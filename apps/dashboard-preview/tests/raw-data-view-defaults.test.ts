import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { resolveForecastPortfolioBenchmarkSubject } from '@/app/[locale]/page'
import {
  RANGE_PRESETS,
  buildForecastControlButtonMeta,
  forecastModelLabel,
  forecastTargetBasisLabel,
  resolveDefaultForecastTargetBasis,
  resolveForecastVerificationBannerState,
  resolveInitialForecastVerificationVisibility,
  resolveInitialForecastVisibility,
  resolveForecastVerificationUnavailableState,
  shouldHideEmbeddedBenchmarkShell,
} from '@/components/raw-data-view/index'
import { FORECAST_ACCURACY_HORIZONS } from '@/lib/forecast-accuracy/forecast-accuracy-contract'

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

test('verification banner stays hidden once the exact selected verification artifact is already available', () => {
  assert.equal(resolveForecastVerificationBannerState({
    forecastVerificationState: 'loading',
    forecastVerificationResult: {
      status: 'AVAILABLE',
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      displayName: 'Brent',
      description: null,
      methodVersion: 'test-method-v1',
      lineage: {
        inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
        inputRunId: null,
        sourceSeriesId: 'wocaes0074',
        sourceFrequency: 'DAILY',
        historyFingerprint: 'history-fingerprint',
        preparation: null,
      },
      history: {
        frequency: 'DAILY',
        start: '2026-01-01',
        end: '2026-09-01',
        observations: 200,
      },
      forecastOrigin: '2026-09-01',
      verification: {},
    },
    forecastVerificationErrorState: null,
    selectedProgressiveVariant: { verificationState: 'QUEUED' },
    identity: {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
  }), null)
})

test('verification banner preserves a truthful queued state when the exact artifact is not ready', () => {
  assert.equal(resolveForecastVerificationBannerState({
    forecastVerificationState: 'loading',
    forecastVerificationResult: null,
    forecastVerificationErrorState: null,
    selectedProgressiveVariant: { verificationState: 'QUEUED' },
    identity: {
      seriesId: 'wocaes0074',
      modelId: 'naive',
      targetBasis: 'MONTHLY_AVERAGE',
    },
  }), 'QUEUED')
})

test('verification banner preserves a truthful preparing state when the exact artifact is still preparing', () => {
  assert.equal(resolveForecastVerificationBannerState({
    forecastVerificationState: 'loading',
    forecastVerificationResult: null,
    forecastVerificationErrorState: null,
    selectedProgressiveVariant: { verificationState: 'PREPARING' },
    identity: {
      seriesId: 'wocaes0074',
      modelId: 'ets',
      targetBasis: 'END_OF_PERIOD',
    },
  }), 'PREPARING')
})

test('forecast controls preserve the requested labels and presets', () => {
  assert.deepEqual(
    ['naive', 'damped_holt', 'ets', 'arima'].map((model) => forecastModelLabel('en', model as 'naive' | 'damped_holt' | 'ets' | 'arima')),
    ['Naive', 'Damped Holt', 'ETS', 'ARIMA'],
  )
  assert.deepEqual(
    ['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD'].map((targetBasis) => forecastTargetBasisLabel('en', targetBasis as 'MONTHLY_AVERAGE' | 'POINT_IN_TIME' | 'END_OF_PERIOD')),
    ['Monthly average', 'Daily', 'End of period'],
  )
  assert.deepEqual(FORECAST_ACCURACY_HORIZONS, [1, 3, 6, 12])
  assert.deepEqual(RANGE_PRESETS, ['3M', '6M', '1Y', '3Y', '5Y', 'ALL'])
})

test('forecast portfolio controls stay in the two-row structure without a standalone forecast model label', () => {
  const source = fs.readFileSync(new URL('../components/raw-data-view/index.tsx', import.meta.url), 'utf8')

  assert.match(source, /forecast-portfolio-row forecast-current-row/)
  assert.match(source, /forecast-portfolio-row forecast-verification-row/)
  assert.doesNotMatch(source, /control-group-label">\{t\('forecastModel'\)\}<\/span>/)
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
