import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  createCurrentForecastRouteHandler,
  createForecastVerificationRouteHandler,
  createInternalProductionForecastRouteHandler,
  resolvePreparedForecastVerification,
} from '../lib/forecast/route-handlers'
import { createInteractiveForecastPreparationService } from '../lib/forecast/interactive-preparation'
import {
  createInternalCurrentForecastPreparationRouteHandler,
  createInternalForecastCapabilityRouteHandler,
  createInternalProgressiveForecastPreparationRouteHandler,
} from '../lib/forecast/interactive-route-handlers'
import type {
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationResult,
} from '../lib/forecast/contracts'
import type { ProductionForecastResult } from '../lib/forecast/production-routing'
import type { ForecastRequestInput } from '../lib/forecast/request-contract'
import { createForecastStressTelemetry, type ForecastStressEvent } from '../lib/forecast/stress-telemetry'
import type { ForecastCapabilityResolution, ForecastVariantCapability } from '../lib/forecast/capability-resolver'

function buildRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

function buildUserRequest(url: string, headers: Record<string, string> = {}) {
  return buildRequest(url, {
    'x-clerk-org-id': 'org-1',
    'x-clerk-user-id': 'user-1',
    ...headers,
  })
}

function buildJsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function capabilityIdentity(targetBasis: ForecastRequestInput['targetBasis']) {
  if (targetBasis === 'END_OF_PERIOD') {
    return { targetSemantics: 'END_OF_PERIOD', methodId: 'END_OF_PERIOD' } as const
  }

  if (targetBasis === 'POINT_IN_TIME') {
    return { targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', methodId: 'ROLLING_DAILY_POINT_IN_TIME' } as const
  }

  return { targetSemantics: 'MONTHLY_AVERAGE', methodId: 'MONTHLY_AVERAGE' } as const
}

function availableIdentity(targetBasis: ForecastRequestInput['targetBasis']) {
  return {
    ...capabilityIdentity(targetBasis),
    lineage: {
      inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
      inputRunId: null,
      sourceSeriesId: 'wocaes0074',
      sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      historyFingerprint: 'abc',
      preparation: null,
    },
  } as const
}

function buildCapabilityCandidate(overrides: Partial<ForecastVariantCapability> = {}): ForecastVariantCapability {
  return {
    identity: {
      seriesId: 'wocaes0074',
      targetSemantics: 'MONTHLY_AVERAGE',
      methodId: 'MONTHLY_AVERAGE',
      methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
      modelId: 'ets',
    },
    sourceFrequency: 'MONTHLY',
    sourceFrequencyRecognized: true,
    businessTarget: 'AVERAGE',
    targetCadence: 'MONTHLY',
    targetSemanticsSupported: true,
    horizonSupportState: 'NOT_REQUESTED',
    horizonMonths: null,
    horizonSteps: null,
    semanticLawfulness: 'LAWFUL_WITH_PROVENANCE',
    admissionState: 'ADMITTED',
    provenanceStatus: 'PROVEN',
    implementationState: 'SUPPORTED',
    historyEligibility: 'ELIGIBLE',
    minimumRequiredObservations: 36,
    availableObservations: 48,
    modelEligible: true,
    currentForecastEligible: true,
    verificationOriginCount: 36,
    verificationEvidenceState: 'SUFFICIENT',
    predictionBandResidualCount: 40,
    predictionBandState: 'AVAILABLE',
    targetPreparationState: 'PREPARED',
    currentPreparedState: 'NOT_PREPARED',
    historicalPreparedState: 'READY',
    capabilityState: 'PREPARATION_REQUIRED',
    ...overrides,
  }
}

function buildCapabilityResolution(overrides: Partial<ForecastCapabilityResolution> = {}): ForecastCapabilityResolution {
  return {
    status: 'AVAILABLE',
    reason: null,
    sourceMetadata: {
      seriesId: 'wocaes0074',
      providerCode: 'macrobond',
      source: 'POSTGRES_RUNTIME_SNAPSHOT',
      sourceFrequency: 'MONTHLY',
      rawFrequency: 'MONTHLY',
      sourceObservationCount: 48,
      fullHistoryObservationCount: 48,
    },
    targetedHydration: {
      scope: 'SINGLE_SERIES',
      requestedSeriesId: 'wocaes0074',
      source: 'postgres',
      cacheStatus: 'hit',
    },
    preparationFailures: {},
    capabilities: [buildCapabilityCandidate()],
    ...overrides,
  }
}

function buildExactCapabilityTrace() {
  return {
    sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY' as const,
    sourceFrequencyLookupMs: 1,
    sourceFrequencyLookupExternalIo: false,
    provenanceReadMs: 0,
    provenanceReadCount: 0,
    preparedVariantReadMs: 0,
    preparedVariantReadCount: 0,
    prepareCount: 0,
    modelFitCount: 0,
    exactUnsupportedFastPathTaken: false,
    capabilityTotalMs: 1,
  }
}

test('current forecast route defaults missing targetBasis to MONTHLY_AVERAGE', async () => {
  let receivedInput: ForecastRequestInput | null = null

  const handler = createCurrentForecastRouteHandler(async (input) => {
    receivedInput = input
    return {
      status: 'AVAILABLE',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      ...availableIdentity(input.targetBasis),
      userFacingModel: true,
      displayName: 'Brent',
      description: null,
      methodVersion: 'test',
      source: { kind: 'POSTGRES_RUNTIME_SNAPSHOT', runId: null },
      historyFingerprint: 'abc',
      history: { frequency: 'MONTHLY', start: '2026-01-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z', observations: 7 },
      forecastOrigin: '2026-07-01T00:00:00.000Z',
      runtimeSeconds: 0.01,
      cacheStatus: 'miss',
      alignment: {
        status: 'ALIGNED',
        trainingFrequency: 'MONTHLY',
        lastHistoricalPeriod: '2026-07-01T00:00:00.000Z',
        forecastOrigin: '2026-07-01T00:00:00.000Z',
        firstForecastTarget: '2026-08-01T00:00:00.000Z',
      },
      currentForecast: {},
    } satisfies BenchmarkForecastCurrentResult
  })

  const response = await handler(buildUserRequest('http://localhost/api/benchmark/forecast/current?seriesId=wocaes0074&model=ets'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  if (!receivedInput) {
    throw new Error('Expected current route resolver to receive normalized input.')
  }
  const currentInput = receivedInput as ForecastRequestInput
  assert.equal(currentInput.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(payload.targetBasis, 'MONTHLY_AVERAGE')
})

test('current forecast route accepts arima model and forwards it to the service boundary', async () => {
  let receivedInput: ForecastRequestInput | null = null

  const handler = createCurrentForecastRouteHandler(async (input) => {
    receivedInput = input
    return {
      status: 'UNSUPPORTED',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      ...capabilityIdentity(input.targetBasis),
      reason: 'ARIMA request reached the forecast service boundary.',
      supportedSeriesIds: [input.seriesId],
      supportedModels: ['naive', 'damped_holt', 'ets', 'arima'],
    } satisfies BenchmarkForecastCurrentResult
  })

  const response = await handler(buildUserRequest('http://localhost/api/benchmark/forecast/current?seriesId=wocaes0074&model=arima'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  if (!receivedInput) {
    throw new Error('Expected current route resolver to receive arima input.')
  }

  const arimaInput = receivedInput as ForecastRequestInput
  assert.equal(arimaInput.modelId, 'arima')
  assert.equal(payload.modelId, 'arima')
  assert.equal(payload.status, 'UNSUPPORTED')
})

test('current forecast route rejects invalid explicit targetBasis', async () => {
  let called = false

  const handler = createCurrentForecastRouteHandler(async () => {
    called = true
    throw new Error('should not be reached')
  })

  const response = await handler(buildUserRequest('http://localhost/api/benchmark/forecast/current?seriesId=wocaes0074&model=ets&targetBasis=INVALID'))
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(called, false)
  assert.equal(payload.code, 'VALIDATION_ERROR')
})

test('current forecast route preserves explicit END_OF_PERIOD to the service boundary', async () => {
  let receivedInput: ForecastRequestInput | null = null

  const handler = createCurrentForecastRouteHandler(async (input) => {
    receivedInput = input
    return {
      status: 'UNSUPPORTED',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      ...capabilityIdentity(input.targetBasis),
      reason: 'Forecast targetBasis END_OF_PERIOD is recognized but not yet compute-enabled.',
      supportedSeriesIds: [input.seriesId],
      supportedModels: ['naive', 'damped_holt', 'ets', 'arima'],
    } satisfies BenchmarkForecastCurrentResult
  })

  const response = await handler(buildUserRequest('http://localhost/api/benchmark/forecast/current?seriesId=wocaes0074&model=ets&targetBasis=END_OF_PERIOD'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  if (!receivedInput) {
    throw new Error('Expected current route resolver to receive explicit END_OF_PERIOD.')
  }
  const endOfPeriodInput = receivedInput as ForecastRequestInput
  assert.equal(endOfPeriodInput.targetBasis, 'END_OF_PERIOD')
  assert.equal(payload.targetBasis, 'END_OF_PERIOD')
  assert.equal(payload.status, 'UNSUPPORTED')
})

test('verification route passes explicit MONTHLY_AVERAGE and serializes targetBasis', async () => {
  let receivedInput: ForecastRequestInput | null = null

  const handler = createForecastVerificationRouteHandler(async (input) => {
    receivedInput = input
    return {
      status: 'AVAILABLE',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      ...availableIdentity(input.targetBasis),
      userFacingModel: true,
      displayName: 'Brent',
      description: null,
      methodVersion: 'test',
      source: { kind: 'POSTGRES_RUNTIME_SNAPSHOT', runId: null },
      historyFingerprint: 'abc',
      history: { frequency: 'MONTHLY', start: '2026-01-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z', observations: 7 },
      forecastOrigin: '2026-07-01T00:00:00.000Z',
      runtimeSeconds: 0.01,
      cacheStatus: 'miss',
      verification: {},
    } satisfies BenchmarkForecastVerificationResult
  })

  const response = await handler(buildUserRequest('http://localhost/api/benchmark/forecast/verification?seriesId=wocaes0074&model=ets&targetBasis=MONTHLY_AVERAGE'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  if (!receivedInput) {
    throw new Error('Expected verification route resolver to receive explicit MONTHLY_AVERAGE.')
  }
  const verificationInput = receivedInput as ForecastRequestInput
  assert.equal(verificationInput.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(payload.targetBasis, 'MONTHLY_AVERAGE')
})

test('prepared verification routes point-in-time and period requests to their lawful owners', async () => {
  const owners: string[] = []
  const resolveOwner = (owner: string) => async (input: ForecastRequestInput): Promise<BenchmarkForecastVerificationResult> => {
    owners.push(owner)
    return {
      status: 'NOT_AVAILABLE',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      ...capabilityIdentity(input.targetBasis),
      reason: 'Prepared owner proof.',
    }
  }
  const dependencies = {
    readRollingDailyVerification: resolveOwner('ROLLING_DAILY'),
    readGenericPeriodVerification: resolveOwner('GENERIC_PERIOD'),
  }

  await resolvePreparedForecastVerification({
    seriesId: 'wocaes0074',
    modelId: 'ets',
    targetBasis: 'POINT_IN_TIME',
    sourceFrequency: 'DAILY',
    targetCadence: 'DAILY',
  }, dependencies)
  await resolvePreparedForecastVerification({
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  }, dependencies)

  assert.deepEqual(owners, ['ROLLING_DAILY', 'GENERIC_PERIOD'])
})

test('internal production forecast route denies requests when service token is not configured', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN

  try {
    const handler = createInternalProductionForecastRouteHandler(async () => {
      throw new Error('should not be reached')
    })

    const response = await handler(buildRequest('http://localhost/api/internal/forecast/production?seriesId=wocaes0074&model=ets&forecastMethod=ROLLING_DAILY_POINT_IN_TIME'))
    const payload = await response.json()

    assert.equal(response.status, 403)
    assert.equal(payload.code, 'INTERNAL_SERVICE_AUTH_UNAVAILABLE')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal production forecast route denies requests without bearer credential', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalProductionForecastRouteHandler(async () => {
      throw new Error('should not be reached')
    })

    const response = await handler(buildRequest('http://localhost/api/internal/forecast/production?seriesId=wocaes0074&model=ets&forecastMethod=ROLLING_DAILY_POINT_IN_TIME'))
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.code, 'INTERNAL_SERVICE_AUTH_REQUIRED')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal production forecast route denies requests with invalid bearer credential', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalProductionForecastRouteHandler(async () => {
      throw new Error('should not be reached')
    })

    const response = await handler(buildRequest(
      'http://localhost/api/internal/forecast/production?seriesId=wocaes0074&model=ets&forecastMethod=ROLLING_DAILY_POINT_IN_TIME',
      { Authorization: 'Bearer wrong-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 403)
    assert.equal(payload.code, 'INTERNAL_SERVICE_AUTH_INVALID')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal production forecast route accepts valid dashboard-preview service credential', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'
  let receivedInput: { seriesId: string; modelId: string; forecastMethod: string } | null = null

  try {
    const handler = createInternalProductionForecastRouteHandler(async (input) => {
      receivedInput = input
      return {
        productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
        contractVersion: '1',
        status: 'AVAILABLE',
        benchmark: {
          benchmarkId: input.seriesId,
          displayName: 'Brent, Spot, FOB North Sea',
          frequency: 'DAILY',
          unit: 'USD/bbl',
          currency: 'USD',
          provider: 'macrobond',
          providerSeriesId: input.seriesId,
        },
        forecastMethod: {
          id: 'ROLLING_DAILY_POINT_IN_TIME',
          version: 'rolling-daily-point-in-time-v1',
        },
        model: {
          id: input.modelId,
          selectedCandidate: 'ETS_AUTO',
          selectionMetric: null,
          selectionScore: null,
          selectedParameters: null,
        },
        origin: {
          date: '2026-08-19',
          value: 72.5,
        },
        maxHorizonMonths: 12,
        anchors: [],
        path: [],
        calibration: {
          availabilityStatus: 'AVAILABLE',
          freshnessStatus: 'FRESH',
          quantileConvention: 'HF7_LINEAR_INTERPOLATION',
          coverageLabel: '80% empirical prediction band',
          methodologicalMinimumStatus: 'MET',
          updatedAt: '2026-08-20T00:00:00.000Z',
          processedThrough: '2026-08-19',
          lastResidualAvailabilityDate: '2026-08-19',
        },
        audit: {
          sourceHistoryFingerprint: 'fingerprint-1',
          generatedAt: '2026-08-20T00:00:00.000Z',
          sourceLatestObservationDate: '2026-08-19',
          calendarProjectionMode: 'CALENDAR_MONTH_CLAMP',
          projectionCalendarStrategy: 'CALENDAR_MONTH_CLAMP',
          technicalMinimumTrainingObservations: 60,
          methodologicalTrainingEligibilityStatus: 'ELIGIBLE',
          calibrationUpdatedAt: '2026-08-20T00:00:00.000Z',
          calibrationLastResidualAvailabilityDate: '2026-08-19',
          inputSource: 'DYNAMIC_MARKET_DATA_STORE',
        },
        warnings: [],
      } satisfies ProductionForecastResult
    })

    const response = await handler(buildRequest(
      'http://localhost/api/internal/forecast/production?seriesId=wocaes0074&model=arima&forecastMethod=ROLLING_DAILY_POINT_IN_TIME',
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(receivedInput, {
      seriesId: 'wocaes0074',
      modelId: 'arima',
      forecastMethod: 'ROLLING_DAILY_POINT_IN_TIME',
    })
    assert.equal(payload.productionMethod, 'ROLLING_DAILY_POINT_IN_TIME')
    assert.equal(payload.forecastMethod.id, 'ROLLING_DAILY_POINT_IN_TIME')
    assert.equal(payload.model.id, 'arima')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal capability route denies requests without bearer credential', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalForecastCapabilityRouteHandler(async () => {
      throw new Error('should not be reached')
    })

    const response = await handler(buildRequest('http://localhost/api/internal/forecast/capability?seriesId=wocaes0074&targetSemantics=MONTHLY_AVERAGE&modelId=ets'))
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.code, 'INTERNAL_SERVICE_AUTH_REQUIRED')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal capability route rejects invalid requests before resolving capability', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'
  let called = false

  try {
    const handler = createInternalForecastCapabilityRouteHandler(async () => {
      called = true
      throw new Error('should not be reached')
    })

    const response = await handler(buildRequest(
      'http://localhost/api/internal/forecast/capability?seriesId=*&targetSemantics=MONTHLY_AVERAGE&modelId=ets',
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(called, false)
    assert.equal(payload.code, 'VALIDATION_ERROR')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal capability route returns supported capability in legacy-compatible shape', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalForecastCapabilityRouteHandler(async (input) => ({
      seriesId: input.seriesId,
      targetSemantics: input.targetSemantics,
      modelId: input.modelId,
      sourceFrequency: 'MONTHLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
      status: 'AVAILABLE',
      currentReadiness: 'READY',
      verificationReadiness: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 7,
      reason: null,
    }))

    const response = await handler(buildRequest(
      'http://localhost/api/internal/forecast/capability?seriesId=wocaes0074&targetSemantics=MONTHLY_AVERAGE&modelId=ets',
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      seriesId: 'wocaes0074',
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'ets',
      sourceFrequency: 'MONTHLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
      status: 'AVAILABLE',
      currentReadiness: 'READY',
      verificationReadiness: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 7,
      reason: null,
    })
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal capability route returns unavailable capability without changing status code', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalForecastCapabilityRouteHandler(async (input) => ({
      seriesId: input.seriesId,
      targetSemantics: input.targetSemantics,
      modelId: input.modelId,
      sourceFrequency: 'MONTHLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
      status: 'PREPARATION_REQUIRED',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'NOT_PREPARED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 5,
      reason: 'Prepared artifacts are missing.',
    }))

    const response = await handler(buildRequest(
      'http://localhost/api/internal/forecast/capability?seriesId=wocaes0074&targetSemantics=MONTHLY_AVERAGE&modelId=ets',
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.status, 'PREPARATION_REQUIRED')
    assert.equal(payload.currentReadiness, 'NOT_PREPARED')
    assert.equal(payload.reason, 'Prepared artifacts are missing.')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal capability route emits timing header only when trace is requested', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalForecastCapabilityRouteHandler(async () => ({
      seriesId: 'usnaac0169',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      modelId: 'arima',
      sourceFrequency: 'QUARTERLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'NOT_LAWFUL',
      status: 'NOT_LAWFUL',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 37,
      reason: 'NOT_LAWFUL',
      trace: {
        sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
        sourceFrequencyLookupMs: 31,
        sourceFrequencyLookupExternalIo: true,
        provenanceReadMs: 0,
        provenanceReadCount: 0,
        preparedVariantReadMs: 0,
        preparedVariantReadCount: 0,
        prepareCount: 0,
        modelFitCount: 0,
        exactUnsupportedFastPathTaken: true,
        capabilityTotalMs: 37,
      },
    }))

    const response = await handler(buildRequest(
      'http://localhost/api/internal/forecast/capability?seriesId=usnaac0169&targetSemantics=ROLLING_DAILY_POINT_IN_TIME&modelId=arima',
      { Authorization: 'Bearer test-internal-token', 'x-sg-forecast-trace': '1' },
    ))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-sg-runtime-capability-total-ms'), '37')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal prepare-current route denies invalid bearer credential', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalCurrentForecastPreparationRouteHandler(async () => {
      throw new Error('should not be reached')
    })

    const response = await handler(buildJsonRequest(
      'http://localhost/api/internal/forecast/prepare/current',
      { seriesId: 'wocaes0074', targetSemantics: 'MONTHLY_AVERAGE', modelId: 'ets' },
      { Authorization: 'Bearer wrong-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 403)
    assert.equal(payload.code, 'INTERNAL_SERVICE_AUTH_INVALID')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal prepare-current route rejects invalid payload before compute delegation', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'
  let called = false

  try {
    const handler = createInternalCurrentForecastPreparationRouteHandler(async () => {
      called = true
      throw new Error('should not be reached')
    })

    const response = await handler(buildJsonRequest(
      'http://localhost/api/internal/forecast/prepare/current',
      { seriesId: '*', targetSemantics: 'MONTHLY_AVERAGE', modelId: 'ets' },
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(called, false)
    assert.equal(payload.code, 'VALIDATION_ERROR')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal prepare-current route returns reused success in legacy-compatible shape', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalCurrentForecastPreparationRouteHandler(async (input) => ({
      ...input,
      operation: 'CURRENT_FORECAST',
      status: 'REUSED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 11,
      reason: null,
    }))

    const response = await handler(buildJsonRequest(
      'http://localhost/api/internal/forecast/prepare/current',
      { seriesId: 'wocaes0074', targetSemantics: 'MONTHLY_AVERAGE', modelId: 'ets' },
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      seriesId: 'wocaes0074',
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'ets',
      operation: 'CURRENT_FORECAST',
      status: 'REUSED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 11,
      reason: null,
    })
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('internal progressive preparation route accepts valid dashboard-preview service credential and returns queued status snapshot', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'

  try {
    const handler = createInternalProgressiveForecastPreparationRouteHandler(async () => ({
      seriesId: 'wocaes0074',
      variants: [{
        seriesId: 'wocaes0074',
        modelId: 'naive',
        targetBasis: 'MONTHLY_AVERAGE',
        targetSemantics: 'MONTHLY_AVERAGE',
        currentState: 'PREPARING',
        currentReason: null,
        verificationState: 'QUEUED',
        verificationReason: null,
      }],
      firstReadyCurrent: null,
      activeItem: {
        modelId: 'naive',
        targetBasis: 'MONTHLY_AVERAGE',
        kind: 'CURRENT',
      },
      queuedCount: 1,
      currentReadyCount: 0,
      verificationReadyCount: 0,
    }))

    const response = await handler(buildJsonRequest(
      'http://localhost/api/internal/forecast/progressive',
      { seriesId: 'wocaes0074', targetSemantics: 'MONTHLY_AVERAGE', modelId: 'naive' },
      { Authorization: 'Bearer test-internal-token' },
    ))
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.seriesId, 'wocaes0074')
    assert.equal(payload.variants[0]?.currentState, 'PREPARING')
    assert.equal(payload.variants[0]?.verificationState, 'QUEUED')
    assert.equal(payload.activeItem?.kind, 'CURRENT')
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('interactive current preparation service returns lawful unavailable status without compute', async () => {
  let monthlyCalls = 0
  let rollingCalls = 0
  const service = createInteractiveForecastPreparationService({
    now: () => 10,
    resolveExactCapability: async () => ({
      resolution: buildCapabilityResolution({
        capabilities: [buildCapabilityCandidate({
          targetPreparationState: 'NOT_SUPPORTED',
          capabilityState: 'PREPARATION_REQUIRED',
        })],
      }),
      capability: buildCapabilityCandidate({
        targetPreparationState: 'NOT_SUPPORTED',
        capabilityState: 'PREPARATION_REQUIRED',
      }),
      trace: buildExactCapabilityTrace(),
    }),
    prepareMonthlyCurrent: async () => {
      monthlyCalls += 1
      throw new Error('should not be called')
    },
    prepareRollingCurrent: async () => {
      rollingCalls += 1
      throw new Error('should not be called')
    },
  })

  const result = await service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
  })

  assert.equal(result.status, 'PREPARATION_REQUIRED')
  assert.equal(result.reason, 'PREPARATION_REQUIRED')
  assert.equal(monthlyCalls, 0)
  assert.equal(rollingCalls, 0)
})

test('interactive current preparation service returns structured insufficient contiguous history without compute', async () => {
  let monthlyCalls = 0
  let rollingCalls = 0
  const capability = buildCapabilityCandidate({
    availableObservations: 7,
    minimumRequiredObservations: 36,
    historyEligibility: 'INSUFFICIENT_HISTORY',
    modelEligible: false,
    currentForecastEligible: false,
    capabilityState: 'INSUFFICIENT_HISTORY',
  })
  const service = createInteractiveForecastPreparationService({
    now: () => 15,
    resolveExactCapability: async () => ({
      resolution: buildCapabilityResolution({ capabilities: [capability] }),
      capability,
      trace: buildExactCapabilityTrace(),
    }),
    prepareMonthlyCurrent: async () => {
      monthlyCalls += 1
      throw new Error('should not be called')
    },
    prepareRollingCurrent: async () => {
      rollingCalls += 1
      throw new Error('should not be called')
    },
  })

  const result = await service.prepareCurrent({
    seriesId: 'bindex',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'arima',
  })

  assert.equal(result.status, 'INSUFFICIENT_HISTORY')
  assert.equal(result.reason, 'INSUFFICIENT_CONTIGUOUS_HISTORY: availableContiguousObservations=7; requiredObservations=36.')
  assert.equal(monthlyCalls, 0)
  assert.equal(rollingCalls, 0)
})

test('interactive current preparation service reuses ready artifacts without duplicate compute', async () => {
  let monthlyCalls = 0
  let rollingCalls = 0
  const service = createInteractiveForecastPreparationService({
    now: () => 20,
    resolveExactCapability: async () => ({
      resolution: buildCapabilityResolution({
        capabilities: [buildCapabilityCandidate({
          currentPreparedState: 'READY',
          capabilityState: 'AVAILABLE',
        })],
      }),
      capability: buildCapabilityCandidate({
        currentPreparedState: 'READY',
        capabilityState: 'AVAILABLE',
      }),
      trace: buildExactCapabilityTrace(),
    }),
    prepareMonthlyCurrent: async () => {
      monthlyCalls += 1
      throw new Error('should not be called')
    },
    prepareRollingCurrent: async () => {
      rollingCalls += 1
      throw new Error('should not be called')
    },
  })

  const result = await service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
  })

  assert.equal(result.status, 'REUSED')
  assert.equal(monthlyCalls, 0)
  assert.equal(rollingCalls, 0)
})

test('interactive current preparation service delegates monthly and rolling preparation to canonical owners only', async () => {
  let monthlyCalls = 0
  let rollingCalls = 0
  const service = createInteractiveForecastPreparationService({
    now: (() => {
      let tick = 0
      return () => ++tick
    })(),
    resolveExactCapability: async (input) => {
      const capability = input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
        ? buildCapabilityCandidate({
          identity: {
            seriesId: 'wocaes0074',
            targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
            methodId: 'ROLLING_DAILY_POINT_IN_TIME',
            methodVersion: 'rolling-daily-point-in-time-v1',
            modelId: 'ets',
          },
          sourceFrequency: 'DAILY',
          businessTarget: 'DAILY',
          targetCadence: 'DAILY',
          semanticLawfulness: 'LAWFUL',
          minimumRequiredObservations: 60,
          availableObservations: 96,
          predictionBandResidualCount: 48,
          currentPreparedState: 'NOT_PREPARED',
          historicalPreparedState: 'NOT_PREPARED',
          capabilityState: 'PREPARATION_REQUIRED',
        })
        : buildCapabilityCandidate()

      return {
        resolution: buildCapabilityResolution({ capabilities: [capability] }),
        capability,
        trace: buildExactCapabilityTrace(),
      }
    },
    prepareMonthlyCurrent: async () => {
      monthlyCalls += 1
      return {
        status: 'AVAILABLE',
        cacheStatus: 'miss',
        reason: null,
      } as unknown as BenchmarkForecastCurrentResult
    },
    prepareRollingDailyOwnership: async () => ({
      history: {
        seriesId: 'wocaes0074',
        displayName: 'Brent',
        description: 'Brent',
        frequency: 'DAILY',
        source: 'DYNAMIC_MARKET_DATA_STORE',
        points: [{ date: '2026-08-20', value: 89.9 }],
      },
      identity: {} as never,
      logicalArtifactKey: 'current|wocaes0074|ets|hist-1',
    }),
    prepareRollingCurrent: async (request) => {
      rollingCalls += 1
      assert.equal(request.seriesId, 'wocaes0074')
      assert.deepEqual(request.modelIds, ['ets'])
      assert.equal(request.preparedHistory?.seriesId, 'wocaes0074')
      return {
        status: 'SUCCEEDED',
        seriesId: 'wocaes0074',
        refreshedSnapshotCount: 1,
        recoveredSnapshotCount: 0,
        noOpModelCount: 0,
        failedModelCount: 0,
        results: [{
          status: 'SUCCEEDED',
          modelId: 'ets',
          maintenance: {
            status: 'SUCCEEDED',
            seriesId: 'wocaes0074',
            modelId: 'ets',
            targetBasis: 'POINT_IN_TIME',
            inputSource: 'DYNAMIC_MARKET_DATA_STORE',
            methodId: 'ROLLING_DAILY_POINT_IN_TIME',
            methodVersion: 'rolling-daily-point-in-time-v1',
            reasonCode: null,
            sourceHistoryFingerprint: 'hist-1',
            latestSourceObservationAt: '2026-08-20',
            sourceObservationCount: 96,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
            newOriginCount: 1,
            maturedRecordCount: 0,
            calibrationRefreshCount: 0,
            affectedCalibrationGroupCount: 0,
            lastProcessedOriginAt: '2026-08-20',
            lastMaturedObservedAt: null,
            runtimeMs: 10,
          },
          snapshot: {
            status: 'REFRESHED_AFTER_MAINTENANCE',
            reason: 'MAINTENANCE_DELTA_APPLIED',
            parityStatus: 'MATCHED',
          },
          error: null,
        }],
      }
    },
  })

  const monthly = await service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
  })
  const rolling = await service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'ets',
  })

  assert.equal(monthly.status, 'READY')
  assert.equal(rolling.status, 'READY')
  assert.equal(monthlyCalls, 1)
  assert.equal(rollingCalls, 1)
})

test('interactive current preparation service maps rolling daily NO_OP to REUSED and failures to FAILED', async () => {
  let rollingCalls = 0
  const service = createInteractiveForecastPreparationService({
    now: (() => {
      let tick = 200
      return () => ++tick
    })(),
    resolveExactCapability: async () => {
      const capability = buildCapabilityCandidate({
        identity: {
          seriesId: 'bz_c1_cl',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
          methodId: 'ROLLING_DAILY_POINT_IN_TIME',
          methodVersion: 'rolling-daily-point-in-time-v1',
          modelId: 'arima',
        },
        sourceFrequency: 'DAILY',
        businessTarget: 'DAILY',
        targetCadence: 'DAILY',
        semanticLawfulness: 'LAWFUL',
        minimumRequiredObservations: 60,
        availableObservations: 6108,
        currentPreparedState: 'NOT_PREPARED',
        historicalPreparedState: 'NOT_PREPARED',
        capabilityState: 'PREPARATION_REQUIRED',
      })

      return {
        resolution: buildCapabilityResolution({ capabilities: [capability] }),
        capability,
        trace: buildExactCapabilityTrace(),
      }
    },
    prepareMonthlyCurrent: async () => {
      throw new Error('should not be called')
    },
    prepareRollingDailyOwnership: async () => ({
      history: {
        seriesId: 'bz_c1_cl',
        displayName: 'Brent',
        description: 'Brent',
        frequency: 'DAILY',
        source: 'DYNAMIC_MARKET_DATA_STORE',
        points: [{ date: '2026-08-20', value: 89.9 }],
      },
      identity: {} as never,
      logicalArtifactKey: 'current|bz_c1_cl|arima|hist-2',
    }),
    prepareRollingCurrent: async () => {
      rollingCalls += 1
      return rollingCalls === 1
        ? {
            status: 'NO_OP',
            seriesId: 'bz_c1_cl',
            refreshedSnapshotCount: 0,
            recoveredSnapshotCount: 0,
            noOpModelCount: 1,
            failedModelCount: 0,
            results: [{
              status: 'NO_OP',
              modelId: 'arima',
              maintenance: {
                status: 'NO_OP',
                seriesId: 'bz_c1_cl',
                modelId: 'arima',
                targetBasis: 'POINT_IN_TIME',
                inputSource: 'DYNAMIC_MARKET_DATA_STORE',
                methodId: 'ROLLING_DAILY_POINT_IN_TIME',
                methodVersion: 'rolling-daily-point-in-time-v1',
                reasonCode: null,
                sourceHistoryFingerprint: 'hist-2',
                latestSourceObservationAt: '2026-08-20',
                sourceObservationCount: 6108,
                filteredNullCount: 0,
                filteredDuplicateCount: 0,
                newOriginCount: 0,
                maturedRecordCount: 0,
                calibrationRefreshCount: 0,
                affectedCalibrationGroupCount: 0,
                lastProcessedOriginAt: '2026-08-20',
                lastMaturedObservedAt: null,
                runtimeMs: 10,
              },
              snapshot: {
                status: 'SKIPPED_ALREADY_FRESH',
                reason: null,
                parityStatus: null,
              },
              error: null,
            }],
          }
        : {
            status: 'FAILED',
            seriesId: 'bz_c1_cl',
            refreshedSnapshotCount: 0,
            recoveredSnapshotCount: 0,
            noOpModelCount: 0,
            failedModelCount: 1,
            results: [{
              status: 'FAILED',
              modelId: 'arima',
              maintenance: null,
              snapshot: {
                status: 'SKIPPED_MAINTENANCE_FAILURE',
                reason: 'MAINTENANCE_FAILED',
                parityStatus: null,
              },
              error: 'maintenance failed',
            }],
          }
    },
  })

  const reused = await service.prepareCurrent({
    seriesId: 'bz_c1_cl',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  })
  const failed = await service.prepareCurrent({
    seriesId: 'bz_c1_cl',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  })

  assert.equal(reused.status, 'REUSED')
  assert.equal(reused.reason, null)
  assert.equal(failed.status, 'FAILED')
  assert.equal(failed.reason, 'maintenance failed')
})

test('interactive point-in-time current reuses ready artifacts without owner compute', async () => {
  let rollingCalls = 0
  let ownershipCalls = 0

  const capability = buildCapabilityCandidate({
    identity: {
      seriesId: 'wocaes0074',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      methodVersion: 'rolling-daily-point-in-time-v1',
      modelId: 'arima',
    },
    sourceFrequency: 'DAILY',
    businessTarget: 'DAILY',
    targetCadence: 'DAILY',
    semanticLawfulness: 'LAWFUL',
    currentPreparedState: 'READY',
    historicalPreparedState: 'READY',
    capabilityState: 'AVAILABLE',
  })

  const service = createInteractiveForecastPreparationService({
    now: () => 300,
    resolveExactCapability: async () => ({
      resolution: buildCapabilityResolution({ capabilities: [capability] }),
      capability,
      trace: buildExactCapabilityTrace(),
    }),
    prepareRollingDailyOwnership: async () => {
      ownershipCalls += 1
      throw new Error('should not be called')
    },
    prepareMonthlyCurrent: async () => {
      throw new Error('should not be called')
    },
    prepareRollingCurrent: async () => {
      rollingCalls += 1
      throw new Error('should not be called')
    },
  })

  const result = await service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  })

  assert.equal(result.status, 'REUSED')
  assert.equal(ownershipCalls, 0)
  assert.equal(rollingCalls, 0)
})

test('interactive point-in-time current uses canonical single-flight for concurrent same-identity requests', async () => {
  let rollingCalls = 0
  let ownershipCalls = 0
  let releaseRolling: (() => void) | undefined
  const rollingGate = new Promise<void>((resolve) => {
    releaseRolling = resolve
  })

  const capability = buildCapabilityCandidate({
    identity: {
      seriesId: 'wocaes0074',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      methodVersion: 'rolling-daily-point-in-time-v1',
      modelId: 'arima',
    },
    sourceFrequency: 'DAILY',
    businessTarget: 'DAILY',
    targetCadence: 'DAILY',
    semanticLawfulness: 'LAWFUL',
    minimumRequiredObservations: 60,
    availableObservations: 6108,
    currentPreparedState: 'NOT_PREPARED',
    historicalPreparedState: 'READY',
    capabilityState: 'PREPARATION_REQUIRED',
  })

  const service = createInteractiveForecastPreparationService({
    now: (() => {
      let tick = 400
      return () => ++tick
    })(),
    resolveExactCapability: async () => ({
      resolution: buildCapabilityResolution({ capabilities: [capability] }),
      capability,
      trace: buildExactCapabilityTrace(),
    }),
    prepareRollingDailyOwnership: async () => {
      ownershipCalls += 1
      return {
        history: {
          seriesId: 'wocaes0074',
          displayName: 'Brent',
          description: 'Brent',
          frequency: 'DAILY',
          source: 'DYNAMIC_MARKET_DATA_STORE',
          points: [{ date: '2026-08-20', value: 89.9 }],
        },
        identity: {} as never,
        logicalArtifactKey: 'current|wocaes0074|arima|hist-1',
      }
    },
    prepareMonthlyCurrent: async () => {
      throw new Error('should not be called')
    },
    prepareRollingCurrent: async (request) => {
      rollingCalls += 1
      assert.equal(request.seriesId, 'wocaes0074')
      assert.deepEqual(request.modelIds, ['arima'])
      await rollingGate
      return {
        status: 'SUCCEEDED',
        seriesId: 'wocaes0074',
        refreshedSnapshotCount: 1,
        recoveredSnapshotCount: 0,
        noOpModelCount: 0,
        failedModelCount: 0,
        results: [{
          status: 'SUCCEEDED',
          modelId: 'arima',
          maintenance: {
            status: 'SUCCEEDED',
            seriesId: 'wocaes0074',
            modelId: 'arima',
            targetBasis: 'POINT_IN_TIME',
            inputSource: 'DYNAMIC_MARKET_DATA_STORE',
            methodId: 'ROLLING_DAILY_POINT_IN_TIME',
            methodVersion: 'rolling-daily-point-in-time-v1',
            reasonCode: null,
            sourceHistoryFingerprint: 'hist-1',
            latestSourceObservationAt: '2026-08-20',
            sourceObservationCount: 6108,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
            newOriginCount: 1,
            maturedRecordCount: 0,
            calibrationRefreshCount: 0,
            affectedCalibrationGroupCount: 0,
            lastProcessedOriginAt: '2026-08-20',
            lastMaturedObservedAt: null,
            runtimeMs: 10,
          },
          snapshot: {
            status: 'REFRESHED_AFTER_MAINTENANCE',
            reason: 'MAINTENANCE_DELTA_APPLIED',
            parityStatus: 'MATCHED',
          },
          error: null,
        }],
      }
    },
  })

  const first = service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  })
  const second = service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  })

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(rollingCalls, 1)
  assert.equal(ownershipCalls, 2)

  releaseRolling?.()
  const results = await Promise.all([first, second])

  assert.equal(rollingCalls, 1)
  assert.deepEqual(results.map((result) => result.status), ['READY', 'READY'])
  assert.ok(results.every((result) => result.reason === null))
})

test('interactive point-in-time current keeps different lawful identities independent', async () => {
  let rollingCalls = 0
  let activeRollingCalls = 0
  let maxActiveRollingCalls = 0
  let releaseRolling: (() => void) | undefined
  const rollingGate = new Promise<void>((resolve) => {
    releaseRolling = resolve
  })

  const service = createInteractiveForecastPreparationService({
    now: (() => {
      let tick = 500
      return () => ++tick
    })(),
    resolveExactCapability: async (input) => {
      const capability = buildCapabilityCandidate({
        identity: {
          seriesId: 'wocaes0074',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
          methodId: 'ROLLING_DAILY_POINT_IN_TIME',
          methodVersion: 'rolling-daily-point-in-time-v1',
          modelId: input.modelId,
        },
        sourceFrequency: 'DAILY',
        businessTarget: 'DAILY',
        targetCadence: 'DAILY',
        semanticLawfulness: 'LAWFUL',
        minimumRequiredObservations: 60,
        availableObservations: 6108,
        currentPreparedState: 'NOT_PREPARED',
        historicalPreparedState: 'READY',
        capabilityState: 'PREPARATION_REQUIRED',
      })

      return {
        resolution: buildCapabilityResolution({ capabilities: [capability] }),
        capability,
        trace: buildExactCapabilityTrace(),
      }
    },
    prepareRollingDailyOwnership: async (input) => ({
      history: {
        seriesId: input.seriesId,
        displayName: 'Brent',
        description: 'Brent',
        frequency: 'DAILY',
        source: 'DYNAMIC_MARKET_DATA_STORE',
        points: [{ date: '2026-08-20', value: 89.9 }],
      },
      identity: {} as never,
      logicalArtifactKey: `current|${input.seriesId}|${input.modelId}|hist-1`,
    }),
    prepareMonthlyCurrent: async () => {
      throw new Error('should not be called')
    },
    prepareRollingCurrent: async (request) => {
      rollingCalls += 1
      activeRollingCalls += 1
      maxActiveRollingCalls = Math.max(maxActiveRollingCalls, activeRollingCalls)
      await rollingGate
      activeRollingCalls -= 1
      return {
        status: 'SUCCEEDED',
        seriesId: request.seriesId,
        refreshedSnapshotCount: 1,
        recoveredSnapshotCount: 0,
        noOpModelCount: 0,
        failedModelCount: 0,
        results: request.modelIds.map((modelId) => ({
          status: 'SUCCEEDED' as const,
          modelId,
          maintenance: {
            status: 'SUCCEEDED' as const,
            seriesId: request.seriesId,
            modelId,
            targetBasis: 'POINT_IN_TIME',
            inputSource: 'DYNAMIC_MARKET_DATA_STORE',
            methodId: 'ROLLING_DAILY_POINT_IN_TIME',
            methodVersion: 'rolling-daily-point-in-time-v1',
            reasonCode: null,
            sourceHistoryFingerprint: 'hist-1',
            latestSourceObservationAt: '2026-08-20',
            sourceObservationCount: 6108,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
            newOriginCount: 1,
            maturedRecordCount: 0,
            calibrationRefreshCount: 0,
            affectedCalibrationGroupCount: 0,
            lastProcessedOriginAt: '2026-08-20',
            lastMaturedObservedAt: null,
            runtimeMs: 10,
          },
          snapshot: {
            status: 'REFRESHED_AFTER_MAINTENANCE' as const,
            reason: 'MAINTENANCE_DELTA_APPLIED' as const,
            parityStatus: 'MATCHED' as const,
          },
          error: null,
        })),
      }
    },
  })

  const first = service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'ets',
  })
  const second = service.prepareCurrent({
    seriesId: 'wocaes0074',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    modelId: 'arima',
  })

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(rollingCalls, 2)
  assert.equal(maxActiveRollingCalls, 2)

  releaseRolling?.()
  const results = await Promise.all([first, second])

  assert.deepEqual(results.map((result) => result.status), ['READY', 'READY'])
})

test('interactive current preparation service preserves native sparse cadence for lawful END_OF_PERIOD preparation', async () => {
  let monthlyCalls = 0

  const service = createInteractiveForecastPreparationService({
    now: (() => {
      let tick = 100
      return () => ++tick
    })(),
    resolveExactCapability: async () => {
      const capability = buildCapabilityCandidate({
        identity: {
          seriesId: 'ussurv0303',
          targetSemantics: 'END_OF_PERIOD',
          methodId: 'END_OF_PERIOD',
          methodVersion: 'native-period-end-of-period-v1',
          modelId: 'arima',
        },
        sourceFrequency: 'SEMIANNUAL',
        businessTarget: 'END_OF_PERIOD',
        targetCadence: 'SEMIANNUAL',
        semanticLawfulness: 'LAWFUL_WITH_PROVENANCE',
        currentPreparedState: 'NOT_PREPARED',
        historicalPreparedState: 'NOT_PREPARED',
        capabilityState: 'PREPARATION_REQUIRED',
      })

      return {
        resolution: buildCapabilityResolution({ capabilities: [capability] }),
        capability,
        trace: buildExactCapabilityTrace(),
      }
    },
    prepareMonthlyCurrent: async (request) => {
      monthlyCalls += 1
      assert.equal(request.seriesId, 'ussurv0303')
      assert.equal(request.modelId, 'arima')
      assert.equal(request.targetBasis, 'END_OF_PERIOD')
      assert.equal(request.sourceFrequency, 'SEMIANNUAL')
      assert.equal(request.targetCadence, 'SEMIANNUAL')

      return {
        status: 'AVAILABLE',
        cacheStatus: 'miss',
        reason: null,
      } as unknown as BenchmarkForecastCurrentResult
    },
    prepareRollingCurrent: async () => {
      throw new Error('should not be called')
    },
  })

  const result = await service.prepareCurrent({
    seriesId: 'ussurv0303',
    targetSemantics: 'END_OF_PERIOD',
    modelId: 'arima',
  })

  assert.equal(result.status, 'READY')
  assert.equal(result.reason, null)
  assert.equal(monthlyCalls, 1)
})

test('current forecast route propagates stress correlation into the resolver context', async () => {
  const events: ForecastStressEvent[] = []
  const telemetry = createForecastStressTelemetry({
    env: {
      APP_ENV: 'development',
      FORECAST_STRESS_TELEMETRY_ENABLED: 'true',
      FORECAST_STRESS_ENVIRONMENT_ID: 'phase-2-1-local-isolated-v1',
      FORECAST_STRESS_DATABASE_CLONE_ALIAS: 'phase-2-1-local-clone-v1',
      SG_RUNTIME_DATABASE_URL: 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_app',
      MARKET_DATA_DATABASE_URL: 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data',
    },
    sink: (event) => events.push(event),
  })
  const handler = createCurrentForecastRouteHandler(async (input) => {
    telemetry.emit('resolver_probe', { reached: true })
    return {
      status: 'UNSUPPORTED',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      ...capabilityIdentity(input.targetBasis),
      reason: 'Readiness correlation probe.',
      supportedSeriesIds: [input.seriesId],
      supportedModels: [input.modelId],
    }
  }, telemetry)

  const response = await handler(buildUserRequest(
    'http://localhost/api/benchmark/forecast/current?seriesId=wocaes0074&model=ets',
    {
      'x-sg-stress-run-id': 'readiness-route-probe',
      'x-sg-stress-scenario-id': 'READINESS_CORRELATION_PROBE',
      'x-sg-stress-virtual-user-id': 'vu-1',
      'x-sg-stress-logical-artifact-key': 'wocaes0074|MONTHLY_AVERAGE|ets|probe',
      'x-request-id': 'request-route-1',
    },
  ))
  telemetry.close()

  assert.equal(response.status, 200)
  assert.deepEqual(events.map(({ event }) => event), ['resource_sample', 'resolver_probe', 'resource_sample'])
  assert.ok(events.every(({ stressRunId }) => stressRunId === 'readiness-route-probe'))
  assert.ok(events.every(({ scenarioId }) => scenarioId === 'READINESS_CORRELATION_PROBE'))
  assert.ok(events.every(({ requestId }) => requestId === 'request-route-1'))
  assert.ok(events.every(({ forecastIdentity }) => forecastIdentity === 'wocaes0074|MONTHLY_AVERAGE|ets'))
})
