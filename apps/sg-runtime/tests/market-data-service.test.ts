import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeBenchmarkObservationDate } from '../lib/benchmark/observation-date'
import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import { sliceHistoricalPoints } from '../lib/benchmark/service'
import { createBenchmarkMarketDataService } from '../lib/market-data/service'

function createHistory(seriesId: string, dates: Array<[string, number | null]>): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: 'Macrobond',
      },
      providerSeriesId: seriesId,
      providerSeriesKey: seriesId,
    },
    displayName: 'WTI',
    frequency: 'Daily',
    currency: 'USD',
    unit: 'USD/Barrel',
    source: 'Provider',
    historical: dates.map(([date, value]) => ({ date, value })),
  }
}

test('market data service hydrates provider data on miss and preserves exact series identity', async () => {
  const persisted: BenchmarkHistoricalSeriesResult[] = []
  const providerHistory = createHistory('uscaes0301', [
    ['2026-01-01T00:00:00.000Z', 70],
    ['2026-02-01T00:00:00.000Z', 72],
    ['2026-03-01T00:00:00.000Z', 74],
  ])

  const service = createBenchmarkMarketDataService({
    repository: {
      async readStoredSeries() {
        return null
      },
      async upsertSeriesHistory(history) {
        persisted.push(history)
        return { hydratedObservationCount: history.historical.length }
      },
    },
    async fetchProviderSeriesHistory() {
      return providerHistory
    },
    now: () => new Date('2026-03-02T00:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.resolveHistoricalSeries('uscaes0301', '1Y')

  assert.equal(result.marketDataSource, 'macrobond')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(result.history.providerSeries.providerSeriesId, 'uscaes0301')
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0]?.historical.length, 3)
})

test('market data service returns a warm postgres hit when coverage is sufficient and fresh', async () => {
  let providerCalled = false
  const service = createBenchmarkMarketDataService({
    repository: {
      async readStoredSeries() {
        return {
          series: {
            providerCode: 'MACROBOND',
            providerSeriesId: 'uscaes0301',
            providerSeriesKey: 'uscaes0301',
            displayName: 'WTI',
            frequency: 'Daily',
            currency: 'USD',
            unit: 'USD/Barrel',
            sourceLabel: 'Provider',
          },
          historical: [
            { date: '2025-01-01T00:00:00.000Z', value: 50 },
            { date: '2025-12-31T00:00:00.000Z', value: 80 },
          ],
          lastProviderFetchAt: new Date('2026-01-01T06:00:00.000Z'),
          earliestStoredObservationAt: new Date('2025-01-01T00:00:00.000Z'),
          latestStoredObservationAt: new Date('2025-12-31T00:00:00.000Z'),
        }
      },
      async upsertSeriesHistory() {
        throw new Error('should not persist on hit')
      },
    },
    async fetchProviderSeriesHistory() {
      providerCalled = true
      throw new Error('provider should not be used on hit')
    },
    now: () => new Date('2026-01-01T12:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.resolveHistoricalSeries('uscaes0301', '6M')

  assert.equal(result.marketDataSource, 'postgres')
  assert.equal(result.cacheStatus, 'hit')
  assert.equal(providerCalled, false)
  assert.equal(result.history.historical.length, 2)
})

test('market data service falls back to provider when the dedicated DB is unavailable', async () => {
  let persisted = false
  const providerHistory = createHistory('uscaes0301', [['2026-03-01T00:00:00.000Z', 74]])

  const service = createBenchmarkMarketDataService({
    repository: {
      async readStoredSeries() {
        throw new Error('db offline')
      },
      async upsertSeriesHistory() {
        persisted = true
        return { hydratedObservationCount: 1 }
      },
    },
    async fetchProviderSeriesHistory() {
      return providerHistory
    },
    now: () => new Date('2026-03-02T00:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.resolveHistoricalSeries('uscaes0301', '1Y')

  assert.equal(result.marketDataSource, 'macrobond')
  assert.equal(result.cacheStatus, 'db-unavailable')
  assert.equal(persisted, false)
})

test('market data service returns stale DB coverage when provider refresh fails', async () => {
  const service = createBenchmarkMarketDataService({
    repository: {
      async readStoredSeries() {
        return {
          series: {
            providerCode: 'MACROBOND',
            providerSeriesId: 'uscaes0301',
            providerSeriesKey: 'uscaes0301',
            displayName: 'WTI',
            frequency: 'Daily',
            currency: 'USD',
            unit: 'USD/Barrel',
            sourceLabel: 'Provider',
          },
          historical: [
            { date: '2025-01-01T00:00:00.000Z', value: 50 },
            { date: '2025-12-31T00:00:00.000Z', value: 80 },
          ],
          lastProviderFetchAt: new Date('2025-12-20T00:00:00.000Z'),
          earliestStoredObservationAt: new Date('2025-01-01T00:00:00.000Z'),
          latestStoredObservationAt: new Date('2025-12-31T00:00:00.000Z'),
        }
      },
      async upsertSeriesHistory() {
        throw new Error('should not persist when provider fails')
      },
    },
    async fetchProviderSeriesHistory() {
      throw new Error('provider unavailable')
    },
    now: () => new Date('2026-01-05T12:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.resolveHistoricalSeries('uscaes0301', '6M')

  assert.equal(result.marketDataSource, 'postgres')
  assert.equal(result.cacheStatus, 'stale')
  assert.equal(result.history.providerSeries.providerSeriesId, 'uscaes0301')
})

test('benchmark observation normalization canonicalizes timezone-less provider dates to UTC', () => {
  assert.equal(normalizeBenchmarkObservationDate('2026-08-17T00:00:00'), '2026-08-17T00:00:00.000Z')
  assert.equal(normalizeBenchmarkObservationDate('2026-08-17'), '2026-08-17T00:00:00.000Z')
  assert.equal(normalizeBenchmarkObservationDate('2026-08-17T00:00:00.000Z'), '2026-08-17T00:00:00.000Z')
})

test('market data service keeps repeated hydration idempotent for timezone-less daily dates', async () => {
  const persisted = new Map<string, number | null>()
  let providerCalls = 0

  const service = createBenchmarkMarketDataService({
    repository: {
      async readStoredSeries() {
        if (persisted.size === 0) {
          return null
        }

        const historical = [...persisted.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, value]) => ({ date, value }))

        return {
          series: {
            providerCode: 'MACROBOND',
            providerSeriesId: 'uscaes0301',
            providerSeriesKey: 'uscaes0301',
            displayName: 'WTI',
            frequency: 'Daily',
            currency: 'USD',
            unit: 'USD/Barrel',
            sourceLabel: 'Provider',
          },
          historical,
          lastProviderFetchAt: new Date('2025-12-01T00:00:00.000Z'),
          earliestStoredObservationAt: new Date(historical[0]!.date),
          latestStoredObservationAt: new Date(historical[historical.length - 1]!.date),
        }
      },
      async upsertSeriesHistory(history) {
        for (const point of history.historical) {
          persisted.set(point.date, point.value)
        }

        return { hydratedObservationCount: history.historical.length }
      },
    },
    async fetchProviderSeriesHistory() {
      providerCalls += 1
      return createHistory('uscaes0301', [
        ['2026-01-01T00:00:00', 70],
        ['2026-01-02T00:00:00', 72],
      ])
    },
    now: () => new Date('2026-01-10T00:00:00.000Z'),
    logEvent: () => {},
  })

  const first = await service.resolveHistoricalSeries('uscaes0301', 'ALL')
  assert.deepEqual(first.history.historical.map((point) => point.date), [
    '2026-01-01T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
  ])
  assert.equal(persisted.size, 2)

  const second = await service.resolveHistoricalSeries('uscaes0301', 'ALL')
  assert.equal(second.marketDataSource, 'macrobond')
  assert.equal(providerCalls, 2)
  assert.equal(persisted.size, 2)
  assert.deepEqual([...persisted.keys()], [
    '2026-01-01T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
  ])
})

test('range slicing keeps only the requested recent window', () => {
  const sliced = sliceHistoricalPoints([
    { date: '2025-01-01T00:00:00.000Z', value: 1 },
    { date: '2025-06-01T00:00:00.000Z', value: 2 },
    { date: '2025-10-01T00:00:00.000Z', value: 3 },
    { date: '2025-12-31T00:00:00.000Z', value: 4 },
  ], '3M')

  assert.deepEqual(
    sliced.map((point) => point.date),
    ['2025-10-01T00:00:00.000Z', '2025-12-31T00:00:00.000Z'],
  )
})