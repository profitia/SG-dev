import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluatePhase21Readiness } from './phase-2-1-readiness.mjs'

test('Phase 2.1A validates all 27 readiness conditions from content evidence', async () => {
  const result = await evaluatePhase21Readiness()

  assert.equal(result.contractVersion, 1)
  assert.equal(result.contractDrift, false)
  assert.equal(result.gate, 'PASS')
  assert.equal(result.fullBaselineStarted, false)
  assert.equal(result.loadRequestsExecuted, 0)
  assert.equal(result.environment.present, true)
  assert.equal(result.environment.nonProductionConfirmed, true)
  assert.equal(result.environment.isolatedDatabaseConfirmed, true)
  assert.equal(result.environment.runtimeSmokeConfirmed, true)
  assert.equal(result.snapshots.present, true)
  assert.equal(result.snapshots.immutableSnapshotsConfirmed, true)
  assert.deepEqual(result.evidence, {
    telemetry: true,
    databaseObservability: true,
    correctness: true,
    runtimeSmoke: true,
    resultSchemaValidation: true,
  })
  assert.equal(result.conditions.length, 27)
  assert.deepEqual(result.conditions.map(({ id }) => id), Array.from({ length: 27 }, (_, index) => index + 1))
  assert.ok(result.conditions.every(({ status }) => status === 'PASS'))
  assert.equal(result.barrierSmoke.mode, 'DRY_RUN_NO_NETWORK')
  assert.equal(result.barrierSmoke.fullStressExecuted, false)
})

test('Phase 2.1 readiness evaluation never unlocks mandatory load concurrency', async () => {
  const result = await evaluatePhase21Readiness()

  assert.equal(result.loadRequestsExecuted, 0)
  assert.ok(result.barrierSmoke.actualRequests < 10)
})