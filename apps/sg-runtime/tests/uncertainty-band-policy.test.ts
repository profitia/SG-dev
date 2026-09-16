import assert from 'node:assert/strict'
import test from 'node:test'

import type { ForecastCurrentPoint, ForecastUncertaintyBand } from '../lib/forecast/contracts'
import { buildForecastPredictionBandIdentityKey } from '../lib/forecast/identity'
import {
  ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
  attachExactUncertaintyBandIdentity,
  buildExactForecastPredictionBandIdentity,
} from '../lib/forecast/uncertainty-band-policy'

const band: ForecastUncertaintyBand = {
  status: 'AVAILABLE',
  source: 'MODEL_NATIVE_SHORT_HISTORY',
  policyVersion: ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
  coverage: 0.8,
  lower: 90,
  upper: 110,
  sampleCount: 9,
  calibrationStatus: 'INSUFFICIENT_SAMPLE',
  calibrationMethod: 'STATSMODELS_ETS_SIMULATION',
  calibrationVersion: 'statsmodels-ets-simulation-seed-1729-r1000-v1',
  reasonCode: null,
}

const point: ForecastCurrentPoint = {
  horizon: '1M',
  horizonSteps: 1,
  forecastDate: '2026-10-01T00:00:00.000Z',
  forecastValue: 100,
  metadata: {
    modelFamily: 'ets',
    selectedVariant: 'ETS(A,A,N)',
    selectedParameters: {},
    selectionScore: 1,
    selectionMetric: 'AICc',
    fitStatus: 'SUCCEEDED',
    failureReason: null,
    uncertaintyBand: band,
  },
  failureReason: null,
}

const context = {
  seriesId: 'generic.series',
  modelId: 'ets',
  targetBasis: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  inputSource: 'postgres',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  sourceHistoryFingerprint: 'sha256:history-a',
  trainingWindowPolicyId: 'CURRENT_POLICY_FREQUENCY_SPECIFIC@current-policy-frequency-specific-v1',
  effectiveTrainingPolicyId: 'policy-a',
  forecastOrigin: '2026-09-01T00:00:00.000Z',
} as const

test('exact band identity round-trips inside Current point metadata', () => {
  const enriched = attachExactUncertaintyBandIdentity(context, point)
  const persisted = JSON.parse(JSON.stringify(enriched.metadata))

  assert.deepEqual(persisted.uncertaintyBand, enriched.metadata?.uncertaintyBand)
  assert.equal(persisted.uncertaintyBand.identity.forecastIdentity.seriesId, context.seriesId)
  assert.equal(persisted.uncertaintyBand.identity.bandPolicyVersion, ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION)
  assert.equal(persisted.uncertaintyBand.identity.sourceHistoryFingerprint, context.sourceHistoryFingerprint)
})

test('band identity isolates series, model, method, cadence, policy, and horizon', () => {
  const baseIdentity = buildExactForecastPredictionBandIdentity(context, point, band)
  const identities = [
    baseIdentity,
    buildExactForecastPredictionBandIdentity({ ...context, seriesId: 'other.series' }, point, band),
    buildExactForecastPredictionBandIdentity({ ...context, modelId: 'arima' }, point, band),
    buildExactForecastPredictionBandIdentity({ ...context, targetBasis: 'END_OF_PERIOD' }, point, band),
    buildExactForecastPredictionBandIdentity({ ...context, targetCadence: 'QUARTERLY' }, point, band),
    buildExactForecastPredictionBandIdentity({ ...context, effectiveTrainingPolicyId: 'policy-b' }, point, band),
    buildExactForecastPredictionBandIdentity(context, {
      ...point,
      horizon: '3M',
      horizonSteps: 3,
      forecastDate: '2026-12-01T00:00:00.000Z',
    }, band),
  ]

  assert.equal(new Set(identities.map(buildForecastPredictionBandIdentityKey)).size, identities.length)
})

test('model-native band fails closed if it masquerades as calibrated', () => {
  assert.throws(() => attachExactUncertaintyBandIdentity(context, {
    ...point,
    metadata: {
      ...point.metadata!,
      uncertaintyBand: {
        ...band,
        calibrationStatus: 'CALIBRATED',
      },
    },
  }), /cannot report CALIBRATED/)
})
