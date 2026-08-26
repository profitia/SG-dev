import assert from 'node:assert/strict'
import test from 'node:test'

import {
  persistRollingDailyCurrentForecastSnapshot,
  readRollingDailyCurrentForecastSnapshot,
} from '../lib/forecast/rolling-daily-current-forecast-snapshot'

test('rolling-daily current snapshot persistence upserts the canonical payload and preserves storage parity', async () => {
  let capturedUpsertArgs: Record<string, unknown> | null = null

  const result = await persistRollingDailyCurrentForecastSnapshot(
    {
      seriesId: 'wocaes0074',
      modelId: 'ets',
    },
    {
      prisma: {
        rollingDailyCurrentForecastSnapshot: {
          async upsert(args: Record<string, unknown>) {
            capturedUpsertArgs = args
            return {
              payloadJson: (args.create as { payloadJson: unknown }).payloadJson,
            }
          },
        },
      } as never,
      resolveProductionForecast: async () => ({
        productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
        contractVersion: '1',
        status: 'AVAILABLE',
        benchmark: {
          benchmarkId: 'wocaes0074',
          displayName: 'Brent, Spot, FOB North Sea',
          frequency: 'DAILY',
          unit: 'USD/bbl',
          currency: 'USD',
          provider: 'macrobond',
          providerSeriesId: 'wocaes0074',
        },
        forecastMethod: {
          id: 'ROLLING_DAILY_POINT_IN_TIME',
          version: 'rolling-daily-point-in-time-v1',
        },
        model: {
          id: 'ets',
          selectedCandidate: 'ETS_AUTO',
          selectionMetric: null,
          selectionScore: null,
          selectedParameters: null,
        },
        origin: {
          date: '2026-08-19',
          value: 72.5,
        },
        maxHorizonMonths: 12,
        anchors: [
          {
            horizon: '1M',
            horizonMonths: 1,
            targetCalendarDate: '2026-09-19',
            pointForecast: 73,
            band: {
              status: 'AVAILABLE',
              reasonCode: null,
              source: 'EMPIRICAL_ANCHOR',
              lower: 70,
              upper: 75,
              sampleCount: 25,
              p10ResidualOffset: -3,
              p90ResidualOffset: 2,
            },
          },
          {
            horizon: '3M',
            horizonMonths: 3,
            targetCalendarDate: '2026-11-19',
            pointForecast: 74,
            band: {
              status: 'AVAILABLE',
              reasonCode: null,
              source: 'EMPIRICAL_ANCHOR',
              lower: 69,
              upper: 77,
              sampleCount: 25,
              p10ResidualOffset: -4,
              p90ResidualOffset: 3,
            },
          },
          {
            horizon: '6M',
            horizonMonths: 6,
            targetCalendarDate: '2027-02-19',
            pointForecast: 75,
            band: {
              status: 'AVAILABLE',
              reasonCode: null,
              source: 'EMPIRICAL_ANCHOR',
              lower: 68,
              upper: 79,
              sampleCount: 25,
              p10ResidualOffset: -5,
              p90ResidualOffset: 4,
            },
          },
          {
            horizon: '12M',
            horizonMonths: 12,
            targetCalendarDate: '2027-08-19',
            pointForecast: 76,
            band: {
              status: 'AVAILABLE',
              reasonCode: null,
              source: 'EMPIRICAL_ANCHOR',
              lower: 67,
              upper: 81,
              sampleCount: 25,
              p10ResidualOffset: -6,
              p90ResidualOffset: 5,
            },
          },
        ],
        path: [
          {
            date: '2026-08-20',
            pointForecast: 72.8,
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
            pointForecast: 73,
            band: {
              status: 'AVAILABLE',
              reasonCode: null,
              source: 'EMPIRICAL_ANCHOR',
              lower: 70,
              upper: 75,
            },
          },
          {
            date: '2027-08-19',
            pointForecast: 76,
            band: {
              status: 'AVAILABLE',
              reasonCode: null,
              source: 'EMPIRICAL_ANCHOR',
              lower: 67,
              upper: 81,
            },
          },
        ],
        calibration: {
          availabilityStatus: 'AVAILABLE',
          freshnessStatus: 'FRESH',
          quantileConvention: 'HF7_LINEAR_INTERPOLATION',
          coverageLabel: '80% empirical prediction band',
          methodologicalMinimumStatus: 'MET',
          updatedAt: '2026-08-20T00:00:00.000Z',
          processedThrough: '2026-08-19',
          lastResidualAvailabilityDate: '2026-08-19',
        },
        audit: {
          generatedAt: '2026-08-20T00:00:00.000Z',
          sourceLatestObservationDate: '2026-08-19',
          calendarProjectionMode: 'CALENDAR_MONTH_CLAMP',
          projectionCalendarStrategy: 'CALENDAR_MONTH_CLAMP',
          technicalMinimumTrainingObservations: 60,
          methodologicalTrainingEligibilityStatus: 'ELIGIBLE',
          calibrationUpdatedAt: '2026-08-20T00:00:00.000Z',
          calibrationLastResidualAvailabilityDate: '2026-08-19',
          inputSource: 'DYNAMIC_MARKET_DATA_STORE',
          sourceHistoryFingerprint: 'history-fingerprint-v1',
        },
        warnings: [],
      }),
    },
  )

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.parityStatus, 'MATCHED')
  assert.equal(result.targetSemantics, 'ROLLING_DAILY_POINT_IN_TIME')
  assert.ok(capturedUpsertArgs)

  const createArgs = (capturedUpsertArgs as { create: Record<string, unknown> }).create
  assert.equal(createArgs.seriesId, 'wocaes0074')
  assert.equal(createArgs.targetBasis, 'POINT_IN_TIME')
  assert.equal(createArgs.methodId, 'ROLLING_DAILY_POINT_IN_TIME')
  assert.equal(createArgs.modelId, 'ets')
})

test('rolling-daily current snapshot supports arima and prepared read returns the stored canonical payload without refit', async () => {
  let resolveCalls = 0
  let storedPayload: unknown = null

  await persistRollingDailyCurrentForecastSnapshot(
    {
      seriesId: 'wocaes0074',
      modelId: 'arima',
    },
    {
      prisma: {
        rollingDailyCurrentForecastSnapshot: {
          async upsert(args: Record<string, unknown>) {
            storedPayload = (args.create as { payloadJson: unknown }).payloadJson
            return { payloadJson: storedPayload }
          },
          async findUnique() {
            return storedPayload === null ? null : { payloadJson: storedPayload }
          },
        },
      } as never,
      resolveProductionForecast: async () => {
        resolveCalls += 1
        return {
          productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
          contractVersion: '1',
          status: 'AVAILABLE',
          benchmark: {
            benchmarkId: 'wocaes0074',
            displayName: 'Brent, Spot, FOB North Sea',
            frequency: 'DAILY',
            unit: 'USD/bbl',
            currency: 'USD',
            provider: 'macrobond',
            providerSeriesId: 'wocaes0074',
          },
          forecastMethod: {
            id: 'ROLLING_DAILY_POINT_IN_TIME',
            version: 'rolling-daily-point-in-time-v1',
          },
          model: {
            id: 'arima',
            selectedCandidate: 'ARIMA(2,1,2)',
            selectionMetric: 'AICc',
            selectionScore: 33370.94305202132,
            selectedParameters: {
              order: [2, 1, 2],
              trend: 't',
              policyIdentity: 'ARIMA_NON_SEASONAL_BOUNDED_AICC_V1',
            },
          },
          origin: {
            date: '2026-08-18',
            value: 90.1,
          },
          maxHorizonMonths: 12,
          anchors: [
            { horizon: '1M', horizonMonths: 1, targetCalendarDate: '2026-09-18', pointForecast: 90.3, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
            { horizon: '3M', horizonMonths: 3, targetCalendarDate: '2026-11-18', pointForecast: 90.5, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
            { horizon: '6M', horizonMonths: 6, targetCalendarDate: '2027-02-18', pointForecast: 90.9, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
            { horizon: '12M', horizonMonths: 12, targetCalendarDate: '2027-08-18', pointForecast: 91.7, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
          ],
          path: [
            { date: '2026-08-19', pointForecast: 90.1, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null } },
            { date: '2027-08-18', pointForecast: 91.7, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null } },
          ],
          calibration: {
            availabilityStatus: 'NOT_AVAILABLE',
            freshnessStatus: null,
            quantileConvention: 'HF7_LINEAR_INTERPOLATION',
            coverageLabel: '80% empirical prediction band',
            methodologicalMinimumStatus: 'OPEN',
            updatedAt: null,
            processedThrough: null,
            lastResidualAvailabilityDate: null,
          },
          audit: {
            generatedAt: '2026-08-20T00:00:00.000Z',
            sourceLatestObservationDate: '2026-08-18',
            calendarProjectionMode: 'CALENDAR_MONTH_CLAMP',
            projectionCalendarStrategy: 'CALENDAR_MONTH_CLAMP',
            technicalMinimumTrainingObservations: 60,
            methodologicalTrainingEligibilityStatus: 'ELIGIBLE',
            calibrationUpdatedAt: null,
            calibrationLastResidualAvailabilityDate: null,
            inputSource: 'DYNAMIC_MARKET_DATA_STORE',
            sourceHistoryFingerprint: 'history-fingerprint-v2',
          },
          warnings: [],
        }
      },
    },
  )

  const readResult = await readRollingDailyCurrentForecastSnapshot(
    {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      sourceHistoryFingerprint: 'history-fingerprint-v2',
    },
    {
      prisma: {
        rollingDailyCurrentForecastSnapshot: {
          async findUnique() {
            return storedPayload === null ? null : { payloadJson: storedPayload }
          },
        },
      } as never,
    },
  )

  assert.equal(resolveCalls, 1)
  assert.equal(readResult.status, 'HIT')
  if (readResult.status !== 'HIT') throw new Error('Expected HIT.')
  assert.equal(readResult.payload.model.id, 'arima')
  assert.equal(readResult.payload.model.selectedCandidate, 'ARIMA(2,1,2)')
  assert.deepEqual(readResult.payload.model.selectedParameters, {
    order: [2, 1, 2],
    trend: 't',
    policyIdentity: 'ARIMA_NON_SEASONAL_BOUNDED_AICC_V1',
  })
})

test('rolling-daily current snapshot detects source fingerprint drift and marks the prepared payload stale', async () => {
  const readResult = await readRollingDailyCurrentForecastSnapshot(
    {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      sourceHistoryFingerprint: 'different-history-fingerprint',
    },
    {
      prisma: {
        rollingDailyCurrentForecastSnapshot: {
          async findUnique() {
            return {
              payloadJson: {
                contractVersion: '1',
                status: 'AVAILABLE',
                benchmark: {
                  benchmarkId: 'wocaes0074',
                  displayName: 'Brent, Spot, FOB North Sea',
                  frequency: 'DAILY',
                  unit: 'USD/bbl',
                  currency: 'USD',
                  provider: 'macrobond',
                  providerSeriesId: 'wocaes0074',
                },
                forecastMethod: {
                  id: 'ROLLING_DAILY_POINT_IN_TIME',
                  version: 'rolling-daily-point-in-time-v1',
                },
                model: {
                  id: 'arima',
                  selectedCandidate: 'ARIMA(2,1,2)',
                  selectionMetric: 'AICc',
                  selectionScore: 33370.94305202132,
                  selectedParameters: null,
                },
                origin: {
                  date: '2026-08-18',
                  value: 90.1,
                },
                maxHorizonMonths: 12,
                anchors: [
                  { horizon: '1M', horizonMonths: 1, targetCalendarDate: '2026-09-18', pointForecast: 90.3, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
                  { horizon: '3M', horizonMonths: 3, targetCalendarDate: '2026-11-18', pointForecast: 90.5, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
                  { horizon: '6M', horizonMonths: 6, targetCalendarDate: '2027-02-18', pointForecast: 90.9, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
                  { horizon: '12M', horizonMonths: 12, targetCalendarDate: '2027-08-18', pointForecast: 91.7, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null, p10ResidualOffset: null, p90ResidualOffset: null } },
                ],
                path: [
                  { date: '2026-08-19', pointForecast: 90.1, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null } },
                  { date: '2027-08-18', pointForecast: 91.7, band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null } },
                ],
                calibration: {
                  availabilityStatus: 'NOT_AVAILABLE',
                  freshnessStatus: null,
                  quantileConvention: 'HF7_LINEAR_INTERPOLATION',
                  coverageLabel: '80% empirical prediction band',
                  methodologicalMinimumStatus: 'OPEN',
                  updatedAt: null,
                  processedThrough: null,
                  lastResidualAvailabilityDate: null,
                },
                audit: {
                  generatedAt: '2026-08-20T00:00:00.000Z',
                  sourceLatestObservationDate: '2026-08-18',
                  calendarProjectionMode: 'CALENDAR_MONTH_CLAMP',
                  projectionCalendarStrategy: 'CALENDAR_MONTH_CLAMP',
                  technicalMinimumTrainingObservations: 60,
                  methodologicalTrainingEligibilityStatus: 'ELIGIBLE',
                  calibrationUpdatedAt: null,
                  calibrationLastResidualAvailabilityDate: null,
                  inputSource: 'DYNAMIC_MARKET_DATA_STORE',
                  sourceHistoryFingerprint: 'history-fingerprint-v2',
                },
                warnings: [],
              },
            }
          },
        },
      } as never,
    },
  )

  assert.equal(readResult.status, 'STALE')
  if (readResult.status !== 'STALE') throw new Error('Expected STALE.')
  assert.equal(readResult.reason, 'SOURCE_HISTORY_FINGERPRINT_MISMATCH')
})