import type { DataCollection } from '@sentry/core'

export type ObservabilityConfiguration = {
  enabled?: string
  scope?: string
  dsn?: string
  projectId?: string
  environment?: string
  release?: string
  service?: string
  tracesSampleRate?: string
  productionApproved?: string
}

// This policy also applies before event processing, including AI and DB integrations.
export const technicalDataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
}

export function observabilityOptions(config: ObservabilityConfiguration) {
  const environment = config.environment
  let validDsn = false
  try {
    const dsn = new URL(config.dsn ?? '')
    validDsn = dsn.protocol === 'https:' && !dsn.password && !dsn.search && !dsn.hash
      && /^[a-f0-9]{32}$/i.test(dsn.username)
      && /(^|\.)ingest(?:\.[a-z]+)?\.sentry\.io$/.test(dsn.hostname)
      && /^\d+$/.test(config.projectId ?? '') && dsn.pathname === `/${config.projectId}`
  } catch { /* Missing or malformed configuration stays disabled. */ }

  const validEnvironment = ['development', 'staging', 'production'].includes(environment ?? '')
  const service = /^sg2-(development|staging|production)-runtime$/.test(config.service ?? '')
    && config.service === `sg2-${environment}-runtime` ? config.service : undefined
  const release = /^[a-f0-9]{40}$/i.test(config.release ?? '') ? config.release : undefined
  const configuredRate = config.tracesSampleRate?.trim()
  const rate = configuredRate ? Number(configuredRate) : 0.1
  const validRate = Number.isFinite(rate) && rate >= 0 && rate <= 1
  const enabled = config.enabled === 'true' && config.scope === 'sg2-porr'
    && validEnvironment && validDsn && Boolean(service && release) && validRate
    && (environment !== 'production' || config.productionApproved === 'true')

  return {
    enabled,
    dsn: enabled ? config.dsn : undefined,
    environment: validEnvironment ? environment : undefined,
    release,
    tracesSampleRate: enabled ? rate : 0,
    sampleRate: 1,
    sendDefaultPii: false,
    dataCollection: technicalDataCollection,
    enableLogs: false,
    sendClientReports: false,
    tracePropagationTargets: [] as RegExp[],
    initialScope: { tags: { application: 'sg-runtime', service: service ?? 'unconfigured' } },
  }
}
