import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/src/generated/prisma/client'

import { assertDashboardPreviewDatabaseUrl } from './env'

function createClient() {
  const adapter = new PrismaPg({ connectionString: assertDashboardPreviewDatabaseUrl() })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  dashboardPreviewPrisma: PrismaClient | undefined
  dashboardPreviewPrismaConnectionString: string | undefined
}

export function getPrismaClient() {
  const connectionString = assertDashboardPreviewDatabaseUrl()
  if (globalForPrisma.dashboardPreviewPrisma && globalForPrisma.dashboardPreviewPrismaConnectionString !== connectionString) {
    throw new Error('SG2_DASHBOARD_CLIENT_BINDING_CHANGED: restart before querying.')
  }
  if (!globalForPrisma.dashboardPreviewPrisma) {
    globalForPrisma.dashboardPreviewPrisma = createClient()
    globalForPrisma.dashboardPreviewPrismaConnectionString = connectionString
  }

  return globalForPrisma.dashboardPreviewPrisma
}
