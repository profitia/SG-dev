import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createInitialAdaptiveVerificationBatchCheckpoint,
  fallbackAdaptiveVerificationBatchAfterFailure,
  observeSuccessfulVerificationBatch,
  readAdaptiveVerificationBatchCheckpoint,
} from '@/lib/forecast/adaptive-verification-batching'

test('adaptive verification starts with one origin to preserve the fastest first partial result', () => {
  const initial = readAdaptiveVerificationBatchCheckpoint(null)

  assert.equal(initial.nextBatchSize, 1)
  assert.equal(initial.decision, 'INITIAL')
})

test('adaptive verification grows by only one bounded step when a slice has headroom', () => {
  const initial = createInitialAdaptiveVerificationBatchCheckpoint()
  const afterOne = observeSuccessfulVerificationBatch(initial, {
    batchSize: 1,
    sliceMs: 6_000,
    originCount: 1,
  })
  const afterTwo = observeSuccessfulVerificationBatch(afterOne, {
    batchSize: 2,
    sliceMs: 12_000,
    originCount: 2,
  })

  assert.equal(afterOne.nextBatchSize, 2)
  assert.equal(afterOne.decision, 'GROW')
  assert.equal(afterTwo.nextBatchSize, 4)
  assert.equal(afterTwo.decision, 'GROW')
})

test('adaptive verification holds a batch close to the target envelope', () => {
  const state = {
    ...createInitialAdaptiveVerificationBatchCheckpoint(),
    nextBatchSize: 2,
    ewmaMsPerOrigin: 26_000,
  }
  const observed = observeSuccessfulVerificationBatch(state, {
    batchSize: 2,
    sliceMs: 52_000,
    originCount: 2,
  })

  assert.equal(observed.nextBatchSize, 2)
  assert.equal(observed.decision, 'HOLD')
})

test('adaptive verification resets to one after a hard overrun or failure', () => {
  const state = {
    ...createInitialAdaptiveVerificationBatchCheckpoint(),
    nextBatchSize: 16,
  }
  const overrun = observeSuccessfulVerificationBatch(state, {
    batchSize: 16,
    sliceMs: 121_000,
    originCount: 16,
  })
  const failed = fallbackAdaptiveVerificationBatchAfterFailure(state, 'worker failure')

  assert.equal(overrun.nextBatchSize, 1)
  assert.equal(overrun.decision, 'FALLBACK')
  assert.equal(failed.nextBatchSize, 1)
  assert.equal(failed.decision, 'FALLBACK')
})

test('invalid or legacy checkpoint data fails safely to the initial batch', () => {
  assert.equal(readAdaptiveVerificationBatchCheckpoint({ nextBatchSize: 32 }).nextBatchSize, 1)
  assert.equal(readAdaptiveVerificationBatchCheckpoint({
    schemaVersion: 'adaptive-verification-batch-v1',
    policyVersion: 'unexpected',
    nextBatchSize: 32,
  }).nextBatchSize, 1)
})
