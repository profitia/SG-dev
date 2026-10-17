import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import type { FinancialPeriodSelection } from '@profitia/srm-xray/contracts';

// No static React/root UI import may warm the module cache before this probe.
// This file runs in its own Node test process. The loader also proves that the
// guard is effective, rather than inferring independence from source strings.
register(new URL('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'react' || specifier.startsWith('react/') || specifier === 'react-dom' || specifier.startsWith('react-dom/')) throw new Error('React forbidden in the pure supplier port');
    return nextResolve(specifier, context);
  }
`)), import.meta.url);

test('public supplier rules and formatting load with React resolution forbidden', async () => {
  await assert.rejects(import('react'), /React forbidden in the pure supplier port/);
  const { executiveSummary } = await import('@profitia/srm-xray/executive-summary-rules');
  const { financialValue, compactFinancialValue } = await import('@profitia/srm-xray/financial-value');
  const { readSharedFinancialSummary } = await import('@profitia/srm-xray/shared-financial-summary');
  const selectedPeriod: FinancialPeriodSelection = { from: '2025-01-01', to: '2025-12-31' };
  const result = executiveSummary({ nip: '0000000000', entityType: 'COMPANY', metadata: null,
    scope: 'standalone', selectedPeriod, kysStatus: 'NOT_REQUESTED', kysHasData: false });
  assert.deepEqual(result.facts, []); assert.equal(result.limitations[0].id, 'metadata');
  assert.equal(financialValue('-0.50', 'PLN'), '−0,50 PLN');
  assert.equal(financialValue(null, 'PLN'), 'Brak wartości');
  assert.equal(financialValue('12345678901234567890.1234', 'PLN').replace(/\s/g, ''), '12345678901234567890,1234PLN');
  assert.match(compactFinancialValue('1234567890', 'PLN'), /1,2 mld zł/);
  const freshness = { retrievedAt: null, checkedAt: null, cacheExpiresAt: null, retentionUntil: null,
    freshness: 'ABSENT', readSource: 'STORED', lastRetrievalMethod: 'UNKNOWN' };
  const empty = { schemaVersion: '1.0', nip: '0000000000', entityType: 'COMPANY',
    financial: { status: 'EMPTY', source: 'MGBI', freshness, completeness: 'EMPTY', limitations: [],
      mappingVersion: null, sourceVersion: null, representationVersion: null, periods: [], history: [] },
    kys: { status: 'NOT_REQUESTED', source: 'VERCLY', freshness, completeness: 'UNKNOWN',
      lastAttemptStatus: null, lastAttemptAt: null, limitations: ['KYS_NOT_REQUESTED'], reportAvailable: false } };
  assert.deepEqual(readSharedFinancialSummary(empty, { nip: '0000000000', entityType: 'COMPANY' }), empty);
  assert.throws(() => readSharedFinancialSummary(empty, { nip: '1111111111', entityType: 'COMPANY' }));
});
