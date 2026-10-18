import type { BenchmarkForecastCurrentAvailableResult, BenchmarkForecastCurrentResult, ForecastCurrentFreshness, ForecastCurrentPoint, ForecastPortfolioModelId, ForecastTargetBasis, ForecastTargetSemantics, ForecastMethodId, ForecastIdentity, RollingDailyProductionForecastResult } from './forecast-contract'

/** Existing pure presentation/identity functions extracted unchanged from the retained bridge. No datasource, network, authority or framework dependency. */
export const ROLLING_DAILY_INPUT_SOURCE = 'DYNAMIC_MARKET_DATA_STORE'
export const ROLLING_DAILY_METHOD_ID = 'ROLLING_DAILY_POINT_IN_TIME'
export const ROLLING_DAILY_METHOD_VERSION = 'rolling-daily-point-in-time-v1'
export const MONTHLY_METHOD_VERSION = 'benchmark-forecasting-mvp-phase2-v1'

export function resolveForecastMethodIdentity(targetBasis: ForecastTargetBasis): {
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


export function buildForecastIdentity(
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


export function toRollingDailyCurrentForecastPointMap(result: Extract<RollingDailyProductionForecastResult, { status: 'AVAILABLE' }>) {
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


export function evaluateRollingDailyCurrentForecastFreshness(
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


export function toPointInTimeCurrentResult(
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


export function toCurrentNotAvailableReason(
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  reason: string,
): BenchmarkForecastCurrentResult {
  const identity = resolveForecastMethodIdentity(targetBasis)

  return {
    status: 'NOT_AVAILABLE',
    seriesId,
    modelId: model,
    targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    reason,
  }
}
