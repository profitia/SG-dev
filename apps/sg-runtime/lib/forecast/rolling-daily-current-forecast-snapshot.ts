import { Prisma, type PrismaClient } from '@/generated/market-data-client'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import type { ProductionForecastResult } from '@/lib/forecast/production-routing'
import {
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  type RollingDailyHistoryPayload,
} from '@/lib/forecast/rolling-daily-maintenance'
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
): Promise<RollingDailyCurrentForecastSnapshotPersistenceResult> {
  const prisma = getSnapshotPrismaClient(dependencies)
  const payload = toSnapshotPayload(result)
  const inputSource = payload.audit.inputSource ?? ROLLING_DAILY_INPUT_SOURCE
  const forecastOriginAt = payload.status === 'AVAILABLE' ? toDateFromCalendarValue(payload.origin.date) : null
  const sourceLatestObservationAt = toDateFromCalendarValue(payload.audit.sourceLatestObservationDate)

  const persisted = await prisma.rollingDailyCurrentForecastSnapshot.upsert({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: {
        seriesId: request.seriesId,
        inputSource,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: payload.forecastMethod.version,
        modelId: request.modelId,
      },
    },
    create: {
      seriesId: request.seriesId,
      inputSource,
      inputRunId: null,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: payload.forecastMethod.version,
      modelId: request.modelId,
      contractVersion: payload.contractVersion,
      status: payload.status,
      reasonCode: payload.status === 'AVAILABLE' ? null : payload.reasonCode,
      message: payload.status === 'AVAILABLE' ? null : payload.message,
      forecastOriginAt,
      sourceLatestObservationAt,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
    },
    update: {
      inputRunId: null,
      contractVersion: payload.contractVersion,
      status: payload.status,
      reasonCode: payload.status === 'AVAILABLE' ? null : payload.reasonCode,
      message: payload.status === 'AVAILABLE' ? null : payload.message,
      forecastOriginAt,
      sourceLatestObservationAt,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
    },
  })

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

  const snapshot = await prisma.rollingDailyCurrentForecastSnapshot.findUnique({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: {
        seriesId: request.seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: request.modelId,
      },
    },
  })

  if (!snapshot) {
    return { status: 'MISS' }
  }

  const payload = RollingDailyProductionForecastResultSchema.parse(snapshot.payloadJson as unknown)
  const persistedFingerprint = payload.audit.sourceHistoryFingerprint

  if (!persistedFingerprint) {
    return {
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISSING',
      payload,
    }
  }

  if (persistedFingerprint !== request.sourceHistoryFingerprint) {
    return {
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
      payload,
    }
  }

  return {
    status: 'HIT',
    payload,
  }
}