import test from 'node:test'
import assert from 'node:assert/strict'

import { resolvePresetRange } from '@/components/raw-data-view/index'
import { clipDeltaOverlaysToRange } from '@/lib/chart/delta-overlay-clipping'
import { buildForecastPortfolioPayload } from '@/lib/time-series-viewer/forecast-portfolio-to-time-series-viewer'
import type {
  BenchmarkForecastCurrentAvailableResult,
  BenchmarkForecastVerificationAvailableResult,
  ForecastVerificationRecord,
} from '@/lib/benchmark-forecast/forecast-contract'
import type { TimeSeriesViewerPayload, TimeSeriesViewerPoint } from '@/lib/time-series-viewer/time-series-viewer-contract'

const GEOMETRY_EPSILON = 1e-8

function createBasePayload(): TimeSeriesViewerPayload {
  return {
    title: 'Brent, Spot, FOB North Sea',
    subtitle: null,
    locale: 'pl',
    sourceInfo: null,
    benchmarkCode: 'wocaes0074',
    description: null,
    unit: 'usd',
    currency: 'usd',
    market: null,
    country: null,
    lastSyncedAt: null,
    xAxis: {
      type: 'time',
      labelFormat: 'MMM yy',
      ticks: [],
    },
    yAxis: {
      type: 'value',
      unit: 'usd',
      currency: 'usd',
      ticks: [],
    },
    series: [],
    forecastAnchor: null,
    forecastOrigin: null,
    deltaOverlays: [],
    tooltipModel: null,
    detailModel: null,
    events: [],
  }
}

function createHistoricalPoint(date: string, value: number): TimeSeriesViewerPoint {
  return {
    key: `historical-${date}`,
    date,
    value,
    diff: null,
    recordId: `historical-${date}`,
    anchor: false,
    tooltipModel: {
      title: `Brent, Spot, FOB North Sea · ${date}`,
      rows: [],
    },
    detailModel: {
      componentName: 'Brent, Spot, FOB North Sea',
      benchmarkCode: 'wocaes0074',
      sourceDate: date,
      temporalResolution: 'day',
      scenarioType: 'historical',
      value,
      forecastLower: null,
      forecastUpper: null,
      forecastAccuracyDiff: null,
      description: null,
      unit: 'usd',
      currency: 'usd',
      market: null,
      country: null,
      qualityStatus: null,
      sourceLabel: null,
      lastSyncedAt: null,
    },
  }
}

function createBasePayloadWithHistorical(points: Array<{ date: string; value: number }>): TimeSeriesViewerPayload {
  return {
    ...createBasePayload(),
    series: [{
      id: 'historical',
      kind: 'historical',
      label: 'Ceny historyczne',
      lineStyle: 'solid',
      points: points.map((point) => createHistoricalPoint(point.date, point.value)),
    }],
  }
}

function createRecord(overrides: Partial<ForecastVerificationRecord>): ForecastVerificationRecord {
  return {
    benchmarkId: 'wocaes0074',
    modelId: 'damped_holt',
    forecastOrigin: '2026-01-01T00:00:00.000Z',
    horizon: '3M',
    horizonSteps: 3,
    forecastDate: '2026-04-01T00:00:00.000Z',
    actualObservedAt: null,
    originValue: 95,
    forecastValue: 100,
    actualValue: 90,
    error: 10,
    absoluteError: 10,
    delta: 10,
    deltaPct: 0.1111111111,
    maseScale: 1,
    ...overrides,
  }
}

function createVerificationResult(records: ForecastVerificationRecord[]): BenchmarkForecastVerificationAvailableResult {
  return createVerificationResultForTargetBasis('MONTHLY_AVERAGE', records)
}

function createIdentityFields(
  targetBasis: 'MONTHLY_AVERAGE' | 'POINT_IN_TIME' | 'END_OF_PERIOD',
) {
  const targetSemantics = targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis
  const methodId = targetSemantics

  return {
    targetSemantics,
    methodId,
    lineage: {
      inputSource: targetBasis === 'POINT_IN_TIME' ? 'DYNAMIC_MARKET_DATA_STORE' : 'TEST_SOURCE',
      inputRunId: null,
      sourceSeriesId: 'wocaes0074',
      sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      historyFingerprint: 'test-history-fingerprint',
      preparation: null,
    },
  } as const
}

function createVerificationResultForTargetBasis(
  targetBasis: 'MONTHLY_AVERAGE' | 'POINT_IN_TIME' | 'END_OF_PERIOD',
  records: ForecastVerificationRecord[],
): BenchmarkForecastVerificationAvailableResult {
  return {
    status: 'AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'damped_holt',
    targetBasis,
    ...createIdentityFields(targetBasis),
    displayName: 'Brent, Spot, FOB North Sea',
    description: null,
    methodVersion: 'test',
    history: {
      frequency: 'MONTHLY',
      start: '2020-01-01T00:00:00.000Z',
      end: '2026-07-01T00:00:00.000Z',
      observations: 79,
    },
    forecastOrigin: '2026-07-01T00:00:00.000Z',
    verification: {
      '3M': {
        horizon: '3M',
        horizonSteps: 3,
        origins: records.length,
        expectedOrigins: records.length,
        successfulOrigins: records.length,
        failedOrigins: 0,
        coverage: 1,
        records,
      },
    },
  }
}

function createCurrentResult(targetBasis: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD'): BenchmarkForecastCurrentAvailableResult {
  return {
    status: 'AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'damped_holt',
    targetBasis,
    ...createIdentityFields(targetBasis),
    displayName: 'Brent, Spot, FOB North Sea',
    description: null,
    methodVersion: 'test',
    history: {
      frequency: 'MONTHLY',
      start: '2020-01-01T00:00:00.000Z',
      end: '2026-07-01T00:00:00.000Z',
      observations: 79,
    },
    forecastOrigin: '2026-07-01T00:00:00.000Z',
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-08-01T00:00:00.000Z',
        forecastValue: 110,
      },
    },
  }
}

function createPointInTimeCurrentResult(): BenchmarkForecastCurrentAvailableResult {
  return {
    status: 'AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'damped_holt',
    targetBasis: 'POINT_IN_TIME',
    ...createIdentityFields('POINT_IN_TIME'),
    displayName: 'Brent, Spot, FOB North Sea',
    description: null,
    methodVersion: 'rolling-daily-point-in-time-v1',
    history: {
      frequency: 'DAILY',
      start: null,
      end: '2026-08-19',
      observations: 0,
    },
    forecastOrigin: '2026-08-19',
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-09-19',
        forecastValue: 110,
      },
    },
    rollingDailySnapshot: {
      productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
      contractVersion: '1',
      status: 'AVAILABLE',
      benchmark: {
        benchmarkId: 'wocaes0074',
        displayName: 'Brent, Spot, FOB North Sea',
        frequency: 'DAILY',
        unit: 'usd',
        currency: 'usd',
        provider: 'macrobond',
        providerSeriesId: 'wocaes0074',
      },
      forecastMethod: {
        id: 'ROLLING_DAILY_POINT_IN_TIME',
        version: 'rolling-daily-point-in-time-v1',
      },
      model: {
        id: 'damped_holt',
        selectedCandidate: 'damped_holt',
      },
      origin: {
        date: '2026-08-19',
        value: 104,
      },
      maxHorizonMonths: 12,
      anchors: [
        {
          horizon: '1M',
          horizonMonths: 1,
          targetCalendarDate: '2026-09-19',
          pointForecast: 110,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 107,
            upper: 113,
            sampleCount: 50,
            p10ResidualOffset: -3,
            p90ResidualOffset: 3,
          },
        },
      ],
      path: [
        {
          date: '2026-08-20',
          pointForecast: 105,
          band: {
            status: 'NOT_AVAILABLE',
            reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
            source: null,
            lower: null,
            upper: null,
          },
        },
        {
          date: '2026-09-19',
          pointForecast: 110,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 107,
            upper: 113,
          },
        },
      ],
      calibration: {
        availabilityStatus: 'AVAILABLE',
        freshnessStatus: 'FRESH',
        quantileConvention: 'HF7',
        coverageLabel: '80%',
        methodologicalMinimumStatus: 'MET',
        updatedAt: '2026-08-20T00:00:00.000Z',
        processedThrough: '2026-08-19',
        lastResidualAvailabilityDate: '2026-08-19',
      },
      audit: {
        sourceHistoryFingerprint: 'fixture-source-history-fingerprint',
        generatedAt: '2026-08-20T00:00:00.000Z',
        sourceLatestObservationDate: '2026-08-19',
        calendarProjectionMode: 'CALENDAR_MONTH_CLAMP',
        projectionCalendarStrategy: 'CALENDAR_MONTH_CLAMP',
        technicalMinimumTrainingObservations: 60,
        methodologicalTrainingEligibilityStatus: 'ELIGIBLE',
        calibrationUpdatedAt: '2026-08-20T00:00:00.000Z',
        calibrationLastResidualAvailabilityDate: '2026-08-19',
        inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      },
      warnings: [],
    },
  }
}

function createExtendedPointInTimeCurrentResult(): BenchmarkForecastCurrentAvailableResult {
  return {
    ...createPointInTimeCurrentResult(),
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-09-19',
        forecastValue: 110,
      },
      '3M': {
        horizon: '3M',
        horizonSteps: 3,
        forecastDate: '2026-11-19',
        forecastValue: 111,
      },
      '6M': {
        horizon: '6M',
        horizonSteps: 6,
        forecastDate: '2027-02-19',
        forecastValue: 112,
      },
      '12M': {
        horizon: '12M',
        horizonSteps: 12,
        forecastDate: '2027-08-19',
        forecastValue: 113,
      },
    },
    rollingDailySnapshot: {
      ...createPointInTimeCurrentResult().rollingDailySnapshot!,
      anchors: [
        {
          horizon: '1M',
          horizonMonths: 1,
          targetCalendarDate: '2026-09-19',
          pointForecast: 110,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 107,
            upper: 113,
            sampleCount: 50,
            p10ResidualOffset: -3,
            p90ResidualOffset: 3,
          },
        },
        {
          horizon: '3M',
          horizonMonths: 3,
          targetCalendarDate: '2026-11-19',
          pointForecast: 111,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 108,
            upper: 114,
            sampleCount: 50,
            p10ResidualOffset: -3,
            p90ResidualOffset: 3,
          },
        },
        {
          horizon: '6M',
          horizonMonths: 6,
          targetCalendarDate: '2027-02-19',
          pointForecast: 112,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 109,
            upper: 115,
            sampleCount: 50,
            p10ResidualOffset: -3,
            p90ResidualOffset: 3,
          },
        },
        {
          horizon: '12M',
          horizonMonths: 12,
          targetCalendarDate: '2027-08-19',
          pointForecast: 113,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 110,
            upper: 116,
            sampleCount: 50,
            p10ResidualOffset: -3,
            p90ResidualOffset: 3,
          },
        },
      ],
      path: [
        {
          date: '2026-08-20',
          pointForecast: 105,
          band: {
            status: 'NOT_AVAILABLE',
            reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
            source: null,
            lower: null,
            upper: null,
          },
        },
        {
          date: '2026-09-19',
          pointForecast: 110,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 107,
            upper: 113,
          },
        },
        {
          date: '2026-11-19',
          pointForecast: 111,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS',
            lower: 108,
            upper: 114,
          },
        },
        {
          date: '2027-02-19',
          pointForecast: 112,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 109,
            upper: 115,
          },
        },
        {
          date: '2027-08-19',
          pointForecast: 113,
          band: {
            status: 'AVAILABLE',
            reasonCode: null,
            source: 'EMPIRICAL_ANCHOR',
            lower: 110,
            upper: 116,
          },
        },
      ],
    },
  }
}

test('point-in-time current forecast keeps the line and withholds the band before the first empirical anchor', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-08-15T00:00:00.000Z', value: 102 },
      { date: '2026-08-19T00:00:00.000Z', value: 104 },
    ]),
    locale: 'pl',
    model: 'damped_holt',
    currentResult: createPointInTimeCurrentResult(),
    verificationResult: null,
    verificationHorizon: '1M',
  })

  assert.ok(payload)

  const centralSeries = payload?.series.find((entry) => entry.kind === 'forecast-central')
  const upperSeries = payload?.series.find((entry) => entry.kind === 'forecast-upper')
  const lowerSeries = payload?.series.find((entry) => entry.kind === 'forecast-lower')

  assert.ok(centralSeries)
  assert.ok(upperSeries)
  assert.ok(lowerSeries)
  assert.deepEqual(centralSeries?.points.map((point) => point.date), [
    '2026-08-20T12:00:00.000Z',
    '2026-09-19T12:00:00.000Z',
  ])
  assert.deepEqual(upperSeries?.points.map((point) => point.value), [null, 113])
  assert.deepEqual(lowerSeries?.points.map((point) => point.value), [null, 107])
})

test('point-in-time current forecast preserves full path and lawful upper/lower counts', () => {
  const currentResult = createExtendedPointInTimeCurrentResult()
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-08-15T00:00:00.000Z', value: 102 },
      { date: '2026-08-19T00:00:00.000Z', value: 104 },
    ]),
    locale: 'pl',
    model: 'damped_holt',
    currentResult,
    verificationResult: null,
    verificationHorizon: '12M',
  })

  const centralSeries = payload?.series.find((entry) => entry.kind === 'forecast-central')
  const upperSeries = payload?.series.find((entry) => entry.kind === 'forecast-upper')
  const lowerSeries = payload?.series.find((entry) => entry.kind === 'forecast-lower')
  const runtimePath = currentResult.rollingDailySnapshot?.path ?? []
  const availableBandCount = runtimePath.filter((point) => point.band.status === 'AVAILABLE').length

  assert.equal(centralSeries?.points.length, runtimePath.length)
  assert.equal(upperSeries?.points.filter((point) => point.value !== null).length, availableBandCount)
  assert.equal(lowerSeries?.points.filter((point) => point.value !== null).length, availableBandCount)
})

test('point-in-time verification stays on exact target dates and enables daily overlay geometry', () => {
  const firstRecord = createRecord({
    forecastOrigin: '2026-01-15T00:00:00.000Z',
    forecastDate: '2026-04-15T00:00:00.000Z',
    actualObservedAt: '2026-04-15T00:00:00.000Z',
    forecastValue: 90,
    actualValue: 94,
    delta: -4,
    error: -4,
    absoluteError: 4,
    deltaPct: -0.0425531915,
  })
  const secondRecord = createRecord({
    forecastOrigin: '2026-01-16T00:00:00.000Z',
    forecastDate: '2026-04-16T00:00:00.000Z',
    actualObservedAt: '2026-04-16T00:00:00.000Z',
    forecastValue: 92,
    actualValue: 95,
    delta: -3,
    error: -3,
    absoluteError: 3,
    deltaPct: -0.0315789474,
  })

  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-04-15T00:00:00.000Z', value: 94 },
      { date: '2026-04-16T00:00:00.000Z', value: 95 },
    ]),
    locale: 'pl',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('POINT_IN_TIME', [firstRecord, secondRecord]),
    verificationHorizon: '3M',
  })

  assert.ok(payload)
  assert.equal(payload?.verificationTargetBasis, 'POINT_IN_TIME')

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')
  const monthlyActualSeries = payload?.series.find((entry) => entry.kind === 'monthly-actual')

  assert.ok(verificationSeries)
  assert.equal(monthlyActualSeries, undefined)
  assert.deepEqual(verificationSeries?.points.map((point) => point.date), [
    '2026-04-15T00:00:00.000Z',
    '2026-04-16T00:00:00.000Z',
  ])
})

function interpolateByDate(
  leftDate: string,
  rightDate: string,
  leftValue: number,
  rightValue: number,
  targetDate: string,
) {
  const leftMs = new Date(leftDate).getTime()
  const rightMs = new Date(rightDate).getTime()
  const targetMs = new Date(targetDate).getTime()

  if (rightMs <= leftMs) {
    return leftValue
  }

  const ratio = (targetMs - leftMs) / (rightMs - leftMs)
  return leftValue + ((rightValue - leftValue) * ratio)
}

function evaluateTrajectoryAtDate(points: TimeSeriesViewerPoint[], targetDate: string) {
  const visiblePoints = points
    .filter((point): point is TimeSeriesViewerPoint & { value: number } => point.value !== null)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())

  for (let index = 0; index < visiblePoints.length; index += 1) {
    const point = visiblePoints[index]
    const next = visiblePoints[index + 1]

    if (!point) {
      continue
    }

    if (point.date === targetDate) {
      return point.value
    }

    if (!next) {
      continue
    }

    if (new Date(point.date).getTime() < new Date(targetDate).getTime() && new Date(targetDate).getTime() < new Date(next.date).getTime()) {
      return interpolateByDate(point.date, next.date, point.value, next.value, targetDate)
    }
  }

  return null
}

function collectBoundarySamples(payload: TimeSeriesViewerPayload, edge: 'actual' | 'forecast') {
  const sampleMap = new Map<string, number[]>()

  for (const overlay of payload.deltaOverlays) {
    const boundaryPoints = edge === 'actual'
      ? [overlay.points[0], overlay.points[1]]
      : [overlay.points[3], overlay.points[2]]

    for (const point of boundaryPoints) {
      if (!point) {
        continue
      }

      const values = sampleMap.get(point.date) ?? []
      values.push(point.value)
      sampleMap.set(point.date, values)
    }
  }

  return [...sampleMap.entries()]
    .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
    .map(([date, values]) => ({ date, values }))
}

function summarizeBoundaryCoincidence(
  payload: TimeSeriesViewerPayload,
  edge: 'actual' | 'forecast',
  trajectoryPoints: TimeSeriesViewerPoint[],
) {
  const samples = collectBoundarySamples(payload, edge)
  let duplicateX = 0
  let conflictingDuplicateX = 0
  let exactCoincident = 0
  let nonCoincident = 0
  let maxDifference = 0

  for (const sample of samples) {
    if (sample.values.length > 1) {
      duplicateX += 1
    }

    const expectedValue = evaluateTrajectoryAtDate(trajectoryPoints, sample.date)
    assert.notEqual(expectedValue, null)

    const baseline = sample.values[0] ?? null

    for (const value of sample.values) {
      const difference = Math.abs(value - (expectedValue ?? value))
      maxDifference = Math.max(maxDifference, difference)

      if (baseline !== null && Math.abs(value - baseline) > GEOMETRY_EPSILON) {
        conflictingDuplicateX += 1
      }

      if (difference <= GEOMETRY_EPSILON) {
        exactCoincident += 1
      } else {
        nonCoincident += 1
      }
    }
  }

  return {
    samples: samples.length,
    duplicateX,
    conflictingDuplicateX,
    exactCoincident,
    nonCoincident,
    maxDifference,
  }
}

test('verification band uses target periods rather than forecast origins for geometry', () => {
  const firstRecord = createRecord({
    forecastOrigin: '2026-01-01T00:00:00.000Z',
    forecastDate: '2026-04-01T00:00:00.000Z',
    forecastValue: 100,
    actualValue: 90,
    delta: 10,
    error: 10,
  })
  const secondRecord = createRecord({
    forecastOrigin: '2026-02-01T00:00:00.000Z',
    forecastDate: '2026-05-01T00:00:00.000Z',
    forecastValue: 102,
    actualValue: 101,
    delta: 1,
    error: 1,
    absoluteError: 1,
    deltaPct: 0.0099009901,
  })

  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'pl',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResult([firstRecord, secondRecord]),
    verificationHorizon: '3M',
  })

  assert.ok(payload)

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')
  const monthlyActualSeries = payload?.series.find((entry) => entry.kind === 'monthly-actual')
  assert.ok(verificationSeries)
  assert.ok(monthlyActualSeries)
  assert.deepEqual(verificationSeries?.points.map((point) => point.date), [
    '2026-04-30T12:00:00.000Z',
    '2026-05-31T12:00:00.000Z',
  ])
  assert.deepEqual(monthlyActualSeries?.points.map((point) => ({ date: point.date, value: point.value })), [
    { date: '2026-04-30T12:00:00.000Z', value: 90 },
    { date: '2026-05-31T12:00:00.000Z', value: 101 },
  ])

  const overlayDates = payload?.deltaOverlays.flatMap((overlay) => overlay.points.map((point) => point.date)) ?? []
  assert.deepEqual(overlayDates, [
    '2026-04-30T12:00:00.000Z',
    '2026-05-31T12:00:00.000Z',
    '2026-05-31T12:00:00.000Z',
    '2026-04-30T12:00:00.000Z',
  ])
  assert.ok(!overlayDates.includes('2026-01-31T12:00:00.000Z'))
  assert.ok(!overlayDates.includes('2026-02-28T12:00:00.000Z'))
})

test('verification tooltip preserves target-period geometry and forecast-origin provenance', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResult([
      createRecord({
        forecastOrigin: '2026-01-01T00:00:00.000Z',
        forecastDate: '2026-04-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 92,
        delta: 8,
        deltaPct: 8 / 92,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')
  assert.ok(verificationSeries)
  assert.equal(verificationSeries?.points[0]?.date, '2026-04-30T12:00:00.000Z')
  assert.deepEqual(verificationSeries?.points[0]?.tooltipModel.rows.map((row) => row.label), [
    'Series',
    'Value',
    'Actual',
    'Target',
    'Historical forecast',
    'Forecast origin',
    'Horizon',
    'Forecast error',
    'Target basis',
    'Model',
    'Interpretation',
  ])
  assert.equal(verificationSeries?.points[0]?.tooltipModel.rows.find((row) => row.label === 'Forecast origin')?.value, 'Jan 2026')
  assert.equal(verificationSeries?.points[0]?.tooltipModel.rows.find((row) => row.label === 'Target')?.value, 'Apr 2026')
  assert.equal(verificationSeries?.points[0]?.tooltipModel.rows.find((row) => row.label === 'Target basis')?.value, 'Monthly average')
})

test('verification ribbon splits positive-to-negative crossings into local signed segments', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResult([
      createRecord({
        forecastOrigin: '2026-01-01T00:00:00.000Z',
        forecastDate: '2026-04-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 90,
        delta: 10,
        deltaPct: 10 / 90,
        error: 10,
      }),
      createRecord({
        forecastOrigin: '2026-02-01T00:00:00.000Z',
        forecastDate: '2026-05-01T00:00:00.000Z',
        forecastValue: 102,
        actualValue: 101,
        delta: 1,
        deltaPct: 1 / 101,
        error: 1,
        absoluteError: 1,
      }),
      createRecord({
        forecastOrigin: '2026-03-01T00:00:00.000Z',
        forecastDate: '2026-06-01T00:00:00.000Z',
        forecastValue: 98,
        actualValue: 103,
        delta: -5,
        deltaPct: -5 / 103,
        error: -5,
        absoluteError: 5,
      }),
    ]),
    verificationHorizon: '3M',
  })

  assert.ok(payload)
  assert.deepEqual(payload?.deltaOverlays.map((overlay) => overlay.sign), ['above', 'above', 'below'])
  assert.equal(payload?.deltaOverlays[1]?.points[1]?.date, payload?.deltaOverlays[2]?.points[0]?.date)
})

test('verification layer fails closed when duplicate target periods exist', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'pl',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResult([
      createRecord({ forecastDate: '2026-04-01T00:00:00.000Z' }),
      createRecord({
        forecastOrigin: '2026-02-01T00:00:00.000Z',
        forecastDate: '2026-04-15T00:00:00.000Z',
        forecastValue: 101,
        actualValue: 91,
        delta: 10,
      }),
    ]),
    verificationHorizon: '3M',
  })

  assert.ok(payload)
  assert.equal(payload?.series.some((entry) => entry.kind === 'historical-forecast'), false)
  assert.deepEqual(payload?.deltaOverlays, [])
})

test('verification line preserves gaps instead of bridging missing months', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'pl',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResult([
      createRecord({ forecastDate: '2026-04-01T00:00:00.000Z' }),
      createRecord({
        forecastOrigin: '2026-02-01T00:00:00.000Z',
        forecastDate: '2026-05-01T00:00:00.000Z',
        forecastValue: 101,
        actualValue: 91,
        delta: 10,
      }),
      createRecord({
        forecastOrigin: '2026-04-01T00:00:00.000Z',
        forecastDate: '2026-07-01T00:00:00.000Z',
        forecastValue: 99,
        actualValue: 93,
        delta: 6,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')

  assert.ok(verificationSeries)
  assert.deepEqual(verificationSeries?.segments?.map((segment) => segment.map((point) => point.date)), [[
    '2026-04-30T12:00:00.000Z',
    '2026-05-31T12:00:00.000Z',
  ]])
})

test('end-of-period verification preserves observed-at provenance and explicit basis semantics', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-04-01T00:00:00.000Z',
        actualObservedAt: '2026-04-30T00:00:00.000Z',
      }),
    ]),
    verificationHorizon: '3M',
  })

  const monthlyActualSeries = payload?.series.find((entry) => entry.kind === 'monthly-actual')
  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')

  assert.equal(monthlyActualSeries?.label, 'End-of-period actual')
  assert.equal(monthlyActualSeries?.points[0]?.detailModel.sourceDate, '2026-04-30T00:00:00.000Z')
  assert.equal(verificationSeries?.points[0]?.tooltipModel.rows.find((row) => row.label === 'Target basis')?.value, 'End of period')
  assert.equal(verificationSeries?.points[0]?.tooltipModel.rows.find((row) => row.label === 'Actual observed at')?.value, 'Apr 30, 2026')
})

test('current forecast tooltip exposes selected target basis semantics', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'en',
    model: 'damped_holt',
    currentResult: createCurrentResult('END_OF_PERIOD'),
    verificationResult: null,
    verificationHorizon: '3M',
  })

  const currentSeries = payload?.series.find((entry) => entry.kind === 'forecast-central')

  assert.ok(currentSeries)
  assert.equal(currentSeries?.points[0]?.tooltipModel.rows.find((row) => row.label === 'Target basis')?.value, 'End of period')
})

test('forecast origin marker label stays locale-aware', () => {
  const englishPayload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'en',
    model: 'damped_holt',
    currentResult: createCurrentResult('MONTHLY_AVERAGE'),
    verificationResult: null,
    verificationHorizon: '3M',
  })

  const polishPayload = buildForecastPortfolioPayload({
    basePayload: createBasePayload(),
    locale: 'pl',
    model: 'damped_holt',
    currentResult: createCurrentResult('MONTHLY_AVERAGE'),
    verificationResult: null,
    verificationHorizon: '3M',
  })

  assert.equal(englishPayload?.forecastOrigin?.label, 'Forecast origin · Jul 2026')
  assert.equal(polishPayload?.forecastOrigin?.label, 'Forecast Origin · lip 2026')
})

test('point-in-time current path remains unchanged across verification horizon switches', () => {
  const currentResult = createExtendedPointInTimeCurrentResult()
  const verificationResult: BenchmarkForecastVerificationAvailableResult = {
    status: 'AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'damped_holt',
    targetBasis: 'POINT_IN_TIME',
    ...createIdentityFields('POINT_IN_TIME'),
    displayName: 'Brent, Spot, FOB North Sea',
    description: null,
    methodVersion: 'rolling-daily-point-in-time-v1',
    history: {
      frequency: 'DAILY',
      start: null,
      end: '2026-08-19',
      observations: 0,
    },
    forecastOrigin: '2026-08-19',
    verification: {
      '1M': { horizon: '1M', horizonSteps: 1, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [createRecord({ horizon: '1M', horizonSteps: 1, forecastDate: '2026-02-15T00:00:00.000Z', actualObservedAt: '2026-02-15T00:00:00.000Z' })] },
      '3M': { horizon: '3M', horizonSteps: 3, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [createRecord({ horizon: '3M', horizonSteps: 3, forecastDate: '2026-04-15T00:00:00.000Z', actualObservedAt: '2026-04-15T00:00:00.000Z' })] },
      '6M': { horizon: '6M', horizonSteps: 6, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [createRecord({ horizon: '6M', horizonSteps: 6, forecastDate: '2026-07-15T00:00:00.000Z', actualObservedAt: '2026-07-15T00:00:00.000Z' })] },
      '12M': { horizon: '12M', horizonSteps: 12, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [createRecord({ horizon: '12M', horizonSteps: 12, forecastDate: '2027-01-15T00:00:00.000Z', actualObservedAt: '2027-01-15T00:00:00.000Z' })] },
    },
  }

  const centralPointSets = ['1M', '3M', '6M', '12M'].map((verificationHorizon) => {
    const payload = buildForecastPortfolioPayload({
      basePayload: createBasePayloadWithHistorical([
        { date: '2026-08-15T00:00:00.000Z', value: 102 },
        { date: '2026-08-19T00:00:00.000Z', value: 104 },
      ]),
      locale: 'pl',
      model: 'damped_holt',
      currentResult,
      verificationResult,
      verificationHorizon,
    })

    return payload?.series.find((entry) => entry.kind === 'forecast-central')?.points.map((point) => point.date) ?? []
  })

  assert.deepEqual(centralPointSets[0], centralPointSets[1])
  assert.deepEqual(centralPointSets[1], centralPointSets[2])
  assert.deepEqual(centralPointSets[2], centralPointSets[3])
})

test('range presets keep full point-in-time future domain through the final +12M forecast date', () => {
  const historicalDates = [
    '2021-08-01T00:00:00.000Z',
    '2026-08-18T00:00:00.000Z',
  ]
  const forecastDates = [
    '2026-08-19T12:00:00.000Z',
    '2027-08-18T12:00:00.000Z',
  ]

  const oneYearRange = resolvePresetRange(historicalDates, forecastDates, '1Y')
  const fiveYearRange = resolvePresetRange(historicalDates, forecastDates, '5Y')
  const allRange = resolvePresetRange(historicalDates, forecastDates, 'ALL')

  assert.equal(oneYearRange?.end, '2027-08-18T12:00:00.000Z')
  assert.equal(fiveYearRange?.end, '2027-08-18T12:00:00.000Z')
  assert.equal(allRange?.end, '2027-08-18T12:00:00.000Z')
})

test('end-of-period ribbon follows daily historical actual observations instead of monthly straight interpolation', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-01-30T00:00:00.000Z', value: 95 },
      { date: '2026-02-02T00:00:00.000Z', value: 103 },
      { date: '2026-02-10T00:00:00.000Z', value: 98 },
      { date: '2026-02-27T00:00:00.000Z', value: 108 },
      { date: '2026-03-02T00:00:00.000Z', value: 105 },
      { date: '2026-03-31T00:00:00.000Z', value: 112 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-01-01T00:00:00.000Z',
        forecastOrigin: '2025-10-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 95,
        actualObservedAt: '2026-01-30T00:00:00.000Z',
      }),
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        forecastOrigin: '2025-11-01T00:00:00.000Z',
        forecastValue: 110,
        actualValue: 108,
        actualObservedAt: '2026-02-27T00:00:00.000Z',
        delta: 2,
        error: 2,
        absoluteError: 2,
        deltaPct: 2 / 108,
      }),
      createRecord({
        forecastDate: '2026-03-01T00:00:00.000Z',
        forecastOrigin: '2025-12-01T00:00:00.000Z',
        forecastValue: 104,
        actualValue: 112,
        actualObservedAt: '2026-03-31T00:00:00.000Z',
        delta: -8,
        error: -8,
        absoluteError: 8,
        deltaPct: -8 / 112,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const monthlyActualSeries = payload?.series.find((entry) => entry.kind === 'monthly-actual')
  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')
  const historicalSeries = payload?.series.find((entry) => entry.kind === 'historical')
  const overlayDates = payload?.deltaOverlays.flatMap((overlay) => overlay.points.map((point) => point.date)) ?? []

  assert.ok(monthlyActualSeries)
  assert.ok(verificationSeries)
  assert.ok(historicalSeries)
  assert.deepEqual(monthlyActualSeries?.points.map((point) => point.date), [
    '2026-01-30T00:00:00.000Z',
    '2026-02-27T00:00:00.000Z',
    '2026-03-31T00:00:00.000Z',
  ])
  assert.ok(monthlyActualSeries?.segments?.every((segment) => segment.length === 1))
  assert.ok(overlayDates.includes('2026-01-31T12:00:00.000Z'))
  assert.ok(overlayDates.includes('2026-02-28T12:00:00.000Z'))
  assert.ok(overlayDates.includes('2026-02-02T00:00:00.000Z'))
  assert.ok(overlayDates.includes('2026-02-10T00:00:00.000Z'))
  assert.ok(!overlayDates.includes('2026-01-30T00:00:00.000Z'))

  const forecastDiagnostics = summarizeBoundaryCoincidence(payload as TimeSeriesViewerPayload, 'forecast', verificationSeries?.points ?? [])
  const actualDiagnostics = summarizeBoundaryCoincidence(payload as TimeSeriesViewerPayload, 'actual', historicalSeries?.points ?? [])

  assert.equal(forecastDiagnostics.nonCoincident, 0)
  assert.equal(forecastDiagnostics.conflictingDuplicateX, 0)
  assert.equal(forecastDiagnostics.maxDifference, 0)
  assert.equal(actualDiagnostics.nonCoincident, 0)
  assert.equal(actualDiagnostics.conflictingDuplicateX, 0)
  assert.equal(actualDiagnostics.maxDifference, 0)
})

test('end-of-period control markers remain exact on non-month-end observed dates', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-02-27T00:00:00.000Z', value: 73.08 },
      { date: '2026-03-31T00:00:00.000Z', value: 103.46 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        actualObservedAt: '2026-02-27T00:00:00.000Z',
        actualValue: 73.08,
        forecastValue: 70,
        delta: -3.08,
        error: -3.08,
        absoluteError: 3.08,
        deltaPct: -3.08 / 73.08,
      }),
      createRecord({
        forecastDate: '2026-03-01T00:00:00.000Z',
        forecastOrigin: '2025-12-01T00:00:00.000Z',
        actualObservedAt: '2026-03-31T00:00:00.000Z',
        actualValue: 103.46,
        forecastValue: 101,
        delta: -2.46,
        error: -2.46,
        absoluteError: 2.46,
        deltaPct: -2.46 / 103.46,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const monthlyActualSeries = payload?.series.find((entry) => entry.kind === 'monthly-actual')

  assert.equal(monthlyActualSeries?.points[0]?.date, '2026-02-27T00:00:00.000Z')
  assert.equal(monthlyActualSeries?.points[0]?.value, 73.08)
  assert.equal(monthlyActualSeries?.points[0]?.detailModel.sourceDate, '2026-02-27T00:00:00.000Z')
})

test('end-of-period ribbon inserts local zero-width crossings when daily market path crosses forecast trajectory multiple times', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-02-02T00:00:00.000Z', value: 102 },
      { date: '2026-02-10T00:00:00.000Z', value: 108 },
      { date: '2026-02-18T00:00:00.000Z', value: 101 },
      { date: '2026-02-27T00:00:00.000Z', value: 111 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-01-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 95,
        actualObservedAt: '2026-01-30T00:00:00.000Z',
      }),
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        forecastValue: 110,
        actualValue: 111,
        actualObservedAt: '2026-02-27T00:00:00.000Z',
        delta: -1,
        error: -1,
        absoluteError: 1,
        deltaPct: -1 / 111,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const overlaySigns = payload?.deltaOverlays.map((overlay) => overlay.sign) ?? []
  const zeroWidthCrossings = (payload?.deltaOverlays ?? []).flatMap((overlay, index, collection) => {
    const next = collection[index + 1]

    if (!next) {
      return []
    }

    const leftEnd = overlay.points[1]
    const leftForecastEnd = overlay.points[2]
    const rightStart = next.points[0]
    const rightForecastStart = next.points[3]

    if (!leftEnd || !leftForecastEnd || !rightStart || !rightForecastStart) {
      return []
    }

    const sameBoundaryDate = leftEnd.date === rightStart.date && leftForecastEnd.date === rightForecastStart.date
    const actualWidth = Math.abs(leftEnd.value - leftForecastEnd.value)
    const nextActualWidth = Math.abs(rightStart.value - rightForecastStart.value)

    return sameBoundaryDate && actualWidth <= GEOMETRY_EPSILON && nextActualWidth <= GEOMETRY_EPSILON
      ? [leftEnd.date]
      : []
  })

  assert.ok(overlaySigns.length >= 3)
  assert.ok(overlaySigns.includes('above'))
  assert.ok(overlaySigns.includes('below'))
  assert.ok(zeroWidthCrossings.length > 0)
})

test('end-of-period ribbon uses only lawful observed daily points and does not invent weekend dates', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-02-27T00:00:00.000Z', value: 73.08 },
      { date: '2026-03-02T00:00:00.000Z', value: 77.89 },
      { date: '2026-03-31T00:00:00.000Z', value: 103.46 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        actualObservedAt: '2026-02-27T00:00:00.000Z',
        actualValue: 73.08,
        forecastValue: 80,
        delta: 6.92,
        error: 6.92,
        absoluteError: 6.92,
        deltaPct: 6.92 / 73.08,
      }),
      createRecord({
        forecastDate: '2026-03-01T00:00:00.000Z',
        actualObservedAt: '2026-03-31T00:00:00.000Z',
        actualValue: 103.46,
        forecastValue: 100,
        delta: -3.46,
        error: -3.46,
        absoluteError: 3.46,
        deltaPct: -3.46 / 103.46,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')
  const historicalSeries = payload?.series.find((entry) => entry.kind === 'historical')
  const overlayDates = new Set(payload?.deltaOverlays.flatMap((overlay) => overlay.points.map((point) => point.date)) ?? [])

  assert.ok(overlayDates.has('2026-02-28T12:00:00.000Z'))
  assert.ok(overlayDates.has('2026-03-02T00:00:00.000Z'))
  assert.ok(!overlayDates.has('2026-02-28T00:00:00.000Z'))
  assert.ok(!overlayDates.has('2026-03-01T00:00:00.000Z'))

  const forecastDiagnostics = summarizeBoundaryCoincidence(payload as TimeSeriesViewerPayload, 'forecast', verificationSeries?.points ?? [])
  const actualDiagnostics = summarizeBoundaryCoincidence(payload as TimeSeriesViewerPayload, 'actual', historicalSeries?.points ?? [])

  assert.equal(forecastDiagnostics.nonCoincident, 0)
  assert.equal(actualDiagnostics.nonCoincident, 0)
  assert.equal(forecastDiagnostics.conflictingDuplicateX, 0)
})

test('end-of-period ribbon forecast boundary stays on the visible historical forecast trajectory at control points and segment joints', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-01-30T00:00:00.000Z', value: 95 },
      { date: '2026-02-02T00:00:00.000Z', value: 103 },
      { date: '2026-02-10T00:00:00.000Z', value: 98 },
      { date: '2026-02-27T00:00:00.000Z', value: 108 },
      { date: '2026-03-02T00:00:00.000Z', value: 105 },
      { date: '2026-03-31T00:00:00.000Z', value: 112 },
      { date: '2026-04-02T00:00:00.000Z', value: 109 },
      { date: '2026-04-30T00:00:00.000Z', value: 107 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-01-01T00:00:00.000Z',
        forecastOrigin: '2025-10-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 95,
        actualObservedAt: '2026-01-30T00:00:00.000Z',
      }),
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        forecastOrigin: '2025-11-01T00:00:00.000Z',
        forecastValue: 110,
        actualValue: 108,
        actualObservedAt: '2026-02-27T00:00:00.000Z',
        delta: 2,
        error: 2,
        absoluteError: 2,
        deltaPct: 2 / 108,
      }),
      createRecord({
        forecastDate: '2026-03-01T00:00:00.000Z',
        forecastOrigin: '2025-12-01T00:00:00.000Z',
        forecastValue: 104,
        actualValue: 112,
        actualObservedAt: '2026-03-31T00:00:00.000Z',
        delta: -8,
        error: -8,
        absoluteError: 8,
        deltaPct: -8 / 112,
      }),
      createRecord({
        forecastDate: '2026-04-01T00:00:00.000Z',
        forecastOrigin: '2026-01-01T00:00:00.000Z',
        forecastValue: 106,
        actualValue: 107,
        actualObservedAt: '2026-04-30T00:00:00.000Z',
        delta: -1,
        error: -1,
        absoluteError: 1,
        deltaPct: -1 / 107,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')

  assert.ok(payload)
  assert.ok(verificationSeries)

  const diagnostics = summarizeBoundaryCoincidence(payload as TimeSeriesViewerPayload, 'forecast', verificationSeries?.points ?? [])

  assert.equal(diagnostics.nonCoincident, 0)
  assert.equal(diagnostics.conflictingDuplicateX, 0)
  assert.equal(diagnostics.maxDifference, 0)
})

test('end-of-period ribbon forecast boundary remains coincident with the visible forecast trajectory after range clipping', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-01-30T00:00:00.000Z', value: 95 },
      { date: '2026-02-02T00:00:00.000Z', value: 103 },
      { date: '2026-02-10T00:00:00.000Z', value: 98 },
      { date: '2026-02-27T00:00:00.000Z', value: 108 },
      { date: '2026-03-02T00:00:00.000Z', value: 105 },
      { date: '2026-03-31T00:00:00.000Z', value: 112 },
      { date: '2026-04-02T00:00:00.000Z', value: 109 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResultForTargetBasis('END_OF_PERIOD', [
      createRecord({
        forecastDate: '2026-01-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 95,
        actualObservedAt: '2026-01-30T00:00:00.000Z',
      }),
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        forecastValue: 110,
        actualValue: 108,
        actualObservedAt: '2026-02-27T00:00:00.000Z',
        delta: 2,
        error: 2,
        absoluteError: 2,
        deltaPct: 2 / 108,
      }),
      createRecord({
        forecastDate: '2026-03-01T00:00:00.000Z',
        forecastValue: 104,
        actualValue: 112,
        actualObservedAt: '2026-03-31T00:00:00.000Z',
        delta: -8,
        error: -8,
        absoluteError: 8,
        deltaPct: -8 / 112,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const verificationSeries = payload?.series.find((entry) => entry.kind === 'historical-forecast')
  const historicalSeries = payload?.series.find((entry) => entry.kind === 'historical')

  assert.ok(payload)
  assert.ok(verificationSeries)
  assert.ok(historicalSeries)

  const clippedPayload: TimeSeriesViewerPayload = {
    ...(payload as TimeSeriesViewerPayload),
    deltaOverlays: clipDeltaOverlaysToRange((payload as TimeSeriesViewerPayload).deltaOverlays, {
      start: '2026-02-15T00:00:00.000Z',
      end: '2026-03-15T00:00:00.000Z',
    }),
  }

  const forecastDiagnostics = summarizeBoundaryCoincidence(clippedPayload, 'forecast', verificationSeries?.points ?? [])
  const actualDiagnostics = summarizeBoundaryCoincidence(clippedPayload, 'actual', historicalSeries?.points ?? [])

  assert.equal(forecastDiagnostics.nonCoincident, 0)
  assert.equal(forecastDiagnostics.conflictingDuplicateX, 0)
  assert.equal(actualDiagnostics.nonCoincident, 0)
  assert.equal(actualDiagnostics.conflictingDuplicateX, 0)
})

test('monthly-average verification remains period-aware and does not reuse END_OF_PERIOD daily geometry', () => {
  const payload = buildForecastPortfolioPayload({
    basePayload: createBasePayloadWithHistorical([
      { date: '2026-02-02T00:00:00.000Z', value: 103 },
      { date: '2026-02-10T00:00:00.000Z', value: 98 },
      { date: '2026-02-27T00:00:00.000Z', value: 108 },
    ]),
    locale: 'en',
    model: 'damped_holt',
    currentResult: null,
    verificationResult: createVerificationResult([
      createRecord({
        forecastDate: '2026-01-01T00:00:00.000Z',
        forecastValue: 100,
        actualValue: 95,
      }),
      createRecord({
        forecastDate: '2026-02-01T00:00:00.000Z',
        forecastValue: 110,
        actualValue: 108,
        delta: 2,
        error: 2,
        absoluteError: 2,
        deltaPct: 2 / 108,
      }),
    ]),
    verificationHorizon: '3M',
  })

  const monthlyActualSeries = payload?.series.find((entry) => entry.kind === 'monthly-actual')
  const overlayDates = payload?.deltaOverlays.flatMap((overlay) => overlay.points.map((point) => point.date)) ?? []

  assert.deepEqual(monthlyActualSeries?.points.map((point) => point.date), [
    '2026-01-31T12:00:00.000Z',
    '2026-02-28T12:00:00.000Z',
  ])
  assert.ok(overlayDates.includes('2026-01-31T12:00:00.000Z'))
  assert.ok(overlayDates.includes('2026-02-28T12:00:00.000Z'))
  assert.ok(!overlayDates.includes('2026-02-10T00:00:00.000Z'))
})