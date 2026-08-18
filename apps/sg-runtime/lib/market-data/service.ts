import { Prisma } from '@/generated/market-data-client'
import { randomUUID } from 'node:crypto'
import type {
  BenchmarkHistoricalSeriesResult,
  BenchmarkPreviewPoint,
  BenchmarkRangePreset,
} from '@/lib/benchmark/contracts'
import { normalizeBenchmarkObservationDate, parseBenchmarkObservationDate } from '@/lib/benchmark/observation-date'
import { fetchMacrobondSeriesHistory } from '@/lib/benchmark/macrobond'
import { getMarketDataPrisma } from '@/lib/market-data/client'

type MarketDataSource = 'postgres' | 'macrobond'
type MarketDataCacheStatus = 'hit' | 'miss' | 'partial' | 'stale' | 'db-unavailable'

type StoredSeriesSnapshot = {
  series: {
    providerCode: string
    providerSeriesId: string
    providerSeriesKey: string | null
    displayName: string
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
  }
  historical: BenchmarkPreviewPoint[]
  lastProviderFetchAt: Date | null
  earliestStoredObservationAt: Date | null
  latestStoredObservationAt: Date | null
}

type PersistedHistoryResult = {
  hydratedObservationCount: number
}

type MarketDataRepository = {
  readStoredSeries(seriesId: string): Promise<StoredSeriesSnapshot | null>
  upsertSeriesHistory(history: BenchmarkHistoricalSeriesResult): Promise<PersistedHistoryResult>
}

type BenchmarkMarketDataServiceDependencies = {
  repository: MarketDataRepository
  fetchProviderSeriesHistory: (seriesId: string) => Promise<BenchmarkHistoricalSeriesResult>
  now: () => Date
  logEvent: (event: string, data: Record<string, string | number | boolean | null>) => void
}

type ResolvedSeriesResult = {
  history: BenchmarkHistoricalSeriesResult
  marketDataSource: MarketDataSource
  cacheStatus: MarketDataCacheStatus
}

const MACROBOND_PROVIDER_CODE = 'MACROBOND'
const OBSERVATION_UPSERT_CHUNK_SIZE = 5000

function buildDefaultLogPayload(data: Record<string, string | number | boolean | null>) {
  return Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
}

function logMarketDataEvent(event: string, data: Record<string, string | number | boolean | null>) {
  console.info(`[${event}] ${buildDefaultLogPayload(data)}`)
}

function frequencyFreshnessWindowMs(frequency: string | null) {
  const normalized = frequency?.trim().toLowerCase() ?? ''

  if (normalized.includes('daily')) {
    return 36 * 60 * 60 * 1000
  }

  if (normalized.includes('weekly')) {
    return 10 * 24 * 60 * 60 * 1000
  }

  if (normalized.includes('monthly')) {
    return 45 * 24 * 60 * 60 * 1000
  }

  if (normalized.includes('quarter')) {
    return 120 * 24 * 60 * 60 * 1000
  }

  if (normalized.includes('annual') || normalized.includes('yearly')) {
    return 400 * 24 * 60 * 60 * 1000
  }

  return 24 * 60 * 60 * 1000
}

function rangeLookbackDays(range: BenchmarkRangePreset) {
  switch (range) {
    case '1M':
      return 31
    case '3M':
      return 92
    case '6M':
      return 183
    case '1Y':
      return 366
    case '3Y':
      return 366 * 3
    case '5Y':
      return 366 * 5
    case 'ALL':
      return null
  }
}

function hasCoverageForRange(
  earliestStoredObservationAt: Date | null,
  latestStoredObservationAt: Date | null,
  requestedRange: BenchmarkRangePreset,
) {
  if (!earliestStoredObservationAt || !latestStoredObservationAt) {
    return false
  }

  const lookbackDays = rangeLookbackDays(requestedRange)
  if (lookbackDays === null) {
    return true
  }

  const threshold = new Date(latestStoredObservationAt)
  threshold.setUTCDate(threshold.getUTCDate() - lookbackDays)
  return earliestStoredObservationAt.getTime() <= threshold.getTime()
}

function isFreshEnough(snapshot: StoredSeriesSnapshot, now: Date) {
  const reference = snapshot.lastProviderFetchAt ?? snapshot.latestStoredObservationAt
  if (!reference) {
    return false
  }

  return now.getTime() - reference.getTime() <= frequencyFreshnessWindowMs(snapshot.series.frequency)
}

function deriveCacheStatus(snapshot: StoredSeriesSnapshot | null, requestedRange: BenchmarkRangePreset, now: Date): MarketDataCacheStatus {
  if (!snapshot || snapshot.historical.length === 0) {
    return 'miss'
  }

  const covered = hasCoverageForRange(
    snapshot.earliestStoredObservationAt,
    snapshot.latestStoredObservationAt,
    requestedRange,
  )

  if (!covered) {
    return 'partial'
  }

  return isFreshEnough(snapshot, now) ? 'hit' : 'stale'
}

function toHistoricalSeries(snapshot: StoredSeriesSnapshot): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: 'Macrobond',
      },
      providerSeriesId: snapshot.series.providerSeriesId,
      providerSeriesKey: snapshot.series.providerSeriesKey,
    },
    displayName: snapshot.series.displayName,
    frequency: snapshot.series.frequency,
    currency: snapshot.series.currency,
    unit: snapshot.series.unit,
    source: snapshot.series.sourceLabel,
    historical: snapshot.historical,
  }
}

function countReturnedObservations(history: BenchmarkHistoricalSeriesResult, range: BenchmarkRangePreset) {
  if (range === 'ALL') {
    return history.historical.length
  }

  const lookbackDays = rangeLookbackDays(range)
  if (lookbackDays === null || history.historical.length === 0) {
    return history.historical.length
  }

  const latestPoint = history.historical[history.historical.length - 1]
  const threshold = parseBenchmarkObservationDate(latestPoint.date)
  threshold.setUTCDate(threshold.getUTCDate() - lookbackDays)
  return history.historical.filter((point) => parseBenchmarkObservationDate(point.date) >= threshold).length
}

function assertExactSeries(seriesId: string, history: BenchmarkHistoricalSeriesResult) {
  if (history.providerSeries.providerSeriesId !== seriesId) {
    throw new Error(`Exact series integrity violated for ${seriesId}.`)
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeHistoricalSeriesDates(history: BenchmarkHistoricalSeriesResult): BenchmarkHistoricalSeriesResult {
  return {
    ...history,
    historical: history.historical.map((point) => ({
      ...point,
      date: normalizeBenchmarkObservationDate(point.date),
    })),
  }
}

async function readStoredSeriesFromPrisma(seriesId: string): Promise<StoredSeriesSnapshot | null> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    return null
  }

  const record = await prisma.marketSeries.findUnique({
    where: {
      providerCode_providerSeriesId: {
        providerCode: MACROBOND_PROVIDER_CODE,
        providerSeriesId: seriesId,
      },
    },
    include: {
      hydrationState: true,
      observations: {
        orderBy: {
          observedAt: 'asc',
        },
      },
    },
  })

  if (!record) {
    return null
  }

  return {
    series: {
      providerCode: record.providerCode,
      providerSeriesId: record.providerSeriesId,
      providerSeriesKey: record.providerSeriesKey,
      displayName: record.displayName,
      frequency: record.frequency,
      currency: record.currency,
      unit: record.unit,
      sourceLabel: record.sourceLabel,
    },
    historical: record.observations.map((point) => ({
      date: point.observedAt.toISOString(),
      value: point.value === null ? null : Number(point.value),
    })),
    lastProviderFetchAt: record.hydrationState?.lastProviderFetchAt ?? null,
    earliestStoredObservationAt:
      record.hydrationState?.earliestStoredObservationAt ?? record.observations[0]?.observedAt ?? null,
    latestStoredObservationAt:
      record.hydrationState?.latestStoredObservationAt ?? record.observations[record.observations.length - 1]?.observedAt ?? null,
  }
}

async function upsertSeriesHistoryWithPrisma(history: BenchmarkHistoricalSeriesResult): Promise<PersistedHistoryResult> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    return { hydratedObservationCount: 0 }
  }

  const normalizedHistory = normalizeHistoricalSeriesDates(history)
  const earliest = normalizedHistory.historical[0]
    ? parseBenchmarkObservationDate(normalizedHistory.historical[0].date)
    : null
  const latest = normalizedHistory.historical[normalizedHistory.historical.length - 1]
    ? parseBenchmarkObservationDate(normalizedHistory.historical[normalizedHistory.historical.length - 1].date)
    : null

  await prisma.$transaction(async (tx) => {
    const series = await tx.marketSeries.upsert({
      where: {
        providerCode_providerSeriesId: {
          providerCode: MACROBOND_PROVIDER_CODE,
          providerSeriesId: normalizedHistory.providerSeries.providerSeriesId,
        },
      },
      create: {
        providerCode: MACROBOND_PROVIDER_CODE,
        providerSeriesId: normalizedHistory.providerSeries.providerSeriesId,
        providerSeriesKey: normalizedHistory.providerSeries.providerSeriesKey ?? null,
        displayName: normalizedHistory.displayName,
        frequency: normalizedHistory.frequency,
        currency: normalizedHistory.currency,
        unit: normalizedHistory.unit,
        sourceLabel: normalizedHistory.source,
      },
      update: {
        providerSeriesKey: normalizedHistory.providerSeries.providerSeriesKey ?? null,
        displayName: normalizedHistory.displayName,
        frequency: normalizedHistory.frequency,
        currency: normalizedHistory.currency,
        unit: normalizedHistory.unit,
        sourceLabel: normalizedHistory.source,
      },
    })

    if (normalizedHistory.historical.length > 0) {
      for (const batch of chunkArray(normalizedHistory.historical, OBSERVATION_UPSERT_CHUNK_SIZE)) {
        const rows = batch.map((point) => Prisma.sql`(
          ${randomUUID()},
          ${series.id},
          ${parseBenchmarkObservationDate(point.date)},
          ${point.value === null ? null : new Prisma.Decimal(point.value)},
          NOW(),
          NOW()
        )`)

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "market_observations" ("id", "seriesId", "observedAt", "value", "createdAt", "updatedAt")
          VALUES ${Prisma.join(rows)}
          ON CONFLICT ("seriesId", "observedAt")
          DO UPDATE SET
            "value" = EXCLUDED."value",
            "updatedAt" = EXCLUDED."updatedAt"
        `)
      }
    }

    await tx.marketHydrationState.upsert({
      where: {
        seriesId: series.id,
      },
      create: {
        seriesId: series.id,
        lastProviderFetchAt: new Date(),
        earliestStoredObservationAt: earliest,
        latestStoredObservationAt: latest,
        lastHydrationStatus: normalizedHistory.historical.length > 0 ? 'SUCCEEDED' : 'NO_DATA',
        lastHydrationMessage: null,
        lastHydratedObservationCount: normalizedHistory.historical.length,
      },
      update: {
        lastProviderFetchAt: new Date(),
        earliestStoredObservationAt: earliest,
        latestStoredObservationAt: latest,
        lastHydrationStatus: normalizedHistory.historical.length > 0 ? 'SUCCEEDED' : 'NO_DATA',
        lastHydrationMessage: null,
        lastHydratedObservationCount: normalizedHistory.historical.length,
      },
    })
  })

  return {
    hydratedObservationCount: normalizedHistory.historical.length,
  }
}

function createDefaultRepository(): MarketDataRepository {
  return {
    readStoredSeries: readStoredSeriesFromPrisma,
    upsertSeriesHistory: upsertSeriesHistoryWithPrisma,
  }
}

export function createBenchmarkMarketDataService(
  dependencies: Partial<BenchmarkMarketDataServiceDependencies> = {},
) {
  const resolvedDependencies: BenchmarkMarketDataServiceDependencies = {
    repository: dependencies.repository ?? createDefaultRepository(),
    fetchProviderSeriesHistory: dependencies.fetchProviderSeriesHistory ?? fetchMacrobondSeriesHistory,
    now: dependencies.now ?? (() => new Date()),
    logEvent: dependencies.logEvent ?? logMarketDataEvent,
  }

  return {
    async resolveHistoricalSeries(seriesId: string, requestedRange: BenchmarkRangePreset): Promise<ResolvedSeriesResult> {
      const startedAt = performance.now()
      let dbReadMs = 0
      let providerFetchMs = 0
      let persistMs = 0

      let snapshot: StoredSeriesSnapshot | null = null
      let dbReadFailed = false

      try {
        const dbReadStartedAt = performance.now()
        snapshot = await resolvedDependencies.repository.readStoredSeries(seriesId)
        dbReadMs = performance.now() - dbReadStartedAt
      } catch (error) {
        dbReadFailed = true
        resolvedDependencies.logEvent('BENCHMARK_MARKET_DATA', {
          seriesId,
          requestedRange,
          marketDataSource: 'macrobond',
          cacheStatus: 'db-unavailable',
          dbReadMs: 0,
          providerFetchMs: 0,
          persistMs: 0,
          totalMs: 0,
          hydratedObservationCount: 0,
          returnedObservationCount: 0,
          dbFailure: true,
          dbError: error instanceof Error ? error.message : 'unknown',
        })
      }

      const cacheStatus = dbReadFailed ? 'db-unavailable' : deriveCacheStatus(snapshot, requestedRange, resolvedDependencies.now())

      if (cacheStatus === 'hit' && snapshot) {
        const history = toHistoricalSeries(snapshot)
        assertExactSeries(seriesId, history)
        resolvedDependencies.logEvent('BENCHMARK_MARKET_DATA', {
          seriesId,
          requestedRange,
          marketDataSource: 'postgres',
          cacheStatus,
          dbReadMs: Math.round(dbReadMs),
          providerFetchMs: 0,
          persistMs: 0,
          totalMs: Math.round(performance.now() - startedAt),
          hydratedObservationCount: 0,
          returnedObservationCount: countReturnedObservations(history, requestedRange),
          dbFailure: false,
        })

        return {
          history,
          marketDataSource: 'postgres',
          cacheStatus,
        }
      }

      try {
        const providerFetchStartedAt = performance.now()
        const history = normalizeHistoricalSeriesDates(await resolvedDependencies.fetchProviderSeriesHistory(seriesId))
        providerFetchMs = performance.now() - providerFetchStartedAt
        assertExactSeries(seriesId, history)

        let hydratedObservationCount = 0
        if (!dbReadFailed) {
          try {
            const persistStartedAt = performance.now()
            const persisted = await resolvedDependencies.repository.upsertSeriesHistory(history)
            persistMs = performance.now() - persistStartedAt
            hydratedObservationCount = persisted.hydratedObservationCount
          } catch (error) {
            resolvedDependencies.logEvent('BENCHMARK_MARKET_DATA', {
              seriesId,
              requestedRange,
              marketDataSource: 'macrobond',
              cacheStatus,
              dbReadMs: Math.round(dbReadMs),
              providerFetchMs: Math.round(providerFetchMs),
              persistMs: 0,
              totalMs: Math.round(performance.now() - startedAt),
              hydratedObservationCount: 0,
              returnedObservationCount: countReturnedObservations(history, requestedRange),
              dbFailure: true,
              persistError: error instanceof Error ? error.message : 'unknown',
            })

            return {
              history,
              marketDataSource: 'macrobond',
              cacheStatus,
            }
          }
        }

        resolvedDependencies.logEvent('BENCHMARK_MARKET_DATA', {
          seriesId,
          requestedRange,
          marketDataSource: 'macrobond',
          cacheStatus,
          dbReadMs: Math.round(dbReadMs),
          providerFetchMs: Math.round(providerFetchMs),
          persistMs: Math.round(persistMs),
          totalMs: Math.round(performance.now() - startedAt),
          hydratedObservationCount,
          returnedObservationCount: countReturnedObservations(history, requestedRange),
          dbFailure: dbReadFailed,
        })

        return {
          history,
          marketDataSource: 'macrobond',
          cacheStatus,
        }
      } catch (error) {
        if ((cacheStatus === 'stale' || cacheStatus === 'hit') && snapshot) {
          const history = toHistoricalSeries(snapshot)
          assertExactSeries(seriesId, history)
          resolvedDependencies.logEvent('BENCHMARK_MARKET_DATA', {
            seriesId,
            requestedRange,
            marketDataSource: 'postgres',
            cacheStatus: 'stale',
            dbReadMs: Math.round(dbReadMs),
            providerFetchMs: Math.round(providerFetchMs),
            persistMs: 0,
            totalMs: Math.round(performance.now() - startedAt),
            hydratedObservationCount: 0,
            returnedObservationCount: countReturnedObservations(history, requestedRange),
            dbFailure: false,
            providerFallbackUsed: true,
          })

          return {
            history,
            marketDataSource: 'postgres',
            cacheStatus: 'stale',
          }
        }

        throw error
      }
    },
  }
}

const benchmarkMarketDataService = createBenchmarkMarketDataService()

export async function resolveBenchmarkHistoricalSeries(
  seriesId: string,
  requestedRange: BenchmarkRangePreset,
) {
  return benchmarkMarketDataService.resolveHistoricalSeries(seriesId, requestedRange)
}
