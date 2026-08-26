import type {
  BenchmarkForecastVerificationResult,
  ForecastSelectionMetadata,
  ForecastVerificationHorizon,
  ForecastVerificationRecord,
} from '@/lib/forecast/contracts'
import type { ForecastRequestInput } from '@/lib/forecast/request-contract'
import { buildRollingDailyHistoryFingerprint, ROLLING_DAILY_INPUT_SOURCE } from '@/lib/forecast/rolling-daily-maintenance'
import { forecastStressTelemetry } from '@/lib/forecast/stress-telemetry'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'

const ROLLING_DAILY_METHOD_ID = 'ROLLING_DAILY_POINT_IN_TIME'
const ROLLING_DAILY_METHOD_VERSION = 'rolling-daily-point-in-time-v1'

function asNumber(value: { toString(): string } | number | null) {
  return value === null ? null : Number(value)
}

export async function readPreparedRollingDailyForecastVerification(
  input: ForecastRequestInput,
): Promise<BenchmarkForecastVerificationResult> {
  const prisma = getMarketDataPrisma()
  if (!prisma) throw new Error('Forecast library datastore is unavailable.')

  const { history } = await resolveBenchmarkHistoricalSeries(input.seriesId, 'ALL')
  const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: input.seriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.historical,
  })
  const records = await prisma.rollingDailyVerificationRecord.findMany({
    where: {
      seriesId: input.seriesId,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: 'POINT_IN_TIME',
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId: input.modelId,
      sourceHistoryFingerprint,
    },
    orderBy: [{ horizonMonths: 'asc' }, { targetCalendarDate: 'asc' }, { forecastOriginAt: 'asc' }],
  })

  forecastStressTelemetry.emit('prepared_read', {
    kind: 'verification',
    store: 'rolling_daily_verification_records',
    hit: records.length > 0,
    stale: false,
  })

  if (records.length === 0) {
    return {
      status: 'NOT_AVAILABLE',
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: ROLLING_DAILY_METHOD_ID,
      reason: 'PREPARATION_REQUIRED: No exact-identity prepared Rolling Daily Historical Verification is available.',
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
    const expectedOrigins = horizonRecords.length
    const successfulOrigins = persistedRecords.length
    return [horizonLabel, {
      horizon: horizonLabel,
      horizonSteps: horizonRecords[0]?.horizonSteps ?? 0,
      origins: successfulOrigins,
      expectedOrigins,
      successfulOrigins,
      failedOrigins: 0,
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
  }
}