import assert from 'node:assert/strict'
import test from 'node:test'

import { forwardForecastUiVisibleTelemetry } from '@/lib/benchmark-forecast/forecast-action-telemetry'

test('Dashboard forwards post-render acknowledgement with the action correlation identity', async () => {
  const previousBaseUrl = process.env.SG_RUNTIME_BASE_URL
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_BASE_URL = 'https://runtime.example'
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-token'
  const observed: Array<{ url: string, init?: RequestInit }> = []

  try {
    const result = await forwardForecastUiVisibleTelemetry({
      correlationId: 'corr-ui-1',
      layer: 'CURRENT',
      seriesId: 'series-1',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      modelId: 'arima',
      pageInstanceId: 'page-1',
      clientVisibleAt: '2026-09-20T20:00:00.000Z',
      responseToVisibleMs: 16.5,
    }, (async (input, init) => {
      observed.push({ url: String(input), init })
      return new Response(JSON.stringify({ data: { recorded: true } }), { status: 200 })
    }) as typeof fetch)

    assert.deepEqual(result, { recorded: true })
    assert.equal(observed[0]?.url, 'https://runtime.example/api/internal/forecast/action-trace')
    assert.equal(new Headers(observed[0]?.init?.headers).get('x-sg-forecast-correlation-id'), 'corr-ui-1')
    assert.equal(new Headers(observed[0]?.init?.headers).get('authorization'), 'Bearer test-token')
  } finally {
    if (previousBaseUrl === undefined) delete process.env.SG_RUNTIME_BASE_URL
    else process.env.SG_RUNTIME_BASE_URL = previousBaseUrl
    if (previousToken === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
  }
})
