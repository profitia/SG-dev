import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import { buildForecastHistoryFingerprint } from '../lib/forecast/service'
import {
  buildLiveForecastBridgePayloadFromHistory,
  selectLatestCurrentForecastMonthlyTrainingPayload,
} from '../lib/forecast/live-market-input'

function createDailyHistory(
  points: Array<{ date: string; value: number | null }>,
  seriesId = 'wocaes0074',
): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: 'Macrobond',
      },
      providerSeriesId: seriesId,
      providerSeriesKey: seriesId,
    },
    displayName: 'Brent, Spot, FOB North Sea',
    frequency: 'daily',
    currency: 'usd',
    unit: 'USD/barrel',
    source: 'src_macrobond',
    historical: points,
  }
}

function createWeeklyHistory(
  points: Array<{ date: string; value: number | null }>,
  seriesId = 'uscaes0001',
): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: 'Macrobond',
      },
      providerSeriesId: seriesId,
      providerSeriesKey: seriesId,
    },
    displayName: 'Total, Including SPR',
    frequency: 'Weekly',
    currency: null,
    unit: 'Barrels',
    source: 'src_useia',
    historical: points,
  }
}

test('wocaes0074 live forecast input payload is monthly and provider-neutral at the bridge boundary', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'wocaes0074',
    createDailyHistory([
      { date: '2026-01-02T00:00:00.000Z', value: 10 },
      { date: '2026-01-30T00:00:00.000Z', value: 30 },
      { date: '2026-02-03T00:00:00.000Z', value: 20 },
      { date: '2026-02-28T00:00:00.000Z', value: 40 },
      { date: '2026-03-05T00:00:00.000Z', value: 999 },
    ]),
    { now: new Date('2026-03-20T00:00:00.000Z') },
  )

  assert.equal(payload.source.kind, 'DYNAMIC_MARKET_DATA_STORE')
  assert.equal(payload.source.runId, null)
  assert.equal(payload.benchmark.seriesId, 'wocaes0074')
  assert.equal(payload.benchmark.frequency, 'MONTHLY')
  assert.equal(payload.benchmark.expectedObservations, 2)
  assert.equal(payload.history.benchmarkName, 'Brent, Spot, FOB North Sea')
  assert.equal(payload.history.frequency, 'MONTHLY')
  assert.equal(payload.history.start, '2026-01-01T00:00:00.000Z')
  assert.equal(payload.history.end, '2026-02-01T00:00:00.000Z')
  assert.equal(payload.history.observations, 2)
  assert.equal(payload.canonicalization.excludedPartialPeriods, 1)
  assert.equal(payload.canonicalization.targetBasis, 'MONTHLY_AVERAGE')
  assert.deepEqual(payload.history.points, [
    { date: '2026-01-01T00:00:00.000Z', value: 20, sourceObservedAt: null },
    { date: '2026-02-01T00:00:00.000Z', value: 30, sourceObservedAt: null },
  ])
})

test('wocaes0074 end-of-period live payload preserves exact source observation provenance', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'wocaes0074',
    createDailyHistory([
      { date: '2026-02-20T00:00:00.000Z', value: 70 },
      { date: '2026-02-27T00:00:00.000Z', value: 73 },
      { date: '2026-02-28T00:00:00.000Z', value: null },
      { date: '2026-03-31T00:00:00.000Z', value: 103 },
      { date: '2026-04-01T00:00:00.000Z', value: 110 },
    ]),
    { now: new Date('2026-04-15T00:00:00.000Z'), targetBasis: 'END_OF_PERIOD' },
  )

  assert.equal(payload.canonicalization.targetBasis, 'END_OF_PERIOD')
  assert.equal(payload.canonicalization.method, 'LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD')
  assert.equal(payload.canonicalization.version, 'daily-market-price-end-of-period-v1')
  assert.deepEqual(payload.history.points, [
    { date: '2026-02-01T00:00:00.000Z', value: 73, sourceObservedAt: '2026-02-27T00:00:00.000Z' },
    { date: '2026-03-01T00:00:00.000Z', value: 103, sourceObservedAt: '2026-03-31T00:00:00.000Z' },
  ])
})

test('weekly end-of-period live payload lawfully canonicalizes weekly history into closed monthly periods', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'uscaes0001',
    createWeeklyHistory([
      { date: '2026-01-04T00:00:00.000Z', value: 100 },
      { date: '2026-01-11T00:00:00.000Z', value: 105 },
      { date: '2026-01-18T00:00:00.000Z', value: 110 },
      { date: '2026-01-25T00:00:00.000Z', value: 115 },
      { date: '2026-02-01T00:00:00.000Z', value: 120 },
      { date: '2026-02-08T00:00:00.000Z', value: 121 },
      { date: '2026-02-15T00:00:00.000Z', value: 122 },
      { date: '2026-02-22T00:00:00.000Z', value: 123 },
      { date: '2026-03-01T00:00:00.000Z', value: 124 },
    ]),
    { now: new Date('2026-03-15T00:00:00.000Z'), targetBasis: 'END_OF_PERIOD', targetCadence: 'MONTHLY' },
  )

  assert.equal(payload.benchmark.frequency, 'MONTHLY')
  assert.equal(payload.canonicalization.targetBasis, 'END_OF_PERIOD')
  assert.equal(payload.canonicalization.method, 'LAST_LAWFUL_WEEKLY_LEVEL_IN_CLOSED_PERIOD')
  assert.equal(payload.canonicalization.version, 'weekly-level-end-of-period-v1')
  assert.deepEqual(payload.history.points, [
    { date: '2026-01-01T00:00:00.000Z', value: 115, sourceObservedAt: '2026-01-25T00:00:00.000Z' },
    { date: '2026-02-01T00:00:00.000Z', value: 123, sourceObservedAt: '2026-02-22T00:00:00.000Z' },
  ])
})

test('history fingerprint changes when canonicalization version changes', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'wocaes0074',
    createDailyHistory([
      { date: '2026-01-02T00:00:00.000Z', value: 10 },
      { date: '2026-01-30T00:00:00.000Z', value: 30 },
      { date: '2026-02-03T00:00:00.000Z', value: 20 },
      { date: '2026-02-28T00:00:00.000Z', value: 40 },
    ]),
    { now: new Date('2026-03-20T00:00:00.000Z') },
  )

  const original = buildForecastHistoryFingerprint(payload.history)
  const updated = buildForecastHistoryFingerprint({
    ...payload.history,
    canonicalization: {
      ...payload.history.canonicalization,
      version: 'daily-market-price-monthly-average-v3',
    },
  })

  assert.notEqual(original, updated)
})

test('history fingerprint changes across target bases and source observation provenance', () => {
  const average = buildLiveForecastBridgePayloadFromHistory(
    'wocaes0074',
    createDailyHistory([
      { date: '2026-02-20T00:00:00.000Z', value: 70 },
      { date: '2026-02-27T00:00:00.000Z', value: 73 },
    ]),
    { now: new Date('2026-03-15T00:00:00.000Z'), targetBasis: 'MONTHLY_AVERAGE' },
  )
  const eop = buildLiveForecastBridgePayloadFromHistory(
    'wocaes0074',
    createDailyHistory([
      { date: '2026-02-20T00:00:00.000Z', value: 70 },
      { date: '2026-02-27T00:00:00.000Z', value: 73 },
    ]),
    { now: new Date('2026-03-15T00:00:00.000Z'), targetBasis: 'END_OF_PERIOD' },
  )

  assert.notEqual(buildForecastHistoryFingerprint(average.history), buildForecastHistoryFingerprint(eop.history))

  const provenanceShifted = buildForecastHistoryFingerprint({
    ...eop.history,
    points: eop.history.points.map((point, index) => (
      index === 0 ? { ...point, sourceObservedAt: '2026-02-26T00:00:00.000Z' } : point
    )),
  })

  assert.notEqual(buildForecastHistoryFingerprint(eop.history), provenanceShifted)
})

test('arbitrary exact DAILY series use the same generic Forecast input path', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'generic.daily.series',
    createDailyHistory([
      { date: '2026-01-02T00:00:00.000Z', value: 10 },
      { date: '2026-01-30T00:00:00.000Z', value: 30 },
    ], 'generic.daily.series'),
    { now: new Date('2026-02-20T00:00:00.000Z') },
  )

  assert.equal(payload.benchmark.seriesId, 'generic.daily.series')
  assert.equal(payload.benchmark.component, 'generic.daily.series')
  assert.equal(payload.history.observations, 1)
})

test('native QUARTERLY payload carries the exact B1 execution plan without a 1M horizon', () => {
  const history = createDailyHistory([
    { date: '2015-03-31T00:00:00.000Z', value: 10 },
    { date: '2015-06-30T00:00:00.000Z', value: 12 },
    { date: '2015-09-30T00:00:00.000Z', value: 14 },
  ], 'quarterly.series')
  history.frequency = 'Quarterly'

  const payload = buildLiveForecastBridgePayloadFromHistory('quarterly.series', history, {
    targetBasis: 'END_OF_PERIOD',
    targetCadence: 'QUARTERLY',
    now: new Date('2016-01-15T00:00:00.000Z'),
  })

  assert.equal(payload.benchmark.frequency, 'QUARTERLY')
  assert.deepEqual(payload.execution.historicalPeriodStarts, [
    '2015-01-01T00:00:00.000Z',
    '2015-04-01T00:00:00.000Z',
    '2015-07-01T00:00:00.000Z',
  ])
  assert.deepEqual(payload.execution.horizons, { '3M': 1, '6M': 2, '12M': 4 })
  assert.deepEqual(payload.execution.currentTargetDates, {
    '3M': '2015-10-01T00:00:00.000Z',
    '6M': '2016-01-01T00:00:00.000Z',
    '12M': '2016-07-01T00:00:00.000Z',
  })
})

test('generic Forecast input rejects mismatched provider series identity', () => {
  assert.throws(() => buildLiveForecastBridgePayloadFromHistory(
    'requested.series',
    createDailyHistory([
      { date: '2026-01-02T00:00:00.000Z', value: 10 },
    ], 'different.series'),
  ), /exact series integrity/i)
})

test('current monthly training payload preserves the exact trailing 12M window even when it contains lawful gaps', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'gappy.monthly.series',
    createDailyHistory([
      { date: '2020-01-02T00:00:00.000Z', value: 10 },
      { date: '2020-01-24T00:00:00.000Z', value: 11 },
      { date: '2020-02-03T00:00:00.000Z', value: 12 },
      { date: '2020-02-24T00:00:00.000Z', value: 13 },
      { date: '2020-05-04T00:00:00.000Z', value: 20 },
      { date: '2020-05-25T00:00:00.000Z', value: 21 },
      { date: '2020-06-03T00:00:00.000Z', value: 22 },
      { date: '2020-06-24T00:00:00.000Z', value: 23 },
      { date: '2020-07-03T00:00:00.000Z', value: 24 },
      { date: '2020-07-24T00:00:00.000Z', value: 25 },
      { date: '2020-08-03T00:00:00.000Z', value: 26 },
      { date: '2020-08-24T00:00:00.000Z', value: 27 },
    ], 'gappy.monthly.series'),
    {
      now: new Date('2020-09-15T00:00:00.000Z'),
      continuityPolicy: 'ALLOW_GAPS',
    },
  )

  const narrowed = selectLatestCurrentForecastMonthlyTrainingPayload(payload)

  assert.deepEqual(narrowed.execution.historicalPeriodStarts, [
    '2020-01-01T00:00:00.000Z',
    '2020-02-01T00:00:00.000Z',
    '2020-05-01T00:00:00.000Z',
    '2020-06-01T00:00:00.000Z',
    '2020-07-01T00:00:00.000Z',
    '2020-08-01T00:00:00.000Z',
  ])
  assert.equal(narrowed.history.start, '2020-01-01T00:00:00.000Z')
  assert.equal(narrowed.history.end, '2020-08-01T00:00:00.000Z')
  assert.equal(narrowed.history.observations, 6)
})

test('current training payload uses the exact trailing 12 calendar months instead of the full lawful history', () => {
  const payload = buildLiveForecastBridgePayloadFromHistory(
    'long.monthly.series',
    createDailyHistory([
      { date: '2023-07-03T00:00:00.000Z', value: 10 },
      { date: '2023-07-28T00:00:00.000Z', value: 11 },
      { date: '2023-08-03T00:00:00.000Z', value: 12 },
      { date: '2023-08-28T00:00:00.000Z', value: 13 },
      { date: '2023-09-04T00:00:00.000Z', value: 14 },
      { date: '2023-09-28T00:00:00.000Z', value: 15 },
      { date: '2023-10-03T00:00:00.000Z', value: 16 },
      { date: '2023-10-30T00:00:00.000Z', value: 17 },
      { date: '2023-11-03T00:00:00.000Z', value: 18 },
      { date: '2023-11-29T00:00:00.000Z', value: 19 },
      { date: '2023-12-04T00:00:00.000Z', value: 20 },
      { date: '2023-12-28T00:00:00.000Z', value: 21 },
      { date: '2024-01-03T00:00:00.000Z', value: 22 },
      { date: '2024-01-29T00:00:00.000Z', value: 23 },
      { date: '2024-02-02T00:00:00.000Z', value: 24 },
      { date: '2024-02-28T00:00:00.000Z', value: 25 },
      { date: '2024-03-04T00:00:00.000Z', value: 26 },
      { date: '2024-03-28T00:00:00.000Z', value: 27 },
      { date: '2024-04-03T00:00:00.000Z', value: 28 },
      { date: '2024-04-29T00:00:00.000Z', value: 29 },
      { date: '2024-05-03T00:00:00.000Z', value: 30 },
      { date: '2024-05-30T00:00:00.000Z', value: 31 },
      { date: '2024-06-03T00:00:00.000Z', value: 32 },
      { date: '2024-06-28T00:00:00.000Z', value: 33 },
      { date: '2024-07-03T00:00:00.000Z', value: 34 },
      { date: '2024-07-30T00:00:00.000Z', value: 35 },
      { date: '2024-08-02T00:00:00.000Z', value: 36 },
      { date: '2024-08-29T00:00:00.000Z', value: 37 },
    ], 'long.monthly.series'),
    {
      now: new Date('2024-09-15T00:00:00.000Z'),
      continuityPolicy: 'ALLOW_GAPS',
    },
  )

  const narrowed = selectLatestCurrentForecastMonthlyTrainingPayload(payload)

  assert.equal(payload.history.observations, 14)
  assert.equal(narrowed.history.start, '2023-09-01T00:00:00.000Z')
  assert.equal(narrowed.history.end, '2024-08-01T00:00:00.000Z')
  assert.equal(narrowed.history.observations, 12)
  assert.deepEqual(narrowed.execution.historicalPeriodStarts, [
    '2023-09-01T00:00:00.000Z',
    '2023-10-01T00:00:00.000Z',
    '2023-11-01T00:00:00.000Z',
    '2023-12-01T00:00:00.000Z',
    '2024-01-01T00:00:00.000Z',
    '2024-02-01T00:00:00.000Z',
    '2024-03-01T00:00:00.000Z',
    '2024-04-01T00:00:00.000Z',
    '2024-05-01T00:00:00.000Z',
    '2024-06-01T00:00:00.000Z',
    '2024-07-01T00:00:00.000Z',
    '2024-08-01T00:00:00.000Z',
  ])
})

test('current trailing 12M boundary excludes the exact window-start point and includes later lawful points', () => {
  const payload = {
    benchmark: {
      seriesId: 'boundary.series',
      component: 'boundary.series',
      description: 'Boundary series',
      frequency: 'MONTHLY' as const,
      expectedObservations: 4,
    },
    execution: {
      frequency: 'MONTHLY' as const,
      historicalPeriodStarts: [
        '2024-07-01T00:00:00.000Z',
        '2024-08-01T00:00:00.000Z',
        '2024-08-15T00:00:00.000Z',
        '2025-08-01T00:00:00.000Z',
      ],
      horizons: { '1M': 1, '3M': 3, '6M': 6, '12M': 12 },
      currentTargetDates: {
        '1M': '2025-09-01T00:00:00.000Z',
        '3M': '2025-11-01T00:00:00.000Z',
        '6M': '2026-02-01T00:00:00.000Z',
        '12M': '2026-08-01T00:00:00.000Z',
      },
    },
    source: {
      kind: 'DYNAMIC_MARKET_DATA_STORE' as const,
      runId: null,
    },
    canonicalization: {
      targetBasis: 'MONTHLY_AVERAGE' as const,
      method: 'test',
      version: 'test-v1',
      partialMonthRule: 'EXCLUDE_OPEN_CALENDAR_MONTH' as const,
      missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY' as const,
      sourceObservationCount: 4,
      sourceObservationsUsed: 4,
      excludedPartialPeriods: 0,
    },
    history: {
      seriesId: 'boundary.series',
      benchmarkName: 'Boundary series',
      description: 'Boundary series',
      frequency: 'MONTHLY' as const,
      start: '2024-07-01T00:00:00.000Z',
      end: '2025-08-01T00:00:00.000Z',
      observations: 4,
      canonicalization: {
        method: 'test',
        version: 'test-v1',
      },
      points: [
        { date: '2024-07-01T00:00:00.000Z', value: 1, sourceObservedAt: null },
        { date: '2024-08-01T00:00:00.000Z', value: 2, sourceObservedAt: null },
        { date: '2024-08-15T00:00:00.000Z', value: 3, sourceObservedAt: null },
        { date: '2025-08-01T00:00:00.000Z', value: 4, sourceObservedAt: null },
      ],
    },
  }

  const narrowed = selectLatestCurrentForecastMonthlyTrainingPayload(payload)

  assert.deepEqual(narrowed.history.points.map((point) => point.date), [
    '2024-08-15T00:00:00.000Z',
    '2025-08-01T00:00:00.000Z',
  ])
})