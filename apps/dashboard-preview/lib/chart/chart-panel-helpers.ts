export type NiceScaleTick = {
  value: number
  offset: number
}

import type { TimeSeriesViewerSeries } from '@/lib/time-series-viewer/time-series-viewer-contract'

export type NiceScaleDomain = {
  minimum: number
  maximum: number
  step: number
  ticks: NiceScaleTick[]
}

export type VisibleRange = {
  start: string
  end: string
}

const MIN_TICK_COUNT = 5
const MAX_TICK_COUNT = 8
const PREFERRED_TICK_COUNTS = [6, 5, 7, 8] as const

function almostEqual(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-9
}

function niceNumber(value: number, round: boolean) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1
  }

  const exponent = Math.floor(Math.log10(value))
  const fraction = value / 10 ** exponent

  let niceFraction: number

  if (round) {
    if (fraction < 1.5) {
      niceFraction = 1
    } else if (fraction < 2.25) {
      niceFraction = 2
    } else if (fraction < 3.5) {
      niceFraction = 2.5
    } else if (fraction < 7.5) {
      niceFraction = 5
    } else {
      niceFraction = 10
    }
  } else if (fraction <= 1) {
    niceFraction = 1
  } else if (fraction <= 2) {
    niceFraction = 2
  } else if (fraction <= 2.5) {
    niceFraction = 2.5
  } else if (fraction <= 5) {
    niceFraction = 5
  } else {
    niceFraction = 10
  }

  return niceFraction * 10 ** exponent
}

function fallbackSpanFromFlatValue(value: number) {
  const baseline = Math.abs(value) > 0 ? Math.abs(value) : 1
  return niceNumber(baseline / 50, true)
}

function buildCandidate(minimumValue: number, maximumValue: number, targetTickCount: number) {
  const rawSpan = maximumValue - minimumValue
  const midpoint = Math.max(Math.abs((minimumValue + maximumValue) / 2), 1)
  const spanStep = rawSpan > 0
    ? niceNumber(rawSpan / Math.max(targetTickCount - 1, 1), true)
    : fallbackSpanFromFlatValue(maximumValue || minimumValue)
  const volatilityRatio = rawSpan > 0 ? rawSpan / midpoint : 0
  const magnitudeFloorStep = niceNumber(midpoint / 200, true)
  const step = rawSpan > 0 && volatilityRatio < 0.05
    ? Math.max(spanStep, magnitudeFloorStep)
    : spanStep
  let minimum = Math.floor(minimumValue / step) * step
  let maximum = Math.ceil(maximumValue / step) * step

  if (almostEqual(minimum, minimumValue)) {
    minimum -= step
  }

  if (almostEqual(maximum, maximumValue)) {
    maximum += step
  }

  let tickCount = Math.round((maximum - minimum) / step) + 1

  while (tickCount < MIN_TICK_COUNT) {
    minimum -= step
    maximum += step
    tickCount = Math.round((maximum - minimum) / step) + 1
  }

  return {
    minimum,
    maximum,
    step,
    tickCount,
    paddingScore: (maximum - minimum) - rawSpan,
    preferenceScore: Math.abs(targetTickCount - 6),
  }
}

export function resolveNiceScaleDomain(values: number[]): NiceScaleDomain {
  const finiteValues = values.filter((value) => Number.isFinite(value))

  if (finiteValues.length === 0) {
    return {
      minimum: 0,
      maximum: 1,
      step: 0.2,
      ticks: Array.from({ length: 6 }, (_, index) => ({
        value: index * 0.2,
        offset: index / 5,
      })),
    }
  }

  const minimumValue = Math.min(...finiteValues)
  const maximumValue = Math.max(...finiteValues)
  const candidates = PREFERRED_TICK_COUNTS
    .map((targetTickCount) => buildCandidate(minimumValue, maximumValue, targetTickCount))
    .filter((candidate) => candidate.tickCount >= MIN_TICK_COUNT && candidate.tickCount <= MAX_TICK_COUNT)
    .sort((left, right) => {
      if (left.preferenceScore !== right.preferenceScore) {
        return left.preferenceScore - right.preferenceScore
      }

      if (!almostEqual(left.paddingScore, right.paddingScore)) {
        return left.paddingScore - right.paddingScore
      }

      return left.tickCount - right.tickCount
    })

  const winner = candidates[0] ?? buildCandidate(minimumValue, maximumValue, 6)
  const tickDenominator = Math.max(winner.tickCount - 1, 1)

  return {
    minimum: winner.minimum,
    maximum: winner.maximum,
    step: winner.step,
    ticks: Array.from({ length: winner.tickCount }, (_, index) => ({
      value: winner.minimum + winner.step * index,
      offset: index / tickDenominator,
    })),
  }
}

export function filterSeriesToVisibleRange(series: TimeSeriesViewerSeries[], range: VisibleRange | null) {
  if (!range) {
    return series
  }

  const startMs = new Date(range.start).getTime()
  const endMs = new Date(range.end).getTime()

  return series.map((entry) => ({
    ...entry,
    points: entry.points.filter((point) => {
      const pointMs = new Date(point.date).getTime()
      return pointMs >= startMs && pointMs <= endMs
    }),
    segments: entry.segments
      ? entry.segments
          .map((segment) => segment.filter((point) => {
            const pointMs = new Date(point.date).getTime()
            return pointMs >= startMs && pointMs <= endMs
          }))
          .filter((segment) => segment.length > 0)
      : undefined,
  }))
}