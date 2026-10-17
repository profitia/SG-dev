import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from './private-runtime'
import { fetchSupplierSummary, readSupplierSummarySelection, SUPPLIER_SUMMARY_HEADERS } from './supplier-summary'

const response = (status: number) => Response.json({ error: 'Operation unavailable' }, { status, headers: SUPPLIER_SUMMARY_HEADERS })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createOperationSupplierSummaryHandler(executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string,
  options: { origin: string; fetcher?: typeof fetch }) {
  if (!uuid.test(defaultOrganisationId)) throw new TypeError('Explicit server organisation required')
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const denied = response(405); denied.headers.set('Allow', 'GET'); return denied }
    const authorization = request.headers.get('authorization') ?? ''
    if (!/^Bearer [^\s]{1,8192}$/.test(authorization)) return response(401)
    let selection, organisationId: string
    try {
      const parameters = new URL(request.url).searchParams
      if ([...parameters.keys()].some(key => !['nip','entityType','organisationId'].includes(key))
        || [...new Set(parameters.keys())].some(key => parameters.getAll(key).length !== 1)) return response(400)
      selection = readSupplierSummarySelection({ nip: parameters.get('nip'), entityType: parameters.get('entityType') ?? 'COMPANY' })
      organisationId = parameters.get('organisationId') ?? defaultOrganisationId
      if (!uuid.test(organisationId)) return response(400)
    } catch { return response(400) }
    // Authentication and the outbound request use exactly this captured bearer,
    // never a different cookie or a caller-supplied identity/role header.
    const authenticatedRequest = new Request(request.url, { method: 'GET', signal: request.signal, headers: { authorization } })
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'supplier.report.read', organisationId, resourceId: `supplier-report:${selection.entityType}:${selection.nip}`,
        payload: selection, request: authenticatedRequest }, context => fetchSupplierSummary({
          origin: options.origin, fetcher: options.fetcher, authorization, context, signal: request.signal,
        }))
      return result.value
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return response(reason === 'UNVERIFIED_IDENTITY' ? 401 : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

export function createRuntimeSupplierSummaryHandler(resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const denied = response(405); denied.headers.set('Allow', 'GET'); return denied }
    if (!/^Bearer [^\s]{1,8192}$/.test(request.headers.get('authorization') ?? '')) return response(401)
    try {
      const runtime = resolveRuntime()
      if (runtime.provider !== 'clerk' || !runtime.supplierSummary) return response(503)
      return await createOperationSupplierSummaryHandler(runtime.supplierSummary.executor, runtime.defaultOrganisationId,
        { origin: runtime.supplierSummary.origin })(request)
    } catch { return response(503) }
  }
}
