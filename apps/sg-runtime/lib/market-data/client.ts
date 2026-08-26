import { PrismaClient } from '@/generated/market-data-client'

declare global {
  // eslint-disable-next-line no-var
  var __sgRuntimeMarketDataPrisma__: PrismaClient | undefined
}

function normalizeUrl(value?: string) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const marketDataDatabaseUrl = normalizeUrl(process.env.MARKET_DATA_DATABASE_URL)

export function getMarketDataPrisma() {
  if (!marketDataDatabaseUrl) {
    return null
  }

  const prisma =
    globalThis.__sgRuntimeMarketDataPrisma__ ??
    new PrismaClient({
      datasources: {
        db: {
          url: marketDataDatabaseUrl,
        },
      },
    })

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__sgRuntimeMarketDataPrisma__ = prisma
  }

  return prisma
}