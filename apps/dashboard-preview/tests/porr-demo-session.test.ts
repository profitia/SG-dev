import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPorrDemoEntryRedirectTarget,
  buildPorrDemoSessionCookieHeader,
  extractPorrDemoSessionCookieValue,
  isDashboardPreviewPorrDemoRuntimeReady,
  resolveDashboardPreviewPorrDemoRuntimeConfig,
} from '@/lib/porr-demo-profile'
import { verifyPorrDemoSessionToken } from '@/lib/porr-demo-session'

async function createSignedToken(secret: string, payloadOverrides: Partial<Record<string, unknown>> = {}, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const payload = {
    aud: 'sg-runtime-porr-demo',
    sub: 'porr-demo-access',
    profile: 'porr-demo',
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
    iat: issuedAt,
    exp: issuedAt + 60,
    ...payloadOverrides,
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

test('Dashboard Preview validates the existing SG Runtime PORR session format', async () => {
  const token = await createSignedToken('shared-secret')
  const payload = await verifyPorrDemoSessionToken('shared-secret', token)

  assert.equal(payload?.aud, 'sg-runtime-porr-demo')
  assert.equal(payload?.profile, 'porr-demo')
  assert.equal(payload?.orgId, 'porr-org')
})

test('Dashboard Preview rejects malformed, invalid, and expired PORR sessions', async () => {
  const validToken = await createSignedToken('shared-secret')
  const expiredToken = await createSignedToken('shared-secret', { exp: Math.floor(Date.now() / 1000) - 1 })

  assert.equal(await verifyPorrDemoSessionToken('shared-secret', 'malformed-token'), null)
  assert.equal(await verifyPorrDemoSessionToken('different-secret', validToken), null)
  assert.equal(await verifyPorrDemoSessionToken('shared-secret', expiredToken), null)
})

test('Dashboard Preview PORR runtime config fails closed unless fully enabled', () => {
  const previousFlag = process.env.DASHBOARD_PREVIEW_PORR_DEMO
  const previousEntryUrl = process.env.PORR_DEMO_ENTRY_URL
  const previousSecret = process.env.PORR_DEMO_SESSION_SECRET

  delete process.env.DASHBOARD_PREVIEW_PORR_DEMO
  delete process.env.PORR_DEMO_ENTRY_URL
  delete process.env.PORR_DEMO_SESSION_SECRET

  try {
    const config = resolveDashboardPreviewPorrDemoRuntimeConfig()
    assert.equal(config.enabled, false)
    assert.equal(isDashboardPreviewPorrDemoRuntimeReady(config), false)
    assert.equal(buildPorrDemoEntryRedirectTarget(config.entryUrl), null)
  } finally {
    if (previousFlag === undefined) delete process.env.DASHBOARD_PREVIEW_PORR_DEMO
    else process.env.DASHBOARD_PREVIEW_PORR_DEMO = previousFlag
    if (previousEntryUrl === undefined) delete process.env.PORR_DEMO_ENTRY_URL
    else process.env.PORR_DEMO_ENTRY_URL = previousEntryUrl
    if (previousSecret === undefined) delete process.env.PORR_DEMO_SESSION_SECRET
    else process.env.PORR_DEMO_SESSION_SECRET = previousSecret
  }
})

test('Dashboard Preview extracts and rebuilds only the shared PORR cookie header', () => {
  const cookieHeader = 'other=value; sg_porr_demo_session=signed.token; another=entry'
  assert.equal(extractPorrDemoSessionCookieValue(cookieHeader), 'signed.token')
  assert.equal(buildPorrDemoSessionCookieHeader('signed.token'), 'sg_porr_demo_session=signed.token')
  assert.equal(buildPorrDemoSessionCookieHeader(''), null)
})