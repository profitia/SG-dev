import type {
  BenchmarkForecastCurrentResult,
  BenchmarkForecastCurrentAvailableResult,
  BenchmarkForecastVerificationResult,
  BenchmarkForecastVerificationAvailableResult,
  ForecastCurrentFreshness,
  ForecastCapabilityStatus,
  ForecastCurrentPoint,
  ForecastIdentity,
  ForecastMethodId,
  InteractiveForecastCapabilityResult,
  ForecastVerificationHorizon,
  ForecastVerificationRecord,
  ForecastTargetBasis,
  ForecastPortfolioModelId,
  ForecastTargetSemantics,
  RollingDailyProductionForecastResult,
} from './forecast-contract'
import { DEFAULT_FORECAST_TARGET_BASIS } from './forecast-contract'

import { getMarketDataPrismaClient } from '@/lib/db/market-data-prisma'
import { phase22cDiagnosticSpan } from '@/lib/phase-2-2c/diagnostics'

const LOCAL_SG_RUNTIME_BASE_URL = 'http://localhost:3001'
const INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH = '/api/internal/forecast/capability'
const INTERNAL_FORECAST_ROUTE_PATH = '/api/internal/forecast/production'
const INTERNAL_FORECAST_TIMEOUT_MS = 20_000
const ROLLING_DAILY_INPUT_SOURCE = 'DYNAMIC_MARKET_DATA_STORE'
const ROLLING_DAILY_METHOD_ID = 'ROLLING_DAILY_POINT_IN_TIME'
const ROLLING_DAILY_METHOD_VERSION = 'rolling-daily-point-in-time-v1'
const MONTHLY_METHOD_VERSION = 'benchmark-forecasting-mvp-phase2-v1'
const FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION = 'FORECAST_CADENCE_V1'
const FORECAST_CADENCES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'QUADMONTHLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const
const VALID_PREPARED_ARTIFACT_FREQUENCIES = [
  'MONTHLY',
  ...FORECAST_CADENCES.flatMap((sourceFrequency) => (
    FORECAST_CADENCES.map((targetCadence) => (
      `${FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION}|source=${sourceFrequency}|target=${targetCadence}`
    ))
  )),
]

function parsePreparedArtifactFrequency(value: string | null | undefined) {
  if (!value) {
    return null
  }

  if (value === 'MONTHLY') {
    return { sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY' }
  }

  const [version, sourcePart, targetPart, unexpectedPart] = value.split('|')
  const sourceFrequency = sourcePart?.slice('source='.length)
  const targetCadence = targetPart?.slice('target='.length)
  if (
    version !== FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION
    || unexpectedPart !== undefined
    || !sourcePart?.startsWith('source=')
    || !targetPart?.startsWith('target=')
    || !FORECAST_CADENCES.includes(sourceFrequency as (typeof FORECAST_CADENCES)[number])
    || !FORECAST_CADENCES.includes(targetCadence as (typeof FORECAST_CADENCES)[number])
  ) {
    return null
  }

  return { sourceFrequency, targetCadence }
}

function resolveForecastMethodIdentity(targetBasis: ForecastTargetBasis): {
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  methodVersion: string
} {
  if (targetBasis === 'END_OF_PERIOD') {
    return {
      targetSemantics: 'END_OF_PERIOD',
      methodId: 'END_OF_PERIOD',
      methodVersion: MONTHLY_METHOD_VERSION,
    }
  }

  if (targetBasis === 'POINT_IN_TIME') {
    return {
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
    }
  }

  return {
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: MONTHLY_METHOD_VERSION,
  }
}

function buildForecastIdentity(
  seriesId: string,
  modelId: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  methodVersion?: string,
): ForecastIdentity {
  const method = resolveForecastMethodIdentity(targetBasis)

  return {
    seriesId,
    modelId,
    targetSemantics: method.targetSemantics,
    methodId: method.methodId,
    methodVersion: methodVersion ?? method.methodVersion,
  }
}

function assertPointInTimeSnapshotDatastoreAvailable() {
  if (!getMarketDataPrismaClient()) {
    throw new Error('MARKET_DATA_DATABASE_URL or DATABASE_URL is required for POINT_IN_TIME dashboard snapshot reads.')
  }
}

export class SgRuntimeForecastAuthError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'SgRuntimeForecastAuthError'
    this.statusCode = statusCode
  }
}

function normalizeForecastStatus(status: string | null | undefined): Exclude<ForecastCapabilityStatus, 'AVAILABLE'> {
  if (status === 'FAILED' || status === 'UNSUPPORTED' || status === 'NOT_AVAILABLE') {
    return status
  }

  return 'NOT_AVAILABLE'
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  return typeof value === 'number' ? value : Number(value.toString())
}

function toRollingDailyCurrentForecastPointMap(result: Extract<RollingDailyProductionForecastResult, { status: 'AVAILABLE' }>) {
  return Object.fromEntries(
    result.anchors.map((anchor): [string, ForecastCurrentPoint] => [
      anchor.horizon,
      {
        horizon: anchor.horizon,
        horizonSteps: anchor.horizonMonths,
        forecastDate: anchor.targetCalendarDate,
        forecastValue: anchor.pointForecast,
      },
    ]),
  )
}

function evaluateRollingDailyCurrentForecastFreshness(
  seriesId: string,
  model: ForecastPortfolioModelId,
  payload: Extract<RollingDailyProductionForecastResult, { status: 'AVAILABLE' }>,
  currentSourceHistoryFingerprint: string | null,
): ForecastCurrentFreshness {
  const snapshotSourceHistoryFingerprint = payload.audit.sourceHistoryFingerprint ?? null
  const identity = {
    forecastIdentity: buildForecastIdentity(seriesId, model, 'POINT_IN_TIME', payload.forecastMethod.version),
    inputSource: payload.audit.inputSource ?? ROLLING_DAILY_INPUT_SOURCE,
    sourceHistoryFingerprint: snapshotSourceHistoryFingerprint ?? '',
    forecastOrigin: payload.origin.date,
  }

  if (!snapshotSourceHistoryFingerprint) {
    return {
      identity,
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISSING',
      snapshotSourceHistoryFingerprint,
      currentSourceHistoryFingerprint,
    }
  }

  if (!currentSourceHistoryFingerprint) {
    return {
      identity,
      status: 'STALE',
      reason: 'CURRENT_SOURCE_HISTORY_FINGERPRINT_MISSING',
      snapshotSourceHistoryFingerprint,
      currentSourceHistoryFingerprint,
    }
  }

  if (snapshotSourceHistoryFingerprint !== currentSourceHistoryFingerprint) {
    return {
      identity,
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
      snapshotSourceHistoryFingerprint,
      currentSourceHistoryFingerprint,
    }
  }

  return {
    identity,
    status: 'FRESH',
    reason: null,
    snapshotSourceHistoryFingerprint,
    currentSourceHistoryFingerprint,
  }
}

async function getRollingDailyCurrentSourceHistoryFingerprint(
  seriesId: string,
  model: ForecastPortfolioModelId,
): Promise<string | null> {
  const prisma = getMarketDataPrismaClient()

  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const state = await phase22cDiagnosticSpan('market_db_rolling_daily_maintenance_state_query', () => prisma.rollingDailyMaintenanceState.findUnique({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: {
        seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: 'POINT_IN_TIME',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: model,
      },
    },
    select: {
      latestSourceHistoryFingerprint: true,
    },
  }))

  return state?.latestSourceHistoryFingerprint ?? null
}

function toPointInTimeCurrentResult(
  seriesId: string,
  model: ForecastPortfolioModelId,
  payload: Extract<RollingDailyProductionForecastResult, { status: 'AVAILABLE' }>,
  freshness: ForecastCurrentFreshness,
): BenchmarkForecastCurrentAvailableResult {
  const identity = buildForecastIdentity(seriesId, model, 'POINT_IN_TIME', payload.forecastMethod.version)

  return {
    status: 'AVAILABLE',
    seriesId,
    modelId: model,
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    displayName: payload.benchmark.displayName,
    description: null,
    methodVersion: payload.forecastMethod.version,
    lineage: {
      inputSource: payload.audit.inputSource ?? ROLLING_DAILY_INPUT_SOURCE,
      inputRunId: null,
      sourceSeriesId: payload.benchmark.providerSeriesId ?? seriesId,
      sourceFrequency: payload.benchmark.frequency,
      historyFingerprint: payload.audit.sourceHistoryFingerprint ?? '',
      preparation: null,
    },
    history: {
      frequency: payload.benchmark.frequency,
      start: null,
      end: payload.audit.sourceLatestObservationDate,
      observations: 0,
    },
    forecastOrigin: payload.origin.date,
    currentForecast: toRollingDailyCurrentForecastPointMap(payload),
    rollingDailySnapshot: payload,
    freshness,
  }
}

async function getPersistedRollingDailyCurrentForecast(
  seriesId: string,
  model: ForecastPortfolioModelId,
): Promise<BenchmarkForecastCurrentResult> {
  const prisma = getMarketDataPrismaClient()

  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const snapshot = await phase22cDiagnosticSpan('market_db_rolling_daily_current_snapshot_query', () => prisma.rollingDailyCurrentForecastSnapshot.findFirst({
    where: {
      seriesId,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: 'POINT_IN_TIME',
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId: model,
    },
    orderBy: [{ updatedAt: 'desc' }],
  }))

  if (!snapshot) {
    const identity = resolveForecastMethodIdentity('POINT_IN_TIME')
    return {
      status: 'NOT_AVAILABLE',
      seriesId,
      modelId: model,
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: 'No persisted point-in-time current forecast snapshot is available for the selected series and model.',
    }
  }

  const payload = snapshot.payloadJson as unknown as RollingDailyProductionForecastResult

  if (payload.status !== 'AVAILABLE') {
    const identity = resolveForecastMethodIdentity('POINT_IN_TIME')
    return {
      status: payload.status,
      seriesId,
      modelId: model,
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: snapshot.message ?? ('reasonCode' in payload ? payload.reasonCode : snapshot.reasonCode) ?? 'Latest point-in-time current forecast snapshot is not available.',
    }
  }

  return toPointInTimeCurrentResult(
    seriesId,
    model,
    payload,
    evaluateRollingDailyCurrentForecastFreshness(
      seriesId,
      model,
      payload,
      await getRollingDailyCurrentSourceHistoryFingerprint(seriesId, model),
    ),
  )
}

async function getPersistedCurrentForecast(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
): Promise<BenchmarkForecastCurrentResult> {
  const prisma = getMarketDataPrismaClient()

  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const identity = resolveForecastMethodIdentity(targetBasis)

  const run = await phase22cDiagnosticSpan('market_db_generic_current_prepared_query', () => prisma.forecastCurrentRun.findFirst({
    where: {
      seriesId,
      modelId: model,
      frequency: { in: VALID_PREPARED_ARTIFACT_FREQUENCIES },
      targetBasis,
      methodId: identity.methodId,
      methodVersion: identity.methodVersion,
      status: 'AVAILABLE',
    },
    include: {
      points: {
        orderBy: [{ horizonSteps: 'asc' }, { forecastDate: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  }))

  if (!run) {
    const latestRun = await phase22cDiagnosticSpan('market_db_generic_current_fallback_query', () => prisma.forecastCurrentRun.findFirst({
      where: {
        seriesId,
        modelId: model,
        frequency: { in: VALID_PREPARED_ARTIFACT_FREQUENCIES },
        targetBasis,
        methodId: identity.methodId,
        methodVersion: identity.methodVersion,
      },
      orderBy: [{ updatedAt: 'desc' }],
    }))

    if (!latestRun) {
      return {
        status: 'NOT_AVAILABLE',
        seriesId,
        modelId: model,
        targetBasis,
        targetSemantics: identity.targetSemantics,
        methodId: identity.methodId,
        reason: 'No persisted current forecast is available for the selected series and model.',
      }
    }

    return {
      status: normalizeForecastStatus(latestRun.status),
      seriesId,
      modelId: model,
      targetBasis,
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: latestRun.failureReason ?? 'Latest persisted current forecast is not available.',
    }
  }

  const currentForecast = Object.fromEntries(
    run.points.map((point): [string, ForecastCurrentPoint] => [
      point.horizonLabel,
      {
        horizon: point.horizonLabel,
        horizonSteps: point.horizonSteps,
        forecastDate: point.forecastDate.toISOString(),
        forecastValue: toNumber(point.forecastValue),
      },
    ]),
  )
  const cadence = parsePreparedArtifactFrequency(run.frequency)
  if (!cadence) {
    return {
      status: 'NOT_AVAILABLE',
      seriesId,
      modelId: model,
      targetBasis,
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: 'Persisted current forecast cadence identity is invalid.',
    }
  }

  return {
    status: 'AVAILABLE',
    seriesId: run.seriesId,
    modelId: model,
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    displayName: run.displayName,
    description: run.description,
    methodVersion: run.methodVersion,
    lineage: {
      inputSource: run.inputSource,
      inputRunId: run.inputRunId,
      sourceSeriesId: run.seriesId,
      sourceFrequency: cadence.sourceFrequency,
      historyFingerprint: run.historyFingerprint,
      preparation: null,
    },
    history: {
      frequency: cadence.targetCadence,
      start: toIsoString(run.historyStartAt),
      end: toIsoString(run.historyEndAt),
      observations: run.observationCount,
    },
    forecastOrigin: toIsoString(run.forecastOriginAt),
    currentForecast,
  } satisfies BenchmarkForecastCurrentAvailableResult
}

async function getPersistedForecastVerification(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
): Promise<BenchmarkForecastVerificationResult> {
  const prisma = getMarketDataPrismaClient()

  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const identity = resolveForecastMethodIdentity(targetBasis)

  const run = await prisma.forecastVerificationRun.findFirst({
    where: {
      seriesId,
      modelId: model,
      frequency: { in: VALID_PREPARED_ARTIFACT_FREQUENCIES },
      targetBasis,
      methodId: identity.methodId,
      methodVersion: identity.methodVersion,
      status: 'AVAILABLE',
    },
    include: {
      metrics: {
        orderBy: [{ horizonSteps: 'asc' }],
      },
      points: {
        orderBy: [{ horizonSteps: 'asc' }, { forecastOriginAt: 'asc' }, { targetDate: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!run) {
    const latestRun = await prisma.forecastVerificationRun.findFirst({
      where: {
        seriesId,
        modelId: model,
        frequency: { in: VALID_PREPARED_ARTIFACT_FREQUENCIES },
        targetBasis,
        methodId: identity.methodId,
        methodVersion: identity.methodVersion,
      },
      orderBy: [{ updatedAt: 'desc' }],
    })

    if (!latestRun) {
      return {
        status: 'NOT_AVAILABLE',
        seriesId,
        modelId: model,
        targetBasis,
        targetSemantics: identity.targetSemantics,
        methodId: identity.methodId,
        reason: 'No persisted forecast verification is available for the selected series and model.',
      }
    }

    return {
      status: normalizeForecastStatus(latestRun.status),
      seriesId,
      modelId: model,
      targetBasis,
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: latestRun.failureReason ?? 'Latest persisted forecast verification is not available.',
    }
  }

  const verification = Object.fromEntries(
    run.metrics.map((metric): [string, ForecastVerificationHorizon] => {
      const records = run.points
        .filter((point) => point.horizonLabel === metric.horizonLabel)
        .map((point): ForecastVerificationRecord => ({
          benchmarkId: run.seriesId,
          modelId: model,
          forecastOrigin: point.forecastOriginAt.toISOString(),
          horizon: point.horizonLabel,
          horizonSteps: point.horizonSteps,
          forecastDate: point.targetDate.toISOString(),
          actualObservedAt: toIsoString(point.actualObservedAt),
          originValue: toNumber(point.originValue) ?? 0,
          forecastValue: toNumber(point.forecastValue) ?? 0,
          actualValue: toNumber(point.actualValue) ?? 0,
          error: toNumber(point.errorValue) ?? 0,
          absoluteError: toNumber(point.absoluteErrorValue) ?? 0,
          delta: toNumber(point.deltaValue) ?? 0,
          deltaPct: point.deltaPct,
          maseScale: toNumber(point.maseScale) ?? 0,
        }))

      return [
        metric.horizonLabel,
        {
          horizon: metric.horizonLabel,
          horizonSteps: metric.horizonSteps,
          origins: metric.origins,
          expectedOrigins: metric.expectedOrigins,
          successfulOrigins: metric.origins - metric.failedOrigins,
          failedOrigins: metric.failedOrigins,
          coverage: metric.coverage,
          records,
        },
      ]
    }),
  )
  const cadence = parsePreparedArtifactFrequency(run.frequency)
  if (!cadence) {
    return {
      status: 'NOT_AVAILABLE',
      seriesId,
      modelId: model,
      targetBasis,
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: 'Persisted forecast verification cadence identity is invalid.',
    }
  }

  return {
    status: 'AVAILABLE',
    seriesId: run.seriesId,
    modelId: model,
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    displayName: run.displayName,
    description: run.description,
    methodVersion: run.methodVersion,
    lineage: {
      inputSource: run.inputSource,
      inputRunId: run.inputRunId,
      sourceSeriesId: run.seriesId,
      sourceFrequency: cadence.sourceFrequency,
      historyFingerprint: run.historyFingerprint,
      preparation: null,
    },
    history: {
      frequency: cadence.targetCadence,
      start: toIsoString(run.historyStartAt),
      end: toIsoString(run.historyEndAt),
      observations: run.observationCount,
    },
    forecastOrigin: toIsoString(run.forecastOriginAt),
    verification,
  } satisfies BenchmarkForecastVerificationAvailableResult
}

async function getPersistedRollingDailyForecastVerification(
  seriesId: string,
  model: ForecastPortfolioModelId,
): Promise<BenchmarkForecastVerificationResult> {
  const prisma = getMarketDataPrismaClient()

  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const records = await prisma.rollingDailyVerificationRecord.findMany({
    where: {
      seriesId,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: 'POINT_IN_TIME',
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId: model,
    },
    orderBy: [{ horizonMonths: 'asc' }, { targetCalendarDate: 'asc' }, { forecastOriginAt: 'asc' }],
  })

  if (records.length === 0) {
    const identity = resolveForecastMethodIdentity('POINT_IN_TIME')
    return {
      status: 'NOT_AVAILABLE',
      seriesId,
      modelId: model,
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: identity.targetSemantics,
      methodId: identity.methodId,
      reason: 'No persisted point-in-time forecast verification is available for the selected series and model.',
    }
  }

  const verification = Object.fromEntries(
    [...records.reduce((map, record) => {
      const group = map.get(record.horizonLabel) ?? []
      group.push(record)
      map.set(record.horizonLabel, group)
      return map
    }, new Map<string, typeof records>())].map(([horizonLabel, horizonRecords]): [string, ForecastVerificationHorizon] => {
      const maturedRecords = horizonRecords.filter((record) => record.maturityStatus === 'MATURED' && record.actualValue !== null)
      const persistedRecords = maturedRecords.map((record): ForecastVerificationRecord => ({
        benchmarkId: record.seriesId,
        modelId: record.modelId,
        forecastOrigin: record.forecastOriginAt.toISOString(),
        horizon: record.horizonLabel,
        horizonSteps: record.horizonSteps,
        forecastDate: record.targetCalendarDate.toISOString(),
        actualObservedAt: toIsoString(record.verificationObservedAt),
        originValue: toNumber(record.originValue) ?? 0,
        forecastValue: toNumber(record.forecastValue) ?? 0,
        actualValue: toNumber(record.actualValue) ?? 0,
        error: toNumber(record.errorValue) ?? 0,
        absoluteError: toNumber(record.absoluteErrorValue) ?? 0,
        delta: toNumber(record.deltaValue) ?? 0,
        deltaPct: record.deltaPct,
        maseScale: record.maseScale,
      }))

      const expectedOrigins = horizonRecords.length
      const successfulOrigins = persistedRecords.length

      return [
        horizonLabel,
        {
          horizon: horizonLabel,
          horizonSteps: horizonRecords[0]?.horizonSteps ?? 0,
          origins: successfulOrigins,
          expectedOrigins,
          successfulOrigins,
          failedOrigins: 0,
          coverage: expectedOrigins > 0 ? successfulOrigins / expectedOrigins : 0,
          records: persistedRecords,
        },
      ]
    }),
  )

  const latestRecord = [...records].sort((left, right) => right.forecastOriginAt.getTime() - left.forecastOriginAt.getTime())[0]
  const identity = resolveForecastMethodIdentity('POINT_IN_TIME')

  return {
    status: 'AVAILABLE',
    seriesId,
    modelId: model,
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    displayName: seriesId,
    description: null,
    methodVersion: latestRecord?.methodVersion ?? 'rolling-daily-point-in-time-v1',
    lineage: {
      inputSource: latestRecord?.inputSource ?? ROLLING_DAILY_INPUT_SOURCE,
      inputRunId: latestRecord?.inputRunId ?? null,
      sourceSeriesId: seriesId,
      sourceFrequency: 'DAILY',
      historyFingerprint: latestRecord?.sourceHistoryFingerprint ?? '',
      preparation: null,
    },
    history: {
      frequency: 'DAILY',
      start: null,
      end: toIsoString(latestRecord?.trainingHistoryEndAt),
      observations: latestRecord?.trainingObservationCount ?? 0,
    },
    forecastOrigin: toIsoString(latestRecord?.forecastOriginAt),
    verification,
  }
}

function resolveSgRuntimeBaseUrl() {
  if (process.env.SG_RUNTIME_BASE_URL?.trim()) {
    return process.env.SG_RUNTIME_BASE_URL.trim()
  }

  if (process.env.RENDER_EXTERNAL_URL?.trim() || process.env.VERCEL_URL?.trim()) {
    throw new Error('SG_RUNTIME_BASE_URL is required in deployed dashboard-preview environments.')
  }

  return LOCAL_SG_RUNTIME_BASE_URL
}

function readSgRuntimeInternalForecastServiceToken() {
  return process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim() ?? ''
}

async function fetchSgRuntimeJson<T extends object>(pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, resolveSgRuntimeBaseUrl())

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await response.json() as T | { error?: string }

  if (!response.ok) {
    throw new Error('error' in payload ? payload.error ?? 'SG Runtime request failed.' : 'SG Runtime request failed.')
  }

  return payload as T
}

export async function getRollingDailyPointInTimeProductionForecast(
  seriesId: string,
  model: ForecastPortfolioModelId,
): Promise<RollingDailyProductionForecastResult> {
  return getBenchmarkProductionForecast(seriesId, model, 'POINT_IN_TIME') as unknown as Promise<RollingDailyProductionForecastResult>
}

export async function getBenchmarkProductionForecast(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  cadence?: { sourceFrequency: string, targetCadence: string },
  correlationHeaders: Record<string, string> = {},
) {
  const token = readSgRuntimeInternalForecastServiceToken()

  if (!token) {
    throw new Error('SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured.')
  }

  const url = new URL(INTERNAL_FORECAST_ROUTE_PATH, resolveSgRuntimeBaseUrl())
  url.searchParams.set('seriesId', seriesId)
  url.searchParams.set('model', model)
  url.searchParams.set('forecastMethod', targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis)
  if (cadence) {
    url.searchParams.set('sourceFrequency', cadence.sourceFrequency)
    url.searchParams.set('targetCadence', cadence.targetCadence)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), INTERNAL_FORECAST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...correlationHeaders,
      },
    })

    const payload = await response.json() as { status: string } | { error?: string }
    if (!response.ok) {
      const message = 'error' in payload ? payload.error ?? 'SG Runtime production forecast request failed.' : 'SG Runtime production forecast request failed.'

      if (response.status === 401 || response.status === 403) {
        throw new SgRuntimeForecastAuthError(message, response.status)
      }

      throw new Error(message)
    }

    return payload as { status: string }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('SG Runtime production forecast request timed out.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function readInteractiveForecastCapability(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
): Promise<InteractiveForecastCapabilityResult> {
  const token = readSgRuntimeInternalForecastServiceToken()

  if (!token) {
    throw new Error('SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured.')
  }

  const url = new URL(INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH, resolveSgRuntimeBaseUrl())
  url.searchParams.set('seriesId', seriesId)
  url.searchParams.set('modelId', model)
  url.searchParams.set('targetSemantics', resolveForecastMethodIdentity(targetBasis).targetSemantics)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), INTERNAL_FORECAST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const payload = await response.json() as InteractiveForecastCapabilityResult | { error?: string }
    if (!response.ok) {
      const message = 'error' in payload ? payload.error ?? 'SG Runtime capability request failed.' : 'SG Runtime capability request failed.'

      if (response.status === 401 || response.status === 403) {
        throw new SgRuntimeForecastAuthError(message, response.status)
      }

      throw new Error(message)
    }

    return payload as InteractiveForecastCapabilityResult
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('SG Runtime capability request timed out.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getBenchmarkForecastCurrent(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis = DEFAULT_FORECAST_TARGET_BASIS,
) {
  if (targetBasis === 'POINT_IN_TIME') {
    assertPointInTimeSnapshotDatastoreAvailable()

    let capability: InteractiveForecastCapabilityResult | null = null
    if (readSgRuntimeInternalForecastServiceToken()) {
      capability = await readInteractiveForecastCapability(seriesId, model, targetBasis)
    }

    if (capability && (capability.status === 'NOT_LAWFUL' || capability.reason === 'NOT_LAWFUL')) {
      const identity = resolveForecastMethodIdentity(targetBasis)
      return {
        status: 'UNSUPPORTED',
        seriesId,
        modelId: model,
        targetBasis,
        targetSemantics: identity.targetSemantics,
        methodId: identity.methodId,
        reason: 'UNSUPPORTED_FREQUENCY',
      } satisfies BenchmarkForecastCurrentResult
    }

    return getPersistedRollingDailyCurrentForecast(seriesId, model)
  }

  if (getMarketDataPrismaClient()) {
    return getPersistedCurrentForecast(seriesId, model, targetBasis)
  }

  const identity = resolveForecastMethodIdentity(targetBasis)
  return {
    status: 'NOT_AVAILABLE',
    seriesId,
    modelId: model,
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    reason: 'PREPARATION_REQUIRED: Prepared Forecast datastore authority is unavailable.',
  } satisfies BenchmarkForecastCurrentResult
}

type ShowForecastDependencies = {
  readPrepared: (
    seriesId: string,
    model: ForecastPortfolioModelId,
    targetBasis: ForecastTargetBasis,
  ) => Promise<{ status: string }>
}

const showForecastDependencies: ShowForecastDependencies = {
  readPrepared: getBenchmarkForecastCurrent,
}

export async function resolveShowForecastCurrent(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis = DEFAULT_FORECAST_TARGET_BASIS,
  dependencies: ShowForecastDependencies = showForecastDependencies,
) {
  return dependencies.readPrepared(seriesId, model, targetBasis)
}

export async function getBenchmarkForecastVerification(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis = DEFAULT_FORECAST_TARGET_BASIS,
) {
  if (targetBasis === 'POINT_IN_TIME') {
    assertPointInTimeSnapshotDatastoreAvailable()
    return getPersistedRollingDailyForecastVerification(seriesId, model)
  }

  if (getMarketDataPrismaClient()) {
    return getPersistedForecastVerification(seriesId, model, targetBasis)
  }

  const identity = resolveForecastMethodIdentity(targetBasis)
  return {
    status: 'NOT_AVAILABLE',
    seriesId,
    modelId: model,
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    reason: 'PREPARATION_REQUIRED: Prepared Verification datastore authority is unavailable.',
  } satisfies BenchmarkForecastVerificationResult
}
