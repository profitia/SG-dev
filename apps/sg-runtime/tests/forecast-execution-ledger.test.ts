import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildForecastPreparationExecutionId,
  createForecastPreparationExecutionContextRegistry,
  createForecastPreparationExecutionLedger,
  reduceForecastPreparationExecution,
  type ForecastPreparationExecutionLedgerStore,
  type ForecastPreparationExecutionRecord,
} from '../lib/forecast/execution-ledger'
import type { CurrentLogicalArtifactIdentity } from '../lib/forecast/current-single-flight'
import type { VerificationLogicalArtifactIdentity } from '../lib/forecast/verification-single-flight'

function createInMemoryStore(): ForecastPreparationExecutionLedgerStore {
  const records = new Map<string, ForecastPreparationExecutionRecord>()

  return {
    async readExecution(executionId) {
      return records.get(executionId) ?? null
    },
    async writeExecution(record) {
      records.set(record.executionId, record)
    },
  }
}

const currentIdentity: CurrentLogicalArtifactIdentity = {
  artifactScope: 'CURRENT_FORECAST',
  seriesId: 'wocaes0280',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  trainingWindowPolicyId: 'CURRENT_POLICY_FREQUENCY_SPECIFIC@current-policy-frequency-specific-v1',
  modelId: 'ets',
  inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
  historyFingerprint: 'history-current',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  forecastOrigin: '2026-04-01T00:00:00.000Z',
  horizonConfigurationId: '1M:1:2026-05-01T00:00:00.000Z',
}

const verificationIdentity: VerificationLogicalArtifactIdentity = {
  artifactScope: 'FULL_VERIFICATION',
  seriesId: 'wocaes0280',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  trainingWindowPolicyId: 'FULL_EXPANDING_HISTORY_PER_ORIGIN@full-expanding-history-per-origin-v1',
  modelId: 'ets',
  inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
  historyFingerprint: 'history-verification',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  verificationHorizonSetId: '{"1M":1}',
  verificationConfigurationId: '{"minTrainingWindow":36}',
  originPolicyId: 'EXPANDING_WINDOW_ROLLING_ORIGIN@expanding-window-rolling-origin-v1',
}

test('execution ledger reducer preserves owner/waiter lineage and phase timestamps', () => {
  const executionId = 'de7a09f9-8ca3-4604-b6fc-c4e43055ab70'
  let record = reduceForecastPreparationExecution(null, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'single_flight_owner_acquired',
    observedAt: '2026-09-06T18:20:00.000Z',
    executionMode: 'PRIMARY',
    ownerToken: 'owner-token-1',
    leaseVersion: 1,
    leaseAcquiredAt: '2026-09-06T18:20:00.000Z',
    leaseExpiresAt: '2026-09-06T18:25:00.000Z',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-waiter',
    ownerRequestId: 'req-owner',
    role: 'WAITER',
    eventType: 'single_flight_waiter_joined',
    observedAt: '2026-09-06T18:20:01.000Z',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'compute_started',
    observedAt: '2026-09-06T18:20:02.000Z',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'compute_completed',
    observedAt: '2026-09-06T18:20:03.000Z',
    resultStatus: 'AVAILABLE',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'persistence_started',
    observedAt: '2026-09-06T18:20:04.000Z',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'persistence_completed',
    observedAt: '2026-09-06T18:20:05.000Z',
    artifactWrites: 1,
    pointWrites: 2,
    writeFailures: 0,
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'execution_completed',
    observedAt: '2026-09-06T18:20:06.000Z',
    resultStatus: 'AVAILABLE',
    cacheStatus: 'miss',
  })

  assert.equal(record.executionStatus, 'COMPLETED')
  assert.equal(record.executionMode, 'PRIMARY')
  assert.equal(record.ownerToken, 'owner-token-1')
  assert.equal(record.leaseVersion, 1)
  assert.equal(record.leaseAcquiredAt, '2026-09-06T18:20:00.000Z')
  assert.equal(record.leaseExpiresAt, '2026-09-06T18:25:00.000Z')
  assert.equal(record.lastProgressAt, '2026-09-06T18:20:06.000Z')
  assert.equal(record.failurePhase, null)
  assert.equal(record.waiterCount, 1)
  assert.equal(record.computeStartedAt, '2026-09-06T18:20:02.000Z')
  assert.equal(record.computeCompletedAt, '2026-09-06T18:20:03.000Z')
  assert.equal(record.persistenceStartedAt, '2026-09-06T18:20:04.000Z')
  assert.equal(record.persistenceCompletedAt, '2026-09-06T18:20:05.000Z')
  assert.equal(record.completedAt, '2026-09-06T18:20:06.000Z')
  assert.equal(record.eventCount, 7)
  assert.equal(record.events[1]?.role, 'WAITER')
  assert.equal(record.events[6]?.eventType, 'execution_completed')
})

test('execution ledger serializes concurrent writes per execution id', async () => {
  const ledger = createForecastPreparationExecutionLedger({ store: createInMemoryStore() })
  const executionId = buildForecastPreparationExecutionId('VERIFICATION', 'req-owner')

  await Promise.all([
    ledger.recordEvent({
      executionId,
      logicalArtifactKey: 'logical-verification',
      operationFamily: 'VERIFICATION',
      logicalArtifactIdentity: verificationIdentity,
      requestId: 'req-owner',
      ownerRequestId: 'req-owner',
      role: 'OWNER',
      eventType: 'single_flight_owner_acquired',
      observedAt: '2026-09-06T18:21:00.000Z',
    }),
    ledger.recordEvent({
      executionId,
      logicalArtifactKey: 'logical-verification',
      operationFamily: 'VERIFICATION',
      logicalArtifactIdentity: verificationIdentity,
      requestId: 'req-waiter',
      ownerRequestId: 'req-owner',
      role: 'WAITER',
      eventType: 'single_flight_waiter_joined',
      observedAt: '2026-09-06T18:21:01.000Z',
    }),
  ])

  const stored = await ledger.readExecution(executionId)
  assert.ok(stored)
  assert.equal(stored?.eventCount, 2)
  assert.deepEqual(stored?.events.map((event) => event.sequence), [1, 2])
  assert.equal(stored?.waiterCount, 1)
})

test('execution ids isolate operation families for the same owner request', () => {
  assert.notEqual(
    buildForecastPreparationExecutionId('CURRENT', 'req-123'),
    buildForecastPreparationExecutionId('VERIFICATION', 'req-123'),
  )
})

test('execution context registry mints ids independent from request ids and reuses owner lineage for waiters', () => {
  const registry = createForecastPreparationExecutionContextRegistry()

  const owner = registry.getOrCreateContext({
    operationFamily: 'CURRENT',
    logicalArtifactKey: 'logical-current',
    ownerRequestId: 'req-owner',
    observedAt: '2026-09-06T18:22:00.000Z',
  })

  const waiterView = registry.getOrCreateContext({
    operationFamily: 'CURRENT',
    logicalArtifactKey: 'logical-current',
    ownerRequestId: 'req-owner',
    observedAt: '2026-09-06T18:22:01.000Z',
  })

  assert.equal(waiterView.executionId, owner.executionId)
  assert.equal(waiterView.ownerToken, owner.ownerToken)
  assert.equal(owner.ownerRequestId, 'req-owner')
  assert.notEqual(owner.executionId, 'CURRENT:req-owner')
  assert.match(owner.executionId, /^[0-9a-f-]{36}$/)
  assert.match(owner.ownerToken, /^[0-9a-f-]{36}$/)
  assert.equal(owner.executionMode, 'PRIMARY')
  assert.equal(owner.leaseVersion, 1)
  assert.equal(owner.leaseAcquiredAt, '2026-09-06T18:22:00.000Z')
  assert.equal(owner.leaseExpiresAt, '2026-09-06T18:27:00.000Z')
})

test('execution context registry releases terminal lineage and allows a fresh recovery execution', () => {
  const registry = createForecastPreparationExecutionContextRegistry()

  const initial = registry.getOrCreateContext({
    operationFamily: 'VERIFICATION',
    logicalArtifactKey: 'logical-verification',
    ownerRequestId: 'req-owner',
    observedAt: '2026-09-06T18:23:00.000Z',
  })

  registry.releaseContext(initial.executionId)

  const recovery = registry.getOrCreateContext({
    operationFamily: 'VERIFICATION',
    logicalArtifactKey: 'logical-verification',
    ownerRequestId: 'req-owner',
    executionMode: 'RECOVERY',
    recoveredFromExecutionId: initial.executionId,
    observedAt: '2026-09-06T18:24:00.000Z',
  })

  assert.notEqual(recovery.executionId, initial.executionId)
  assert.notEqual(recovery.ownerToken, initial.ownerToken)
  assert.equal(recovery.executionMode, 'RECOVERY')
  assert.equal(recovery.recoveredFromExecutionId, initial.executionId)
  assert.equal(recovery.leaseAcquiredAt, '2026-09-06T18:24:00.000Z')
})

test('execution ledger failure metadata is phase-aware and terminal transitions are guarded', () => {
  const executionId = '77ff61c5-20c7-43ca-bbf7-5264c9e8d02b'
  let record = reduceForecastPreparationExecution(null, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'single_flight_owner_acquired',
    observedAt: '2026-09-06T18:30:00.000Z',
    executionMode: 'RECOVERY',
    ownerToken: 'owner-token-2',
    leaseVersion: 2,
    leaseAcquiredAt: '2026-09-06T18:30:00.000Z',
    leaseExpiresAt: '2026-09-06T18:35:00.000Z',
    recoveredFromExecutionId: 'prior-execution-id',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'compute_started',
    observedAt: '2026-09-06T18:30:01.000Z',
  })

  record = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'execution_failed',
    observedAt: '2026-09-06T18:30:02.000Z',
    resultStatus: 'FAILED',
    error: 'bridge failure',
  })

  const guarded = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'compute_completed',
    observedAt: '2026-09-06T18:30:03.000Z',
    resultStatus: 'AVAILABLE',
  })

  const released = reduceForecastPreparationExecution(record, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'single_flight_entry_released',
    observedAt: '2026-09-06T18:30:04.000Z',
  })

  assert.equal(record.executionMode, 'RECOVERY')
  assert.equal(record.recoveredFromExecutionId, 'prior-execution-id')
  assert.equal(record.failurePhase, 'COMPUTE')
  assert.equal(record.failureReason, 'bridge failure')
  assert.equal(record.lastProgressAt, '2026-09-06T18:30:02.000Z')
  assert.equal(guarded, record)
  assert.equal(released.eventCount, record.eventCount + 1)
  assert.equal(released.events.at(-1)?.eventType, 'single_flight_entry_released')
  assert.equal(released.lastEventAt, '2026-09-06T18:30:04.000Z')
  assert.equal(released.lastProgressAt, '2026-09-06T18:30:02.000Z')
})