import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCciFromMarketData, prepareCciNodeInput, type CciNodesCalculated } from '../lib/cost-analysis/node-integration'
import { calculateCciNodes } from '../lib/cost-analysis/cci-node-calculation'
import { calculateMonthlyCci } from '../lib/cost-analysis/monthly-integration'
import { createCalendarTargetPeriod } from '../lib/forecast/cadence'
import type { CciCadence, CciMarketComponent, CciMarketDataRequest } from '../lib/cost-analysis/market-data-contracts'

function component(id: string, frequency: CciCadence, points: readonly { date: string; value: number | null }[], weightPercent: number): CciMarketComponent {
  return { componentId: id, weightPercent, benchmarkSeriesId: id,
    history: { providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: id, providerSeriesKey: id },
      displayName: id, frequency, currency: id === 'copper' ? 'USD' : 'EUR', unit: 'price index', source: 'synthetic fixture', historical: [...points] },
    qualification: { valueKind: 'PRICE_INDEX', periodBasis: 'END_OF_PERIOD', calendar: 'UTC_CALENDAR', evidenceRef: `reviewed-${id}-native-v1` },
    reduction: { method: 'END_OF_PERIOD', approvalRef: `approved-${id}-closed-end-v1` }, snapshot: { retrievedAt: null, revisionRef: null } }
}
function fixture(cadence: CciCadence, sourceCadences: readonly [CciCadence, CciCadence] = [cadence, cadence]): CciMarketDataRequest {
  const middle = createCalendarTargetPeriod('2024-01-01', cadence)
  const previous = createCalendarTargetPeriod(new Date(middle.start.getTime() - 1), cadence)
  const after = createCalendarTargetPeriod(middle.endExclusive, cadence)
  const periods = [previous, middle, after]
  const components = sourceCadences.map((source, index) => {
    const points: { date: string; value: number }[] = []
    periods.forEach((period, i) => {
      let native = createCalendarTargetPeriod(period.start, source)
      while (native.start < period.endExclusive) {
        // These are distinct supplied native observations, not resampling inside production.
        points.push({ date: native.start.toISOString(), value: index === 0 ? [80, 100, 120][i] : [110, 100, 90][i] })
        native = createCalendarTargetPeriod(native.endExclusive, source)
      }
    })
    return component(index === 0 ? 'copper' : 'energy', source, points, index === 0 ? 60 : 40)
  })
  return { modelKey: 'fixture-category', baseNodeStart: middle.start.toISOString(), analysisCadence: cadence,
    range: { start: previous.start.toISOString(), endExclusive: after.endExclusive.toISOString() }, cutoff: after.endExclusive.toISOString(),
    availability: 'RETROSPECTIVE_CURRENT_HISTORY', alignmentPolicy: 'STRICT_COMMON_NODES', nodeBasis: 'END_OF_PERIOD',
    currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' }, components }
}
function calculate(input: CciMarketDataRequest): CciNodesCalculated {
  const result = calculateCciFromMarketData(input)
  if (result.status !== 'CALCULATED') assert.fail(JSON.stringify(result))
  return result
}
function near(value: number | null, expected: number) { assert.ok(value !== null && Math.abs(value - expected) < 1e-10) }

for (const cadence of ['DAILY', 'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'QUADMONTHLY', 'SEMIANNUAL', 'ANNUAL'] as const) {
  test(`A: real history → adapter → ${cadence} Core calculates both directions and PoP`, () => {
    const result = calculate(fixture(cadence))
    assert.equal(result.status, 'CALCULATED')
    assert.equal(result.completeness, 'COMPLETE')
    assert.equal(result.alignment.analysisCadence, cadence)
    assert.deepEqual(result.alignment.series.map(s => s.nativeCadence), [cadence, cadence])
    assert.equal(Object.hasOwn(result.alignment, 'coreCompatibility'), false)
    assert.equal(result.calculation.nodes.length, 3)
    assert.deepEqual(result.calculation, calculateCciNodes(result.cciInput))
    result.calculation.nodes.forEach((n, i) => near(n.cci, [92, 100, 108][i]))
    assert.equal(result.calculation.nodes[1].cci, 100)
    near(result.calculation.nodes[1].periodOverPeriodChangePercent, (100 / 92 - 1) * 100)
    near(result.calculation.nodes[2].periodOverPeriodChangePercent, 8)
    for (const n of result.calculation.nodes) near(n.components.reduce((sum, c) => sum + c.contributionPercentagePoints!, 0), n.cci! - 100)
    assert.deepEqual(result.calculation.nodes.map(n => n.period), result.alignment.nodes.map(n => n.period))
    assert.deepEqual(result.cciInput.inputSemantics.currencyPolicy, { kind: 'NATIVE_CURRENCY_RELATIVES' })
    assert.ok(!result.limitations.some(l => l.includes('PRE_BASE_CALCULATION_DEFERRED')))
  })
}

const mixed: readonly [CciCadence, CciCadence, CciCadence][] = [
  ['DAILY', 'MONTHLY', 'MONTHLY'], ['MONTHLY', 'QUARTERLY', 'QUARTERLY'],
  ['QUARTERLY', 'ANNUAL', 'ANNUAL'], ['BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL'], ['DAILY', 'ANNUAL', 'ANNUAL'],
]
for (const [left, right, common] of mixed) {
  test(`B: ${left} + ${right} genuinely calculate on lawful ${common} nodes`, () => {
    const input = fixture(common, [left, right])
    const { analysisCadence: _requested, ...derived } = input
    const result = calculate(derived)
    assert.equal(result.calculation.analysisCadence, common)
    assert.deepEqual(result.alignment.series.map(s => s.nativeCadence), [left, right])
    result.calculation.nodes.forEach((n, i) => near(n.cci, [92, 100, 108][i]))
    assert.equal(result.calculation.nodes[1].cci, 100)
    assert.ok(result.methodology.definition.components.every(c => c.methods.length > 0))
    assert.equal(result.methodology.definition.analysisCadence, common)
  })
}

test('preparation is PREPARED with no calculation; actual calculation is a separate operation', () => {
  const input = fixture('ANNUAL'), result = prepareCciNodeInput(input)
  assert.equal(result.status, 'PREPARED')
  assert.equal(result.calculation, null)
  assert.equal(calculate(input).status, 'CALCULATED')
})

test('unchanged monthly integration remains forward-only while new monthly node path includes pre-base', () => {
  const input = fixture('MONTHLY'), generic = calculate(input), legacy = calculateMonthlyCci(input)
  assert.equal(legacy.status, 'CALCULATED')
  if (legacy.status !== 'CALCULATED') assert.fail('Legacy monthly calculation failed')
  assert.equal(legacy.calculation.monthly.length, 2)
  assert.equal(generic.calculation.nodes.length, 3)
  assert.equal(legacy.calculation.monthly[0].monthOverMonthChangePercent, null)
  assert.notEqual(generic.calculation.nodes[1].periodOverPeriodChangePercent, null)
  assert.deepEqual(legacy.calculation.monthly[1].components, generic.calculation.nodes[2].components)
})

test('missing pre/post-base components stay INCOMPLETE; cumulative values resume without bridging gaps', () => {
  const input = fixture('QUARTERLY')
  const components = input.components.map(c => c.componentId !== 'energy' ? c : { ...c,
    history: { ...c.history, historical: c.history.historical.map((p, i) => ({ ...p, value: i === 0 ? null : p.value })) } })
  const result = calculate({ ...input, components })
  assert.equal(result.completeness, 'INCOMPLETE')
  assert.equal(result.calculation.nodes[0].cci, null)
  assert.equal(result.calculation.nodes[1].cci, 100)
  assert.equal(result.calculation.nodes[1].periodOverPeriodChangePercent, null)
  assert.equal(result.calculation.nodes[1].periodOverPeriodUnavailableReason, 'PREVIOUS_NODE_INCOMPLETE')
})

for (const policy of ['NO_APPROVAL', 'UNVERIFIED_FX', 'HISTORICAL_AS_OF', 'MISSING_BASE', 'MISALIGNED_BASE', 'OPEN_BASE', 'UNKNOWN_FREQUENCY'] as const) {
  test(`methodological refusal remains a refusal: ${policy}`, () => {
    const input = fixture('MONTHLY')
    const altered = policy === 'NO_APPROVAL' ? { ...fixture('MONTHLY', ['DAILY', 'MONTHLY']), components: fixture('MONTHLY', ['DAILY', 'MONTHLY']).components.map(c => ({ ...c, reduction: { method: 'NATIVE_ONLY' as const } })) }
      : policy === 'UNVERIFIED_FX' ? { ...input, currencyPolicy: { kind: 'PRECONVERTED_COMMON_CURRENCY' as const, currency: 'PLN', conversionPolicyId: 'unverified' } }
        : policy === 'HISTORICAL_AS_OF' ? { ...input, availability: 'HISTORICAL_AS_OF' as const }
          : policy === 'MISSING_BASE' ? { ...input, components: input.components.map(c => ({ ...c, history: { ...c.history, historical: c.history.historical.filter((_, i) => i !== 1) } })) }
            : policy === 'MISALIGNED_BASE' ? { ...input, baseNodeStart: '2024-01-15' }
              : policy === 'OPEN_BASE' ? { ...input, cutoff: input.baseNodeStart }
                : { ...input, components: input.components.map(c => ({ ...c, history: { ...c.history, frequency: 'UNKNOWN' } })) }
    const result = calculateCciFromMarketData(altered)
    assert.equal(result.status, 'REFUSED')
    assert.equal(result.cciInput, null)
    assert.equal(result.calculation, null)
  })
}

test('bimonthly + quarterly cannot be forced to fabricated quarters', () => {
  const input = fixture('SEMIANNUAL', ['BIMONTHLY', 'QUARTERLY'])
  const result = calculateCciFromMarketData({ ...input, analysisCadence: 'QUARTERLY' })
  assert.equal(result.status, 'REFUSED')
  assert.equal(result.calculation, null)
})

test('zero-weight series need no observations and preserve original weights', () => {
  const input = fixture('ANNUAL')
  const result = calculate({ ...input, components: [...input.components, component('ignored', 'MONTHLY', [], 0)] })
  assert.equal(result.calculation.nodes[0].components[2].contributionPercentagePoints, 0)
  assert.equal(result.calculation.nodes[1].cci, 100)
})

test('stable methodology, immutable provenance and deterministic inputs with no external retrieval', () => {
  const input = fixture('ANNUAL'), copy = structuredClone(input), oldFetch = globalThis.fetch
  globalThis.fetch = (() => { throw Error('External provider retrieval forbidden') }) as typeof fetch
  try {
    const first = calculate(input), second = calculate({ ...input, components: [...input.components].reverse() })
    assert.deepEqual(first, second)
    assert.deepEqual(input, copy)
    assert.equal(Object.isFrozen(input.components[0].history), false)
    assert.equal(Object.isFrozen(first.alignment.nodes[0].period), true)
    assert.equal(Object.isFrozen(first.calculation.nodes[0].components[0]), true)
    assert.equal(first.methodology.id, first.cciInput.inputSemantics.preparationPolicyId)
    assert.equal(first.methodology.definition.mappingVersion, 'CCI_NODE_MAPPING_V1')
  } finally { globalThis.fetch = oldFetch }
})
