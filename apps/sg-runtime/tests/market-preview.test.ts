import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { OPERATION_CONTRACT, OperationDenied, type OperationExecutor, type OperationInput } from '@profitia/platform-contracts/operation-context';
import { getBenchmarkPreview } from '../lib/benchmark/service';
import { BenchmarkAppError } from '../lib/benchmark/errors';
import { createOperationBenchmarkPreviewHandler, createRuntimeBenchmarkPreviewHandler } from '../lib/benchmark/preview-handlers';
import { MARKET_PREVIEW_PROJECTION, marketPreviewResourceId, readMarketPreviewSelection, projectMarketPreviewResponse } from '../lib/platform/market-preview';
import { GET as mountedGET } from '../app/api/benchmark/preview/route';
const A = '11111111-1111-4111-8111-111111111111';
const selected = { seriesName: 'synthetic_series', range: 'ALL' } as const;
const resource = { id: marketPreviewResourceId(selected.seriesName), type: 'market_knowledge', dataClass: 'SHARED_KNOWLEDGE', environment: 'development' as const,
    ownerOrganisationId: null, ownerUserId: null, approvedSharedProjection: true, version: MARKET_PREVIEW_PROJECTION, projectionVersion: MARKET_PREVIEW_PROJECTION };
const context = { payload: selected, resource };
const history = { providerSeries: { provider: { providerCode: 'MACROBOND' as const, displayName: 'Macrobond' }, providerSeriesId: selected.seriesName, providerSeriesKey: null },
    displayName: 'Stored market series', frequency: 'monthly', currency: null, unit: 'UNSUPPORTED_SOURCE_UNIT', source: 'Synthetic source',
    historical: [{ date: '2020-01-01T00:00:00.000Z', value: 10 }, { date: '2025-01-01T00:00:00.000Z', value: 0 }, { date: '2025-02-01T00:00:00.000Z', value: null }] };
const request = (suffix = '?seriesName=synthetic_series&range=ALL', method = 'GET') => new NextRequest('https://app.fixture.test/api/benchmark/preview' + suffix, { method, headers: { 'x-clerk-user-id': 'forged-user', 'x-clerk-org-id': A } });
test('actual preview formatter reuses stored history with correct range, nulls, zero and original units', async () => {
    let reads = 0;
    const reader = async (series: string) => { reads++; assert.equal(series, selected.seriesName); return { history }; };
    const all = await getBenchmarkPreview(selected.seriesName, 'ALL', reader);
    assert.equal(reads, 1);
    assert.equal(all.latestValue, 0);
    assert.equal(all.unit, 'UNSUPPORTED_SOURCE_UNIT');
    assert.equal(all.currency, null);
    assert.deepEqual(all.historical, history.historical);
    assert.equal(all.changeMetrics['1Y'], -100);
    const year = await getBenchmarkPreview(selected.seriesName, '1Y', reader);
    assert.equal(year.historical.length, 2);
    assert.equal(year.historical[1]?.value, null);
    assert.equal(year.latestValue, 0);
    assert.equal(reads, 2);
    assert.equal(await projectMarketPreviewResponse(Response.json(all), context) instanceof Response, true);
});
test('shared output rejects foreign series/range/resource, private fields and nonfinite data', async () => {
    const good = await getBenchmarkPreview(selected.seriesName, 'ALL', async () => ({ history }));
    const values = [{ ...good, organisationId: A }, { ...good, providerSeries: { ...good.providerSeries, providerSeriesId: 'another_series' } },
        { ...good, range: '1Y' }, { ...good, historical: [{ date: '2025-01-01', value: 1, userId: 'private' }] },
        { ...good, changeMetrics: { ...good.changeMetrics, privateNote: 'private' } }, { ...good, historical: [{ date: 'not-a-date', value: null }] }];
    for (const value of values)
        await assert.rejects(projectMarketPreviewResponse(Response.json(value), context), OperationDenied);
    await assert.rejects(projectMarketPreviewResponse(Response.json(good), { ...context, resource: { ...resource, id: 'foreign' } }), OperationDenied);
    await assert.rejects(projectMarketPreviewResponse(Response.json({ error: 'not available' }, { status: 404 }), context), OperationDenied);
});
test('stored series selection cannot carry identity, operation, wildcard, malformed range or unbounded identifiers', () => {
    assert.deepEqual(readMarketPreviewSelection({ seriesName: ' synthetic_series ' }), { seriesName: 'synthetic_series', range: '1Y' });
    for (const value of [{ ...selected, userId: A }, { ...selected, operation: 'knowledge.ingest' }, { ...selected, seriesName: '*' }, { ...selected, range: 'UNKNOWN' }, { ...selected, seriesName: 'a'.repeat(257) }])
        assert.throws(() => readMarketPreviewSelection(value), OperationDenied);
});
test('actual native handler pins current operation/resource/payload and refuses invalid selectors before authority', async () => {
    const calls: OperationInput[] = [];
    let business = 0;
    const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT, async execute(input) { calls.push(input); throw new OperationDenied('PERMISSION_DENIED'); } };
    const handler = createOperationBenchmarkPreviewHandler(executor, A, async () => { business++; return {}; });
    const valid = await handler(request());
    assert.equal(valid.status, 403);
    assert.equal(valid.headers.get('cache-control'), 'private, no-store');
    assert.equal(calls[0]?.operation, 'knowledge.read');
    assert.equal(calls[0]?.resourceId, resource.id);
    assert.equal(calls[0]?.organisationId, A);
    assert.deepEqual(calls[0]?.payload, selected);
    assert.equal(business, 0);
    for (const suffix of ['?seriesName=x&seriesName=y', '?seriesName=x&organisationId=', '?seriesName=x&userId=forged', '?seriesName=x&range=UNKNOWN', '?seriesName=*'])
        assert.equal((await handler(request(suffix))).status, 400);
    assert.equal((await handler(request('', 'POST'))).status, 405);
    assert.equal(calls.length, 1);
    assert.equal(business, 0);
});
test('explicit private mode without its own market capability cannot call legacy preview', async () => {
    let legacy = 0;
    const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT, async execute() { throw new OperationDenied('PERMISSION_DENIED'); } };
    const response = await createRuntimeBenchmarkPreviewHandler(() => ({ provider: 'clerk', executor, defaultOrganisationId: A }), async () => { legacy++; throw Error('Must not run'); })(request());
    assert.equal(response.status, 503);
    assert.equal(legacy, 0);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('legacy dispatcher preserves existing business callback, result and errors without market configuration', async () => {
    let calls = 0;
    const old = NextResponse.json({ synthetic: 'unchanged' }, { status: 202 });
    const response = await createRuntimeBenchmarkPreviewHandler(() => ({ provider: 'legacy_demo' }), async () => { calls++; return old; })(request());
    assert.equal(response, old);
    assert.equal(response.status, 202);
    assert.equal(calls, 1);
    const failure = new BenchmarkAppError('STORED_HISTORY_NOT_AVAILABLE', 'Stored market history is not available.', 404);
    await assert.rejects(getBenchmarkPreview(selected.seriesName, 'ALL', async () => { throw failure; }), error => error === failure);
});
test('mounted preview refuses incomplete individual configuration without provider fallback', async () => {
    const prior = process.env.PROFITIA_AUTH_PROVIDER;
    process.env.PROFITIA_AUTH_PROVIDER = 'clerk';
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error('No external requests'); };
    try {
        const response = await mountedGET(request());
        assert.equal(response.status, 503);
        assert.equal(calls, 0);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
    finally {
        globalThis.fetch = original;
        if (prior === undefined)
            delete process.env.PROFITIA_AUTH_PROVIDER;
        else
            process.env.PROFITIA_AUTH_PROVIDER = prior;
    }
});
