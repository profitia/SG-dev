import assert from 'node:assert/strict'
import test from 'node:test'

import type { ForecastVerificationRecord } from '../lib/forecast/contracts'
import { calculateForecastVerificationMetrics } from '../lib/forecast/verification-metrics'

function record(input: Partial<ForecastVerificationRecord>): ForecastVerificationRecord {
  return {
    benchmarkId: 'generic.series',
    modelId: 'naive',
    forecastOrigin: '2026-01-01T00:00:00.000Z',
    horizon: '1M',
    horizonSteps: 1,
    forecastDate: '2026-02-01T00:00:00.000Z',
    actualObservedAt: '2026-02-01T00:00:00.000Z',
    originValue: 100,
    forecastValue: 110,
    actualValue: 100,
    error: 10,
    absoluteError: 10,
    delta: 10,
    deltaPct: 0.1,
    maseScale: 5,
    metadata: null,
    ...input,
  }
}

test('canonical verification metrics expose sMAPE in percentage points', () => {
  const metrics = calculateForecastVerificationMetrics([record({})])

  assert.ok(metrics)
  assert.equal(metrics.smape, (20 / 210) * 100)
  assert.equal(metrics.directionalAccuracy, 0)
  assert.equal(metrics.mae, 10)
  assert.equal(metrics.mase, 2)
})

test('canonical verification metrics preserve perfect zero-valued comparisons', () => {
  const metrics = calculateForecastVerificationMetrics([record({
    originValue: 0,
    forecastValue: 0,
    actualValue: 0,
    error: 0,
    absoluteError: 0,
    delta: 0,
    maseScale: 1,
  })])

  assert.ok(metrics)
  assert.equal(metrics.smape, 0)
  assert.equal(metrics.directionalAccuracy, 1)
})

test('canonical verification metrics fail closed for an empty record set', () => {
  assert.equal(calculateForecastVerificationMetrics([]), null)
})
