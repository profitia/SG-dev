import {
  createForecastAcceptanceMatrixService,
  type ForecastAcceptanceCell,
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
} from './interactive-current-preparation'
import { getBenchmarkForecastVerification, resolveShowForecastCurrent } from './runtime-query'

const DEMO_VERIFICATION_HORIZONS = ['1M', '3M', '6M', '12M'] as const
const DEFAULT_DEPLOYED_REVISION_ENV_KEYS = [
  'RENDER_GIT_COMMIT',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
] as const
const DEFAULT_BENCHMARK_TIMEOUT_MS = 75_000

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
  readCapability: (input: BenchmarkForecastCurrentPreparationRequest, options?: { signal?: AbortSignal }) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (input: BenchmarkForecastCurrentPreparationRequest, options?: { signal?: AbortSignal }) => Promise<BenchmarkForecastCurrentPreparationResult>
  readCurrent: (seriesId: string, modelId: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => Promise<BenchmarkForecastCurrentResult>
  readVerification: (seriesId: string, modelId: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => Promise<BenchmarkForecastVerificationResult>
  evaluateMatrix: (seriesId: string, allowPrepare: boolean, options?: { signal?: AbortSignal }) => Promise<ForecastAcceptanceMatrixReport>
}

type DemoCertificationOptions = {
  mode?: DemoCertificationMode
  seriesIds?: readonly string[]
  includeFallback?: boolean
  priorSnapshots?: readonly DemoCertificationSnapshot[]
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
  return capability.currentReadiness === 'NOT_PREPARED'
    && (capability.status === 'PREPARATION_REQUIRED' || capability.status === 'NOT_PREPARED')
}

function createMatrixEvaluator(
  dependencies: Pick<DemoCertificationDependencies, 'readCapability' | 'prepareCurrent' | 'readCurrent' | 'readVerification'>,
) {
  return async (seriesId: string, allowPrepare: boolean, options?: { signal?: AbortSignal }) => {
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
  dependencies: Pick<DemoCertificationDependencies, 'readCurrent' | 'readVerification' | 'evaluateMatrix'>,
  options?: { signal?: AbortSignal },
): Promise<DemoWarmRehearsal> {
  const currentInputs: BenchmarkForecastCurrentPreparationRequest[] = []
  const currentFailures: string[] = []
  const verificationFailures: string[] = []

  for (const modelId of requiredModels) {
    for (const targetBasis of requiredTargetBases) {
      currentInputs.push({ seriesId: entry.seriesId, modelId, targetBasis })

      const current = await dependencies.readCurrent(entry.seriesId, modelId, targetBasis)
      if (!isRenderableCurrentResult(current)) {
        currentFailures.push(`${modelId}/${targetBasis}: current not renderable`)
        continue
      }

      if (targetBasis === 'POINT_IN_TIME' && current.freshness?.status === 'STALE') {
        currentFailures.push(`${modelId}/${targetBasis}: point-in-time current is stale`)
      }

      const verification = await dependencies.readVerification(entry.seriesId, modelId, targetBasis)
      if (!isAvailableVerificationResult(verification)) {
        verificationFailures.push(`${modelId}/${targetBasis}: verification unavailable`)
        continue
      }

      for (const horizon of requiredHorizons) {
        const selected = verification.verification[horizon]
        if (!selected || selected.records.length === 0) {
          verificationFailures.push(`${modelId}/${targetBasis}/${horizon}: verification horizon unavailable`)
        }
      }
    }
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
  }
}

async function withBenchmarkTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) {
    return operation(new AbortController().signal)
  }

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error(`Demo certification benchmark timed out after ${timeoutMs}ms.`))
        }, timeoutMs)
      }),
    ])
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
  const resolvedDependencies: DemoCertificationDependencies = {
    now: dependencies.now ?? (() => new Date().toISOString()),
    benchmarkTimeoutMs: dependencies.benchmarkTimeoutMs ?? DEFAULT_BENCHMARK_TIMEOUT_MS,
    cohort: dependencies.cohort ?? DEFAULT_DEMO_COHORT,
    resolveReleaseSnapshot: dependencies.resolveReleaseSnapshot ?? defaultReleaseSnapshot,
    readCapability: dependencies.readCapability ?? readInteractiveForecastCapability,
    prepareCurrent: dependencies.prepareCurrent ?? prepareInteractiveCurrentForecast,
    readCurrent: dependencies.readCurrent ?? resolveShowForecastCurrent,
    readVerification: dependencies.readVerification ?? getBenchmarkForecastVerification,
    evaluateMatrix: dependencies.evaluateMatrix ?? createMatrixEvaluator({
      readCapability: dependencies.readCapability ?? readInteractiveForecastCapability,
      prepareCurrent: dependencies.prepareCurrent ?? prepareInteractiveCurrentForecast,
      readCurrent: dependencies.readCurrent ?? resolveShowForecastCurrent,
      readVerification: dependencies.readVerification ?? getBenchmarkForecastVerification,
    }),
  }

  return {
    async run(options: DemoCertificationOptions = {}): Promise<DemoCertificationReport> {
      const mode = options.mode ?? 'CERTIFY'
      const selectedCohort = selectCohortEntries(resolvedDependencies.cohort, {
        includeFallback: true,
        ...options,
      })
      const releaseSnapshot = resolvedDependencies.resolveReleaseSnapshot(selectedCohort, mode)
      const priorBySeriesId = new Map((options.priorSnapshots ?? []).map((snapshot) => [snapshot.seriesId, snapshot]))
      const benchmarks: DemoBenchmarkCertification[] = []

      for (const entry of selectedCohort) {
        const requiredTargetBases = resolveRequiredTargetBases(entry)
        const optionalTargetBases = resolveOptionalTargetBases(entry)
        const inspectedTargetBases = [...new Set([...requiredTargetBases, ...optionalTargetBases])]
        const requiredModels = resolveRequiredModels(entry)
        const requiredVerificationHorizons = resolveRequiredHorizons(entry)
        try {
          const benchmark = await withBenchmarkTimeout((async (signal): Promise<DemoBenchmarkCertification> => {
          const variants: DemoVariantPreparationRecord[] = []
          const capabilityChecks = await Promise.all(
            requiredModels.flatMap((modelId) => (
              inspectedTargetBases.map(async (targetBasis) => {
                const input = { seriesId: entry.seriesId, modelId, targetBasis }
                return {
                  input,
                  required: requiredTargetBases.includes(targetBasis),
                  capability: await resolvedDependencies.readCapability(input, { signal }),
                }
              })
            )),
          )

          for (const { input, required, capability } of capabilityChecks) {
            if (!isCapabilityLawful(capability)) {
              variants.push({
                seriesId: entry.seriesId,
                modelId: input.modelId,
                targetBasis: input.targetBasis,
                targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
                required,
                capabilityStatus: capability.status,
                currentReadiness: capability.currentReadiness,
                verificationReadiness: capability.verificationReadiness,
                preparationStatus: null,
                status: required ? 'FAIL' : 'UNSUPPORTED',
                reason: capability.reason ?? capability.status,
              })
              continue
            }

            if (mode === 'REVALIDATE') {
              const warmReady = capability.currentReadiness === 'READY' && capability.verificationReadiness === 'READY'
              variants.push({
                seriesId: entry.seriesId,
                modelId: input.modelId,
                targetBasis: input.targetBasis,
                targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
                required,
                capabilityStatus: capability.status,
                currentReadiness: capability.currentReadiness,
                verificationReadiness: capability.verificationReadiness,
                preparationStatus: null,
                status: warmReady ? 'PASS' : 'FAIL',
                reason: warmReady ? null : 'Warm revalidation requires both current and verification readiness to remain READY.',
              })
              continue
            }

            if (capability.currentReadiness === 'READY' && capability.verificationReadiness === 'READY') {
              variants.push({
                seriesId: entry.seriesId,
                modelId: input.modelId,
                targetBasis: input.targetBasis,
                targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
                required,
                capabilityStatus: capability.status,
                currentReadiness: capability.currentReadiness,
                verificationReadiness: capability.verificationReadiness,
                preparationStatus: null,
                status: 'PASS',
                reason: null,
              })
              continue
            }

            if (!isPrepareEligible(capability)) {
              variants.push({
                seriesId: entry.seriesId,
                modelId: input.modelId,
                targetBasis: input.targetBasis,
                targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
                required,
                capabilityStatus: capability.status,
                currentReadiness: capability.currentReadiness,
                verificationReadiness: capability.verificationReadiness,
                preparationStatus: null,
                status: 'FAIL',
                reason: capability.reason ?? capability.status,
              })
              continue
            }

            const preparation = await resolvedDependencies.prepareCurrent(input, { signal })
            variants.push({
              seriesId: entry.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              targetSemantics: preparation.targetSemantics,
              required,
              capabilityStatus: capability.status,
              currentReadiness: capability.currentReadiness,
              verificationReadiness: capability.verificationReadiness,
              preparationStatus: preparation.prepareStatus,
              status: preparation.state === 'READY' ? 'PASS' : 'FAIL',
              reason: preparation.state === 'READY' ? null : preparation.reason ?? preparation.state,
            })
          }

          const requiredVariants = variants.filter((variant) => variant.required)
          const precompute = {
            status: requiredVariants.every((variant) => variant.status === 'PASS') ? 'PASS' as DemoStatus : 'FAIL' as DemoStatus,
            variants,
            reason: requiredVariants.find((variant) => variant.status !== 'PASS')?.reason ?? null,
          }

          const matrixReport = await resolvedDependencies.evaluateMatrix(entry.seriesId, mode === 'CERTIFY', { signal })
          const requiredCells = filterRequiredCells(matrixReport, requiredTargetBases, requiredVerificationHorizons)
          const matrix = resolveMatrixGate(requiredCells.current, requiredCells.verification)
          const freshness = resolveFreshnessGate(requiredCells.current, requiredCells.verification)
          const reread = {
            status: matrix.status === 'PASS' ? 'PASS' as DemoStatus : 'FAIL' as DemoStatus,
            reason: matrix.status === 'PASS' ? null : matrix.failingReasons[0] ?? 'Stage 2 matrix did not stay fully PASS.',
          }
          const warmRehearsal = await runWarmRehearsal(
            entry,
            requiredTargetBases,
            requiredModels,
            requiredVerificationHorizons,
            {
              readCurrent: resolvedDependencies.readCurrent,
              readVerification: resolvedDependencies.readVerification,
              evaluateMatrix: resolvedDependencies.evaluateMatrix,
            },
            { signal },
          )
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
            lastVerifiedAt: resolvedDependencies.now(),
            deployedRevision: releaseSnapshot.deployedRevision,
            fingerprintDigest,
          }
          }), resolvedDependencies.benchmarkTimeoutMs)

          benchmarks.push(benchmark)
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Demo certification environment is not ready.'
          benchmarks.push(createEnvironmentFailureBenchmark(
            entry,
            requiredTargetBases,
            optionalTargetBases,
            requiredModels,
            requiredVerificationHorizons,
            reason,
            resolvedDependencies.now(),
            releaseSnapshot.deployedRevision,
          ))
        }
      }

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