import type {
  ForecastAccuracyHorizonMonths,
  ForecastAccuracyPoint,
  ForecastAccuracyResponse,
} from '@/lib/forecast-accuracy/forecast-accuracy-contract'

export type AccuracyPresentationMode = 'off' | 'percentage-arrows' | 'historical-forecast'

export type HistoricalForecastDirection = 'above' | 'below' | 'equal'

export interface HistoricalForecastComparisonPoint {
  key: string
  monthKey: string
  date: string
  actualValue: number
  forecastValue: number
  sourceDifferenceValue: number | null
  sourceErrorType: string | null
  absoluteDiff: number
  percentageDiff: number | null
  direction: HistoricalForecastDirection
}

export interface HistoricalForecastComparison {
  horizonMonths: ForecastAccuracyHorizonMonths
  availableHorizons: ForecastAccuracyHorizonMonths[]
  points: HistoricalForecastComparisonPoint[]
}

export interface HistoricalForecastLineSegment {
  points: HistoricalForecastComparisonPoint[]
}

export interface HistoricalForecastDeltaVertex {
  date: string
  value: number
  edge: 'actual' | 'forecast'
  monthKey: string
  source: 'point' | 'crossing'
}

export interface HistoricalForecastDeltaSegment {
  sign: Exclude<HistoricalForecastDirection, 'equal'>
  points: HistoricalForecastDeltaVertex[]
}

function toIsoMonthStart(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)).toISOString()
}

function monthOrdinal(date: string) {
  const next = new Date(date)
  return next.getUTCFullYear() * 12 + next.getUTCMonth()
}

function isConsecutiveMonth(left: string, right: string) {
  return monthOrdinal(right) - monthOrdinal(left) === 1
}

function compareDatesAscending(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime()
}

function resolveDirection(diff: number): HistoricalForecastDirection {
  if (diff > 0) {
    return 'above'
  }

  if (diff < 0) {
    return 'below'
  }

  return 'equal'
}

export function toCanonicalMonthKey(date: string) {
  const next = new Date(date)
  const year = next.getUTCFullYear()
  const month = `${next.getUTCMonth() + 1}`.padStart(2, '0')
  return `${year}-${month}`
}

export function resolveHistoricalForecastPercentageDiff(actualValue: number, forecastValue: number) {
  if (actualValue === 0) {
    return null
  }

  return ((forecastValue - actualValue) / actualValue) * 100
}

export function selectPreferredAccuracyHorizon(
  availableHorizons: ForecastAccuracyHorizonMonths[],
  previousHorizon: ForecastAccuracyHorizonMonths | null,
) {
  if (availableHorizons.length === 0) {
    return null
  }

  if (previousHorizon !== null && availableHorizons.includes(previousHorizon)) {
    return previousHorizon
  }

  if (availableHorizons.includes(1)) {
    return 1
  }

  return [...availableHorizons].sort((left, right) => left - right)[0] ?? null
}

export function buildHistoricalForecastComparison(response: ForecastAccuracyResponse): HistoricalForecastComparison {
  const selectedHorizon = selectPreferredAccuracyHorizon(
    response.availableHorizons,
    response.selection.horizonMonths,
  )

  if (selectedHorizon === null) {
    return {
      horizonMonths: response.selection.horizonMonths ?? 1,
      availableHorizons: response.availableHorizons,
      points: [],
    }
  }

  return {
    horizonMonths: selectedHorizon,
    availableHorizons: response.availableHorizons,
    points: response.points
      .filter((point): point is ForecastAccuracyPoint & { actualValue: number } => (
        point.actualValue !== null
        && Number.isFinite(point.actualValue)
        && Number.isFinite(point.forecastValue)
      ))
      .sort((left, right) => compareDatesAscending(left.targetDate, right.targetDate))
      .map((point) => {
        const absoluteDiff = point.forecastValue - point.actualValue
        return {
          key: `${response.selection.benchmarkCode}:${selectedHorizon}:${toCanonicalMonthKey(point.targetDate)}`,
          monthKey: toCanonicalMonthKey(point.targetDate),
          date: point.targetDate,
          actualValue: point.actualValue,
          forecastValue: point.forecastValue,
          sourceDifferenceValue: point.sourceDifferenceValue,
          sourceErrorType: point.sourceErrorType,
          absoluteDiff,
          percentageDiff: resolveHistoricalForecastPercentageDiff(point.actualValue, point.forecastValue),
          direction: resolveDirection(absoluteDiff),
        }
      })
      .filter((point, index, collection) => index === 0 || collection[index - 1]?.monthKey !== point.monthKey),
  }
}

function normalizeHistoricalForecastPoints(points: HistoricalForecastComparisonPoint[]) {
  return [...points]
    .sort((left, right) => compareDatesAscending(left.date, right.date))
    .filter((point, index, collection) => index === 0 || collection[index - 1]?.monthKey !== point.monthKey)
}

export function buildHistoricalForecastLineSegments(points: HistoricalForecastComparisonPoint[]) {
  const normalizedPoints = normalizeHistoricalForecastPoints(points)
  const segments: HistoricalForecastLineSegment[] = []
  let current: HistoricalForecastComparisonPoint[] = []

  for (let index = 0; index < normalizedPoints.length; index += 1) {
    const point = normalizedPoints[index]
    const previous = normalizedPoints[index - 1]

    if (!point) {
      continue
    }

    if (current.length === 0) {
      current = [point]
      continue
    }

    if (!previous || !isConsecutiveMonth(previous.date, point.date)) {
      if (current.length >= 2) {
        segments.push({ points: current })
      }

      current = [point]
      continue
    }

    current.push(point)
  }

  if (current.length >= 2) {
    segments.push({ points: current })
  }

  return segments
}

function createCrossingVertex(
  left: HistoricalForecastComparisonPoint,
  right: HistoricalForecastComparisonPoint,
): Omit<HistoricalForecastDeltaVertex, 'value' | 'edge'> & { actualValue: number; forecastValue: number } {
  const leftDiff = left.forecastValue - left.actualValue
  const rightDiff = right.forecastValue - right.actualValue
  const ratio = leftDiff / (leftDiff - rightDiff)
  const leftDate = new Date(left.date)
  const rightDate = new Date(right.date)
  const crossedAtMs = leftDate.getTime() + (rightDate.getTime() - leftDate.getTime()) * ratio
  const actualValue = left.actualValue + (right.actualValue - left.actualValue) * ratio

  return {
    date: new Date(crossedAtMs).toISOString(),
    actualValue,
    forecastValue: actualValue,
    monthKey: toCanonicalMonthKey(toIsoMonthStart(new Date(crossedAtMs).getUTCFullYear(), new Date(crossedAtMs).getUTCMonth())),
    source: 'crossing',
  }
}

function createActualVertex(point: { date: string; actualValue: number; monthKey: string; source: 'point' | 'crossing' }): HistoricalForecastDeltaVertex {
  return {
    date: point.date,
    value: point.actualValue,
    edge: 'actual',
    monthKey: point.monthKey,
    source: point.source,
  }
}

function createForecastVertex(point: { date: string; forecastValue: number; monthKey: string; source: 'point' | 'crossing' }): HistoricalForecastDeltaVertex {
  return {
    date: point.date,
    value: point.forecastValue,
    edge: 'forecast',
    monthKey: point.monthKey,
    source: point.source,
  }
}

function createPointEndpoint(point: HistoricalForecastComparisonPoint) {
  return {
    date: point.date,
    actualValue: point.actualValue,
    forecastValue: point.forecastValue,
    monthKey: point.monthKey,
    source: 'point' as const,
  }
}

function createLocalDeltaSegment(
  sign: Exclude<HistoricalForecastDirection, 'equal'>,
  start: { date: string; actualValue: number; forecastValue: number; monthKey: string; source: 'point' | 'crossing' },
  end: { date: string; actualValue: number; forecastValue: number; monthKey: string; source: 'point' | 'crossing' },
): HistoricalForecastDeltaSegment {
  return {
    sign,
    points: [
      createActualVertex(start),
      createActualVertex(end),
      createForecastVertex(end),
      createForecastVertex(start),
    ],
  }
}

export function buildHistoricalForecastDeltaSegments(points: HistoricalForecastComparisonPoint[]) {
  const normalizedPoints = normalizeHistoricalForecastPoints(points)
  const segments: HistoricalForecastDeltaSegment[] = []

  for (let index = 1; index < normalizedPoints.length; index += 1) {
    const previousPoint = normalizedPoints[index - 1]
    const point = normalizedPoints[index]

    if (!previousPoint || !point || !isConsecutiveMonth(previousPoint.date, point.date)) {
      continue
    }

    const previousDiff = previousPoint.forecastValue - previousPoint.actualValue
    const nextDiff = point.forecastValue - point.actualValue

    if (previousDiff === 0 && nextDiff === 0) {
      continue
    }

    const previousEndpoint = createPointEndpoint(previousPoint)
    const nextEndpoint = createPointEndpoint(point)

    if (previousDiff === 0) {
      const sign = resolveDirection(nextDiff)

      if (sign !== 'equal') {
        segments.push(createLocalDeltaSegment(sign, previousEndpoint, nextEndpoint))
      }

      continue
    }

    if (nextDiff === 0) {
      const sign = resolveDirection(previousDiff)

      if (sign !== 'equal') {
        segments.push(createLocalDeltaSegment(sign, previousEndpoint, nextEndpoint))
      }

      continue
    }

    const previousSign = resolveDirection(previousDiff)
    const nextSign = resolveDirection(nextDiff)

    if (previousSign === nextSign) {
      segments.push(createLocalDeltaSegment(previousSign as Exclude<HistoricalForecastDirection, 'equal'>, previousEndpoint, nextEndpoint))
      continue
    }

    const crossing = createCrossingVertex(previousPoint, point)
    segments.push(createLocalDeltaSegment(previousSign as Exclude<HistoricalForecastDirection, 'equal'>, previousEndpoint, crossing))
    segments.push(createLocalDeltaSegment(nextSign as Exclude<HistoricalForecastDirection, 'equal'>, crossing, nextEndpoint))
  }

  return segments
}