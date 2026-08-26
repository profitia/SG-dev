import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDatePlotOffset } from '@/lib/chart/date-plot-offset'
import {
  auditEndOfPeriodDeltaSurfaces,
  buildEndOfPeriodDeltaSurfaces,
  prepareVisibleSeriesGeometry,
} from '@/lib/chart/end-of-period-delta-geometry'
import type { TimeSeriesViewerPoint, TimeSeriesViewerSeries } from '@/lib/time-series-viewer/time-series-viewer-contract'

const EPSILON = 1e-8

function createPoint(date: string, value: number, scenarioType: string): TimeSeriesViewerPoint {
  return {
    key: `${scenarioType}-${date}`,
    date,
    value,
    diff: null,
    recordId: `${scenarioType}-${date}`,
    anchor: false,
    tooltipModel: { title: `${scenarioType}-${date}`, rows: [] },
    detailModel: {
      componentName: 'Brent, Spot, FOB North Sea',
      benchmarkCode: 'wocaes0074',
      sourceDate: date,
      temporalResolution: scenarioType === 'historical' ? 'day' : 'month',
      scenarioType,
      value,
      forecastLower: null,
      forecastUpper: null,
      forecastAccuracyDiff: null,
      description: null,
      unit: 'usd',
      currency: 'usd',
      market: null,
      country: null,
      qualityStatus: null,
      sourceLabel: null,
      lastSyncedAt: null,
    },
  }
}

function createSeries(kind: TimeSeriesViewerSeries['kind'], datesAndValues: Array<{ date: string; value: number }>, segments?: string[][]): TimeSeriesViewerSeries {
  const points = datesAndValues.map(({ date, value }) => createPoint(date, value, kind))
  const pointByDate = new Map(points.map((point) => [point.date, point]))

  return {
    id: `${kind}-series`,
    kind,
    label: kind,
    lineStyle: kind === 'historical-forecast' ? 'dashed' : 'solid',
    points,
    segments: segments?.map((segment) => segment.map((date) => pointByDate.get(date)).filter((point): point is TimeSeriesViewerPoint => point !== undefined)),
  }
}

function createPointX(allDates: string[]) {
  const layout = {
    width: 720,
    paddingLeft: 40,
    paddingRight: 20,
  }
  const denominator = Math.max(allDates.length - 1, 1)

  return (date: string) => layout.paddingLeft + (resolveDatePlotOffset(allDates, date) / denominator) * (layout.width - layout.paddingLeft - layout.paddingRight)
}

function createPointY(minimum: number, maximum: number) {
  const layout = {
    height: 360,
    paddingTop: 20,
    paddingBottom: 30,
  }
  const range = maximum - minimum || 1

  return (value: number | null) => layout.height - layout.paddingBottom - ((((value ?? minimum) - minimum) / range) * (layout.height - layout.paddingTop - layout.paddingBottom))
}

function collectUniqueSamples(surfaces: ReturnType<typeof buildEndOfPeriodDeltaSurfaces>) {
  return surfaces
    .flatMap((surface) => surface.samples)
    .sort((left, right) => left.x - right.x)
    .filter((sample, index, items) => {
      const previous = items[index - 1]

      if (!previous) {
        return true
      }

      return Math.abs(previous.x - sample.x) > EPSILON
        || Math.abs(previous.actualY - sample.actualY) > EPSILON
        || Math.abs(previous.forecastY - sample.forecastY) > EPSILON
    })
}

test('non-uniform plot-x sampling uses the visible forecast geometry instead of calendar interpolation', () => {
  const historicalSeries = createSeries('historical', [
    { date: '2026-01-30T00:00:00.000Z', value: 95 },
    { date: '2026-02-02T00:00:00.000Z', value: 103 },
    { date: '2026-02-10T00:00:00.000Z', value: 98 },
    { date: '2026-02-27T00:00:00.000Z', value: 108 },
  ])
  const forecastSeries = createSeries('historical-forecast', [
    { date: '2026-01-31T12:00:00.000Z', value: 100 },
    { date: '2026-02-28T12:00:00.000Z', value: 110 },
  ])
  const allDates = [
    '2026-01-30T00:00:00.000Z',
    '2026-01-31T12:00:00.000Z',
    '2026-02-02T00:00:00.000Z',
    '2026-02-10T00:00:00.000Z',
    '2026-02-27T00:00:00.000Z',
    '2026-02-28T12:00:00.000Z',
  ]
  const pointX = createPointX(allDates)
  const pointY = createPointY(90, 112)
  const actualGeometry = prepareVisibleSeriesGeometry(historicalSeries, pointX, pointY)
  const forecastGeometry = prepareVisibleSeriesGeometry(forecastSeries, pointX, pointY)
  const surfaces = buildEndOfPeriodDeltaSurfaces(actualGeometry, forecastGeometry)
  const samples = collectUniqueSamples(surfaces)
  const sampleX = pointX('2026-02-10T00:00:00.000Z')
  const sample = samples.find((entry) => Math.abs(entry.x - sampleX) <= EPSILON)

  const calendarRatio = (new Date('2026-02-10T00:00:00.000Z').getTime() - new Date('2026-01-31T12:00:00.000Z').getTime())
    / (new Date('2026-02-28T12:00:00.000Z').getTime() - new Date('2026-01-31T12:00:00.000Z').getTime())
  const plotRatio = (pointX('2026-02-10T00:00:00.000Z') - pointX('2026-01-31T12:00:00.000Z'))
    / (pointX('2026-02-28T12:00:00.000Z') - pointX('2026-01-31T12:00:00.000Z'))
  const oldForecastValue = 100 + ((110 - 100) * calendarRatio)
  const visibleForecastValue = 100 + ((110 - 100) * plotRatio)

  assert.ok(sample)
  assert.notEqual(calendarRatio, plotRatio)
  assert.ok(Math.abs(sample.forecastY - pointY(visibleForecastValue)) <= EPSILON)
  assert.ok(Math.abs(sample.forecastY - pointY(oldForecastValue)) > 1)
})

test('every generated eop sample stays exactly on the prepared actual and forecast visual trajectories', () => {
  const historicalSeries = createSeries('historical', [
    { date: '2026-01-30T00:00:00.000Z', value: 95 },
    { date: '2026-02-02T00:00:00.000Z', value: 103 },
    { date: '2026-02-10T00:00:00.000Z', value: 98 },
    { date: '2026-02-27T00:00:00.000Z', value: 108 },
    { date: '2026-03-02T00:00:00.000Z', value: 105 },
    { date: '2026-03-31T00:00:00.000Z', value: 112 },
  ])
  const forecastSeries = createSeries('historical-forecast', [
    { date: '2026-01-31T12:00:00.000Z', value: 100 },
    { date: '2026-02-28T12:00:00.000Z', value: 110 },
    { date: '2026-03-31T12:00:00.000Z', value: 104 },
  ])
  const allDates = [...new Set([...historicalSeries.points, ...forecastSeries.points].map((point) => point.date))].sort()
  const pointX = createPointX(allDates)
  const pointY = createPointY(90, 112)
  const actualGeometry = prepareVisibleSeriesGeometry(historicalSeries, pointX, pointY)
  const forecastGeometry = prepareVisibleSeriesGeometry(forecastSeries, pointX, pointY)
  const surfaces = buildEndOfPeriodDeltaSurfaces(actualGeometry, forecastGeometry)
  const audit = auditEndOfPeriodDeltaSurfaces(surfaces, actualGeometry, forecastGeometry)

  assert.ok(surfaces.length > 0)
  assert.equal(audit.forecastMismatches, 0)
  assert.equal(audit.actualMismatches, 0)
  assert.equal(audit.maxForecastDifference, 0)
  assert.equal(audit.maxActualDifference, 0)
  assert.equal(audit.conflictingDuplicateX, 0)
  assert.equal(audit.signDefects, 0)
  assert.equal(audit.legacyFallbackCount, 0)
})

test('unsupported fragments are omitted instead of falling back to a legacy quadrilateral', () => {
  const historicalSeries = createSeries('historical', [
    { date: '2026-02-10T00:00:00.000Z', value: 103 },
    { date: '2026-02-27T00:00:00.000Z', value: 108 },
  ], [[
    '2026-02-10T00:00:00.000Z',
    '2026-02-27T00:00:00.000Z',
  ]])
  const forecastSeries = createSeries('historical-forecast', [
    { date: '2026-01-31T12:00:00.000Z', value: 100 },
    { date: '2026-02-28T12:00:00.000Z', value: 110 },
    { date: '2026-03-31T12:00:00.000Z', value: 104 },
  ])
  const allDates = [...new Set([...historicalSeries.points, ...forecastSeries.points].map((point) => point.date))].sort()
  const pointX = createPointX(allDates)
  const pointY = createPointY(90, 112)
  const actualGeometry = prepareVisibleSeriesGeometry(historicalSeries, pointX, pointY)
  const forecastGeometry = prepareVisibleSeriesGeometry(forecastSeries, pointX, pointY)
  const surfaces = buildEndOfPeriodDeltaSurfaces(actualGeometry, forecastGeometry)
  const maxSupportedX = pointX('2026-02-27T00:00:00.000Z')

  assert.ok(surfaces.length > 0)
  assert.ok(surfaces.every((surface) => surface.samples[1].x <= maxSupportedX + EPSILON))
  assert.ok(surfaces.every((surface) => !surface.path.includes(` ${pointX('2026-03-31T12:00:00.000Z')},`)))
})

test('multiple daily crossings split into sign-consistent visual surfaces without self-intersection', () => {
  const historicalSeries = createSeries('historical', [
    { date: '2026-01-30T00:00:00.000Z', value: 95 },
    { date: '2026-02-02T00:00:00.000Z', value: 112 },
    { date: '2026-02-10T00:00:00.000Z', value: 99 },
    { date: '2026-02-18T00:00:00.000Z', value: 111 },
    { date: '2026-02-27T00:00:00.000Z', value: 98 },
  ])
  const forecastSeries = createSeries('historical-forecast', [
    { date: '2026-01-31T12:00:00.000Z', value: 105 },
    { date: '2026-02-28T12:00:00.000Z', value: 105 },
  ])
  const allDates = [...new Set([...historicalSeries.points, ...forecastSeries.points].map((point) => point.date))].sort()
  const pointX = createPointX(allDates)
  const pointY = createPointY(90, 115)
  const actualGeometry = prepareVisibleSeriesGeometry(historicalSeries, pointX, pointY)
  const forecastGeometry = prepareVisibleSeriesGeometry(forecastSeries, pointX, pointY)
  const surfaces = buildEndOfPeriodDeltaSurfaces(actualGeometry, forecastGeometry)
  const audit = auditEndOfPeriodDeltaSurfaces(surfaces, actualGeometry, forecastGeometry)
  const signs = new Set(surfaces.map((surface) => surface.sign))
  const zeroWidthCrossings = surfaces
    .slice(0, -1)
    .filter((surface, index) => {
      const next = surfaces[index + 1]

      if (!next) {
        return false
      }

      const leftEnd = surface.samples[1]
      const rightStart = next.samples[0]

      return Math.abs(leftEnd.x - rightStart.x) <= EPSILON
        && Math.abs(leftEnd.actualY - leftEnd.forecastY) <= EPSILON
        && Math.abs(rightStart.actualY - rightStart.forecastY) <= EPSILON
    })

  assert.ok(signs.has('above'))
  assert.ok(signs.has('below'))
  assert.ok(zeroWidthCrossings.length >= 2)
  assert.equal(audit.signDefects, 0)
})