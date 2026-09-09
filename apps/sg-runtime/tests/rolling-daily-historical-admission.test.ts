import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import '../scripts/load-env'

process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL
  ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'

import {
  createDefaultForecastPreparationExecutionAdmission,
  createDefaultForecastPreparationExecutionLedger,
} from '../lib/forecast/execution-ledger'
import {
  createRollingDailyMaintenanceService,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  ROLLING_DAILY_TARGET_BASIS,
  type RollingDailyHistoryPayload,
  type RollingDailyMaintenanceRepository,
  type RollingDailyMaintenanceRunner,
  type RollingDailyMaintenanceStateArtifact,
  type RollingDailyVerificationRecordArtifact,
} from '../lib/forecast/rolling-daily-maintenance'
import { getMarketDataPrisma } from '../lib/market-data/client'

function createHistory(seriesId: string): RollingDailyHistoryPayload {
  return {
    seriesId,
    displayName: 'Historical admission test',
    description: null,
    frequency: 'DAILY',
    source: 'TEST',
    points: [
      { date: '2024-01-01', value: 101 },
      { date: '2024-01-02', value: 102 },
      { date: '2024-01-03', value: 103 },
      { date: '2024-01-04', value: 104 },
      { date: '2024-01-05', value: 105 },
    ],
  }
}

function createVerificationRecord(seriesId: string): RollingDailyVerificationRecordArtifact {
  return {
    seriesId,
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    forecastOriginAt: '2024-01-05',
    horizonLabel: '1M',
    horizonMonths: 1,
    horizonSteps: 31,
    targetCalendarDate: '2024-02-05',
    verificationObservedAt: null,
    maturityStatus: 'NOT_YET_MATURED',
    originValue: 105,
    forecastValue: 106,
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
    metadata: null,
    selectedVariant: 'naive',
    selectionMetric: null,
    selectionScore: null,
  }
}

test('rolling daily maintenance converges concurrent bounded historical callers to one authoritative execution', async () => {
  const prisma = getMarketDataPrisma()
  assert.ok(prisma, 'MARKET_DATA_DATABASE_URL must target the isolated PostgreSQL authority for historical admission tests.')

  const seriesId = `stage8-historical-admission-${randomUUID()}`
  const executionAdmission = createDefaultForecastPreparationExecutionAdmission()
  const executionLedger = createDefaultForecastPreparationExecutionLedger()
  let state: RollingDailyMaintenanceStateArtifact | null = null
  let records: RollingDailyVerificationRecordArtifact[] = []
  let runnerCalls = 0
  let releaseOwner: (() => void) | undefined

  const ownerGate = new Promise<void>((resolve) => {
    releaseOwner = resolve
  })

  const repository: RollingDailyMaintenanceRepository = {
    async readState() {
      return state
    },
    async listVerificationRecords() {
      return records
    },
    async applyMaintenanceUpdate(input) {
      state = {
        seriesId: input.identity.seriesId,
        inputSource: input.identity.inputSource,
        inputRunId: input.inputRunId,
        targetBasis: input.identity.targetBasis,
        methodId: input.identity.methodId,
        methodVersion: input.identity.methodVersion,
        modelId: input.identity.modelId,
        historicalOriginStartAt: input.historicalOriginStartAt,
        minimumTrainingObservations: input.minimumTrainingObservations,
        minimumCalibrationSamples: input.minimumCalibrationSamples,
        latestSourceObservationAt: input.latestSourceObservationAt,
        latestSourceHistoryStartAt: input.latestSourceHistoryStartAt,
        latestSourceObservationCount: input.latestSourceObservationCount,
        latestSourceHistoryFingerprint: input.latestSourceHistoryFingerprint,
        lastProcessedOriginAt: input.lastProcessedOriginAt,
        lastMaturedObservedAt: input.lastMaturedObservedAt,
        lastMaintenanceAt: '2024-01-05T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
      records = [...input.newRecords]
    },
    async recordMaintenanceFailure() {
      throw new Error('recordMaintenanceFailure should not be called in the happy-path admission test')
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run() {
      runnerCalls += 1
      await ownerGate
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
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 0,
          calibrationRefreshCount: 0,
          lastProcessedOriginDate: '2024-01-05',
          lastMaturedObservedAt: null,
          newOriginDates: ['2024-01-05'],
        },
        newRecords: [createVerificationRecord(seriesId)],
        maturedRecords: [],
        calibrationGroups: [],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(seriesId),
    logEvent: () => {},
    executionAdmission,
    executionLedger,
  })

  try {
    const first = service.runIncrementalMaintenance({
      seriesId,
      modelId: 'naive',
      bootstrapHistoricalIfMissing: true,
      maxOriginsPerRun: 1,
    })
    const second = service.runIncrementalMaintenance({
      seriesId,
      modelId: 'naive',
      bootstrapHistoricalIfMissing: true,
      maxOriginsPerRun: 1,
    })

    await new Promise<void>((resolve) => setImmediate(resolve))
    releaseOwner?.()

    const [left, right] = await Promise.all([first, second])

    assert.equal(runnerCalls, 1)
    assert.deepEqual([left.status, right.status].sort(), ['SUCCEEDED', 'SUCCEEDED'])
    assert.equal(left.executionLineage?.logicalArtifactKey, right.executionLineage?.logicalArtifactKey)
    assert.equal(left.executionLineage?.executionId, right.executionLineage?.executionId)
    assert.deepEqual([left.executionLineage?.role, right.executionLineage?.role].sort(), ['OWNER', 'WAITER'])

    const executions = await prisma.forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId,
        operationFamily: 'HISTORICAL_MAINTENANCE',
      },
    })

    assert.equal(executions.length, 1)
    assert.equal(executions[0]?.executionStatus, 'COMPLETED')
    assert.equal(executions[0]?.waiterCount, 1)
    assert.ok((executions[0]?.eventCount ?? 0) >= 4)
  } finally {
    await prisma.forecastPreparationExecutionLedger.deleteMany({ where: { seriesId } })
  }
})