import { type NextRequest } from 'next/server'
import { z } from 'zod'

import type {
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationResult,
} from '@/lib/forecast/contracts'
import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody, parseSearchParams, withCognitionAuth } from '@/lib/api/middleware'
import { Prisma } from '@/generated/market-data-client'
import { resolveProductionForecast, type ProductionForecastResult } from '@/lib/forecast/production-routing'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { buildRollingDailyHistoryFingerprint } from '@/lib/forecast/rolling-daily-maintenance'
import { readPreparedRollingDailyForecastVerification } from '@/lib/forecast/rolling-daily-verification'
import {
  ForecastRouteQuerySchema,
  ProductionForecastRouteQuerySchema,
  toForecastRequestInput,
  toProductionForecastRequestInput,
  type ForecastRequestInput,
  type ProductionForecastRequestInput,
} from '@/lib/forecast/request-contract'
import {
  readPreparedBenchmarkCurrentForecast,
  resolveBenchmarkForecastVerification,
  readPreparedBenchmarkForecastVerification,
} from '@/lib/forecast/service'
import {
  forecastStressContextFromHeaders,
  forecastStressTelemetry,
  type ForecastStressTelemetry,
} from '@/lib/forecast/stress-telemetry'
import {
  appendForecastRequestDiagnosticsHeader,
  isForecastRequestDiagnosticsEnabled,
  noteForecastRequestDiagnosticsEvent,
  runWithForecastRequestDiagnostics,
  traceForecastRequestDiagnosticsSpan,
  updateForecastRequestDiagnosticsIdentity,
} from '@/lib/forecast/request-diagnostics'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'

type PreparedCurrentResult = BenchmarkForecastCurrentResult | Awaited<ReturnType<typeof readPreparedRollingDailyCurrentForecast>>
type CurrentForecastResolver = (input: ForecastRequestInput) => Promise<PreparedCurrentResult>
type ForecastVerificationResolver = (input: ForecastRequestInput) => Promise<BenchmarkForecastVerificationResult>
type ProductionForecastResolver = (input: ProductionForecastRequestInput) => Promise<ProductionForecastResult>

type PreparedVerificationDependencies = {
  readRollingDailyVerification: ForecastVerificationResolver
  readGenericPeriodVerification: ForecastVerificationResolver
}

type PointInTimeVerificationPreparer = (input: {
  seriesId: string
  modelId: ForecastRequestInput['modelId']
}) => Promise<void>

type ExecutionLedgerRow = {
  executionId: string
  logicalArtifactKey: string
  operationFamily: string
  executionStatus: string
  ownerRequestId: string
  latestRequestId: string
  latestRole: string
  waiterCount: number
  startedAt: string
  computeStartedAt: string | null
  computeCompletedAt: string | null
  persistenceStartedAt: string | null
  persistenceCompletedAt: string | null
  completedAt: string | null
  failureReason: string | null
}

const PREPARED_READ_AUTHORITY_SOURCE_FREQUENCY_HEADER = 'x-sg-prepared-source-frequency'
const PREPARED_READ_AUTHORITY_TARGET_CADENCE_HEADER = 'x-sg-prepared-target-cadence'
const PREPARED_READ_AUTHORITY_HISTORY_FINGERPRINT_HEADER = 'x-sg-prepared-history-fingerprint'

function readPreparedReadAuthorityFromHeaders(
  request: NextRequest,
  input: ForecastRequestInput,
) {
  const sourceFrequency = request.headers.get(PREPARED_READ_AUTHORITY_SOURCE_FREQUENCY_HEADER)?.trim()
  const targetCadence = request.headers.get(PREPARED_READ_AUTHORITY_TARGET_CADENCE_HEADER)?.trim()
  const expectedHistoryFingerprint = request.headers.get(PREPARED_READ_AUTHORITY_HISTORY_FINGERPRINT_HEADER)?.trim()

  if (!sourceFrequency && !targetCadence && !expectedHistoryFingerprint) {
    return undefined
  }

  if (!sourceFrequency || !targetCadence || !expectedHistoryFingerprint) {
    return {
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      sourceFrequency: input.sourceFrequency ?? 'MONTHLY',
      targetCadence: input.targetCadence ?? 'MONTHLY',
      expectedHistoryFingerprint: '',
    }
  }

  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    sourceFrequency: sourceFrequency as NonNullable<ForecastRequestInput['sourceFrequency']>,
    targetCadence: targetCadence as NonNullable<ForecastRequestInput['targetCadence']>,
    expectedHistoryFingerprint,
  }
}

const preparedVerificationDependencies: PreparedVerificationDependencies = {
  readRollingDailyVerification: readPreparedRollingDailyForecastVerification,
  readGenericPeriodVerification: readPreparedBenchmarkForecastVerification,
}

const executionLedgerLookupSchema = z.object({
  ownerRequestIds: z.array(z.string().trim().min(1)).max(100),
})

const rollingDailyProductionOperations = createRollingDailyProductionOperationsService()

async function readPreparedRollingDailyCurrentForecast(input: ForecastRequestInput) {
  const { history } = await resolveBenchmarkHistoricalSeries(input.seriesId, 'ALL')
  const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: input.seriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.historical,
  })
  const snapshot = await readRollingDailyCurrentForecastSnapshot({
    seriesId: input.seriesId,
    modelId: input.modelId,
    sourceHistoryFingerprint,
  })
  forecastStressTelemetry.emit('prepared_read', {
    kind: 'current',
    store: 'rolling_daily_current_forecast_snapshots',
    hit: snapshot.status === 'HIT',
    stale: snapshot.status === 'STALE',
  })
  if (snapshot.status === 'HIT') return snapshot.payload
  return {
    status: 'NOT_AVAILABLE' as const,
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: 'POINT_IN_TIME' as const,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    methodId: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    reason: `PREPARATION_REQUIRED: Rolling Daily prepared Current snapshot is ${snapshot.status}.`,
  }
}

async function readPreparedCurrentForecast(input: ForecastRequestInput): Promise<PreparedCurrentResult> {
  return input.targetBasis === 'POINT_IN_TIME'
    ? readPreparedRollingDailyCurrentForecast(input)
    : readPreparedBenchmarkCurrentForecast(input)
}

export async function resolvePreparedForecastVerification(
  input: ForecastRequestInput,
  dependencies: PreparedVerificationDependencies = preparedVerificationDependencies,
) {
  return input.targetBasis === 'POINT_IN_TIME'
    ? dependencies.readRollingDailyVerification(input)
    : dependencies.readGenericPeriodVerification(input)
}

export function createInternalForecastVerificationResolver(
  resolveGenericPeriodVerification: ForecastVerificationResolver = resolveBenchmarkForecastVerification,
  preparePointInTimeVerification: PointInTimeVerificationPreparer = async ({ seriesId, modelId }) => {
    await rollingDailyProductionOperations.run({
      seriesId,
      modelIds: [modelId],
      prepareHistorical: true,
      maxOriginsPerRun: 1,
    })
  },
  readPointInTimeVerification: ForecastVerificationResolver = readPreparedRollingDailyForecastVerification,
): ForecastVerificationResolver {
  return async (input) => {
    if (input.targetBasis !== 'POINT_IN_TIME') {
      return resolveGenericPeriodVerification(input)
    }

    updateForecastRequestDiagnosticsIdentity({
      operationType: 'VERIFICATION_MATERIALIZATION',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
    })

    await traceForecastRequestDiagnosticsSpan(
      'point_in_time_verification_prepare',
      'APPLICATION',
      () => preparePointInTimeVerification({
        seriesId: input.seriesId,
        modelId: input.modelId,
      }),
      { seriesId: input.seriesId, modelId: input.modelId },
    )

    return traceForecastRequestDiagnosticsSpan(
      'point_in_time_verification_read',
      'DB_OPERATION',
      () => readPointInTimeVerification(input),
      { seriesId: input.seriesId, modelId: input.modelId },
    )
  }
}

async function runForecastRouteWithDiagnostics(
  request: NextRequest,
  requestId: string,
  operationType: 'READ_ONLY_PREPARED' | 'VERIFICATION_MATERIALIZATION' | 'PRODUCTION' | 'OTHER',
  operation: () => Promise<ReturnType<typeof cognitionOk>>,
) {
  return runWithForecastRequestDiagnostics({
    enabled: isForecastRequestDiagnosticsEnabled(request.headers),
    requestId,
    route: request.nextUrl.pathname,
    method: request.method,
    operationType,
  }, async () => {
    noteForecastRequestDiagnosticsEvent('handler_entered', 'HTTP', { requestId })
    const response = await operation()
    return appendForecastRequestDiagnosticsHeader(response)
  })
}

async function readExecutionLedgerRows(ownerRequestIds: string[]) {
  const prisma = getMarketDataPrisma()
  if (!prisma || ownerRequestIds.length === 0) {
    return [] as ExecutionLedgerRow[]
  }

  return prisma.$queryRaw<ExecutionLedgerRow[]>(Prisma.sql`
    SELECT
      "executionId",
      "logicalArtifactKey",
      "operationFamily",
      "executionStatus",
      "ownerRequestId",
      "latestRequestId",
      "latestRole",
      "waiterCount",
      "startedAt"::text AS "startedAt",
      "computeStartedAt"::text AS "computeStartedAt",
      "computeCompletedAt"::text AS "computeCompletedAt",
      "persistenceStartedAt"::text AS "persistenceStartedAt",
      "persistenceCompletedAt"::text AS "persistenceCompletedAt",
      "completedAt"::text AS "completedAt",
      "failureReason"
    FROM "forecast_preparation_execution_ledger"
    WHERE "ownerRequestId" IN (${Prisma.join(ownerRequestIds)})
    ORDER BY "startedAt" ASC
  `)
}

export function createCurrentForecastRouteHandler(
  resolveCurrentForecast: CurrentForecastResolver = readPreparedCurrentForecast,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withCognitionAuth(async (_auth, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _auth.requestId, 'READ_ONLY_PREPARED', async () => {
      const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400)
      }

      const input = toForecastRequestInput(parsed.data)
      const preparedReadAuthority = readPreparedReadAuthorityFromHeaders(request, input)
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
        telemetry.sampleResources()
        const resolved = await resolveCurrentForecast({
          ...input,
          ...(preparedReadAuthority ? { preparedReadAuthority } : {}),
        })
        telemetry.sampleResources()
        return resolved
      })
      return cognitionOk(result)
    })
  })
}

export function createInternalPreparedCurrentForecastRouteHandler(
  resolveCurrentForecast: CurrentForecastResolver = readPreparedCurrentForecast,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withInternalForecastServiceAuth(async (_principal, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _principal.requestId, 'READ_ONLY_PREPARED', async () => {
      const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400)
      }

      const input = toForecastRequestInput(parsed.data)
      const preparedReadAuthority = readPreparedReadAuthorityFromHeaders(request, input)
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
        telemetry.sampleResources()
        const resolved = await resolveCurrentForecast({
          ...input,
          ...(preparedReadAuthority ? { preparedReadAuthority } : {}),
        })
        telemetry.sampleResources()
        return resolved
      })
      return cognitionOk(result)
    })
  })
}

export function createInternalForecastExecutionLedgerRouteHandler() {
  return withInternalForecastServiceAuth(async (_principal, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _principal.requestId, 'OTHER', async () => {
      const parsed = await parseJsonBody(request, executionLedgerLookupSchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400, _principal.requestId)
      }

      const rows = await traceForecastRequestDiagnosticsSpan(
        'execution_ledger_lookup',
        'DB_OPERATION',
        () => readExecutionLedgerRows(parsed.data.ownerRequestIds),
        { ownerRequestCount: parsed.data.ownerRequestIds.length },
      )

      return cognitionOk({ rows })
    })
  })
}

export function createForecastVerificationRouteHandler(
  resolveForecastVerification: ForecastVerificationResolver = resolvePreparedForecastVerification,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withCognitionAuth(async (_auth, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _auth.requestId, 'READ_ONLY_PREPARED', async () => {
      const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400)
      }

      const input = toForecastRequestInput(parsed.data)
      const preparedReadAuthority = readPreparedReadAuthorityFromHeaders(request, input)
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
        telemetry.sampleResources()
        const resolved = await resolveForecastVerification({
          ...input,
          ...(preparedReadAuthority ? { preparedReadAuthority } : {}),
        })
        telemetry.sampleResources()
        return resolved
      })
      return cognitionOk(result)
    })
  })
}

export function createInternalPreparedForecastVerificationRouteHandler(
  resolveForecastVerification: ForecastVerificationResolver = resolvePreparedForecastVerification,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withInternalForecastServiceAuth(async (_principal, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _principal.requestId, 'READ_ONLY_PREPARED', async () => {
      const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400)
      }

      const input = toForecastRequestInput(parsed.data)
      const preparedReadAuthority = readPreparedReadAuthorityFromHeaders(request, input)
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'READ_ONLY_PREPARED',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
        telemetry.sampleResources()
        const resolved = await resolveForecastVerification({
          ...input,
          ...(preparedReadAuthority ? { preparedReadAuthority } : {}),
        })
        telemetry.sampleResources()
        return resolved
      })
      return cognitionOk(result)
    })
  })
}

export function createInternalForecastVerificationRouteHandler(
  resolveForecastVerification: ForecastVerificationResolver = createInternalForecastVerificationResolver(),
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withInternalForecastServiceAuth(async (_principal, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _principal.requestId, 'VERIFICATION_MATERIALIZATION', async () => {
      const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400)
      }

      const input = toForecastRequestInput(parsed.data)
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'VERIFICATION_MATERIALIZATION',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
      })
      const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
        telemetry.sampleResources()
        const resolved = await resolveForecastVerification(input)
        telemetry.sampleResources()
        return resolved
      })
      return cognitionOk(result)
    })
  })
}

export function createInternalProductionForecastRouteHandler(
  resolveInternalProductionForecast: ProductionForecastResolver = resolveProductionForecast,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withInternalForecastServiceAuth(async (_principal, request: NextRequest) => {
    return runForecastRouteWithDiagnostics(request, request.headers.get('x-request-id') ?? _principal.requestId, 'PRODUCTION', async () => {
      const parsed = parseSearchParams(request, ProductionForecastRouteQuerySchema)
      if (!parsed.ok) {
        return cognitionError('VALIDATION_ERROR', parsed.message, 400)
      }

      const input = toProductionForecastRequestInput(parsed.data)
      updateForecastRequestDiagnosticsIdentity({
        operationType: 'PRODUCTION',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.forecastMethod,
      })
      const result = await telemetry.run(forecastStressContextFromHeaders(request, {
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.forecastMethod,
      }), async () => {
        telemetry.sampleResources()
        const resolved = await traceForecastRequestDiagnosticsSpan(
          'production_forecast_resolution',
          'APPLICATION',
          () => resolveInternalProductionForecast(input),
          { seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.forecastMethod },
        )
        telemetry.sampleResources()
        return resolved
      })
      return cognitionOk(result)
    })
  })
}