import assert from 'node:assert/strict'
import test from 'node:test'
import { createBenchmarkRequester } from '../components/benchmark-finder/benchmark-request'

function fixture() {
  const calls: { path: unknown; init: RequestInit }[] = []; let token: string | null = 'official-synthetic-sdk-session', n = 0, status = 200
  const request = createBenchmarkRequester({ mode: () => 'clerk', getToken: async () => token, origin: () => 'https://picker.fixture.test',
    newKey: () => 'finder_' + String(++n).padStart(16, '0'), fetch: async (path, init) => { calls.push({ path, init: init! }); return Response.json({}, { status }) } }, 'picker')
  return { request, calls, token: (value: string | null) => { token = value }, status: (value: number) => { status = value } }
}
test('L: search, price-type dictionary, preview and selection reuse official credentials with private/no-store transport', async () => {
  const f = fixture()
  for (const path of ['/api/benchmark/search?q=Copper&limit=25', '/api/benchmark/metadata/PriceType/values?limit=200', '/api/benchmark/preview?seriesName=fixture&range=1Y', '/api/benchmark/selection']) await f.request(path)
  await f.request('/api/benchmark/selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"candidate":{}}' })
  assert.equal(f.calls.length, 5)
  f.calls.forEach(({ init }, i) => {
    const headers = new Headers(init.headers); assert.equal(headers.get('authorization'), 'Bearer official-synthetic-sdk-session')
    assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error')
    assert.equal(headers.has('x-profitia-idempotency-key'), i < 2)
    assert.equal(headers.has('x-clerk-org-id'), false); assert.equal(headers.has('x-clerk-user-id'), false)
  })
})
test('L: discovery retains its existing retry key; selection keeps original server upsert semantics', async () => {
  const f = fixture(); f.status(503); await f.request('/api/benchmark/search?q=Copper'); f.status(200); await f.request('/api/benchmark/search?q=Copper'); await f.request('/api/benchmark/search?q=Copper')
  const keys = f.calls.map(c => new Headers(c.init.headers).get('x-profitia-idempotency-key'))
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2])
})
test('L: unavailable/missing/forged credentials and non-picker operations cannot dispatch', async () => {
  const f = fixture()
  for (const [path, init] of [['https://other.fixture.test/api/benchmark/search', {}], ['/api/benchmark/context', { method: 'POST' }], ['/api/benchmark/ai-search', { method: 'POST' }], ['/api/benchmark/selection', { method: 'DELETE' }], ['/api/benchmark/search', { method: 'POST' }], ['/api/benchmark/metadata/Region/values', {}], ['/api/benchmark/search', { headers: { authorization: 'Bearer forged' } }]] as const) await assert.rejects(f.request(path, init))
  f.token(null); await assert.rejects(f.request('/api/benchmark/selection'))
  assert.equal(f.calls.length, 0)
})
test('L: closing a session rejects a delayed SDK token before any request and closes pending responses', async () => {
  let resolve!: (value: string | null) => void, hits = 0
  const request = createBenchmarkRequester({ mode: () => 'clerk', getToken: () => new Promise(r => { resolve = r }), origin: () => 'https://picker.fixture.test', newKey: () => 'finder_' + 'a'.repeat(16), fetch: async () => { hits++; return new Response() } }, 'picker')
  const pending = request('/api/benchmark/selection'); request.close(); resolve('later-token'); await assert.rejects(pending); assert.equal(hits, 0)
})
