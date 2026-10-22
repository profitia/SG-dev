import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { request as httpRequest } from 'node:http'
import { randomBytes } from 'node:crypto'
import { fixture, ids, issuer, origin } from './fixtures.mjs'
import { createAccountSurface, accountTransactions } from '../dist/src/account-provisioning.js'
import { accountPage, accountBrowserScript } from '../dist/src/account-page.js'
import { createHttpHandler } from '../dist/src/http-handler.js'
import { createNodeServer } from '../dist/src/node-server.js'

function accountFixture(patch = {}) {
  const f = fixture(patch), baseGetUser = f.client.users.getUser
  f.client.users.getUser = async id => ({ ...await baseGetUser(id), primaryEmailAddressId: 'primary',
    emailAddresses: [{ id: 'primary', verification: { status: f.unverified ? 'unverified' : 'verified' } }] })
  const binding = { applicationId: f.config.applicationId, environment: 'development', projectId: 'synthetic', branchId: 'synthetic', databaseName: 'synthetic', role: 'identity_b1_runtime', schemaDigest: 'a'.repeat(64) }
  f.sql = []; f.releases = []; f.created = new Set()
  const pool = { async connect() { return { async query(sql, values) {
    f.sql.push(sql)
    if (sql === 'COMMIT' && f.commitFailure) throw Error('synthetic commit failure')
    if (sql.includes('profitia_profile.runtime_descriptor')) return { rows: [{ descriptor: { ...binding, profileSchemaDigest: 'b'.repeat(64), issuer, enabled: !f.disabledPolicy } }] }
    if (sql.includes('profitia_profile.binding_renewal_descriptor')) return { rows: [{ descriptor: { renewalSchemaDigest: f.wrongRenewalDigest ? 'e'.repeat(64) : 'c'.repeat(64) } }] }
    if (sql.includes('profitia_profile.binding_renewal_metadata')) return { rows: [{ metadata: f.bindingMissing ? null : {
      userId: ids.a, version: ids.a + ':1:1', revision: 1, expiresAt: new Date(f.now + (f.bindingExpired ? -1000 : 120000)).toISOString(),
      allowRenewal: !f.disabledRenewal, allowExpiredRecovery: !f.disabledRenewal, maxRecoveryAgeMs: 604800000 } }] }
    if (sql.includes('profitia_profile.renew_binding')) { f.bindingExpired = false; return { rows: [{ binding: {} }] } }
    if (sql.includes('txid_current')) return { rows: [{ transaction_id: '42' }] }
    if (sql.includes('provision_account')) {
      if (f.bindingStatus !== 'ACTIVE' || f.bindingExpired) throw Object.assign(Error('synthetic deny'), { code: 'PT403' })
      f.created.add(values[1]); f.bindingMissing = false
      return { rows: [{ user_id: ids[values[1].slice(-1)] }] }
    }
    if (sql.includes('current_database()')) return { rows: [{ database_name: binding.databaseName, role: binding.role, login: binding.role,
      rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false,
      descriptor: { ...binding, schemaVersion: '1.0.0' } }] }
    if (sql.includes('profitia_access.identity_binding')) return { rows: [{ binding: await f.authority.resolveBinding({ environment: 'development', issuer: values[0], subject: values[1] }) }] }
    return { rows: [] }
  }, release(destroy = false) { f.releases.push(destroy) } } } }
  f.account = createAccountSurface({ configuration: f.config, client: f.client, authority: f.authority, binding,
    schemaDigest: 'b'.repeat(64), ...(f.renewal ? { renewalSchemaDigest: 'c'.repeat(64) } : {}), proofKey: randomBytes(32), transact: accountTransactions(pool), now: () => f.now })
  f.handler = createHttpHandler(f.boundary, f.account)
  return f
}

test('account surfaces are disabled by default, without provider/SQL activity', async () => {
  const f = fixture(), h = createHttpHandler(f.boundary)
  for (const path of ['/v1/account', '/account/sg2/account/registration', '/account-client']) assert.equal((await h(f.request(path))).status, 503)
  assert.equal(f.calls.length, 0)
})
test('same-origin verified session provisions through unchanged B1, then rereads current identity', async () => {
  const f = accountFixture({ bindingMissing: true }), response = await f.handler(f.request('/v1/account', 'POST', {}))
  assert.equal(response.status, 200); const result = await response.json()
  assert.deepEqual(Object.keys(result).sort(), ['authenticated', 'expiresAt', 'userId'])
  assert.equal(result.userId, ids.a); assert.equal(result.authenticated, true)
  assert(f.sql.some(s => s.includes('profitia_profile.provision_account'))); assert(f.sql.includes('BEGIN')); assert(f.sql.includes('COMMIT'))
  assert(!f.sql.some(s => /organisation|membership|grant/i.test(s))); assert.equal(f.created.size, 1)
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('access-control-allow-origin'), null)
})
test('retry/concurrent same-identity wiring retains one stable account; other identity remains distinct', async () => {
  const f = accountFixture()
  const results = await Promise.all(Array.from({ length: 3 }, () => f.handler(f.request('/v1/account', 'POST', {})).then(r => r.json())))
  assert(results.every(r => r.userId === ids.a)); assert.equal(f.created.size, 1)
  f.user = 'b'; const other = await f.handler(f.request('/v1/account', 'POST', {})); assert.equal((await other.json()).userId, ids.b)
  assert.equal(f.created.size, 2)
})
for (const patch of [{ unverified: true }, { sessionStatus: 'revoked' }, { banned: true }, { locked: true }, { deprovisioned: true }, { providerError: true }, { disabledPolicy: true }, { bindingStatus: 'REVOKED' }, { bindingExpired: true }, { party: 'https://foreign.example.test' }]) {
  test('registration fails closed: ' + JSON.stringify(patch), async () => {
    const f = accountFixture(patch), response = await f.handler(f.request('/v1/account', 'POST', {}))
    assert.notEqual(response.status, 200); assert.equal((await response.json()).authenticated, undefined)
    assert(!f.sql.includes('COMMIT')); assert(f.sql.includes('ROLLBACK'))
  })
}
test('commit failure never produces account success; cleanup does not release a poisoned transaction as active', async () => {
  const f = accountFixture({ commitFailure: true }), response = await f.handler(f.request('/v1/account', 'POST', {}))
  assert.equal(response.status, 503); assert(f.sql.includes('ROLLBACK')); assert.equal(f.releases.length, 1)
})
test('opt-in HTTP account completion renews an expired ACTIVE binding before its independent read', async () => {
  const f = accountFixture({ renewal: true, bindingExpired: true })
  const response = await f.handler(f.request('/v1/account', 'POST', {}))
  assert.equal(response.status, 200); assert.equal((await response.json()).userId, ids.a)
  assert(f.sql.some(s => s.includes('renew_binding'))); assert(f.sql.includes('COMMIT'))
  assert(!f.sql.some(s => s.includes('provision_account'))); assert.equal(f.created.size, 0)
})
test('opt-in remains fail closed for disabled recovery, wrong installation and revoked accounts', async () => {
  for (const patch of [{ disabledRenewal: true }, { wrongRenewalDigest: true }, { bindingStatus: 'REVOKED' }]) {
    const f = accountFixture({ renewal: true, bindingExpired: true, ...patch })
    assert.notEqual((await f.handler(f.request('/v1/account', 'POST', {}))).status, 200)
    assert(!f.sql.includes('COMMIT')); assert(f.sql.includes('ROLLBACK'))
  }
})
test('opt-in first registration still uses B1 and commit failure never confirms an account', async () => {
  const f = accountFixture({ renewal: true, bindingMissing: true })
  assert.equal((await f.handler(f.request('/v1/account', 'POST', {}))).status, 200)
  assert(f.sql.some(s => s.includes('provision_account')))
  const failed = accountFixture({ renewal: true, bindingExpired: true, commitFailure: true })
  assert.equal((await failed.handler(failed.request('/v1/account', 'POST', {}))).status, 503)
  assert(failed.sql.includes('ROLLBACK'))
})
test('peer path is GET-only, current verified binding required, never anonymous or browser CORS', async () => {
  const f = accountFixture({ party: 'https://sg2.example.test' }), req = new Request(origin + '/v1/account', { headers: { authorization: 'Bearer synthetic_fixture_only' } })
  assert.equal((await f.handler(req)).status, 200); assert.equal(f.sql.length, 0)
  assert.equal((await f.handler(f.request('/v1/account', 'POST', {}))).status, 503)
  assert(!f.sql.some(s => s.includes('provision_account')))
  assert.equal((await f.handler(new Request(origin + '/v1/account', { headers: { origin: 'https://sg2.example.test', authorization: 'Bearer synthetic_fixture_only' } }))).status, 403)
  f.bindingExpired = true; assert.notEqual((await f.handler(req)).status, 200)
})
test('request intent cannot choose an identity, organisation, target or entitlement', async () => {
  const f = accountFixture()
  for (const value of [{ userId: ids.b }, { organisationId: ids.b }, { role: 'ADMIN' }, { verified: true }]) assert.equal((await f.handler(f.request('/v1/account', 'POST', value))).status, 400)
  assert.equal(f.sql.length, 0)
  const foreign = new Request(origin + '/v1/account', { method: 'POST', headers: { origin: 'https://foreign.test', 'content-type': 'application/json' }, body: '{}' })
  assert.equal((await f.handler(foreign)).status, 403); assert.equal(f.sql.length, 0)
})
test('transaction abort destroys connection once; late callbacks cannot query or commit on a reused connection', async () => {
  const calls = [], releases = [], controller = new AbortController(); let query, finish
  const pool = { connect: async () => ({ query: async sql => { calls.push(sql); return { rows: [] } }, release: destroy => releases.push(destroy) }) }
  const work = accountTransactions(pool)(async s => { query = s.query; await new Promise(r => { finish = r }); await query('LATE'); return 1 }, { timeoutMs: 15000, maxWaitMs: 5000 }, controller.signal)
  while (!finish) await new Promise(r => setImmediate(r))
  controller.abort(); await assert.rejects(work); finish(); await new Promise(r => setImmediate(r))
  assert.deepEqual(releases, [true]); assert.deepEqual(calls, ['BEGIN']); await assert.rejects(query('LATER'))
})
test('account page uses official pinned SDK, closed destination and a parseable script without persistent secrets', () => {
  const f = fixture(), html = accountPage(f.config, 'sg2', 'account', 'registration')
  assert(html.includes('@clerk/clerk-js@6.40.0')); assert(html.includes('@clerk/ui@1.41.1'))
  assert(html.includes('https://sg2.example.test/account')); assert(!html.includes('sk_test_'))
  assert.throws(() => accountPage(f.config, 'foreign', 'account', 'registration'))
  new vm.Script(accountBrowserScript)
  assert(!/localStorage|sessionStorage|document\.cookie|setInterval|session_token/.test(accountBrowserScript))
  // Custom password input is sent only to the pinned SDK; the conversation masks it.
  assert(accountBrowserScript.includes("attemptFirstFactor({ strategy: 'password', password: input })"))
  assert(accountBrowserScript.includes("['password','code'].includes(step)"))
})

const browserAccount = (userId = ids.a) => ({ authenticated: true, userId, expiresAt: new Date(Date.now() + 60000).toISOString() })
function browserFixture({ signedIn = true, response = () => new Response(JSON.stringify(browserAccount())), loadFailure = false, logoutFailure = false } = {}) {
  const elements = Object.fromEntries(['account-config', 'status', 'retry', 'logout', 'sign-in'].map(id => [id, { textContent: '', hidden: true, replaceChildren() {} }]))
  elements['account-config'].textContent = JSON.stringify({ en: false, flow: 'registration', returnTo: 'https://sg2.example.test/account',
    signInUrl: origin + '/account/sg2/account/login', signUpUrl: origin + '/account/sg2/account/registration', allowedRedirectOrigins: [origin, 'https://sg2.example.test'], localization: {} })
  const f = { elements, calls: [], redirects: [], mounted: 0, reloaded: 0 }
  f.clerk = { session: signedIn ? { id: 'sess_a', getToken: async () => 'synthetic_fixture_only' } : null,
    load: async () => { if (loadFailure) throw Error('synthetic SDK unavailable') }, addListener: fn => { f.listener = fn },
    mountSignIn: () => { f.mounted++ }, mountSignUp: () => { f.mounted++ }, unmountSignUp() {}, unmountSignIn() {}, signOut: async () => { if (logoutFailure) throw Error('synthetic outage'); f.clerk.session = null } }
  const window = { Clerk: f.clerk, __internal_ClerkUICtor: {}, addEventListener: (_name, fn) => { f.start = fn },
    location: { origin, pathname: '/account/sg2/account/registration', replace: url => f.redirects.push(url), reload: () => { f.reloaded++ } } }
  vm.runInNewContext(accountBrowserScript, { window, document: { getElementById: id => elements[id] }, AbortController,
    fetch: async (url, options) => { f.calls.push({ url, options }); return response(f.calls.length) } })
  return f
}
test('synthetic browser flow redirects only after confirmed B1 success; native signed-out state mounts the official widget', async () => {
  const f = browserFixture(); await f.start()
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, '/v1/account'); assert.equal(f.calls[0].options.method, 'POST')
  assert.deepEqual(f.redirects, ['https://sg2.example.test/account']); assert.equal(f.elements.status.textContent, 'Konto gotowe.')
  const signedOut = browserFixture({ signedIn: false }); await signedOut.start(); assert.equal(signedOut.calls.length, 0); assert.equal(signedOut.mounted, 1)
})
test('synthetic interrupted/denied account completion never becomes success or a redirect', async () => {
  for (const response of [() => new Response('{}', { status: 503 }), () => new Response('{}', { status: 401 }), () => { throw Error('synthetic interruption') }]) {
    const f = browserFixture({ response }); await f.start(); assert.deepEqual(f.redirects, []); assert.equal(f.elements.retry.hidden, false)
    assert(f.elements.status.textContent.includes('Nie udało'))
  }
})
test('synthetic account switching discards a late result from the previous session', async () => {
  let resolveA
  const f = browserFixture({ response: count => count === 1 ? new Promise(r => { resolveA = r }) : new Response(JSON.stringify(browserAccount(ids.b))) })
  const first = f.start(); while (!resolveA) await new Promise(r => setImmediate(r))
  f.clerk.session = { id: 'sess_b', getToken: async () => 'synthetic_fixture_other' }; f.listener()
  await new Promise(r => setImmediate(r)); resolveA(new Response(JSON.stringify(browserAccount()))); await first
  assert.deepEqual(f.redirects, ['https://sg2.example.test/account']); assert.equal(f.calls[0].options.signal.aborted, true)
})
test('synthetic browser reload/native session restoration performs a new backend confirmation, without a saved-account shortcut', async () => {
  const first = browserFixture(), reopened = browserFixture(); await first.start(); await reopened.start()
  assert.equal(first.calls.length, 1); assert.equal(reopened.calls.length, 1)
})
test('synthetic SDK failure retries a clean page; provider logout failure is not reported as successful logout', async () => {
  const failed = browserFixture({ loadFailure: true }); await failed.start(); failed.elements.retry.onclick(); assert.equal(failed.reloaded, 1); assert.equal(failed.calls.length, 0)
  const f = browserFixture({ logoutFailure: true, response: () => new Response('{}', { status: 503 }) }); await f.start(); await f.elements.logout.onclick()
  assert(f.elements.status.textContent.includes('Wylogowanie nie zostało potwierdzone')); assert.deepEqual(f.redirects, [])
})
test('real HTTP primary entry permits opaque SDK navigation only on bounded public GET, without projecting it or changing protected API policy', async t => {
  const f = accountFixture(), server = createNodeServer(origin, f.handler)
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => { server.closeAllConnections(); server.close() })
  const send = path => new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: server.address().port, path, headers: { host: 'localhost:3600', 'sec-fetch-site': 'cross-site' } }, r => {
      let body = ''; r.setEncoding('utf8'); r.on('data', chunk => { body += chunk }); r.once('end', () => resolve({ status: r.statusCode, body }))
    }); req.on('error', reject); req.end()
  })
  const page = await send('/account/sg2/account/registration?__clerk_synced=true&redirect_url=https%3A%2F%2Fforeign.invalid')
  assert.equal(page.status, 200); assert(!page.body.includes('foreign.invalid')); assert(page.body.includes('allowedRedirectOrigins'))
  assert.equal(f.sql.length, 0); assert.equal(f.calls.length, 0)
  for (const path of ['/healthz?x=1', '/v1/account?__clerk_synced=true', '/account/sg2/account/registration?x=' + 'a'.repeat(8200)]) assert.equal((await send(path)).status, 400)
})
