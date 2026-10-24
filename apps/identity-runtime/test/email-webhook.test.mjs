import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createClerkEmailVerifier } from '../dist/src/email-webhook.js'

// Synthetic signing key and OTP; no provider credentials or real messages.
const key = Buffer.alloc(32, 7), secret = 'whsec_' + key.toString('base64')
const clock = Date.now(), seconds = String(Math.floor(Date.now() / 1000)), eventId = 'msg_test1234'
const config = { environment: 'development', instanceId: 'ins_test1234', signingSecret: secret }
const event = { type: 'email.created', object: 'event', instance_id: config.instanceId, timestamp: clock,
  data: { object: 'email', id: 'ema_test1234', slug: 'verification_code', delivered_by_clerk: false,
    to_email_address: 'Recipient@example.com', email_address_id: 'idn_test1234', user_id: null,
    body: '<script>untrusted body</script>', subject: 'ignored subject',
    data: { otp_code: '123456', user: { public_metadata: { assistantAvatar: 'female' } } } } }
function signed(payload = event, overrides = {}, signKey = key) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const timestamp = overrides.timestamp ?? seconds, messageId = overrides.messageId ?? eventId
  const signature = createHmac('sha256', signKey).update(`${messageId}.${timestamp}.${body}`).digest('base64')
  return new Request('https://identity.example/v1/webhooks/clerk-email', { method: overrides.method ?? 'POST',
    headers: { 'content-type': 'application/json', 'svix-id': messageId, 'svix-timestamp': timestamp,
      'svix-signature': 'v1,' + signature, ...overrides.headers }, body })
}
const verify = createClerkEmailVerifier(config, () => clock)

test('application invitation is opt-in, exact allowed origin, bounded expiry, original signed action only',async()=>{
  const verifier=createClerkEmailVerifier({...config,allowedInvitationOrigins:['https://identity.example']},()=>clock)
  const payload={...event,data:{...event.data,slug:'invitation',data:{action_url:'https://identity.example/invite?ticket=synthetic',invitation:{expires_in_days:7}}}}
  const result=await verifier(signed(payload));assert.equal(result.instruction.kind,'invitation')
  assert.equal(result.instruction.actionUrl,payload.data.data.action_url);assert.equal(result.instruction.expiresInDays,7)
  for(const data of [{action_url:'https://evil.example/invite',invitation:{expires_in_days:7}},
    {action_url:'https://evil@identity.example/invite',invitation:{expires_in_days:7}},
    {action_url:'https://identity.example/invite',invitation:{expires_in_days:0}},
    {action_url:'https://identity.example/invite',invitation:{expires_in_days:'7'}},
    {action_url:'javascript:alert(1)',invitation:{expires_in_days:7}}])
    await assert.rejects(()=>verifier(signed({...payload,data:{...payload.data,data}})))
  assert.deepEqual(await verify(signed(payload)),{status:'ignored',reason:'unsupported-template'})
})

test('real SDK verifies signature, selects only minimal delivery fields, never metadata or HTML', async () => {
  const result = await verify(signed())
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.instruction, { eventId, emailId: 'ema_test1234', instanceId: config.instanceId,
    createdAt: clock, recipient: 'Recipient@example.com', emailAddressId: 'idn_test1234', providerUserId: null,
    kind: 'verification-code', otpCode: '123456', expiresAt: clock + 300000 })
  assert.equal(Object.hasOwn(result.instruction, 'avatar'), false)
  assert.ok(Object.isFrozen(result.instruction))
})

test('wrong key, altered body, absent headers, duplicate header lists and stale Svix timestamps fail', async () => {
  const altered = signed(); const headers = altered.headers
  for (const request of [signed(event, {}, Buffer.alloc(32, 8)),
    new Request(altered.url, { method: 'POST', headers, body: JSON.stringify({ ...event, timestamp: clock + 1 }) }),
    signed(event, { headers: { 'svix-signature': '' } }), signed(event, { headers: { 'svix-id': eventId + ',' + eventId } }),
    signed(event, { timestamp: String(Number(seconds) - 600) }),
    signed(event, { headers: { 'svix-timestamp': seconds + ',' + seconds } }),
  ]) await assert.rejects(() => verify(request), { message: 'EMAIL_EVENT_REJECTED' })
})

test('signed foreign instance, event type, recipient injection, non-code, suppression fail closed', async () => {
  const bad = [{ ...event, instance_id: 'ins_foreign1' }, { ...event, type: 'user.created' },
    ...[{ to_email_address: 'one@example.com,two@example.com' }, { to_email_address: 'x@example.com\r\nBcc: evil@example.com' },
      { data: { otp_code: '{{secret}}' } }, { data: { otp_code: 123456 } }, { user_id: '123' },
      { suppression_reason: 'recipient_suppressed' }, { delivered_by_clerk: 'false' }, { object: 'sms' }]
      .map(data => ({ ...event, data: { ...event.data, ...data } }))]
  for (const payload of bad) await assert.rejects(() => verify(signed(payload)), { message: 'EMAIL_EVENT_REJECTED' })
})

test('Clerk delivery stays single owner; unsupported templates never become generic OTPs', async () => {
  assert.deepEqual(await verify(signed({ ...event, data: { ...event.data, delivered_by_clerk: true } })),
    { status: 'ignored', reason: 'clerk-delivery' })
  for (const slug of ['invitation', 'organization_invitation', 'reset_password_code', 'unknown'])
    assert.deepEqual(await verify(signed({ ...event, data: { ...event.data, slug } })), { status: 'ignored', reason: 'unsupported-template' })
})

test('fresh signatures cannot revive stale events; seconds/ms normalize; future events rejected', async () => {
  assert.deepEqual(await verify(signed({ ...event, timestamp: clock - 300000 })), { status: 'ignored', reason: 'expired' })
  assert.equal((await verify(signed({ ...event, timestamp: Math.floor(clock / 1000) }))).status, 'ready')
  for (const timestamp of [clock + 30001, '123', -1, 1.5])
    await assert.rejects(() => verify(signed({ ...event, timestamp })), { message: 'EMAIL_EVENT_REJECTED' })
})

test('bounded JSON bytes, strict transport and explicit Development configuration', async () => {
  for (const override of [{ environment: 'production' }, { environment: 'staging' }, { instanceId: '' }, { signingSecret: '' }])
    assert.throws(() => createClerkEmailVerifier({ ...config, ...override }))
  for (const request of [signed(event, { method: 'PUT' }), signed(event, { headers: { 'content-type': 'text/plain' } }),
    signed(event, { headers: { 'content-encoding': 'gzip' } }), signed('x'.repeat(131073)), signed('not JSON'),
    signed(event, { headers: { 'content-length': '1' } }), signed(event, { headers: { 'content-length': '999999' } }),
  ]) await assert.rejects(() => verify(request), { message: 'EMAIL_EVENT_REJECTED' })
})
