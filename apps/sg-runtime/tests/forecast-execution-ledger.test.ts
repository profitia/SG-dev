import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildForecastPreparationExecutionId,
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
  trainingWindowPolicyId: 'CURRENT_ALL_AVAILABLE_HISTORY@current-all-available-history-v1',
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
  trainingWindowPolicyId: 'FULL_EXPANDING_WINDOW@full-expanding-window-v1',
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
  const executionId = buildForecastPreparationExecutionId('CURRENT', 'req-owner')
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