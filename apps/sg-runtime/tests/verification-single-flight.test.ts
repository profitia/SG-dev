import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVerificationLogicalArtifactKey,
  VerificationForecastSingleFlight,
  type VerificationLogicalArtifactIdentity,
  type VerificationSingleFlightEvent,
} from '../lib/forecast/verification-single-flight'

const identity: VerificationLogicalArtifactIdentity = {
  seriesId: 'wocaes0280',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  modelId: 'naive',
  inputSource: 'DYNAMIC_MARKET_DATA_STORE',
  historyFingerprint: 'history-a',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  verificationHorizonSetId: '{"1M":1,"3M":3,"6M":6,"12M":12}',
  verificationConfigurationId: '{"minTrainingWindow":36}',
  originPolicyId: 'EXPANDING_WINDOW_ROLLING_ORIGIN@expanding-window-rolling-origin-v1',
}

test('Verification logical key is deterministic, exact-field isolated, and fail-closed', () => {
  const key = buildVerificationLogicalArtifactKey(identity)
  assert.equal(buildVerificationLogicalArtifactKey({ ...identity }), key)
  assert.ok(key.startsWith('9:namespace12:VERIFICATION|'))
  assert.ok(!key.startsWith('9:namespace7:CURRENT|'))

  for (const field of [
    'modelId',
    'targetSemantics',
    'targetBasis',
    'methodVersion',
    'sourceFrequency',
    'targetCadence',
    'frequencyIdentity',
    'historyFingerprint',
    'verificationHorizonSetId',
    'verificationConfigurationId',
    'originPolicyId',
  ] as const) {
    assert.notEqual(
      buildVerificationLogicalArtifactKey({ ...identity, [field]: `${identity[field]}-different` }),
      key,
      field,
    )
  }

  assert.throws(
    () => buildVerificationLogicalArtifactKey({ ...identity, originPolicyId: undefined } as never),
    /originPolicyId/,
  )
  assert.match(
    buildVerificationLogicalArtifactKey({ ...identity, inputSource: null }),
    /11:inputSource6:<NULL>/,
  )
})

test('ten exact-key Verification callers share one owner and release the entry', async () => {
  const registry = new VerificationForecastSingleFlight<{ value: number }>()
  const events: VerificationSingleFlightEvent[] = []
  let computes = 0
  let releaseOwner: (() => void) | undefined
  const ownerGate = new Promise<void>((resolve) => {
    releaseOwner = resolve
  })
  const operation = async () => {
    computes += 1
    await ownerGate
    return { value: 42 }
  }
  const key = buildVerificationLogicalArtifactKey(identity)
  const requests = Array.from({ length: 10 }, (_, index) => registry.run({
    logicalArtifactKey: key,
    requestId: `request-${index + 1}`,
    operation,
    emit: (event) => events.push(event),
  }))

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(computes, 1)
  assert.equal(registry.activeEntryCount, 1)
  releaseOwner?.()
  const results = await Promise.all(requests)

  assert.equal(events.filter((event) => event === 'single_flight_owner_acquired').length, 1)
  assert.equal(events.filter((event) => event === 'single_flight_waiter_joined').length, 9)
  assert.ok(results.every((result) => result === results[0]))
  assert.equal(registry.activeEntryCount, 0)
})

test('different Verification keys run independently', async () => {
  const registry = new VerificationForecastSingleFlight<string>()
  let activeOperations = 0
  let maximumActiveOperations = 0
  let releaseOperations: (() => void) | undefined
  const operationGate = new Promise<void>((resolve) => {
    releaseOperations = resolve
  })
  const operation = async (result: string) => {
    activeOperations += 1
    maximumActiveOperations = Math.max(maximumActiveOperations, activeOperations)
    await operationGate
    activeOperations -= 1
    return result
  }

  const first = registry.run({
    logicalArtifactKey: buildVerificationLogicalArtifactKey(identity),
    requestId: 'first',
    operation: () => operation('first'),
  })
  const second = registry.run({
    logicalArtifactKey: buildVerificationLogicalArtifactKey({ ...identity, modelId: 'ets' }),
    requestId: 'second',
    operation: () => operation('second'),
  })

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(maximumActiveOperations, 2)
  releaseOperations?.()
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second'])
  assert.equal(registry.activeEntryCount, 0)
})

test('Verification owner failure is shared, cleaned up, and permits retry', async () => {
  const registry = new VerificationForecastSingleFlight<string>()
  const failure = new Error('controlled-verification-owner-failure')
  let computes = 0
  let releaseFailure: (() => void) | undefined
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve
  })
  const key = buildVerificationLogicalArtifactKey(identity)
  const operation = async () => {
    computes += 1
    await failureGate
    throw failure
  }
  const owner = registry.run({ logicalArtifactKey: key, requestId: 'owner', operation })
  const waiter = registry.run({ logicalArtifactKey: key, requestId: 'waiter', operation })

  releaseFailure?.()
  const settled = await Promise.allSettled([owner, waiter])
  assert.equal(computes, 1)
  assert.ok(settled.every((result) => result.status === 'rejected' && result.reason === failure))
  assert.equal(registry.activeEntryCount, 0)

  const retry = await registry.run({
    logicalArtifactKey: key,
    requestId: 'retry',
    operation: async () => {
      computes += 1
      return 'recovered'
    },
  })
  assert.equal(retry, 'recovered')
  assert.equal(computes, 2)
  assert.equal(registry.activeEntryCount, 0)
})

test('late arrivals join before settlement and become new owners after release', async () => {
  const registry = new VerificationForecastSingleFlight<string>()
  const events: VerificationSingleFlightEvent[] = []
  let computes = 0
  let releaseSettlement: (() => void) | undefined
  const settlementGate = new Promise<void>((resolve) => {
    releaseSettlement = resolve
  })
  const key = buildVerificationLogicalArtifactKey(identity)
  const operation = async () => {
    computes += 1
    await settlementGate
    return 'canonical'
  }
  const owner = registry.run({
    logicalArtifactKey: key,
    requestId: 'owner',
    operation,
    emit: (event) => events.push(event),
  })
  await new Promise((resolve) => setImmediate(resolve))
  const lateWaiter = registry.run({
    logicalArtifactKey: key,
    requestId: 'late-waiter',
    operation,
    emit: (event) => events.push(event),
  })

  assert.equal(events.filter((event) => event === 'single_flight_waiter_joined').length, 1)
  releaseSettlement?.()
  assert.deepEqual(await Promise.all([owner, lateWaiter]), ['canonical', 'canonical'])
  assert.equal(registry.activeEntryCount, 0)

  const postRelease = await registry.run({
    logicalArtifactKey: key,
    requestId: 'post-release-owner',
    operation: async () => {
      computes += 1
      return 'new-owner'
    },
  })
  assert.equal(postRelease, 'new-owner')
  assert.equal(computes, 2)
  assert.equal(registry.activeEntryCount, 0)
})

test('local waiter cancellation does not cancel Verification owner work', async () => {
  const registry = new VerificationForecastSingleFlight<string>()
  let computes = 0
  let releaseOwner: (() => void) | undefined
  const ownerGate = new Promise<void>((resolve) => {
    releaseOwner = resolve
  })
  const key = buildVerificationLogicalArtifactKey(identity)
  const operation = async () => {
    computes += 1
    await ownerGate
    return 'completed'
  }
  const owner = registry.run({ logicalArtifactKey: key, requestId: 'owner', operation })
  const waiter = registry.run({ logicalArtifactKey: key, requestId: 'waiter', operation })
  const localCancellation = Promise.reject(new Error('local-waiter-cancellation'))

  await assert.rejects(Promise.race([waiter, localCancellation]), /local-waiter-cancellation/)
  assert.equal(computes, 1)
  assert.equal(registry.activeEntryCount, 1)
  releaseOwner?.()
  assert.deepEqual(await Promise.all([owner, waiter]), ['completed', 'completed'])
  assert.equal(computes, 1)
  assert.equal(registry.activeEntryCount, 0)
})