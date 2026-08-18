import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_DASHBOARD_VARIANT_ID,
  buildDashboardVariantHref,
  getStandaloneSwitcherVariants,
  resolveDashboardVariant,
} from '@/lib/dashboard-variants/registry'

test('dashboard variant resolver uses finder embedded v2 as the default selection', () => {
  const resolution = resolveDashboardVariant({})

  assert.equal(resolution.resolutionReason, 'default')
  assert.equal(resolution.resolvedVariant.id, DEFAULT_DASHBOARD_VARIANT_ID)
  assert.equal(resolution.isRunnable, true)
  assert.equal(resolution.hostAvailability, 'runnable')
  assert.equal(resolution.fallbackFromVariantId, null)
})

test('dashboard variant resolver keeps historical-v1 explicit and truthfully non-runnable', () => {
  const resolution = resolveDashboardVariant({ requestedVariantId: 'historical-v1' })

  assert.equal(resolution.resolutionReason, 'requested')
  assert.equal(resolution.requestMatchedRegistry, true)
  assert.equal(resolution.resolvedVariant.id, 'historical-v1')
  assert.equal(resolution.hostAvailability, 'provenance-only')
  assert.equal(resolution.isRunnable, false)
})

test('dashboard variant resolver keeps forecast-portfolio-v3 explicit and planned', () => {
  const resolution = resolveDashboardVariant({ requestedVariantId: 'forecast-portfolio-v3', embedded: true })

  assert.equal(resolution.host, 'embedded')
  assert.equal(resolution.resolutionReason, 'requested')
  assert.equal(resolution.resolvedVariant.id, 'forecast-portfolio-v3')
  assert.equal(resolution.hostAvailability, 'planned')
  assert.equal(resolution.isRunnable, false)
})

test('dashboard variant resolver falls back unknown variant ids to the active baseline', () => {
  const resolution = resolveDashboardVariant({ requestedVariantId: 'unknown-variant' })

  assert.equal(resolution.resolutionReason, 'unknown-fallback')
  assert.equal(resolution.requestMatchedRegistry, false)
  assert.equal(resolution.resolvedVariant.id, DEFAULT_DASHBOARD_VARIANT_ID)
  assert.equal(resolution.fallbackFromVariantId, 'unknown-variant')
  assert.equal(resolution.isRunnable, true)
})

test('standalone switcher only exposes runnable standalone variants', () => {
  const variants = getStandaloneSwitcherVariants()

  assert.deepEqual(variants.map((variant) => variant.id), ['finder-embedded-v2'])
})

test('dashboard variant href preserves host contract params when switching back to the default variant', () => {
  const href = buildDashboardVariantHref({
    locale: 'pl',
    searchParams: {
      embed: '1',
      seriesId: 'wocaes0282',
      range: '1Y',
      displayName: 'Brent',
      variantId: 'historical-v1',
    },
    variantId: 'finder-embedded-v2',
  })

  assert.equal(href, '/pl?embed=1&seriesId=wocaes0282&range=1Y&displayName=Brent')
})

test('dashboard variant href adds explicit non-default variant ids without dropping existing params', () => {
  const href = buildDashboardVariantHref({
    locale: 'en',
    searchParams: {
      seriesId: 'wocaes0282',
      range: '3Y',
    },
    variantId: 'forecast-portfolio-v3',
  })

  assert.equal(href, '/en?seriesId=wocaes0282&range=3Y&variantId=forecast-portfolio-v3')
})