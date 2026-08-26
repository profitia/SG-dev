import assert from 'node:assert/strict'
import test from 'node:test'

import { ROLLING_DAILY_TARGET_BASIS } from '../lib/forecast/rolling-daily-policy'
import {
  buildRollingDailyHistoryFingerprint,
  createRollingDailyMaintenanceService,
  DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE,
  normalizePersistedRollingDailyArtifacts,
  ROLLING_DAILY_REBUILD_REQUIRED_REASON,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  type RollingDailyCalibrationGroupArtifact,
  type RollingDailyMaintenanceRepository,
  type RollingDailyMaintenanceRunner,
  type RollingDailyMaintenanceStateArtifact,
  type RollingDailyVerificationRecordArtifact,
} from '../lib/forecast/rolling-daily-maintenance'

function createHistory() {
  return {
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'Macrobond',
    points: [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 101 },
      { date: '2024-01-03', value: 102 },
      { date: '2024-01-04', value: 103 },
      { date: '2024-01-05', value: 104 },
    ],
  }
}

function createHistoryFingerprint(points = createHistory().points) {
  return buildRollingDailyHistoryFingerprint({
    ...createHistory(),
    points,
  })
}

function createVerificationRecord(overrides: Partial<RollingDailyVerificationRecordArtifact> = {}): RollingDailyVerificationRecordArtifact {
  return {
    seriesId: 'wocaes0074',
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    forecastOriginAt: '2024-01-05',
    horizonLabel: '1M',
    horizonMonths: 1,
    horizonSteps: 21,
    targetCalendarDate: '2024-02-05',
    verificationObservedAt: null,
    maturityStatus: 'NOT_YET_MATURED',
    originValue: 104,
    forecastValue: 104,
    actualValue: null,
    errorValue: null,
    absoluteErrorValue: null,
    deltaValue: null,
    deltaPct: null,
    residualValue: null,
    maseScale: 1,
    trainingHistoryStartAt: '2024-01-01',
    trainingHistoryEndAt: '2024-01-05',
    trainingObservationCount: 5,
    sourceHistoryFingerprint: 'hist-1',
    metadata: {
      modelFamily: 'naive',
      selectedVariant: 'NAIVE_LAST_VALUE',
      selectedParameters: {},
      fitStatus: 'SUCCEEDED',
    },
    selectedVariant: 'NAIVE_LAST_VALUE',
    selectionMetric: null,
    selectionScore: null,
    ...overrides,
  }
}

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
    calibrationOriginAt: '2024-01-05',
    sampleCount: 1,
    residualP10: null,
    residualP90: null,
    quantileMethod: 'HF7_LINEAR_INTERPOLATION',
    status: 'INSUFFICIENT_CALIBRATION_HISTORY',
    lastResidualObservedAt: null,
    refreshedAt: '2024-01-05',
    ...overrides,
  }
}

test('rolling daily maintenance persists incremental updates and forwards the last processed origin', async () => {
  const persistedUpdates: Array<{
    newRecords: RollingDailyVerificationRecordArtifact[]
    maturedRecords: RollingDailyVerificationRecordArtifact[]
    calibrationGroups: RollingDailyCalibrationGroupArtifact[]
    state: string | null
  }> = []
  const requestedTargetBases: string[] = []

  const repository: RollingDailyMaintenanceRepository = {
    async readState(): Promise<RollingDailyMaintenanceStateArtifact | null> {
      requestedTargetBases.push(ROLLING_DAILY_TARGET_BASIS)
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: `${DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE}T00:00:00.000Z`,
        minimumTrainingObservations: 5,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-04T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 4,
        latestSourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)),
        lastProcessedOriginAt: '2024-01-04',
        lastMaturedObservedAt: null,
        lastMaintenanceAt: '2024-01-04T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return [createVerificationRecord({ forecastOriginAt: '2024-01-04', sourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)) })]
    },
    async applyMaintenanceUpdate(input) {
      persistedUpdates.push({
        newRecords: input.newRecords,
        maturedRecords: input.maturedRecords,
        calibrationGroups: input.calibrationGroups,
        state: input.lastProcessedOriginAt,
      })
    },
    async recordMaintenanceFailure() {
      throw new Error('recordMaintenanceFailure should not be called on success')
    },
  }

  let runnerRequestLastProcessedOrigin: string | null = null
  const runner: RollingDailyMaintenanceRunner = {
    async run(request) {
      runnerRequestLastProcessedOrigin = request.lastProcessedOriginDate
      return {
        status: 'AVAILABLE',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: 'hist-1',
        },
        maintenance: {
          newOriginCount: 1,
          maturedRecordCount: 1,
          affectedCalibrationGroupCount: 1,
          calibrationRefreshCount: 1,
          lastProcessedOriginDate: '2024-01-05',
          lastMaturedObservedAt: '2024-01-05',
          newOriginDates: ['2024-01-05'],
        },
        newRecords: [createVerificationRecord()],
        maturedRecords: [createVerificationRecord({ forecastOriginAt: '2024-01-04', verificationObservedAt: '2024-01-05', maturityStatus: 'MATURED', actualValue: 104, errorValue: 0, absoluteErrorValue: 0, deltaValue: 0, residualValue: 0 })],
        calibrationGroups: [createCalibrationGroup()],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    now: () => new Date('2024-01-05T00:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.runIncrementalMaintenance({
    seriesId: 'wocaes0074',
    modelId: 'naive',
  })

  assert.equal(runnerRequestLastProcessedOrigin, '2024-01-04')
  assert.deepEqual(requestedTargetBases, [ROLLING_DAILY_TARGET_BASIS])
  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(result.reasonCode, null)
  assert.equal(result.targetBasis, ROLLING_DAILY_TARGET_BASIS)
  assert.equal(result.newOriginCount, 1)
  assert.equal(result.maturedRecordCount, 1)
  assert.equal(result.calibrationRefreshCount, 1)
  assert.equal(result.lastProcessedOriginAt, '2024-01-05')
  assert.equal(persistedUpdates.length, 1)
  assert.equal(persistedUpdates[0]?.newRecords.length, 1)
  assert.equal(persistedUpdates[0]?.maturedRecords.length, 1)
  assert.equal(persistedUpdates[0]?.calibrationGroups.length, 1)
  assert.equal(persistedUpdates[0]?.state, '2024-01-05')
  assert.equal(persistedUpdates[0]?.newRecords[0]?.targetBasis, ROLLING_DAILY_TARGET_BASIS)
  assert.equal(persistedUpdates[0]?.calibrationGroups[0]?.targetBasis, ROLLING_DAILY_TARGET_BASIS)
})

test('rolling daily maintenance returns NO_OP when the runner reports no delta', async () => {
  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return null
    },
    async listVerificationRecords() {
      return []
    },
    async applyMaintenanceUpdate() {
      return
    },
    async recordMaintenanceFailure() {
      throw new Error('recordMaintenanceFailure should not be called for NO_OP success')
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run() {
      return {
        status: 'AVAILABLE',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: 'hist-1',
        },
        maintenance: {
          newOriginCount: 0,
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 0,
          calibrationRefreshCount: 0,
          lastProcessedOriginDate: '2024-01-05',
          lastMaturedObservedAt: null,
          newOriginDates: [],
        },
        newRecords: [],
        maturedRecords: [],
        calibrationGroups: [],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    logEvent: () => {},
  })

  const result = await service.runIncrementalMaintenance({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    minimumTrainingObservations: 5,
  })

  assert.equal(result.status, 'NO_OP')
  assert.equal(result.reasonCode, null)
  assert.equal(result.newOriginCount, 0)
  assert.equal(result.maturedRecordCount, 0)
})

test('rolling daily maintenance requests a calibration-only refresh when mature records exist but the state watermark is missing', async () => {
  let capturedForceCalibrationRefresh: boolean | undefined

  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: `${DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE}T00:00:00.000Z`,
        minimumTrainingObservations: 5,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 5,
        latestSourceHistoryFingerprint: createHistoryFingerprint(),
        lastProcessedOriginAt: '2024-01-05',
        lastMaturedObservedAt: null,
        lastMaintenanceAt: '2024-01-05T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return [
        createVerificationRecord({
          forecastOriginAt: '2024-01-04',
          verificationObservedAt: '2024-01-05',
          maturityStatus: 'MATURED',
          actualValue: 104,
          errorValue: 0,
          absoluteErrorValue: 0,
          deltaValue: 0,
          residualValue: 0,
        }),
      ]
    },
    async applyMaintenanceUpdate() {
      return
    },
    async recordMaintenanceFailure() {
      throw new Error('recordMaintenanceFailure should not be called for calibration-only refresh')
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run(request) {
      capturedForceCalibrationRefresh = request.forceCalibrationRefresh
      return {
        status: 'AVAILABLE',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: createHistoryFingerprint(),
        },
        maintenance: {
          newOriginCount: 0,
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 1,
          calibrationRefreshCount: 1,
          lastProcessedOriginDate: '2024-01-05',
          lastMaturedObservedAt: '2024-01-05',
          newOriginDates: [],
        },
        newRecords: [],
        maturedRecords: [],
        calibrationGroups: [createCalibrationGroup({ lastResidualObservedAt: '2024-01-05' })],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    logEvent: () => {},
  })

  const result = await service.runIncrementalMaintenance({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    minimumTrainingObservations: 5,
  })

  assert.equal(capturedForceCalibrationRefresh, true)
  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(result.calibrationRefreshCount, 1)
})

test('rolling daily maintenance records FAILED state when the bridge fails', async () => {
  const failureUpdates: Array<{
    failureReason: string
    lastProcessedOriginAt: string | null
    lastMaturedObservedAt: string | null
    latestSourceObservationAt: string | null
  }> = []

  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: `${DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE}T00:00:00.000Z`,
        minimumTrainingObservations: 5,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-04T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 4,
        latestSourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)),
        lastProcessedOriginAt: '2024-01-04',
        lastMaturedObservedAt: '2024-01-03',
        lastMaintenanceAt: '2024-01-04T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return [createVerificationRecord({ forecastOriginAt: '2024-01-04', sourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)) })]
    },
    async applyMaintenanceUpdate() {
      throw new Error('applyMaintenanceUpdate should not be called when the bridge fails')
    },
    async recordMaintenanceFailure(input) {
      failureUpdates.push({
        failureReason: input.failureReason,
        lastProcessedOriginAt: input.lastProcessedOriginAt,
        lastMaturedObservedAt: input.lastMaturedObservedAt,
        latestSourceObservationAt: input.latestSourceObservationAt,
      })
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run() {
      return {
        status: 'FAILED',
        reason: 'calibration refresh failed',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: 'hist-1',
        },
        maintenance: {
          newOriginCount: 0,
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 0,
          calibrationRefreshCount: 0,
          lastProcessedOriginDate: '2024-01-04',
          lastMaturedObservedAt: '2024-01-03',
          newOriginDates: [],
        },
        newRecords: [],
        maturedRecords: [],
        calibrationGroups: [],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    now: () => new Date('2024-01-05T00:00:00.000Z'),
    logEvent: () => {},
  })

  await assert.rejects(
    service.runIncrementalMaintenance({
      seriesId: 'wocaes0074',
      modelId: 'naive',
    }),
    /calibration refresh failed/
  )

  assert.equal(failureUpdates.length, 1)
  assert.equal(failureUpdates[0]?.failureReason, 'calibration refresh failed')
  assert.equal(failureUpdates[0]?.lastProcessedOriginAt, '2024-01-04')
  assert.equal(failureUpdates[0]?.lastMaturedObservedAt, '2024-01-03')
  assert.equal(failureUpdates[0]?.latestSourceObservationAt, '2024-01-05')
})

test('rolling daily maintenance records FAILED state when persistence fails after a successful bridge run', async () => {
  const failureUpdates: Array<{
    failureReason: string
    lastProcessedOriginAt: string | null
    lastMaturedObservedAt: string | null
  }> = []

  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: `${DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE}T00:00:00.000Z`,
        minimumTrainingObservations: 5,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-04T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 4,
        latestSourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)),
        lastProcessedOriginAt: '2024-01-04',
        lastMaturedObservedAt: '2024-01-03',
        lastMaintenanceAt: '2024-01-04T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return [createVerificationRecord({ forecastOriginAt: '2024-01-04', sourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)) })]
    },
    async applyMaintenanceUpdate() {
      throw new Error('write transaction failed')
    },
    async recordMaintenanceFailure(input) {
      failureUpdates.push({
        failureReason: input.failureReason,
        lastProcessedOriginAt: input.lastProcessedOriginAt,
        lastMaturedObservedAt: input.lastMaturedObservedAt,
      })
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run() {
      return {
        status: 'AVAILABLE',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: 'hist-1',
        },
        maintenance: {
          newOriginCount: 1,
          maturedRecordCount: 1,
          affectedCalibrationGroupCount: 1,
          calibrationRefreshCount: 1,
          lastProcessedOriginDate: '2024-01-05',
          lastMaturedObservedAt: '2024-01-05',
          newOriginDates: ['2024-01-05'],
        },
        newRecords: [createVerificationRecord()],
        maturedRecords: [createVerificationRecord({ forecastOriginAt: '2024-01-04', verificationObservedAt: '2024-01-05', maturityStatus: 'MATURED', actualValue: 104, errorValue: 0, absoluteErrorValue: 0, deltaValue: 0, residualValue: 0 })],
        calibrationGroups: [createCalibrationGroup()],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    now: () => new Date('2024-01-05T00:00:00.000Z'),
    logEvent: () => {},
  })

  await assert.rejects(
    service.runIncrementalMaintenance({
      seriesId: 'wocaes0074',
      modelId: 'naive',
    }),
    /write transaction failed/
  )

  assert.equal(failureUpdates.length, 1)
  assert.equal(failureUpdates[0]?.failureReason, 'write transaction failed')
  assert.equal(failureUpdates[0]?.lastProcessedOriginAt, '2024-01-04')
  assert.equal(failureUpdates[0]?.lastMaturedObservedAt, '2024-01-03')
})

test('rolling daily maintenance marks REBUILD_REQUIRED when a processed historical value changes', async () => {
  const failureUpdates: Array<{
    maintenanceStatus: string
    failureReason: string
    lastProcessedOriginAt: string | null
    latestSourceHistoryFingerprint: string | null
  }> = []
  let runnerCalled = false

  const baseHistory = createHistory()
  const revisedHistory = {
    ...baseHistory,
    points: baseHistory.points.map((point) => point.date === '2024-01-03' ? { ...point, value: 999 } : point),
  }

  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: `${DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE}T00:00:00.000Z`,
        minimumTrainingObservations: 5,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-04T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 4,
        latestSourceHistoryFingerprint: createHistoryFingerprint(baseHistory.points.slice(0, 4)),
        lastProcessedOriginAt: '2024-01-04',
        lastMaturedObservedAt: '2024-01-03',
        lastMaintenanceAt: '2024-01-04T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return [createVerificationRecord({ forecastOriginAt: '2024-01-04' })]
    },
    async applyMaintenanceUpdate() {
      throw new Error('applyMaintenanceUpdate should not be called when rebuild is required')
    },
    async recordMaintenanceFailure(input) {
      failureUpdates.push({
        maintenanceStatus: input.maintenanceStatus,
        failureReason: input.failureReason,
        lastProcessedOriginAt: input.lastProcessedOriginAt,
        latestSourceHistoryFingerprint: input.latestSourceHistoryFingerprint,
      })
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run() {
      runnerCalled = true
      throw new Error('runner should not be called when source revision is detected')
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => revisedHistory,
    now: () => new Date('2024-01-05T00:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.runIncrementalMaintenance({
    seriesId: 'wocaes0074',
    modelId: 'naive',
  })

  assert.equal(runnerCalled, false)
  assert.equal(result.status, 'REBUILD_REQUIRED')
  assert.equal(result.reasonCode, ROLLING_DAILY_REBUILD_REQUIRED_REASON)
  assert.equal(result.newOriginCount, 0)
  assert.equal(result.lastProcessedOriginAt, '2024-01-04')
  assert.equal(failureUpdates.length, 1)
  assert.equal(failureUpdates[0]?.maintenanceStatus, 'REBUILD_REQUIRED')
  assert.equal(failureUpdates[0]?.failureReason, ROLLING_DAILY_REBUILD_REQUIRED_REASON)
  assert.equal(failureUpdates[0]?.lastProcessedOriginAt, '2024-01-04')
  assert.equal(failureUpdates[0]?.latestSourceHistoryFingerprint, createHistoryFingerprint(baseHistory.points.slice(0, 4)))
})

test('rolling daily maintenance does not false-positive REBUILD_REQUIRED on normal append-only growth', async () => {
  let runnerCalled = false

  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: `${DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE}T00:00:00.000Z`,
        minimumTrainingObservations: 5,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-04T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 4,
        latestSourceHistoryFingerprint: createHistoryFingerprint(createHistory().points.slice(0, 4)),
        lastProcessedOriginAt: '2024-01-04',
        lastMaturedObservedAt: null,
        lastMaintenanceAt: '2024-01-04T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return []
    },
    async applyMaintenanceUpdate() {
      return
    },
    async recordMaintenanceFailure() {
      throw new Error('recordMaintenanceFailure should not be called on append-only growth')
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run() {
      runnerCalled = true
      return {
        status: 'AVAILABLE',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: createHistoryFingerprint(),
        },
        maintenance: {
          newOriginCount: 1,
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 0,
          calibrationRefreshCount: 0,
          lastProcessedOriginDate: '2024-01-05',
          lastMaturedObservedAt: null,
          newOriginDates: ['2024-01-05'],
        },
        newRecords: [createVerificationRecord()],
        maturedRecords: [],
        calibrationGroups: [],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    now: () => new Date('2024-01-05T00:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.runIncrementalMaintenance({
    seriesId: 'wocaes0074',
    modelId: 'naive',
  })

  assert.equal(runnerCalled, true)
  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(result.reasonCode, null)
})

test('rolling daily persistence artifacts are normalized to the canonical maintenance identity', () => {
  const normalized = normalizePersistedRollingDailyArtifacts({
    identity: {
      seriesId: 'wocaes0074',
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId: 'arima',
    },
    inputRunId: null,
    historicalOriginStartAt: '2024-01-01T00:00:00.000Z',
    minimumTrainingObservations: 60,
    minimumCalibrationSamples: 20,
    latestSourceObservationAt: '2024-01-02T00:00:00.000Z',
    latestSourceHistoryStartAt: '1985-10-01T00:00:00.000Z',
    latestSourceObservationCount: 9780,
    latestSourceHistoryFingerprint: 'hist-1',
    lastProcessedOriginAt: '2024-01-02',
    lastMaturedObservedAt: null,
    newRecords: [createVerificationRecord({ inputSource: 'src_macrobond', modelId: 'ets' })],
    maturedRecords: [createVerificationRecord({ inputSource: 'src_macrobond', modelId: 'ets', maturityStatus: 'MATURED' })],
    calibrationGroups: [createCalibrationGroup({ inputSource: 'src_macrobond', modelId: 'ets' })],
  })

  assert.equal(normalized.newRecords[0]?.inputSource, ROLLING_DAILY_INPUT_SOURCE)
  assert.equal(normalized.newRecords[0]?.modelId, 'arima')
  assert.equal(normalized.newRecords[0]?.methodId, ROLLING_DAILY_METHOD_ID)
  assert.equal(normalized.maturedRecords[0]?.inputSource, ROLLING_DAILY_INPUT_SOURCE)
  assert.equal(normalized.calibrationGroups[0]?.inputSource, ROLLING_DAILY_INPUT_SOURCE)
  assert.equal(normalized.calibrationGroups[0]?.modelId, 'arima')
})