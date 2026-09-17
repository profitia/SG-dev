import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { resolveForecastPortfolioBenchmarkSubject } from '@/app/[locale]/page'
import {
  RANGE_PRESETS,
  buildForecastControlButtonMeta,
  forecastModelLabel,
  forecastTargetBasisLabel,
  isExactSelectedRenderableCurrentResult,
  resolveDisplayedRenderableCurrentResult,
  resolveDefaultForecastTargetBasis,
  resolveForecastVerificationBannerState,
  resolveHistoricalVerificationNotice,
  resolveInitialForecastVerificationVisibility,
  resolveInitialForecastVisibility,
  resolveRangeForForecastVerification,
  resolveForecastVerificationUnavailableState,
  shouldApplyCurrentResultForActiveRequest,
  shouldHideEmbeddedBenchmarkShell,
  isPreparedReadsOnlyForecastSession,
  isRecentVerificationPrepared,
  mergeExactCapabilitySnapshot,
  shouldRunProgressiveForecastPreparation,
} from '@/components/raw-data-view/index'
import type { BenchmarkForecastCurrentAvailableResult } from '@/lib/benchmark-forecast/forecast-contract'
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

test('client-facing forecast reads do not invoke progressive preparation unless an embedded operator explicitly opts in', () => {
  const disabled = { get: () => null }
  const enabled = { get: (key: string) => key === 'progressivePreparation' ? '1' : null }

  assert.equal(shouldRunProgressiveForecastPreparation(disabled, { embedded: false, variant: 'forecast-portfolio-v3' }), false)
  assert.equal(shouldRunProgressiveForecastPreparation(enabled, { embedded: false, variant: 'forecast-portfolio-v3' }), false)
  assert.equal(shouldRunProgressiveForecastPreparation(disabled, { embedded: true, variant: 'forecast-portfolio-v3' }), false)
  assert.equal(shouldRunProgressiveForecastPreparation(enabled, { embedded: true, variant: 'forecast-portfolio-v3' }), true)
})

test('prepared-read-only demo mode is explicit and fail-closed', () => {
  assert.equal(isPreparedReadsOnlyForecastSession({ get: (key) => key === 'preparedReadsOnly' ? '1' : null }), true)
  assert.equal(isPreparedReadsOnlyForecastSession({ get: () => null }), false)
  assert.equal(isPreparedReadsOnlyForecastSession({ get: () => 'true' }), false)
})

test('prepared verification requires the exact Recent Verification artifact', () => {
  const capability = {
    seriesId: 'b_c1_cl',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'naive',
    sourceFrequency: 'DAILY',
    targetCadence: 'MONTHLY',
    sourceAvailability: 'AVAILABLE',
    lawfulTargetSemantics: 'LAWFUL',
    status: 'STALE',
    currentReadiness: 'READY',
    verificationReadiness: 'READY',
    recentVerificationReadiness: 'STALE',
    targetedDataScope: 'SINGLE_SERIES',
    timingMs: 4,
    reason: 'Recent Verification is stale.',
  } as const

  assert.equal(isRecentVerificationPrepared(capability), false)
  assert.equal(isRecentVerificationPrepared({
    ...capability,
    recentVerificationReadiness: 'READY',
  }), true)
})

test('an exact capability refresh replaces only the matching model and methodology', () => {
  const baseVariant = {
    seriesId: 'b_c1_cl',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'naive',
    sourceFrequency: 'DAILY',
    targetCadence: 'MONTHLY',
    sourceAvailability: 'AVAILABLE',
    lawfulTargetSemantics: 'LAWFUL',
    status: 'STALE',
    currentReadiness: 'READY',
    verificationReadiness: 'READY',
    recentVerificationReadiness: 'STALE',
    targetedDataScope: 'SINGLE_SERIES',
    timingMs: 4,
    reason: 'Recent Verification is stale.',
  } as const
  const otherVariant = {
    ...baseVariant,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    recentVerificationReadiness: 'READY',
  } as const
  const refreshed = {
    ...baseVariant,
    status: 'READY',
    recentVerificationReadiness: 'READY',
    reason: null,
  } as const

  const merged = mergeExactCapabilitySnapshot({
    seriesId: 'b_c1_cl',
    sourceFrequency: 'DAILY',
    sourceAvailability: 'AVAILABLE',
    status: 'AVAILABLE',
    reason: null,
    targetedDataScope: 'SINGLE_SERIES',
    timingMs: 10,
    variants: [baseVariant, otherVariant],
  }, refreshed)

  assert.equal(merged.variants.length, 2)
  assert.equal(merged.variants.find((variant) => variant.targetSemantics === 'MONTHLY_AVERAGE')?.recentVerificationReadiness, 'READY')
  assert.equal(merged.variants.find((variant) => variant.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME')?.recentVerificationReadiness, 'READY')
})

test('showing Historical Verification preserves the chart range selected by the user', () => {
  assert.equal(resolveRangeForForecastVerification('3M', true), '3M')
  assert.equal(resolveRangeForForecastVerification('6M', true), '6M')
  assert.equal(resolveRangeForForecastVerification('1Y', true), '1Y')
  assert.equal(resolveRangeForForecastVerification('3Y', true), '3Y')
  assert.equal(resolveRangeForForecastVerification('5Y', true), '5Y')
  assert.equal(resolveRangeForForecastVerification('ALL', true), 'ALL')
  assert.equal(resolveRangeForForecastVerification('1Y', false), '1Y')
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

test('historical verification notice exposes a limited sample without hiding available results', () => {
  assert.deepEqual(resolveHistoricalVerificationNotice({
    status: 'AVAILABLE',
    seriesId: 'hg2027g_cl',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    displayName: 'Copper Future',
    description: null,
    methodVersion: 'test-method-v1',
    lineage: {
      inputSource: 'TEST_SOURCE',
      inputRunId: null,
      sourceSeriesId: 'hg2027g_cl',
      sourceFrequency: 'DAILY',
      historyFingerprint: 'history-fingerprint',
      preparation: null,
    },
    history: { frequency: 'DAILY', start: '2026-01-01', end: '2026-09-01', observations: 170 },
    forecastOrigin: '2026-09-01',
    verification: {},
    historicalVerification: {
      contractVersion: 'HISTORICAL_VERIFICATION_V2',
      status: 'LIMITED_SAMPLE',
      originCount: 8,
      expectedOriginCount: 8,
      failedOriginCount: 0,
      pendingOriginCount: 0,
      coverage: 1,
      horizons: {},
    },
  }), {
    status: 'LIMITED_SAMPLE',
    originCount: 8,
    expectedOriginCount: 8,
    failedOriginCount: 0,
    pendingOriginCount: 0,
    minimumOriginCount: 0,
  })
})

test('historical verification notice also exposes not-prepared state from an unavailable result', () => {
  assert.deepEqual(resolveHistoricalVerificationNotice({
    status: 'NOT_AVAILABLE',
    seriesId: 'hwwi_gb_ironsteel_2021_eur',
    modelId: 'naive',
    targetBasis: 'END_OF_PERIOD',
    targetSemantics: 'END_OF_PERIOD',
    methodId: 'END_OF_PERIOD',
    reason: 'PREPARATION_REQUIRED',
    historicalVerification: {
      contractVersion: 'HISTORICAL_VERIFICATION_V2',
      status: 'NOT_PREPARED',
      originCount: 0,
      expectedOriginCount: 0,
      failedOriginCount: 0,
      pendingOriginCount: 0,
      coverage: 0,
      horizons: {},
    },
  }), {
    status: 'NOT_PREPARED',
    originCount: 0,
    expectedOriginCount: 0,
    failedOriginCount: 0,
    pendingOriginCount: 0,
    minimumOriginCount: 0,
  })
})

test('historical verification notice follows the selected horizon instead of the aggregate summary', () => {
  assert.equal(resolveHistoricalVerificationNotice({
    status: 'AVAILABLE',
    seriesId: 'cl_c1_cl',
    modelId: 'naive',
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    displayName: 'Light Sweet (WTI) Physical',
    description: null,
    methodVersion: 'rolling-daily-point-in-time-v1',
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: null,
      sourceSeriesId: 'cl_c1_cl',
      sourceFrequency: 'DAILY',
      historyFingerprint: 'history-fingerprint',
      preparation: null,
    },
    history: { frequency: 'DAILY', start: '1983-03-30', end: '2026-09-15', observations: 10917 },
    forecastOrigin: '2026-09-15',
    verification: {},
    historicalVerification: {
      contractVersion: 'HISTORICAL_VERIFICATION_V2',
      status: 'LIMITED_SAMPLE',
      originCount: 29,
      expectedOriginCount: 29,
      failedOriginCount: 0,
      pendingOriginCount: 24,
      coverage: 1,
      horizons: {
        '1M': {
          status: 'AVAILABLE',
          originCount: 30,
          expectedOriginCount: 30,
          failedOriginCount: 0,
          pendingOriginCount: 6,
          minimumOriginCount: 24,
          coverage: 1,
          warningCode: null,
        },
      },
    },
  }, '1M'), null)
})

test('displayed current forecast stays on the chart until the requested identity becomes renderable', () => {
  const displayed: BenchmarkForecastCurrentAvailableResult = {
    status: 'AVAILABLE' as const,
    seriesId: 'wocaes0074',
    modelId: 'naive' as const,
    targetBasis: 'POINT_IN_TIME' as const,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    methodId: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    displayName: 'Brent',
    description: null,
    methodVersion: 'rolling-daily-point-in-time-v1',
    lineage: {
      inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
      inputRunId: null,
      sourceSeriesId: 'wocaes0074',
      sourceFrequency: 'DAILY' as const,
      historyFingerprint: 'history-1',
      preparation: null,
    },
    history: {
      frequency: 'DAILY',
      start: '2026-01-01',
      end: '2026-09-01',
      observations: 200,
    },
    forecastOrigin: '2026-09-01',
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-10-01',
        forecastValue: 72,
      },
    },
    rollingDailySnapshot: {
      productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
      contractVersion: '1',
      status: 'AVAILABLE',
      benchmark: {
        benchmarkId: 'wocaes0074',
        unit: null,
        currency: null,
        provider: null,
        providerSeriesId: 'wocaes0074',
        displayName: 'Brent',
        frequency: 'DAILY',
      },
      model: { id: 'naive', selectedCandidate: null },
      origin: { date: '2026-09-01', value: 71 },
      forecastMethod: { id: 'ROLLING_DAILY_POINT_IN_TIME', version: 'rolling-daily-point-in-time-v1' },
      maxHorizonMonths: 12,
      audit: {
        generatedAt: '2026-09-01T00:00:00.000Z',
        inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
        sourceHistoryFingerprint: 'history-1',
        sourceLatestObservationDate: '2026-09-01',
        calendarProjectionMode: 'OBSERVED_WEEKDAY_SET_V1',
        projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1',
        technicalMinimumTrainingObservations: 60,
        methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
        calibrationUpdatedAt: null,
        calibrationLastResidualAvailabilityDate: null,
      },
      anchors: [],
      path: [
        {
          date: '2026-09-02',
          pointForecast: 72,
          band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null },
        },
      ],
      calibration: {
        availabilityStatus: 'NOT_AVAILABLE',
        freshnessStatus: null,
        quantileConvention: 'HF7_LINEAR_INTERPOLATION',
        coverageLabel: '80% empirical prediction band',
        methodologicalMinimumStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
        updatedAt: null,
        processedThrough: null,
        lastResidualAvailabilityDate: null,
      },
      warnings: [],
    },
  }

  const displayedSnapshot = displayed.rollingDailySnapshot
  if (!displayedSnapshot) {
    throw new Error('Expected rolling daily snapshot fixture')
  }

  const requestedNotRenderable: BenchmarkForecastCurrentAvailableResult = {
    ...displayed,
    modelId: 'arima' as const,
    currentForecast: {},
    rollingDailySnapshot: {
      ...displayedSnapshot,
      path: [],
    },
  }

  assert.equal(isExactSelectedRenderableCurrentResult(displayed, {
    seriesId: 'wocaes0074',
    modelId: 'naive',
    targetBasis: 'POINT_IN_TIME',
  }), true)

  assert.deepEqual(resolveDisplayedRenderableCurrentResult({
    showForecast: true,
    requestedIdentity: {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
    requestedResult: requestedNotRenderable,
    displayedResult: displayed,
  }), displayed)

  assert.equal(resolveDisplayedRenderableCurrentResult({
    showForecast: true,
    requestedIdentity: {
      seriesId: 'ussurv0301',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
    requestedResult: requestedNotRenderable,
    displayedResult: displayed,
  }), null)
})

test('displayed current forecast stays visible when the requested replacement fails', () => {
  const displayed: BenchmarkForecastCurrentAvailableResult = {
    status: 'AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'naive',
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    displayName: 'Brent',
    description: null,
    methodVersion: 'rolling-daily-point-in-time-v1',
    lineage: {
      inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
      inputRunId: null,
      sourceSeriesId: 'wocaes0074',
      sourceFrequency: 'DAILY',
      historyFingerprint: 'history-1',
      preparation: null,
    },
    history: {
      frequency: 'DAILY',
      start: '2026-01-01',
      end: '2026-09-01',
      observations: 200,
    },
    forecastOrigin: '2026-09-01',
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-10-01',
        forecastValue: 72,
      },
    },
    rollingDailySnapshot: {
      productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
      contractVersion: '1',
      status: 'AVAILABLE',
      benchmark: {
        benchmarkId: 'wocaes0074',
        unit: null,
        currency: null,
        provider: null,
        providerSeriesId: 'wocaes0074',
        displayName: 'Brent',
        frequency: 'DAILY',
      },
      model: { id: 'naive', selectedCandidate: null },
      origin: { date: '2026-09-01', value: 71 },
      forecastMethod: { id: 'ROLLING_DAILY_POINT_IN_TIME', version: 'rolling-daily-point-in-time-v1' },
      maxHorizonMonths: 12,
      audit: {
        generatedAt: '2026-09-01T00:00:00.000Z',
        inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
        sourceHistoryFingerprint: 'history-1',
        sourceLatestObservationDate: '2026-09-01',
        calendarProjectionMode: 'OBSERVED_WEEKDAY_SET_V1',
        projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1',
        technicalMinimumTrainingObservations: 60,
        methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
        calibrationUpdatedAt: null,
        calibrationLastResidualAvailabilityDate: null,
      },
      anchors: [],
      path: [
        {
          date: '2026-09-02',
          pointForecast: 72,
          band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null },
        },
      ],
      calibration: {
        availabilityStatus: 'NOT_AVAILABLE',
        freshnessStatus: null,
        quantileConvention: 'HF7_LINEAR_INTERPOLATION',
        coverageLabel: '80% empirical prediction band',
        methodologicalMinimumStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
        updatedAt: null,
        processedThrough: null,
        lastResidualAvailabilityDate: null,
      },
      warnings: [],
    },
  }

  const requestedFailed = {
    status: 'NOT_AVAILABLE' as const,
    seriesId: 'wocaes0074',
    modelId: 'arima' as const,
    targetBasis: 'POINT_IN_TIME' as const,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    methodId: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    reason: 'PREPARATION_REQUIRED: Requested replacement is still preparing.',
  }

  assert.equal(resolveDisplayedRenderableCurrentResult({
    showForecast: true,
    requestedIdentity: {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
    requestedResult: requestedFailed,
    displayedResult: displayed,
  }), displayed)
})

test('stale current response cannot replace a newer active request', () => {
  assert.equal(shouldApplyCurrentResultForActiveRequest({
    requestId: 2,
    activeRequestId: 3,
    cancelled: false,
    requestedIdentity: {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
    payload: {
      status: 'AVAILABLE',
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      displayName: 'Brent',
      description: null,
      methodVersion: 'rolling-daily-point-in-time-v1',
      lineage: {
        inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
        inputRunId: null,
        sourceSeriesId: 'wocaes0074',
        sourceFrequency: 'DAILY',
        historyFingerprint: 'history-b',
        preparation: null,
      },
      history: {
        frequency: 'DAILY',
        start: '2026-01-01',
        end: '2026-09-01',
        observations: 200,
      },
      forecastOrigin: '2026-09-01',
      currentForecast: {
        '1M': {
          horizon: '1M',
          horizonSteps: 1,
          forecastDate: '2026-10-01',
          forecastValue: 75,
        },
      },
      rollingDailySnapshot: null,
    },
  }), false)
})

test('displayed current forecast switches exactly Naive to ARIMA to Naive without blanking once both identities are renderable', () => {
  const naive: BenchmarkForecastCurrentAvailableResult = {
    status: 'AVAILABLE',
    seriesId: 'wocaes0074',
    modelId: 'naive',
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    displayName: 'Brent',
    description: null,
    methodVersion: 'rolling-daily-point-in-time-v1',
    lineage: {
      inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
      inputRunId: null,
      sourceSeriesId: 'wocaes0074',
      sourceFrequency: 'DAILY',
      historyFingerprint: 'history-naive',
      preparation: null,
    },
    history: {
      frequency: 'DAILY',
      start: '2026-01-01',
      end: '2026-09-01',
      observations: 200,
    },
    forecastOrigin: '2026-09-01',
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-10-01',
        forecastValue: 72,
      },
    },
    rollingDailySnapshot: {
      productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
      contractVersion: '1',
      status: 'AVAILABLE',
      benchmark: {
        benchmarkId: 'wocaes0074',
        unit: null,
        currency: null,
        provider: null,
        providerSeriesId: 'wocaes0074',
        displayName: 'Brent',
        frequency: 'DAILY',
      },
      model: { id: 'naive', selectedCandidate: null },
      origin: { date: '2026-09-01', value: 71 },
      forecastMethod: { id: 'ROLLING_DAILY_POINT_IN_TIME', version: 'rolling-daily-point-in-time-v1' },
      maxHorizonMonths: 12,
      audit: {
        generatedAt: '2026-09-01T00:00:00.000Z',
        inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
        sourceHistoryFingerprint: 'history-naive',
        sourceLatestObservationDate: '2026-09-01',
        calendarProjectionMode: 'OBSERVED_WEEKDAY_SET_V1',
        projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1',
        technicalMinimumTrainingObservations: 60,
        methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
        calibrationUpdatedAt: null,
        calibrationLastResidualAvailabilityDate: null,
      },
      anchors: [],
      path: [
        {
          date: '2026-09-02',
          pointForecast: 72,
          band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null },
        },
      ],
      calibration: {
        availabilityStatus: 'NOT_AVAILABLE',
        freshnessStatus: null,
        quantileConvention: 'HF7_LINEAR_INTERPOLATION',
        coverageLabel: '80% empirical prediction band',
        methodologicalMinimumStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
        updatedAt: null,
        processedThrough: null,
        lastResidualAvailabilityDate: null,
      },
      warnings: [],
    },
  }

  const naiveSnapshot = naive.rollingDailySnapshot
  if (!naiveSnapshot) {
    throw new Error('Expected naive rolling daily snapshot fixture')
  }

  const arima: BenchmarkForecastCurrentAvailableResult = {
    ...naive,
    modelId: 'arima',
    lineage: {
      ...naive.lineage,
      historyFingerprint: 'history-arima',
    },
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-10-01',
        forecastValue: 75,
      },
    },
    rollingDailySnapshot: {
      ...naiveSnapshot,
      model: { id: 'arima', selectedCandidate: 'ARIMA(2,1,2)' },
      audit: {
        ...naiveSnapshot.audit,
        sourceHistoryFingerprint: 'history-arima',
      },
      path: [
        {
          date: '2026-09-02',
          pointForecast: 75,
          band: { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null },
        },
      ],
    },
  }

  const displayedArima = resolveDisplayedRenderableCurrentResult({
    showForecast: true,
    requestedIdentity: {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
    requestedResult: arima,
    displayedResult: naive,
  })

  const displayedNaiveAgain = resolveDisplayedRenderableCurrentResult({
    showForecast: true,
    requestedIdentity: {
      seriesId: 'wocaes0074',
      modelId: 'naive',
      targetBasis: 'POINT_IN_TIME',
    },
    requestedResult: naive,
    displayedResult: displayedArima,
  })

  const displayedArimaAgain = resolveDisplayedRenderableCurrentResult({
    showForecast: true,
    requestedIdentity: {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    },
    requestedResult: arima,
    displayedResult: displayedNaiveAgain,
  })

  assert.equal(displayedArima, arima)
  assert.equal(displayedNaiveAgain, naive)
  assert.equal(displayedArimaAgain, arima)
  assert.notEqual(displayedArima, null)
  assert.notEqual(displayedNaiveAgain, null)
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

test('forecast portfolio controls keep two ordered rows with explicit group labels', () => {
  const source = fs.readFileSync(new URL('../components/raw-data-view/index.tsx', import.meta.url), 'utf8')

  assert.match(source, /forecast-portfolio-row forecast-current-row/)
  assert.match(source, /forecast-portfolio-row forecast-verification-row/)
  assert.match(source, /control-group-label">\{t\('forecastModel'\)\}<\/span>/)
  assert.match(source, /forecast-portfolio-toggle-copy/)
})

test('forecast portfolio does not show an uncertainty disclaimer when bands are rendered', () => {
  const source = fs.readFileSync(new URL('../components/raw-data-view/index.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /t\('modelNativeBands'\)/)
})

test('forecast preparation date is outside the chart drawing area', () => {
  const source = fs.readFileSync(new URL('../components/raw-data-view/index.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /chart-origin-label/)
  assert.match(source, /chart-forecast-preparation-date/)
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

test('verification unavailable state uses the explicit not-prepared historical status', () => {
  assert.deepEqual(resolveForecastVerificationUnavailableState({
    status: 'NOT_AVAILABLE',
    seriesId: 'hg2027g_cl',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    reason: 'PREPARATION_REQUIRED',
    historicalVerification: {
      contractVersion: 'HISTORICAL_VERIFICATION_V2',
      status: 'NOT_PREPARED',
      originCount: 0,
      expectedOriginCount: 0,
      failedOriginCount: 0,
      pendingOriginCount: 0,
      coverage: 0,
      horizons: {},
    },
  }, {
    verificationUnavailable: 'Unavailable',
    verificationUnavailableHint: 'Unavailable hint',
    verificationBlocked: 'Blocked',
    verificationBlockedHint: 'Blocked hint',
    verificationNotPrepared: 'Not prepared',
    verificationNotPreparedHint: 'Not prepared hint',
  }), {
    title: 'Not prepared',
    message: 'Not prepared hint',
  })
})
