import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import React, { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BenchmarkPickerView, SharedBenchmarkPicker, type SharedBenchmarkPickerProps } from '../components/benchmark-picker/shared-benchmark-picker'
import { emptyPickerState, benchmarkSeriesKey, type PickerState } from '../components/benchmark-picker/picker-controller'
import { benchmarkPriceType, pickerNumber } from '../components/benchmark-picker/presentation'
import type { BenchmarkCandidate, SavedBenchmark } from '../lib/benchmark/contracts'
// Included in the existing mandatory SG2 operation suite, without a parallel test entrypoint.
import './benchmark-qualification.test'
import './bql-integration.test'

const provider = { providerCode: 'MACROBOND' as const, displayName: 'Macrobond' }
function item(index = 0): BenchmarkCandidate { return { candidateId: `macrobond:s${index}`, displayName: `Copper ${index}`, description: null, provider,
  providerSeries: { provider, providerSeriesId: `s${index}` }, frequency: 'quarterly', currency: 'USD', unit: 't', source: 'Exchange', region: 'World', lastObservationDate: '2024-05-15', metadata: { PriceType: 'fixture_spot' } } }
const selected: SavedBenchmark = { ...item(), selectionId: 'selected', businessBenchmarkId: 'business', organizationId: 'authorized-fixture', selectedAt: '2024-05-15T00:00:00.000Z' }
function state(): PickerState {
  const candidates = Array.from({ length: 12 }, (_, i) => item(i))
  return { ...emptyPickerState(), ready: true, searched: true, candidates, saved: [selected], priceTypes: [{ value: 'fixture_spot', label: 'Spot' }],
    previews: Object.fromEntries(candidates.slice(0, 5).map(c => [benchmarkSeriesKey(c), { status: 'ready', data: {
      providerSeries: c.providerSeries, displayName: c.displayName, latestValue: 123.45, frequency: 'quarterly', currency: 'USD', unit: 't', source: 'Exchange', range: '1Y', changeMetrics: { '1M': 1.25, '3M': -2.5, '1Y': 0 }, historical: [],
    } }])) }
}
const noop = () => {}
function render(s = state(), locale: 'pl' | 'en' = 'en') {
  return renderToStaticMarkup(<BenchmarkPickerView locale={locale} state={s} query="Copper" setQuery={noop} search={noop} more={noop} select={noop} cancel={noop} initialSelectedBenchmarkId="business" />)
}
test('B/D/G: actual table renders only five candidates with name/type/native frequency/Last/1M/3M/1Y and source context', () => {
  const html = render()
  assert.equal((html.match(/scope="row"/g) ?? []).length, 5)
  for (const value of ['Copper 0', 'Copper 4', 'Spot', 'quarterly', '123.45', '+1.25%', '-2.5%', '0%', 'USD t', 'Exchange', 'World', 'Observation date', 'Show next 5']) assert.ok(html.includes(value), value)
  assert.ok(!html.includes('Copper 5')); assert.ok(!html.includes('6M')); assert.ok(!html.includes('iframe'))
  assert.match(html, /type="search"/); assert.match(html, /aria-label="Use selected: Copper 0"/)
  assert.match(html, /grid-cols-2/); assert.match(html, /md:table-row/)
})
test('A/E: empty, loading, disabled, search and selection errors have neutral accessible presentation', () => {
  assert.match(render({ ...emptyPickerState(), ready: true, searched: true }), /No results/)
  assert.match(render(emptyPickerState()), /Loading/)
  assert.match(render({ ...emptyPickerState(), error: 'SESSION_UNAVAILABLE' }), /role="alert"/)
  assert.match(render({ ...emptyPickerState(), ready: true, error: 'SEARCH_FAILED' }), /Benchmark search failed/)
  assert.match(render({ ...emptyPickerState(), ready: true, error: 'SELECTION_FAILED' }), /Benchmark selection failed/)
  const html = renderToStaticMarkup(<SharedBenchmarkPicker locale="en" onSelect={noop} disabled onCancel={noop} />)
  assert.match(html, /Benchmark selection is disabled/); assert.match(html, /disabled=""/)
})
test('E: missing Last and metrics use placeholders and preserve real zero changes', () => {
  const s = state(), key = benchmarkSeriesKey(item())
  const data = s.previews[key].data!
  const html = render({ ...s, candidates: [item()], previews: { [key]: { status: 'ready', data: { ...data, latestValue: null, changeMetrics: {} } } } })
  assert.ok(html.includes('—')); assert.ok(!html.includes('123.45')); assert.ok(!html.includes('0%'))
  assert.equal(pickerNumber(0, 'en', true), '0%'); assert.equal(pickerNumber(NaN, 'en'), '—')
})
test('F: exact provider PriceType dictionary labels only; sampling Class/DataType and titles never classify', () => {
  const values = [{ value: 'fixture_spot', label: 'Spot' }, { value: 'fixture_futures', label: 'Futures' }, { value: 'fixture_continuous', label: 'Continuous futures' }, { value: 'fixture_wholesale', label: 'Wholesale price' }]
  for (const v of values) assert.equal(benchmarkPriceType({ ...item(), metadata: { PriceType: v.value } }, values, 'en'), v.label)
  assert.equal(benchmarkPriceType({ ...item(), displayName: 'Copper futures spot', metadata: { DataType: 'close', Class: 'stock' } }, values, 'en'), 'Unspecified')
  assert.equal(benchmarkPriceType({ ...item(), metadata: { PriceType: 'unknown' } }, values, 'pl'), 'Nieokreślony')
  assert.equal(benchmarkPriceType(item(), [], 'en'), 'Unspecified')
  assert.equal(benchmarkPriceType({ ...item(), metadata: { PriceType: ['fixture_spot', 'unknown'] } }, values, 'en'), 'Unspecified')
})
test('K: independent consumer contracts supply only initial presentation and a SavedBenchmark callback', () => {
  const calls: unknown[] = []
  const independent: SharedBenchmarkPickerProps[] = [
    { locale: 'en', onSelect: b => calls.push(['first', b.businessBenchmarkId]) },
    { locale: 'pl', initialQuery: 'Copper', onSelect: b => calls.push(['second', b.providerSeries.providerSeriesId]) },
    { locale: 'en', initialSelectedBenchmarkId: 'business', onSelect: b => calls.push(['future', b.selectionId]), onCancel: () => calls.push('cancel') },
  ]
  independent.forEach(p => p.onSelect(selected)); independent[2].onCancel?.()
  assert.deepEqual(calls, [['first', 'business'], ['second', 's0'], ['future', 'selected'], 'cancel'])
  for (const p of independent) assert.ok(renderToStaticMarkup(<SharedBenchmarkPicker {...p} disabled />).length)
  // @ts-expect-error business workflow identifiers are not Picker props
  const invalid: SharedBenchmarkPickerProps = { locale: 'en', onSelect: noop, categoryId: 'not-a-picker-concern' }
  void invalid
})
function visit(node: ReactNode, callback: (element: React.ReactElement<Record<string, unknown>>) => void): void {
  if (Array.isArray(node)) return node.forEach(c => visit(c, callback))
  if (!isValidElement(node)) return
  callback(node as React.ReactElement<Record<string, unknown>>)
  visit((node.props as { children?: ReactNode }).children, callback)
}
test('J/K: view actions delegate to the consumer/controller; keyboard Escape uses the same cancel action', () => {
  const calls: unknown[] = []
  const tree = BenchmarkPickerView({ locale: 'en', state: state(), query: 'Copper', setQuery: v => calls.push(v), search: () => calls.push('search'), more: () => calls.push('more'), select: c => calls.push(c.candidateId), cancel: () => calls.push('cancel') })
  visit(tree, e => {
    if (e.type === 'form') (e.props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} })
    if (e.type === 'button' && e.props.children === 'Show next 5') (e.props.onClick as () => void)()
    if (e.type === 'button' && e.props['aria-label'] === 'Select: Copper 0') (e.props.onClick as () => void)()
  })
  ;(tree.props.onKeyDown as (event: { key: string; preventDefault(): void; stopPropagation(): void }) => void)({ key: 'Escape', preventDefault() {}, stopPropagation() {} })
  assert.deepEqual(calls, ['search', item().candidateId, 'more', 'cancel'])
})
test('isolation: shared picker code contains no reverse domain imports or forecast/analytics work', () => {
  for (const name of ['shared-benchmark-picker.tsx', 'picker-controller.ts', 'presentation.ts']) {
    const source = fs.readFileSync(new URL('../components/benchmark-picker/' + name, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"][^'"]*(cost-analysis|cost-scan|category-builder|srm|forecast)/)
    assert.doesNotMatch(source, /<iframe|analytics-eligibility|forecast\/|localStorage|sessionStorage/)
  }
})

test('candidate name is an accessible selection action with the same busy guard as Wybierz', () => {
  const selected: string[] = []
  const tree = BenchmarkPickerView({ locale: 'pl', state: state(), query: 'Copper', setQuery: noop, search: noop,
    more: noop, select: candidate => selected.push(candidate.candidateId) })
  visit(tree, e => {
    if (e.type === 'button' && e.props['aria-label'] === 'Wybierz benchmark: Copper 0') (e.props.onClick as () => void)()
  })
  assert.deepEqual(selected, [item().candidateId])
  const busy = renderToStaticMarkup(<BenchmarkPickerView locale="pl" state={{ ...state(), selecting: benchmarkSeriesKey(item()) }} query="Copper"
    setQuery={noop} search={noop} more={noop} select={noop} />)
  assert.match(busy, /aria-label="Wybierz benchmark: Copper 0" disabled=""/)
})
