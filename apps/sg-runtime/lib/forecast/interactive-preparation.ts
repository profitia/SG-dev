import { z } from 'zod'

import {
  type ExactForecastCapabilityTrace,
  type ForecastCapabilityResolution,
  resolveExactForecastCapability,
  resolveForecastCapabilitiesBySeriesId,
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
  readPreparedRollingDailyFastForecastVerification,
  readPreparedRollingDailyForecastVerification,
  readPreparedRollingDailyRecentForecastVerification,
} from '@/lib/forecast/rolling-daily-verification'
import {
  type ForecastPersistenceOwnership,
  readPreparedBenchmarkFastForecastVerification,
  readPreparedBenchmarkForecastVerification,
  readPreparedBenchmarkCurrentForecast,
  readPreparedBenchmarkRecentForecastVerification,
  resolveBenchmarkCurrentForecast,
  type ForecastServiceRequest,
} from '@/lib/forecast/service'
import {
  type BenchmarkForecastVerificationResult,
  type ForecastTargetBasis,
} from '@/lib/forecast/contracts'
import type { ForecastRequestInput } from '@/lib/forecast/request-contract'
import {
  resolveForecastStage3HeartbeatIntervalMs,
  startForecastExecutionLeaseHeartbeat,
} from '@/lib/forecast/stage3-lease-heartbeat'
import { resolveForecastOperationRequestId } from '@/lib/forecast/request-diagnostics'

export const InteractiveForecastIdentitySchema = z.object({
  seriesId: z.string().trim().min(1).refine((seriesId) => seriesId !== '*', 'A concrete seriesId is required.'),
  targetSemantics: z.enum(FORECAST_TARGET_SEMANTICS),
  modelId: z.enum(USER_FACING_FORECAST_MODELS),
}).strict()

export type InteractiveForecastIdentity = z.infer<typeof InteractiveForecastIdentitySchema>

export const InteractiveForecastSeriesRequestSchema = z.object({
  seriesId: z.string().trim().min(1).refine((seriesId) => seriesId !== '*', 'A concrete seriesId is required.'),
}).strict()

export type InteractiveForecastSeriesRequest = z.infer<typeof InteractiveForecastSeriesRequestSchema>

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
  preparedReadAuthority: {
    sourceFrequency: string
    targetCadence: string
    expectedHistoryFingerprint: string
  } | null
  sourceFrequency: string | null
  targetCadence: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  lawfulTargetSemantics: ForecastVariantCapability['semanticLawfulness'] | null
  status: ForecastVariantCapability['capabilityState'] | 'FAILED'
  currentReadiness: ForecastVariantCapability['currentPreparedState'] | 'NOT_PREPARED'
  verificationReadiness: ForecastVariantCapability['historicalPreparedState'] | 'NOT_PREPARED'
  recentVerificationReadiness: ForecastVariantCapability['historicalPreparedState'] | 'NOT_PREPARED'
  fastVerificationReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  fullVerificationReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  predictionBandResidualCount: number
  predictionBandState: ForecastVariantCapability['predictionBandState']
  readiness: {
    fastReady: boolean
    bandsReady: boolean
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
  | 'FAST_VERIFICATION_MISSING'
  | 'FAST_VERIFICATION_PARTIAL'
  | 'FAST_VERIFICATION_STALE'
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

export type InteractiveForecastCapabilitySeriesSnapshot = {
  seriesId: string
  sourceFrequency: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  status: ForecastCapabilityResolution['status']
  reason: string | null
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  variants: InteractiveForecastCapabilityResult[]
}

type InteractiveForecastPreparationDependencies = {
  resolveExactCapability: typeof resolveExactForecastCapability
  resolveCapabilitiesBySeriesId: typeof resolveForecastCapabilitiesBySeriesId
  prepareMonthlyCurrent: typeof resolveBenchmarkCurrentForecast
  prepareRollingCurrent: ReturnType<typeof createRollingDailyProductionOperationsService>['runCurrentOnly']
  prepareRollingDailyOwnership: typeof prepareRollingDailyCurrentOwnership
  readRollingCurrentSnapshot: typeof readRollingDailyCurrentForecastSnapshot
  readPreparedFullVerification: typeof readPreparedBenchmarkForecastVerification
  readPreparedFastVerification: typeof readPreparedBenchmarkFastForecastVerification
  readPreparedCurrent: typeof readPreparedBenchmarkCurrentForecast
  readPreparedRollingDailyFullVerification: typeof readPreparedRollingDailyForecastVerification
  readPreparedRollingDailyFastVerification: typeof readPreparedRollingDailyFastForecastVerification
  readPreparedRecentVerification: (input: ForecastServiceRequest) => Promise<BenchmarkForecastVerificationResult>
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

function buildAllInteractiveForecastIdentities(seriesId: string): InteractiveForecastIdentity[] {
  return FORECAST_TARGET_SEMANTICS.flatMap((targetSemantics) => (
    USER_FACING_FORECAST_MODELS.map((modelId) => ({
      seriesId,
      targetSemantics,
      modelId,
    }))
  ))
}

function resolveInteractiveSourceAvailability(
  resolution: ForecastCapabilityResolution,
): InteractiveForecastCapabilityResult['sourceAvailability'] {
  if (resolution.status !== 'AVAILABLE') {
    return 'FAILED'
  }

  return resolution.sourceMetadata.sourceObservationCount === 0
    ? 'DATA_NOT_AVAILABLE'
    : 'AVAILABLE'
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

function buildPreparedReadAuthority(
  input: InteractiveForecastIdentity,
  capability: ForecastVariantCapability | null,
): ForecastServiceRequest['preparedReadAuthority'] {
  if (!capability?.preparedReadAuthority) {
    return undefined
  }

  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: targetBasisForSemantics(input.targetSemantics),
    sourceFrequency: capability.preparedReadAuthority.sourceFrequency,
    targetCadence: capability.preparedReadAuthority.targetCadence,
    expectedHistoryFingerprint: capability.preparedReadAuthority.expectedHistoryFingerprint,
  }
}

export function isPreparedVerificationAvailable(result: BenchmarkForecastVerificationResult) {
  if (result.status !== 'AVAILABLE') return false
  const status = result.historicalVerification?.status
  return status == null || status === 'AVAILABLE' || status === 'LIMITED_SAMPLE'
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

  if (input.result.status === 'AVAILABLE') {
    return { readiness: 'NOT_PREPARED', blockers: [input.partial] }
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

  if (reason.includes('INCOMPLETE FOR THE LATEST LAWFUL SOURCE OBSERVATION')) {
    return {
      readiness: 'STALE',
      blockers: [input.stale],
    }
  }

  if (reason.includes('NOT COMPATIBLE') || reason.includes('FINGERPRINT')) {
    return {
      readiness: 'STALE',
      blockers: [input.stale, 'SOURCE_REVISION_REBUILD_REQUIRED'],
    }
  }

  return { readiness: 'NOT_PREPARED', blockers: [input.missing] }
}

function resolvePreparedStateOnlyReadiness(
  capability: ForecastVariantCapability | null,
): Pick<InteractiveForecastCapabilityResult, 'recentVerificationReadiness' | 'fastVerificationReadiness' | 'fullVerificationReadiness' | 'predictionBandResidualCount' | 'predictionBandState' | 'readiness'> {
  const blockers = new Set<InteractiveForecastReadinessBlocker>()
  const add = (...next: InteractiveForecastReadinessBlocker[]) => {
    for (const blocker of next) blockers.add(blocker)
  }

  if (!capability) {
    add('CURRENT_MISSING', 'RECENT_MISSING', 'FAST_VERIFICATION_MISSING', 'FULL_HISTORICAL_MISSING')
    return {
      recentVerificationReadiness: 'NOT_PREPARED',
      fastVerificationReadiness: 'NOT_PREPARED',
      fullVerificationReadiness: 'NOT_PREPARED',
      predictionBandResidualCount: 0,
      predictionBandState: 'NOT_AVAILABLE',
      readiness: {
        fastReady: false,
        bandsReady: false,
        calibratedReady: false,
        fullReady: false,
        blockers: [...blockers],
      },
    }
  }

  if (capability.capabilityState === 'NOT_LAWFUL') add('NOT_LAWFUL')
  if (capability.capabilityState === 'PROVENANCE_REQUIRED') add('PROVENANCE_REQUIRED')
  if (capability.capabilityState === 'NOT_IMPLEMENTED') add('NOT_IMPLEMENTED')
  if (capability.capabilityState === 'DATA_NOT_AVAILABLE') add('DATA_NOT_AVAILABLE')
  if (capability.capabilityState === 'INSUFFICIENT_HISTORY') add('INSUFFICIENT_HISTORY')

  if (capability.currentPreparedState === 'STALE') {
    add('CURRENT_STALE', 'SOURCE_REVISION_REBUILD_REQUIRED')
  } else if (capability.currentPreparedState !== 'READY') {
    add('CURRENT_MISSING')
  }

  const verificationRenderable = capability.historicalPreparedState === 'READY'
    && capability.verificationEvidenceState !== 'NOT_AVAILABLE'

  if (capability.historicalPreparedState === 'STALE') {
    add('RECENT_STALE', 'FAST_VERIFICATION_STALE', 'FULL_HISTORICAL_STALE', 'SOURCE_REVISION_REBUILD_REQUIRED')
  } else if (capability.historicalPreparedState !== 'READY') {
    add('RECENT_MISSING', 'FAST_VERIFICATION_MISSING', 'FULL_HISTORICAL_MISSING')
  } else if (!verificationRenderable) {
    add('RECENT_PARTIAL', 'FAST_VERIFICATION_PARTIAL', 'FULL_HISTORICAL_PARTIAL')
  }

  add('BANDS_NOT_AVAILABLE')
  if (capability.predictionBandState !== 'AVAILABLE') add('CALIBRATION_INSUFFICIENT_SAMPLES')

  const currentReady = capability.currentPreparedState === 'READY'
  const verificationReady = verificationRenderable

  return {
    recentVerificationReadiness: capability.historicalPreparedState === 'STALE'
      ? 'STALE'
      : verificationReady ? 'READY' : 'NOT_PREPARED',
    fastVerificationReadiness: capability.historicalPreparedState === 'STALE'
      ? 'STALE'
      : verificationReady ? 'READY' : 'NOT_PREPARED',
    fullVerificationReadiness: capability.historicalPreparedState === 'STALE'
      ? 'STALE'
      : verificationReady ? 'READY' : 'NOT_PREPARED',
    predictionBandResidualCount: capability.predictionBandResidualCount,
    predictionBandState: capability.predictionBandState,
    readiness: {
      fastReady: currentReady && verificationReady,
      bandsReady: false,
      calibratedReady: false,
      fullReady: currentReady && verificationReady,
      blockers: [...blockers],
    },
  }
}

async function resolveInteractiveForecastReadiness(
  dependencies: Pick<InteractiveForecastPreparationDependencies, 'readPreparedCurrent' | 'readRollingCurrentSnapshot' | 'readPreparedFastVerification' | 'readPreparedFullVerification' | 'readPreparedRollingDailyFastVerification' | 'readPreparedRollingDailyFullVerification' | 'readPreparedRecentVerification'>,
  input: InteractiveForecastIdentity,
  capability: ForecastVariantCapability | null,
  sourceFrequency: InteractiveForecastCapabilityResult['sourceFrequency'],
): Promise<Pick<InteractiveForecastCapabilityResult, 'recentVerificationReadiness' | 'fastVerificationReadiness' | 'fullVerificationReadiness' | 'predictionBandResidualCount' | 'predictionBandState' | 'readiness'>> {
  const blockers = new Set<InteractiveForecastReadinessBlocker>()
  const addBlockers = (next: InteractiveForecastReadinessBlocker[]) => {
    for (const blocker of next) blockers.add(blocker)
  }

  if (!capability) {
    addBlockers(['CURRENT_MISSING'])
    return {
      recentVerificationReadiness: 'NOT_PREPARED',
      fastVerificationReadiness: 'NOT_PREPARED',
      fullVerificationReadiness: 'NOT_PREPARED',
      predictionBandResidualCount: 0,
      predictionBandState: 'NOT_AVAILABLE',
      readiness: {
        fastReady: false,
        bandsReady: false,
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
  let fastVerificationReadiness: InteractiveForecastCapabilityResult['fastVerificationReadiness'] = 'NOT_PREPARED'
  let fullVerificationReadiness: InteractiveForecastCapabilityResult['fullVerificationReadiness'] = 'NOT_PREPARED'
  let bandsReady = false
  let calibratedBandsReady = false

  if (capability.currentPreparedState === 'READY' && capability.capabilityState !== 'NOT_LAWFUL' && capability.capabilityState !== 'NOT_IMPLEMENTED') {
    const request = buildPreparedReadRequest(input, sourceFrequency, capability.targetCadence)
    const preparedReadAuthority = buildPreparedReadAuthority(input, capability)
    const recentVerificationRequest = {
      ...request,
      ...(preparedReadAuthority ? { preparedReadAuthority } : {}),
    }
    const rollingDailyFullVerificationRequest: ForecastRequestInput = {
      seriesId: request.seriesId,
      modelId: input.modelId,
      targetBasis: request.targetBasis,
      ...(request.sourceFrequency ? { sourceFrequency: request.sourceFrequency } : {}),
      ...(request.targetCadence ? { targetCadence: request.targetCadence } : {}),
    }
    const bandReadinessPromise = input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? capability.preparedReadAuthority
        ? dependencies.readRollingCurrentSnapshot({
            seriesId: input.seriesId,
            modelId: input.modelId,
            sourceHistoryFingerprint: capability.preparedReadAuthority.expectedHistoryFingerprint,
          }).then((snapshot) => {
            if (snapshot.status !== 'HIT' || snapshot.payload.status !== 'AVAILABLE' || snapshot.payload.path.length === 0) {
              return { bandsReady: false, calibratedBandsReady: false }
            }
            return {
              bandsReady: snapshot.payload.path.every((point) => point.band.status === 'AVAILABLE'),
              calibratedBandsReady: snapshot.payload.path.every((point) => (
                point.band.status === 'AVAILABLE'
                && point.band.source === 'EMPIRICAL_EXACT_RESIDUALS'
                && point.band.calibrationStatus === 'CALIBRATED'
              )),
            }
          })
        : Promise.resolve({ bandsReady: false, calibratedBandsReady: false })
      : dependencies.readPreparedCurrent(recentVerificationRequest).then((current) => {
          if (current.status !== 'AVAILABLE' || Object.values(current.currentForecast).length === 0) {
            return { bandsReady: false, calibratedBandsReady: false }
          }
          const points = Object.values(current.currentForecast)
          return {
            bandsReady: points.every((point) => point.metadata?.uncertaintyBand?.status === 'AVAILABLE'),
            calibratedBandsReady: points.every((point) => (
              point.metadata?.uncertaintyBand?.status === 'AVAILABLE'
              && point.metadata.uncertaintyBand.source === 'EMPIRICAL_EXACT_RESIDUALS'
              && point.metadata.uncertaintyBand.calibrationStatus === 'CALIBRATED'
            )),
          }
        })
    const fullVerificationReader = input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? dependencies.readPreparedRollingDailyFullVerification
      : dependencies.readPreparedFullVerification
    const fastVerificationReader = input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? dependencies.readPreparedRollingDailyFastVerification
      : dependencies.readPreparedFastVerification
    const fullVerificationPromise = fullVerificationReader(rollingDailyFullVerificationRequest)
    const fastVerificationPromise = fastVerificationReader === fullVerificationReader
      ? fullVerificationPromise
      : fastVerificationReader(rollingDailyFullVerificationRequest)
    const [resolvedBandReadiness, recentVerification, fastVerification, fullVerification] = await Promise.all([
      bandReadinessPromise,
      dependencies.readPreparedRecentVerification(recentVerificationRequest),
      fastVerificationPromise,
      fullVerificationPromise,
    ])
    bandsReady = resolvedBandReadiness.bandsReady
    calibratedBandsReady = resolvedBandReadiness.calibratedBandsReady
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
    const normalizedFast = normalizeVerificationReadiness({
      result: fastVerification,
      missing: 'FAST_VERIFICATION_MISSING',
      partial: 'FAST_VERIFICATION_PARTIAL',
      stale: 'FAST_VERIFICATION_STALE',
    })
    recentVerificationReadiness = normalizedRecent.readiness
    fastVerificationReadiness = normalizedFast.readiness
    fullVerificationReadiness = normalizedFull.readiness
    addBlockers(normalizedRecent.blockers)
    addBlockers(normalizedFast.blockers)
    addBlockers(normalizedFull.blockers)
  }

  const fastReady = capability.currentPreparedState === 'READY' && fastVerificationReadiness === 'READY'
  const calibratedReady = fastReady && calibratedBandsReady && capability.predictionBandState === 'AVAILABLE'
  const fullReady = capability.currentPreparedState === 'READY' && fullVerificationReadiness === 'READY'

  if (capability.currentPreparedState === 'READY' && !bandsReady) addBlockers(['BANDS_NOT_AVAILABLE'])
  if (capability.predictionBandState !== 'AVAILABLE') {
    addBlockers(['CALIBRATION_INSUFFICIENT_SAMPLES'])
  }

  return {
    recentVerificationReadiness,
    fastVerificationReadiness,
    fullVerificationReadiness,
    predictionBandResidualCount: capability.predictionBandResidualCount,
    predictionBandState: capability.predictionBandState,
    readiness: {
      fastReady,
      bandsReady,
      calibratedReady,
      fullReady,
      blockers: [...blockers],
    },
  }
}

async function projectInteractiveForecastCapability(
  dependencies: Pick<InteractiveForecastPreparationDependencies, 'readPreparedCurrent' | 'readRollingCurrentSnapshot' | 'readPreparedFastVerification' | 'readPreparedFullVerification' | 'readPreparedRollingDailyFastVerification' | 'readPreparedRollingDailyFullVerification' | 'readPreparedRecentVerification'>,
  input: InteractiveForecastIdentity,
  resolution: ForecastCapabilityResolution,
  capability: ForecastVariantCapability | null,
  options: { inspectPreparedArtifacts?: boolean } = {},
): Promise<Omit<InteractiveForecastCapabilityResult, 'timingMs' | 'trace'>> {
  const readiness = options.inspectPreparedArtifacts === false
    ? resolvePreparedStateOnlyReadiness(capability)
    : await resolveInteractiveForecastReadiness(
        {
          readPreparedCurrent: dependencies.readPreparedCurrent,
          readRollingCurrentSnapshot: dependencies.readRollingCurrentSnapshot,
          readPreparedFastVerification: dependencies.readPreparedFastVerification,
          readPreparedFullVerification: dependencies.readPreparedFullVerification,
          readPreparedRollingDailyFastVerification: dependencies.readPreparedRollingDailyFastVerification,
          readPreparedRollingDailyFullVerification: dependencies.readPreparedRollingDailyFullVerification,
          readPreparedRecentVerification: dependencies.readPreparedRecentVerification,
        },
        input,
        capability,
        resolution.sourceMetadata.sourceFrequency,
      )

  return {
    seriesId: input.seriesId,
    targetSemantics: input.targetSemantics,
    modelId: input.modelId,
    preparedReadAuthority: capability?.preparedReadAuthority ?? null,
    sourceFrequency: resolution.sourceMetadata.sourceFrequency,
    targetCadence: capability?.targetCadence ?? null,
    sourceAvailability: resolveInteractiveSourceAvailability(resolution),
    lawfulTargetSemantics: capability?.semanticLawfulness ?? null,
    status: capability?.capabilityState ?? 'FAILED',
    currentReadiness: capability?.currentPreparedState ?? 'NOT_PREPARED',
    verificationReadiness: capability?.historicalPreparedState ?? 'NOT_PREPARED',
    recentVerificationReadiness: readiness.recentVerificationReadiness,
    fastVerificationReadiness: readiness.fastVerificationReadiness,
    fullVerificationReadiness: readiness.fullVerificationReadiness,
    predictionBandResidualCount: readiness.predictionBandResidualCount,
    predictionBandState: readiness.predictionBandState,
    readiness: readiness.readiness,
    targetedDataScope: 'SINGLE_SERIES',
    reason: formatInteractiveCapabilityReason(capability, resolution.reason ?? (capability ? null : 'Exact Forecast capability was not resolved.')),
  }
}

export function createInteractiveForecastPreparationService(
  dependencies: Partial<InteractiveForecastPreparationDependencies> = {},
) {
  const rollingDaily = createRollingDailyProductionOperationsService()
  const resolvedDependencies: InteractiveForecastPreparationDependencies = {
    resolveExactCapability: dependencies.resolveExactCapability ?? resolveExactForecastCapability,
    resolveCapabilitiesBySeriesId: dependencies.resolveCapabilitiesBySeriesId ?? resolveForecastCapabilitiesBySeriesId,
    prepareMonthlyCurrent: dependencies.prepareMonthlyCurrent ?? resolveBenchmarkCurrentForecast,
    prepareRollingCurrent: dependencies.prepareRollingCurrent ?? ((request) => rollingDaily.runCurrentOnly(request)),
    prepareRollingDailyOwnership: dependencies.prepareRollingDailyOwnership ?? prepareRollingDailyCurrentOwnership,
    readRollingCurrentSnapshot: dependencies.readRollingCurrentSnapshot ?? readRollingDailyCurrentForecastSnapshot,
    readPreparedCurrent: dependencies.readPreparedCurrent ?? readPreparedBenchmarkCurrentForecast,
    readPreparedFastVerification: dependencies.readPreparedFastVerification
      ?? (dependencies.readPreparedFullVerification ? dependencies.readPreparedFullVerification : readPreparedBenchmarkFastForecastVerification),
    readPreparedFullVerification: dependencies.readPreparedFullVerification ?? readPreparedBenchmarkForecastVerification,
    readPreparedRollingDailyFastVerification: dependencies.readPreparedRollingDailyFastVerification
      ?? (dependencies.readPreparedRollingDailyFullVerification
        ? dependencies.readPreparedRollingDailyFullVerification
        : readPreparedRollingDailyFastForecastVerification),
    readPreparedRollingDailyFullVerification: dependencies.readPreparedRollingDailyFullVerification ?? readPreparedRollingDailyForecastVerification,
    readPreparedRecentVerification: dependencies.readPreparedRecentVerification ?? ((request) => {
      if (request.targetBasis !== 'POINT_IN_TIME') {
        return readPreparedBenchmarkRecentForecastVerification(request)
      }
      return readPreparedRollingDailyRecentForecastVerification({
        seriesId: request.seriesId,
        modelId: request.modelId as ForecastRequestInput['modelId'],
        targetBasis: request.targetBasis,
        ...(request.sourceFrequency ? { sourceFrequency: request.sourceFrequency } : {}),
        ...(request.targetCadence ? { targetCadence: request.targetCadence } : {}),
      })
    }),
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
      const projected = await projectInteractiveForecastCapability(
        resolvedDependencies,
        input,
        resolution,
        capability,
      )
      const timingMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))

      return {
        ...projected,
        timingMs,
        trace,
      }
    },

    async capabilitySnapshotBySeriesId(seriesId: string): Promise<InteractiveForecastCapabilitySeriesSnapshot> {
      const startedAt = resolvedDependencies.now()
      const resolution = await resolvedDependencies.resolveCapabilitiesBySeriesId(seriesId)
      const identities = buildAllInteractiveForecastIdentities(seriesId)
      const projectedVariants = await Promise.all(identities.map(async (identity) => {
        const capability = findExactCapability(resolution, identity)
        return projectInteractiveForecastCapability(resolvedDependencies, identity, resolution, capability)
      }))
      const timingMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))

      return {
        seriesId,
        sourceFrequency: resolution.sourceMetadata.sourceFrequency,
        sourceAvailability: resolveInteractiveSourceAvailability(resolution),
        status: resolution.status,
        reason: resolution.reason,
        targetedDataScope: 'SINGLE_SERIES',
        timingMs,
        variants: projectedVariants.map((variant) => ({
          ...variant,
          timingMs,
        })),
      }
    },

    async readinessSnapshotBySeriesId(seriesId: string): Promise<InteractiveForecastCapabilitySeriesSnapshot> {
      const startedAt = resolvedDependencies.now()
      const resolution = await resolvedDependencies.resolveCapabilitiesBySeriesId(seriesId)
      const identities = buildAllInteractiveForecastIdentities(seriesId)
      const projectedVariants = await Promise.all(identities.map(async (identity) => {
        const capability = findExactCapability(resolution, identity)
        return projectInteractiveForecastCapability(
          resolvedDependencies,
          identity,
          resolution,
          capability,
          { inspectPreparedArtifacts: false },
        )
      }))
      const timingMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))

      return {
        seriesId,
        sourceFrequency: resolution.sourceMetadata.sourceFrequency,
        sourceAvailability: resolveInteractiveSourceAvailability(resolution),
        status: resolution.status,
        reason: resolution.reason,
        targetedDataScope: 'SINGLE_SERIES',
        timingMs,
        variants: projectedVariants.map((variant) => ({
          ...variant,
          timingMs,
        })),
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
        const requestId = resolveForecastOperationRequestId()
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
export const resolveInteractiveForecastCapabilitySnapshotBySeriesId = interactiveForecastPreparationService.capabilitySnapshotBySeriesId
export const resolveInteractiveForecastReadinessSnapshotBySeriesId = interactiveForecastPreparationService.readinessSnapshotBySeriesId
export const prepareInteractiveCurrentForecast = interactiveForecastPreparationService.prepareCurrent
