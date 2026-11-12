import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fixture, intent, ids } from './fixtures.mjs'
import { createFlowStore } from '../dist/src/flow-store.js'
import { createSessionBoundary } from '../dist/src/session-boundary.js'

// These exercise the accepted boundary. No renewal or browser retry is installed.
const restarted = f => createSessionBoundary({ configuration: f.config, client: f.client,
  authority: f.authority, now: () => f.now, flowStore: createFlowStore({ now: () => f.now }) })
const consume = (f, boundary, state) => boundary.consumeFlow(f.request('/v1/flows/consume', 'POST'), { state })
const issue = (f, boundary = f.boundary) => boundary.beginFlow(f.request('/v1/flows', 'POST'), intent)

test('two actual Node processes cannot recover or replay another process navigation state', () => {
  const moduleUrl = new URL('../dist/src/flow-store.js', import.meta.url).href
  const run = source => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  }
  const state = run(`import {createFlowStore} from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify(createFlowStore().issue({expiresAt:Date.now()+60000,userId:'synthetic'})))`)
  assert.match(state, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(run(`import {createFlowStore} from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify(createFlowStore().take(${JSON.stringify(state)})))`), null)
})

test('one fresh navigation after restart rechecks identity, uses a new nonce and rejects both replays', async () => {
  const f = fixture(), old = await issue(f), boundary = restarted(f)
  await assert.rejects(consume(f, boundary, old.state), e => e.status === 409)
  const checks = f.sdkCalls, fresh = await issue(f, boundary)
  assert.ok(f.sdkCalls > checks)
  assert.notEqual(old.state, fresh.state)
  assert.equal(await consume(f, boundary, fresh.state), 'https://sg2.example.test/')
  for (const s of [old.state, fresh.state]) await assert.rejects(consume(f, boundary, s), e => e.status === 409)
  assert.equal(f.calls.some(x => x.startsWith('revoke:')), false)
})

for (const patch of [{ sessionStatus: 'revoked' }, { bindingExpired: true }, { bindingStatus: 'REVOKED' },
  { banned: true }, { locked: true }, { providerError: true }, { sessionExpired: true }, { status: 'handshake' }]) {
  test('restart does not create identity authority when ' + JSON.stringify(patch), async () => {
    const f = fixture(), old = await issue(f)
    Object.assign(f, patch)
    const boundary = restarted(f)
    await assert.rejects(consume(f, boundary, old.state))
    await assert.rejects(issue(f, boundary))
    assert.equal(f.calls.some(x => x.startsWith('revoke:')), false)
  })
}

test('switch after restart cannot resume the prior user or change a closed destination', async () => {
  const f = fixture(), old = await issue(f)
  f.user = 'b'
  const boundary = restarted(f)
  await assert.rejects(consume(f, boundary, old.state), e => e.status === 409)
  assert.equal((await boundary.session(f.request())).actor.userId, ids.b)
  await assert.rejects(boundary.beginFlow(f.request('/v1/flows', 'POST'), { ...intent, returnTo: 'https://evil.test' }))
  const fresh = await issue(f, boundary)
  assert.equal(await consume(f, boundary, fresh.state), 'https://sg2.example.test/')
})

test('provider-confirmed logout survives process-local store replacement', async () => {
  const f = fixture(), pending = await issue(f)
  await f.boundary.logout(f.request('/v1/logout', 'POST'))
  assert.equal(f.sessionStatus, 'revoked')
  const boundary = restarted(f)
  assert.equal((await boundary.session(f.request())).status, 'unauthenticated')
  await assert.rejects(consume(f, boundary, pending.state), e => e.status === 401)
})

test('failed provider revocation reports failure; local deny is explicitly not durable authority', async () => {
  const f = fixture({ revocationError: true })
  await assert.rejects(f.boundary.logout(f.request('/v1/logout', 'POST')), e => e.status === 503 && e.code === 'PROVIDER_REVOCATION_UNAVAILABLE')
  assert.equal((await f.boundary.session(f.request())).status, 'unauthenticated')
  assert.equal(f.sessionStatus, 'active')
  // Exposes the accepted limitation; no claim of successful global logout.
  assert.equal((await restarted(f).session(f.request())).status, 'authenticated')
})

test('proof and navigation are capped by a near-expiry binding, without extending it', async () => {
  const f = fixture(), until = f.now + 750, resolve = f.authority.resolveBinding
  f.authority.resolveBinding = async key => ({ ...await resolve(key), expiresAt: new Date(until).toISOString() })
  assert.equal(Date.parse((await f.boundary.session(f.request())).actor.expiresAt), until)
  assert.equal(Date.parse((await issue(f)).expiresAt), until)
  f.now = until + 1
  assert.equal((await f.boundary.session(f.request())).status, 'unauthenticated')
})

test('return days later with a fresh provider proof cannot repair the original expired B1 binding', async () => {
  const f = fixture(), until = f.now + 300000, resolve = f.authority.resolveBinding
  f.authority.resolveBinding = async key => ({ ...await resolve(key), expiresAt: new Date(until).toISOString() })
  assert.equal((await f.boundary.session(f.request())).status, 'authenticated')
  f.now += 3 * 86400000
  assert.equal(f.sessionStatus, 'active')
  assert.equal((await f.boundary.session(f.request())).status, 'unauthenticated')
  assert.equal(until < f.now, true)
})

test('database unavailability on a returning session cannot fall back to cached ALLOW', async () => {
  const f = fixture()
  assert.equal((await f.boundary.session(f.request())).status, 'authenticated')
  f.authority.resolveBinding = async () => { throw Error('synthetic database outage') }
  assert.equal((await f.boundary.session(f.request())).status, 'unavailable')
  await assert.rejects(issue(f), e => e.status === 503)
})
