import assert from 'node:assert/strict'
import test from 'node:test'

import { ROLLING_DAILY_METHOD_VERSION, ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY } from '../lib/forecast/rolling-daily-policy'
import { createProductionForecastRouter } from '../lib/forecast/production-routing'

test('production forecast router sends ROLLING_DAILY_POINT_IN_TIME to the rolling-daily adapter', async () => {
  let monthlyCalls = 0
  let rollingDailyCalls = 0

  const router = createProductionForecastRouter({
    async resolveMonthlyForecast() {
      monthlyCalls += 1
      throw new Error('Monthly forecast resolver should not be called for rolling daily.')
    },
    async resolveRollingDailyForecast(input) {
      rollingDailyCalls += 1
      assert.equal(input.seriesId, 'wocaes0074')
      assert.equal(input.modelId, 'arima')
      return {
        contractVersion: '1',
        status: 'AVAILABLE',
        benchmark: {
          benchmarkId: 'wocaes0074',
          displayName: 'Brent',
          frequency: 'DAILY',
          unit: 'USD/bbl',
          currency: 'USD',
          provider: 'macrobond',
          providerSeriesId: 'wocaes0074',
        },
        forecastMethod: {
          id: 'ROLLING_DAILY_POINT_IN_TIME',
          version: ROLLING_DAILY_METHOD_VERSION,
        },
        model: {
          id: 'arima',
          selectedCandidate: 'ARIMA(2,1,2)',
          selectionMetric: 'AICc',
          selectionScore: 123.45,
          selectedParameters: {
            order: [2, 1, 2],
          },
        },
        origin: {
          date: '2026-08-18',
          value: 89.9,
        },
        maxHorizonMonths: 12,
        anchors: [],
        path: [{
          date: '2026-08-19',
          pointForecast: 89.9,
          band: {
            status: 'NOT_AVAILABLE',
            reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
            source: null,
            lower: null,
            upper: null,
          },
        }],
        calibration: {
          availabilityStatus: 'AVAILABLE',
          freshnessStatus: 'FRESH',
          quantileConvention: 'HF7_LINEAR_INTERPOLATION',
          coverageLabel: '80% empirical prediction band',
            methodologicalMinimumStatus: 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',
          updatedAt: '2026-08-18T00:00:00.000Z',
          processedThrough: '2026-08-18',
          lastResidualAvailabilityDate: '2026-08-18',
        },
        audit: {
          sourceHistoryFingerprint: 'fingerprint-1',
          generatedAt: '2026-08-18T12:00:00.000Z',
          sourceLatestObservationDate: '2026-08-18',
          calendarProjectionMode: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
          projectionCalendarStrategy: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
          technicalMinimumTrainingObservations: 60,
          methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
          calibrationUpdatedAt: '2026-08-18T00:00:00.000Z',
          calibrationLastResidualAvailabilityDate: '2026-08-18',
          inputSource: 'DYNAMIC_MARKET_DATA_STORE',
        },
        warnings: [],
      }
    },
  })

  const result = await router.resolveProductionForecast({
    seriesId: 'wocaes0074',
    modelId: 'arima',
    forecastMethod: 'ROLLING_DAILY_POINT_IN_TIME',
  })

  assert.equal(monthlyCalls, 0)
  assert.equal(rollingDailyCalls, 1)
  assert.equal(result.productionMethod, 'ROLLING_DAILY_POINT_IN_TIME')
  if (result.productionMethod !== 'ROLLING_DAILY_POINT_IN_TIME') {
    throw new Error('Expected rolling-daily production result.')
  }
  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.forecastMethod.version, ROLLING_DAILY_METHOD_VERSION)
})

test('production forecast router keeps legacy monthly path unchanged for MONTHLY_AVERAGE', async () => {
  let monthlyCalls = 0
  let rollingDailyCalls = 0

  const router = createProductionForecastRouter({
    async resolveMonthlyForecast(input) {
      monthlyCalls += 1
      assert.equal(input.targetBasis, 'MONTHLY_AVERAGE')
      return {
        status: 'UNSUPPORTED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        targetSemantics: 'MONTHLY_AVERAGE',
        methodId: 'MONTHLY_AVERAGE',
        reason: 'Monthly implementation remains unchanged.',
        supportedSeriesIds: [input.seriesId],
        supportedModels: ['naive', 'damped_holt', 'ets'],
      }
    },
    async resolveRollingDailyForecast() {
      rollingDailyCalls += 1
      throw new Error('Rolling-daily adapter should not be called for monthly basis.')
    },
  })

  const result = await router.resolveProductionForecast({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    forecastMethod: 'MONTHLY_AVERAGE',
  })

  assert.equal(monthlyCalls, 1)
  assert.equal(rollingDailyCalls, 0)
  assert.equal(result.productionMethod, 'MONTHLY_AVERAGE')
  assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(result.status, 'UNSUPPORTED')
})

test('production forecast router rejects unsupported method values without fallback', async () => {
  let monthlyCalls = 0
  let rollingDailyCalls = 0

  const router = createProductionForecastRouter({
    async resolveMonthlyForecast() {
      monthlyCalls += 1
      throw new Error('Monthly resolver should not be called for unsupported methods.')
    },
    async resolveRollingDailyForecast() {
      rollingDailyCalls += 1
      throw new Error('Rolling-daily resolver should not be called for unsupported methods.')
    },
  })

  const result = await router.resolveProductionForecast({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    forecastMethod: 'UNKNOWN_METHOD',
  })

  assert.equal(monthlyCalls, 0)
  assert.equal(rollingDailyCalls, 0)
  assert.equal(result.status, 'UNSUPPORTED')
  assert.match(result.reason, /UNKNOWN_METHOD/)
  assert.deepEqual(result.supportedModels, ['naive', 'damped_holt', 'ets', 'arima'])
})