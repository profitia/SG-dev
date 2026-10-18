import assert from 'node:assert/strict'
import test from 'node:test'
import { OperationDenied, operationPayloadDigest, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import type { PoolClient } from 'pg'
import { createOperationSupplierRequestHandler, createRuntimeSupplierRequestHandler } from './supplier-request-handler'
import { readSupplierRequest, supplierRequestResourceId } from './supplier-request-operation'
import type { SrmReportRuntime } from './private-runtime'

const A = '11111111-1111-4111-8111-111111111111'
const command = { kind: 'SUPPLIER_REPORT', nip: '8650004194' } as const
const key = 'synthetic-request-key-0001'
const make = (body: unknown = command, headers: Record<string, string> = {}, suffix = '') => new Request(`https://app.fixture.test/api/xray/requests${suffix}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key, ...headers }, body: JSON.stringify(body),
})
function fixture() {
  let calls = 0, input: unknown
  const executor = { execute: async (value: unknown) => {
    calls++; input = value
    return { value: Response.json({ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ACCEPTED' }, { status: 202 }) }
  } } as unknown as OperationExecutor<PoolClient>
  return { handler: createOperationSupplierRequestHandler(executor, A), calls: () => calls, input: () => input }
}
test('supplier intent is closed, normalized by the existing NIP validator and independent of object order', () => {
  assert.deepEqual(readSupplierRequest(command), command)
  assert(Object.isFrozen(readSupplierRequest(command)))
  assert.equal(supplierRequestResourceId({ nip: command.nip, kind: command.kind }), `supplier-request:${operationPayloadDigest(command)}`)
  for (const value of [null, [], 'supplier', { ...command, userId: A }, { ...command, organisationId: A }, { ...command, destination: 'https://foreign.test' },
    { ...command, kind: 'KYS_PERSON' }, { ...command, nip: '8650004195' }, { ...command, nip: '0000000000' }, { ...command, nip: '865-000-4194' },
    { ...command, fields: ['personal'] }, Object.assign(Object.create(null), command)]) {
    assert.throws(() => readSupplierRequest(value), e => e instanceof OperationDenied && e.reasonCode === 'CONTEXT_INVALID')
  }
})
test('intent endpoint passes a fixed operation/resource and original request to the shared executor', async () => {
  const f = fixture(), request = make(command, { 'x-clerk-org-id': 'forged', 'x-clerk-user-id': 'forged' })
  assert.equal((await f.handler(request)).status, 202)
  const input = f.input() as Record<string, unknown>
  assert.equal(input.operation, 'supplier.report.refresh'); assert.equal(input.organisationId, A)
  assert.equal(input.resourceId, supplierRequestResourceId(command)); assert.deepEqual(input.payload, command)
  assert.equal(input.idempotencyKey, key); assert.equal(input.request, request)
  assert(!('userId' in input)); assert.equal(f.calls(), 1)
})
test('bad method, selector, media type, purpose, idempotency and actual oversized body never enter the executor', async () => {
  const f = fixture()
  for (const request of [new Request('https://app.fixture.test/api/xray/requests'),
    make(command, {}, `?organisationId=${A}&organisationId=${A}`), make(command, {}, '?organisationId='),
    make(command, {}, '?userId=forged'), make(command, { 'idempotency-key': '' }), make(command, { 'idempotency-key': 'a,b' }),
    make(command, { 'content-type': 'text/plain' }), make({ ...command, rawResponse: 'private' }),
    make({ ...command, padding: 'x'.repeat(2048) }, { 'content-length': '2' })]) {
    const response = await f.handler(request)
    assert([400, 405].includes(response.status)); assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('vary'), 'Cookie, Authorization')
    assert.deepEqual(await response.json(), { error: 'Operation unavailable' })
  }
  assert.equal(f.calls(), 0)
})
test('aborted or stalled request input is cancelled within a bound before authentication or persistence', async () => {
  const f = fixture(), controller = new AbortController(); controller.abort()
  assert.equal((await f.handler(new Request(make(), { signal: controller.signal }))).status, 400)
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{')) }, cancel() { cancelled = true } })
  const request = new Request('https://app.fixture.test/api/xray/requests', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body, duplex: 'half' } as RequestInit)
  const timeout = setTimeout(() => assert.fail('Request body deadline not enforced'), 6000)
  try { assert.equal((await f.handler(request)).status, 400); assert(cancelled); assert.equal(f.calls(), 0) }
  finally { clearTimeout(timeout) }
})
test('canonical denial categories keep intent unavailable and redact diagnostics', async () => {
  for (const [reason, status] of [['UNVERIFIED_IDENTITY',401],['PERMISSION_DENIED',403],['CONTEXT_INVALID',400],
    ['AUDIT_UNAVAILABLE',503],['LIMIT_POLICY_UNAVAILABLE',503],['LIMIT_EXCEEDED',429],['IDEMPOTENCY_CONFLICT',409]] as const) {
    const executor = { execute: async () => { throw new OperationDenied(reason) } } as unknown as OperationExecutor<PoolClient>
    const response = await createOperationSupplierRequestHandler(executor, A)(make())
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: 'Operation unavailable' })
  }
})
test('new intent entry is opt-in only and never borrows a demo callback or a report-only executor', async () => {
  const f = fixture()
  for (const runtime of [{ provider: 'legacy_demo' }, { provider: 'clerk', executor: {}, defaultOrganisationId: A }] as SrmReportRuntime[]) {
    assert.equal((await createRuntimeSupplierRequestHandler(() => runtime)(make())).status, 503)
  }
  assert.equal((await createRuntimeSupplierRequestHandler(() => { throw Error('private diagnostic') })(make())).status, 503)
  assert.equal(f.calls(), 0)
})
