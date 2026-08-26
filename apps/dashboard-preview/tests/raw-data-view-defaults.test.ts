import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveDefaultForecastTargetBasis } from '@/components/raw-data-view/index'

test('forecast-portfolio-v3 defaults target basis to point in time', () => {
  assert.equal(resolveDefaultForecastTargetBasis('forecast-portfolio-v3'), 'POINT_IN_TIME')
})

test('non-forecast variants keep the monthly-average default target basis', () => {
  assert.equal(resolveDefaultForecastTargetBasis('historical-v1'), 'MONTHLY_AVERAGE')
  assert.equal(resolveDefaultForecastTargetBasis('finder-embedded-v2'), 'MONTHLY_AVERAGE')
})
