import type { OperationContext, OperationExecutor, OperationOutcome } from '@profitia/platform-contracts/operation-context'
import { OPERATION_CONTRACT, OperationDenied, isOperationDenied } from '@profitia/platform-contracts/operation-context'
import type { PoolClient } from 'pg'
import type { SrmReportRuntime } from './private-runtime'
import { bindOrganizationTransaction } from './db'
import { validateFinancialExcelSelection, buildFinancialExcel } from './financial-excel'
import { readPreparedFinancialDocuments } from './financial-documents'
import { readSavedFinancialData } from './shared-catalog'
import { isSameOriginRequest } from './request-origin'
import { validateXrayRequest } from './xray-lookup'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
const respond = (status: number, error = 'Operation unavailable') => Response.json({ error }, { status, headers: privateHeaders })
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const noData = 'Nie znaleziono zapisanego raportu finansowego dla tego NIP-u.'
const unavailableSelection = (message: unknown): message is string => typeof message === 'string' && (message.startsWith('Wybrane lata') || message.startsWith('Pełne dane'))

/** Output is built by the existing financial projection, then fenced before commit
 * and release. No durable external file/URL is created by this adapter. */
export async function projectPrivateFinancialExcel(value: unknown, context: Readonly<OperationContext>): Promise<Response> {
  if (!(value instanceof Response) || value.headers.get('Cache-Control') !== privateHeaders['Cache-Control'] || value.headers.get('Vary') !== privateHeaders.Vary
    || [...value.headers.keys()].some(key => !['content-type','content-disposition','content-length','x-download-filename','cache-control','vary'].includes(key))) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const selection = validateFinancialExcelSelection(context.payload)
  if (value.status === 404 || value.status === 409) {
    const body: unknown = await value.clone().json()
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('error' in body)
      || (value.status === 404 ? body.error !== noData : !unavailableSelection(body.error))) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    return value
  }
  const filename = value.headers.get('X-Download-Filename')
  if (value.status !== 200 || value.headers.get('Content-Type') !== mime
    || !filename || !new RegExp(`^Financials_(?:MSR_)?${selection.nip}_[0-9]{8}\\.xlsx$`).test(filename)
    || value.headers.get('Content-Disposition') !== `attachment; filename="${filename}"`) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const length = value.headers.get('Content-Length')
  if (!length || !/^[1-9][0-9]*$/.test(length) || !Number.isSafeInteger(Number(length))) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const bytes = new Uint8Array(await value.clone().arrayBuffer())
  if (Number(length) !== bytes.byteLength || bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return value
}
export function describePrivateFinancialExcel(value: unknown): OperationOutcome {
  if (!(value instanceof Response)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return value.status === 404 ? 'NO_DATA' : value.status === 409 ? 'SELECTION_UNAVAILABLE' : 'SUCCEEDED'
}

export function createOperationFinancialExcelHandler(executor: OperationExecutor<PoolClient>, defaultOrganisationId: string) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') { const response = respond(405); response.headers.set('Allow','POST'); return response }
    if (!isSameOriginRequest(request)) return respond(403)
    let selection
    try { selection = validateFinancialExcelSelection(await request.clone().json()); validateXrayRequest({ identifier: selection.nip }) }
    catch { return respond(400) }
    const organisations = new URL(request.url).searchParams.getAll('organisationId')
    if (organisations.length > 1 || (organisations.length === 1 && !organisations[0])) return respond(400)
    const organisationId = organisations[0] ?? defaultOrganisationId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organisationId)) return respond(400)
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'supplier.report.export',
        organisationId, resourceId: `supplier-report:COMPANY:${selection.nip}`, payload: selection, request }, async (context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
        const data = await readSavedFinancialData(context.organisationId!, selection.nip, bindOrganizationTransaction(context.organisationId!, client))
        if (!data) return respond(404, noData)
        const documents = await readPreparedFinancialDocuments(client, context.organisationId!, selection.nip)
        try {
          const { filename, bytes } = await buildFinancialExcel(data, selection, new Date(), documents)
          return new Response(new Uint8Array(bytes), { headers: { ...privateHeaders, 'Content-Type': mime,
            'Content-Disposition': `attachment; filename="${filename}"`, 'X-Download-Filename': filename, 'Content-Length': String(bytes.byteLength) } })
        } catch (error) {
          if (error instanceof Error && unavailableSelection(error.message)) return respond(409, error.message)
          throw error
        }
      })
      return result.value
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return respond(reason === 'UNVERIFIED_IDENTITY' ? 401 : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

/** Server-selected provider only. A failed Clerk path never invokes legacy. */
export function createRuntimeSrmFinancialExcelHandler(resolveRuntime: () => SrmReportRuntime, legacy: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy(request)
      if (runtime.provider !== 'clerk') throw new TypeError('Unsupported server runtime')
      return await createOperationFinancialExcelHandler(runtime.executor, runtime.defaultOrganisationId)(request)
    } catch { return respond(503) }
  }
}
