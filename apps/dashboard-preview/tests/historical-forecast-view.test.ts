import test from 'node:test'
import assert from 'node:assert/strict'

import type { ForecastAccuracyResponse } from '@/lib/forecast-accuracy/forecast-accuracy-contract'
import {
  buildHistoricalForecastComparison,
  buildHistoricalForecastDeltaSegments,
  buildHistoricalForecastLineSegments,
  resolveHistoricalForecastPercentageDiff,
  selectPreferredAccuracyHorizon,
  toCanonicalMonthKey,
} from '@/lib/forecast-accuracy/historical-forecast-view'

function createResponse(overrides: Partial<ForecastAccuracyResponse> = {}): ForecastAccuracyResponse {
  return {
    selection: {
      componentName: 'ALUMINIUM',
      benchmarkCode: 'lmeofalcashask',
      horizonMonths: 1,
    },
    availableHorizons: [1, 3, 6, 12],
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 105,
        sourceDifferenceValue: 5,
        sourceErrorType: 'Przeszacowanie',
      },
    ],
    sourceInfo: {
      sourceTableName: 'ALUMINIUM',
      sourceBusinessName: 'Aluminium',
      latestRunId: 'run-1',
      lastSyncedAt: '2026-07-10T00:00:00.000Z',
    },
    coverage: {
      firstDate: '2026-01-01T00:00:00.000Z',
      lastDate: '2026-01-01T00:00:00.000Z',
      pointCount: 1,
      missingPointCount: 0,
    },
    ...overrides,
  }
}

test('selects default horizon as 1M when available', () => {
  assert.equal(selectPreferredAccuracyHorizon([1, 3, 6], null), 1)
})

test('keeps previous horizon when still available', () => {
  assert.equal(selectPreferredAccuracyHorizon([1, 3, 6], 3), 3)
})

test('falls back to shortest available horizon when 1M is unavailable', () => {
  assert.equal(selectPreferredAccuracyHorizon([3, 6, 12], 1), 3)
})

test('builds canonical UTC month keys', () => {
  assert.equal(toCanonicalMonthKey('2026-03-31T23:00:00.000-02:00'), '2026-04')
})

test('builds comparison points with presentation percentage diff and canonical keys', () => {
  const comparison = buildHistoricalForecastComparison(createResponse())

  assert.equal(comparison.horizonMonths, 1)
  assert.equal(comparison.points[0]?.monthKey, '2026-01')
  assert.equal(comparison.points[0]?.percentageDiff, 5)
  assert.equal(comparison.points[0]?.direction, 'above')
})

test('does not calculate percentage diff when actual value is zero', () => {
  assert.equal(resolveHistoricalForecastPercentageDiff(0, 120), null)
})

test('filters out points without actual value from comparison geometry input', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: null,
        forecastValue: 105,
        sourceDifferenceValue: 5,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 99,
        sourceDifferenceValue: -1,
        sourceErrorType: null,
      },
    ],
  }))

  assert.deepEqual(comparison.points.map((point) => point.monthKey), ['2026-02'])
})

test('filters out points without a finite forecast value from comparison geometry input', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: Number.NaN,
        sourceDifferenceValue: null,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 105,
        forecastValue: 102,
        sourceDifferenceValue: -3,
        sourceErrorType: null,
      },
    ],
  }))

  assert.deepEqual(comparison.points.map((point) => point.monthKey), ['2026-02'])
})

test('creates separate delta segments for above and below states', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 105,
        sourceDifferenceValue: 5,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 110,
        forecastValue: 100,
        sourceDifferenceValue: -10,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 2)
  assert.equal(segments[0]?.sign, 'above')
  assert.equal(segments[1]?.sign, 'below')
  assert.equal(segments[0]?.points[1]?.source, 'crossing')
  assert.equal(segments[0]?.points[2]?.source, 'crossing')
  assert.equal(segments[1]?.points[0]?.source, 'crossing')
  assert.equal(segments[1]?.points.at(-1)?.source, 'crossing')
})

test('does not interpolate delta through monthly gaps', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 105,
        sourceDifferenceValue: 5,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-03-01T00:00:00.000Z',
        actualValue: 102,
        forecastValue: 103,
        sourceDifferenceValue: 1,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 0)
})

test('splits historical forecast line into monthly-contiguous segments only', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 105,
        sourceDifferenceValue: 5,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 110,
        forecastValue: 108,
        sourceDifferenceValue: -2,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-04-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 119,
        sourceDifferenceValue: -1,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-05-01T00:00:00.000Z',
        actualValue: 118,
        forecastValue: 121,
        sourceDifferenceValue: 3,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastLineSegments(comparison.points)

  assert.deepEqual(segments.map((segment) => segment.points.map((point) => point.monthKey)), [
    ['2026-01', '2026-02'],
    ['2026-04', '2026-05'],
  ])
})

test('builds one local polygon for two points when forecast is above actual', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 110,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 135,
        sourceDifferenceValue: 15,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 1)
  assert.equal(segments[0]?.sign, 'above')
  assert.deepEqual(segments[0]?.points.map((point) => point.edge), ['actual', 'actual', 'forecast', 'forecast'])
})

test('builds one local polygon for two points when forecast is below actual', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 110,
        sourceDifferenceValue: -10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 140,
        forecastValue: 125,
        sourceDifferenceValue: -15,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 1)
  assert.equal(segments[0]?.sign, 'below')
})

test('splits crossing from plus to minus into two local polygons', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 120,
        sourceDifferenceValue: 20,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 110,
        sourceDifferenceValue: -10,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 2)
  assert.deepEqual(segments.map((segment) => segment.sign), ['above', 'below'])
})

test('splits crossing from minus to plus into two local polygons', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 100,
        sourceDifferenceValue: -20,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 110,
        forecastValue: 130,
        sourceDifferenceValue: 20,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 2)
  assert.deepEqual(segments.map((segment) => segment.sign), ['below', 'above'])
})

test('builds a local polygon when delta is zero at the start', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 100,
        sourceDifferenceValue: 0,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 130,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 1)
  assert.equal(segments[0]?.sign, 'above')
})

test('builds a local polygon when delta is zero at the end', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 90,
        sourceDifferenceValue: -10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 120,
        sourceDifferenceValue: 0,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 1)
  assert.equal(segments[0]?.sign, 'below')
})

test('does not build a polygon when delta is zero at both points', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 100,
        sourceDifferenceValue: 0,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 120,
        sourceDifferenceValue: 0,
        sourceErrorType: null,
      },
    ],
  }))

  assert.equal(buildHistoricalForecastDeltaSegments(comparison.points).length, 0)
})

test('normalizes duplicate month keys before building polygons', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 110,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-01-15T00:00:00.000Z',
        actualValue: 102,
        forecastValue: 111,
        sourceDifferenceValue: 9,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 130,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 1)
  assert.equal(segments[0]?.points[0]?.date, '2026-01-01T00:00:00.000Z')
})

test('normalizes unsorted input before building polygons', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-03-01T00:00:00.000Z',
        actualValue: 130,
        forecastValue: 140,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 110,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 130,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
    ],
  }))

  const segments = buildHistoricalForecastDeltaSegments(comparison.points)

  assert.equal(segments.length, 2)
  assert.deepEqual(segments.map((segment) => segment.points[0]?.date), [
    '2026-01-01T00:00:00.000Z',
    '2026-02-01T00:00:00.000Z',
  ])
})

test('prevents self-intersection by keeping winding order actual-start actual-end forecast-end forecast-start', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 120,
        sourceDifferenceValue: 20,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 130,
        forecastValue: 150,
        sourceDifferenceValue: 20,
        sourceErrorType: null,
      },
    ],
  }))

  const segment = buildHistoricalForecastDeltaSegments(comparison.points)[0]

  assert.deepEqual(segment?.points.map((point) => point.edge), ['actual', 'actual', 'forecast', 'forecast'])
})

test('does not build polygons for a single point', () => {
  const comparison = buildHistoricalForecastComparison(createResponse())

  assert.equal(buildHistoricalForecastDeltaSegments(comparison.points).length, 0)
})

test('builds several local polygons instead of one broad polygon for a continuous run', () => {
  const comparison = buildHistoricalForecastComparison(createResponse({
    points: [
      {
        targetDate: '2026-01-01T00:00:00.000Z',
        actualValue: 100,
        forecastValue: 110,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-02-01T00:00:00.000Z',
        actualValue: 120,
        forecastValue: 130,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
      {
        targetDate: '2026-03-01T00:00:00.000Z',
        actualValue: 140,
        forecastValue: 150,
        sourceDifferenceValue: 10,
        sourceErrorType: null,
      },
    ],
  }))

  assert.equal(buildHistoricalForecastDeltaSegments(comparison.points).length, 2)
})