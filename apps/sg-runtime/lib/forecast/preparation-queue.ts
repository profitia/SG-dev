import { createHash, randomUUID } from 'node:crypto'

import { Prisma, type ForecastPreparationJob, type PrismaClient } from '@/generated/market-data-client'
import { z } from 'zod'
import {
  resolveExactForecastCapability,
  type ForecastPreparedReadAuthority,
  type ForecastVariantCapability,
} from '@/lib/forecast/capability-resolver'
import { buildForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  InteractiveForecastIdentitySchema,
  prepareInteractiveCurrentForecast,
  resolveInteractiveForecastCapability,
  type InteractiveForecastIdentity,
} from '@/lib/forecast/interactive-preparation'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import { buildLiveForecastBridgePayloadFromHistory } from '@/lib/forecast/live-market-input'
import {
  createForecastProductionOperationsService,
  type ForecastProductionOperationsResult,
} from '@/lib/forecast/production-operations'
import {
  buildRollingDailyHistoryFingerprint,
  loadRollingDailyHistory,
} from '@/lib/forecast/rolling-daily-maintenance'
import { selectTrailingRollingDailyCurrentHistory } from '@/lib/forecast/rolling-daily-current-ownership'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'
import {
  ADAPTIVE_HISTORICAL_VERIFICATION_ORIGIN_POLICY_VERSION,
  FAST_HISTORICAL_VERIFICATION_POLICY_VERSION,
} from '@/lib/forecast/historical-verification-origin-policy'
import { resolveForecastJobCorrelationId } from '@/lib/forecast/forecast-correlation'
import {
  recordForecastActionRequested,
  recordForecastArtifactReady,
  recordForecastQueueAccepted,
} from '@/lib/forecast/forecast-action-trace'
import { persistForecastExecutionResourceSummary } from '@/lib/forecast/execution-ledger'
import {
  completeForecastRequestDiagnostics,
  noteForecastRequestDiagnosticsEvent,
  runWithForecastRequestDiagnostics,
  updateForecastRequestDiagnosticsIdentity,
} from '@/lib/forecast/request-diagnostics'
import { measureForecastWorkerJob } from '@/lib/forecast/worker-resource-telemetry'
import {
  fallbackAdaptiveVerificationBatchAfterFailure,
  observeSuccessfulVerificationBatch,
  readAdaptiveVerificationBatchCheckpoint,
  type AdaptiveVerificationBatchCheckpoint,
} from '@/lib/forecast/adaptive-verification-batching'

export const FORECAST_PREPARATION_JOB_KINDS = ['CURRENT', 'VERIFICATION'] as const
export const FORECAST_PREPARATION_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'RETRY_WAIT',
  'SUCCEEDED',
  'FAILED',
  'SUPERSEDED',
] as const

export type ForecastPreparationJobKind = (typeof FORECAST_PREPARATION_JOB_KINDS)[number]
export type ForecastPreparationJobStatus = (typeof FORECAST_PREPARATION_JOB_STATUSES)[number]

export type ForecastPreparationCommand = InteractiveForecastIdentity & {
  kind: ForecastPreparationJobKind
}

export const ForecastPreparationCommandSchema = InteractiveForecastIdentitySchema.extend({
  kind: z.enum(FORECAST_PREPARATION_JOB_KINDS),
}).strict()

export type ForecastPreparationJobView = {
  jobKey: string
  kind: ForecastPreparationJobKind
  status: ForecastPreparationJobStatus
  seriesId: string
  modelId: InteractiveForecastIdentity['modelId']
  targetSemantics: InteractiveForecastIdentity['targetSemantics']
  targetBasis: 'MONTHLY_AVERAGE' | 'POINT_IN_TIME' | 'END_OF_PERIOD'
  requestCount: number
  sliceCount: number
  failureCount: number
  requestedAt: string
  startedAt: string | null
  completedAt: string | null
  failureReason: string | null
  originCorrelationId: string | null
  latestCorrelationId: string | null
}

export type ForecastPreparationCommandResult = {
  state: 'READY' | 'FAST_READY' | 'QUEUED' | 'PREPARING' | 'FAILED' | 'UNSUPPORTED'
  reason: string | null
  job: ForecastPreparationJobView | null
}

export type ForecastPreparationIdentitySnapshot = {
  seriesId: string
  modelId: InteractiveForecastIdentity['modelId']
  targetSemantics: InteractiveForecastIdentity['targetSemantics']
  targetBasis: ForecastPreparationJobView['targetBasis']
  current: ForecastPreparationCommandResult
  verification: ForecastPreparationCommandResult
}

export function resolveTerminalVerificationUnavailability(
  result: ForecastProductionOperationsResult | void,
  input: InteractiveForecastIdentity,
) {
  if (!result) return null
  const item = result.results.find((candidate) => (
    candidate.targetSemantics === input.targetSemantics
    && candidate.modelId === input.modelId
  ))
  const capability = result.after.capabilities.find((candidate) => (
    candidate.identity.targetSemantics === input.targetSemantics
    && candidate.identity.modelId === input.modelId
  ))
  if (
    item
    && ['READY', 'REUSED'].includes(item.historical)
    && capability?.verificationOriginCount === 0
    && (
      input.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME'
      || item.historicalProgressOriginCount === 0
    )
  ) {
    return 'Historical Verification completed with zero lawful comparisons for the requested horizons because the available history is insufficient.'
  }
  return null
}

export type ClaimedForecastPreparationJob = ForecastPreparationJob & {
  leaseOwnerToken: string
}

const TARGET_BASIS_BY_SEMANTICS = {
  END_OF_PERIOD: 'END_OF_PERIOD',
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
  ROLLING_DAILY_POINT_IN_TIME: 'POINT_IN_TIME',
} as const

const CURRENT_PRIORITY = 10
const VERIFICATION_PRIORITY = 100
const DEFAULT_LEASE_MS = 10 * 60_000
const RETRY_BASE_MS = 5_000
const MAX_RETRY_DELAY_MS = 5 * 60_000

function requirePrisma(prisma?: PrismaClient | null) {
  const resolved = prisma ?? getMarketDataPrisma()
  if (!resolved) {
    throw new Error('MARKET_DATA_DATABASE_URL is required for the durable Forecast preparation queue.')
  }
  return resolved
}

export function buildForecastPreparationJobKey(input: {
  kind: ForecastPreparationJobKind
  seriesId: string
  targetSemantics: string
  modelId: string
  historyFingerprint: string
}) {
  const identityParts = [
    'PPF1_DURABLE_QUEUE_V1',
    input.kind,
    input.seriesId,
    input.targetSemantics,
    input.modelId,
    input.historyFingerprint,
  ]
  if (input.kind === 'VERIFICATION' && input.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME') {
    identityParts.push(ADAPTIVE_HISTORICAL_VERIFICATION_ORIGIN_POLICY_VERSION)
  }
  if (input.kind === 'VERIFICATION') {
    identityParts.push(FAST_HISTORICAL_VERIFICATION_POLICY_VERSION)
  }
  return createHash('sha256')
    .update(identityParts.join('|'))
    .digest('hex')
}

function isEligible(capability: ForecastVariantCapability | null) {
  return capability?.admissionState === 'ADMITTED'
    && capability.implementationState === 'SUPPORTED'
    && capability.historyEligibility === 'ELIGIBLE'
    && capability.currentForecastEligible
    && capability.sourceFrequency !== null
    && capability.targetCadence !== null
}

async function resolveJobAuthority(
  input: ForecastPreparationCommand,
  capability: ForecastVariantCapability,
): Promise<ForecastPreparedReadAuthority> {
  if (input.kind === 'CURRENT' && capability.preparedReadAuthority) {
    return capability.preparedReadAuthority
  }

  if (input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
    const history = await loadRollingDailyHistory(input.seriesId)
    const fingerprintHistory = input.kind === 'CURRENT'
      ? selectTrailingRollingDailyCurrentHistory(history)
      : history
    return {
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      expectedHistoryFingerprint: buildRollingDailyHistoryFingerprint(fingerprintHistory),
    }
  }

  if (!capability.sourceFrequency || !capability.targetCadence) {
    throw new Error('Exact Forecast cadence authority is unavailable.')
  }
  const resolved = await resolveBenchmarkHistoricalSeries(input.seriesId, 'ALL')
  const targetBasis = TARGET_BASIS_BY_SEMANTICS[input.targetSemantics]
  const payload = buildLiveForecastBridgePayloadFromHistory(input.seriesId, resolved.history, {
    targetBasis,
    targetCadence: capability.targetCadence,
    continuityPolicy: capability.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  return {
    sourceFrequency: capability.sourceFrequency,
    targetCadence: capability.targetCadence,
    expectedHistoryFingerprint: buildForecastHistoryFingerprint({
      ...payload.history,
      cadence: {
        sourceFrequency: capability.sourceFrequency,
        targetCadence: capability.targetCadence,
      },
    }),
  }
}

function toView(job: ForecastPreparationJob): ForecastPreparationJobView {
  return {
    jobKey: job.jobKey,
    kind: job.jobKind as ForecastPreparationJobKind,
    status: job.status as ForecastPreparationJobStatus,
    seriesId: job.seriesId,
    modelId: job.modelId as InteractiveForecastIdentity['modelId'],
    targetSemantics: job.targetSemantics as InteractiveForecastIdentity['targetSemantics'],
    targetBasis: job.targetBasis,
    requestCount: job.requestCount,
    sliceCount: job.sliceCount,
    failureCount: job.failureCount,
    requestedAt: job.requestedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    failureReason: job.failureReason,
    originCorrelationId: job.originCorrelationId,
    latestCorrelationId: job.latestCorrelationId,
  }
}

function stateForJob(job: ForecastPreparationJob | null): ForecastPreparationCommandResult {
  if (!job) return { state: 'UNSUPPORTED', reason: 'No preparation request has been submitted for this exact identity.', job: null }
  const state = job.status === 'RUNNING'
    ? 'PREPARING'
    : job.status === 'FAILED'
      ? 'FAILED'
      : job.status === 'SUCCEEDED'
        ? 'READY'
        : job.status === 'SUPERSEDED'
          ? 'UNSUPPORTED'
          : 'QUEUED'
  return { state, reason: job.failureReason, job: toView(job) }
}

function preparedResult(reason: string | null = null): ForecastPreparationCommandResult {
  return { state: 'READY', reason, job: null }
}

function fastPreparedResult(job: ForecastPreparationJob | null): ForecastPreparationCommandResult {
  return {
    state: 'FAST_READY',
    reason: 'A representative Fast Historical Verification sample is ready; full-history preparation continues in the background.',
    job: job ? toView(job) : null,
  }
}

function unsupportedResult(reason: string): ForecastPreparationCommandResult {
  return { state: 'UNSUPPORTED', reason, job: null }
}

export function shouldRequeueSucceededPreparationJob(input: {
  jobStatus: ForecastPreparationJobStatus
  artifactReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
}) {
  return input.jobStatus === 'SUCCEEDED' && input.artifactReadiness !== 'READY'
}

export function buildSucceededPreparationJobRequeueData(now: Date) {
  return {
    status: 'QUEUED' as const,
    availableAt: now,
    startedAt: null,
    completedAt: null,
    sliceCount: 0,
    failureCount: 0,
    leaseOwnerToken: null,
    leaseAcquiredAt: null,
    leaseExpiresAt: null,
    lastHeartbeatAt: null,
    checkpointJson: Prisma.DbNull,
    failureCode: null,
    failureReason: null,
  }
}

async function requeueSucceededJobIfArtifactIsMissing(
  prisma: PrismaClient,
  job: ForecastPreparationJob,
  input: InteractiveForecastIdentity,
) {
  if (job.status !== 'SUCCEEDED') return job

  // The artifact can become ready between the initial capability read and the
  // idempotent job upsert. Re-read before reopening a terminal job so a race
  // with worker completion never creates duplicate compute.
  const capability = await resolveInteractiveForecastCapability(input)
  const artifactReadiness = job.jobKind === 'CURRENT'
    ? capability.currentReadiness
    : capability.fullVerificationReadiness

  if (!shouldRequeueSucceededPreparationJob({
    jobStatus: job.status as ForecastPreparationJobStatus,
    artifactReadiness,
  })) {
    return job
  }

  const now = new Date()
  await prisma.forecastPreparationJob.updateMany({
    where: { id: job.id, status: 'SUCCEEDED' },
    data: buildSucceededPreparationJobRequeueData(now),
  })
  return prisma.forecastPreparationJob.findUniqueOrThrow({ where: { id: job.id } })
}

async function upsertJob(
  prisma: PrismaClient,
  input: ForecastPreparationCommand,
  authority: ForecastPreparedReadAuthority,
  dependencyJobKey: string | null,
  correlationId: string,
) {
  const key = buildForecastPreparationJobKey({
    kind: input.kind,
    seriesId: input.seriesId,
    targetSemantics: input.targetSemantics,
    modelId: input.modelId,
    historyFingerprint: authority.expectedHistoryFingerprint,
  })
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    await tx.forecastPreparationJob.updateMany({
      where: {
        seriesId: input.seriesId,
        targetSemantics: input.targetSemantics,
        modelId: input.modelId,
        jobKind: input.kind === 'CURRENT' ? { in: ['CURRENT', 'VERIFICATION'] } : input.kind,
        historyFingerprint: { not: authority.expectedHistoryFingerprint },
        status: { in: ['QUEUED', 'RUNNING', 'RETRY_WAIT'] },
      },
      data: {
        status: 'SUPERSEDED',
        completedAt: now,
        leaseOwnerToken: null,
        leaseExpiresAt: null,
        failureCode: 'SOURCE_IDENTITY_SUPERSEDED',
        failureReason: 'A newer exact source-history identity was requested.',
      },
    })

    const persisted = await tx.forecastPreparationJob.upsert({
      where: { jobKey: key },
      create: {
        jobKey: key,
        jobKind: input.kind,
        status: 'QUEUED',
        priority: input.kind === 'CURRENT' ? CURRENT_PRIORITY : VERIFICATION_PRIORITY,
        seriesId: input.seriesId,
        targetBasis: TARGET_BASIS_BY_SEMANTICS[input.targetSemantics],
        targetSemantics: input.targetSemantics,
        modelId: input.modelId,
        sourceFrequency: authority.sourceFrequency,
        targetCadence: authority.targetCadence,
        historyFingerprint: authority.expectedHistoryFingerprint,
        dependencyJobKey,
        originCorrelationId: correlationId,
        latestCorrelationId: correlationId,
      },
      update: {
        requestCount: { increment: 1 },
        requestedAt: now,
        dependencyJobKey,
        priority: input.kind === 'CURRENT' ? CURRENT_PRIORITY : VERIFICATION_PRIORITY,
        latestCorrelationId: correlationId,
      },
    })

    // A succeeded exact-identity job is already authoritative. Re-queuing it here
    // would create duplicate compute when an enqueue races with worker completion.
    if (!['FAILED', 'SUPERSEDED'].includes(persisted.status)) {
      return persisted
    }

    await tx.forecastPreparationJob.updateMany({
      where: { id: persisted.id, status: { in: ['FAILED', 'SUPERSEDED'] } },
      data: {
        status: 'QUEUED',
        availableAt: now,
        completedAt: null,
        failureCount: 0,
        failureCode: null,
        failureReason: null,
      },
    })
    return tx.forecastPreparationJob.findUniqueOrThrow({ where: { id: persisted.id } })
  })
}

export function createForecastPreparationQueueService(options: {
  prisma?: PrismaClient | null
  leaseMs?: number
} = {}) {
  const prisma = requirePrisma(options.prisma)
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS

  async function resolveCapability(input: InteractiveForecastIdentity) {
    const exact = await resolveExactForecastCapability(input)
    return exact.capability
  }

  async function safelyRecordActionRequested(input: Parameters<typeof recordForecastActionRequested>[0]) {
    try {
      await recordForecastActionRequested(input, prisma)
    } catch (error) {
      console.error('[forecast-preparation] action-request telemetry failed', {
        correlationId: input.correlationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function safelyRecordQueueAccepted(correlationId: string, jobKey: string) {
    try {
      await recordForecastQueueAccepted(correlationId, jobKey, new Date(), prisma)
    } catch (error) {
      console.error('[forecast-preparation] queue-accepted telemetry failed', {
        correlationId,
        jobKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function enqueue(
    input: ForecastPreparationCommand,
    options: { correlationId: string },
  ): Promise<ForecastPreparationCommandResult> {
    const parsed = ForecastPreparationCommandSchema.safeParse(input)
    if (!parsed.success) {
      return unsupportedResult('The exact Forecast preparation identity is invalid.')
    }

    await safelyRecordActionRequested({
      correlationId: options.correlationId,
      actionType: parsed.data.kind === 'CURRENT' ? 'CURRENT_PREPARATION' : 'VERIFICATION_PREPARATION',
      seriesId: parsed.data.seriesId,
      targetBasis: TARGET_BASIS_BY_SEMANTICS[parsed.data.targetSemantics],
      targetSemantics: parsed.data.targetSemantics,
      modelId: parsed.data.modelId,
    })

    const interactiveCapability = await resolveInteractiveForecastCapability(parsed.data)
    if (input.kind === 'CURRENT' && interactiveCapability.currentReadiness === 'READY') {
      return preparedResult('The exact Current Forecast artifact is already prepared.')
    }
    if (input.kind === 'VERIFICATION' && interactiveCapability.fullVerificationReadiness === 'READY') {
      return preparedResult('The exact Historical Verification artifact is already prepared.')
    }

    const capability = await resolveCapability(parsed.data)
    if (!isEligible(capability)) {
      return unsupportedResult(interactiveCapability.reason ?? capability?.capabilityState ?? 'Exact Forecast preparation is not eligible.')
    }

    let dependencyJobKey: string | null = null
    if (input.kind === 'VERIFICATION' && interactiveCapability.currentReadiness !== 'READY') {
      const currentInput = { ...parsed.data, kind: 'CURRENT' as const }
      const persistedCurrent = await upsertJob(
        prisma,
        currentInput,
        await resolveJobAuthority(currentInput, capability!),
        null,
        options.correlationId,
      )
      const current = await requeueSucceededJobIfArtifactIsMissing(prisma, persistedCurrent, currentInput)
      dependencyJobKey = current.jobKey
    }

    const command = parsed.data
    const persistedJob = await upsertJob(
      prisma,
      command,
      await resolveJobAuthority(command, capability!),
      dependencyJobKey,
      options.correlationId,
    )
    const job = await requeueSucceededJobIfArtifactIsMissing(prisma, persistedJob, command)
    await safelyRecordQueueAccepted(options.correlationId, job.jobKey)
    return stateForJob(job)
  }

  async function snapshot(input: InteractiveForecastIdentity): Promise<ForecastPreparationIdentitySnapshot> {
    const parsed = InteractiveForecastIdentitySchema.parse(input)
    const capability = await resolveInteractiveForecastCapability(parsed)
    const jobs = await prisma.forecastPreparationJob.findMany({
      where: {
        seriesId: parsed.seriesId,
        targetSemantics: parsed.targetSemantics,
        modelId: parsed.modelId,
      },
      orderBy: { requestedAt: 'desc' },
    })
    const currentJob = jobs.find((job) => job.jobKind === 'CURRENT') ?? null
    const verificationJob = jobs.find((job) => job.jobKind === 'VERIFICATION') ?? null

    return {
      ...parsed,
      targetBasis: TARGET_BASIS_BY_SEMANTICS[parsed.targetSemantics],
      current: capability.currentReadiness === 'READY'
        ? preparedResult()
        : currentJob?.status === 'SUCCEEDED'
          ? unsupportedResult('The prepared Current Forecast is stale; submit a new preparation request.')
          : stateForJob(currentJob),
      verification: capability.fullVerificationReadiness === 'READY'
        ? preparedResult()
        : capability.fastVerificationReadiness === 'READY'
          ? fastPreparedResult(verificationJob)
        : verificationJob?.status === 'SUCCEEDED'
          ? unsupportedResult('The prepared Historical Verification is stale; submit a new preparation request.')
          : stateForJob(verificationJob),
    }
  }

  async function claimNext(workerId: string): Promise<ClaimedForecastPreparationJob | null> {
    const ownerToken = `${workerId}:${randomUUID()}`
    const leaseExpiresAt = new Date(Date.now() + leaseMs)
    const rows = await prisma.$queryRaw<ForecastPreparationJob[]>(Prisma.sql`
      WITH recover_expired AS (
        UPDATE "forecast_preparation_job"
        SET "status" = 'RETRY_WAIT',
            "availableAt" = NOW(),
            "leaseOwnerToken" = NULL,
            "leaseExpiresAt" = NULL,
            "lastHeartbeatAt" = NULL,
            "updatedAt" = NOW(),
            "failureCode" = 'LEASE_EXPIRED',
            "failureReason" = 'The previous worker lease expired; the job was safely re-queued.'
        WHERE "status" = 'RUNNING' AND "leaseExpiresAt" < NOW()
      ), fail_blocked AS (
        UPDATE "forecast_preparation_job" job
        SET "status" = 'FAILED',
            "completedAt" = NOW(),
            "failureCode" = 'DEPENDENCY_FAILED',
            "failureReason" = 'The prerequisite Current Forecast preparation failed.',
            "updatedAt" = NOW()
        FROM "forecast_preparation_job" dependency
        WHERE job."status" IN ('QUEUED', 'RETRY_WAIT')
          AND job."dependencyJobKey" = dependency."jobKey"
          AND dependency."status" = 'FAILED'
      ), candidate AS (
        SELECT job."id"
        FROM "forecast_preparation_job" job
        WHERE job."status" IN ('QUEUED', 'RETRY_WAIT')
          AND job."availableAt" <= NOW()
          AND (
            job."dependencyJobKey" IS NULL
            OR EXISTS (
              SELECT 1 FROM "forecast_preparation_job" dependency
              WHERE dependency."jobKey" = job."dependencyJobKey"
                AND dependency."status" = 'SUCCEEDED'
            )
          )
        ORDER BY job."priority" ASC, job."availableAt" ASC, job."requestedAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "forecast_preparation_job" job
      SET "status" = 'RUNNING',
          "leaseOwnerToken" = ${ownerToken},
          "leaseVersion" = job."leaseVersion" + 1,
          "leaseAcquiredAt" = NOW(),
          "leaseExpiresAt" = ${leaseExpiresAt},
          "lastHeartbeatAt" = NOW(),
          "startedAt" = COALESCE(job."startedAt", NOW()),
          "failureCode" = NULL,
          "failureReason" = NULL,
          "updatedAt" = NOW()
      FROM candidate
      WHERE job."id" = candidate."id"
      RETURNING job.*
    `)
    const claimed = rows[0]
    return claimed ? { ...claimed, leaseOwnerToken: ownerToken } : null
  }

  async function heartbeat(job: ClaimedForecastPreparationJob) {
    const updated = await prisma.forecastPreparationJob.updateMany({
      where: {
        id: job.id,
        status: 'RUNNING',
        leaseOwnerToken: job.leaseOwnerToken,
        leaseVersion: job.leaseVersion,
      },
      data: {
        lastHeartbeatAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + leaseMs),
      },
    })
    if (updated.count !== 1) throw new Error(`Forecast preparation lease lost for ${job.jobKey}.`)
  }

  async function complete(job: ClaimedForecastPreparationJob, checkpoint?: Record<string, unknown>) {
    const updated = await prisma.forecastPreparationJob.updateMany({
      where: { id: job.id, status: 'RUNNING', leaseOwnerToken: job.leaseOwnerToken, leaseVersion: job.leaseVersion },
      data: {
        status: 'SUCCEEDED',
        sliceCount: { increment: 1 },
        completedAt: new Date(),
        leaseOwnerToken: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        checkpointJson: checkpoint ? checkpoint as Prisma.InputJsonValue : Prisma.DbNull,
        failureCode: null,
        failureReason: null,
      },
    })
    if (updated.count !== 1) throw new Error(`Forecast preparation completion lost its lease for ${job.jobKey}.`)
  }

  async function continueAfterSlice(job: ClaimedForecastPreparationJob, checkpoint: Record<string, unknown>) {
    const updated = await prisma.forecastPreparationJob.updateMany({
      where: { id: job.id, status: 'RUNNING', leaseOwnerToken: job.leaseOwnerToken, leaseVersion: job.leaseVersion },
      data: {
        status: 'QUEUED',
        sliceCount: { increment: 1 },
        availableAt: new Date(),
        checkpointJson: checkpoint as Prisma.InputJsonValue,
        leaseOwnerToken: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
      },
    })
    if (updated.count !== 1) throw new Error(`Forecast preparation checkpoint lost its lease for ${job.jobKey}.`)
  }

  async function failOrRetry(
    job: ClaimedForecastPreparationJob,
    error: unknown,
    checkpoint?: Record<string, unknown>,
  ) {
    const failureCount = job.failureCount + 1
    const terminal = failureCount >= job.maxFailureCount
    const delayMs = Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_MS * (2 ** Math.max(0, failureCount - 1)))
    const updated = await prisma.forecastPreparationJob.updateMany({
      where: { id: job.id, status: 'RUNNING', leaseOwnerToken: job.leaseOwnerToken, leaseVersion: job.leaseVersion },
      data: {
        status: terminal ? 'FAILED' : 'RETRY_WAIT',
        failureCount,
        availableAt: terminal ? new Date() : new Date(Date.now() + delayMs),
        completedAt: terminal ? new Date() : null,
        leaseOwnerToken: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        ...(checkpoint ? { checkpointJson: checkpoint as Prisma.InputJsonValue } : {}),
        failureCode: terminal ? 'RETRY_EXHAUSTED' : 'TRANSIENT_FAILURE',
        failureReason: error instanceof Error ? error.message : String(error),
      },
    })
    if (updated.count !== 1) throw new Error(`Forecast preparation failure handling lost its lease for ${job.jobKey}.`)
  }

  async function completeUnavailable(job: ClaimedForecastPreparationJob, reason: string) {
    const updated = await prisma.forecastPreparationJob.updateMany({
      where: { id: job.id, status: 'RUNNING', leaseOwnerToken: job.leaseOwnerToken, leaseVersion: job.leaseVersion },
      data: {
        status: 'FAILED',
        sliceCount: { increment: 1 },
        completedAt: new Date(),
        leaseOwnerToken: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: null,
        failureCode: 'INSUFFICIENT_VERIFICATION_HISTORY',
        failureReason: reason,
      },
    })
    if (updated.count !== 1) throw new Error(`Forecast preparation terminal-unavailable handling lost its lease for ${job.jobKey}.`)
  }

  return { enqueue, snapshot, claimNext, heartbeat, complete, completeUnavailable, continueAfterSlice, failOrRetry }
}

export type ForecastPreparationQueueService = ReturnType<typeof createForecastPreparationQueueService>

export function createForecastPreparationWorker(options: {
  queue?: ForecastPreparationQueueService
  workerId?: string
  heartbeatMs?: number
  prepareCurrent?: typeof prepareInteractiveCurrentForecast
  prepareVerificationSlice?: (
    job: ClaimedForecastPreparationJob,
    options: { maxOriginsPerRun: number },
  ) => Promise<ForecastProductionOperationsResult | void>
  resolveReadiness?: typeof resolveInteractiveForecastCapability
  recordArtifactReady?: typeof recordForecastArtifactReady
  persistResourceSummary?: typeof persistForecastExecutionResourceSummary
} = {}) {
  const queue = options.queue ?? createForecastPreparationQueueService()
  const workerId = options.workerId ?? `forecast-worker-${randomUUID()}`
  const heartbeatMs = options.heartbeatMs ?? 60_000
  const operations = createForecastProductionOperationsService()
  const prepareCurrent = options.prepareCurrent ?? prepareInteractiveCurrentForecast
  const prepareVerificationSlice = options.prepareVerificationSlice ?? (async (
    job: ClaimedForecastPreparationJob,
    slice: { maxOriginsPerRun: number },
  ) => {
    const result = await operations.run({
      seriesId: job.seriesId,
      targetSemantics: [job.targetSemantics as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE' | 'ROLLING_DAILY_POINT_IN_TIME'],
      modelIds: [job.modelId as InteractiveForecastIdentity['modelId']],
      prepareHistorical: true,
      verificationScope: 'FULL',
      maxOriginsPerRun: slice.maxOriginsPerRun,
      rollingDailySnapshotRefreshMode: 'WHEN_REQUIRED',
    })
    if (result.status === 'FAILED') {
      throw new Error(result.results[0]?.error ?? 'Historical Verification preparation failed.')
    }
    return result
  })
  const resolveReadiness = options.resolveReadiness ?? resolveInteractiveForecastCapability
  const recordArtifactReady = options.recordArtifactReady ?? recordForecastArtifactReady
  const persistResourceSummary = options.persistResourceSummary ?? persistForecastExecutionResourceSummary

  function resolvePreparedOriginCount(
    result: ForecastProductionOperationsResult | void,
    job: ClaimedForecastPreparationJob,
    requestedBatchSize: number,
  ) {
    const item = result?.results.find((candidate) => (
      candidate.targetSemantics === job.targetSemantics
      && candidate.modelId === job.modelId
    ))
    return item?.historicalProgressOriginCount ?? requestedBatchSize
  }

  async function safelyRecordArtifactReady(jobKey: string, kind: ForecastPreparationJobKind) {
    try {
      await recordArtifactReady(jobKey, kind)
    } catch (error) {
      console.error('[forecast-preparation-worker] artifact-ready telemetry failed', {
        jobKey,
        kind,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function safelyPersistResourceSummary(
    correlationId: string,
    summary: Awaited<ReturnType<typeof measureForecastWorkerJob>>['summary'],
  ) {
    try {
      await persistResourceSummary(correlationId, summary)
    } catch (error) {
      console.error('[forecast-preparation-worker] resource-summary telemetry failed', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function execute(job: ClaimedForecastPreparationJob) {
    const input = InteractiveForecastIdentitySchema.parse({
      seriesId: job.seriesId,
      targetSemantics: job.targetSemantics,
      modelId: job.modelId,
    })
    const heartbeat = setInterval(() => {
      void queue.heartbeat(job).catch((error) => console.error('[forecast-preparation-worker] heartbeat failed', error))
    }, heartbeatMs)

    const correlationId = resolveForecastJobCorrelationId(job)
    const operationType = job.jobKind === 'CURRENT' ? 'CURRENT_MATERIALIZATION' : 'VERIFICATION_MATERIALIZATION'
    let adaptiveCheckpoint: AdaptiveVerificationBatchCheckpoint | null = job.jobKind === 'VERIFICATION'
      ? readAdaptiveVerificationBatchCheckpoint(job.checkpointJson)
      : null

    const measured = await measureForecastWorkerJob({ correlationId, jobKey: job.jobKey }, async () => runWithForecastRequestDiagnostics({
      enabled: true,
      requestId: correlationId,
      route: 'forecast-preparation-worker',
      method: 'WORKER',
      operationType,
    }, async () => {
      updateForecastRequestDiagnosticsIdentity({
        seriesId: job.seriesId,
        modelId: job.modelId,
        targetBasis: job.targetBasis,
        targetSemantics: job.targetSemantics,
        sourceFrequency: job.sourceFrequency,
        targetCadence: job.targetCadence,
      })
      noteForecastRequestDiagnosticsEvent('durable_job_started', 'APPLICATION', {
        jobKey: job.jobKey,
        jobKind: job.jobKind,
        workerId,
        historyFingerprint: job.historyFingerprint,
      })
      console.info(JSON.stringify({
        event: 'FORECAST_PREPARATION_JOB_STARTED',
        correlationId,
        jobKey: job.jobKey,
        jobKind: job.jobKind,
        workerId,
        seriesId: job.seriesId,
        modelId: job.modelId,
        targetSemantics: job.targetSemantics,
        historyFingerprint: job.historyFingerprint,
      }))

      let completionStatus = 200

      try {
        if (job.jobKind === 'CURRENT') {
          const result = await prepareCurrent(input)
          if (result.status !== 'READY' && result.status !== 'REUSED') {
            throw new Error(result.reason ?? `Current Forecast preparation ended with ${result.status}.`)
          }
          await queue.complete(job)
          await safelyRecordArtifactReady(job.jobKey, 'CURRENT')
          noteForecastRequestDiagnosticsEvent('durable_job_completed', 'APPLICATION', { jobKey: job.jobKey, state: 'SUCCEEDED' })
          return
        }

        const batchSize = adaptiveCheckpoint?.nextBatchSize ?? 1
        const sliceStartedAt = performance.now()
        const sliceResult = await prepareVerificationSlice(job, { maxOriginsPerRun: batchSize })
        const sliceMs = Math.max(1, performance.now() - sliceStartedAt)
        adaptiveCheckpoint = observeSuccessfulVerificationBatch(
          adaptiveCheckpoint ?? readAdaptiveVerificationBatchCheckpoint(null),
          {
            batchSize,
            sliceMs,
            originCount: resolvePreparedOriginCount(sliceResult, job, batchSize),
          },
        )
        console.info(JSON.stringify({
          event: 'FORECAST_VERIFICATION_ADAPTIVE_BATCH_DECISION',
          correlationId,
          jobKey: job.jobKey,
          batchSize,
          nextBatchSize: adaptiveCheckpoint.nextBatchSize,
          sliceMs,
          originCount: adaptiveCheckpoint.lastOriginCount,
          decision: adaptiveCheckpoint.decision,
          reason: adaptiveCheckpoint.reason,
        }))
        const readiness = await resolveReadiness(input)
        const checkpoint = {
          ...adaptiveCheckpoint,
          fastVerificationReadiness: readiness.fastVerificationReadiness,
          fullVerificationReadiness: readiness.fullVerificationReadiness,
          blockers: readiness.readiness.blockers,
          checkedAt: new Date().toISOString(),
        }
        if (readiness.fastVerificationReadiness === 'READY' || readiness.fullVerificationReadiness === 'READY') {
          await safelyRecordArtifactReady(job.jobKey, 'VERIFICATION')
          noteForecastRequestDiagnosticsEvent('fast_verification_ready', 'APPLICATION', {
            jobKey: job.jobKey,
            fullVerificationReadiness: readiness.fullVerificationReadiness,
          })
        }
        if (readiness.fullVerificationReadiness === 'READY') {
          await queue.complete(job, { ...checkpoint, terminal: true })
          noteForecastRequestDiagnosticsEvent('durable_job_completed', 'APPLICATION', { jobKey: job.jobKey, state: 'SUCCEEDED' })
        } else {
          const terminalReason = resolveTerminalVerificationUnavailability(sliceResult, input)
          if (terminalReason) {
            await queue.completeUnavailable(job, terminalReason)
            completionStatus = 422
            noteForecastRequestDiagnosticsEvent('durable_job_completed', 'APPLICATION', { jobKey: job.jobKey, state: 'FAILED' })
            return
          }
          await queue.continueAfterSlice(job, checkpoint)
          noteForecastRequestDiagnosticsEvent('durable_job_completed', 'APPLICATION', { jobKey: job.jobKey, state: 'QUEUED' })
        }
      } catch (error) {
        completionStatus = 500
        noteForecastRequestDiagnosticsEvent('durable_job_failed', 'APPLICATION', {
          jobKey: job.jobKey,
          error: error instanceof Error ? error.message : String(error),
        })
        const failureCheckpoint = adaptiveCheckpoint
          ? fallbackAdaptiveVerificationBatchAfterFailure(
              adaptiveCheckpoint,
              `Reset after failed slice: ${error instanceof Error ? error.message : String(error)}`,
            )
          : null
        await queue.failOrRetry(job, error, failureCheckpoint ?? undefined)
      } finally {
        clearInterval(heartbeat)
        console.info(JSON.stringify({
          event: 'FORECAST_PREPARATION_JOB_FINISHED',
          correlationId,
          jobKey: job.jobKey,
          jobKind: job.jobKind,
          workerId,
          status: completionStatus,
        }))
        completeForecastRequestDiagnostics(completionStatus)
      }
    }))
    await safelyPersistResourceSummary(correlationId, measured.summary)
    console.info(JSON.stringify({
      event: 'FORECAST_PREPARATION_RESOURCE_SUMMARY',
      correlationId,
      jobKey: job.jobKey,
      summary: measured.summary,
    }))
  }

  return {
    workerId,
    async runOne() {
      const job = await queue.claimNext(workerId)
      if (!job) return false
      await execute(job)
      return true
    },
  }
}
