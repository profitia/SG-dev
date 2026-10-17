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

function assertPrivate(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const vary = response.headers.get('vary')?.toLowerCase().split(',').map(value => value.trim())
  assert(vary?.includes('cookie') && vary.includes('authorization'))
}

for (const provider of ['clerk', 'unknown', '', ' legacy_demo ']) {
  for (const enabled of ['true', undefined]) {
    test(`explicit ${provider || 'empty'} provider refuses demo and open preview (profile=${enabled})`, async () => {
      await withEnv({
        PROFITIA_AUTH_PROVIDER: provider, DASHBOARD_PREVIEW_PORR_DEMO: enabled,
        PORR_DEMO_ENTRY_URL: 'https://app.fixture.test/en', PORR_DEMO_SESSION_SECRET: 'synthetic-secret',
        APP_ENV: 'development',
      }, async () => {
        const token = await createSignedToken('synthetic-secret')
        for (const path of ['/en?embed=1', '/api/series?organizationId=forged&pipelineId=forged']) {
          const response = await middleware(new NextRequest(`https://dashboard.fixture.test${path}`, {
            headers: { cookie: `sg_porr_demo_session_development=${token}`,
              'x-clerk-user-id': 'forged', 'x-clerk-org-id': 'forged', 'x-clerk-org-role': 'owner' },
          }))
          assert.equal(response.status, 503); assertPrivate(response)
          assert.equal(response.headers.get('x-middleware-next'), null)
          assert.equal(response.headers.get('location'), null)
        }
      })
    })
  }
}

test('explicit legacy mode preserves signed private dashboard API and page behavior', async () => {
  await withEnv({
    PROFITIA_AUTH_PROVIDER: 'legacy_demo', APP_ENV: 'development',
    DASHBOARD_PREVIEW_PORR_DEMO: 'true', PORR_DEMO_ENTRY_URL: 'https://app.fixture.test/en',
    PORR_DEMO_SESSION_SECRET: 'synthetic-secret',
  }, async () => {
    const token = await createSignedToken('synthetic-secret')
    for (const path of ['/en?embed=1', '/api/series?seriesId=synthetic']) {
      const response = await middleware(new NextRequest(`https://dashboard.fixture.test${path}`, {
        headers: { cookie: `sg_porr_demo_session_development=${token}` },
      }))
      assert.equal(response.status, 200); assertPrivate(response)
    }
    const refused = await middleware(new NextRequest('https://dashboard.fixture.test/api/series'))
    assert.equal(refused.status, 401); assertPrivate(refused)
    const redirected = await middleware(new NextRequest('https://dashboard.fixture.test/en'))
    assert.equal(redirected.status, 307); assertPrivate(redirected)
    assert.equal(redirected.headers.get('location'), 'https://app.fixture.test/en')
  })
})

test('private dashboard configuration failures retain the same cache boundary', async () => {
  await withEnv({
    PROFITIA_AUTH_PROVIDER: 'legacy_demo', DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: undefined, PORR_DEMO_SESSION_SECRET: undefined,
  }, async () => {
    for (const path of ['/en', '/api/series']) {
      const response = await middleware(new NextRequest(`https://dashboard.fixture.test${path}`))
      assert.equal(response.status, 503); assertPrivate(response)
    }
  })
})

test('explicit legacy mode preserves the intentionally open library policy', async () => {
  await withEnv({
    PROFITIA_AUTH_PROVIDER: 'legacy_demo', DASHBOARD_PREVIEW_PORR_DEMO: undefined,
    PORR_DEMO_ENTRY_URL: undefined, PORR_DEMO_SESSION_SECRET: undefined,
  }, async () => {
    const response = await middleware(new NextRequest('https://dashboard.fixture.test/api/series'))
    assert.equal(response.headers.get('x-middleware-next'), '1')
    assert.equal(response.headers.get('cache-control'), null)
  })
})

test('PORR middleware redirects unauthenticated page requests to the SG Runtime entry URL', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spendguru.app/pl',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const response = await middleware(new NextRequest('https://analytics-demo-sg-porr.spendguru.app/pl?embed=1'))
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'https://demo-sg-porr.spendguru.app/pl')
  })
})

test('PORR middleware rejects unauthenticated and malformed API requests', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spendguru.app/pl',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const missing = await middleware(new NextRequest('https://analytics-demo-sg-porr.spendguru.app/api/series?seriesId=wocaes0074'))
    assert.equal(missing.status, 401)

    const malformed = await middleware(new NextRequest('https://analytics-demo-sg-porr.spendguru.app/api/series?seriesId=wocaes0074', {
      headers: { cookie: 'sg_porr_demo_session=malformed-token' },
    }))
    assert.equal(malformed.status, 401)
  })
})

test('PORR middleware accepts a valid shared session for embedded dashboard requests', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spendguru.app/pl',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const token = await createSignedToken('shared-secret')
    const response = await middleware(new NextRequest('https://analytics-demo-sg-porr.spendguru.app/pl?embed=1&variantId=forecast-portfolio-v3', {
      headers: { cookie: `sg_porr_demo_session=${token}` },
    }))

    assert.notEqual(response.headers.get('location'), 'https://demo-sg-porr.spendguru.app/pl')
    assert.equal(response.status, 200)
  })
})

test('Development dashboard accepts only the Development cookie, not the Staging cookie', async () => {
  await withEnv({
    APP_ENV: 'development',
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://dev-sg2.spendguru.app/en',
    PORR_DEMO_SESSION_SECRET: 'shared-secret',
  }, async () => {
    const token = await createSignedToken('shared-secret')
    const url = 'https://analytics-dev-sg2.spendguru.app/en?embed=1'
    const stagingCookie = await middleware(new NextRequest(url, {
      headers: { cookie: `sg_porr_demo_session=${token}` },
    }))
    assert.equal(stagingCookie.headers.get('location'), 'https://dev-sg2.spendguru.app/en')

    const developmentCookie = await middleware(new NextRequest(url, {
      headers: { cookie: `sg_porr_demo_session_development=${token}` },
    }))
    assert.equal(developmentCookie.status, 200)
    assert.notEqual(developmentCookie.headers.get('location'), 'https://dev-sg2.spendguru.app/en')
  })
})

test('PORR middleware fails closed when profile is enabled without the shared session secret', async () => {
  await withEnv({
    DASHBOARD_PREVIEW_PORR_DEMO: 'true',
    PORR_DEMO_ENTRY_URL: 'https://demo-sg-porr.spendguru.app/pl',
    PORR_DEMO_SESSION_SECRET: undefined,
  }, async () => {
    const response = await middleware(new NextRequest('https://analytics-demo-sg-porr.spendguru.app/api/series?seriesId=wocaes0074'))
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
