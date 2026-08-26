import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

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

function readLocalSgRuntimeMarketDataDatabaseUrl(): string | null {
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  try {
    const envPath = path.resolve(process.cwd(), '../sg-runtime/.env.local')

    if (!existsSync(envPath)) {
      return null
    }

    const envFile = readFileSync(envPath, 'utf8')
    const match = envFile.match(/^\s*MARKET_DATA_DATABASE_URL\s*=\s*(.+)\s*$/m)

    return normalizeOptionalEnvString(match?.[1])
  } catch {
    return null
  }
}

export function readDashboardPreviewEnvironment(): DashboardPreviewEnvironment {
  const databaseUrl = normalizeOptionalEnvString(process.env.DATABASE_URL)
  const marketDataDatabaseUrl = normalizeOptionalEnvString(process.env.MARKET_DATA_DATABASE_URL)
    ?? readLocalSgRuntimeMarketDataDatabaseUrl()
    ?? databaseUrl

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

  return environment.databaseUrl
}

export function readDashboardPreviewMarketDataDatabaseUrl(): string | null {
  return readDashboardPreviewEnvironment().marketDataDatabaseUrl
}
