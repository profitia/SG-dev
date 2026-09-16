import assert from 'node:assert/strict'
import test from 'node:test'

import type { ForecastVerificationHorizon } from '../lib/forecast/contracts'
import {
  ensureHistoricalVerificationContract,
  HISTORICAL_VERIFICATION_CONTRACT_VERSION,
  resolveHistoricalVerificationHorizon,
  resolveHistoricalVerificationSummary,
} from '../lib/forecast/historical-verification-policy'

function horizon(input: Partial<ForecastVerificationHorizon>): ForecastVerificationHorizon {
  return {
    horizon: '1M',
    horizonSteps: 1,
    origins: 0,
    expectedOrigins: 0,
    successfulOrigins: 0,
    failedOrigins: 0,
    coverage: 0,
    metrics: null,
    records: [],
    failures: [],
    ...input,
  }
}

test('zero lawful out-of-sample origins reports INSUFFICIENT_HISTORY', () => {
  const resolved = resolveHistoricalVerificationHorizon(horizon({}))

  assert.equal(resolved.status, 'INSUFFICIENT_HISTORY')
  assert.equal(resolved.originCount, 0)
  assert.equal(resolved.warningCode, 'NO_LAWFUL_OUT_OF_SAMPLE_ORIGIN')
})

test('small lawful sample reports LIMITED_SAMPLE with factual counts', () => {
  const resolved = resolveHistoricalVerificationHorizon(horizon({
    origins: 7,
    expectedOrigins: 9,
    successfulOrigins: 7,
    failedOrigins: 2,
    coverage: 7 / 9,
  }))

  assert.equal(resolved.status, 'LIMITED_SAMPLE')
  assert.equal(resolved.originCount, 7)
  assert.equal(resolved.expectedOriginCount, 9)
  assert.equal(resolved.failedOriginCount, 2)
  assert.equal(resolved.warningCode, 'SMALL_SAMPLE')
})

test('24 lawful origins report AVAILABLE without changing metric definitions', () => {
  const metrics = { mae: 1, rmse: 2, mase: 3, smape: 4, directionalAccuracy: 0.5, bias: -1 }
  const input = horizon({
    origins: 24,
    expectedOrigins: 24,
    successfulOrigins: 24,
    coverage: 1,
    metrics,
  })
  const resolved = resolveHistoricalVerificationSummary({ '1M': input })

  assert.equal(resolved.contractVersion, HISTORICAL_VERIFICATION_CONTRACT_VERSION)
  assert.equal(resolved.status, 'AVAILABLE')
  assert.equal(resolved.originCount, 24)
  assert.deepEqual(input.metrics, metrics)
})

test('all failed lawful origins report FAILED instead of successful verification', () => {
  const resolved = resolveHistoricalVerificationSummary({
    '1M': horizon({ expectedOrigins: 4, failedOrigins: 4, coverage: 0 }),
  })

  assert.equal(resolved.status, 'FAILED')
  assert.equal(resolved.originCount, 0)
  assert.equal(resolved.failedOriginCount, 4)
})

test('empty verification artifact reports NOT_PREPARED', () => {
  const resolved = resolveHistoricalVerificationSummary({})

  assert.equal(resolved.status, 'NOT_PREPARED')
  assert.equal(resolved.originCount, 0)
})

test('unprepared and failed verification responses always expose a factual Historical Verification object', () => {
  const notPrepared = ensureHistoricalVerificationContract({
    status: 'NOT_AVAILABLE',
    seriesId: 'generic.series',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    reason: 'PREPARATION_REQUIRED',
  })
  const failed = ensureHistoricalVerificationContract({
    status: 'FAILED',
    seriesId: 'generic.series',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    reason: 'MODEL_FIT_FAILED',
  })

  assert.equal(notPrepared.historicalVerification.status, 'NOT_PREPARED')
  assert.equal(failed.historicalVerification.status, 'FAILED')
})
