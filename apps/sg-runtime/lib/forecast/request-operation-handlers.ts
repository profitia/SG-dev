import type { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { readPresentationJson } from '@profitia/platform-contracts/embedded-read-channel'
import { cognitionError, privateApiResponse } from '@/lib/api/middleware'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { forecastRequestResourceId, MAX_FORECAST_REQUEST_BYTES, persistForecastRequest, readForecastRequest,FORECAST_REQUEST_COMMAND_CONTRACT } from './request-operation'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const respond = (status: number, code = 'OPERATION_DENIED') => privateApiResponse(cognitionError(code, 'Operation unavailable.', status))

export function createOperationForecastRequestHandler(executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string,
  persist:typeof persistForecastRequest=persistForecastRequest) {
  if (!uuid.test(defaultOrganisationId)) throw new TypeError('Explicit private request organisation required')
  return async (request: NextRequest): Promise<NextResponse> => {
    if (request.method !== 'POST') { const response = respond(405, 'METHOD_NOT_ALLOWED'); response.headers.set('Allow', 'POST'); return response }
    // Writes require the official session header; ambient cookies cannot create
    // a cross-site command. The actual token is still verified by the SDK.
    if (!/^Bearer \S+$/.test(request.headers.get('authorization') ?? '')) return respond(401)
    const query = request.nextUrl.searchParams
    const organisationId = query.get('organisationId') ?? defaultOrganisationId
    const idempotencyKey = request.headers.get('idempotency-key') ?? ''
    if (!uuid.test(organisationId) || [...query.keys()].some(key => key !== 'organisationId') || query.getAll('organisationId').length > 1
      || !/^[A-Za-z0-9_-]{24,128}$/.test(idempotencyKey) || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')
      || request.headers.has('content-encoding') || !request.body) return respond(400, 'VALIDATION_ERROR')
    let payload
    try { payload = await readForecastRequest(await readPresentationJson(new Response(request.body, { headers: { 'content-type': 'application/json' } }), MAX_FORECAST_REQUEST_BYTES)) }
    catch { return respond(400, 'VALIDATION_ERROR') }
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'forecast.request', organisationId, resourceId: forecastRequestResourceId(payload), payload, idempotencyKey, request }, persist)
      const projected: unknown = result.value
      if (!(projected instanceof NextResponse)) return respond(503)
      return privateApiResponse(projected)
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return respond(reason === 'UNVERIFIED_IDENTITY' ? 401 : reason === 'IDEMPOTENCY_CONFLICT' ? 409 : reason === 'LIMIT_EXCEEDED' ? 429
        : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

export function createRuntimeForecastRequestHandler(resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider !== 'clerk' || !runtime.forecastRequest) return respond(503)
      const expected=request.headers.get('x-profitia-forecast-command')
      if(expected!==null&&expected!==FORECAST_REQUEST_COMMAND_CONTRACT)return respond(400,'VALIDATION_ERROR')
      if(expected!==null&&(runtime.forecastRequest.delivery!=='DELEGATED'||typeof runtime.forecastRequest.persist!=='function'))return respond(503)
      const response=await createOperationForecastRequestHandler(runtime.forecastRequest.executor, runtime.defaultOrganisationId, runtime.forecastRequest.persist)(request)
      if(response.status===202&&runtime.forecastRequest.delivery==='DELEGATED')response.headers.set('X-Profitia-Forecast-Delivery','DELEGATED')
      return response
    } catch { return respond(503) }
  }
}
