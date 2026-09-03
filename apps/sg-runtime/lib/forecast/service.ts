import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { serverEnv } from '@/lib/env'
import { buildForecastHistoryFingerprint as buildCanonicalForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  createForecastCadence,
  normalizeForecastSourceFrequency,
  type ForecastCadence,
  type ForecastSourceFrequency,
  type ForecastTargetCadence,
} from '@/lib/forecast/cadence'
import {
  buildCurrentLogicalArtifactKey,
  CurrentForecastSingleFlight,
} from '@/lib/forecast/current-single-flight'
import {
  buildVerificationHorizonSetId,
  buildVerificationLogicalArtifactKey,
  VERIFICATION_CONFIGURATION_ID,
  VERIFICATION_ORIGIN_POLICY_ID,
  VerificationForecastSingleFlight,
} from '@/lib/forecast/verification-single-flight'
import {
  buildVerificationPersistenceDecimals,
  normalizeForecastLibraryDecimal,
} from '@/lib/forecast/persistence-decimal'
import type {
  BenchmarkForecastCurrentAvailableResult,
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationAvailableResult,
  BenchmarkForecastVerificationResult,
  ForecastCurrentAlignment,
  ForecastCurrentPoint,
  ForecastHistorySummary,
  ForecastSelectionMetadata,
  ForecastSourceRef,
  ForecastTargetBasis,
  UserFacingForecastModelId,
  ForecastUnsupportedResult,
  ForecastVerificationFailure,
  ForecastVerificationHorizon,
  ForecastVerificationMetrics,
  ForecastVerificationRecord,
} from '@/lib/forecast/contracts'
import { DEFAULT_FORECAST_TARGET_BASIS, USER_FACING_FORECAST_MODELS } from '@/lib/forecast/contracts'
import {
  buildForecastArtifactCadenceIdentity,
  LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
  parseForecastArtifactCadenceIdentity,
  resolveForecastMethodContract,
  type ForecastMethodId,
  type ForecastPreparationIdentity,
  type ForecastTargetSemantics,
} from '@/lib/forecast/identity'
import {
  buildCurrentForecastExecutionPlan,
  buildCurrentHorizonConfigurationId,
  loadLiveForecastBridgePayload,
  selectLatestCurrentForecastMonthlyTrainingPayload,
  type LiveForecastBridgePayload,
} from '@/lib/forecast/live-market-input'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import {
  forecastStressTelemetry,
  type ForecastStressTelemetry,
} from '@/lib/forecast/stress-telemetry'

const execFileAsync = promisify(execFile)
const DEFAULT_FORECASTING_LAB_ROOT = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting')
const DEFAULT_FORECASTING_PYTHON = path.join(DEFAULT_FORECASTING_LAB_ROOT, '.venv', 'bin', 'python')
const FORECASTING_BRIDGE_SCRIPT = ['scripts', 'export_forecast_bundle.py']
const BRIDGE_BUFFER_BYTES = 25 * 1024 * 1024
const currentForecastSingleFlight = new CurrentForecastSingleFlight<unknown>()
const verificationForecastSingleFlight = new VerificationForecastSingleFlight<BenchmarkForecastVerificationResult>()

export function runCurrentForecastSingleFlight<Result>(
  input: Parameters<CurrentForecastSingleFlight<Result>['run']>[0],
): Promise<Result> {
  return currentForecastSingleFlight.run(input) as Promise<Result>
}

export function getActiveCurrentForecastSingleFlightEntryCount() {
  return currentForecastSingleFlight.activeEntryCount
}

type ForecastBridgeMode = 'history' | 'current' | 'verification'

export type ForecastServiceRequest = {
  seriesId: string
  modelId: UserFacingForecastModelId | string
  targetBasis: ForecastTargetBasis
  sourceFrequency?: ForecastSourceFrequency
  targetCadence?: ForecastTargetCadence
}

type ForecastHistoryPoint = {
  date: string
  value: number | null
  sourceObservedAt?: string | null
}

type ForecastHistoryCanonicalization = {
  method: string
  version: string
}

type ForecastBridgeHistory = {
  seriesId: string
  benchmarkName: string
  description: string
  frequency: string
  start: string
  end: string
  observations: number
  canonicalization?: ForecastHistoryCanonicalization | null
  points: ForecastHistoryPoint[]
}

type ForecastBridgeBenchmark = {
  seriesId: string
  component: string
  description: string
  frequency: string
  expectedObservations: number
}

type ForecastBridgeSource = {
  kind: string
  runId: string | null
}

type ForecastBridgeUnavailable = {
  status: 'NOT_AVAILABLE'
  reason: string
}

type ForecastBridgeUnsupported = {
  status: 'UNSUPPORTED'
  reason: string
  seriesId: string
  supportedSeriesIds: string[]
  supportedModels: string[]
  methodVersion?: string
  source?: ForecastBridgeSource
}

type ForecastBridgeFailed = {
  status: 'FAILED'
  reason: string
  seriesId: string
  model?: string | null
  methodVersion?: string
  source?: ForecastBridgeSource
}

type ForecastBridgeHistoryAvailable = {
  status: 'AVAILABLE'
  methodVersion: string
  source: ForecastBridgeSource
  benchmark: ForecastBridgeBenchmark
  history: ForecastBridgeHistory
}

type ForecastBridgeCurrentAvailable = {
  status: 'AVAILABLE'
  methodVersion: string
  source: ForecastBridgeSource
  benchmark: ForecastBridgeBenchmark
  model: {
    id: string
    userFacing: boolean
  }
  result: {
    benchmarkId: string
    component: string
    description: string
    frequency: string
    model: string
    history: ForecastBridgeHistory
    currentForecast: Record<string, ForecastCurrentPoint>
    runtimeSeconds: number
  }
}

type ForecastBridgeVerificationMetricPayload = {
  mae: number | null
  rmse: number | null
  mase: number | null
  smape: number | null
  directional_accuracy: number | null
  bias: number | null
}

type ForecastBridgeVerificationAvailable = {
  status: 'AVAILABLE'
  methodVersion: string
  source: ForecastBridgeSource
  benchmark: ForecastBridgeBenchmark
  model: {
    id: string
    userFacing: boolean
  }
  result: {
    benchmarkId: string
    component: string
    description: string
    frequency: string
    model: string
    history: ForecastBridgeHistory
    backtest: Record<
      string,
      {
        origins: number
        expectedOrigins: number
        successfulOrigins: number
        failedOrigins: number
        coverage: number
        metrics: ForecastBridgeVerificationMetricPayload | null
        records: ForecastVerificationRecord[]
        failures: ForecastVerificationFailure[]
      }
    >
    runtimeSeconds: number
  }
}

type ForecastHistoryBridgeResponse =
  | ForecastBridgeUnavailable
  | ForecastBridgeUnsupported
  | ForecastBridgeFailed
  | ForecastBridgeHistoryAvailable

type ForecastCurrentBridgeResponse =
  | ForecastBridgeUnavailable
  | ForecastBridgeUnsupported
  | ForecastBridgeFailed
  | ForecastBridgeCurrentAvailable

type ForecastVerificationBridgeResponse =
  | ForecastBridgeUnavailable
  | ForecastBridgeUnsupported
  | ForecastBridgeFailed
  | ForecastBridgeVerificationAvailable

type ForecastPersistedArtifactBase = {
  seriesId: string
  modelId: string
  displayName: string
  description: string | null
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  methodVersion: string
  source: ForecastSourceRef
  preparation: ForecastPreparationIdentity | null
  historyFingerprint: string
  cadence: ForecastCadence | null
  frequencyIdentity: string
  history: ForecastHistorySummary
  forecastOrigin: string | null
  runtimeSeconds: number | null
}

export type PersistedCurrentArtifact = ForecastPersistedArtifactBase & {
  currentForecast: Record<string, ForecastCurrentPoint>
}

export type PersistedVerificationArtifact = ForecastPersistedArtifactBase & {
  verification: Record<string, ForecastVerificationHorizon>
}

export type ForecastCacheLookupKey = {
  seriesId: string
  modelId: string
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  methodVersion: string
  inputSource: string
  historyFingerprint: string
  targetBasis: ForecastTargetBasis
  frequencyIdentity: string
}

type ForecastPreparedLookupKey = Pick<
  ForecastCacheLookupKey,
  'seriesId' | 'modelId' | 'targetSemantics' | 'methodId' | 'methodVersion' | 'targetBasis' | 'frequencyIdentity'
>

type ForecastBridgeReadyConfiguration = {
  ok: true
  labRoot: string
  pythonBin: string
  scriptPath: string
}

type ForecastBridgeUnavailableConfiguration = {
  ok: false
  reason: string
}

export type ForecastLibraryRepository = {
  readCurrentRun(key: ForecastCacheLookupKey): Promise<PersistedCurrentArtifact | null>
  writeCurrentRun(artifact: PersistedCurrentArtifact): Promise<void>
  readVerificationRun(key: ForecastCacheLookupKey): Promise<PersistedVerificationArtifact | null>
  writeVerificationRun(artifact: PersistedVerificationArtifact): Promise<void>
  readLatestCurrentRun?(key: ForecastPreparedLookupKey): Promise<PersistedCurrentArtifact | null>
  readLatestVerificationRun?(key: ForecastPreparedLookupKey): Promise<PersistedVerificationArtifact | null>
}

export type ForecastBridge = {
  exportHistory(input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>): Promise<ForecastHistoryBridgeResponse>
  exportCurrent(input: ForecastServiceRequest): Promise<ForecastCurrentBridgeResponse>
  exportVerification(input: ForecastServiceRequest): Promise<ForecastVerificationBridgeResponse>
  prepareExecutionContext?(input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>): Promise<ForecastPreparedExecutionContext | null>
}

export type ForecastPreparedExecutionContext = {
  exportHistory(mode?: 'current' | 'verification'): Promise<ForecastHistoryBridgeResponse>
  exportCurrent(modelId: string): Promise<ForecastCurrentBridgeResponse>
  exportVerification(modelId: string): Promise<ForecastVerificationBridgeResponse>
}

export type ForecastLibraryServiceDependencies = {
  repository: ForecastLibraryRepository
  bridge: ForecastBridge
  logEvent: (event: string, data: Record<string, string | number | boolean | null>) => void
  telemetry: Pick<ForecastStressTelemetry, 'emit'> & Partial<Pick<ForecastStressTelemetry, 'currentContext'>>
}

function buildDefaultLogPayload(data: Record<string, string | number | boolean | null>) {
  return Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
}

function logForecastEvent(event: string, data: Record<string, string | number | boolean | null>) {
  console.info(`[${event}] ${buildDefaultLogPayload(data)}`)
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asSelectionMetadata(value: unknown): ForecastSelectionMetadata | null {
  return isJsonObject(value) ? (value as unknown as ForecastSelectionMetadata) : null
}

function asFailureArray(value: unknown): ForecastVerificationFailure[] {
  return Array.isArray(value) ? (value as ForecastVerificationFailure[]) : []
}

function isUserFacingModel(modelId: string) {
  return USER_FACING_FORECAST_MODELS.includes(modelId as (typeof USER_FACING_FORECAST_MODELS)[number])
}

function resolveCapabilityIdentity(targetBasis: ForecastTargetBasis, methodVersion?: string) {
  const method = resolveForecastMethodContract(targetBasis)

  return {
    targetSemantics: method.targetSemantics,
    methodId: method.methodId,
    methodVersion: methodVersion ?? method.methodVersion,
  }
}

function resolveArtifactCadenceContext(input: ForecastServiceRequest): {
  cadence: ForecastCadence | null
  frequencyIdentity: string
} {
  const hasSourceFrequency = input.sourceFrequency !== undefined
  const hasTargetCadence = input.targetCadence !== undefined

  if (hasSourceFrequency !== hasTargetCadence) {
    throw new Error('Forecast artifact identity requires sourceFrequency and targetCadence together.')
  }

  if (input.sourceFrequency && input.targetCadence) {
    const cadence = createForecastCadence(input.sourceFrequency, input.targetCadence)
    return {
      cadence,
      frequencyIdentity: buildForecastArtifactCadenceIdentity(cadence),
    }
  }

  return {
    cadence: null,
    frequencyIdentity: input.targetBasis === 'POINT_IN_TIME'
      ? 'DAILY'
      : LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
  }
}

function preparationIdentityFromHistory(history: ForecastBridgeHistory): ForecastPreparationIdentity | null {
  if (!history.canonicalization) {
    return {
      method: 'UNRESOLVED_SOURCE_PREPARATION',
      version: 'legacy-unresolved',
      provenanceStatus: 'LEGACY_UNRESOLVED',
    }
  }

  return {
    method: history.canonicalization.method,
    version: history.canonicalization.version,
    provenanceStatus: 'PROVEN',
  }
}

export function buildForecastHistoryFingerprint(history: ForecastBridgeHistory, cadence?: ForecastCadence) {
  return buildCanonicalForecastHistoryFingerprint({ ...history, cadence })
}

function historySummaryFromBridge(history: ForecastBridgeHistory): ForecastHistorySummary {
  return {
    frequency: history.frequency,
    start: history.start,
    end: history.end,
    observations: history.observations,
  }
}

function normalizeVerificationMetrics(
  metrics: ForecastBridgeVerificationMetricPayload | null,
): ForecastVerificationMetrics | null {
  if (!metrics) {
    return null
  }

  return {
    mae: metrics.mae,
    rmse: metrics.rmse,
    mase: metrics.mase,
    smape: metrics.smape,
    directionalAccuracy: metrics.directional_accuracy,
    bias: metrics.bias,
  }
}

function buildActualObservedAtByTargetDate(
  history: ForecastBridgeHistory,
  targetBasis: ForecastTargetBasis,
) {
  const actualObservedAtByTargetDate = new Map<string, string>()

  if (targetBasis !== 'END_OF_PERIOD') {
    return actualObservedAtByTargetDate
  }

  for (const point of history.points) {
    const targetDateKey = normalizePeriodIdentityKey(point.date)
    if (point.sourceObservedAt && targetDateKey) {
      actualObservedAtByTargetDate.set(targetDateKey, point.sourceObservedAt)
    }
  }

  return actualObservedAtByTargetDate
}

function resolveVerificationRecordActualObservedAt(
  record: ForecastVerificationRecord,
  actualObservedAtByTargetDate: Map<string, string>,
  targetBasis: ForecastTargetBasis,
) {
  if (record.actualObservedAt) {
    return record.actualObservedAt
  }

  if (targetBasis !== 'END_OF_PERIOD') {
    return null
  }

  const targetDateKey = normalizePeriodIdentityKey(record.forecastDate)
  return (targetDateKey ? actualObservedAtByTargetDate.get(targetDateKey) : null) ?? null
}

function toPrismaNullableJson(value: Prisma.InputJsonValue | null) {
  return value === null ? Prisma.JsonNull : value
}

function toPrismaJsonArray(value: ForecastVerificationFailure[]) {
  return value as unknown as Prisma.InputJsonValue
}

function resolveVerificationHorizonSteps(payload: {
  records: ForecastVerificationRecord[]
  failures: ForecastVerificationFailure[]
}) {
  return payload.records[0]?.horizonSteps ?? payload.failures[0]?.horizonSteps ?? 0
}

function parseIsoDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizePeriodIdentityKey(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = parseIsoDate(value)
  if (parsed) {
    return parsed.toISOString()
  }

  const trimmed = value.trim()
  return trimmed.length >= 10 ? `${trimmed.slice(0, 10)}T00:00:00.000Z` : trimmed
}

function resolveFirstCurrentForecastPoint(currentForecast: Record<string, ForecastCurrentPoint>) {
  return (
    [...Object.values(currentForecast)].sort((left, right) => {
      if (left.horizonSteps !== right.horizonSteps) {
        return left.horizonSteps - right.horizonSteps
      }

      const leftTime = parseIsoDate(left.forecastDate)?.getTime() ?? Number.POSITIVE_INFINITY
      const rightTime = parseIsoDate(right.forecastDate)?.getTime() ?? Number.POSITIVE_INFINITY
      return leftTime - rightTime
    })[0] ?? null
  )
}

function buildCurrentAlignment(artifact: PersistedCurrentArtifact): ForecastCurrentAlignment {
  const firstPoint = resolveFirstCurrentForecastPoint(artifact.currentForecast)
  const lastHistoricalPeriod = artifact.history.end
  const forecastOrigin = artifact.forecastOrigin
  const firstForecastTarget = firstPoint?.forecastDate ?? null

  let status: ForecastCurrentAlignment['status'] = 'INDETERMINATE'

  if (lastHistoricalPeriod && forecastOrigin) {
    if (lastHistoricalPeriod !== forecastOrigin) {
      status = 'UNALIGNED'
    } else if (!firstPoint) {
      status = 'INDETERMINATE'
    } else if (firstPoint.horizonSteps !== 1) {
      status = 'UNALIGNED'
    } else {
      const forecastOriginTime = parseIsoDate(forecastOrigin)?.getTime() ?? null
      const firstTargetTime = parseIsoDate(firstForecastTarget)?.getTime() ?? null

      if (forecastOriginTime === null || firstTargetTime === null) {
        status = 'INDETERMINATE'
      } else {
        status = firstTargetTime > forecastOriginTime ? 'ALIGNED' : 'UNALIGNED'
      }
    }
  }

  return {
    status,
    trainingFrequency: artifact.history.frequency,
    lastHistoricalPeriod,
    forecastOrigin,
    firstForecastTarget,
  }
}

function toCurrentAvailable(
  artifact: PersistedCurrentArtifact,
  cacheStatus: BenchmarkForecastCurrentAvailableResult['cacheStatus'],
): BenchmarkForecastCurrentAvailableResult {
  return {
    status: 'AVAILABLE',
    seriesId: artifact.seriesId,
    modelId: artifact.modelId,
    userFacingModel: isUserFacingModel(artifact.modelId),
    displayName: artifact.displayName,
    description: artifact.description,
    targetBasis: artifact.targetBasis,
    targetSemantics: artifact.targetSemantics,
    methodId: artifact.methodId,
    methodVersion: artifact.methodVersion,
    source: artifact.source,
    lineage: {
      inputSource: artifact.source.kind,
      inputRunId: artifact.source.runId,
      sourceSeriesId: artifact.seriesId,
      sourceFrequency: artifact.cadence?.sourceFrequency ?? artifact.history.frequency,
      historyFingerprint: artifact.historyFingerprint,
      preparation: artifact.preparation,
    },
    historyFingerprint: artifact.historyFingerprint,
    history: artifact.history,
    forecastOrigin: artifact.forecastOrigin,
    runtimeSeconds: artifact.runtimeSeconds,
    cacheStatus,
    alignment: buildCurrentAlignment(artifact),
    currentForecast: artifact.currentForecast,
  }
}

function toVerificationAvailable(
  artifact: PersistedVerificationArtifact,
  cacheStatus: BenchmarkForecastVerificationAvailableResult['cacheStatus'],
): BenchmarkForecastVerificationAvailableResult {
  return {
    status: 'AVAILABLE',
    seriesId: artifact.seriesId,
    modelId: artifact.modelId,
    userFacingModel: isUserFacingModel(artifact.modelId),
    displayName: artifact.displayName,
    description: artifact.description,
    targetBasis: artifact.targetBasis,
    targetSemantics: artifact.targetSemantics,
    methodId: artifact.methodId,
    methodVersion: artifact.methodVersion,
    source: artifact.source,
    lineage: {
      inputSource: artifact.source.kind,
      inputRunId: artifact.source.runId,
      sourceSeriesId: artifact.seriesId,
      sourceFrequency: artifact.cadence?.sourceFrequency ?? artifact.history.frequency,
      historyFingerprint: artifact.historyFingerprint,
      preparation: artifact.preparation,
    },
    historyFingerprint: artifact.historyFingerprint,
    history: artifact.history,
    forecastOrigin: artifact.forecastOrigin,
    runtimeSeconds: artifact.runtimeSeconds,
    cacheStatus,
    verification: artifact.verification,
  }
}

function verificationArtifactNeedsRebuild(artifact: PersistedVerificationArtifact) {
  if (artifact.targetBasis !== 'END_OF_PERIOD') {
    return false
  }

  for (const horizon of Object.values(artifact.verification)) {
    for (const record of horizon.records) {
      if (record.actualObservedAt === null) {
        return true
      }
    }
  }

  return false
}

function toUnsupportedResult(
  response: ForecastBridgeUnsupported,
  input: ForecastServiceRequest,
): ForecastUnsupportedResult {
  const identity = resolveCapabilityIdentity(input.targetBasis, response.methodVersion)

  return {
    status: 'UNSUPPORTED',
    seriesId: response.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    reason: response.reason,
    supportedSeriesIds: response.supportedSeriesIds,
    supportedModels: response.supportedModels,
    methodVersion: response.methodVersion,
    source: response.source
      ? {
          kind: response.source.kind,
          runId: response.source.runId,
        }
      : undefined,
  }
}

function toTargetBasisUnsupportedResult(input: ForecastServiceRequest): ForecastUnsupportedResult {
  const identity = resolveCapabilityIdentity(input.targetBasis)

  return {
    status: 'UNSUPPORTED',
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    reason: `Forecast targetBasis ${input.targetBasis} is recognized but not yet compute-enabled.`,
    supportedSeriesIds: [input.seriesId],
    supportedModels: [...USER_FACING_FORECAST_MODELS],
  }
}

function mapCurrentArtifact(
  response: ForecastBridgeCurrentAvailable,
  targetBasis: ForecastTargetBasis,
  cadenceContext: ReturnType<typeof resolveArtifactCadenceContext>,
): PersistedCurrentArtifact {
  const identity = resolveCapabilityIdentity(targetBasis, response.methodVersion)

  return {
    seriesId: response.benchmark.seriesId,
    modelId: response.model.id,
    displayName: response.result.history.benchmarkName,
    description: normalizeOptionalString(response.result.history.description),
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    methodVersion: identity.methodVersion,
    source: {
      kind: response.source.kind,
      runId: response.source.runId,
    },
    historyFingerprint: buildForecastHistoryFingerprint(response.result.history, cadenceContext.cadence ?? undefined),
    cadence: cadenceContext.cadence,
    frequencyIdentity: cadenceContext.frequencyIdentity,
    preparation: preparationIdentityFromHistory(response.result.history),
    history: historySummaryFromBridge(response.result.history),
    forecastOrigin: response.result.history.end,
    runtimeSeconds: response.result.runtimeSeconds,
    currentForecast: Object.fromEntries(
      Object.entries(response.result.currentForecast).sort(([, left], [, right]) => left.horizonSteps - right.horizonSteps),
    ),
  }
}

function mapVerificationArtifact(
  response: ForecastBridgeVerificationAvailable,
  targetBasis: ForecastTargetBasis,
  authoritativeHistory: ForecastBridgeHistory,
  cadenceContext: ReturnType<typeof resolveArtifactCadenceContext>,
): PersistedVerificationArtifact {
  const identity = resolveCapabilityIdentity(targetBasis, response.methodVersion)
  const actualObservedAtByTargetDate = buildActualObservedAtByTargetDate(authoritativeHistory, targetBasis)
  const verification = Object.fromEntries(
    Object.entries(response.result.backtest)
      .sort(([, left], [, right]) => resolveVerificationHorizonSteps(left) - resolveVerificationHorizonSteps(right))
      .map(([horizon, payload]) => [
        horizon,
        {
          horizon,
          horizonSteps: resolveVerificationHorizonSteps(payload),
          origins: payload.origins,
          expectedOrigins: payload.expectedOrigins,
          successfulOrigins: payload.successfulOrigins,
          failedOrigins: payload.failedOrigins,
          coverage: payload.coverage,
          metrics: normalizeVerificationMetrics(payload.metrics),
          records: payload.records.map((record) => ({
            ...record,
            actualObservedAt: resolveVerificationRecordActualObservedAt(
              record,
              actualObservedAtByTargetDate,
              targetBasis,
            ),
          })),
          failures: payload.failures,
        } satisfies ForecastVerificationHorizon,
      ]),
  )

  return {
    seriesId: response.benchmark.seriesId,
    modelId: response.model.id,
    displayName: response.result.history.benchmarkName,
    description: normalizeOptionalString(response.result.history.description),
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    methodVersion: identity.methodVersion,
    source: {
      kind: response.source.kind,
      runId: response.source.runId,
    },
    historyFingerprint: buildForecastHistoryFingerprint(authoritativeHistory, cadenceContext.cadence ?? undefined),
    cadence: cadenceContext.cadence,
    frequencyIdentity: cadenceContext.frequencyIdentity,
    preparation: preparationIdentityFromHistory(authoritativeHistory),
    history: historySummaryFromBridge(authoritativeHistory),
    forecastOrigin: authoritativeHistory.end,
    runtimeSeconds: response.result.runtimeSeconds,
    verification,
  }
}

function resolveForecastBridgeConfiguration() {
  const labRoot = normalizeOptionalString(serverEnv.FORECASTING_LAB_ROOT) ?? DEFAULT_FORECASTING_LAB_ROOT
  const pythonBin = normalizeOptionalString(serverEnv.FORECASTING_PYTHON_BIN) ?? DEFAULT_FORECASTING_PYTHON
  const scriptPath = path.join(labRoot, ...FORECASTING_BRIDGE_SCRIPT)

  if (!existsSync(labRoot)) {
    return {
      ok: false as const,
      reason: `Forecasting laboratory root is unavailable at ${labRoot}.`,
    }
  }

  if (!existsSync(scriptPath)) {
    return {
      ok: false as const,
      reason: `Forecasting bridge script is unavailable at ${scriptPath}.`,
    }
  }

  if (!existsSync(pythonBin)) {
    return {
      ok: false as const,
      reason: `Forecasting Python interpreter is unavailable at ${pythonBin}.`,
    }
  }

  return {
    ok: true as const,
    labRoot,
    pythonBin,
    scriptPath,
  }
}

async function executeForecastBridge(
  configuration: ForecastBridgeReadyConfiguration,
  mode: ForecastBridgeMode,
  seriesId: string,
  modelId?: string,
  extraArgs: string[] = [],
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  const args = [configuration.scriptPath, '--mode', mode, '--series-id', seriesId, ...extraArgs]
  if (modelId) {
    args.push('--model', modelId)
  }

  try {
    const { stdout, stderr } = await execFileAsync(configuration.pythonBin, args, {
      cwd: configuration.labRoot,
      maxBuffer: BRIDGE_BUFFER_BYTES,
    })

    const payload = JSON.parse(stdout) as
      | ForecastHistoryBridgeResponse
      | ForecastCurrentBridgeResponse
      | ForecastVerificationBridgeResponse

    if (payload.status === 'FAILED' && stderr.trim().length > 0) {
      payload.reason = `${payload.reason} | stderr: ${stderr.trim()}`
    }

    return payload
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forecast bridge invocation failed.'

    if (message.includes('ENOENT')) {
      return {
        status: 'NOT_AVAILABLE',
        reason: message,
      }
    }

    return {
      status: 'FAILED',
      reason: message,
      seriesId,
      model: modelId ?? null,
    }
  }
}

async function executeLiveForecastBridge(
  configuration: ForecastBridgeReadyConfiguration,
  mode: ForecastBridgeMode,
  seriesId: string,
  targetBasis: ForecastTargetBasis,
  modelId?: string,
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  try {
    const payload = await loadLiveForecastBridgePayload(seriesId, { targetBasis })
    if (!payload) {
      return {
        status: 'UNSUPPORTED',
        reason: `Forecast targetBasis ${targetBasis} requires an implemented lawful source adapter.`,
        seriesId,
        supportedSeriesIds: [seriesId],
        supportedModels: [...USER_FACING_FORECAST_MODELS],
      }
    }

    const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-runtime-forecast-'))
    const historyPath = path.join(tempDir, `${seriesId}.json`)
    await writeFile(historyPath, JSON.stringify(payload), 'utf8')

    try {
      return await executeForecastBridge(configuration, mode, seriesId, modelId, ['--history-json', historyPath])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    return {
      status: 'FAILED',
      reason: error instanceof Error ? error.message : 'Live forecast input bridge invocation failed.',
      seriesId,
      model: modelId ?? null,
    }
  }
}

async function executePreparedLiveForecastBridge(
  configuration: ForecastBridgeReadyConfiguration,
  payload: LiveForecastBridgePayload,
  mode: ForecastBridgeMode,
  seriesId: string,
  modelId?: string,
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-runtime-forecast-'))
  const historyPath = path.join(tempDir, `${seriesId}.json`)

  try {
    await writeFile(historyPath, JSON.stringify(payload), 'utf8')
    return await executeForecastBridge(configuration, mode, seriesId, modelId, ['--history-json', historyPath])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function prepareExecutionContext(
  input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>,
): Promise<ForecastPreparedExecutionContext | null> {
  const configuration = resolveForecastBridgeConfiguration()
  if (!configuration.ok) {
    return null
  }

  const payload = await loadLiveForecastBridgePayload(input.seriesId, {
    targetBasis: input.targetBasis,
    targetCadence: input.targetCadence,
  })
  if (!payload) {
    return null
  }

  const currentPayload = selectLatestCurrentForecastMonthlyTrainingPayload(payload)

  return {
    exportHistory(mode = 'verification') {
      return executePreparedLiveForecastBridge(
        configuration,
        mode === 'current' ? currentPayload : payload,
        'history',
        input.seriesId,
      ) as Promise<ForecastHistoryBridgeResponse>
    },
    exportCurrent(modelId) {
      return executePreparedLiveForecastBridge(
        configuration,
        currentPayload,
        'current',
        input.seriesId,
        modelId,
      ) as Promise<ForecastCurrentBridgeResponse>
    },
    exportVerification(modelId) {
      return executePreparedLiveForecastBridge(
        configuration,
        payload,
        'verification',
        input.seriesId,
        modelId,
      ) as Promise<ForecastVerificationBridgeResponse>
    },
  }
}

async function runForecastBridge(
  mode: ForecastBridgeMode,
  seriesId: string,
  targetBasis: ForecastTargetBasis,
  modelId?: string,
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  const configuration = resolveForecastBridgeConfiguration()
  if (!configuration.ok) {
    return {
      status: 'NOT_AVAILABLE',
      reason: configuration.reason,
    }
  }

  const dailyResult = await executeLiveForecastBridge(configuration, mode, seriesId, targetBasis, modelId)
  if (dailyResult.status !== 'UNSUPPORTED') {
    return dailyResult
  }

  if (targetBasis !== DEFAULT_FORECAST_TARGET_BASIS) {
    return dailyResult
  }

  return executeForecastBridge(configuration, mode, seriesId, modelId)
}

function createDefaultBridge(): ForecastBridge {
  return {
    prepareExecutionContext(input) {
      return prepareExecutionContext(input)
    },
    exportHistory(input) {
      return runForecastBridge('history', input.seriesId, input.targetBasis) as Promise<ForecastHistoryBridgeResponse>
    },
    exportCurrent(input) {
      return runForecastBridge('current', input.seriesId, input.targetBasis, input.modelId) as Promise<ForecastCurrentBridgeResponse>
    },
    exportVerification(input) {
      return runForecastBridge('verification', input.seriesId, input.targetBasis, input.modelId) as Promise<ForecastVerificationBridgeResponse>
    },
  }
}

export async function readCurrentRunFromPrisma(key: ForecastCacheLookupKey): Promise<PersistedCurrentArtifact | null> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const run = await prisma.forecastCurrentRun.findFirst({
    where: {
      seriesId: key.seriesId,
      inputSource: key.inputSource,
      historyFingerprint: key.historyFingerprint,
      targetBasis: key.targetBasis,
      methodId: key.methodId,
      modelId: key.modelId,
      methodVersion: key.methodVersion,
      frequency: key.frequencyIdentity,
    },
    include: {
      points: {
        orderBy: [
          { horizonSteps: 'asc' },
          { forecastDate: 'asc' },
        ],
      },
    },
  })

  if (!run) {
    return null
  }

  const currentForecast = Object.fromEntries(
    run.points.map((point) => [
      point.horizonLabel,
      {
        horizon: point.horizonLabel,
        horizonSteps: point.horizonSteps,
        forecastDate: point.forecastDate.toISOString(),
        forecastValue: point.forecastValue === null ? null : Number(point.forecastValue),
        metadata: asSelectionMetadata(point.metadataJson),
        failureReason: point.failureReason,
      } satisfies ForecastCurrentPoint,
    ]),
  )
  const storedCadence = parseForecastArtifactCadenceIdentity(run.frequency)

  return {
    seriesId: run.seriesId,
    modelId: run.modelId,
    displayName: run.displayName,
    description: run.description,
    targetBasis: run.targetBasis,
    targetSemantics: key.targetSemantics,
    methodId: key.methodId,
    methodVersion: run.methodVersion,
    source: {
      kind: run.inputSource,
      runId: run.inputRunId,
    },
    historyFingerprint: run.historyFingerprint,
    cadence: storedCadence && !storedCadence.legacyMonthly
      ? createForecastCadence(storedCadence.sourceFrequency, storedCadence.targetCadence)
      : null,
    frequencyIdentity: run.frequency ?? key.frequencyIdentity,
    preparation: null,
    history: {
      frequency: storedCadence?.targetCadence ?? run.frequency,
      start: run.historyStartAt?.toISOString() ?? null,
      end: run.historyEndAt?.toISOString() ?? null,
      observations: run.observationCount,
    },
    forecastOrigin: run.forecastOriginAt?.toISOString() ?? run.historyEndAt?.toISOString() ?? null,
    runtimeSeconds: run.runtimeSeconds,
    currentForecast,
  }
}

export async function writeCurrentRunWithPrisma(artifact: PersistedCurrentArtifact) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  await prisma.$transaction(async (tx) => {
    const run = await tx.forecastCurrentRun.upsert({
      where: {
        seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion: {
          seriesId: artifact.seriesId,
          inputSource: artifact.source.kind,
          historyFingerprint: artifact.historyFingerprint,
          targetBasis: artifact.targetBasis,
          methodId: artifact.methodId,
          modelId: artifact.modelId,
          methodVersion: artifact.methodVersion,
        },
      },
      create: {
        seriesId: artifact.seriesId,
        displayName: artifact.displayName,
        description: artifact.description,
        frequency: artifact.frequencyIdentity,
        currency: null,
        unit: null,
        sourceLabel: null,
        inputSource: artifact.source.kind,
        inputRunId: artifact.source.runId,
        historyFingerprint: artifact.historyFingerprint,
        targetBasis: artifact.targetBasis,
        methodId: artifact.methodId,
        historyStartAt: artifact.history.start ? new Date(artifact.history.start) : null,
        historyEndAt: artifact.history.end ? new Date(artifact.history.end) : null,
        observationCount: artifact.history.observations,
        forecastOriginAt: artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null,
        modelId: artifact.modelId,
        methodVersion: artifact.methodVersion,
        status: 'AVAILABLE',
        failureReason: null,
        runtimeSeconds: artifact.runtimeSeconds,
      },
      update: {
        displayName: artifact.displayName,
        description: artifact.description,
        frequency: artifact.frequencyIdentity,
        inputRunId: artifact.source.runId,
        historyStartAt: artifact.history.start ? new Date(artifact.history.start) : null,
        historyEndAt: artifact.history.end ? new Date(artifact.history.end) : null,
        observationCount: artifact.history.observations,
        targetBasis: artifact.targetBasis,
        methodId: artifact.methodId,
        forecastOriginAt: artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null,
        status: 'AVAILABLE',
        failureReason: null,
        runtimeSeconds: artifact.runtimeSeconds,
      },
    })

    await tx.forecastCurrentPoint.deleteMany({
      where: {
        runId: run.id,
      },
    })

    const points = Object.values(artifact.currentForecast)
    if (points.length > 0) {
      await tx.forecastCurrentPoint.createMany({
        data: points.map((point) => ({
          runId: run.id,
          horizonLabel: point.horizon,
          horizonSteps: point.horizonSteps,
          forecastDate: new Date(point.forecastDate),
          forecastValue: point.forecastValue === null ? null : normalizeForecastLibraryDecimal(point.forecastValue),
          fitStatus: point.metadata?.fitStatus ?? null,
          failureReason: point.failureReason ?? point.metadata?.failureReason ?? null,
          selectedVariant: point.metadata?.selectedVariant ?? null,
          selectionMetric: point.metadata?.selectionMetric ?? null,
          selectionScore: point.metadata?.selectionScore ?? null,
          metadataJson: toPrismaNullableJson(point.metadata as unknown as Prisma.InputJsonValue | null),
        })),
      })
    }
  })
}

export async function readVerificationRunFromPrisma(key: ForecastCacheLookupKey): Promise<PersistedVerificationArtifact | null> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const run = await prisma.forecastVerificationRun.findFirst({
    where: {
      seriesId: key.seriesId,
      inputSource: key.inputSource,
      historyFingerprint: key.historyFingerprint,
      targetBasis: key.targetBasis,
      methodId: key.methodId,
      modelId: key.modelId,
      methodVersion: key.methodVersion,
      frequency: key.frequencyIdentity,
    },
    include: {
      metrics: {
        orderBy: {
          horizonSteps: 'asc',
        },
      },
      points: {
        orderBy: [
          { horizonSteps: 'asc' },
          { forecastOriginAt: 'asc' },
          { targetDate: 'asc' },
        ],
      },
    },
  })

  if (!run) {
    return null
  }

  const pointsByHorizon = new Map<string, ForecastVerificationRecord[]>()
  for (const point of run.points) {
    const records = pointsByHorizon.get(point.horizonLabel) ?? []
    records.push({
      benchmarkId: run.seriesId,
      modelId: run.modelId,
      forecastOrigin: point.forecastOriginAt.toISOString(),
      horizon: point.horizonLabel,
      horizonSteps: point.horizonSteps,
      forecastDate: point.targetDate.toISOString(),
      actualObservedAt: point.actualObservedAt?.toISOString() ?? null,
      originValue: Number(point.originValue),
      forecastValue: Number(point.forecastValue),
      actualValue: Number(point.actualValue),
      error: Number(point.errorValue),
      absoluteError: Number(point.absoluteErrorValue),
      delta: Number(point.deltaValue),
      deltaPct: point.deltaPct,
      maseScale: point.maseScale,
      metadata: asSelectionMetadata(point.metadataJson),
    })
    pointsByHorizon.set(point.horizonLabel, records)
  }

  const verification = Object.fromEntries(
    run.metrics.map((metric) => {
      const metricsPresent = [metric.mae, metric.rmse, metric.mase, metric.smape, metric.directionalAccuracy, metric.bias]
        .some((value) => value !== null)

      return [
        metric.horizonLabel,
        {
          horizon: metric.horizonLabel,
          horizonSteps: metric.horizonSteps,
          origins: metric.origins,
          expectedOrigins: metric.expectedOrigins,
          successfulOrigins: metric.origins,
          failedOrigins: metric.failedOrigins,
          coverage: metric.coverage,
          metrics: metricsPresent
            ? {
                mae: metric.mae,
                rmse: metric.rmse,
                mase: metric.mase,
                smape: metric.smape,
                directionalAccuracy: metric.directionalAccuracy,
                bias: metric.bias,
              }
            : null,
          records: pointsByHorizon.get(metric.horizonLabel) ?? [],
          failures: asFailureArray(metric.failureSummaryJson),
        } satisfies ForecastVerificationHorizon,
      ]
    }),
  )
  const storedCadence = parseForecastArtifactCadenceIdentity(run.frequency)

  return {
    seriesId: run.seriesId,
    modelId: run.modelId,
    displayName: run.displayName,
    description: run.description,
    targetBasis: run.targetBasis,
    targetSemantics: key.targetSemantics,
    methodId: key.methodId,
    methodVersion: run.methodVersion,
    source: {
      kind: run.inputSource,
      runId: run.inputRunId,
    },
    historyFingerprint: run.historyFingerprint,
    cadence: storedCadence && !storedCadence.legacyMonthly
      ? createForecastCadence(storedCadence.sourceFrequency, storedCadence.targetCadence)
      : null,
    frequencyIdentity: run.frequency ?? key.frequencyIdentity,
    preparation: null,
    history: {
      frequency: storedCadence?.targetCadence ?? run.frequency,
      start: run.historyStartAt?.toISOString() ?? null,
      end: run.historyEndAt?.toISOString() ?? null,
      observations: run.observationCount,
    },
    forecastOrigin: run.forecastOriginAt?.toISOString() ?? run.historyEndAt?.toISOString() ?? null,
    runtimeSeconds: run.runtimeSeconds,
    verification,
  }
}

export async function writeVerificationRunWithPrisma(artifact: PersistedVerificationArtifact) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  await prisma.$transaction(async (tx) => {
    const run = await tx.forecastVerificationRun.upsert({
      where: {
        seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion: {
          seriesId: artifact.seriesId,
          inputSource: artifact.source.kind,
          historyFingerprint: artifact.historyFingerprint,
          targetBasis: artifact.targetBasis,
          methodId: artifact.methodId,
          modelId: artifact.modelId,
          methodVersion: artifact.methodVersion,
        },
      },
      create: {
        seriesId: artifact.seriesId,
        displayName: artifact.displayName,
        description: artifact.description,
        frequency: artifact.frequencyIdentity,
        currency: null,
        unit: null,
        sourceLabel: null,
        inputSource: artifact.source.kind,
        inputRunId: artifact.source.runId,
        historyFingerprint: artifact.historyFingerprint,
        targetBasis: artifact.targetBasis,
        methodId: artifact.methodId,
        historyStartAt: artifact.history.start ? new Date(artifact.history.start) : null,
        historyEndAt: artifact.history.end ? new Date(artifact.history.end) : null,
        observationCount: artifact.history.observations,
        forecastOriginAt: artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null,
        modelId: artifact.modelId,
        methodVersion: artifact.methodVersion,
        status: 'AVAILABLE',
        failureReason: null,
        runtimeSeconds: artifact.runtimeSeconds,
      },
      update: {
        displayName: artifact.displayName,
        description: artifact.description,
        frequency: artifact.frequencyIdentity,
        inputRunId: artifact.source.runId,
        historyStartAt: artifact.history.start ? new Date(artifact.history.start) : null,
        historyEndAt: artifact.history.end ? new Date(artifact.history.end) : null,
        observationCount: artifact.history.observations,
        targetBasis: artifact.targetBasis,
        methodId: artifact.methodId,
        forecastOriginAt: artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null,
        status: 'AVAILABLE',
        failureReason: null,
        runtimeSeconds: artifact.runtimeSeconds,
      },
    })

    await tx.forecastVerificationMetric.deleteMany({
      where: {
        runId: run.id,
      },
    })

    await tx.forecastVerificationPoint.deleteMany({
      where: {
        runId: run.id,
      },
    })

    const verificationEntries = Object.values(artifact.verification)
    if (verificationEntries.length > 0) {
      await tx.forecastVerificationMetric.createMany({
        data: verificationEntries.map((horizon) => ({
          runId: run.id,
          horizonLabel: horizon.horizon,
          horizonSteps: horizon.horizonSteps,
          origins: horizon.origins,
          expectedOrigins: horizon.expectedOrigins,
          failedOrigins: horizon.failedOrigins,
          coverage: horizon.coverage,
          mae: horizon.metrics?.mae ?? null,
          rmse: horizon.metrics?.rmse ?? null,
          mase: horizon.metrics?.mase ?? null,
          smape: horizon.metrics?.smape ?? null,
          directionalAccuracy: horizon.metrics?.directionalAccuracy ?? null,
          bias: horizon.metrics?.bias ?? null,
          failureSummaryJson: toPrismaJsonArray(horizon.failures),
        })),
      })

      const points = verificationEntries.flatMap((horizon) =>
        horizon.records.map((record) => {
          const normalizedValues = buildVerificationPersistenceDecimals(record)

          return {
            runId: run.id,
            horizonLabel: horizon.horizon,
            horizonSteps: horizon.horizonSteps,
            forecastOriginAt: new Date(record.forecastOrigin),
            targetDate: new Date(record.forecastDate),
            actualObservedAt: record.actualObservedAt ? new Date(record.actualObservedAt) : null,
            originValue: normalizedValues.originValue,
            forecastValue: normalizedValues.forecastValue,
            actualValue: normalizedValues.actualValue,
            errorValue: normalizedValues.errorValue,
            absoluteErrorValue: normalizedValues.absoluteErrorValue,
            deltaValue: normalizedValues.deltaValue,
            deltaPct: record.deltaPct,
            maseScale: record.maseScale,
            selectedVariant: record.metadata?.selectedVariant ?? null,
            selectionMetric: record.metadata?.selectionMetric ?? null,
            selectionScore: record.metadata?.selectionScore ?? null,
            metadataJson: toPrismaNullableJson(record.metadata as unknown as Prisma.InputJsonValue | null),
          }
        }),
      )

      if (points.length > 0) {
        await tx.forecastVerificationPoint.createMany({
          data: points,
        })
      }
    }
  })
}

async function readLatestCurrentRunFromPrisma(key: ForecastPreparedLookupKey) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const latest = await prisma.forecastCurrentRun.findFirst({
    where: {
      seriesId: key.seriesId,
      targetBasis: key.targetBasis,
      methodId: key.methodId,
      modelId: key.modelId,
      methodVersion: key.methodVersion,
      frequency: key.frequencyIdentity,
      status: 'AVAILABLE',
    },
    select: {
      inputSource: true,
      historyFingerprint: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return latest
    ? readCurrentRunFromPrisma({ ...key, ...latest })
    : null
}

async function readLatestVerificationRunFromPrisma(key: ForecastPreparedLookupKey) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const latest = await prisma.forecastVerificationRun.findFirst({
    where: {
      seriesId: key.seriesId,
      targetBasis: key.targetBasis,
      methodId: key.methodId,
      modelId: key.modelId,
      methodVersion: key.methodVersion,
      frequency: key.frequencyIdentity,
      status: 'AVAILABLE',
    },
    select: {
      inputSource: true,
      historyFingerprint: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return latest
    ? readVerificationRunFromPrisma({ ...key, ...latest })
    : null
}

function createDefaultRepository(): ForecastLibraryRepository {
  return {
    readCurrentRun: readCurrentRunFromPrisma,
    writeCurrentRun: writeCurrentRunWithPrisma,
    readVerificationRun: readVerificationRunFromPrisma,
    writeVerificationRun: writeVerificationRunWithPrisma,
    readLatestCurrentRun: readLatestCurrentRunFromPrisma,
    readLatestVerificationRun: readLatestVerificationRunFromPrisma,
  }
}

export function createForecastLibraryService(
  dependencies: Partial<ForecastLibraryServiceDependencies> = {},
) {
  const resolvedDependencies: ForecastLibraryServiceDependencies = {
    repository: dependencies.repository ?? createDefaultRepository(),
    bridge: dependencies.bridge ?? createDefaultBridge(),
    logEvent: dependencies.logEvent ?? logForecastEvent,
    telemetry: dependencies.telemetry ?? forecastStressTelemetry,
  }

  return {
    async readPreparedCurrentForecastRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastCurrentResult> {
      const startedAt = performance.now()
      const identity = resolveCapabilityIdentity(input.targetBasis)
      const cadenceContext = resolveArtifactCadenceContext(input)
      const prepared = await resolvedDependencies.repository.readLatestCurrentRun?.({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        ...identity,
      }) ?? null

      resolvedDependencies.telemetry.emit('prepared_read', {
        kind: 'current',
        hit: prepared !== null,
        durationMs: performance.now() - startedAt,
      })

      if (!prepared) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: No exact-identity prepared Current Forecast is available.',
        }
      }

      return toCurrentAvailable(prepared, 'hit')
    },

    async readPreparedVerificationRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastVerificationResult> {
      const startedAt = performance.now()
      const identity = resolveCapabilityIdentity(input.targetBasis)
      const cadenceContext = resolveArtifactCadenceContext(input)
      const prepared = await resolvedDependencies.repository.readLatestVerificationRun?.({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        ...identity,
      }) ?? null

      resolvedDependencies.telemetry.emit('prepared_read', {
        kind: 'verification',
        hit: prepared !== null,
        durationMs: performance.now() - startedAt,
      })

      if (!prepared) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: No exact-identity prepared Historical Verification is available.',
        }
      }

      return toVerificationAvailable(prepared, 'hit')
    },

    async resolveCurrentForecast(seriesId: string, modelId: string): Promise<BenchmarkForecastCurrentResult> {
      const input: ForecastServiceRequest = {
        seriesId,
        modelId,
        targetBasis: DEFAULT_FORECAST_TARGET_BASIS,
      }
      return this.resolveCurrentForecastRequest(input)
    },

    async resolveCurrentForecastRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastCurrentResult> {
      const startedAt = performance.now()
      const cadenceContext = resolveArtifactCadenceContext(input)
      const preparedExecutionContext = await resolvedDependencies.bridge.prepareExecutionContext?.({
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        sourceFrequency: input.sourceFrequency,
        targetCadence: input.targetCadence,
      }) ?? null

      const historyResponse = preparedExecutionContext
        ? await preparedExecutionContext.exportHistory('current')
        : await resolvedDependencies.bridge.exportHistory({
            seriesId: input.seriesId,
            targetBasis: input.targetBasis,
          sourceFrequency: input.sourceFrequency,
          targetCadence: input.targetCadence,
          })

      if (historyResponse.status === 'NOT_AVAILABLE') {
        const identity = resolveCapabilityIdentity(input.targetBasis)
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: historyResponse.reason,
        }
      }

      if (historyResponse.status === 'UNSUPPORTED') {
        return toUnsupportedResult(historyResponse, input)
      }

      if (historyResponse.status === 'FAILED') {
        const identity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
        return {
          status: 'FAILED',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: historyResponse.reason,
          methodVersion: historyResponse.methodVersion,
          source: historyResponse.source,
        }
      }

      const historyFingerprint = buildForecastHistoryFingerprint(historyResponse.history, cadenceContext.cadence ?? undefined)
      const methodIdentity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
      const cacheKey: ForecastCacheLookupKey = {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        inputSource: historyResponse.source.kind,
        historyFingerprint,
        targetBasis: input.targetBasis,
        frequencyIdentity: cadenceContext.frequencyIdentity,
      }

      let dbReadFailed = false
      try {
        const persisted = await resolvedDependencies.repository.readCurrentRun(cacheKey)
        if (persisted) {
          resolvedDependencies.telemetry.emit('prepared_read', {
            kind: 'current',
            hit: true,
            durationMs: performance.now() - startedAt,
          })
          resolvedDependencies.logEvent('FORECAST_LIBRARY_CURRENT', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            cacheStatus: 'hit',
            totalMs: Math.round(performance.now() - startedAt),
            dbFailure: false,
          })
          return toCurrentAvailable(persisted, 'hit')
        }
      } catch (error) {
        dbReadFailed = true
        resolvedDependencies.logEvent('FORECAST_LIBRARY_CURRENT', {
          seriesId: input.seriesId,
          modelId: input.modelId,
          cacheStatus: 'db-unavailable',
          totalMs: Math.round(performance.now() - startedAt),
          dbFailure: true,
          dbError: error instanceof Error ? error.message : 'unknown',
        })
      }

      resolvedDependencies.telemetry.emit('prepared_read', {
        kind: 'current',
        hit: false,
        durationMs: performance.now() - startedAt,
      })
      const sourceFrequency = cadenceContext.cadence?.sourceFrequency
        ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
      const targetCadence = cadenceContext.cadence?.targetCadence
        ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
      if (!sourceFrequency || !targetCadence) {
        throw new Error('Current single-flight identity requires lawful source and target cadence.')
      }
      const logicalArtifactKey = buildCurrentLogicalArtifactKey({
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        modelId: input.modelId,
        inputSource: historyResponse.source.kind,
        historyFingerprint,
        sourceFrequency,
        targetCadence,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        forecastOrigin: historyResponse.history.end,
        horizonConfigurationId: buildCurrentHorizonConfigurationId(
          historyResponse.history.end,
          targetCadence,
        ),
      })
      const requestId = resolvedDependencies.telemetry.currentContext?.()?.requestId ?? randomUUID()

      return runCurrentForecastSingleFlight<BenchmarkForecastCurrentResult>({
        logicalArtifactKey,
        requestId,
        emit(event, eventData) {
          resolvedDependencies.telemetry.emit(event, {
            logicalArtifactKey: eventData.logicalArtifactKey,
            operationFamily: eventData.operationFamily,
            ownerRequestId: eventData.ownerRequestId,
            requestId: eventData.requestId,
            role: eventData.role,
            activeCurrentSingleFlightEntries: eventData.activeCurrentSingleFlightEntries,
            durationMs: eventData.durationMs ?? null,
            error: eventData.error ?? null,
            seriesId: input.seriesId,
            modelId: input.modelId,
            targetSemantics: methodIdentity.targetSemantics,
            sourceFrequency,
            targetCadence,
          })
        },
        operation: async () => {
          const computeStartedAt = performance.now()
          resolvedDependencies.telemetry.emit('current_compute_start', {
            modelId: input.modelId,
            count: 1,
            logicalArtifactKey,
          })
          const currentResponse = preparedExecutionContext
            ? await preparedExecutionContext.exportCurrent(input.modelId)
            : await resolvedDependencies.bridge.exportCurrent(input)
          const computeDurationMs = performance.now() - computeStartedAt
          resolvedDependencies.telemetry.emit('current_compute_end', {
            modelId: input.modelId,
            count: 1,
            durationMs: computeDurationMs,
            status: currentResponse.status,
            logicalArtifactKey,
          })
          resolvedDependencies.telemetry.emit('model_fit', {
            operation: 'current',
            modelId: input.modelId,
            count: currentResponse.status === 'AVAILABLE' ? 1 : 0,
            durationMs: computeDurationMs,
          })

          if (currentResponse.status === 'NOT_AVAILABLE') {
            const identity = resolveCapabilityIdentity(input.targetBasis)
            return {
              status: 'NOT_AVAILABLE',
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              targetSemantics: identity.targetSemantics,
              methodId: identity.methodId,
              reason: currentResponse.reason,
            }
          }

          if (currentResponse.status === 'UNSUPPORTED') {
            return toUnsupportedResult(currentResponse, input)
          }

          if (currentResponse.status === 'FAILED') {
            const identity = resolveCapabilityIdentity(input.targetBasis, currentResponse.methodVersion)
            return {
              status: 'FAILED',
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              targetSemantics: identity.targetSemantics,
              methodId: identity.methodId,
              reason: currentResponse.reason,
              methodVersion: currentResponse.methodVersion,
              source: currentResponse.source,
              historyFingerprint,
            }
          }

          const artifact = mapCurrentArtifact(currentResponse, input.targetBasis, cadenceContext)
          const cacheStatus: BenchmarkForecastCurrentAvailableResult['cacheStatus'] = dbReadFailed ? 'db-unavailable' : 'miss'

          if (!dbReadFailed) {
            try {
              const persistStartedAt = performance.now()
              await resolvedDependencies.repository.writeCurrentRun(artifact)
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'current',
                artifactWrites: 1,
                pointWrites: Object.keys(artifact.currentForecast).length,
                verificationRecordWrites: 0,
                writeFailures: 0,
                durationMs: performance.now() - persistStartedAt,
              })
            } catch (error) {
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'current',
                artifactWrites: 0,
                pointWrites: 0,
                verificationRecordWrites: 0,
                writeFailures: 1,
              })
              resolvedDependencies.logEvent('FORECAST_LIBRARY_CURRENT', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                cacheStatus: 'persist-failed',
                totalMs: Math.round(performance.now() - startedAt),
                dbFailure: true,
                persistError: error instanceof Error ? error.message : 'unknown',
              })

              return toCurrentAvailable(artifact, 'persist-failed')
            }
          }

          resolvedDependencies.logEvent('FORECAST_LIBRARY_CURRENT', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            cacheStatus,
            totalMs: Math.round(performance.now() - startedAt),
            dbFailure: dbReadFailed,
          })

          return toCurrentAvailable(artifact, cacheStatus)
        }
      })
    },

    async resolveVerification(seriesId: string, modelId: string): Promise<BenchmarkForecastVerificationResult> {
      const input: ForecastServiceRequest = {
        seriesId,
        modelId,
        targetBasis: DEFAULT_FORECAST_TARGET_BASIS,
      }
      return this.resolveVerificationRequest(input)
    },

    async resolveVerificationRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastVerificationResult> {
      const startedAt = performance.now()
      const cadenceContext = resolveArtifactCadenceContext(input)
      const preparedExecutionContext = await resolvedDependencies.bridge.prepareExecutionContext?.({
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        sourceFrequency: input.sourceFrequency,
        targetCadence: input.targetCadence,
      }) ?? null

      const historyResponse = preparedExecutionContext
        ? await preparedExecutionContext.exportHistory('verification')
        : await resolvedDependencies.bridge.exportHistory({
            seriesId: input.seriesId,
            targetBasis: input.targetBasis,
          sourceFrequency: input.sourceFrequency,
          targetCadence: input.targetCadence,
          })

      if (historyResponse.status === 'NOT_AVAILABLE') {
        const identity = resolveCapabilityIdentity(input.targetBasis)
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: historyResponse.reason,
        }
      }

      if (historyResponse.status === 'UNSUPPORTED') {
        return toUnsupportedResult(historyResponse, input)
      }

      if (historyResponse.status === 'FAILED') {
        const identity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
        return {
          status: 'FAILED',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: historyResponse.reason,
          methodVersion: historyResponse.methodVersion,
          source: historyResponse.source,
        }
      }

      const historyFingerprint = buildForecastHistoryFingerprint(historyResponse.history, cadenceContext.cadence ?? undefined)
      const methodIdentity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
      const cacheKey: ForecastCacheLookupKey = {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        inputSource: historyResponse.source.kind,
        historyFingerprint,
        targetBasis: input.targetBasis,
        frequencyIdentity: cadenceContext.frequencyIdentity,
      }

      let dbReadFailed = false
      try {
        const persisted = await resolvedDependencies.repository.readVerificationRun(cacheKey)
        if (persisted) {
          if (verificationArtifactNeedsRebuild(persisted)) {
            resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
              seriesId: input.seriesId,
              modelId: input.modelId,
              cacheStatus: 'stale-rebuild',
              totalMs: Math.round(performance.now() - startedAt),
              dbFailure: false,
            })
          } else {
          resolvedDependencies.telemetry.emit('prepared_read', {
            kind: 'verification',
            hit: true,
            durationMs: performance.now() - startedAt,
          })
          resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            cacheStatus: 'hit',
            totalMs: Math.round(performance.now() - startedAt),
            dbFailure: false,
          })
          return toVerificationAvailable(persisted, 'hit')
          }
        }
      } catch (error) {
        dbReadFailed = true
        resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
          seriesId: input.seriesId,
          modelId: input.modelId,
          cacheStatus: 'db-unavailable',
          totalMs: Math.round(performance.now() - startedAt),
          dbFailure: true,
          dbError: error instanceof Error ? error.message : 'unknown',
        })
      }

      resolvedDependencies.telemetry.emit('prepared_read', {
        kind: 'verification',
        hit: false,
        durationMs: performance.now() - startedAt,
      })
      const sourceFrequency = cadenceContext.cadence?.sourceFrequency
        ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
      const targetCadence = cadenceContext.cadence?.targetCadence
        ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
      if (!sourceFrequency || !targetCadence) {
        throw new Error('Verification single-flight identity requires lawful source and target cadence.')
      }
      const verificationHorizonSetId = buildVerificationHorizonSetId(
        buildCurrentForecastExecutionPlan(historyResponse.history.end, targetCadence).horizons,
      )
      const logicalArtifactKey = buildVerificationLogicalArtifactKey({
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        modelId: input.modelId,
        inputSource: historyResponse.source.kind,
        historyFingerprint,
        sourceFrequency,
        targetCadence,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        verificationHorizonSetId,
        verificationConfigurationId: VERIFICATION_CONFIGURATION_ID,
        originPolicyId: VERIFICATION_ORIGIN_POLICY_ID,
      })
      const requestId = resolvedDependencies.telemetry.currentContext?.()?.requestId ?? randomUUID()

      return verificationForecastSingleFlight.run({
        logicalArtifactKey,
        requestId,
        emit(event, eventData) {
          resolvedDependencies.telemetry.emit(event, {
            logicalArtifactKey: eventData.logicalArtifactKey,
            operationFamily: eventData.operationFamily,
            ownerRequestId: eventData.ownerRequestId,
            requestId: eventData.requestId,
            role: eventData.role,
            activeVerificationSingleFlightEntries: eventData.activeVerificationSingleFlightEntries,
            durationMs: eventData.durationMs ?? null,
            error: eventData.error ?? null,
            seriesId: input.seriesId,
            modelId: input.modelId,
            targetSemantics: methodIdentity.targetSemantics,
            sourceFrequency,
            targetCadence,
          })
        },
        operation: async () => {
          const verificationStartedAt = performance.now()
          resolvedDependencies.telemetry.emit('verification_compute_start', {
            modelId: input.modelId,
            count: 1,
            logicalArtifactKey,
          })
          const verificationResponse = preparedExecutionContext
            ? await preparedExecutionContext.exportVerification(input.modelId)
            : await resolvedDependencies.bridge.exportVerification(input)
          const verificationDurationMs = performance.now() - verificationStartedAt
          const verificationOrigins = verificationResponse.status === 'AVAILABLE'
            ? Object.values(verificationResponse.result.backtest).reduce((sum, horizon) => sum + horizon.origins, 0)
            : 0
          resolvedDependencies.telemetry.emit('verification_compute_end', {
            modelId: input.modelId,
            count: 1,
            originCount: verificationOrigins,
            durationMs: verificationDurationMs,
            status: verificationResponse.status,
            logicalArtifactKey,
          })
          resolvedDependencies.telemetry.emit('model_fit', {
            operation: 'verification',
            modelId: input.modelId,
            count: verificationOrigins,
            durationMs: verificationDurationMs,
          })

          if (verificationResponse.status === 'NOT_AVAILABLE') {
            const identity = resolveCapabilityIdentity(input.targetBasis)
            return {
              status: 'NOT_AVAILABLE',
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              targetSemantics: identity.targetSemantics,
              methodId: identity.methodId,
              reason: verificationResponse.reason,
            }
          }

          if (verificationResponse.status === 'UNSUPPORTED') {
            return toUnsupportedResult(verificationResponse, input)
          }

          if (verificationResponse.status === 'FAILED') {
            const identity = resolveCapabilityIdentity(input.targetBasis, verificationResponse.methodVersion)
            return {
              status: 'FAILED',
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              targetSemantics: identity.targetSemantics,
              methodId: identity.methodId,
              reason: verificationResponse.reason,
              methodVersion: verificationResponse.methodVersion,
              source: verificationResponse.source,
              historyFingerprint,
            }
          }

          const artifact = mapVerificationArtifact(
            verificationResponse,
            input.targetBasis,
            historyResponse.history,
            cadenceContext,
          )
          const cacheStatus: BenchmarkForecastVerificationAvailableResult['cacheStatus'] = dbReadFailed ? 'db-unavailable' : 'miss'

          if (!dbReadFailed) {
            try {
              const persistStartedAt = performance.now()
              await resolvedDependencies.repository.writeVerificationRun(artifact)
              const verificationRecordWrites = Object.values(artifact.verification)
                .reduce((sum, horizon) => sum + horizon.records.length, 0)
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'verification',
                artifactWrites: 1,
                pointWrites: 0,
                verificationRecordWrites,
                writeFailures: 0,
                durationMs: performance.now() - persistStartedAt,
              })
            } catch (error) {
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'verification',
                artifactWrites: 0,
                pointWrites: 0,
                verificationRecordWrites: 0,
                writeFailures: 1,
              })
              resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                cacheStatus: 'persist-failed',
                totalMs: Math.round(performance.now() - startedAt),
                dbFailure: true,
                persistError: error instanceof Error ? error.message : 'unknown',
              })

              return toVerificationAvailable(artifact, 'persist-failed')
            }
          }

          resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            cacheStatus,
            totalMs: Math.round(performance.now() - startedAt),
            dbFailure: dbReadFailed,
          })

          return toVerificationAvailable(artifact, cacheStatus)
        },
      })
    },
  }
}

const forecastLibraryService = createForecastLibraryService()

export async function resolveBenchmarkCurrentForecast(input: ForecastServiceRequest) {
  return forecastLibraryService.resolveCurrentForecastRequest(input)
}

export async function resolveBenchmarkForecastVerification(input: ForecastServiceRequest) {
  return forecastLibraryService.resolveVerificationRequest(input)
}

export async function readPreparedBenchmarkCurrentForecast(input: ForecastServiceRequest) {
  return forecastLibraryService.readPreparedCurrentForecastRequest(input)
}

export async function readPreparedBenchmarkForecastVerification(input: ForecastServiceRequest) {
  return forecastLibraryService.readPreparedVerificationRequest(input)
}