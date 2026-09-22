import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { Prisma, type ForecastPreparationJob, type PrismaClient } from '@/generated/market-data-client'
import {
  ForecastPreparationCommandSchema,
  buildSucceededPreparationJobRequeueData,
  buildForecastPreparationJobKey,
  createForecastPreparationQueueService,
  createForecastPreparationWorker,
  resolveForecastPreparationWorkerJobKinds,
  resolveForecastPreparationWorkerMode,
  resolveVerificationProgress,
  resolveTerminalVerificationUnavailability,
  shouldRefreshCurrentBandsAfterFastVerification,
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

test('worker mode defaults safely and rejects unknown deployment configuration', () => {
  assert.equal(resolveForecastPreparationWorkerMode(undefined), 'ALL')
  assert.equal(resolveForecastPreparationWorkerMode(' current_only '), 'CURRENT_ONLY')
  assert.equal(resolveForecastPreparationWorkerMode('verification_only'), 'VERIFICATION_ONLY')
  assert.deepEqual(resolveForecastPreparationWorkerJobKinds('ALL'), ['CURRENT', 'VERIFICATION'])
  assert.deepEqual(resolveForecastPreparationWorkerJobKinds('CURRENT_ONLY'), ['CURRENT'])
  assert.deepEqual(resolveForecastPreparationWorkerJobKinds('VERIFICATION_ONLY'), ['VERIFICATION'])
  assert.throws(
    () => resolveForecastPreparationWorkerMode('current-and-verification-sometimes'),
    /must be one of ALL, CURRENT_ONLY, VERIFICATION_ONLY/,
  )
})

test('durable claim SQL binds the exact worker lane instead of relying on priority alone', async () => {
  const observedQueries: Prisma.Sql[] = []
  const prisma = {
    $queryRaw: async (query: Prisma.Sql) => {
      observedQueries.push(query)
      return []
    },
  } as unknown as PrismaClient
  const queue = createForecastPreparationQueueService({ prisma })

  assert.equal(await queue.claimNext('current-lane-sql-test', ['CURRENT']), null)
  assert.equal(observedQueries.length, 1)
  assert.match(observedQueries[0]!.sql, /job\."jobKind" IN \(\?\)/)
  assert.ok(observedQueries[0]!.values.includes('CURRENT'))
  assert.ok(!observedQueries[0]!.values.includes('VERIFICATION'))
  await assert.rejects(
    queue.claimNext('empty-lane-sql-test', []),
    /At least one Forecast preparation job kind/,
  )
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

test('verification progress reports queue wait, slice and FAST SLA independently from FULL completion', () => {
  const job = claimedJob('VERIFICATION')
  job.status = 'QUEUED'
  job.requestedAt = new Date('2026-09-20T12:00:00.000Z')
  job.startedAt = new Date('2026-09-20T12:00:30.000Z')
  job.availableAt = new Date('2026-09-20T12:01:00.000Z')
  job.sliceCount = 3
  job.checkpointJson = {
    fastReadyAt: '2026-09-20T12:01:20.000Z',
  }

  assert.deepEqual(resolveVerificationProgress(job, new Date('2026-09-20T12:01:45.000Z')), {
    phase: 'FAST_READY',
    sliceNumber: 4,
    queueWaitMs: 30_000,
    currentSliceWaitMs: 45_000,
    fastReadyAt: '2026-09-20T12:01:20.000Z',
    fastReadyElapsedMs: 80_000,
    fullReadyAt: null,
    fastSlaMs: 120_000,
    fastSlaStatus: 'MET',
  })
})

function queueHarness(job: ForecastPreparationJob | null) {
  const events: string[] = []
  const checkpoints: Array<Record<string, unknown> | undefined> = []
  const claims: Array<readonly string[]> = []
  const enqueues: Array<{ input: unknown, options: unknown }> = []
  const queue = {
    claimNext: async (_workerId: string, allowedJobKinds: readonly string[]) => {
      claims.push(allowedJobKinds)
      return job
    },
    heartbeat: async () => undefined,
    complete: async (_job: ClaimedForecastPreparationJob, checkpoint?: Record<string, unknown>) => {
      events.push('complete')
      checkpoints.push(checkpoint)
    },
    completeUnavailable: async () => { events.push('unavailable') },
    checkpointInLease: async (_job: ClaimedForecastPreparationJob, checkpoint: Record<string, unknown>) => {
      events.push('checkpoint')
      checkpoints.push(checkpoint)
    },
    continueAfterSlice: async (_job: ClaimedForecastPreparationJob, checkpoint: Record<string, unknown>) => {
      events.push('continue')
      checkpoints.push(checkpoint)
    },
    failOrRetry: async (_job: ClaimedForecastPreparationJob, _error: unknown, checkpoint?: Record<string, unknown>) => {
      events.push('retry')
      checkpoints.push(checkpoint)
    },
    enqueue: async (input: unknown, options: unknown) => {
      enqueues.push({ input, options })
      events.push('enqueue')
      return { state: 'QUEUED', reason: null, job: null }
    },
    shouldCompleteCalibrationOnly: async () => true,
  } as unknown as ForecastPreparationQueueService
  return { queue, events, checkpoints, claims, enqueues }
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

test('Naive Daily Current completion queues bounded calibration before publishing completion', async () => {
  const job = claimedJob('CURRENT')
  job.targetBasis = 'POINT_IN_TIME'
  job.targetSemantics = 'ROLLING_DAILY_POINT_IN_TIME'
  job.modelId = 'naive'
  const harness = queueHarness(job)
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
  assert.deepEqual(harness.events, ['enqueue', 'complete'])
  assert.deepEqual(harness.enqueues[0]?.input, {
    seriesId: 'series-1',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'naive',
    kind: 'VERIFICATION',
  })
  assert.equal((harness.enqueues[0]?.options as { calibrationOnly?: boolean }).calibrationOnly, true)
  assert.match((harness.enqueues[0]?.options as { correlationId: string }).correlationId, /^[0-9a-f-]{36}$/)
  assert.notEqual((harness.enqueues[0]?.options as { correlationId: string }).correlationId, 'ppf1-e2e-latest')
})

test('dedicated worker lanes pass mutually exclusive job-kind claims to the shared durable queue', async () => {
  const currentHarness = queueHarness(null)
  const verificationHarness = queueHarness(null)
  const currentWorker = createForecastPreparationWorker({
    queue: currentHarness.queue,
    workerId: 'current-fast-lane',
    mode: 'CURRENT_ONLY',
  })
  const verificationWorker = createForecastPreparationWorker({
    queue: verificationHarness.queue,
    workerId: 'verification-background-lane',
    mode: 'VERIFICATION_ONLY',
  })

  assert.equal(await currentWorker.runOne(), false)
  assert.equal(await verificationWorker.runOne(), false)
  assert.deepEqual(currentHarness.claims, [['CURRENT']])
  assert.deepEqual(verificationHarness.claims, [['VERIFICATION']])
  assert.equal(currentWorker.mode, 'CURRENT_ONLY')
  assert.equal(verificationWorker.mode, 'VERIFICATION_ONLY')
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
  assert.deepEqual(harness.events, ['checkpoint', 'checkpoint', 'checkpoint', 'continue'])
  assert.deepEqual(observedBatchSizes, [1, 2, 4, 8])
  assert.equal(harness.checkpoints.at(-1)?.nextBatchSize, 16)
  assert.equal(harness.checkpoints.at(-1)?.fullVerificationReadiness, 'NOT_PREPARED')
})

test('worker reaches Fast Verification inside one bounded lease and returns FULL continuation to fair scheduling', async () => {
  const harness = queueHarness(claimedJob('VERIFICATION'))
  const observedBatchSizes: number[] = []
  let readinessCall = 0
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async (_job, options) => {
      observedBatchSizes.push(options.maxOriginsPerRun)
      return undefined
    },
    resolveReadiness: async () => {
      readinessCall += 1
      return {
        fastVerificationReadiness: readinessCall >= 3 ? 'READY' : 'NOT_PREPARED',
        fullVerificationReadiness: 'NOT_PREPARED',
        predictionBandState: 'NOT_AVAILABLE',
        readiness: { bandsReady: false, blockers: ['FULL_HISTORICAL_PARTIAL'] },
      } as never
    },
  })

  assert.equal(await worker.runOne(), true)
  assert.deepEqual(observedBatchSizes, [1, 2, 4])
  assert.deepEqual(harness.events, ['checkpoint', 'checkpoint', 'continue'])
  assert.equal(harness.checkpoints.at(-1)?.fastVerificationReadiness, 'READY')
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
  assert.equal(typeof harness.checkpoints[0]?.fastReadyAt, 'string')
  assert.equal(harness.checkpoints[0]?.fullReadyAt, null)
})

test('Naive Daily automatically refreshes native Current bands on the first FAST transition without empirical calibration', async () => {
  const job = claimedJob('VERIFICATION')
  job.targetBasis = 'POINT_IN_TIME'
  job.targetSemantics = 'ROLLING_DAILY_POINT_IN_TIME'
  job.modelId = 'naive'
  const harness = queueHarness(job)
  let readinessCall = 0
  let refreshCount = 0
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async () => undefined,
    resolveReadiness: async () => {
      readinessCall += 1
      return {
        fastVerificationReadiness: 'READY',
        fullVerificationReadiness: 'NOT_PREPARED',
        predictionBandState: 'INSUFFICIENT_SAMPLE',
        readiness: {
          bandsReady: readinessCall > 1,
          blockers: readinessCall > 1 ? ['FULL_HISTORICAL_PARTIAL'] : ['BANDS_NOT_AVAILABLE', 'FULL_HISTORICAL_PARTIAL'],
        },
      } as never
    },
    refreshCurrentAfterCalibration: async () => {
      refreshCount += 1
      return { status: 'SUCCEEDED', results: [] } as never
    },
  })

  assert.equal(await worker.runOne(), true)
  assert.equal(refreshCount, 1)
  assert.equal(readinessCall, 2)
  assert.deepEqual(harness.events, ['continue'])
  assert.equal(harness.checkpoints[0]?.fastVerificationReadiness, 'READY')
  assert.equal(typeof harness.checkpoints[0]?.currentBandsRefreshAttemptedAt, 'string')
  assert.equal(typeof harness.checkpoints[0]?.currentBandsRefreshedAt, 'string')
})

test('Naive Daily first-FAST band refresh is not repeated after the durable attempt checkpoint', () => {
  assert.equal(shouldRefreshCurrentBandsAfterFastVerification({
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'naive',
    fastVerificationReadiness: 'READY',
    predictionBandState: 'INSUFFICIENT_SAMPLE',
    bandsReady: false,
    currentBandsRefreshAttemptedAt: null,
    currentBandsRefreshedAt: null,
  }), true)
  assert.equal(shouldRefreshCurrentBandsAfterFastVerification({
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'naive',
    fastVerificationReadiness: 'READY',
    predictionBandState: 'INSUFFICIENT_SAMPLE',
    bandsReady: false,
    currentBandsRefreshAttemptedAt: '2026-09-22T10:00:00.000Z',
    currentBandsRefreshedAt: null,
  }), false)
})

test('bounded Naive Daily calibration completes after bands are refreshed without forcing FULL verification', async () => {
  const job = claimedJob('VERIFICATION')
  job.targetBasis = 'POINT_IN_TIME'
  job.targetSemantics = 'ROLLING_DAILY_POINT_IN_TIME'
  job.modelId = 'naive'
  job.checkpointJson = { calibrationOnly: true }
  const harness = queueHarness(job)
  let readinessCall = 0
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async () => undefined,
    resolveReadiness: async () => {
      readinessCall += 1
      return {
        fastVerificationReadiness: 'READY',
        fullVerificationReadiness: 'NOT_PREPARED',
        predictionBandState: 'INSUFFICIENT_SAMPLE',
        readiness: {
          bandsReady: readinessCall > 1,
          blockers: readinessCall > 1 ? ['FULL_HISTORICAL_PARTIAL'] : ['BANDS_NOT_AVAILABLE'],
        },
      } as never
    },
    refreshCurrentAfterCalibration: async () => ({ status: 'SUCCEEDED', results: [] }) as never,
  })

  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['complete'])
  assert.equal(harness.checkpoints[0]?.calibrationOnly, true)
  assert.equal(harness.checkpoints[0]?.terminal, false)
  assert.equal(typeof harness.checkpoints[0]?.currentBandsRefreshedAt, 'string')
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
