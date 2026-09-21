import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { Prisma, type ForecastPreparationJob } from '@/generated/market-data-client'
import {
  ForecastPreparationCommandSchema,
  buildSucceededPreparationJobRequeueData,
  buildForecastPreparationJobKey,
  createForecastPreparationWorker,
  resolveTerminalVerificationUnavailability,
  shouldRequeueSucceededPreparationJob,
  type ClaimedForecastPreparationJob,
  type ForecastPreparationQueueService,
} from '@/lib/forecast/preparation-queue'
import {
  currentForecastRequestDiagnostics,
  resolveForecastOperationRequestId,
} from '@/lib/forecast/request-diagnostics'

test('a succeeded queue record is reopened only when its exact artifact remains missing', () => {
  assert.equal(shouldRequeueSucceededPreparationJob({
    jobStatus: 'SUCCEEDED',
    artifactReadiness: 'NOT_PREPARED',
  }), true)
  assert.equal(shouldRequeueSucceededPreparationJob({
    jobStatus: 'SUCCEEDED',
    artifactReadiness: 'STALE',
  }), true)
  assert.equal(shouldRequeueSucceededPreparationJob({
    jobStatus: 'SUCCEEDED',
    artifactReadiness: 'READY',
  }), false)
  assert.equal(shouldRequeueSucceededPreparationJob({
    jobStatus: 'RUNNING',
    artifactReadiness: 'NOT_PREPARED',
  }), false)

  const now = new Date('2026-09-20T17:04:14.091Z')
  assert.deepEqual(buildSucceededPreparationJobRequeueData(now), {
    status: 'QUEUED',
    availableAt: now,
    startedAt: null,
    completedAt: null,
    sliceCount: 0,
    failureCount: 0,
    leaseOwnerToken: null,
    leaseAcquiredAt: null,
    leaseExpiresAt: null,
    lastHeartbeatAt: null,
    checkpointJson: Prisma.DbNull,
    failureCode: null,
    failureReason: null,
  })
})

function legacyJobKey(input: {
  kind: 'CURRENT' | 'VERIFICATION'
  targetSemantics: string
}) {
  return createHash('sha256')
    .update(['PPF1_DURABLE_QUEUE_V1', input.kind, 'series-1', input.targetSemantics, 'arima', 'history-1'].join('|'))
    .digest('hex')
}

test('durable command schema accepts the job kind sent by the Dashboard', () => {
  assert.deepEqual(ForecastPreparationCommandSchema.parse({
    seriesId: 'series-1',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
    kind: 'CURRENT',
  }), {
    seriesId: 'series-1',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
    kind: 'CURRENT',
  })
})

test('versioned Fast Verification policy rotates every verification job without rotating Current jobs', () => {
  const current = buildForecastPreparationJobKey({
    kind: 'CURRENT',
    seriesId: 'series-1',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
    historyFingerprint: 'history-1',
  })
  const rollingDaily = buildForecastPreparationJobKey({
    kind: 'VERIFICATION',
    seriesId: 'series-1',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
    historyFingerprint: 'history-1',
  })
  const periodVerification = buildForecastPreparationJobKey({
    kind: 'VERIFICATION',
    seriesId: 'series-1',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
    historyFingerprint: 'history-1',
  })

  assert.equal(current, legacyJobKey({ kind: 'CURRENT', targetSemantics: 'MONTHLY_AVERAGE' }))
  assert.notEqual(rollingDaily, legacyJobKey({ kind: 'VERIFICATION', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' }))
  assert.notEqual(periodVerification, legacyJobKey({ kind: 'VERIFICATION', targetSemantics: 'MONTHLY_AVERAGE' }))
})

function claimedJob(kind: 'CURRENT' | 'VERIFICATION'): ClaimedForecastPreparationJob {
  const now = new Date('2026-09-20T12:00:00.000Z')
  return {
    id: `job-${kind.toLowerCase()}`,
    jobKey: `key-${kind.toLowerCase()}`,
    jobKind: kind,
    status: 'RUNNING',
    priority: kind === 'CURRENT' ? 10 : 100,
    seriesId: 'series-1',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
    sourceFrequency: 'DAILY',
    targetCadence: 'MONTHLY',
    historyFingerprint: 'history-1',
    originCorrelationId: 'ppf1-e2e-origin',
    latestCorrelationId: 'ppf1-e2e-latest',
    requestCount: 1,
    sliceCount: 0,
    failureCount: 0,
    maxFailureCount: 5,
    availableAt: now,
    leaseOwnerToken: 'worker:token',
    leaseVersion: 1,
    leaseAcquiredAt: now,
    leaseExpiresAt: new Date('2026-09-20T12:10:00.000Z'),
    lastHeartbeatAt: now,
    dependencyJobKey: null,
    checkpointJson: null,
    failureCode: null,
    failureReason: null,
    requestedAt: now,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function queueHarness(job: ForecastPreparationJob | null) {
  const events: string[] = []
  const checkpoints: Array<Record<string, unknown> | undefined> = []
  const queue = {
    claimNext: async () => job,
    heartbeat: async () => undefined,
    complete: async (_job: ClaimedForecastPreparationJob, checkpoint?: Record<string, unknown>) => {
      events.push('complete')
      checkpoints.push(checkpoint)
    },
    completeUnavailable: async () => { events.push('unavailable') },
    continueAfterSlice: async (_job: ClaimedForecastPreparationJob, checkpoint: Record<string, unknown>) => {
      events.push('continue')
      checkpoints.push(checkpoint)
    },
    failOrRetry: async (_job: ClaimedForecastPreparationJob, _error: unknown, checkpoint?: Record<string, unknown>) => {
      events.push('retry')
      checkpoints.push(checkpoint)
    },
  } as unknown as ForecastPreparationQueueService
  return { queue, events, checkpoints }
}

test('completed verification compute with zero lawful origins is terminal instead of looping', async () => {
  const job = claimedJob('VERIFICATION')
  const harness = queueHarness(job)
  const operationResult = {
    results: [{
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'arima',
      historical: 'REUSED',
    }],
    after: {
      capabilities: [{
        identity: { targetSemantics: 'MONTHLY_AVERAGE', modelId: 'arima' },
        verificationOriginCount: 0,
      }],
    },
  } as never

  assert.match(resolveTerminalVerificationUnavailability(operationResult, {
    seriesId: 'series-1',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
  }) ?? '', /zero lawful comparisons/)

  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async () => operationResult,
    resolveReadiness: async () => ({
      fullVerificationReadiness: 'NOT_PREPARED',
      readiness: { blockers: ['FULL_HISTORICAL_PARTIAL'] },
    }) as never,
  })
  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['unavailable'])
})

test('rolling daily verification continues when a bounded slice persisted a lawful origin', () => {
  const operationResult = {
    results: [{
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      modelId: 'arima',
      historical: 'READY',
      historicalProgressOriginCount: 1,
    }],
    after: {
      capabilities: [{
        identity: { targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', modelId: 'arima' },
        verificationOriginCount: 0,
      }],
    },
  } as never

  assert.equal(resolveTerminalVerificationUnavailability(operationResult, {
    seriesId: 'series-1',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  }), null)
})

test('rolling daily verification is terminal only when a bounded slice cannot add another lawful origin', () => {
  const operationResult = {
    results: [{
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      modelId: 'arima',
      historical: 'REUSED',
      historicalProgressOriginCount: 0,
    }],
    after: {
      capabilities: [{
        identity: { targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', modelId: 'arima' },
        verificationOriginCount: 0,
      }],
    },
  } as never

  assert.match(resolveTerminalVerificationUnavailability(operationResult, {
    seriesId: 'series-1',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  }) ?? '', /zero lawful comparisons/)
})

test('durable queue migration defines constrained scheduling state and claim indexes', async () => {
  const migration = await readFile(new URL('../prisma-market-data/migrations/20260920120000_forecast_preparation_job_queue/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE "forecast_preparation_job"/)
  assert.match(migration, /'QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'SUPERSEDED'/)
  assert.match(migration, /forecast_preparation_job_claim_idx/)
  assert.match(migration, /forecast_preparation_job_jobKey_key/)
})

test('correlation migration keeps legacy jobs compatible and adds the lookup index', async () => {
  const migration = await readFile(new URL('../prisma-market-data/migrations/20260920202000_forecast_e2e_correlation_id/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN "originCorrelationId" TEXT/)
  assert.match(migration, /ADD COLUMN "latestCorrelationId" TEXT/)
  assert.match(migration, /forecast_preparation_job_correlation_idx/)
})

test('worker completes a Current job through the canonical preparation owner', async () => {
  const harness = queueHarness(claimedJob('CURRENT'))
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareCurrent: async (input) => ({
      ...input,
      operation: 'CURRENT_FORECAST',
      status: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 1,
      reason: null,
    }),
  })
  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['complete'])
})

test('observability persistence cannot turn a completed Forecast job into a retry', async () => {
  const harness = queueHarness(claimedJob('CURRENT'))
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareCurrent: async (input) => ({
      ...input,
      operation: 'CURRENT_FORECAST',
      status: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 1,
      reason: null,
    }),
    recordArtifactReady: async () => { throw new Error('telemetry unavailable') },
    persistResourceSummary: async () => { throw new Error('ledger unavailable') },
  })

  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['complete'])
})

test('worker preserves the durable user correlation in compute diagnostics', async () => {
  const harness = queueHarness(claimedJob('CURRENT'))
  let observedRequestId: string | null = null
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    workerId: 'worker-correlation-test',
    prepareCurrent: async (input) => {
      observedRequestId = currentForecastRequestDiagnostics()?.requestId ?? null
      assert.equal(resolveForecastOperationRequestId(() => 'unexpected-fallback'), 'ppf1-e2e-latest')
      return {
        ...input,
        operation: 'CURRENT_FORECAST',
        status: 'READY',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: 1,
        reason: null,
      }
    },
  })

  assert.equal(await worker.runOne(), true)
  assert.equal(observedRequestId, 'ppf1-e2e-latest')
  assert.deepEqual(harness.events, ['complete'])
})

test('worker checkpoints an incomplete Historical Verification slice', async () => {
  const harness = queueHarness(claimedJob('VERIFICATION'))
  const observedBatchSizes: number[] = []
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async (_job, options) => {
      observedBatchSizes.push(options.maxOriginsPerRun)
      return undefined
    },
    resolveReadiness: async () => ({
      fullVerificationReadiness: 'NOT_PREPARED',
      readiness: { blockers: ['FULL_HISTORICAL_PARTIAL'] },
    }) as never,
  })
  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['continue'])
  assert.deepEqual(observedBatchSizes, [1])
  assert.equal(harness.checkpoints[0]?.nextBatchSize, 2)
  assert.equal(harness.checkpoints[0]?.fullVerificationReadiness, 'NOT_PREPARED')
})

test('worker publishes Fast Verification readiness without completing the full-history job', async () => {
  const harness = queueHarness(claimedJob('VERIFICATION'))
  const readyKinds: string[] = []
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async () => undefined,
    resolveReadiness: async () => ({
      fastVerificationReadiness: 'READY',
      fullVerificationReadiness: 'NOT_PREPARED',
      readiness: { blockers: ['FULL_HISTORICAL_PARTIAL'] },
    }) as never,
    recordArtifactReady: async (_jobKey, kind) => {
      readyKinds.push(kind)
    },
  })

  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['continue'])
  assert.deepEqual(readyKinds, ['VERIFICATION'])
  assert.equal(harness.checkpoints[0]?.fastVerificationReadiness, 'READY')
  assert.equal(harness.checkpoints[0]?.fullVerificationReadiness, 'NOT_PREPARED')
})

test('worker resumes from the durable adaptive batch checkpoint', async () => {
  const job = claimedJob('VERIFICATION')
  job.checkpointJson = {
    schemaVersion: 'adaptive-verification-batch-v1',
    policyVersion: 'PPF1_ADAPTIVE_VERIFICATION_BATCH_V1',
    nextBatchSize: 4,
    lastBatchSize: 2,
    lastSliceMs: 12_000,
    lastOriginCount: 2,
    ewmaMsPerOrigin: 6_000,
    successfulSliceCount: 2,
    fallbackCount: 0,
    decision: 'GROW',
    reason: 'test',
  }
  const harness = queueHarness(job)
  const observedBatchSizes: number[] = []
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async (_claimed, options) => {
      observedBatchSizes.push(options.maxOriginsPerRun)
      return undefined
    },
    resolveReadiness: async () => ({
      fullVerificationReadiness: 'READY',
      readiness: { blockers: [] },
    }) as never,
  })

  assert.equal(await worker.runOne(), true)
  assert.deepEqual(observedBatchSizes, [4])
  assert.deepEqual(harness.events, ['complete'])
  assert.equal(harness.checkpoints[0]?.terminal, true)
  assert.equal(harness.checkpoints[0]?.fullVerificationReadiness, 'READY')
})

test('worker resets adaptive verification to one origin after a retryable slice failure', async () => {
  const job = claimedJob('VERIFICATION')
  job.checkpointJson = {
    schemaVersion: 'adaptive-verification-batch-v1',
    policyVersion: 'PPF1_ADAPTIVE_VERIFICATION_BATCH_V1',
    nextBatchSize: 8,
    lastBatchSize: 4,
    lastSliceMs: 30_000,
    lastOriginCount: 4,
    ewmaMsPerOrigin: 7_500,
    successfulSliceCount: 3,
    fallbackCount: 0,
    decision: 'GROW',
    reason: 'test',
  }
  const harness = queueHarness(job)
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async () => { throw new Error('transient verification failure') },
  })

  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['retry'])
  assert.equal(harness.checkpoints[0]?.nextBatchSize, 1)
  assert.equal(harness.checkpoints[0]?.decision, 'FALLBACK')
})

test('worker marks retryable failure without claiming a second job', async () => {
  const harness = queueHarness(claimedJob('CURRENT'))
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareCurrent: async () => { throw new Error('transient') },
  })
  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['retry'])
})
