import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveForecastPortfolioBenchmarkSubject } from '@/app/[locale]/page'
import {
  buildForecastControlButtonMeta,
  resolveDefaultForecastTargetBasis,
  resolveInitialForecastVerificationVisibility,
  resolveInitialForecastVisibility,
  resolveForecastVerificationUnavailableState,
  shouldHideEmbeddedBenchmarkShell,
} from '@/components/raw-data-view/index'

test('forecast-portfolio-v3 defaults target basis to point in time', () => {
  assert.equal(resolveDefaultForecastTargetBasis('forecast-portfolio-v3'), 'POINT_IN_TIME')
})

test('non-forecast variants keep the monthly-average default target basis', () => {
  assert.equal(resolveDefaultForecastTargetBasis('historical-v1'), 'MONTHLY_AVERAGE')
  assert.equal(resolveDefaultForecastTargetBasis('finder-embedded-v2'), 'MONTHLY_AVERAGE')
})

test('forecast-portfolio-v3 stays historical-first when embedded', () => {
  assert.equal(resolveInitialForecastVisibility('forecast-portfolio-v3', true), false)
  assert.equal(resolveInitialForecastVerificationVisibility('forecast-portfolio-v3', true), false)
})

test('forecast-portfolio-v3 still defaults forecast-on in standalone mode', () => {
  assert.equal(resolveInitialForecastVisibility('forecast-portfolio-v3', false), true)
  assert.equal(resolveInitialForecastVerificationVisibility('forecast-portfolio-v3', false), true)
})

test('embedded forecast-portfolio-v3 keeps the benchmark shell visible for controls', () => {
  assert.equal(shouldHideEmbeddedBenchmarkShell(true, true, true), false)
  assert.equal(shouldHideEmbeddedBenchmarkShell(true, true, false), true)
})

test('forecast-portfolio-v3 keeps a dynamic non-Brent seriesId authoritative', () => {
  assert.deepEqual(
    resolveForecastPortfolioBenchmarkSubject({
      variantId: 'forecast-portfolio-v3',
      seriesId: 'ussurv1055',
      displayName: 'US Sulphur Example',
    }),
    {
      seriesId: 'ussurv1055',
      displayName: 'US Sulphur Example',
    },
  )
})

test('forecast control button metadata keeps readiness text separate from the primary label', () => {
  assert.deepEqual(
    buildForecastControlButtonMeta('ARIMA', 'pl', 'QUEUED'),
    {
      label: 'ARIMA',
      statusLabel: 'W kolejce',
      state: 'QUEUED',
    },
  )

  assert.deepEqual(
    buildForecastControlButtonMeta('Daily', 'en', null),
    {
      label: 'Daily',
      statusLabel: null,
      state: null,
    },
  )
})

test('forecast-portfolio-v3 keeps explicit Brent authoritative when Brent is selected', () => {
  assert.deepEqual(
    resolveForecastPortfolioBenchmarkSubject({
      variantId: 'forecast-portfolio-v3',
      seriesId: 'wocaes0074',
      displayName: 'Brent, Spot, FOB North Sea',
    }),
    {
      seriesId: 'wocaes0074',
      displayName: 'Brent, Spot, FOB North Sea',
    },
  )
})

test('forecast-portfolio-v3 falls back to Brent only when no seriesId is supplied', () => {
  assert.deepEqual(
    resolveForecastPortfolioBenchmarkSubject({
      variantId: 'forecast-portfolio-v3',
      displayName: 'Ignored without series',
    }),
    {
      seriesId: 'wocaes0074',
      displayName: 'Brent, Spot, FOB North Sea',
    },
  )
})

test('verification unavailable state surfaces preparation-required misses', () => {
  const result = resolveForecastVerificationUnavailableState({
    status: 'NOT_AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    reason: 'PREPARATION_REQUIRED: No persisted forecast verification is available for the selected series and model.',
  }, {
    verificationUnavailable: 'Forecast verification unavailable',
    verificationUnavailableHint: 'Historical data and current forecast stay available. Historical forecast verification could not be loaded right now.',
    verificationBlocked: 'Forecast verification blocked',
    verificationBlockedHint: 'Historical forecast verification is blocked for this selection.',
  })

  assert.deepEqual(result, {
    title: 'Forecast verification unavailable',
    message: 'Historical data and current forecast stay available. Historical forecast verification could not be loaded right now.',
  })
})
