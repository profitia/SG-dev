import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  isTemporaryPublicBenchmarkComponentRequest,
  resolveCognitionAuth,
} from '../lib/api/middleware'

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

test('production runtime keeps protected benchmark search closed when profile is absent', () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
  })

  assert.equal(auth, null)
})

test('production runtime keeps protected benchmark search closed when profile flag is malformed or false', () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const falseAuth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: false,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
  })

  assert.equal(falseAuth, null)
})

test('production runtime allows approved temporary benchmark component endpoints only when the profile is enabled', () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
  })

  assert.deepEqual(auth, {
    orgId: 'temp-org',
    userId: 'temp-user',
    orgRole: 'viewer',
    requestId: auth?.requestId,
  })
})

test('production runtime does not expose unrelated SG surfaces when temporary profile is enabled', () => {
  const request = buildRequest('http://localhost/api/internal/forecast/production?seriesId=wocaes0074')
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
  })

  assert.equal(auth, null)
})

test('production runtime keeps non-approved methods closed even on approved benchmark paths', () => {
  const request = buildRequest('http://localhost/api/category/abc', { method: 'PATCH' })
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
  })

  assert.equal(auth, null)
})

test('production runtime fails closed when temporary profile identity is incomplete', () => {
  const request = buildRequest('http://localhost/api/benchmark/selection')
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    developmentOrgId: 'temp-org',
    developmentUserId: '',
    developmentOrgRole: 'viewer',
  })

  assert.equal(auth, null)
})

test('normal Clerk-authenticated behavior is unchanged', () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel', {
    headers: {
      'x-clerk-org-id': 'org-1',
      'x-clerk-user-id': 'user-1',
      'x-clerk-org-role': 'admin',
      'x-request-id': 'req-123',
    },
  })
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: false,
    isTemporaryPublicBenchmarkComponentProfile: true,
    developmentOrgId: 'temp-org',
    developmentUserId: 'temp-user',
    developmentOrgRole: 'viewer',
  })

  assert.deepEqual(auth, {
    orgId: 'org-1',
    userId: 'user-1',
    orgRole: 'admin',
    requestId: 'req-123',
  })
})

test('existing local development fallback behavior is unchanged', () => {
  const request = buildRequest('http://localhost/api/benchmark/search?q=steel')
  const auth = resolveCognitionAuth(request, {
    isDevelopmentRuntime: true,
    isTemporaryPublicBenchmarkComponentProfile: false,
    developmentOrgId: undefined,
    developmentUserId: undefined,
    developmentOrgRole: undefined,
  })

  assert.deepEqual(auth, {
    orgId: 'dev-org-1',
    userId: 'dev-user-1',
    orgRole: 'developer',
    requestId: auth?.requestId,
  })
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