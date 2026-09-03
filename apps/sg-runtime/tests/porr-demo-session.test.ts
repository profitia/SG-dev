import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildExpiredPorrDemoSessionCookie,
  buildPorrDemoSessionCookie,
  createPorrDemoSessionToken,
  verifyPorrDemoSessionToken,
} from '../lib/porr-demo-session'
import {
  isPorrDemoAllowedApiRequest,
  isPorrDemoProtectedPagePath,
  isPorrDemoRestrictedPagePath,
  isPorrDemoRuntimeReady,
  resolvePorrDemoCookieDomain,
} from '../lib/porr-demo-profile'

const SECRET = 'porr-demo-test-secret'

test('creates and verifies a signed PORR demo session token', async () => {
  const token = await createPorrDemoSessionToken(SECRET, {
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
  }, 1_725_000_000_000)

  const payload = await verifyPorrDemoSessionToken(SECRET, token, 1_725_000_100_000)

  assert.deepEqual(payload, {
    aud: 'sg-runtime-porr-demo',
    sub: 'porr-demo-access',
    profile: 'porr-demo',
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
    iat: 1725000000,
    exp: 1725028800,
  })
})

test('rejects tampered or expired PORR demo session tokens', async () => {
  const token = await createPorrDemoSessionToken(SECRET, {
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
  }, 1_725_000_000_000, 60)

  const [payload, signature] = token.split('.')
  const tamperedToken = `${payload}.broken${signature}`

  assert.equal(await verifyPorrDemoSessionToken(SECRET, tamperedToken, 1_725_000_010_000), null)
  assert.equal(await verifyPorrDemoSessionToken(SECRET, token, 1_725_000_061_000), null)
  assert.equal(await verifyPorrDemoSessionToken(SECRET, undefined, 1_725_000_010_000), null)
})

test('builds spenduru-wide cookie settings for production deployments', () => {
  const cookie = buildPorrDemoSessionCookie('token', 'https://demo-sg-porr.spenduru.app', 'production')
  const expiredCookie = buildExpiredPorrDemoSessionCookie('https://demo-sg-porr.spenduru.app', 'production')

  assert.equal(cookie.domain, '.spenduru.app')
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.sameSite, 'lax')
  assert.equal(cookie.secure, true)
  assert.equal(expiredCookie.maxAge, 0)
})

test('PORR demo routing and readiness helpers fail closed by default', () => {
  assert.equal(isPorrDemoProtectedPagePath('/pl/benchmark-finder'), true)
  assert.equal(isPorrDemoProtectedPagePath('/pl'), false)
  assert.equal(isPorrDemoRestrictedPagePath('/pl/category-builder'), true)
  assert.equal(isPorrDemoRestrictedPagePath('/en/cost-scan/category/cat-1'), true)
  assert.equal(isPorrDemoAllowedApiRequest('POST', '/api/benchmark/ai-search'), true)
  assert.equal(isPorrDemoAllowedApiRequest('GET', '/api/category'), false)
  assert.equal(resolvePorrDemoCookieDomain('https://demo-sg-porr.spenduru.app'), '.spenduru.app')
  assert.equal(resolvePorrDemoCookieDomain('http://localhost:3001'), undefined)
  assert.equal(isPorrDemoRuntimeReady({ enabled: false }), false)
  assert.equal(isPorrDemoRuntimeReady({ enabled: true, password: 'pw', sessionSecret: 'secret', orgId: 'org', userId: 'user', orgRole: 'viewer' }), true)
  assert.equal(isPorrDemoRuntimeReady({ enabled: true, password: 'pw', sessionSecret: 'secret', orgId: 'org', userId: '', orgRole: 'viewer' }), false)
})