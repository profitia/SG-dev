import { z } from 'zod'

import { FORECAST_NATIVE_FREQUENCIES } from '@/lib/forecast/cadence'
import {
  DEFAULT_FORECAST_TARGET_BASIS,
  FORECAST_TARGET_BASES,
  PRODUCTION_FORECAST_METHODS,
  USER_FACING_FORECAST_MODELS,
  type ForecastTargetBasis,
  type ProductionForecastMethod,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'

export const ForecastTargetBasisSchema = z.enum(FORECAST_TARGET_BASES)

export const ForecastRouteQuerySchema = z.object({
  seriesId: z.string().trim().min(1),
  model: z.enum(USER_FACING_FORECAST_MODELS),
  targetBasis: ForecastTargetBasisSchema.optional(),
  sourceFrequency: z.enum(FORECAST_NATIVE_FREQUENCIES).optional(),
  targetCadence: z.enum(FORECAST_NATIVE_FREQUENCIES).optional(),
}).refine((value) => (
  value.sourceFrequency === undefined
) === (
  value.targetCadence === undefined
), {
  message: 'sourceFrequency and targetCadence must be provided together.',
})

export type ForecastRouteQuery = z.infer<typeof ForecastRouteQuerySchema>

export type ForecastRequestInput = {
  seriesId: string
  modelId: UserFacingForecastModelId
  targetBasis: ForecastTargetBasis
  sourceFrequency?: (typeof FORECAST_NATIVE_FREQUENCIES)[number]
  targetCadence?: (typeof FORECAST_NATIVE_FREQUENCIES)[number]
}

export const ProductionForecastMethodSchema = z.enum(PRODUCTION_FORECAST_METHODS)

export const ProductionForecastRouteQuerySchema = z.object({
  seriesId: z.string().trim().min(1),
  model: z.enum(USER_FACING_FORECAST_MODELS),
  forecastMethod: ProductionForecastMethodSchema,
  sourceFrequency: z.enum(FORECAST_NATIVE_FREQUENCIES).optional(),
  targetCadence: z.enum(FORECAST_NATIVE_FREQUENCIES).optional(),
}).refine((value) => (
  value.sourceFrequency === undefined
) === (
  value.targetCadence === undefined
), {
  message: 'sourceFrequency and targetCadence must be provided together.',
})

export type ProductionForecastRouteQuery = z.infer<typeof ProductionForecastRouteQuerySchema>

export type ProductionForecastRequestInput = {
  seriesId: string
  modelId: UserFacingForecastModelId
  forecastMethod: ProductionForecastMethod
  sourceFrequency?: (typeof FORECAST_NATIVE_FREQUENCIES)[number]
  targetCadence?: (typeof FORECAST_NATIVE_FREQUENCIES)[number]
}

export function normalizeForecastTargetBasis(targetBasis?: ForecastTargetBasis | null): ForecastTargetBasis {
  return targetBasis ?? DEFAULT_FORECAST_TARGET_BASIS
}

export function toForecastRequestInput(query: ForecastRouteQuery): ForecastRequestInput {
  return {
    seriesId: query.seriesId,
    modelId: query.model,
    targetBasis: normalizeForecastTargetBasis(query.targetBasis),
    sourceFrequency: query.sourceFrequency,
    targetCadence: query.targetCadence,
  }
}

export function toProductionForecastRequestInput(query: ProductionForecastRouteQuery): ProductionForecastRequestInput {
  return {
    seriesId: query.seriesId,
    modelId: query.model,
    forecastMethod: query.forecastMethod,
    ...(query.sourceFrequency && query.targetCadence
      ? { sourceFrequency: query.sourceFrequency, targetCadence: query.targetCadence }
      : {}),
  }
}