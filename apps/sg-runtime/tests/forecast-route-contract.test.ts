import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  createCurrentForecastRouteHandler,
  createForecastVerificationRouteHandler,
  createInternalProductionForecastRouteHandler,
  resolvePreparedForecastVerification,
} from '../lib/forecast/route-handlers'
import type {
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationResult,
} from '../lib/forecast/contracts'
import type { ProductionForecastResult } from '../lib/forecast/production-routing'
import type { ForecastRequestInput } from '../lib/forecast/request-contract'
import { createForecastStressTelemetry, type ForecastStressEvent } from '../lib/forecast/stress-telemetry'

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
