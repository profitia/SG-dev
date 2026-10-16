import { assertDashboardDatabaseIdentity, assertSg2Environment } from '../environment-identity'

export interface DashboardPreviewEnvironment {
  databaseUrl: string | null
  marketDataDatabaseUrl: string | null
}

function normalizeOptionalEnvString(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) {
    return null
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unwrapped = trimmed.slice(1, -1).trim()
    return unwrapped.length > 0 ? unwrapped : null
  }

  return trimmed
}

export function readDashboardPreviewEnvironment(): DashboardPreviewEnvironment {
  assertSg2Environment(process.env.APP_ENV)
  const databaseUrl = normalizeOptionalEnvString(process.env.DATABASE_URL)
  const marketDataDatabaseUrl = normalizeOptionalEnvString(process.env.MARKET_DATA_DATABASE_URL)


  return {
    databaseUrl,
    marketDataDatabaseUrl,
  }
}

export function assertDashboardPreviewDatabaseUrl(): string {
  const environment = readDashboardPreviewEnvironment()

  if (!environment.databaseUrl) {
    throw new Error('DATABASE_URL is required for apps/dashboard-preview.')
  }

  assertDashboardDatabaseIdentity(environment.databaseUrl, 'dashboard')
  return environment.databaseUrl
}

export function readDashboardPreviewMarketDataDatabaseUrl(): string | null {
  const url = readDashboardPreviewEnvironment().marketDataDatabaseUrl
  if (url) assertDashboardDatabaseIdentity(url, 'market')
  return url
}
