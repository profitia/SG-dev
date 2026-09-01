import assert from 'node:assert/strict'
import test from 'node:test'

test('analytics URL routes Finder to embedded forecast portfolio v3 on the dashboard preview host', async () => {
  process.env.NODE_ENV = 'production'
  const { buildDashboardPreviewAnalyticsUrl } = await import('@/lib/benchmark/analytics')
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'wocaes0074', 'Brent'))

  assert.equal(url.origin, 'https://dashboards-library.onrender.com')
  assert.equal(url.pathname, '/pl')
  assert.equal(url.searchParams.get('embed'), '1')
  assert.equal(url.searchParams.get('variantId'), 'forecast-portfolio-v3')
  assert.equal(url.searchParams.get('showForecast'), 'false')
  assert.equal(url.searchParams.get('seriesId'), 'wocaes0074')
  assert.equal(url.searchParams.get('range'), '1Y')
  assert.equal(url.searchParams.get('displayName'), 'Brent')
})