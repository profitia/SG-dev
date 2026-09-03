import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  isTemporaryPublicBenchmarkComponentRequest,
  resolveCognitionAuth,
} from '../lib/api/middleware'
import { createPorrDemoSessionToken } from '../lib/porr-demo-session'

function buildRequest(
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
  },
) {
  return new NextRequest(url, {
    method: init?.method,
    headers: init?.headers,
  })
}

test('production runtime keeps protected benchmark search closed when profile is absent', async () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: false,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.equal(auth, null)
})

test('production runtime keeps protected benchmark search closed when profile flag is malformed or false', async () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const falseAuth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: false,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.equal(falseAuth, null)
})

test('production runtime allows approved temporary benchmark component endpoints only when the profile is enabled', async () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.deepEqual(auth, {
    orgId: 'temp-org',
    userId: 'temp-user',
    orgRole: 'viewer',
    requestId: auth?.requestId,
  })
})

test('production runtime does not expose unrelated SG surfaces when temporary profile is enabled', async () => {
  const request = buildRequest('http://localhost/api/internal/forecast/production?seriesId=wocaes0074')
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.equal(auth, null)
})

test('production runtime keeps non-approved methods closed even on approved benchmark paths', async () => {
  const request = buildRequest('http://localhost/api/category/abc', { method: 'PATCH' })
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.equal(auth, null)
})

test('production runtime fails closed when temporary profile identity is incomplete', async () => {
  const request = buildRequest('http://localhost/api/benchmark/selection')
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: '',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.equal(auth, null)
})

test('normal Clerk-authenticated behavior is unchanged', async () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel', {
    headers: {
      'x-clerk-org-id': 'org-1',
      'x-clerk-user-id': 'user-1',
      'x-clerk-org-role': 'admin',
      'x-request-id': 'req-123',
    },
  })
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    isPorrDemoProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.deepEqual(auth, {
    orgId: 'org-1',
    userId: 'user-1',
    orgRole: 'admin',
    requestId: 'req-123',
  })
})

test('existing local development fallback behavior is unchanged when PORR profile is disabled', async () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: true,
    isTemporaryPublicBenchmarkComponentProfile: false,
    isPorrDemoProfile: false,
    developmentOrgId: undefined,
    developmentUserId: undefined,
    developmentOrgRole: undefined,
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.deepEqual(auth, {
    orgId: 'dev-org-1',
    userId: 'dev-user-1',
    orgRole: 'developer',
    requestId: auth?.requestId,
  })
})

test('PORR profile accepts a valid signed demo session for benchmark APIs only', async () => {
  const token = await createPorrDemoSessionToken('secret', {
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
  })

  const request = buildRequest('http://localhost/api/benchmark/metadata', {
    headers: {
      cookie: `sg_porr_demo_session=${token}`,
    },
  })

  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: false,
    isPorrDemoProfile: true,
    developmentOrgId: 'porr-org',
    developmentUserId: 'porr-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.deepEqual(auth, {
    orgId: 'porr-org',
    userId: 'porr-user',
    orgRole: 'viewer',
    requestId: auth?.requestId,
  })
})

test('PORR profile keeps category APIs closed and suppresses development fallback', async () => {
  const request = buildRequest('http://localhost/api/category')

  const auth = await resolveCognitionAuth(request, {
    isDevelopmentRuntime: true,
    isTemporaryPublicBenchmarkComponentProfile: false,
    isPorrDemoProfile: true,
    developmentOrgId: 'porr-org',
    developmentUserId: 'porr-user',
    developmentOrgRole: 'viewer',
    porrDemoPassword: 'pw',
    porrDemoSessionSecret: 'secret',
  })

  assert.equal(auth, null)
})

test('temporary benchmark component allowlist is constrained to the approved method and path pairs', () => {
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/benchmark/metadata'), true)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/benchmark/metadata/source/values'), true)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/benchmark/preview'), true)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('POST', '/api/benchmark/context'), true)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/category'), true)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/category/cat-1'), true)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/benchmark/context'), false)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('POST', '/api/benchmark/preview'), false)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('POST', '/api/category'), false)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('PATCH', '/api/category/cat-1'), false)
  assert.equal(isTemporaryPublicBenchmarkComponentRequest('GET', '/api/internal/forecast/production'), false)
})