import {
  DEFAULT_FORECAST_TARGET_BASIS,
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

import { getMarketDataPrismaClient } from '@/lib/db/market-data-prisma'

const DEFAULT_VERIFICATION_HORIZONS = ['1M', '3M', '6M', '12M'] as const
const MONTHLY_METHOD_VERSION = 'benchmark-forecasting-mvp-phase2-v1'
const ROLLING_DAILY_METHOD_VERSION = 'rolling-daily-point-in-time-v1'
const ROLLING_DAILY_INPUT_SOURCE = 'DYNAMIC_MARKET_DATA_STORE'
const VALID_PREPARED_ARTIFACT_FREQUENCIES = [
  'MONTHLY',
  'FORECAST_CADENCE_V1|source=DAILY|target=DAILY',
  'FORECAST_CADENCE_V1|source=DAILY|target=MONTHLY',
  'FORECAST_CADENCE_V1|source=WEEKLY|target=MONTHLY',
  'FORECAST_CADENCE_V1|source=WEEKLY|target=WEEKLY',
  'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  'FORECAST_CADENCE_V1|source=BIMONTHLY|target=BIMONTHLY',
  'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY',
  'FORECAST_CADENCE_V1|source=QUADMONTHLY|target=QUADMONTHLY',
  'FORECAST_CADENCE_V1|source=SEMIANNUAL|target=SEMIANNUAL',
  'FORECAST_CADENCE_V1|source=ANNUAL|target=ANNUAL',
] as const

export type ForecastAcceptanceCellState = 'PASS' | 'FAIL' | 'UNSUPPORTED'
export type ForecastAcceptanceLayer = 'CAPABILITY' | 'PREPARED_STATE' | 'POSTGRES_ARTIFACT' | 'CANONICAL_READ' | 'DASHBOARD_ADAPTER' | 'RENDERABLE_PAYLOAD'
export type ForecastAcceptanceReasonCode =
  | 'UNSUPPORTED_COMBINATION'
  | 'NOT_IMPLEMENTED'
  | 'PROVENANCE_REQUIRED'
  | 'DATA_NOT_AVAILABLE'
  | 'INSUFFICIENT_HISTORY'
  | 'PREPARED_STATE_NOT_READY'
  | 'VERIFICATION_NOT_READY'
  | 'MISSING_ARTIFACT'
  | 'STALE_FINGERPRINT'
  | 'IDENTITY_MISMATCH'
  | 'READ_NOT_AVAILABLE'
  | 'EMPTY_PATH'
  | 'MISSING_REQUIRED_POINTS'
  | 'ADAPTER_REJECTED'
  | 'INVALID_PAYLOAD'
  | 'UNEXPECTED_RUNTIME_ERROR'

type PrismaClientLike = NonNullable<ReturnType<typeof getMarketDataPrismaClient>>

type PersistedArtifactCheckResult = {
  ok: boolean
  reasonCode: ForecastAcceptanceReasonCode | null
  diagnostic: string | null
  historyFingerprint: string | null
}

type AvailableCurrentResult = Extract<BenchmarkForecastCurrentResult, { status: 'AVAILABLE' }>
type AvailableVerificationResult = Extract<BenchmarkForecastVerificationResult, { status: 'AVAILABLE' }>
type ExactReadIdentity = Pick<ForecastAcceptanceIdentity, 'seriesId' | 'modelId' | 'targetBasis' | 'targetSemantics' | 'methodId' | 'methodVersion'>

type AcceptanceMatrixDependencies = {
  readCapability: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<BenchmarkForecastCurrentPreparationResult>
  readCurrent: (seriesId: string, model: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => Promise<BenchmarkForecastCurrentResult>
  readVerification: (seriesId: string, model: ForecastPortfolioModelId, targetBasis: ForecastTargetBasis) => Promise<BenchmarkForecastVerificationResult>
  getPrisma: () => PrismaClientLike | null
}

type PreparationEvidence = {
  state: BenchmarkForecastCurrentPreparationResult['state']
  prepareStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus']
  reason: string | null
}

type ResolvedVariantReadiness = {
  capability: InteractiveForecastCapabilityResult
  preparation: PreparationEvidence | null
}

export type ForecastAcceptanceIdentity = {
  seriesId: string
  kind: 'CURRENT' | 'VERIFICATION'
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastTargetSemantics
  methodVersion: string
  sourceFrequency: string | null
  targetCadence: string | null
  historyFingerprint: string | null
  verificationHorizon: string | null
}

export type ForecastAcceptanceCell = {
  identity: ForecastAcceptanceIdentity
  state: ForecastAcceptanceCellState
  failingLayer: ForecastAcceptanceLayer | null
  reasonCode: ForecastAcceptanceReasonCode | null
  diagnostic: string | null
  preparation: {
    attempted: boolean
    prepareStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus'] | null
    warmReadinessVerified: boolean
  }
}

export type ForecastAcceptanceSection = {
  pass: number
  fail: number
  unsupported: number
  cells: ForecastAcceptanceCell[]
}

export type ForecastAcceptanceMatrixReport = {
  seriesId: string
  generatedAt: string
  current: ForecastAcceptanceSection
  verification: ForecastAcceptanceSection
  overall: 'PASS' | 'FAIL' | 'INCOMPLETE'
}

function resolveMethodVersion(targetBasis: ForecastTargetBasis) {
  return targetBasis === 'POINT_IN_TIME' ? ROLLING_DAILY_METHOD_VERSION : MONTHLY_METHOD_VERSION
}

function resolveTargetCadence(sourceFrequency: string | null, targetBasis: ForecastTargetBasis) {
  if (!sourceFrequency) return null
  if (targetBasis === 'POINT_IN_TIME') return 'DAILY'
  if (sourceFrequency === 'DAILY' || sourceFrequency === 'MONTHLY') return 'MONTHLY'
  if (sourceFrequency === 'WEEKLY' && targetBasis === 'END_OF_PERIOD') return 'MONTHLY'
  return sourceFrequency
}

function resolveIdentityBase(
  seriesId: string,
  modelId: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  sourceFrequency: string | null,
): Omit<ForecastAcceptanceIdentity, 'kind' | 'historyFingerprint' | 'verificationHorizon'> {
  const targetSemantics = resolveForecastTargetSemantics(targetBasis)
  return {
    seriesId,
    modelId,
    targetBasis,
    targetSemantics,
    methodId: targetSemantics,
    methodVersion: resolveMethodVersion(targetBasis),
    sourceFrequency,
    targetCadence: resolveTargetCadence(sourceFrequency, targetBasis),
  }
}

function summarize(cells: ForecastAcceptanceCell[]): ForecastAcceptanceSection {
  return {
    pass: cells.filter((cell) => cell.state === 'PASS').length,
    fail: cells.filter((cell) => cell.state === 'FAIL').length,
    unsupported: cells.filter((cell) => cell.state === 'UNSUPPORTED').length,
    cells,
  }
}

function capabilityFailureState(capability: InteractiveForecastCapabilityResult): ForecastAcceptanceCellState {
  return capability.status === 'NOT_LAWFUL' || capability.status === 'NOT_IMPLEMENTED'
    ? 'UNSUPPORTED'
    : 'FAIL'
}

function capabilityFailureReason(capability: InteractiveForecastCapabilityResult): ForecastAcceptanceReasonCode {
  switch (capability.status) {
    case 'NOT_LAWFUL':
      return 'UNSUPPORTED_COMBINATION'
    case 'NOT_IMPLEMENTED':
      return 'NOT_IMPLEMENTED'
    case 'PROVENANCE_REQUIRED':
      return 'PROVENANCE_REQUIRED'
    case 'DATA_NOT_AVAILABLE':
      return 'DATA_NOT_AVAILABLE'
    case 'INSUFFICIENT_HISTORY':
      return 'INSUFFICIENT_HISTORY'
    default:
      return 'UNEXPECTED_RUNTIME_ERROR'
  }
}

function capabilityAllowsMatrixEvaluation(capability: InteractiveForecastCapabilityResult) {
  return capability.status === 'AVAILABLE'
    || capability.status === 'READY'
    || capability.status === 'PREPARATION_REQUIRED'
    || capability.status === 'NOT_PREPARED'
}

function resolveReadIdentityMismatch(
  expected: ExactReadIdentity,
  actual: ExactReadIdentity,
) {
  const mismatch = ([
    ['seriesId', expected.seriesId, actual.seriesId],
    ['modelId', expected.modelId, actual.modelId],
    ['targetBasis', expected.targetBasis, actual.targetBasis],
    ['targetSemantics', expected.targetSemantics, actual.targetSemantics],
    ['methodId', expected.methodId, actual.methodId],
    ['methodVersion', expected.methodVersion, actual.methodVersion],
  ] as const).find(([, expectedValue, actualValue]) => expectedValue !== actualValue)

  if (!mismatch) {
    return null
  }

  const [field, expectedValue, actualValue] = mismatch
  return `Expected ${field}=${String(expectedValue)} but read ${String(actualValue)}.`
}

function resolvePersistedFingerprintMismatch(
  persistedHistoryFingerprint: string | null,
  readHistoryFingerprint: string,
) {
  if (!persistedHistoryFingerprint || persistedHistoryFingerprint === readHistoryFingerprint) {
    return null
  }

  return `Persisted history fingerprint ${persistedHistoryFingerprint} does not match canonical read fingerprint ${readHistoryFingerprint}.`
}

function resolveCurrentStaleFingerprint(
  current: AvailableCurrentResult,
  persistedHistoryFingerprint: string | null,
) {
  if (current.freshness?.status === 'STALE') {
    return `Current forecast freshness is STALE: ${current.freshness.reason ?? 'UNKNOWN'} (snapshot=${current.freshness.snapshotSourceHistoryFingerprint ?? 'null'}, current=${current.freshness.currentSourceHistoryFingerprint ?? 'null'}).`
  }

  return resolvePersistedFingerprintMismatch(persistedHistoryFingerprint, current.lineage.historyFingerprint)
}

async function checkPersistedCurrentArtifact(
  prisma: PrismaClientLike | null,
  seriesId: string,
  modelId: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
): Promise<PersistedArtifactCheckResult> {
  if (!prisma) {
    return { ok: false, reasonCode: 'MISSING_ARTIFACT', diagnostic: 'Market-data Prisma client is unavailable.', historyFingerprint: null }
  }

  if (targetBasis === 'POINT_IN_TIME') {
    const snapshot = await prisma.rollingDailyCurrentForecastSnapshot.findFirst({
      where: {
        seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: 'POINT_IN_TIME',
        methodId: 'ROLLING_DAILY_POINT_IN_TIME',
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId,
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: { status: true, payloadJson: true },
    })

    if (!snapshot) {
      return { ok: false, reasonCode: 'MISSING_ARTIFACT', diagnostic: 'No persisted point-in-time current snapshot exists.', historyFingerprint: null }
    }

    const payload = snapshot.payloadJson as { status?: string, path?: Array<{ pointForecast?: number }>, audit?: { sourceHistoryFingerprint?: string | null } } | null
    const historyFingerprint = payload?.audit?.sourceHistoryFingerprint ?? null
    if (snapshot.status !== 'AVAILABLE' || payload?.status !== 'AVAILABLE') {
      return { ok: false, reasonCode: 'READ_NOT_AVAILABLE', diagnostic: 'Latest point-in-time current snapshot is not AVAILABLE.', historyFingerprint }
    }

    const hasPath = (payload.path ?? []).some((point) => typeof point?.pointForecast === 'number' && Number.isFinite(point.pointForecast))
    return hasPath
      ? { ok: true, reasonCode: null, diagnostic: null, historyFingerprint }
      : { ok: false, reasonCode: 'EMPTY_PATH', diagnostic: 'Point-in-time current snapshot has no renderable forecast path.', historyFingerprint }
  }

  const run = await prisma.forecastCurrentRun.findFirst({
    where: {
      seriesId,
      modelId,
      frequency: { in: [...VALID_PREPARED_ARTIFACT_FREQUENCIES] },
      targetBasis,
      methodId: resolveForecastTargetSemantics(targetBasis),
      methodVersion: resolveMethodVersion(targetBasis),
    },
    include: { points: true },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!run) {
    return { ok: false, reasonCode: 'MISSING_ARTIFACT', diagnostic: 'No persisted current forecast run exists.', historyFingerprint: null }
  }

  if (run.status !== 'AVAILABLE') {
    return { ok: false, reasonCode: 'READ_NOT_AVAILABLE', diagnostic: run.failureReason ?? 'Latest current forecast run is not AVAILABLE.', historyFingerprint: run.historyFingerprint }
  }

  const hasPoints = run.points.some((point) => point.forecastValue !== null)
  return hasPoints
    ? { ok: true, reasonCode: null, diagnostic: null, historyFingerprint: run.historyFingerprint }
    : { ok: false, reasonCode: 'MISSING_REQUIRED_POINTS', diagnostic: 'Persisted current forecast run has no forecast points.', historyFingerprint: run.historyFingerprint }
}

async function checkPersistedVerificationArtifact(
  prisma: PrismaClientLike | null,
  seriesId: string,
  modelId: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  horizon: string,
): Promise<PersistedArtifactCheckResult> {
  if (!prisma) {
    return { ok: false, reasonCode: 'MISSING_ARTIFACT', diagnostic: 'Market-data Prisma client is unavailable.', historyFingerprint: null }
  }

  if (targetBasis === 'POINT_IN_TIME') {
    const records = await prisma.rollingDailyVerificationRecord.findMany({
      where: {
        seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: 'POINT_IN_TIME',
        methodId: 'ROLLING_DAILY_POINT_IN_TIME',
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId,
        horizonLabel: horizon,
      },
      orderBy: [{ forecastOriginAt: 'desc' }],
      select: { actualValue: true, maturityStatus: true, sourceHistoryFingerprint: true },
    })

    if (records.length === 0) {
      return { ok: false, reasonCode: 'MISSING_ARTIFACT', diagnostic: `No persisted point-in-time verification records exist for ${horizon}.`, historyFingerprint: null }
    }

    const matured = records.filter((record) => record.maturityStatus === 'MATURED' && record.actualValue !== null)
    return matured.length > 0
      ? { ok: true, reasonCode: null, diagnostic: null, historyFingerprint: matured[0]?.sourceHistoryFingerprint ?? null }
      : { ok: false, reasonCode: 'VERIFICATION_NOT_READY', diagnostic: `Persisted point-in-time verification horizon ${horizon} is not matured yet.`, historyFingerprint: records[0]?.sourceHistoryFingerprint ?? null }
  }

  const run = await prisma.forecastVerificationRun.findFirst({
    where: {
      seriesId,
      modelId,
      frequency: { in: [...VALID_PREPARED_ARTIFACT_FREQUENCIES] },
      targetBasis,
      methodId: resolveForecastTargetSemantics(targetBasis),
      methodVersion: resolveMethodVersion(targetBasis),
    },
    include: { metrics: true, points: true },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!run) {
    return { ok: false, reasonCode: 'MISSING_ARTIFACT', diagnostic: 'No persisted verification run exists.', historyFingerprint: null }
  }

  if (run.status !== 'AVAILABLE') {
    return { ok: false, reasonCode: 'READ_NOT_AVAILABLE', diagnostic: run.failureReason ?? 'Latest verification run is not AVAILABLE.', historyFingerprint: run.historyFingerprint }
  }

  const metric = run.metrics.find((item) => item.horizonLabel === horizon)
  const recordCount = run.points.filter((item) => item.horizonLabel === horizon).length
  if (!metric || recordCount === 0) {
    return { ok: false, reasonCode: 'MISSING_REQUIRED_POINTS', diagnostic: `Verification horizon ${horizon} is missing persisted metrics or records.`, historyFingerprint: run.historyFingerprint }
  }

  return { ok: true, reasonCode: null, diagnostic: null, historyFingerprint: run.historyFingerprint }
}

export function createForecastAcceptanceMatrixService(
  dependencies: Partial<AcceptanceMatrixDependencies> = {},
) {
  const resolvedDependencies: AcceptanceMatrixDependencies = {
    readCapability: dependencies.readCapability ?? readInteractiveForecastCapability,
    prepareCurrent: dependencies.prepareCurrent ?? prepareInteractiveCurrentForecast,
    readCurrent: dependencies.readCurrent ?? ((seriesId, model, targetBasis) => (
      resolveShowForecastCurrent(seriesId, model, targetBasis) as Promise<BenchmarkForecastCurrentResult>
    )),
    readVerification: dependencies.readVerification ?? getBenchmarkForecastVerification,
    getPrisma: dependencies.getPrisma ?? getMarketDataPrismaClient,
  }

  const preparationCache = new Map<string, Promise<PreparationEvidence>>()
  const readinessCache = new Map<string, Promise<ResolvedVariantReadiness>>()

  function createVariantKey(
    seriesId: string,
    modelId: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
  ) {
    return `${seriesId}::${modelId}::${targetBasis}`
  }

  async function ensurePrepared(
    input: BenchmarkForecastCurrentPreparationRequest,
  ): Promise<PreparationEvidence> {
    const cacheKey = createVariantKey(input.seriesId, input.modelId, input.targetBasis)
    const cached = preparationCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const pending = resolvedDependencies.prepareCurrent(input)
      .then((result) => ({
        state: result.state,
        prepareStatus: result.prepareStatus,
        reason: result.reason,
      }))

    preparationCache.set(cacheKey, pending)
    return pending
  }

  async function resolveVariantReadiness(
    input: BenchmarkForecastCurrentPreparationRequest,
  ): Promise<ResolvedVariantReadiness> {
    const cacheKey = createVariantKey(input.seriesId, input.modelId, input.targetBasis)
    const cached = readinessCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const pending = (async () => {
      const initialCapability = await resolvedDependencies.readCapability(input)

      if (
        (initialCapability.currentReadiness === 'READY' || initialCapability.verificationReadiness === 'READY')
        || (initialCapability.status !== 'PREPARATION_REQUIRED' && initialCapability.status !== 'NOT_PREPARED')
      ) {
        return {
          capability: initialCapability,
          preparation: null,
        }
      }

      const preparation = await ensurePrepared(input)
      const warmedCapability = await resolvedDependencies.readCapability(input)

      return {
        capability: warmedCapability,
        preparation,
      }
    })()

    readinessCache.set(cacheKey, pending)
    return pending
  }

  function buildPreparation(attempted: boolean, prepareStatus: BenchmarkForecastCurrentPreparationResult['prepareStatus'] | null, warmReadinessVerified: boolean) {
    return {
      attempted,
      prepareStatus,
      warmReadinessVerified,
    }
  }

  async function evaluateCurrentCell(
    seriesId: string,
    modelId: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
  ): Promise<ForecastAcceptanceCell> {
    try {
      const resolvedReadiness = await resolveVariantReadiness({ seriesId, modelId, targetBasis })
      const effectiveCapability = resolvedReadiness.capability
      const prepareEvidence = resolvedReadiness.preparation

      const identityBase = resolveIdentityBase(seriesId, modelId, targetBasis, effectiveCapability.sourceFrequency)

      if (!capabilityAllowsMatrixEvaluation(effectiveCapability)) {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: null, verificationHorizon: null },
          state: capabilityFailureState(effectiveCapability),
          failingLayer: 'CAPABILITY',
          reasonCode: capabilityFailureReason(effectiveCapability),
          diagnostic: effectiveCapability.reason ?? effectiveCapability.status,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      if (effectiveCapability.currentReadiness !== 'READY') {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: null, verificationHorizon: null },
          state: 'FAIL',
          failingLayer: 'PREPARED_STATE',
          reasonCode: 'PREPARED_STATE_NOT_READY',
          diagnostic: prepareEvidence?.reason ?? effectiveCapability.reason ?? effectiveCapability.status,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const persisted = await checkPersistedCurrentArtifact(resolvedDependencies.getPrisma(), seriesId, modelId, targetBasis)
      if (!persisted.ok) {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: persisted.historyFingerprint, verificationHorizon: null },
          state: 'FAIL',
          failingLayer: 'POSTGRES_ARTIFACT',
          reasonCode: persisted.reasonCode,
          diagnostic: persisted.diagnostic,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const current = await resolvedDependencies.readCurrent(seriesId, modelId, targetBasis)
      if (current.status !== 'AVAILABLE') {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: persisted.historyFingerprint, verificationHorizon: null },
          state: current.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'FAIL',
          failingLayer: 'CANONICAL_READ',
          reasonCode: current.status === 'UNSUPPORTED' ? 'UNSUPPORTED_COMBINATION' : 'READ_NOT_AVAILABLE',
          diagnostic: current.reason,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const availableCurrent = current as AvailableCurrentResult
      const currentIdentityMismatch = resolveReadIdentityMismatch(identityBase, availableCurrent)
      if (currentIdentityMismatch) {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: availableCurrent.lineage.historyFingerprint, verificationHorizon: null },
          state: 'FAIL',
          failingLayer: 'DASHBOARD_ADAPTER',
          reasonCode: 'IDENTITY_MISMATCH',
          diagnostic: currentIdentityMismatch,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const currentStaleFingerprint = resolveCurrentStaleFingerprint(availableCurrent, persisted.historyFingerprint)
      if (currentStaleFingerprint) {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: availableCurrent.lineage.historyFingerprint, verificationHorizon: null },
          state: 'FAIL',
          failingLayer: 'POSTGRES_ARTIFACT',
          reasonCode: 'STALE_FINGERPRINT',
          diagnostic: currentStaleFingerprint,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      if (!isRenderableCurrentResult(availableCurrent)) {
        return {
          identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: availableCurrent.lineage.historyFingerprint, verificationHorizon: null },
          state: 'FAIL',
          failingLayer: 'RENDERABLE_PAYLOAD',
          reasonCode: 'INVALID_PAYLOAD',
          diagnostic: 'Current result is AVAILABLE but not renderable under the Stage 1 truth contract.',
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const renderableCurrent = availableCurrent

      return {
        identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: renderableCurrent.lineage.historyFingerprint, verificationHorizon: null },
        state: 'PASS',
        failingLayer: null,
        reasonCode: null,
        diagnostic: null,
        preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
      }
    } catch (error) {
      const identityBase = resolveIdentityBase(seriesId, modelId, targetBasis, null)
      return {
        identity: { ...identityBase, kind: 'CURRENT', historyFingerprint: null, verificationHorizon: null },
        state: 'FAIL',
        failingLayer: 'CANONICAL_READ',
        reasonCode: 'UNEXPECTED_RUNTIME_ERROR',
        diagnostic: error instanceof Error ? error.message : String(error),
        preparation: buildPreparation(false, null, false),
      }
    }
  }

  async function evaluateVerificationCell(
    seriesId: string,
    modelId: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
    horizon: string,
  ): Promise<ForecastAcceptanceCell> {
    try {
      const resolvedReadiness = await resolveVariantReadiness({ seriesId, modelId, targetBasis })
      const effectiveCapability = resolvedReadiness.capability
      const prepareEvidence = resolvedReadiness.preparation

      const identityBase = resolveIdentityBase(seriesId, modelId, targetBasis, effectiveCapability.sourceFrequency)

      if (!capabilityAllowsMatrixEvaluation(effectiveCapability)) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: null, verificationHorizon: horizon },
          state: capabilityFailureState(effectiveCapability),
          failingLayer: 'CAPABILITY',
          reasonCode: capabilityFailureReason(effectiveCapability),
          diagnostic: effectiveCapability.reason ?? effectiveCapability.status,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      if (effectiveCapability.verificationReadiness !== 'READY') {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: null, verificationHorizon: horizon },
          state: 'FAIL',
          failingLayer: 'PREPARED_STATE',
          reasonCode: 'VERIFICATION_NOT_READY',
          diagnostic: prepareEvidence?.reason ?? effectiveCapability.reason ?? effectiveCapability.status,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const persisted = await checkPersistedVerificationArtifact(resolvedDependencies.getPrisma(), seriesId, modelId, targetBasis, horizon)
      if (!persisted.ok) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: persisted.historyFingerprint, verificationHorizon: horizon },
          state: 'FAIL',
          failingLayer: 'POSTGRES_ARTIFACT',
          reasonCode: persisted.reasonCode,
          diagnostic: persisted.diagnostic,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const verification = await resolvedDependencies.readVerification(seriesId, modelId, targetBasis)
      if (!isAvailableVerificationResult(verification)) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: persisted.historyFingerprint, verificationHorizon: horizon },
          state: verification.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'FAIL',
          failingLayer: 'CANONICAL_READ',
          reasonCode: verification.status === 'UNSUPPORTED' ? 'UNSUPPORTED_COMBINATION' : 'READ_NOT_AVAILABLE',
          diagnostic: verification.reason,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const verificationIdentityMismatch = resolveReadIdentityMismatch(identityBase, verification)
      if (verificationIdentityMismatch) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: verification.lineage.historyFingerprint, verificationHorizon: horizon },
          state: 'FAIL',
          failingLayer: 'DASHBOARD_ADAPTER',
          reasonCode: 'IDENTITY_MISMATCH',
          diagnostic: verificationIdentityMismatch,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const verificationStaleFingerprint = resolvePersistedFingerprintMismatch(persisted.historyFingerprint, verification.lineage.historyFingerprint)
      if (verificationStaleFingerprint) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: verification.lineage.historyFingerprint, verificationHorizon: horizon },
          state: 'FAIL',
          failingLayer: 'POSTGRES_ARTIFACT',
          reasonCode: 'STALE_FINGERPRINT',
          diagnostic: verificationStaleFingerprint,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      const selectedHorizon = verification.verification[horizon]
      if (!selectedHorizon) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: verification.lineage.historyFingerprint, verificationHorizon: horizon },
          state: 'FAIL',
          failingLayer: 'DASHBOARD_ADAPTER',
          reasonCode: 'ADAPTER_REJECTED',
          diagnostic: `Verification horizon ${horizon} is missing from the dashboard consumer contract.`,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      if (selectedHorizon.records.length === 0) {
        return {
          identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: verification.lineage.historyFingerprint, verificationHorizon: horizon },
          state: 'FAIL',
          failingLayer: 'RENDERABLE_PAYLOAD',
          reasonCode: 'MISSING_REQUIRED_POINTS',
          diagnostic: `Verification horizon ${horizon} has no renderable records.`,
          preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
        }
      }

      return {
        identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: verification.lineage.historyFingerprint, verificationHorizon: horizon },
        state: 'PASS',
        failingLayer: null,
        reasonCode: null,
        diagnostic: null,
        preparation: buildPreparation(Boolean(prepareEvidence), prepareEvidence?.prepareStatus ?? null, Boolean(prepareEvidence)),
      }
    } catch (error) {
      const identityBase = resolveIdentityBase(seriesId, modelId, targetBasis, null)
      return {
        identity: { ...identityBase, kind: 'VERIFICATION', historyFingerprint: null, verificationHorizon: horizon },
        state: 'FAIL',
        failingLayer: 'CANONICAL_READ',
        reasonCode: 'UNEXPECTED_RUNTIME_ERROR',
        diagnostic: error instanceof Error ? error.message : String(error),
        preparation: buildPreparation(false, null, false),
      }
    }
  }

  return {
    async evaluateSeries(seriesId: string): Promise<ForecastAcceptanceMatrixReport> {
      const currentCells: ForecastAcceptanceCell[] = []
      const verificationCells: ForecastAcceptanceCell[] = []

      for (const modelId of FORECAST_PORTFOLIO_MODELS) {
        for (const targetBasis of FORECAST_TARGET_BASES) {
          currentCells.push(await evaluateCurrentCell(seriesId, modelId, targetBasis))
          for (const horizon of DEFAULT_VERIFICATION_HORIZONS) {
            verificationCells.push(await evaluateVerificationCell(seriesId, modelId, targetBasis, horizon))
          }
        }
      }

      const current = summarize(currentCells)
      const verification = summarize(verificationCells)
      const overall = current.fail === 0 && verification.fail === 0
        ? 'PASS'
        : current.pass + verification.pass === 0 && current.unsupported + verification.unsupported === 0
          ? 'INCOMPLETE'
          : 'FAIL'

      return {
        seriesId,
        generatedAt: new Date().toISOString(),
        current,
        verification,
        overall,
      }
    },
  }
}

export async function getForecastAcceptanceMatrixReport(seriesId: string) {
  return createForecastAcceptanceMatrixService().evaluateSeries(seriesId)
}

export function normalizeAcceptanceMatrixTargetBasis(targetBasis: string | null | undefined): ForecastTargetBasis {
  return FORECAST_TARGET_BASES.includes((targetBasis ?? '') as ForecastTargetBasis)
    ? (targetBasis as ForecastTargetBasis)
    : DEFAULT_FORECAST_TARGET_BASIS
}