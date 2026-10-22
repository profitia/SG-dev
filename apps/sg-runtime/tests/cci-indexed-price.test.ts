import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCciIndexedPrice, CciIndexedPriceValidationError, CCI_PRICE_NUMERIC_POLICY } from '../lib/cost-analysis/cci-indexed-price'
import type { CciIndexedPriceInput, CciIndexedPriceResult, CciIndexedPriceValidationCode, CciPurchasePriceAnchor, CciPurchasePriceAmount } from '../lib/cost-analysis/cci-indexed-price-contracts'
import { calculateCciNodes } from '../lib/cost-analysis/cci-node-calculation'
import { calculateCciFromMarketData } from '../lib/cost-analysis/node-integration'
import type { CciNodeInput, CciNodesResult } from '../lib/cost-analysis/cci-node-contracts'
import type { CciCadence, CciMarketDataRequest } from '../lib/cost-analysis/market-data-contracts'
import type { CciIndex } from '../lib/cost-analysis/contracts'

const iso = (day: string) => `${day}T00:00:00.000Z`
const calendars: Record<CciCadence, readonly string[]> = {
  DAILY: ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'],
  WEEKLY: ['2023-12-25', '2024-01-01', '2024-01-08', '2024-01-15'],
  MONTHLY: ['2024-04-01', '2024-05-01', '2024-06-01', '2024-07-01'],
  BIMONTHLY: ['2024-03-01', '2024-05-01', '2024-07-01', '2024-09-01'],
  QUARTERLY: ['2023-10-01', '2024-01-01', '2024-04-01', '2024-07-01'],
  QUADMONTHLY: ['2023-09-01', '2024-01-01', '2024-05-01', '2024-09-01'],
  SEMIANNUAL: ['2023-07-01', '2024-01-01', '2024-07-01', '2025-01-01'],
  ANNUAL: ['2023-01-01', '2024-01-01', '2025-01-01', '2026-01-01'],
}
const identities = [
  { componentId: 'copper', weightPercent: 60 }, { componentId: 'pvc', weightPercent: 20 },
  { componentId: 'energy', weightPercent: 10 }, { componentId: 'labor', weightPercent: 7 }, { componentId: 'transport', weightPercent: 3 },
]
function fixture(cadence: CciCadence = 'MONTHLY', levels: readonly (readonly (number | null)[])[] = [
  [90, 90, 90, 90, 90], [100, 100, 100, 100, 100], [110, 110, 110, 110, 110],
]): CciNodeInput {
  const dates = calendars[cadence]
  return { modelKey: 'synthetic-copper-cable', baseNodeStart: iso(dates[1]), analysisCadence: cadence, nodeBasis: 'END_OF_PERIOD', cutoff: iso(dates[3]),
    inputSemantics: { preparationPolicyId: 'reviewed-synthetic-native-v1', currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' } },
    components: identities, nodes: levels.map((values, i) => ({ period: { cadence, start: iso(dates[i]), endExclusive: iso(dates[i + 1]) },
      status: values.includes(null) ? 'INCOMPLETE' : 'COMPLETE', components: identities.map((c, j) => ({ ...c, value: values[j],
        status: values[j] === null ? 'MISSING_OBSERVATION' : 'COMPLETE', method: null, sourceDates: [iso(dates[i])], coverage: 'NATIVE_PERIOD' })) })) }
}
function anchor(calculation: CciNodesResult, changes: Partial<CciPurchasePriceAnchor> = {}): CciPurchasePriceAnchor {
  return { amount: 1000, currency: 'PLN', unit: 'mb', purchaseDate: calculation.baseNode.start.slice(0, 10),
    referenceNodeStart: calculation.baseNode.start, taxBasis: 'NET', deliveryBasis: { kind: 'UNKNOWN' },
    modeledPriceScope: 'FULL_PURCHASE_PRICE_ALLOCATED_TO_DECLARED_COMPONENTS',
    periodMapping: calculation.analysisCadence === 'DAILY' ? { kind: 'EXACT_PURCHASE_DAY' }
      : { kind: 'EXPLICIT_ECONOMIC_PERIOD', policyId: 'synthetic-period-association-v1', approvalRef: 'explicit-fixture-review', interpretation: 'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE' },
    ...changes }
}
function calculate(input = fixture(), changes: Partial<CciPurchasePriceAnchor> = {}) {
  const calculation = calculateCciNodes(input)
  return calculateCciIndexedPrice({ calculation, basePrice: anchor(calculation, changes) })
}
function near(actual: number | null, expected: number, scale = Math.max(Math.abs(expected), 1000)) {
  assert.ok(actual !== null && Math.abs(actual - expected) <= scale * CCI_PRICE_NUMERIC_POLICY.relativeReconciliationTolerance, `${actual} != ${expected}`)
}
function identitiesHold(result: CciIndexedPriceResult): void {
  for (const n of result.nodes) {
    if (n.status !== 'COMPLETE') continue
    const scale = Math.max(result.basePrice.amount, n.categoryIndexedPrice)
    near(n.categoryIndexedPrice, result.basePrice.amount * (n.cci / 100), scale)
    near(n.components.reduce((s, c) => s + c.indexedComponentPrice!, 0), n.categoryIndexedPrice, scale)
    near(n.components.reduce((s, c) => s + c.componentPriceChange!, 0), n.categoryPriceChange, scale)
    for (const c of n.components) {
      near(c.componentPriceChange, c.contributionAmount!, Math.max(c.baseAllocatedPrice, c.indexedComponentPrice!))
      if (c.status === 'COMPLETE') near(c.contributionAmount, result.basePrice.amount * (c.contributionPercentagePoints / 100), scale)
    }
  }
}
function rejects(input: unknown, code: CciIndexedPriceValidationCode) {
  assert.throws(() => calculateCciIndexedPrice(input as CciIndexedPriceInput), error => error instanceof CciIndexedPriceValidationError && error.issue.code === code)
}
function withAnchor(changes: Record<string, unknown>): unknown {
  const calculation = calculateCciNodes(fixture())
  return { calculation, basePrice: { ...anchor(calculation), ...changes } }
}

test('A: exact base 1000 and allocated 600/200/100/70/30, with no invented margin', () => {
  const result = calculate(), base = result.nodes[1]
  assert.equal(base.categoryIndexedPrice, 1000)
  assert.equal(base.categoryPriceChange, 0)
  assert.equal(base.categoryPriceChangePercent, 0)
  const expected: Record<string, number> = { copper: 600, pvc: 200, energy: 100, labor: 70, transport: 30 }
  assert.equal(base.components.length, 5)
  for (const c of base.components) {
    near(c.baseAllocatedPrice, expected[c.componentId])
    assert.equal(c.indexedComponentPrice, c.baseAllocatedPrice)
    assert.equal(c.componentPriceChange, 0)
    assert.equal(c.contributionAmount, 0)
  }
  assert.equal(base.components.reduce((s, c) => s + c.indexedComponentPrice!, 0), 1000)
  identitiesHold(result)
})

test('B: February 900, May 1000, June 1100, from real Core before/after the purchase anchor', () => {
  const input = fixture()
  const first = { ...input.nodes[0], period: { cadence: 'MONTHLY' as const, start: iso('2024-02-01'), endExclusive: iso('2024-03-01') } }
  const result = calculate({ ...input, nodes: [first, ...input.nodes.slice(1)] }, { purchaseDate: '2024-05-15' })
  result.nodes.forEach((n, i) => near(n.categoryIndexedPrice, [900, 1000, 1100][i]))
  assert.equal(result.basePrice.purchaseDate, '2024-05-15')
  assert.equal(result.nodes.length, 3)
  assert.equal(result.missingIntervals.length, 1)
  assert.ok(result.nodes[0].categoryIndexedPrice! !== 1000 * 1000 / result.nodes[2].categoryIndexedPrice!)
  identitiesHold(result)
})

test('C/D: independent five-component opposing movements and monetary contributions reconcile', () => {
  const result = calculate(fixture('MONTHLY', [[80, 120, 90, 103, 95], [100, 100, 100, 100, 100], [90, 105, 130, 102, 97]]))
  const expected: Record<string, number> = { copper: 540, pvc: 210, energy: 130, labor: 71.4, transport: 29.1 }
  const changes: Record<string, number> = { copper: -60, pvc: 10, energy: 30, labor: 1.4, transport: -0.9 }
  for (const c of result.nodes[2].components) {
    near(c.indexedComponentPrice, expected[c.componentId])
    near(c.componentPriceChange, changes[c.componentId])
    near(c.contributionAmount, changes[c.componentId])
  }
  near(result.nodes[2].categoryIndexedPrice, 980.5)
  near(result.nodes[2].categoryPriceChange, -19.5)
  identitiesHold(result)
})

for (const cadence of Object.keys(calendars) as CciCadence[]) {
  test(`E: ${cadence} actual Core → price, before/base/after, precise original period identities`, () => {
    const input = fixture(cadence), calculation = calculateCciNodes(input), result = calculateCciIndexedPrice({ calculation, basePrice: anchor(calculation) })
    assert.equal(result.analysisCadence, cadence)
    assert.equal(result.nodes.length, calculation.nodes.length)
    assert.deepEqual(result.nodes.map(n => n.period), calculation.nodes.map(n => n.period))
    assert.deepEqual(result.sourceCalculation, calculation)
    assert.deepEqual(result.baseNode, calculation.baseNode)
    result.nodes.forEach((n, i) => near(n.categoryIndexedPrice, [900, 1000, 1100][i]))
    assert.equal(result.nodes[1].categoryIndexedPrice, 1000)
    identitiesHold(result)
  })
  for (const index of [0, 2]) {
    test(`F: ${cadence} missing component ${index === 0 ? 'before' : 'after'} base keeps partial/null semantics`, () => {
      const levels = [[90, 90, 90, 90, 90], [100, 100, 100, 100, 100], [110, 110, 110, 110, 110]] as (number | null)[][]
      levels[index][0] = null
      const result = calculate(fixture(cadence, levels)), n = result.nodes[index]
      assert.equal(result.status, 'INCOMPLETE')
      assert.equal(n.status, 'INCOMPLETE')
      assert.equal(n.categoryIndexedPrice, null)
      assert.equal(n.categoryPriceChange, null)
      assert.equal(n.categoryPriceChangePercent, null)
      assert.deepEqual(n.missingComponentIds, ['copper'])
      assert.ok(n.limitations.includes('PARTIAL_COMPONENTS_NOT_A_CATEGORY_TOTAL'))
      const missing = n.components.find(c => c.componentId === 'copper')!
      assert.equal(missing.status, 'MISSING_OBSERVATION')
      assert.equal(missing.baseAllocatedPrice, 600)
      assert.equal(missing.indexedComponentPrice, null)
      assert.equal(missing.componentPriceChange, null)
      assert.equal(missing.contributionAmount, null)
      for (const c of n.components.filter(c => c.componentId !== 'copper')) assert.equal(c.status, 'PARTIAL_NODE')
      assert.deepEqual(n.components.map(c => c.weightPercent), result.sourceCalculation.components.map(c => c.weightPercent))
      assert.equal(result.nodes[1].categoryIndexedPrice, 1000)
      identitiesHold(result)
    })
  }
}

test('G: omitted Q2 remains a gap, without a manufactured price or interpolation', () => {
  const input = fixture('QUARTERLY'), nodes = [input.nodes[0], input.nodes[2]]
  const calculation = calculateCciNodes({ ...input, baseNodeStart: nodes[0].period.start, nodes })
  const result = calculateCciIndexedPrice({ calculation, basePrice: anchor(calculation) })
  assert.equal(result.nodes.length, 2)
  assert.deepEqual(result.missingIntervals, calculation.missingIntervals)
  assert.equal(result.status, 'INCOMPLETE')
  assert.equal(result.sourceCalculation.nodes[1].periodOverPeriodUnavailableReason, 'NON_ADJACENT_PERIODS')
  assert.ok(result.nodes.every(n => n.categoryIndexedPrice !== null))
  identitiesHold(result)
})

test('H: incorrect base reference is refused without shifting the CCI base', () => {
  rejects(withAnchor({ referenceNodeStart: iso('2024-06-01') }), 'BASE_REFERENCE_MISMATCH')
  rejects(withAnchor({ referenceNodeStart: '2024-05' }), 'BASE_REFERENCE_MISMATCH')
})

test('I: selected-period membership is half-open and an interior transaction day is accepted only explicitly', () => {
  assert.equal(calculate(fixture(), { purchaseDate: '2024-05-15' }).basePrice.purchaseDate, '2024-05-15')
  assert.equal(calculate(fixture(), { purchaseDate: '2024-05-31' }).nodes[1].categoryIndexedPrice, 1000)
  rejects(withAnchor({ purchaseDate: '2024-04-30' }), 'PURCHASE_OUTSIDE_BASE_PERIOD')
  rejects(withAnchor({ purchaseDate: '2024-06-01' }), 'PURCHASE_OUTSIDE_BASE_PERIOD')
  rejects(withAnchor({ periodMapping: undefined }), 'UNAPPROVED_PERIOD_MAPPING')
  rejects(withAnchor({ periodMapping: { kind: 'EXACT_PURCHASE_DAY' } }), 'UNAPPROVED_PERIOD_MAPPING')
})

test('I: annual May purchase never acquires monthly precision or unapproved automatic mapping', () => {
  const calculation = calculateCciNodes(fixture('ANNUAL')), basePrice = anchor(calculation, { purchaseDate: '2024-05-15' })
  rejects({ calculation, basePrice: { ...basePrice, periodMapping: { kind: 'EXACT_PURCHASE_DAY' } } }, 'UNAPPROVED_PERIOD_MAPPING')
  rejects({ calculation, basePrice: { ...basePrice, periodMapping: { kind: 'EXPLICIT_ECONOMIC_PERIOD', policyId: 'p', approvalRef: '', interpretation: 'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE' } } }, 'UNAPPROVED_PERIOD_MAPPING')
  rejects({ calculation, basePrice: { ...basePrice, periodMapping: { kind: 'NEAREST_MONTH' } } }, 'UNAPPROVED_PERIOD_MAPPING')
  const result = calculateCciIndexedPrice({ calculation, basePrice })
  assert.equal(result.nodes[1].period.cadence, 'ANNUAL')
  assert.equal(result.nodes.length, 3)
  assert.ok(result.limitations.includes('PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE'))
  assert.ok(result.limitations.includes('HISTORICAL_PUBLICATION_AVAILABILITY_NOT_VERIFIED'))
})

for (const [currency, unit] of [['PLN', 'mb'], ['EUR', 'szt.'], ['USD', 't']]) {
  test(`J: ${currency}/${unit} remains the buyer's price unit, with explicit native-no-FX semantics`, () => {
    const result = calculate(fixture(), { currency, unit, taxBasis: 'GROSS', deliveryBasis: { kind: 'DECLARED', description: 'Delivered to buyer site' } })
    assert.equal(result.currency, currency)
    assert.equal(result.unit, unit)
    assert.equal(result.taxBasis, 'GROSS')
    assert.equal(result.deliveryBasis.kind, 'DECLARED')
    assert.equal(result.fxSemantics, 'NATIVE_CURRENCY_RELATIVES_NO_FX')
    near(result.nodes[2].categoryIndexedPrice, 1100)
  })
}

test('J: declared preconversion metadata is preserved, never promoted to verified historical FX', () => {
  const original = fixture(), policy = { kind: 'PRECONVERTED_COMMON_CURRENCY' as const, currency: 'EUR', conversionPolicyId: 'external-unverified-policy' }
  const result = calculate({ ...original, inputSemantics: { ...original.inputSemantics, currencyPolicy: policy } })
  assert.deepEqual(result.inputSemantics.currencyPolicy, policy)
  assert.equal(result.fxSemantics, 'DECLARED_PRECONVERSION_NOT_VERIFIED')
  assert.ok(result.limitations.includes('DECLARED_PRECONVERSION_NOT_VERIFIED'))
  assert.equal(result.currency, 'PLN')
})

for (const amount of [0, -1, NaN, Infinity, -Infinity]) test(`K: invalid base price ${amount} refused`, () => rejects(withAnchor({ amount }), 'INVALID_PRICE'))
for (const currency of ['', 'pln', 'PL', 'PLNN', ' PLN', 'PLN\n', 123]) test(`K: invalid currency ${JSON.stringify(currency)} refused`, () => rejects(withAnchor({ currency }), 'INVALID_CURRENCY'))
for (const unit of ['', ' ', ' mb', '\u0000mb', 'x'.repeat(65), null]) test(`K: invalid unit ${JSON.stringify(unit)} refused`, () => rejects(withAnchor({ unit }), 'INVALID_UNIT'))
for (const purchaseDate of ['', '2024-05', '2024-02-30', '2023-02-29', '2024-13-01', '2024-05-15T12:00:00Z', '0099-05-15']) test(`K: invalid purchase date ${purchaseDate} refused`, () => rejects(withAnchor({ purchaseDate }), 'INVALID_PURCHASE_DATE'))
for (const changes of [{ taxBasis: undefined }, { taxBasis: 'UNKNOWN' }, { deliveryBasis: undefined }, { deliveryBasis: { kind: 'DECLARED', description: '' } }, { modeledPriceScope: undefined }, { modeledPriceScope: 'MANUFACTURING_COST_ONLY' }]) {
  test(`K: explicit purchase assumptions required ${JSON.stringify(changes)}`, () => rejects(withAnchor(changes), 'INVALID_PRICE_ASSUMPTIONS'))
}

test('L: unrounded decimal prices reconcile at small and large safe scales, without residual correction', () => {
  for (const amount of [0.00000001, 1.2345678912345, 1234.5678912345, 1e12]) {
    const result = calculate(fixture('MONTHLY', [[93.123456789, 87.345678912, 97.876543219, 105.987654321, 99.567891234], [100, 100, 100, 100, 100], [111.123456789, 103.789123456, 114.876543219, 101.987654321, 104.567891234]]), { amount })
    identitiesHold(result)
    for (const n of result.nodes) for (const c of n.components) {
      assert.equal(c.baseAllocatedPrice, amount * (c.weightPercent / 100))
      assert.equal(c.indexedComponentPrice, c.baseAllocatedPrice * c.benchmarkRelative!)
    }
    assert.ok(result.nodes[2].categoryIndexedPrice! !== Math.round(result.nodes[2].categoryIndexedPrice! * 100) / 100)
  }
})

test('L: many non-integer weights and cancellation preserve reconciliation without normalization', () => {
  const original = fixture(), weights = [33.333333333333, 22.222222222222, 11.111111111111, 18.888888888889, 14.444444444445]
  const input = { ...original, components: original.components.map((c, i) => ({ ...c, weightPercent: weights[i] })),
    nodes: original.nodes.map(n => ({ ...n, components: n.components.map((c, i) => ({ ...c, weightPercent: weights[i] })) })) }
  const result = calculate(input, { amount: 1973.12789456 })
  identitiesHold(result)
  assert.deepEqual(result.sourceCalculation.components.map(c => c.weightPercent), [...result.sourceCalculation.components].map(c => weights[identities.findIndex(i => i.componentId === c.componentId)]))
})

test('L: price range rejects large, overflowed, subnormal and underflowed monetary values', () => {
  for (const amount of [Number.MAX_VALUE, Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE]) rejects(withAnchor({ amount }), 'NUMERIC_RANGE')
  const huge = calculateCciNodes(fixture('MONTHLY', [[100, 100, 100, 100, 100], [100, 100, 100, 100, 100], [1e305, 1e305, 1e305, 1e305, 1e305]]))
  rejects({ calculation: huge, basePrice: anchor(huge) }, 'NUMERIC_RANGE')
  const tiny = calculateCciNodes(fixture('MONTHLY', [[100, 100, 100, 100, 100], [100, 100, 100, 100, 100], [1e-298, 1e-298, 1e-298, 1e-298, 1e-298]]))
  rejects({ calculation: tiny, basePrice: anchor(tiny, { amount: 1e-30 }) }, 'NUMERIC_RANGE')
  rejects(withAnchor({ amount: 2 ** -1022 }), 'NUMERIC_RANGE') // positive allocations would be subnormal
})

test('L: corrupted authoritative monetary identities are refused, never repaired or reindexed', () => {
  const calculation = calculateCciNodes(fixture()), price = anchor(calculation)
  const changedIndex = { ...calculation, nodes: calculation.nodes.map((n, i) => i === 2 ? { ...n, cci: 120 } : n) }
  rejects({ calculation: changedIndex, basePrice: price }, 'RECONCILIATION_FAILED')
  const changedContribution = { ...calculation, nodes: calculation.nodes.map((n, i) => i === 2 ? { ...n, components: n.components.map((c, j) => j ? c : { ...c, contributionPercentagePoints: 88 }) } : n) }
  rejects({ calculation: changedContribution, basePrice: price }, 'RECONCILIATION_FAILED')
  rejects({ calculation: { ...calculation, nodes: calculation.nodes.slice(0, 1) }, basePrice: price }, 'INVALID_CCI_RESULT')
  rejects({ calculation: { ...calculation, status: 'INCOMPLETE' }, basePrice: price }, 'INVALID_CCI_RESULT')
})

test('M: zero weight needs no observations, produces exactly zero money without reweighting', () => {
  const input = fixture(), excluded = { componentId: 'zero', weightPercent: 0 }
  const result = calculate({ ...input, components: [...input.components, excluded], nodes: input.nodes.map(n => ({ ...n,
    components: [...n.components, { ...excluded, value: null, status: 'EXCLUDED_ZERO_WEIGHT', method: null, sourceDates: [], coverage: 'NONE' }] })) })
  for (const n of result.nodes) {
    const zero = n.components.find(c => c.componentId === 'zero')!
    assert.deepEqual([zero.baseAllocatedPrice, zero.indexedComponentPrice, zero.componentPriceChange, zero.contributionAmount], [0, 0, 0, 0])
    assert.equal(zero.status, 'EXCLUDED_ZERO_WEIGHT')
    assert.equal(zero.benchmarkRelative, null)
  }
  identitiesHold(result)
})

test('N: deterministic frozen owned result; neither mutates nor freezes caller data or metadata', () => {
  const calculation = calculateCciNodes(fixture()), basePrice = anchor(calculation), before = structuredClone({ calculation, basePrice })
  const first = calculateCciIndexedPrice({ calculation, basePrice }), second = calculateCciIndexedPrice({ calculation, basePrice })
  assert.deepEqual(first, second)
  assert.deepEqual({ calculation, basePrice }, before)
  assert.equal(Object.isFrozen(calculation), false)
  assert.equal(Object.isFrozen(calculation.nodes[0].components[0]), false)
  assert.equal(Object.isFrozen(basePrice.periodMapping), false)
  assert.notEqual(first.sourceCalculation, calculation)
  assert.notEqual(first.basePrice, basePrice)
  assert.equal(Object.isFrozen(first.sourceCalculation.nodes[0].components[0]), true)
  assert.equal(Object.isFrozen(first.basePrice.periodMapping), true)
  assert.equal(Object.isFrozen(first.nodes[0].components), true)
  ;(basePrice as { amount: number }).amount = 2000
  assert.equal(first.basePrice.amount, 1000)
})

function marketRequest(cadence: CciCadence): CciMarketDataRequest {
  const dates = calendars[cadence]
  return { modelKey: 'synthetic-provider-cable', baseNodeStart: iso(dates[1]), range: { start: iso(dates[0]), endExclusive: iso(dates[3]) },
    cutoff: iso(dates[3]), availability: 'RETROSPECTIVE_CURRENT_HISTORY', alignmentPolicy: 'STRICT_COMMON_NODES', analysisCadence: cadence,
    nodeBasis: 'END_OF_PERIOD', currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' }, components: identities.map((c, j) => ({ ...c,
      benchmarkSeriesId: c.componentId, history: { providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: c.componentId },
        displayName: c.componentId, frequency: cadence, currency: ['USD', 'EUR', 'PLN', null, 'EUR'][j], unit: ['t', 't', 'MWh', 'wage index', 'transport index'][j],
        source: 'synthetic deterministic fixture', historical: dates.slice(0, 3).map((date, i) => ({ date: iso(date), value: [80 + j * 3, 100, 120 - j * 3][i] })) },
      qualification: { valueKind: 'PRICE_LEVEL', periodBasis: 'END_OF_PERIOD', calendar: 'UTC_CALENDAR', evidenceRef: `reviewed-${c.componentId}` },
      reduction: { method: 'NATIVE_ONLY' }, snapshot: { retrievedAt: null, revisionRef: null } })) }
}
for (const cadence of Object.keys(calendars) as CciCadence[]) {
  test(`O: synthetic provider histories → existing adapter → Core → ${cadence} indexed decomposition`, () => {
    const request = marketRequest(cadence), before = structuredClone(request), pipeline = calculateCciFromMarketData(request)
    if (pipeline.status !== 'CALCULATED') assert.fail(JSON.stringify(pipeline))
    const result = calculateCciIndexedPrice({ calculation: pipeline.calculation, basePrice: anchor(pipeline.calculation) })
    assert.equal(result.preparationPolicyId, pipeline.methodology.id)
    assert.equal(result.cciMethodologyVersion, pipeline.calculation.methodologyVersion)
    assert.deepEqual(result.sourceCalculation, pipeline.calculation)
    assert.deepEqual(result.nodes.map(n => n.period), pipeline.alignment.nodes.map(n => n.period))
    assert.equal(result.nodes[1].categoryIndexedPrice, 1000)
    assert.ok(result.nodes[0].categoryIndexedPrice! < 1000)
    assert.ok(result.nodes[2].categoryIndexedPrice! > 1000)
    assert.equal(result.fxSemantics, 'NATIVE_CURRENCY_RELATIVES_NO_FX')
    assert.equal(result.unit, 'mb')
    assert.deepEqual(request, before)
    assert.equal(pipeline.alignment.series.find(s => s.componentId === 'copper')?.unit, 't')
    assert.equal(pipeline.alignment.series.find(s => s.componentId === 'copper')?.currency, 'USD')
    identitiesHold(result)
  })
}

test('O: real pipeline and financial layer execute with external I/O and implicit clock forbidden', () => {
  const request = marketRequest('MONTHLY'), oldFetch = globalThis.fetch, OriginalDate = Date
  class ExplicitDate extends OriginalDate {
    constructor(value?: string | number) { if (value === undefined) throw Error('Implicit clock forbidden'); super(value) }
    static now(): number { throw Error('System clock forbidden') }
  }
  globalThis.fetch = (() => { throw Error('Network forbidden') }) as typeof fetch
  globalThis.Date = ExplicitDate as DateConstructor
  try {
    const pipeline = calculateCciFromMarketData(request)
    if (pipeline.status !== 'CALCULATED') assert.fail(JSON.stringify(pipeline))
    const result = calculateCciIndexedPrice({ calculation: pipeline.calculation, basePrice: anchor(pipeline.calculation, { purchaseDate: '2024-05-15' }) })
    assert.equal(result.nodes[1].categoryIndexedPrice, 1000)
    identitiesHold(result)
  } finally { globalThis.fetch = oldFetch; globalThis.Date = OriginalDate }
})

// Compile-time semantic separation: a price amount cannot be passed as an index quantity.
function quantityTypes(price: CciPurchasePriceAmount) {
  // @ts-expect-error purchase-price amounts are not dimensionless CCI indices
  const index: CciIndex = price
  return index
}
void quantityTypes
