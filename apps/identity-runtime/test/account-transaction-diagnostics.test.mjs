import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { accountTransactions, createAccountSurface } from '../dist/src/account-provisioning.js'
import { createHttpHandler } from '../dist/src/http-handler.js'
import { fixture, ids, issuer } from './fixtures.mjs'

const limits = { timeoutMs: 15000, maxWaitMs: 5000 }
const privateSentinel = 'PRIVATE_TEST_ONLY_email-token-key-query-parameter'
function database({ failAt, failure, acquireFailure, rollbackFails = false, resultForQuery, onCommit } = {}) {
  const calls = [], releases = []
  return { calls, releases, pool: { async connect() {
    if (acquireFailure) throw acquireFailure
    return {
      async query(sql, values) {
        calls.push({ sql, values })
        if (sql === failAt) throw failure
        if (sql === 'ROLLBACK' && rollbackFails) throw Error(privateSentinel)
        if (sql === 'COMMIT') onCommit?.()
        return await resultForQuery?.(sql, values) ?? { rows: [] }
      },
      release: destroy => releases.push(destroy ?? false),
    }
  } } }
}

test('a SQL failure remains diagnosable after SDK denial wrapping without disclosing SQL or values', async () => {
  const sql = 'SELECT profitia_profile.renew_binding($1)', events = []
  const f = database({ failAt: sql, failure: Object.assign(Error(privateSentinel), {
    code: 'PT403', detail: privateSentinel, query: privateSentinel,
  }) })
  const transact = accountTransactions(f.pool, event => events.push(event))
  await assert.rejects(transact(async ({ query }) => {
    try { await query(sql, [privateSentinel]) }
    catch { throw Object.assign(Error(privateSentinel), { reasonCode: 'ACCESS_BASIS_INVALID' }) }
  }, limits))
  assert.deepEqual(events, [{ phase: 'query', operation: 'binding-renewal', code: 'PT403' }])
  assert.equal(Object.isFrozen(events[0]), true)
  assert.equal(JSON.stringify(events).includes(privateSentinel), false)
  assert.deepEqual(f.calls.map(x => x.sql), ['BEGIN', sql, 'ROLLBACK'])
  assert.deepEqual(f.releases, [false])
})

test('a failed descriptor validation records the last completed step without claiming a SQL failure', async () => {
  const events = [], f = database(), denied = Object.assign(Error(privateSentinel), { reasonCode: 'ACCESS_BASIS_INVALID' })
  await assert.rejects(accountTransactions(f.pool, event => events.push(event))(async ({ query }) => {
    await query('SELECT profitia_profile.runtime_descriptor() AS descriptor')
    throw denied
  }, limits), error => error === denied)
  assert.deepEqual(events, [{ phase: 'action', operation: 'profile-descriptor', code: 'ACCESS_BASIS_INVALID' }])
  assert.deepEqual(f.releases, [false])
})

test('unknown errors and query text never become diagnostic fields', async () => {
  const events = [], sql = 'SELECT ' + privateSentinel
  const failure = Object.assign(Error(privateSentinel), { code: privateSentinel, reasonCode: privateSentinel })
  const f = database({ failAt: sql, failure })
  await assert.rejects(accountTransactions(f.pool, event => events.push(event))(({ query }) => query(sql, [privateSentinel]), limits), error => error === failure)
  assert.deepEqual(events, [{ phase: 'query', operation: 'other', code: 'UNCLASSIFIED' }])
  assert.equal(JSON.stringify(events).includes(privateSentinel), false)
})

test('a broken reporter and failed rollback cannot replace a commit error or reuse its poisoned connection', async () => {
  const failure = Object.assign(Error(privateSentinel), { code: '40001' }), events = []
  const f = database({ failAt: 'COMMIT', failure, rollbackFails: true })
  await assert.rejects(accountTransactions(f.pool, event => { events.push(event); throw Error(privateSentinel) })(async () => true, limits), error => error === failure)
  assert.deepEqual(events, [{ phase: 'commit', operation: 'transaction', code: '40001' }])
  assert.deepEqual(f.calls.map(x => x.sql), ['BEGIN', 'COMMIT', 'ROLLBACK'])
  assert.deepEqual(f.releases, [true])
})

test('connection failure exposes only an allowed code and retains the existing unavailable response', async () => {
  const events = [], f = database({ acquireFailure: Object.assign(Error(privateSentinel), { code: '28P01' }) })
  await assert.rejects(accountTransactions(f.pool, event => events.push(event))(async () => true, limits), error => error.status === 503 && error.code === 'ACCOUNT_UNAVAILABLE')
  assert.deepEqual(events, [{ phase: 'acquire', operation: 'connection', code: '28P01' }])
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.releases, [])
})

test('successful transactions emit no failure event', async () => {
  const events = [], f = database()
  assert.equal(await accountTransactions(f.pool, event => events.push(event))(async ({ query }) => {
    await query('SELECT txid_current()::text AS transaction_id')
    return true
  }, limits), true)
  assert.deepEqual(events, [])
  assert.deepEqual(f.calls.map(x => x.sql), ['BEGIN', 'SELECT txid_current()::text AS transaction_id', 'COMMIT'])
  assert.deepEqual(f.releases, [false])
})

function postCommitFixture(fault, reporterFails = false, peer = false) {
  const f = fixture(peer ? { party: 'https://sg2.example.test' } : {}), events = [], getUser = f.client.users.getUser
  f.client.users.getUser = async id => ({ ...await getUser(id), primaryEmailAddressId: 'primary',
    emailAddresses: [{ id: 'primary', verification: { status: 'verified' } }] })
  const binding = { applicationId: f.config.applicationId, environment: 'development', projectId: 'synthetic',
    branchId: 'synthetic', databaseName: 'synthetic', role: 'identity_b1_runtime', schemaDigest: 'a'.repeat(64) }
  const db = database({
    onCommit() { if (fault === 'sdk') f.sdkError = true; if (fault === 'provider') f.providerError = true },
    async resultForQuery(sql, values) {
      if (sql.includes('profitia_profile.runtime_descriptor')) return { rows: [{ descriptor: {
        ...binding, profileSchemaDigest: 'b'.repeat(64), issuer, enabled: true,
      } }] }
      if (sql.includes('profitia_profile.binding_renewal_descriptor')) return { rows: [{ descriptor: { renewalSchemaDigest: 'c'.repeat(64) } }] }
      if (sql.includes('profitia_profile.binding_renewal_metadata')) return { rows: [{ metadata: {
        userId: ids.a, version: ids.a + ':1:1', revision: 1, expiresAt: new Date(f.now + 120000).toISOString(),
        allowRenewal: true, allowExpiredRecovery: true, maxRecoveryAgeMs: 604800000,
      } }] }
      if (sql.includes('txid_current')) return { rows: [{ transaction_id: '42' }] }
      if (sql.includes('provision_account')) return { rows: [{ user_id: ids.a }] }
      if (sql.includes('current_database()')) return { rows: [{ database_name: binding.databaseName,
        role: binding.role, login: binding.role, rolsuper: false, rolbypassrls: false, rolcreatedb: false,
        rolcreaterole: false, rolinherit: false, descriptor: { ...binding, schemaVersion: '1.0.0' },
      }] }
      if (sql.includes('profitia_access.identity_binding')) return { rows: [{ binding: await f.authority.resolveBinding({
        environment: 'development', issuer: values[0], subject: values[1],
      }) }] }
    },
  })
  const diagnostic = event => { events.push(event); if (reporterFails) throw Error(privateSentinel) }
  const authority = { ...f.authority, async resolveBinding(key) {
    if (fault === 'binding') throw Object.assign(Error(privateSentinel), { code: '42501' })
    return f.authority.resolveBinding(key)
  } }
  const account = createAccountSurface({ configuration: f.config, client: f.client, authority, binding,
    schemaDigest: 'b'.repeat(64), proofKey: randomBytes(32), transact: accountTransactions(db.pool, diagnostic),
    ...(peer ? { renewalSchemaDigest: 'c'.repeat(64) } : {}),
    diagnostic, now: () => f.now })
  return { f, db, events, handler: createHttpHandler(f.boundary, account) }
}

for (const fault of ['binding', 'sdk', 'provider']) test(`independent post-commit ${fault} failure remains unavailable and emits only its closed stage`, async () => {
  const { f, db, events, handler } = postCommitFixture(fault)
  const response = await handler(f.request('/v1/account', 'POST', {}))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'IDENTITY_UNAVAILABLE' })
  assert.deepEqual(events, [{ phase: 'account-read', operation: 'account-read', code: 'POLICY_UNAVAILABLE' }])
  assert.equal(Object.isFrozen(events[0]), true)
  assert.equal(JSON.stringify(events).includes(privateSentinel), false)
  assert.equal(db.calls.at(-1).sql, 'COMMIT')
  assert.equal(db.calls.some(x => x.sql === 'ROLLBACK'), false)
  assert.deepEqual(db.releases, [false])
})

test('a broken post-commit reporter cannot turn a denied independent read into success or a rollback', async () => {
  const { f, db, events, handler } = postCommitFixture('binding', true)
  const response = await handler(f.request('/v1/account', 'POST', {}))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).authenticated, undefined)
  assert.equal(events.length, 1)
  assert.equal(db.calls.at(-1).sql, 'COMMIT')
  assert.deepEqual(db.releases, [false])
})

test('a successful independent post-commit read keeps the existing account response and emits no failure event', async () => {
  const { f, db, events, handler } = postCommitFixture()
  const response = await handler(f.request('/v1/account', 'POST', {}))
  assert.equal(response.status, 200)
  const value = await response.json()
  assert.equal(value.authenticated, true)
  assert.equal(value.userId, ids.a)
  assert.deepEqual(Object.keys(value).sort(), ['authenticated', 'expiresAt', 'userId'])
  assert.deepEqual(events, [])
  assert.equal(db.calls.at(-1).sql, 'COMMIT')
  assert.deepEqual(db.releases, [false])
})

const peerRenewalRequest = f => new Request(f.config.origin + '/v1/account/renew', { method: 'POST',
  headers: { authorization: 'Bearer synthetic_fixture_only', 'content-type': 'application/json' }, body: '{}' })
for (const fault of ['binding', 'sdk', 'provider']) test(`peer renewal post-commit ${fault} failure is diagnosed without changing its existing unavailable response`, async () => {
  const { f, db, events, handler } = postCommitFixture(fault, false, true)
  const response = await handler(peerRenewalRequest(f))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: fault === 'binding' ? 'IDENTITY_UNAVAILABLE' : 'ACCOUNT_UNAVAILABLE' })
  assert.deepEqual(events, [{ phase: 'account-read', operation: 'account-read', code: 'POLICY_UNAVAILABLE' }])
  assert.equal(db.calls.at(-1).sql, 'COMMIT')
  assert.deepEqual(db.releases, [false])
})

test('a failed independent GET is diagnosed even when no transaction is entered', async () => {
  const { f, db, events, handler } = postCommitFixture('binding')
  const response = await handler(new Request(f.config.origin + '/v1/account', { headers: { authorization: 'Bearer synthetic_fixture_only' } }))
  assert.equal(response.status, 503)
  assert.deepEqual(events, [{ phase: 'account-read', operation: 'account-read', code: 'POLICY_UNAVAILABLE' }])
  assert.deepEqual(db.calls, [])
  assert.deepEqual(db.releases, [])
})

test('a successful peer renewal independent read emits no failure event', async () => {
  const { f, db, events, handler } = postCommitFixture(undefined, false, true)
  const response = await handler(peerRenewalRequest(f))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).userId, ids.a)
  assert.deepEqual(events, [])
  assert.equal(db.calls.at(-1).sql, 'COMMIT')
  assert.deepEqual(db.releases, [false])
})
