import { serverEnv } from '@/lib/env'

const LOCAL_DASHBOARD_PREVIEW_BASE_URL = 'http://localhost:3002'
const PRODUCTION_DASHBOARD_PREVIEW_BASE_URL = 'https://dashboards-library.onrender.com'
export const FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM = 'forecastWarmupExperiment'
const FORECAST_WARMUP_QUERY_VALUE = '1'

export type ForecastWarmupExperiment = 'single'

export function normalizeForecastWarmupExperiment(
  value: string | null | undefined,
): ForecastWarmupExperiment | null {
  return value === 'single' ? 'single' : null
}

export type BenchmarkAnalyticsEligibility = {
  eligible: boolean
  componentCode: string | null
  analyticsUrl: string | null
}

function shouldEnablePorrWarmCurrentForecastByDefault() {
  return process.env.SG_RUNTIME_PORR_DEMO === 'true'
}

function resolveDashboardPreviewBaseUrl() {
  if (serverEnv.DASHBOARD_PREVIEW_BASE_URL) {
    return serverEnv.DASHBOARD_PREVIEW_BASE_URL
  }

  if (serverEnv.NODE_ENV === 'production') {
    return PRODUCTION_DASHBOARD_PREVIEW_BASE_URL
  }

  return LOCAL_DASHBOARD_PREVIEW_BASE_URL
}

export function buildDashboardPreviewAnalyticsUrl(
  locale: 'pl' | 'en',
  seriesId: string,
  displayName?: string | null,
  options?: {
    warmCurrentForecast?: boolean
  },
) {
  const shouldWarmCurrentForecast = options?.warmCurrentForecast ?? shouldEnablePorrWarmCurrentForecastByDefault()
  const url = new URL(`/${locale}`, resolveDashboardPreviewBaseUrl())
  url.searchParams.set('embed', '1')
  url.searchParams.set('variantId', 'forecast-portfolio-v3')
  url.searchParams.set('showForecast', 'false')
  if (shouldWarmCurrentForecast) {
    url.searchParams.set('warmCurrentForecast', FORECAST_WARMUP_QUERY_VALUE)
  }
  url.searchParams.set('seriesId', seriesId)
  url.searchParams.set('range', '1Y')
  if (displayName?.trim()) {
    url.searchParams.set('displayName', displayName.trim())
  }
  return url.toString()
}

export async function resolveBenchmarkAnalyticsEligibility(
  locale: 'pl' | 'en',
  seriesId: string,
  displayName?: string | null,
  options?: {
    warmCurrentForecast?: boolean
  },
): Promise<BenchmarkAnalyticsEligibility> {
  if (!seriesId.trim()) {
    return {
      eligible: false,
      componentCode: null,
      analyticsUrl: null,
    }
  }

  return {
    eligible: true,
    componentCode: null,
    analyticsUrl: buildDashboardPreviewAnalyticsUrl(locale, seriesId, displayName, options),
  }
}