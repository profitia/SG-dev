import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { UserFacingForecastModelId } from '@/lib/forecast/contracts'
import type { ForecastTargetSemantics } from '@/lib/forecast/identity'
import { ROLLING_DAILY_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS } from '@/lib/forecast/rolling-daily-policy'

type PeriodForecastModelTechnicalRequirements = Record<UserFacingForecastModelId, {
  minimumTrainingObservations: number
}>

const PERIOD_FORECAST_MODEL_TECHNICAL_REQUIREMENTS_PATH = path.resolve(
  process.cwd(),
  '../../tooling/Benchmark-Forecasting/metadata/model-technical-requirements.json',
)

let periodForecastModelTechnicalRequirementsCache: PeriodForecastModelTechnicalRequirements | null = null

function loadPeriodForecastModelTechnicalRequirements(): PeriodForecastModelTechnicalRequirements {
  if (periodForecastModelTechnicalRequirementsCache) {
    return periodForecastModelTechnicalRequirementsCache
  }

  const parsed = JSON.parse(readFileSync(PERIOD_FORECAST_MODEL_TECHNICAL_REQUIREMENTS_PATH, 'utf8')) as unknown
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Forecast model technical requirements must be a JSON object.')
  }

  const modelIds: UserFacingForecastModelId[] = ['naive', 'damped_holt', 'ets', 'arima']
  const requirements = Object.fromEntries(modelIds.map((modelId) => {
    const entry = (parsed as Record<string, unknown>)[modelId]
    const rawMinimumTrainingObservations = typeof entry === 'object' && entry !== null
      ? (entry as Record<string, unknown>).minimumTrainingObservations
      : null

    if (
      typeof rawMinimumTrainingObservations !== 'number'
      || !Number.isInteger(rawMinimumTrainingObservations)
      || rawMinimumTrainingObservations < 1
    ) {
      throw new Error(`Forecast model technical requirements are invalid for ${modelId}.`)
    }

    const minimumTrainingObservations = rawMinimumTrainingObservations as number

    return [modelId, { minimumTrainingObservations }]
  })) as PeriodForecastModelTechnicalRequirements

  periodForecastModelTechnicalRequirementsCache = requirements
  return requirements
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

  return loadPeriodForecastModelTechnicalRequirements()[input.modelId].minimumTrainingObservations
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