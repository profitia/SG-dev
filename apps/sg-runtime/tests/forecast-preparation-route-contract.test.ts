import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import {
  createForecastPreparationJobsGetHandler,
  createForecastPreparationJobsPostHandler,
} from '@/lib/forecast/preparation-route-handlers'

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

test('durable preparation snapshot records Fast Verification as the first Dashboard-ready observation', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'
  let observedReadiness: { currentReady: boolean, verificationReady: boolean } | null = null

  try {
    const handler = createForecastPreparationJobsGetHandler(
      async () => ({
        current: { state: 'READY', reason: null, job: null },
        verification: { state: 'FAST_READY', reason: null, job: null },
      }),
      async (_correlationId, readiness) => {
        observedReadiness = readiness
        return true
      },
    )
    const response = await handler(new NextRequest(
      'http://localhost/api/internal/forecast/preparation/jobs?seriesId=series-1&modelId=arima&targetSemantics=MONTHLY_AVERAGE',
      {
        headers: {
          Authorization: 'Bearer test-internal-token',
          'x-sg-forecast-correlation-id': 'ppf1-fast-ready:1234',
        },
      },
    ))

    assert.equal(response.status, 200)
    assert.deepEqual(observedReadiness, { currentReady: true, verificationReady: true })
  } finally {
    if (previousToken === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
  }
})
