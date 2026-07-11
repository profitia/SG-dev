import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolvePaddedValueDomain,
  shouldCommitZoomSelection,
  shouldTogglePinnedSurface,
} from '@/lib/chart/chart-panel-helpers'

test('resolvePaddedValueDomain adds lower and upper breathing room for ranged values', () => {
  const domain = resolvePaddedValueDomain([100, 125, 160])

  assert.equal(domain.minimum, 92.8)
  assert.equal(domain.maximum, 167.2)
})

test('resolvePaddedValueDomain keeps a minimum padding for flat low-value series', () => {
  const domain = resolvePaddedValueDomain([0.2, 0.2, 0.2])

  assert.equal(domain.minimum, -0.8)
  assert.equal(domain.maximum, 1.2)
})

test('resolvePaddedValueDomain returns fallback bounds for empty values', () => {
  const domain = resolvePaddedValueDomain([])

  assert.deepEqual(domain, { minimum: 0, maximum: 1 })
})

test('shouldCommitZoomSelection rejects pointer movement below threshold', () => {
  assert.equal(shouldCommitZoomSelection(120, 131, 12), false)
})

test('shouldCommitZoomSelection accepts pointer movement at threshold', () => {
  assert.equal(shouldCommitZoomSelection(120, 132, 12), true)
})

test('shouldTogglePinnedSurface returns true for the same key and variant', () => {
  assert.equal(shouldTogglePinnedSurface('point-1', 'historical', 'point-1', 'historical'), true)
})

test('shouldTogglePinnedSurface returns false when either key or variant changes', () => {
  assert.equal(shouldTogglePinnedSurface('point-1', 'historical', 'point-2', 'historical'), false)
  assert.equal(shouldTogglePinnedSurface('point-1', 'historical', 'point-1', 'historical-forecast'), false)
})