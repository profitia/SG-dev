import type {Prisma} from '@/generated/market-data-client'
import type {
  BenchmarkForecastVerificationResult,
  ForecastSelectionMetadata,
  ForecastVerificationHorizon,
  ForecastVerificationRecord,
} from '@/lib/forecast/contracts'
import {
  createFullVerificationStatisticalCompatibility,
  createRecentVerificationStatisticalCompatibility,
} from '@/lib/forecast/identity'
import type { ForecastRequestInput } from '@/lib/forecast/request-contract'
import {
  buildRollingDailyHistoryFingerprint,
  filterRollingDailyVerificationRecordsCompatibleWithHistory,
  isRollingDailyHistoricalPreparationComplete,
  ROLLING_DAILY_INPUT_SOURCE,
} from '@/lib/forecast/rolling-daily-maintenance'
import { forecastStressTelemetry } from '@/lib/forecast/stress-telemetry'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'
import {
  createUnavailableHistoricalVerificationSummary,
  isFastHistoricalVerificationReady,
  resolveHistoricalVerificationSummary,
} from '@/lib/forecast/historical-verification-policy'
import { calculateForecastVerificationMetrics } from '@/lib/forecast/verification-metrics'

const ROLLING_DAILY_METHOD_ID = 'ROLLING_DAILY_POINT_IN_TIME'
const ROLLING_DAILY_METHOD_VERSION = 'rolling-daily-point-in-time-v1'

type MarketDataPrismaClient = NonNullable<ReturnType<typeof getMarketDataPrisma>>

export type PreparedRollingDailyForecastVerificationDependencies = (
  | {prisma?:PreparedRollingDailyVerificationReadClient;projection?:never}
  | {prisma:Prisma.TransactionClient;projection:'STORED_SHARED';storedSource?:StoredRollingDailyVerificationSource}
) & {
  resolveHistory?: typeof resolveBenchmarkHistoricalSeries
  emitPreparedRead?: typeof forecastStressTelemetry.emit
}

export type PreparedRollingDailyVerificationReadClient = {
  readonly rollingDailyVerificationRecord: Pick<MarketDataPrismaClient['rollingDailyVerificationRecord'], 'findMany'>
  readonly rollingDailyMaintenanceState: Pick<MarketDataPrismaClient['rollingDailyMaintenanceState'], 'findUnique'>
}

type StoredRollingSelection = Pick<ForecastRequestInput, 'seriesId' | 'modelId'>
type StoredRollingMaintenance = {
  latestSourceHistoryFingerprint: string | null
  latestSourceObservationAt: Date | null
  lastProcessedOriginAt: Date | null
  lastMaintenanceStatus: string | null
}
export type StoredRollingDailyVerificationSource = Readonly<{
  readRecords: (input: StoredRollingSelection) => Promise<Prisma.RollingDailyVerificationRecordGetPayload<{}>[]>
  readMaintenance: (input: StoredRollingSelection) => Promise<StoredRollingMaintenance | null>
}>
const sourceTransactions = new WeakMap<StoredRollingDailyVerificationSource, Prisma.TransactionClient>()

/** Share stored source facts only within one genuine source transaction. The
 * three scientific scopes still independently apply their original policies.
 * No identity, permission, decision or result survives the operation. */
export function createStoredRollingDailyVerificationSource(transaction: Prisma.TransactionClient): StoredRollingDailyVerificationSource {
  if (!transaction || '$transaction' in transaction || typeof transaction.$queryRawUnsafe !== 'function'
    || typeof transaction.$executeRawUnsafe !== 'function') throw new TypeError('A live Rolling projection transaction is required')
  const records = new Map<string, Promise<Prisma.RollingDailyVerificationRecordGetPayload<{}>[]>>()
  const maintenance = new Map<string, Promise<StoredRollingMaintenance | null>>()
  const key = (input: StoredRollingSelection) => {
    if (!/^[a-z0-9_./-]{1,256}$/i.test(input.seriesId) || !['naive','damped_holt','ets','arima'].includes(input.modelId))
      throw new TypeError('Explicit stored Rolling selection required')
    return JSON.stringify([input.seriesId, input.modelId])
  }
  const values = (input: StoredRollingSelection) => [input.seriesId, ROLLING_DAILY_INPUT_SOURCE, 'POINT_IN_TIME',
    ROLLING_DAILY_METHOD_ID, ROLLING_DAILY_METHOD_VERSION, input.modelId]
  const source: StoredRollingDailyVerificationSource = Object.freeze({
    readRecords(input) {
      const selected = key(input)
      let result = records.get(selected)
      if (!result) {
        result = transaction.$queryRawUnsafe<Prisma.RollingDailyVerificationRecordGetPayload<{}>[]>(`SELECT
          id,"seriesId","inputSource","inputRunId","targetBasis"::text AS "targetBasis","methodId","methodVersion","modelId","forecastOriginAt",
          "horizonLabel","horizonMonths","horizonSteps","targetCalendarDate","verificationObservedAt","maturityStatus"::text AS "maturityStatus",
          "originValue","forecastValue","actualValue","errorValue","absoluteErrorValue","deltaValue","deltaPct","residualValue","maseScale",
          "trainingHistoryStartAt","trainingHistoryEndAt","trainingObservationCount","sourceHistoryFingerprint","selectedVariant","selectionMetric",
          "selectionScore","metadataJson","createdAt","updatedAt"
          FROM profitia_forecast_read.rolling_daily_verification_records WHERE "seriesId"=$1 AND "inputSource"=$2 AND "targetBasis"::text=$3
            AND "methodId"=$4 AND "methodVersion"=$5 AND "modelId"=$6 ORDER BY "horizonMonths","targetCalendarDate","forecastOriginAt"`, ...values(input)).then(rows => rows)
        records.set(selected, result)
      }
      return result
    },
    readMaintenance(input) {
      const selected = key(input)
      let result = maintenance.get(selected)
      if (!result) {
        result = transaction.$queryRawUnsafe<StoredRollingMaintenance[]>(
          `SELECT "latestSourceHistoryFingerprint","latestSourceObservationAt","lastProcessedOriginAt","lastMaintenanceStatus"
            FROM profitia_forecast_read.rolling_daily_maintenance_state WHERE "seriesId"=$1 AND "inputSource"=$2 AND "targetBasis"::text=$3
              AND "methodId"=$4 AND "methodVersion"=$5 AND "modelId"=$6 LIMIT 2`, ...values(input))
          .then(rows => { if (rows.length > 1) throw new Error('Stored Rolling identity is not unique'); return rows[0] ?? null })
        maintenance.set(selected, result)
      }
      return result
    },
  })
  sourceTransactions.set(source, transaction)
  return source
}

function asNumber(value: { toString(): string } | number | null) {
  return value === null ? null : Number(value)
}

function asIsoString(value: Date | string | null) {
  if (value === null) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
}

function normalizeDailyObservationDay(value: Date | string) {
  return asIsoString(value)?.slice(0, 10) ?? ''
}

function subtractCalendarMonthsClamped(value: string, months: number) {
  const date = new Date(`${normalizeDailyObservationDay(value)}T00:00:00.000Z`)
  const originalDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(originalDay, lastDay))
  return date.toISOString().slice(0, 10)
}

function createPreparedRollingDailyForecastVerificationReaderForScope(
  scope: 'FULL' | 'FAST' | 'RECENT',
  dependencies: PreparedRollingDailyForecastVerificationDependencies = {},
) {
  return async function readPreparedRollingDailyForecastVerification(
    input: ForecastRequestInput,
  ): Promise<BenchmarkForecastVerificationResult> {
    const projection=dependencies?.projection==='STORED_SHARED'?dependencies.prisma:null
    if(dependencies?.projection!==undefined&&(dependencies.projection!=='STORED_SHARED'||!projection||'$transaction' in projection
      ||typeof projection.$queryRawUnsafe!=='function'||typeof projection.$executeRawUnsafe!=='function'))throw new TypeError('A live Rolling projection transaction is required')
    const storedSource = dependencies?.projection === 'STORED_SHARED' ? dependencies.storedSource : undefined
    if (storedSource && sourceTransactions.get(storedSource) !== projection) throw new TypeError('Stored Rolling source transaction mismatch')
    const projectedSource = projection ? storedSource ?? createStoredRollingDailyVerificationSource(projection) : null
    const explicitPrisma = dependencies == null || Object.prototype.hasOwnProperty.call(dependencies, 'prisma')
    const prisma = explicitPrisma ? dependencies?.prisma : getMarketDataPrisma()
    if (!prisma
      || typeof prisma.rollingDailyVerificationRecord?.findMany !== 'function'
      || typeof prisma.rollingDailyMaintenanceState?.findUnique !== 'function') {
      throw new Error('Forecast library datastore is unavailable.')
    }
    const resolveHistory = dependencies.resolveHistory ?? resolveBenchmarkHistoricalSeries
    const emitPreparedRead = dependencies.emitPreparedRead ?? forecastStressTelemetry.emit.bind(forecastStressTelemetry)

    const { history } = await resolveHistory(input.seriesId, 'ALL')
    const rollingDailyHistory = {
      seriesId: input.seriesId,
      displayName: history.displayName,
      description: history.displayName,
      frequency: 'DAILY',
      source: history.source,
      points: history.historical,
    }
    const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint(rollingDailyHistory)
    const persistedRecords = projectedSource ? await projectedSource.readRecords(input)
      : await prisma.rollingDailyVerificationRecord.findMany({
      where: {
        seriesId: input.seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: 'POINT_IN_TIME',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: input.modelId,
      },
      orderBy: [{ horizonMonths: 'asc' }, { targetCalendarDate: 'asc' }, { forecastOriginAt: 'asc' }],
    })
    const records = filterRollingDailyVerificationRecordsCompatibleWithHistory(
      persistedRecords,
      rollingDailyHistory,
      sourceHistoryFingerprint,
    )

    const maintenanceState = projectedSource ? await projectedSource.readMaintenance(input) : await prisma.rollingDailyMaintenanceState.findUnique({
      where: {
        seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: {
          seriesId: input.seriesId,
          inputSource: ROLLING_DAILY_INPUT_SOURCE,
          targetBasis: 'POINT_IN_TIME',
          methodId: ROLLING_DAILY_METHOD_ID,
          methodVersion: ROLLING_DAILY_METHOD_VERSION,
          modelId: input.modelId,
        },
      },
      select: {
        latestSourceHistoryFingerprint: true,
        latestSourceObservationAt: true,
        lastProcessedOriginAt: true,
        lastMaintenanceStatus: true,
      },
    })

    const fullPrepared = isRollingDailyHistoricalPreparationComplete({
      state: maintenanceState
        ? {
            latestSourceHistoryFingerprint: maintenanceState.latestSourceHistoryFingerprint,
            latestSourceObservationAt: asIsoString(maintenanceState.latestSourceObservationAt),
            lastProcessedOriginAt: asIsoString(maintenanceState.lastProcessedOriginAt),
            lastMaintenanceStatus: maintenanceState.lastMaintenanceStatus,
          }
        : null,
      expectedSourceHistoryFingerprint: sourceHistoryFingerprint,
      latestSourceObservationDate: history.historical[history.historical.length - 1]?.date ?? null,
      verificationRecordCount: records.length,
    })
    const latestSourceObservationDate = history.historical[history.historical.length - 1]?.date ?? null
    const earliestSourceObservationDate = history.historical[0]?.date ?? null
    const recentPrepared = Boolean(
      records.length > 0
      && maintenanceState
      && (maintenanceState.lastMaintenanceStatus === 'SUCCEEDED' || maintenanceState.lastMaintenanceStatus === 'NO_OP')
      && maintenanceState.latestSourceHistoryFingerprint === sourceHistoryFingerprint
      && latestSourceObservationDate
      && maintenanceState.latestSourceObservationAt
      && normalizeDailyObservationDay(maintenanceState.latestSourceObservationAt) === normalizeDailyObservationDay(latestSourceObservationDate)
      && earliestSourceObservationDate
      && history.historical.length >= 36
      && [1, 3, 6, 12]
        .filter((horizonMonths) => (
          normalizeDailyObservationDay(earliestSourceObservationDate)
          <= subtractCalendarMonthsClamped(latestSourceObservationDate, horizonMonths)
        ))
        .every((horizonMonths) => records.some((record) => {
          if (
            record.horizonMonths !== horizonMonths
            || record.maturityStatus !== 'MATURED'
            || record.actualValue === null
            || !record.verificationObservedAt
          ) {
            return false
          }
          const lagDays = (
            new Date(`${normalizeDailyObservationDay(latestSourceObservationDate)}T00:00:00.000Z`).getTime()
            - new Date(`${normalizeDailyObservationDay(record.verificationObservedAt)}T00:00:00.000Z`).getTime()
          ) / (24 * 60 * 60 * 1000)
          return lagDays >= 0 && lagDays <= 7
        })),
    )
    const latestSourceReady = Boolean(
      records.length > 0
      && maintenanceState
      && (maintenanceState.lastMaintenanceStatus === 'SUCCEEDED' || maintenanceState.lastMaintenanceStatus === 'NO_OP')
      && maintenanceState.latestSourceHistoryFingerprint === sourceHistoryFingerprint
      && latestSourceObservationDate
      && maintenanceState.latestSourceObservationAt
      && normalizeDailyObservationDay(maintenanceState.latestSourceObservationAt) === normalizeDailyObservationDay(latestSourceObservationDate),
    )
    const preliminaryPrepared = scope === 'FULL'
      ? fullPrepared
      : scope === 'RECENT'
        ? recentPrepared
        : latestSourceReady

    if (!preliminaryPrepared) {
      emitPreparedRead('prepared_read', {
        kind: 'verification',
        store: 'rolling_daily_verification_records',
        hit: false,
        stale: records.length > 0,
      })
      return {
        status: 'NOT_AVAILABLE',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: 'POINT_IN_TIME',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        methodId: ROLLING_DAILY_METHOD_ID,
        reason: records.length === 0
          ? `PREPARATION_REQUIRED: No exact-identity prepared Rolling Daily ${scope === 'RECENT' ? 'Recent' : scope === 'FAST' ? 'Fast Historical' : 'Historical'} Verification is available.`
          : `PREPARATION_REQUIRED: Prepared Rolling Daily ${scope === 'RECENT' ? 'Recent Verification is not ready' : scope === 'FAST' ? 'Fast Historical Verification is not ready' : 'Historical Verification is incomplete'} for the latest lawful source observation.`,
        historicalVerification: createUnavailableHistoricalVerificationSummary('NOT_PREPARED'),
      }
    }

    const groupedRecords = records.reduce((groups, record) => {
      const group = groups.get(record.horizonLabel) ?? []
      group.push(record)
      groups.set(record.horizonLabel, group)
      return groups
    }, new Map<string, typeof records>())
    const verification = Object.fromEntries([...groupedRecords].map(([horizonLabel, horizonRecords]): [string, ForecastVerificationHorizon] => {
      const maturedRecords = horizonRecords.filter((record) => record.maturityStatus === 'MATURED' && record.actualValue !== null)
      const persistedRecords = maturedRecords.map((record): ForecastVerificationRecord => ({
        benchmarkId: record.seriesId,
        modelId: record.modelId,
        forecastOrigin: record.forecastOriginAt.toISOString(),
        horizon: record.horizonLabel,
        horizonSteps: record.horizonSteps,
        forecastDate: record.targetCalendarDate.toISOString(),
        actualObservedAt: record.verificationObservedAt?.toISOString() ?? null,
        originValue: asNumber(record.originValue) ?? 0,
        forecastValue: asNumber(record.forecastValue) ?? 0,
        actualValue: asNumber(record.actualValue) ?? 0,
        error: asNumber(record.errorValue) ?? 0,
        absoluteError: asNumber(record.absoluteErrorValue) ?? 0,
        delta: asNumber(record.deltaValue) ?? 0,
        deltaPct: record.deltaPct,
        maseScale: record.maseScale,
        metadata: record.metadataJson as ForecastSelectionMetadata | null,
      }))
      const expectedOrigins = maturedRecords.length
      const successfulOrigins = persistedRecords.length
      const pendingOrigins = horizonRecords.length - maturedRecords.length
      return [horizonLabel, {
        horizon: horizonLabel,
        horizonSteps: horizonRecords[0]?.horizonSteps ?? 0,
        origins: successfulOrigins,
        expectedOrigins,
        successfulOrigins,
        failedOrigins: 0,
        pendingOrigins,
        coverage: expectedOrigins > 0 ? successfulOrigins / expectedOrigins : 0,
        metrics: calculateForecastVerificationMetrics(persistedRecords),
        records: persistedRecords,
        failures: [],
      }]
    }))
    const prepared = scope !== 'FAST' || isFastHistoricalVerificationReady(verification)
    emitPreparedRead('prepared_read', {
      kind: 'verification',
      store: 'rolling_daily_verification_records',
      hit: prepared,
      stale: records.length > 0 && !prepared,
    })
    if (!prepared) {
      return {
        status: 'NOT_AVAILABLE',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: 'POINT_IN_TIME',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        methodId: ROLLING_DAILY_METHOD_ID,
        reason: 'PREPARATION_REQUIRED: Prepared Rolling Daily Fast Historical Verification has fewer than 24 lawful comparisons for one or more horizons.',
        historicalVerification: createUnavailableHistoricalVerificationSummary('NOT_PREPARED'),
      }
    }
    const latestRecord = records.reduce((latest, record) => (
      record.forecastOriginAt > latest.forecastOriginAt ? record : latest
    ))
    const historyStart = records.reduce<Date | null>((earliest, record) => {
      if (!record.trainingHistoryStartAt) return earliest
      return !earliest || record.trainingHistoryStartAt < earliest ? record.trainingHistoryStartAt : earliest
    }, null)
    const statisticalCompatibility = (scope === 'RECENT'
      ? createRecentVerificationStatisticalCompatibility
      : createFullVerificationStatisticalCompatibility)({
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    })

    return {
      status: 'AVAILABLE',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: ROLLING_DAILY_METHOD_ID,
      displayName: history.displayName,
      description: history.displayName,
      userFacingModel: true,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      source: { kind: latestRecord.inputSource, runId: latestRecord.inputRunId },
      lineage: {
        inputSource: latestRecord.inputSource,
        inputRunId: latestRecord.inputRunId,
        sourceSeriesId: input.seriesId,
        sourceFrequency: 'DAILY',
        historyFingerprint: sourceHistoryFingerprint,
        preparation: null,
        statisticalCompatibility,
      },
      historyFingerprint: sourceHistoryFingerprint,
      history: {
        frequency: 'DAILY',
        start: historyStart?.toISOString() ?? null,
        end: latestRecord.trainingHistoryEndAt.toISOString(),
        observations: latestRecord.trainingObservationCount,
      },
      forecastOrigin: latestRecord.forecastOriginAt.toISOString(),
      runtimeSeconds: null,
      cacheStatus: 'hit',
      verification,
      historicalVerification: resolveHistoricalVerificationSummary(verification, { fullHistoryReady: fullPrepared }),
    }
  }
}

export function createPreparedRollingDailyForecastVerificationReader(
  dependencies: PreparedRollingDailyForecastVerificationDependencies = {},
) {
  return createPreparedRollingDailyForecastVerificationReaderForScope('FULL', dependencies)
}

export function createPreparedRollingDailyRecentForecastVerificationReader(
  dependencies: PreparedRollingDailyForecastVerificationDependencies = {},
) {
  return createPreparedRollingDailyForecastVerificationReaderForScope('RECENT', dependencies)
}

export function createPreparedRollingDailyFastForecastVerificationReader(
  dependencies: PreparedRollingDailyForecastVerificationDependencies = {},
) {
  return createPreparedRollingDailyForecastVerificationReaderForScope('FAST', dependencies)
}

const defaultPreparedRollingDailyForecastVerificationReader = createPreparedRollingDailyForecastVerificationReader()
const defaultPreparedRollingDailyRecentForecastVerificationReader = createPreparedRollingDailyRecentForecastVerificationReader()
const defaultPreparedRollingDailyFastForecastVerificationReader = createPreparedRollingDailyFastForecastVerificationReader()

export async function readPreparedRollingDailyForecastVerification(
  input: ForecastRequestInput,
): Promise<BenchmarkForecastVerificationResult> {
  return defaultPreparedRollingDailyForecastVerificationReader(input)
}

export async function readPreparedRollingDailyRecentForecastVerification(
  input: ForecastRequestInput,
): Promise<BenchmarkForecastVerificationResult> {
  return defaultPreparedRollingDailyRecentForecastVerificationReader(input)
}

export async function readPreparedRollingDailyFastForecastVerification(
  input: ForecastRequestInput,
): Promise<BenchmarkForecastVerificationResult> {
  return defaultPreparedRollingDailyFastForecastVerificationReader(input)
}
