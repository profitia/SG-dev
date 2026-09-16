import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { UserFacingForecastModelId } from '@/lib/forecast/contracts'

type PeriodForecastModelTechnicalRequirement = {
  minimumTrainingObservations: number
}

type PeriodForecastTrainingPolicy = {
  policyVersion: string
  etsSeasonalMinimumObservations: number
  modelRequirements: Record<UserFacingForecastModelId, PeriodForecastModelTechnicalRequirement>
}

const PERIOD_FORECAST_MODEL_TECHNICAL_REQUIREMENTS_PATH = path.resolve(
  process.cwd(),
  '../../tooling/Benchmark-Forecasting/metadata/model-technical-requirements.json',
)

let periodForecastTrainingPolicyCache: PeriodForecastTrainingPolicy | null = null

function parsePositiveInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`)
  }

  return value
}

function loadPeriodForecastTrainingPolicy(): PeriodForecastTrainingPolicy {
  if (periodForecastTrainingPolicyCache) {
    return periodForecastTrainingPolicyCache
  }

  const parsed = JSON.parse(readFileSync(PERIOD_FORECAST_MODEL_TECHNICAL_REQUIREMENTS_PATH, 'utf8')) as unknown
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Forecast model technical requirements must be a JSON object.')
  }

  const root = parsed as Record<string, unknown>
  if (typeof root.policyVersion !== 'string' || root.policyVersion.trim().length === 0) {
    throw new Error('Forecast model technical requirements must define policyVersion.')
  }

  const modelIds: UserFacingForecastModelId[] = ['naive', 'damped_holt', 'ets', 'arima']
  const modelRequirements = Object.fromEntries(modelIds.map((modelId) => {
    const entry = root[modelId]
    const rawMinimumTrainingObservations = typeof entry === 'object' && entry !== null
      ? (entry as Record<string, unknown>).minimumTrainingObservations
      : null

    return [
      modelId,
      {
        minimumTrainingObservations: parsePositiveInteger(
          rawMinimumTrainingObservations,
          `Forecast model technical requirements are invalid for ${modelId}`,
        ),
      },
    ]
  })) as Record<UserFacingForecastModelId, PeriodForecastModelTechnicalRequirement>

  periodForecastTrainingPolicyCache = {
    policyVersion: root.policyVersion.trim(),
    etsSeasonalMinimumObservations: parsePositiveInteger(
      root.etsSeasonalMinimumObservations,
      'Forecast model technical requirements must define etsSeasonalMinimumObservations',
    ),
    modelRequirements,
  }

  return periodForecastTrainingPolicyCache
}

export function getPeriodForecastTrainingPolicyVersion() {
  return loadPeriodForecastTrainingPolicy().policyVersion
}

export function getPeriodForecastEtsSeasonalMinimumObservations() {
  return loadPeriodForecastTrainingPolicy().etsSeasonalMinimumObservations
}

export function resolvePeriodForecastTechnicalMinimumObservations(modelId: UserFacingForecastModelId) {
  return loadPeriodForecastTrainingPolicy().modelRequirements[modelId].minimumTrainingObservations
}
