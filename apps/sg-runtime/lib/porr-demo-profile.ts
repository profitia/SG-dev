import { isPorrDemoProfile, publicEnv, serverEnv } from '@/lib/env'

export const PORR_DEMO_SESSION_COOKIE_NAME = 'sg_porr_demo_session'
export const PORR_DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

type PorrDemoAllowedApiRoute = {
  readonly method: 'GET' | 'POST'
  readonly pattern: RegExp
}

export type PorrDemoRuntimeConfig = {
  readonly enabled: boolean
  readonly password?: string
  readonly sessionSecret?: string
  readonly appUrl: string
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly appEnv: 'development' | 'staging' | 'production'
  readonly orgId?: string
  readonly userId?: string
  readonly orgRole?: string
}

const LOCALE_SEGMENTS = new Set(['pl', 'en'])

const PORR_DEMO_ALLOWED_API_ROUTES: readonly PorrDemoAllowedApiRoute[] = [
  { method: 'GET', pattern: /^\/api\/benchmark\/search$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/search$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/ai-search$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/preview$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/context$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/selection$/ },
  { method: 'POST', pattern: /^\/api\/benchmark\/selection$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/analytics-series$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/analytics-eligibility$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/metadata$/ },
  { method: 'GET', pattern: /^\/api\/benchmark\/metadata\/[^/]+\/values$/ },
] as const

function trimToUndefined(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname || '/'
}

function stripLocalePrefix(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)
  const segments = normalizedPathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return '/'
  }

  if (!LOCALE_SEGMENTS.has(segments[0] ?? '')) {
    return normalizedPathname
  }

  const remainder = segments.slice(1)
  return remainder.length === 0 ? '/' : `/${remainder.join('/')}`
}

export function resolvePorrDemoRuntimeConfig(): PorrDemoRuntimeConfig {
  return {
    enabled: isPorrDemoProfile,
    password: trimToUndefined(serverEnv.PORR_DEMO_PASSWORD),
    sessionSecret: trimToUndefined(serverEnv.PORR_DEMO_SESSION_SECRET),
    appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
    nodeEnv: serverEnv.NODE_ENV,
    appEnv: serverEnv.APP_ENV,
    orgId: trimToUndefined(serverEnv.SG_RUNTIME_DEV_ORG_ID),
    userId: trimToUndefined(serverEnv.SG_RUNTIME_DEV_USER_ID),
    orgRole: trimToUndefined(serverEnv.SG_RUNTIME_DEV_ORG_ROLE),
  }
}

export function isPorrDemoRuntimeReady(config: Pick<PorrDemoRuntimeConfig, 'enabled' | 'password' | 'sessionSecret' | 'orgId' | 'userId' | 'orgRole'>) {
  if (!config.enabled) {
    return false
  }

  return Boolean(
    trimToUndefined(config.password)
    && trimToUndefined(config.sessionSecret)
    && trimToUndefined(config.orgId)
    && trimToUndefined(config.userId)
    && trimToUndefined(config.orgRole),
  )
}

export function isPorrDemoProtectedPagePath(pathname: string) {
  const routePath = stripLocalePrefix(pathname)
  return routePath === '/benchmark-finder'
}

export function isPorrDemoRestrictedPagePath(pathname: string) {
  const routePath = stripLocalePrefix(pathname)
  return routePath === '/category-builder'
    || routePath === '/cost-scan'
    || routePath.startsWith('/cost-scan/')
}

export function isPorrDemoAllowedApiRequest(method: string, pathname: string) {
  const normalizedMethod = method.trim().toUpperCase()
  const normalizedPathname = normalizePathname(pathname)

  return PORR_DEMO_ALLOWED_API_ROUTES.some((route) => (
    route.method === normalizedMethod && route.pattern.test(normalizedPathname)
  ))
}

export function resolvePorrDemoCookieDomain(appUrl: string) {
  try {
    const hostname = new URL(appUrl).hostname
    if (hostname === 'spenduru.app' || hostname.endsWith('.spenduru.app')) {
      return '.spenduru.app'
    }
  } catch {
    return undefined
  }

  return undefined
}

export function isPorrDemoSecureCookie(nodeEnv: PorrDemoRuntimeConfig['nodeEnv']) {
  return nodeEnv === 'production'
}

export function resolvePorrDemoLocale(pathname: string): 'pl' | 'en' {
  const segment = normalizePathname(pathname).split('/').filter(Boolean)[0]
  return segment === 'en' ? 'en' : 'pl'
}

export function resolvePorrDemoNextPath(nextPath: string | null | undefined, locale: 'pl' | 'en') {
  const normalized = trimToUndefined(nextPath)
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return `/${locale}/benchmark-finder`
  }

  return normalized
}

export function resolvePorrDemoAbsoluteUrl(pathname: string, appUrl: string, fallbackUrl?: string) {
  try {
    return new URL(pathname, appUrl)
  } catch {
    return new URL(pathname, fallbackUrl ?? appUrl)
  }
}