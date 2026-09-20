import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import type { ForecastPreparationJob } from '@/generated/market-data-client'
import {
  createForecastPreparationWorker,
  type ClaimedForecastPreparationJob,
  type ForecastPreparationQueueService,
} from '@/lib/forecast/preparation-queue'

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
