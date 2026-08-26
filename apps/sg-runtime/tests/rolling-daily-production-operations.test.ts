import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createRollingDailyProductionOperationsService,
  ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS,
} from '../lib/forecast/rolling-daily-production-operations'
import type { RollingDailyMaintenanceResult } from '../lib/forecast/rolling-daily-maintenance'

function createMaintenanceResult(overrides: Partial<RollingDailyMaintenanceResult> = {}): RollingDailyMaintenanceResult {
  return {
    status: 'SUCCEEDED',
    seriesId: 'wocaes0074',
    modelId: 'naive',
    targetBasis: 'POINT_IN_TIME',
    inputSource: 'DYNAMIC_MARKET_DATA_STORE',
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    methodVersion: 'rolling-daily-point-in-time-v1',
    reasonCode: null,
    sourceHistoryFingerprint: 'hist-1',
    latestSourceObservationAt: '2026-08-20',
    sourceObservationCount: 100,
    filteredNullCount: 0,
    filteredDuplicateCount: 0,
    newOriginCount: 1,
    maturedRecordCount: 0,
    calibrationRefreshCount: 0,
    affectedCalibrationGroupCount: 0,
    lastProcessedOriginAt: '2026-08-20',
    lastMaturedObservedAt: null,
    runtimeMs: 10,
    ...overrides,
  }
}

test('production operations refreshes snapshots for the canonical four-model maintenance pass', async () => {
  const maintenanceCalls: string[] = []
  const snapshotCalls: string[] = []

  const service = createRollingDailyProductionOperationsService({
    async runMaintenance(request) {
      maintenanceCalls.push(request.modelId)
      return createMaintenanceResult({ modelId: request.modelId, status: 'SUCCEEDED' })
    },
    async persistSnapshot(request) {
      snapshotCalls.push(request.modelId)
      return {
        seriesId: request.seriesId,
        modelId: request.modelId,
        targetBasis: 'POINT_IN_TIME',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        methodId: 'ROLLING_DAILY_POINT_IN_TIME',
        methodVersion: 'rolling-daily-point-in-time-v1',
        contractVersion: '1',
        status: 'AVAILABLE',
        reasonCode: null,
        parityStatus: 'MATCHED',
      }
    },
    async readSnapshot() {
      throw new Error('readSnapshot should not be called after maintenance delta')
    },
    logEvent: () => {},
  })

  const result = await service.run({ seriesId: 'wocaes0074' })

  assert.equal(result.status, 'SUCCEEDED')
  assert.deepEqual(maintenanceCalls, [...ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS])
  assert.deepEqual(snapshotCalls, [...ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS])
  assert.equal(result.refreshedSnapshotCount, 4)
  assert.equal(result.failedModelCount, 0)
})

test('production operations returns NO_OP when maintenance is idle and snapshots are already fresh', async () => {
  let snapshotRefreshes = 0

  const service = createRollingDailyProductionOperationsService({
    async runMaintenance(request) {
      return createMaintenanceResult({
        modelId: request.modelId,
        status: 'NO_OP',
        newOriginCount: 0,
        maturedRecordCount: 0,
        calibrationRefreshCount: 0,
      })
    },
    async readSnapshot() {
      return {
        status: 'HIT',
        payload: {} as never,
      }
    },
    async persistSnapshot() {
      snapshotRefreshes += 1
      throw new Error('persistSnapshot should not be called during clean NO_OP')
    },
    logEvent: () => {},
  })

  const result = await service.run({ seriesId: 'wocaes0074', modelIds: ['naive'] })

  assert.equal(result.status, 'NO_OP')
  assert.equal(snapshotRefreshes, 0)
  assert.equal(result.noOpModelCount, 1)
  assert.equal(result.results[0]?.status, 'NO_OP')
  assert.equal(result.results[0]?.snapshot.status, 'SKIPPED_ALREADY_FRESH')
})

test('production operations recovers a stale prepared snapshot after maintenance NO_OP', async () => {
  const service = createRollingDailyProductionOperationsService({
    async runMaintenance(request) {
      return createMaintenanceResult({
        modelId: request.modelId,
        status: 'NO_OP',
        newOriginCount: 0,
        maturedRecordCount: 0,
        calibrationRefreshCount: 0,
      })
    },
    async readSnapshot() {
      return {
        status: 'STALE',
        reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
        payload: {} as never,
      }
    },
    async persistSnapshot(request) {
      return {
        seriesId: request.seriesId,
        modelId: request.modelId,
        targetBasis: 'POINT_IN_TIME',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        methodId: 'ROLLING_DAILY_POINT_IN_TIME',
        methodVersion: 'rolling-daily-point-in-time-v1',
        contractVersion: '1',
        status: 'AVAILABLE',
        reasonCode: null,
        parityStatus: 'MATCHED',
      }
    },
    logEvent: () => {},
  })

  const result = await service.run({ seriesId: 'wocaes0074', modelIds: ['ets'] })

  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(result.recoveredSnapshotCount, 1)
  assert.equal(result.results[0]?.status, 'RECOVERED')
  assert.equal(result.results[0]?.snapshot.status, 'REFRESHED_AFTER_RECOVERY')
  assert.equal(result.results[0]?.snapshot.reason, 'SOURCE_HISTORY_FINGERPRINT_MISMATCH')
})

test('production operations supports safe retry when a prior snapshot refresh failed after maintenance success', async () => {
  let attempt = 0

  const service = createRollingDailyProductionOperationsService({
    async runMaintenance(request) {
      attempt += 1
      return createMaintenanceResult({
        modelId: request.modelId,
        status: attempt === 1 ? 'SUCCEEDED' : 'NO_OP',
        newOriginCount: attempt === 1 ? 1 : 0,
        maturedRecordCount: 0,
        calibrationRefreshCount: 0,
      })
    },
    async readSnapshot() {
      return {
        status: 'MISS',
      }
    },
    async persistSnapshot(request) {
      if (attempt === 1) {
        throw new Error(`snapshot write failed for ${request.modelId}`)
      }

      return {
        seriesId: request.seriesId,
        modelId: request.modelId,
        targetBasis: 'POINT_IN_TIME',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        methodId: 'ROLLING_DAILY_POINT_IN_TIME',
        methodVersion: 'rolling-daily-point-in-time-v1',
        contractVersion: '1',
        status: 'AVAILABLE',
        reasonCode: null,
        parityStatus: 'MATCHED',
      }
    },
    logEvent: () => {},
  })

  const firstAttempt = await service.run({ seriesId: 'wocaes0074', modelIds: ['arima'] })
  const secondAttempt = await service.run({ seriesId: 'wocaes0074', modelIds: ['arima'] })

  assert.equal(firstAttempt.status, 'FAILED')
  assert.equal(firstAttempt.results[0]?.status, 'FAILED')
  assert.equal(secondAttempt.status, 'SUCCEEDED')
  assert.equal(secondAttempt.results[0]?.status, 'RECOVERED')
  assert.equal(secondAttempt.results[0]?.snapshot.reason, 'SNAPSHOT_MISS')
})

test('production operations fails closed on rebuild required and preserves the last good snapshot', async () => {
  let snapshotRefreshes = 0

  const service = createRollingDailyProductionOperationsService({
    async runMaintenance(request) {
      return createMaintenanceResult({
        modelId: request.modelId,
        status: 'REBUILD_REQUIRED',
        reasonCode: 'SOURCE_HISTORY_REVISION_DETECTED',
        newOriginCount: 0,
        maturedRecordCount: 0,
        calibrationRefreshCount: 0,
      })
    },
    async readSnapshot() {
      throw new Error('readSnapshot should not be called when rebuild is required')
    },
    async persistSnapshot() {
      snapshotRefreshes += 1
      throw new Error('persistSnapshot should not be called when rebuild is required')
    },
    logEvent: () => {},
  })

  const result = await service.run({ seriesId: 'wocaes0074', modelIds: ['naive'] })

  assert.equal(result.status, 'FAILED')
  assert.equal(result.results[0]?.status, 'REBUILD_REQUIRED')
  assert.equal(result.results[0]?.snapshot.status, 'SKIPPED_REBUILD_REQUIRED')
  assert.equal(snapshotRefreshes, 0)
})