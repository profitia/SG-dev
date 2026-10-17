import assert from 'node:assert/strict'
import test from 'node:test'
import type { PoolClient } from 'pg'
import type { OperationContext, OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { executiveSummary } from '@profitia/srm-xray/executive-summary-rules'
import { FINANCIAL_MAPPING_VERSION } from './shared-catalog'
import type { ReportReadRow } from './report-data'
import { readSharedFinancialReport, projectSharedFinancialResponse, NO_STORED_FINANCIAL_SOURCE } from './shared-financial-read'
import { createOperationSharedFinancialHandler, createRuntimeSharedFinancialHandler } from './shared-financial-runtime'

const selection = { nip: '8650004194', entityType: 'COMPANY' as const }, org = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-10-17T10:00:00Z'), version = 'a'.repeat(64)
function fixture(): ReportReadRow & { registration_status?: 'ACTIVE' | 'LIQUIDATION' | 'DEREGISTERED' } {
  const periodStart = '2025-01-01', periodEnd = '2025-12-31'
  const facts: ReportReadRow['facts'] = ['PALA_NRFS', 'PALA_NPL'].map(metricCode => ({ metricCode, periodStart, periodEnd,
    statementScope: 'UNIT', amount: metricCode === 'PALA_NRFS' ? '123456.789' : '-3000', sourceAmount: metricCode === 'PALA_NRFS' ? '123456.789' : '-3000',
    currencyCode: 'PLN', unitCode: 'PLN', sourcePath: 'private-source-path', validationStatus: 'VALID', normalizationRule: 'SOURCE_VALUE', sourceSnapshotId: 'private-snapshot' }))
  return { nip: selection.nip, financial_sha256: version, financial_checked_at: now,
    financial_json: { status: 'SUCCESS', source: { provider: 'MGBI', model: 'private-model', recordId: 'private-record' }, retrievedAt: now.toISOString(), effectiveAt: periodEnd, warnings: [], catalogMappingVersion: FINANCIAL_MAPPING_VERSION,
      data: { qualityRule: 'FINANCIAL_QUALITY_V1', periods: [{ from: periodStart, to: periodEnd, scope: 'standalone', documentId: 'private-document:cfy', facts: facts.map(f => ({ metricCode: f.metricCode, amount: f.amount, currency: 'PLN', unit: 'PLN' })) }] } },
    facts, indicators: [], kys: null, registration_status: 'ACTIVE' }
}
function client(row: unknown) { return { query: async () => ({ rows: row ? [row] : [] }) } as unknown as Pick<PoolClient, 'query'> }
const response = (body: unknown) => Response.json(body, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } })
const context = { payload: selection } as unknown as OperationContext

test('shared stored values use the existing business projector and actual summary rules without private output', async () => {
  const report = await readSharedFinancialReport(client(fixture()), org, selection, version, now)
  const summary = executiveSummary({ ...selection, metadata: report, scope: 'standalone', selectedPeriod: { from: '2025-01-01', to: '2025-12-31' }, kysStatus: 'NOT_REQUESTED', kysHasData: false })
  assert.deepEqual(summary.facts.map(f => f.id), ['revenue', 'net'])
  assert(summary.facts[0].text.replace(/\s/g, '').includes('123456,789PLN'))
  assert(summary.facts[1].text.replace(/\s/g, '').includes('-3000PLN'))
  assert.equal(report.kys.status, 'NOT_REQUESTED'); assert.equal(report.kys.reportAvailable, false)
  const text = JSON.stringify(report)
  for (const secret of ['private-source-path', 'private-snapshot', 'private-model', 'private-record', 'private-document', 'preferenceScope', 'exportRef', 'scanner']) assert(!text.includes(secret), secret)
  assert.equal(await projectSharedFinancialResponse(response(report), context) instanceof Response, true)
})
test('wrong supplier, changed source and absent rows are refused; explicit no-data is truthful', async () => {
  for (const row of [null, { ...fixture(), nip: '1111111111' }, { ...fixture(), financial_sha256: 'b'.repeat(64) }]) {
    await assert.rejects(readSharedFinancialReport(client(row), org, selection, version, now))
  }
  await assert.rejects(readSharedFinancialReport(client({ ...fixture(), financial_sha256: null }), org, selection, NO_STORED_FINANCIAL_SOURCE, now))
  const empty = { nip: selection.nip, financial_json: null, financial_sha256: null, financial_checked_at: null, facts: [], indicators: [], kys: null }
  const report = await readSharedFinancialReport(client(empty), org, selection, NO_STORED_FINANCIAL_SOURCE, now)
  assert.deepEqual(report.financial.periods, []); assert.equal(report.financial.freshness.freshness, 'ABSENT')
})
test('known catalog removal or liquidation suppresses financial results without consulting private archives', async () => {
  for (const registration_status of ['LIQUIDATION', 'DEREGISTERED'] as const) {
    const report = await readSharedFinancialReport(client({ ...fixture(), registration_status }), org, selection, version, now)
    assert.deepEqual(report.financial.periods, []); assert.equal(report.financial.sourceVersion, null)
  }
})
test('shared output refuses private capabilities, supplier substitution and cache/header changes', async () => {
  const report = await readSharedFinancialReport(client(fixture()), org, selection, version, now)
  for (const body of [{ ...report, nip: '1111111111' }, { ...report, preferenceScope: 'private' }, { ...report, kys: { ...report.kys, exportRef: 'private' } },
    { ...report, kys: { ...report.kys, reportAvailable: true } }, { ...report, kys: { ...report.kys, lastAttemptAt: now.toISOString() } },
    { ...report, kys: { ...report.kys, freshness: { ...report.kys.freshness, retrievedAt: now.toISOString() } } },
    { ...report, financial: { ...report.financial, scanner: {} } }]) {
    await assert.rejects(projectSharedFinancialResponse(response(body), context))
  }
  for (const patch of [{ 'Cache-Control': 'public' }, { Vary: '' }, { 'Set-Cookie': 'private' }, { Location: 'https://foreign.invalid' }]) {
    const value = response(report); for (const [key, value2] of Object.entries(patch)) value.headers.set(key, value2)
    await assert.rejects(projectSharedFinancialResponse(value, context))
  }
})
test('bearer-only request port removes cookies and cannot select another operation or private payload', async () => {
  let calls = 0
  const executor = { async execute(input: { operation: string; request: Request; payload: unknown }) {
    calls++; assert.equal(input.operation, 'supplier.report.read'); assert.deepEqual(input.payload, selection)
    assert.deepEqual([...input.request.headers.keys()], ['authorization'])
    return { value: response({ isolatedBoundaryProbe: true }) }
  } } as unknown as OperationExecutor<PoolClient>
  const handler = createOperationSharedFinancialHandler(executor, org)
  const make = (query = `nip=${selection.nip}`, authorization = 'Bearer fixture') => new Request(`https://app.fixture.test/api/xray/financial-summary?${query}`, {
    headers: { authorization, Cookie: 'unrelated', 'x-clerk-user-id': 'forged', 'x-clerk-org-id': org, 'x-clerk-org-role': 'admin' } })
  assert.equal((await handler(make())).status, 200)
  for (const query of [`nip=${selection.nip}&nip=${selection.nip}`, `nip=${selection.nip}&organisationId=demo`, `nip=${selection.nip}&organisationId=`, `nip=${selection.nip}&operation=supplier.report.export`]) assert.equal((await handler(make(query))).status, 400)
  for (const authorization of ['', 'Basic fixture', 'Bearer fixture extra']) assert.equal((await handler(make(undefined, authorization))).status, 401)
  assert.equal(calls, 1)
})
test('missing bearer or unavailable configuration cannot activate a demo or create a database dependency', async () => {
  let calls = 0
  const request = new Request(`https://app.fixture.test/api/xray/financial-summary?nip=${selection.nip}`)
  const resolve = () => { calls++; throw Error('private diagnostic') }
  assert.equal((await createRuntimeSharedFinancialHandler(resolve)(request)).status, 401); assert.equal(calls, 0)
  const bearer = new Request(request, { headers: { authorization: 'Bearer fixture' } })
  const failed = await createRuntimeSharedFinancialHandler(resolve)(bearer)
  assert.equal(failed.status, 503); assert.deepEqual(await failed.json(), { error: 'Operation unavailable' })
  assert.equal((await createRuntimeSharedFinancialHandler(() => ({ provider: 'legacy_demo' }))(bearer)).status, 503)
})
