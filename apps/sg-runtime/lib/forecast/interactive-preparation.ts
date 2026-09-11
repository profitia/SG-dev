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
import { normalizeForecastSourceFrequency } from '@/lib/forecast/cadence'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { prepareRollingDailyCurrentOwnership } from '@/lib/forecast/rolling-daily-current-ownership'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import {
  createDefaultForecastPreparationExecutionAdmission,
  type ForecastPreparationExecutionAdmission,
  type ForecastPreparationOwnedExecutionContext,
} from '@/lib/forecast/execution-ledger'
import {
  type ForecastPersistenceOwnership,
  readPreparedBenchmarkForecastVerification,
  readPreparedBenchmarkRecentForecastVerification,
  resolveBenchmarkCurrentForecast,
  type ForecastServiceRequest,
} from '@/lib/forecast/service'
import {
  type BenchmarkForecastVerificationResult,
  type ForecastTargetBasis,
} from '@/lib/forecast/contracts'
import {
  resolveForecastStage3HeartbeatIntervalMs,
  startForecastExecutionLeaseHeartbeat,
} from '@/lib/forecast/stage3-lease-heartbeat'

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
  recentVerificationReadiness: ForecastVariantCapability['historicalPreparedState'] | 'NOT_PREPARED'
  fullVerificationReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  predictionBandResidualCount: number
  predictionBandState: ForecastVariantCapability['predictionBandState']
  readiness: {
    fastReady: boolean
    calibratedReady: boolean
    fullReady: boolean
    blockers: InteractiveForecastReadinessBlocker[]
  }
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
  trace?: ExactForecastCapabilityTrace
}

export type InteractiveForecastReadinessBlocker =
  | 'CURRENT_MISSING'
  | 'CURRENT_STALE'
  | 'RECENT_MISSING'
  | 'RECENT_PARTIAL'
  | 'RECENT_STALE'
  | 'FULL_HISTORICAL_MISSING'
  | 'FULL_HISTORICAL_PARTIAL'
  | 'FULL_HISTORICAL_STALE'
  | 'CALIBRATION_INSUFFICIENT_SAMPLES'
  | 'BANDS_NOT_AVAILABLE'
  | 'SOURCE_REVISION_REBUILD_REQUIRED'
  | 'DATA_NOT_AVAILABLE'
  | 'INSUFFICIENT_HISTORY'
  | 'PROVENANCE_REQUIRED'
  | 'NOT_IMPLEMENTED'
  | 'NOT_LAWFUL'

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
  readPreparedFullVerification: typeof readPreparedBenchmarkForecastVerification
  readPreparedRecentVerification: typeof readPreparedBenchmarkRecentForecastVerification
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

function targetBasisForSemantics(targetSemantics: ForecastTargetSemantics): ForecastTargetBasis {
  return TARGET_BASIS_BY_SEMANTICS[targetSemantics]
}

function buildPreparedReadRequest(
  input: InteractiveForecastIdentity,
  sourceFrequency: InteractiveForecastCapabilityResult['sourceFrequency'],
  targetCadence: InteractiveForecastCapabilityResult['targetCadence'],
): ForecastServiceRequest {
  const normalizedSourceFrequency = normalizeForecastSourceFrequency(sourceFrequency)
  const normalizedTargetCadence = normalizeForecastSourceFrequency(targetCadence)

  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: targetBasisForSemantics(input.targetSemantics),
    ...(normalizedSourceFrequency ? { sourceFrequency: normalizedSourceFrequency } : {}),
    ...(normalizedTargetCadence ? { targetCadence: normalizedTargetCadence } : {}),
  }
}

function isPreparedVerificationAvailable(result: BenchmarkForecastVerificationResult) {
  return result.status === 'AVAILABLE'
}

function normalizeVerificationReadiness(input: {
  result: BenchmarkForecastVerificationResult
  missing: InteractiveForecastReadinessBlocker
  partial: InteractiveForecastReadinessBlocker
  stale: InteractiveForecastReadinessBlocker
}): {
  readiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  blockers: InteractiveForecastReadinessBlocker[]
} {
  if (isPreparedVerificationAvailable(input.result)) {
    return { readiness: 'READY', blockers: [] }
  }

  if (input.result.status === 'FAILED') {
    return {
      readiness: 'STALE',
      blockers: [input.stale, 'SOURCE_REVISION_REBUILD_REQUIRED'],
    }
  }

  const reason = input.result.reason?.toUpperCase() ?? ''
  if (reason.includes('NO EXACT-IDENTITY PREPARED')) {
    return { readiness: 'NOT_PREPARED', blockers: [input.missing] }
  }

  if (reason.includes('NOT RENDERABLE') || reason.includes('PARTIAL')) {
    return { readiness: 'NOT_PREPARED', blockers: [input.partial] }
  }

  if (reason.includes('NOT COMPATIBLE') || reason.includes('FINGERPRINT')) {
    return {
      readiness: 'STALE',
      blockers: [input.stale, 'SOURCE_REVISION_REBUILD_REQUIRED'],
    }
  }

  return { readiness: 'NOT_PREPARED', blockers: [input.missing] }
}

async function resolveInteractiveForecastReadiness(
  dependencies: Pick<InteractiveForecastPreparationDependencies, 'readPreparedFullVerification' | 'readPreparedRecentVerification'>,
  input: InteractiveForecastIdentity,
  capability: ForecastVariantCapability | null,
  sourceFrequency: InteractiveForecastCapabilityResult['sourceFrequency'],
): Promise<Pick<InteractiveForecastCapabilityResult, 'recentVerificationReadiness' | 'fullVerificationReadiness' | 'predictionBandResidualCount' | 'predictionBandState' | 'readiness'>> {
  const blockers = new Set<InteractiveForecastReadinessBlocker>()
  const addBlockers = (next: InteractiveForecastReadinessBlocker[]) => {
    for (const blocker of next) blockers.add(blocker)
  }

  if (!capability) {
    addBlockers(['CURRENT_MISSING'])
    return {
      recentVerificationReadiness: 'NOT_PREPARED',
      fullVerificationReadiness: 'NOT_PREPARED',
      predictionBandResidualCount: 0,
      predictionBandState: 'NOT_AVAILABLE',
      readiness: {
        fastReady: false,
        calibratedReady: false,
        fullReady: false,
        blockers: [...blockers],
      },
    }
  }

  if (capability.capabilityState === 'NOT_LAWFUL') addBlockers(['NOT_LAWFUL'])
  if (capability.capabilityState === 'PROVENANCE_REQUIRED') addBlockers(['PROVENANCE_REQUIRED'])
  if (capability.capabilityState === 'NOT_IMPLEMENTED') addBlockers(['NOT_IMPLEMENTED'])
  if (capability.capabilityState === 'DATA_NOT_AVAILABLE') addBlockers(['DATA_NOT_AVAILABLE'])
  if (capability.capabilityState === 'INSUFFICIENT_HISTORY') addBlockers(['INSUFFICIENT_HISTORY'])

  if (capability.currentPreparedState === 'STALE') {
    addBlockers(['CURRENT_STALE', 'SOURCE_REVISION_REBUILD_REQUIRED'])
  } else if (capability.currentPreparedState !== 'READY') {
    addBlockers(['CURRENT_MISSING'])
  }

  let recentVerificationReadiness: InteractiveForecastCapabilityResult['recentVerificationReadiness'] = capability.historicalPreparedState
  let fullVerificationReadiness: InteractiveForecastCapabilityResult['fullVerificationReadiness'] = 'NOT_PREPARED'

  if (capability.currentPreparedState === 'READY' && capability.capabilityState !== 'NOT_LAWFUL' && capability.capabilityState !== 'NOT_IMPLEMENTED') {
    const request = buildPreparedReadRequest(input, sourceFrequency, capability.targetCadence)
    const [recentVerification, fullVerification] = await Promise.all([
      dependencies.readPreparedRecentVerification(request),
      dependencies.readPreparedFullVerification(request),
    ])
    const normalizedRecent = normalizeVerificationReadiness({
      result: recentVerification,
      missing: 'RECENT_MISSING',
      partial: 'RECENT_PARTIAL',
      stale: 'RECENT_STALE',
    })
    const normalizedFull = normalizeVerificationReadiness({
      result: fullVerification,
      missing: 'FULL_HISTORICAL_MISSING',
      partial: 'FULL_HISTORICAL_PARTIAL',
      stale: 'FULL_HISTORICAL_STALE',
    })
    recentVerificationReadiness = normalizedRecent.readiness
    fullVerificationReadiness = normalizedFull.readiness
    addBlockers(normalizedRecent.blockers)
    addBlockers(normalizedFull.blockers)
  }

  const fastReady = capability.currentPreparedState === 'READY' && recentVerificationReadiness === 'READY'
  const calibratedReady = fastReady && capability.predictionBandState === 'AVAILABLE'
  const fullReady = capability.currentPreparedState === 'READY' && fullVerificationReadiness === 'READY'

  if (!calibratedReady) {
    if (capability.predictionBandState === 'INSUFFICIENT_SAMPLE') {
      addBlockers(['CALIBRATION_INSUFFICIENT_SAMPLES'])
    } else if (capability.predictionBandState === 'NOT_AVAILABLE') {
      addBlockers(['BANDS_NOT_AVAILABLE'])
    }
  }

  return {
    recentVerificationReadiness,
    fullVerificationReadiness,
    predictionBandResidualCount: capability.predictionBandResidualCount,
    predictionBandState: capability.predictionBandState,
    readiness: {
      fastReady,
      calibratedReady,
      fullReady,
      blockers: [...blockers],
    },
  }
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
    readPreparedFullVerification: dependencies.readPreparedFullVerification ?? readPreparedBenchmarkForecastVerification,
    readPreparedRecentVerification: dependencies.readPreparedRecentVerification ?? readPreparedBenchmarkRecentForecastVerification,
    executionAdmission: dependencies.executionAdmission ?? createDefaultForecastPreparationExecutionAdmission(),
    now: dependencies.now ?? (() => performance.now()),
  }

  const buildRollingDailyPersistenceOwnership = (
    logicalArtifactKey: string,
    ownership: ForecastPreparationOwnedExecutionContext,
  ): ForecastPersistenceOwnership => ({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    executionId: ownership.executionId,
    ownerToken: ownership.ownerToken,
    leaseVersion: ownership.leaseVersion,
    requestId: ownership.requestId,
    ownerRequestId: ownership.ownerRequestId,
    role: ownership.role,
  })

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
      const readiness = await resolveInteractiveForecastReadiness(
        {
          readPreparedFullVerification: resolvedDependencies.readPreparedFullVerification,
          readPreparedRecentVerification: resolvedDependencies.readPreparedRecentVerification,
        },
        input,
        capability,
        resolution.sourceMetadata.sourceFrequency,
      )

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
        recentVerificationReadiness: readiness.recentVerificationReadiness,
        fullVerificationReadiness: readiness.fullVerificationReadiness,
        predictionBandResidualCount: readiness.predictionBandResidualCount,
        predictionBandState: readiness.predictionBandState,
        readiness: readiness.readiness,
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
        const rollingDailyStage3HeartbeatIntervalMs = resolveForecastStage3HeartbeatIntervalMs(
          resolvedDependencies.executionAdmission.leaseDurationMs,
        )
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

          let currentOwnership = admission.ownership
          const heartbeat = startForecastExecutionLeaseHeartbeat({
            executionAdmission: resolvedDependencies.executionAdmission,
            logicalArtifactKey: ownership.logicalArtifactKey,
            ownership: currentOwnership,
            requestId,
            heartbeatIntervalMs: rollingDailyStage3HeartbeatIntervalMs,
          })
          let failurePhase: 'COMPUTE' | 'PERSISTENCE' | 'FINALIZATION' = 'COMPUTE'

          try {
            const snapshotBeforeCompute = await readPreparedSnapshot()
            if (snapshotBeforeCompute.status === 'HIT') {
              currentOwnership = heartbeat.getOwnership()
              await resolvedDependencies.executionAdmission.markExecutionCompleted({
                executionId: currentOwnership.executionId,
                logicalArtifactKey: ownership.logicalArtifactKey,
                ownerToken: currentOwnership.ownerToken,
                leaseVersion: currentOwnership.leaseVersion,
                requestId,
                ownerRequestId: currentOwnership.ownerRequestId,
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
              resolvePersistenceOwnership: async () => {
                heartbeat.assertActive()
                currentOwnership = await heartbeat.renewNow()
                return buildRollingDailyPersistenceOwnership(ownership.logicalArtifactKey, currentOwnership)
              },
            })
            const modelResult = result.results.find((candidate) => candidate.modelId === input.modelId)
            const failed = result.status === 'FAILED'
              || !modelResult
              || modelResult.status === 'FAILED'
              || modelResult.status === 'REBUILD_REQUIRED'

            if (failed) {
              heartbeat.assertActive()
              currentOwnership = heartbeat.getOwnership()
              await resolvedDependencies.executionAdmission.markExecutionFailed({
                executionId: currentOwnership.executionId,
                logicalArtifactKey: ownership.logicalArtifactKey,
                ownerToken: currentOwnership.ownerToken,
                leaseVersion: currentOwnership.leaseVersion,
                requestId,
                ownerRequestId: currentOwnership.ownerRequestId,
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
              failurePhase = 'PERSISTENCE'
              heartbeat.assertActive()
              currentOwnership = heartbeat.getOwnership()
              await resolvedDependencies.executionAdmission.markExecutionFailed({
                executionId: currentOwnership.executionId,
                logicalArtifactKey: ownership.logicalArtifactKey,
                ownerToken: currentOwnership.ownerToken,
                leaseVersion: currentOwnership.leaseVersion,
                requestId,
                ownerRequestId: currentOwnership.ownerRequestId,
                failurePhase,
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

            failurePhase = 'FINALIZATION'
            heartbeat.assertActive()
            currentOwnership = heartbeat.getOwnership()
            await resolvedDependencies.executionAdmission.markExecutionCompleted({
              executionId: currentOwnership.executionId,
              logicalArtifactKey: ownership.logicalArtifactKey,
              ownerToken: currentOwnership.ownerToken,
              leaseVersion: currentOwnership.leaseVersion,
              requestId,
              ownerRequestId: currentOwnership.ownerRequestId,
              resultStatus: 'AVAILABLE',
              cacheStatus: modelResult.status === 'NO_OP' ? 'hit' : 'miss',
            })

            return {
              ...base,
              status: modelResult.status === 'NO_OP' ? 'REUSED' : 'READY',
              timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
              reason: null,
            }
          } catch (error) {
            try {
              heartbeat.assertActive()
              currentOwnership = heartbeat.getOwnership()
              await resolvedDependencies.executionAdmission.markExecutionFailed({
                executionId: currentOwnership.executionId,
                logicalArtifactKey: ownership.logicalArtifactKey,
                ownerToken: currentOwnership.ownerToken,
                leaseVersion: currentOwnership.leaseVersion,
                requestId,
                ownerRequestId: currentOwnership.ownerRequestId,
                failurePhase,
                failureReason: error instanceof Error ? error.message : 'unknown',
                resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
              })
            } catch {
              // Preserve the original failure as the surfaced error.
            }

            throw error
          } finally {
            await heartbeat.stop()
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