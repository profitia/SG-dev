import assert from 'node:assert/strict'
import test from 'node:test'

import { buildForecastHistoryFingerprint } from '../lib/forecast/service'

function createAverageHistory() {
  return {
    seriesId: 'wocaes0074',
    benchmarkName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'MONTHLY',
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-02-01T00:00:00.000Z',
    observations: 2,
    canonicalization: {
      method: 'AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS',
      version: 'daily-market-price-monthly-average-v2',
    },
    points: [
      { date: '2026-01-01T00:00:00.000Z', value: 20, sourceObservedAt: null },
      { date: '2026-02-01T00:00:00.000Z', value: 30, sourceObservedAt: null },
    ],
  }
}

function createEndOfPeriodHistory() {
  return {
    ...createAverageHistory(),
    canonicalization: {
      method: 'LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD',
      version: 'daily-market-price-end-of-period-v1',
    },
    points: [
      { date: '2026-01-01T00:00:00.000Z', value: 20, sourceObservedAt: '2026-01-30T00:00:00.000Z' },
      { date: '2026-02-01T00:00:00.000Z', value: 30, sourceObservedAt: '2026-02-27T00:00:00.000Z' },
    ],
  }
}

test('monthly date-only and ISO period identities hash identically', () => {
  const iso = createAverageHistory()
  const dateOnly = {
    ...iso,
    start: '2026-01-01',
    end: '2026-02-01',
    points: [
      { date: '2026-01-01', value: 20, sourceObservedAt: null },
      { date: '2026-02-01', value: 30, sourceObservedAt: null },
    ],
  }
  const timezoneVariant = {
    ...iso,
    start: '2026-01-01T00:00:00Z',
    end: '2026-02-01T00:00:00Z',
    points: [
      { date: '2026-01-01T00:00:00Z', value: 20, sourceObservedAt: null },
      { date: '2026-02-01T00:00:00Z', value: 30, sourceObservedAt: null },
    ],
  }

  const expected = buildForecastHistoryFingerprint(iso)
  assert.equal(buildForecastHistoryFingerprint(dateOnly), expected)
  assert.equal(buildForecastHistoryFingerprint(timezoneVariant), expected)
})

test('monthly fingerprint is deterministic regardless of point ordering', () => {
  const ordered = createAverageHistory()
  const reversed = {
    ...ordered,
    points: [...ordered.points].reverse(),
  }

  assert.equal(buildForecastHistoryFingerprint(reversed), buildForecastHistoryFingerprint(ordered))
})

test('explicit cadence fingerprint distinguishes source frequency and target cadence independently', () => {
  const quarterlyHistory = {
    ...createAverageHistory(),
    frequency: 'QUARTERLY',
    start: '2026-01-01',
    end: '2026-04-01',
    points: [
      { date: '2026-01-01', value: 20, sourceObservedAt: null },
      { date: '2026-04-01', value: 30, sourceObservedAt: null },
    ],
  }
  const monthlySource = buildForecastHistoryFingerprint(quarterlyHistory, {
    sourceFrequency: 'MONTHLY',
    targetCadence: 'QUARTERLY',
  })
  const quarterlySource = buildForecastHistoryFingerprint(quarterlyHistory, {
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const semiannualTarget = buildForecastHistoryFingerprint({
    ...quarterlyHistory,
    frequency: 'SEMIANNUAL',
    end: '2026-07-01',
    points: [
      { date: '2026-01-01', value: 20, sourceObservedAt: null },
      { date: '2026-07-01', value: 30, sourceObservedAt: null },
    ],
  }, {
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'SEMIANNUAL',
  })

  assert.equal(new Set([monthlySource, quarterlySource, semiannualTarget]).size, 3)
})

test('legacy Monthly fingerprint remains unchanged when explicit cadence metadata is absent', () => {
  const history = createAverageHistory()
  const legacy = buildForecastHistoryFingerprint(history)

  assert.equal(buildForecastHistoryFingerprint({ ...history }), legacy)
  assert.notEqual(buildForecastHistoryFingerprint(history, {
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  }), legacy)
})

test('invalid mid-month period fails closed instead of being truncated into a month identity', () => {
  const invalid = {
    ...createAverageHistory(),
    points: [{ date: '2026-01-15', value: 20, sourceObservedAt: null }],
    observations: 1,
    end: '2026-01-15',
  }

  assert.throws(
    () => buildForecastHistoryFingerprint(invalid),
    /must identify a canonical MONTHLY period/i,
  )
})

test('end-of-period date-only and ISO source provenance hash identically', () => {
  const iso = createEndOfPeriodHistory()
  const dateOnly = {
    ...iso,
    points: [
      { date: '2026-01-01', value: 20, sourceObservedAt: '2026-01-30' },
      { date: '2026-02-01', value: 30, sourceObservedAt: '2026-02-27' },
    ],
    start: '2026-01-01',
    end: '2026-02-01',
  }

  assert.equal(buildForecastHistoryFingerprint(dateOnly), buildForecastHistoryFingerprint(iso))
})

test('end-of-period fingerprint remains provenance-sensitive and value-sensitive', () => {
  const baseline = createEndOfPeriodHistory()
  const provenanceShifted = {
    ...baseline,
    points: [
      { ...baseline.points[0], sourceObservedAt: '2026-01-29T00:00:00.000Z' },
      baseline.points[1],
    ],
  }
  const valueShifted = {
    ...baseline,
    points: [
      { ...baseline.points[0], value: 21 },
      baseline.points[1],
    ],
  }

  assert.notEqual(buildForecastHistoryFingerprint(provenanceShifted), buildForecastHistoryFingerprint(baseline))
  assert.notEqual(buildForecastHistoryFingerprint(valueShifted), buildForecastHistoryFingerprint(baseline))
})