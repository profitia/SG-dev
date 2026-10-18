import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { NextRequest } from 'next/server'
import middleware from '../middleware'
import { GET } from '../app/api/series/route'
import { createNativeMarketAnalyticsHandler } from '../lib/time-series/native-analytics-relay'
import { NativeReadFailure, readNativeStoredPublication } from '../lib/platform/native-read-transport'

const ORIGIN = 'https://sg2-development-runtime.onrender.com'
const A = '11111111-1111-4111-8111-111111111111'
const authorization = 'Bearer synthetic_header.synthetic_payload.synthetic_signature'
const environment = { APP_ENV: 'development', TARGET_ENVIRONMENT: 'development', PROFITIA_AUTH_PROVIDER: 'clerk',
  PROFITIA_FORECAST_API_ORIGIN: ORIGIN, PROFITIA_FORECAST_API_CONFIGURATION_VERSION: 'sg2-native-forecast-relay-dev-v1' }
const query = `seriesId=shared_series&range=ALL&locale=pl&organisationId=${A}`
const request = (parameters = query, headers = {}, method = 'GET') => new NextRequest(`https://dashboard.fixture.test/api/series?${parameters}`,
  { method, headers: { authorization, ...headers } })
const facts = { providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: 'shared_series', providerSeriesKey: null },
  displayName: 'Stored source', latestValue: 0, frequency: 'MONTHLY', currency: null, unit: 'UNSUPPORTED_UNIT', source: 'Synthetic', range: 'ALL',
  historical: [{ date: '2025-01-01T00:00:00.000Z', value: 10 }, { date: '2025-02-01T00:00:00.000Z', value: 0 }, { date: '2025-03-01T00:00:00.000Z', value: null }] }
function publication(body: unknown = facts, headers = {}) {
  return Response.json(body, { headers: { 'X-Profitia-Operation-Contract': 'profitia.operation-context@1.0.0', 'X-Profitia-Application': 'spendguru',
    'X-Profitia-Environment': 'development', 'X-Profitia-Market-Projection': 'sg2-stored-market-analytics-v1',
    'X-Profitia-Market-Resource': 'market-analytics:shared_series', ...headers } })
}
async function withEnvironment(run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, environment)
  try { await run() } finally { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value
  } }
}

test('historical chart consumption uses the same pinned native host and preserves original zero/null/unit mapping', async () => {
  let calls = 0
  const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async (input, init) => {
    calls++
    const url = new URL(String(input)); assert.equal(url.origin, ORIGIN); assert.equal(url.pathname, '/api/benchmark/analytics-series')
    assert.deepEqual([...url.searchParams], [['seriesId', 'shared_series'], ['range', 'ALL'], ['organisationId', A]])
    assert.deepEqual([...new Headers(init?.headers)], [['authorization', authorization]])
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'manual'); assert.equal(init?.credentials, 'omit'); assert(init?.signal)
    return publication()
  } })
  const response = await handler(request(query + '&displayName=Personal%20label', { cookie: 'synthetic_legacy', 'x-clerk-user-id': 'forged', 'x-clerk-org-id': A }))
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json(); assert.equal(body.selection.componentName, 'Personal label')
  assert.equal(body.selection.componentCode, 'shared_series'); assert.equal(body.sourceInfo.unit, 'UNSUPPORTED_UNIT'); assert.equal(body.sourceInfo.currency, null)
  assert.deepEqual(body.historical.map((point: { value: unknown }) => point.value), [10, 0, null])
  assert.equal(body.detailSummary.metricValue, 0); assert.equal(body.forecastAnchor.value, null); assert.equal(body.forecast, null); assert.equal(calls, 1)
})

test('invalid selection, foreign environment, missing session and private-record filters never reach a source', async () => {
  let calls = 0
  const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async () => { calls++; return publication() } })
  for (const parameters of ['', query + '&seriesId=other', query + '&organisationId=' + A, query + '&componentName=private', query + '&organizationId=' + A,
    query.replace('range=ALL', 'range=bad'), query.replace('locale=pl', 'locale=bad'), query.replace(A, 'foreign')])
    assert.equal((await handler(request(parameters))).status, 400)
  assert.equal((await handler(request(query, { authorization: '' }))).status, 401)
  const post = await handler(request(query, {}, 'POST')); assert.equal(post.status, 405); assert.equal(post.headers.get('Allow'), 'GET')
  for (const env of [{ ...environment, PROFITIA_AUTH_PROVIDER: 'legacy_demo' }, { ...environment, TARGET_ENVIRONMENT: 'staging' },
    { ...environment, PROFITIA_FORECAST_API_ORIGIN: 'https://foreign.fixture.test' }]) {
    const closed = createNativeMarketAnalyticsHandler({ env: () => env, fetch: async () => { calls++; return publication() } })
    assert.equal((await closed(request())).status, 503)
  }
  assert.equal(calls, 0)
})

test('old, wrong-scope, malformed and oversized native publications are withheld', async () => {
  for (const [name, value] of [['X-Profitia-Operation-Contract', 'old'], ['X-Profitia-Application', 'other'], ['X-Profitia-Environment', 'staging'],
    ['X-Profitia-Market-Projection', 'preview'], ['X-Profitia-Market-Resource', 'market-analytics:foreign']]) {
    const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async () => publication(facts, { [name]: value }) })
    assert.equal((await handler(request())).status, 503)
  }
  for (const body of [null, [], { ...facts, range: '1Y' }, { ...facts, providerSeries: { providerSeriesId: 'foreign' } },
    { ...facts, historical: null }, { ...facts, description: 'x'.repeat(4 * 1024 * 1024) }]) {
    const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async () => publication(body) })
    assert.equal((await handler(request())).status, 503)
  }
  for (const type of ['text/html', 'application/jsonp', 'application/json']) {
    const headers = publication().headers; headers.set('Content-Type', type)
    const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async () => new Response('not JSON', { headers }) })
    assert.equal((await handler(request())).status, 503)
  }
})

test('shared transport refuses redirects and diagnostics, preserves public refusal statuses and observes cancellation', async () => {
  for (const status of [301, 302, 307, 400, 401, 403, 404, 409, 413, 429, 500, 503]) {
    const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async () => new Response('SYNTHETIC_PRIVATE_DIAGNOSTIC',
      { status, headers: { location: 'https://foreign.fixture.test/private' } }) })
    const response = await handler(request()); assert.equal(response.status, [400, 401, 403, 404, 409, 413, 429, 503].includes(status) ? status : 503)
    assert.equal(response.headers.get('location'), null); assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'))
  }
  const controller = new AbortController(); controller.abort()
  const handler = createNativeMarketAnalyticsHandler({ env: () => environment, fetch: async (_input, init) => { assert(init?.signal?.aborted); throw Error('SYNTHETIC_PRIVATE_DIAGNOSTIC') } })
  assert.equal((await handler(new Request(request(), { signal: controller.signal }))).status, 503)
  await assert.rejects(readNativeStoredPublication(request(), { configuration: { origin: ORIGIN, applicationId: 'spendguru', environment: 'development' },
    operationContract: 'profitia.operation-context@1.0.0', feature: 'market', projection: 'unused', resource: 'unused', path: '/api/admin', parameters: new URLSearchParams(), maximumBytes: 1024 },
  async () => { throw Error('Unexpected transport') }), error => error instanceof NativeReadFailure && error.status === 503)
})

test('actual series dispatcher avoids legacy datastores and middleware admits only explicit native benchmark history', async () => withEnvironment(async () => {
  const previous = globalThis.fetch, names = ['dashboardPreviewPrisma', 'dashboardPreviewMarketDataPrisma']
  const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name)); let escapes = 0, calls = 0
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { escapes++; throw Error('Forbidden owner datastore') } })
  globalThis.fetch = async () => { calls++; return publication() }
  try {
    const allowed = await middleware(request()); assert.equal(allowed.headers.get('x-middleware-next'), '1')
    assert.equal(allowed.headers.get('cache-control'), 'private, no-store')
    assert.equal((await GET(request())).status, 200)
    assert.equal((await GET(request(query, { authorization: '' }))).status, 401)
    for (const path of ['/api/series', '/api/components', '/api/records', '/api/forecast-accuracy', '/en?embed=1'])
      assert.equal((await middleware(new NextRequest('https://dashboard.fixture.test' + path))).status, 503)
    assert.equal((await middleware(request(query, {}, 'POST'))).status, 503)
    assert.equal(calls, 1); assert.equal(escapes, 0)
  } finally { globalThis.fetch = previous; for (const [index, name] of names.entries()) {
    const descriptor = descriptors[index]; if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as Record<string, unknown>)[name]
  } }
}))

test('fresh native history and transport imports do not create owner clients or call a provider', () => {
  const script = `let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Forbidden provider')};
    for(const name of ['dashboardPreviewPrisma','dashboardPreviewMarketDataPrisma'])Object.defineProperty(globalThis,name,{configurable:true,get(){calls++;throw Error('Forbidden owner')}});
    await import('./lib/time-series/native-analytics-relay.ts');await import('./lib/platform/native-read-transport.ts');
    await import('./lib/time-series/benchmark-series-publication.ts');await import('./app/api/series/route.ts');
    if(calls)throw Error('Unexpected side effect');process.stdout.write('PASS');`
  const env = { ...process.env, DATABASE_URL: '', MARKET_DATA_DATABASE_URL: '', PROFITIA_AUTH_PROVIDER: 'clerk' }
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', env, timeout: 20000 })
  assert.equal(result.status, 0, result.stderr || result.stdout); assert.equal(result.stdout, 'PASS')
})
