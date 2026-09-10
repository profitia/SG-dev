import assert from 'node:assert/strict'
import test from 'node:test'

import type { UserFacingForecastModelId } from '../lib/forecast/contracts'
import {
  buildStage9FinalDecision,
  ensureStage9ParityArtifactsComplete,
  isCompleteStage9ExactVerificationRun,
  isExplicitLoopbackDatabaseHost,
} from '../scripts/run-forecast-stage9-final-evidence'

function createPassingDecision(overrides: Partial<Parameters<typeof buildStage9FinalDecision>[0]> = {}) {
  return buildStage9FinalDecision({
    sourceCandidateSha: '8a12f036a486aab6e2ae482c5592e418ed8de853',
    cleanWorktree: true,
    databaseHost: '127.0.0.1',
    capabilityMatrixStatus: 'PASS',
    runtimeMatrixPass: true,
    representativePass: true,
    stage7Status: 'PASS',
    stage8Status: 'PASS',
    focusedValidationPass: true,
    dependencyProvenancePass: true,
    lawfulNonDailyPathCount: 13,
    ...overrides,
  })
}

test('stage9 loopback database host predicate accepts only explicit loopback forms', () => {
  for (const host of ['127.0.0.1', '127.0.0.1/32', '::1', '::1/128'] as const) {
    assert.equal(isExplicitLoopbackDatabaseHost(host), true)
  }

  for (const host of [null, '', '10.0.0.1', '192.168.1.1', '8.8.8.8', 'db.internal.example'] as const) {
    assert.equal(isExplicitLoopbackDatabaseHost(host), false)
  }
})

test('stage9 overall acceptance fails closed when clean worktree gate fails', () => {
  const decision = createPassingDecision({ cleanWorktree: false })
  assert.equal(decision.CLEAN_WORKTREE_REQUIRED, 'FAIL')
  assert.equal(decision.ISOLATED_POSTGRES_REQUIRED, 'PASS')
  assert.equal(decision.OVERALL_STAGE9_FINAL_ACCEPTANCE, 'FAIL')
})

test('stage9 overall acceptance fails closed when isolated Postgres gate fails', () => {
  const decision = createPassingDecision({ databaseHost: '10.0.0.1' })
  assert.equal(decision.CLEAN_WORKTREE_REQUIRED, 'PASS')
  assert.equal(decision.ISOLATED_POSTGRES_REQUIRED, 'FAIL')
  assert.equal(decision.OVERALL_STAGE9_FINAL_ACCEPTANCE, 'FAIL')
})

test('stage9 overall acceptance passes only when all required gates pass', () => {
  const decision = createPassingDecision()
  assert.equal(decision.CLEAN_WORKTREE_REQUIRED, 'PASS')
  assert.equal(decision.ISOLATED_POSTGRES_REQUIRED, 'PASS')
  assert.equal(decision.OVERALL_STAGE9_FINAL_ACCEPTANCE, 'PASS')
})

test('stage9 parity completion precondition completes the exact persisted artifact before parity', async () => {
  let partial = true
  const modelIds: readonly UserFacingForecastModelId[] = ['arima']
  const calls: string[] = []
  const readPersistedRun = async () => (
    partial
      ? { metrics: [{ origins: 12, expectedOrigins: 13, failedOrigins: 0 }] }
      : { metrics: [{ origins: 13, expectedOrigins: 13, failedOrigins: 0 }] }
  )

  assert.equal(isCompleteStage9ExactVerificationRun(await readPersistedRun()), false)

  await ensureStage9ParityArtifactsComplete(
    modelIds,
    async (modelId) => {
      calls.push(modelId)
      partial = false
    },
    async () => readPersistedRun(),
    'WEEKLY:END_OF_PERIOD:MONTHLY',
  )

  assert.deepEqual(calls, ['arima'])
  assert.equal(isCompleteStage9ExactVerificationRun(await readPersistedRun()), true)
})

test('stage9 parity completion precondition fails closed when exact artifact remains partial', async () => {
  await assert.rejects(
    ensureStage9ParityArtifactsComplete(
      ['arima'],
      async () => undefined,
      async () => ({ metrics: [{ origins: 12, expectedOrigins: 13, failedOrigins: 0 }] }),
      'MONTHLY:END_OF_PERIOD:MONTHLY',
    ),
    /Stage 9 parity requires a complete exact persisted verification artifact/,
  )
})
