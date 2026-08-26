import test from 'node:test'
import assert from 'node:assert/strict'

import { clipDeltaOverlayToRange, clipDeltaOverlaysToRange } from '@/lib/chart/delta-overlay-clipping'
import type { TimeSeriesViewerDeltaOverlay } from '@/lib/time-series-viewer/time-series-viewer-contract'

function createOverlay(overrides: Partial<TimeSeriesViewerDeltaOverlay> = {}): TimeSeriesViewerDeltaOverlay {
  return {
    key: 'delta-above-0',
    sign: 'above',
    points: [
      { date: '2026-02-28T12:00:00.000Z', value: 92 },
      { date: '2026-04-30T12:00:00.000Z', value: 96 },
      { date: '2026-04-30T12:00:00.000Z', value: 108 },
      { date: '2026-02-28T12:00:00.000Z', value: 102 },
    ],
    ...overrides,
  }
}

test('keeps overlays unchanged when fully inside the visible domain', () => {
  const overlay = createOverlay()

  assert.deepEqual(clipDeltaOverlayToRange(overlay, {
    start: '2026-02-01T00:00:00.000Z',
    end: '2026-05-01T00:00:00.000Z',
  }), overlay)
})

test('clips the left edge with interpolated actual and forecast boundary values', () => {
  const overlay = createOverlay()
  const clipped = clipDeltaOverlayToRange(overlay, {
    start: '2026-03-31T12:00:00.000Z',
    end: '2026-05-01T00:00:00.000Z',
  })

  assert.ok(clipped)
  assert.deepEqual(clipped?.points, [
    { date: '2026-03-31T12:00:00.000Z', value: 94.0327868852459 },
    { date: '2026-04-30T12:00:00.000Z', value: 96 },
    { date: '2026-04-30T12:00:00.000Z', value: 108 },
    { date: '2026-03-31T12:00:00.000Z', value: 105.04918032786885 },
  ])
})

test('clips the right edge with interpolated actual and forecast boundary values', () => {
  const overlay = createOverlay()
  const clipped = clipDeltaOverlayToRange(overlay, {
    start: '2026-02-01T00:00:00.000Z',
    end: '2026-03-31T12:00:00.000Z',
  })

  assert.ok(clipped)
  assert.deepEqual(clipped?.points, [
    { date: '2026-02-28T12:00:00.000Z', value: 92 },
    { date: '2026-03-31T12:00:00.000Z', value: 94.0327868852459 },
    { date: '2026-03-31T12:00:00.000Z', value: 105.04918032786885 },
    { date: '2026-02-28T12:00:00.000Z', value: 102 },
  ])
})

test('removes overlays that are fully outside the visible domain', () => {
  const overlay = createOverlay()

  assert.equal(clipDeltaOverlayToRange(overlay, {
    start: '2026-05-01T00:00:00.000Z',
    end: '2026-06-01T00:00:00.000Z',
  }), null)
})

test('clips a collection without dropping segments that cross into the range', () => {
  const overlays = [
    createOverlay(),
    createOverlay({
      key: 'delta-below-1',
      sign: 'below',
      points: [
        { date: '2026-05-31T12:00:00.000Z', value: 110 },
        { date: '2026-06-30T12:00:00.000Z', value: 100 },
        { date: '2026-06-30T12:00:00.000Z', value: 88 },
        { date: '2026-05-31T12:00:00.000Z', value: 94 },
      ],
    }),
  ]

  const clipped = clipDeltaOverlaysToRange(overlays, {
    start: '2026-03-31T12:00:00.000Z',
    end: '2026-06-15T12:00:00.000Z',
  })

  assert.equal(clipped.length, 2)
  assert.equal(clipped[0]?.points[0]?.date, '2026-03-31T12:00:00.000Z')
  assert.equal(clipped[1]?.points[1]?.date, '2026-06-15T12:00:00.000Z')
})