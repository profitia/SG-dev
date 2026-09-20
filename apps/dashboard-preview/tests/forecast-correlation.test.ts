import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildForecastCorrelationHeaders,
  createForecastCorrelationId,
  normalizeForecastCorrelationId,
} from '@/lib/benchmark-forecast/forecast-correlation'

test('forecast correlation accepts bounded safe identities and rejects header injection', () => {
  assert.equal(normalizeForecastCorrelationId('ppf1-action:1234'), 'ppf1-action:1234')
  assert.equal(normalizeForecastCorrelationId('bad\nheader'), null)
  assert.equal(normalizeForecastCorrelationId('short'), null)
})

test('forecast correlation uses the same identity for canonical and request headers', () => {
  const correlationId = createForecastCorrelationId('ppf1-action:5678')
  assert.deepEqual(buildForecastCorrelationHeaders(correlationId), {
    'x-sg-forecast-correlation-id': correlationId,
    'x-request-id': correlationId,
  })
})
