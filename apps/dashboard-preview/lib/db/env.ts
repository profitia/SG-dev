export interface DashboardPreviewEnvironment {
  databaseUrl: string | null
}

export function readDashboardPreviewEnvironment(): DashboardPreviewEnvironment {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? ''

  return {
    databaseUrl: databaseUrl.length > 0 ? databaseUrl : null,
  }
}

export function assertDashboardPreviewDatabaseUrl(): string {
  const environment = readDashboardPreviewEnvironment()

  if (!environment.databaseUrl) {
    throw new Error('DATABASE_URL is required for apps/dashboard-preview.')
  }

  return environment.databaseUrl
}
