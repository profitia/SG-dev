import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/src/generated/market-data-prisma/client'

import { readDashboardPreviewMarketDataDatabaseUrl } from './env'

function createClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForMarketDataPrisma = globalThis as unknown as {
  dashboardPreviewMarketDataPrisma: PrismaClient | undefined
  dashboardPreviewMarketDataPrismaConnectionString: string | undefined
}

export function getMarketDataPrismaClient() {
  const connectionString = readDashboardPreviewMarketDataDatabaseUrl()

  if (!connectionString) {
    return null
  }

  if (
    globalForMarketDataPrisma.dashboardPreviewMarketDataPrisma
    && globalForMarketDataPrisma.dashboardPreviewMarketDataPrismaConnectionString !== connectionString
  ) {
    void globalForMarketDataPrisma.dashboardPreviewMarketDataPrisma.$disconnect().catch(() => undefined)
    globalForMarketDataPrisma.dashboardPreviewMarketDataPrisma = undefined
    globalForMarketDataPrisma.dashboardPreviewMarketDataPrismaConnectionString = undefined
  }

  if (!globalForMarketDataPrisma.dashboardPreviewMarketDataPrisma) {
    globalForMarketDataPrisma.dashboardPreviewMarketDataPrisma = createClient(connectionString)
    globalForMarketDataPrisma.dashboardPreviewMarketDataPrismaConnectionString = connectionString
  }

  return globalForMarketDataPrisma.dashboardPreviewMarketDataPrisma
}