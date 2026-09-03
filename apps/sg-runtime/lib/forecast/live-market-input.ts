import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import {
  DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD,
  DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION,
  DAILY_MARKET_PRICE_MONTHLY_METHOD,
  DAILY_MARKET_PRICE_MONTHLY_VERSION,
  LIVE_FORECAST_INPUT_SOURCE_KIND,
  canonicalizeDailyMarketPriceHistory,
  canonicalizeProvenanceQualifiedWeeklyEndOfPeriod,
  canonicalizeProvenanceQualifiedNativePeriod,
  selectLatestContiguousMonthlySuffix,
} from '@/lib/forecast/canonical-history'
import { DEFAULT_FORECAST_TARGET_BASIS, type ForecastTargetBasis } from '@/lib/forecast/contracts'
import {
  createFutureForecastTargetPeriods,
  mapLegacyCalendarMonthHorizonToNativeSteps,
  normalizeForecastSourceFrequency,
  type ForecastTargetCadence,
} from '@/lib/forecast/cadence'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'

type LiveForecastBridgeHistory = {
  seriesId: string
  benchmarkName: string
  description: string
  frequency: ForecastTargetCadence
  start: string
  end: string
  observations: number
  canonicalization: {
    method: string
    version: string
  }
  points: Array<{
    date: string
    value: number
    sourceObservedAt?: string | null
  }>
}

export type LiveForecastBridgePayload = {
  benchmark: {
    seriesId: string
    component: string
    description: string
    frequency: ForecastTargetCadence
    expectedObservations: number
  }
  execution: {
    frequency: ForecastTargetCadence
    historicalPeriodStarts: string[]
    horizons: Record<string, number>
    currentTargetDates: Record<string, string>
  }
  source: {
    kind: typeof LIVE_FORECAST_INPUT_SOURCE_KIND
    runId: null
  }
  canonicalization: {
    targetBasis: ForecastTargetBasis
    method: string
    version: string
    partialMonthRule: 'EXCLUDE_OPEN_CALENDAR_MONTH' | 'EXCLUDE_OPEN_TARGET_PERIOD'
    missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY'
    sourceObservationCount: number
    sourceObservationsUsed: number
    excludedPartialPeriods: number
  }
  history: LiveForecastBridgeHistory
}

export function selectLatestCurrentForecastMonthlyTrainingPayload(
  payload: LiveForecastBridgePayload,
): LiveForecastBridgePayload {
  if (payload.history.frequency !== 'MONTHLY') {
    return payload
  }

  const points = selectLatestContiguousMonthlySuffix(payload.history.points.map((point) => ({
    ...point,
    sourceObservedAt: point.sourceObservedAt ?? null,
  })))
  if (points.length === payload.history.points.length) {
    return payload
  }

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  if (!firstPoint || !lastPoint) {
    return payload
  }

  const { horizons, currentTargetDates } = buildCurrentForecastExecutionPlan(lastPoint.date, payload.execution.frequency)

  return {
    ...payload,
    benchmark: {
      ...payload.benchmark,
      expectedObservations: points.length,
    },
    execution: {
      ...payload.execution,
      historicalPeriodStarts: points.map((point) => point.date),
      horizons,
      currentTargetDates,
    },
    history: {
      ...payload.history,
      start: firstPoint.date,
      end: lastPoint.date,
      observations: points.length,
      points,
    },
  }
}

export function buildCurrentForecastExecutionPlan(
  forecastOrigin: string,
  targetCadence: ForecastTargetCadence,
) {
  const horizons = Object.fromEntries(
    [1, 3, 6, 12].flatMap((horizonMonths) => {
      const nativeSteps = mapLegacyCalendarMonthHorizonToNativeSteps(targetCadence, horizonMonths)
      return nativeSteps === null ? [] : [[`${horizonMonths}M`, nativeSteps]]
    }),
  )
  const currentTargetDates = Object.fromEntries(
    Object.entries(horizons).map(([label, nativeSteps]) => [
      label,
      createFutureForecastTargetPeriods(forecastOrigin, targetCadence, nativeSteps).at(-1)!.start.toISOString(),
    ]),
  )

  return { horizons, currentTargetDates }
}

export function buildCurrentHorizonConfigurationId(
  forecastOrigin: string,
  targetCadence: ForecastTargetCadence,
) {
  return JSON.stringify(buildCurrentForecastExecutionPlan(forecastOrigin, targetCadence))
}

export function buildLiveForecastBridgePayloadFromHistory(
  seriesId: string,
  history: BenchmarkHistoricalSeriesResult,
  options: { now?: Date; targetBasis?: ForecastTargetBasis; targetCadence?: ForecastTargetCadence } = {},
): LiveForecastBridgePayload {
  if (history.providerSeries.providerSeriesId !== seriesId) {
    throw new Error(`Exact series integrity violated for ${seriesId}.`)
  }

  const targetBasis = options.targetBasis ?? DEFAULT_FORECAST_TARGET_BASIS
  if (targetBasis === 'POINT_IN_TIME') {
    throw new Error('The period forecast bridge does not support POINT_IN_TIME targets.')
  }
  const targetCadence = options.targetCadence ?? 'MONTHLY'
  const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
  const canonical = sourceFrequency === 'DAILY' && targetCadence === 'MONTHLY'
    ? canonicalizeDailyMarketPriceHistory(history, targetBasis, options)
    : sourceFrequency === 'WEEKLY' && targetCadence === 'MONTHLY' && targetBasis === 'END_OF_PERIOD'
      ? canonicalizeProvenanceQualifiedWeeklyEndOfPeriod(history, options)
    : canonicalizeProvenanceQualifiedNativePeriod(history, targetBasis, targetCadence, options)
  const firstPoint = canonical.historical[0]
  const lastPoint = canonical.historical[canonical.historical.length - 1]

  if (!firstPoint || !lastPoint) {
    throw new Error(`No lawful closed ${targetCadence} periods are available yet for ${seriesId}.`)
  }
  const { horizons, currentTargetDates } = buildCurrentForecastExecutionPlan(lastPoint.date, targetCadence)

  return {
    benchmark: {
      seriesId,
      component: history.providerSeries.providerSeriesKey ?? seriesId,
      description: history.displayName,
      frequency: targetCadence,
      expectedObservations: canonical.historical.length,
    },
    execution: {
      frequency: targetCadence,
      historicalPeriodStarts: canonical.historical.map((point) => point.date),
      horizons,
      currentTargetDates,
    },
    source: {
      kind: LIVE_FORECAST_INPUT_SOURCE_KIND,
      runId: null,
    },
    canonicalization: {
      targetBasis: canonical.targetBasis,
      method: canonical.method,
      version: canonical.version,
      partialMonthRule: 'partialMonthRule' in canonical
        ? canonical.partialMonthRule
        : canonical.partialPeriodRule,
      missingDayRule: 'missingDayRule' in canonical
        ? canonical.missingDayRule
        : canonical.missingObservationRule,
      sourceObservationCount: canonical.sourceObservationCount,
      sourceObservationsUsed: canonical.sourceObservationsUsed,
      excludedPartialPeriods: canonical.excludedPartialPeriods,
    },
    history: {
      seriesId,
      benchmarkName: history.displayName,
      description: history.displayName,
      frequency: targetCadence,
      start: firstPoint.date,
      end: lastPoint.date,
      observations: canonical.historical.length,
      canonicalization: {
        method: canonical.method,
        version: canonical.version,
      },
      points: canonical.historical,
    },
  }
}

export async function loadLiveForecastBridgePayload(
  seriesId: string,
  options: { now?: Date; targetBasis?: ForecastTargetBasis; targetCadence?: ForecastTargetCadence } = {},
) {
  const resolved = await resolveBenchmarkHistoricalSeries(seriesId, 'ALL')
  const sourceFrequency = normalizeForecastSourceFrequency(resolved.history.frequency)
  const targetCadence = options.targetCadence ?? 'MONTHLY'
  if (
    !sourceFrequency
    || (sourceFrequency === 'DAILY' && targetCadence !== 'MONTHLY')
    || (sourceFrequency !== 'DAILY'
      && sourceFrequency !== targetCadence
      && !(sourceFrequency === 'WEEKLY' && targetCadence === 'MONTHLY' && (options.targetBasis ?? DEFAULT_FORECAST_TARGET_BASIS) === 'END_OF_PERIOD'))
  ) {
    return null
  }

  return buildLiveForecastBridgePayloadFromHistory(seriesId, resolved.history, {
    ...options,
    targetCadence,
  })
}