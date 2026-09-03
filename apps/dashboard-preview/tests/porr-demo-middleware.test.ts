import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import middleware from '@/middleware'

async function createSignedToken(secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const payload = {
    aud: 'sg-runtime-porr-demo',
    sub: 'porr-demo-access',
    profile: 'porr-demo',
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
    iat: issuedAt,
    exp: issuedAt + 300,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload))
  return `${encodedPayload}.${Buffer.from(signature).toString('base64url')}`
}

function withEnv(overrides: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const previousEntries = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]]),
  )

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(previousEntries)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })
}

test('PORR middleware redirects unauthenticated page requests to the SG Runtime entry URL', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spenduru.app/pl',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const response = await middleware(new NextRequest('https://analytics-demo-sg-porr.spenduru.app/pl?embed=1'))
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'https://demo-sg-porr.spenduru.app/pl')
  })
})

test('PORR middleware rejects unauthenticated and malformed API requests', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spenduru.app/pl',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const missing = await middleware(new NextRequest('https://analytics-demo-sg-porr.spenduru.app/api/series?seriesId=wocaes0074'))
    assert.equal(missing.status, 401)

    const malformed = await middleware(new NextRequest('https://analytics-demo-sg-porr.spenduru.app/api/series?seriesId=wocaes0074', {
      headers: { cookie: 'sg_porr_demo_session=malformed-token' },
    }))
    assert.equal(malformed.status, 401)
  })
})

test('PORR middleware accepts a valid shared session for embedded dashboard requests', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spenduru.app/pl',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const token = await createSignedToken('shared-secret')
    const response = await middleware(new NextRequest('https://analytics-demo-sg-porr.spenduru.app/pl?embed=1&variantId=forecast-portfolio-v3', {
      headers: { cookie: `sg_porr_demo_session=${token}` },
    }))

    assert.notEqual(response.headers.get('location'), 'https://demo-sg-porr.spenduru.app/pl')
    assert.equal(response.status, 200)
  })
})

test('PORR middleware fails closed when profile is enabled without the shared session secret', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spenduru.app/pl',
    PORR_DEMO_SESSION_SECRET: undefined,
  }, async () => {
    const response = await middleware(new NextRequest('https://analytics-demo-sg-porr.spenduru.app/api/series?seriesId=wocaes0074'))
    assert.equal(response.status, 503)
  })
})

test('existing dashboards-library behavior stays open when the PORR profile is disabled', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: undefined,
    PORR_DEMO_ENTRY_URL: undefined,
    PORR_DEMO_SESSION_SECRET: undefined,
  }, async () => {
    const response = await middleware(new NextRequest('https://dashboards-library.onrender.com/api/series?seriesId=wocaes0074'))
    assert.equal(response.headers.get('x-middleware-next'), '1')
  })
})