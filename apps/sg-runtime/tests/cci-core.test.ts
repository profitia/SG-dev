import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateCci, CciValidationError, CCI_WEIGHT_SUM_TOLERANCE } from '../lib/cost-analysis/cci'
import type {
  CciIndex, CciInput, CciInputSemantics, CciResult, CciValidationCode, PercentChange, PercentagePoints,
} from '../lib/cost-analysis/contracts'
import {
  calculateBenchmarkChangePercent, calculateCategoryMovementPercent, calculateContributionPercentagePoints,
} from '../lib/cost-scan/math'

const semantics: CciInputSemantics = {
  frequency: 'MONTHLY', monthlyPreparationPolicyId: 'fixture-monthly-levels-v1',
  currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' },
}
const identities = ['Copper', 'PVC', 'Energy', 'Labor', 'Transport']
const cableWeights = [60, 20, 10, 7, 3]

function fixture(rows: readonly (readonly number[])[], periods = ['2024-05', '2024-06', '2024-07'], weights = cableWeights): CciInput {
  return { basePeriod: '2024-05', inputSemantics: semantics, components: weights.map((weightPercent, index) => ({
    componentId: identities[index] ?? `resource-${index}`, weightPercent,
    observations: rows.map((row, month) => ({ period: periods[month], value: row[index] })),
  })) }
}

function close(actual: number | null | undefined, expected: number, tolerance = 1e-11) {
  assert.equal(typeof actual, 'number')
  assert.ok(Number.isFinite(actual))
  assert.ok(Math.abs(actual! - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} differs from ${expected}`)
}

function invalid(input: unknown, code: CciValidationCode) {
  assert.throws(() => calculateCci(input as CciInput), (error: unknown) => error instanceof CciValidationError && error.issue.code === code)
}

function contributionIdentity(result: CciResult) {
  for (const month of result.monthly) {
    if (month.status !== 'COMPLETE') continue
    close(month.components.reduce((total, component) => total + (component.contributionPercentagePoints ?? 0), 0), month.cci - 100)
  }
}

test('A: base period is exactly 100 with zero contributions and no MoM', () => {
  const result = calculateCci(fixture([[100, 100, 100, 100, 100]]))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.methodologyVersion, 'CCI_FIXED_BASE_V1')
  assert.equal(result.outputSemantics, 'DIMENSIONLESS_BASE_100_INDEX')
  const base = result.monthly[0]
  assert.equal(base.cci, 100)
  assert.equal(base.cumulativeChangePercent, 0)
  assert.equal(base.monthOverMonthChangePercent, null)
  assert.equal(base.monthOverMonthUnavailableReason, 'BASE_PERIOD')
  for (const component of base.components) {
    assert.equal(component.benchmarkRelative, 1)
    assert.equal(component.componentIndex, 100)
    assert.equal(component.contributionPercentagePoints, 0)
  }
})

test('B: copper +10% at a 60% base weight gives CCI 106 and +6 pp', () => {
  const result = calculateCci(fixture([[100, 100, 100, 100, 100], [110, 100, 100, 100, 100]]))
  const month = result.monthly[1]
  close(month.cci, 106)
  close(month.cumulativeChangePercent, 6)
  close(month.monthOverMonthChangePercent, 6)
  for (const component of month.components) close(component.contributionPercentagePoints, component.componentId === 'Copper' ? 6 : 0)
  contributionIdentity(result)
})

test('C: cumulative index and MoM follow fixed base quantities, not monthly rebalancing', () => {
  const result = calculateCci(fixture([[100, 100, 100, 100, 100], [110, 100, 100, 100, 100], [121, 100, 100, 100, 100]]))
  close(result.monthly[1].cci, 106)
  close(result.monthly[2].cci, 112.6)
  close(result.monthly[2].cumulativeChangePercent, 12.6)
  close(result.monthly[2].monthOverMonthChangePercent, (112.6 / 106 - 1) * 100)
  assert.ok(Math.abs(result.monthly[2].monthOverMonthChangePercent! - 6) > 0.2)
  contributionIdentity(result)
})

test('D: opposing movements preserve signed contributions', () => {
  const result = calculateCci(fixture([[100, 100], [110, 90]], undefined, [60, 40]))
  close(result.monthly[1].cci, 102)
  close(result.monthly[1].components.find(component => component.componentId === 'Copper')!.contributionPercentagePoints, 6)
  close(result.monthly[1].components.find(component => component.componentId === 'PVC')!.contributionPercentagePoints, -4)
  contributionIdentity(result)
})

test('a falling basket produces an index below 100 and negative changes', () => {
  const result = calculateCci(fixture([[100], [96]], undefined, [100]))
  close(result.monthly[1].cci, 96)
  close(result.monthly[1].cumulativeChangePercent, -4)
  close(result.monthly[1].monthOverMonthChangePercent, -4)
  contributionIdentity(result)
})

test('E: constant series retain index 100 across calendar year boundaries', () => {
  const input = { ...fixture([[7, 90], [7, 90], [7, 90]], ['2024-11', '2024-12', '2025-01'], [33.3, 66.7]), basePeriod: '2024-11' }
  const result = calculateCci(input)
  for (const [index, month] of result.monthly.entries()) {
    close(month.cci, 100)
    close(month.cumulativeChangePercent, 0)
    assert.equal(month.monthOverMonthChangePercent, index === 0 ? null : 0)
  }
})

test('F: missing component blocks only the complete index and consecutive-month MoM', () => {
  const result = calculateCci({ basePeriod: '2024-05', inputSemantics: semantics, components: [
    { componentId: 'a', weightPercent: 60, observations: [{ period: '2024-05', value: 100 }, { period: '2024-07', value: 120 }, { period: '2024-08', value: 125 }] },
    { componentId: 'b', weightPercent: 40, observations: [{ period: '2024-05', value: 100 }, { period: '2024-06', value: 90 }, { period: '2024-07', value: 110 }, { period: '2024-08', value: 110 }] },
  ] })
  assert.equal(result.status, 'INCOMPLETE')
  const missing = result.monthly[1]
  assert.equal(missing.status, 'INCOMPLETE')
  assert.equal(missing.cci, null)
  assert.equal(missing.cumulativeChangePercent, null)
  assert.equal(missing.monthOverMonthChangePercent, null)
  assert.equal(missing.monthOverMonthUnavailableReason, 'CURRENT_MONTH_INCOMPLETE')
  assert.deepEqual(missing.missingComponentIds, ['a'])
  assert.equal(missing.components[0].contributionPercentagePoints, null)
  assert.equal(missing.components[0].benchmarkValue, null)
  close(missing.components[1].contributionPercentagePoints, -4)
  close(result.monthly[2].cci, 116)
  assert.equal(result.monthly[2].monthOverMonthChangePercent, null)
  assert.equal(result.monthly[2].monthOverMonthUnavailableReason, 'PREVIOUS_MONTH_INCOMPLETE')
  close(result.monthly[3].monthOverMonthChangePercent, (119 / 116 - 1) * 100)
})

test('F: explicit null observations are missing data rather than zero prices', () => {
  const result = calculateCci({ basePeriod: '2024-05', inputSemantics: semantics, components: [
    { componentId: 'a', weightPercent: 100, observations: [{ period: '2024-05', value: 4 }, { period: '2024-06', value: null }] },
  ] })
  assert.equal(result.monthly[1].cci, null)
  assert.deepEqual(result.monthly[1].missingComponentIds, ['a'])
})

for (const value of [undefined, null]) {
  test(`G: missing base (${String(value)}) is a definition error`, () => {
    const observations = value === undefined ? [{ period: '2024-06', value: 100 }] : [{ period: '2024-05', value: null }]
    invalid({ basePeriod: '2024-05', inputSemantics: semantics, components: [{ componentId: 'a', weightPercent: 100, observations }] }, 'MISSING_BASE_PERIOD')
  })
}

for (const weights of [[95], [105], [0], [-1, 101], [NaN, 100], [Infinity, 0], [-Infinity, 100]]) {
  test(`H: invalid weights ${weights.join('/')} are rejected without normalization`, () => {
    invalid(fixture([weights.map(() => 100)], undefined, weights), weights.some(weight => !Number.isFinite(weight) || weight < 0) ? 'INVALID_WEIGHT' : 'INVALID_WEIGHT_SUM')
  })
}

test('H: empty models and duplicate or blank identifiers are rejected', () => {
  invalid({ basePeriod: '2024-05', inputSemantics: semantics, components: [] }, 'INVALID_MODEL')
  const input = fixture([[100, 100]], undefined, [60, 40])
  invalid({ ...input, components: input.components.map(component => ({ ...component, componentId: 'same' })) }, 'DUPLICATE_COMPONENT_ID')
  invalid({ ...input, components: input.components.map(component => ({ ...component, componentId: ' ' })) }, 'INVALID_COMPONENT_ID')
  invalid(null, 'INVALID_MODEL')
})

test('malformed runtime inputs fail with typed validation errors', () => {
  const input = fixture([[100]], undefined, [100])
  invalid({ ...input, components: null }, 'INVALID_MODEL')
  invalid({ ...input, components: [null] }, 'INVALID_COMPONENT_ID')
  invalid({ ...input, components: [{ ...input.components[0], observations: null }] }, 'INVALID_OBSERVATION')
  invalid({ ...input, components: [{ ...input.components[0], observations: [null] }] }, 'INVALID_OBSERVATION')
  invalid({ ...input, components: [{ ...input.components[0], weightPercent: '100' }] }, 'INVALID_WEIGHT')
})

test('H: decimal weights and one active component are supported', () => {
  const result = calculateCci(fixture([[10, 20, 30], [11, 18, 45]], undefined, [33.33, 33.33, 33.34]))
  close(result.monthly[1].cci, 100 * (0.3333 * 1.1 + 0.3333 * 0.9 + 0.3334 * 1.5))
  contributionIdentity(result)
  assert.equal(calculateCci(fixture([[100]], undefined, [100])).monthly[0].cci, 100)
})

test('H: the weight-sum tolerance accepts representation noise but not substantive errors', () => {
  const inside = fixture([[100, 100]], undefined, [50, 50 + CCI_WEIGHT_SUM_TOLERANCE / 2])
  assert.equal(calculateCci(inside).monthly[0].cci, 100)
  assert.equal(calculateCci(inside).components[1].weightPercent, inside.components[1].weightPercent)
  invalid(fixture([[100]], undefined, [100 + CCI_WEIGHT_SUM_TOLERANCE * 2]), 'INVALID_WEIGHT_SUM')
})

test('zero-weight components need no base, do not extend the calendar and never hide invalid supplied levels', () => {
  const input: CciInput = { ...fixture([[100], [110]], undefined, [100]), components: [
    ...fixture([[100], [110]], undefined, [100]).components,
    { componentId: 'unused', weightPercent: 0, observations: [{ period: '2099-12', value: 12 }] },
  ] }
  const result = calculateCci(input)
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.monthly.length, 2)
  close(result.monthly[1].cci, 110)
  const unused = result.monthly[0].components.find(component => component.componentId === 'unused')!
  assert.equal(unused.status, 'EXCLUDED_ZERO_WEIGHT')
  assert.equal(unused.contributionPercentagePoints, 0)
  assert.equal(unused.benchmarkRelative, null)
  invalid({ ...input, components: [...input.components.slice(0, 1), { componentId: 'unused', weightPercent: 0, observations: [{ period: '2024-05', value: 0 }] }] }, 'INVALID_BENCHMARK_VALUE')
})

for (const value of [0, -1, NaN, Infinity, -Infinity, undefined, '100']) {
  test(`I: invalid benchmark level ${String(value)} is rejected`, () => {
    const input = fixture([[100], [100]], undefined, [100])
    invalid({ ...input, components: [{ ...input.components[0], observations: [{ period: '2024-05', value: 100 }, { period: '2024-06', value }] }] }, 'INVALID_BENCHMARK_VALUE')
    invalid({ ...input, components: [{ ...input.components[0], observations: [{ period: '2024-05', value }] }] }, 'INVALID_BENCHMARK_VALUE')
  })
}

test('I: intermediate overflow or underflow cannot leak non-finite or zero indices', () => {
  for (const [base, next] of [[Number.MIN_VALUE, Number.MAX_VALUE], [Number.MAX_VALUE, Number.MIN_VALUE], [1, Number.MAX_VALUE]]) {
    invalid(fixture([[base], [next]], undefined, [100]), 'NUMERIC_RANGE')
  }
  const result = calculateCci(fixture([[1e200], [1e-100]], undefined, [100]))
  assert.ok(result.monthly[1].cci! > 0)
  close(result.monthly[1].cumulativeChangePercent, -100)
})

for (const period of ['2024-5', '2024-00', '2024-13', '2024-05-01', ' 2024-05', '2024-05 ', '2024-05\n', 'May 2024']) {
  test(`J: invalid period ${JSON.stringify(period)} is rejected`, () => {
    invalid({ ...fixture([[100]], undefined, [100]), basePeriod: period }, 'INVALID_PERIOD')
    const input = fixture([[100]], undefined, [100])
    invalid({ ...input, components: [{ ...input.components[0], observations: [{ period, value: 100 }] }] }, 'INVALID_PERIOD')
  })
}

test('J: duplicate monthly observations are definition errors', () => {
  invalid(fixture([[100], [110]], ['2024-05', '2024-05'], [100]), 'DUPLICATE_PERIOD')
})

test('J: every absent calendar month is emitted, and MoM never jumps a gap', () => {
  const result = calculateCci(fixture([[100], [121]], ['2024-05', '2024-07'], [100]))
  assert.deepEqual(result.monthly.map(month => month.period), ['2024-05', '2024-06', '2024-07'])
  assert.equal(result.monthly[1].status, 'INCOMPLETE')
  close(result.monthly[2].cci, 121)
  assert.equal(result.monthly[2].monthOverMonthChangePercent, null)
})

test('J/K: unsorted component and observation input produces the same ordered history', () => {
  const input = fixture([[100, 200], [101, 202], [120, 210]], undefined, [60, 40])
  const shuffled = { ...input, components: [...input.components].reverse().map(component => ({ ...component, observations: [...component.observations].reverse() })) }
  assert.deepEqual(calculateCci(shuffled), calculateCci(input))
})

test('J: pre-base history is validated but excluded from the result', () => {
  const input = fixture([[50], [100], [120]], ['2024-04', '2024-05', '2024-06'], [100])
  const result = calculateCci(input)
  assert.deepEqual(result.monthly.map(month => month.period), ['2024-05', '2024-06'])
  close(result.monthly[1].cci, 120)
})

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

test('K: repeated calculations accept deeply frozen input and share no mutable input objects', () => {
  const input = deepFreeze(fixture([[100, 100], [110, 90]], undefined, [60, 40]))
  const before = JSON.stringify(input)
  const first = calculateCci(input)
  assert.deepEqual(calculateCci(input), first)
  assert.deepEqual(calculateCci(input), first)
  assert.equal(JSON.stringify(input), before)
  assert.notEqual(first.inputSemantics, input.inputSemantics)
  assert.notEqual(first.inputSemantics.currencyPolicy, input.inputSemantics.currencyPolicy)
  assert.notEqual(first.components[0], input.components[0])
})

test('L: varied levels and decimal weights retain unrounded contribution identities', () => {
  const rows = Array.from({ length: 18 }, (_, month) => [11.123456789 + month / 17, 200.987654321 - month / 11, 3.141592653589793 + month / 23])
  const periods = Array.from({ length: 18 }, (_, month) => `${2024 + Math.floor((month + 4) / 12)}-${String((month + 4) % 12 + 1).padStart(2, '0')}`)
  const result = calculateCci(fixture(rows, periods, [17.123456789, 32.876543211, 50]))
  contributionIdentity(result)
  const copper = result.monthly[1].components.find(component => component.componentId === 'Copper')!
  assert.notEqual(copper.contributionPercentagePoints, Math.round(copper.contributionPercentagePoints! * 1e6) / 1e6)
  close(copper.benchmarkRelative, rows[1][0] / rows[0][0])
})

test('M: CCI agrees with the existing Cost Scan fixture within its presentation rounding', () => {
  const weights = [70, 20, 5, 5]
  const next = [110, 105, 103, 98]
  const result = calculateCci(fixture([[100, 100, 100, 100], next], undefined, weights))
  const scanContributions = next.map((value, index) => calculateContributionPercentagePoints(weights[index], calculateBenchmarkChangePercent(100, value)!))
  close(result.monthly[1].cci, 108.05)
  close(result.monthly[1].cumulativeChangePercent, calculateCategoryMovementPercent(scanContributions)!)
})

test('input semantics are required, copied and do not turn the result into a currency amount', () => {
  const input = fixture([[100]], undefined, [100])
  invalid({ ...input, inputSemantics: undefined }, 'INVALID_INPUT_SEMANTICS')
  invalid({ ...input, inputSemantics: { ...semantics, frequency: 'DAILY' } }, 'INVALID_INPUT_SEMANTICS')
  invalid({ ...input, inputSemantics: { ...semantics, currencyPolicy: { kind: 'PRECONVERTED_COMMON_CURRENCY', currency: 'PLN' } } }, 'INVALID_INPUT_SEMANTICS')
  const converted = { ...semantics, currencyPolicy: { kind: 'PRECONVERTED_COMMON_CURRENCY' as const, currency: 'PLN', conversionPolicyId: 'external-fx-fixture-v1' } }
  const result = calculateCci({ ...input, inputSemantics: converted })
  assert.deepEqual(result.inputSemantics, converted)
  assert.equal(result.outputSemantics, 'DIMENSIONLESS_BASE_100_INDEX')
})

// These assertions are checked by the focused TypeScript test compilation.
function quantityTypeContract(index: CciIndex, percent: PercentChange, points: PercentagePoints) {
  // @ts-expect-error An index is not a percentage change.
  const wrongPercent: PercentChange = index
  // @ts-expect-error Percent changes are not contribution percentage points.
  const wrongPoints: PercentagePoints = percent
  // @ts-expect-error Contributions are not an index level.
  const wrongIndex: CciIndex = points
  return [wrongPercent, wrongPoints, wrongIndex]
}
void quantityTypeContract
