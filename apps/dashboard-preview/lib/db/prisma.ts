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
}

export function getPrismaClient() {
  if (!globalForPrisma.dashboardPreviewPrisma) {
    globalForPrisma.dashboardPreviewPrisma = createClient()
  }

  return globalForPrisma.dashboardPreviewPrisma
}
