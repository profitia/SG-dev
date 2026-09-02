import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import { buildForecastHistoryFingerprint } from '../lib/forecast/service'
import {
  buildLiveForecastBridgePayloadFromHistory,
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