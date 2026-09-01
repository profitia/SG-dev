import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  FORECAST_TRACE_HEADER,
  createInteractiveCurrentPreparationGateway,
  readInteractiveForecastCapability,
  requestInteractiveForecastCurrentPreparation,
} from '@/lib/benchmark-forecast/interactive-current-preparation'
import { createPrepareCurrentForecastRouteHandler } from '@/app/api/benchmark-forecast/current/prepare/route'

test('interactive current preparation gateway reuses ready variants without prepare POST', async () => {
  let prepareCalls = 0
  const prepareCurrent = createInteractiveCurrentPreparationGateway({
    now: (() => {
      let tick = 10
      return () => tick += 5
    })(),
    resolveCapability: async () => ({
      seriesId: 'wocaes0074',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      modelId: 'arima',
      sourceFrequency: 'DAILY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL',
      status: 'READY',
      currentReadiness: 'READY',
      verificationReadiness: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 4,
      reason: null,
    }),
    prepareCurrent: async () => {
      prepareCalls += 1
      throw new Error('prepare-current should not be called')
    },
  })

  const result = await prepareCurrent({
    seriesId: 'wocaes0074',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  assert.equal(result.state, 'READY')
  assert.equal(result.prepareAttempted, false)
  assert.equal(result.prepareStatus, null)
  assert.equal(prepareCalls, 0)
})

test('interactive current preparation gateway fails closed on unsupported capability without prepare POST', async () => {
  let prepareCalls = 0
  const prepareCurrent = createInteractiveCurrentPreparationGateway({
    now: (() => {
      let tick = 20
      return () => tick += 3
    })(),
    resolveCapability: async () => ({
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
      timingMs: 5,
      reason: 'UNSUPPORTED_FREQUENCY',
    }),
    prepareCurrent: async () => {
      prepareCalls += 1
      throw new Error('prepare-current should not be called')
    },
  })

  const result = await prepareCurrent({
    seriesId: 'usnaac0169',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  assert.equal(result.state, 'UNSUPPORTED')
  assert.equal(result.prepareAttempted, false)
  assert.equal(result.prepareStatus, null)
  assert.equal(result.reason, 'UNSUPPORTED_FREQUENCY')
  assert.equal(prepareCalls, 0)
})

test('interactive current preparation gateway prepares exactly the requested variant', async () => {
  const capabilityInputs: Array<Record<string, string>> = []
  const prepareInputs: Array<Record<string, string>> = []
  const prepareCurrent = createInteractiveCurrentPreparationGateway({
    now: (() => {
      let tick = 30
      return () => tick += 7
    })(),
    resolveCapability: async (input) => {
      capabilityInputs.push(input)
      return {
        seriesId: input.seriesId,
        targetSemantics: 'MONTHLY_AVERAGE',
        modelId: input.modelId,
        sourceFrequency: 'MONTHLY',
        sourceAvailability: 'AVAILABLE',
        lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
        status: 'NOT_PREPARED',
        currentReadiness: 'NOT_PREPARED',
        verificationReadiness: 'NOT_PREPARED',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: 4,
        reason: 'Prepared artifacts are missing.',
      }
    },
    prepareCurrent: async (input) => {
      prepareInputs.push(input)
      return {
        seriesId: input.seriesId,
        targetSemantics: 'MONTHLY_AVERAGE',
        modelId: input.modelId,
        operation: 'CURRENT_FORECAST',
        status: 'READY',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: 18,
        reason: null,
      }
    },
  })

  const result = await prepareCurrent({
    seriesId: 'wocaes0280',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
  })

  assert.equal(result.state, 'READY')
  assert.equal(result.prepareAttempted, true)
  assert.equal(result.prepareStatus, 'READY')
  assert.deepEqual(capabilityInputs, [{
    seriesId: 'wocaes0280',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
  }])
  assert.deepEqual(prepareInputs, [{
    seriesId: 'wocaes0280',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
  }])
})

test('interactive current preparation gateway reports failed preparation truthfully', async () => {
  const prepareCurrent = createInteractiveCurrentPreparationGateway({
    now: (() => {
      let tick = 40
      return () => tick += 6
    })(),
    resolveCapability: async () => ({
      seriesId: 'wocaes0280',
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'ets',
      sourceFrequency: 'MONTHLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
      status: 'PREPARATION_REQUIRED',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'NOT_PREPARED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 4,
      reason: 'Prepared artifacts are missing.',
    }),
    prepareCurrent: async () => ({
      seriesId: 'wocaes0280',
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'ets',
      operation: 'CURRENT_FORECAST',
      status: 'FAILED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 12,
      reason: 'MODEL_FIT_FAILED',
    }),
  })

  const result = await prepareCurrent({
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
  })

  assert.equal(result.state, 'FAILED')
  assert.equal(result.prepareAttempted, true)
  assert.equal(result.prepareStatus, 'FAILED')
  assert.equal(result.reason, 'MODEL_FIT_FAILED')
})

test('interactive current preparation route rejects invalid input before gateway execution', async () => {
  let called = false
  const handler = createPrepareCurrentForecastRouteHandler(async () => {
    called = true
    throw new Error('should not be reached')
  })

  const response = await handler(new NextRequest('http://localhost/api/benchmark-forecast/current/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesId: '', modelId: 'arima', targetBasis: 'POINT_IN_TIME' }),
  }))
  const payload = await response.json()

  assert.equal(response.status, 400)
  assert.equal(called, false)
  assert.equal(String(payload.error), 'seriesId is required.')
})

test('interactive current preparation route includes trace payload only when explicitly requested', async () => {
  const handler = createPrepareCurrentForecastRouteHandler(async () => ({
    seriesId: 'usnaac0169',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    capabilityStatus: 'NOT_LAWFUL',
    currentReadiness: 'NOT_PREPARED',
    timingMs: 111,
    state: 'UNSUPPORTED',
    prepareAttempted: false,
    prepareStatus: null,
    reason: 'NOT_LAWFUL',
    trace: {
      dashboardBridgeTotalMs: 111,
      fallbackUsed: false,
      attempts: [{
        targetRole: 'PRIMARY',
        startedAt: '2026-09-01T00:00:00.000Z',
        completedAt: '2026-09-01T00:00:00.111Z',
        durationMs: 111,
        httpStatus: 200,
        timeout: false,
        fallbackUsed: false,
        sgRuntimeCapabilityExecutionMs: 109,
      }],
    },
  }))

  const response = await handler(new NextRequest('http://localhost/api/benchmark-forecast/current/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [FORECAST_TRACE_HEADER]: '1' },
    body: JSON.stringify({ seriesId: 'usnaac0169', modelId: 'arima', targetBasis: 'POINT_IN_TIME' }),
  }))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.trace.dashboardBridgeTotalMs, 111)
  assert.equal(payload.trace.attempts[0].sgRuntimeCapabilityExecutionMs, 109)
})

test('interactive current capability bridge keeps private auth server-side and forwards exact identity', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  const previousBaseUrl = process.env.SG_RUNTIME_BASE_URL
  const originalFetch = global.fetch
  let capturedUrl: URL | null = null
  let capturedInit: RequestInit | null = null

  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'dashboard-preview-token'
  process.env.SG_RUNTIME_BASE_URL = 'https://sg-runtime.example.invalid'
  global.fetch = (async (input: URL | RequestInfo | string, init?: RequestInit) => {
    capturedUrl = new URL(String(input))
    capturedInit = init ?? null
    return new Response(JSON.stringify({
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
      timingMs: 8,
      reason: 'UNSUPPORTED_FREQUENCY',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-sg-runtime-capability-total-ms': '8' },
    })
  }) as typeof fetch

  try {
    const result = await readInteractiveForecastCapability({
      seriesId: 'usnaac0169',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
    })

    assert.equal(result.status, 'NOT_LAWFUL')
  } finally {
    global.fetch = originalFetch
    if (previousToken === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    if (previousBaseUrl === undefined) delete process.env.SG_RUNTIME_BASE_URL
    else process.env.SG_RUNTIME_BASE_URL = previousBaseUrl
  }

  if (!capturedUrl || !capturedInit) {
    throw new Error('Expected capability bridge to issue a server-side SG Runtime request.')
  }

  assert.equal(capturedUrl.pathname, '/api/internal/forecast/capability')
  assert.equal(capturedUrl.searchParams.get('seriesId'), 'usnaac0169')
  assert.equal(capturedUrl.searchParams.get('modelId'), 'arima')
  assert.equal(capturedUrl.searchParams.get('targetSemantics'), 'ROLLING_DAILY_POINT_IN_TIME')
  assert.equal(capturedUrl.searchParams.get('token'), null)
  assert.equal((capturedInit.headers as Record<string, string>).Authorization, 'Bearer dashboard-preview-token')
  assert.equal((capturedInit.headers as Record<string, string>)[FORECAST_TRACE_HEADER], undefined)
})

test('interactive current prepare bridge keeps private auth server-side and forwards exact identity', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  const previousBaseUrl = process.env.SG_RUNTIME_BASE_URL
  const originalFetch = global.fetch
  let capturedUrl: URL | null = null
  let capturedInit: RequestInit | null = null

  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'dashboard-preview-token'
  process.env.SG_RUNTIME_BASE_URL = 'https://sg-runtime.example.invalid'
  global.fetch = (async (input: URL | RequestInfo | string, init?: RequestInit) => {
    capturedUrl = new URL(String(input))
    capturedInit = init ?? null
    return new Response(JSON.stringify({
      seriesId: 'wocaes0280',
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'ets',
      operation: 'CURRENT_FORECAST',
      status: 'READY',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 101,
      reason: null,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-sg-runtime-capability-total-ms': '11' },
    })
  }) as typeof fetch

  try {
    const result = await requestInteractiveForecastCurrentPreparation({
      seriesId: 'wocaes0280',
      modelId: 'ets',
      targetBasis: 'MONTHLY_AVERAGE',
    })

    assert.equal(result.status, 'READY')
  } finally {
    global.fetch = originalFetch
    if (previousToken === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    if (previousBaseUrl === undefined) delete process.env.SG_RUNTIME_BASE_URL
    else process.env.SG_RUNTIME_BASE_URL = previousBaseUrl
  }

  if (!capturedUrl || !capturedInit) {
    throw new Error('Expected prepare bridge to issue a server-side SG Runtime request.')
  }

  assert.equal(capturedUrl.pathname, '/api/internal/forecast/prepare/current')
  assert.equal(capturedUrl.searchParams.get('token'), null)
  assert.equal((capturedInit.headers as Record<string, string>).Authorization, 'Bearer dashboard-preview-token')
  const body = JSON.parse(String(capturedInit.body)) as Record<string, string>
  assert.deepEqual(body, {
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetSemantics: 'MONTHLY_AVERAGE',
  })
})

test('interactive capability bridge falls back to the public SG Runtime deployment after a primary timeout', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  const previousBaseUrl = process.env.SG_RUNTIME_BASE_URL
  const originalFetch = global.fetch
  const visited: string[] = []

  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'dashboard-preview-token'
  process.env.SG_RUNTIME_BASE_URL = 'https://sg-runtime-primary.example.invalid'
  global.fetch = (async (input: URL | RequestInfo | string) => {
    const url = new URL(String(input))
    visited.push(url.origin)

    if (url.origin === 'https://sg-runtime-primary.example.invalid') {
      const timeoutError = new Error('timed out') as Error & { name: string }
      timeoutError.name = 'AbortError'
      throw timeoutError
    }

    return new Response(JSON.stringify({
      seriesId: 'wocaes0280',
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'arima',
      sourceFrequency: 'MONTHLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
      status: 'NOT_PREPARED',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'NOT_PREPARED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 11,
      reason: 'Prepared artifacts are missing.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const result = await readInteractiveForecastCapability({
      seriesId: 'wocaes0280',
      modelId: 'arima',
      targetBasis: 'MONTHLY_AVERAGE',
    })

    assert.equal(result.status, 'NOT_PREPARED')
  } finally {
    global.fetch = originalFetch
    if (previousToken === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    if (previousBaseUrl === undefined) delete process.env.SG_RUNTIME_BASE_URL
    else process.env.SG_RUNTIME_BASE_URL = previousBaseUrl
  }

  assert.deepEqual(visited, [
    'https://sg-runtime-primary.example.invalid',
    'https://benchmark-finder-category-builder.onrender.com',
  ])
})