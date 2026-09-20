import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDatePlotOffset, resolveDateTimePlotRatio } from '@/lib/chart/date-plot-offset'

const dates = [
  '2025-01-01T00:00:00.000Z',
  '2025-02-01T00:00:00.000Z',
  '2025-03-01T00:00:00.000Z',
]

test('returns the exact discrete index for known plot dates', () => {
  assert.equal(resolveDatePlotOffset(dates, '2025-02-01T00:00:00.000Z'), 1)
})

test('interpolates crossing dates between neighboring plot dates instead of falling back to zero', () => {
  const offset = resolveDatePlotOffset(dates, '2025-01-16T12:00:00.000Z')

  assert.ok(offset > 0)
  assert.ok(offset < 1)
})

test('clamps dates before the known range to the first plot column', () => {
  assert.equal(resolveDatePlotOffset(dates, '2024-12-01T00:00:00.000Z'), 0)
})

test('clamps dates after the known range to the last plot column', () => {
  assert.equal(resolveDatePlotOffset(dates, '2025-04-01T00:00:00.000Z'), 2)
})

test('positions sparse monthly forecasts by elapsed time instead of point count', () => {
  const denseHistory = Array.from({ length: 366 }, (_, index) => new Date(Date.UTC(2025, 0, 1 + index)).toISOString())
  const twelveMonthForecastEnd = new Date(Date.UTC(2026, 11, 31)).toISOString()
  const timeline = [...denseHistory, twelveMonthForecastEnd]

  const forecastOriginRatio = resolveDateTimePlotRatio(timeline, denseHistory[denseHistory.length - 1])

  assert.ok(forecastOriginRatio > 0.49)
  assert.ok(forecastOriginRatio < 0.51)
})
