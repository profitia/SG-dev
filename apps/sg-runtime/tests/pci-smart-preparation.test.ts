import test from 'node:test'
import assert from 'node:assert/strict'
import type { SavedBenchmark, BenchmarkAnalyticsSeriesResult } from '../lib/benchmark/contracts'
import { classifyBenchmark } from '../lib/benchmark/qualification'
import { pciSmartRequest, PCI_SMART_VERSION, type SmartPciRequest } from '../lib/cost-analysis/pci-smart-preparation-contracts'
import { prepareSmartPci } from '../lib/cost-analysis/pci-smart-preparation'
import { analyseSmartPci } from '../lib/cost-analysis/pci-smart-analysis'

const org = '11111111-1111-4111-8111-111111111111', now = '2026-10-30T12:00:00.000Z'
/** Entirely synthetic histories and purchase details; these are not live-provider claims. */
function fixture(count = 2) {
  const provider = { providerCode: 'MACROBOND' as const, displayName: 'Synthetic provider' }
  const selected: SavedBenchmark[] = Array.from({ length: count }, (_, i) => {
    const b: SavedBenchmark = { businessBenchmarkId: 'series-' + i, selectionId: 'selection-' + i, organizationId: org,
      displayName: `Synthetic commodity price ${i}, Close, USD/tonne`, provider,
      providerSeries: { provider, providerSeriesId: 'series-' + i, providerSeriesKey: 'series-' + i },
      frequency: 'Daily', currency: 'USD', unit: 'USD/tonne', source: 'SYNTHETIC', selectedAt: now }
    b.semanticProfile = classifyBenchmark({ ...b, metadata: { DataType: 'Close' } }); return b
  })
  const histories = new Map<string, BenchmarkAnalyticsSeriesResult>(selected.map((b, i) => [b.businessBenchmarkId, {
    providerSeries: b.providerSeries, displayName: b.displayName, frequency: 'Daily', currency: 'USD', unit: 'USD/tonne', source: 'SYNTHETIC', range: 'ALL', latestValue: 120,
    historical: ['2026-10-01', '2026-10-02', '2026-10-03'].map((date, j) => ({ date, value: (i ? [110, 100, 90] : [80, 100, 120])[j] })),
  }]))
  const input = pciSmartRequest.parse({ contractVersion: PCI_SMART_VERSION, mode: 'PREPARE', organisationId: org,
    category: { name: 'Synthetic category', components: selected.map((b, i) => ({ name: 'Component ' + i, businessBenchmarkId: b.businessBenchmarkId, weightPercent: count === 2 ? i ? 40 : 60 : 100 / count })) },
    purchase: { amount: 1000, currency: 'PLN', unit: 'tona', taxBasis: 'NET', deliveryBasis: 'EXW', purchaseDate: '2026-10-02' },
    declarations: selected.map(b => ({ componentId: b.businessBenchmarkId })),
  })
  return { selected, histories, input }
}
function cadence(f: ReturnType<typeof fixture>, i: number, frequency: string, sampling = 'Close', dates = ['2026-08-01', '2026-09-01']) {
  const b = f.selected[i]; b.frequency = frequency; b.semanticProfile = classifyBenchmark({ ...b, metadata: { DataType: sampling } })
  const h = f.histories.get(b.businessBenchmarkId)!; h.frequency = frequency; h.historical = dates.map((date, j) => ({ date, value: 100 + j * 10 }))
}
function run(f: ReturnType<typeof fixture>, accept = true, cutoff = now, candidateId?: string) {
  const p = prepareSmartPci(f.input, f.selected, f.histories, cutoff).preparation
  return analyseSmartPci({ ...f.input, mode: 'ANALYSE', reference: { candidateId: candidateId ?? p.recommendedCandidateId!, preparationId: p.id,
    strictPeriodAccepted: accept, proxyMarketOnlyAccepted: accept } }, f.selected, f.histories, cutoff)
}

test('A01: exact strict day reuses Core and Indexed Price; contributions reconcile and inputs remain unchanged', () => {
  const f = fixture(), before = JSON.stringify([f.input, [...f.histories]])
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert.equal(p.state, 'STRICT_PURCHASE_REFERENCE'); const base = p.candidates.find(c => c.id === p.recommendedCandidateId)!
  assert.equal(base.period.start, '2026-10-02T00:00:00.000Z'); assert.equal(base.requiresApproval, false)
  const r = run(f); assert.equal(r.status, 'CALCULATED'); if (r.status !== 'CALCULATED') return
  const n = r.indexedPrice.nodes.find(n => n.period.start.startsWith('2026-10-03'))!
  assert.equal(n.cci, 108); assert.equal(n.categoryIndexedPrice, 1080)
  assert(Math.abs(n.components.reduce((sum, c) => sum + c.contributionAmount!, 0) - 80) < 1e-9)
  assert.equal(r.indexedPrice.basePrice.purchaseDate, f.input.purchase.purchaseDate)
  assert.equal(r.calculation.methodologyVersion, 'CCI_FIXED_BASE_NODES_V1')
  assert.equal(JSON.stringify([f.input, [...f.histories]]), before)
})
test('A02/A05: daily closes plus native monthly averages use individually disclosed methods, not invented days', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-09-22'
  cadence(f, 0, 'Daily', 'Close', ['2026-09-02', '2026-09-23']); cadence(f, 1, 'Monthly', 'Average', ['2026-09-01'])
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert.equal(p.state, 'STRICT_PURCHASE_REFERENCE'); const c = p.candidates.find(c => c.id === p.recommendedCandidateId)!
  assert.equal(c.period.cadence, 'MONTHLY'); assert.equal(c.basis, 'PERIOD_AVERAGE')
  assert.deepEqual(c.components.map(c => c.method), ['AVAILABLE_OBSERVATION_AVERAGE', 'NATIVE_VALUE'])
  assert.equal(c.components[0].value, 105); assert.equal(c.components[0].sourceCount, 2)
  assert.equal(c.quality, 'QUALIFIED_PARTIAL_DISCLOSED'); assert.equal(c.components[0].expectedObservations, 'UNKNOWN')
  assert.deepEqual(c.components[0].sourceDates, ['2026-09-02', '2026-09-23'])
  assert.equal(run(f, false).status, 'REFUSED'); assert.equal(run(f).status, 'CALCULATED')
})
test('A03: monthly and quarterly averages cannot become an unapproved average of averages', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-09-22'
  cadence(f, 0, 'Monthly', 'Average', ['2026-07-01', '2026-08-01', '2026-09-01']); cadence(f, 1, 'Quarterly', 'Average', ['2026-07-01'])
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert.equal(p.state, 'NO_QUALIFIED_REFERENCE'); assert.equal(p.candidates.length, 0)
})
test('monthly EOP to a quarter requires explicit component reduction; lawful approved policy is retained', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-09-22'
  cadence(f, 0, 'Monthly', 'Close', ['2026-07-01', '2026-08-01', '2026-09-01']); cadence(f, 1, 'Quarterly', 'Close', ['2026-07-01'])
  assert.equal(prepareSmartPci(f.input, f.selected, f.histories, now).preparation.candidates.length, 0)
  f.input.declarations[0].reduction = 'END_OF_PERIOD'; f.input.declarations[0].verified = true
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation, c = p.candidates.find(c => c.id === p.recommendedCandidateId)!
  assert.equal(c.period.cadence, 'QUARTERLY'); assert.equal(c.components[0].value, 120)
  assert.equal(c.components[0].sourceDates.at(-1), '2026-09-01'); assert.equal(run(f).status, 'CALCULATED')
})
test('A04: a missing weekend is not a new observation or a falsely complete trading calendar', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-10-04'
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert(!p.candidates.some(c => c.mode === 'STRICT_PURCHASE_REFERENCE' && c.period.cadence === 'DAILY'))
  assert(p.components.every(c => c.expectedObservations === 'UNKNOWN'))
  assert(p.candidates.every(c => !c.components.some(p => p.sourceDates.includes('2026-10-04'))))
})
test('A06/A07: earlier monthly proxy never returns money and no later complete node is not a zero-percent success', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-10-22'
  cadence(f, 0, 'Monthly', 'Average'); cadence(f, 1, 'Monthly', 'Average')
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert.equal(p.state, 'EARLIER_MARKET_PROXY'); const c = p.candidates.find(c => c.id === p.recommendedCandidateId)!
  assert.equal(c.period.start, '2026-09-01T00:00:00.000Z'); assert.equal(c.canCalculateIndexedPrice, false)
  assert.equal(run(f, false).status, 'REFUSED')
  const r = run(f); assert.equal(r.status, 'PROXY_MARKET_ONLY'); if (r.status !== 'PROXY_MARKET_ONLY') return
  assert.equal(r.comparisonStatus, 'NO_LATER_COMPARISON_POINT'); assert.equal(r.purchaseContext.purchaseDate, '2026-10-22')
  assert.equal(r.purchaseContext.amount, 1000); assert(!('indexedPrice' in r)); assert(!('modeledPurchasePrice' in r))
})
test('market proxy produces real later CCI and pp contributions across an explicitly missing purchase month', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-10-22'
  cadence(f, 0, 'Monthly', 'Average', ['2026-09-01', '2026-11-01']); cadence(f, 1, 'Monthly', 'Average', ['2026-09-01', '2026-11-01'])
  const r = run(f, true, '2026-12-02T00:00:00.000Z'); assert.equal(r.status, 'PROXY_MARKET_ONLY'); if (r.status !== 'PROXY_MARKET_ONLY') return
  assert.equal(r.comparisonStatus, 'COMPARISON_AVAILABLE'); const last = r.calculation.nodes.find(n => n.period.start.startsWith('2026-11-01'))!
  assert(Math.abs(last.cci! - 110) < 1e-9)
  assert.equal(r.calculation.nodes.find(n => n.period.start.startsWith('2026-10-01'))!.cci, null)
  assert.equal(last.periodOverPeriodChangePercent, null); assert.equal(last.periodOverPeriodUnavailableReason, 'PREVIOUS_NODE_INCOMPLETE')
})
test('A09/A10: old WTI duplicates stay in provenance without vetoing unrelated later base or rewriting source', () => {
  const f = fixture(), h = f.histories.get('series-0')!
  h.historical.unshift({ date: '2020-04-01', value: 20 }, { date: '2020-04-01T12:00:00.000Z', value: 21 }, { date: '2020-04-02', value: -36 })
  const before = JSON.stringify(h.historical), p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert(p.historicalDiagnostics.some(i => i.code === 'DUPLICATE_NATIVE_PERIOD' && i.usedInWindow === false))
  assert(p.historicalDiagnostics.some(i => i.code === 'INVALID_PRICE_LEVEL' && i.usedInWindow === false))
  assert.equal(p.analysisWindow.start, '2026-07-01T00:00:00.000Z'); assert.equal(run(f).status, 'CALCULATED')
  assert.equal(JSON.stringify(h.historical), before); assert.match(p.components[0].historyFingerprint!, /^raw-history-sha256:/)
})
test('A11: conflicts in the actual base prevent that base; other periods remain inspectable and unavailable nodes remain null', () => {
  for (const kind of ['duplicate', 'negative', 'null'] as const) {
    const f = fixture(), h = f.histories.get('series-0')!
    if (kind === 'duplicate') h.historical.push({ date: '2026-10-02T12:00:00.000Z', value: 101 })
    else h.historical[1].value = kind === 'negative' ? -1 : null
    const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
    assert(!p.candidates.some(c => c.mode === 'STRICT_PURCHASE_REFERENCE' && c.period.cadence === 'DAILY'))
    assert(p.candidates.every(c => c.components.every(v => v.quality !== 'INSUFFICIENT')))
    if (kind !== 'null') assert(p.historicalDiagnostics.some(i => i.period === '2026-10-02T00:00:00.000Z'))
  }
})
test('A12: economically mismatched component name warns independently without changing valid BQL semantics', () => {
  const f = fixture(); f.input.category.components[0].name = 'Stal'
  f.selected[0].displayName = 'Brent Crude Oil Price, Close, USD/tonne'
  const p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert.equal(p.components[0].valueKind, 'PRICE_LEVEL'); assert(p.components[0].warnings.some(w => w.code === 'ECONOMIC_REPRESENTATIVENESS_VERIFY'))
})
test('lookback is three full calendar months; older references require deliberate discovery and never become automatic recommendations', () => {
  const f = fixture(); f.input.purchase.purchaseDate = '2026-10-22'
  cadence(f, 0, 'Monthly', 'Average', ['2026-06-01']); cadence(f, 1, 'Monthly', 'Average', ['2026-06-01'])
  let p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert.equal(p.recommendationStart, '2026-07-01'); assert.equal(p.recommendedCandidateId, null)
  f.input.olderYear = 2026; p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  assert(p.candidates.length > 0); assert(p.candidates.every(c => c.olderExplicitSelection && !c.recommended)); assert.equal(p.recommendedCandidateId, null)
  assert.equal(run(f, true, now, p.candidates[0].id).status, 'PROXY_MARKET_ONLY')
})
test('A16: preparation IDs bind exact date, methods, sources and composition; stale consent never authorizes new data', () => {
  const f = fixture(), p = prepareSmartPci(f.input, f.selected, f.histories, now).preparation
  f.input.purchase.purchaseDate = '2026-10-03'
  const r = analyseSmartPci({ ...f.input, mode: 'ANALYSE', reference: { candidateId: p.recommendedCandidateId!, preparationId: p.id, strictPeriodAccepted: true, proxyMarketOnlyAccepted: true } }, f.selected, f.histories, now)
  assert.equal(r.status, 'REFUSED'); if (r.status === 'REFUSED') assert.equal(r.issues[0].code, 'PREPARATION_CHANGED')
  assert.equal(f.input.purchase.purchaseDate, '2026-10-03')
})
test('A18: five-component math keeps each identity, fixed weight, pp and money reconciliation; bad weights stay rejected', () => {
  const f = fixture(5), r = run(f); assert.equal(r.status, 'CALCULATED'); if (r.status !== 'CALCULATED') return
  const last = r.indexedPrice.nodes.find(n => n.period.start.startsWith('2026-10-03'))!
  assert.equal(last.components.length, 5); assert(Math.abs(last.categoryIndexedPrice! - 960) < 1e-9)
  assert(Math.abs(last.components.reduce((sum, c) => sum + c.contributionAmount!, 0) + 40) < 1e-9)
  f.input.category.components[0].weightPercent = 10
  assert.equal(prepareSmartPci(f.input, f.selected, f.histories, now).preparation.issues[0].code, 'CATEGORY_NOT_READY')
})
test('zero-weight components are visibly excluded, not dropped from fixed identities and not required to supply a price level', () => {
  const f = fixture(); f.input.category.components[0].weightPercent = 100; f.input.category.components[1].weightPercent = 0
  f.histories.delete('series-1'); const r = run(f); assert.equal(r.status, 'CALCULATED')
  if (r.status === 'CALCULATED') assert.equal(r.calculation.components.length, 2)
})
test('genuine uncertainty requires meaningful per-component verification; a known quantity cannot be overridden as price', () => {
  const f = fixture(); f.selected[0].semanticProfile = classifyBenchmark({ ...f.selected[0], displayName: 'Unknown series', currency: null, unit: null })
  assert.equal(prepareSmartPci(f.input, f.selected, f.histories, now).preparation.state, 'VERIFICATION_REQUIRED')
  f.input.declarations[0] = { ...f.input.declarations[0], valueKind: 'PRICE_LEVEL', periodBasis: 'END_OF_PERIOD', verified: true }
  assert.equal(run(f).status, 'CALCULATED')
  f.selected[0].semanticProfile = classifyBenchmark({ ...f.selected[0], displayName: 'Steel inventories', currency: null, unit: 'Tonnes' })
  assert.equal(prepareSmartPci(f.input, f.selected, f.histories, now).preparation.issues[0].code, 'SEMANTIC_MISMATCH')
})

test('verified declaration cannot relabel an explicit monthly average as EOP',()=>{
 const f=fixture();cadence(f,0,'Monthly','Average');cadence(f,1,'Monthly','Average');f.input.declarations[0].periodBasis='END_OF_PERIOD';f.input.declarations[0].verified=true
 const p=prepareSmartPci(f.input,f.selected,f.histories,now).preparation;assert.equal(p.state,'VERIFICATION_REQUIRED');assert.equal(p.candidates.length,0)
})

test('proxy explains the unavailable purchase period separately for each component without disqualifying its valid base',()=>{
 const f=fixture();f.input.purchase.purchaseDate='2026-10-22';cadence(f,0,'Monthly','Average');cadence(f,1,'Monthly','Average')
 const p=prepareSmartPci(f.input,f.selected,f.histories,now).preparation;assert.equal(p.state,'EARLIER_MARKET_PROXY')
 assert.deepEqual(p.issues.filter(i=>i.code==='OPEN_PURCHASE_PERIOD').map(i=>i.componentId).sort(),['series-0','series-1'])
 assert(p.issues.every(i=>i.period==='2026-10-01T00:00:00.000Z'));assert.equal(run(f).status,'PROXY_MARKET_ONLY')
})
