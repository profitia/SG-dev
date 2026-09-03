import assert from 'node:assert/strict'
import test from 'node:test'

test('analytics URL keeps warm-up off by default for Finder embeds', async () => {
  process.env.SG_RUNTIME_PORR_DEMO = 'false'
  process.env.NODE_ENV = 'production'
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

test('analytics URL auto-enables warm-up for the PORR demo profile', async () => {
  process.env.SG_RUNTIME_PORR_DEMO = 'true'
  process.env.NODE_ENV = 'production'
  const { buildDashboardPreviewAnalyticsUrl, resolveBenchmarkAnalyticsEligibility } = await import('@/lib/benchmark/analytics')
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'wocaes0074', 'Brent'))
  const eligibility = await resolveBenchmarkAnalyticsEligibility('pl', 'wocaes0074', 'Brent')
  const eligibilityUrl = new URL(eligibility.analyticsUrl ?? '')

  assert.equal(url.searchParams.get('showForecast'), 'false')
  assert.equal(url.searchParams.get('warmCurrentForecast'), '1')
  assert.equal(eligibilityUrl.searchParams.get('showForecast'), 'false')
  assert.equal(eligibilityUrl.searchParams.get('warmCurrentForecast'), '1')
})

test('analytics URL propagates the warm-up flag for explicit experiment requests without duplication', async () => {
  process.env.SG_RUNTIME_PORR_DEMO = 'false'
  process.env.NODE_ENV = 'production'
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