import assert from 'node:assert/strict'
import test from 'node:test'
import { alignCciMarketData, CciMarketDataValidationError } from '../lib/cost-analysis/node-alignment'
import type { CciMarketComponent, CciMarketDataRequest } from '../lib/cost-analysis/market-data-contracts'
import { FORECAST_NATIVE_FREQUENCIES } from '../lib/forecast/cadence'

function component(id: string, frequency: string, points: readonly (readonly [string, number | null])[], weight = 100): CciMarketComponent {
  return { componentId: id, weightPercent: weight, benchmarkSeriesId: id,
    history: { providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: id, providerSeriesKey: id },
      displayName: id, frequency, currency: 'USD', unit: 'USD/tonne', source: 'synthetic fixture', historical: points.map(([date, value]) => ({ date, value })) },
    qualification: { valueKind: 'PRICE_LEVEL', periodBasis: 'END_OF_PERIOD', calendar: 'UTC_CALENDAR', evidenceRef: 'reviewed-fixture-level-semantics-v1' },
    reduction: { method: 'END_OF_PERIOD', approvalRef: 'fixture-approved-last-observation-in-closed-period-v1' },
    snapshot: { retrievedAt: '2026-01-01T00:00:00Z', revisionRef: null } }
}

function request(components: readonly CciMarketComponent[], overrides: Partial<CciMarketDataRequest> = {}): CciMarketDataRequest {
  return { modelKey: 'synthetic-cost-breakdown', baseNodeStart: '2024-01-01', range: { start: '2024-01-01', endExclusive: '2025-01-01' },
    cutoff: '2025-01-01', availability: 'RETROSPECTIVE_CURRENT_HISTORY', alignmentPolicy: 'STRICT_COMMON_NODES', nodeBasis: 'END_OF_PERIOD',
    currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' }, components, ...overrides }
}

function throws(input: unknown, code: string) {
  assert.throws(() => alignCciMarketData(input as CciMarketDataRequest), e => e instanceof CciMarketDataValidationError && e.code === code)
}

for (const frequency of FORECAST_NATIVE_FREQUENCIES) {
  test(`A: ${frequency} retains one genuine native observation without artificial resampling`, () => {
    const date = frequency === 'WEEKLY' ? '2024-01-01' : '2024-01-01'
    const result = alignCciMarketData(request([component('level', frequency, [[date, 100]])]))
    assert.equal(result.analysisCadence, frequency)
    assert.equal(result.series[0].nativeCadence, frequency)
    assert.equal(result.series[0].sourceObservations.length, 1)
    assert.equal(result.nodes.filter(n => n.status === 'COMPLETE').length, 1)
    assert.equal(result.nodes[0].components[0].value, 100)
    assert.equal(result.series[0].sourceObservations[0].originalDate, date)
  })
}

test('annual history has four annual nodes and never 48 fabricated monthly values', () => {
  const result = alignCciMarketData(request([component('annual', 'ANNUAL', [2022, 2023, 2024, 2025].map(year => [`${year}-12-31`, year]))], {
    baseNodeStart: '2022-01-01', range: { start: '2022-01-01', endExclusive: '2026-01-01' }, cutoff: '2026-01-01',
  }))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.nodes.length, 4)
  assert.equal(result.analysisCadence, 'ANNUAL')
})

test('B: monthly + quarterly use closed quarters with approved monthly end-of-period reduction', () => {
  const monthly = component('copper', 'MONTHLY', [['2024-01-31', 100], ['2024-02-29', 105], ['2024-03-31', 110]], 60)
  const quarterly = component('energy', 'QUARTERLY', [['2024-03-31', 200]], 40)
  const result = alignCciMarketData(request([monthly, quarterly], { range: { start: '2024-01-01', endExclusive: '2024-04-01' } }))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.analysisCadence, 'QUARTERLY')
  assert.equal(result.nodes[0].components[0].value, 110)
  assert.equal(result.nodes[0].components[1].value, 200)
  assert.deepEqual(result.nodes[0].period, { cadence: 'QUARTERLY', start: '2024-01-01T00:00:00.000Z', endExclusive: '2024-04-01T00:00:00.000Z' })
})

test('B: daily + monthly reuse the existing approved daily monthly average', () => {
  const daily = component('copper', 'DAILY', [['2024-01-02', 100], ['2024-01-31', 120]], 60)
  const monthly = component('energy', 'MONTHLY', [['2024-01-01', 80]], 40)
  const result = alignCciMarketData(request([
    { ...daily, reduction: { method: 'OBSERVATION_AVERAGE', approvalRef: 'reviewed-daily-observation-average-v1' } },
    { ...monthly, qualification: { ...monthly.qualification, periodBasis: 'PERIOD_AVERAGE' } },
  ], { nodeBasis: 'PERIOD_AVERAGE', range: { start: '2024-01-01', endExclusive: '2024-02-01' } }))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.analysisCadence, 'MONTHLY')
  assert.equal(result.nodes[0].components[0].value, 110)
  assert.equal(result.nodes[0].components[0].method?.id, 'AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS')
  assert.equal(result.nodes[0].components[0].coverage, 'AVAILABLE_DAILY_OBSERVATIONS')
})

test('B: quarterly + annual align annually without repeating the annual observation', () => {
  const result = alignCciMarketData(request([
    component('a', 'QUARTERLY', [['2024-01-01', 10], ['2024-04-01', 20], ['2024-07-01', 30], ['2024-10-01', 40]], 60),
    component('b', 'ANNUAL', [['2024-12-31', 50]], 40),
  ]))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.analysisCadence, 'ANNUAL')
  assert.equal(result.nodes.length, 1)
  assert.equal(result.nodes[0].components[0].value, 40)
})

test('B: bimonthly + quarterly tile a half-year, not a quarter', () => {
  const input = request([
    component('a', 'BIMONTHLY', [['2024-01-01', 10], ['2024-03-01', 20], ['2024-05-01', 30]], 60),
    component('b', 'QUARTERLY', [['2024-01-01', 40], ['2024-04-01', 50]], 40),
  ], { range: { start: '2024-01-01', endExclusive: '2024-07-01' } })
  const result = alignCciMarketData(input)
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.analysisCadence, 'SEMIANNUAL')
  assert.equal(result.nodes[0].components[0].value, 30)
  assert.equal(result.nodes[0].components[1].value, 50)
  const forced = alignCciMarketData({ ...input, analysisCadence: 'QUARTERLY' })
  assert.equal(forced.status, 'UNSUPPORTED_CANONICALIZATION')
  assert.equal(forced.nodes.length, 0)
})

test('B: daily + annual reduce actual daily levels only within the closed annual node', () => {
  const result = alignCciMarketData(request([
    component('a', 'DAILY', [['2024-01-02', 100], ['2024-12-30', 120]], 60),
    component('b', 'ANNUAL', [['2024-12-31', 200]], 40),
  ]))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.analysisCadence, 'ANNUAL')
  assert.equal(result.nodes[0].components[0].value, 120)
  assert.equal(result.nodes[0].components[0].method?.id, 'REDUCE_LAWFUL_PERIOD_END_OF_PERIOD')
})

test('a reduction without approval and average-of-monthly-averages are refused', () => {
  const m = component('m', 'MONTHLY', [['2024-01-01', 10]], 60)
  const q = component('q', 'QUARTERLY', [['2024-01-01', 20]], 40)
  assert.equal(alignCciMarketData(request([{ ...m, reduction: { method: 'NATIVE_ONLY' } }, q])).status, 'NOT_COMPARABLE')
  const result = alignCciMarketData(request([
    { ...m, qualification: { ...m.qualification, periodBasis: 'PERIOD_AVERAGE' }, reduction: { method: 'OBSERVATION_AVERAGE', approvalRef: 'cannot-change-the-reducer-semantics' } },
    { ...q, qualification: { ...q.qualification, periodBasis: 'PERIOD_AVERAGE' } },
  ], { nodeBasis: 'PERIOD_AVERAGE' }))
  assert.equal(result.status, 'NOT_COMPARABLE')
})

test('weekly periods crossing month boundaries do not silently become calendar months', () => {
  const result = alignCciMarketData(request([
    component('w', 'WEEKLY', [['2024-01-01', 10]], 60), component('m', 'MONTHLY', [['2024-01-01', 20]], 40),
  ], { analysisCadence: 'MONTHLY' }))
  assert.equal(result.status, 'UNSUPPORTED_CANONICALIZATION')
})

test('derived cadence considers actual common coverage as well as labels and approved reductions', () => {
  const result = alignCciMarketData(request([
    component('a', 'DAILY', [['2024-01-01', 100]], 60), component('b', 'DAILY', [['2024-01-02', 120]], 40),
  ], { range: { start: '2024-01-01', endExclusive: '2024-01-08' } }))
  assert.equal(result.analysisCadence, 'WEEKLY')
  assert.equal(result.status, 'COMPLETE')
  assert.deepEqual(result.nodes[0].components.map(c => c.sourceDates), [['2024-01-01'], ['2024-01-02']])
  assert.deepEqual(result.nodes[0].components.map(c => c.coverage), ['AVAILABLE_DAILY_OBSERVATIONS', 'AVAILABLE_DAILY_OBSERVATIONS'])
})

test('C: UTC boundaries and leap day use economic periods, preserving original timestamps', () => {
  const result = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-02-29T23:00:00-01:00', 100]])], {
    baseNodeStart: '2024-03-01', range: { start: '2024-03-01', endExclusive: '2024-04-01' },
  }))
  assert.equal(result.status, 'COMPLETE')
  assert.equal(result.nodes[0].period.start, '2024-03-01T00:00:00.000Z')
  assert.equal(result.series[0].sourceObservations[0].originalDate, '2024-02-29T23:00:00-01:00')
  assert.equal(result.series[0].sourceObservations[0].observedAt, '2024-03-01T00:00:00.000Z')
})

test('C: open periods and partial requested periods do not become complete nodes', () => {
  const result = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-01-01', 100], ['2024-02-01', 110]])], {
    cutoff: '2024-02-15', range: { start: '2024-01-01', endExclusive: '2024-03-01' },
  }))
  assert.equal(result.nodes.length, 1)
  assert.equal(result.series[0].excludedOpenPeriodCount, 1)
  assert.deepEqual(result.excludedAnalysisPeriods.map(p => p.reasons), [['OPEN_AT_CUTOFF']])
  const partial = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-01-01', 100]])], {
    baseNodeStart: '2024-01-15', range: { start: '2024-01-15', endExclusive: '2024-02-01' },
  }))
  assert.equal(partial.status, 'NOT_COMPARABLE')
  assert.ok(partial.issues.some(i => i.code === 'BASE_NODE_NOT_ALIGNED'))
  assert.deepEqual(partial.excludedAnalysisPeriods[0].reasons, ['PARTIAL_ANALYSIS_RANGE'])
})

test('D: gaps and nulls are explicit and later valid periods remain available', () => {
  const result = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-01-01', 100], ['2024-03-01', null], ['2024-04-01', 120]])], {
    range: { start: '2024-01-01', endExclusive: '2024-05-01' },
  }))
  assert.equal(result.status, 'INCOMPLETE')
  assert.deepEqual(result.nodes.map(n => n.status), ['COMPLETE', 'INCOMPLETE', 'INCOMPLETE', 'COMPLETE'])
  assert.deepEqual(result.nodes.map(n => n.components[0].value), [100, null, null, 120])
  assert.equal(result.series[0].sourceObservations.length, 3)
})

test('D: a missing monthly constituent makes the reduced quarter incomplete', () => {
  const result = alignCciMarketData(request([
    component('a', 'MONTHLY', [['2024-01-01', 100], ['2024-02-01', 110], ['2024-03-01', 120], ['2024-04-01', 130], ['2024-06-01', 140]], 60),
    component('b', 'QUARTERLY', [['2024-01-01', 100], ['2024-04-01', 110]], 40),
  ], { range: { start: '2024-01-01', endExclusive: '2024-07-01' } }))
  assert.equal(result.status, 'INCOMPLETE')
  assert.equal(result.nodes[1].components[0].status, 'INCOMPLETE_COVERAGE')
  assert.equal(result.nodes[1].components[0].value, null)
})

test('D: missing base never silently moves to the next complete node', () => {
  const result = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-02-01', 100]])], {
    range: { start: '2024-01-01', endExclusive: '2024-03-01' },
  }))
  assert.equal(result.status, 'NOT_COMPARABLE')
  assert.ok(result.issues.some(i => i.code === 'MISSING_BASE_NODE'))
  assert.equal(result.nodes[1].status, 'COMPLETE')
})

test('E: unknown native frequency retains source facts and returns an explicit limitation', () => {
  const result = alignCciMarketData(request([component('a', 'BUSINESS_DAILY', [['2024-01-01', 100]])]))
  assert.equal(result.status, 'UNSUPPORTED_CANONICALIZATION')
  assert.equal(result.analysisCadence, null)
  assert.equal(result.series[0].sourceFrequency, 'BUSINESS_DAILY')
  assert.equal(result.series[0].sourceObservations[0].value, 100)
  assert.equal(result.series[0].sourceObservations[0].period, null)
})

test('G: provenance and fingerprint record levels, not fictional publication or immutable vintage', () => {
  const original = component('a', 'ANNUAL', [['2024-12-31', 100]])
  const result = alignCciMarketData(request([original]))
  assert.equal(result.series[0].provider, 'MACROBOND')
  assert.equal(result.series[0].currency, 'USD')
  assert.equal(result.series[0].unit, 'USD/tonne')
  assert.match(result.series[0].historyFingerprint!, /^[a-f0-9]{64}$/)
  const revised = { ...original, history: { ...original.history, historical: [{ date: '2024-12-31', value: 101 }] } }
  assert.notEqual(alignCciMarketData(request([revised])).series[0].historyFingerprint, result.series[0].historyFingerprint)
  assert.equal(result.availability.historicalPublicationDatesVerified, false)
  assert.equal(result.availability.immutableVintagesVerified, false)
  assert.equal(result.series[0].snapshot.revisionRef, null)
})

test('H/M: annual 2024 data cannot prove availability at a June 2024 purchase comparison', () => {
  const result = alignCciMarketData(request([component('labor', 'ANNUAL', [['2024-01-01', 100]])], {
    baseNodeStart: '2024-05-01', range: { start: '2024-05-01', endExclusive: '2024-07-01' }, cutoff: '2024-07-01', availability: 'HISTORICAL_AS_OF',
  }))
  assert.equal(result.status, 'NOT_COMPARABLE')
  assert.equal(result.analysisCadence, 'ANNUAL')
  assert.equal(result.nodes.length, 0)
  assert.ok(result.issues.some(i => i.code === 'HISTORICAL_AS_OF_UNSUPPORTED'))
  assert.equal(result.availability.supported, 'RETROSPECTIVE_CURRENT_HISTORY_ONLY')
})

test('I: native currency metadata never becomes a false historical FX conversion', () => {
  const result = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-01-01', 100]])], {
    currencyPolicy: { kind: 'PRECONVERTED_COMMON_CURRENCY', currency: 'PLN', conversionPolicyId: 'a-label-is-not-conversion-evidence' },
  }))
  assert.equal(result.status, 'NOT_COMPARABLE')
  assert.equal(result.currencyStatus, 'FX_CONVERSION_NOT_SUPPORTED')
  assert.equal(result.series[0].currency, 'USD')
})

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child) }
  return value
}

test('J: deterministic sorted output accepts immutable input and shares no input metadata', () => {
  const first = component('b', 'MONTHLY', [['2024-02-01', 110], ['2024-01-31', 100]], 60)
  const second = component('a', 'MONTHLY', [['2024-02-29', 100], ['2024-01-01', 100]], 40)
  const input = freeze(request([first, second], { range: { start: '2024-01-01', endExclusive: '2024-03-01' } }))
  const baseline = alignCciMarketData(input)
  assert.deepEqual(alignCciMarketData(input), baseline)
  assert.deepEqual(alignCciMarketData({ ...input, components: [...input.components].reverse() }), baseline)
  assert.notEqual(baseline.series[0].qualification, second.qualification)
  assert.notEqual(baseline.series[0].preparationPolicy, second.reduction)
  assert.notEqual(baseline.series[0].snapshot, second.snapshot)
})

for (const value of [0, -1, NaN, Infinity, -Infinity]) {
  test(`invalid supplied price ${String(value)} is rejected`, () => throws(request([component('a', 'MONTHLY', [['2024-01-01', value]])]), 'INVALID_PRICE_LEVEL'))
}
for (const date of ['2024-02-30', '2024-13-01', '2024-01-01T24:00:00Z', '2024-1-1', 'bad']) {
  test(`invalid source date ${date} is rejected before calendar normalization`, () => throws(request([component('a', 'MONTHLY', [[date, 100]])]), 'INVALID_DATE'))
}
test('duplicates, exact-series mismatch and invalid weights are rejected', () => {
  throws(request([component('a', 'MONTHLY', [['2024-01-01', 100], ['2024-01-31', 110]])]), 'DUPLICATE_NATIVE_PERIOD')
  throws(request([component('a', 'MONTHLY', [['2024-01-01', 100], ['2024-01-01T00:00:00Z', 110]])]), 'DUPLICATE_OBSERVATION')
  const c = component('a', 'MONTHLY', [['2024-01-01', 100]])
  throws(request([{ ...c, benchmarkSeriesId: 'another-series' }]), 'SERIES_IDENTITY_MISMATCH')
  throws(request([{ ...c, weightPercent: 95 }]), 'INVALID_WEIGHT_SUM')
  throws(request([{ ...c, weightPercent: NaN }]), 'INVALID_WEIGHT')
})

test('zero-weight series does not force a coarser analysis cadence or hide invalid levels', () => {
  const result = alignCciMarketData(request([component('a', 'MONTHLY', [['2024-01-01', 100]]), component('b', 'ANNUAL', [['2024-01-01', 90]], 0)]))
  assert.equal(result.analysisCadence, 'MONTHLY')
  assert.equal(result.nodes[0].components[1].status, 'EXCLUDED_ZERO_WEIGHT')
  throws(request([component('a', 'MONTHLY', [['2024-01-01', 100]]), component('b', 'ANNUAL', [['2024-01-01', 0]], 0)]), 'INVALID_PRICE_LEVEL')
})
