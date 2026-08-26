import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { buildPhase21bResult, validatePhase21bResultShape } from './phase-2-1b-result.mjs'

test('result aggregation produces the exact frozen schema shape and duplicate counts', async () => {
  const schema = JSON.parse(await readFile(new URL('./stress-test-result.schema.json', import.meta.url), 'utf8'))
  const requests = Array.from({ length: 10 }, (_, index) => ({
    ok: true,
    startedMonotonicMs: index,
    endedMonotonicMs: index + 10,
    value: { status: 'AVAILABLE', cacheStatus: 'miss' },
  }))
  const context = {
    stressRunId: 'run-1', scenarioId: 'P03', virtualUserId: 'vu-1', requestId: 'request-1',
    forecastIdentity: 'identity', logicalArtifactKey: 'logical-key',
  }
  const events = [
    ...Array.from({ length: 10 }, () => ({ ...context, event: 'current_compute_start', timestamp: new Date().toISOString(), metrics: {} })),
    ...Array.from({ length: 10 }, () => ({ ...context, event: 'persistence', timestamp: new Date().toISOString(), metrics: { artifactWrites: 1 } })),
    { ...context, event: 'resource_sample', timestamp: new Date().toISOString(), metrics: { rssBytes: 104857600, cpuUserMicros: 500000, cpuSystemMicros: 250000 } },
  ]
  const result = buildPhase21bResult({
    metadata: {
      stressRunId: 'run-1', scenarioId: 'P03', environmentId: 'phase-2-1-local-isolated-v1',
      sourceRevision: '9fc9f81b5649140ff46e029f3381873a9fbb60e3',
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:01.000Z',
      concurrency: 10, keyDistribution: 'SAME_KEY', loadShape: 'SYNCHRONIZED_BURST', releaseSpreadMs: 2,
      benchmark: 'wocaes0280', modelId: 'ets', firstRunAfterStateSetup: true, repetitionNumber: 1,
      datasetFingerprint: {
        seriesId: 'wocaes0280', frequency: 'MONTHLY', lawfulObservationCount: 10,
        historyStart: '2025-01-01T00:00:00.000Z', historyEnd: '2025-10-01T00:00:00.000Z',
        historyFingerprint: 'abc', targetSemantics: 'MONTHLY_AVERAGE', horizon: '12M',
      },
    },
    requests,
    events,
    correctnessPassed: true,
  })

  assert.deepEqual(validatePhase21bResultShape(result, schema), [])
  assert.equal(result.duplicateComputeCount, 9)
  assert.equal(result.duplicateComputeRatio, 9)
  assert.equal(result.duplicateArtifactWriteCount, 9)
  assert.equal(result.cpuSeconds, 0.75)
  assert.equal(result.peakMemoryMb, 100)
})

test('result aggregation counts a transport-successful FAILED payload as an application failure', async () => {
  const result = buildPhase21bResult({
    metadata: {
      stressRunId: 'run-failed-payload', scenarioId: 'P04', environmentId: 'phase-2-1-local-isolated-v1',
      sourceRevision: '9fc9f81b5649140ff46e029f3381873a9fbb60e3',
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:01.000Z',
      concurrency: 10, keyDistribution: 'SMALL_POOL', loadShape: 'SYNCHRONIZED_BURST', releaseSpreadMs: 2,
      benchmark: 'wocaes0074,wocaes0280,usnaac0169', modelId: 'ets', firstRunAfterStateSetup: true, repetitionNumber: 1,
      datasetFingerprint: {
        seriesId: 'wocaes0074', frequency: 'DAILY', lawfulObservationCount: 10,
        historyStart: '2025-01-01T00:00:00.000Z', historyEnd: '2025-01-10T00:00:00.000Z',
        historyFingerprint: 'abc', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', horizon: '12M',
      },
    },
    requests: [{
      ok: true,
      startedMonotonicMs: 0,
      endedMonotonicMs: 10,
      value: { status: 'FAILED', reason: 'controlled failure' },
    }],
    correctnessPassed: false,
  })

  assert.equal(result.successCount, 0)
  assert.equal(result.failureCount, 1)
  assert.equal(result.errorRate, 1)
  assert.deepEqual(result.functionalOutcomes, { APPLICATION_ERROR: 1 })
})