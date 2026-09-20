import assert from 'node:assert/strict'
import test from 'node:test'

import {
  durableSnapshotToProgressiveSnapshot,
  type DurableForecastPreparationSnapshot,
} from '../lib/benchmark-forecast/interactive-current-preparation'
import { requestExplicitVerificationPreparationThroughDashboard } from '../lib/benchmark-forecast/interactive-current-client'

test('durable queue status projects to the existing UI progress contract', () => {
  const snapshot: DurableForecastPreparationSnapshot = {
    seriesId: 'series-1',
    modelId: 'arima',
    targetSemantics: 'MONTHLY_AVERAGE',
    targetBasis: 'MONTHLY_AVERAGE',
    current: { state: 'READY', reason: null, job: null },
    verification: {
      state: 'QUEUED',
      reason: null,
      job: {
        jobKey: 'verification-1',
        kind: 'VERIFICATION',
        status: 'QUEUED',
        seriesId: 'series-1',
        modelId: 'arima',
        targetSemantics: 'MONTHLY_AVERAGE',
        targetBasis: 'MONTHLY_AVERAGE',
        requestCount: 1,
        sliceCount: 0,
        failureCount: 0,
        requestedAt: '2026-09-20T12:00:00.000Z',
        startedAt: null,
        completedAt: null,
        failureReason: null,
      },
    },
  }
  const projected = durableSnapshotToProgressiveSnapshot(snapshot)
  assert.equal(projected.variants[0]?.currentState, 'READY')
  assert.equal(projected.variants[0]?.verificationState, 'QUEUED')
  assert.equal(projected.queuedCount, 1)
})

test('missing durable request projects to preparation-required instead of unsupported', () => {
  const snapshot: DurableForecastPreparationSnapshot = {
    seriesId: 'series-1',
    modelId: 'arima',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    targetBasis: 'POINT_IN_TIME',
    current: {
      state: 'UNSUPPORTED',
      reason: 'No preparation request has been submitted for this exact identity.',
      job: null,
    },
    verification: {
      state: 'UNSUPPORTED',
      reason: 'No preparation request has been submitted for this exact identity.',
      job: null,
    },
  }

  const projected = durableSnapshotToProgressiveSnapshot(snapshot)
  assert.equal(projected.variants[0]?.currentState, 'NOT_PREPARED')
  assert.equal(projected.variants[0]?.verificationState, 'NOT_PREPARED')
})

test('verification preparation client submits an explicit durable command', async () => {
  let observedUrl = ''
  let observedBody = ''
  const result = await requestExplicitVerificationPreparationThroughDashboard(async (url, init) => {
    observedUrl = url
    observedBody = String(init?.body)
    return new Response(JSON.stringify({ state: 'QUEUED', reason: null, job: null }), { status: 200 })
  }, { seriesId: 'series-1', modelId: 'arima', targetBasis: 'MONTHLY_AVERAGE' })
  assert.equal(observedUrl, '/api/benchmark-forecast/verification/prepare')
  assert.match(observedBody, /"seriesId":"series-1"/)
  assert.equal(result.state, 'QUEUED')
})
