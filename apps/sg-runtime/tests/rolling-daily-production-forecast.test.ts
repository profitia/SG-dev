import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ROLLING_DAILY_TARGET_BASIS,
  ROLLING_DAILY_INSUFFICIENT_TECHNICAL_TRAINING_REASON,
  ROLLING_DAILY_METHODOLOGICAL_CALIBRATION_MINIMUM_STATUS,
  ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
} from '../lib/forecast/rolling-daily-policy'
import {
  createRollingDailyProductionForecastService,
  ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION,
  type RollingDailyProductionForecastRepository,
} from '../lib/forecast/rolling-daily-production-forecast'
import {
  buildRollingDailyHistoryFingerprint,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  type RollingDailyCalibrationGroupArtifact,
  type RollingDailyMaintenanceStateArtifact,
} from '../lib/forecast/rolling-daily-maintenance'

function createCalibrationGroup(overrides: Partial<RollingDailyCalibrationGroupArtifact> = {}): RollingDailyCalibrationGroupArtifact {
  return {
    seriesId: 'wocaes0074',
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    horizonLabel: '1M',
    horizonMonths: 1,
    calibrationOriginAt: '2024-03-29',
    sampleCount: 25,
    residualP10: -2,
    residualP90: 3,
    quantileMethod: 'HF7_LINEAR_INTERPOLATION',
    status: 'AVAILABLE',
    lastResidualObservedAt: '2024-03-28',
    refreshedAt: '2024-03-29T00:00:00.000Z',
    ...overrides,
  }
}

function createMaintenanceState(overrides: Partial<RollingDailyMaintenanceStateArtifact> = {}): RollingDailyMaintenanceStateArtifact {
  return {
    seriesId: 'wocaes0074',
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    historicalOriginStartAt: '2024-01-01T00:00:00.000Z',
    minimumTrainingObservations: 60,
    minimumCalibrationSamples: 20,
    latestSourceObservationAt: '2024-03-28T00:00:00.000Z',
    latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
    latestSourceObservationCount: 64,
    latestSourceHistoryFingerprint: 'hist-1',
    lastProcessedOriginAt: '2024-03-28',
    lastMaturedObservedAt: '2024-03-28',
    lastMaintenanceAt: '2024-03-28T00:00:00.000Z',
    lastMaintenanceStatus: 'SUCCEEDED',
    lastFailureReason: null,
    ...overrides,
  }
}

function createRepository(overrides: {
  groups?: RollingDailyCalibrationGroupArtifact[]
  state?: RollingDailyMaintenanceStateArtifact | null
} = {}): RollingDailyProductionForecastRepository {
  return {
    async readCalibrationAuthority() {
      return {
        groups: overrides.groups ?? [
          createCalibrationGroup(),
          createCalibrationGroup({ horizonLabel: '3M', horizonMonths: 3, residualP10: -4, residualP90: 5 }),
          createCalibrationGroup({ horizonLabel: '6M', horizonMonths: 6, residualP10: -6, residualP90: 7 }),
          createCalibrationGroup({ horizonLabel: '12M', horizonMonths: 12, residualP10: -8, residualP90: 9 }),
        ],
        state: overrides.state ?? createMaintenanceState(),
      }
    },
  }
}

function createBenchmarkContext() {
  return {
    benchmark: {
      benchmarkId: 'wocaes0074',
      displayName: 'Brent, Spot, FOB North Sea',
      frequency: 'DAILY' as const,
      unit: 'USD/bbl',
      currency: 'USD',
      provider: 'macrobond',
      providerSeriesId: 'wocaes0074',
    },
    history: {
      seriesId: 'wocaes0074',
      displayName: 'Brent, Spot, FOB North Sea',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'DAILY',
      source: 'Macrobond',
      points: [
        { date: '2024-03-27', value: 100 },
        { date: '2024-03-28', value: 101 },
        { date: '2024-03-29', value: 102 },
      ],
    },
    sourceLatestObservationDate: '2024-03-29',
    sourceLatestObservationValue: 102,
  }
}

test('rolling daily production forecast maps current bridge output into the ETAP 10 contract', async () => {
  let runnerCallCount = 0
  let calibrationGroupsPassed = 0
  const requestedTargetBases: string[] = []
  const service = createRollingDailyProductionForecastService({
    repository: {
      async readCalibrationAuthority(identity) {
        requestedTargetBases.push(identity.targetBasis)
        return createRepository().readCalibrationAuthority(identity)
      },
    },
    loadBenchmarkContext: async () => createBenchmarkContext(),
    now: () => new Date('2024-03-29T12:00:00.000Z'),
    runner: {
      async run(request) {
        runnerCallCount += 1
        calibrationGroupsPassed = request.calibrationGroups.length
        return {
          status: 'AVAILABLE',
          reason: undefined,
          methodId: ROLLING_DAILY_METHOD_ID,
          methodVersion: ROLLING_DAILY_METHOD_VERSION,
          modelId: 'naive',
          sourceHistory: {
            startDate: '2024-01-01',
            latestObservationDate: '2024-03-29',
            observationCount: 64,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
          },
          currentForecast: {
            originDate: '2024-03-29',
            calendarProjectionMode: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
            maxHorizonMonths: 12,
            selectedCandidate: 'NAIVE_LAST_VALUE',
            selectionMetric: null,
            selectionScore: null,
            selectedParameters: null,
            path: [
              {
                date: '2024-03-30',
                pointForecast: 102,
                lowerP10: null,
                upperP90: null,
                bandStatus: 'NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR',
                bandSource: null,
                p10ResidualOffset: null,
                p90ResidualOffset: null,
              },
              {
                date: '2024-04-29',
                pointForecast: 103,
                lowerP10: 101,
                upperP90: 106,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -2,
                p90ResidualOffset: 3,
              },
              {
                date: '2024-05-15',
                pointForecast: 104,
                lowerP10: 101,
                upperP90: 108,
                bandStatus: 'AVAILABLE',
                bandSource: 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS',
                p10ResidualOffset: -3,
                p90ResidualOffset: 4,
              },
              {
                date: '2024-06-29',
                pointForecast: 105,
                lowerP10: 101,
                upperP90: 110,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -4,
                p90ResidualOffset: 5,
              },
              {
                date: '2024-09-29',
                pointForecast: 106,
                lowerP10: 100,
                upperP90: 113,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -6,
                p90ResidualOffset: 7,
              },
              {
                date: '2025-03-29',
                pointForecast: 107,
                lowerP10: 99,
                upperP90: 116,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -8,
                p90ResidualOffset: 9,
              },
            ],
            anchors: [
              {
                horizon: '1M',
                horizonMonths: 1,
                targetCalendarDate: '2024-04-29',
                projectedStepCount: 21,
                pointForecast: 103,
                lowerP10: 101,
                upperP90: 106,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -2,
                p90ResidualOffset: 3,
              },
              {
                horizon: '3M',
                horizonMonths: 3,
                targetCalendarDate: '2024-06-29',
                projectedStepCount: 64,
                pointForecast: 105,
                lowerP10: 101,
                upperP90: 110,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -4,
                p90ResidualOffset: 5,
              },
              {
                horizon: '6M',
                horizonMonths: 6,
                targetCalendarDate: '2024-09-29',
                projectedStepCount: 128,
                pointForecast: 106,
                lowerP10: 100,
                upperP90: 113,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -6,
                p90ResidualOffset: 7,
              },
              {
                horizon: '12M',
                horizonMonths: 12,
                targetCalendarDate: '2025-03-29',
                projectedStepCount: 256,
                pointForecast: 107,
                lowerP10: 99,
                upperP90: 116,
                bandStatus: 'AVAILABLE',
                bandSource: 'EMPIRICAL_ANCHOR',
                p10ResidualOffset: -8,
                p90ResidualOffset: 9,
              },
            ],
          },
        }
      },
    },
  })

  const result = await service.getRollingDailyProductionForecast({
    seriesId: 'wocaes0074',
    modelId: 'naive',
  })

  assert.equal(runnerCallCount, 1)
  assert.deepEqual(requestedTargetBases, [ROLLING_DAILY_TARGET_BASIS])
  assert.equal(calibrationGroupsPassed, 4)
  assert.equal(result.contractVersion, ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION)
  assert.equal(result.status, 'AVAILABLE')
  if (result.status !== 'AVAILABLE') {
    throw new Error('Expected AVAILABLE result.')
  }

  assert.equal(result.benchmark.provider, 'macrobond')
  assert.equal(result.forecastMethod.version, ROLLING_DAILY_METHOD_VERSION)
  assert.equal(result.origin.date, '2024-03-29')
  assert.equal(result.origin.value, 102)
  assert.equal(result.path[0]?.band.status, 'NOT_AVAILABLE')
  assert.equal(result.path[0]?.band.reasonCode, 'BEFORE_FIRST_EMPIRICAL_ANCHOR')
  assert.equal(result.path[2]?.band.source, 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS')
  assert.equal(result.anchors[0]?.band.sampleCount, 25)
  assert.equal(result.anchors[3]?.targetCalendarDate, result.path[result.path.length - 1]?.date)
  assert.equal(result.calibration.freshnessStatus, 'STALE')
  assert.equal(result.calibration.methodologicalMinimumStatus, ROLLING_DAILY_METHODOLOGICAL_CALIBRATION_MINIMUM_STATUS)
  assert.equal(result.audit.projectionCalendarStrategy, ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY)
  assert.ok(result.audit.sourceHistoryFingerprint)
  assert.equal(result.warnings[0]?.code, 'CALIBRATION_STALE')
})

test('rolling daily production forecast serves naive current from prepared history without bridge runner', async () => {
  let runnerCallCount = 0

  const service = createRollingDailyProductionForecastService({
    repository: createRepository(),
    loadBenchmarkContext: async () => {
      throw new Error('prepared history should avoid market-data reload')
    },
    now: () => new Date('2024-03-29T12:00:00.000Z'),
    runner: {
      async run() {
        runnerCallCount += 1
        throw new Error('naive prepared history should not call the bridge runner')
      },
    },
  })

  const result = await service.getRollingDailyProductionForecast({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    minimumTrainingObservations: 2,
    preparedHistory: createBenchmarkContext().history,
  })

  assert.equal(runnerCallCount, 0)
  assert.equal(result.status, 'AVAILABLE')
  if (result.status !== 'AVAILABLE') {
    throw new Error('Expected AVAILABLE result.')
  }

  assert.equal(result.origin.date, '2024-03-29')
  assert.equal(result.origin.value, 102)
  assert.equal(result.model.selectedCandidate, 'NAIVE_LAST_VALUE')
  assert.deepEqual(result.model.selectedParameters, {})
  assert.equal(result.path[0]?.pointForecast, 102)
  assert.equal(result.path[0]?.band.status, 'AVAILABLE')
  assert.equal(result.path[0]?.band.source, 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS')
  assert.equal(result.anchors[0]?.pointForecast, 102)
  assert.equal(result.anchors[0]?.band.status, 'AVAILABLE')
  assert.equal(result.audit.sourceHistoryFingerprint, buildRollingDailyHistoryFingerprint(createBenchmarkContext().history))
})

test('rolling daily production forecast maps unavailable bridge states without fabricating bands', async () => {
  const service = createRollingDailyProductionForecastService({
    repository: createRepository({ groups: [], state: null }),
    loadBenchmarkContext: async () => createBenchmarkContext(),
    now: () => new Date('2024-03-29T12:00:00.000Z'),
    runner: {
      async run() {
        return {
          status: 'INSUFFICIENT_HISTORY',
          reason: 'INSUFFICIENT_HISTORY: 3 observations remain after filtering.',
          methodId: ROLLING_DAILY_METHOD_ID,
          methodVersion: ROLLING_DAILY_METHOD_VERSION,
          modelId: 'naive',
          sourceHistory: {
            startDate: '2024-03-27',
            latestObservationDate: '2024-03-29',
            observationCount: 3,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
          },
          currentForecast: {
            originDate: '2024-03-29',
            calendarProjectionMode: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
            maxHorizonMonths: 12,
            selectedCandidate: null,
            selectionMetric: null,
            selectionScore: null,
            selectedParameters: null,
            path: [],
            anchors: [],
          },
        }
      },
    },
  })

  const result = await service.getRollingDailyProductionForecast({
    seriesId: 'wocaes0074',
    modelId: 'naive',
  })

  assert.equal(result.contractVersion, ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION)
  assert.equal(result.status, 'NOT_AVAILABLE')

  assert.equal(result.reasonCode, ROLLING_DAILY_INSUFFICIENT_TECHNICAL_TRAINING_REASON)
  assert.equal(result.model.selectedCandidate, null)
  assert.equal(result.model.selectedParameters, null)
  assert.equal(result.audit.sourceLatestObservationDate, '2024-03-29')
  assert.ok(result.audit.sourceHistoryFingerprint)
})