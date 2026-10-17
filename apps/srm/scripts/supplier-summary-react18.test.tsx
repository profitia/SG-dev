import assert from 'node:assert/strict';
import test from 'node:test';
import React, { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExecutiveSummary } from '@profitia/srm-xray/executive-summary';
import { executiveSummary, type ExecutiveSummaryInput } from '@profitia/srm-xray/executive-summary-rules';
import type { FinancialFactEvidence } from '@profitia/srm-xray/contracts';

/** Copied unchanged into an isolated consumer by CI. Imports are exclusively
 * public package ports, never private app code, a router, IdP or a database. */
function fixture(): ExecutiveSummaryInput {
  const from = '2025-01-01', to = '2025-12-31', documentRef = 'synthetic-document';
  const fact = (metricCode: string, amount: string): FinancialFactEvidence => ({ ref: `synthetic-${metricCode}`, documentRef,
    metricCode, periodStart: from, periodEnd: to, scope: 'standalone', amount, sourceAmount: amount,
    currency: 'PLN', unit: 'PLN', validation: 'VERIFIED', normalization: 'SOURCE_VALUE', normalizationRule: null, reasonCode: null });
  const freshness = { retrievedAt: '2026-10-17T10:00:00Z', checkedAt: '2026-10-17T10:00:00Z', cacheExpiresAt: '2026-10-24T10:00:00Z', retentionUntil: null,
    freshness: 'FRESH' as const, readSource: 'STORED' as const, lastRetrievalMethod: 'CACHE' as const };
  return { nip: '0000000000', entityType: 'COMPANY', scope: 'standalone', selectedPeriod: { from, to }, kysStatus: 'NOT_REQUESTED', kysHasData: false,
    metadata: { schemaVersion: '1.0', nip: '0000000000', entityType: 'COMPANY',
      financial: { status: 'SUCCESS', source: 'MGBI', freshness, completeness: 'PARTIAL', limitations: [], mappingVersion: 'synthetic-mapping', representationVersion: 'synthetic-representation', sourceVersion: 'synthetic-source',
        periods: [{ from, to, year: '2025', scope: 'standalone', documentRef, facts: [fact('PALA_NRFS', '123456.789'), fact('PALA_NPL', '-3000')] }], history: [] },
      kys: { status: 'NOT_REQUESTED', source: 'VERCLY', freshness: { ...freshness, freshness: 'ABSENT' }, completeness: 'UNKNOWN', lastAttemptStatus: null, lastAttemptAt: null, limitations: [], reportAvailable: false } } };
}
test('the existing Supplier Intelligence module really renders with React18', () => {
  assert.equal(React.version, '18.3.1');
  const input = fixture();
  const model = executiveSummary(input); assert.deepEqual(model.facts.map(fact => fact.id), ['revenue', 'net']);
  const html = renderToStaticMarkup(<ExecutiveSummary input={input} onSource={() => {}} onIndicator={() => {}} onDetails={() => {}} onFinance={() => {}} />);
  assert.match(html, /Przychody/); assert.match(html, /Wynik netto/); assert.match(html, /123[\s\u00a0]?456,789/);
  assert(!html.includes('synthetic-document')); assert(!html.includes('synthetic-source'));
});
test('the module invokes host callbacks without owning routing, authentication or fetching', () => {
  const input = fixture(), calls: unknown[] = [];
  const tree = ExecutiveSummary({ input, onSource: fact => { calls.push(fact.ref); }, onIndicator: code => { calls.push(code); }, onDetails: () => { calls.push('details'); }, onFinance: () => { calls.push('finance'); } });
  const buttons: Array<{ children?: ReactNode; onClick?: () => void; 'aria-label'?: string }> = [];
  function visit(node: ReactNode): void {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!isValidElement(node)) return;
    const props = node.props as { children?: ReactNode; onClick?: () => void; 'aria-label'?: string };
    if (node.type === 'button') buttons.push(props);
    visit(props.children);
  }
  visit(tree);
  buttons.find(button => button['aria-label']?.includes('Przychody'))!.onClick!();
  buttons.find(button => button.children === 'Zobacz wskaźniki')!.onClick!();
  buttons.find(button => button.children === 'Przejdź do sprawozdania')!.onClick!();
  assert.deepEqual(calls, ['synthetic-PALA_NRFS', 'finance', 'details']);
});
test('foreign supplier, wrong period, loading and unverified facts do not become confirmed summary values', () => {
  for (const change of [(input: ExecutiveSummaryInput) => { input.nip = '1111111111'; },
    (input: ExecutiveSummaryInput) => { input.selectedPeriod = { from: '2024-01-01', to: '2024-12-31' }; },
    (input: ExecutiveSummaryInput) => { input.scope = 'consolidated'; },
    (input: ExecutiveSummaryInput) => { input.loading = true; },
    (input: ExecutiveSummaryInput) => { input.metadata = null; }]) {
    const input = fixture(); change(input); assert.deepEqual(executiveSummary(input).facts, []);
  }
  const input = fixture(); input.metadata!.financial.periods[0].facts[0].validation = 'UNVERIFIED';
  assert(!executiveSummary(input).facts.some(fact => fact.id === 'revenue'));
});
