import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Prisma } from '@prisma/client'
import { OperationDenied, type OperationContext, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { fetchSupplierSummary, projectSupplierSummaryResponse, readSupplierSummarySelection, SUPPLIER_SUMMARY_HEADERS } from '../lib/platform/supplier-summary'
import { createOperationSupplierSummaryHandler, createRuntimeSupplierSummaryHandler } from '../lib/platform/supplier-summary-runtime'
import { GET as deployedGET } from '../app/api/supplier/financial-summary/route'

const org = '11111111-1111-4111-8111-111111111111', nip = '0000000000'
const context = { applicationId: 'spendguru', organisationId: org, operation: 'supplier.report.read',
  resourceId: `supplier-report:COMPANY:${nip}`, payload: { nip, entityType: 'COMPANY' } } as unknown as Readonly<OperationContext>
function body() {
  const freshness = { retrievedAt: null, checkedAt: null, cacheExpiresAt: null, retentionUntil: null,
    freshness: 'ABSENT', readSource: 'STORED', lastRetrievalMethod: 'UNKNOWN' }
  return { schemaVersion: '1.0', nip, entityType: 'COMPANY', financial: { status: 'EMPTY', source: 'MGBI', freshness,
    completeness: 'EMPTY', limitations: [], mappingVersion: null, sourceVersion: null, representationVersion: null, periods: [], history: [] },
    kys: { status: 'NOT_REQUESTED', source: 'VERCLY', freshness, completeness: 'UNKNOWN', lastAttemptStatus: null,
      lastAttemptAt: null, limitations: ['KYS_NOT_REQUESTED'], reportAvailable: false } }
}
const response = (data: unknown = body()) => Response.json(data, { headers: SUPPLIER_SUMMARY_HEADERS })
const call = (fetcher: typeof fetch, extra: Partial<Parameters<typeof fetchSupplierSummary>[0]> = {}) => fetchSupplierSummary({
  origin: 'https://srm-peer.fixture.test', authorization: 'Bearer synthetic_session', context,
  signal: new AbortController().signal, fetcher, ...extra,
})
test('the second host binds the installed public module and its declared producer source', () => {
  const manifest = JSON.parse(readFileSync(new URL('../operation-integration.json', import.meta.url), 'utf8'))
  const receipt = manifest.supplierSummary, current = manifest.appshellXraySourceCompatibility.publicUi
  const port = pathToFileURL(createRequire(import.meta.url).resolve('@profitia/srm-xray/shared-financial-summary'))
  const installed = JSON.parse(readFileSync(new URL('../package.json', port), 'utf8'))
  assert.equal(receipt.version, '0.2.1'); assert.equal(current.version, '0.3.0')
  assert.equal(installed.version, current.version); assert.equal(installed.name, receipt.package)
  assert.equal(current.package, receipt.package)
  assert.equal(receipt.producer.projectKey, 'SRM')
  for (const name of receipt.publicPorts) assert(Object.hasOwn(installed.exports, './' + name))
  assert.equal(readFileSync(port, 'utf8'), execFileSync('git', ['show', receipt.producer.sourceSha + ':packages/srm-xray/src/shared-financial-summary.ts'], { encoding: 'utf8' }))
})

test('only exact typed selection and server-owned peer context can enter the transport', async () => {
  assert.deepEqual(readSupplierSummarySelection({ nip, entityType: 'COMPANY' }), { nip, entityType: 'COMPANY' })
  for (const invalid of [null, [], { nip }, { nip, entityType: 'COMPANY', operation: 'export' }, { nip: 1234567890, entityType: 'COMPANY' },
    { nip, entityType: { toString: () => 'COMPANY' } }, { nip: 'short', entityType: 'COMPANY' }]) assert.throws(() => readSupplierSummarySelection(invalid))
  let calls = 0
  const fetcher: typeof fetch = async () => { calls++; return response() }
  for (const extra of [{ origin: 'http://srm-peer.fixture.test' }, { origin: 'https://srm-peer.fixture.test/path' },
    { authorization: '' }, { authorization: 'Bearer one two' }, { timeoutMs: 0 }, { timeoutMs: 5001 }, { maximumBytes: 0 },
    { context: { ...context, operation: 'supplier.report.export' } as typeof context },
    { context: { ...context, resourceId: 'supplier-report:COMPANY:1111111111' } as typeof context }]) await assert.rejects(call(fetcher, extra))
  assert.equal(calls, 0)
})
test('actual transport sends only captured bearer, own authorised organisation and read selection, then rebuilds private output', async () => {
  let calls = 0
  const fetcher: typeof fetch = async (input, init) => {
    calls++; const url = new URL(String(input))
    assert.equal(url.origin, 'https://srm-peer.fixture.test'); assert.equal(url.pathname, '/api/xray/financial-summary')
    assert.deepEqual([...url.searchParams], [['nip', nip], ['entityType','COMPANY'], ['organisationId', org]])
    assert.deepEqual(init?.headers, { authorization: 'Bearer synthetic_session' })
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store')
    assert(init?.signal); return response()
  }
  const result = await call(fetcher)
  assert.equal(calls, 1); assert.equal(result.status, 200); assert.deepEqual(await result.clone().json(), body())
  assert.equal(result.headers.get('cache-control'), 'private, no-store'); assert.equal(result.headers.get('vary'), 'Cookie, Authorization')
  assert.equal(await projectSupplierSummaryResponse(result, context), result)
})
test('wrong supplier, private projections, headers, redirects, MIME and oversize bodies fail closed', async () => {
  for (const data of [{ ...body(), nip: '1111111111' }, { ...body(), preferenceScope: 'private' },
    { ...body(), kys: { ...body().kys, exportRef: 'private' } }, { ...body(), financial: { ...body().financial, scanner: {} } }]) {
    await assert.rejects(call(async () => response(data)))
    await assert.rejects(projectSupplierSummaryResponse(response(data), context))
  }
  for (const headers of [{ 'cache-control': 'public' }, { vary: '' }, { 'set-cookie': 'private' },
    { location: 'https://foreign.invalid' }, { 'content-type': 'text/html' }, { 'content-length': '5000000' }]) {
    await assert.rejects(call(async () => { const result = response(); for (const [key, value] of Object.entries(headers)) result.headers.set(key, value); return result }))
  }
  await assert.rejects(call(async () => response(), { maximumBytes: 10 }))
  await assert.rejects(call(async () => new Response('not JSON', { headers: { ...SUPPLIER_SUMMARY_HEADERS, 'content-type': 'application/json' } })))
  await assert.rejects(call(async () => Response.redirect('https://foreign.invalid', 302)))
  for (const status of [401,403,404,500]) await assert.rejects(call(async () => new Response('private upstream diagnostics', { status })))
})
test('caller cancellation and bounded peer deadline propagate through the request without returning late data', async () => {
  let calls = 0
  const controller = new AbortController(); controller.abort()
  await assert.rejects(call(async () => { calls++; return response() }, { signal: controller.signal })); assert.equal(calls, 0)
  await assert.rejects(call(async (_input, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('synthetic aborted peer')), { once: true })
  }), { timeoutMs: 15 }))
})
test('real dispatcher never accepts cookie/header authority or caller-selected operation and peer', async () => {
  let executions = 0, reads = 0
  const executor = { async execute(input: { request: Request; operation: string; organisationId: string; payload: unknown }, action: (value: typeof context) => Promise<Response>) {
    executions++; assert.equal(input.operation, 'supplier.report.read'); assert.equal(input.organisationId, org)
    assert.deepEqual([...input.request.headers], [['authorization','Bearer synthetic_session']]); assert.deepEqual(input.payload, context.payload)
    return { value: await action(context) }
  } } as unknown as OperationExecutor<Prisma.TransactionClient>
  const handler = createOperationSupplierSummaryHandler(executor, org, { origin: 'https://srm-peer.fixture.test',
    fetcher: async () => { reads++; return response() } })
  const request = (query = `nip=${nip}`, authorization = 'Bearer synthetic_session') => new Request(`https://sg2.fixture.test/api/supplier/financial-summary?${query}`, {
    headers: { authorization, Cookie: 'unrelated', 'x-clerk-user-id': 'forged', 'x-clerk-org-id': 'foreign', 'x-clerk-org-role': 'admin' },
  })
  assert.equal((await handler(request())).status, 200)
  for (const query of [`nip=${nip}&nip=${nip}`, `nip=${nip}&organisationId=demo`, `nip=${nip}&url=https://foreign.invalid`, `nip=${nip}&operation=supplier.report.export`]) assert.equal((await handler(request(query))).status, 400)
  for (const authorization of ['', 'Basic fixture', 'Bearer one two']) assert.equal((await handler(request(undefined, authorization))).status, 401)
  assert.equal((await handler(new Request(request(), { method: 'POST' }))).status, 405)
  assert.equal(executions, 1); assert.equal(reads, 1)
})
test('runtime routing stays closed without explicit supplier capability and never falls back to demo or raw errors', async () => {
  let calls = 0
  const request = (authorization = '') => new Request(`https://sg2.fixture.test/api/supplier/financial-summary?nip=${nip}`, { headers: { authorization } })
  const fail = () => { calls++; throw new Error('private database diagnostics') }
  assert.equal((await createRuntimeSupplierSummaryHandler(fail)(request())).status, 401); assert.equal(calls, 0)
  for (const resolve of [fail, () => ({ provider: 'legacy_demo' as const }), () => ({ provider: 'clerk' as const, executor: {} as OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: org })]) {
    const result = await createRuntimeSupplierSummaryHandler(resolve)(request('Bearer synthetic_session'))
    assert.equal(result.status, 503); assert.deepEqual(await result.json(), { error: 'Operation unavailable' })
    assert.equal(result.headers.get('cache-control'), 'private, no-store')
  }
  assert.equal((await deployedGET(request())).status, 401)
  const denied = { async execute() { throw new OperationDenied('PERMISSION_DENIED') } } as unknown as OperationExecutor<Prisma.TransactionClient>
  const result = await createOperationSupplierSummaryHandler(denied, org, { origin: 'https://srm-peer.fixture.test' })(request('Bearer synthetic_session'))
  assert.equal(result.status, 403); assert.deepEqual(await result.json(), { error: 'Operation unavailable' })
})
