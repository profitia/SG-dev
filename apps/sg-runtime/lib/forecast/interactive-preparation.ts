import { z } from 'zod'

import {
  resolveExactForecastCapability,
  type ForecastVariantCapability,
} from '@/lib/forecast/capability-resolver'
import { USER_FACING_FORECAST_MODELS } from '@/lib/forecast/contracts'
import {
  FORECAST_TARGET_SEMANTICS,
  type ForecastTargetSemantics,
} from '@/lib/forecast/identity'
import { persistRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { resolveBenchmarkCurrentForecast } from '@/lib/forecast/service'

export const InteractiveForecastIdentitySchema = z.object({
  seriesId: z.string().trim().min(1).refine((seriesId) => seriesId !== '*', 'A concrete seriesId is required.'),
  targetSemantics: z.enum(FORECAST_TARGET_SEMANTICS),
  modelId: z.enum(USER_FACING_FORECAST_MODELS),
}).strict()

export type InteractiveForecastIdentity = z.infer<typeof InteractiveForecastIdentitySchema>

export type InteractiveForecastOperationStatus =
  | 'READY'
  | 'REUSED'
  | 'DATA_NOT_AVAILABLE'
  | 'INSUFFICIENT_HISTORY'
  | 'NOT_LAWFUL'
  | 'PROVENANCE_REQUIRED'
  | 'NOT_IMPLEMENTED'
  | 'PREPARATION_REQUIRED'
  | 'FAILED'

export type InteractiveForecastCapabilityResult = {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  modelId: InteractiveForecastIdentity['modelId']
  sourceFrequency: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  lawfulTargetSemantics: ForecastVariantCapability['semanticLawfulness'] | null
  status: ForecastVariantCapability['capabilityState'] | 'FAILED'
  currentReadiness: ForecastVariantCapability['currentPreparedState'] | 'NOT_PREPARED'
  verificationReadiness: ForecastVariantCapability['historicalPreparedState'] | 'NOT_PREPARED'
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
}

export type InteractiveForecastPreparationResult = {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  modelId: InteractiveForecastIdentity['modelId']
  operation: 'CURRENT_FORECAST'
  status: InteractiveForecastOperationStatus
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
}

type InteractiveForecastPreparationDependencies = {
  resolveExactCapability: typeof resolveExactForecastCapability
  prepareMonthlyCurrent: typeof resolveBenchmarkCurrentForecast
  prepareRollingCurrent: typeof persistRollingDailyCurrentForecastSnapshot
  now: () => number
}

const TARGET_BASIS_BY_SEMANTICS = {
  END_OF_PERIOD: 'END_OF_PERIOD',
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
  ROLLING_DAILY_POINT_IN_TIME: 'POINT_IN_TIME',
} as const

function findExactCapability(
  resolution: { capabilities: ForecastVariantCapability[] },
  input: InteractiveForecastIdentity,
) {
  return resolution.capabilities.find((candidate) => (
    candidate.identity.seriesId === input.seriesId
    && candidate.identity.targetSemantics === input.targetSemantics
    && candidate.identity.modelId === input.modelId
  )) ?? null
}

function blockedPreparationStatus(capability: ForecastVariantCapability): InteractiveForecastOperationStatus | null {
  if (capability.admissionState !== 'ADMITTED') return capability.admissionState
  if (capability.implementationState !== 'SUPPORTED') return 'NOT_IMPLEMENTED'
  if (capability.historyEligibility !== 'ELIGIBLE') return capability.historyEligibility
  if (capability.targetPreparationState !== 'PREPARED') return 'PREPARATION_REQUIRED'
  return null
}

export function createInteractiveForecastPreparationService(
  dependencies: Partial<InteractiveForecastPreparationDependencies> = {},
) {
  const resolvedDependencies: InteractiveForecastPreparationDependencies = {
    resolveExactCapability: dependencies.resolveExactCapability ?? resolveExactForecastCapability,
    prepareMonthlyCurrent: dependencies.prepareMonthlyCurrent ?? resolveBenchmarkCurrentForecast,
    prepareRollingCurrent: dependencies.prepareRollingCurrent ?? persistRollingDailyCurrentForecastSnapshot,
    now: dependencies.now ?? (() => performance.now()),
  }

  async function resolveExact(input: InteractiveForecastIdentity) {
    const exact = await resolvedDependencies.resolveExactCapability(input)
    return { resolution: exact.resolution, capability: exact.capability ?? findExactCapability(exact.resolution, input) }
  }

  return {
    async capability(input: InteractiveForecastIdentity): Promise<InteractiveForecastCapabilityResult> {
      const startedAt = resolvedDependencies.now()
      const { resolution, capability } = await resolveExact(input)
      const sourceAvailability = resolution.status !== 'AVAILABLE'
        ? 'FAILED'
        : resolution.sourceMetadata.sourceObservationCount === 0
          ? 'DATA_NOT_AVAILABLE'
          : 'AVAILABLE'

      return {
        seriesId: input.seriesId,
        targetSemantics: input.targetSemantics,
        modelId: input.modelId,
        sourceFrequency: resolution.sourceMetadata.sourceFrequency,
        sourceAvailability,
        lawfulTargetSemantics: capability?.semanticLawfulness ?? null,
        status: capability?.capabilityState ?? 'FAILED',
        currentReadiness: capability?.currentPreparedState ?? 'NOT_PREPARED',
        verificationReadiness: capability?.historicalPreparedState ?? 'NOT_PREPARED',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
        reason: resolution.reason ?? (capability ? null : 'Exact Forecast capability was not resolved.'),
      }
    },

    async prepareCurrent(input: InteractiveForecastIdentity): Promise<InteractiveForecastPreparationResult> {
      const startedAt = resolvedDependencies.now()
      const { resolution, capability } = await resolveExact(input)
      const base = {
        ...input,
        operation: 'CURRENT_FORECAST' as const,
        targetedDataScope: 'SINGLE_SERIES' as const,
      }

      if (!capability) {
        return {
          ...base,
          status: 'FAILED',
          timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
          reason: resolution.reason ?? 'Exact Forecast capability was not resolved.',
        }
      }

      const blocked = blockedPreparationStatus(capability)
      if (blocked) {
        return {
          ...base,
          status: blocked,
          timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
          reason: capability.capabilityState,
        }
      }

      if (capability.currentPreparedState === 'READY') {
        return {
          ...base,
          status: 'REUSED',
          timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
          reason: null,
        }
      }

      if (input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
        const result = await resolvedDependencies.prepareRollingCurrent({
          seriesId: input.seriesId,
          modelId: input.modelId,
        })

        return {
          ...base,
          status: result.status === 'AVAILABLE' ? 'READY' : 'FAILED',
          timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
          reason: result.reasonCode,
        }
      }

      const cadenceContext = capability.sourceFrequency && capability.targetCadence
        ? {
            sourceFrequency: capability.sourceFrequency,
            targetCadence: capability.targetCadence,
          }
        : {}

      const result = await resolvedDependencies.prepareMonthlyCurrent({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: TARGET_BASIS_BY_SEMANTICS[input.targetSemantics],
        ...cadenceContext,
      })
      const persisted = result.status === 'AVAILABLE' && (result.cacheStatus === 'hit' || result.cacheStatus === 'miss')

      return {
        ...base,
        status: persisted ? (result.cacheStatus === 'hit' ? 'REUSED' : 'READY') : 'FAILED',
        timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
        reason: result.status === 'AVAILABLE'
          ? (persisted ? null : `Persistence status: ${result.cacheStatus}`)
          : result.reason,
      }
    },
  }
}

const interactiveForecastPreparationService = createInteractiveForecastPreparationService()

export const resolveInteractiveForecastCapability = interactiveForecastPreparationService.capability
export const prepareInteractiveCurrentForecast = interactiveForecastPreparationService.prepareCurrent