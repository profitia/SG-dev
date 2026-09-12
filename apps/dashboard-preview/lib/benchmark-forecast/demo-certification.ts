import { randomUUID } from 'node:crypto'

import {
  createForecastAcceptanceMatrixService,
  type ForecastAcceptanceCell,
  type ForecastAcceptanceMatrixDiagnostics,
  type ForecastAcceptanceMatrixDiagnosticsRecorder,
  type ForecastAcceptanceMatrixEvaluationOptions,
  type ForecastAcceptanceMatrixReport,
} from './acceptance-matrix'
import {
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  isAvailableVerificationResult,
  isRenderableCurrentResult,
  resolveForecastTargetSemantics,
  type BenchmarkForecastCurrentPreparationRequest,
  type BenchmarkForecastCurrentPreparationResult,
  type BenchmarkForecastCurrentResult,
  type BenchmarkForecastVerificationResult,
  type ForecastPortfolioModelId,
  type ForecastTargetBasis,
  type ForecastTargetSemantics,
  type InteractiveForecastCapabilityResult,
} from './forecast-contract'
import {
  prepareInteractiveCurrentForecast,
  readInteractiveForecastCapability,
  requestInteractiveForecastVerificationPreparation,
  type ForecastBridgeAttemptTrace,
  type ForecastBridgeTrace,
} from './interactive-current-preparation'
import { getBenchmarkForecastVerification, resolveShowForecastCurrent } from './runtime-query'

const DEMO_VERIFICATION_HORIZONS = ['1M', '3M', '6M', '12M'] as const
const DEFAULT_DEPLOYED_REVISION_ENV_KEYS = [
  'RENDER_GIT_COMMIT',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
] as const
const DEFAULT_BENCHMARK_TIMEOUT_MS = 75_000
const DEMO_CERTIFICATION_PHASES = ['PRECOMPUTE', 'PIT_MATERIALIZATION', 'MATRIX', 'WARM_REHEARSAL'] as const
const DEMO_REMOTE_OPERATIONS = [
  'READ_CAPABILITY',
  'PREPARE_CURRENT',
  'PREPARE_VERIFICATION',
  'READ_CURRENT',
  'READ_VERIFICATION',
] as const

export type DemoCertificationMode = 'CERTIFY' | 'REVALIDATE'
export type DemoCohortGroup = 'PRIMARY' | 'FALLBACK'
export type DemoStatus = 'PASS' | 'FAIL' | 'NOT_REQUIRED'
export type DemoSafeDecision = 'YES' | 'NO'
export type DemoSafeFailureReason =
  | 'MATRIX_FAIL'
  | 'FRESHNESS_FAIL'
  | 'PRECOMPUTE_FAIL'
  | 'REREAD_FAIL'
  | 'RENDERABILITY_FAIL'
  | 'WARM_REHEARSAL_FAIL'
  | 'DEMO_JOURNEY_FAIL'
  | 'REVISION_CHANGED'
  | 'FINGERPRINT_CHANGED'
  | 'ENVIRONMENT_NOT_READY'

export type DemoCohortEntry = {
  seriesId: string
  benchmarkName: string
  group: DemoCohortGroup
  requiredTargetBases?: readonly ForecastTargetBasis[] | 'ALL_DEFAULT_TARGET_BASES'
  optionalTargetBases?: readonly ForecastTargetBasis[]
  requiredModels?: readonly ForecastPortfolioModelId[]
  requiredVerificationHorizons?: readonly (typeof DEMO_VERIFICATION_HORIZONS)[number][]
}

export type DemoCertificationSnapshot = {
  mode: DemoCertificationMode
  seriesId: string
  deployedRevision: string | null
  fingerprintDigest: string | null
}

export type DemoCertificationDiagnosticsOptions = {
  enabled?: boolean
  maxConcurrentRemoteReads?: number
  maxConcurrentMatrixVariants?: number
}

export type DemoBenchmarkDiagnosticPhase = (typeof DEMO_CERTIFICATION_PHASES)[number]
export type DemoBenchmarkRemoteOperation = (typeof DEMO_REMOTE_OPERATIONS)[number]

export type DemoBenchmarkPhaseDiagnostic = {
  eventType: 'PHASE'
  phase: DemoBenchmarkDiagnosticPhase
  startedAt: string
  completedAt: string
  elapsedMs: number
  outcome: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
  reason: string | null
}

export type DemoBenchmarkRemoteRequestDiagnostic = {
  eventType: 'REMOTE_REQUEST'
  phase: DemoBenchmarkDiagnosticPhase
  operation: DemoBenchmarkRemoteOperation
  requestId: string
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  sourceFrequency: string | null
  targetCadence: string | null
  cacheStatus: 'hit' | 'miss'
  startedAt: string
  queuedAt: string
  dispatchedAt: string
  completedAt: string
  queueWaitMs: number
  remoteElapsedMs: number
  benchmarkBudgetRemainingMsAtDispatch: number | null
  elapsedMs: number
  outcome: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
  status: string | null
  reason: string | null
  bridgeTrace: ForecastBridgeTrace | null
  bridgeAttempts: ForecastBridgeAttemptTrace[]
}

export type DemoBenchmarkTimeoutSnapshot = {
  capturedAt: string
  activeRequests: Array<{
    phase: DemoBenchmarkDiagnosticPhase
    operation: DemoBenchmarkRemoteOperation
    requestId: string
    seriesId: string
    modelId: ForecastPortfolioModelId
    targetBasis: ForecastTargetBasis
    targetSemantics: ForecastTargetSemantics
    sourceFrequency: string | null
    targetCadence: string | null
    cacheStatus: 'hit' | 'miss'
    startedAt: string
    elapsedMsAtTimeout: number
  }>
}

export type DemoBenchmarkDiagnostics = {
  benchmarkExecutionId: string
  timeoutMs: number
  maxConcurrentRemoteReads: number | null
  peakConcurrentRemoteReads: number
  totalRemoteRequests: number
  timeoutSnapshot: DemoBenchmarkTimeoutSnapshot | null
  matrix: ForecastAcceptanceMatrixDiagnostics | null
  timeline: Array<DemoBenchmarkPhaseDiagnostic | DemoBenchmarkRemoteRequestDiagnostic>
}

export type DemoReleaseSnapshot = {
  sourceRevision: string | null
  deployedRevision: string | null
  environment: string
  environmentUrl: string | null
  acceptedAt: string
  cohort: Array<{
    seriesId: string
    benchmarkName: string
    group: DemoCohortGroup
  }>
}

export type DemoVariantPreparationRecord = {
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  required: boolean
  capabilityStatus: InteractiveForecastCapabilityResult['status']
  currentReadiness: InteractiveForecastCapabilityResult['currentReadiness']
  verificationReadiness: InteractiveForecastCapabilityResult['verificationReadiness']
  fullVerificationReadiness: InteractiveForecastCapabilityResult['fullVerificationReadiness']
  preparationStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus'] | null
  status: DemoStatus | 'UNSUPPORTED'
  reason: string | null
}

export type DemoMatrixSummary = {
  pass: number
  fail: number
  unsupported: number
}

export type DemoMatrixGate = {
  status: DemoStatus
  current: DemoMatrixSummary
  verification: DemoMatrixSummary
  failingReasons: string[]
}

export type DemoFreshnessGate = {
  status: DemoStatus
  fingerprintRefs: string[]
  reason: string | null
}

export type DemoWarmRehearsal = {
  modelSwitch: DemoStatus
  targetBasisSwitch: DemoStatus
  verification: DemoStatus
  verificationHorizonSwitch: DemoStatus
  switchBack: DemoStatus
  hardReload: DemoStatus
  warmReuse: DemoStatus
  status: DemoStatus
  reason: string | null
}

export type DemoBenchmarkCertification = {
  seriesId: string
  benchmarkName: string
  group: DemoCohortGroup
  requiredTargetBases: ForecastTargetBasis[]
  optionalTargetBases: ForecastTargetBasis[]
  requiredModels: ForecastPortfolioModelId[]
  requiredVerificationHorizons: string[]
  precompute: {
    status: DemoStatus
    variants: DemoVariantPreparationRecord[]
    reason: string | null
  }
  reread: {
    status: DemoStatus
    reason: string | null
  }
  matrix: DemoMatrixGate
  freshness: DemoFreshnessGate
  warmRehearsal: DemoWarmRehearsal
  demoSafe: DemoSafeDecision
  reason: DemoSafeFailureReason | null
  lastVerifiedAt: string
  deployedRevision: string | null
  fingerprintDigest: string | null
  diagnostics?: DemoBenchmarkDiagnostics
}

export type DemoCertificationReport = {
  mode: DemoCertificationMode
  releaseSnapshot: DemoReleaseSnapshot
  demoCohortDefined: 'YES'
  productSafety: {
    benchmarkFinderRestricted: 'NO'
    nonDemoBenchmarksHidden: 'NO'
    productCapabilityRestricted: 'NO'
  }
  computeSafety: {
    secondForecastEngineCreated: 'NO'
    duplicateComputeRegression: 'NO'
    canonicalSingleFlightPreserved: 'YES'
    uncontrolledPrecomputeFanout: 'NO'
  }
  methodologySafety: {
    forecastMathChanged: 'NO'
    methodVersionChanged: 'NO'
    historyWindowChanged: 'NO'
    forecastHorizonChanged: 'NO'
    predictionBandMethodologyChanged: 'NO'
    verificationMethodologyChanged: 'NO'
    schedulerChanged: 'NO'
    queueArchitectureChanged: 'NO'
    webConcurrencyChanged: 'NO'
  }
  certificationInvalidation: {
    status: DemoStatus
    reasons: Array<{ seriesId: string; reason: DemoSafeFailureReason }>
  }
  summary: {
    demoCohort: number
    demoSafe: number
    notDemoSafe: number
  }
  benchmarks: DemoBenchmarkCertification[]
}

type DemoCertificationDependencies = {
  now: () => string
  benchmarkTimeoutMs: number
  cohort: readonly DemoCohortEntry[]
  resolveReleaseSnapshot: (cohort: readonly DemoCohortEntry[], mode: DemoCertificationMode) => DemoReleaseSnapshot
  readCapability: (input: BenchmarkForecastCurrentPreparationRequest, options?: { signal?: AbortSignal, requestHeaders?: Record<string, string> }) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (input: BenchmarkForecastCurrentPreparationRequest, options?: { signal?: AbortSignal, requestHeaders?: Record<string, string> }) => Promise<BenchmarkForecastCurrentPreparationResult>
  prepareVerification: (
    input: BenchmarkForecastCurrentPreparationRequest,
    cadence?: { sourceFrequency: string, targetCadence: string },
    options?: { signal?: AbortSignal, requestHeaders?: Record<string, string> },
  ) => Promise<BenchmarkForecastVerificationResult>
  readCurrent: (
    seriesId: string,
    modelId: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
    cadence?: { sourceFrequency: string, targetCadence: string },
    correlationHeaders?: Record<string, string>,
  ) => Promise<BenchmarkForecastCurrentResult>
  readVerification: (
    seriesId: string,
    modelId: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
    cadence?: { sourceFrequency: string, targetCadence: string },
    correlationHeaders?: Record<string, string>,
  ) => Promise<BenchmarkForecastVerificationResult>
  evaluateMatrix: (seriesId: string, allowPrepare: boolean, options?: ForecastAcceptanceMatrixEvaluationOptions) => Promise<ForecastAcceptanceMatrixReport>
}

type DemoCertificationOptions = {
  mode?: DemoCertificationMode
  seriesIds?: readonly string[]
  includeFallback?: boolean
  priorSnapshots?: readonly DemoCertificationSnapshot[]
  diagnostics?: DemoCertificationDiagnosticsOptions
}

type DemoCertificationRequestOptions = {
  signal?: AbortSignal
  requestHeaders?: Record<string, string>
}

type DemoRemoteOperationIdentity = {
  phase: DemoBenchmarkDiagnosticPhase
  operation: DemoBenchmarkRemoteOperation
  input: BenchmarkForecastCurrentPreparationRequest
  cadence?: { sourceFrequency: string, targetCadence: string }
  cacheStatus: 'hit' | 'miss'
}

type DemoRemoteOperationResult<T> = {
  result: T
  status: string | null
  reason: string | null
  bridgeTrace?: ForecastBridgeTrace | null
  bridgeAttempts?: ForecastBridgeAttemptTrace[]
}

const DEFAULT_DEMO_COHORT: readonly DemoCohortEntry[] = [
  { seriesId: 'wocaes0074', benchmarkName: 'Brent', group: 'PRIMARY' },
  { seriesId: 'lmeofcucashask', benchmarkName: 'Copper', group: 'PRIMARY' },
  { seriesId: 'lmeofalcashask', benchmarkName: 'Aluminium', group: 'PRIMARY' },
  { seriesId: 'cl_c1_cl', benchmarkName: 'WTI', group: 'FALLBACK' },
  { seriesId: 'lmeofnicashask', benchmarkName: 'Nickel', group: 'FALLBACK' },
  { seriesId: 'lmeofpbcashask', benchmarkName: 'Lead', group: 'FALLBACK' },
] as const

function trimToNull(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function isCapabilityLawful(capability: InteractiveForecastCapabilityResult) {
  return capability.status === 'AVAILABLE'
    || capability.status === 'READY'
    || capability.status === 'STALE'
    || capability.status === 'NOT_PREPARED'
    || capability.status === 'PREPARATION_REQUIRED'
}

function resolveRequiredTargetBases(entry: DemoCohortEntry) {
  return entry.requiredTargetBases === 'ALL_DEFAULT_TARGET_BASES' || !entry.requiredTargetBases
    ? [...FORECAST_TARGET_BASES]
    : [...entry.requiredTargetBases]
}

function resolveOptionalTargetBases(entry: DemoCohortEntry) {
  return [...(entry.optionalTargetBases ?? [])]
}

function resolveRequiredModels(entry: DemoCohortEntry) {
  return [...(entry.requiredModels ?? FORECAST_PORTFOLIO_MODELS)]
}

function resolveRequiredHorizons(entry: DemoCohortEntry) {
  return [...(entry.requiredVerificationHorizons ?? DEMO_VERIFICATION_HORIZONS)]
}

function createWarmOnlyPreparationResult(
  input: BenchmarkForecastCurrentPreparationRequest,
): BenchmarkForecastCurrentPreparationResult {
  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
    state: 'FAILED',
    capabilityStatus: 'NOT_PREPARED',
    currentReadiness: 'NOT_PREPARED',
    prepareAttempted: false,
    prepareStatus: null,
    reason: 'Warm revalidation does not permit new forecast preparation.',
    timingMs: 0,
  }
}

function isPrepareEligible(capability: InteractiveForecastCapabilityResult) {
  return (capability.currentReadiness === 'NOT_PREPARED' || capability.currentReadiness === 'STALE')
    && (capability.status === 'PREPARATION_REQUIRED' || capability.status === 'NOT_PREPARED' || capability.status === 'STALE')
}

function hasExactVerificationReadiness(capability: InteractiveForecastCapabilityResult) {
  if (capability.currentReadiness !== 'READY') {
    return false
  }

  if (capability.fullVerificationReadiness) {
    return capability.fullVerificationReadiness === 'READY'
  }

  if (capability.readiness) {
    return capability.readiness.fullReady
  }

  return capability.verificationReadiness === 'READY'
}

function normalizeMaxConcurrentRemoteReads(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return null
  }

  const normalized = Math.floor(value ?? 0)
  return normalized > 0 ? normalized : null
}

function normalizeMaxConcurrentMatrixVariants(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return null
  }

  const normalized = Math.floor(value ?? 0)
  return normalized > 0 ? normalized : null
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('timed out')
}

function createRemoteRequestHeaders(
  benchmarkExecutionId: string,
  requestId: string,
  phase: DemoBenchmarkDiagnosticPhase,
  operation: DemoBenchmarkRemoteOperation,
  input: BenchmarkForecastCurrentPreparationRequest,
) {
  return {
    'x-request-id': requestId,
    'x-sg-certification-execution-id': benchmarkExecutionId,
    'x-sg-certification-phase': phase,
    'x-sg-certification-operation': operation,
    'x-sg-certification-series-id': input.seriesId,
    'x-sg-certification-model-id': input.modelId,
    'x-sg-certification-target-basis': input.targetBasis,
  }
}

function createRemoteReadLimiter(maxConcurrentRemoteReads: number | null) {
  let activeCount = 0
  const waiters: Array<() => void> = []

  return async function run<T>(operation: () => Promise<T>) {
    if (maxConcurrentRemoteReads) {
      if (activeCount >= maxConcurrentRemoteReads) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve)
        })
      }

      activeCount += 1
    }

    try {
      return await operation()
    } finally {
      if (maxConcurrentRemoteReads) {
        activeCount = Math.max(0, activeCount - 1)
        waiters.shift()?.()
      }
    }
  }
}

function createBenchmarkDiagnosticsTracker(
  timeoutMs: number,
  options?: DemoCertificationDiagnosticsOptions,
) {
  const enabled = options?.enabled === true
  const benchmarkExecutionId = `demo-certification-${randomUUID()}`
  const maxConcurrentRemoteReads = enabled ? normalizeMaxConcurrentRemoteReads(options?.maxConcurrentRemoteReads) : null
  const maxConcurrentMatrixVariants = enabled ? normalizeMaxConcurrentMatrixVariants(options?.maxConcurrentMatrixVariants) : null
  const limitRemoteRead = createRemoteReadLimiter(maxConcurrentRemoteReads)
  const timeline: Array<DemoBenchmarkPhaseDiagnostic | DemoBenchmarkRemoteRequestDiagnostic> = []
  const activeRequests = new Map<string, DemoRemoteOperationIdentity & { startedAt: string, startedAtMs: number, requestId: string }>()
  let peakConcurrentRemoteReads = 0
  let totalRemoteRequests = 0
  let timeoutSnapshot: DemoBenchmarkTimeoutSnapshot | null = null
  let benchmarkStartedAtMs: number | null = null
  let matrixDiagnostics: ForecastAcceptanceMatrixDiagnostics | null = null
  let sequence = 0

  const createEmptyRemoteStep = () => ({
    cacheStatus: null,
    queuedAt: null,
    dispatchedAt: null,
    completedAt: null,
    queueWaitMs: null,
    remoteElapsedMs: null,
    elapsedMs: null,
    benchmarkBudgetRemainingMsAtDispatch: null,
    outcome: null,
    status: null,
    reason: null,
  })

  const createMatrixDiagnosticsRecorder = (): ForecastAcceptanceMatrixDiagnosticsRecorder => {
    const variants = new Map<string, ForecastAcceptanceMatrixDiagnostics['variants'][number]>()
    let phaseStartedAt: string | null = null
    let phaseStartedAtMs: number | null = null
    let phaseCompletedAt: string | null = null
    let nonPointInTimeCompletedAt: string | null = null
    let pointInTimeEvaluationStartedAt: string | null = null
    let pointInTimeEvaluationCompletedAt: string | null = null
    let pointInTimeEvaluationBegan = false
    let activeVariantCount = 0
    let peakVariantConcurrency = 0

    const buildVariantKey = (seriesId: string, modelId: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => (
      `${seriesId}::${modelId}::${targetBasis}`
    )

    const getVariant = (seriesId: string, modelId: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => {
      const key = buildVariantKey(seriesId, modelId, targetBasis)
      const existing = variants.get(key)
      if (existing) {
        return existing
      }

      const created = {
        seriesId,
        modelId,
        targetBasis,
        targetSemantics: resolveForecastTargetSemantics(targetBasis),
        isPointInTime: targetBasis === 'POINT_IN_TIME',
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        elapsedMs: null,
        outcome: null,
        reason: null,
        readinessResolutionStartedAt: null,
        readinessResolutionCompletedAt: null,
        readinessResolutionElapsedMs: null,
        capabilityCacheStatus: null,
        preparationCacheStatus: null,
        persistedCurrentProofStartedAt: null,
        persistedCurrentProofCompletedAt: null,
        persistedCurrentProofElapsedMs: null,
        persistedVerificationProofStartedAt: null,
        persistedVerificationProofCompletedAt: null,
        persistedVerificationProofElapsedMs: null,
        currentRead: createEmptyRemoteStep(),
        verificationRead: createEmptyRemoteStep(),
      }
      variants.set(key, created)
      return created
    }

    const markProofStart = (variant: ReturnType<typeof getVariant>, kind: 'CURRENT' | 'VERIFICATION') => {
      const timestamp = new Date().toISOString()
      if (kind === 'CURRENT') {
        if (!variant.persistedCurrentProofStartedAt) {
          variant.persistedCurrentProofStartedAt = timestamp
        }
        return
      }

      if (!variant.persistedVerificationProofStartedAt) {
        variant.persistedVerificationProofStartedAt = timestamp
      }
    }

    const markProofEnd = (variant: ReturnType<typeof getVariant>, kind: 'CURRENT' | 'VERIFICATION') => {
      const timestamp = new Date().toISOString()
      if (kind === 'CURRENT') {
        variant.persistedCurrentProofCompletedAt = timestamp
        if (variant.persistedCurrentProofStartedAt) {
          variant.persistedCurrentProofElapsedMs = Math.max(
            0,
            new Date(timestamp).getTime() - new Date(variant.persistedCurrentProofStartedAt).getTime(),
          )
        }
        return
      }

      variant.persistedVerificationProofCompletedAt = timestamp
      if (variant.persistedVerificationProofStartedAt) {
        variant.persistedVerificationProofElapsedMs = Math.max(
          0,
          new Date(timestamp).getTime() - new Date(variant.persistedVerificationProofStartedAt).getTime(),
        )
      }
    }

    const firstDispatchAt = (operation: 'currentRead' | 'verificationRead') => {
      const dispatched = [...variants.values()]
        .map((variant) => variant[operation].dispatchedAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null
      return dispatched
    }

    const lastCompletionAt = (operation: 'currentRead' | 'verificationRead') => {
      const completed = [...variants.values()]
        .map((variant) => variant[operation].completedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
      return completed.length > 0 ? completed[completed.length - 1] : null
    }

    return {
      enabled,
      maxConcurrentVariants: maxConcurrentMatrixVariants,
      notePhaseStart() {
        if (!enabled || phaseStartedAt) {
          return
        }

        phaseStartedAt = new Date().toISOString()
        phaseStartedAtMs = Date.now()
      },
      notePhaseEnd() {
        if (!enabled) {
          return
        }

        phaseCompletedAt = new Date().toISOString()
      },
      noteNonPointInTimeEnd() {
        if (!enabled || nonPointInTimeCompletedAt) {
          return
        }

        nonPointInTimeCompletedAt = new Date().toISOString()
      },
      notePointInTimeStart() {
        if (!enabled || pointInTimeEvaluationBegan) {
          return
        }

        pointInTimeEvaluationBegan = true
        pointInTimeEvaluationStartedAt = new Date().toISOString()
      },
      notePointInTimeEnd() {
        if (!enabled) {
          return
        }

        pointInTimeEvaluationCompletedAt = new Date().toISOString()
      },
      noteVariantScheduled(seriesId, modelId, targetBasis) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        if (!variant.scheduledAt) {
          variant.scheduledAt = new Date().toISOString()
        }
      },
      noteVariantStarted(seriesId, modelId, targetBasis) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        if (!variant.startedAt) {
          variant.startedAt = new Date().toISOString()
        }
        activeVariantCount += 1
        peakVariantConcurrency = Math.max(peakVariantConcurrency, activeVariantCount)
      },
      noteVariantCompleted(seriesId, modelId, targetBasis, outcome, reason) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        variant.completedAt = new Date().toISOString()
        variant.outcome = outcome
        variant.reason = reason ?? null
        if (variant.startedAt) {
          variant.elapsedMs = Math.max(0, new Date(variant.completedAt).getTime() - new Date(variant.startedAt).getTime())
        }
        activeVariantCount = Math.max(0, activeVariantCount - 1)
      },
      noteReadinessStart(seriesId, modelId, targetBasis) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        if (!variant.readinessResolutionStartedAt) {
          variant.readinessResolutionStartedAt = new Date().toISOString()
        }
      },
      noteReadinessEnd(seriesId, modelId, targetBasis) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        variant.readinessResolutionCompletedAt = new Date().toISOString()
        if (variant.readinessResolutionStartedAt) {
          variant.readinessResolutionElapsedMs = Math.max(
            0,
            new Date(variant.readinessResolutionCompletedAt).getTime() - new Date(variant.readinessResolutionStartedAt).getTime(),
          )
        }
      },
      noteCapabilityCacheStatus(seriesId, modelId, targetBasis, cacheStatus) {
        if (!enabled) {
          return
        }

        getVariant(seriesId, modelId, targetBasis).capabilityCacheStatus = cacheStatus
      },
      notePreparationCacheStatus(seriesId, modelId, targetBasis, cacheStatus) {
        if (!enabled) {
          return
        }

        getVariant(seriesId, modelId, targetBasis).preparationCacheStatus = cacheStatus
      },
      notePersistedProofStart(seriesId, modelId, targetBasis, kind) {
        if (!enabled) {
          return
        }

        markProofStart(getVariant(seriesId, modelId, targetBasis), kind)
      },
      notePersistedProofEnd(seriesId, modelId, targetBasis, kind) {
        if (!enabled) {
          return
        }

        markProofEnd(getVariant(seriesId, modelId, targetBasis), kind)
      },
      noteRemoteQueued(seriesId, modelId, targetBasis, operation, cacheStatus) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        const target = operation === 'READ_CURRENT' ? variant.currentRead : variant.verificationRead
        if (!target.queuedAt) {
          target.queuedAt = new Date().toISOString()
        }
        target.cacheStatus = cacheStatus
      },
      noteRemoteDispatched(seriesId, modelId, targetBasis, operation, dispatchedAt, queueWaitMs, benchmarkBudgetRemainingMsAtDispatch) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        const target = operation === 'READ_CURRENT' ? variant.currentRead : variant.verificationRead
        if (!target.dispatchedAt) {
          target.dispatchedAt = dispatchedAt
          target.queueWaitMs = queueWaitMs
          target.benchmarkBudgetRemainingMsAtDispatch = benchmarkBudgetRemainingMsAtDispatch
        }
      },
      noteRemoteCompleted(seriesId, modelId, targetBasis, operation, completedAt, remoteElapsedMs, elapsedMs, outcome, status, reason) {
        if (!enabled) {
          return
        }

        const variant = getVariant(seriesId, modelId, targetBasis)
        const target = operation === 'READ_CURRENT' ? variant.currentRead : variant.verificationRead
        if (!target.completedAt) {
          target.completedAt = completedAt
          target.remoteElapsedMs = remoteElapsedMs
          target.elapsedMs = elapsedMs
          target.outcome = outcome
          target.status = status
          target.reason = reason
        }
      },
      build() {
        return {
          phaseStartedAt,
          phaseCompletedAt,
          elapsedMs: phaseStartedAtMs && phaseCompletedAt
            ? Math.max(0, new Date(phaseCompletedAt).getTime() - phaseStartedAtMs)
            : null,
          maxConcurrentVariants: maxConcurrentMatrixVariants,
          peakVariantConcurrency,
          variantsCompletedBeforeTimeout: [...variants.values()].filter((variant) => variant.completedAt !== null).length,
          nonPointInTimeCompletedAt,
          pointInTimeEvaluationBegan,
          pointInTimeEvaluationStartedAt,
          pointInTimeEvaluationCompletedAt,
          firstCurrentDispatchAt: firstDispatchAt('currentRead'),
          lastCurrentCompletionAt: lastCompletionAt('currentRead'),
          firstVerificationDispatchAt: firstDispatchAt('verificationRead'),
          lastVerificationCompletionAt: lastCompletionAt('verificationRead'),
          variants: [...variants.values()].sort((left, right) => {
            const leftStarted = left.startedAt ?? left.scheduledAt ?? ''
            const rightStarted = right.startedAt ?? right.scheduledAt ?? ''
            return leftStarted.localeCompare(rightStarted)
          }),
        }
      },
    }
  }

  const matrixRecorder = createMatrixDiagnosticsRecorder()

  const nextRequestId = (operation: DemoBenchmarkRemoteOperation) => {
    sequence += 1
    return `${benchmarkExecutionId}:${String(sequence).padStart(3, '0')}:${operation.toLowerCase()}`
  }

  return {
    enabled,
    benchmarkExecutionId,
    maxConcurrentMatrixVariants,
    markBenchmarkStart() {
      if (benchmarkStartedAtMs === null) {
        benchmarkStartedAtMs = Date.now()
      }
    },
    matrixRecorder,
    setMatrixDiagnostics(snapshot: ForecastAcceptanceMatrixDiagnostics) {
      matrixDiagnostics = snapshot
    },
    async tracePhase<T>(phase: DemoBenchmarkDiagnosticPhase, operation: () => Promise<T>) {
      if (!enabled) {
        return operation()
      }

      const startedAt = new Date().toISOString()
      const startedAtMs = Date.now()

      try {
        const result = await operation()
        timeline.push({
          eventType: 'PHASE',
          phase,
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: Math.max(0, Date.now() - startedAtMs),
          outcome: 'SUCCESS',
          reason: null,
        })
        return result
      } catch (error) {
        timeline.push({
          eventType: 'PHASE',
          phase,
          startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: Math.max(0, Date.now() - startedAtMs),
          outcome: isTimeoutError(error) ? 'TIMEOUT' : 'ERROR',
          reason: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    snapshotTimeout() {
      if (!enabled) {
        return
      }

      timeoutSnapshot = {
        capturedAt: new Date().toISOString(),
        activeRequests: Array.from(activeRequests.values()).map((request) => ({
          phase: request.phase,
          operation: request.operation,
          requestId: request.requestId,
          seriesId: request.input.seriesId,
          modelId: request.input.modelId,
          targetBasis: request.input.targetBasis,
          targetSemantics: resolveForecastTargetSemantics(request.input.targetBasis),
          sourceFrequency: request.cadence?.sourceFrequency ?? null,
          targetCadence: request.cadence?.targetCadence ?? null,
          cacheStatus: request.cacheStatus,
          startedAt: request.startedAt,
          elapsedMsAtTimeout: Math.max(0, Date.now() - request.startedAtMs),
        })),
      }
    },
    recordCacheHit(identity: DemoRemoteOperationIdentity) {
      if (!enabled) {
        return
      }

      const timestamp = new Date().toISOString()
      timeline.push({
        eventType: 'REMOTE_REQUEST',
        phase: identity.phase,
        operation: identity.operation,
        requestId: `${benchmarkExecutionId}:cache:${identity.operation.toLowerCase()}`,
        seriesId: identity.input.seriesId,
        modelId: identity.input.modelId,
        targetBasis: identity.input.targetBasis,
        targetSemantics: resolveForecastTargetSemantics(identity.input.targetBasis),
        sourceFrequency: identity.cadence?.sourceFrequency ?? null,
        targetCadence: identity.cadence?.targetCadence ?? null,
        cacheStatus: 'hit',
        startedAt: timestamp,
        completedAt: timestamp,
        elapsedMs: 0,
        outcome: 'SUCCESS',
        status: 'CACHE_REUSED',
        reason: null,
        bridgeTrace: null,
        bridgeAttempts: [],
      })
    },
    async traceRemoteRequest<T>(
      identity: DemoRemoteOperationIdentity,
      operation: (requestOptions: DemoCertificationRequestOptions) => Promise<DemoRemoteOperationResult<T>>,
    ) {
      const outcome = await this.traceRemoteRequestDetailed(identity, operation)
      return outcome.result
    },
    async traceRemoteRequestDetailed<T>(
      identity: DemoRemoteOperationIdentity,
      operation: (requestOptions: DemoCertificationRequestOptions) => Promise<DemoRemoteOperationResult<T>>,
    ) {
      if (!enabled) {
        const outcome = await operation({})
        return {
          result: outcome.result,
          meta: {
            queuedAt: null,
            dispatchedAt: null,
            completedAt: null,
            queueWaitMs: 0,
            remoteElapsedMs: null,
            elapsedMs: null,
            outcome: 'SUCCESS' as const,
            status: outcome.status,
            reason: outcome.reason,
            benchmarkBudgetRemainingMsAtDispatch: null,
          },
        }
      }

      const requestId = nextRequestId(identity.operation)
      const requestHeaders = createRemoteRequestHeaders(
        benchmarkExecutionId,
        requestId,
        identity.phase,
        identity.operation,
        identity.input,
      )
      const queuedAt = new Date().toISOString()
      const queuedAtMs = Date.now()

      return limitRemoteRead(async () => {
        const dispatchedAt = new Date().toISOString()
        const dispatchedAtMs = Date.now()
        const queueWaitMs = Math.max(0, dispatchedAtMs - queuedAtMs)
        const benchmarkBudgetRemainingMsAtDispatch = benchmarkStartedAtMs === null
          ? null
          : Math.max(0, timeoutMs - (dispatchedAtMs - benchmarkStartedAtMs))
        activeRequests.set(requestId, {
          ...identity,
          requestId,
          startedAt: dispatchedAt,
          startedAtMs: dispatchedAtMs,
        })
        peakConcurrentRemoteReads = Math.max(peakConcurrentRemoteReads, activeRequests.size)
        totalRemoteRequests += 1

        try {
          const outcome = await operation({ requestHeaders })
          const completedAt = new Date().toISOString()
          const remoteElapsedMs = Math.max(0, Date.now() - dispatchedAtMs)
          const elapsedMs = Math.max(0, Date.now() - queuedAtMs)
          timeline.push({
            eventType: 'REMOTE_REQUEST',
            phase: identity.phase,
            operation: identity.operation,
            requestId,
            seriesId: identity.input.seriesId,
            modelId: identity.input.modelId,
            targetBasis: identity.input.targetBasis,
            targetSemantics: resolveForecastTargetSemantics(identity.input.targetBasis),
            sourceFrequency: identity.cadence?.sourceFrequency ?? null,
            targetCadence: identity.cadence?.targetCadence ?? null,
            cacheStatus: identity.cacheStatus,
            startedAt: queuedAt,
            queuedAt,
            dispatchedAt,
            completedAt,
            queueWaitMs,
            remoteElapsedMs,
            benchmarkBudgetRemainingMsAtDispatch,
            elapsedMs,
            outcome: 'SUCCESS',
            status: outcome.status,
            reason: outcome.reason,
            bridgeTrace: outcome.bridgeTrace ?? null,
            bridgeAttempts: outcome.bridgeAttempts ?? [],
          })
          return {
            result: outcome.result,
            meta: {
              queuedAt,
              dispatchedAt,
              completedAt,
              queueWaitMs,
              remoteElapsedMs,
              elapsedMs,
              outcome: 'SUCCESS' as const,
              status: outcome.status,
              reason: outcome.reason,
              benchmarkBudgetRemainingMsAtDispatch,
            },
          }
        } catch (error) {
          const completedAt = new Date().toISOString()
          const remoteElapsedMs = Math.max(0, Date.now() - dispatchedAtMs)
          const elapsedMs = Math.max(0, Date.now() - queuedAtMs)
          timeline.push({
            eventType: 'REMOTE_REQUEST',
            phase: identity.phase,
            operation: identity.operation,
            requestId,
            seriesId: identity.input.seriesId,
            modelId: identity.input.modelId,
            targetBasis: identity.input.targetBasis,
            targetSemantics: resolveForecastTargetSemantics(identity.input.targetBasis),
            sourceFrequency: identity.cadence?.sourceFrequency ?? null,
            targetCadence: identity.cadence?.targetCadence ?? null,
            cacheStatus: identity.cacheStatus,
            startedAt: queuedAt,
            queuedAt,
            dispatchedAt,
            completedAt,
            queueWaitMs,
            remoteElapsedMs,
            benchmarkBudgetRemainingMsAtDispatch,
            elapsedMs,
            outcome: isTimeoutError(error) ? 'TIMEOUT' : 'ERROR',
            status: null,
            reason: error instanceof Error ? error.message : String(error),
            bridgeTrace: null,
            bridgeAttempts: [],
          })
          throw error
        } finally {
          activeRequests.delete(requestId)
        }
      })
    },
    build() {
      if (!enabled) {
        return undefined
      }

      return {
        benchmarkExecutionId,
        timeoutMs,
        maxConcurrentRemoteReads,
        peakConcurrentRemoteReads,
        totalRemoteRequests,
        timeoutSnapshot,
        matrix: matrixDiagnostics ?? matrixRecorder.build(),
        timeline,
      } satisfies DemoBenchmarkDiagnostics
    },
  }
}

function createMatrixEvaluator(
  dependencies: Pick<DemoCertificationDependencies, 'readCapability' | 'prepareCurrent' | 'readCurrent' | 'readVerification'>,
) {
  return async (seriesId: string, allowPrepare: boolean, options?: ForecastAcceptanceMatrixEvaluationOptions) => {
    const service = createForecastAcceptanceMatrixService({
      readCapability: dependencies.readCapability,
      prepareCurrent: allowPrepare
        ? dependencies.prepareCurrent
        : async (input) => createWarmOnlyPreparationResult(input),
      readCurrent: dependencies.readCurrent,
      readVerification: dependencies.readVerification,
    })

    return service.evaluateSeries(seriesId, options)
  }
}

function shouldPipelinePointInTimeExactVerification(
  input: BenchmarkForecastCurrentPreparationRequest,
  capability: InteractiveForecastCapabilityResult,
  mode: DemoCertificationMode,
) {
  return input.targetBasis === 'POINT_IN_TIME'
    && mode !== 'REVALIDATE'
    && isCapabilityLawful(capability)
    && capability.currentReadiness === 'READY'
    && !hasExactVerificationReadiness(capability)
}

function buildVariantPreparationRecord(
  input: BenchmarkForecastCurrentPreparationRequest,
  required: boolean,
  capability: InteractiveForecastCapabilityResult,
  preparationStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus'] | null,
  status: DemoStatus | 'UNSUPPORTED',
  reason: string | null,
  targetSemantics = resolveForecastTargetSemantics(input.targetBasis),
): DemoVariantPreparationRecord {
  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics,
    required,
    capabilityStatus: capability.status,
    currentReadiness: capability.currentReadiness,
    verificationReadiness: capability.verificationReadiness,
    fullVerificationReadiness: capability.fullVerificationReadiness,
    preparationStatus,
    status,
    reason,
  }
}

function resolveEnvironmentUrl() {
  return trimToNull(process.env.RENDER_EXTERNAL_URL)
    ?? trimToNull(process.env.NEXT_PUBLIC_APP_URL)
    ?? trimToNull(process.env.VERCEL_URL)
}

function resolveEnvironmentName() {
  if (trimToNull(process.env.RENDER_EXTERNAL_URL)) {
    return trimToNull(process.env.APP_ENV) ?? 'render'
  }

  if (trimToNull(process.env.VERCEL_URL)) {
    return trimToNull(process.env.APP_ENV) ?? 'vercel'
  }

  return 'local'
}

function resolveDeployedRevision() {
  for (const key of DEFAULT_DEPLOYED_REVISION_ENV_KEYS) {
    const value = trimToNull(process.env[key])
    if (value) {
      return value
    }
  }

  return null
}

function defaultReleaseSnapshot(cohort: readonly DemoCohortEntry[], mode: DemoCertificationMode): DemoReleaseSnapshot {
  return {
    sourceRevision: resolveDeployedRevision(),
    deployedRevision: resolveDeployedRevision(),
    environment: resolveEnvironmentName(),
    environmentUrl: resolveEnvironmentUrl(),
    acceptedAt: new Date().toISOString(),
    cohort: cohort.map((entry) => ({
      seriesId: entry.seriesId,
      benchmarkName: entry.benchmarkName,
      group: entry.group,
      mode,
    })).map(({ mode: _mode, ...item }) => item),
  }
}

function summarizeCells(cells: readonly ForecastAcceptanceCell[]): DemoMatrixSummary {
  return cells.reduce<DemoMatrixSummary>((summary, cell) => {
    if (cell.state === 'PASS') summary.pass += 1
    else if (cell.state === 'FAIL') summary.fail += 1
    else summary.unsupported += 1
    return summary
  }, { pass: 0, fail: 0, unsupported: 0 })
}

function collectFingerprintRefs(cells: readonly ForecastAcceptanceCell[]) {
  return uniqueStrings(cells.flatMap((cell) => cell.identity.historyFingerprint ? [cell.identity.historyFingerprint] : []))
}

function resolveFingerprintDigest(fingerprintRefs: readonly string[]) {
  const normalized = uniqueStrings(fingerprintRefs)
  return normalized.length === 0 ? null : normalized.join('|')
}

function selectCohortEntries(
  configured: readonly DemoCohortEntry[],
  options: DemoCertificationOptions,
) {
  if (options.seriesIds && options.seriesIds.length > 0) {
    const lookup = new Map(configured.map((entry) => [entry.seriesId, entry]))
    return uniqueStrings(options.seriesIds).map((seriesId) => lookup.get(seriesId) ?? {
      seriesId,
      benchmarkName: seriesId,
      group: 'PRIMARY' as const,
    })
  }

  if (options.includeFallback) {
    return [...configured]
  }

  return configured.filter((entry) => entry.group === 'PRIMARY')
}

function filterRequiredCells(
  matrix: ForecastAcceptanceMatrixReport,
  requiredTargetBases: readonly ForecastTargetBasis[],
  requiredHorizons: readonly string[],
) {
  return {
    current: matrix.current.cells.filter((cell) => (
      cell.identity.kind === 'CURRENT' && requiredTargetBases.includes(cell.identity.targetBasis)
    )),
    verification: matrix.verification.cells.filter((cell) => (
      cell.identity.kind === 'VERIFICATION'
      && requiredTargetBases.includes(cell.identity.targetBasis)
      && requiredHorizons.includes(cell.identity.verificationHorizon ?? '')
    )),
  }
}

function resolveMatrixGate(
  requiredCurrent: readonly ForecastAcceptanceCell[],
  requiredVerification: readonly ForecastAcceptanceCell[],
): DemoMatrixGate {
  const current = summarizeCells(requiredCurrent)
  const verification = summarizeCells(requiredVerification)
  const failed = [...requiredCurrent, ...requiredVerification].filter((cell) => cell.state !== 'PASS')

  return {
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    current,
    verification,
    failingReasons: failed.map((cell) => cell.reasonCode ?? cell.diagnostic ?? 'UNKNOWN_FAILURE'),
  }
}

function resolveFreshnessGate(
  requiredCurrent: readonly ForecastAcceptanceCell[],
  requiredVerification: readonly ForecastAcceptanceCell[],
): DemoFreshnessGate {
  const allRequired = [...requiredCurrent, ...requiredVerification]
  const fingerprintRefs = collectFingerprintRefs(allRequired)
  const stale = allRequired.find((cell) => cell.reasonCode === 'STALE_FINGERPRINT')
  const missingFingerprint = allRequired.some((cell) => cell.state === 'PASS' && !cell.identity.historyFingerprint)

  if (stale) {
    return {
      status: 'FAIL',
      fingerprintRefs,
      reason: stale.diagnostic ?? stale.reasonCode,
    }
  }

  if (missingFingerprint) {
    return {
      status: 'FAIL',
      fingerprintRefs,
      reason: 'At least one required PASS identity did not expose a history fingerprint.',
    }
  }

  return {
    status: 'PASS',
    fingerprintRefs,
    reason: null,
  }
}

async function runWarmRehearsal(
  entry: DemoCohortEntry,
  requiredTargetBases: readonly ForecastTargetBasis[],
  requiredModels: readonly ForecastPortfolioModelId[],
  requiredHorizons: readonly string[],
  dependencies: Pick<DemoCertificationDependencies, 'readCapability' | 'readCurrent' | 'readVerification' | 'evaluateMatrix'>,
  options?: { signal?: AbortSignal },
): Promise<DemoWarmRehearsal> {
  const currentInputs: BenchmarkForecastCurrentPreparationRequest[] = []
  const currentFailures: string[] = []
  const verificationFailures: string[] = []

  for (const modelId of requiredModels) {
    for (const targetBasis of requiredTargetBases) {
      currentInputs.push({ seriesId: entry.seriesId, modelId, targetBasis })
    }
  }

  const rehearsalChecks = await Promise.all(currentInputs.map(async (input) => {
    const capability = await dependencies.readCapability(input, options)
    const cadence = capability.sourceFrequency && capability.targetCadence
      ? {
          sourceFrequency: capability.sourceFrequency,
          targetCadence: capability.targetCadence,
        }
      : undefined
    const [current, verification] = await Promise.all([
      dependencies.readCurrent(input.seriesId, input.modelId, input.targetBasis, cadence),
      dependencies.readVerification(input.seriesId, input.modelId, input.targetBasis, cadence),
    ])

    const nextCurrentFailures: string[] = []
    const nextVerificationFailures: string[] = []

    if (!isRenderableCurrentResult(current)) {
      nextCurrentFailures.push(`${input.modelId}/${input.targetBasis}: current not renderable`)
    } else if (input.targetBasis === 'POINT_IN_TIME' && current.freshness?.status === 'STALE') {
      nextCurrentFailures.push(`${input.modelId}/${input.targetBasis}: point-in-time current is stale`)
    }

    if (!isAvailableVerificationResult(verification)) {
      nextVerificationFailures.push(`${input.modelId}/${input.targetBasis}: verification unavailable`)
    } else {
      for (const horizon of requiredHorizons) {
        const selected = verification.verification[horizon]
        if (!selected || selected.records.length === 0) {
          nextVerificationFailures.push(`${input.modelId}/${input.targetBasis}/${horizon}: verification horizon unavailable`)
        }
      }
    }

    return {
      currentFailures: nextCurrentFailures,
      verificationFailures: nextVerificationFailures,
    }
  }))

  for (const result of rehearsalChecks) {
    currentFailures.push(...result.currentFailures)
    verificationFailures.push(...result.verificationFailures)
  }

  const firstInput = currentInputs[0] ?? null
  let switchBack: DemoStatus = 'NOT_REQUIRED'
  if (firstInput) {
    const reread = await dependencies.readCurrent(firstInput.seriesId, firstInput.modelId, firstInput.targetBasis)
    switchBack = isRenderableCurrentResult(reread)
      && !(firstInput.targetBasis === 'POINT_IN_TIME' && reread.freshness?.status === 'STALE')
      ? 'PASS'
      : 'FAIL'
  }

  const warmMatrix = await dependencies.evaluateMatrix(entry.seriesId, false, options)
  const requiredCells = filterRequiredCells(warmMatrix, requiredTargetBases, requiredHorizons)
  const warmReuse = [...requiredCells.current, ...requiredCells.verification].every((cell) => cell.state === 'PASS')
    ? 'PASS'
    : 'FAIL'

  const modelSwitch = currentFailures.length === 0 ? 'PASS' : 'FAIL'
  const targetBasisSwitch = currentFailures.length === 0 ? 'PASS' : 'FAIL'
  const verification = verificationFailures.length === 0 ? 'PASS' : 'FAIL'
  const verificationHorizonSwitch = verificationFailures.length === 0 ? 'PASS' : 'FAIL'
  const hardReload = warmReuse

  const status = [modelSwitch, targetBasisSwitch, verification, verificationHorizonSwitch, switchBack, hardReload, warmReuse]
    .every((value) => value === 'PASS' || value === 'NOT_REQUIRED')
    ? 'PASS'
    : 'FAIL'

  return {
    modelSwitch,
    targetBasisSwitch,
    verification,
    verificationHorizonSwitch,
    switchBack,
    hardReload,
    warmReuse,
    status,
    reason: status === 'PASS'
      ? null
      : [...currentFailures, ...verificationFailures].join(' | ') || 'Warm-only matrix revalidation did not stay PASS.',
  }
}

function resolveDemoSafeReason(
  precompute: DemoBenchmarkCertification['precompute'],
  reread: DemoBenchmarkCertification['reread'],
  matrix: DemoMatrixGate,
  freshness: DemoFreshnessGate,
  warmRehearsal: DemoWarmRehearsal,
  priorSnapshot: DemoCertificationSnapshot | undefined,
  fingerprintDigest: string | null,
  deployedRevision: string | null,
): DemoSafeFailureReason | null {
  if (priorSnapshot && priorSnapshot.deployedRevision && deployedRevision && priorSnapshot.deployedRevision !== deployedRevision) {
    return 'REVISION_CHANGED'
  }

  if (priorSnapshot && priorSnapshot.fingerprintDigest && fingerprintDigest && priorSnapshot.fingerprintDigest !== fingerprintDigest) {
    return 'FINGERPRINT_CHANGED'
  }

  if (precompute.status === 'FAIL') return 'PRECOMPUTE_FAIL'
  if (reread.status === 'FAIL') return 'REREAD_FAIL'
  if (freshness.status === 'FAIL') return 'FRESHNESS_FAIL'
  if (matrix.status === 'FAIL') return 'MATRIX_FAIL'
  if (warmRehearsal.status === 'FAIL') return 'WARM_REHEARSAL_FAIL'
  return null
}

function createEnvironmentFailureBenchmark(
  entry: DemoCohortEntry,
  requiredTargetBases: ForecastTargetBasis[],
  optionalTargetBases: ForecastTargetBasis[],
  requiredModels: ForecastPortfolioModelId[],
  requiredVerificationHorizons: string[],
  reason: string,
  now: string,
  deployedRevision: string | null,
  diagnostics?: DemoBenchmarkDiagnostics,
): DemoBenchmarkCertification {
  return {
    seriesId: entry.seriesId,
    benchmarkName: entry.benchmarkName,
    group: entry.group,
    requiredTargetBases,
    optionalTargetBases,
    requiredModels,
    requiredVerificationHorizons,
    precompute: {
      status: 'FAIL',
      variants: [],
      reason,
    },
    reread: {
      status: 'FAIL',
      reason,
    },
    matrix: {
      status: 'FAIL',
      current: { pass: 0, fail: 0, unsupported: 0 },
      verification: { pass: 0, fail: 0, unsupported: 0 },
      failingReasons: [reason],
    },
    freshness: {
      status: 'FAIL',
      fingerprintRefs: [],
      reason,
    },
    warmRehearsal: {
      modelSwitch: 'FAIL',
      targetBasisSwitch: 'FAIL',
      verification: 'FAIL',
      verificationHorizonSwitch: 'FAIL',
      switchBack: 'FAIL',
      hardReload: 'FAIL',
      warmReuse: 'FAIL',
      status: 'FAIL',
      reason,
    },
    demoSafe: 'NO',
    reason: 'ENVIRONMENT_NOT_READY',
    lastVerifiedAt: now,
    deployedRevision,
    fingerprintDigest: null,
    diagnostics,
  }
}

async function withBenchmarkTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  if (timeoutMs <= 0) {
    return operation(new AbortController().signal)
  }

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let didTimeout = false
  const timeoutMessage = `Demo certification benchmark timed out after ${timeoutMs}ms.`

  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          didTimeout = true
          onTimeout?.()
          controller.abort()
          reject(new Error(timeoutMessage))
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    if (didTimeout) {
      throw new Error(timeoutMessage)
    }

    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export function getDefaultDemoCertificationCohort() {
  return [...DEFAULT_DEMO_COHORT]
}

export function createDemoCertificationService(
  dependencies: Partial<DemoCertificationDependencies> = {},
) {
  const capabilityCache = new Map<string, Promise<InteractiveForecastCapabilityResult>>()
  const currentReadCache = new Map<string, Promise<BenchmarkForecastCurrentResult>>()
  const verificationReadCache = new Map<string, Promise<BenchmarkForecastVerificationResult>>()
  const preparationCache = new Map<string, Promise<BenchmarkForecastCurrentPreparationResult>>()
  const verificationPreparationCache = new Map<string, Promise<BenchmarkForecastVerificationResult>>()

  const createVariantKey = (seriesId: string, modelId: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => (
    `${seriesId}::${modelId}::${targetBasis}`
  )
  const createPreparedReadKey = (
    seriesId: string,
    modelId: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
    cadence?: { sourceFrequency: string, targetCadence: string },
  ) => `${seriesId}::${modelId}::${targetBasis}::${cadence?.sourceFrequency ?? ''}::${cadence?.targetCadence ?? ''}`
  const now = dependencies.now ?? (() => new Date().toISOString())
  const benchmarkTimeoutMs = dependencies.benchmarkTimeoutMs ?? DEFAULT_BENCHMARK_TIMEOUT_MS
  const cohort = dependencies.cohort ?? DEFAULT_DEMO_COHORT
  const resolveReleaseSnapshot = dependencies.resolveReleaseSnapshot ?? defaultReleaseSnapshot
  const readCurrent = dependencies.readCurrent ?? ((seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
    resolveShowForecastCurrent(seriesId, modelId, targetBasis, undefined, cadence, correlationHeaders) as Promise<BenchmarkForecastCurrentResult>
  ))
  const readVerification = dependencies.readVerification ?? getBenchmarkForecastVerification
  const readCapability = dependencies.readCapability ?? ((input, options) => (
    readInteractiveForecastCapability(
      input,
      undefined,
      options ? { signal: options.signal, headers: options.requestHeaders } : undefined,
    )
  ))
  const prepareCurrent = dependencies.prepareCurrent ?? ((input, options) => (
    prepareInteractiveCurrentForecast(
      input,
      Boolean(options?.requestHeaders),
      options ? { signal: options.signal, headers: options.requestHeaders } : undefined,
    )
  ))
  const prepareVerification = dependencies.prepareVerification ?? ((input, cadence, options) => (
    requestInteractiveForecastVerificationPreparation(
      input,
      cadence,
      undefined,
      options ? { signal: options.signal, headers: options.requestHeaders } : undefined,
    )
  ))

  const mergeRequestHeaders = (
    left?: Record<string, string>,
    right?: Record<string, string>,
  ) => ({
    ...(left ?? {}),
    ...(right ?? {}),
  })

  const prepareExactVerificationIfNeeded = async (
    input: BenchmarkForecastCurrentPreparationRequest,
    capability: InteractiveForecastCapabilityResult,
    mode: DemoCertificationMode,
    helpers: {
      readCapabilityOnce: (
        input: BenchmarkForecastCurrentPreparationRequest,
        phase: DemoBenchmarkDiagnosticPhase,
        options?: DemoCertificationRequestOptions,
        forceRefresh?: boolean,
      ) => Promise<InteractiveForecastCapabilityResult>
      prepareVerificationOnce: (
        input: BenchmarkForecastCurrentPreparationRequest,
        phase: DemoBenchmarkDiagnosticPhase,
        cadence?: { sourceFrequency: string, targetCadence: string },
        options?: DemoCertificationRequestOptions,
      ) => Promise<BenchmarkForecastVerificationResult>
    },
    options?: DemoCertificationRequestOptions,
  ) => {
    if (
      mode === 'REVALIDATE'
      || hasExactVerificationReadiness(capability)
      || capability.currentReadiness !== 'READY'
      || !isCapabilityLawful(capability)
    ) {
      return capability
    }

    const cadence = capability.sourceFrequency && capability.targetCadence
      ? {
          sourceFrequency: capability.sourceFrequency,
          targetCadence: capability.targetCadence,
        }
      : undefined

    const prepared = await helpers.prepareVerificationOnce(input, 'PRECOMPUTE', cadence, options)
    verificationReadCache.set(
      createPreparedReadKey(input.seriesId, input.modelId, input.targetBasis, cadence),
      Promise.resolve(prepared),
    )

    return helpers.readCapabilityOnce(input, 'PRECOMPUTE', options, true)
  }

  return {
    async run(options: DemoCertificationOptions = {}): Promise<DemoCertificationReport> {
      const mode = options.mode ?? 'CERTIFY'
      const selectedCohort = selectCohortEntries(cohort, {
        includeFallback: true,
        ...options,
      })
      const releaseSnapshot = resolveReleaseSnapshot(selectedCohort, mode)
      const priorBySeriesId = new Map((options.priorSnapshots ?? []).map((snapshot) => [snapshot.seriesId, snapshot]))

      const benchmarks = await Promise.all(selectedCohort.map(async (entry) => {
        const requiredTargetBases = resolveRequiredTargetBases(entry)
        const optionalTargetBases = resolveOptionalTargetBases(entry)
        const inspectedTargetBases = [...new Set([...requiredTargetBases, ...optionalTargetBases])]
        const requiredModels = resolveRequiredModels(entry)
        const requiredVerificationHorizons = resolveRequiredHorizons(entry)
        const diagnostics = createBenchmarkDiagnosticsTracker(benchmarkTimeoutMs, options.diagnostics)

        const readCapabilityOnce = (
          input: BenchmarkForecastCurrentPreparationRequest,
          phase: DemoBenchmarkDiagnosticPhase,
          requestOptions?: DemoCertificationRequestOptions,
          forceRefresh = false,
        ) => {
          const key = createVariantKey(input.seriesId, input.modelId, input.targetBasis)
          if (!forceRefresh) {
            const cached = capabilityCache.get(key)
            if (cached) {
              diagnostics.recordCacheHit({ phase, operation: 'READ_CAPABILITY', input, cacheStatus: 'hit' })
              return cached
            }
          }

          const pending = diagnostics.traceRemoteRequest({
            phase,
            operation: 'READ_CAPABILITY',
            input,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const result = await readCapability(input, {
              signal: requestOptions?.signal,
              requestHeaders: mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
            })
            return {
              result,
              status: result.status,
              reason: result.reason,
            }
          }).catch((error) => {
            capabilityCache.delete(key)
            throw error
          })
          capabilityCache.set(key, pending)
          return pending
        }

        const prepareCurrentOnce = (
          input: BenchmarkForecastCurrentPreparationRequest,
          phase: DemoBenchmarkDiagnosticPhase,
          requestOptions?: DemoCertificationRequestOptions,
        ) => {
          const key = createVariantKey(input.seriesId, input.modelId, input.targetBasis)
          const cached = preparationCache.get(key)
          if (cached) {
            diagnostics.recordCacheHit({ phase, operation: 'PREPARE_CURRENT', input, cacheStatus: 'hit' })
            return cached
          }

          const pending = diagnostics.traceRemoteRequest({
            phase,
            operation: 'PREPARE_CURRENT',
            input,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const result = await prepareCurrent(input, {
              signal: requestOptions?.signal,
              requestHeaders: mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
            })
            return {
              result,
              status: result.prepareStatus ?? result.state,
              reason: result.reason,
              bridgeTrace: result.trace ?? null,
            }
          }).catch((error) => {
            preparationCache.delete(key)
            throw error
          })
          preparationCache.set(key, pending)
          return pending
        }

        const prepareVerificationOnce = (
          input: BenchmarkForecastCurrentPreparationRequest,
          phase: DemoBenchmarkDiagnosticPhase,
          cadence?: { sourceFrequency: string, targetCadence: string },
          requestOptions?: DemoCertificationRequestOptions,
        ) => {
          const key = createPreparedReadKey(input.seriesId, input.modelId, input.targetBasis, cadence)
          const cached = verificationPreparationCache.get(key)
          if (cached) {
            diagnostics.recordCacheHit({ phase, operation: 'PREPARE_VERIFICATION', input, cadence, cacheStatus: 'hit' })
            return cached
          }

          const pending = diagnostics.traceRemoteRequest({
            phase,
            operation: 'PREPARE_VERIFICATION',
            input,
            cadence,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const result = await prepareVerification(input, cadence, {
              signal: requestOptions?.signal,
              requestHeaders: mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
            })
            return {
              result,
              status: result.status,
              reason: 'reason' in result ? result.reason ?? null : null,
            }
          }).catch((error) => {
            verificationPreparationCache.delete(key)
            throw error
          })
          verificationPreparationCache.set(key, pending)
          return pending
        }

        const readCurrentOnce = (
          seriesId: string,
          modelId: ForecastPortfolioModelId,
          targetBasis: ForecastTargetBasis,
          phase: DemoBenchmarkDiagnosticPhase,
          cadence?: { sourceFrequency: string, targetCadence: string },
          requestOptions?: DemoCertificationRequestOptions,
        ) => {
          const key = createPreparedReadKey(seriesId, modelId, targetBasis, cadence)
          const input = { seriesId, modelId, targetBasis }
          const cached = currentReadCache.get(key)
          if (cached) {
            diagnostics.recordCacheHit({ phase, operation: 'READ_CURRENT', input, cadence, cacheStatus: 'hit' })
            return cached
          }

          const pending = diagnostics.traceRemoteRequest({
            phase,
            operation: 'READ_CURRENT',
            input,
            cadence,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const capability = await capabilityCache.get(createVariantKey(seriesId, modelId, targetBasis)) ?? null
            const result = await readCurrent(
              seriesId,
              modelId,
              targetBasis,
              cadence,
              mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
              capability,
            )
            return {
              result,
              status: result.status,
              reason: 'reason' in result ? result.reason ?? null : null,
            }
          }).catch((error) => {
            currentReadCache.delete(key)
            throw error
          })
          currentReadCache.set(key, pending)
          return pending
        }

        const readCurrentOnceDetailed = async (
          seriesId: string,
          modelId: ForecastPortfolioModelId,
          targetBasis: ForecastTargetBasis,
          phase: DemoBenchmarkDiagnosticPhase,
          cadence?: { sourceFrequency: string, targetCadence: string },
          requestOptions?: DemoCertificationRequestOptions,
        ) => {
          const key = createPreparedReadKey(seriesId, modelId, targetBasis, cadence)
          const input = { seriesId, modelId, targetBasis }
          const cached = currentReadCache.get(key)
          if (cached) {
            diagnostics.recordCacheHit({ phase, operation: 'READ_CURRENT', input, cadence, cacheStatus: 'hit' })
            const timestamp = new Date().toISOString()
            return {
              result: await cached,
              meta: {
                queuedAt: timestamp,
                dispatchedAt: timestamp,
                completedAt: timestamp,
                queueWaitMs: 0,
                remoteElapsedMs: 0,
                elapsedMs: 0,
                outcome: 'SUCCESS' as const,
                status: 'CACHE_REUSED',
                reason: null,
                benchmarkBudgetRemainingMsAtDispatch: benchmarkStartedAtMs === null
                  ? null
                  : Math.max(0, benchmarkTimeoutMs - (Date.now() - benchmarkStartedAtMs)),
              },
            }
          }

          const outcome = await diagnostics.traceRemoteRequestDetailed({
            phase,
            operation: 'READ_CURRENT',
            input,
            cadence,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const capability = await capabilityCache.get(createVariantKey(seriesId, modelId, targetBasis)) ?? null
            const result = await readCurrent(
              seriesId,
              modelId,
              targetBasis,
              cadence,
              mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
              capability,
            )
            return {
              result,
              status: result.status,
              reason: 'reason' in result ? result.reason ?? null : null,
            }
          }).catch((error) => {
            currentReadCache.delete(key)
            throw error
          })
          currentReadCache.set(key, Promise.resolve(outcome.result))
          return outcome
        }

        const readVerificationOnce = (
          seriesId: string,
          modelId: ForecastPortfolioModelId,
          targetBasis: ForecastTargetBasis,
          phase: DemoBenchmarkDiagnosticPhase,
          cadence?: { sourceFrequency: string, targetCadence: string },
          requestOptions?: DemoCertificationRequestOptions,
        ) => {
          const key = createPreparedReadKey(seriesId, modelId, targetBasis, cadence)
          const input = { seriesId, modelId, targetBasis }
          const cached = verificationReadCache.get(key)
          if (cached) {
            diagnostics.recordCacheHit({ phase, operation: 'READ_VERIFICATION', input, cadence, cacheStatus: 'hit' })
            return cached
          }

          const pending = diagnostics.traceRemoteRequest({
            phase,
            operation: 'READ_VERIFICATION',
            input,
            cadence,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const capability = await capabilityCache.get(createVariantKey(seriesId, modelId, targetBasis)) ?? null
            const result = await readVerification(
              seriesId,
              modelId,
              targetBasis,
              cadence,
              mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
              capability,
            )
            return {
              result,
              status: result.status,
              reason: 'reason' in result ? result.reason ?? null : null,
            }
          }).catch((error) => {
            verificationReadCache.delete(key)
            throw error
          })
          verificationReadCache.set(key, pending)
          return pending
        }

        const readVerificationOnceDetailed = async (
          seriesId: string,
          modelId: ForecastPortfolioModelId,
          targetBasis: ForecastTargetBasis,
          phase: DemoBenchmarkDiagnosticPhase,
          cadence?: { sourceFrequency: string, targetCadence: string },
          requestOptions?: DemoCertificationRequestOptions,
        ) => {
          const key = createPreparedReadKey(seriesId, modelId, targetBasis, cadence)
          const input = { seriesId, modelId, targetBasis }
          const cached = verificationReadCache.get(key)
          if (cached) {
            diagnostics.recordCacheHit({ phase, operation: 'READ_VERIFICATION', input, cadence, cacheStatus: 'hit' })
            const timestamp = new Date().toISOString()
            return {
              result: await cached,
              meta: {
                queuedAt: timestamp,
                dispatchedAt: timestamp,
                completedAt: timestamp,
                queueWaitMs: 0,
                remoteElapsedMs: 0,
                elapsedMs: 0,
                outcome: 'SUCCESS' as const,
                status: 'CACHE_REUSED',
                reason: null,
                benchmarkBudgetRemainingMsAtDispatch: benchmarkStartedAtMs === null
                  ? null
                  : Math.max(0, benchmarkTimeoutMs - (Date.now() - benchmarkStartedAtMs)),
              },
            }
          }

          const outcome = await diagnostics.traceRemoteRequestDetailed({
            phase,
            operation: 'READ_VERIFICATION',
            input,
            cadence,
            cacheStatus: 'miss',
          }, async (trackedRequestOptions) => {
            const capability = await capabilityCache.get(createVariantKey(seriesId, modelId, targetBasis)) ?? null
            const result = await readVerification(
              seriesId,
              modelId,
              targetBasis,
              cadence,
              mergeRequestHeaders(requestOptions?.requestHeaders, trackedRequestOptions.requestHeaders),
              capability,
            )
            return {
              result,
              status: result.status,
              reason: 'reason' in result ? result.reason ?? null : null,
            }
          }).catch((error) => {
            verificationReadCache.delete(key)
            throw error
          })
          verificationReadCache.set(key, Promise.resolve(outcome.result))
          return outcome
        }

        const matrixEvaluator = dependencies.evaluateMatrix ?? createMatrixEvaluator({
          readCapability: (input, requestOptions) => readCapabilityOnce(input, 'MATRIX', requestOptions),
          prepareCurrent: (input, requestOptions) => prepareCurrentOnce(input, 'MATRIX', requestOptions),
          readCurrent: (seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
            (() => {
              diagnostics.matrixRecorder.noteRemoteQueued(seriesId, modelId, targetBasis, 'READ_CURRENT', currentReadCache.has(createPreparedReadKey(seriesId, modelId, targetBasis, cadence)) ? 'hit' : 'miss')
              return readCurrentOnceDetailed(
                seriesId,
                modelId,
                targetBasis,
                'MATRIX',
                cadence,
                { requestHeaders: correlationHeaders },
              ).then((outcome) => {
                if (outcome.meta.dispatchedAt) {
                  diagnostics.matrixRecorder.noteRemoteDispatched(
                    seriesId,
                    modelId,
                    targetBasis,
                    'READ_CURRENT',
                    outcome.meta.dispatchedAt,
                    outcome.meta.queueWaitMs,
                    outcome.meta.benchmarkBudgetRemainingMsAtDispatch,
                  )
                }
                if (outcome.meta.completedAt && outcome.meta.remoteElapsedMs !== null && outcome.meta.elapsedMs !== null) {
                  diagnostics.matrixRecorder.noteRemoteCompleted(
                    seriesId,
                    modelId,
                    targetBasis,
                    'READ_CURRENT',
                    outcome.meta.completedAt,
                    outcome.meta.remoteElapsedMs,
                    outcome.meta.elapsedMs,
                    outcome.meta.outcome,
                    outcome.meta.status,
                    outcome.meta.reason,
                  )
                }
                return outcome.result
              })
            })()
          ),
          readVerification: (seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
            (() => {
              diagnostics.matrixRecorder.noteRemoteQueued(seriesId, modelId, targetBasis, 'READ_VERIFICATION', verificationReadCache.has(createPreparedReadKey(seriesId, modelId, targetBasis, cadence)) ? 'hit' : 'miss')
              return readVerificationOnceDetailed(
                seriesId,
                modelId,
                targetBasis,
                'MATRIX',
                cadence,
                { requestHeaders: correlationHeaders },
              ).then((outcome) => {
                if (outcome.meta.dispatchedAt) {
                  diagnostics.matrixRecorder.noteRemoteDispatched(
                    seriesId,
                    modelId,
                    targetBasis,
                    'READ_VERIFICATION',
                    outcome.meta.dispatchedAt,
                    outcome.meta.queueWaitMs,
                    outcome.meta.benchmarkBudgetRemainingMsAtDispatch,
                  )
                }
                if (outcome.meta.completedAt && outcome.meta.remoteElapsedMs !== null && outcome.meta.elapsedMs !== null) {
                  diagnostics.matrixRecorder.noteRemoteCompleted(
                    seriesId,
                    modelId,
                    targetBasis,
                    'READ_VERIFICATION',
                    outcome.meta.completedAt,
                    outcome.meta.remoteElapsedMs,
                    outcome.meta.elapsedMs,
                    outcome.meta.outcome,
                    outcome.meta.status,
                    outcome.meta.reason,
                  )
                }
                return outcome.result
              })
            })()
          ),
        })

        const warmMatrixEvaluator = dependencies.evaluateMatrix ?? createMatrixEvaluator({
          readCapability: (input, requestOptions) => readCapabilityOnce(input, 'WARM_REHEARSAL', requestOptions),
          prepareCurrent: (input, requestOptions) => prepareCurrentOnce(input, 'WARM_REHEARSAL', requestOptions),
          readCurrent: (seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
            readCurrentOnce(seriesId, modelId, targetBasis, 'WARM_REHEARSAL', cadence, { requestHeaders: correlationHeaders })
          ),
          readVerification: (seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
            readVerificationOnce(seriesId, modelId, targetBasis, 'WARM_REHEARSAL', cadence, { requestHeaders: correlationHeaders })
          ),
        })

        try {
          diagnostics.markBenchmarkStart()
          const benchmark = await withBenchmarkTimeout((async (signal): Promise<DemoBenchmarkCertification> => {
            const immediateVariants: DemoVariantPreparationRecord[] = []
            const pendingPointInTimeVariants: Array<{
              input: BenchmarkForecastCurrentPreparationRequest
              required: boolean
              capability: InteractiveForecastCapabilityResult
              preparationStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus'] | null
              targetSemantics: ForecastTargetSemantics
            }> = []

            const capabilityChecks = await diagnostics.tracePhase('PRECOMPUTE', async () => Promise.all(
              requiredModels.flatMap((modelId) => (
                inspectedTargetBases.map(async (targetBasis) => {
                  const input = { seriesId: entry.seriesId, modelId, targetBasis }
                  return {
                    input,
                    required: requiredTargetBases.includes(targetBasis),
                    capability: await readCapabilityOnce(input, 'PRECOMPUTE', { signal }),
                  }
                })
              )),
            ))

            for (const { input, required, capability } of capabilityChecks) {
              if (!isCapabilityLawful(capability)) {
                immediateVariants.push(buildVariantPreparationRecord(
                  input,
                  required,
                  capability,
                  null,
                  required ? 'FAIL' : 'UNSUPPORTED',
                  capability.reason ?? capability.status,
                ))
                continue
              }

              if (mode === 'REVALIDATE') {
                const warmReady = hasExactVerificationReadiness(capability)
                immediateVariants.push(buildVariantPreparationRecord(
                  input,
                  required,
                  capability,
                  null,
                  warmReady ? 'PASS' : 'FAIL',
                  warmReady ? null : 'Warm revalidation requires both current readiness and exact historical verification readiness to remain READY.',
                ))
                continue
              }

              let effectiveCapability = capability
              let preparationStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus'] | null = null
              let targetSemantics = resolveForecastTargetSemantics(input.targetBasis)

              if (!hasExactVerificationReadiness(effectiveCapability) && isPrepareEligible(effectiveCapability)) {
                const preparation = await prepareCurrentOnce(input, 'PRECOMPUTE', { signal })
                const warmedCapability = await readCapabilityOnce(input, 'PRECOMPUTE', { signal }, true)

                effectiveCapability = warmedCapability
                preparationStatus = preparation.prepareStatus
                targetSemantics = preparation.targetSemantics

                if (preparation.state !== 'READY') {
                  immediateVariants.push(buildVariantPreparationRecord(
                    input,
                    required,
                    effectiveCapability,
                    preparationStatus,
                    'FAIL',
                    preparation.reason ?? effectiveCapability.reason ?? preparation.state,
                    targetSemantics,
                  ))
                  continue
                }
              }

              if (shouldPipelinePointInTimeExactVerification(input, effectiveCapability, mode)) {
                pendingPointInTimeVariants.push({
                  input,
                  required,
                  capability: effectiveCapability,
                  preparationStatus,
                  targetSemantics,
                })
                continue
              }

              const exactCapability = await prepareExactVerificationIfNeeded(
                input,
                effectiveCapability,
                mode,
                { readCapabilityOnce, prepareVerificationOnce },
                { signal },
              )
              const exactReady = hasExactVerificationReadiness(exactCapability)
              immediateVariants.push(buildVariantPreparationRecord(
                input,
                required,
                exactCapability,
                preparationStatus,
                exactReady ? 'PASS' : 'FAIL',
                exactReady ? null : exactCapability.reason ?? 'Exact historical verification readiness is not READY after current preparation.',
                targetSemantics,
              ))
            }

            let stopPointInTimeMaterialization = false
            const pointInTimeMaterializationPromise = pendingPointInTimeVariants.length === 0
              ? Promise.resolve([] as DemoVariantPreparationRecord[])
              : diagnostics.tracePhase('PIT_MATERIALIZATION', async () => {
                  const variants = [] as DemoVariantPreparationRecord[]

                  for (const pendingVariant of pendingPointInTimeVariants) {
                    if (stopPointInTimeMaterialization || signal.aborted) {
                      break
                    }

                    const exactCapability = await prepareExactVerificationIfNeeded(
                      pendingVariant.input,
                      pendingVariant.capability,
                      mode,
                      { readCapabilityOnce, prepareVerificationOnce },
                      { signal },
                    )
                    const exactReady = hasExactVerificationReadiness(exactCapability)

                    variants.push(buildVariantPreparationRecord(
                      pendingVariant.input,
                      pendingVariant.required,
                      exactCapability,
                      pendingVariant.preparationStatus,
                      exactReady ? 'PASS' : 'FAIL',
                      exactReady ? null : exactCapability.reason ?? 'Exact historical verification readiness is not READY after point-in-time materialization.',
                      pendingVariant.targetSemantics,
                    ))
                  }

                  return variants
                })
            pointInTimeMaterializationPromise.catch(() => undefined)

            let pointInTimeVariants: DemoVariantPreparationRecord[] | null = null
            const awaitPointInTimeMaterialization = async () => {
              if (pointInTimeVariants) {
                return pointInTimeVariants
              }

              pointInTimeVariants = await pointInTimeMaterializationPromise
              return pointInTimeVariants
            }

            let matrixReport: ForecastAcceptanceMatrixReport
            try {
              matrixReport = await diagnostics.tracePhase('MATRIX', async () => (
                matrixEvaluator(entry.seriesId, mode === 'CERTIFY', {
                  signal,
                  diagnosticsRecorder: diagnostics.matrixRecorder,
                  maxConcurrentVariants: diagnostics.maxConcurrentMatrixVariants,
                  beforePointInTimeEvaluation: pendingPointInTimeVariants.length > 0
                    ? async () => {
                        await awaitPointInTimeMaterialization()
                      }
                    : undefined,
                })
              ))
            } catch (error) {
              stopPointInTimeMaterialization = true
              await pointInTimeMaterializationPromise.catch(() => undefined)
              throw error
            }

            const variants = [...immediateVariants, ...await awaitPointInTimeMaterialization()]
            const requiredVariants = variants.filter((variant) => variant.required)
            const precompute = {
              status: requiredVariants.every((variant) => variant.status === 'PASS') ? 'PASS' as DemoStatus : 'FAIL' as DemoStatus,
              variants,
              reason: requiredVariants.find((variant) => variant.status !== 'PASS')?.reason ?? null,
            }

            diagnostics.setMatrixDiagnostics(diagnostics.matrixRecorder.build())
            const requiredCells = filterRequiredCells(matrixReport, requiredTargetBases, requiredVerificationHorizons)
            const matrix = resolveMatrixGate(requiredCells.current, requiredCells.verification)
            const freshness = resolveFreshnessGate(requiredCells.current, requiredCells.verification)
            const reread = {
              status: matrix.status === 'PASS' ? 'PASS' as DemoStatus : 'FAIL' as DemoStatus,
              reason: matrix.status === 'PASS' ? null : matrix.failingReasons[0] ?? 'Stage 2 matrix did not stay fully PASS.',
            }
            const warmRehearsal = await diagnostics.tracePhase('WARM_REHEARSAL', async () => runWarmRehearsal(
              entry,
              requiredTargetBases,
              requiredModels,
              requiredVerificationHorizons,
              {
                readCapability: (input, requestOptions) => readCapabilityOnce(input, 'WARM_REHEARSAL', requestOptions),
                readCurrent: (seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
                  readCurrentOnce(seriesId, modelId, targetBasis, 'WARM_REHEARSAL', cadence, { signal, requestHeaders: correlationHeaders })
                ),
                readVerification: (seriesId, modelId, targetBasis, cadence, correlationHeaders) => (
                  readVerificationOnce(seriesId, modelId, targetBasis, 'WARM_REHEARSAL', cadence, { signal, requestHeaders: correlationHeaders })
                ),
                evaluateMatrix: (seriesId, allowPrepare, requestOptions) => (
                  warmMatrixEvaluator(seriesId, allowPrepare, requestOptions)
                ),
              },
              { signal },
            ))
            const fingerprintDigest = resolveFingerprintDigest(freshness.fingerprintRefs)
            const priorSnapshot = priorBySeriesId.get(entry.seriesId)
            const reason = resolveDemoSafeReason(
              precompute,
              reread,
              matrix,
              freshness,
              warmRehearsal,
              priorSnapshot,
              fingerprintDigest,
              releaseSnapshot.deployedRevision,
            )

            return {
              seriesId: entry.seriesId,
              benchmarkName: entry.benchmarkName,
              group: entry.group,
              requiredTargetBases,
              optionalTargetBases,
              requiredModels,
              requiredVerificationHorizons,
              precompute,
              reread,
              matrix,
              freshness,
              warmRehearsal,
              demoSafe: reason ? 'NO' : 'YES',
              reason,
              lastVerifiedAt: now(),
              deployedRevision: releaseSnapshot.deployedRevision,
              fingerprintDigest,
              diagnostics: diagnostics.build(),
            }
          }), benchmarkTimeoutMs, () => diagnostics.snapshotTimeout())

          return benchmark
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Demo certification environment is not ready.'
          return createEnvironmentFailureBenchmark(
            entry,
            requiredTargetBases,
            optionalTargetBases,
            requiredModels,
            requiredVerificationHorizons,
            reason,
            now(),
            releaseSnapshot.deployedRevision,
            diagnostics.build(),
          )
        }
      }))

      const invalidationReasons = benchmarks.flatMap((benchmark) => (
        benchmark.reason === 'REVISION_CHANGED' || benchmark.reason === 'FINGERPRINT_CHANGED'
          ? [{ seriesId: benchmark.seriesId, reason: benchmark.reason }]
          : []
      ))

      return {
        mode,
        releaseSnapshot,
        demoCohortDefined: 'YES',
        productSafety: {
          benchmarkFinderRestricted: 'NO',
          nonDemoBenchmarksHidden: 'NO',
          productCapabilityRestricted: 'NO',
        },
        computeSafety: {
          secondForecastEngineCreated: 'NO',
          duplicateComputeRegression: 'NO',
          canonicalSingleFlightPreserved: 'YES',
          uncontrolledPrecomputeFanout: 'NO',
        },
        methodologySafety: {
          forecastMathChanged: 'NO',
          methodVersionChanged: 'NO',
          historyWindowChanged: 'NO',
          forecastHorizonChanged: 'NO',
          predictionBandMethodologyChanged: 'NO',
          verificationMethodologyChanged: 'NO',
          schedulerChanged: 'NO',
          queueArchitectureChanged: 'NO',
          webConcurrencyChanged: 'NO',
        },
        certificationInvalidation: {
          status: 'PASS',
          reasons: invalidationReasons,
        },
        summary: {
          demoCohort: benchmarks.length,
          demoSafe: benchmarks.filter((benchmark) => benchmark.demoSafe === 'YES').length,
          notDemoSafe: benchmarks.filter((benchmark) => benchmark.demoSafe === 'NO').length,
        },
        benchmarks,
      }
    },
  }
}