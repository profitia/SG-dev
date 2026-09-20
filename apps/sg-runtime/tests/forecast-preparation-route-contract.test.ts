import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { createForecastPreparationJobsPostHandler } from '@/lib/forecast/preparation-route-handlers'

test('durable preparation route passes the validated end-to-end correlation to the queue', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'
  let observedCorrelationId: string | null = null

  try {
    const handler = createForecastPreparationJobsPostHandler(async (_input, options) => {
      observedCorrelationId = options.correlationId
      return { state: 'QUEUED', reason: null, job: null }
    })
    const response = await handler(new NextRequest('http://localhost/api/internal/forecast/preparation/jobs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-internal-token',
        'Content-Type': 'application/json',
        'x-sg-forecast-correlation-id': 'ppf1-route-action:1234',
        'x-request-id': 'different-request-id',
      },
      body: JSON.stringify({
        seriesId: 'series-1',
        modelId: 'arima',
        targetSemantics: 'MONTHLY_AVERAGE',
        kind: 'CURRENT',
      }),
    }))

    assert.equal(response.status, 200)
    assert.equal(observedCorrelationId, 'ppf1-route-action:1234')
  } finally {
    if (previousToken === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
  }
})
