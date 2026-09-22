import assert from 'node:assert/strict'
import test from 'node:test'

import type { ForecastVerificationHorizon } from '../lib/forecast/contracts'
import {
  ensureHistoricalVerificationContract,
  FORECAST_VERIFICATION_QUALITY_POLICY_VERSION,
  HISTORICAL_VERIFICATION_CONTRACT_VERSION,
  isFastHistoricalVerificationReady,
  resolveFastHistoricalVerificationReadyHorizons,
  resolveForecastVerificationQuality,
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

test('Fast Verification becomes readable when the first exact horizon reaches its lawful boundary', () => {
  const metrics = { mae: 1, rmse: 2, mase: 0.8, smape: 4, directionalAccuracy: 0.5, bias: 0 }
  const verification = Object.fromEntries(['1M', '3M', '6M', '12M'].map((label) => [
    label,
    horizon({
      horizon: label,
      origins: 24,
      expectedOrigins: 40,
      successfulOrigins: 24,
      pendingOrigins: 16,
      coverage: 24 / 40,
      metrics,
    }),
  ]))

  assert.equal(isFastHistoricalVerificationReady(verification), true)
  const summary = resolveHistoricalVerificationSummary(verification, { fullHistoryReady: false })
  assert.equal(summary.preparationState, 'FAST_READY')
  assert.equal(summary.fullHistoryReady, false)
  assert.equal(summary.status, 'AVAILABLE')

  verification['12M']!.successfulOrigins = 23
  assert.equal(isFastHistoricalVerificationReady(verification), true)
  assert.deepEqual(resolveFastHistoricalVerificationReadyHorizons(verification), ['1M', '3M', '6M'])

  verification['1M']!.successfulOrigins = 23
  verification['3M']!.successfulOrigins = 23
  verification['6M']!.successfulOrigins = 23
  assert.equal(isFastHistoricalVerificationReady(verification), false)
})

test('non-daily Fast Verification becomes lawful at the moderate-confidence boundary before FULL', () => {
  const metrics = { mae: 1, rmse: 2, mase: 0.8, smape: 4, directionalAccuracy: 0.5, bias: 0 }
  const verification = Object.fromEntries(['1M', '3M', '6M', '12M'].map((label) => [
    label,
    horizon({
      horizon: label,
      origins: 8,
      expectedOrigins: 24,
      successfulOrigins: 8,
      pendingOrigins: 16,
      coverage: 8 / 24,
      metrics,
    }),
  ]))

  assert.equal(isFastHistoricalVerificationReady(verification), false)
  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'MONTHLY_AVERAGE' }), true)
  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'END_OF_PERIOD' }), true)
  assert.equal(resolveHistoricalVerificationSummary(verification, {
    fullHistoryReady: false,
    targetSemantics: 'MONTHLY_AVERAGE',
  }).preparationState, 'FAST_READY')
})

test('non-daily Fast Verification adapts to the lawful history available for each horizon', () => {
  const metrics = { mae: 1, rmse: 2, mase: 0.8, smape: 4, directionalAccuracy: 0.5, bias: 0 }
  const verification = {
    '1M': horizon({ horizon: '1M', origins: 8, expectedOrigins: 12, successfulOrigins: 8, metrics }),
    '3M': horizon({ horizon: '3M', origins: 8, expectedOrigins: 10, successfulOrigins: 8, metrics }),
    '6M': horizon({ horizon: '6M', origins: 7, expectedOrigins: 7, successfulOrigins: 7, metrics }),
    '12M': horizon({ horizon: '12M', origins: 1, expectedOrigins: 1, successfulOrigins: 1, metrics }),
  }

  assert.equal(isFastHistoricalVerificationReady(verification), true)
  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'MONTHLY_AVERAGE' }), true)
  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'END_OF_PERIOD' }), true)

  verification['6M'].successfulOrigins = 6
  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'MONTHLY_AVERAGE' }), true)
  assert.deepEqual(
    resolveFastHistoricalVerificationReadyHorizons(verification, { targetSemantics: 'MONTHLY_AVERAGE' }),
    ['1M', '3M', '12M'],
  )
})

test('Fast Verification excludes unavailable horizons without blocking a ready exact horizon', () => {
  const metrics = { mae: 1, rmse: 2, mase: 0.8, smape: 4, directionalAccuracy: 0.5, bias: 0 }
  const verification = Object.fromEntries(['1M', '3M', '6M', '12M'].map((label) => [
    label,
    horizon({
      horizon: label,
      origins: 8,
      expectedOrigins: 8,
      successfulOrigins: 8,
      metrics,
    }),
  ]))
  verification['12M'] = horizon({ horizon: '12M', expectedOrigins: 0, successfulOrigins: 0, metrics: null })

  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'MONTHLY_AVERAGE' }), true)
  assert.deepEqual(
    resolveFastHistoricalVerificationReadyHorizons(verification, { targetSemantics: 'MONTHLY_AVERAGE' }),
    ['1M', '3M', '6M'],
  )
})

test('Daily Fast Verification adapts to available history independently per horizon', () => {
  const metrics = { mae: 1, rmse: 2, mase: 0.8, smape: 4, directionalAccuracy: 0.5, bias: 0 }
  const verification = {
    '1M': horizon({ horizon: '1M', expectedOrigins: 40, successfulOrigins: 24, metrics }),
    '3M': horizon({ horizon: '3M', expectedOrigins: 40, successfulOrigins: 18, metrics }),
    '6M': horizon({ horizon: '6M', expectedOrigins: 12, successfulOrigins: 12, metrics }),
    '12M': horizon({ horizon: '12M', expectedOrigins: 0, successfulOrigins: 0, metrics: null }),
  }

  assert.equal(isFastHistoricalVerificationReady(verification, { targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' }), true)
  assert.deepEqual(
    resolveFastHistoricalVerificationReadyHorizons(verification, { targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' }),
    ['1M', '6M'],
  )
})

test('verification quality uses 24 lawful comparisons as the versioned common denominator', () => {
  const quality = resolveForecastVerificationQuality(horizon({
    origins: 17,
    expectedOrigins: 53,
    successfulOrigins: 17,
    coverage: 17 / 53,
    metrics: {
      mae: 1,
      rmse: 2,
      mase: 0.7,
      smape: 4.3,
      directionalAccuracy: 0.71,
      bias: -0.2,
    },
  }))

  assert.equal(quality.policyVersion, FORECAST_VERIFICATION_QUALITY_POLICY_VERSION)
  assert.equal(quality.averageVerificationPercent, 95.7)
  assert.equal(quality.directionalAccuracyPercent, 71)
  assert.equal(quality.requiredOriginCount, 24)
  assert.equal(quality.comparableOriginCount, 17)
  assert.equal(quality.sampleCompletenessPercent, 17 / 24 * 100)
  assert.equal(quality.confidenceCode, 'SUFFICIENT')
  assert.equal(quality.confidenceLevel, 3)
})

test('verification quality applies the agreed integer boundaries without using expectedOrigins', () => {
  const metrics = { mae: 1, rmse: 1, mase: 1, smape: 10, directionalAccuracy: 0.5, bias: 0 }

  assert.equal(resolveForecastVerificationQuality(horizon({
    expectedOrigins: 100,
    successfulOrigins: 7,
    metrics,
  })).confidenceLevel, 1)
  assert.equal(resolveForecastVerificationQuality(horizon({
    expectedOrigins: 8,
    successfulOrigins: 8,
    metrics,
  })).confidenceLevel, 2)
  assert.equal(resolveForecastVerificationQuality(horizon({
    expectedOrigins: 17,
    successfulOrigins: 17,
    metrics,
  })).confidenceLevel, 3)
})

test('verification quality is unavailable when no lawful metric sample exists', () => {
  const quality = resolveForecastVerificationQuality(horizon({
    expectedOrigins: 24,
    successfulOrigins: 0,
    metrics: null,
  }))

  assert.equal(quality.averageVerificationPercent, null)
  assert.equal(quality.directionalAccuracyPercent, null)
  assert.equal(quality.confidenceCode, 'UNAVAILABLE')
  assert.equal(quality.confidenceLevel, null)
})

test('verification quality clamps business-facing percentages to their lawful range', () => {
  const quality = resolveForecastVerificationQuality(horizon({
    expectedOrigins: 30,
    successfulOrigins: 30,
    metrics: { mae: 1, rmse: 1, mase: 1, smape: 180, directionalAccuracy: 1.2, bias: 0 },
  }))

  assert.equal(quality.averageVerificationPercent, 0)
  assert.equal(quality.directionalAccuracyPercent, 100)
  assert.equal(quality.sampleCompletenessPercent, 100)
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
