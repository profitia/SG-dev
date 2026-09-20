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
  shouldRequeueSucceededPreparationJob,
  type ClaimedForecastPreparationJob,
  type ForecastPreparationQueueService,
} from '@/lib/forecast/preparation-queue'

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

test('adaptive period verification rotates only the affected durable job identity', () => {
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
  assert.equal(rollingDaily, legacyJobKey({ kind: 'VERIFICATION', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' }))
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
  const queue = {
    claimNext: async () => job,
    heartbeat: async () => undefined,
    complete: async () => { events.push('complete') },
    continueAfterSlice: async () => { events.push('continue') },
    failOrRetry: async () => { events.push('retry') },
  } as unknown as ForecastPreparationQueueService
  return { queue, events }
}

test('durable queue migration defines constrained scheduling state and claim indexes', async () => {
  const migration = await readFile(new URL('../prisma-market-data/migrations/20260920120000_forecast_preparation_job_queue/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE "forecast_preparation_job"/)
  assert.match(migration, /'QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'SUPERSEDED'/)
  assert.match(migration, /forecast_preparation_job_claim_idx/)
  assert.match(migration, /forecast_preparation_job_jobKey_key/)
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

test('worker checkpoints an incomplete Historical Verification slice', async () => {
  const harness = queueHarness(claimedJob('VERIFICATION'))
  const worker = createForecastPreparationWorker({
    queue: harness.queue,
    prepareVerificationSlice: async () => undefined,
    resolveReadiness: async () => ({
      fullVerificationReadiness: 'NOT_PREPARED',
      readiness: { blockers: ['FULL_HISTORICAL_PARTIAL'] },
    }) as never,
  })
  assert.equal(await worker.runOne(), true)
  assert.deepEqual(harness.events, ['continue'])
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
