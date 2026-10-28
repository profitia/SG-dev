import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCciNodes, CciNodeValidationError } from '../lib/cost-analysis/cci-node-calculation'
import { calculateCci } from '../lib/cost-analysis/cci'
import type { CciNodeInput, CciNodeValidationCode } from '../lib/cost-analysis/cci-node-contracts'
import type { CciAlignedNode, CciCadence, CciPeriodIdentity } from '../lib/cost-analysis/market-data-contracts'

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
const identities = [{ componentId: 'copper', weightPercent: 60 }, { componentId: 'energy', weightPercent: 40 }]
function node(period: CciPeriodIdentity, levels: readonly (number | null)[]): CciAlignedNode {
  return { period, status: levels.some(value => value === null) ? 'INCOMPLETE' : 'COMPLETE',
    components: identities.map((c, i) => ({ ...c, value: levels[i], status: levels[i] === null ? 'MISSING_OBSERVATION' : 'COMPLETE',
      method: { id: 'VALIDATED_NATIVE_LEVEL', version: 'fixture-v1', approvalRef: 'reviewed-fixture' }, sourceDates: [period.start], coverage: 'NATIVE_PERIOD' })) }
}
function fixture(cadence: CciCadence = 'MONTHLY'): CciNodeInput {
  const dates = calendars[cadence]
  return { modelKey: 'synthetic-category', baseNodeStart: iso(dates[1]), analysisCadence: cadence, nodeBasis: 'END_OF_PERIOD', cutoff: iso(dates[3]),
    inputSemantics: { preparationPolicyId: 'synthetic-prepared-nodes-v1', currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' } },
    components: identities, nodes: [[80, 110], [100, 100], [120, 90]].map((levels, i) =>
      node({ cadence, start: iso(dates[i]), endExclusive: iso(dates[i + 1]) }, levels)) }
}
function near(actual: number | null, expected: number, tolerance = 1e-11) {
  assert.equal(typeof actual, 'number')
  assert.ok(Math.abs(actual! - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`)
}
function rejects(input: unknown, code: CciNodeValidationCode) {
  assert.throws(() => calculateCciNodes(input as CciNodeInput), error => error instanceof CciNodeValidationError && error.issue.code === code)
}

for (const cadence of Object.keys(calendars) as CciCadence[]) {
  test(`A/C: ${cadence} Core calculates genuine before/base/after nodes and calendar-adjacent PoP`, () => {
    const input = fixture(cadence), result = calculateCciNodes(input)
    assert.equal(result.status, 'COMPLETE')
    assert.equal(result.analysisCadence, cadence)
    assert.equal(result.outputSemantics, 'DIMENSIONLESS_BASE_100_INDEX')
    assert.deepEqual(result.nodes.map(n => n.period), input.nodes.map(n => n.period))
    assert.deepEqual(result.baseNode, input.nodes[1].period)
    const [before, base, after] = result.nodes
    near(before.cci, 92)
    assert.equal(base.cci, 100)
    near(after.cci, 108)
    near(before.cumulativeChangePercent, -8)
    assert.equal(base.cumulativeChangePercent, 0)
    near(after.cumulativeChangePercent, 8)
    assert.equal(before.periodOverPeriodChangePercent, null)
    assert.equal(before.periodOverPeriodUnavailableReason, 'NO_PREVIOUS_NODE')
    near(base.periodOverPeriodChangePercent, (100 / 92 - 1) * 100)
    near(after.periodOverPeriodChangePercent, 8)
    assert.equal(base.periodOverPeriodUnavailableReason, null)
    near(before.components[0].benchmarkRelative, 0.8)
    near(before.components[0].contributionPercentagePoints, -12)
    near(before.components[1].contributionPercentagePoints, 4)
    for (const n of result.nodes) {
      near(n.components.reduce((total, c) => total + c.contributionPercentagePoints!, 0), n.cci! - 100)
      near(n.components.reduce((total, c) => total + c.weightPercent * c.benchmarkRelative!, 0), n.cci!)
      // Algebraic future price decomposition only; no money calculation API is introduced.
      near(n.components.reduce((total, c) => total + 1000 * c.weightPercent / 100 * c.benchmarkRelative!, 0), 1000 * n.cci! / 100)
    }
    assert.deepEqual(result.missingIntervals, [])
  })
}

test('C: history before base uses component relatives, never inversion of aggregate index', () => {
  const result = calculateCciNodes(fixture())
  near(result.nodes[0].cci, 92)
  assert.ok(Math.abs(result.nodes[0].cci! - 10000 / result.nodes[2].cci!) > 0.5)
})

test('D: purchase anchor May has February 90, May 100, June 110 without fabricated months', () => {
  const input = fixture()
  const nodes = [
    node({ cadence: 'MONTHLY', start: iso('2024-02-01'), endExclusive: iso('2024-03-01') }, [90, 90]),
    node({ cadence: 'MONTHLY', start: iso('2024-05-01'), endExclusive: iso('2024-06-01') }, [100, 100]),
    node({ cadence: 'MONTHLY', start: iso('2024-06-01'), endExclusive: iso('2024-07-01') }, [110, 110]),
  ]
  const result = calculateCciNodes({ ...input, nodes })
  result.nodes.forEach((n, i) => near(n.cci, [90, 100, 110][i]))
  result.nodes.forEach((n, i) => near(1000 * n.cci! / 100, [900, 1000, 1100][i]))
  assert.equal(result.nodes.length, 3)
  assert.equal(result.nodes[1].periodOverPeriodChangePercent, null)
  assert.equal(result.nodes[1].periodOverPeriodUnavailableReason, 'NON_ADJACENT_PERIODS')
  assert.deepEqual(result.missingIntervals, [{ start: iso('2024-03-01'), endExclusive: iso('2024-05-01'), cadence: 'MONTHLY' }])
})

for (const side of ['BEFORE_BASE', 'AFTER_BASE'] as const) {
  test(`G: missing component ${side} stays null and prevents adjacent PoP`, () => {
    const input = fixture('QUARTERLY')
    const index = side === 'BEFORE_BASE' ? 0 : 2
    const nodes = input.nodes.map((n, i) => i === index ? node(n.period, [100, null]) : n)
    const result = calculateCciNodes({ ...input, nodes })
    assert.equal(result.status, 'INCOMPLETE')
    assert.equal(result.nodes[index].cci, null)
    assert.equal(result.nodes[index].periodOverPeriodChangePercent, null)
    assert.deepEqual(result.nodes[index].missingComponentIds, ['energy'])
    assert.deepEqual(result.nodes[index].components.map(c => c.weightPercent), [60, 40])
    if (index === 0) {
      assert.equal(result.nodes[1].cci, 100)
      assert.equal(result.nodes[1].periodOverPeriodChangePercent, null)
      assert.equal(result.nodes[1].periodOverPeriodUnavailableReason, 'PREVIOUS_NODE_INCOMPLETE')
    }
  })
}

test('G: Q2 incomplete does not stop Q3 cumulative index but cannot produce QoQ', () => {
  const input = fixture('QUARTERLY')
  const nodes = input.nodes.map((n, i) => i === 1 ? node(n.period, [110, null]) : n)
  const result = calculateCciNodes({ ...input, baseNodeStart: nodes[0].period.start, nodes })
  assert.equal(result.nodes[1].status, 'INCOMPLETE')
  near(result.nodes[2].cci, 100 * (0.6 * 120 / 80 + 0.4 * 90 / 110))
  assert.equal(result.nodes[2].periodOverPeriodChangePercent, null)
  assert.equal(result.nodes[2].periodOverPeriodUnavailableReason, 'PREVIOUS_NODE_INCOMPLETE')
})

test('H: omitted 2023 does not turn 2022 → 2024 into YoY; no new nodes', () => {
  const input = fixture('ANNUAL')
  const nodes = [node({ cadence: 'ANNUAL', start: iso('2022-01-01'), endExclusive: iso('2023-01-01') }, [80, 80]),
    node({ cadence: 'ANNUAL', start: iso('2024-01-01'), endExclusive: iso('2025-01-01') }, [100, 100])]
  const result = calculateCciNodes({ ...input, nodes })
  assert.equal(result.nodes.length, 2)
  assert.equal(result.status, 'INCOMPLETE')
  near(result.nodes[0].cci, 80)
  assert.equal(result.nodes[1].cci, 100)
  assert.equal(result.nodes[1].periodOverPeriodChangePercent, null)
  assert.equal(result.nodes[1].periodOverPeriodUnavailableReason, 'NON_ADJACENT_PERIODS')
  assert.deepEqual(result.missingIntervals, [{ start: iso('2023-01-01'), endExclusive: iso('2024-01-01'), cadence: 'ANNUAL' }])
})

test('I: exact missing or incomplete base is rejected without shifting', () => {
  const input = fixture()
  rejects({ ...input, baseNodeStart: iso('2024-03-01') }, 'MISSING_BASE_NODE')
  rejects({ ...input, nodes: input.nodes.map((n, i) => i === 1 ? node(n.period, [100, null]) : n) }, 'INCOMPLETE_BASE_NODE')
})

const calendarFailures: readonly [string, (input: CciNodeInput) => unknown, CciNodeValidationCode][] = [
  ['unsorted', i => ({ ...i, nodes: [...i.nodes].reverse() }), 'INVALID_PERIOD_ORDER'],
  ['duplicate period', i => ({ ...i, nodes: [i.nodes[0], i.nodes[0], ...i.nodes.slice(1)] }), 'INVALID_PERIOD_ORDER'],
  ['wrong cadence', i => ({ ...i, nodes: i.nodes.map((n, j) => j ? n : { ...n, period: { ...n.period, cadence: 'QUARTERLY' } }) }), 'CADENCE_MISMATCH'],
  ['monthly label', i => ({ ...i, nodes: i.nodes.map((n, j) => j ? n : { ...n, period: { ...n.period, start: '2024-04' } }) }), 'INVALID_PERIOD_BOUNDARIES'],
  ['timezone offset', i => ({ ...i, nodes: i.nodes.map((n, j) => j ? n : { ...n, period: { ...n.period, start: '2024-04-01T01:00:00.000+01:00' } }) }), 'INVALID_PERIOD_BOUNDARIES'],
  ['not midnight', i => ({ ...i, nodes: i.nodes.map((n, j) => j ? n : { ...n, period: { ...n.period, start: '2024-04-01T00:00:00.001Z' } }) }), 'INVALID_PERIOD_BOUNDARIES'],
  ['calendar overflow', i => ({ ...i, nodes: i.nodes.map((n, j) => j ? n : { ...n, period: { ...n.period, start: iso('2024-04-31') } }) }), 'INVALID_PERIOD_BOUNDARIES'],
  ['overlapping interval end', i => ({ ...i, nodes: i.nodes.map((n, j) => j ? n : { ...n, period: { ...n.period, endExclusive: iso('2024-06-01') } }) }), 'INVALID_PERIOD_BOUNDARIES'],
  ['open period', i => ({ ...i, cutoff: iso('2024-06-15') }), 'UNCLOSED_PERIOD'],
]
for (const [name, change, code] of calendarFailures) test(`J: ${name} is rejected`, () => rejects(change(fixture()), code))

test('J: weekly start must be Monday and quarterly start must be a real quarter boundary', () => {
  const weekly = fixture('WEEKLY'), quarterly = fixture('QUARTERLY')
  rejects({ ...weekly, nodes: weekly.nodes.map((n, i) => i ? n : { ...n, period: { ...n.period, start: iso('2023-12-26'), endExclusive: iso('2024-01-02') } }) }, 'INVALID_PERIOD_BOUNDARIES')
  rejects({ ...quarterly, nodes: quarterly.nodes.map((n, i) => i ? n : { ...n, period: { ...n.period, start: iso('2023-11-01'), endExclusive: iso('2024-02-01') } }) }, 'INVALID_PERIOD_BOUNDARIES')
})

test('K: generic and legacy monthly mathematics agree, preserving legacy forward-only base/MoM behavior', () => {
  const input = fixture(), generic = calculateCciNodes(input)
  const monthly = calculateCci({ basePeriod: '2024-05', inputSemantics: { frequency: 'MONTHLY', monthlyPreparationPolicyId: 'fixture-v1', currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' } },
    components: input.components.map(c => ({ ...c, observations: input.nodes.map(n => ({ period: n.period.start.slice(0, 7), value: n.components.find(v => v.componentId === c.componentId)!.value })) })) })
  assert.equal(monthly.monthly.length, 2)
  assert.equal(monthly.monthly[0].monthOverMonthChangePercent, null)
  assert.equal(monthly.monthly[0].monthOverMonthUnavailableReason, 'BASE_PERIOD')
  assert.notEqual(generic.nodes[1].periodOverPeriodChangePercent, null)
  monthly.monthly.forEach((m, i) => {
    assert.equal(m.cci, generic.nodes[i + 1].cci)
    assert.equal(m.cumulativeChangePercent, generic.nodes[i + 1].cumulativeChangePercent)
    assert.deepEqual(m.components, generic.nodes[i + 1].components)
    if (i) assert.equal(m.monthOverMonthChangePercent, generic.nodes[i + 1].periodOverPeriodChangePercent)
  })
})

test('zero weights do not require base observations or change positive component weights', () => {
  const input = fixture(), excluded = { componentId: 'ignored', weightPercent: 0 }
  const result = calculateCciNodes({ ...input, components: [...input.components, excluded], nodes: input.nodes.map(n => ({ ...n,
    components: [...n.components, { ...excluded, value: null, status: 'EXCLUDED_ZERO_WEIGHT', method: null, sourceDates: [], coverage: 'NONE' }] })) })
  assert.equal(result.nodes[1].cci, 100)
  assert.equal(result.nodes[0].components[2].contributionPercentagePoints, 0)
})

for (const value of [0, -1, NaN, Infinity]) {
  test(`invalid benchmark level ${value} fails closed`, () => {
    const input = fixture()
    rejects({ ...input, nodes: input.nodes.map((n, i) => i ? n : node(n.period, [value, 100])) }, 'INVALID_BENCHMARK_VALUE')
  })
}
for (const weights of [[55, 40], [65, 40], [-1, 101], [NaN, 40], [Infinity, 40]]) {
  test(`invalid fixed weights ${String(weights)} fail closed`, () => {
    const input = fixture()
    rejects({ ...input, components: input.components.map((c, i) => ({ ...c, weightPercent: weights[i] })) }, weights.some(v => !Number.isFinite(v) || v < 0) ? 'INVALID_WEIGHT' : 'INVALID_WEIGHT_SUM')
  })
}

test('duplicate/undeclared components, inconsistent statuses and changing node weights fail closed', () => {
  const input = fixture()
  rejects({ ...input, components: [input.components[0], input.components[0]] }, 'DUPLICATE_COMPONENT_ID')
  rejects({ ...input, nodes: input.nodes.map((n, i) => i ? n : { ...n, components: [n.components[0], n.components[0]] }) }, 'INVALID_NODE_COMPONENTS')
  rejects({ ...input, nodes: input.nodes.map((n, i) => i ? n : { ...n, components: [] }) }, 'INVALID_NODE_COMPONENTS')
  rejects({ ...input, nodes: input.nodes.map((n, i) => i ? n : { ...n, components: n.components.map(c => ({ ...c, weightPercent: 50 })) }) }, 'INVALID_NODE_COMPONENTS')
  rejects({ ...input, nodes: input.nodes.map((n, i) => i ? n : { ...n, status: 'INCOMPLETE' }) }, 'INCONSISTENT_NODE_STATUS')
  rejects({ ...input, analysisCadence: 'UNKNOWN' }, 'INVALID_CADENCE')
  rejects({ ...input, inputSemantics: { preparationPolicyId: '' } }, 'INVALID_INPUT_SEMANTICS')
})

for (const [before, base, after] of [[1, 1e-308, 1e308], [1, 1e308, 1e-308], [1, 1, Number.MAX_VALUE]]) {
  test(`numeric range ${base} → ${after} cannot produce Infinity, zero-relative or invalid indices`, () => {
    const input = fixture()
    rejects({ ...input, nodes: input.nodes.map((n, i) => node(n.period, [[before, base, after][i], 100])) }, 'NUMERIC_RANGE')
  })
}

test('determinism, component ordering and input immutability', () => {
  const input = fixture(), before = structuredClone(input)
  const first = calculateCciNodes(input)
  assert.deepEqual(first, calculateCciNodes(input))
  assert.deepEqual(first, calculateCciNodes({ ...input, components: [...input.components].reverse(), nodes: input.nodes.map(n => ({ ...n, components: [...n.components].reverse() })) }))
  assert.deepEqual(input, before)
  assert.notEqual(first.nodes[0].period, input.nodes[0].period)
})

test('N: Core has no hidden clock, network or DB access', () => {
  const input = fixture('DAILY'), OriginalDate = Date, oldFetch = globalThis.fetch
  class ExplicitDate extends OriginalDate {
    constructor(value?: string | number) { if (value === undefined) throw Error('Implicit clock forbidden'); super(value) }
    static now(): number { throw Error('System clock forbidden') }
  }
  globalThis.Date = ExplicitDate as DateConstructor
  globalThis.fetch = (() => { throw Error('Network forbidden') }) as typeof fetch
  try { assert.equal(calculateCciNodes(input).nodes[1].cci, 100) }
  finally { globalThis.Date = OriginalDate; globalThis.fetch = oldFetch }
})
