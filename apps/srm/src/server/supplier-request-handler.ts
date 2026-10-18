import type { PoolClient } from 'pg'
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { validRequestIdempotencyKey } from '@profitia/platform-contracts/request-ledger'
import { readPresentationJson } from '@profitia/platform-contracts/embedded-read-channel'
import { getSrmReportRuntime, type SrmReportRuntime } from './private-runtime'
import { MAX_SUPPLIER_REQUEST_BYTES, readSupplierRequest, supplierRequestResourceId, persistSupplierRequest } from './supplier-request-operation'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const response = (status: number) => Response.json({ error: 'Operation unavailable' }, {
  status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization' },
})

export function createOperationSupplierRequestHandler(executor: OperationExecutor<PoolClient>, defaultOrganisationId: string) {
  if (!uuid.test(defaultOrganisationId)) throw new TypeError('Explicit supplier request organisation required')
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') { const r = response(405); r.headers.set('Allow', 'POST'); return r }
    const parameters = new URL(request.url).searchParams
    if ([...parameters.keys()].some(k => k !== 'organisationId') || parameters.getAll('organisationId').length > 1) return response(400)
    const organisationId = parameters.get('organisationId') ?? defaultOrganisationId
    const idempotencyKey = request.headers.get('idempotency-key')
    if (!uuid.test(organisationId) || !validRequestIdempotencyKey(idempotencyKey)
      || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return response(400)
    let command
    try {
      if (request.signal.aborted || !request.body) return response(400)
      const stream = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(), {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(3000)]),
      })
      command = readSupplierRequest(await readPresentationJson(new Response(stream, {
        headers: { 'content-type': 'application/json' },
      }), MAX_SUPPLIER_REQUEST_BYTES))
    } catch { return response(400) }
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'supplier.report.refresh', organisationId, resourceId: supplierRequestResourceId(command),
        payload: command, idempotencyKey, request,
      }, persistSupplierRequest)
      if (!(result.value instanceof Response)) return response(503)
      return result.value
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return response(reason === 'UNVERIFIED_IDENTITY' ? 401
        : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE'].includes(reason) ? 503
        : reason === 'CONTEXT_INVALID' ? 400 : reason === 'IDEMPOTENCY_CONFLICT' ? 409 : reason === 'LIMIT_EXCEEDED' ? 429 : 403)
    }
  }
}

/** Additive intent API. It never falls back to demo or calls a provider. */
export function createRuntimeSupplierRequestHandler(resolveRuntime: () => SrmReportRuntime = getSrmReportRuntime) {
  return async (request: Request): Promise<Response> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider !== 'clerk' || !runtime.supplierRequest) return response(503)
      return await createOperationSupplierRequestHandler(runtime.supplierRequest.executor, runtime.defaultOrganisationId)(request)
    } catch { return response(503) }
  }
}
