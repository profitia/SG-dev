import test from 'node:test'
import assert from 'node:assert/strict'

import { createDashboardRecordQueryRuntime } from '@/lib/raw-data/dashboard-record-query'

type DiagnosticEvent = {
  event: string
  fields: Record<string, unknown>
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function countEvents(events: DiagnosticEvent[], event: string) {
  return events.filter((entry) => entry.event === event).length
}

test('coalesces ten concurrent same-key misses into one owner read and releases the entry', async () => {
  const query = createDeferred<unknown[]>()
  const events: DiagnosticEvent[] = []
  let connectCount = 0
  let queryCount = 0
  const records = [{ id: 'record-1' }]
  const runtime = createDashboardRecordQueryRuntime({
    diagnosticEvent: (event, fields = {}) => events.push({ event, fields }),
    getClient: () => ({
      $connect: async () => {
        connectCount += 1
      },
      drDashboardIndexRecord: {
        findMany: async () => {
          queryCount += 1
          return query.promise
        },
      },
    }),
    now: () => 1_000,
  })

  const pending = Array.from({ length: 9 }, () => runtime.listDashboardRecordsWithMetrics({
    organizationId: 'org-1',
    pipelineId: 'pipeline-1',
  }))

  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(runtime.activeEntryCount(), 1)
  assert.equal(connectCount, 1)
  assert.equal(queryCount, 1)
  pending.push(runtime.listDashboardRecordsWithMetrics({
    organizationId: 'org-1',
    pipelineId: 'pipeline-1',
  }))

  query.resolve(records)
  const results = await Promise.all(pending)

  assert.equal(results.length, 10)
  assert.ok(results.every((result) => result.records === results[0].records))
  assert.equal(runtime.activeEntryCount(), 0)
  assert.equal(countEvents(events, 'owner_acquired'), 1)
  assert.equal(countEvents(events, 'joiner_acquired'), 9)
  assert.equal(countEvents(events, 'underlying_read_started'), 1)
  assert.equal(countEvents(events, 'underlying_read_completed'), 1)
  assert.equal(countEvents(events, 'entry_released'), 1)
  assert.equal(events.find((entry) => entry.event === 'entry_released')?.fields.activeEntries, 0)
})

test('keeps distinct organization and pipeline keys independently executable', async () => {
  const pendingQueries = new Map<string, ReturnType<typeof createDeferred<unknown[]>>>()
  const observedWhere: unknown[] = []
  let queryCount = 0
  const runtime = createDashboardRecordQueryRuntime({
    diagnosticEvent: () => undefined,
    getClient: () => ({
      $connect: async () => undefined,
      drDashboardIndexRecord: {
        findMany: async ({ where }) => {
          queryCount += 1
          observedWhere.push(where)
          const key = JSON.stringify({
            organizationId: where.organizationId ?? null,
            pipelineId: where.pipelineId ?? null,
          })
          const query = createDeferred<unknown[]>()
          pendingQueries.set(key, query)
          return query.promise
        },
      },
    }),
    now: () => 1_000,
  })
  const filters = [
    {},
    { organizationId: 'org-1' },
    { pipelineId: 'pipeline-1' },
    { organizationId: 'org-1', pipelineId: 'pipeline-1' },
    { organizationId: 'org-2', pipelineId: 'pipeline-1' },
    { organizationId: 'org-1', pipelineId: 'pipeline-2' },
  ]

  const pending = filters.map((filter) => runtime.listDashboardRecordsWithMetrics(filter))
  await new Promise<void>((resolve) => setImmediate(resolve))

  assert.equal(queryCount, filters.length)
  assert.equal(runtime.activeEntryCount(), filters.length)
  assert.deepEqual(observedWhere[3], {
    organizationId: 'org-1',
    pipelineId: 'pipeline-1',
    id: undefined,
    componentName: undefined,
    componentCode: undefined,
    scenarioType: undefined,
    deletedAt: null,
  })

  for (const [key, query] of pendingQueries) {
    query.resolve([{ id: key }])
  }
  await Promise.all(pending)

  assert.equal(runtime.activeEntryCount(), 0)
})

test('propagates one owner failure to joiners, releases the entry, and permits retry', async () => {
  const firstQuery = createDeferred<unknown[]>()
  const failure = new Error('application read failed')
  const events: DiagnosticEvent[] = []
  let queryCount = 0
  const retryRecords = [{ id: 'retry-record' }]
  const runtime = createDashboardRecordQueryRuntime({
    diagnosticEvent: (event, fields = {}) => events.push({ event, fields }),
    getClient: () => ({
      $connect: async () => undefined,
      drDashboardIndexRecord: {
        findMany: async () => {
          queryCount += 1
          return queryCount === 1 ? firstQuery.promise : retryRecords
        },
      },
    }),
    now: () => 1_000,
  })

  const pending = Array.from({ length: 10 }, () => runtime.listDashboardRecordsWithMetrics({
    organizationId: 'org-1',
    pipelineId: 'pipeline-1',
  }))
  await new Promise<void>((resolve) => setImmediate(resolve))
  firstQuery.reject(failure)
  const settled = await Promise.allSettled(pending)

  assert.ok(settled.every((result) => result.status === 'rejected' && result.reason === failure))
  assert.equal(queryCount, 1)
  assert.equal(runtime.activeEntryCount(), 0)
  assert.equal(countEvents(events, 'underlying_read_failed'), 1)
  assert.equal(countEvents(events, 'owner_failed'), 1)
  assert.equal(countEvents(events, 'joiner_failed'), 9)
  assert.equal(countEvents(events, 'entry_released'), 1)

  const retry = await runtime.listDashboardRecordsWithMetrics({
    organizationId: 'org-1',
    pipelineId: 'pipeline-1',
  })

  assert.equal(queryCount, 2)
  assert.equal(retry.records, retryRecords)
  assert.equal(runtime.activeEntryCount(), 0)
})

test('preserves the 30-second result-cache hit and expiry boundary', async () => {
  let currentTime = 1_000
  let queryCount = 0
  const records = [{ id: 'record-1' }]
  const events: DiagnosticEvent[] = []
  const runtime = createDashboardRecordQueryRuntime({
    diagnosticEvent: (event, fields = {}) => events.push({ event, fields }),
    getClient: () => ({
      $connect: async () => undefined,
      drDashboardIndexRecord: {
        findMany: async () => {
          queryCount += 1
          return records
        },
      },
    }),
    now: () => currentTime,
  })
  const filters = { organizationId: 'org-1', pipelineId: 'pipeline-1' }

  const first = await runtime.listDashboardRecordsWithMetrics(filters)
  currentTime += 30_000
  const boundaryHit = await runtime.listDashboardRecordsWithMetrics(filters)
  currentTime += 1
  const expiredMiss = await runtime.listDashboardRecordsWithMetrics(filters)

  assert.equal(first.records, records)
  assert.equal(boundaryHit.records, records)
  assert.equal(expiredMiss.records, records)
  assert.equal(queryCount, 2)
  assert.equal(countEvents(events, 'cache_hit'), 1)
  assert.equal(countEvents(events, 'owner_acquired'), 2)
  assert.equal(runtime.activeEntryCount(), 0)
})