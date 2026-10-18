import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { NextRequest } from 'next/server'
import middleware from '../middleware'
import { createNativeForecastReadHandler, readNativeForecastConfiguration, nativeForecastApiKind, NATIVE_FORECAST_API_PATHS,
  MAX_NATIVE_FORECAST_BYTES, type NativeForecastReadKind } from '../lib/benchmark-forecast/native-read-relay'
import { GET as currentGET } from '../app/api/benchmark-forecast/current/route'
import { GET as verificationGET } from '../app/api/benchmark-forecast/verification/route'
import { GET as capabilityGET } from '../app/api/benchmark-forecast/current/capability/route'
import { GET as capabilitiesGET } from '../app/api/benchmark-forecast/current/capabilities/route'

const ORIGIN = 'https://sg2-development-runtime.onrender.com'
const A = '11111111-1111-4111-8111-111111111111'
const bearer = 'Bearer synthetic_header.synthetic_payload.synthetic_signature'
const environment = { APP_ENV: 'development', TARGET_ENVIRONMENT: 'development', PROFITIA_AUTH_PROVIDER: 'clerk', PROFITIA_FORECAST_API_ORIGIN: ORIGIN,
  PROFITIA_FORECAST_API_CONFIGURATION_VERSION: 'sg2-native-forecast-relay-dev-v1' }
const query = (kind: NativeForecastReadKind) => `seriesId=shared_series&organisationId=${A}`
  + (kind === 'capabilities' ? '' : kind === 'capability' ? '&modelId=naive&targetBasis=MONTHLY_AVERAGE' : '&model=naive')
const request = (kind: NativeForecastReadKind, parameters = query(kind), headers = {}, method = 'GET') =>
  new NextRequest(`https://dashboard.fixture.test${NATIVE_FORECAST_API_PATHS[kind]}?${parameters}`, { method, headers: { authorization: bearer, ...headers } })
const resource = (kind: NativeForecastReadKind) => kind === 'capabilities' ? 'forecast-readiness:shared_series'
  : kind === 'capability' ? 'forecast-capability:shared_series:naive:MONTHLY_AVERAGE'
    : `forecast-${kind}:shared_series:naive:MONTHLY_AVERAGE` + (kind === 'verification' ? ':FAST' : '')
function body(kind: NativeForecastReadKind) {
  return kind === 'capabilities' ? { status: 'AVAILABLE', seriesId: 'shared_series', variants: Array.from({ length: 12 }, () => ({ seriesId: 'shared_series' })) }
    : { status: 'AVAILABLE', seriesId: 'shared_series', modelId: 'naive', targetBasis: 'MONTHLY_AVERAGE', targetSemantics: 'MONTHLY_AVERAGE',
      currentForecast: { '1M': { forecastValue: 0 } }, verification: { '1M': { origins: 0, metrics: null } } }
}
function publication(kind: NativeForecastReadKind, value: unknown = body(kind), extraHeaders = {}) {
  return Response.json(value, { headers: { 'X-Profitia-Operation-Contract': 'profitia.operation-context@1.0.0',
    'X-Profitia-Application': 'spendguru', 'X-Profitia-Environment': 'development', 'X-Profitia-Forecast-Resource': resource(kind),
    'X-Profitia-Forecast-Projection': kind === 'current' ? 'sg2-stored-current-v2' : kind === 'verification'
      ? 'sg2-stored-verification-v1' : 'sg2-stored-readiness-v1', ...extraHeaders } })
}
async function withEnvironment(run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
  Object.assign(process.env, environment)
  try { await run() } finally { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value
  } }
}

test('native configuration pins the registered Development service without accepting an origin fallback or another environment', () => {
  assert.equal(readNativeForecastConfiguration(environment)?.origin, ORIGIN)
  for (const values of [{}, { ...environment, APP_ENV: 'staging' }, { ...environment, APP_ENV: 'production' },
    { ...environment, TARGET_ENVIRONMENT: 'staging' }, { ...environment, TARGET_ENVIRONMENT: 'production' },
    { ...environment, RENDER_SERVICE_ID: 'srv-other-environment' },
    { ...environment, PROFITIA_AUTH_PROVIDER: 'legacy_demo' }, { ...environment, PROFITIA_FORECAST_API_CONFIGURATION_VERSION: 'old' },
    ...['http://localhost:3001', `${ORIGIN}/`, `${ORIGIN}?target=other`, 'https://evil.fixture.test', 'https://spendguru-porr-demo.onrender.com'].map(origin => ({ ...environment, PROFITIA_FORECAST_API_ORIGIN: origin }))])
    assert.equal(readNativeForecastConfiguration(values), null)
  assert.equal(nativeForecastApiKind('/api/records'), undefined)
  assert.equal(nativeForecastApiKind('/api/benchmark-forecast/current/prepare'), undefined)
})

test('each native read forwards only the bearer session to the pinned path and preserves FAST and state-only semantics', async () => {
  for (const kind of Object.keys(NATIVE_FORECAST_API_PATHS) as NativeForecastReadKind[]) {
    let calls = 0
    const handler = createNativeForecastReadHandler(kind, { env: () => new Proxy(environment, { get(target, key) {
      assert(!['DATABASE_URL', 'MARKET_DATA_DATABASE_URL', 'SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN', 'PROFITIA_CLERK_SECRET_KEY'].includes(String(key)))
      return Reflect.get(target, key)
    } }), fetch: async (input, init) => {
      calls++; const url = new URL(String(input)); assert.equal(url.origin, ORIGIN)
      assert.equal(url.searchParams.get('organisationId'), A)
      assert.deepEqual([...new Headers(init?.headers)], [['authorization', bearer]])
      assert.equal(init?.redirect, 'manual'); assert.equal(init?.credentials, 'omit'); assert.equal(init?.cache, 'no-store')
      if (kind === 'verification') assert.equal(url.searchParams.get('verificationScope'), 'FAST')
      if (kind === 'capabilities') assert.equal(url.pathname, '/api/internal/forecast/readiness')
      if (kind === 'capability') assert.equal(url.searchParams.get('targetSemantics'), 'MONTHLY_AVERAGE')
      return publication(kind)
    } })
    const response = await handler(request(kind, undefined, { cookie: 'synthetic_legacy_cookie', 'x-clerk-user-id': 'foreign', 'x-clerk-org-id': 'foreign',
      'x-profitia-environment': 'production', 'x-sg-forecast-trace': '1' }))
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), body(kind)); assert.equal(calls, 1)
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie, Authorization')
    assert.equal(response.headers.get('set-cookie'), null)
  }
})

test('misconfiguration, missing or opaque identity and malformed selections refuse before any network call', async () => {
  let calls = 0
  const fetch: typeof globalThis.fetch = async () => { calls++; throw Error('No upstream') }
  assert.equal((await createNativeForecastReadHandler('current', { env: () => ({}), fetch })(request('current'))).status, 503)
  const handler = createNativeForecastReadHandler('current', { env: () => environment, fetch })
  for (const value of ['', 'Bearer retained_opaque_token', 'Basic synthetic', `Bearer ${'a'.repeat(32769)}`])
    assert.equal((await handler(request('current', undefined, { authorization: value }))).status, 401)
  for (const value of ['seriesId=*', `${query('current')}&model=arima`, `${query('current')}&organisationId=${A}`, `${query('current')}&userId=foreign`,
    `${query('current')}&sourceFrequency=DAILY`, `${query('current')}&sourceFrequency=&targetCadence=`, `${query('current')}&url=https://evil.fixture.test`,
    `${query('current')}&targetBasis=unknown`, `${query('current')}&verificationScope=FULL`]) assert.equal((await handler(request('current', value))).status, 400)
  assert.equal((await handler(request('current', undefined, { 'x-sg-prepared-history-fingerprint': 'forged' }))).status, 400)
  const method = await handler(request('current', undefined, {}, 'POST')); assert.equal(method.status, 405); assert.equal(method.headers.get('allow'), 'GET')
  assert.equal(calls, 0)
})

test('missing or substituted native publication metadata cannot make an old or foreign deployment a successful source', async () => {
  for (const headers of [null, { 'X-Profitia-Operation-Contract': 'old' }, { 'X-Profitia-Application': 'srm' },
    { 'X-Profitia-Environment': 'staging' }, { 'X-Profitia-Forecast-Projection': 'sg2-stored-current-v1' }, { 'X-Profitia-Forecast-Resource': 'foreign' }]) {
    const handler = createNativeForecastReadHandler('current', { env: () => environment,
      fetch: async () => headers === null ? Response.json(body('current')) : publication('current', undefined, headers) })
    const result = await handler(request('current')); assert.equal(result.status, 503); assert(!(await result.text()).includes('shared_series'))
  }
})

test('source failures, redirects and transport errors stay bounded and never disclose upstream diagnostics', async () => {
  for (const status of [301, 302, 307, 400, 401, 403, 404, 413, 429, 500, 503]) {
    const handler = createNativeForecastReadHandler('current', { env: () => environment, fetch: async () =>
      new Response('SYNTHETIC_PRIVATE_UPSTREAM_DIAGNOSTIC', { status, headers: { location: 'https://evil.fixture.test/private' } }) })
    const response = await handler(request('current')); assert.equal(response.status, [400, 401, 403, 404, 413, 429, 503].includes(status) ? status : 503)
    assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_UPSTREAM_DIAGNOSTIC')); assert.equal(response.headers.get('location'), null)
  }
  const handler = createNativeForecastReadHandler('current', { env: () => environment, fetch: async () => { throw Error('SYNTHETIC_PRIVATE_UPSTREAM_DIAGNOSTIC') } })
  const response = await handler(request('current')); assert.equal(response.status, 503); assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_UPSTREAM_DIAGNOSTIC'))
})

test('malformed, oversized and mismatched bodies are withheld even when their transport metadata is present', async () => {
  for (const value of [null, [], { ...body('current'), seriesId: 'foreign' }, { ...body('current'), modelId: 'arima' },
    { ...body('current'), targetBasis: 'END_OF_PERIOD' }, { ...body('current'), currentForecast: null }, { ...body('current'), description: 'x'.repeat(MAX_NATIVE_FORECAST_BYTES) }]) {
    const handler = createNativeForecastReadHandler('current', { env: () => environment, fetch: async () => publication('current', value) })
    assert.equal((await handler(request('current'))).status, 503)
  }
  for (const type of ['text/html', 'application/jsonp', 'application/json']) {
    const headers = publication('current').headers; headers.set('content-type', type)
    const handler = createNativeForecastReadHandler('current', { env: () => environment, fetch: async () => new Response('not JSON', { headers }) })
    assert.equal((await handler(request('current'))).status, 503)
  }
})

test('actual middleware admits only the four configured native GET routes while pages, writes and other data APIs remain closed', async () => withEnvironment(async () => {
  for (const kind of Object.keys(NATIVE_FORECAST_API_PATHS) as NativeForecastReadKind[]) {
    const response = await middleware(request(kind)); assert.equal(response.headers.get('x-middleware-next'), '1')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal((await middleware(request(kind, undefined, {}, 'POST'))).status, 503)
  }
  for (const path of ['/en?embed=1', '/pl', '/api/components', '/api/records', '/api/series', '/api/forecast-accuracy', '/api/benchmark-forecast/current/prepare'])
    assert.equal((await middleware(new NextRequest(`https://dashboard.fixture.test${path}`, { headers: { authorization: bearer, cookie: 'synthetic_legacy' } }))).status, 503)
}))

test('all actual mounted native API dispatchers avoid legacy owner-datastore and technical-token paths', async () => withEnvironment(async () => {
  const previous = globalThis.fetch, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'dashboardPreviewMarketDataPrisma')
  let escapes = 0, calls = 0
  Object.defineProperty(globalThis, 'dashboardPreviewMarketDataPrisma', { configurable: true, get() { escapes++; throw Error('Forbidden owner datastore') } })
  globalThis.fetch = async input => {
    calls++; const path = new URL(String(input)).pathname
    const kind = path.endsWith('/readiness') ? 'capabilities' : path.endsWith('/capability') ? 'capability'
      : path.endsWith('/verification') ? 'verification' : 'current'
    return publication(kind)
  }
  try {
    for (const [kind, get] of [['current', currentGET], ['verification', verificationGET], ['capability', capabilityGET], ['capabilities', capabilitiesGET]] as const)
      assert.equal((await get(request(kind))).status, 200)
    assert.equal(calls, 4); assert.equal(escapes, 0)
  } finally {
    globalThis.fetch = previous
    if (descriptor) Object.defineProperty(globalThis, 'dashboardPreviewMarketDataPrisma', descriptor); else Reflect.deleteProperty(globalThis, 'dashboardPreviewMarketDataPrisma')
  }
}))

test('fresh relay and route imports do not initialize the legacy owner datastore or call a provider', () => {
  const script = "let owner=0,network=0;Object.defineProperty(globalThis,'dashboardPreviewMarketDataPrisma',{configurable:true,get(){owner++;throw Error('Forbidden owner source')}});globalThis.fetch=async()=>{network++;throw Error('Forbidden network')};await import(process.argv[1]);if(owner||network)throw Error('Import resolved resources');console.log(JSON.stringify({owner,network}));"
  for (const file of ['../lib/benchmark-forecast/native-read-relay.ts', '../app/api/benchmark-forecast/current/route.ts',
    '../app/api/benchmark-forecast/verification/route.ts', '../app/api/benchmark-forecast/current/capability/route.ts', '../app/api/benchmark-forecast/current/capabilities/route.ts']) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script, new URL(file, import.meta.url).href], {
      env: { ...process.env, DATABASE_URL: 'postgresql://architecture_test_owner@127.0.0.1:1/sg2_operation_test',
        MARKET_DATA_DATABASE_URL: 'postgresql://architecture_test_owner@127.0.0.1:1/sg2_operation_test' }, encoding: 'utf8', timeout: 15000,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout); assert.deepEqual(JSON.parse(result.stdout.trim()), { owner: 0, network: 0 })
  }
})
