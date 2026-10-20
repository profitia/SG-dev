import test from 'node:test'
import assert from 'node:assert/strict'
import { createClerkIdentityAuthenticator } from '../src/identity-provider.mjs'
import { isOperationDenied } from '../src/operation-context.mjs'

const time = 2_000_000_000_000
const sourceOrigin = 'https://spendguru.example.test', targetOrigin = 'https://srm.example.test'
const otherOrigin = 'https://other.example.test', issuer = 'https://synthetic.clerk.accounts.dev'
const path = '/api/xray/financial-summary', internalUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const rule = () => ({ sourceOrigin, targetOrigin, path })

function fixture() {
  const f = {
    calls: [], app: { appId: 'srm-local', environment: 'development', issuer,
      authorizedParties: [sourceOrigin, targetOrigin, otherOrigin], bearerPeerReads: [rule()] },
    claims: { iss: issuer, sub: 'user_synthetic', sid: 'sess_synthetic', azp: sourceOrigin, exp: time / 1000 + 60 },
    session: { id: 'sess_synthetic', userId: 'user_synthetic', status: 'active', actor: null, expireAt: time + 600_000, abandonAt: time + 600_000 },
    user: { id: 'user_synthetic', banned: false, locked: false, deprovisioned: false },
    binding: { environment: 'development', issuer, subject: 'user_synthetic', userId: internalUser, status: 'ACTIVE', version: 'binding-v1', sourceRef: 'synthetic-only', expiresAt: new Date(time + 600_000).toISOString() },
  }
  f.auth = { isAuthenticated: true, tokenType: 'session_token', userId: 'user_synthetic', sessionId: 'sess_synthetic', sessionClaims: f.claims }
  f.state = { status: 'signed-in', isAuthenticated: true, toAuth: () => f.auth }
  f.client = {
    authenticateRequest: async (request, options) => {
      f.calls.push('verify'); f.sdkRequest = request
      assert.deepEqual(options, { acceptsToken: 'session_token', authorizedParties: [sourceOrigin, targetOrigin, otherOrigin], clockSkewInMs: 0 })
      if (f.onVerify) await f.onVerify(request)
      return f.state
    },
    sessions: { getSession: async id => { f.calls.push('session'); assert.equal(id, 'sess_synthetic'); return f.session } },
    users: { getUser: async id => { f.calls.push('user'); assert.equal(id, 'user_synthetic'); return f.user } },
  }
  f.resolveBinding = async key => {
    f.calls.push('binding'); assert(Object.isFrozen(key))
    assert.deepEqual(key, { environment: 'development', issuer, subject: 'user_synthetic' })
    return f.binding
  }
  f.make = () => createClerkIdentityAuthenticator({ client: f.client, application: f.app, resolveBinding: f.resolveBinding, now: () => time })
  f.request = (url = targetOrigin + path, init = {}) => new Request(url, { ...init, headers: { authorization: 'Bearer synthetic-session', ...init.headers } })
  return f
}

test('only the explicit peer read returns the current authoritative internal actor', async () => {
  const f = fixture(), request = f.request(targetOrigin + path + '?nip=5260250995&organisationId=untrusted')
  f.auth.orgId = 'untrusted'; f.auth.orgRole = 'admin'
  const actor = await f.make()(request)
  assert.deepEqual(f.calls, ['verify', 'session', 'user', 'binding'])
  assert.deepEqual(actor, { kind: 'HUMAN', actorId: internalUser, userId: internalUser,
    proofRef: 'clerk-session:sess_synthetic:binding:binding-v1', issuer,
    audience: 'srm-local', environment: 'development', expiresAt: new Date(time + 60_000).toISOString() })
  assert(Object.isFrozen(actor)); assert.notEqual(f.sdkRequest, request)
  assert.equal(f.sdkRequest.url, request.url)
  assert.equal(actor.organisationId, undefined); assert.equal(actor.role, undefined)
})

test('listing both origins alone never enables the peer read', async () => {
  for (const configured of [undefined, []]) {
    const f = fixture(); f.app.bearerPeerReads = configured
    assert.equal(await f.make()(f.request()), null)
    assert.deepEqual(f.calls, ['verify'])
  }
})

for (const [label, request] of [
  ['POST', f => f.request(undefined, { method: 'POST' })],
  ['HEAD', f => f.request(undefined, { method: 'HEAD' })],
  ['OPTIONS', f => f.request(undefined, { method: 'OPTIONS' })],
  ['another path', f => f.request(targetOrigin + '/api/xray/refresh')],
  ['trailing slash', f => f.request(targetOrigin + path + '/')],
  ['encoded path', f => f.request(targetOrigin + '/api/xray/%66inancial-summary')],
  ['double separator', f => f.request(targetOrigin + '/api//xray/financial-summary')],
  ['URL fragment', f => f.request(targetOrigin + path + '#hint')],
  ['different receiver', f => f.request(otherOrigin + path)],
  ['unapproved receiver', f => f.request('https://attacker.example.test' + path)],
  ['Cookie', f => f.request(undefined, { headers: { cookie: '__session=synthetic' } })],
  ['empty Cookie', f => f.request(undefined, { headers: { cookie: '' } })],
  ['Origin even matching receiver', f => f.request(undefined, { headers: { origin: targetOrigin } })],
  ['Origin matching sender', f => f.request(undefined, { headers: { origin: sourceOrigin } })],
  ['no authorization', f => new Request(targetOrigin + path)],
  ['wrong authorization scheme', f => f.request(undefined, { headers: { authorization: 'Basic synthetic' } })],
  ['ambiguous bearer list', f => f.request(undefined, { headers: { authorization: 'Bearer synthetic, Bearer second' } })],
  ['unbounded bearer value', f => f.request(undefined, { headers: { authorization: 'Bearer ' + 'x'.repeat(16385) } })],
]) test('peer identity rejects ' + label, async () => {
  const f = fixture(); assert.equal(await f.make()(request(f)), null)
  assert(!f.calls.includes('binding'))
})

test('a different already-listed sender is denied; reverse direction is not implied', async () => {
  const f = fixture(); f.claims.azp = otherOrigin
  assert.equal(await f.make()(f.request()), null)
  f.claims.azp = targetOrigin
  assert.equal(await f.make()(f.request(sourceOrigin + path)), null)
})

test('ordinary same-origin identity retains its previous behavior', async () => {
  const f = fixture(); f.claims.azp = targetOrigin
  assert(await f.make()(new Request(targetOrigin + '/ordinary', { headers: { cookie: 'synthetic', origin: targetOrigin } })))
  f.calls.length = 0
  assert.equal(await f.make()(new Request(targetOrigin + '/ordinary', { method: 'POST', headers: { cookie: 'synthetic' } })), null)
  assert.deepEqual(f.calls, [])
})

for (const [label, policy] of [
  ['null policy', null], ['object instead of list', rule()], ['unbounded list', Array.from({ length: 17 }, rule)],
  ['duplicate', [rule(), rule()]], ['null entry', [null]], ['extra policy field', [{ ...rule(), methods: ['POST'] }]],
  ['missing source', [{ targetOrigin, path }]], ['same origins', [{ ...rule(), sourceOrigin: targetOrigin }]],
  ['unlisted source', [{ ...rule(), sourceOrigin: 'https://unlisted.example.test' }]],
  ['wildcard source', [{ ...rule(), sourceOrigin: 'https://*.example.test' }]],
  ['credential origin', [{ ...rule(), sourceOrigin: 'https://user:pass@spendguru.example.test' }]],
  ['trailing origin slash', [{ ...rule(), targetOrigin: targetOrigin + '/' }]],
  ['path prefix wildcard', [{ ...rule(), path: '/api/*' }]], ['query in path', [{ ...rule(), path: path + '?x=1' }]],
  ['fragment in path', [{ ...rule(), path: path + '#x' }]], ['encoded path', [{ ...rule(), path: '/api/%66oo' }]],
  ['dot path segment', [{ ...rule(), path: '/api/../foo' }]], ['double separator', [{ ...rule(), path: '/api//foo' }]],
  ['backslash', [{ ...rule(), path: '/api\\foo' }]], ['oversized path', [{ ...rule(), path: '/' + 'a'.repeat(256) }]],
]) test('configuration rejects ' + label, () => {
  const f = fixture(); f.app.bearerPeerReads = policy; assert.throws(f.make, TypeError)
  assert.deepEqual(f.calls, [])
})

test('deployment policy and captured bearer transport cannot change across provider awaits', async () => {
  const f = fixture(), authenticate = f.make(), request = f.request()
  f.app.bearerPeerReads[0].path = '/api/other'; f.app.bearerPeerReads[0].sourceOrigin = otherOrigin
  f.app.bearerPeerReads.length = 0; f.app.authorizedParties.length = 0
  f.onVerify = async sdkRequest => {
    request.headers.set('authorization', 'Bearer changed'); request.headers.set('cookie', 'changed'); request.headers.set('origin', sourceOrigin)
    await Promise.resolve()
    assert.equal(sdkRequest.headers.get('authorization'), 'Bearer synthetic-session')
    assert.equal(sdkRequest.headers.has('cookie'), false); assert.equal(sdkRequest.headers.has('origin'), false)
  }
  assert(await authenticate(request))
})

for (const [label, mutate] of [
  ['unsigned result', f => f.state.status = 'signed-out'], ['machine token', f => f.auth.tokenType = 'm2m_token'],
  ['wrong issuer', f => f.claims.iss = 'https://foreign.example.test'], ['wrong subject', f => f.claims.sub = 'foreign'],
  ['expired token', f => f.claims.exp = time / 1000], ['impersonation', f => f.claims.act = { sub: 'operator' }],
  ['revoked session', f => f.session.status = 'revoked'], ['expired session', f => f.session.expireAt = time],
  ['abandoned session', f => f.session.abandonAt = time], ['foreign session owner', f => f.session.userId = 'foreign'],
  ['disabled account', f => f.user.locked = true], ['banned account', f => f.user.banned = true],
  ['deprovisioned account', f => f.user.deprovisioned = true], ['unbound identity', f => f.binding = null],
  ['revoked binding', f => f.binding.status = 'REVOKED'], ['wrong environment binding', f => f.binding.environment = 'staging'],
  ['expired binding', f => f.binding.expiresAt = new Date(time).toISOString()],
]) test('peer policy does not bypass ' + label, async () => {
  const f = fixture(); mutate(f); assert.equal(await f.make()(f.request()), null)
})

test('peer reads recheck revocation and binding on each operation', async () => {
  const f = fixture(), authenticate = f.make()
  assert(await authenticate(f.request())); f.session.status = 'revoked'; assert.equal(await authenticate(f.request()), null)
  f.session.status = 'active'; f.binding.status = 'REVOKED'; assert.equal(await authenticate(f.request()), null)
})

for (const boundary of ['verify', 'session', 'user', 'binding']) test('peer read fails closed on ' + boundary + ' authority outage', async () => {
  const f = fixture(), unavailable = async () => { throw Error('private diagnostic must not escape') }
  if (boundary === 'verify') f.client.authenticateRequest = unavailable
  else if (boundary === 'session') f.client.sessions.getSession = unavailable
  else if (boundary === 'user') f.client.users.getUser = unavailable
  else f.resolveBinding = unavailable
  await assert.rejects(f.make()(f.request()), error => isOperationDenied(error) && error.reasonCode === 'POLICY_UNAVAILABLE' && !error.message.includes('diagnostic'))
})
