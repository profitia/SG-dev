import test, { before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createClerkClient } from '@clerk/backend'
import { createClerkIdentityAuthenticator } from '../../../packages/platform-contracts/src/identity-provider.mjs'
import { isOperationDenied } from '../../../packages/platform-contracts/src/operation-context.mjs'

// Every key, token, user and provider response below is synthetic and disposable.
// Only the loopback fixture receives SDK API calls; no Clerk tenant or customer is used.
const issuer = 'https://synthetic.clerk.accounts.dev', origin = 'http://localhost:3400'
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const networkFetch = globalThis.fetch
let server, apiUrl, mode = 'active', calls = []
before(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url, 'http://synthetic-fixture').pathname
    calls.push(path); response.setHeader('content-type', 'application/json')
    if (mode === 'provider-error') { response.writeHead(401); response.end(JSON.stringify({ errors: [{ code: 'synthetic_error', message: 'Synthetic fixture only' }] })); return }
    const timestamp = Date.now()
    if (path === '/v1/sessions/sess_fixture') response.end(JSON.stringify({ object: 'session', id: 'sess_fixture', client_id: 'client_fixture', user_id: 'user_fixture', status: mode === 'revoked' ? 'revoked' : 'active', actor: null, expire_at: timestamp + 600_000, abandon_at: timestamp + 600_000, created_at: timestamp, updated_at: timestamp, last_active_at: timestamp }))
    else if (path === '/v1/users/user_fixture') response.end(JSON.stringify({ object: 'user', id: 'user_fixture', banned: mode === 'banned', locked: false, deprovisioned: false, password_enabled: false, two_factor_enabled: false, totp_enabled: false, backup_code_enabled: false, email_addresses: [], phone_numbers: [], web3_wallets: [], external_accounts: [], saml_accounts: [], enterprise_accounts: [], passkeys: [], public_metadata: {}, private_metadata: {}, unsafe_metadata: {}, created_at: timestamp, updated_at: timestamp }))
    else { response.writeHead(404); response.end('{}') }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  apiUrl = `http://127.0.0.1:${server.address().port}`
  mock.method(globalThis, 'fetch', (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    assert.equal(url.origin, apiUrl, 'Official SDK tests may only contact their loopback fixture')
    return networkFetch(input, init)
  })
})
after(async () => { mock.restoreAll(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
function fixture() {
  mode = 'active'; calls = []
  const client = createClerkClient({ secretKey: 'sk_test_fixture', publishableKey: 'pk_test_' + Buffer.from('synthetic.clerk.accounts.dev$').toString('base64'), apiUrl, jwtKey: keys.publicKey.export({ type: 'spki', format: 'pem' }), telemetry: { disabled: true } })
  const authenticate = createClerkIdentityAuthenticator({ client, application: { appId: 'srm-local', environment: 'development', issuer, authorizedParties: [origin] }, resolveBinding: async key => ({ ...key, userId, status: 'ACTIVE', version: 'synthetic-v1', sourceRef: 'fixture-only', expiresAt: new Date(Date.now() + 600_000).toISOString() }) })
  const request = (patch = {}, signingKey = keys.privateKey) => {
    const now = Math.floor(Date.now() / 1000)
    const claims = { v: 2, iss: issuer, sub: 'user_fixture', sid: 'sess_fixture', azp: origin, iat: now, nbf: now - 1, exp: now + 60, ...patch }
    const data = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'synthetic-key' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url')
    const jwt = data + '.' + sign('RSA-SHA256', Buffer.from(data), signingKey).toString('base64url')
    return new Request(origin + '/api/protected', { headers: { authorization: 'Bearer ' + jwt } })
  }
  return { authenticate, request }
}

test('official SDK verifies a real RSA-signed fixture, reads current session/user, and returns internal identity', async () => {
  const f = fixture(), actor = await f.authenticate(f.request())
  assert(actor, 'Official SDK verification must succeed, never skip')
  assert.equal(actor.actorId, userId); assert.equal(actor.userId, userId); assert.equal(actor.audience, 'srm-local')
  assert.deepEqual(calls, ['/v1/sessions/sess_fixture', '/v1/users/user_fixture'])
})
test('official SDK rejects a forged signature before authority/API access', async () => {
  const f = fixture(), other = generateKeyPairSync('rsa', { modulusLength: 2048 })
  assert.equal(await f.authenticate(f.request({}, other.privateKey)), null); assert.deepEqual(calls, [])
})
for (const [name, claims] of [['expired', { exp: 1 }], ['wrong issuer', { iss: 'https://foreign.clerk.accounts.dev' }], ['wrong party', { azp: 'https://attacker.example.test' }], ['future activation', { nbf: Math.floor(Date.now() / 1000) + 600 }]]) test('real signed token with ' + name + ' is denied', async () => {
  const f = fixture(); assert.equal(await f.authenticate(f.request(claims)), null); assert.deepEqual(calls, [])
})
test('a valid signed token cannot retain access after current session revocation', async () => {
  const f = fixture(), request = f.request(); assert(await f.authenticate(request)); mode = 'revoked'
  assert.equal(await f.authenticate(request), null); assert.equal(calls.filter(x => x.includes('/sessions/')).length, 2)
})
test('a valid signed token cannot retain access after the user is banned', async () => {
  const f = fixture(); mode = 'banned'; assert.equal(await f.authenticate(f.request()), null)
  assert.deepEqual(calls, ['/v1/sessions/sess_fixture', '/v1/users/user_fixture'])
})
test('current provider failure is unavailable, without fallback to a valid JWT alone', async () => {
  const f = fixture(); mode = 'provider-error'
  await assert.rejects(f.authenticate(f.request()), error => isOperationDenied(error) && error.reasonCode === 'POLICY_UNAVAILABLE')
})
