import test from 'node:test'
import assert from 'node:assert/strict'
import { createClerkIdentityAuthenticator, createClerkAccountStatusReader } from '../src/identity-provider.mjs'
import { isOperationDenied } from '../src/operation-context.mjs'

const time = 2_000_000_000_000
const issuer = 'https://synthetic.clerk.accounts.dev'
const origin = 'http://localhost:3400'
const internalUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
test('delegated external account reader is uncached, bounded, and never creates a human actor', async () => {
  const f=fixture(), read=createClerkAccountStatusReader({client:f.client,environment:'development',issuer,now:()=>time})
  const key={environment:'development',issuer,subject:'user_synthetic'}
  const result=await read(key)
  assert.deepEqual(result,{...key,status:'ACTIVE',observedAt:new Date(time).toISOString(),expiresAt:new Date(time+5000).toISOString()})
  assert(Object.isFrozen(result)); assert.equal(result.actorId,undefined); assert.equal(result.userId,undefined)
  f.user.locked=true; assert.equal(await read(key),null)
  assert.deepEqual(f.calls,['user','user'])
})
for(const [label,mutate] of [
  ['wrong environment',key=>key.environment='staging'],['wrong issuer',key=>key.issuer='https://foreign.example.test'],
  ['credential instead of subject',key=>key.subject='Bearer synthetic'],['session field',key=>key.sessionId='sess_synthetic'],
  ['on behalf of claim',key=>key.onBehalfOf=internalUser],['missing subject',key=>delete key.subject],
])test('delegated account reader rejects '+label+' before contacting the provider',async()=>{
  const f=fixture(),read=createClerkAccountStatusReader({client:f.client,environment:'development',issuer,now:()=>time})
  const key={environment:'development',issuer,subject:'user_synthetic'};mutate(key)
  assert.equal(await read(key),null);assert.deepEqual(f.calls,[])
})
for(const field of ['banned','locked','deprovisioned','id'])test('delegated account reader rejects changed '+field,async()=>{
  const f=fixture();f.user[field]=field==='id'?'user_foreign':true
  const read=createClerkAccountStatusReader({client:f.client,environment:'development',issuer,now:()=>time})
  assert.equal(await read({environment:'development',issuer,subject:'user_synthetic'}),null)
})
test('delegated account observation expires from the start of the provider call, without stale fallback',async()=>{
  let current=time
  const client={users:{getUser:async()=>{current+=5000;return{id:'user_synthetic',banned:false,locked:false,deprovisioned:false}}}}
  const read=createClerkAccountStatusReader({client,environment:'development',issuer,now:()=>current})
  assert.equal(await read({environment:'development',issuer,subject:'user_synthetic'}),null)
  client.users.getUser=async()=>{throw Error('upstream diagnostic must not escape')}
  await assert.rejects(read({environment:'development',issuer,subject:'user_synthetic'}),error=>isOperationDenied(error)&&error.reasonCode==='POLICY_UNAVAILABLE'&&!error.message.includes('upstream'))
  assert.throws(()=>createClerkAccountStatusReader({client,environment:'staging',issuer}),TypeError)
})
function fixture() {
  const f = { calls: [], app: { appId: 'srm-local', environment: 'development', issuer, authorizedParties: [origin] },
    claims: { iss: issuer, sub: 'user_synthetic', sid: 'sess_synthetic', azp: origin, exp: time / 1000 + 60 },
    session: { id: 'sess_synthetic', userId: 'user_synthetic', status: 'active', expireAt: time + 600_000, abandonAt: time + 600_000, actor: null },
    user: { id: 'user_synthetic', banned: false, locked: false, deprovisioned: false },
    binding: { environment: 'development', issuer, subject: 'user_synthetic', userId: internalUser, status: 'ACTIVE', version: 'binding-v1', sourceRef: 'synthetic-only', expiresAt: new Date(time + 600_000).toISOString() } }
  f.auth = { isAuthenticated: true, tokenType: 'session_token', userId: 'user_synthetic', sessionId: 'sess_synthetic', sessionClaims: f.claims }
  f.state = { status: 'signed-in', isAuthenticated: true, toAuth: () => f.auth }
  f.client = { authenticateRequest: async (_request, options) => { f.calls.push('verify'); assert.equal(options.acceptsToken, 'session_token'); assert.equal(options.clockSkewInMs, 0); assert.deepEqual(options.authorizedParties, [origin]); return f.state },
    sessions: { getSession: async id => { f.calls.push('session'); assert.equal(id, 'sess_synthetic'); return f.session } },
    users: { getUser: async id => { f.calls.push('user'); assert.equal(id, 'user_synthetic'); return f.user } } }
  f.resolveBinding = async key => { f.calls.push('binding'); assert(Object.isFrozen(key)); assert.deepEqual(key, { environment: 'development', issuer, subject: 'user_synthetic' }); return f.binding }
  f.make = () => createClerkIdentityAuthenticator({ client: f.client, application: f.app, resolveBinding: f.resolveBinding, now: () => time })
  f.request = () => new Request(origin + '/api/protected', { headers: { 'x-clerk-user-id': 'attacker', 'x-clerk-org-id': 'foreign-org', 'x-clerk-role': 'admin' } })
  return f
}

test('verified current provider identity maps to a stable internal user without provider roles or email linking', async () => {
  const f = fixture(); f.auth.orgId = 'org_foreign'; f.auth.orgRole = 'org:admin'
  const actor = await f.make()(f.request())
  assert.deepEqual(f.calls, ['verify', 'session', 'user', 'binding'])
  assert.equal(actor.actorId, internalUser); assert.equal(actor.userId, internalUser); assert.equal(actor.kind, 'HUMAN')
  assert.equal(actor.audience, f.app.appId); assert.equal(actor.issuer, issuer); assert(Object.isFrozen(actor))
  assert.equal(actor.expiresAt, new Date(time + 60_000).toISOString())
  assert.deepEqual(Object.keys(actor).sort(), ['kind', 'actorId', 'userId', 'proofRef', 'issuer', 'audience', 'environment', 'expiresAt'].sort())
})

const denied = [
  ['signed-out SDK state', f => { f.state.status = 'signed-out' }],
  ['handshake is not authenticated', f => { f.state.status = 'handshake' }],
  ['pending session', f => { f.auth.isAuthenticated = false }],
  ['machine token cannot impersonate a human', f => { f.auth.tokenType = 'm2m_token' }],
  ['different issuer', f => { f.claims.iss = 'https://foreign.example.test' }],
  ['different subject', f => { f.claims.sub = 'user_foreign' }],
  ['different session ID', f => { f.claims.sid = 'sess_foreign' }],
  ['foreign authorized party', f => { f.claims.azp = 'https://attacker.example.test' }],
  ['expired token', f => { f.claims.exp = time / 1000 }],
  ['impersonated token', f => { f.claims.act = { sub: 'user_operator' } }],
  ['revoked current session', f => { f.session.status = 'revoked' }],
  ['expired current session', f => { f.session.expireAt = time }],
  ['abandoned current session', f => { f.session.abandonAt = time }],
  ['session belongs to another user', f => { f.session.userId = 'user_foreign' }],
  ['impersonated current session', f => { f.session.actor = { sub: 'user_operator' } }],
  ['banned provider user', f => { f.user.banned = true }],
  ['locked provider user', f => { f.user.locked = true }],
  ['deprovisioned provider user', f => { f.user.deprovisioned = true }],
  ['missing active-user status', f => { delete f.user.banned }],
  ['mismatched provider user', f => { f.user.id = 'user_foreign' }],
  ['unbound identity', f => { f.binding = null }],
  ['disabled internal identity', f => { f.binding.status = 'DISABLED' }],
  ['binding for another environment', f => { f.binding.environment = 'staging' }],
  ['binding for another issuer', f => { f.binding.issuer = 'https://foreign.example.test' }],
  ['binding for another subject', f => { f.binding.subject = 'user_foreign' }],
  ['provider ID is not an internal UUID', f => { f.binding.userId = 'user_synthetic' }],
  ['expired binding', f => { f.binding.expiresAt = new Date(time).toISOString() }],
  ['binding without a version', f => { f.binding.version = '' }],
]
for (const [name, mutate] of denied) test(name + ' fails closed', async () => { const f = fixture(); mutate(f); assert.equal(await f.make()(f.request()), null) })

for (const boundary of ['verify', 'session', 'user', 'binding']) test(boundary + ' authority outage denies instead of falling back', async () => {
  const f = fixture(); const unavailable = async () => { throw Error('sensitive upstream diagnostic') }
  if (boundary === 'verify') f.client.authenticateRequest = unavailable
  else if (boundary === 'session') f.client.sessions.getSession = unavailable
  else if (boundary === 'user') f.client.users.getUser = unavailable
  else f.resolveBinding = unavailable
  await assert.rejects(f.make()(f.request()), error => isOperationDenied(error) && error.reasonCode === 'POLICY_UNAVAILABLE' && !error.message.includes('sensitive'))
})

test('revocation and disabled binding take effect on the next operation without cached ALLOW', async () => {
  const f = fixture(), authenticate = f.make()
  assert(await authenticate(f.request())); f.session.status = 'revoked'; assert.equal(await authenticate(f.request()), null)
  f.session.status = 'active'; f.binding.status = 'REVOKED'; assert.equal(await authenticate(f.request()), null)
})
test('request origin and cookie mutation intent are checked before authority calls', async () => {
  const f = fixture(), authenticate = f.make()
  for (const request of [{ verified: true }, new Request('https://foreign.example.test/api'), new Request(origin + '/api', { headers: { origin: 'https://foreign.example.test' } }), new Request(origin + '/api', { method: 'POST', headers: { cookie: 'opaque' } })]) assert.equal(await authenticate(request), null)
  assert.deepEqual(f.calls, [])
  assert(await authenticate(new Request(origin + '/api', { method: 'POST', headers: { origin } })))
})
test('configuration is pinned and rejects wildcards, credential URLs and release use of development identity', async () => {
  const f = fixture(), authenticate = f.make(); f.app.authorizedParties.push('https://foreign.example.test'); f.app.issuer = 'https://foreign.example.test'
  assert(await authenticate(f.request()))
  for (const patch of [{ authorizedParties: ['https://*.example.test'] }, { issuer: 'https://user:password@example.test' }, { authorizedParties: [] }, { environment: 'staging' }, { environment: 'production' }]) {
    const x = fixture(); assert.throws(() => createClerkIdentityAuthenticator({ client: x.client, application: { ...x.app, ...patch }, resolveBinding: x.resolveBinding }))
  }
})
