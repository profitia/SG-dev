import './load-env'

import { writeFile } from 'node:fs/promises'

import { getMarketDataPrisma } from '@/lib/market-data/client'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'
import type { ForecastTargetBasis } from '@/lib/forecast/contracts'
import {
  buildRollingDailyHistoryFingerprint,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
} from '@/lib/forecast/rolling-daily-maintenance'
import { ROLLING_DAILY_TARGET_BASIS } from '@/lib/forecast/rolling-daily-policy'

const DEFAULT_SERIES_ID = 'wocaes0074'
const MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const

type Stage9ContextIdentity = {
  seriesId: string
  inputSource: string
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: (typeof MODELS)[number]
}

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function toDateString(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return value
  }

  return Number(value)
}

async function main() {
  const seriesId = readArg('seriesId') || DEFAULT_SERIES_ID
  const outputPath = readArg('outputJson')
  if (!outputPath) {
    throw new Error('Missing required argument --outputJson=...')
  }

  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const { history } = await resolveBenchmarkHistoricalSeries(seriesId, 'ALL')
  const lawfulPoints = history.historical.filter((point) => point.value !== null)
  const historyPayload = {
    seriesId: history.providerSeries.providerSeriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: history.frequency ?? 'DAILY',
    source: history.source,
    points: history.historical.map((point) => ({
      date: point.date,
      value: point.value,
    })),
  }
  const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint(historyPayload)

  const output: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    identity: {
      seriesId,
      displayName: history.displayName,
      forecastMethod: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      models: [...MODELS],
    },
    history: historyPayload,
    sourceSummary: {
      latestLawfulObservationDate: lawfulPoints.at(-1)?.date ?? null,
      previousLawfulObservationDate: lawfulPoints.at(-2)?.date ?? null,
      lawfulObservationCount: lawfulPoints.length,
      totalReturnedPoints: history.historical.length,
      nullPlaceholders: history.historical.filter((point) => point.value === null).length,
      sourceHistoryFingerprint,
    },
    models: {},
  }

  for (const modelId of MODELS) {
    const identity: Stage9ContextIdentity = {
      seriesId,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId,
    }

    const [state, snapshot, verificationRecords, calibrationGroups] = await Promise.all([
      prisma.rollingDailyMaintenanceState.findUnique({
        where: {
          seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: identity,
        },
      }),
      prisma.rollingDailyCurrentForecastSnapshot.findUnique({
        where: {
          seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: identity,
        },
      }),
      prisma.rollingDailyVerificationRecord.findMany({
        where: identity,
        orderBy: [{ forecastOriginAt: 'asc' }, { horizonMonths: 'asc' }],
      }),
      prisma.rollingDailyCalibrationGroup.findMany({
        where: identity,
        orderBy: [{ horizonMonths: 'asc' }],
      }),
    ])

    const verificationSummary = {
      total: verificationRecords.length,
      matured: verificationRecords.filter((record) => record.maturityStatus === 'MATURED').length,
      immature: verificationRecords.filter((record) => record.maturityStatus === 'NOT_YET_MATURED').length,
    }

    ;(output.models as Record<string, unknown>)[modelId] = {
      state: state ? {
        latestSourceObservationAt: toDateString(state.latestSourceObservationAt),
        latestSourceHistoryStartAt: toDateString(state.latestSourceHistoryStartAt),
        latestSourceObservationCount: state.latestSourceObservationCount,
        latestSourceHistoryFingerprint: state.latestSourceHistoryFingerprint,
        lastProcessedOriginAt: toDateString(state.lastProcessedOriginAt),
        lastMaturedObservedAt: toDateString(state.lastMaturedObservedAt),
        lastMaintenanceStatus: state.lastMaintenanceStatus,
        lastFailureReason: state.lastFailureReason,
        historicalOriginStartAt: toDateString(state.historicalOriginStartAt),
        minimumTrainingObservations: state.minimumTrainingObservations,
        minimumCalibrationSamples: state.minimumCalibrationSamples,
      } : null,
      snapshot: snapshot ? {
        status: snapshot.status,
        forecastOriginAt: toDateString(snapshot.forecastOriginAt),
        sourceLatestObservationAt: toDateString(snapshot.sourceLatestObservationAt),
        contractVersion: snapshot.contractVersion,
        reasonCode: snapshot.reasonCode,
        payloadModelId: (snapshot.payloadJson as Record<string, unknown> | null)?.model && typeof (snapshot.payloadJson as Record<string, unknown>).model === 'object'
          ? ((snapshot.payloadJson as { model?: { id?: string } }).model?.id ?? null)
          : null,
        payloadMethodVersion: (snapshot.payloadJson as { forecastMethod?: { version?: string } } | null)?.forecastMethod?.version ?? null,
        payloadSourceHistoryFingerprint: (snapshot.payloadJson as { audit?: { sourceHistoryFingerprint?: string | null } } | null)?.audit?.sourceHistoryFingerprint ?? null,
      } : null,
      verificationSummary,
      verificationRecords: verificationRecords.map((record) => ({
        seriesId: record.seriesId,
        inputSource: record.inputSource,
        inputRunId: record.inputRunId,
        targetBasis: record.targetBasis,
        methodId: record.methodId,
        methodVersion: record.methodVersion,
        modelId: record.modelId,
        forecastOriginAt: record.forecastOriginAt.toISOString().slice(0, 10),
        horizonLabel: record.horizonLabel,
        horizonMonths: record.horizonMonths,
        horizonSteps: record.horizonSteps,
        targetCalendarDate: record.targetCalendarDate.toISOString().slice(0, 10),
        verificationObservedAt: toDateString(record.verificationObservedAt),
        maturityStatus: record.maturityStatus,
        originValue: toNumber(record.originValue),
        forecastValue: toNumber(record.forecastValue),
        actualValue: toNumber(record.actualValue),
        errorValue: toNumber(record.errorValue),
        absoluteErrorValue: toNumber(record.absoluteErrorValue),
        deltaValue: toNumber(record.deltaValue),
        deltaPct: record.deltaPct,
        residualValue: toNumber(record.residualValue),
        maseScale: record.maseScale,
        trainingHistoryStartAt: toDateString(record.trainingHistoryStartAt),
        trainingHistoryEndAt: record.trainingHistoryEndAt.toISOString().slice(0, 10),
        trainingObservationCount: record.trainingObservationCount,
        sourceHistoryFingerprint: record.sourceHistoryFingerprint,
        metadata: record.metadataJson,
        selectedVariant: record.selectedVariant,
        selectionMetric: record.selectionMetric,
        selectionScore: record.selectionScore,
      })),
      calibrationGroups: calibrationGroups.map((group) => ({
        seriesId: group.seriesId,
        inputSource: group.inputSource,
        inputRunId: group.inputRunId,
        targetBasis: group.targetBasis,
        methodId: group.methodId,
        methodVersion: group.methodVersion,
        modelId: group.modelId,
        horizonLabel: group.horizonLabel,
        horizonMonths: group.horizonMonths,
        calibrationOriginAt: toDateString(group.calibrationOriginAt),
        sampleCount: group.sampleCount,
        residualP10: toNumber(group.residualP10),
        residualP90: toNumber(group.residualP90),
        quantileMethod: group.quantileMethod,
        status: group.status,
        lastResidualObservedAt: toDateString(group.lastResidualObservedAt),
        refreshedAt: toDateString(group.refreshedAt),
      })),
    }
  }

  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ status: 'SUCCEEDED', outputPath }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})