import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
  type ExactForecastCapabilityTrace,
  resolveExactForecastCapability,
  type ForecastVariantCapability,
} from '@/lib/forecast/capability-resolver'
import { USER_FACING_FORECAST_MODELS } from '@/lib/forecast/contracts'
import {
  FORECAST_TARGET_SEMANTICS,
  type ForecastTargetSemantics,
} from '@/lib/forecast/identity'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { prepareRollingDailyCurrentOwnership } from '@/lib/forecast/rolling-daily-current-ownership'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import {
  createDefaultForecastPreparationExecutionAdmission,
  type ForecastPreparationExecutionAdmission,
} from '@/lib/forecast/execution-ledger'
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
  targetCadence: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  lawfulTargetSemantics: ForecastVariantCapability['semanticLawfulness'] | null
  status: ForecastVariantCapability['capabilityState'] | 'FAILED'
  currentReadiness: ForecastVariantCapability['currentPreparedState'] | 'NOT_PREPARED'
  verificationReadiness: ForecastVariantCapability['historicalPreparedState'] | 'NOT_PREPARED'
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
  trace?: ExactForecastCapabilityTrace
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
  prepareRollingCurrent: ReturnType<typeof createRollingDailyProductionOperationsService>['runCurrentOnly']
  prepareRollingDailyOwnership: typeof prepareRollingDailyCurrentOwnership
  readRollingCurrentSnapshot: typeof readRollingDailyCurrentForecastSnapshot
  executionAdmission: ForecastPreparationExecutionAdmission
  now: () => number
}

const ROLLING_DAILY_STAGE3_WAITER_MULTIPLIER = 10
const ROLLING_DAILY_STAGE3_WAIT_BACKOFF_MS = [25, 50, 100, 200, 400] as const

function waitForRollingDailyBackoff(attempt: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal?.reason ?? new Error('The operation was aborted.'))
      return
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ROLLING_DAILY_STAGE3_WAIT_BACKOFF_MS[Math.min(attempt, ROLLING_DAILY_STAGE3_WAIT_BACKOFF_MS.length - 1)])

    const onAbort = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      reject(signal?.reason ?? new Error('The operation was aborted.'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
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

function formatInteractiveCapabilityReason(capability: ForecastVariantCapability | null, fallback: string | null = null) {
  if (!capability) {
    return fallback
  }

  if (
    capability.historyEligibility === 'INSUFFICIENT_HISTORY'
    && capability.targetCadence === 'MONTHLY'
    && capability.identity.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME'
  ) {
    return `INSUFFICIENT_CONTIGUOUS_HISTORY: availableContiguousObservations=${capability.availableObservations}; requiredObservations=${capability.minimumRequiredObservations}.`
  }

  return fallback
}

export function createInteractiveForecastPreparationService(
  dependencies: Partial<InteractiveForecastPreparationDependencies> = {},
) {
  const rollingDaily = createRollingDailyProductionOperationsService()
  const resolvedDependencies: InteractiveForecastPreparationDependencies = {
    resolveExactCapability: dependencies.resolveExactCapability ?? resolveExactForecastCapability,
    prepareMonthlyCurrent: dependencies.prepareMonthlyCurrent ?? resolveBenchmarkCurrentForecast,
    prepareRollingCurrent: dependencies.prepareRollingCurrent ?? ((request) => rollingDaily.runCurrentOnly(request)),
    prepareRollingDailyOwnership: dependencies.prepareRollingDailyOwnership ?? prepareRollingDailyCurrentOwnership,
    readRollingCurrentSnapshot: dependencies.readRollingCurrentSnapshot ?? readRollingDailyCurrentForecastSnapshot,
    executionAdmission: dependencies.executionAdmission ?? createDefaultForecastPreparationExecutionAdmission(),
    now: dependencies.now ?? (() => performance.now()),
  }

  async function resolveExact(input: InteractiveForecastIdentity) {
    const exact = await resolvedDependencies.resolveExactCapability(input)
    return {
      resolution: exact.resolution,
      capability: exact.capability ?? findExactCapability(exact.resolution, input),
      trace: exact.trace,
    }
  }

  return {
    async capability(input: InteractiveForecastIdentity): Promise<InteractiveForecastCapabilityResult> {
      const startedAt = resolvedDependencies.now()
      const { resolution, capability, trace } = await resolveExact(input)
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
        targetCadence: capability?.targetCadence ?? null,
        sourceAvailability,
        lawfulTargetSemantics: capability?.semanticLawfulness ?? null,
        status: capability?.capabilityState ?? 'FAILED',
        currentReadiness: capability?.currentPreparedState ?? 'NOT_PREPARED',
        verificationReadiness: capability?.historicalPreparedState ?? 'NOT_PREPARED',
        targetedDataScope: 'SINGLE_SERIES',
        timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
        reason: formatInteractiveCapabilityReason(capability, resolution.reason ?? (capability ? null : 'Exact Forecast capability was not resolved.')),
        trace,
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
          reason: formatInteractiveCapabilityReason(capability, capability.capabilityState),
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
        const ownership = await resolvedDependencies.prepareRollingDailyOwnership({
          seriesId: input.seriesId,
          modelId: input.modelId,
        })
        const requestId = randomUUID()
        const waitDeadline = Date.now() + (resolvedDependencies.executionAdmission.leaseDurationMs * ROLLING_DAILY_STAGE3_WAITER_MULTIPLIER)
        const readPreparedSnapshot = () => resolvedDependencies.readRollingCurrentSnapshot({
          seriesId: input.seriesId,
          modelId: input.modelId,
          sourceHistoryFingerprint: ownership.identity.historyFingerprint,
        })

        while (true) {
          const admission = await resolvedDependencies.executionAdmission.acquireExecution({
            operationFamily: 'CURRENT',
            logicalArtifactKey: ownership.logicalArtifactKey,
            logicalArtifactIdentity: ownership.identity,
            requestId,
            ownerRequestId: requestId,
          })

          if (admission.role === 'WAITER') {
            let attempt = 0

            while (Date.now() <= waitDeadline) {
              const snapshot = await readPreparedSnapshot()
              if (snapshot.status === 'HIT') {
                return {
                  ...base,
                  status: 'REUSED',
                  timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
                  reason: null,
                }
              }

              const latestExecution = await resolvedDependencies.executionAdmission.readLatestExecutionForLogicalArtifact(ownership.logicalArtifactKey)
              if (!latestExecution) {
                break
              }
              if (latestExecution.executionStatus === 'FAILED') {
                return {
                  ...base,
                  status: 'FAILED',
                  timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
                  reason: latestExecution.failureReason ?? 'Rolling Daily authoritative execution failed before producing a prepared snapshot.',
                }
              }
              if (latestExecution.executionStatus === 'COMPLETED') {
                const completedSnapshot = await readPreparedSnapshot()
                if (completedSnapshot.status === 'HIT') {
                  return {
                    ...base,
                    status: 'REUSED',
                    timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
                    reason: null,
                  }
                }

                throw new Error(`Rolling Daily execution completed without an exact prepared snapshot for ${ownership.logicalArtifactKey}.`)
              }

              if (new Date(latestExecution.leaseExpiresAt).getTime() <= Date.now()) {
                break
              }

              await waitForRollingDailyBackoff(attempt)
              attempt += 1
            }

            if (Date.now() > waitDeadline) {
              throw new Error(`Timed out waiting for the authoritative Rolling Daily Current execution for ${ownership.logicalArtifactKey}.`)
            }

            continue
          }

          const snapshotBeforeCompute = await readPreparedSnapshot()
          if (snapshotBeforeCompute.status === 'HIT') {
            await resolvedDependencies.executionAdmission.markExecutionCompleted({
              executionId: admission.ownership.executionId,
              logicalArtifactKey: ownership.logicalArtifactKey,
              ownerToken: admission.ownership.ownerToken,
              leaseVersion: admission.ownership.leaseVersion,
              requestId,
              ownerRequestId: admission.ownership.ownerRequestId,
              resultStatus: 'AVAILABLE',
              cacheStatus: 'hit',
            })

            return {
              ...base,
              status: 'REUSED',
              timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
              reason: null,
            }
          }

          const result = await resolvedDependencies.prepareRollingCurrent({
            seriesId: input.seriesId,
            modelIds: [input.modelId],
            preparedHistory: ownership.history,
          })
          const modelResult = result.results.find((candidate) => candidate.modelId === input.modelId)
          const failed = result.status === 'FAILED'
            || !modelResult
            || modelResult.status === 'FAILED'
            || modelResult.status === 'REBUILD_REQUIRED'

          if (failed) {
            await resolvedDependencies.executionAdmission.markExecutionFailed({
              executionId: admission.ownership.executionId,
              logicalArtifactKey: ownership.logicalArtifactKey,
              ownerToken: admission.ownership.ownerToken,
              leaseVersion: admission.ownership.leaseVersion,
              requestId,
              ownerRequestId: admission.ownership.ownerRequestId,
              failurePhase: 'COMPUTE',
              failureReason: modelResult?.error ?? 'Rolling Daily production operations did not produce a prepared artifact.',
              resultStatus: modelResult?.status ?? 'FAILED',
              cacheStatus: 'miss',
            })

            return {
              ...base,
              status: 'FAILED',
              timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
              reason: modelResult?.error ?? 'Rolling Daily production operations did not produce a prepared artifact.',
            }
          }

          const snapshotAfterCompute = await readPreparedSnapshot()
          if (snapshotAfterCompute.status !== 'HIT') {
            await resolvedDependencies.executionAdmission.markExecutionFailed({
              executionId: admission.ownership.executionId,
              logicalArtifactKey: ownership.logicalArtifactKey,
              ownerToken: admission.ownership.ownerToken,
              leaseVersion: admission.ownership.leaseVersion,
              requestId,
              ownerRequestId: admission.ownership.ownerRequestId,
              failurePhase: 'PERSISTENCE',
              failureReason: `Rolling Daily production operations completed without persisting the exact prepared snapshot for ${ownership.logicalArtifactKey}.`,
              resultStatus: modelResult.status,
              cacheStatus: 'miss',
            })
            return {
              ...base,
              status: 'FAILED',
              timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
              reason: `Rolling Daily production operations completed without persisting the exact prepared snapshot for ${ownership.logicalArtifactKey}.`,
            }
          }

          await resolvedDependencies.executionAdmission.markExecutionCompleted({
            executionId: admission.ownership.executionId,
            logicalArtifactKey: ownership.logicalArtifactKey,
            ownerToken: admission.ownership.ownerToken,
            leaseVersion: admission.ownership.leaseVersion,
            requestId,
            ownerRequestId: admission.ownership.ownerRequestId,
            resultStatus: 'AVAILABLE',
            cacheStatus: modelResult.status === 'NO_OP' ? 'hit' : 'miss',
          })

          return {
            ...base,
            status: modelResult.status === 'NO_OP' ? 'REUSED' : 'READY',
            timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
            reason: null,
          }
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