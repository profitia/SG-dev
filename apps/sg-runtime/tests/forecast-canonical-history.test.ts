import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import {
  DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD,
  DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION,
  DAILY_MARKET_PRICE_MONTHLY_METHOD,
  DAILY_MARKET_PRICE_MONTHLY_VERSION,
  canonicalizeDailyMarketPriceHistory,
  canonicalizeDailyMarketPriceToEndOfPeriod,
  canonicalizeDailyMarketPriceToMonthly,
  canonicalizeProvenanceQualifiedNativePeriod,
  canonicalizeProvenanceQualifiedNativeMonthly,
  canonicalizeProvenanceQualifiedWeeklyEndOfPeriod,
  selectLatestContiguousMonthlySuffix,
} from '../lib/forecast/canonical-history'

function createDailyHistory(points: Array<{ date: string; value: number | null }>): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: 'Macrobond',
      },
      providerSeriesId: 'wocaes0074',
      providerSeriesKey: 'wocaes0074',
    },
    displayName: 'Brent, Spot, FOB North Sea',
    frequency: 'daily',
    currency: 'usd',
    unit: 'USD/barrel',
    source: 'src_macrobond',
    historical: points,
  }
}

test('daily market-price history canonicalizes to monthly averages with first-of-month identity', () => {
  const monthly = canonicalizeDailyMarketPriceToMonthly(
    createDailyHistory([
      { date: '2026-01-02T00:00:00.000Z', value: 10 },
      { date: '2026-01-31T00:00:00.000Z', value: 20 },
      { date: '2026-02-02T00:00:00.000Z', value: 30 },
      { date: '2026-02-27T00:00:00.000Z', value: 50 },
      { date: '2026-03-03T00:00:00.000Z', value: 100 },
    ]),
    { now: new Date('2026-03-15T12:00:00.000Z') },
  )

  assert.equal(monthly.frequency, 'MONTHLY')
  assert.equal(monthly.method, DAILY_MARKET_PRICE_MONTHLY_METHOD)
  assert.equal(monthly.version, DAILY_MARKET_PRICE_MONTHLY_VERSION)
  assert.equal(monthly.sourceObservationCount, 5)
  assert.equal(monthly.sourceObservationsUsed, 4)
  assert.equal(monthly.excludedPartialPeriods, 1)
  assert.deepEqual(monthly.historical, [
    { date: '2026-01-01T00:00:00.000Z', value: 15, sourceObservedAt: null },
    { date: '2026-02-01T00:00:00.000Z', value: 40, sourceObservedAt: null },
  ])
})

test('partial current month is excluded without mutating closed monthly history', () => {
  const baseHistory = createDailyHistory([
    { date: '2026-01-02T00:00:00.000Z', value: 10 },
    { date: '2026-01-30T00:00:00.000Z', value: 30 },
    { date: '2026-02-03T00:00:00.000Z', value: 20 },
    { date: '2026-02-28T00:00:00.000Z', value: 40 },
  ])

  const withPartialMarch = createDailyHistory([
    ...baseHistory.historical,
    { date: '2026-03-05T00:00:00.000Z', value: 999 },
    { date: '2026-03-12T00:00:00.000Z', value: 1001 },
  ])

  const baseline = canonicalizeDailyMarketPriceToMonthly(baseHistory, {
    now: new Date('2026-03-20T00:00:00.000Z'),
  })
  const withOpenMonth = canonicalizeDailyMarketPriceToMonthly(withPartialMarch, {
    now: new Date('2026-03-20T00:00:00.000Z'),
  })

  assert.deepEqual(withOpenMonth.historical, baseline.historical)
  assert.equal(withOpenMonth.excludedPartialPeriods, 1)
})

test('canonical monthly output is deterministic for identical daily history', () => {
  const history = createDailyHistory([
    { date: '2026-01-02T00:00:00.000Z', value: 10 },
    { date: '2026-01-30T00:00:00.000Z', value: 30 },
    { date: '2026-02-03T00:00:00.000Z', value: 20 },
    { date: '2026-02-28T00:00:00.000Z', value: 40 },
  ])

  const first = canonicalizeDailyMarketPriceToMonthly(history, {
    now: new Date('2026-03-20T00:00:00.000Z'),
  })
  const second = canonicalizeDailyMarketPriceToMonthly(history, {
    now: new Date('2026-03-20T00:00:00.000Z'),
  })

  assert.deepEqual(second, first)
})

test('future closed-month observations do not mutate earlier monthly periods', () => {
  const history = createDailyHistory([
    { date: '2026-01-02T00:00:00.000Z', value: 10 },
    { date: '2026-01-30T00:00:00.000Z', value: 30 },
    { date: '2026-02-03T00:00:00.000Z', value: 20 },
    { date: '2026-02-28T00:00:00.000Z', value: 40 },
  ])

  const extendedHistory = createDailyHistory([
    ...history.historical,
    { date: '2026-03-02T00:00:00.000Z', value: 50 },
    { date: '2026-03-31T00:00:00.000Z', value: 70 },
  ])

  const baseline = canonicalizeDailyMarketPriceToMonthly(history, {
    now: new Date('2026-04-20T00:00:00.000Z'),
  })
  const extended = canonicalizeDailyMarketPriceToMonthly(extendedHistory, {
    now: new Date('2026-04-20T00:00:00.000Z'),
  })

  assert.deepEqual(extended.historical.slice(0, baseline.historical.length), baseline.historical)
  assert.deepEqual(extended.historical[2], { date: '2026-03-01T00:00:00.000Z', value: 60, sourceObservedAt: null })
})

test('null daily observations are ignored as missing-day placeholders', () => {
  const monthly = canonicalizeDailyMarketPriceToMonthly(
    createDailyHistory([
      { date: '2026-01-02T00:00:00.000Z', value: 10 },
      { date: '2026-01-15T00:00:00.000Z', value: null },
      { date: '2026-01-30T00:00:00.000Z', value: 30 },
    ]),
    { now: new Date('2026-02-10T00:00:00.000Z') },
  )

  assert.equal(monthly.sourceObservationCount, 3)
  assert.equal(monthly.sourceObservationsUsed, 2)
  assert.deepEqual(monthly.historical, [{ date: '2026-01-01T00:00:00.000Z', value: 20, sourceObservedAt: null }])
})

test('non-finite daily observations fail closed instead of silently repairing forecast input', () => {
  assert.throws(
    () =>
      canonicalizeDailyMarketPriceToMonthly(
        createDailyHistory([
          { date: '2026-01-02T00:00:00.000Z', value: 10 },
          { date: '2026-01-30T00:00:00.000Z', value: Number.NaN },
        ]),
        { now: new Date('2026-02-10T00:00:00.000Z') },
      ),
    /cannot include non-finite daily observations/i,
  )
})

test('missing closed calendar month fails closed for Forecast Core monthly cadence', () => {
  assert.throws(
    () =>
      canonicalizeDailyMarketPriceToMonthly(
        createDailyHistory([
          { date: '2026-01-02T00:00:00.000Z', value: 10 },
          { date: '2026-01-30T00:00:00.000Z', value: 20 },
          { date: '2026-03-02T00:00:00.000Z', value: 30 },
          { date: '2026-03-30T00:00:00.000Z', value: 40 },
        ]),
        { now: new Date('2026-04-10T00:00:00.000Z') },
      ),
    /has a gap between/i,
  )
})

test('latest contiguous monthly suffix keeps only the newest lawful segment without modifying values or provenance', () => {
  const suffix = selectLatestContiguousMonthlySuffix([
    { date: '2020-01-01T00:00:00.000Z', value: 10, sourceObservedAt: null },
    { date: '2020-02-01T00:00:00.000Z', value: 11, sourceObservedAt: null },
    { date: '2020-05-01T00:00:00.000Z', value: 12, sourceObservedAt: '2020-05-29T00:00:00.000Z' },
    { date: '2020-06-01T00:00:00.000Z', value: 13, sourceObservedAt: '2020-06-30T00:00:00.000Z' },
    { date: '2020-07-01T00:00:00.000Z', value: 14, sourceObservedAt: '2020-07-31T00:00:00.000Z' },
  ])

  assert.deepEqual(suffix, [
    { date: '2020-05-01T00:00:00.000Z', value: 12, sourceObservedAt: '2020-05-29T00:00:00.000Z' },
    { date: '2020-06-01T00:00:00.000Z', value: 13, sourceObservedAt: '2020-06-30T00:00:00.000Z' },
    { date: '2020-07-01T00:00:00.000Z', value: 14, sourceObservedAt: '2020-07-31T00:00:00.000Z' },
  ])
})

test('end-of-period uses the last lawful observation when month-end exists', () => {
  const monthly = canonicalizeDailyMarketPriceToEndOfPeriod(
    createDailyHistory([
      { date: '2026-03-29T00:00:00.000Z', value: 98 },
      { date: '2026-03-30T00:00:00.000Z', value: 101 },
      { date: '2026-03-31T00:00:00.000Z', value: 103 },
      { date: '2026-04-02T00:00:00.000Z', value: 200 },
    ]),
    { now: new Date('2026-04-15T00:00:00.000Z') },
  )

  assert.equal(monthly.method, DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD)
  assert.equal(monthly.version, DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION)
  assert.equal(monthly.targetBasis, 'END_OF_PERIOD')
  assert.deepEqual(monthly.historical, [
    {
      date: '2026-03-01T00:00:00.000Z',
      value: 103,
      sourceObservedAt: '2026-03-31T00:00:00.000Z',
    },
  ])
})

test('end-of-period rolls back over explicit nulls to the latest lawful numeric observation in the month', () => {
  const monthly = canonicalizeDailyMarketPriceToEndOfPeriod(
    createDailyHistory([
      { date: '2026-03-27T00:00:00.000Z', value: 101 },
      { date: '2026-03-30T00:00:00.000Z', value: null },
      { date: '2026-03-31T00:00:00.000Z', value: null },
      { date: '2026-04-01T00:00:00.000Z', value: 110 },
    ]),
    { now: new Date('2026-04-15T00:00:00.000Z') },
  )

  assert.deepEqual(monthly.historical, [
    {
      date: '2026-03-01T00:00:00.000Z',
      value: 101,
      sourceObservedAt: '2026-03-27T00:00:00.000Z',
    },
  ])
})

test('end-of-period uses the latest lawful in-month observation when the calendar month end has no observation', () => {
  const monthly = canonicalizeDailyMarketPriceToEndOfPeriod(
    createDailyHistory([
      { date: '2026-02-27T00:00:00.000Z', value: 73 },
      { date: '2026-03-03T00:00:00.000Z', value: 80 },
    ]),
    { now: new Date('2026-03-15T00:00:00.000Z') },
  )

  assert.deepEqual(monthly.historical, [
    {
      date: '2026-02-01T00:00:00.000Z',
      value: 73,
      sourceObservedAt: '2026-02-27T00:00:00.000Z',
    },
  ])
})

test('end-of-period excludes the open current month even when daily observations already exist', () => {
  const monthly = canonicalizeDailyMarketPriceToEndOfPeriod(
    createDailyHistory([
      { date: '2026-07-31T00:00:00.000Z', value: 90 },
      { date: '2026-08-01T00:00:00.000Z', value: 91 },
      { date: '2026-08-18T00:00:00.000Z', value: 92 },
    ]),
    { now: new Date('2026-08-18T12:00:00.000Z') },
  )

  assert.equal(monthly.excludedPartialPeriods, 1)
  assert.deepEqual(monthly.historical, [
    {
      date: '2026-07-01T00:00:00.000Z',
      value: 90,
      sourceObservedAt: '2026-07-31T00:00:00.000Z',
    },
  ])
})

test('end-of-period month membership is UTC-safe across the month boundary', () => {
  const monthly = canonicalizeDailyMarketPriceToEndOfPeriod(
    createDailyHistory([
      { date: '2026-03-31T00:00:00.000Z', value: 103 },
      { date: '2026-04-01T00:00:00.000Z', value: 110 },
      { date: '2026-04-30T00:00:00.000Z', value: 115 },
    ]),
    { now: new Date('2026-05-10T00:00:00.000Z') },
  )

  assert.deepEqual(monthly.historical, [
    {
      date: '2026-03-01T00:00:00.000Z',
      value: 103,
      sourceObservedAt: '2026-03-31T00:00:00.000Z',
    },
    {
      date: '2026-04-01T00:00:00.000Z',
      value: 115,
      sourceObservedAt: '2026-04-30T00:00:00.000Z',
    },
  ])
})

test('end-of-period fails closed when a closed month has no lawful numeric observation', () => {
  assert.throws(
    () =>
      canonicalizeDailyMarketPriceToEndOfPeriod(
        createDailyHistory([
          { date: '2026-01-30T00:00:00.000Z', value: 20 },
          { date: '2026-02-03T00:00:00.000Z', value: null },
          { date: '2026-02-27T00:00:00.000Z', value: null },
          { date: '2026-03-31T00:00:00.000Z', value: 40 },
        ]),
        { now: new Date('2026-04-10T00:00:00.000Z') },
      ),
    /has a gap between/i,
  )
})

test('target basis selector preserves monthly-average semantics while enabling end-of-period', () => {
  const history = createDailyHistory([
    { date: '2026-02-20T00:00:00.000Z', value: 60 },
    { date: '2026-02-27T00:00:00.000Z', value: 73 },
    { date: '2026-03-31T00:00:00.000Z', value: 100 },
  ])

  const average = canonicalizeDailyMarketPriceHistory(history, 'MONTHLY_AVERAGE', {
    now: new Date('2026-04-10T00:00:00.000Z'),
  })
  const eop = canonicalizeDailyMarketPriceHistory(history, 'END_OF_PERIOD', {
    now: new Date('2026-04-10T00:00:00.000Z'),
  })

  assert.equal(average.method, DAILY_MARKET_PRICE_MONTHLY_METHOD)
  assert.equal(average.version, DAILY_MARKET_PRICE_MONTHLY_VERSION)
  assert.equal(average.historical[0]?.value, 66.5)
  assert.equal(eop.historical[0]?.value, 73)
  assert.notDeepEqual(average.historical, eop.historical)
})

test('provenance-qualified WEEKLY EOP reuses latest real in-month level without interpolation', () => {
  const history = createDailyHistory([
    { date: '2025-01-03T00:00:00.000Z', value: 10 },
    { date: '2025-01-31T00:00:00.000Z', value: 13 },
    { date: '2025-02-07T00:00:00.000Z', value: 15 },
    { date: '2025-02-28T00:00:00.000Z', value: 17 },
  ])
  history.frequency = 'Weekly'

  const prepared = canonicalizeProvenanceQualifiedWeeklyEndOfPeriod(history, {
    now: new Date('2025-03-15T00:00:00.000Z'),
  })

  assert.equal(prepared.method, 'LAST_LAWFUL_WEEKLY_LEVEL_IN_CLOSED_PERIOD')
  assert.equal(prepared.version, 'weekly-level-end-of-period-v1')
  assert.deepEqual(prepared.historical, [
    { date: '2025-01-01T00:00:00.000Z', value: 13, sourceObservedAt: '2025-01-31T00:00:00.000Z' },
    { date: '2025-02-01T00:00:00.000Z', value: 17, sourceObservedAt: '2025-02-28T00:00:00.000Z' },
  ])
})

test('provenance-qualified native MONTHLY preserves exact EOP provenance and Monthly Average values', () => {
  const history = createDailyHistory([
    { date: '2025-01-29T00:00:00.000Z', value: 10 },
    { date: '2025-02-26T00:00:00.000Z', value: 12 },
  ])
  history.frequency = 'Monthly'

  const eop = canonicalizeProvenanceQualifiedNativeMonthly(history, 'END_OF_PERIOD', {
    now: new Date('2025-03-15T00:00:00.000Z'),
  })
  const monthlyAverage = canonicalizeProvenanceQualifiedNativeMonthly(history, 'MONTHLY_AVERAGE', {
    now: new Date('2025-03-15T00:00:00.000Z'),
  })

  assert.deepEqual(eop.historical.map((point) => point.sourceObservedAt), [
    '2025-01-29T00:00:00.000Z',
    '2025-02-26T00:00:00.000Z',
  ])
  assert.deepEqual(monthlyAverage.historical.map((point) => point.sourceObservedAt), [null, null])
  assert.deepEqual(eop.historical.map((point) => point.value), monthlyAverage.historical.map((point) => point.value))
})

test('native QUARTERLY preparation keeps Average and EOP values equal but identities distinct', () => {
  const history = createDailyHistory([
    { date: '2015-03-31T00:00:00.000Z', value: 10 },
    { date: '2015-06-30T00:00:00.000Z', value: 12 },
    { date: '2015-09-30T00:00:00.000Z', value: 14 },
  ])
  history.frequency = 'Quarterly'

  const average = canonicalizeProvenanceQualifiedNativePeriod(
    history,
    'MONTHLY_AVERAGE',
    'QUARTERLY',
    { now: new Date('2016-01-15T00:00:00.000Z') },
  )
  const eop = canonicalizeProvenanceQualifiedNativePeriod(
    history,
    'END_OF_PERIOD',
    'QUARTERLY',
    { now: new Date('2016-01-15T00:00:00.000Z') },
  )

  assert.equal(average.frequency, 'QUARTERLY')
  assert.deepEqual(average.historical.map((point) => point.value), [10, 12, 14])
  assert.deepEqual(eop.historical.map((point) => point.value), [10, 12, 14])
  assert.notEqual(average.method, eop.method)
  assert.deepEqual(eop.historical.map((point) => point.sourceObservedAt), [
    '2015-03-31T00:00:00.000Z',
    '2015-06-30T00:00:00.000Z',
    '2015-09-30T00:00:00.000Z',
  ])
})

test('provenance-qualified adapters fail closed on frequency mismatch and duplicate native target months', () => {
  const daily = createDailyHistory([{ date: '2025-01-03T00:00:00.000Z', value: 10 }])
  assert.throws(() => canonicalizeProvenanceQualifiedWeeklyEndOfPeriod(daily), /requires WEEKLY/i)

  const monthly = createDailyHistory([
    { date: '2025-01-01T00:00:00.000Z', value: 10 },
    { date: '2025-01-31T00:00:00.000Z', value: 11 },
  ])
  monthly.frequency = 'Monthly'
  assert.throws(
    () => canonicalizeProvenanceQualifiedNativeMonthly(monthly, 'END_OF_PERIOD'),
    /duplicate target month/i,
  )
})