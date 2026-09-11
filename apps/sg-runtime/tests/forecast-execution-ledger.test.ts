import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  createDefaultForecastPreparationExecutionAdmission,
  createForecastPreparationExecutionContextRegistry,
  createForecastPreparationExecutionLedger,
  hasForecastPreparationExecutionLedgerRelation,
  reduceForecastPreparationExecution,
  STAGE2_NON_AUTHORITATIVE_LEASE_WINDOW_MS,
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
  trainingWindowPolicyId: 'CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX@current-fast-minimal-lawful-suffix-v1',
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
    attemptKind: 'PRIMARY',
    executionMode: 'PRE_STAGE3_PREPARATION',
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
  assert.equal(record.attemptKind, 'PRIMARY')
  assert.equal(record.executionMode, 'PRE_STAGE3_PREPARATION')
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
  const executionId = '4d71e28e-d7eb-44c1-aec1-a5aa2c1cc1d8'

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
      attemptKind: 'PRIMARY',
      executionMode: 'PRE_STAGE3_PREPARATION',
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

test('stage 2 lease window stays explicitly non-authoritative until Stage 3', () => {
  assert.equal(STAGE2_NON_AUTHORITATIVE_LEASE_WINDOW_MS, 5 * 60 * 1000)
})

test('execution context registry mints UUID ids independent from request ids and reuses owner lineage for waiters', () => {
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
  assert.match(owner.executionId, /^[0-9a-f-]{36}$/)
  assert.match(owner.ownerToken, /^[0-9a-f-]{36}$/)
  assert.notEqual(owner.executionId, owner.ownerRequestId)
  assert.notEqual(owner.executionId, owner.ownerToken)
  assert.equal(owner.attemptKind, 'PRIMARY')
  assert.equal(owner.executionMode, 'PRE_STAGE3_PREPARATION')
  assert.equal(owner.leaseVersion, 1)
  assert.equal(owner.leaseAcquiredAt, '2026-09-06T18:22:00.000Z')
  assert.equal(owner.leaseExpiresAt, '2026-09-06T18:27:00.000Z')
  assert.equal(registry.getActiveContextCount(), 1)
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
  assert.equal(registry.getActiveContextCount(), 0)

  const recovery = registry.getOrCreateContext({
    operationFamily: 'VERIFICATION',
    logicalArtifactKey: 'logical-verification',
    ownerRequestId: 'req-owner',
    attemptKind: 'RECOVERY',
    executionMode: 'RECOVERY_RESUME',
    recoveredFromExecutionId: initial.executionId,
    observedAt: '2026-09-06T18:24:00.000Z',
  })

  assert.notEqual(recovery.executionId, initial.executionId)
  assert.notEqual(recovery.ownerToken, initial.ownerToken)
  assert.equal(recovery.attemptKind, 'RECOVERY')
  assert.equal(recovery.executionMode, 'RECOVERY_RESUME')
  assert.equal(recovery.recoveredFromExecutionId, initial.executionId)
  assert.equal(recovery.leaseAcquiredAt, '2026-09-06T18:24:00.000Z')
})

test('owner and nine waiters share one context and release it exactly once', () => {
  const registry = createForecastPreparationExecutionContextRegistry()
  const owner = registry.getOrCreateContext({
    operationFamily: 'CURRENT',
    logicalArtifactKey: 'logical-current',
    ownerRequestId: 'req-owner',
    observedAt: '2026-09-06T18:26:00.000Z',
  })

  const waiters = Array.from({ length: 9 }, (_, index) => registry.getOrCreateContext({
    operationFamily: 'CURRENT',
    logicalArtifactKey: 'logical-current',
    ownerRequestId: 'req-owner',
    observedAt: `2026-09-06T18:26:${String(index + 1).padStart(2, '0')}.000Z`,
  }))

  assert.equal(new Set(waiters.map((context) => context.executionId)).size, 1)
  assert.ok(waiters.every((context) => context.executionId === owner.executionId))
  assert.ok(waiters.every((context) => context.ownerToken === owner.ownerToken))
  assert.equal(registry.getActiveContextCount(), 1)

  registry.releaseContext(owner.executionId)
  assert.equal(registry.getActiveContextCount(), 0)
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
    attemptKind: 'RECOVERY',
    executionMode: 'RECOVERY_RESUME',
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

  assert.equal(record.attemptKind, 'RECOVERY')
  assert.equal(record.executionMode, 'RECOVERY_RESUME')
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

test('passive waiter events cannot advance authoritative lease state', () => {
  const executionId = '29c08242-9dad-40bf-9136-2400c21c7dbb'
  let record = reduceForecastPreparationExecution(null, {
    executionId,
    logicalArtifactKey: 'logical-current',
    operationFamily: 'CURRENT',
    logicalArtifactIdentity: currentIdentity,
    requestId: 'req-owner',
    ownerRequestId: 'req-owner',
    role: 'OWNER',
    eventType: 'single_flight_owner_acquired',
    observedAt: '2026-09-07T12:00:00.000Z',
    attemptKind: 'PRIMARY',
    executionMode: 'PRE_STAGE3_PREPARATION',
    ownerToken: 'owner-token-3',
    leaseVersion: 1,
    leaseAcquiredAt: '2026-09-07T12:00:00.000Z',
    leaseExpiresAt: '2026-09-07T12:05:00.000Z',
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
    observedAt: '2026-09-07T12:00:01.000Z',
    leaseVersion: 99,
    leaseAcquiredAt: '2026-09-07T12:00:01.000Z',
    leaseExpiresAt: '2026-09-07T13:00:00.000Z',
    recoveredFromExecutionId: 'spoofed-recovery',
  })

  assert.equal(record.leaseVersion, 1)
  assert.equal(record.leaseAcquiredAt, '2026-09-07T12:00:00.000Z')
  assert.equal(record.leaseExpiresAt, '2026-09-07T12:05:00.000Z')
  assert.equal(record.recoveredFromExecutionId, null)
  assert.equal(record.waiterCount, 1)
  assert.equal(record.latestRole, 'WAITER')
})

test('corrective migration keeps historical progress semantics and removes misleading defaults additively', () => {
  const migration = readFileSync(
    new URL('../prisma-market-data/migrations/20260906235500_forecast_execution_ledger_stage2_contract_fix/migration.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /ADD COLUMN "attemptKind" TEXT/)
  assert.match(migration, /"executionMode" = CASE\s+WHEN "executionMode" = 'RECOVERY' THEN 'RECOVERY_RESUME'\s+ELSE 'PRE_STAGE3_PREPARATION'/)
  assert.match(migration, /"lastProgressAt" = COALESCE\(\s+"persistenceCompletedAt",\s+"persistenceStartedAt",\s+"computeCompletedAt",\s+"computeStartedAt",\s+"startedAt"/)
  assert.match(migration, /"leaseExpiresAt" = "startedAt"/)
  assert.match(migration, /ALTER COLUMN "executionMode" DROP DEFAULT/)
  assert.match(migration, /ALTER COLUMN "ownerToken" DROP DEFAULT/)
  assert.match(migration, /ALTER COLUMN "leaseAcquiredAt" DROP DEFAULT/)
  assert.match(migration, /ALTER COLUMN "leaseExpiresAt" DROP DEFAULT/)
  assert.match(migration, /ALTER COLUMN "lastProgressAt" DROP DEFAULT/)
})

test('stage 3 migration enforces one active durable owner per logical artifact key', () => {
  const migration = readFileSync(
    new URL('../prisma-market-data/migrations/20260907_forecast_stage3_canonical_execution_admission/migration.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /CREATE UNIQUE INDEX "forecast_preparation_execution_ledger_active_owner_uidx"/)
  assert.match(migration, /WHERE "executionStatus" = 'STARTED'/)
  assert.match(migration, /CREATE INDEX "forecast_preparation_execution_ledger_active_lookup_idx"/)
})

test('default execution admission falls back to in-memory coordination when the ledger relation is unavailable', async () => {
  const previousUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousPrisma = globalThis.__sgRuntimeMarketDataPrisma__
  let transactionAttempts = 0

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-ledger.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $transaction: async () => {
      transactionAttempts += 1
      throw new Error('Raw query failed. Code: `42P01`. Message: `relation "forecast_preparation_execution_ledger" does not exist`')
    },
  } as never

  try {
    const admission = createDefaultForecastPreparationExecutionAdmission()
    const owner = await admission.acquireExecution({
      operationFamily: 'CURRENT',
      logicalArtifactKey: 'legacy-ledger-current',
      logicalArtifactIdentity: currentIdentity,
      requestId: 'req-owner',
      ownerRequestId: 'req-owner',
      observedAt: '2026-09-11T16:00:00.000Z',
    })

    assert.equal(owner.role, 'OWNER')
    if (owner.role !== 'OWNER') {
      throw new Error('Expected owner admission from in-memory legacy fallback.')
    }

    const waiter = await admission.acquireExecution({
      operationFamily: 'CURRENT',
      logicalArtifactKey: 'legacy-ledger-current',
      logicalArtifactIdentity: currentIdentity,
      requestId: 'req-waiter',
      ownerRequestId: 'req-owner',
      observedAt: '2026-09-11T16:00:01.000Z',
    })

    assert.equal(waiter.role, 'WAITER')

    const latest = await admission.readLatestExecutionForLogicalArtifact('legacy-ledger-current')
    assert.ok(latest)
    assert.equal(latest?.executionId, owner.ownership.executionId)
    assert.equal(latest?.waiterCount, 1)
    assert.equal(transactionAttempts, 1)
  } finally {
    if (previousUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousUrl
    }

    globalThis.__sgRuntimeMarketDataPrisma__ = previousPrisma
  }
})

test('execution ledger relation probe casts regclass to text for Prisma compatibility', async () => {
  let observedQuery = ''

  const available = await hasForecastPreparationExecutionLedgerRelation({
    async $queryRaw(query) {
      observedQuery = Array.isArray(query.strings) ? query.strings.join(' ') : String(query)
      return [{ relation: 'public.forecast_preparation_execution_ledger' }]
    },
  } as never)

  assert.equal(available, true)
  assert.match(observedQuery, /to_regclass\('public\.forecast_preparation_execution_ledger'\)::text AS relation/)
})