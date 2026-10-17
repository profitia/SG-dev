import assert from 'node:assert/strict'
import test from 'node:test'
import React, { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExecutiveSummary } from '@profitia/srm-xray/executive-summary'
import type { ExecutiveSummaryInput } from '@profitia/srm-xray/executive-summary-rules'
import { SupplierSummaryView, type SupplierSummaryDetail } from '../components/supplier-intelligence/supplier-summary-view'

function fixture(): ExecutiveSummaryInput {
  const from = '2025-01-01', to = '2025-12-31', documentRef = 'synthetic-document'
  const freshness = { retrievedAt: null, checkedAt: null, cacheExpiresAt: null, retentionUntil: null,
    freshness: 'UNKNOWN' as const, readSource: 'STORED' as const, lastRetrievalMethod: 'UNKNOWN' as const }
  return { nip: '0000000000', entityType: 'COMPANY', scope: 'standalone', selectedPeriod: { from, to }, kysStatus: 'NOT_REQUESTED', kysHasData: false,
    metadata: { schemaVersion: '1.0', nip: '0000000000', entityType: 'COMPANY',
      financial: { status: 'PARTIAL', source: 'MGBI', freshness, completeness: 'PARTIAL', limitations: [],
        mappingVersion: 'synthetic-mapping', representationVersion: 'synthetic-representation', sourceVersion: 'synthetic-source',
        periods: [{ from, to, scope: 'standalone', year: '2025', documentRef, facts: [{ ref: 'synthetic-fact', documentRef, metricCode: 'PALA_NRFS',
          periodStart: from, periodEnd: to, scope: 'standalone', amount: '123456.789', sourceAmount: '123456.789', currency: 'PLN', unit: 'PLN',
          validation: 'VERIFIED', normalization: 'SOURCE_VALUE', normalizationRule: null, reasonCode: null }] }], history: [] },
      kys: { status: 'NOT_REQUESTED', source: 'VERCLY', freshness: { ...freshness, freshness: 'ABSENT' }, completeness: 'UNKNOWN',
        lastAttemptStatus: null, lastAttemptAt: null, limitations: ['KYS_NOT_REQUESTED'], reportAvailable: false } } }
}
const noop = () => {}
function render(input: ExecutiveSummaryInput, detail: SupplierSummaryDetail = null) {
  return renderToStaticMarkup(<SupplierSummaryView input={input} detail={detail} onSource={noop} onIndicator={noop} onDetails={noop} onFinance={noop} onClose={noop} />)
}
test('SG2 really renders the shared business module under React18 with stored source facts and shared formatting', () => {
  assert.match(React.version, /^18\.3\.1$/)
  const html = render(fixture())
  assert.match(html, /Przychody/); assert.match(html, /123[\s\u00a0]?456,789/)
  assert.match(html, /Dane dla NIP/); assert.match(html, /zapisane dane finansowe MGBI/)
  assert(!html.includes('synthetic-document')); assert(!html.includes('synthetic-source'))
})
test('host callbacks come from the actual shared module and open meaningful source, finance and report details', () => {
  const input = fixture(), calls: unknown[] = []
  const tree = SupplierSummaryView({ input, detail: null, onSource: fact => calls.push(fact.ref), onIndicator: code => calls.push(code),
    onDetails: () => calls.push('report'), onFinance: () => calls.push('finance'), onClose: noop })
  let module: React.ReactElement<React.ComponentProps<typeof ExecutiveSummary>> | undefined
  function visit(node: ReactNode): void {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!isValidElement(node)) return
    if (node.type === ExecutiveSummary) module = node as typeof module
    visit((node.props as { children?: ReactNode }).children)
  }
  visit(tree); assert(module)
  module.props.onSource(input.metadata!.financial.periods[0].facts[0]); module.props.onFinance(); module.props.onDetails()
  assert.deepEqual(calls, ['synthetic-fact','finance','report'])
  const source = render(input, { kind: 'source', fact: input.metadata!.financial.periods[0].facts[0] })
  assert.match(source, /Dokładna wartość/); assert.match(source, /Potwierdzone w zapisanych danych/)
  assert.match(render(input, { kind: 'report' }), /Pozycje z wybranego sprawozdania/)
  assert.match(render(input, { kind: 'finance' }), /Brak wskaźników dla tego wyboru/)
})
test('all host detail panels refuse a foreign supplier, another scope, stale period and ambiguous documents', () => {
  for (const change of [(input: ExecutiveSummaryInput) => { input.nip = '1111111111' },
    (input: ExecutiveSummaryInput) => { input.scope = 'consolidated' },
    (input: ExecutiveSummaryInput) => { input.selectedPeriod = { from: '2024-01-01', to: '2024-12-31' } },
    (input: ExecutiveSummaryInput) => { input.metadata!.financial.periods = [...input.metadata!.financial.periods, input.metadata!.financial.periods[0]] }]) {
    const input = fixture(), fact = input.metadata!.financial.periods[0].facts[0]; change(input)
    for (const detail of [{ kind: 'source', fact }, { kind: 'report' }, { kind: 'finance' }] as SupplierSummaryDetail[]) {
      const html = render(input, detail); assert(!/123[\s\u00a0]?456,789/.test(html), JSON.stringify(detail))
    }
  }
  const input = fixture(), foreignFact = { ...input.metadata!.financial.periods[0].facts[0], ref: 'foreign', amount: '999999' }
  assert(!render(input, { kind: 'source', fact: foreignFact }).includes('999999'))
})
test('empty results stay empty and never turn absence into zero or a supplier risk assertion', () => {
  const input = fixture(); input.metadata!.financial.periods = []; input.metadata!.financial.history = []
  input.metadata!.financial.status = 'EMPTY'; input.metadata!.financial.sourceVersion = null
  const html = render(input, { kind: 'report' })
  assert.match(html, /Brak pozycji/); assert(!html.includes('0,00 PLN')); assert(!html.includes('123456'))
})
test('source details retain an unsupported original unit without relabelling it PLN', () => {
  const input = fixture(), fact = input.metadata!.financial.periods[0].facts[0]
  fact.unit = 'EUR'; fact.currency = 'EUR'; fact.validation = 'UNVERIFIED'
  const html = render(input, { kind: 'source', fact })
  assert.match(html, /123456\.789 EUR/); assert.match(html, /jednostka źródłowa/)
  assert(!html.includes('123456.789 PLN'))
})
