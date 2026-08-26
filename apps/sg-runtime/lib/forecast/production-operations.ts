import {
  resolveForecastCapabilitiesBySeriesId,
  type ForecastCapabilityResolution,
} from '@/lib/forecast/capability-resolver'
import {
  USER_FACING_FORECAST_MODELS,
  type ForecastTargetBasis,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import {
  resolveBenchmarkCurrentForecast,
  resolveBenchmarkForecastVerification,
} from '@/lib/forecast/service'

export const OPERATIONAL_FORECAST_TARGETS = [
  'END_OF_PERIOD',
  'MONTHLY_AVERAGE',
  'ROLLING_DAILY_POINT_IN_TIME',
] as const

export type OperationalForecastTarget = (typeof OPERATIONAL_FORECAST_TARGETS)[number]

export type ForecastProductionOperationsRequest = {
  seriesId: string
  targetSemantics?: readonly OperationalForecastTarget[]
  modelIds?: readonly UserFacingForecastModelId[]
  prepareHistorical?: boolean
}

export type ForecastProductionOperationItem = {
  targetSemantics: OperationalForecastTarget
  modelId: UserFacingForecastModelId
  current: 'READY' | 'REUSED' | 'FAILED'
  historical: 'READY' | 'REUSED' | 'NOT_REQUESTED' | 'FAILED'
  currentCacheStatus: string | null
  historicalCacheStatus: string | null
  error: string | null
}

export type ForecastProductionOperationsResult = {
  status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED'
  seriesId: string
  requestedTargets: OperationalForecastTarget[]
  requestedModels: UserFacingForecastModelId[]
  prepareHistorical: boolean
  before: ForecastCapabilityResolution
  after: ForecastCapabilityResolution
  results: ForecastProductionOperationItem[]
}

type ForecastProductionOperationsDependencies = {
  resolveCapabilities: typeof resolveForecastCapabilitiesBySeriesId
  prepareMonthlyCurrent: typeof resolveBenchmarkCurrentForecast
  prepareMonthlyHistorical: typeof resolveBenchmarkForecastVerification
  runRollingDaily: ReturnType<typeof createRollingDailyProductionOperationsService>['run']
}

const TARGET_BASIS_BY_SEMANTICS: Record<Exclude<OperationalForecastTarget, 'ROLLING_DAILY_POINT_IN_TIME'>, ForecastTargetBasis> = {
  END_OF_PERIOD: 'END_OF_PERIOD',
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
}

function readiness(cacheStatus: string | undefined): 'READY' | 'REUSED' {
  return cacheStatus === 'hit' ? 'REUSED' : 'READY'
}

export function createForecastProductionOperationsService(
  dependencies: Partial<ForecastProductionOperationsDependencies> = {},
) {
  const rollingDaily = createRollingDailyProductionOperationsService()
  const resolvedDependencies: ForecastProductionOperationsDependencies = {
    resolveCapabilities: dependencies.resolveCapabilities ?? resolveForecastCapabilitiesBySeriesId,
    prepareMonthlyCurrent: dependencies.prepareMonthlyCurrent ?? resolveBenchmarkCurrentForecast,
    prepareMonthlyHistorical: dependencies.prepareMonthlyHistorical ?? resolveBenchmarkForecastVerification,
    runRollingDaily: dependencies.runRollingDaily ?? ((request) => rollingDaily.run(request)),
  }

  return {
    async run(request: ForecastProductionOperationsRequest): Promise<ForecastProductionOperationsResult> {
      const requestedTargets = request.targetSemantics?.length
        ? [...request.targetSemantics]
        : [...OPERATIONAL_FORECAST_TARGETS]
      const requestedModels = request.modelIds?.length
        ? [...request.modelIds]
        : [...USER_FACING_FORECAST_MODELS]
      const prepareHistorical = request.prepareHistorical ?? false
      const before = await resolvedDependencies.resolveCapabilities(request.seriesId)
      const results: ForecastProductionOperationItem[] = []

      if (before.status !== 'AVAILABLE') {
        return {
          status: 'FAILED',
          seriesId: request.seriesId,
          requestedTargets,
          requestedModels,
          prepareHistorical,
          before,
          after: before,
          results,
        }
      }

      for (const targetSemantics of requestedTargets.filter((target) => target !== 'ROLLING_DAILY_POINT_IN_TIME')) {
        const targetBasis = TARGET_BASIS_BY_SEMANTICS[targetSemantics as keyof typeof TARGET_BASIS_BY_SEMANTICS]

        for (const modelId of requestedModels) {
          const capability = before.capabilities.find((item) => (
            item.identity.targetSemantics === targetSemantics && item.identity.modelId === modelId
          ))

          if (
            !capability
            || capability.admissionState !== 'ADMITTED'
            || capability.implementationState !== 'SUPPORTED'
            || !capability.currentForecastEligible
          ) {
            results.push({
              targetSemantics,
              modelId,
              current: 'FAILED',
              historical: prepareHistorical ? 'FAILED' : 'NOT_REQUESTED',
              currentCacheStatus: null,
              historicalCacheStatus: null,
              error: capability?.capabilityState ?? 'CAPABILITY_NOT_RESOLVED',
            })
            continue
          }

          const current = await resolvedDependencies.prepareMonthlyCurrent({
            seriesId: request.seriesId,
            modelId,
            targetBasis,
            sourceFrequency: capability.sourceFrequency ?? undefined,
            targetCadence: capability.targetCadence ?? undefined,
          })
          const currentPersisted = current.status === 'AVAILABLE'
            && (current.cacheStatus === 'hit' || current.cacheStatus === 'miss')
          const item: ForecastProductionOperationItem = {
            targetSemantics,
            modelId,
            current: currentPersisted && current.status === 'AVAILABLE' ? readiness(current.cacheStatus) : 'FAILED',
            historical: 'NOT_REQUESTED',
            currentCacheStatus: current.status === 'AVAILABLE' ? current.cacheStatus : null,
            historicalCacheStatus: null,
            error: current.status === 'AVAILABLE' ? null : current.reason,
          }
          results.push(item)
        }
      }

      if (prepareHistorical) {
        for (const item of results.filter((candidate) => candidate.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME')) {
          if (item.current === 'FAILED') {
            item.historical = 'FAILED'
            continue
          }

          const targetBasis = TARGET_BASIS_BY_SEMANTICS[item.targetSemantics as keyof typeof TARGET_BASIS_BY_SEMANTICS]
          const capability = before.capabilities.find((candidate) => (
            candidate.identity.targetSemantics === item.targetSemantics
            && candidate.identity.modelId === item.modelId
          ))
          const historical = await resolvedDependencies.prepareMonthlyHistorical({
            seriesId: request.seriesId,
            modelId: item.modelId,
            targetBasis,
            sourceFrequency: capability?.sourceFrequency ?? undefined,
            targetCadence: capability?.targetCadence ?? undefined,
          })
          const historicalPersisted = historical.status === 'AVAILABLE'
            && (historical.cacheStatus === 'hit' || historical.cacheStatus === 'miss')
          item.historical = historicalPersisted && historical.status === 'AVAILABLE'
            ? readiness(historical.cacheStatus)
            : 'FAILED'
          item.historicalCacheStatus = historical.status === 'AVAILABLE' ? historical.cacheStatus : null
          if (historical.status !== 'AVAILABLE') item.error = historical.reason
        }
      }

      if (requestedTargets.includes('ROLLING_DAILY_POINT_IN_TIME')) {
        const rolling = await resolvedDependencies.runRollingDaily({
          seriesId: request.seriesId,
          modelIds: requestedModels,
        })
        for (const modelId of requestedModels) {
          const item = rolling.results.find((candidate) => candidate.modelId === modelId)
          const succeeded = item && !['FAILED', 'REBUILD_REQUIRED'].includes(item.status)
          results.push({
            targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
            modelId,
            current: succeeded ? (item.status === 'NO_OP' ? 'REUSED' : 'READY') : 'FAILED',
            historical: prepareHistorical
              ? succeeded ? (item.status === 'NO_OP' ? 'REUSED' : 'READY') : 'FAILED'
              : 'NOT_REQUESTED',
            currentCacheStatus: item?.snapshot.status ?? null,
            historicalCacheStatus: item?.maintenance?.status ?? null,
            error: item?.error ?? null,
          })
        }
      }

      const after = await resolvedDependencies.resolveCapabilities(request.seriesId)
      const failed = results.filter((item) => item.current === 'FAILED' || item.historical === 'FAILED').length
      const status: ForecastProductionOperationsResult['status'] = failed === 0
        ? 'SUCCEEDED'
        : failed === results.length
          ? 'FAILED'
          : 'PARTIAL'

      return {
        status,
        seriesId: request.seriesId,
        requestedTargets,
        requestedModels,
        prepareHistorical,
        before,
        after,
        results,
      }
    },
  }
}