import { readFirstSearchParamValue } from './registry'

export const FORECAST_PORTFOLIO_DEFAULT_BENCHMARK = {
  seriesId: 'wocaes0074',
  displayName: 'Brent, Spot, FOB North Sea',
} as const

export function resolveForecastPortfolioBenchmarkSubject(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const seriesId = readFirstSearchParamValue(searchParams.seriesId)?.trim() ?? ''
  const displayName = readFirstSearchParamValue(searchParams.displayName)?.trim() ?? ''

  if (seriesId) {
    return {
      seriesId,
      displayName: displayName || null,
    }
  }

  return FORECAST_PORTFOLIO_DEFAULT_BENCHMARK
}

