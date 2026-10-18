import type { SeriesResponse } from './series-contract'

export type BenchmarkAnalyticsRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'

export type BenchmarkAnalyticsSeriesResponse = {
  providerSeries: {
    providerSeriesId: string
  }
  displayName: string
  latestValue: number | null
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  range: BenchmarkAnalyticsRange
  historical: Array<{
    date: string
    value: number | null
  }>
}

export function toBenchmarkSeriesResponse(
  payload: BenchmarkAnalyticsSeriesResponse,
  locale: 'pl' | 'en',
  displayNameOverride: string | null,
): SeriesResponse {
  const effectiveName = displayNameOverride?.trim() || payload.displayName
  const latestHistoricalPoint = payload.historical[payload.historical.length - 1] ?? null
  const detailDate = latestHistoricalPoint?.date ?? null
  const detailValue = latestHistoricalPoint?.value ?? payload.latestValue

  return {
    selection: {
      componentName: effectiveName,
      componentId: null,
      componentCode: payload.providerSeries.providerSeriesId,
      sourceLabel: payload.source,
    },
    benchmarkSelectionRequired: false,
    availableBenchmarks: [
      {
        componentCode: payload.providerSeries.providerSeriesId,
        sourceLabel: payload.source,
        descriptionPlAvailable: locale === 'pl',
        descriptionEnAvailable: locale === 'en',
      },
    ],
    sourceInfo: {
      benchmarkCode: payload.providerSeries.providerSeriesId,
      sourceLabel: payload.source,
      descriptionPl: locale === 'pl' ? effectiveName : null,
      descriptionEn: locale === 'en' ? effectiveName : null,
      unit: payload.unit,
      currency: payload.currency,
      market: null,
      country: null,
      qualityStatus: null,
      lastSyncedAt: null,
    },
    detailSummary: {
      componentName: effectiveName,
      componentCode: payload.providerSeries.providerSeriesId,
      sourceDate: detailDate,
      scenarioType: 'historical',
      metricValue: detailValue,
      forecastLower: null,
      forecastUpper: null,
      forecastAccuracyDiff: null,
      unit: payload.unit,
      currency: payload.currency,
      market: null,
      country: null,
      qualityStatus: null,
      descriptionPl: locale === 'pl' ? effectiveName : null,
      descriptionEn: locale === 'en' ? effectiveName : null,
      sourceLabel: payload.source,
      lastSyncedAt: null,
    },
    forecastAnchor: latestHistoricalPoint
      ? {
          date: latestHistoricalPoint.date,
          value: latestHistoricalPoint.value,
        }
      : null,
    historicalWindow: {
      from: payload.historical[0]?.date ?? null,
      to: latestHistoricalPoint?.date ?? null,
    },
    historical: payload.historical.map((point, index) => ({
      date: point.date,
      value: point.value,
      diff: null,
      recordId: `${payload.providerSeries.providerSeriesId}-${index}`,
      dedupeKey: `${payload.providerSeries.providerSeriesId}-${point.date}`,
    })),
    forecast: null,
  }
}

