import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { calculateCci } from '../lib/cost-analysis/cci'
import { calculateMonthlyCci, prepareMonthlyCciInput, type CciMonthlyCalculated } from '../lib/cost-analysis/monthly-integration'
import type { CciMarketComponent, CciMarketDataRequest } from '../lib/cost-analysis/market-data-contracts'

function component(id: string, points: readonly (readonly [string, number | null])[], weight: number, frequency = 'MONTHLY'): CciMarketComponent {
  return { componentId: id, weightPercent: weight, benchmarkSeriesId: id,
    history: { providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: id, providerSeriesKey: id },
      displayName: id, frequency, currency: id === 'copper' ? 'USD' : 'EUR', unit: 'price index', source: 'synthetic fixture',
      historical: points.map(([date, value]) => ({ date, value })) },
    qualification: { valueKind: 'PRICE_INDEX', periodBasis: 'END_OF_PERIOD', calendar: 'UTC_CALENDAR', evidenceRef: `reviewed-${id}-v1` },
    reduction: { method: 'END_OF_PERIOD', approvalRef: `approved-${id}-end-of-period-v1` },
    snapshot: { retrievedAt: '2025-01-01', revisionRef: null } }
}

function request(components: readonly CciMarketComponent[] = [
  component('copper', [['2024-01-31', 100], ['2024-02-29', 110], ['2024-03-31', 121]], 60),
  component('energy', [['2024-01-01', 200], ['2024-02-01', 200], ['2024-03-01', 200]], 40),
], overrides: Partial<CciMarketDataRequest> = {}): CciMarketDataRequest {
  return { modelKey: 'synthetic-category', baseNodeStart: '2024-01-01', range: { start: '2024-01-01', endExclusive: '2024-04-01' },
    cutoff: '2024-04-01', availability: 'RETROSPECTIVE_CURRENT_HISTORY', alignmentPolicy: 'STRICT_COMMON_NODES', nodeBasis: 'END_OF_PERIOD',
    currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' }, components, ...overrides }
}

function calculated(input = request()): CciMonthlyCalculated {
  const result = calculateMonthlyCci(input)
  assert.equal(result.status, 'CALCULATED')
  if (result.status !== 'CALCULATED') throw new Error(JSON.stringify(result))
  return result
}

function near(actual: number | null, expected: number, tolerance = 1e-10) {
  assert.notEqual(actual, null)
  assert.ok(Math.abs(actual! - expected) <= tolerance, `${actual} != ${expected}`)
}

test('A/C: actual historical-series adapter → CciInput → original Core calculates 100, 106, 112.6', () => {
  const result = calculated()
  assert.equal(result.completeness, 'COMPLETE')
  assert.deepEqual(result.periods, { prepared: ['2024-01', '2024-02', '2024-03'], calculated: ['2024-01', '2024-02', '2024-03'] })
  assert.equal(result.cciInput.basePeriod, '2024-01')
  assert.equal(result.cciInput.inputSemantics.frequency, 'MONTHLY')
  assert.deepEqual(result.cciInput.inputSemantics.currencyPolicy, { kind: 'NATIVE_CURRENCY_RELATIVES' })
  assert.deepEqual(result.cciInput.components.map(c => [c.componentId, c.weightPercent]), [['copper', 60], ['energy', 40]])
  assert.deepEqual(result.cciInput.components[0].observations, [
    { period: '2024-01', value: 100 }, { period: '2024-02', value: 110 }, { period: '2024-03', value: 121 },
  ])
  // Both paths execute production calculateCci, never a local reimplementation.
  assert.deepEqual(result.calculation, calculateCci(result.cciInput))
  const [base, feb, mar] = result.calculation.monthly
  assert.equal(base.cci, 100)
  assert.equal(base.cumulativeChangePercent, 0)
  assert.equal(base.monthOverMonthChangePercent, null)
  near(feb.cci, 106)
  near(feb.cumulativeChangePercent, 6)
  near(feb.components[0].contributionPercentagePoints, 6)
  near(feb.components[1].contributionPercentagePoints, 0)
  near(mar.cci, 112.6)
  near(mar.monthOverMonthChangePercent, 6.22641509433962)
  assert.notEqual(mar.monthOverMonthChangePercent, 6)
  assert.deepEqual(result.alignment.series.map(s => s.currency), ['USD', 'EUR'])
})

for (const reduction of ['OBSERVATION_AVERAGE', 'END_OF_PERIOD'] as const) {
  test(`B: daily + monthly use approved ${reduction} levels in the real Core`, () => {
    const copper = component('copper', [['2024-01-02', 90], ['2024-01-31', 110], ['2024-02-02', 100], ['2024-02-29', 120]], 60, 'DAILY')
    const energy = component('energy', [['2024-01-01', 200], ['2024-02-01', 200]], 40)
    const basis = reduction === 'OBSERVATION_AVERAGE' ? 'PERIOD_AVERAGE' : 'END_OF_PERIOD'
    const result = calculated(request([
      { ...copper, reduction: { method: reduction, approvalRef: `reviewed-daily-${reduction}-v1` } },
      { ...energy, qualification: { ...energy.qualification, periodBasis: basis } },
    ], { nodeBasis: basis, range: { start: '2024-01-01', endExclusive: '2024-03-01' } }))
    assert.equal(result.alignment.analysisCadence, 'MONTHLY')
    assert.deepEqual(result.alignment.series.map(s => s.nativeCadence), ['DAILY', 'MONTHLY'])
    assert.equal(result.alignment.nodes[0].components[0].coverage, 'AVAILABLE_DAILY_OBSERVATIONS')
    const [base, next] = result.cciInput.components[0].observations
    assert.equal(base.value, reduction === 'OBSERVATION_AVERAGE' ? 100 : 110)
    assert.equal(next.value, reduction === 'OBSERVATION_AVERAGE' ? 110 : 120)
    near(result.calculation.monthly[1].cci, reduction === 'OBSERVATION_AVERAGE' ? 106 : 105.45454545454545)
    const methods = result.methodology.definition.components[0].methods
    assert.equal(methods[0].id, reduction === 'OBSERVATION_AVERAGE' ? 'AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS' : 'LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD')
    assert.ok(methods[0].version)
    assert.equal(methods[0].approvalRef, `reviewed-daily-${reduction}-v1`)
    assert.equal(result.methodology.definition.components[1].methods.length, 1)
  })
}

test('D: opposite changes retain contribution identity', () => {
  const result = calculated(request([
    component('copper', [['2024-01-01', 100], ['2024-02-01', 110]], 60),
    component('pvc', [['2024-01-01', 100], ['2024-02-01', 90]], 40),
  ], { range: { start: '2024-01-01', endExclusive: '2024-03-01' } }))
  near(result.calculation.monthly[1].cci, 102)
  near(result.calculation.monthly[1].components[1].contributionPercentagePoints, -4)
  for (const month of result.calculation.monthly) {
    assert.equal(month.status, 'COMPLETE')
    near(month.components.reduce((total, c) => total + c.contributionPercentagePoints!, 0), month.cci! - 100)
  }
})

for (const gap of ['ABSENT', 'EXPLICIT_NULL', 'ALL_ABSENT'] as const) {
  test(`E: ${gap} month stays null; MoM cannot bridge the gap`, () => {
    const copper = component('copper', [['2024-01-01', 100], ...(gap === 'ALL_ABSENT' ? [] : [['2024-02-01', 105] as const]), ['2024-03-01', 110], ['2024-04-01', 121]], 60)
    const energy = component('energy', [['2024-01-01', 100], ...(gap === 'EXPLICIT_NULL' ? [['2024-02-01', null] as const] : []), ['2024-03-01', 100], ['2024-04-01', 100]], 40)
    const result = calculated(request([copper, energy], { range: { start: '2024-01-01', endExclusive: '2024-05-01' }, cutoff: '2024-05-01' }))
    assert.equal(result.completeness, 'INCOMPLETE')
    const [, feb, mar, apr] = result.calculation.monthly
    assert.equal(feb.status, 'INCOMPLETE')
    assert.equal(feb.cci, null)
    assert.equal(feb.monthOverMonthChangePercent, null)
    assert.equal(result.cciInput.components[1].observations[1].value, null)
    assert.equal(mar.cci, 106)
    assert.equal(mar.monthOverMonthChangePercent, null)
    assert.equal(mar.monthOverMonthUnavailableReason, 'PREVIOUS_MONTH_INCOMPLETE')
    near(apr.monthOverMonthChangePercent, 6.22641509433962)
    assert.deepEqual(mar.components.map(c => c.weightPercent), [60, 40])
  })
}

test('E: trailing empty closed months are retained through the requested range', () => {
  const result = calculated(request([component('copper', [['2024-01-01', 100]], 100)]))
  assert.deepEqual(result.calculation.monthly.map(m => [m.period, m.cci]), [['2024-01', 100], ['2024-02', null], ['2024-03', null]])
})

for (const overrides of [
  { baseNodeStart: '2024-02-01' },
  { baseNodeStart: '2024-01-15' },
  { cutoff: '2024-01-15' },
] satisfies Partial<CciMarketDataRequest>[]) {
  test(`F: missing/open/misaligned base refuses without moving it: ${JSON.stringify(overrides)}`, () => {
    const result = calculateMonthlyCci(request([component('copper', [['2024-01-01', 100], ['2024-03-01', 120]], 100)], overrides))
    assert.equal(result.status, 'REFUSED')
    assert.equal(result.cciInput, null)
    assert.equal(result.calculation, null)
    if (result.status === 'REFUSED') assert.ok(result.issues.some(i => ['MISSING_BASE_NODE', 'BASE_NODE_NOT_ALIGNED'].includes(i.code)))
    assert.equal(result.alignment?.baseNodeStart.slice(0, 10), overrides.baseNodeStart ?? '2024-01-01')
  })
}

for (const frequency of ['QUARTERLY', 'ANNUAL']) {
  test(`G: valid ${frequency} history stays native and cannot enter monthly Core`, () => {
    const result = calculateMonthlyCci(request([component('copper', [['2024-01-01', 100]], 100, frequency)], {
      range: { start: '2024-01-01', endExclusive: '2025-01-01' }, cutoff: '2025-01-01',
    }))
    assert.equal(result.status, 'REFUSED')
    assert.equal(result.cciInput, null)
    assert.equal(result.calculation, null)
    assert.equal(result.alignment?.analysisCadence, frequency)
    assert.equal(result.alignment?.series[0].nativeCadence, frequency)
    if (result.status === 'REFUSED') assert.equal(result.reason, 'CORE_CADENCE_NOT_SUPPORTED')
  })
}

for (const overrides of [
  { currencyPolicy: { kind: 'PRECONVERTED_COMMON_CURRENCY', currency: 'PLN', conversionPolicyId: 'unverified' } },
  { availability: 'HISTORICAL_AS_OF' },
] satisfies Partial<CciMarketDataRequest>[]) {
  test(`H: unsupported FX/as-of cannot become a calculation: ${JSON.stringify(overrides)}`, () => {
    const result = calculateMonthlyCci(request(undefined, overrides))
    assert.equal(result.status, 'REFUSED')
    assert.equal(result.cciInput, null)
    assert.equal(result.calculation, null)
    if (result.status === 'REFUSED') assert.equal(result.reason, 'ALIGNMENT_BLOCKED')
    assert.ok(result.alignment?.issues.some(i => ['FX_CONVERSION_NOT_SUPPORTED', 'HISTORICAL_AS_OF_UNSUPPORTED'].includes(i.code)))
  })
}

test('preparation has its own status and never pretends to have calculated', () => {
  const result = prepareMonthlyCciInput(request())
  assert.equal(result.status, 'PREPARED')
  assert.equal(result.calculation, null)
  if (result.status === 'PREPARED') {
    assert.deepEqual(result.periods.calculated, [])
    assert.equal(result.completeness, 'COMPLETE')
    assert.deepEqual(result.cciInput, calculated().cciInput)
  }
})

test('pre-base data and missingness remain in provenance/input; output starts at explicit base', () => {
  const result = calculated(request([
    component('copper', [['2023-12-01', 90], ['2024-01-01', 100], ['2024-02-01', 110]], 60),
    component('energy', [['2024-01-01', 100], ['2024-02-01', 100]], 40),
  ], { range: { start: '2023-12-01', endExclusive: '2024-03-01' } }))
  assert.equal(result.alignment.status, 'INCOMPLETE')
  assert.equal(result.completeness, 'COMPLETE')
  assert.deepEqual(result.periods, { prepared: ['2023-12', '2024-01', '2024-02'], calculated: ['2024-01', '2024-02'] })
  assert.deepEqual(result.cciInput.components[1].observations[0], { period: '2023-12', value: null })
  assert.equal(result.alignment.series[0].sourceObservations[0].value, 90)
  assert.ok(result.limitations.includes('PRE_BASE_CALCULATION_DEFERRED_TO_TASK_02B'))
})

test('methodology identity includes actual methods/versions/policies in stable component order', () => {
  const input = request()
  const first = calculated(input)
  const reversed = calculated({ ...input, components: [...input.components].reverse() })
  assert.deepEqual(first, reversed)
  const reorderedMetadata = calculated({ ...input, components: input.components.map(c => ({ ...c,
    qualification: { evidenceRef: c.qualification.evidenceRef, calendar: c.qualification.calendar,
      periodBasis: c.qualification.periodBasis, valueKind: c.qualification.valueKind },
    reduction: c.reduction.method === 'NATIVE_ONLY' ? c.reduction : { approvalRef: c.reduction.approvalRef, method: c.reduction.method },
  })) })
  assert.equal(first.methodology.id, reorderedMetadata.methodology.id)
  assert.equal(first.methodology.scope, 'PREPARATION_METHODOLOGY_NOT_IMMUTABLE_SNAPSHOT')
  assert.equal(first.methodology.id, `cci-monthly-preparation-v1:${createHash('sha256').update(JSON.stringify(first.methodology.definition)).digest('hex')}`)
  assert.equal(first.cciInput.inputSemantics.monthlyPreparationPolicyId, first.methodology.id)
  assert.equal(first.methodology.definition.components[0].methods[0].version,
    first.alignment.nodes[0].components[0].method?.version)
  const changedPolicy = calculated({ ...input, components: input.components.map(c => ({ ...c,
    qualification: { ...c.qualification, evidenceRef: 'new-reviewed-methodology-v2' } })) })
  assert.notEqual(first.methodology.id, changedPolicy.methodology.id)
  const changedData = calculated({ ...input, components: input.components.map(c => ({ ...c,
    snapshot: { retrievedAt: '2025-02-01', revisionRef: 'revised' },
    history: { ...c.history, historical: c.history.historical.map(p => ({ ...p, value: p.value! * 2 })) } })) })
  assert.equal(first.methodology.id, changedData.methodology.id)
  assert.notEqual(first.alignment.series[0].historyFingerprint, changedData.alignment.series[0].historyFingerprint)
})

test('I: deterministic immutable output does not mutate or freeze caller objects', () => {
  const input = request()
  const before = structuredClone(input)
  const first = calculated(input)
  assert.deepEqual(first, calculated(input))
  assert.deepEqual(input, before)
  assert.equal(Object.isFrozen(input.components[0].history), false)
  assert.equal(Object.isFrozen(first.alignment.series[0].sourceObservations[0]), true)
  assert.equal(Object.isFrozen(first.cciInput.components[0].observations), true)
  assert.equal(Object.isFrozen(first.calculation.monthly[0].components[0]), true)
})

test('zero-weight series preserves identity without requiring a base or adding contribution', () => {
  const result = calculated(request([component('copper', [['2024-01-01', 100]], 100), component('excluded', [], 0)]))
  assert.equal(result.cciInput.components[1].weightPercent, 0)
  assert.equal(result.calculation.monthly[0].components[1].status, 'EXCLUDED_ZERO_WEIGHT')
  assert.equal(result.calculation.monthly[0].components[1].contributionPercentagePoints, 0)
})

for (const value of [0, -1, NaN, Infinity]) {
  test(`invalid source level ${value} returns an explicit refusal`, () => {
    const result = calculateMonthlyCci(request([component('copper', [['2024-01-01', value]], 100)]))
    assert.equal(result.status, 'REFUSED')
    if (result.status === 'REFUSED') {
      assert.equal(result.reason, 'INVALID_MARKET_DATA')
      assert.equal(result.issues[0].code, 'INVALID_PRICE_LEVEL')
    }
    assert.equal(result.calculation, null)
  })
}

test('Core numeric-range validation remains authoritative and becomes a typed refusal', () => {
  const result = calculateMonthlyCci(request([component('copper', [['2024-01-01', 1e-308], ['2024-02-01', 1e308]], 100)]))
  assert.equal(result.status, 'REFUSED')
  if (result.status === 'REFUSED') {
    assert.equal(result.reason, 'CORE_VALIDATION_FAILED')
    assert.equal(result.issues[0].code, 'NUMERIC_RANGE')
  }
  assert.equal(result.calculation, null)
})

test('invalid identifiers, weights and preparation approvals cannot enter Core', () => {
  const input = request()
  const cases = [
    { ...input, modelKey: '' },
    { ...input, components: input.components.map(c => ({ ...c, weightPercent: 45 })) },
    { ...input, components: input.components.map(c => ({ ...c, componentId: 'duplicate' })) },
    { ...input, components: input.components.map(c => ({ ...c, reduction: { method: 'END_OF_PERIOD' as const, approvalRef: '' } })) },
  ]
  for (const invalid of cases) {
    const result = calculateMonthlyCci(invalid)
    assert.equal(result.status, 'REFUSED')
    assert.equal(result.cciInput, null)
    assert.equal(result.calculation, null)
  }
})

test('J: real pipeline uses supplied history without network or resolving market-data Prisma', () => {
  const previousFetch = globalThis.fetch
  const previousDb = Object.getOwnPropertyDescriptor(globalThis, '__sgRuntimeMarketDataPrisma__')
  let ioAttempts = 0
  globalThis.fetch = (() => { ioAttempts++; throw new Error('External I/O forbidden') }) as typeof fetch
  Object.defineProperty(globalThis, '__sgRuntimeMarketDataPrisma__', { configurable: true,
    get() { ioAttempts++; throw new Error('Database resolution forbidden') } })
  try {
    const result = calculated()
    assert.equal(result.calculation.monthly[0].cci, 100)
    assert.equal(ioAttempts, 0)
  } finally {
    globalThis.fetch = previousFetch
    if (previousDb) Object.defineProperty(globalThis, '__sgRuntimeMarketDataPrisma__', previousDb)
    else Reflect.deleteProperty(globalThis, '__sgRuntimeMarketDataPrisma__')
  }
})
