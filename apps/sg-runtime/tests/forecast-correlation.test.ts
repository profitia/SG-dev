import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveForecastCorrelationId,
  resolveForecastJobCorrelationId,
} from '@/lib/forecast/forecast-correlation'

test('SG Runtime prefers the canonical correlation header and rejects unsafe values', () => {
  assert.equal(resolveForecastCorrelationId(new Headers({
    'x-sg-forecast-correlation-id': 'ppf1-action:canonical',
    'x-request-id': 'ppf1-action:fallback',
  })), 'ppf1-action:canonical')

  assert.equal(resolveForecastCorrelationId(new Headers({
    'x-sg-forecast-correlation-id': 'bad value',
    'x-request-id': 'ppf1-action:fallback',
  })), 'ppf1-action:fallback')
})

test('durable jobs use latest correlation, then origin, then deterministic legacy fallback', () => {
  assert.equal(resolveForecastJobCorrelationId({ id: 'job-1', originCorrelationId: 'ppf1-origin:1234', latestCorrelationId: 'ppf1-latest:1234' }), 'ppf1-latest:1234')
  assert.equal(resolveForecastJobCorrelationId({ id: 'job-1', originCorrelationId: 'ppf1-origin:1234', latestCorrelationId: null }), 'ppf1-origin:1234')
  assert.equal(resolveForecastJobCorrelationId({ id: 'job-1', originCorrelationId: null, latestCorrelationId: null }), 'forecast-job:job-1')
})
