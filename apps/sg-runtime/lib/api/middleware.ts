/**
 * lib/api/middleware.ts — sg-runtime
 * PCOS-8 — SG2 Operational API Runtime
 *
 * Next.js-specific middleware helpers for procurement cognition API routes.
 * Provides legacy deployment-profile context, request validation,
 * request parsing and structured response builders.
 *
 * ARCHITECTURAL CONSTRAINTS:
 * - Legacy identity comes only from its verified demo session or explicit server profile
 * - Request headers never establish an individual user, organisation or role
 * - Individual authentication/permissions belong to the accepted shared private host
 * - Validation errors return 400 with structured ApiError
 * - Auth errors return 401 with structured ApiError
 * - Runtime errors return 500 with structured ApiError
 * - No Snowflake or PostgreSQL field names in responses
 */

import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import {
  isDevelopmentRuntime,
  isPorrDemoProfile,
  isTemporaryPublicBenchmarkComponentProfile,
  serverEnv,
} from '@/lib/env'
import {
  isPorrDemoAllowedApiRequest,
  isPorrDemoRuntimeReady,
  resolvePorrDemoSessionCookieName,
} from '@/lib/porr-demo-profile'
import { verifyPorrDemoSessionToken } from '@/lib/porr-demo-session'

// ─────────────────────────────────────────────────────────────────────────────
// Auth context
// ─────────────────────────────────────────────────────────────────────────────

export interface CognitionAuthContext {
  readonly orgId:    string
  readonly userId:   string
  readonly orgRole?: string
  readonly requestId: string
}

type AuthRequestLike = Pick<NextRequest, 'headers' | 'method' | 'nextUrl'>

type CognitionAuthRuntimeConfig = {
  /** This resolver is exclusively for the retained legacy profile. */
  readonly authProvider?: string
  readonly isDevelopmentRuntime: boolean
  readonly isTemporaryPublicBenchmarkComponentProfile: boolean
  readonly isPorrDemoProfile: boolean
  readonly developmentOrgId?: string
  readonly developmentUserId?: string
  readonly developmentOrgRole?: string
  readonly porrDemoPassword?: string
  readonly porrDemoSessionSecret?: string
  readonly appEnv?: 'development' | 'staging' | 'production'
}

type TemporaryPublicBenchmarkComponentRoute = {
  readonly method: 'GET' | 'POST'
  readonly pattern: RegExp
}

export const TEMPORARY_PUBLIC_BENCHMARK_COMPONENT_ALLOWLIST: readonly TemporaryPublicBenchmarkComponentRoute[] = [
  { method: 'GET', pattern: /^\/api\/benchmark\/search$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/search$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/preview$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/context$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/selection$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/selection$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/analytics-series$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/analytics-eligibility$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/metadata$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/metadata\/[^/]+\/values$/ },
  { method: 'GET', pattern: /^\/api\/category$/ },
  { method: 'GET', pattern: /^\/api\/category\/[^/]+$/ },
] as const

function trimToUndefined(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
}

export function isTemporaryPublicBenchmarkComponentRequest(method: string, pathname: string) {
  const normalizedMethod = method.trim().toUpperCase()
  const normalizedPathname = normalizePathname(pathname)

  return TEMPORARY_PUBLIC_BENCHMARK_COMPONENT_ALLOWLIST.some((route) => (
    route.method === normalizedMethod && route.pattern.test(normalizedPathname)
  ))
}

function resolveDevelopmentFallbackAuth(request: AuthRequestLike, config: CognitionAuthRuntimeConfig) {
  if (!config.isDevelopmentRuntime) {
    return null
  }

  return {
    orgId: config.developmentOrgId ?? 'dev-org-1',
    userId: config.developmentUserId ?? 'dev-user-1',
    orgRole: config.developmentOrgRole ?? 'developer',
    requestId: request.headers.get('x-request-id') ?? randomUUID(),
  } satisfies CognitionAuthContext
}

function resolveTemporaryPublicBenchmarkComponentAuth(
  request: AuthRequestLike,
  config: CognitionAuthRuntimeConfig,
) {
  if (!config.isTemporaryPublicBenchmarkComponentProfile) {
    return null
  }

  if (!isTemporaryPublicBenchmarkComponentRequest(request.method, request.nextUrl.pathname)) {
    return null
  }

  const developmentOrgId = trimToUndefined(config.developmentOrgId)
  const developmentUserId = trimToUndefined(config.developmentUserId)
  const developmentOrgRole = trimToUndefined(config.developmentOrgRole)

  if (!developmentOrgId || !developmentUserId || !developmentOrgRole) {
    return null
  }

  return {
    orgId: developmentOrgId,
    userId: developmentUserId,
    orgRole: developmentOrgRole,
    requestId: request.headers.get('x-request-id') ?? randomUUID(),
  } satisfies CognitionAuthContext
}

async function resolvePorrDemoAuth(
  request: AuthRequestLike,
  config: CognitionAuthRuntimeConfig,
) {
  if (!config.isPorrDemoProfile || config.isTemporaryPublicBenchmarkComponentProfile) {
    return null
  }

  if (!isPorrDemoRuntimeReady({
    enabled: config.isPorrDemoProfile,
    password: config.porrDemoPassword,
    sessionSecret: config.porrDemoSessionSecret,
    orgId: config.developmentOrgId,
    userId: config.developmentUserId,
    orgRole: config.developmentOrgRole,
  })) {
    return null
  }

  if (!isPorrDemoAllowedApiRequest(request.method, request.nextUrl.pathname)) {
    return null
  }

  const cookieName = resolvePorrDemoSessionCookieName(config.appEnv ?? serverEnv.APP_ENV)
  const token = request.headers.get('cookie')
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)

  const session = await verifyPorrDemoSessionToken(config.porrDemoSessionSecret!, token)
  if (!session) {
    return null
  }

  return {
    orgId: session.orgId,
    userId: session.userId,
    orgRole: session.orgRole,
    requestId: request.headers.get('x-request-id') ?? randomUUID(),
  } satisfies CognitionAuthContext
}

export async function resolveCognitionAuth(
  request: AuthRequestLike,
  config: CognitionAuthRuntimeConfig,
): Promise<CognitionAuthContext | null> {
  // A Clerk-prefixed header is ordinary caller input. The root middleware does
  // not attest it. Real Clerk mode must use the accepted private operation host,
  // never this legacy resolver or a demo/development fallback.
  const provider = config.authProvider === undefined ? 'legacy_demo' : config.authProvider
  if (provider !== 'legacy_demo') return null

  const porrDemoAuth = await resolvePorrDemoAuth(request, config)
  if (porrDemoAuth) {
    return porrDemoAuth
  }

  if (config.isPorrDemoProfile) {
    return null
  }

  const developmentAuth = resolveDevelopmentFallbackAuth(request, config)
  if (developmentAuth) {
    return developmentAuth
  }

  return resolveTemporaryPublicBenchmarkComponentAuth(request, config)
}

/**
 * Resolve retained deployment/demo context. This does not authenticate an
 * individual Clerk account or establish its organisation membership.
 */
export async function extractCognitionAuth(request: NextRequest): Promise<CognitionAuthContext | null> {
  return resolveCognitionAuth(request, {
    authProvider: process.env.PROFITIA_AUTH_PROVIDER,
    isDevelopmentRuntime,
    isTemporaryPublicBenchmarkComponentProfile,
    isPorrDemoProfile,
    developmentOrgId: serverEnv.SG_RUNTIME_DEV_ORG_ID,
    developmentUserId: serverEnv.SG_RUNTIME_DEV_USER_ID,
    developmentOrgRole: serverEnv.SG_RUNTIME_DEV_ORG_ROLE,
    porrDemoPassword: serverEnv.PORR_DEMO_PASSWORD,
    porrDemoSessionSecret: serverEnv.PORR_DEMO_SESSION_SECRET,
    appEnv: serverEnv.APP_ENV,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Response builders
// ─────────────────────────────────────────────────────────────────────────────

const COGNITION_HEADERS = {
  'Content-Type':         'application/json',
  'X-Cognition-Runtime':  'pcos-v1',
  'X-Cognition-Boundary': 'procurement-cognition',
  'Cache-Control':        'no-store, no-cache, must-revalidate',
} as const

export function cognitionOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: COGNITION_HEADERS })
}

export function cognitionError(
  code:      string,
  message:   string,
  status:    number,
  requestId?: string
): NextResponse {
  return NextResponse.json(
    { error: message, code, requestId, timestamp: new Date().toISOString() },
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// withCognitionAuth — wraps a handler with tenant isolation + error handling
// ─────────────────────────────────────────────────────────────────────────────

type CognitionHandler<TArgs extends unknown[] = []> = (
  auth:    CognitionAuthContext,
  request: NextRequest,
  ...args: TArgs
) => Promise<NextResponse>

function privateApiResponse(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store')
  const vary = response.headers.get('Vary')?.split(',').map(value => value.trim()).filter(Boolean) ?? []
  if (!vary.includes('*')) {
    for (const name of ['Cookie', 'Authorization']) {
      if (!vary.some(value => value.toLowerCase() === name.toLowerCase())) vary.push(name)
    }
    response.headers.set('Vary', vary.join(', '))
  }
  return response
}

export function withCognitionAuth<TArgs extends unknown[]>(handler: CognitionHandler<TArgs>) {
  return async (request: NextRequest, ...args: TArgs): Promise<NextResponse> => {
    const auth = await extractCognitionAuth(request)

    if (!auth) {
      return privateApiResponse(cognitionError(
        'UNAUTHORIZED',
        'Authentication required.',
        401
      ))
    }

    try {
      return privateApiResponse(await handler(auth, request, ...args))
    } catch {
      // Raw provider/SQL exceptions can contain credentials or private data.
      // The typed operation host owns the durable access trail; this retained
      // demo helper must not manufacture an individual identity or log payloads.
      console.error('[pcos-api] Protected operation failed')
      return privateApiResponse(cognitionError('INTERNAL_ERROR', 'Operation unavailable.', 500, auth.requestId))
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

export function parseSearchParams<T>(
  request:   NextRequest,
  schema:    z.ZodType<T>
): { ok: true; data: T } | { ok: false; message: string } {
  const raw    = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok:      false,
      message: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    }
  }
  return { ok: true, data: result.data }
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema:  z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const body   = await request.json()
    const result = schema.safeParse(body)
    if (!result.success) {
      return {
        ok:      false,
        message: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      }
    }
    return { ok: true, data: result.data }
  } catch {
    return { ok: false, message: 'Invalid JSON body' }
  }
}
