import assert from 'node:assert/strict'
import test from 'node:test'

import {
  explicitlyPrepareForecastCurrent,
  readCurrentForecastCapabilityThroughDashboard,
  readProgressiveForecastPreparationThroughDashboard,
  readPreparedCurrentForecastThroughDashboard,
  requestExplicitCurrentForecastPreparationThroughDashboard,
  resolveForecastCurrentDisplayState,
  resolveForecastCurrentUiState,
  resolveSelectedProgressiveVariant,
  shouldReadCurrentForecast,
  shouldPrepareCurrentForecastFromCapability,
  shouldShowExplicitCurrentPreparation,
  warmCurrentForecastThroughDashboard,
} from '@/lib/benchmark-forecast/interactive-current-client'
import { shouldWarmCurrentForecastInBackground } from '@/components/raw-data-view'

test('initial embedded historical-first state keeps current forecast reads disabled until explicit forecast intent', () => {
  assert.equal(shouldReadCurrentForecast({
    showForecast: false,
    isForecastPortfolioVariant: true,
    seriesId: 'wocaes0074',
  }), false)
})

test('embedded forecast portfolio warm-up stays behind an explicit query gate', () => {
  const enabledParams = new URLSearchParams('warmCurrentForecast=1')
  const disabledParams = new URLSearchParams('warmCurrentForecast=0')

  assert.equal(shouldWarmCurrentForecastInBackground(enabledParams as ReturnType<typeof import('next/navigation').useSearchParams>, {
    embedded: true,
    variant: 'forecast-portfolio-v3',
  }), true)

  assert.equal(shouldWarmCurrentForecastInBackground(disabledParams as ReturnType<typeof import('next/navigation').useSearchParams>, {
    embedded: true,
    variant: 'forecast-portfolio-v3',
  }), false)

  assert.equal(shouldWarmCurrentForecastInBackground(enabledParams as ReturnType<typeof import('next/navigation').useSearchParams>, {
    embedded: false,
    variant: 'forecast-portfolio-v3',
  }), false)
})

test('background warm-up uses capability truth and avoids prepare for unsupported identities', async () => {
  const calls: string[] = []

  const outcome = await warmCurrentForecastThroughDashboard(async (input, init) => {
    const url = new URL(String(input), 'https://dashboard.example.invalid')
    calls.push(`${init?.method ?? 'GET'} ${url.pathname}?${url.searchParams.toString()}`)

    if (url.pathname === '/api/benchmark-forecast/current/capability') {
      return new Response(JSON.stringify({
        seriesId: 'usnaac0169',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        modelId: 'arima',
        sourceFrequency: 'WEEKLY',
        sourceAvailability: 'AVAILABLE',
        lawfulTargetSemantics: 'NOT_LAWFUL',
        status: 'NOT_LAWFUL',
        currentReadiness: 'NOT_PREPARED',
        verificationReadiness: 'READY',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: 9,
        reason: 'UNSUPPORTED_FREQUENCY',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    throw new Error(`Unexpected request ${url.pathname}`)
  }, {
    seriesId: 'usnaac0169',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  assert.equal(outcome.currentState, 'UNSUPPORTED')
  assert.equal(outcome.prepareAttempted, false)
  assert.equal(shouldPrepareCurrentForecastFromCapability(outcome.capability), false)
  assert.deepEqual(calls, [
    'GET /api/benchmark-forecast/current/capability?seriesId=usnaac0169&modelId=arima&targetBasis=POINT_IN_TIME',
  ])
})

test('background warm-up performs one exact prepare and one reread for a lawful cold miss', async () => {
  const calls: string[] = []

  const outcome = await warmCurrentForecastThroughDashboard(async (input, init) => {
    const method = init?.method ?? 'GET'
    const url = new URL(String(input), 'https://dashboard.example.invalid')
    calls.push(`${method} ${url.pathname}?${url.searchParams.toString()}`)

    if (url.pathname === '/api/benchmark-forecast/current/capability') {
      return new Response(JSON.stringify({
        seriesId: 'wocaes0280',
        targetSemantics: 'END_OF_PERIOD',
        modelId: 'ets',
        sourceFrequency: 'MONTHLY',
        sourceAvailability: 'AVAILABLE',
        lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
        status: 'PREPARATION_REQUIRED',
        currentReadiness: 'NOT_PREPARED',
        verificationReadiness: 'NOT_PREPARED',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: 6,
        reason: 'Prepared artifacts are missing.',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.pathname === '/api/benchmark-forecast/current/prepare') {
      return new Response(JSON.stringify({
        seriesId: 'wocaes0280',
        modelId: 'ets',
        targetBasis: 'END_OF_PERIOD',
        targetSemantics: 'END_OF_PERIOD',
        state: 'READY',
        capabilityStatus: 'PREPARATION_REQUIRED',
        currentReadiness: 'NOT_PREPARED',
        prepareAttempted: true,
        prepareStatus: 'READY',
        reason: null,
        timingMs: 1200,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.pathname === '/api/benchmark-forecast/current') {
      return new Response(JSON.stringify({
        status: 'AVAILABLE',
        seriesId: 'wocaes0280',
        modelId: 'ets',
        targetBasis: 'END_OF_PERIOD',
        targetSemantics: 'END_OF_PERIOD',
        methodId: 'END_OF_PERIOD',
        displayName: 'WTI',
        description: null,
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        lineage: {
          inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
          inputRunId: null,
          sourceSeriesId: 'wocaes0280',
          sourceFrequency: 'MONTHLY',
          historyFingerprint: 'abc',
          preparation: null,
        },
        history: { frequency: 'MONTHLY', start: '2020-01-01', end: '2026-08-01', observations: 80 },
        forecastOrigin: '2026-08-01',
        currentForecast: {},
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    throw new Error(`Unexpected request ${url.pathname}`)
  }, {
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(outcome.currentState, 'AVAILABLE')
  assert.equal(outcome.prepareAttempted, true)
  assert.deepEqual(calls, [
    'GET /api/benchmark-forecast/current/capability?seriesId=wocaes0280&modelId=ets&targetBasis=END_OF_PERIOD',
    'POST /api/benchmark-forecast/current/prepare?',
    'GET /api/benchmark-forecast/current?seriesId=wocaes0280&model=ets&targetBasis=END_OF_PERIOD',
  ])
})

test('background warm-up hot reuse reads prepared current without recompute', async () => {
  const prepareCalls: string[] = []

  const outcome = await warmCurrentForecastThroughDashboard(async (input, init) => {
    const method = init?.method ?? 'GET'
    const url = new URL(String(input), 'https://dashboard.example.invalid')

    if (url.pathname === '/api/benchmark-forecast/current/capability') {
      return new Response(JSON.stringify({
        seriesId: 'wocaes0074',
        targetSemantics: 'POINT_IN_TIME',
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
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.pathname === '/api/benchmark-forecast/current/prepare') {
      prepareCalls.push(method)
      throw new Error('prepare should not be called for hot warm-up')
    }

    return new Response(JSON.stringify({
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
        historyFingerprint: 'abc',
        preparation: null,
      },
      history: { frequency: 'DAILY', start: '2026-01-01', end: '2026-08-31', observations: 180 },
      forecastOrigin: '2026-08-31',
      currentForecast: {},
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'wocaes0074',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  assert.equal(outcome.currentState, 'AVAILABLE')
  assert.equal(outcome.prepareAttempted, false)
  assert.deepEqual(prepareCalls, [])
})

test('background warm-up preserves progressive preparing state after timeout fallback', async () => {
  const outcome = await warmCurrentForecastThroughDashboard(async (input, init) => {
    const url = new URL(String(input), 'https://dashboard.example.invalid')

    if (url.pathname === '/api/benchmark-forecast/current/capability') {
      return new Response(JSON.stringify({
        seriesId: 'cl_c1_cl',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        modelId: 'arima',
        sourceFrequency: 'DAILY',
        sourceAvailability: 'AVAILABLE',
        lawfulTargetSemantics: 'LAWFUL',
        status: 'PREPARATION_REQUIRED',
        currentReadiness: 'NOT_PREPARED',
        verificationReadiness: 'NOT_PREPARED',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: 8,
        reason: 'Prepared artifacts are missing.',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.pathname === '/api/benchmark-forecast/current/prepare') {
      return new Response(JSON.stringify({
        seriesId: 'cl_c1_cl',
        modelId: 'arima',
        targetBasis: 'POINT_IN_TIME',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        state: 'PREPARING',
        capabilityStatus: 'PREPARATION_REQUIRED',
        currentReadiness: 'NOT_PREPARED',
        prepareAttempted: true,
        prepareStatus: null,
        reason: null,
        timingMs: 45012,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    throw new Error(`Unexpected request ${init?.method ?? 'GET'} ${url.pathname}`)
  }, {
    seriesId: 'cl_c1_cl',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  assert.equal(outcome.currentState, 'PREPARING')
  assert.equal(outcome.prepareAttempted, true)
})

test('explicit preparation preserves queued state until the progressive owner work becomes ready', async () => {
  const outcome = await explicitlyPrepareForecastCurrent({
    seriesId: 'cl_c1_cl',
    modelId: 'ets',
    targetBasis: 'POINT_IN_TIME',
  }, {
    prepareCurrent: async () => ({
      seriesId: 'cl_c1_cl',
      modelId: 'ets',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      state: 'QUEUED',
      capabilityStatus: 'PREPARATION_REQUIRED',
      currentReadiness: 'NOT_PREPARED',
      prepareAttempted: true,
      prepareStatus: null,
      reason: null,
      timingMs: 45001,
    }),
    readPrepared: async () => {
      throw new Error('readPrepared should not be called before the owner work is ready')
    },
  })

  assert.equal(outcome.currentState, 'QUEUED')
  assert.equal(outcome.rereadAttempted, false)
  assert.equal(outcome.currentResult, null)
})

test('prepared current result stays on the hot read path without explicit preparation action', () => {
  const state = resolveForecastCurrentUiState({
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
      historyFingerprint: 'abc',
      preparation: null,
    },
    history: { frequency: 'DAILY', start: '2026-01-01', end: '2026-08-31', observations: 180 },
    forecastOrigin: '2026-08-31',
    currentForecast: {},
  })

  assert.equal(state, 'AVAILABLE')
  assert.equal(shouldShowExplicitCurrentPreparation(state, null), false)
})

test('stale point-in-time current result falls back to not-prepared UI state', () => {
  const state = resolveForecastCurrentUiState({
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
      historyFingerprint: 'abc',
      preparation: null,
    },
    history: { frequency: 'DAILY', start: '2026-01-01', end: '2026-08-31', observations: 180 },
    forecastOrigin: '2026-08-31',
    currentForecast: {},
    freshness: {
      identity: {
        forecastIdentity: {
          seriesId: 'wocaes0074',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
          methodId: 'ROLLING_DAILY_POINT_IN_TIME',
          methodVersion: 'rolling-daily-point-in-time-v1',
          modelId: 'arima',
        },
        inputSource: 'DYNAMIC_MARKET_DATA_STORE',
        sourceHistoryFingerprint: 'snapshot-fingerprint',
        forecastOrigin: '2026-08-31',
      },
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
    },
  })

  assert.equal(state, 'NOT_PREPARED')
})

test('progressive snapshot keeps lawful cold misses out of unsupported state', () => {
  const variant = resolveSelectedProgressiveVariant({
    seriesId: 'wocaes0280',
    variants: [{
      seriesId: 'wocaes0280',
      modelId: 'ets',
      targetBasis: 'END_OF_PERIOD',
      targetSemantics: 'END_OF_PERIOD',
      currentState: 'QUEUED',
      currentReason: null,
      verificationState: 'QUEUED',
      verificationReason: null,
    }],
    firstReadyCurrent: null,
    activeItem: null,
    queuedCount: 1,
    currentReadyCount: 0,
    verificationReadyCount: 0,
  }, {
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(resolveForecastCurrentDisplayState('NOT_PREPARED', variant), 'QUEUED')
  assert.equal(resolveForecastCurrentDisplayState('UNSUPPORTED', variant), 'QUEUED')
})

test('dashboard progressive preparation route forwards exact model and target identity', async () => {
  const payload = await readProgressiveForecastPreparationThroughDashboard(async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>
    assert.equal(body.seriesId, 'wocaes0280')
    assert.equal(body.modelId, 'arima')
    assert.equal(body.targetBasis, 'MONTHLY_AVERAGE')

    return new Response(JSON.stringify({
      seriesId: 'wocaes0280',
      variants: [{
        seriesId: 'wocaes0280',
        modelId: 'arima',
        targetBasis: 'MONTHLY_AVERAGE',
        targetSemantics: 'MONTHLY_AVERAGE',
        currentState: 'PREPARING',
        currentReason: null,
        verificationState: 'QUEUED',
        verificationReason: null,
      }],
      firstReadyCurrent: null,
      activeItem: { modelId: 'arima', targetBasis: 'MONTHLY_AVERAGE', kind: 'CURRENT' },
      queuedCount: 1,
      currentReadyCount: 0,
      verificationReadyCount: 0,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'wocaes0280',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
  })

  assert.equal(payload.activeItem?.kind, 'CURRENT')
  assert.equal(payload.variants[0]?.currentState, 'PREPARING')
})

test('dashboard current read forwards exact model and target identity', async () => {
  let capturedUrl: URL | null = null
  const payload = await readPreparedCurrentForecastThroughDashboard(async (input) => {
    capturedUrl = new URL(String(input), 'https://dashboard.example.invalid')
    return new Response(JSON.stringify({
      status: 'NOT_AVAILABLE',
      seriesId: 'wocaes0280',
      modelId: 'ets',
      targetBasis: 'END_OF_PERIOD',
      targetSemantics: 'END_OF_PERIOD',
      methodId: 'END_OF_PERIOD',
      reason: 'PREPARATION_REQUIRED: No exact prepared Current Forecast is available.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(payload.modelId, 'ets')
  assert.equal(payload.targetBasis, 'END_OF_PERIOD')
  assert.equal(capturedUrl?.searchParams.get('seriesId'), 'wocaes0280')
  assert.equal(capturedUrl?.searchParams.get('model'), 'ets')
  assert.equal(capturedUrl?.searchParams.get('targetBasis'), 'END_OF_PERIOD')
})

test('dashboard current capability read forwards exact model and target identity', async () => {
  let capturedUrl: URL | null = null
  const payload = await readCurrentForecastCapabilityThroughDashboard(async (input) => {
    capturedUrl = new URL(String(input), 'https://dashboard.example.invalid')
    return new Response(JSON.stringify({
      seriesId: 'wocaes0280',
      targetSemantics: 'END_OF_PERIOD',
      modelId: 'ets',
      sourceFrequency: 'MONTHLY',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'LAWFUL_WITH_PROVENANCE',
      status: 'PREPARATION_REQUIRED',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'NOT_PREPARED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 12,
      reason: 'Prepared artifacts are missing.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(payload.modelId, 'ets')
  assert.equal(payload.status, 'PREPARATION_REQUIRED')
  assert.equal(capturedUrl?.searchParams.get('seriesId'), 'wocaes0280')
  assert.equal(capturedUrl?.searchParams.get('modelId'), 'ets')
  assert.equal(capturedUrl?.searchParams.get('targetBasis'), 'END_OF_PERIOD')
})

test('explicit current preparation performs exactly one prepare action and one prepared reread for a lawful miss', async () => {
  const calls: string[] = []
  const result = await explicitlyPrepareForecastCurrent({
    seriesId: 'wocaes0280',
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
  }, {
    prepareCurrent: async (input) => {
      calls.push(`prepare:${input.seriesId}:${input.modelId}:${input.targetBasis}`)
      return {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        targetSemantics: 'MONTHLY_AVERAGE',
        state: 'READY',
        capabilityStatus: 'PREPARATION_REQUIRED',
        currentReadiness: 'NOT_PREPARED',
        prepareAttempted: true,
        prepareStatus: 'READY',
        reason: null,
        timingMs: 1400,
      }
    },
    readPrepared: async (input) => {
      calls.push(`read:${input.seriesId}:${input.modelId}:${input.targetBasis}`)
      return {
        status: 'AVAILABLE',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        targetSemantics: 'MONTHLY_AVERAGE',
        methodId: 'MONTHLY_AVERAGE',
        displayName: 'WTI',
        description: null,
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        lineage: {
          inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
          inputRunId: null,
          sourceSeriesId: input.seriesId,
          sourceFrequency: 'MONTHLY',
          historyFingerprint: 'abc',
          preparation: null,
        },
        history: { frequency: 'MONTHLY', start: '2020-01-01', end: '2026-08-01', observations: 80 },
        forecastOrigin: '2026-08-01',
        currentForecast: {},
      }
    },
  })

  assert.equal(result.currentState, 'AVAILABLE')
  assert.equal(result.rereadAttempted, true)
  assert.deepEqual(calls, [
    'prepare:wocaes0280:arima:MONTHLY_AVERAGE',
    'read:wocaes0280:arima:MONTHLY_AVERAGE',
  ])
})

test('explicit current preparation does not reread after preparation failure', async () => {
  let rereadCalls = 0
  const result = await explicitlyPrepareForecastCurrent({
    seriesId: 'wocaes0280',
    modelId: 'damped_holt',
    targetBasis: 'MONTHLY_AVERAGE',
  }, {
    prepareCurrent: async (input) => ({
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      targetSemantics: 'MONTHLY_AVERAGE',
      state: 'FAILED',
      capabilityStatus: 'PREPARATION_REQUIRED',
      currentReadiness: 'NOT_PREPARED',
      prepareAttempted: true,
      prepareStatus: 'FAILED',
      reason: 'MODEL_FIT_FAILED',
      timingMs: 800,
    }),
    readPrepared: async () => {
      rereadCalls += 1
      throw new Error('should not reread after failed prepare')
    },
  })

  assert.equal(result.currentState, 'FAILED')
  assert.equal(result.rereadAttempted, false)
  assert.equal(rereadCalls, 0)
})

test('explicit current preparation request uses the exact target-specific identity', async () => {
  let capturedBody: Record<string, string> | null = null
  const payload = await requestExplicitCurrentForecastPreparationThroughDashboard(async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, string>
    return new Response(JSON.stringify({
      seriesId: 'usnaac0169',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      state: 'UNSUPPORTED',
      capabilityStatus: 'NOT_LAWFUL',
      currentReadiness: 'NOT_PREPARED',
      prepareAttempted: false,
      prepareStatus: null,
      reason: 'UNSUPPORTED_FREQUENCY',
      timingMs: 22,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'usnaac0169',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  assert.equal(payload.state, 'UNSUPPORTED')
  assert.deepEqual(capturedBody, {
    seriesId: 'usnaac0169',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })
})

test('model and target switches preserve exact peer identity instead of reusing another variant', async () => {
  const seenReads: string[] = []

  await readPreparedCurrentForecastThroughDashboard(async (input) => {
    const url = new URL(String(input), 'https://dashboard.example.invalid')
    seenReads.push(`${url.searchParams.get('seriesId')}:${url.searchParams.get('model')}:${url.searchParams.get('targetBasis')}`)
    return new Response(JSON.stringify({
      status: 'NOT_AVAILABLE',
      seriesId: 'uscaes0302',
      modelId: url.searchParams.get('model'),
      targetBasis: url.searchParams.get('targetBasis'),
      targetSemantics: url.searchParams.get('targetBasis') === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : 'END_OF_PERIOD',
      methodId: url.searchParams.get('targetBasis') === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : 'END_OF_PERIOD',
      reason: 'PREPARATION_REQUIRED: No exact prepared Current Forecast is available.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'uscaes0302',
    modelId: 'arima',
    targetBasis: 'POINT_IN_TIME',
  })

  await readPreparedCurrentForecastThroughDashboard(async (input) => {
    const url = new URL(String(input), 'https://dashboard.example.invalid')
    seenReads.push(`${url.searchParams.get('seriesId')}:${url.searchParams.get('model')}:${url.searchParams.get('targetBasis')}`)
    return new Response(JSON.stringify({
      status: 'NOT_AVAILABLE',
      seriesId: 'uscaes0302',
      modelId: url.searchParams.get('model'),
      targetBasis: url.searchParams.get('targetBasis'),
      targetSemantics: 'END_OF_PERIOD',
      methodId: 'END_OF_PERIOD',
      reason: 'PREPARATION_REQUIRED: No exact prepared Current Forecast is available.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, {
    seriesId: 'uscaes0302',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.deepEqual(seenReads, [
    'uscaes0302:arima:POINT_IN_TIME',
    'uscaes0302:ets:END_OF_PERIOD',
  ])
})