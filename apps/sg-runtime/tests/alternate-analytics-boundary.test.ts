import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { NextRequest, NextResponse } from 'next/server'

// This process exercises the actual route and retained signed deployment
// profile. No paid provider request, private connection or fake Clerk user.
const environment = {
  APP_ENV: 'development', NODE_ENV: 'production', SG_RUNTIME_PORR_DEMO: 'true',
  SG_RUNTIME_TEMPORARY_PUBLIC_BENCHMARK_COMPONENT: 'false',
  PORR_DEMO_PASSWORD: 'synthetic-password', PORR_DEMO_SESSION_SECRET: 'synthetic-secret',
  SG_RUNTIME_DEV_ORG_ID: 'fixture-demo-organisation', SG_RUNTIME_DEV_USER_ID: 'fixture-demo-user',
  SG_RUNTIME_DEV_ORG_ROLE: 'viewer', PROFITIA_AUTH_PROVIDER: 'legacy_demo',
}
const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]))
Object.assign(process.env, environment)
let GET: typeof import('../app/api/benchmark/analytics-series/route').GET
let withCognitionAuth: typeof import('../lib/api/middleware').withCognitionAuth
let token: string
let fetches = 0
const originalFetch = globalThis.fetch
before(async () => {
  globalThis.fetch = async () => { fetches++; throw new Error('Unexpected provider request') }
  GET = (await import('../app/api/benchmark/analytics-series/route')).GET
  withCognitionAuth = (await import('../lib/api/middleware')).withCognitionAuth
  const { createPorrDemoSessionToken } = await import('../lib/porr-demo-session')
  token = await createPorrDemoSessionToken(environment.PORR_DEMO_SESSION_SECRET, {
    orgId: environment.SG_RUNTIME_DEV_ORG_ID, userId: environment.SG_RUNTIME_DEV_USER_ID,
    orgRole: environment.SG_RUNTIME_DEV_ORG_ROLE,
  })
})
after(() => {
  globalThis.fetch = originalFetch
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
function request(headers: Record<string, string> = {}, query = 'seriesId=synthetic_series_01') {
  return new NextRequest(`https://app.fixture.test/api/benchmark/analytics-series?${query}`, { headers })
}
const cookie = () => ({ cookie: `sg_porr_demo_session_development=${token}` })
function assertPrivate(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const vary = response.headers.get('vary')?.toLowerCase().split(',').map(value => value.trim())
  assert(vary?.includes('cookie') && vary.includes('authorization'))
}

test('actual alternate API refuses missing identity before vendor access', async () => {
  const response = await GET(request())
  assert.equal(response.status, 401); assertPrivate(response); assert.equal(fetches, 0)
})
test('unsigned Clerk headers or role claims cannot open the alternate API', async () => {
  const response = await GET(request({ 'x-clerk-user-id': 'forged', 'x-clerk-org-id': 'forged', 'x-clerk-org-role': 'owner' }))
  assert.equal(response.status, 401); assertPrivate(response); assert.equal(fetches, 0)
})
test('a real signed cookie from another deployment environment is refused', async () => {
  const response = await GET(request({ cookie: `sg_porr_demo_session=${token}` }))
  assert.equal(response.status, 401); assertPrivate(response); assert.equal(fetches, 0)
})
test('malformed signed-profile cookie cannot reach the provider', async () => {
  const response = await GET(request({ cookie: 'sg_porr_demo_session_development=invalid' }))
  assert.equal(response.status, 401); assertPrivate(response); assert.equal(fetches, 0)
})
test('configured signed legacy session reaches existing parameter validation', async () => {
  const response = await GET(request(cookie(), 'range=invalid'))
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'VALIDATION_ERROR')
  assertPrivate(response); assert.equal(fetches, 0)
})
for (const provider of ['clerk', 'unknown', '']) {
  test(`explicit ${provider || 'empty'} provider cannot borrow a signed demo session`, async () => {
    const prior = process.env.PROFITIA_AUTH_PROVIDER
    try {
      process.env.PROFITIA_AUTH_PROVIDER = provider
      const response = await GET(request(cookie()))
      assert.equal(response.status, 401); assertPrivate(response); assert.equal(fetches, 0)
    } finally { process.env.PROFITIA_AUTH_PROVIDER = prior }
  })
}
test('shared helper preserves the handler body/status and existing Vary without duplicate credentials', async () => {
  const value = { seriesId: 'synthetic_series_01', observations: [{ date: '2026-01-01', value: 7 }] }
  const handler = withCognitionAuth(async () => NextResponse.json(value, {
    status: 202, headers: { 'Cache-Control': 'public, max-age=600', Vary: 'Origin, cookie' },
  }))
  const response = await handler(request(cookie()))
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), value); assertPrivate(response)
  assert.equal(response.headers.get('vary'), 'Origin, cookie, Authorization')
})
test('shared helper retains wildcard Vary while refusing shared caching', async () => {
  const handler = withCognitionAuth(async () => NextResponse.json({ ok: true }, { headers: { Vary: '*' } }))
  const response = await handler(request(cookie()))
  assert.equal(response.headers.get('vary'), '*'); assert.equal(response.headers.get('cache-control'), 'private, no-store')
})
test('unexpected private/provider exceptions are absent from public responses and legacy diagnostics', async () => {
  const secret = 'synthetic_private_exception_do_not_log'
  const logs: unknown[][] = [], prior = console.error
  console.error = (...args: unknown[]) => { logs.push(args) }
  try {
    const handler = withCognitionAuth(async () => { throw new Error(secret) })
    const response = await handler(request(cookie()))
    assert.equal(response.status, 500); assertPrivate(response)
    assert.equal((await response.json()).error, 'Operation unavailable.')
    assert(!JSON.stringify(logs).includes(secret)); assert.equal(logs.length, 1)
  } finally { console.error = prior }
})
