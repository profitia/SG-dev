import test from 'node:test'
import assert from 'node:assert/strict'

import { filterSeriesToVisibleRange, resolveNiceScaleDomain } from '../lib/chart/chart-panel-helpers'

test('resolveNiceScaleDomain returns human-friendly rounded ticks', () => {
  const domain = resolveNiceScaleDomain([2492.37, 2511.64, 2530.91])

  assert.ok(domain.minimum <= 2490)
  assert.ok(domain.maximum >= 2540)
  assert.equal(domain.step, 10)
  assert.ok(domain.ticks.every((tick) => Number.isInteger(tick.value / 10)))
  assert.ok(domain.ticks.length >= 5)
  assert.ok(domain.ticks.length <= 8)
})

test('resolveNiceScaleDomain keeps small fluctuations visible without exaggerating them', () => {
  const domain = resolveNiceScaleDomain([98.4, 98.8, 99.2, 99.6])

  assert.ok(domain.minimum <= 98.5)
  assert.ok(domain.maximum >= 99.5)
  assert.equal(domain.step, 0.5)
  assert.ok(domain.ticks.length >= 5)
  assert.ok(domain.ticks.length <= 8)
})

test('resolveNiceScaleDomain creates a stable domain for flat series', () => {
  const domain = resolveNiceScaleDomain([8452, 8452, 8452])

  assert.ok(domain.minimum < 8452)
  assert.ok(domain.maximum > 8452)
  assert.ok(domain.ticks.length >= 5)
  assert.ok(domain.ticks.length <= 8)
})

test('filterSeriesToVisibleRange trims precomputed segments as well as points', () => {
  const series = filterSeriesToVisibleRange([
    {
      id: 'historical-forecast',
      kind: 'historical-forecast',
      label: 'Historyczna prognoza',
      lineStyle: 'dashed',
      points: [
        {
          key: 'p1',
          date: '2026-01-31T12:00:00.000Z',
          value: 100,
          diff: null,
          recordId: 'p1',
          anchor: false,
          tooltipModel: { title: 'p1', rows: [] },
          detailModel: { componentName: 'x', benchmarkCode: 'x', sourceDate: '2026-01-31T12:00:00.000Z', temporalResolution: 'month', scenarioType: 'historical-forecast', value: 100, forecastLower: null, forecastUpper: null, forecastAccuracyDiff: null, description: null, unit: 'usd', currency: 'usd', market: null, country: null, qualityStatus: null, sourceLabel: null, lastSyncedAt: null },
        },
        {
          key: 'p2',
          date: '2026-02-28T12:00:00.000Z',
          value: 110,
          diff: null,
          recordId: 'p2',
          anchor: false,
          tooltipModel: { title: 'p2', rows: [] },
          detailModel: { componentName: 'x', benchmarkCode: 'x', sourceDate: '2026-02-28T12:00:00.000Z', temporalResolution: 'month', scenarioType: 'historical-forecast', value: 110, forecastLower: null, forecastUpper: null, forecastAccuracyDiff: null, description: null, unit: 'usd', currency: 'usd', market: null, country: null, qualityStatus: null, sourceLabel: null, lastSyncedAt: null },
        },
        {
          key: 'p3',
          date: '2026-03-31T12:00:00.000Z',
          value: 104,
          diff: null,
          recordId: 'p3',
          anchor: false,
          tooltipModel: { title: 'p3', rows: [] },
          detailModel: { componentName: 'x', benchmarkCode: 'x', sourceDate: '2026-03-31T12:00:00.000Z', temporalResolution: 'month', scenarioType: 'historical-forecast', value: 104, forecastLower: null, forecastUpper: null, forecastAccuracyDiff: null, description: null, unit: 'usd', currency: 'usd', market: null, country: null, qualityStatus: null, sourceLabel: null, lastSyncedAt: null },
        },
      ],
      segments: [[
        {
          key: 'p1',
          date: '2026-01-31T12:00:00.000Z',
          value: 100,
          diff: null,
          recordId: 'p1',
          anchor: false,
          tooltipModel: { title: 'p1', rows: [] },
          detailModel: { componentName: 'x', benchmarkCode: 'x', sourceDate: '2026-01-31T12:00:00.000Z', temporalResolution: 'month', scenarioType: 'historical-forecast', value: 100, forecastLower: null, forecastUpper: null, forecastAccuracyDiff: null, description: null, unit: 'usd', currency: 'usd', market: null, country: null, qualityStatus: null, sourceLabel: null, lastSyncedAt: null },
        },
        {
          key: 'p2',
          date: '2026-02-28T12:00:00.000Z',
          value: 110,
          diff: null,
          recordId: 'p2',
          anchor: false,
          tooltipModel: { title: 'p2', rows: [] },
          detailModel: { componentName: 'x', benchmarkCode: 'x', sourceDate: '2026-02-28T12:00:00.000Z', temporalResolution: 'month', scenarioType: 'historical-forecast', value: 110, forecastLower: null, forecastUpper: null, forecastAccuracyDiff: null, description: null, unit: 'usd', currency: 'usd', market: null, country: null, qualityStatus: null, sourceLabel: null, lastSyncedAt: null },
        },
        {
          key: 'p3',
          date: '2026-03-31T12:00:00.000Z',
          value: 104,
          diff: null,
          recordId: 'p3',
          anchor: false,
          tooltipModel: { title: 'p3', rows: [] },
          detailModel: { componentName: 'x', benchmarkCode: 'x', sourceDate: '2026-03-31T12:00:00.000Z', temporalResolution: 'month', scenarioType: 'historical-forecast', value: 104, forecastLower: null, forecastUpper: null, forecastAccuracyDiff: null, description: null, unit: 'usd', currency: 'usd', market: null, country: null, qualityStatus: null, sourceLabel: null, lastSyncedAt: null },
        },
      ]],
    },
  ], {
    start: '2026-02-15T00:00:00.000Z',
    end: '2026-03-15T00:00:00.000Z',
  })

  assert.equal(series[0]?.points.length, 1)
  assert.deepEqual(series[0]?.points.map((point) => point.date), ['2026-02-28T12:00:00.000Z'])
  assert.equal(series[0]?.segments?.length, 1)
  assert.deepEqual(series[0]?.segments?.[0]?.map((point) => point.date), ['2026-02-28T12:00:00.000Z'])
})