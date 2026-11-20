import test from 'node:test'
import assert from 'node:assert/strict'
import { accountTransactions } from '../dist/src/account-provisioning.js'

const limits = { timeoutMs: 15000, maxWaitMs: 5000 }
const privateSentinel = 'PRIVATE_TEST_ONLY_email-token-key-query-parameter'
function database({ failAt, failure, acquireFailure, rollbackFails = false } = {}) {
  const calls = [], releases = []
  return { calls, releases, pool: { async connect() {
    if (acquireFailure) throw acquireFailure
    return {
      async query(sql, values) {
        calls.push({ sql, values })
        if (sql === failAt) throw failure
        if (sql === 'ROLLBACK' && rollbackFails) throw Error(privateSentinel)
        return { rows: [] }
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
