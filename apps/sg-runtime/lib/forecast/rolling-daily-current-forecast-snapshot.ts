import { Prisma, type PrismaClient } from '@/generated/market-data-client'
import {
  ForecastExecutionControlError,
  hasForecastPreparationExecutionLedgerRelation,
  isMissingExecutionLedgerRelationError,
} from '@/lib/forecast/execution-ledger'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import type { ProductionForecastResult } from '@/lib/forecast/production-routing'
import type { ForecastPersistenceOwnership } from '@/lib/forecast/service'
import {
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  type RollingDailyHistoryPayload,
} from '@/lib/forecast/rolling-daily-maintenance'
import {
  createCurrentForecastStatisticalCompatibility,
  type ForecastStatisticalCompatibility,
} from '@/lib/forecast/identity'
import {
  ROLLING_DAILY_TARGET_BASIS,
} from '@/lib/forecast/rolling-daily-policy'
import {
  RollingDailyProductionForecastResultSchema,
  type RollingDailyProductionForecastResult,
} from '@/lib/forecast/rolling-daily-production-forecast'

type MarketDataPrismaClient = NonNullable<ReturnType<typeof getMarketDataPrisma>>

export type RollingDailyCurrentForecastSnapshotModelId = 'naive' | 'damped_holt' | 'ets' | 'arima'

export type RollingDailyCurrentForecastSnapshotRequest = {
  seriesId: string
  modelId: RollingDailyCurrentForecastSnapshotModelId
  preparedHistory?: RollingDailyHistoryPayload
}

export type RollingDailyCurrentForecastSnapshotPersistenceResult = {
  seriesId: string
  modelId: RollingDailyCurrentForecastSnapshotModelId
  targetBasis: 'POINT_IN_TIME'
  targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME'
  methodId: 'ROLLING_DAILY_POINT_IN_TIME'
  methodVersion: string
  contractVersion: string
  status: RollingDailyProductionForecastResult['status']
  reasonCode: string | null
  parityStatus: 'MATCHED'
}

type SnapshotResolver = (input: RollingDailyCurrentForecastSnapshotRequest & {
  forecastMethod: 'ROLLING_DAILY_POINT_IN_TIME'
}) => Promise<ProductionForecastResult>

type SnapshotPersistenceDependencies = {
  prisma?: MarketDataPrismaClient
  resolveProductionForecast?: SnapshotResolver
}

type RollingDailySnapshotPersistenceOptions = {
  ownership?: ForecastPersistenceOwnership
}

function upsertRollingDailyCurrentForecastSnapshot(
  tx: Pick<MarketDataPrismaClient, 'rollingDailyCurrentForecastSnapshot'>,
  input: {
    request: RollingDailyCurrentForecastSnapshotRequest
    inputSource: string
    statisticalCompatibility: ForecastStatisticalCompatibility
    sourceHistoryFingerprint: string
    payload: RollingDailyProductionForecastResult
    forecastOriginAt: Date | null
    sourceLatestObservationAt: Date | null
  },
) {
  return tx.rollingDailyCurrentForecastSnapshot.upsert({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint: {
        seriesId: input.request.seriesId,
        inputSource: input.inputSource,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: input.payload.forecastMethod.version,
        modelId: input.request.modelId,
        trainingWindowPolicyId: input.statisticalCompatibility.trainingWindowPolicyId,
        effectiveTrainingPolicyId: input.statisticalCompatibility.effectiveTrainingPolicyId,
        sourceHistoryFingerprint: input.sourceHistoryFingerprint,
      },
    },
    create: {
      seriesId: input.request.seriesId,
      inputSource: input.inputSource,
      inputRunId: null,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: input.payload.forecastMethod.version,
      modelId: input.request.modelId,
      trainingWindowPolicyId: input.statisticalCompatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: input.statisticalCompatibility.effectiveTrainingPolicyId,
      sourceHistoryFingerprint: input.sourceHistoryFingerprint,
      contractVersion: input.payload.contractVersion,
      status: input.payload.status,
      reasonCode: input.payload.status === 'AVAILABLE' ? null : input.payload.reasonCode,
      message: input.payload.status === 'AVAILABLE' ? null : input.payload.message,
      forecastOriginAt: input.forecastOriginAt,
      sourceLatestObservationAt: input.sourceLatestObservationAt,
      payloadJson: input.payload as unknown as Prisma.InputJsonValue,
    },
    update: {
      inputRunId: null,
      trainingWindowPolicyId: input.statisticalCompatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: input.statisticalCompatibility.effectiveTrainingPolicyId,
      sourceHistoryFingerprint: input.sourceHistoryFingerprint,
      contractVersion: input.payload.contractVersion,
      status: input.payload.status,
      reasonCode: input.payload.status === 'AVAILABLE' ? null : input.payload.reasonCode,
      message: input.payload.status === 'AVAILABLE' ? null : input.payload.message,
      forecastOriginAt: input.forecastOriginAt,
      sourceLatestObservationAt: input.sourceLatestObservationAt,
      payloadJson: input.payload as unknown as Prisma.InputJsonValue,
    },
  })
}

export type RollingDailyCurrentForecastSnapshotReadRequest = {
  seriesId: string
  modelId: RollingDailyCurrentForecastSnapshotModelId
  sourceHistoryFingerprint: string
}

export type RollingDailyCurrentForecastSnapshotReadResult =
  | {
      status: 'HIT'
      payload: RollingDailyProductionForecastResult
    }
  | {
      status: 'MISS'
    }
  | {
      status: 'STALE'
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH'
      payload: RollingDailyProductionForecastResult
    }

const SNAPSHOT_NUMERIC_PARITY_EPSILON = 1e-9

function resolveRollingDailyCurrentSnapshotCompatibility(): ForecastStatisticalCompatibility {
  return createCurrentForecastStatisticalCompatibility({
    sourceFrequency: 'DAILY',
    targetCadence: 'DAILY',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
  })
}

function toDateFromCalendarValue(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function assertRollingDailyProductionMethod(result: ProductionForecastResult): asserts result is ProductionForecastResult & { productionMethod: 'ROLLING_DAILY_POINT_IN_TIME' } {
  if (result.productionMethod !== 'ROLLING_DAILY_POINT_IN_TIME') {
    throw new Error(`Expected ROLLING_DAILY_POINT_IN_TIME production method, received ${result.productionMethod}.`)
  }
}

function toSnapshotPayload(result: ProductionForecastResult): RollingDailyProductionForecastResult {
  assertRollingDailyProductionMethod(result)
  const { productionMethod: _ignored, ...payload } = result
  return RollingDailyProductionForecastResultSchema.parse(payload)
}

function areSnapshotPayloadsEquivalent(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) <= SNAPSHOT_NUMERIC_PARITY_EPSILON
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => areSnapshotPayloadsEquivalent(value, right[index]))
  }

  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left as Record<string, unknown>).sort()
    const rightKeys = Object.keys(right as Record<string, unknown>).sort()

    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    return leftKeys.every((key, index) => key === rightKeys[index] && areSnapshotPayloadsEquivalent(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
    ))
  }

  return Object.is(left, right)
}

function getSnapshotPrismaClient(dependencies: SnapshotPersistenceDependencies) {
  const prisma = dependencies.prisma ?? getMarketDataPrisma()

  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  return prisma
}

export async function persistRollingDailyCurrentForecastSnapshot(
  request: RollingDailyCurrentForecastSnapshotRequest,
  dependencies: SnapshotPersistenceDependencies = {},
): Promise<RollingDailyCurrentForecastSnapshotPersistenceResult> {
  const resolveProductionForecast = dependencies.resolveProductionForecast
    ?? (await import('@/lib/forecast/production-routing')).resolveProductionForecast
  const result = await resolveProductionForecast({
    ...request,
    forecastMethod: 'ROLLING_DAILY_POINT_IN_TIME',
  })
  return persistResolvedRollingDailyCurrentForecastSnapshot(request, result, dependencies)
}

export async function persistResolvedRollingDailyCurrentForecastSnapshot(
  request: RollingDailyCurrentForecastSnapshotRequest,
  result: ProductionForecastResult,
  dependencies: Pick<SnapshotPersistenceDependencies, 'prisma'> = {},
  options: RollingDailySnapshotPersistenceOptions = {},
): Promise<RollingDailyCurrentForecastSnapshotPersistenceResult> {
  const prisma = getSnapshotPrismaClient(dependencies)
  const payload = toSnapshotPayload(result)
  const inputSource = payload.audit.inputSource ?? ROLLING_DAILY_INPUT_SOURCE
  const statisticalCompatibility = resolveRollingDailyCurrentSnapshotCompatibility()
  const sourceHistoryFingerprint = payload.audit.sourceHistoryFingerprint
  if (!sourceHistoryFingerprint) {
    throw new Error(`Rolling Daily snapshot persistence requires a source history fingerprint for ${request.seriesId}/${request.modelId}.`)
  }
  const forecastOriginAt = payload.status === 'AVAILABLE' ? toDateFromCalendarValue(payload.origin.date) : null
  const sourceLatestObservationAt = toDateFromCalendarValue(payload.audit.sourceLatestObservationDate)

  const observedAt = new Date().toISOString()
  const shouldFenceOwnership = options.ownership
    ? await hasForecastPreparationExecutionLedgerRelation(prisma)
    : false
  const upsertInput = {
    request,
    inputSource,
    statisticalCompatibility,
    sourceHistoryFingerprint,
    payload,
    forecastOriginAt,
    sourceLatestObservationAt,
  }

  const persisted = shouldFenceOwnership && '$transaction' in prisma && typeof prisma.$transaction === 'function'
    ? await prisma.$transaction(async (tx) => {
      const ownership = options.ownership as ForecastPersistenceOwnership
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
        if (!isMissingExecutionLedgerRelationError(error)) {
          throw error
        }
      }

      return upsertRollingDailyCurrentForecastSnapshot(tx as MarketDataPrismaClient, upsertInput)
    })
    : await upsertRollingDailyCurrentForecastSnapshot(prisma, upsertInput)

  const persistedPayload = RollingDailyProductionForecastResultSchema.parse(persisted.payloadJson as unknown)
  if (!areSnapshotPayloadsEquivalent(persistedPayload, payload)) {
    throw new Error(`Persisted rolling-daily snapshot parity failed for ${request.seriesId}/${request.modelId}.`)
  }

  return {
    seriesId: request.seriesId,
    modelId: request.modelId,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: payload.forecastMethod.version || ROLLING_DAILY_METHOD_VERSION,
    contractVersion: payload.contractVersion,
    status: payload.status,
    reasonCode: payload.status === 'AVAILABLE' ? null : payload.reasonCode,
    parityStatus: 'MATCHED',
  }
}

export async function persistRollingDailyCurrentForecastSnapshots(
  seriesId: string,
  modelIds: readonly RollingDailyCurrentForecastSnapshotModelId[],
  dependencies: SnapshotPersistenceDependencies = {},
) {
  const results: RollingDailyCurrentForecastSnapshotPersistenceResult[] = []

  for (const modelId of modelIds) {
    results.push(await persistRollingDailyCurrentForecastSnapshot({ seriesId, modelId }, dependencies))
  }

  return results
}

export async function readRollingDailyCurrentForecastSnapshot(
  request: RollingDailyCurrentForecastSnapshotReadRequest,
  dependencies: { prisma?: MarketDataPrismaClient } = {},
): Promise<RollingDailyCurrentForecastSnapshotReadResult> {
  const prisma = getSnapshotPrismaClient(dependencies)
  const statisticalCompatibility = resolveRollingDailyCurrentSnapshotCompatibility()

  const snapshot = await prisma.rollingDailyCurrentForecastSnapshot.findUnique({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint: {
        seriesId: request.seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: request.modelId,
        trainingWindowPolicyId: statisticalCompatibility.trainingWindowPolicyId,
        effectiveTrainingPolicyId: statisticalCompatibility.effectiveTrainingPolicyId,
        sourceHistoryFingerprint: request.sourceHistoryFingerprint,
      },
    },
  })

  if (!snapshot) {
    const legacySnapshot = await prisma.rollingDailyCurrentForecastSnapshot.findFirst({
      where: {
        seriesId: request.seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: request.modelId,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!legacySnapshot) {
      return { status: 'MISS' }
    }

    const payload = RollingDailyProductionForecastResultSchema.parse(legacySnapshot.payloadJson as unknown)
    const persistedFingerprint = payload.audit.sourceHistoryFingerprint

    if (!persistedFingerprint) {
      return {
        status: 'STALE',
        reason: 'SOURCE_HISTORY_FINGERPRINT_MISSING',
        payload,
      }
    }

    return {
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
      payload,
    }
  }

  const payload = RollingDailyProductionForecastResultSchema.parse(snapshot.payloadJson as unknown)

  return {
    status: 'HIT',
    payload,
  }
}