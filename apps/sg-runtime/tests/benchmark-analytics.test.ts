import assert from 'node:assert/strict'
import test from 'node:test'

const mutableEnv = process.env as Record<string, string | undefined>

test('analytics URL keeps warm-up off by default for Finder embeds', async () => {
  process.env.SG_RUNTIME_PORR_DEMO = 'false'
  mutableEnv.NODE_ENV = 'production'
  const { buildDashboardPreviewAnalyticsUrl } = await import('@/lib/benchmark/analytics')
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'wocaes0074', 'Brent'))

  assert.equal(url.pathname, '/pl')
  assert.equal(url.searchParams.get('embed'), '1')
  assert.equal(url.searchParams.get('variantId'), 'forecast-portfolio-v3')
  assert.equal(url.searchParams.get('showForecast'), 'false')
  assert.equal(url.searchParams.has('warmCurrentForecast'), false)
  assert.equal(url.searchParams.get('seriesId'), 'wocaes0074')
  assert.equal(url.searchParams.get('range'), '1Y')
  assert.equal(url.searchParams.get('displayName'), 'Brent')
})

test('analytics URL keeps warm-up off for the PORR demo profile', async () => {
  process.env.SG_RUNTIME_PORR_DEMO = 'true'
  mutableEnv.NODE_ENV = 'production'
  const { buildDashboardPreviewAnalyticsUrl, resolveBenchmarkAnalyticsEligibility } = await import('@/lib/benchmark/analytics')
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'wocaes0074', 'Brent'))
  const eligibility = await resolveBenchmarkAnalyticsEligibility('pl', 'wocaes0074', 'Brent', { porrDemoProfile: true })
  const eligibilityUrl = new URL(eligibility.analyticsUrl ?? '')

  assert.equal(url.searchParams.get('showForecast'), 'false')
  assert.equal(url.searchParams.has('warmCurrentForecast'), false)
  assert.equal(eligibilityUrl.searchParams.get('showForecast'), 'false')
  assert.equal(eligibilityUrl.searchParams.has('warmCurrentForecast'), false)
  assert.equal(eligibilityUrl.searchParams.get('preparedReadsOnly'), '1')
  assert.equal(eligibility.forecastPortfolioEnabled, true)
})

test('PORR demo keeps the configured eleven prepared-read only without blocking canonical preparation for other benchmarks', async () => {
  const { resolveBenchmarkAnalyticsEligibility } = await import('@/lib/benchmark/analytics')
  const { PORR_DEMO_FORECAST_BENCHMARKS } = await import('@/lib/benchmark/porr-demo-forecast-portfolio')

  assert.equal(PORR_DEMO_FORECAST_BENCHMARKS.length, 11)
  assert.equal(new Set(PORR_DEMO_FORECAST_BENCHMARKS.map((item) => item.seriesId)).size, 11)

  const portfolio = await resolveBenchmarkAnalyticsEligibility('en', 'lmeofcucashask', 'LME Copper', { porrDemoProfile: true })
  const canonicalPreparation = await resolveBenchmarkAnalyticsEligibility('en', 'lmeofalcashask', 'LME Aluminium', { porrDemoProfile: true })

  assert.equal(portfolio.eligible, true)
  assert.equal(portfolio.forecastPortfolioEnabled, true)
  assert.equal(new URL(portfolio.analyticsUrl ?? '').searchParams.get('variantId'), 'forecast-portfolio-v3')
  assert.equal(new URL(portfolio.analyticsUrl ?? '').searchParams.get('preparedReadsOnly'), '1')

  assert.equal(canonicalPreparation.eligible, true)
  assert.equal(canonicalPreparation.forecastPortfolioEnabled, true)
  assert.equal(new URL(canonicalPreparation.analyticsUrl ?? '').searchParams.get('variantId'), 'forecast-portfolio-v3')
  assert.equal(new URL(canonicalPreparation.analyticsUrl ?? '').searchParams.has('preparedReadsOnly'), false)
})

test('analytics URL propagates the warm-up flag for explicit experiment requests without duplication', async () => {
  process.env.SG_RUNTIME_PORR_DEMO = 'false'
  mutableEnv.NODE_ENV = 'production'
  const { buildDashboardPreviewAnalyticsUrl, normalizeForecastWarmupExperiment } = await import('@/lib/benchmark/analytics')
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'wocaes0074', 'Brent', {
    warmCurrentForecast: normalizeForecastWarmupExperiment('single') === 'single',
  }))

  assert.equal(url.searchParams.get('warmCurrentForecast'), '1')
  assert.equal(url.searchParams.getAll('warmCurrentForecast').length, 1)
})

test('forecast warm-up experiment parsing stays explicit and fail-closed', async () => {
  const { normalizeForecastWarmupExperiment } = await import('@/lib/benchmark/analytics')

  assert.equal(normalizeForecastWarmupExperiment(undefined), null)
  assert.equal(normalizeForecastWarmupExperiment(null), null)
  assert.equal(normalizeForecastWarmupExperiment(''), null)
  assert.equal(normalizeForecastWarmupExperiment('single'), 'single')
  assert.equal(normalizeForecastWarmupExperiment('all'), null)
})

test('analytics embed follows the active Finder locale without losing prepared-read identity', async () => {
  const { localizeDashboardPreviewAnalyticsUrl } = await import('@/lib/benchmark/analytics')
  const source = 'https://analytics-demo-sg-porr.spendguru.app/pl?embed=1&preparedReadsOnly=1&seriesId=b_c1_cl'
  const localized = new URL(localizeDashboardPreviewAnalyticsUrl(source, 'en'))

  assert.equal(localized.pathname, '/en')
  assert.equal(localized.searchParams.get('embed'), '1')
  assert.equal(localized.searchParams.get('preparedReadsOnly'), '1')
  assert.equal(localized.searchParams.get('seriesId'), 'b_c1_cl')
})
