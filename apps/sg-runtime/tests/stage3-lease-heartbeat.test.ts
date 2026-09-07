import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

import {
  startForecastExecutionLeaseHeartbeat,
} from '../lib/forecast/stage3-lease-heartbeat'
import type {
  ForecastPreparationExecutionAdmission,
  ForecastPreparationLeaseRenewalInput,
  ForecastPreparationOwnedExecutionContext,
} from '../lib/forecast/execution-ledger'

function createOwnership(leaseVersion: number): ForecastPreparationOwnedExecutionContext {
  return {
    role: 'OWNER',
    requestId: 'request-1',
    executionId: 'execution-1',
    ownerToken: 'owner-1',
    operationFamily: 'CURRENT',
    logicalArtifactKey: 'current|series|ets|hist-1',
    ownerRequestId: 'request-1',
    attemptKind: 'PRIMARY',
    executionMode: 'PRE_STAGE3_PREPARATION',
    leaseVersion,
    leaseAcquiredAt: `2026-09-07T12:00:0${leaseVersion}.000Z`,
    leaseExpiresAt: `2026-09-07T12:05:0${leaseVersion}.000Z`,
    recoveredFromExecutionId: null,
  }
}

test('scheduled heartbeat renewal and renewNow share one serialized renewal pipeline', async () => {
  let releaseFirstRenewal: (() => void) | undefined
  const firstRenewalBlocked = new Promise<void>((resolve) => {
    releaseFirstRenewal = resolve
  })
  let signalFirstRenewalStarted: (() => void) | undefined
  const firstRenewalStarted = new Promise<void>((resolve) => {
    signalFirstRenewalStarted = resolve
  })

  const leaseVersionsSeen: number[] = []
  let renewLeaseCallCount = 0
  let concurrentRenewals = 0
  let maxConcurrentRenewals = 0

  const executionAdmission = {
    async renewLease(input: ForecastPreparationLeaseRenewalInput) {
      renewLeaseCallCount += 1
      concurrentRenewals += 1
      maxConcurrentRenewals = Math.max(maxConcurrentRenewals, concurrentRenewals)
      leaseVersionsSeen.push(input.leaseVersion)

      try {
        if (renewLeaseCallCount === 1) {
          signalFirstRenewalStarted?.()
          await firstRenewalBlocked
        }

        return createOwnership(input.leaseVersion + 1)
      } finally {
        concurrentRenewals -= 1
      }
    },
  } satisfies Pick<ForecastPreparationExecutionAdmission, 'renewLease'> as ForecastPreparationExecutionAdmission

  const heartbeat = startForecastExecutionLeaseHeartbeat({
    executionAdmission,
    logicalArtifactKey: 'current|series|ets|hist-1',
    ownership: createOwnership(1),
    requestId: 'request-1',
    heartbeatIntervalMs: 5,
  })

  await firstRenewalStarted

  const joinedRenewal = heartbeat.renewNow()
  await new Promise<void>((resolve) => setImmediate(resolve))

  assert.equal(renewLeaseCallCount, 1)
  assert.equal(maxConcurrentRenewals, 1)

  releaseFirstRenewal?.()

  const renewedDuringCollision = await joinedRenewal
  assert.equal(renewedDuringCollision.leaseVersion, 2)
  assert.equal(heartbeat.getOwnership().leaseVersion, 2)

  const renewedAfterCollision = await heartbeat.renewNow()
  assert.equal(renewLeaseCallCount, 2)
  assert.deepEqual(leaseVersionsSeen, [1, 2])
  assert.equal(renewedAfterCollision.leaseVersion, 3)
  assert.equal(heartbeat.getOwnership().leaseVersion, 3)

  await heartbeat.stop()
})

test('stop waits for an in-flight scheduled renewal and does not schedule another timer afterward', async () => {
  let releaseRenewal: (() => void) | undefined
  const renewalBlocked = new Promise<void>((resolve) => {
    releaseRenewal = resolve
  })
  let signalRenewalStarted: (() => void) | undefined
  const renewalStarted = new Promise<void>((resolve) => {
    signalRenewalStarted = resolve
  })

  let renewLeaseCallCount = 0

  const executionAdmission = {
    async renewLease(input: ForecastPreparationLeaseRenewalInput) {
      renewLeaseCallCount += 1
      signalRenewalStarted?.()
      await renewalBlocked
      return createOwnership(input.leaseVersion + 1)
    },
  } satisfies Pick<ForecastPreparationExecutionAdmission, 'renewLease'> as ForecastPreparationExecutionAdmission

  const heartbeat = startForecastExecutionLeaseHeartbeat({
    executionAdmission,
    logicalArtifactKey: 'current|series|ets|hist-1',
    ownership: createOwnership(7),
    requestId: 'request-1',
    heartbeatIntervalMs: 5,
  })

  await renewalStarted

  let stopResolved = false
  const stopPromise = heartbeat.stop().then(() => {
    stopResolved = true
  })

  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(stopResolved, false)
  assert.equal(renewLeaseCallCount, 1)

  releaseRenewal?.()
  await stopPromise
  await delay(20)

  assert.equal(renewLeaseCallCount, 1)
})