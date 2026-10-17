import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { NextRequest, NextResponse } from 'next/server'

// Real mounted routes, no cloud credentials, private records or vendor calls.
const keys = ['PROFITIA_AUTH_PROVIDER', 'SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN'] as const
const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]))
const syntheticCredential = 'isolated-technical-boundary-fixture'
let withAuth: typeof import('../lib/api/internal-forecast-service-auth').withInternalForecastServiceAuth
const originalFetch = globalThis.fetch
let fetches = 0
before(async () => {
  process.env.PROFITIA_AUTH_PROVIDER = 'legacy_demo'
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = syntheticCredential
  withAuth = (await import('../lib/api/internal-forecast-service-auth')).withInternalForecastServiceAuth
  globalThis.fetch = async () => { fetches++; throw new Error('Unexpected external call') }
})
after(() => {
  globalThis.fetch = originalFetch
  for (const key of keys) {
    if (prior[key] === undefined) delete process.env[key]
    else process.env[key] = prior[key]
  }
})
function request(method = 'GET', credential: string | null = syntheticCredential) {
  return new NextRequest('https://fixture.invalid/api/internal/forecast/production?seriesId=synthetic_series', {
    method, headers: {
      ...(credential === null ? {} : { authorization: `Bearer ${credential}` }),
      'x-clerk-org-id': 'forged-organisation', 'x-clerk-user-id': 'forged-user',
      'x-clerk-org-role': 'owner', 'x-profitia-service-grant': 'forged-grant',
      'x-forecast-correlation-id': 'fixture-correlation',
      cookie: 'sg_porr_demo_session_development=forged',
    },
  })
}
function assertPrivate(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const vary = response.headers.get('vary')?.toLowerCase().split(',').map(value => value.trim()) ?? []
  assert(vary.includes('cookie') && vary.includes('authorization'))
}

for (const mode of ['clerk', 'unknown', '', 'CLERK', 'legacy_demo ']) {
  test(`server mode ${JSON.stringify(mode)} refuses an otherwise valid legacy credential before business invocation`, async () => {
    process.env.PROFITIA_AUTH_PROVIDER = mode
    let calls = 0
    const handler = withAuth(async () => { calls++; return NextResponse.json({ private: true }) })
    const response = await handler(request())
    assert.equal(response.status, 403); assertPrivate(response)
    assert.equal((await response.json()).code, 'INTERNAL_SERVICE_AUTH_UNAVAILABLE')
    assert.equal(calls, 0); assert.equal(fetches, 0)
  })
}
for (const mode of [undefined, 'legacy_demo']) {
  test(`retained ${mode ?? 'default'} deployment preserves handler arguments, principal, body and status`, async () => {
    if (mode === undefined) delete process.env.PROFITIA_AUTH_PROVIDER
    else process.env.PROFITIA_AUTH_PROVIDER = mode
    let calls = 0
    const handler = withAuth(async (principal, incoming, parameter: string) => {
      calls++; assert.equal(principal.kind, 'INTERNAL_SERVICE')
      assert.equal(principal.scope, 'FORECAST_READ'); assert.equal(principal.service, 'DASHBOARD_PREVIEW')
      assert.equal(parameter, 'path-argument'); assert(incoming instanceof NextRequest)
      assert.equal('userId' in principal, false); assert.equal('orgId' in principal, false)
      return NextResponse.json({ state: 'QUEUED', reference: 'synthetic-job' }, {
        status: 202, headers: { 'Cache-Control': 'public, max-age=600', Vary: 'Origin, cookie' },
      })
    })
    const response = await handler(request(), 'path-argument')
    assert.equal(response.status, 202); assertPrivate(response)
    assert.equal(response.headers.get('vary'), 'Origin, cookie, Authorization')
    assert.deepEqual(await response.json(), { state: 'QUEUED', reference: 'synthetic-job' }); assert.equal(calls, 1)
  })
}
for (const [credential, configured, status, code] of [
  [null, true, 401, 'INTERNAL_SERVICE_AUTH_REQUIRED'],
  ['wrong-fixture', true, 403, 'INTERNAL_SERVICE_AUTH_INVALID'],
  [syntheticCredential, false, 403, 'INTERNAL_SERVICE_AUTH_UNAVAILABLE'],
] as const) {
  test(`retained deployment preserves ${code} without business access`, async () => {
    process.env.PROFITIA_AUTH_PROVIDER = 'legacy_demo'
    if (configured) process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = syntheticCredential
    else delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    let calls = 0
    const response = await withAuth(async () => { calls++; return NextResponse.json(null) })(request('GET', credential))
    assert.equal(response.status, status); assertPrivate(response)
    const payload = await response.json(); assert.equal(payload.code, code)
    assert(!JSON.stringify(payload).includes(syntheticCredential)); assert.equal(calls, 0)
  })
}
test('legacy handler errors do not disclose provider secrets in response or diagnostic', async () => {
  process.env.PROFITIA_AUTH_PROVIDER = 'legacy_demo'
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = syntheticCredential
  const logs: unknown[][] = [], previous = console.error
  console.error = (...args: unknown[]) => { logs.push(args) }
  try {
    const response = await withAuth(async () => { throw Error('fixture-private-exception-must-not-escape') })(request())
    assert.equal(response.status, 500); assertPrivate(response)
    assert.equal((await response.json()).error, 'Operation unavailable.')
    assert.equal(logs.length, 1); assert(!JSON.stringify(logs).includes('fixture-private-exception-must-not-escape'))
  } finally { console.error = previous }
})

const routes = [
  [
    "../app/api/internal/forecast/action-trace/route",
    "POST"
  ],
  [
    "../app/api/internal/forecast/action-trace/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/capabilities/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/capability/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/execution-ledger/route",
    "POST"
  ],
  [
    "../app/api/internal/forecast/preparation/jobs/route",
    "POST"
  ],
  [
    "../app/api/internal/forecast/preparation/jobs/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/prepare/current/route",
    "POST"
  ],
  [
    "../app/api/internal/forecast/prepared/current/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/prepared/verification/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/production/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/progressive/route",
    "POST"
  ],
  [
    "../app/api/internal/forecast/readiness/route",
    "GET"
  ],
  [
    "../app/api/internal/forecast/verification/route",
    "GET"
  ]
] as const
const routeCount = routes.length
assert.equal(routeCount, 14)
for (const [path, method] of routes) {
  for (const mode of ['clerk', 'unknown', '']) {
    test(`mounted ${method} ${path}: mode ${JSON.stringify(mode)} denies the old token`, async () => {
      process.env.PROFITIA_AUTH_PROVIDER = mode
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = syntheticCredential
      const mounted = await import(path) as Record<string, (request: NextRequest) => Promise<NextResponse>>
      assert.equal(typeof mounted[method], 'function')
      const response = await mounted[method]!(request(method))
      assert.equal(response.status, 403); assertPrivate(response)
      const value = await response.json(); assert.equal(value.code, 'INTERNAL_SERVICE_AUTH_UNAVAILABLE')
      assert(!JSON.stringify(value).includes(syntheticCredential)); assert.equal(fetches, 0)
    })
  }
}
