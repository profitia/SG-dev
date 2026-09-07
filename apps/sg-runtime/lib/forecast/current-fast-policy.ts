import type { UserFacingForecastModelId } from '@/lib/forecast/contracts'
import type { ForecastTargetSemantics } from '@/lib/forecast/identity'
import { ROLLING_DAILY_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS } from '@/lib/forecast/rolling-daily-policy'

export const PERIOD_FORECAST_TECHNICAL_MINIMUM_OBSERVATIONS = 36

const PERIOD_FORECAST_MODEL_TECHNICAL_MINIMUMS: Record<UserFacingForecastModelId, number> = {
  naive: PERIOD_FORECAST_TECHNICAL_MINIMUM_OBSERVATIONS,
  damped_holt: PERIOD_FORECAST_TECHNICAL_MINIMUM_OBSERVATIONS,
  ets: PERIOD_FORECAST_TECHNICAL_MINIMUM_OBSERVATIONS,
  arima: PERIOD_FORECAST_TECHNICAL_MINIMUM_OBSERVATIONS,
}

export type CurrentFastSelectablePoint = {
  date: string
}

export function addCalendarMonthsClamped(value: string, months: number) {
  const source = new Date(value)
  const targetMonthIndex = source.getUTCMonth() + months
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(source.getUTCDate(), lastTargetDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  )).toISOString()
}

export function resolveForecastTechnicalMinimumObservations(input: {
  targetSemantics: ForecastTargetSemantics
  modelId: UserFacingForecastModelId
}) {
  if (input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
    return ROLLING_DAILY_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS
  }

  return PERIOD_FORECAST_MODEL_TECHNICAL_MINIMUMS[input.modelId]
}

export function selectMinimalLawfulCurrentTrainingSuffix<TPoint extends CurrentFastSelectablePoint>(input: {
  points: readonly TPoint[]
  forecastOrigin?: string
  minimumRequiredObservations: number
}) {
  const points = [...input.points].filter((point) => !input.forecastOrigin || point.date <= input.forecastOrigin)
  const lastPoint = points.at(-1)
  const forecastOrigin = input.forecastOrigin ?? lastPoint?.date

  if (!lastPoint || !forecastOrigin) {
    return {
      points: [] as TPoint[],
      forecastOrigin: input.forecastOrigin ?? '',
      windowStartExclusive: input.forecastOrigin ? addCalendarMonthsClamped(input.forecastOrigin, -12) : '',
      defaultWindowObservationCount: 0,
      selectedObservationCount: 0,
      minimumRequiredObservations: input.minimumRequiredObservations,
      extendedBeyondDefaultWindow: false,
      minimumRequirementSatisfied: false,
    }
  }

  const windowStartExclusive = addCalendarMonthsClamped(forecastOrigin, -12)
  const firstInsideWindowIndex = points.findIndex((point) => point.date > windowStartExclusive)
  const defaultWindowStartIndex = firstInsideWindowIndex === -1 ? points.length : firstInsideWindowIndex
  const defaultWindowPoints = points.slice(defaultWindowStartIndex)

  if (defaultWindowPoints.length >= input.minimumRequiredObservations) {
    return {
      points: defaultWindowPoints,
      forecastOrigin,
      windowStartExclusive,
      defaultWindowObservationCount: defaultWindowPoints.length,
      selectedObservationCount: defaultWindowPoints.length,
      minimumRequiredObservations: input.minimumRequiredObservations,
      extendedBeyondDefaultWindow: false,
      minimumRequirementSatisfied: true,
    }
  }

  const selectedStartIndex = Math.max(0, points.length - input.minimumRequiredObservations)
  const selectedPoints = points.slice(selectedStartIndex)

  return {
    points: selectedPoints,
    forecastOrigin,
    windowStartExclusive,
    defaultWindowObservationCount: defaultWindowPoints.length,
    selectedObservationCount: selectedPoints.length,
    minimumRequiredObservations: input.minimumRequiredObservations,
    extendedBeyondDefaultWindow: selectedStartIndex < defaultWindowStartIndex,
    minimumRequirementSatisfied: selectedPoints.length >= input.minimumRequiredObservations,
  }
}