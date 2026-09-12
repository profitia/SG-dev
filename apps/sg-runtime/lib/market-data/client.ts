import { PrismaClient } from '@/generated/market-data-client'

import { noteForecastRequestDiagnosticsPrismaQuery } from '@/lib/forecast/request-diagnostics'

declare global {
  // eslint-disable-next-line no-var
  var __sgRuntimeMarketDataPrisma__: PrismaClient | undefined
}

function normalizeUrl(value?: string) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const prismaQueryTelemetryAttached = new WeakSet<PrismaClient>()

type PrismaQueryEvent = {
  target: string
  duration: number
  query: string
}

type PrismaQueryEventEmitter = PrismaClient & {
  $on(eventType: 'query', callback: (event: PrismaQueryEvent) => void): unknown
}

function attachPrismaQueryTelemetry(prisma: PrismaClient) {
  if (prismaQueryTelemetryAttached.has(prisma)) {
    return prisma
  }

  ;(prisma as PrismaQueryEventEmitter).$on('query', (event) => {
    noteForecastRequestDiagnosticsPrismaQuery({
      target: event.target,
      duration: event.duration,
      query: event.query,
    })
  })
  prismaQueryTelemetryAttached.add(prisma)
  return prisma
}

export function getMarketDataPrisma() {
  const marketDataDatabaseUrl = normalizeUrl(process.env.MARKET_DATA_DATABASE_URL)
  if (!marketDataDatabaseUrl) {
    return null
  }

  const prisma = attachPrismaQueryTelemetry(
    globalThis.__sgRuntimeMarketDataPrisma__ ??
    new PrismaClient({
      datasources: {
        db: {
          url: marketDataDatabaseUrl,
        },
      },
      log: [{ emit: 'event', level: 'query' }],
    }),
  )

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__sgRuntimeMarketDataPrisma__ = prisma
  }

  return prisma
}