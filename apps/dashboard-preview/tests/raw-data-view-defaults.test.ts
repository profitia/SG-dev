import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveDefaultForecastTargetBasis,
  resolveInitialForecastVerificationVisibility,
  resolveInitialForecastVisibility,
  shouldHideEmbeddedBenchmarkShell,
} from '@/components/raw-data-view/index'

test('forecast-portfolio-v3 defaults target basis to point in time', () => {
  assert.equal(resolveDefaultForecastTargetBasis('forecast-portfolio-v3'), 'POINT_IN_TIME')
})

test('non-forecast variants keep the monthly-average default target basis', () => {
  assert.equal(resolveDefaultForecastTargetBasis('historical-v1'), 'MONTHLY_AVERAGE')
  assert.equal(resolveDefaultForecastTargetBasis('finder-embedded-v2'), 'MONTHLY_AVERAGE')
})

test('forecast-portfolio-v3 stays historical-first when embedded', () => {
  assert.equal(resolveInitialForecastVisibility('forecast-portfolio-v3', true), false)
  assert.equal(resolveInitialForecastVerificationVisibility('forecast-portfolio-v3', true), false)
})

test('forecast-portfolio-v3 still defaults forecast-on in standalone mode', () => {
  assert.equal(resolveInitialForecastVisibility('forecast-portfolio-v3', false), true)
  assert.equal(resolveInitialForecastVerificationVisibility('forecast-portfolio-v3', false), true)
})

test('embedded forecast-portfolio-v3 keeps the benchmark shell visible for controls', () => {
  assert.equal(shouldHideEmbeddedBenchmarkShell(true, true, true), false)
  assert.equal(shouldHideEmbeddedBenchmarkShell(true, true, false), true)
})
