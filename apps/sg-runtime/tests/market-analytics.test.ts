import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, OperationDenied, type OperationExecutor, type OperationInput } from '@profitia/platform-contracts/operation-context'
import { getBenchmarkAnalyticsSeries, getBenchmarkPreview } from '../lib/benchmark/service'
import { BenchmarkAppError } from '../lib/benchmark/errors'
import { createOperationBenchmarkAnalyticsHandler, createRuntimeBenchmarkAnalyticsHandler } from '../lib/benchmark/analytics-handlers'
import { MARKET_ANALYTICS_PROJECTION, MAX_MARKET_PREVIEW_BYTES, marketAnalyticsResourceId, marketPreviewResourceId,
  projectMarketAnalyticsResponse, projectMarketPreviewResponse } from '../lib/platform/market-preview'
import { GET as mountedGET } from '../app/api/benchmark/analytics-series/route'

const A = '11111111-1111-4111-8111-111111111111'
const selection = { seriesName: 'synthetic_series', range: 'ALL' } as const
const resource = { id: marketAnalyticsResourceId(selection.seriesName), type: 'market_knowledge', dataClass: 'SHARED_KNOWLEDGE',
  environment: 'development' as const, ownerOrganisationId: null, ownerUserId: null, approvedSharedProjection: true,
  version: MARKET_ANALYTICS_PROJECTION, projectionVersion: MARKET_ANALYTICS_PROJECTION }
const context = { payload: selection, resource }
const history = {
  providerSeries: { provider: { providerCode: 'MACROBOND' as const, displayName: 'Macrobond' }, providerSeriesId: selection.seriesName, providerSeriesKey: null },
  displayName: 'Stored source', frequency: 'monthly', currency: null, unit: 'ORIGINAL_UNSUPPORTED_UNIT', source: 'Synthetic',
  historical: [{ date: '2020-01-01T00:00:00.000Z', value: 10 }, { date: '2025-01-01T00:00:00.000Z', value: 0 }, { date: '2025-02-01T00:00:00.000Z', value: null }],
}
const request = (query = 'seriesId=synthetic_series&range=ALL', method = 'GET') =>
  new NextRequest(`https://app.fixture.test/api/benchmark/analytics-series?${query}`, { method,
    headers: { 'x-clerk-user-id': 'forged', 'x-clerk-org-id': A } })

test('actual analytics formatter uses explicit stored history and preserves range, zero, nulls and units', async () => {
  let reads = 0
  const read = async (series: string) => { reads++; assert.equal(series, selection.seriesName); return { history } }
  const all = await getBenchmarkAnalyticsSeries(selection.seriesName, 'ALL', read)
  assert.equal(reads, 1)
  assert.equal(all.latestValue, 0); assert.equal(all.currency, null); assert.equal(all.unit, history.unit)
  assert.deepEqual(all.historical, history.historical); assert.equal('changeMetrics' in all, false)
  const year = await getBenchmarkAnalyticsSeries(selection.seriesName, '1Y', read)
  assert.deepEqual(year.historical.map(point => point.value), [0, null]); assert.equal(year.latestValue, 0); assert.equal(reads, 2)
  assert(await projectMarketAnalyticsResponse(Response.json(all), context) instanceof Response)
})

test('analytics projection refuses private fields, foreign selections and preview representations', async () => {
  const good = await getBenchmarkAnalyticsSeries(selection.seriesName, 'ALL', async () => ({ history }))
  for (const bad of [
    { ...good, organisationId: A }, { ...good, range: '1Y' },
    { ...good, providerSeries: { ...good.providerSeries, providerSeriesId: 'foreign_series' } },
    { ...good, historical: [{ date: '2025-01-01', value: 0, userId: A }] },
    { ...good, historical: [{ date: 'invalid', value: null }] },
    { ...good, changeMetrics: {} },
  ]) await assert.rejects(projectMarketAnalyticsResponse(Response.json(bad), context), OperationDenied)
  await assert.rejects(projectMarketAnalyticsResponse(Response.json(good), { ...context, resource: { ...resource, id: marketPreviewResourceId(selection.seriesName) } }), OperationDenied)
  const preview = await getBenchmarkPreview(selection.seriesName, 'ALL', async () => ({ history }))
  await assert.rejects(projectMarketAnalyticsResponse(Response.json(preview), context), OperationDenied)
  await assert.rejects(projectMarketPreviewResponse(Response.json(good), { ...context, resource: { ...resource, id: marketPreviewResourceId(selection.seriesName) } }), OperationDenied)
  await assert.rejects(projectMarketAnalyticsResponse(new Response(' '.repeat(MAX_MARKET_PREVIEW_BYTES) + JSON.stringify(good)), context), OperationDenied)
})

test('native analytics preserves the existing seriesId API and pins its own resource before authority', async () => {
  const calls: OperationInput[] = []; let reads = 0
  const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT,
    async execute(input) { calls.push(input); throw new OperationDenied('PERMISSION_DENIED') } }
  const handler = createOperationBenchmarkAnalyticsHandler(executor, A, async () => { reads++; return {} })
  const response = await handler(request())
  assert.equal(response.status, 403); assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(calls[0]?.operation, 'knowledge.read'); assert.equal(calls[0]?.resourceId, resource.id)
  assert.equal(calls[0]?.organisationId, A); assert.deepEqual(calls[0]?.payload, selection)
  assert.equal(reads, 0)
  for (const query of ['seriesId=x&seriesId=y', 'seriesId=x&range=UNKNOWN', 'seriesId=*', 'seriesId=x&organisationId=',
    'seriesName=x', 'seriesId=x&userId=forged', 'seriesId=x&operation=knowledge.ingest', 'seriesId=x&representation=preview',
    `seriesId=${'a'.repeat(257)}`, 'seriesId=x&range=ALL&range=ALL']) {
    assert.equal((await handler(request(query))).status, 400)
  }
  const wrongMethod = await handler(request('', 'POST'))
  assert.equal(wrongMethod.status, 405); assert.equal(wrongMethod.headers.get('allow'), 'GET')
  assert.equal(calls.length, 1); assert.equal(reads, 0)
})

test('native authentication, permission and audit failures remain distinct and never call business code', async () => {
  for (const [reason, status] of [['UNVERIFIED_IDENTITY', 401], ['PERMISSION_DENIED', 403], ['CONTEXT_INVALID', 400],
    ['AUDIT_UNAVAILABLE', 503], ['POLICY_UNAVAILABLE', 503]] as const) {
    const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT, async execute() { throw new OperationDenied(reason) } }
    const response = await createOperationBenchmarkAnalyticsHandler(executor, A, async () => { throw Error('Must not run') })(request())
    assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})

test('preview capability or incomplete native configuration cannot borrow a legacy analytics handler', async () => {
  let legacy = 0; let preview = 0
  const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT, async execute() { throw new OperationDenied('PERMISSION_DENIED') } }
  const handler = createRuntimeBenchmarkAnalyticsHandler(() => ({ provider: 'clerk', executor, defaultOrganisationId: A,
    marketRead: { executor, preview: async () => { preview++; return getBenchmarkPreview(selection.seriesName, 'ALL', async () => ({ history })) } } }),
  async () => { legacy++; return NextResponse.json({ forbidden: true }) })
  assert.equal((await handler(request())).status, 503); assert.equal(legacy, 0); assert.equal(preview, 0)
  const broken = createRuntimeBenchmarkAnalyticsHandler(() => { throw Error('synthetic server configuration detail') },
    async () => { legacy++; return NextResponse.json({ forbidden: true }) })
  const response = await broken(request()); assert.equal(response.status, 503)
  assert(!(await response.text()).includes('synthetic server configuration detail')); assert.equal(legacy, 0)
})

test('legacy dispatcher preserves existing response identity, body and status', async () => {
  const response = NextResponse.json({ unchanged: true }, { status: 202 }); let calls = 0
  const handler = createRuntimeBenchmarkAnalyticsHandler(() => ({ provider: 'legacy_demo' }), async () => { calls++; return response })
  assert.equal(await handler(request()), response); assert.equal(calls, 1)
})

test('explicit history failures are propagated without provider hydration or invented observations', async () => {
  const failure = new BenchmarkAppError('STORED_HISTORY_NOT_AVAILABLE', 'Stored market history is not available.', 404)
  await assert.rejects(getBenchmarkAnalyticsSeries(selection.seriesName, 'ALL', async () => { throw failure }), error => error === failure)
})

test('actual mounted analytics refuses incomplete Clerk configuration without network or demo fallback', async () => {
  const prior = process.env.PROFITIA_AUTH_PROVIDER; const fetch = globalThis.fetch; let calls = 0
  process.env.PROFITIA_AUTH_PROVIDER = 'clerk'
  globalThis.fetch = async () => { calls++; throw Error('No network') }
  try {
    const response = await mountedGET(request()); assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(calls, 0)
  } finally {
    globalThis.fetch = fetch
    if (prior === undefined) delete process.env.PROFITIA_AUTH_PROVIDER
    else process.env.PROFITIA_AUTH_PROVIDER = prior
  }
})
