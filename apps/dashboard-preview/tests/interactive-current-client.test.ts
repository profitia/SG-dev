import assert from 'node:assert/strict'
import test from 'node:test'

import {
  explicitlyPrepareForecastCurrent,
  readPreparedCurrentForecastThroughDashboard,
  requestExplicitCurrentForecastPreparationThroughDashboard,
  resolveForecastCurrentUiState,
  shouldReadCurrentForecast,
  shouldShowExplicitCurrentPreparation,
} from '@/lib/benchmark-forecast/interactive-current-client'

test('initial embedded historical-first state keeps current forecast reads disabled until explicit forecast intent', () => {
  assert.equal(shouldReadCurrentForecast({
    showForecast: false,
    isForecastPortfolioVariant: true,
    seriesId: 'wocaes0074',
  }), false)
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