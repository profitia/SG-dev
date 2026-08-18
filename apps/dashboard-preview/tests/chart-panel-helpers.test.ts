import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveNiceScaleDomain } from '../lib/chart/chart-panel-helpers'

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