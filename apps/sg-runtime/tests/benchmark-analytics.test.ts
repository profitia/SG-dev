import assert from 'node:assert/strict'
import test from 'node:test'

test('analytics URL keeps warm-up off by default for Finder embeds', async () => {
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

test('analytics URL propagates the warm-up flag only for explicit experiment requests', async () => {
  process.env.NODE_ENV = 'production'
  const { buildDashboardPreviewAnalyticsUrl, normalizeForecastWarmupExperiment } = await import('@/lib/benchmark/analytics')
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'wocaes0074', 'Brent', {
    warmCurrentForecast: normalizeForecastWarmupExperiment('single') === 'single',
  }))

  assert.equal(url.searchParams.get('warmCurrentForecast'), '1')
})

test('forecast warm-up experiment parsing stays explicit and fail-closed', async () => {
  const { normalizeForecastWarmupExperiment } = await import('@/lib/benchmark/analytics')

  assert.equal(normalizeForecastWarmupExperiment(undefined), null)
  assert.equal(normalizeForecastWarmupExperiment(null), null)
  assert.equal(normalizeForecastWarmupExperiment(''), null)
  assert.equal(normalizeForecastWarmupExperiment('single'), 'single')
  assert.equal(normalizeForecastWarmupExperiment('all'), null)
})