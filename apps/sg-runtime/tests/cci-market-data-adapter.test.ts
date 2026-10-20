import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareCciMarketData } from '../lib/cost-analysis/market-data-adapter'
import type { CciMarketDataRequest } from '../lib/cost-analysis/market-data-contracts'

function fixture(frequency: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'): CciMarketDataRequest {
  return { modelKey: 'synthetic-category', baseNodeStart: '2024-01-01', range: { start: '2024-01-01', endExclusive: '2025-01-01' },
    cutoff: '2025-01-01', availability: 'RETROSPECTIVE_CURRENT_HISTORY', alignmentPolicy: 'STRICT_COMMON_NODES', nodeBasis: 'END_OF_PERIOD',
    currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' }, components: [{ componentId: 'copper', weightPercent: 100, benchmarkSeriesId: 'fixture',
      history: { displayName: 'fixture', frequency, currency: 'USD', unit: 'USD/tonne', source: 'synthetic fixture',
        providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: 'fixture' },
        historical: [{ date: '2024-01-01', value: 100 }] },
      qualification: { valueKind: 'PRICE_INDEX', calendar: 'UTC_CALENDAR', periodBasis: 'END_OF_PERIOD', evidenceRef: 'fixture-reviewed-semantics-v1' },
      reduction: { method: 'NATIVE_ONLY' }, snapshot: { retrievedAt: null, revisionRef: null } }] }
}

test('monthly preparation readiness does not assert that the Core was executed', () => {
  const result = prepareCciMarketData(fixture('MONTHLY'))
  assert.equal(result.coreCompatibility, 'MONTHLY_PREPARATION_READY')
  assert.equal(result.nodes[0].components[0].value, 100)
  assert.equal(Object.hasOwn(result, 'cciInput'), false)
  assert.equal(Object.hasOwn(result, 'calculation'), false)
})

for (const frequency of ['DAILY', 'QUARTERLY', 'ANNUAL'] as const) {
  test(`L: ${frequency} preparation explicitly refuses the monthly Core boundary`, () => {
    const result = prepareCciMarketData(fixture(frequency))
    assert.equal(result.analysisCadence, frequency)
    assert.equal(result.coreCompatibility, 'CORE_CADENCE_NOT_SUPPORTED')
    assert.equal(result.series[0].sourceObservations.length, 1)
    assert.equal(Object.hasOwn(result, 'cciInput'), false)
  })
}

test('unverified historical as-of blocks even otherwise lawful monthly preparation', () => {
  const result = prepareCciMarketData({ ...fixture('MONTHLY'), availability: 'HISTORICAL_AS_OF' })
  assert.equal(result.coreCompatibility, 'BLOCKED')
  assert.ok(result.issues.some(i => i.code === 'HISTORICAL_AS_OF_UNSUPPORTED'))
})
