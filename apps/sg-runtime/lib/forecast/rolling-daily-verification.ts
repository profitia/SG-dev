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
  resolveHistoricalVerificationSummary,
} from '@/lib/forecast/historical-verification-policy'

const ROLLING_DAILY_METHOD_ID = 'ROLLING_DAILY_POINT_IN_TIME'
const ROLLING_DAILY_METHOD_VERSION = 'rolling-daily-point-in-time-v1'

type MarketDataPrismaClient = NonNullable<ReturnType<typeof getMarketDataPrisma>>

export type PreparedRollingDailyForecastVerificationDependencies = {
  prisma?: Pick<MarketDataPrismaClient, 'rollingDailyVerificationRecord' | 'rollingDailyMaintenanceState'>
  resolveHistory?: typeof resolveBenchmarkHistoricalSeries
  emitPreparedRead?: typeof forecastStressTelemetry.emit
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
  scope: 'FULL' | 'RECENT',
  dependencies: PreparedRollingDailyForecastVerificationDependencies = {},
) {
  return async function readPreparedRollingDailyForecastVerification(
    input: ForecastRequestInput,
  ): Promise<BenchmarkForecastVerificationResult> {
    const prisma = dependencies.prisma ?? getMarketDataPrisma()
    if (!prisma) throw new Error('Forecast library datastore is unavailable.')
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
    const persistedRecords = await prisma.rollingDailyVerificationRecord.findMany({
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

    const maintenanceState = await prisma.rollingDailyMaintenanceState.findUnique({
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
    const prepared = scope === 'FULL' ? fullPrepared : recentPrepared

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
        reason: records.length === 0
          ? `PREPARATION_REQUIRED: No exact-identity prepared Rolling Daily ${scope === 'FULL' ? 'Historical' : 'Recent'} Verification is available.`
          : `PREPARATION_REQUIRED: Prepared Rolling Daily ${scope === 'FULL' ? 'Historical Verification is incomplete' : 'Recent Verification is not ready'} for the latest lawful source observation.`,
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
        metrics: null,
        records: persistedRecords,
        failures: [],
      }]
    }))
    const latestRecord = records.reduce((latest, record) => (
      record.forecastOriginAt > latest.forecastOriginAt ? record : latest
    ))
    const historyStart = records.reduce<Date | null>((earliest, record) => {
      if (!record.trainingHistoryStartAt) return earliest
      return !earliest || record.trainingHistoryStartAt < earliest ? record.trainingHistoryStartAt : earliest
    }, null)
    const statisticalCompatibility = (scope === 'FULL'
      ? createFullVerificationStatisticalCompatibility
      : createRecentVerificationStatisticalCompatibility)({
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
      historicalVerification: resolveHistoricalVerificationSummary(verification),
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

const defaultPreparedRollingDailyForecastVerificationReader = createPreparedRollingDailyForecastVerificationReader()
const defaultPreparedRollingDailyRecentForecastVerificationReader = createPreparedRollingDailyRecentForecastVerificationReader()

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
