import type { TimeSeriesViewerSeries } from '@/lib/time-series-viewer/time-series-viewer-contract'

const VISUAL_EPSILON = 1e-9

export type PreparedVisualSeriesPoint = {
  key: string
  date: string
  value: number
  x: number
  y: number
}

export type PreparedVisualSeriesSubsegment = {
  key: string
  start: PreparedVisualSeriesPoint
  end: PreparedVisualSeriesPoint
}

export type PreparedVisualSeriesGeometry = {
  points: PreparedVisualSeriesPoint[]
  subsegments: PreparedVisualSeriesSubsegment[]
  polylines: string[]
}

export type VisualDeltaSample = {
  x: number
  actualY: number
  forecastY: number
}

export type EndOfPeriodDeltaSurface = {
  key: string
  sign: 'above' | 'below'
  path: string
  actualBoundary: string
  forecastBoundary: string
  samples: [VisualDeltaSample, VisualDeltaSample]
}

export type EndOfPeriodDeltaAudit = {
  samples: number
  exactForecastMatches: number
  forecastMismatches: number
  maxForecastDifference: number
  exactActualMatches: number
  actualMismatches: number
  maxActualDifference: number
  conflictingDuplicateX: number
  signDefects: number
  legacyFallbackCount: number
}

function compareByDate(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime()
}

function formatPoint(x: number, y: number) {
  return `${x},${y}`
}

function sameVisualPoint(left: PreparedVisualSeriesPoint, right: PreparedVisualSeriesPoint) {
  return left.date === right.date
    && Math.abs(left.value - right.value) <= VISUAL_EPSILON
    && Math.abs(left.x - right.x) <= VISUAL_EPSILON
    && Math.abs(left.y - right.y) <= VISUAL_EPSILON
}

function evaluateLinearYAtX(
  start: { x: number; y: number },
  end: { x: number; y: number },
  x: number,
) {
  const dx = end.x - start.x

  if (Math.abs(dx) <= VISUAL_EPSILON) {
    return start.y
  }

  const ratio = (x - start.x) / dx
  return start.y + ((end.y - start.y) * ratio)
}

function evaluateSubsegmentYAtX(subsegment: PreparedVisualSeriesSubsegment, x: number) {
  return evaluateLinearYAtX(subsegment.start, subsegment.end, x)
}

function signFromVisualDelta(delta: number) {
  if (delta > VISUAL_EPSILON) {
    return 'above' as const
  }

  if (delta < -VISUAL_EPSILON) {
    return 'below' as const
  }

  return null
}

function createSurface(
  key: string,
  sign: 'above' | 'below',
  start: VisualDeltaSample,
  end: VisualDeltaSample,
): EndOfPeriodDeltaSurface {
  return {
    key,
    sign,
    path: `M ${formatPoint(start.x, start.actualY)} L ${formatPoint(end.x, end.actualY)} L ${formatPoint(end.x, end.forecastY)} L ${formatPoint(start.x, start.forecastY)} Z`,
    actualBoundary: `${formatPoint(start.x, start.actualY)} ${formatPoint(end.x, end.actualY)}`,
    forecastBoundary: `${formatPoint(start.x, start.forecastY)} ${formatPoint(end.x, end.forecastY)}`,
    samples: [start, end],
  }
}

function splitVisualOverlapIntoSignedSurfaces(
  start: VisualDeltaSample,
  end: VisualDeltaSample,
  keyBase: string,
) {
  const startDelta = start.actualY - start.forecastY
  const endDelta = end.actualY - end.forecastY
  const startSign = signFromVisualDelta(startDelta)
  const endSign = signFromVisualDelta(endDelta)

  if (!startSign && !endSign) {
    return [] as EndOfPeriodDeltaSurface[]
  }

  if (startSign && endSign && startSign === endSign) {
    return [createSurface(keyBase, startSign, start, end)]
  }

  if (startSign && !endSign) {
    return [createSurface(keyBase, startSign, start, end)]
  }

  if (!startSign && endSign) {
    return [createSurface(keyBase, endSign, start, end)]
  }

  const ratio = startDelta / (startDelta - endDelta)
  const crossX = start.x + ((end.x - start.x) * ratio)
  const crossActualY = start.actualY + ((end.actualY - start.actualY) * ratio)
  const crossForecastY = start.forecastY + ((end.forecastY - start.forecastY) * ratio)
  const crossing: VisualDeltaSample = {
    x: crossX,
    actualY: crossActualY,
    forecastY: crossForecastY,
  }

  return [
    createSurface(`${keyBase}-a`, startSign as 'above' | 'below', start, crossing),
    createSurface(`${keyBase}-b`, endSign as 'above' | 'below', crossing, end),
  ]
}

function deduplicateSamples(samples: VisualDeltaSample[]) {
  const unique: VisualDeltaSample[] = []

  for (const sample of samples) {
    const previous = unique[unique.length - 1]

    if (
      previous
      && Math.abs(previous.x - sample.x) <= VISUAL_EPSILON
      && Math.abs(previous.actualY - sample.actualY) <= VISUAL_EPSILON
      && Math.abs(previous.forecastY - sample.forecastY) <= VISUAL_EPSILON
    ) {
      continue
    }

    unique.push(sample)
  }

  return unique
}

export function prepareVisibleSeriesGeometry(
  series: TimeSeriesViewerSeries | null,
  pointX: (date: string) => number,
  pointY: (value: number | null) => number,
): PreparedVisualSeriesGeometry {
  if (!series) {
    return {
      points: [],
      subsegments: [],
      polylines: [],
    }
  }

  const sourceSegments = series.segments && series.segments.length > 0 ? series.segments : [series.points]
  const points: PreparedVisualSeriesPoint[] = []
  const subsegments: PreparedVisualSeriesSubsegment[] = []
  const polylines = sourceSegments
    .map((sourceSegment, sourceSegmentIndex) => sourceSegment
      .filter((point): point is typeof point & { value: number } => point.value !== null)
      .sort((left, right) => compareByDate(left.date, right.date))
      .map((point) => ({
        key: point.key,
        date: point.date,
        value: point.value,
        x: pointX(point.date),
        y: pointY(point.value),
      })))
    .filter((segment) => segment.length > 0)
    .map((segment, sourceSegmentIndex) => {
      for (const point of segment) {
        const previous = points[points.length - 1]

        if (!previous || !sameVisualPoint(previous, point)) {
          points.push(point)
        }
      }

      for (let pointIndex = 1; pointIndex < segment.length; pointIndex += 1) {
        const start = segment[pointIndex - 1]
        const end = segment[pointIndex]

        if (!start || !end) {
          continue
        }

        subsegments.push({
          key: `${series.id}-${sourceSegmentIndex}-${pointIndex - 1}`,
          start,
          end,
        })
      }

      return segment.map((point) => formatPoint(point.x, point.y)).join(' ')
    })

  return {
    points,
    subsegments,
    polylines,
  }
}

export function buildEndOfPeriodDeltaSurfaces(
  actualGeometry: PreparedVisualSeriesGeometry,
  forecastGeometry: PreparedVisualSeriesGeometry,
) {
  if (actualGeometry.subsegments.length === 0 || forecastGeometry.subsegments.length === 0) {
    return [] as EndOfPeriodDeltaSurface[]
  }

  const surfaces: EndOfPeriodDeltaSurface[] = []
  let actualIndex = 0
  let forecastIndex = 0

  while (actualIndex < actualGeometry.subsegments.length && forecastIndex < forecastGeometry.subsegments.length) {
    const actualSegment = actualGeometry.subsegments[actualIndex]
    const forecastSegment = forecastGeometry.subsegments[forecastIndex]

    if (!actualSegment || !forecastSegment) {
      break
    }

    if (actualSegment.end.x <= forecastSegment.start.x + VISUAL_EPSILON) {
      actualIndex += 1
      continue
    }

    if (forecastSegment.end.x <= actualSegment.start.x + VISUAL_EPSILON) {
      forecastIndex += 1
      continue
    }

    const overlapLeft = Math.max(actualSegment.start.x, forecastSegment.start.x)
    const overlapRight = Math.min(actualSegment.end.x, forecastSegment.end.x)

    if (overlapRight - overlapLeft > VISUAL_EPSILON) {
      const start: VisualDeltaSample = {
        x: overlapLeft,
        actualY: evaluateSubsegmentYAtX(actualSegment, overlapLeft),
        forecastY: evaluateSubsegmentYAtX(forecastSegment, overlapLeft),
      }
      const end: VisualDeltaSample = {
        x: overlapRight,
        actualY: evaluateSubsegmentYAtX(actualSegment, overlapRight),
        forecastY: evaluateSubsegmentYAtX(forecastSegment, overlapRight),
      }

      surfaces.push(...splitVisualOverlapIntoSignedSurfaces(start, end, `eop-${forecastSegment.key}-${actualSegment.key}`))
    }

    if (actualSegment.end.x < forecastSegment.end.x - VISUAL_EPSILON) {
      actualIndex += 1
      continue
    }

    if (forecastSegment.end.x < actualSegment.end.x - VISUAL_EPSILON) {
      forecastIndex += 1
      continue
    }

    actualIndex += 1
    forecastIndex += 1
  }

  return surfaces
}

function evaluatePreparedSeriesAtX(geometry: PreparedVisualSeriesGeometry, x: number) {
  for (const subsegment of geometry.subsegments) {
    const leftX = Math.min(subsegment.start.x, subsegment.end.x)
    const rightX = Math.max(subsegment.start.x, subsegment.end.x)

    if (x < leftX - VISUAL_EPSILON || x > rightX + VISUAL_EPSILON) {
      continue
    }

    return evaluateSubsegmentYAtX(subsegment, x)
  }

  return null
}

export function auditEndOfPeriodDeltaSurfaces(
  surfaces: EndOfPeriodDeltaSurface[],
  actualGeometry: PreparedVisualSeriesGeometry,
  forecastGeometry: PreparedVisualSeriesGeometry,
): EndOfPeriodDeltaAudit {
  const samples = deduplicateSamples(surfaces.flatMap((surface) => surface.samples).sort((left, right) => left.x - right.x))
  let exactForecastMatches = 0
  let forecastMismatches = 0
  let maxForecastDifference = 0
  let exactActualMatches = 0
  let actualMismatches = 0
  let maxActualDifference = 0
  let conflictingDuplicateX = 0
  let signDefects = 0

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    const previous = samples[index - 1]
    const expectedForecastY = evaluatePreparedSeriesAtX(forecastGeometry, sample.x)
    const expectedActualY = evaluatePreparedSeriesAtX(actualGeometry, sample.x)

    if (previous && Math.abs(previous.x - sample.x) <= VISUAL_EPSILON) {
      if (
        Math.abs(previous.forecastY - sample.forecastY) > VISUAL_EPSILON
        || Math.abs(previous.actualY - sample.actualY) > VISUAL_EPSILON
      ) {
        conflictingDuplicateX += 1
      }
    }

    if (expectedForecastY === null) {
      forecastMismatches += 1
    } else {
      const difference = Math.abs(sample.forecastY - expectedForecastY)
      maxForecastDifference = Math.max(maxForecastDifference, difference)

      if (difference <= VISUAL_EPSILON) {
        exactForecastMatches += 1
      } else {
        forecastMismatches += 1
      }
    }

    if (expectedActualY === null) {
      actualMismatches += 1
    } else {
      const difference = Math.abs(sample.actualY - expectedActualY)
      maxActualDifference = Math.max(maxActualDifference, difference)

      if (difference <= VISUAL_EPSILON) {
        exactActualMatches += 1
      } else {
        actualMismatches += 1
      }
    }
  }

  for (const surface of surfaces) {
    const [start, end] = surface.samples
    const startSign = signFromVisualDelta(start.actualY - start.forecastY)
    const endSign = signFromVisualDelta(end.actualY - end.forecastY)

    if (end.x + VISUAL_EPSILON < start.x) {
      signDefects += 1
      continue
    }

    if (startSign && startSign !== surface.sign) {
      signDefects += 1
      continue
    }

    if (endSign && endSign !== surface.sign) {
      signDefects += 1
    }
  }

  return {
    samples: samples.length,
    exactForecastMatches,
    forecastMismatches,
    maxForecastDifference: maxForecastDifference <= VISUAL_EPSILON ? 0 : maxForecastDifference,
    exactActualMatches,
    actualMismatches,
    maxActualDifference: maxActualDifference <= VISUAL_EPSILON ? 0 : maxActualDifference,
    conflictingDuplicateX,
    signDefects,
    legacyFallbackCount: 0,
  }
}