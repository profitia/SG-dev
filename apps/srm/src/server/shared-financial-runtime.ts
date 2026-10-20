import type { OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { OPERATION_CONTRACT, isOperationDenied } from '@profitia/platform-contracts/operation-context'
import type { PoolClient } from 'pg'
import { getSrmReportRuntime, type SrmReportRuntime } from './private-runtime'
import { validateReportSelection } from './report-data'
import { readSharedFinancialReport } from './shared-financial-read'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
const respond = (status: number) => Response.json({ error: 'Operation unavailable' }, { status, headers })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createOperationSharedFinancialHandler(executor: OperationExecutor<PoolClient>, defaultOrganisationId: string,
  env: Readonly<Record<string, string | undefined>> = process.env) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const response = respond(405); response.headers.set('Allow', 'GET'); return response }
    if (request.headers.has('cookie') || request.headers.has('origin')) return respond(401)
    const authorization = request.headers.get('authorization') ?? ''
    if (!/^Bearer [^\s]{1,8192}$/.test(authorization)) return respond(401)
    let selection, organisationId: string
    try {
      const params = new URL(request.url).searchParams
      if ([...params.keys()].some(key => !['nip','entityType','organisationId'].includes(key))
        || [...new Set(params.keys())].some(key => params.getAll(key).length !== 1)) return respond(400)
      selection = validateReportSelection({ nip: params.get('nip'), entityType: params.get('entityType') ?? undefined })
      organisationId = params.get('organisationId') ?? defaultOrganisationId
      if (!uuid.test(organisationId)) return respond(400)
    } catch { return respond(400) }
    // Reject browser credentials before projecting headers. Their absence is a
    // real ingress check, not a consequence of stripping them before identity.
    const identityHeaders = new Headers({ authorization })
    const host = request.headers.get('host')
    if (host !== null) identityHeaders.set('host', host)
    const authenticatedRequest = new Request(request.url, { method: 'GET', signal: request.signal, headers: identityHeaders })
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'supplier.report.read', organisationId, resourceId: `supplier-report:${selection.entityType}:${selection.nip}`,
        payload: selection, request: authenticatedRequest }, async (context, client) => Response.json(
          await readSharedFinancialReport(client, context.organisationId!, selection, context.resource.version, new Date(), env), { headers }))
      return result.value
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return respond(reason === 'UNVERIFIED_IDENTITY' ? 401 : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

/** Reuses the existing server runtime and pools. No legacy implementation or
 * automatic activation exists for this new data port. */
export function createRuntimeSharedFinancialHandler(resolveRuntime: () => SrmReportRuntime = getSrmReportRuntime,
  env: Readonly<Record<string, string | undefined>> = process.env) {
  return async (request: Request): Promise<Response> => {
    if (!/^Bearer [^\s]{1,8192}$/.test(request.headers.get('authorization') ?? '')) return respond(401)
    try {
      const runtime = resolveRuntime()
      if (runtime.provider !== 'clerk') return respond(503)
      return await createOperationSharedFinancialHandler(runtime.executor, runtime.defaultOrganisationId, env)(request)
    } catch { return respond(503) }
  }
}
