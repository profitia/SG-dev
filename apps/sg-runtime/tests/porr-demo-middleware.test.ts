import assert from 'node:assert/strict'
import test, { before } from 'node:test'

import { NextRequest } from 'next/server'

process.env.APP_ENV = 'development'
process.env.NODE_ENV = 'production'
process.env.SG_RUNTIME_PORR_DEMO = 'true'
process.env.NEXT_PUBLIC_APP_URL = 'https://dev-sg2.spendguru.app'
process.env.PORR_DEMO_PASSWORD = 'test-password'
process.env.PORR_DEMO_SESSION_SECRET = 'test-secret'
process.env.SG_RUNTIME_DEV_ORG_ID = 'test-org'
process.env.SG_RUNTIME_DEV_USER_ID = 'test-user'
process.env.SG_RUNTIME_DEV_ORG_ROLE = 'viewer'

let middleware: typeof import('../middleware').default
let createPorrDemoSessionToken: typeof import('../lib/porr-demo-session').createPorrDemoSessionToken

before(async () => {
  middleware = (await import('../middleware')).default
  createPorrDemoSessionToken = (await import('../lib/porr-demo-session')).createPorrDemoSessionToken
})

test('upgrades a valid host-only Development session for the analytics sibling host', async () => {
  const token = await createPorrDemoSessionToken('test-secret', {
    orgId: 'test-org',
    userId: 'test-user',
    orgRole: 'viewer',
  })
  const response = await middleware(new NextRequest('https://dev-sg2.spendguru.app/en/benchmark-finder', {
    headers: { cookie: `sg_porr_demo_session_development=${token}` },
  }))

  const cookie = response.cookies.get('sg_porr_demo_session_development')
  assert.equal(response.status, 200)
  assert.equal(cookie?.value, token)
  assert.equal(cookie?.domain, '.spendguru.app')
  assert.equal(cookie?.httpOnly, true)
  assert.equal(cookie?.secure, true)
  assert.ok((cookie?.maxAge ?? 0) > 0)
})

test('does not reissue an invalid session or issue a cross-domain cookie on the technical host', async () => {
  const invalid = await middleware(new NextRequest('https://dev-sg2.spendguru.app/en/benchmark-finder', {
    headers: { cookie: 'sg_porr_demo_session_development=invalid' },
  }))
  assert.equal(invalid.cookies.get('sg_porr_demo_session_development'), undefined)
  assert.equal(invalid.status, 307)

  const token = await createPorrDemoSessionToken('test-secret', {
    orgId: 'test-org',
    userId: 'test-user',
    orgRole: 'viewer',
  })
  const technical = await middleware(new NextRequest('https://sg2-development-runtime.onrender.com/en/benchmark-finder', {
    headers: { cookie: `sg_porr_demo_session_development=${token}` },
  }))
  assert.equal(technical.cookies.get('sg_porr_demo_session_development'), undefined)
})
