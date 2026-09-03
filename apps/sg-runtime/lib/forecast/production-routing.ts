import {
  DEFAULT_FORECAST_TARGET_BASIS,
  PRODUCTION_FORECAST_METHODS,
  USER_FACING_FORECAST_MODELS,
  type BenchmarkForecastCurrentResult,
  type ForecastFailedResult,
  type MonthlyProductionForecastResult,
  type ProductionForecastMethod,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import {
  createRollingDailyProductionForecastService,
  type RollingDailyProductionForecastResult,
} from '@/lib/forecast/rolling-daily-production-forecast'
import { createRollingDailyMaintenanceService } from '@/lib/forecast/rolling-daily-maintenance'
import { persistResolvedRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { resolveBenchmarkCurrentForecast } from '@/lib/forecast/service'
import { resolveForecastMethodContract } from '@/lib/forecast/identity'
import type { ForecastSourceFrequency, ForecastTargetCadence } from '@/lib/forecast/cadence'

export type ProductionForecastRequest = {
  seriesId: string
  modelId: UserFacingForecastModelId
  forecastMethod: ProductionForecastMethod
  sourceFrequency?: ForecastSourceFrequency
  targetCadence?: ForecastTargetCadence
}

export type ProductionForecastResult =
  | MonthlyProductionForecastResult
  | (RollingDailyProductionForecastResult & { productionMethod: 'ROLLING_DAILY_POINT_IN_TIME' })

type MonthlyForecastResolver = (input: {
  seriesId: string
  modelId: UserFacingForecastModelId
  targetBasis: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD'
  sourceFrequency?: ForecastSourceFrequency
  targetCadence?: ForecastTargetCadence
}) => Promise<BenchmarkForecastCurrentResult>

type RollingDailyForecastResolver = (input: {
  seriesId: string
  modelId: UserFacingForecastModelId
}) => Promise<RollingDailyProductionForecastResult>

type RollingDailyHistoricalPreparer = (input: {
  seriesId: string
  modelId: UserFacingForecastModelId
}) => Promise<{ status: 'SUCCEEDED' | 'NO_OP' | 'REBUILD_REQUIRED' }>

type RollingDailySnapshotPersister = (input: {
  seriesId: string
  modelId: UserFacingForecastModelId
}, result: RollingDailyProductionForecastResult & { productionMethod: 'ROLLING_DAILY_POINT_IN_TIME' }) => Promise<unknown>

type ProductionForecastRouterDependencies = {
  resolveMonthlyForecast: MonthlyForecastResolver
  resolveRollingDailyForecast: RollingDailyForecastResolver
  prepareRollingDailyHistorical: RollingDailyHistoricalPreparer
  persistRollingDailySnapshot: RollingDailySnapshotPersister
}

function isSupportedProductionForecastMethod(value: string): value is ProductionForecastMethod {
  return (PRODUCTION_FORECAST_METHODS as readonly string[]).includes(value)
}

function toUnsupportedProductionMethodResult(input: {
  seriesId: string
  modelId: UserFacingForecastModelId
  forecastMethod: string
}): MonthlyProductionForecastResult {
  const identity = resolveForecastMethodContract(DEFAULT_FORECAST_TARGET_BASIS)

  return {
    productionMethod: DEFAULT_FORECAST_TARGET_BASIS,
    status: 'UNSUPPORTED',
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: DEFAULT_FORECAST_TARGET_BASIS,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    reason: `Forecast method ${input.forecastMethod} is not implemented in the canonical production forecast router.`,
    supportedSeriesIds: [input.seriesId],
    supportedModels: [...USER_FACING_FORECAST_MODELS],
  }
}

export function createProductionForecastRouter(
  dependencies: Partial<ProductionForecastRouterDependencies> = {},
) {
  const rollingDailyService = createRollingDailyProductionForecastService()
  const rollingDailyMaintenance = createRollingDailyMaintenanceService()
  const resolvedDependencies: ProductionForecastRouterDependencies = {
    resolveMonthlyForecast: dependencies.resolveMonthlyForecast ?? resolveBenchmarkCurrentForecast,
    resolveRollingDailyForecast: dependencies.resolveRollingDailyForecast
      ?? ((input) => rollingDailyService.getRollingDailyProductionForecast(input)),
    prepareRollingDailyHistorical: dependencies.prepareRollingDailyHistorical
      ?? ((input) => rollingDailyMaintenance.runIncrementalMaintenance(input)),
    persistRollingDailySnapshot: dependencies.persistRollingDailySnapshot
      ?? ((input, result) => persistResolvedRollingDailyCurrentForecastSnapshot(input, result)),
  }

  return {
    async resolveProductionForecast(input: ProductionForecastRequest | {
      seriesId: string
      modelId: UserFacingForecastModelId
      forecastMethod: string
      sourceFrequency?: ForecastSourceFrequency
      targetCadence?: ForecastTargetCadence
    }): Promise<ProductionForecastResult> {
      if (!isSupportedProductionForecastMethod(input.forecastMethod)) {
        return toUnsupportedProductionMethodResult(input)
      }

      if (input.forecastMethod === 'ROLLING_DAILY_POINT_IN_TIME') {
        const result = await resolvedDependencies.resolveRollingDailyForecast({
          seriesId: input.seriesId,
          modelId: input.modelId,
        })
        try {
          const maintenance = await resolvedDependencies.prepareRollingDailyHistorical({
            seriesId: input.seriesId,
            modelId: input.modelId,
          })

          if (maintenance.status !== 'REBUILD_REQUIRED') {
            await resolvedDependencies.persistRollingDailySnapshot(input, {
              ...result,
              productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
            })
          }
        } catch {
          // Skip snapshot persistence when maintenance cannot lawfully establish historical state.
        }

        return {
          ...result,
          productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
        }
      }

      const result = await resolvedDependencies.resolveMonthlyForecast({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.forecastMethod,
        sourceFrequency: input.sourceFrequency,
        targetCadence: input.targetCadence,
      })

      return {
        ...result,
        productionMethod: input.forecastMethod,
      }
    },
  }
}

const productionForecastRouter = createProductionForecastRouter()

export async function resolveProductionForecast(input: ProductionForecastRequest) {
  return productionForecastRouter.resolveProductionForecast(input)
}