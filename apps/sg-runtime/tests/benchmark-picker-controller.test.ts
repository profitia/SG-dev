import assert from 'node:assert/strict'
import test from 'node:test'
import { createPickerController, benchmarkSeriesKey } from '../components/benchmark-picker/picker-controller'
import type { BenchmarkCandidate, SavedBenchmark, BenchmarkPreviewResult } from '../lib/benchmark/contracts'

const provider = { providerCode: 'MACROBOND' as const, displayName: 'Macrobond' }
export function candidate(index: number): BenchmarkCandidate {
  return { candidateId: `macrobond:s${index}`, displayName: `Copper ${index}`, description: null, provider,
    providerSeries: { provider, providerSeriesId: `s${index}`, providerSeriesKey: `s${index}` }, frequency: 'daily', currency: 'USD', unit: 't', source: 'Exchange', region: 'World',
    metadata: { PriceType: 'synthetic_spot' }, lastObservationDate: '2024-05-15' }
}
export function saved(item = candidate(0)): SavedBenchmark {
  return { selectionId: 'selection-existing', businessBenchmarkId: 'business-existing', organizationId: 'authorized-fixture-organization',
    displayName: item.displayName, provider, providerSeries: item.providerSeries, frequency: item.frequency, currency: item.currency, unit: item.unit, source: item.source, selectedAt: '2024-05-15T00:00:00.000Z' }
}
export function preview(item = candidate(0)): BenchmarkPreviewResult {
  return { providerSeries: item.providerSeries, displayName: item.displayName, latestValue: 123.45, frequency: item.frequency,
    currency: 'USD', unit: 't', source: item.source, range: '1Y', changeMetrics: { '1M': 1.25, '3M': -2.5, '1Y': 0 }, historical: [] }
}
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function fixture(total = 16, existing: SavedBenchmark[] = []) {
  const calls: { path: string; init: RequestInit }[] = [], selected: SavedBenchmark[] = []
  const items = Array.from({ length: total }, (_, i) => candidate(i))
  let intercept: ((path: string, init: RequestInit) => Promise<Response> | null) | undefined
  const controller = createPickerController({ onSelect: value => selected.push(value), request: async (path, init = {}) => {
    calls.push({ path, init })
    const pending = intercept?.(path, init); if (pending) return pending
    if (path === '/api/benchmark/selection') return Response.json(init.method === 'POST' ? saved(JSON.parse(init.body as string).candidate) : { items: existing })
    const url = new URL(path, 'https://fixture.test')
    if (url.pathname === '/api/benchmark/search') return Response.json({ items })
    if (url.pathname === '/api/benchmark/preview') return Response.json(preview(items.find(c => c.providerSeries.providerSeriesId === url.searchParams.get('seriesName'))!))
    if (url.pathname === '/api/benchmark/metadata/PriceType/values') return Response.json({ items: [{ value: 'synthetic_spot', label: 'Spot' }] })
    throw Error('Unexpected work: ' + path)
  } })
  return { controller, calls, selected, items, intercept: (fn: typeof intercept) => { intercept = fn } }
}

test('A/B/C/N: one bounded existing search; previews exactly 5+5+5+1 without duplicate work or reorder', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.search(' Copper ')
  const searches = () => f.calls.filter(c => c.path.startsWith('/api/benchmark/search'))
  const previews = () => f.calls.filter(c => c.path.startsWith('/api/benchmark/preview'))
  assert.equal(searches().length, 1); assert.equal(searches()[0].path, '/api/benchmark/search?q=Copper&limit=25')
  assert.equal(f.controller.getSnapshot().visibleCount, 5); assert.equal(previews().length, 5)
  await f.controller.showMore(); assert.equal(f.controller.getSnapshot().visibleCount, 10); assert.equal(previews().length, 10)
  await f.controller.showMore(); assert.equal(f.controller.getSnapshot().visibleCount, 15); assert.equal(previews().length, 15)
  await f.controller.showMore(); assert.equal(f.controller.getSnapshot().visibleCount, 16); assert.equal(previews().length, 16)
  await f.controller.showMore(); assert.equal(previews().length, 16)
  assert.equal(new Set(previews().map(c => c.path)).size, 16)
  assert.deepEqual(f.controller.getSnapshot().candidates, f.items)
  assert.equal(f.calls.filter(c => c.path.includes('/metadata/')).length, 1)
  for (const c of f.calls) assert.equal(c.init.cache, 'no-store')
  assert.ok(!f.calls.some(c => /analytics|forecast|context|ai-search/.test(c.path)))
})
test('B: twelve candidates initially display five, then ten and twelve', async () => {
  const f = fixture(12); await f.controller.initialize(); await f.controller.search('Copper')
  assert.equal(f.controller.getSnapshot().visibleCount, 5); await f.controller.showMore(); assert.equal(f.controller.getSnapshot().visibleCount, 10)
  await f.controller.showMore(); assert.equal(f.controller.getSnapshot().visibleCount, 12)
})
test('D: existing preview DTO and native frequency/metrics preserved without calculation', async () => {
  const f = fixture(1); await f.controller.initialize(); await f.controller.search('Copper')
  assert.deepEqual(f.controller.getSnapshot().previews[benchmarkSeriesKey(f.items[0])].data, preview(f.items[0]))
})
test('E: missing preview or dictionary remains missing and never becomes a zero', async () => {
  const f = fixture(1); f.intercept(path => path.includes('/preview') || path.includes('/metadata/') ? Promise.resolve(Response.json({}, { status: 503 })) : null)
  await f.controller.initialize(); await f.controller.search('Copper')
  assert.deepEqual(f.controller.getSnapshot().previews[benchmarkSeriesKey(f.items[0])], { status: 'error', data: null })
  assert.deepEqual(f.controller.getSnapshot().priceTypes, [])
})
test('H: authorized selection request passes the original candidate and returns complete SavedBenchmark', async () => {
  const f = fixture(1); await f.controller.initialize(); await f.controller.search('Copper'); await f.controller.select(f.controller.getSnapshot().candidates[0])
  assert.deepEqual(f.selected, [saved(f.items[0])])
  const post = f.calls.find(c => c.init.method === 'POST')!
  assert.equal(post.path, '/api/benchmark/selection'); assert.deepEqual(JSON.parse(post.init.body as string), { candidate: f.items[0] })
})
test('I: an existing authorized saved mapping is reused without a duplicate POST', async () => {
  const f = fixture(1, [saved()]); await f.controller.initialize(); await f.controller.search('Copper'); await f.controller.select(f.controller.getSnapshot().candidates[0])
  assert.deepEqual(f.selected, [saved()]); assert.equal(f.calls.filter(c => c.init.method === 'POST').length, 0)
})
test('H: hidden or foreign candidate cannot be selected through the presentation controller', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.search('Copper')
  await f.controller.select(f.controller.getSnapshot().candidates[6]); await f.controller.select(candidate(999))
  assert.equal(f.selected.length, 0); assert.equal(f.calls.filter(c => c.init.method === 'POST').length, 0)
})
test('J: close aborts pending selection and blocks obsolete consumer callbacks even if transport ignores abort', async () => {
  const f = fixture(1), d = deferred<Response>(); let signal: AbortSignal | null | undefined
  f.intercept((path, init) => init.method === 'POST' ? (signal = init.signal, d.promise) : null)
  await f.controller.initialize(); await f.controller.search('Copper'); const pending = f.controller.select(f.controller.getSnapshot().candidates[0])
  f.controller.close(); assert.equal(signal?.aborted, true); d.resolve(Response.json(saved())); await pending
  assert.equal(f.selected.length, 0); assert.deepEqual(f.controller.getSnapshot().candidates, [])
})
test('J: a new search prevents an old in-flight selection attaching to a different result context', async () => {
  const f = fixture(1), d = deferred<Response>(); f.intercept((_, init) => init.method === 'POST' ? d.promise : null)
  await f.controller.initialize(); await f.controller.search('Copper'); const pending = f.controller.select(f.controller.getSnapshot().candidates[0])
  await f.controller.search('PVC'); d.resolve(Response.json(saved())); await pending; assert.equal(f.selected.length, 0)
})
test('M: B wins over a late A response; aborted requests display no stale error', async () => {
  const f = fixture(), a = deferred<Response>(), b = deferred<Response>()
  f.intercept(path => path.includes('q=A&') ? a.promise : path.includes('q=B&') ? b.promise : null)
  await f.controller.initialize(); const first = f.controller.search('A'), second = f.controller.search('B')
  b.resolve(Response.json({ items: [candidate(9)] })); await second; a.resolve(Response.json({ items: [candidate(0)] })); await first
  assert.equal(f.controller.getSnapshot().candidates[0].candidateId, candidate(9).candidateId)
  assert.equal(f.controller.getSnapshot().error, null)
})
test('M: late preview from old query cannot overwrite the new query preview', async () => {
  const f = fixture(1), d = deferred<Response>(); let first = true
  f.intercept(path => path.includes('/preview') && first ? (first = false, d.promise) : null)
  await f.controller.initialize(); const a = f.controller.search('A'); await new Promise(r => setImmediate(r)); await f.controller.search('B')
  d.resolve(Response.json({ ...preview(), latestValue: 99999 })); await a
  assert.equal(f.controller.getSnapshot().previews[benchmarkSeriesKey(candidate(0))].data?.latestValue, 123.45)
})
for (const status of [401, 403]) for (const path of ['selection-read', 'search', 'preview', 'selection-write']) {
  test(`L: ${status} at ${path} fails closed and publishes no selected benchmark`, async () => {
    const f = fixture(1)
    const denied = (p: string, init: RequestInit) => path === 'selection-read' ? p === '/api/benchmark/selection' && !init.method
      : path === 'search' ? p.includes('/search?') : path === 'preview' ? p.includes('/preview?') : init.method === 'POST'
    f.intercept((p, init) => denied(p, init) ? Promise.resolve(Response.json({}, { status })) : null)
    await f.controller.initialize(); await f.controller.search('Copper'); const selected = f.controller.getSnapshot().candidates[0]
    if (selected) await f.controller.select(selected)
    assert.equal(f.controller.getSnapshot().error, 'SESSION_UNAVAILABLE'); assert.equal(f.controller.getSnapshot().ready, false)
    assert.equal(f.selected.length, 0); assert.equal(f.controller.getSnapshot().saved.length, 0); assert.equal(f.controller.getSnapshot().candidates.length, 0)
  })
}
test('L: replacing the session controller clears old private state and ignores late old responses', async () => {
  const a = fixture(1, [saved()]), b = fixture(0), delayed = deferred<Response>()
  a.intercept(path => path.includes('/search?') ? delayed.promise : null)
  await a.controller.initialize(); const pending = a.controller.search('privateA'); a.controller.close()
  await b.controller.initialize(); await b.controller.search('privateB'); delayed.resolve(Response.json({ items: [candidate(0)] })); await pending
  assert.equal(b.controller.getSnapshot().saved.length, 0); assert.equal(b.controller.getSnapshot().candidates.length, 0); assert.equal(a.selected.length, 0)
})
test('N: duplicate show-more while previews load does not issue duplicate preview work', async () => {
  const f = fixture(16); await f.controller.initialize(); await f.controller.search('Copper')
  await Promise.all([f.controller.showMore(), f.controller.showMore()])
  const requests = f.calls.filter(c => c.path.includes('/preview?')); assert.equal(requests.length, 15); assert.equal(new Set(requests.map(c => c.path)).size, 15)
})
test('N: absent price-type metadata does not prefetch the dictionary', async () => {
  const f = fixture(1); f.items[0].metadata = {}; await f.controller.initialize(); await f.controller.search('Copper')
  assert.equal(f.calls.filter(c => c.path.includes('/metadata/')).length, 0)
})
test('H: duplicate clicks do not create a second pending selection write', async () => {
  const f = fixture(1), d = deferred<Response>(); f.intercept((_, init) => init.method === 'POST' ? d.promise : null)
  await f.controller.initialize(); await f.controller.search('Copper'); const c = f.controller.getSnapshot().candidates[0]
  const pending = f.controller.select(c); await f.controller.select(c)
  assert.equal(f.calls.filter(c => c.init.method === 'POST').length, 1); d.resolve(Response.json(saved())); await pending; assert.equal(f.selected.length, 1)
})
test('A: empty and failed searches have explicit stable states', async () => {
  const f = fixture(0); await f.controller.initialize(); await f.controller.search(''); assert.equal(f.calls.length, 1)
  await f.controller.search('Copper'); assert.equal(f.controller.getSnapshot().searched, true); assert.deepEqual(f.controller.getSnapshot().candidates, [])
  f.intercept(path => path.includes('/search?') ? Promise.resolve(Response.json({}, { status: 500 })) : null)
  await f.controller.search('failed'); assert.equal(f.controller.getSnapshot().error, 'SEARCH_FAILED'); assert.equal(f.controller.getSnapshot().searching, false)
})
