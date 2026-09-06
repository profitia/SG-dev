import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canResidualCalibrateCurrent,
  createCurrentForecastStatisticalCompatibility,
  createRecentVerificationStatisticalCompatibility,
  type ForecastCalibrationIdentity,
} from '../lib/forecast/identity'
import { buildForecastHistoryFingerprint, buildOriginBoundForecastHistoryFingerprint } from '../lib/forecast/history-fingerprint'

const MONTHLY_AVERAGE_POLICY_CONTEXT = {
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  targetSemantics: 'MONTHLY_AVERAGE',
} as const

function createMonthlyHistory(values: Array<{ date: string; value: number }>) {
  const first = values[0]
  const last = values.at(-1)
  if (!first || !last) {
    throw new Error('Monthly history fixture requires at least one point.')
  }

  return {
    seriesId: 'wocaes0280',
    frequency: 'MONTHLY',
    start: first.date,
    end: last.date,
    observations: values.length,
    canonicalization: {
      method: 'PROVENANCE_QUALIFIED_NATIVE_PERIOD',
      version: 'provenance-qualified-native-period-v1',
    },
    points: values.map((point) => ({
      date: point.date,
      value: point.value,
      sourceObservedAt: null,
    })),
  } as const
}

function createCurrentCalibrationIdentity(overrides: Partial<ForecastCalibrationIdentity> = {}): ForecastCalibrationIdentity {
  const currentCompatibility = createCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const currentHistory = createMonthlyHistory([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
    { date: '2026-04-01T00:00:00.000Z', value: 40 },
    { date: '2026-05-01T00:00:00.000Z', value: 50 },
    { date: '2026-06-01T00:00:00.000Z', value: 60 },
  ])

  return {
    artifactScope: currentCompatibility.artifactScope,
    seriesId: 'wocaes0280',
    sourceSeriesId: 'wocaes0280',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: currentCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: currentCompatibility.effectiveTrainingPolicyId,
    historyFingerprint: buildForecastHistoryFingerprint(currentHistory),
    horizonLabel: '1M',
    forecastOrigin: '2026-06-01T00:00:00.000Z',
    actualObservedAt: null,
    calibrationPolicy: currentCompatibility.calibrationPolicy,
    ...overrides,
  }
}

function createRecentResidualCalibrationIdentity(
  historyValues: Array<{ date: string; value: number }>,
  overrides: Partial<ForecastCalibrationIdentity> = {},
): ForecastCalibrationIdentity {
  const recentCompatibility = createRecentVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const residualHistory = createMonthlyHistory(historyValues)

  return {
    artifactScope: recentCompatibility.artifactScope,
    seriesId: 'wocaes0280',
    sourceSeriesId: 'wocaes0280',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: recentCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: recentCompatibility.effectiveTrainingPolicyId,
    historyFingerprint: buildForecastHistoryFingerprint(residualHistory),
    horizonLabel: '1M',
    forecastOrigin: residualHistory.end,
    actualObservedAt: '2026-04-30T00:00:00.000Z',
    calibrationPolicy: recentCompatibility.calibrationPolicy,
    ...overrides,
  }
}

test('normal history growth remains calibration-compatible when origin-bound canonical fingerprint matches', () => {
  const currentHistory = createMonthlyHistory([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
    { date: '2026-04-01T00:00:00.000Z', value: 40 },
    { date: '2026-05-01T00:00:00.000Z', value: 50 },
    { date: '2026-06-01T00:00:00.000Z', value: 60 },
  ])
  const current = createCurrentCalibrationIdentity({
    historyFingerprint: buildForecastHistoryFingerprint(currentHistory),
    forecastOrigin: '2026-06-01T00:00:00.000Z',
  })
  const residual = createRecentResidualCalibrationIdentity([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
  ])

  const proof = buildOriginBoundForecastHistoryFingerprint(currentHistory, residual.forecastOrigin!)

  assert.equal(proof, residual.historyFingerprint)
  assert.equal(canResidualCalibrateCurrent(residual, current, {
    canonicalHistoryFingerprintAtResidualOrigin: proof,
  }), true)
})

test('source revision rejects calibration even when residual origin is earlier than current origin', () => {
  const revisedCurrentHistory = createMonthlyHistory([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 21 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
    { date: '2026-04-01T00:00:00.000Z', value: 40 },
    { date: '2026-05-01T00:00:00.000Z', value: 50 },
  ])
  const current = createCurrentCalibrationIdentity({
    historyFingerprint: buildForecastHistoryFingerprint(revisedCurrentHistory),
    forecastOrigin: '2026-05-01T00:00:00.000Z',
  })
  const residual = createRecentResidualCalibrationIdentity([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
  ])

  const proof = buildOriginBoundForecastHistoryFingerprint(revisedCurrentHistory, residual.forecastOrigin!)

  assert.notEqual(proof, residual.historyFingerprint)
  assert.equal(canResidualCalibrateCurrent(residual, current, {
    canonicalHistoryFingerprintAtResidualOrigin: proof,
  }), false)
})

test('same origin accepts only exact fingerprint equality', () => {
  const currentHistory = createMonthlyHistory([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
  ])
  const current = createCurrentCalibrationIdentity({
    historyFingerprint: buildForecastHistoryFingerprint(currentHistory),
    forecastOrigin: '2026-03-01T00:00:00.000Z',
  })
  const exactResidual = createRecentResidualCalibrationIdentity([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
  ])

  assert.equal(canResidualCalibrateCurrent(exactResidual, current), true)
  assert.equal(canResidualCalibrateCurrent({
    ...exactResidual,
    historyFingerprint: buildForecastHistoryFingerprint(createMonthlyHistory([
      { date: '2026-01-01T00:00:00.000Z', value: 10 },
      { date: '2026-02-01T00:00:00.000Z', value: 25 },
      { date: '2026-03-01T00:00:00.000Z', value: 30 },
    ])),
  }, current), false)
})

test('missing or malformed lineage proof fails closed', () => {
  const currentHistory = createMonthlyHistory([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
    { date: '2026-04-01T00:00:00.000Z', value: 40 },
  ])
  const current = createCurrentCalibrationIdentity({
    historyFingerprint: buildForecastHistoryFingerprint(currentHistory),
    forecastOrigin: '2026-04-01T00:00:00.000Z',
  })
  const residual = createRecentResidualCalibrationIdentity([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
  ])

  assert.equal(canResidualCalibrateCurrent(residual, current), false)
  assert.equal(canResidualCalibrateCurrent({
    ...residual,
    forecastOrigin: null,
  }, current), false)
  assert.equal(canResidualCalibrateCurrent({
    ...residual,
    forecastOrigin: 'not-an-iso-origin',
  }, current, {
    canonicalHistoryFingerprintAtResidualOrigin: residual.historyFingerprint,
  }), false)
  assert.throws(
    () => buildOriginBoundForecastHistoryFingerprint(currentHistory, '2026-02-15T00:00:00.000Z'),
    /must identify a canonical MONTHLY period/i,
  )
})

test('source dimensions must still match exactly for lineage proof to pass', () => {
  const currentHistory = createMonthlyHistory([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
    { date: '2026-04-01T00:00:00.000Z', value: 40 },
  ])
  const current = createCurrentCalibrationIdentity({
    historyFingerprint: buildForecastHistoryFingerprint(currentHistory),
    forecastOrigin: '2026-04-01T00:00:00.000Z',
  })
  const residual = createRecentResidualCalibrationIdentity([
    { date: '2026-01-01T00:00:00.000Z', value: 10 },
    { date: '2026-02-01T00:00:00.000Z', value: 20 },
    { date: '2026-03-01T00:00:00.000Z', value: 30 },
  ])
  const proof = buildOriginBoundForecastHistoryFingerprint(currentHistory, residual.forecastOrigin!)

  assert.equal(canResidualCalibrateCurrent({
    ...residual,
    sourceSeriesId: 'other-series',
  }, current, {
    canonicalHistoryFingerprintAtResidualOrigin: proof,
  }), false)
  assert.equal(canResidualCalibrateCurrent({
    ...residual,
    inputSource: 'DIFFERENT_SOURCE',
  }, current, {
    canonicalHistoryFingerprintAtResidualOrigin: proof,
  }), false)
  assert.equal(canResidualCalibrateCurrent({
    ...residual,
    sourceFrequency: 'QUARTERLY',
  }, current, {
    canonicalHistoryFingerprintAtResidualOrigin: proof,
  }), false)
})