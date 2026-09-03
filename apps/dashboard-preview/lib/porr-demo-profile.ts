export const PORR_DEMO_SESSION_COOKIE_NAME = 'sg_porr_demo_session'

export type DashboardPreviewPorrDemoRuntimeConfig = {
  readonly enabled: boolean
  readonly entryUrl?: string
  readonly sessionSecret?: string
  readonly nodeEnv: 'development' | 'test' | 'production'
}

function trimToUndefined(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function readBooleanEnvFlag(value?: string) {
  return value === 'true'
}

export function resolveDashboardPreviewPorrDemoRuntimeConfig(): DashboardPreviewPorrDemoRuntimeConfig {
  return {
    enabled: readBooleanEnvFlag(process.env.DASHBOARD_PREVIEW_PORR_DEMO),
    entryUrl: trimToUndefined(process.env.PORR_DEMO_ENTRY_URL),
    sessionSecret: trimToUndefined(process.env.PORR_DEMO_SESSION_SECRET),
    nodeEnv: process.env.NODE_ENV === 'production'
      ? 'production'
      : process.env.NODE_ENV === 'test'
        ? 'test'
        : 'development',
  }
}

export function isDashboardPreviewPorrDemoRuntimeReady(
  config: Pick<DashboardPreviewPorrDemoRuntimeConfig, 'enabled' | 'entryUrl' | 'sessionSecret'>,
) {
  if (!config.enabled) {
    return false
  }

  return Boolean(trimToUndefined(config.entryUrl) && trimToUndefined(config.sessionSecret))
}

export function isDashboardPreviewApiPath(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function extractPorrDemoSessionCookieValue(cookieHeader?: string | null) {
  return cookieHeader
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PORR_DEMO_SESSION_COOKIE_NAME}=`))
    ?.slice(PORR_DEMO_SESSION_COOKIE_NAME.length + 1) ?? null
}

export function buildPorrDemoSessionCookieHeader(token?: string | null) {
  const normalized = trimToUndefined(token)
  return normalized ? `${PORR_DEMO_SESSION_COOKIE_NAME}=${normalized}` : null
}

export function buildPorrDemoEntryRedirectTarget(entryUrl?: string) {
  const normalized = trimToUndefined(entryUrl)
  if (!normalized) {
    return null
  }

  try {
    return new URL(normalized)
  } catch {
    return null
  }
}