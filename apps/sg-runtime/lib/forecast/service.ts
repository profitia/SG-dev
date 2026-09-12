import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { serverEnv } from '@/lib/env'
import { resolveExactForecastCapability } from '@/lib/forecast/capability-resolver'
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
  type CurrentLogicalArtifactIdentity,
  CurrentForecastSingleFlight,
} from '@/lib/forecast/current-single-flight'
import {
  createForecastPreparationExecutionContextRegistry,
  createDefaultForecastPreparationExecutionAdmission,
  createDefaultForecastPreparationExecutionLedger,
  ForecastExecutionControlError,
  hasForecastPreparationExecutionLedgerRelation,
  isMissingExecutionLedgerRelationError,
  type ForecastPreparationExecutionAdmission,
  type ForecastPreparationExecutionContextRegistry,
  type ForecastPreparationExecutionLedger,
  type ForecastPreparationOwnedExecutionContext,
} from '@/lib/forecast/execution-ledger'
import {
  buildVerificationHorizonSetId,
  buildVerificationLogicalArtifactKey,
  VERIFICATION_CONFIGURATION_ID,
  VERIFICATION_ORIGIN_POLICY_ID,
  type VerificationLogicalArtifactIdentity,
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
  addCalendarMonthsClamped,
  resolveForecastTechnicalMinimumObservations,
  selectMinimalLawfulCurrentTrainingSuffix,
} from '@/lib/forecast/current-fast-policy'
import {
  buildForecastArtifactCadenceIdentity,
  createLegacyVerificationStatisticalCompatibility,
  createLegacyFrequencySpecificCurrentForecastStatisticalCompatibility,
  createLegacyUnresolvedForecastStatisticalCompatibility,
  createCurrentForecastStatisticalCompatibility,
  createStrictTrailing12MCurrentForecastStatisticalCompatibility,
  createFullVerificationStatisticalCompatibility,
  createRecentVerificationStatisticalCompatibility,
  doesForecastArtifactSatisfyRequest,
  CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID,
  CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID,
  CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID,
  FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
  LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
  parseForecastArtifactCadenceIdentity,
  RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
  resolveForecastMethodContract,
  resolveLegacyForecastStatisticalCompatibility,
  type ForecastEffectiveTrainingPolicyId,
  type ForecastMethodId,
  type ForecastPreparationIdentity,
  type ForecastStatisticalCompatibility,
  type ForecastTrainingWindowPolicyId,
  type ForecastTargetSemantics,
} from '@/lib/forecast/identity'
import {
  buildCurrentForecastExecutionPlan,
  buildCurrentHorizonConfigurationId,
  loadLiveForecastBridgePayload,
  selectMinimalLawfulCurrentTrainingPayload,
  type LiveForecastBridgePayload,
} from '@/lib/forecast/live-market-input'
import { LIVE_FORECAST_INPUT_SOURCE_KIND } from '@/lib/forecast/canonical-history'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import {
  forecastStressTelemetry,
  type ForecastStressTelemetry,
} from '@/lib/forecast/stress-telemetry'
import {
  noteForecastRequestDiagnosticsEvent,
  traceForecastRequestDiagnosticsSpan,
  updateForecastRequestDiagnosticsIdentity,
} from '@/lib/forecast/request-diagnostics'
import {
  resolveForecastStage3HeartbeatIntervalMs,
  startForecastExecutionLeaseHeartbeat,
} from '@/lib/forecast/stage3-lease-heartbeat'

const execFileAsync = promisify(execFile)
const DEFAULT_FORECASTING_LAB_ROOT = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting')
const DEFAULT_FORECASTING_PYTHON = path.join(DEFAULT_FORECASTING_LAB_ROOT, '.venv', 'bin', 'python')
const FORECASTING_BRIDGE_SCRIPT = ['scripts', 'export_forecast_bundle.py']
const BRIDGE_BUFFER_BYTES = 25 * 1024 * 1024
const DEFAULT_FORECAST_STAGE3_WAITER_MULTIPLIER = 10
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
  preparedReadAuthority?: {
    seriesId: string
    modelId: string
    targetBasis: ForecastTargetBasis
    sourceFrequency: ForecastSourceFrequency
    targetCadence: ForecastTargetCadence
    expectedHistoryFingerprint: string
  }
  historicalOriginStartDate?: string
  lastProcessedOriginDate?: string | null
  maxOriginsPerRun?: number
  signal?: AbortSignal
}

type ForecastVerificationExecutionOptions = Pick<
  ForecastServiceRequest,
  'historicalOriginStartDate' | 'lastProcessedOriginDate' | 'maxOriginsPerRun'
>

const RECENT_VERIFICATION_MAX_ORIGINS = 1

type Stage3ExecutionLedgerContext = {
  executionId: string
}

type Stage3AuthoritativeExecutionLedgerContext = Stage3ExecutionLedgerContext & {
  executionId: string
  ownerToken: string
  leaseVersion: number
  attemptKind?: 'PRIMARY' | 'RECOVERY'
  executionMode?: 'PRE_STAGE3_PREPARATION' | 'RECOVERY_RESUME'
  leaseAcquiredAt?: string
  leaseExpiresAt: string
  recoveredFromExecutionId: string | null
}

function createAbortError() {
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function asAbortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) {
    return signal.reason
  }

  return createAbortError()
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw asAbortError(signal)
  }
}

function resolveStage3WaiterMaxWaitMs(leaseDurationMs: number) {
  const rawValue = process.env.FORECAST_STAGE3_WAITER_MAX_WAIT_MS?.trim()
  if (rawValue) {
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(parsed) || parsed < 1_000) {
      throw new Error('FORECAST_STAGE3_WAITER_MAX_WAIT_MS must be an integer >= 1000 milliseconds.')
    }
    return parsed
  }

  return leaseDurationMs * DEFAULT_FORECAST_STAGE3_WAITER_MULTIPLIER
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
  statisticalCompatibility: ForecastStatisticalCompatibility
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
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  effectiveTrainingPolicyId: ForecastEffectiveTrainingPolicyId
}

type ForecastPreparedLookupKey = Pick<
  ForecastCacheLookupKey,
  'seriesId' | 'modelId' | 'targetSemantics' | 'methodId' | 'methodVersion' | 'targetBasis' | 'frequencyIdentity' | 'trainingWindowPolicyId' | 'effectiveTrainingPolicyId'
>

type PreparedReadCadenceContext = ReturnType<typeof resolveArtifactCadenceContext> & {
  blockedReason: string | null
}

type PreparedReadFastPathContext = {
  cadenceContext: PreparedReadCadenceContext
  expectedHistoryFingerprint: string
}

type PersistedTrainingPolicyIdentityRecord = {
  trainingWindowPolicyId: string | null
  effectiveTrainingPolicyId: string | null
}

type PersistedCurrentRunPointRecord = {
  horizonLabel: string
  horizonSteps: number
  forecastDate: Date
  forecastValue: Prisma.Decimal | number | null
  metadataJson: Prisma.JsonValue | null
  failureReason: string | null
}

type PersistedCurrentRunRecord = PersistedTrainingPolicyIdentityRecord & {
  seriesId: string
  modelId: string
  displayName: string
  description: string | null
  targetBasis: ForecastTargetBasis
  methodVersion: string
  inputSource: string
  inputRunId: string | null
  historyFingerprint: string
  frequency: string | null
  historyStartAt: Date | null
  historyEndAt: Date | null
  observationCount: number
  forecastOriginAt: Date | null
  runtimeSeconds: number | null
  points: PersistedCurrentRunPointRecord[]
}

type PersistedVerificationMetricRecord = {
  horizonLabel: string
  horizonSteps: number
  origins: number
  expectedOrigins: number
  failedOrigins: number
  coverage: number
  mae: number | null
  rmse: number | null
  mase: number | null
  smape: number | null
  directionalAccuracy: number | null
  bias: number | null
  failureSummaryJson: Prisma.JsonValue | null
}

type PersistedVerificationPointRecord = {
  horizonLabel: string
  horizonSteps: number
  forecastOriginAt: Date
  targetDate: Date
  actualObservedAt: Date | null
  originValue: Prisma.Decimal | number
  forecastValue: Prisma.Decimal | number
  actualValue: Prisma.Decimal | number
  errorValue: Prisma.Decimal | number
  absoluteErrorValue: Prisma.Decimal | number
  deltaValue: Prisma.Decimal | number
  deltaPct: number | null
  maseScale: number
  metadataJson: Prisma.JsonValue | null
}

type PersistedVerificationRunRecord = PersistedTrainingPolicyIdentityRecord & {
  seriesId: string
  modelId: string
  displayName: string
  description: string | null
  targetBasis: ForecastTargetBasis
  methodVersion: string
  inputSource: string
  inputRunId: string | null
  historyFingerprint: string
  frequency: string | null
  historyStartAt: Date | null
  historyEndAt: Date | null
  observationCount: number
  forecastOriginAt: Date | null
  runtimeSeconds: number | null
  metrics: PersistedVerificationMetricRecord[]
  points: PersistedVerificationPointRecord[]
}

function isMissingCurrentTrainingPolicyColumnError(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes('forecast_current_runs.')
      || error.message.includes('The column `trainingWindowPolicyId` does not exist in the current database.')
      || error.message.includes('The column `effectiveTrainingPolicyId` does not exist in the current database.')
    )
    && (
      error.message.includes('trainingWindowPolicyId')
      || error.message.includes('effectiveTrainingPolicyId')
    )
}

function isMissingVerificationTrainingPolicyColumnError(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes('forecast_verification_runs.')
      || error.message.includes('The column `trainingWindowPolicyId` does not exist in the current database.')
      || error.message.includes('The column `effectiveTrainingPolicyId` does not exist in the current database.')
    )
    && (
      error.message.includes('trainingWindowPolicyId')
      || error.message.includes('effectiveTrainingPolicyId')
    )
}

async function hasForecastRunTrainingPolicyColumns(
  prisma: ReturnType<typeof getMarketDataPrisma>,
  tableName: 'forecast_current_runs' | 'forecast_verification_runs',
) {
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const result = await prisma.$queryRaw<Array<{ columnCount: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "columnCount"
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ${tableName}
      AND column_name IN ('trainingWindowPolicyId', 'effectiveTrainingPolicyId')
  `)

  return Number(result[0]?.columnCount ?? 0) === 2
}

type LegacyForecastRunIdentity = {
  seriesId: string
  inputSource: string
  historyFingerprint: string
  targetBasis: ForecastTargetBasis
  methodId: string
  modelId: string
  methodVersion: string
  frequency: string
}

async function findLegacyCurrentRunId(
  tx: Prisma.TransactionClient,
  identity: LegacyForecastRunIdentity,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "forecast_current_runs"
    WHERE "seriesId" = ${identity.seriesId}
      AND "inputSource" = ${identity.inputSource}
      AND "historyFingerprint" = ${identity.historyFingerprint}
      AND "targetBasis" = CAST(${identity.targetBasis} AS "ForecastTargetBasis")
      AND "methodId" = ${identity.methodId}
      AND "modelId" = ${identity.modelId}
      AND "methodVersion" = ${identity.methodVersion}
      AND "frequency" = ${identity.frequency}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `)

  return rows[0]?.id ?? null
}

async function updateLegacyCurrentRun(
  tx: Prisma.TransactionClient,
  runId: string,
  artifact: PersistedCurrentArtifact,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "forecast_current_runs"
    SET "displayName" = ${artifact.displayName},
        "description" = ${artifact.description},
        "frequency" = ${artifact.frequencyIdentity},
        "inputRunId" = ${artifact.source.runId},
        "historyStartAt" = ${artifact.history.start ? new Date(artifact.history.start) : null},
        "historyEndAt" = ${artifact.history.end ? new Date(artifact.history.end) : null},
        "observationCount" = ${artifact.history.observations},
        "targetBasis" = CAST(${artifact.targetBasis} AS "ForecastTargetBasis"),
        "methodId" = ${artifact.methodId},
        "forecastOriginAt" = ${artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null},
        "status" = 'AVAILABLE',
        "failureReason" = NULL,
        "runtimeSeconds" = ${artifact.runtimeSeconds},
        "updatedAt" = NOW()
    WHERE "id" = ${runId}
    RETURNING "id"
  `)

  return rows[0]
}

async function createLegacyCurrentRun(
  tx: Prisma.TransactionClient,
  artifact: PersistedCurrentArtifact,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "forecast_current_runs" (
      "id",
      "seriesId",
      "displayName",
      "description",
      "frequency",
      "currency",
      "unit",
      "sourceLabel",
      "inputSource",
      "inputRunId",
      "historyFingerprint",
      "targetBasis",
      "methodId",
      "historyStartAt",
      "historyEndAt",
      "observationCount",
      "forecastOriginAt",
      "modelId",
      "methodVersion",
      "status",
      "failureReason",
      "runtimeSeconds",
      "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      ${artifact.seriesId},
      ${artifact.displayName},
      ${artifact.description},
      ${artifact.frequencyIdentity},
      NULL,
      NULL,
      NULL,
      ${artifact.source.kind},
      ${artifact.source.runId},
      ${artifact.historyFingerprint},
      CAST(${artifact.targetBasis} AS "ForecastTargetBasis"),
      ${artifact.methodId},
      ${artifact.history.start ? new Date(artifact.history.start) : null},
      ${artifact.history.end ? new Date(artifact.history.end) : null},
      ${artifact.history.observations},
      ${artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null},
      ${artifact.modelId},
      ${artifact.methodVersion},
      'AVAILABLE',
      NULL,
      ${artifact.runtimeSeconds},
      NOW()
    )
    RETURNING "id"
  `)

  return rows[0]
}

async function findLegacyVerificationRunId(
  tx: Prisma.TransactionClient,
  identity: LegacyForecastRunIdentity,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "forecast_verification_runs"
    WHERE "seriesId" = ${identity.seriesId}
      AND "inputSource" = ${identity.inputSource}
      AND "historyFingerprint" = ${identity.historyFingerprint}
      AND "targetBasis" = CAST(${identity.targetBasis} AS "ForecastTargetBasis")
      AND "methodId" = ${identity.methodId}
      AND "modelId" = ${identity.modelId}
      AND "methodVersion" = ${identity.methodVersion}
      AND "frequency" = ${identity.frequency}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `)

  return rows[0]?.id ?? null
}

async function updateLegacyVerificationRun(
  tx: Prisma.TransactionClient,
  runId: string,
  artifact: PersistedVerificationArtifact,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "forecast_verification_runs"
    SET "displayName" = ${artifact.displayName},
        "description" = ${artifact.description},
        "frequency" = ${artifact.frequencyIdentity},
        "inputRunId" = ${artifact.source.runId},
        "historyStartAt" = ${artifact.history.start ? new Date(artifact.history.start) : null},
        "historyEndAt" = ${artifact.history.end ? new Date(artifact.history.end) : null},
        "observationCount" = ${artifact.history.observations},
        "targetBasis" = CAST(${artifact.targetBasis} AS "ForecastTargetBasis"),
        "methodId" = ${artifact.methodId},
        "forecastOriginAt" = ${artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null},
        "status" = 'AVAILABLE',
        "failureReason" = NULL,
        "runtimeSeconds" = ${artifact.runtimeSeconds},
        "updatedAt" = NOW()
    WHERE "id" = ${runId}
    RETURNING "id"
  `)

  return rows[0]
}

async function createLegacyVerificationRun(
  tx: Prisma.TransactionClient,
  artifact: PersistedVerificationArtifact,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "forecast_verification_runs" (
      "id",
      "seriesId",
      "displayName",
      "description",
      "frequency",
      "currency",
      "unit",
      "sourceLabel",
      "inputSource",
      "inputRunId",
      "historyFingerprint",
      "targetBasis",
      "methodId",
      "historyStartAt",
      "historyEndAt",
      "observationCount",
      "forecastOriginAt",
      "modelId",
      "methodVersion",
      "status",
      "failureReason",
      "runtimeSeconds",
      "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      ${artifact.seriesId},
      ${artifact.displayName},
      ${artifact.description},
      ${artifact.frequencyIdentity},
      NULL,
      NULL,
      NULL,
      ${artifact.source.kind},
      ${artifact.source.runId},
      ${artifact.historyFingerprint},
      CAST(${artifact.targetBasis} AS "ForecastTargetBasis"),
      ${artifact.methodId},
      ${artifact.history.start ? new Date(artifact.history.start) : null},
      ${artifact.history.end ? new Date(artifact.history.end) : null},
      ${artifact.history.observations},
      ${artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null},
      ${artifact.modelId},
      ${artifact.methodVersion},
      'AVAILABLE',
      NULL,
      ${artifact.runtimeSeconds},
      NOW()
    )
    RETURNING "id"
  `)

  return rows[0]
}

async function assertForecastPersistenceOwnership(
  tx: Prisma.TransactionClient,
  ownership: ForecastPersistenceOwnership | undefined,
  observedAt: string,
) {
  if (!ownership) {
    return
  }

  try {
    const fencedOwner = await tx.$queryRaw<Array<{ executionId: string }>>(Prisma.sql`
      SELECT "executionId"
      FROM "forecast_preparation_execution_ledger"
      WHERE "executionId" = ${ownership.executionId}
        AND "logicalArtifactKey" = ${ownership.logicalArtifactKey}
        AND "executionStatus" = 'STARTED'
        AND "ownerToken" = ${ownership.ownerToken}
        AND "leaseVersion" = ${ownership.leaseVersion}
        AND "leaseExpiresAt" > CAST(${observedAt} AS timestamp)
      FOR UPDATE
    `)

    if (fencedOwner.length !== 1) {
      throw new ForecastExecutionControlError(
        'STALE_OWNER',
        `Execution ${ownership.executionId} lost fenced persistence rights for ${ownership.logicalArtifactKey}.`,
      )
    }
  } catch (error) {
    if (isMissingExecutionLedgerRelationError(error)) {
      return
    }
    throw error
  }

  await forecastPersistenceTestHooks?.afterOwnerFenceAcquired?.(ownership)
}

function resolvePersistedForecastStatisticalCompatibility(
  artifactFamily: 'CURRENT' | 'VERIFICATION',
  record: PersistedTrainingPolicyIdentityRecord,
  context: {
    sourceFrequency: ForecastSourceFrequency
    targetCadence: ForecastTargetCadence
    targetSemantics: ForecastTargetSemantics
  },
): ForecastStatisticalCompatibility | null {
  if (!record.trainingWindowPolicyId && !record.effectiveTrainingPolicyId) {
    return resolveLegacyForecastStatisticalCompatibility(artifactFamily, context)
  }

  if (!record.trainingWindowPolicyId || !record.effectiveTrainingPolicyId) {
    return null
  }

  const compatibility = (() => {
    if (record.trainingWindowPolicyId === CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID) {
      return createCurrentForecastStatisticalCompatibility(context)
    }
    if (record.trainingWindowPolicyId === CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID) {
      return createStrictTrailing12MCurrentForecastStatisticalCompatibility(context)
    }
    if (record.trainingWindowPolicyId === CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID) {
      return createLegacyFrequencySpecificCurrentForecastStatisticalCompatibility(context)
    }
    if (record.trainingWindowPolicyId === RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID) {
      return createRecentVerificationStatisticalCompatibility(context)
    }
    if (record.trainingWindowPolicyId === FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID) {
      return createFullVerificationStatisticalCompatibility(context)
    }
    return null
  })()

  if (!compatibility || compatibility.effectiveTrainingPolicyId !== record.effectiveTrainingPolicyId) {
    return null
  }

  return compatibility
}

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
  writeCurrentRun(artifact: PersistedCurrentArtifact, options?: ForecastRepositoryWriteOptions): Promise<void>
  readVerificationRun(key: ForecastCacheLookupKey): Promise<PersistedVerificationArtifact | null>
  writeVerificationRun(artifact: PersistedVerificationArtifact, options?: ForecastRepositoryWriteOptions): Promise<void>
  readLatestCurrentRun?(key: ForecastPreparedLookupKey): Promise<PersistedCurrentArtifact | null>
  readLatestVerificationRun?(key: ForecastPreparedLookupKey): Promise<PersistedVerificationArtifact | null>
}

export type ForecastPersistenceOwnership = {
  operationFamily: 'CURRENT' | 'VERIFICATION'
  logicalArtifactKey: string
  executionId: string
  ownerToken: string
  leaseVersion: number
  requestId: string
  ownerRequestId: string
  role: 'OWNER' | 'RECOVERY_OWNER'
}

export type ForecastRepositoryWriteOptions = {
  ownership?: ForecastPersistenceOwnership
}

type ForecastPersistenceTestHooks = {
  afterOwnerFenceAcquired?: (ownership: ForecastPersistenceOwnership) => void | Promise<void>
}

let forecastPersistenceTestHooks: ForecastPersistenceTestHooks | null = null

export function setForecastPersistenceTestHooks(hooks: ForecastPersistenceTestHooks | null) {
  forecastPersistenceTestHooks = hooks
}

export type ForecastBridge = {
  exportHistory(input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>): Promise<ForecastHistoryBridgeResponse>
  exportCurrent(input: ForecastServiceRequest): Promise<ForecastCurrentBridgeResponse>
  exportVerification(input: ForecastServiceRequest): Promise<ForecastVerificationBridgeResponse>
  prepareExecutionContext?(input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>): Promise<ForecastPreparedExecutionContext | null>
}

export type ForecastPreparedExecutionContext = {
  exportHistory(mode?: 'current' | 'verification', modelId?: string): Promise<ForecastHistoryBridgeResponse>
  exportCurrent(modelId: string): Promise<ForecastCurrentBridgeResponse>
  exportVerification(modelId: string, options?: ForecastVerificationExecutionOptions): Promise<ForecastVerificationBridgeResponse>
}

export type ForecastLibraryServiceDependencies = {
  repository: ForecastLibraryRepository
  bridge: ForecastBridge
  logEvent: (event: string, data: Record<string, string | number | boolean | null>) => void
  telemetry: Pick<ForecastStressTelemetry, 'emit'> & Partial<Pick<ForecastStressTelemetry, 'currentContext'>>
  executionLedger: ForecastPreparationExecutionLedger
  executionContextRegistry: ForecastPreparationExecutionContextRegistry
  executionAdmission: ForecastPreparationExecutionAdmission
  resolveExactPreparedCapability: typeof resolveExactForecastCapability
  executePreparedCurrent: typeof executePreparedForecastBridge
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

function isPreparationRequiredMessage(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith('PREPARATION_REQUIRED:')
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

function isUserFacingModel(modelId: string): modelId is UserFacingForecastModelId {
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

async function resolvePreparedReadCadenceContext(
  input: ForecastServiceRequest,
  targetSemantics: ForecastTargetSemantics,
  resolveExactPreparedCapability: ForecastLibraryServiceDependencies['resolveExactPreparedCapability'],
): Promise<PreparedReadCadenceContext> {
  const explicitContext = resolveArtifactCadenceContext(input)
  if (input.targetBasis === 'POINT_IN_TIME' || !isUserFacingModel(input.modelId)) {
    return {
      ...explicitContext,
      blockedReason: null,
    }
  }

  const modelId = input.modelId as UserFacingForecastModelId

  const { capability } = await resolveExactPreparedCapability({
    seriesId: input.seriesId,
    modelId,
    targetSemantics,
  })

  if (
    !capability?.sourceFrequency
    || !capability.targetCadence
    || capability.admissionState !== 'ADMITTED'
    || capability.implementationState !== 'SUPPORTED'
    || capability.historyEligibility !== 'ELIGIBLE'
  ) {
    return {
      ...explicitContext,
      blockedReason: 'PREPARATION_REQUIRED: Canonical prepared-read capability is not lawfully production-readable for this identity.',
    }
  }

  const cadence = createForecastCadence(capability.sourceFrequency, capability.targetCadence)

  if (
    explicitContext.cadence
    && (
      explicitContext.cadence.sourceFrequency !== cadence.sourceFrequency
      || explicitContext.cadence.targetCadence !== cadence.targetCadence
    )
  ) {
    return {
      cadence,
      frequencyIdentity: buildForecastArtifactCadenceIdentity(cadence),
      blockedReason: 'PREPARATION_REQUIRED: Explicit cadence does not match the canonical prepared-read capability.',
    }
  }

  return {
    cadence,
    frequencyIdentity: buildForecastArtifactCadenceIdentity(cadence),
    blockedReason: null,
  }
}

function resolvePreparedReadFastPathContext(
  input: ForecastServiceRequest,
): PreparedReadFastPathContext | null {
  if (input.targetBasis === 'POINT_IN_TIME') {
    return null
  }

  const authority = input.preparedReadAuthority
  if (!authority) {
    return null
  }

  if (
    authority.seriesId !== input.seriesId
    || authority.modelId !== input.modelId
    || authority.targetBasis !== input.targetBasis
  ) {
    return {
      cadenceContext: {
        ...resolveArtifactCadenceContext(input),
        blockedReason: 'PREPARATION_REQUIRED: Trusted prepared-read authority does not match the requested artifact identity.',
      },
      expectedHistoryFingerprint: authority.expectedHistoryFingerprint,
    }
  }

  const explicitContext = resolveArtifactCadenceContext(input)
  const authorityCadence = createForecastCadence(authority.sourceFrequency, authority.targetCadence)

  if (
    explicitContext.cadence
    && (
      explicitContext.cadence.sourceFrequency !== authorityCadence.sourceFrequency
      || explicitContext.cadence.targetCadence !== authorityCadence.targetCadence
    )
  ) {
    return {
      cadenceContext: {
        cadence: authorityCadence,
        frequencyIdentity: buildForecastArtifactCadenceIdentity(authorityCadence),
        blockedReason: 'PREPARATION_REQUIRED: Explicit cadence does not match the trusted prepared-read authority.',
      },
      expectedHistoryFingerprint: authority.expectedHistoryFingerprint,
    }
  }

  if (authority.expectedHistoryFingerprint.trim().length === 0) {
    return {
      cadenceContext: {
        cadence: authorityCadence,
        frequencyIdentity: buildForecastArtifactCadenceIdentity(authorityCadence),
        blockedReason: 'PREPARATION_REQUIRED: Trusted prepared-read authority is missing an exact source-history fingerprint.',
      },
      expectedHistoryFingerprint: authority.expectedHistoryFingerprint,
    }
  }

  return {
    cadenceContext: {
      cadence: authorityCadence,
      frequencyIdentity: buildForecastArtifactCadenceIdentity(authorityCadence),
      blockedReason: null,
    },
    expectedHistoryFingerprint: authority.expectedHistoryFingerprint,
  }
}

function resolvePreparedReadInput(
  input: ForecastServiceRequest,
  cadenceContext: PreparedReadCadenceContext,
): Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'> {
  return {
    seriesId: input.seriesId,
    targetBasis: input.targetBasis,
    sourceFrequency: cadenceContext.cadence?.sourceFrequency ?? input.sourceFrequency,
    targetCadence: cadenceContext.cadence?.targetCadence ?? input.targetCadence,
  }
}

async function readPreparedHistoryForLookup(
  input: ForecastServiceRequest,
  cadenceContext: PreparedReadCadenceContext,
  bridge: ForecastBridge,
  mode: 'current' | 'verification',
  modelId?: string,
): Promise<ForecastHistoryBridgeResponse> {
  const preparedReadInput = resolvePreparedReadInput(input, cadenceContext)
  const preparedExecutionContext = await bridge.prepareExecutionContext?.(preparedReadInput) ?? null

  if (preparedExecutionContext) {
    return preparedExecutionContext.exportHistory(mode, modelId)
  }

  return bridge.exportHistory(preparedReadInput)
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

function average(values: number[]) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateRecentVerificationMetrics(records: ForecastVerificationRecord[]): ForecastVerificationMetrics | null {
  if (records.length === 0) {
    return null
  }

  const rmseBase = average(records.map((record) => record.error ** 2))
  const maseValues = records
    .filter((record) => record.maseScale > 0)
    .map((record) => record.absoluteError / record.maseScale)
  const smapeValues = records
    .map((record) => {
      const denominator = Math.abs(record.forecastValue) + Math.abs(record.actualValue)
      return denominator === 0 ? null : (2 * record.absoluteError) / denominator
    })
    .filter((value): value is number => value !== null && Number.isFinite(value))

  return {
    mae: average(records.map((record) => record.absoluteError)),
    rmse: rmseBase === null ? null : Math.sqrt(rmseBase),
    mase: average(maseValues),
    smape: average(smapeValues),
    directionalAccuracy: average(records.map((record) => {
      const forecastDirection = Math.sign(record.delta)
      const actualDirection = Math.sign(record.actualValue - record.originValue)
      return forecastDirection === actualDirection ? 1 : 0
    })),
    bias: average(records.map((record) => record.error)),
  }
}

function sortVerificationRecords(records: ForecastVerificationRecord[]) {
  return [...records].sort((left, right) => {
    const byOrigin = left.forecastOrigin.localeCompare(right.forecastOrigin)
    if (byOrigin !== 0) return byOrigin
    return left.forecastDate.localeCompare(right.forecastDate)
  })
}

function sortVerificationFailures(failures: ForecastVerificationFailure[]) {
  return [...failures].sort((left, right) => {
    const byOrigin = left.forecastOrigin.localeCompare(right.forecastOrigin)
    if (byOrigin !== 0) return byOrigin
    const byTarget = left.forecastDate.localeCompare(right.forecastDate)
    if (byTarget !== 0) return byTarget
    return left.failureReason.localeCompare(right.failureReason)
  })
}

function countUniqueVerificationOrigins(records: Array<{ forecastOrigin: string }>) {
  return new Set(records.map((record) => record.forecastOrigin)).size
}

function isVerificationArtifactComplete(artifact: PersistedVerificationArtifact) {
  const horizons = Object.values(artifact.verification)
  return horizons.length > 0 && horizons.every((horizon) => {
    const successfulOrigins = Math.max(horizon.successfulOrigins, horizon.origins, countUniqueVerificationOrigins(horizon.records))
    const failedOrigins = Math.max(horizon.failedOrigins, countUniqueVerificationOrigins(horizon.failures))
    return successfulOrigins + failedOrigins >= horizon.expectedOrigins
  })
}

function deriveLastProcessedVerificationOriginDate(artifact: PersistedVerificationArtifact) {
  const processedOrigins = Object.values(artifact.verification)
    .flatMap((horizon) => [
      ...horizon.records.map((record) => record.forecastOrigin),
      ...horizon.failures.map((failure) => failure.forecastOrigin),
    ])
    .filter((value): value is string => value.length > 0)

  if (processedOrigins.length === 0) {
    return null
  }

  return processedOrigins.sort((left, right) => left.localeCompare(right)).at(-1) ?? null
}

function buildVerificationHistoryPrefix(
  history: ForecastBridgeHistory,
  artifact: PersistedVerificationArtifact,
) {
  const start = normalizePeriodIdentityKey(artifact.history.start)
  const end = normalizePeriodIdentityKey(artifact.history.end)
  if (!start || !end || artifact.history.observations < 1) {
    return null
  }

  const points = history.points.filter((point) => {
    const pointDate = normalizePeriodIdentityKey(point.date)
    return pointDate !== null && pointDate >= start && pointDate <= end
  })
  if (
    points.length !== artifact.history.observations
    || normalizePeriodIdentityKey(points[0]?.date ?? null) !== start
    || normalizePeriodIdentityKey(points.at(-1)?.date ?? null) !== end
  ) {
    return null
  }

  return {
    ...history,
    start,
    end,
    observations: points.length,
    points,
  }
}

function isAppendOnlyCompatibleVerificationArtifact(
  artifact: PersistedVerificationArtifact,
  history: ForecastBridgeHistory,
  cadence: ForecastCadence | undefined,
) {
  const artifactEnd = normalizePeriodIdentityKey(artifact.history.end)
  const historyEnd = normalizePeriodIdentityKey(history.end)
  if (
    verificationArtifactNeedsRebuild(artifact)
    || !artifact.history.start
    || !artifact.history.end
    || !artifactEnd
    || !historyEnd
    || artifactEnd >= historyEnd
    || artifact.history.observations >= history.observations
  ) {
    return false
  }

  const historyPrefix = buildVerificationHistoryPrefix(history, artifact)
  if (!historyPrefix) {
    return false
  }

  return buildForecastHistoryFingerprint(historyPrefix, cadence) === artifact.historyFingerprint
}

function resolveVerificationResumeArtifact(input: {
  exactArtifact: PersistedVerificationArtifact | null
  latestArtifact: PersistedVerificationArtifact | null
  history: ForecastBridgeHistory
  cadence: ForecastCadence | undefined
}) {
  if (input.exactArtifact && !verificationArtifactNeedsRebuild(input.exactArtifact)) {
    return input.exactArtifact
  }

  if (
    input.latestArtifact
    && isAppendOnlyCompatibleVerificationArtifact(input.latestArtifact, input.history, input.cadence)
  ) {
    return input.latestArtifact
  }

  return null
}

function mergeVerificationRecords(
  existing: ForecastVerificationRecord[],
  incoming: ForecastVerificationRecord[],
) {
  const merged = new Map<string, ForecastVerificationRecord>()

  for (const record of existing) {
    merged.set(`${record.forecastOrigin}|${record.forecastDate}`, record)
  }

  for (const record of incoming) {
    merged.set(`${record.forecastOrigin}|${record.forecastDate}`, record)
  }

  return sortVerificationRecords([...merged.values()])
}

function mergeVerificationFailures(
  existing: ForecastVerificationFailure[],
  incoming: ForecastVerificationFailure[],
) {
  const merged = new Map<string, ForecastVerificationFailure>()

  for (const failure of existing) {
    merged.set(`${failure.forecastOrigin}|${failure.forecastDate}`, failure)
  }

  for (const failure of incoming) {
    merged.set(`${failure.forecastOrigin}|${failure.forecastDate}`, failure)
  }

  return sortVerificationFailures([...merged.values()])
}

function mergeVerificationArtifacts(
  existing: PersistedVerificationArtifact | null,
  incoming: PersistedVerificationArtifact,
): PersistedVerificationArtifact {
  if (!existing) {
    return incoming
  }

  const mergedVerification = Object.fromEntries(
    Object.entries(incoming.verification).map(([horizonLabel, incomingHorizon]) => {
      const existingHorizon = existing.verification[horizonLabel]
      const records = mergeVerificationRecords(existingHorizon?.records ?? [], incomingHorizon.records)
      const failures = mergeVerificationFailures(existingHorizon?.failures ?? [], incomingHorizon.failures)
      const expectedOrigins = Math.max(existingHorizon?.expectedOrigins ?? 0, incomingHorizon.expectedOrigins)
      const incomingComplete = incomingHorizon.successfulOrigins + incomingHorizon.failedOrigins >= incomingHorizon.expectedOrigins
      const existingComplete = (existingHorizon?.successfulOrigins ?? 0) + (existingHorizon?.failedOrigins ?? 0) >= (existingHorizon?.expectedOrigins ?? Number.MAX_SAFE_INTEGER)
      const expectedOriginsExpanded = expectedOrigins > (existingHorizon?.expectedOrigins ?? 0)
      const successfulOrigins = incomingComplete
        ? incomingHorizon.successfulOrigins
        : existingComplete && !expectedOriginsExpanded
          ? existingHorizon!.successfulOrigins
          : countUniqueVerificationOrigins(records)
      const failedOrigins = incomingComplete
        ? incomingHorizon.failedOrigins
        : existingComplete && !expectedOriginsExpanded
          ? existingHorizon!.failedOrigins
          : countUniqueVerificationOrigins(failures)

      return [
        horizonLabel,
        {
          horizon: incomingHorizon.horizon,
          horizonSteps: incomingHorizon.horizonSteps > 0
            ? incomingHorizon.horizonSteps
            : existingHorizon?.horizonSteps
              ?? resolveVerificationHorizonStepsFromLabel(horizonLabel),
          origins: successfulOrigins,
          expectedOrigins,
          successfulOrigins,
          failedOrigins,
          coverage: expectedOrigins === 0 ? 0 : successfulOrigins / expectedOrigins,
          metrics: calculateRecentVerificationMetrics(records),
          records,
          failures,
        } satisfies ForecastVerificationHorizon,
      ]
    }),
  )

  return {
    ...incoming,
    runtimeSeconds: (existing.runtimeSeconds ?? 0) + (incoming.runtimeSeconds ?? 0),
    verification: mergedVerification,
  }
}

const PARTIAL_VERIFICATION_CACHE_STATUS = 'partial' as const
const PARTIAL_VERIFICATION_REASON = 'PREPARATION_REQUIRED: Exact-identity prepared Historical Verification is still being built in bounded batches.'

function buildCurrentPayloadForSelectedOrigin(input: {
  benchmark: ForecastBridgeBenchmark
  source: ForecastBridgeSource
  authoritativeHistory: ForecastBridgeHistory
  targetBasis: ForecastTargetBasis
  targetCadence: ForecastTargetCadence
  selectedPoints: Array<ForecastHistoryPoint & { value: number }>
}): LiveForecastBridgePayload {
  const firstPoint = input.selectedPoints[0]
  const lastPoint = input.selectedPoints.at(-1)

  if (!firstPoint || !lastPoint) {
    throw new Error('Recent Verification requires at least one selected historical point.')
  }

  const executionPlan = buildCurrentForecastExecutionPlan(lastPoint.date, input.targetCadence)
  const canonicalization = input.authoritativeHistory.canonicalization ?? {
    method: 'LEGACY_UNRESOLVED',
    version: 'LEGACY_UNRESOLVED',
  }

  return {
    benchmark: {
      seriesId: input.benchmark.seriesId,
      component: input.benchmark.component,
      description: input.benchmark.description,
      frequency: input.targetCadence,
      expectedObservations: input.selectedPoints.length,
    },
    execution: {
      frequency: input.targetCadence,
      historicalPeriodStarts: input.selectedPoints.map((point) => point.date),
      horizons: executionPlan.horizons,
      currentTargetDates: executionPlan.currentTargetDates,
    },
    source: {
      kind: LIVE_FORECAST_INPUT_SOURCE_KIND,
      runId: null,
    },
    canonicalization: {
      targetBasis: input.targetBasis,
      method: canonicalization.method,
      version: canonicalization.version,
      partialMonthRule: input.targetCadence === 'MONTHLY'
        ? 'EXCLUDE_OPEN_CALENDAR_MONTH'
        : 'EXCLUDE_OPEN_TARGET_PERIOD',
      missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
      sourceObservationCount: input.authoritativeHistory.observations,
      sourceObservationsUsed: input.selectedPoints.length,
      excludedPartialPeriods: Math.max(0, input.authoritativeHistory.observations - input.selectedPoints.length),
    },
    history: {
      seriesId: input.authoritativeHistory.seriesId,
      benchmarkName: input.authoritativeHistory.benchmarkName,
      description: input.authoritativeHistory.description,
      frequency: input.targetCadence,
      start: firstPoint.date,
      end: lastPoint.date,
      observations: input.selectedPoints.length,
      canonicalization,
      points: input.selectedPoints,
    },
  }
}

export async function buildRecentVerificationArtifact(input: {
  request: ForecastServiceRequest
  methodVersion: string
  targetSemantics: ForecastTargetSemantics
  benchmark: ForecastBridgeBenchmark
  source: ForecastBridgeSource
  authoritativeHistory: ForecastBridgeHistory
  identityHistory?: ForecastBridgeHistory
  cadenceContext: ReturnType<typeof resolveArtifactCadenceContext>
  executePreparedCurrent?: (
    payload: LiveForecastBridgePayload,
    mode: 'current',
    seriesId: string,
    modelId: string,
  ) => Promise<ForecastCurrentBridgeResponse>
}): Promise<PersistedVerificationArtifact> {
  const identityHistory = input.identityHistory ?? input.authoritativeHistory
  const sourceFrequency = input.cadenceContext.cadence?.sourceFrequency
    ?? normalizeForecastSourceFrequency(input.authoritativeHistory.frequency)
  const targetCadence = input.cadenceContext.cadence?.targetCadence
    ?? normalizeForecastSourceFrequency(input.authoritativeHistory.frequency)

  if (!sourceFrequency || !targetCadence) {
    throw new Error('Recent Verification requires lawful source and target cadence.')
  }

  if (!isUserFacingModel(input.request.modelId)) {
    throw new Error('Recent Verification requires a user-facing modelId.')
  }

  const minimumRequiredObservations = resolveForecastTechnicalMinimumObservations({
    targetSemantics: input.targetSemantics,
    modelId: input.request.modelId,
  })
  const actualObservedAtByTargetDate = buildActualObservedAtByTargetDate(input.authoritativeHistory, input.request.targetBasis)
  const authoritativePoints = input.authoritativeHistory.points
    .filter((point): point is ForecastHistoryPoint & { value: number } => typeof point.value === 'number' && Number.isFinite(point.value))
  const actualsByDate = new Map(
    authoritativePoints.map((point) => [normalizePeriodIdentityKey(point.date), point] as const)
      .filter((entry): entry is [string, ForecastHistoryPoint & { value: number }] => entry[0] !== null),
  )
  const latestHistoricalDate = input.authoritativeHistory.end
  const eligibleOrigins = authoritativePoints
    .slice(0, -1)
    .filter((point) => {
      const farthestTargetDate = buildCurrentForecastExecutionPlan(point.date, targetCadence).currentTargetDates['12M']
      if (!(typeof farthestTargetDate === 'string' && farthestTargetDate <= latestHistoricalDate)) {
        return false
      }

      return selectMinimalLawfulCurrentTrainingSuffix({
        points: authoritativePoints,
        forecastOrigin: point.date,
        minimumRequiredObservations,
      }).minimumRequirementSatisfied
    })

  const latestLawfulMaturedOrigin = eligibleOrigins.at(-1)?.date ?? null
  const recentWindowStartExclusive = latestLawfulMaturedOrigin === null
    ? null
    : addCalendarMonthsClamped(latestLawfulMaturedOrigin, -12)
  const selectedOrigins = recentWindowStartExclusive === null || latestLawfulMaturedOrigin === null
    ? []
    : eligibleOrigins.filter((point) => point.date > recentWindowStartExclusive && point.date <= latestLawfulMaturedOrigin).slice(-RECENT_VERIFICATION_MAX_ORIGINS)

  if (selectedOrigins.length !== RECENT_VERIFICATION_MAX_ORIGINS) {
    throw new Error('PREPARATION_REQUIRED: No exact-identity prepared Recent Verification is available.')
  }

  const recordsByHorizon = new Map<string, ForecastVerificationRecord[]>()

  const executePreparedCurrent = input.executePreparedCurrent
    ?? ((payload, mode, seriesId, modelId) => executePreparedForecastBridge(payload, mode, seriesId, modelId) as Promise<ForecastCurrentBridgeResponse>)

  for (const origin of selectedOrigins) {
    const selection = selectMinimalLawfulCurrentTrainingSuffix({
      points: authoritativePoints,
      forecastOrigin: origin.date,
      minimumRequiredObservations,
    })
    const preparedPayload = buildCurrentPayloadForSelectedOrigin({
      benchmark: input.benchmark,
      source: input.source,
      authoritativeHistory: input.authoritativeHistory,
      targetBasis: input.request.targetBasis,
      targetCadence,
      selectedPoints: selection.points as Array<ForecastHistoryPoint & { value: number }>,
    })
    const originValue = preparedPayload.history.points.at(-1)?.value
    if (!(typeof originValue === 'number' && Number.isFinite(originValue))) {
      throw new Error(`Recent Verification origin ${origin.date} is missing a lawful origin value.`)
    }

    const currentResponse = await executePreparedCurrent(
      preparedPayload,
      'current',
      input.request.seriesId,
      input.request.modelId,
    )

    if (currentResponse.status !== 'AVAILABLE') {
      throw new Error(`Recent Verification current execution failed at origin ${origin.date}: ${currentResponse.reason}`)
    }

    for (const [horizon, point] of Object.entries(currentResponse.result.currentForecast)) {
      if (!(typeof point.forecastValue === 'number' && Number.isFinite(point.forecastValue))) {
        continue
      }

      const targetDateKey = normalizePeriodIdentityKey(point.forecastDate)
      const actual = targetDateKey ? actualsByDate.get(targetDateKey) : null
      if (!actual) {
        continue
      }

      const naiveScale = selection.points.length < 2
        ? 0
        : selection.points.slice(1).reduce((sum, candidate, index) => (
          sum + Math.abs(candidate.value - selection.points[index]!.value)
        ), 0) / (selection.points.length - 1)
      const error = point.forecastValue - actual.value
      const record: ForecastVerificationRecord = {
        benchmarkId: input.request.seriesId,
        modelId: input.request.modelId,
        forecastOrigin: origin.date,
        horizon,
        horizonSteps: point.horizonSteps,
        forecastDate: point.forecastDate,
        actualObservedAt: resolveVerificationRecordActualObservedAt({
          benchmarkId: input.request.seriesId,
          modelId: input.request.modelId,
          forecastOrigin: origin.date,
          horizon,
          horizonSteps: point.horizonSteps,
          forecastDate: point.forecastDate,
          actualObservedAt: actual.sourceObservedAt ?? null,
          originValue,
          forecastValue: point.forecastValue,
          actualValue: actual.value,
          error,
          absoluteError: Math.abs(error),
          delta: point.forecastValue - originValue,
          deltaPct: originValue === 0 ? null : (point.forecastValue - originValue) / originValue,
          maseScale: naiveScale,
          metadata: point.metadata,
        }, actualObservedAtByTargetDate, input.request.targetBasis),
        originValue,
        forecastValue: point.forecastValue,
        actualValue: actual.value,
        error,
        absoluteError: Math.abs(error),
        delta: point.forecastValue - originValue,
        deltaPct: originValue === 0 ? null : (point.forecastValue - originValue) / originValue,
        maseScale: naiveScale,
        metadata: point.metadata,
      }

      const existing = recordsByHorizon.get(horizon) ?? []
      existing.push(record)
      recordsByHorizon.set(horizon, existing)
    }
  }

  const compatibility = createRecentVerificationStatisticalCompatibility({
    sourceFrequency,
    targetCadence,
    targetSemantics: input.targetSemantics,
  })
  const verification = Object.fromEntries(
    [...recordsByHorizon.entries()]
      .sort(([, left], [, right]) => (left[0]?.horizonSteps ?? 0) - (right[0]?.horizonSteps ?? 0))
      .map(([horizon, records]) => [
        horizon,
        {
          horizon,
          horizonSteps: records[0]?.horizonSteps ?? 0,
          origins: records.length,
          expectedOrigins: selectedOrigins.length,
          successfulOrigins: records.length,
          failedOrigins: 0,
          coverage: selectedOrigins.length === 0 ? 0 : records.length / selectedOrigins.length,
          metrics: calculateRecentVerificationMetrics(records),
          records: [...records].sort((left, right) => left.forecastOrigin.localeCompare(right.forecastOrigin)),
          failures: [],
        } satisfies ForecastVerificationHorizon,
      ]),
  )

  if (Object.keys(verification).length === 0) {
    throw new Error('PREPARATION_REQUIRED: Prepared Recent Verification artifact is present but not renderable.')
  }

  return {
    seriesId: input.benchmark.seriesId,
    modelId: input.request.modelId,
    displayName: input.authoritativeHistory.benchmarkName,
    description: normalizeOptionalString(input.authoritativeHistory.description),
    targetBasis: input.request.targetBasis,
    targetSemantics: input.targetSemantics,
    methodId: resolveCapabilityIdentity(input.request.targetBasis, input.methodVersion).methodId,
    methodVersion: input.methodVersion,
    source: {
      kind: input.source.kind,
      runId: input.source.runId,
    },
    historyFingerprint: buildForecastHistoryFingerprint(identityHistory, input.cadenceContext.cadence ?? undefined),
    cadence: input.cadenceContext.cadence,
    frequencyIdentity: input.cadenceContext.frequencyIdentity,
    statisticalCompatibility: compatibility,
    preparation: preparationIdentityFromHistory(identityHistory),
    history: historySummaryFromBridge(identityHistory),
    forecastOrigin: latestLawfulMaturedOrigin,
    runtimeSeconds: null,
    verification,
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

function resolveVerificationHorizonStepsFromLabel(horizonLabel: string) {
  const parsed = Number.parseInt(horizonLabel, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseIsoDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizePeriodIdentityKey(value: string | Date | null) {
  if (!value) {
    return null
  }

  const raw = value instanceof Date ? value.toISOString() : String(value)
  const parsed = parseIsoDate(raw)
  if (parsed) {
    return parsed.toISOString()
  }

  const trimmed = raw.trim()
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

function hasRequiredArtifactIdentity(artifact: ForecastPersistedArtifactBase) {
  return typeof artifact.seriesId === 'string'
    && artifact.seriesId.trim().length > 0
    && typeof artifact.modelId === 'string'
    && artifact.modelId.trim().length > 0
    && typeof artifact.methodId === 'string'
    && artifact.methodId.trim().length > 0
    && typeof artifact.methodVersion === 'string'
    && artifact.methodVersion.trim().length > 0
    && typeof artifact.historyFingerprint === 'string'
    && artifact.historyFingerprint.trim().length > 0
}

function hasRenderableCurrentPoint(point: ForecastCurrentPoint) {
  return point.horizon.trim().length > 0
    && Number.isInteger(point.horizonSteps)
    && point.horizonSteps > 0
    && parseIsoDate(point.forecastDate) !== null
    && typeof point.forecastValue === 'number'
    && Number.isFinite(point.forecastValue)
}

function isRenderableCurrentArtifact(artifact: PersistedCurrentArtifact) {
  if (!hasRequiredArtifactIdentity(artifact) || parseIsoDate(artifact.forecastOrigin) === null) {
    return false
  }

  const points = Object.values(artifact.currentForecast)
  if (points.length === 0) {
    return false
  }

  return points.some((point) => hasRenderableCurrentPoint(point))
}

function hasRenderableVerificationRecord(record: ForecastVerificationRecord) {
  return Number.isInteger(record.horizonSteps)
    && record.horizonSteps > 0
    && parseIsoDate(record.forecastOrigin) !== null
    && parseIsoDate(record.forecastDate) !== null
    && Number.isFinite(record.originValue)
    && Number.isFinite(record.forecastValue)
    && Number.isFinite(record.actualValue)
}

function hasRenderableVerificationHorizon(horizon: ForecastVerificationHorizon) {
  return horizon.horizon.trim().length > 0
    && Number.isInteger(horizon.horizonSteps)
    && horizon.horizonSteps > 0
    && (
      horizon.records.some((record) => hasRenderableVerificationRecord(record))
      || horizon.metrics !== null
    )
}

function isRenderableVerificationArtifact(artifact: PersistedVerificationArtifact) {
  if (!hasRequiredArtifactIdentity(artifact) || parseIsoDate(artifact.forecastOrigin) === null) {
    return false
  }

  const horizons = Object.values(artifact.verification)
  if (horizons.length === 0) {
    return false
  }

  return horizons.some((horizon) => hasRenderableVerificationHorizon(horizon))
}

function resolveArtifactTrainingPolicyContext(
  artifact: ForecastPersistedArtifactBase,
  targetSemantics: ForecastTargetSemantics,
) {
  const sourceFrequency = artifact.cadence?.sourceFrequency
    ?? normalizeForecastSourceFrequency(artifact.history.frequency)
  const targetCadence = artifact.cadence?.targetCadence
    ?? normalizeForecastSourceFrequency(artifact.history.frequency)

  if (!sourceFrequency || !targetCadence) {
    return null
  }

  return {
    sourceFrequency,
    targetCadence,
    targetSemantics,
  }
}

function artifactMatchesPreparedReadAuthority(
  artifact: ForecastPersistedArtifactBase,
  expected: {
    seriesId: string
    modelId: string
    targetBasis: ForecastTargetBasis
    targetSemantics: ForecastTargetSemantics
    methodId: ForecastMethodId
    methodVersion: string
    frequencyIdentity: string
    sourceFrequency: ForecastSourceFrequency
    targetCadence: ForecastTargetCadence
    expectedHistoryFingerprint: string
  },
) {
  if (
    artifact.seriesId !== expected.seriesId
    || artifact.modelId !== expected.modelId
    || artifact.targetBasis !== expected.targetBasis
    || artifact.targetSemantics !== expected.targetSemantics
    || artifact.methodId !== expected.methodId
    || artifact.methodVersion !== expected.methodVersion
    || artifact.frequencyIdentity !== expected.frequencyIdentity
    || artifact.historyFingerprint !== expected.expectedHistoryFingerprint
  ) {
    return false
  }

  const cadenceContext = resolveArtifactTrainingPolicyContext(artifact, expected.targetSemantics)
  return cadenceContext?.sourceFrequency === expected.sourceFrequency
    && cadenceContext.targetCadence === expected.targetCadence
}

function satisfiesCurrentPreparedTrainingPolicy(
  artifact: PersistedCurrentArtifact,
  targetSemantics: ForecastTargetSemantics,
) {
  const context = resolveArtifactTrainingPolicyContext(artifact, targetSemantics)
  if (!context) {
    return false
  }

  if (doesForecastArtifactSatisfyRequest(
    artifact.statisticalCompatibility,
    createCurrentForecastStatisticalCompatibility(context),
  )) {
    return true
  }

  return doesForecastArtifactSatisfyRequest(
    artifact.statisticalCompatibility,
    createLegacyUnresolvedForecastStatisticalCompatibility('CURRENT', context),
  )
}

function satisfiesVerificationPreparedTrainingPolicy(
  artifact: PersistedVerificationArtifact,
  targetSemantics: ForecastTargetSemantics,
) {
  const context = resolveArtifactTrainingPolicyContext(artifact, targetSemantics)
  if (!context) {
    return false
  }

  const requested = createFullVerificationStatisticalCompatibility(context)
  if (doesForecastArtifactSatisfyRequest(artifact.statisticalCompatibility, requested)) {
    return true
  }

  return doesForecastArtifactSatisfyRequest(
    artifact.statisticalCompatibility,
    createLegacyUnresolvedForecastStatisticalCompatibility('VERIFICATION', context),
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
      statisticalCompatibility: artifact.statisticalCompatibility,
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
      statisticalCompatibility: artifact.statisticalCompatibility,
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
  const sourceFrequency = cadenceContext.cadence?.sourceFrequency
    ?? normalizeForecastSourceFrequency(response.result.history.frequency)
  const targetCadence = cadenceContext.cadence?.targetCadence
    ?? normalizeForecastSourceFrequency(response.result.history.frequency)

  if (!sourceFrequency || !targetCadence) {
    throw new Error('Current artifact mapping requires lawful source and target cadence.')
  }

  const statisticalCompatibility = createCurrentForecastStatisticalCompatibility({
    sourceFrequency,
    targetCadence,
    targetSemantics: identity.targetSemantics,
  })

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
    statisticalCompatibility,
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
  const sourceFrequency = cadenceContext.cadence?.sourceFrequency
    ?? normalizeForecastSourceFrequency(authoritativeHistory.frequency)
  const targetCadence = cadenceContext.cadence?.targetCadence
    ?? normalizeForecastSourceFrequency(authoritativeHistory.frequency)

  if (!sourceFrequency || !targetCadence) {
    throw new Error('Verification artifact mapping requires lawful source and target cadence.')
  }

  const statisticalCompatibility = createFullVerificationStatisticalCompatibility({
    sourceFrequency,
    targetCadence,
    targetSemantics: identity.targetSemantics,
  })
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
    statisticalCompatibility,
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

function buildVerificationBridgeArgs(options: ForecastVerificationExecutionOptions = {}) {
  const args: string[] = []

  if (options.historicalOriginStartDate) {
    args.push('--historical-origin-start-date', options.historicalOriginStartDate)
  }

  if (options.lastProcessedOriginDate) {
    args.push('--last-processed-origin-date', options.lastProcessedOriginDate)
  }

  if (options.maxOriginsPerRun != null) {
    args.push('--max-origins-per-run', String(options.maxOriginsPerRun))
  }

  return args
}

async function executeLiveForecastBridge(
  configuration: ForecastBridgeReadyConfiguration,
  mode: ForecastBridgeMode,
  seriesId: string,
  targetBasis: ForecastTargetBasis,
  modelId?: string,
  options?: ForecastVerificationExecutionOptions,
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
      return await executeForecastBridge(
        configuration,
        mode,
        seriesId,
        modelId,
        [
          '--history-json',
          historyPath,
          ...(mode === 'verification' ? buildVerificationBridgeArgs(options) : []),
        ],
      )
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

export async function executePreparedLiveForecastBridge(
  configuration: ForecastBridgeReadyConfiguration,
  payload: LiveForecastBridgePayload,
  mode: ForecastBridgeMode,
  seriesId: string,
  modelId?: string,
  options?: ForecastVerificationExecutionOptions,
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-runtime-forecast-'))
  const historyPath = path.join(tempDir, `${seriesId}.json`)

  try {
    await writeFile(historyPath, JSON.stringify(payload), 'utf8')
    return await executeForecastBridge(
      configuration,
      mode,
      seriesId,
      modelId,
      [
        '--history-json',
        historyPath,
        ...(mode === 'verification' ? buildVerificationBridgeArgs(options) : []),
      ],
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function executePreparedForecastBridge(
  payload: LiveForecastBridgePayload,
  mode: ForecastBridgeMode,
  seriesId: string,
  modelId?: string,
  options?: ForecastVerificationExecutionOptions,
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  const configuration = resolveForecastBridgeConfiguration()
  if (!configuration.ok) {
    return {
      status: 'NOT_AVAILABLE',
      reason: configuration.reason,
    }
  }

  return executePreparedLiveForecastBridge(configuration, payload, mode, seriesId, modelId, options)
}

async function prepareExecutionContext(
  input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>,
): Promise<ForecastPreparedExecutionContext | null> {
  const configuration = resolveForecastBridgeConfiguration()
  if (!configuration.ok) {
    return null
  }

  const currentBasePayload = await loadLiveForecastBridgePayload(input.seriesId, {
    targetBasis: input.targetBasis,
    targetCadence: input.targetCadence,
    continuityPolicy: input.targetCadence === 'MONTHLY' || input.targetCadence === undefined ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  if (!currentBasePayload) {
    return null
  }

  return {
    exportHistory(mode = 'verification', modelId) {
      if (mode === 'current') {
        if (!modelId || !isUserFacingModel(modelId)) {
          throw new Error('Prepared Current history requires a user-facing modelId.')
        }

        const userFacingModelId = modelId as UserFacingForecastModelId

        const currentPayload = selectMinimalLawfulCurrentTrainingPayload(
          currentBasePayload,
          resolveForecastTechnicalMinimumObservations({
            targetSemantics: resolveForecastMethodContract(input.targetBasis).targetSemantics,
            modelId: userFacingModelId,
          }),
        )

        return executePreparedLiveForecastBridge(
          configuration,
          currentPayload,
          'history',
          input.seriesId,
        ) as Promise<ForecastHistoryBridgeResponse>
      }

      return (async () => {
        const verificationPayload = await loadLiveForecastBridgePayload(input.seriesId, {
          targetBasis: input.targetBasis,
          targetCadence: input.targetCadence,
        })
        if (!verificationPayload) {
          return {
            status: 'UNSUPPORTED',
            reason: `Forecast targetBasis ${input.targetBasis} requires an implemented lawful source adapter.`,
            seriesId: input.seriesId,
            supportedSeriesIds: [input.seriesId],
            supportedModels: [...USER_FACING_FORECAST_MODELS],
          } satisfies ForecastBridgeUnsupported
        }

        return executePreparedLiveForecastBridge(
          configuration,
          verificationPayload,
          'history',
          input.seriesId,
        ) as Promise<ForecastHistoryBridgeResponse>
      })()
    },
    exportCurrent(modelId) {
      if (!isUserFacingModel(modelId)) {
        throw new Error('Prepared Current execution requires a user-facing modelId.')
      }

      const userFacingModelId = modelId as UserFacingForecastModelId

      return executePreparedLiveForecastBridge(
        configuration,
        selectMinimalLawfulCurrentTrainingPayload(
          currentBasePayload,
          resolveForecastTechnicalMinimumObservations({
            targetSemantics: resolveForecastMethodContract(input.targetBasis).targetSemantics,
            modelId: userFacingModelId,
          }),
        ),
        'current',
        input.seriesId,
        userFacingModelId,
      ) as Promise<ForecastCurrentBridgeResponse>
    },
    exportVerification(modelId, options) {
      return (async () => {
        const verificationPayload = await loadLiveForecastBridgePayload(input.seriesId, {
          targetBasis: input.targetBasis,
          targetCadence: input.targetCadence,
        })
        if (!verificationPayload) {
          return {
            status: 'UNSUPPORTED',
            reason: `Forecast targetBasis ${input.targetBasis} requires an implemented lawful source adapter.`,
            seriesId: input.seriesId,
            supportedSeriesIds: [input.seriesId],
            supportedModels: [...USER_FACING_FORECAST_MODELS],
          } satisfies ForecastBridgeUnsupported
        }

        return executePreparedLiveForecastBridge(
          configuration,
          verificationPayload,
          'verification',
          input.seriesId,
          modelId,
          options,
        ) as Promise<ForecastVerificationBridgeResponse>
      })()
    },
  }
}

async function runForecastBridge(
  mode: ForecastBridgeMode,
  seriesId: string,
  targetBasis: ForecastTargetBasis,
  modelId?: string,
  options?: ForecastVerificationExecutionOptions,
): Promise<ForecastHistoryBridgeResponse | ForecastCurrentBridgeResponse | ForecastVerificationBridgeResponse> {
  const configuration = resolveForecastBridgeConfiguration()
  if (!configuration.ok) {
    return {
      status: 'NOT_AVAILABLE',
      reason: configuration.reason,
    }
  }

  const dailyResult = await executeLiveForecastBridge(configuration, mode, seriesId, targetBasis, modelId, options)
  if (dailyResult.status !== 'UNSUPPORTED') {
    return dailyResult
  }

  if (targetBasis !== DEFAULT_FORECAST_TARGET_BASIS) {
    return dailyResult
  }

  return executeForecastBridge(
    configuration,
    mode,
    seriesId,
    modelId,
    mode === 'verification' ? buildVerificationBridgeArgs(options) : [],
  )
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
      return runForecastBridge(
        'verification',
        input.seriesId,
        input.targetBasis,
        input.modelId,
        {
          historicalOriginStartDate: input.historicalOriginStartDate,
          lastProcessedOriginDate: input.lastProcessedOriginDate,
          maxOriginsPerRun: input.maxOriginsPerRun,
        },
      ) as Promise<ForecastVerificationBridgeResponse>
    },
  }
}

export async function readCurrentRunFromPrisma(key: ForecastCacheLookupKey): Promise<PersistedCurrentArtifact | null> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const where = {
    seriesId: key.seriesId,
    inputSource: key.inputSource,
    historyFingerprint: key.historyFingerprint,
    targetBasis: key.targetBasis,
    methodId: key.methodId,
    modelId: key.modelId,
    methodVersion: key.methodVersion,
    frequency: key.frequencyIdentity,
  } as const
  const select: Prisma.ForecastCurrentRunSelect = {
    seriesId: true,
    modelId: true,
    displayName: true,
    description: true,
    targetBasis: true,
    methodVersion: true,
    inputSource: true,
    inputRunId: true,
    historyFingerprint: true,
    frequency: true,
    trainingWindowPolicyId: true,
    effectiveTrainingPolicyId: true,
    historyStartAt: true,
    historyEndAt: true,
    observationCount: true,
    forecastOriginAt: true,
    runtimeSeconds: true,
    points: {
      select: {
        horizonLabel: true,
        horizonSteps: true,
        forecastDate: true,
        forecastValue: true,
        metadataJson: true,
        failureReason: true,
      },
      orderBy: [
        { horizonSteps: 'asc' },
        { forecastDate: 'asc' },
      ],
    },
  }
  const legacySelect: Prisma.ForecastCurrentRunSelect = {
    ...select,
    trainingWindowPolicyId: false,
    effectiveTrainingPolicyId: false,
  }

  let run: PersistedCurrentRunRecord | null

  try {
    run = await prisma.forecastCurrentRun.findFirst({
      where: {
        ...where,
        trainingWindowPolicyId: key.trainingWindowPolicyId,
        effectiveTrainingPolicyId: key.effectiveTrainingPolicyId,
      },
      select,
    }) as PersistedCurrentRunRecord | null ?? await prisma.forecastCurrentRun.findFirst({
      where: {
        ...where,
        trainingWindowPolicyId: null,
        effectiveTrainingPolicyId: null,
      },
      select,
    }) as PersistedCurrentRunRecord | null
  } catch (error) {
    if (!isMissingCurrentTrainingPolicyColumnError(error)) {
      throw error
    }

    const legacyRun = await prisma.forecastCurrentRun.findFirst({
      where,
      select: legacySelect,
    }) as Omit<PersistedCurrentRunRecord, 'trainingWindowPolicyId' | 'effectiveTrainingPolicyId'> | null

    run = legacyRun
      ? {
          ...legacyRun,
          trainingWindowPolicyId: null,
          effectiveTrainingPolicyId: null,
        }
      : null
  }

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
  const sourceFrequency = storedCadence?.legacyMonthly
    ? 'MONTHLY'
    : storedCadence?.sourceFrequency ?? normalizeForecastSourceFrequency(run.frequency)
  const targetCadence = storedCadence?.legacyMonthly
    ? 'MONTHLY'
    : storedCadence?.targetCadence ?? normalizeForecastSourceFrequency(run.frequency)

  if (!sourceFrequency || !targetCadence) {
    throw new Error('Stored Current artifact requires lawful source and target cadence.')
  }

  const resolvedCompatibility = resolvePersistedForecastStatisticalCompatibility('CURRENT', run, {
    sourceFrequency,
    targetCadence,
    targetSemantics: key.targetSemantics,
  })
  if (!resolvedCompatibility) {
    return null
  }

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
    statisticalCompatibility: resolvedCompatibility,
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

export async function writeCurrentRunWithPrisma(
  artifact: PersistedCurrentArtifact,
  options?: ForecastRepositoryWriteOptions,
) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const observedAt = new Date().toISOString()
  const shouldFenceOwnership = options?.ownership
    ? await hasForecastPreparationExecutionLedgerRelation(prisma)
    : false
  const supportsTrainingPolicyColumns = await hasForecastRunTrainingPolicyColumns(prisma, 'forecast_current_runs')

  await prisma.$transaction(async (tx) => {
    if (shouldFenceOwnership) {
      await assertForecastPersistenceOwnership(tx, options?.ownership, observedAt)
    }

    const currentRunIdentityWhere = {
      seriesId: artifact.seriesId,
      inputSource: artifact.source.kind,
      historyFingerprint: artifact.historyFingerprint,
      targetBasis: artifact.targetBasis,
      methodId: artifact.methodId,
      modelId: artifact.modelId,
      methodVersion: artifact.methodVersion,
      frequency: artifact.frequencyIdentity,
    } as const
    const currentRunCreate = {
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
      trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
      status: 'AVAILABLE',
      failureReason: null,
      runtimeSeconds: artifact.runtimeSeconds,
    } as const
    const currentRunUpdate = {
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
      trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
      status: 'AVAILABLE',
      failureReason: null,
      runtimeSeconds: artifact.runtimeSeconds,
    } as const
    const legacyCurrentRunCreate = {
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
    } as const
    const legacyCurrentRunUpdate = {
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
    } as const

    let run: { id: string }

    if (!supportsTrainingPolicyColumns) {
      const legacyRunId = await findLegacyCurrentRunId(tx, currentRunIdentityWhere)

      run = legacyRunId
        ? await updateLegacyCurrentRun(tx, legacyRunId, artifact)
        : await createLegacyCurrentRun(tx, artifact)
    } else {
      run = await tx.forecastCurrentRun.upsert({
        where: {
          seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion_trainingWindowPolicyId_effectiveTrainingPolicyId: {
            ...currentRunIdentityWhere,
            trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
            effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
          },
        },
        create: currentRunCreate,
        update: currentRunUpdate,
      })
    }

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

  const where = {
    seriesId: key.seriesId,
    inputSource: key.inputSource,
    historyFingerprint: key.historyFingerprint,
    targetBasis: key.targetBasis,
    methodId: key.methodId,
    modelId: key.modelId,
    methodVersion: key.methodVersion,
    frequency: key.frequencyIdentity,
  } as const
  const select: Prisma.ForecastVerificationRunSelect = {
    seriesId: true,
    modelId: true,
    displayName: true,
    description: true,
    targetBasis: true,
    methodVersion: true,
    inputSource: true,
    inputRunId: true,
    historyFingerprint: true,
    frequency: true,
    trainingWindowPolicyId: true,
    effectiveTrainingPolicyId: true,
    historyStartAt: true,
    historyEndAt: true,
    observationCount: true,
    forecastOriginAt: true,
    runtimeSeconds: true,
    metrics: {
      select: {
        horizonLabel: true,
        horizonSteps: true,
        origins: true,
        expectedOrigins: true,
        failedOrigins: true,
        coverage: true,
        mae: true,
        rmse: true,
        mase: true,
        smape: true,
        directionalAccuracy: true,
        bias: true,
        failureSummaryJson: true,
      },
      orderBy: {
        horizonSteps: 'asc',
      },
    },
    points: {
      select: {
        horizonLabel: true,
        horizonSteps: true,
        forecastOriginAt: true,
        targetDate: true,
        actualObservedAt: true,
        originValue: true,
        forecastValue: true,
        actualValue: true,
        errorValue: true,
        absoluteErrorValue: true,
        deltaValue: true,
        deltaPct: true,
        maseScale: true,
        metadataJson: true,
      },
      orderBy: [
        { horizonSteps: 'asc' },
        { forecastOriginAt: 'asc' },
        { targetDate: 'asc' },
      ],
    },
  }
  const legacySelect: Prisma.ForecastVerificationRunSelect = {
    ...select,
    trainingWindowPolicyId: false,
    effectiveTrainingPolicyId: false,
  }

  let run: PersistedVerificationRunRecord | null

  try {
    run = await prisma.forecastVerificationRun.findFirst({
      where: {
        ...where,
        trainingWindowPolicyId: key.trainingWindowPolicyId,
        effectiveTrainingPolicyId: key.effectiveTrainingPolicyId,
      },
      select,
    }) as PersistedVerificationRunRecord | null ?? await prisma.forecastVerificationRun.findFirst({
      where: {
        ...where,
        trainingWindowPolicyId: null,
        effectiveTrainingPolicyId: null,
      },
      select,
    }) as PersistedVerificationRunRecord | null
  } catch (error) {
    if (!isMissingVerificationTrainingPolicyColumnError(error)) {
      throw error
    }

    const legacyRun = await prisma.forecastVerificationRun.findFirst({
      where,
      select: legacySelect,
    }) as Omit<PersistedVerificationRunRecord, 'trainingWindowPolicyId' | 'effectiveTrainingPolicyId'> | null

    run = legacyRun
      ? {
          ...legacyRun,
          trainingWindowPolicyId: null,
          effectiveTrainingPolicyId: null,
        }
      : null
  }

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
  const sourceFrequency = storedCadence?.legacyMonthly
    ? 'MONTHLY'
    : storedCadence?.sourceFrequency ?? normalizeForecastSourceFrequency(run.frequency)
  const targetCadence = storedCadence?.legacyMonthly
    ? 'MONTHLY'
    : storedCadence?.targetCadence ?? normalizeForecastSourceFrequency(run.frequency)

  if (!sourceFrequency || !targetCadence) {
    throw new Error('Stored Verification artifact requires lawful source and target cadence.')
  }

  const resolvedCompatibility = resolvePersistedForecastStatisticalCompatibility('VERIFICATION', run, {
    sourceFrequency,
    targetCadence,
    targetSemantics: key.targetSemantics,
  })
  if (!resolvedCompatibility) {
    return null
  }

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
    statisticalCompatibility: resolvedCompatibility,
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

export async function writeVerificationRunWithPrisma(
  artifact: PersistedVerificationArtifact,
  options?: ForecastRepositoryWriteOptions,
) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const observedAt = new Date().toISOString()
  const shouldFenceOwnership = options?.ownership
    ? await hasForecastPreparationExecutionLedgerRelation(prisma)
    : false
  const supportsTrainingPolicyColumns = await hasForecastRunTrainingPolicyColumns(prisma, 'forecast_verification_runs')

  await prisma.$transaction(async (tx) => {
    if (shouldFenceOwnership) {
      await assertForecastPersistenceOwnership(tx, options?.ownership, observedAt)
    }

    const verificationRunIdentityWhere = {
      seriesId: artifact.seriesId,
      inputSource: artifact.source.kind,
      historyFingerprint: artifact.historyFingerprint,
      targetBasis: artifact.targetBasis,
      methodId: artifact.methodId,
      modelId: artifact.modelId,
      methodVersion: artifact.methodVersion,
      frequency: artifact.frequencyIdentity,
    } as const
    const verificationRunCreate = {
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
      trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
      status: 'AVAILABLE',
      failureReason: null,
      runtimeSeconds: artifact.runtimeSeconds,
    } as const
    const verificationRunUpdate = {
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
      trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
      status: 'AVAILABLE',
      failureReason: null,
      runtimeSeconds: artifact.runtimeSeconds,
    } as const
    const legacyVerificationRunCreate = {
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
    } as const
    const legacyVerificationRunUpdate = {
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
    } as const

    let run: { id: string }

    if (!supportsTrainingPolicyColumns) {
      const legacyRunId = await findLegacyVerificationRunId(tx, verificationRunIdentityWhere)

      run = legacyRunId
        ? await updateLegacyVerificationRun(tx, legacyRunId, artifact)
        : await createLegacyVerificationRun(tx, artifact)
    } else {
      run = await tx.forecastVerificationRun.upsert({
        where: {
          seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion_trainingWindowPolicyId_effectiveTrainingPolicyId: {
            ...verificationRunIdentityWhere,
            trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
            effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
          },
        },
        create: verificationRunCreate,
        update: verificationRunUpdate,
      })
    }

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
      trainingWindowPolicyId: key.trainingWindowPolicyId,
      effectiveTrainingPolicyId: key.effectiveTrainingPolicyId,
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
      trainingWindowPolicyId: key.trainingWindowPolicyId,
      effectiveTrainingPolicyId: key.effectiveTrainingPolicyId,
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
    executionLedger: dependencies.executionLedger ?? createDefaultForecastPreparationExecutionLedger(),
    executionContextRegistry: dependencies.executionContextRegistry ?? createForecastPreparationExecutionContextRegistry(),
    executionAdmission: dependencies.executionAdmission ?? createDefaultForecastPreparationExecutionAdmission(),
    resolveExactPreparedCapability: dependencies.resolveExactPreparedCapability ?? resolveExactForecastCapability,
    executePreparedCurrent: dependencies.executePreparedCurrent ?? executePreparedForecastBridge,
  }
  const isExecutionContextReleaseEvent = (eventType: string) =>
    eventType === 'single_flight_entry_released'
  const durableWaitBackoffMs = [25, 50, 100, 200, 400] as const
  const stage3HeartbeatIntervalMs = resolveForecastStage3HeartbeatIntervalMs(resolvedDependencies.executionAdmission.leaseDurationMs)
  const stage3WaiterMaxWaitMs = resolveStage3WaiterMaxWaitMs(resolvedDependencies.executionAdmission.leaseDurationMs)
  const waitForBackoff = (attempt: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      throwIfAborted(signal)
      let timeout: ReturnType<typeof setTimeout> | null = null

      const onAbort = () => {
        if (timeout) {
          clearTimeout(timeout)
        }
        signal?.removeEventListener('abort', onAbort)
        reject(asAbortError(signal))
      }

      timeout = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, durableWaitBackoffMs[Math.min(attempt, durableWaitBackoffMs.length - 1)])

      signal?.addEventListener('abort', onAbort, { once: true })
    })
  const buildPersistenceOwnership = (
    operationFamily: 'CURRENT' | 'VERIFICATION',
    logicalArtifactKey: string,
    ownership: ForecastPreparationOwnedExecutionContext,
  ): ForecastPersistenceOwnership => ({
    operationFamily,
    logicalArtifactKey,
    executionId: ownership.executionId,
    ownerToken: ownership.ownerToken,
    leaseVersion: ownership.leaseVersion,
    requestId: ownership.requestId,
    ownerRequestId: ownership.ownerRequestId,
    role: ownership.role,
  })

  const toAuthoritativeExecutionLedgerContext = (
    ownership: ForecastPreparationOwnedExecutionContext,
  ): Stage3AuthoritativeExecutionLedgerContext => ({
    executionId: ownership.executionId,
    ownerToken: ownership.ownerToken,
    leaseVersion: ownership.leaseVersion,
    attemptKind: ownership.attemptKind,
    executionMode: ownership.executionMode,
    leaseAcquiredAt: ownership.leaseAcquiredAt,
    leaseExpiresAt: ownership.leaseExpiresAt,
    recoveredFromExecutionId: ownership.recoveredFromExecutionId,
  })

  const toWaiterExecutionLedgerContext = (
    admission: Extract<Awaited<ReturnType<ForecastPreparationExecutionAdmission['acquireExecution']>>, { role: 'WAITER' }>,
  ): Stage3ExecutionLedgerContext => ({
    executionId: admission.executionId,
  })

  const isAuthoritativeExecutionLedgerContext = (
    executionContext: Stage3ExecutionLedgerContext,
  ): executionContext is Stage3AuthoritativeExecutionLedgerContext => 'ownerToken' in executionContext

  const recordAuthoritativeExecutionEvent = (
    executionContext: Stage3ExecutionLedgerContext | null,
    inputEvent: Omit<Parameters<ForecastPreparationExecutionLedger['recordEvent']>[0], 'executionId'>,
    context: { seriesId: string; modelId: string },
  ) => {
    if (!executionContext || isExecutionContextReleaseEvent(inputEvent.eventType)) {
      return
    }

    void resolvedDependencies.executionLedger.recordEvent({
      executionId: executionContext.executionId,
      ...inputEvent,
      ...(isAuthoritativeExecutionLedgerContext(executionContext)
        ? {
            attemptKind: executionContext.attemptKind,
            executionMode: executionContext.executionMode,
            ownerToken: executionContext.ownerToken,
            leaseVersion: executionContext.leaseVersion,
            leaseAcquiredAt: executionContext.leaseAcquiredAt,
            leaseExpiresAt: executionContext.leaseExpiresAt,
            recoveredFromExecutionId: executionContext.recoveredFromExecutionId,
          }
        : {}),
    }).catch((error) => {
      resolvedDependencies.logEvent('FORECAST_PREPARATION_EXECUTION_LEDGER', {
        seriesId: context.seriesId,
        modelId: context.modelId,
        operationFamily: inputEvent.operationFamily,
        ledgerFailure: true,
        ledgerError: error instanceof Error ? error.message : 'unknown',
      })
    })
  }

  const startLeaseHeartbeat = (
    logicalArtifactKey: string,
    ownership: ForecastPreparationOwnedExecutionContext,
    requestId: string,
  ) => startForecastExecutionLeaseHeartbeat({
    executionAdmission: resolvedDependencies.executionAdmission,
    logicalArtifactKey,
    ownership,
    requestId,
    heartbeatIntervalMs: stage3HeartbeatIntervalMs,
  })

  return {
    async readPreparedCurrentForecastRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastCurrentResult> {
      const startedAt = performance.now()
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const fastPathContext = resolvePreparedReadFastPathContext(input)
      const cadenceContext = fastPathContext
        ? fastPathContext.cadenceContext
        : await traceForecastRequestDiagnosticsSpan(
            'prepared_current_cadence_resolution',
            'APPLICATION',
            () => resolvePreparedReadCadenceContext(
              input,
              resolveCapabilityIdentity(input.targetBasis).targetSemantics,
              resolvedDependencies.resolveExactPreparedCapability,
            ),
            { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis },
          )

      if (cadenceContext.blockedReason) {
        const identity = resolveCapabilityIdentity(input.targetBasis)
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: cadenceContext.blockedReason,
        }
      }

      const identity = resolveCapabilityIdentity(input.targetBasis)
      const historyResponse = fastPathContext
        ? null
        : await traceForecastRequestDiagnosticsSpan(
            'prepared_current_history_lookup',
            'SOURCE_DATA',
            () => readPreparedHistoryForLookup(
              input,
              cadenceContext,
              resolvedDependencies.bridge,
              'current',
              input.modelId,
            ),
            { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis },
          )

      if (historyResponse?.status === 'NOT_AVAILABLE') {
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

      if (historyResponse?.status === 'UNSUPPORTED') {
        return toUnsupportedResult(historyResponse, input)
      }

      if (historyResponse?.status === 'FAILED') {
        const failedIdentity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
        return {
          status: 'FAILED',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: failedIdentity.targetSemantics,
          methodId: failedIdentity.methodId,
          reason: historyResponse.reason,
          methodVersion: historyResponse.methodVersion,
          source: historyResponse.source,
        }
      }

      const sourceFrequency = fastPathContext
        ? fastPathContext.cadenceContext.cadence?.sourceFrequency ?? null
        : cadenceContext.cadence?.sourceFrequency
          ?? normalizeForecastSourceFrequency(historyResponse?.history.frequency)
      const targetCadence = fastPathContext
        ? fastPathContext.cadenceContext.cadence?.targetCadence ?? null
        : cadenceContext.cadence?.targetCadence
          ?? normalizeForecastSourceFrequency(historyResponse?.history.frequency)
      updateForecastRequestDiagnosticsIdentity({
        targetSemantics: identity.targetSemantics,
        sourceFrequency: sourceFrequency ?? null,
        targetCadence: targetCadence ?? null,
      })
      if (!sourceFrequency || !targetCadence) {
        throw new Error('Prepared Current lookup requires lawful source and target cadence.')
      }
      const expectedCompatibility = createCurrentForecastStatisticalCompatibility({
        sourceFrequency,
        targetCadence,
        targetSemantics: identity.targetSemantics,
      })
      const prepared = await traceForecastRequestDiagnosticsSpan(
        'prepared_current_artifact_lookup',
        'DB_OPERATION',
        () => fastPathContext && resolvedDependencies.repository.readLatestCurrentRun
          ? resolvedDependencies.repository.readLatestCurrentRun({
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              frequencyIdentity: cadenceContext.frequencyIdentity,
              trainingWindowPolicyId: expectedCompatibility.trainingWindowPolicyId,
              effectiveTrainingPolicyId: expectedCompatibility.effectiveTrainingPolicyId,
              ...identity,
            })
          : resolvedDependencies.repository.readCurrentRun({
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              frequencyIdentity: cadenceContext.frequencyIdentity,
              inputSource: historyResponse!.source.kind,
              historyFingerprint: buildForecastHistoryFingerprint(historyResponse!.history, cadenceContext.cadence ?? undefined),
              trainingWindowPolicyId: expectedCompatibility.trainingWindowPolicyId,
              effectiveTrainingPolicyId: expectedCompatibility.effectiveTrainingPolicyId,
              ...identity,
            }),
        {
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          sourceFrequency,
          targetCadence,
        },
      )

      noteForecastRequestDiagnosticsEvent('prepared_current_compute_absent', 'COMPUTE', {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })

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

      if (fastPathContext && !artifactMatchesPreparedReadAuthority(prepared, {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        targetSemantics: identity.targetSemantics,
        methodId: identity.methodId,
        methodVersion: identity.methodVersion,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        sourceFrequency,
        targetCadence,
        expectedHistoryFingerprint: fastPathContext.expectedHistoryFingerprint,
      })) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Trusted prepared-read authority does not match the persisted Current Forecast artifact.',
        }
      }

      if (!isRenderableCurrentArtifact(prepared)) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Prepared Current Forecast artifact is present but not renderable.',
        }
      }

      if (!satisfiesCurrentPreparedTrainingPolicy(prepared, identity.targetSemantics)) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Prepared Current Forecast training-policy identity is not compatible.',
        }
      }

      return toCurrentAvailable(prepared, 'hit')
    },

    async readPreparedVerificationRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastVerificationResult> {
      const startedAt = performance.now()
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const fastPathContext = resolvePreparedReadFastPathContext(input)
      const cadenceContext = fastPathContext
        ? fastPathContext.cadenceContext
        : await traceForecastRequestDiagnosticsSpan(
            'prepared_verification_cadence_resolution',
            'APPLICATION',
            () => resolvePreparedReadCadenceContext(
              input,
              resolveCapabilityIdentity(input.targetBasis).targetSemantics,
              resolvedDependencies.resolveExactPreparedCapability,
            ),
            { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis },
          )

      if (cadenceContext.blockedReason) {
        const identity = resolveCapabilityIdentity(input.targetBasis)
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: cadenceContext.blockedReason,
        }
      }

      const identity = resolveCapabilityIdentity(input.targetBasis)
      const historyResponse = fastPathContext
        ? null
        : await traceForecastRequestDiagnosticsSpan(
            'prepared_verification_history_lookup',
            'SOURCE_DATA',
            () => readPreparedHistoryForLookup(
              input,
              cadenceContext,
              resolvedDependencies.bridge,
              'verification',
            ),
            { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis },
          )

      if (historyResponse?.status === 'NOT_AVAILABLE') {
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

      if (historyResponse?.status === 'UNSUPPORTED') {
        return toUnsupportedResult(historyResponse, input)
      }

      if (historyResponse?.status === 'FAILED') {
        const failedIdentity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
        return {
          status: 'FAILED',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: failedIdentity.targetSemantics,
          methodId: failedIdentity.methodId,
          reason: historyResponse.reason,
          methodVersion: historyResponse.methodVersion,
          source: historyResponse.source,
        }
      }

      const sourceFrequency = fastPathContext
        ? fastPathContext.cadenceContext.cadence?.sourceFrequency ?? null
        : cadenceContext.cadence?.sourceFrequency
          ?? normalizeForecastSourceFrequency(historyResponse?.history.frequency)
      const targetCadence = fastPathContext
        ? fastPathContext.cadenceContext.cadence?.targetCadence ?? null
        : cadenceContext.cadence?.targetCadence
          ?? normalizeForecastSourceFrequency(historyResponse?.history.frequency)
      updateForecastRequestDiagnosticsIdentity({
        targetSemantics: identity.targetSemantics,
        sourceFrequency: sourceFrequency ?? null,
        targetCadence: targetCadence ?? null,
      })
      if (!sourceFrequency || !targetCadence) {
        throw new Error('Prepared Verification lookup requires lawful source and target cadence.')
      }
      const expectedCompatibility = createFullVerificationStatisticalCompatibility({
        sourceFrequency,
        targetCadence,
        targetSemantics: identity.targetSemantics,
      })
      const prepared = await traceForecastRequestDiagnosticsSpan(
        'prepared_verification_artifact_lookup',
        'DB_OPERATION',
        () => fastPathContext && resolvedDependencies.repository.readLatestVerificationRun
          ? resolvedDependencies.repository.readLatestVerificationRun({
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              frequencyIdentity: cadenceContext.frequencyIdentity,
              trainingWindowPolicyId: expectedCompatibility.trainingWindowPolicyId,
              effectiveTrainingPolicyId: expectedCompatibility.effectiveTrainingPolicyId,
              ...identity,
            })
          : resolvedDependencies.repository.readVerificationRun({
              seriesId: input.seriesId,
              modelId: input.modelId,
              targetBasis: input.targetBasis,
              frequencyIdentity: cadenceContext.frequencyIdentity,
              inputSource: historyResponse!.source.kind,
              historyFingerprint: buildForecastHistoryFingerprint(historyResponse!.history, cadenceContext.cadence ?? undefined),
              trainingWindowPolicyId: expectedCompatibility.trainingWindowPolicyId,
              effectiveTrainingPolicyId: expectedCompatibility.effectiveTrainingPolicyId,
              ...identity,
            }),
        {
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          sourceFrequency,
          targetCadence,
        },
      )

      noteForecastRequestDiagnosticsEvent('prepared_verification_compute_absent', 'COMPUTE', {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })

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

      if (fastPathContext && !artifactMatchesPreparedReadAuthority(prepared, {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        targetSemantics: identity.targetSemantics,
        methodId: identity.methodId,
        methodVersion: identity.methodVersion,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        sourceFrequency,
        targetCadence,
        expectedHistoryFingerprint: fastPathContext.expectedHistoryFingerprint,
      })) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Trusted prepared-read authority does not match the persisted Historical Verification artifact.',
        }
      }

      if (!isRenderableVerificationArtifact(prepared)) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Prepared Historical Verification artifact is present but not renderable.',
        }
      }

      if (!isVerificationArtifactComplete(prepared)) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: PARTIAL_VERIFICATION_REASON,
        }
      }

      if (!satisfiesVerificationPreparedTrainingPolicy(prepared, identity.targetSemantics)) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Prepared Historical Verification training-policy identity is not compatible.',
        }
      }

      return toVerificationAvailable(prepared, 'hit')
    },

    async readPreparedRecentVerificationRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastVerificationResult> {
      const startedAt = performance.now()
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const cadenceContext = await traceForecastRequestDiagnosticsSpan(
        'prepared_recent_verification_cadence_resolution',
        'APPLICATION',
        () => resolvePreparedReadCadenceContext(
          input,
          resolveCapabilityIdentity(input.targetBasis).targetSemantics,
          resolvedDependencies.resolveExactPreparedCapability,
        ),
        { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis },
      )

      if (cadenceContext.blockedReason) {
        const identity = resolveCapabilityIdentity(input.targetBasis)
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: cadenceContext.blockedReason,
        }
      }

      const historyResponse = await traceForecastRequestDiagnosticsSpan(
        'prepared_recent_verification_history_lookup',
        'SOURCE_DATA',
        () => readPreparedHistoryForLookup(
          input,
          cadenceContext,
          resolvedDependencies.bridge,
          'current',
          input.modelId,
        ),
        { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis },
      )

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

      const identity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
      const sourceFrequency = cadenceContext.cadence?.sourceFrequency
        ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
      const targetCadence = cadenceContext.cadence?.targetCadence
        ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
      updateForecastRequestDiagnosticsIdentity({
        targetSemantics: identity.targetSemantics,
        sourceFrequency: sourceFrequency ?? null,
        targetCadence: targetCadence ?? null,
      })
      if (!sourceFrequency || !targetCadence) {
        throw new Error('Prepared Recent Verification lookup requires lawful source and target cadence.')
      }
      const expectedCompatibility = createRecentVerificationStatisticalCompatibility({
        sourceFrequency,
        targetCadence,
        targetSemantics: identity.targetSemantics,
      })
      const prepared = await traceForecastRequestDiagnosticsSpan(
        'prepared_recent_verification_artifact_lookup',
        'DB_OPERATION',
        () => resolvedDependencies.repository.readVerificationRun({
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          frequencyIdentity: cadenceContext.frequencyIdentity,
          inputSource: historyResponse.source.kind,
          historyFingerprint: buildForecastHistoryFingerprint(historyResponse.history, cadenceContext.cadence ?? undefined),
          trainingWindowPolicyId: expectedCompatibility.trainingWindowPolicyId,
          effectiveTrainingPolicyId: expectedCompatibility.effectiveTrainingPolicyId,
          ...identity,
        }),
        {
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          sourceFrequency,
          targetCadence,
        },
      )

      noteForecastRequestDiagnosticsEvent('prepared_recent_verification_compute_absent', 'COMPUTE', {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })

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
          reason: 'PREPARATION_REQUIRED: No exact-identity prepared Recent Verification is available.',
        }
      }

      if (!isRenderableVerificationArtifact(prepared)) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Prepared Recent Verification artifact is present but not renderable.',
        }
      }

      const context = resolveArtifactTrainingPolicyContext(prepared, identity.targetSemantics)
      if (!context || !doesForecastArtifactSatisfyRequest(prepared.statisticalCompatibility, createRecentVerificationStatisticalCompatibility(context))) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: identity.targetSemantics,
          methodId: identity.methodId,
          reason: 'PREPARATION_REQUIRED: Prepared Recent Verification training-policy identity is not compatible.',
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
      const historyLoadStartedAt = performance.now()
      const cadenceContext = resolveArtifactCadenceContext(input)
      const preparedExecutionContext = await resolvedDependencies.bridge.prepareExecutionContext?.({
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        sourceFrequency: input.sourceFrequency,
        targetCadence: input.targetCadence,
      }) ?? null

      const historyResponse = preparedExecutionContext
        ? await preparedExecutionContext.exportHistory('current', input.modelId)
        : await resolvedDependencies.bridge.exportHistory({
            seriesId: input.seriesId,
            targetBasis: input.targetBasis,
          sourceFrequency: input.sourceFrequency,
          targetCadence: input.targetCadence,
          })
      const historyLoadDurationMs = performance.now() - historyLoadStartedAt
      resolvedDependencies.telemetry.emit('current_history_load', {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        durationMs: historyLoadDurationMs,
        status: historyResponse.status,
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
      const cacheStatisticalCompatibility = createCurrentForecastStatisticalCompatibility({
        sourceFrequency: cadenceContext.cadence?.sourceFrequency
          ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
          ?? 'MONTHLY',
        targetCadence: cadenceContext.cadence?.targetCadence
          ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
          ?? 'MONTHLY',
        targetSemantics: methodIdentity.targetSemantics,
      })
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
        trainingWindowPolicyId: cacheStatisticalCompatibility.trainingWindowPolicyId,
        effectiveTrainingPolicyId: cacheStatisticalCompatibility.effectiveTrainingPolicyId,
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
      const currentStatisticalCompatibility = createCurrentForecastStatisticalCompatibility({
        sourceFrequency,
        targetCadence,
        targetSemantics: methodIdentity.targetSemantics,
      })
      const logicalArtifactIdentity: CurrentLogicalArtifactIdentity = {
        artifactScope: currentStatisticalCompatibility.artifactScope,
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        trainingWindowPolicyId: currentStatisticalCompatibility.trainingWindowPolicyId,
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
      }
      const logicalArtifactKey = buildCurrentLogicalArtifactKey(logicalArtifactIdentity)
      const requestId = resolvedDependencies.telemetry.currentContext?.()?.requestId ?? randomUUID()
      const recordCurrentExecutionEvent = (
        executionContext: Stage3ExecutionLedgerContext | null,
        inputEvent: Omit<Parameters<ForecastPreparationExecutionLedger['recordEvent']>[0], 'executionId'>,
      ) => recordAuthoritativeExecutionEvent(executionContext, inputEvent, {
        seriesId: input.seriesId,
        modelId: input.modelId,
      })

      return runCurrentForecastSingleFlight<BenchmarkForecastCurrentResult>({
        logicalArtifactKey,
        requestId,
        async emit(event, eventData) {
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
          recordCurrentExecutionEvent(null, {
            logicalArtifactKey,
            operationFamily: 'CURRENT',
            logicalArtifactIdentity,
            requestId: eventData.requestId,
            ownerRequestId: eventData.ownerRequestId,
            role: eventData.role,
            eventType: event,
            durationMs: eventData.durationMs ?? null,
            error: eventData.error ?? null,
            activeSingleFlightEntries: eventData.activeCurrentSingleFlightEntries,
          })
        },
        operation: async () => {
          if (dbReadFailed) {
            throw new ForecastExecutionControlError(
              'CONTROL_DB_UNAVAILABLE',
              'Current forecast execution is fail-closed while PostgreSQL authority is unavailable.',
            )
          }

          const waitDeadline = Date.now() + stage3WaiterMaxWaitMs

          while (true) {
            throwIfAborted(input.signal)
            const admissionStartedAt = performance.now()
            const admission = await resolvedDependencies.executionAdmission.acquireExecution({
              operationFamily: 'CURRENT',
              logicalArtifactKey,
              logicalArtifactIdentity,
              requestId,
              ownerRequestId: requestId,
            })
            const admissionDurationMs = performance.now() - admissionStartedAt
            resolvedDependencies.telemetry.emit('current_execution_admission', {
              seriesId: input.seriesId,
              modelId: input.modelId,
              logicalArtifactKey,
              requestId,
              role: admission.role,
              durationMs: admissionDurationMs,
            })

            if (admission.role === 'WAITER') {
              recordCurrentExecutionEvent(toWaiterExecutionLedgerContext(admission), {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: admission.ownerRequestId,
                role: 'WAITER',
                eventType: 'single_flight_waiter_joined',
              })
              const waiterWaitStartedAt = performance.now()
              let attempt = 0

              while (Date.now() <= waitDeadline) {
                throwIfAborted(input.signal)
                const persisted = await resolvedDependencies.repository.readCurrentRun(cacheKey)
                if (persisted) {
                  resolvedDependencies.telemetry.emit('current_waiter_wait', {
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    logicalArtifactKey,
                    requestId,
                    attemptCount: attempt,
                    durationMs: performance.now() - waiterWaitStartedAt,
                    resolution: 'PERSISTED_ARTIFACT_VISIBLE',
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

                const latestExecution = await resolvedDependencies.executionAdmission.readLatestExecutionForLogicalArtifact(logicalArtifactKey)
                if (!latestExecution) {
                  break
                }
                if (latestExecution.executionStatus === 'FAILED') {
                  resolvedDependencies.telemetry.emit('current_waiter_wait', {
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    logicalArtifactKey,
                    requestId,
                    attemptCount: attempt,
                    durationMs: performance.now() - waiterWaitStartedAt,
                    resolution: 'AUTHORITATIVE_FAILURE',
                  })
                  return {
                    status: 'FAILED',
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    targetBasis: input.targetBasis,
                    targetSemantics: methodIdentity.targetSemantics,
                    methodId: methodIdentity.methodId,
                    reason: latestExecution.failureReason ?? 'Authoritative forecast execution failed before producing an artifact.',
                    methodVersion: historyResponse.methodVersion,
                    source: historyResponse.source,
                    historyFingerprint,
                  }
                }
                if (latestExecution.executionStatus === 'COMPLETED') {
                  const persistedAfterCompletion = await resolvedDependencies.repository.readCurrentRun(cacheKey)
                  if (persistedAfterCompletion) {
                    resolvedDependencies.telemetry.emit('current_waiter_wait', {
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      logicalArtifactKey,
                      requestId,
                      attemptCount: attempt,
                      durationMs: performance.now() - waiterWaitStartedAt,
                      resolution: 'AUTHORITATIVE_COMPLETION',
                    })
                    resolvedDependencies.logEvent('FORECAST_LIBRARY_CURRENT', {
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      cacheStatus: 'hit',
                      totalMs: Math.round(performance.now() - startedAt),
                      dbFailure: false,
                    })
                    return toCurrentAvailable(persistedAfterCompletion, 'hit')
                  }
                  throw new Error(`Current execution completed without a canonical artifact for ${logicalArtifactKey}.`)
                }
                if (new Date(latestExecution.leaseExpiresAt).getTime() <= Date.now()) {
                  break
                }

                await waitForBackoff(attempt, input.signal)
                attempt += 1
              }

              resolvedDependencies.telemetry.emit('current_waiter_wait', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                logicalArtifactKey,
                requestId,
                attemptCount: attempt,
                durationMs: performance.now() - waiterWaitStartedAt,
                resolution: Date.now() > waitDeadline ? 'TIMEOUT' : 'LEASE_RECOVERY_REQUIRED',
              })

              if (Date.now() > waitDeadline) {
                throw new Error(`Timed out waiting for the authoritative Current execution for ${logicalArtifactKey}.`)
              }

              continue
            }

            let ownership = admission.ownership
            let executionLedgerContext = toAuthoritativeExecutionLedgerContext(ownership)
            const heartbeat = startLeaseHeartbeat(logicalArtifactKey, ownership, requestId)
            let failurePhase: 'COMPUTE' | 'PERSISTENCE' | 'FINALIZATION' = 'COMPUTE'

            try {
              const persistedAfterAdmission = await resolvedDependencies.repository.readCurrentRun(cacheKey)
              if (persistedAfterAdmission) {
                const terminalMarkStartedAt = performance.now()
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: 'AVAILABLE',
                  cacheStatus: 'hit',
                })
                resolvedDependencies.telemetry.emit('current_terminal_mark', {
                  seriesId: input.seriesId,
                  modelId: input.modelId,
                  logicalArtifactKey,
                  requestId,
                  durationMs: performance.now() - terminalMarkStartedAt,
                  resolution: 'CACHE_HIT_AFTER_ADMISSION',
                })
                recordCurrentExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'CURRENT',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: 'AVAILABLE',
                  cacheStatus: 'hit',
                })
                return toCurrentAvailable(persistedAfterAdmission, 'hit')
              }

              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: ownership.ownerRequestId,
                role: 'OWNER',
                eventType: 'single_flight_owner_acquired',
              })
              const computeStartedAt = performance.now()
              resolvedDependencies.telemetry.emit('current_compute_start', {
                modelId: input.modelId,
                count: 1,
                logicalArtifactKey,
              })
              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'compute_started',
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
              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'compute_completed',
                durationMs: computeDurationMs,
                resultStatus: currentResponse.status,
                payload: {
                  modelFitCount: currentResponse.status === 'AVAILABLE' ? 1 : 0,
                },
              })
              heartbeat.assertActive()

              if (currentResponse.status === 'NOT_AVAILABLE') {
                const identity = resolveCapabilityIdentity(input.targetBasis)
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: currentResponse.status,
                  cacheStatus: 'miss',
                })
                recordCurrentExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'CURRENT',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: currentResponse.status,
                  cacheStatus: 'miss',
                })
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
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: currentResponse.status,
                  cacheStatus: 'miss',
                })
                recordCurrentExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'CURRENT',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: currentResponse.status,
                  cacheStatus: 'miss',
                })
                return toUnsupportedResult(currentResponse, input)
              }

              if (currentResponse.status === 'FAILED') {
                const identity = resolveCapabilityIdentity(input.targetBasis, currentResponse.methodVersion)
                await resolvedDependencies.executionAdmission.markExecutionFailed({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  failurePhase: 'COMPUTE',
                  failureReason: currentResponse.reason,
                  resultStatus: currentResponse.status,
                  cacheStatus: 'miss',
                })
                recordCurrentExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'CURRENT',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'execution_failed',
                  resultStatus: currentResponse.status,
                  cacheStatus: 'miss',
                  error: currentResponse.reason,
                })
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
              const cacheStatus: BenchmarkForecastCurrentAvailableResult['cacheStatus'] = 'miss'
              failurePhase = 'PERSISTENCE'

              const persistStartedAt = performance.now()
              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'persistence_started',
              })
              ownership = await heartbeat.renewNow()
              executionLedgerContext = toAuthoritativeExecutionLedgerContext(ownership)
              await resolvedDependencies.repository.writeCurrentRun(artifact, {
                ownership: buildPersistenceOwnership('CURRENT', logicalArtifactKey, ownership),
              })
              const persistenceDurationMs = performance.now() - persistStartedAt
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'current',
                artifactWrites: 1,
                pointWrites: Object.keys(artifact.currentForecast).length,
                verificationRecordWrites: 0,
                writeFailures: 0,
                durationMs: persistenceDurationMs,
              })
              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'persistence_completed',
                durationMs: persistenceDurationMs,
                artifactWrites: 1,
                pointWrites: Object.keys(artifact.currentForecast).length,
                verificationRecordWrites: 0,
                writeFailures: 0,
              })

              failurePhase = 'FINALIZATION'
              heartbeat.assertActive()
              const terminalMarkStartedAt = performance.now()
              await resolvedDependencies.executionAdmission.markExecutionCompleted({
                executionId: ownership.executionId,
                logicalArtifactKey,
                ownerToken: ownership.ownerToken,
                leaseVersion: ownership.leaseVersion,
                requestId,
                ownerRequestId: ownership.ownerRequestId,
                resultStatus: 'AVAILABLE',
                cacheStatus,
              })
              resolvedDependencies.telemetry.emit('current_terminal_mark', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                logicalArtifactKey,
                requestId,
                durationMs: performance.now() - terminalMarkStartedAt,
                resolution: 'PERSISTED_AVAILABLE',
              })
              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'execution_completed',
                resultStatus: 'AVAILABLE',
                cacheStatus,
              })
              resolvedDependencies.logEvent('FORECAST_LIBRARY_CURRENT', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                cacheStatus,
                totalMs: Math.round(performance.now() - startedAt),
                dbFailure: false,
              })

              return toCurrentAvailable(artifact, cacheStatus)
            } catch (error) {
              if (failurePhase === 'PERSISTENCE') {
                resolvedDependencies.telemetry.emit('persistence', {
                  operation: 'current',
                  artifactWrites: 0,
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: 1,
                })
                recordCurrentExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'CURRENT',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'persistence_failed',
                  error: error instanceof Error ? error.message : 'unknown',
                  artifactWrites: 0,
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: 1,
                })
              }

              try {
                heartbeat.assertActive()
                await resolvedDependencies.executionAdmission.markExecutionFailed({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  failurePhase,
                  failureReason: error instanceof Error ? error.message : 'unknown',
                  resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                  cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
                })
              } catch {
                // Preserve the original execution failure as the surfaced error.
              }

              recordCurrentExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'CURRENT',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'execution_failed',
                resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
                error: error instanceof Error ? error.message : 'unknown',
              })
              throw error
            } finally {
              await heartbeat.stop()
            }
          }
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
      const cacheStatisticalCompatibility = createFullVerificationStatisticalCompatibility({
        sourceFrequency: cadenceContext.cadence?.sourceFrequency
          ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
          ?? 'MONTHLY',
        targetCadence: cadenceContext.cadence?.targetCadence
          ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
          ?? 'MONTHLY',
        targetSemantics: methodIdentity.targetSemantics,
      })
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
        trainingWindowPolicyId: cacheStatisticalCompatibility.trainingWindowPolicyId,
        effectiveTrainingPolicyId: cacheStatisticalCompatibility.effectiveTrainingPolicyId,
      }

      let dbReadFailed = false
      let latestReusableArtifact: PersistedVerificationArtifact | null = null
      try {
        const persisted = await resolvedDependencies.repository.readVerificationRun(cacheKey)
        if (
          !persisted
          && input.maxOriginsPerRun != null
          && resolvedDependencies.repository.readLatestVerificationRun
        ) {
          latestReusableArtifact = resolveVerificationResumeArtifact({
            exactArtifact: null,
            latestArtifact: await resolvedDependencies.repository.readLatestVerificationRun(cacheKey),
            history: historyResponse.history,
            cadence: cadenceContext.cadence ?? undefined,
          })
        }
        if (persisted) {
          if (verificationArtifactNeedsRebuild(persisted)) {
            resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
              seriesId: input.seriesId,
              modelId: input.modelId,
              cacheStatus: 'stale-rebuild',
              totalMs: Math.round(performance.now() - startedAt),
              dbFailure: false,
            })
          } else if (isVerificationArtifactComplete(persisted)) {
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
          } else {
            resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
              seriesId: input.seriesId,
              modelId: input.modelId,
              cacheStatus: PARTIAL_VERIFICATION_CACHE_STATUS,
              totalMs: Math.round(performance.now() - startedAt),
              dbFailure: false,
            })
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
      const verificationStatisticalCompatibility = createFullVerificationStatisticalCompatibility({
        sourceFrequency,
        targetCadence,
        targetSemantics: methodIdentity.targetSemantics,
      })
      const logicalArtifactIdentity: VerificationLogicalArtifactIdentity = {
        artifactScope: verificationStatisticalCompatibility.artifactScope,
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        trainingWindowPolicyId: verificationStatisticalCompatibility.trainingWindowPolicyId,
        modelId: input.modelId,
        inputSource: historyResponse.source.kind,
        historyFingerprint,
        sourceFrequency,
        targetCadence,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        verificationHorizonSetId,
        verificationConfigurationId: VERIFICATION_CONFIGURATION_ID,
        originPolicyId: VERIFICATION_ORIGIN_POLICY_ID,
      }
      const logicalArtifactKey = buildVerificationLogicalArtifactKey(logicalArtifactIdentity)
      const requestId = resolvedDependencies.telemetry.currentContext?.()?.requestId ?? randomUUID()
      const recordVerificationExecutionEvent = (
        executionContext: Stage3ExecutionLedgerContext | null,
        inputEvent: Omit<Parameters<ForecastPreparationExecutionLedger['recordEvent']>[0], 'executionId'>,
      ) => recordAuthoritativeExecutionEvent(executionContext, inputEvent, {
        seriesId: input.seriesId,
        modelId: input.modelId,
      })

      return verificationForecastSingleFlight.run({
        logicalArtifactKey,
        requestId,
        async emit(event, eventData) {
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
          recordVerificationExecutionEvent(null, {
            logicalArtifactKey,
            operationFamily: 'VERIFICATION',
            logicalArtifactIdentity,
            requestId: eventData.requestId,
            ownerRequestId: eventData.ownerRequestId,
            role: eventData.role,
            eventType: event,
            durationMs: eventData.durationMs ?? null,
            error: eventData.error ?? null,
            activeSingleFlightEntries: eventData.activeVerificationSingleFlightEntries,
          })
        },
        operation: async () => {
          if (dbReadFailed) {
            throw new ForecastExecutionControlError(
              'CONTROL_DB_UNAVAILABLE',
              'Verification forecast execution is fail-closed while PostgreSQL authority is unavailable.',
            )
          }

          const waitDeadline = Date.now() + stage3WaiterMaxWaitMs

          while (true) {
            throwIfAborted(input.signal)
            const admission = await resolvedDependencies.executionAdmission.acquireExecution({
              operationFamily: 'VERIFICATION',
              logicalArtifactKey,
              logicalArtifactIdentity,
              requestId,
              ownerRequestId: requestId,
            })

            if (admission.role === 'WAITER') {
              resolvedDependencies.telemetry.emit('single_flight_waiter_joined', {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                ownerRequestId: admission.ownerRequestId,
                requestId,
                role: 'WAITER',
                activeVerificationSingleFlightEntries: null,
                durationMs: null,
                error: null,
                seriesId: input.seriesId,
                modelId: input.modelId,
                targetSemantics: methodIdentity.targetSemantics,
                sourceFrequency,
                targetCadence,
                trainingWindowPolicyId: verificationStatisticalCompatibility.trainingWindowPolicyId,
              })
              recordVerificationExecutionEvent(toWaiterExecutionLedgerContext(admission), {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: admission.ownerRequestId,
                role: 'WAITER',
                eventType: 'single_flight_waiter_joined',
              })
              let attempt = 0

              while (Date.now() <= waitDeadline) {
                throwIfAborted(input.signal)
                const persisted = await resolvedDependencies.repository.readVerificationRun(cacheKey)
                if (
                  persisted
                  && !verificationArtifactNeedsRebuild(persisted)
                  && isVerificationArtifactComplete(persisted)
                ) {
                  resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    cacheStatus: 'hit',
                    totalMs: Math.round(performance.now() - startedAt),
                    dbFailure: false,
                  })
                  return toVerificationAvailable(persisted, 'hit')
                }
                if (persisted && !verificationArtifactNeedsRebuild(persisted)) {
                  resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    cacheStatus: PARTIAL_VERIFICATION_CACHE_STATUS,
                    totalMs: Math.round(performance.now() - startedAt),
                    dbFailure: false,
                  })
                  return {
                    status: 'NOT_AVAILABLE',
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    targetBasis: input.targetBasis,
                    targetSemantics: methodIdentity.targetSemantics,
                    methodId: methodIdentity.methodId,
                    reason: PARTIAL_VERIFICATION_REASON,
                  }
                }

                const latestExecution = await resolvedDependencies.executionAdmission.readLatestExecutionForLogicalArtifact(logicalArtifactKey)
                if (!latestExecution) {
                  break
                }
                if (latestExecution.executionStatus === 'FAILED') {
                  return {
                    status: 'FAILED',
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    targetBasis: input.targetBasis,
                    targetSemantics: methodIdentity.targetSemantics,
                    methodId: methodIdentity.methodId,
                    reason: latestExecution.failureReason ?? 'Authoritative verification execution failed before producing an artifact.',
                    methodVersion: historyResponse.methodVersion,
                    source: historyResponse.source,
                    historyFingerprint,
                  }
                }
                if (latestExecution.executionStatus === 'COMPLETED') {
                  const persistedAfterCompletion = await resolvedDependencies.repository.readVerificationRun(cacheKey)
                  if (
                    persistedAfterCompletion
                    && !verificationArtifactNeedsRebuild(persistedAfterCompletion)
                    && isVerificationArtifactComplete(persistedAfterCompletion)
                  ) {
                    resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      cacheStatus: 'hit',
                      totalMs: Math.round(performance.now() - startedAt),
                      dbFailure: false,
                    })
                    return toVerificationAvailable(persistedAfterCompletion, 'hit')
                  }
                  if (
                    persistedAfterCompletion
                    && !verificationArtifactNeedsRebuild(persistedAfterCompletion)
                  ) {
                    resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      cacheStatus: PARTIAL_VERIFICATION_CACHE_STATUS,
                      totalMs: Math.round(performance.now() - startedAt),
                      dbFailure: false,
                    })
                    return {
                      status: 'NOT_AVAILABLE',
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      targetBasis: input.targetBasis,
                      targetSemantics: methodIdentity.targetSemantics,
                      methodId: methodIdentity.methodId,
                      reason: PARTIAL_VERIFICATION_REASON,
                    }
                  }
                  throw new Error(`Verification execution completed without a canonical artifact for ${logicalArtifactKey}.`)
                }
                if (new Date(latestExecution.leaseExpiresAt).getTime() <= Date.now()) {
                  break
                }

                await waitForBackoff(attempt, input.signal)
                attempt += 1
              }

              if (Date.now() > waitDeadline) {
                throw new Error(`Timed out waiting for the authoritative Verification execution for ${logicalArtifactKey}.`)
              }

              continue
            }

            let ownership = admission.ownership
            let executionLedgerContext = toAuthoritativeExecutionLedgerContext(ownership)
            const heartbeat = startLeaseHeartbeat(logicalArtifactKey, ownership, requestId)
            let failurePhase: 'COMPUTE' | 'PERSISTENCE' | 'FINALIZATION' = 'COMPUTE'

            try {
              const persistedAfterAdmission = await resolvedDependencies.repository.readVerificationRun(cacheKey)
              if (
                persistedAfterAdmission
                && !verificationArtifactNeedsRebuild(persistedAfterAdmission)
                && isVerificationArtifactComplete(persistedAfterAdmission)
              ) {
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: 'AVAILABLE',
                  cacheStatus: 'hit',
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: 'AVAILABLE',
                  cacheStatus: 'hit',
                })
                return toVerificationAvailable(persistedAfterAdmission, 'hit')
              }

              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: ownership.ownerRequestId,
                role: 'OWNER',
                eventType: 'single_flight_owner_acquired',
              })
              const verificationStartedAt = performance.now()
              resolvedDependencies.telemetry.emit('verification_compute_start', {
                modelId: input.modelId,
                count: 1,
                logicalArtifactKey,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'compute_started',
              })
              const appendOnlyReusableArtifact = !persistedAfterAdmission
                && input.maxOriginsPerRun != null
                && resolvedDependencies.repository.readLatestVerificationRun
                ? resolveVerificationResumeArtifact({
                    exactArtifact: null,
                    latestArtifact: await resolvedDependencies.repository.readLatestVerificationRun(cacheKey),
                    history: historyResponse.history,
                    cadence: cadenceContext.cadence ?? undefined,
                  })
                : null
              const resumeArtifact = resolveVerificationResumeArtifact({
                exactArtifact: persistedAfterAdmission,
                latestArtifact: appendOnlyReusableArtifact ?? latestReusableArtifact,
                history: historyResponse.history,
                cadence: cadenceContext.cadence ?? undefined,
              })
              const resumeFromOriginDate = input.lastProcessedOriginDate
                ?? (resumeArtifact ? deriveLastProcessedVerificationOriginDate(resumeArtifact) : null)
              const verificationResponse = preparedExecutionContext
                ? await preparedExecutionContext.exportVerification(input.modelId, {
                    historicalOriginStartDate: input.historicalOriginStartDate,
                    lastProcessedOriginDate: resumeFromOriginDate,
                    maxOriginsPerRun: input.maxOriginsPerRun,
                  })
                : await resolvedDependencies.bridge.exportVerification({
                    ...input,
                    lastProcessedOriginDate: resumeFromOriginDate,
                  })
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
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'compute_completed',
                durationMs: verificationDurationMs,
                resultStatus: verificationResponse.status,
                payload: {
                  verificationOrigins,
                },
              })
              heartbeat.assertActive()

              if (verificationResponse.status === 'NOT_AVAILABLE') {
                const identity = resolveCapabilityIdentity(input.targetBasis)
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: verificationResponse.status,
                  cacheStatus: 'miss',
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: verificationResponse.status,
                  cacheStatus: 'miss',
                })
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
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: verificationResponse.status,
                  cacheStatus: 'miss',
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: verificationResponse.status,
                  cacheStatus: 'miss',
                })
                return toUnsupportedResult(verificationResponse, input)
              }

              if (verificationResponse.status === 'FAILED') {
                const identity = resolveCapabilityIdentity(input.targetBasis, verificationResponse.methodVersion)
                await resolvedDependencies.executionAdmission.markExecutionFailed({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  failurePhase: 'COMPUTE',
                  failureReason: verificationResponse.reason,
                  resultStatus: verificationResponse.status,
                  cacheStatus: 'miss',
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'execution_failed',
                  resultStatus: verificationResponse.status,
                  cacheStatus: 'miss',
                  error: verificationResponse.reason,
                })
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
              const mergedArtifact = mergeVerificationArtifacts(resumeArtifact, artifact)
              const completeArtifact = isVerificationArtifactComplete(mergedArtifact)
              const cacheStatus: BenchmarkForecastVerificationAvailableResult['cacheStatus'] = completeArtifact
                ? 'miss'
                : PARTIAL_VERIFICATION_CACHE_STATUS
              failurePhase = 'PERSISTENCE'

              const persistStartedAt = performance.now()
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'persistence_started',
              })
              ownership = await heartbeat.renewNow()
              executionLedgerContext = toAuthoritativeExecutionLedgerContext(ownership)
              await resolvedDependencies.repository.writeVerificationRun(mergedArtifact, {
                ownership: buildPersistenceOwnership('VERIFICATION', logicalArtifactKey, ownership),
              })
              const persistenceDurationMs = performance.now() - persistStartedAt
              const verificationRecordWrites = Object.values(mergedArtifact.verification)
                .reduce((sum, horizon) => sum + horizon.records.length, 0)
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'verification',
                artifactWrites: 1,
                pointWrites: 0,
                verificationRecordWrites,
                writeFailures: 0,
                durationMs: persistenceDurationMs,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'persistence_completed',
                durationMs: persistenceDurationMs,
                artifactWrites: 1,
                pointWrites: 0,
                verificationRecordWrites,
                writeFailures: 0,
              })

              failurePhase = 'FINALIZATION'
              heartbeat.assertActive()
              await resolvedDependencies.executionAdmission.markExecutionCompleted({
                executionId: ownership.executionId,
                logicalArtifactKey,
                ownerToken: ownership.ownerToken,
                leaseVersion: ownership.leaseVersion,
                requestId,
                ownerRequestId: ownership.ownerRequestId,
                resultStatus: completeArtifact ? 'AVAILABLE' : 'NOT_AVAILABLE',
                cacheStatus,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'execution_completed',
                resultStatus: completeArtifact ? 'AVAILABLE' : 'NOT_AVAILABLE',
                cacheStatus,
              })
              resolvedDependencies.logEvent('FORECAST_LIBRARY_VERIFICATION', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                cacheStatus,
                totalMs: Math.round(performance.now() - startedAt),
                dbFailure: false,
              })

              if (!completeArtifact) {
                return {
                  status: 'NOT_AVAILABLE',
                  seriesId: input.seriesId,
                  modelId: input.modelId,
                  targetBasis: input.targetBasis,
                  targetSemantics: methodIdentity.targetSemantics,
                  methodId: methodIdentity.methodId,
                  reason: PARTIAL_VERIFICATION_REASON,
                }
              }

              return toVerificationAvailable(mergedArtifact, cacheStatus)
            } catch (error) {
              if (failurePhase === 'PERSISTENCE') {
                resolvedDependencies.telemetry.emit('persistence', {
                  operation: 'verification',
                  artifactWrites: 0,
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: 1,
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'persistence_failed',
                  error: error instanceof Error ? error.message : 'unknown',
                  artifactWrites: 0,
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: 1,
                })
              }

              try {
                heartbeat.assertActive()
                await resolvedDependencies.executionAdmission.markExecutionFailed({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  failurePhase,
                  failureReason: error instanceof Error ? error.message : 'unknown',
                  resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                  cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
                })
              } catch {
                // Preserve the original execution failure as the surfaced error.
              }

              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'execution_failed',
                resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
                error: error instanceof Error ? error.message : 'unknown',
              })
              throw error
            } finally {
              await heartbeat.stop()
            }
          }
        },
      })
    },

    async resolveRecentVerification(seriesId: string, modelId: string): Promise<BenchmarkForecastVerificationResult> {
      const input: ForecastServiceRequest = {
        seriesId,
        modelId,
        targetBasis: DEFAULT_FORECAST_TARGET_BASIS,
      }
      return this.resolveRecentVerificationRequest(input)
    },

    async resolveRecentVerificationRequest(input: ForecastServiceRequest): Promise<BenchmarkForecastVerificationResult> {
      const startedAt = performance.now()
      const cadenceContext = resolveArtifactCadenceContext(input)
      const preparedExecutionContext = await resolvedDependencies.bridge.prepareExecutionContext?.({
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        sourceFrequency: input.sourceFrequency,
        targetCadence: input.targetCadence,
      }) ?? null

      const historyResponse = preparedExecutionContext
        ? await preparedExecutionContext.exportHistory('current', input.modelId)
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
      const cacheStatisticalCompatibility = createRecentVerificationStatisticalCompatibility({
        sourceFrequency: cadenceContext.cadence?.sourceFrequency
          ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
          ?? 'MONTHLY',
        targetCadence: cadenceContext.cadence?.targetCadence
          ?? normalizeForecastSourceFrequency(historyResponse.history.frequency)
          ?? 'MONTHLY',
        targetSemantics: methodIdentity.targetSemantics,
      })
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
        trainingWindowPolicyId: cacheStatisticalCompatibility.trainingWindowPolicyId,
        effectiveTrainingPolicyId: cacheStatisticalCompatibility.effectiveTrainingPolicyId,
      }

      let dbReadFailed = false
      try {
        const persisted = await resolvedDependencies.repository.readVerificationRun(cacheKey)
        if (persisted && !verificationArtifactNeedsRebuild(persisted)) {
          if (isVerificationArtifactComplete(persisted)) {
            resolvedDependencies.telemetry.emit('prepared_read', {
              kind: 'verification',
              hit: true,
              durationMs: performance.now() - startedAt,
            })
            resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
              seriesId: input.seriesId,
              modelId: input.modelId,
              cacheStatus: 'hit',
              totalMs: Math.round(performance.now() - startedAt),
              dbFailure: false,
            })
            return toVerificationAvailable(persisted, 'hit')
          }

          resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            cacheStatus: PARTIAL_VERIFICATION_CACHE_STATUS,
            totalMs: Math.round(performance.now() - startedAt),
            dbFailure: false,
          })
        }
      } catch (error) {
        dbReadFailed = true
        resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
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
        throw new Error('Recent Verification single-flight identity requires lawful source and target cadence.')
      }

      const verificationHorizonSetId = buildVerificationHorizonSetId(
        buildCurrentForecastExecutionPlan(historyResponse.history.end, targetCadence).horizons,
      )
      const verificationStatisticalCompatibility = createRecentVerificationStatisticalCompatibility({
        sourceFrequency,
        targetCadence,
        targetSemantics: methodIdentity.targetSemantics,
      })
      const logicalArtifactIdentity: VerificationLogicalArtifactIdentity = {
        artifactScope: verificationStatisticalCompatibility.artifactScope,
        seriesId: input.seriesId,
        targetBasis: input.targetBasis,
        targetSemantics: methodIdentity.targetSemantics,
        methodId: methodIdentity.methodId,
        methodVersion: historyResponse.methodVersion,
        trainingWindowPolicyId: verificationStatisticalCompatibility.trainingWindowPolicyId,
        modelId: input.modelId,
        inputSource: historyResponse.source.kind,
        historyFingerprint,
        sourceFrequency,
        targetCadence,
        frequencyIdentity: cadenceContext.frequencyIdentity,
        verificationHorizonSetId,
        verificationConfigurationId: VERIFICATION_CONFIGURATION_ID,
        originPolicyId: VERIFICATION_ORIGIN_POLICY_ID,
      }
      const logicalArtifactKey = buildVerificationLogicalArtifactKey(logicalArtifactIdentity)
      const requestId = resolvedDependencies.telemetry.currentContext?.()?.requestId ?? randomUUID()
      const recordVerificationExecutionEvent = (
        executionContext: Stage3ExecutionLedgerContext | null,
        inputEvent: Omit<Parameters<ForecastPreparationExecutionLedger['recordEvent']>[0], 'executionId'>,
      ) => recordAuthoritativeExecutionEvent(executionContext, inputEvent, {
        seriesId: input.seriesId,
        modelId: input.modelId,
      })

      return verificationForecastSingleFlight.run({
        logicalArtifactKey,
        requestId,
        async emit(event, eventData) {
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
            trainingWindowPolicyId: verificationStatisticalCompatibility.trainingWindowPolicyId,
          })
          recordVerificationExecutionEvent(null, {
            logicalArtifactKey,
            operationFamily: 'VERIFICATION',
            logicalArtifactIdentity,
            requestId: eventData.requestId,
            ownerRequestId: eventData.ownerRequestId,
            role: eventData.role,
            eventType: event,
            durationMs: eventData.durationMs ?? null,
            error: eventData.error ?? null,
            activeSingleFlightEntries: eventData.activeVerificationSingleFlightEntries,
          })
        },
        operation: async () => {
          if (dbReadFailed) {
            throw new ForecastExecutionControlError(
              'CONTROL_DB_UNAVAILABLE',
              'Recent Verification execution is fail-closed while PostgreSQL authority is unavailable.',
            )
          }

          const waitDeadline = Date.now() + stage3WaiterMaxWaitMs

          while (true) {
            throwIfAborted(input.signal)
            const admission = await resolvedDependencies.executionAdmission.acquireExecution({
              operationFamily: 'VERIFICATION',
              logicalArtifactKey,
              logicalArtifactIdentity,
              requestId,
              ownerRequestId: requestId,
            })

            if (admission.role === 'WAITER') {
              recordVerificationExecutionEvent(toWaiterExecutionLedgerContext(admission), {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: admission.ownerRequestId,
                role: 'WAITER',
                eventType: 'single_flight_waiter_joined',
              })
              let attempt = 0

              while (Date.now() <= waitDeadline) {
                throwIfAborted(input.signal)
                const persisted = await resolvedDependencies.repository.readVerificationRun(cacheKey)
                if (
                  persisted
                  && !verificationArtifactNeedsRebuild(persisted)
                  && isVerificationArtifactComplete(persisted)
                ) {
                  resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    cacheStatus: 'hit',
                    totalMs: Math.round(performance.now() - startedAt),
                    dbFailure: false,
                  })
                  return toVerificationAvailable(persisted, 'hit')
                }
                if (persisted && !verificationArtifactNeedsRebuild(persisted)) {
                  resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    cacheStatus: PARTIAL_VERIFICATION_CACHE_STATUS,
                    totalMs: Math.round(performance.now() - startedAt),
                    dbFailure: false,
                  })
                  return {
                    status: 'NOT_AVAILABLE',
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    targetBasis: input.targetBasis,
                    targetSemantics: methodIdentity.targetSemantics,
                    methodId: methodIdentity.methodId,
                    reason: PARTIAL_VERIFICATION_REASON,
                  }
                }

                const latestExecution = await resolvedDependencies.executionAdmission.readLatestExecutionForLogicalArtifact(logicalArtifactKey)
                if (!latestExecution) {
                  break
                }
                if (latestExecution.executionStatus === 'FAILED') {
                  return {
                    status: 'FAILED',
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    targetBasis: input.targetBasis,
                    targetSemantics: methodIdentity.targetSemantics,
                    methodId: methodIdentity.methodId,
                    reason: latestExecution.failureReason ?? 'Authoritative recent verification execution failed before producing an artifact.',
                    methodVersion: historyResponse.methodVersion,
                    source: historyResponse.source,
                    historyFingerprint,
                  }
                }
                if (latestExecution.executionStatus === 'COMPLETED') {
                  const persistedAfterCompletion = await resolvedDependencies.repository.readVerificationRun(cacheKey)
                  if (
                    persistedAfterCompletion
                    && !verificationArtifactNeedsRebuild(persistedAfterCompletion)
                    && isVerificationArtifactComplete(persistedAfterCompletion)
                  ) {
                    resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      cacheStatus: 'hit',
                      totalMs: Math.round(performance.now() - startedAt),
                      dbFailure: false,
                    })
                    return toVerificationAvailable(persistedAfterCompletion, 'hit')
                  }
                  if (
                    persistedAfterCompletion
                    && !verificationArtifactNeedsRebuild(persistedAfterCompletion)
                  ) {
                    resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      cacheStatus: PARTIAL_VERIFICATION_CACHE_STATUS,
                      totalMs: Math.round(performance.now() - startedAt),
                      dbFailure: false,
                    })
                    return {
                      status: 'NOT_AVAILABLE',
                      seriesId: input.seriesId,
                      modelId: input.modelId,
                      targetBasis: input.targetBasis,
                      targetSemantics: methodIdentity.targetSemantics,
                      methodId: methodIdentity.methodId,
                      reason: PARTIAL_VERIFICATION_REASON,
                    }
                  }
                  throw new Error(`Recent Verification execution completed without a canonical artifact for ${logicalArtifactKey}.`)
                }
                if (new Date(latestExecution.leaseExpiresAt).getTime() <= Date.now()) {
                  break
                }

                await waitForBackoff(attempt, input.signal)
                attempt += 1
              }

              if (Date.now() > waitDeadline) {
                throw new Error(`Timed out waiting for the authoritative Recent Verification execution for ${logicalArtifactKey}.`)
              }

              continue
            }

            let ownership = admission.ownership
            let executionLedgerContext = toAuthoritativeExecutionLedgerContext(ownership)
            const heartbeat = startLeaseHeartbeat(logicalArtifactKey, ownership, requestId)
            let failurePhase: 'COMPUTE' | 'PERSISTENCE' | 'FINALIZATION' = 'COMPUTE'

            try {
              const persistedAfterAdmission = await resolvedDependencies.repository.readVerificationRun(cacheKey)
              if (
                persistedAfterAdmission
                && !verificationArtifactNeedsRebuild(persistedAfterAdmission)
                && isVerificationArtifactComplete(persistedAfterAdmission)
              ) {
                await resolvedDependencies.executionAdmission.markExecutionCompleted({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  resultStatus: 'AVAILABLE',
                  cacheStatus: 'hit',
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  role: 'OWNER',
                  eventType: 'execution_completed',
                  resultStatus: 'AVAILABLE',
                  cacheStatus: 'hit',
                })
                return toVerificationAvailable(persistedAfterAdmission, 'hit')
              }

              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: ownership.ownerRequestId,
                role: 'OWNER',
                eventType: 'single_flight_owner_acquired',
              })
              const verificationStartedAt = performance.now()
              resolvedDependencies.telemetry.emit('verification_compute_start', {
                modelId: input.modelId,
                count: 1,
                logicalArtifactKey,
                trainingWindowPolicyId: verificationStatisticalCompatibility.trainingWindowPolicyId,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'compute_started',
              })

              let artifact: PersistedVerificationArtifact
              try {
                const authoritativeHistoryResponse = preparedExecutionContext
                  ? await preparedExecutionContext.exportHistory('verification', input.modelId)
                  : historyResponse

                if (authoritativeHistoryResponse.status !== 'AVAILABLE') {
                  throw new Error('Recent Verification authoritative history is unavailable for computation.')
                }

                artifact = await buildRecentVerificationArtifact({
                  request: input,
                  methodVersion: historyResponse.methodVersion,
                  targetSemantics: methodIdentity.targetSemantics,
                  benchmark: authoritativeHistoryResponse.benchmark,
                  source: authoritativeHistoryResponse.source,
                  authoritativeHistory: authoritativeHistoryResponse.history,
                  identityHistory: historyResponse.history,
                  cadenceContext,
                  executePreparedCurrent: (payload, mode, seriesId, modelId) => (
                    resolvedDependencies.executePreparedCurrent(payload, mode, seriesId, modelId) as Promise<ForecastCurrentBridgeResponse>
                  ),
                })
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Recent Verification preparation failed.'
                if (isPreparationRequiredMessage(message)) {
                  const identity = resolveCapabilityIdentity(input.targetBasis, historyResponse.methodVersion)
                  await resolvedDependencies.executionAdmission.markExecutionCompleted({
                    executionId: ownership.executionId,
                    logicalArtifactKey,
                    ownerToken: ownership.ownerToken,
                    leaseVersion: ownership.leaseVersion,
                    requestId,
                    ownerRequestId: ownership.ownerRequestId,
                    resultStatus: 'NOT_AVAILABLE',
                    cacheStatus: 'miss',
                  })
                  recordVerificationExecutionEvent(executionLedgerContext, {
                    logicalArtifactKey,
                    operationFamily: 'VERIFICATION',
                    logicalArtifactIdentity,
                    requestId,
                    ownerRequestId: requestId,
                    role: 'OWNER',
                    eventType: 'execution_completed',
                    resultStatus: 'NOT_AVAILABLE',
                    cacheStatus: 'miss',
                    error: message,
                  })
                  return {
                    status: 'NOT_AVAILABLE',
                    seriesId: input.seriesId,
                    modelId: input.modelId,
                    targetBasis: input.targetBasis,
                    targetSemantics: identity.targetSemantics,
                    methodId: identity.methodId,
                    reason: message,
                    methodVersion: historyResponse.methodVersion,
                    source: historyResponse.source,
                  }
                }
                throw error
              }

              const verificationDurationMs = performance.now() - verificationStartedAt
              const verificationOrigins = new Set(
                Object.values(artifact.verification)
                  .flatMap((horizon) => horizon.records.map((record) => record.forecastOrigin)),
              ).size
              resolvedDependencies.telemetry.emit('verification_compute_end', {
                modelId: input.modelId,
                count: 1,
                originCount: verificationOrigins,
                durationMs: verificationDurationMs,
                status: 'AVAILABLE',
                logicalArtifactKey,
                trainingWindowPolicyId: verificationStatisticalCompatibility.trainingWindowPolicyId,
              })
              resolvedDependencies.telemetry.emit('model_fit', {
                operation: 'verification',
                modelId: input.modelId,
                count: verificationOrigins,
                durationMs: verificationDurationMs,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'compute_completed',
                durationMs: verificationDurationMs,
                resultStatus: 'AVAILABLE',
                payload: { verificationOrigins },
              })

              failurePhase = 'PERSISTENCE'
              const cacheStatus: BenchmarkForecastVerificationAvailableResult['cacheStatus'] = 'miss'
              const persistStartedAt = performance.now()
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'persistence_started',
              })
              ownership = await heartbeat.renewNow()
              executionLedgerContext = toAuthoritativeExecutionLedgerContext(ownership)
              await resolvedDependencies.repository.writeVerificationRun(artifact, {
                ownership: buildPersistenceOwnership('VERIFICATION', logicalArtifactKey, ownership),
              })
              const persistenceDurationMs = performance.now() - persistStartedAt
              const verificationRecordWrites = Object.values(artifact.verification)
                .reduce((sum, horizon) => sum + horizon.records.length, 0)
              resolvedDependencies.telemetry.emit('persistence', {
                operation: 'verification',
                artifactWrites: 1,
                pointWrites: 0,
                verificationRecordWrites,
                writeFailures: 0,
                durationMs: persistenceDurationMs,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'persistence_completed',
                durationMs: persistenceDurationMs,
                artifactWrites: 1,
                pointWrites: 0,
                verificationRecordWrites,
                writeFailures: 0,
              })

              failurePhase = 'FINALIZATION'
              heartbeat.assertActive()
              await resolvedDependencies.executionAdmission.markExecutionCompleted({
                executionId: ownership.executionId,
                logicalArtifactKey,
                ownerToken: ownership.ownerToken,
                leaseVersion: ownership.leaseVersion,
                requestId,
                ownerRequestId: ownership.ownerRequestId,
                resultStatus: 'AVAILABLE',
                cacheStatus,
              })
              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'execution_completed',
                resultStatus: 'AVAILABLE',
                cacheStatus,
              })
              resolvedDependencies.logEvent('FORECAST_LIBRARY_RECENT_VERIFICATION', {
                seriesId: input.seriesId,
                modelId: input.modelId,
                cacheStatus,
                totalMs: Math.round(performance.now() - startedAt),
                dbFailure: false,
              })

              return toVerificationAvailable(artifact, cacheStatus)
            } catch (error) {
              if (failurePhase === 'PERSISTENCE') {
                resolvedDependencies.telemetry.emit('persistence', {
                  operation: 'verification',
                  artifactWrites: 0,
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: 1,
                })
                recordVerificationExecutionEvent(executionLedgerContext, {
                  logicalArtifactKey,
                  operationFamily: 'VERIFICATION',
                  logicalArtifactIdentity,
                  requestId,
                  ownerRequestId: requestId,
                  role: 'OWNER',
                  eventType: 'persistence_failed',
                  error: error instanceof Error ? error.message : 'unknown',
                  artifactWrites: 0,
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: 1,
                })
              }

              try {
                heartbeat.assertActive()
                await resolvedDependencies.executionAdmission.markExecutionFailed({
                  executionId: ownership.executionId,
                  logicalArtifactKey,
                  ownerToken: ownership.ownerToken,
                  leaseVersion: ownership.leaseVersion,
                  requestId,
                  ownerRequestId: ownership.ownerRequestId,
                  failurePhase,
                  failureReason: error instanceof Error ? error.message : 'unknown',
                  resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                  cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
                })
              } catch {
                // Preserve the original execution failure as the surfaced error.
              }

              recordVerificationExecutionEvent(executionLedgerContext, {
                logicalArtifactKey,
                operationFamily: 'VERIFICATION',
                logicalArtifactIdentity,
                requestId,
                ownerRequestId: requestId,
                role: 'OWNER',
                eventType: 'execution_failed',
                resultStatus: failurePhase === 'COMPUTE' ? 'FAILED' : 'AVAILABLE',
                cacheStatus: failurePhase === 'PERSISTENCE' ? 'persist-failed' : 'miss',
                error: error instanceof Error ? error.message : 'unknown',
              })
              throw error
            } finally {
              await heartbeat.stop()
            }
          }
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

export async function resolveBenchmarkRecentForecastVerification(input: ForecastServiceRequest) {
  return forecastLibraryService.resolveRecentVerificationRequest(input)
}

export async function readPreparedBenchmarkCurrentForecast(input: ForecastServiceRequest) {
  return forecastLibraryService.readPreparedCurrentForecastRequest(input)
}

export async function readPreparedBenchmarkForecastVerification(input: ForecastServiceRequest) {
  return forecastLibraryService.readPreparedVerificationRequest(input)
}

export async function readPreparedBenchmarkRecentForecastVerification(input: ForecastServiceRequest) {
  return forecastLibraryService.readPreparedRecentVerificationRequest(input)
}