import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, OperationDenied, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { CategoryAppError } from './errors'
import { createOrUpdateCategory, getCategory, listCategories } from './service'
import { CATEGORY_BUSINESS_ERRORS, CATEGORY_HEADERS, categoryBodySchema, categoryOperation, categoryResourceId,
  readCategoryOperation, type CategoryOperationInput } from './operation-contract'
import type { CategoryRouteContext } from './handlers'

const unavailable = (status: number) => Response.json({ error: 'Operation unavailable' }, { status, headers: CATEGORY_HEADERS })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const categoryId = /^[A-Za-z0-9_-]{1,128}$/
async function readBody(request: Request) {
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 32768)) throw new TypeError('Invalid request')
  if (!request.body) throw new TypeError('Invalid request')
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) { const item = await reader.read(); if (item.done) break
      bytes += item.value.byteLength; if (bytes > 32768 || request.signal.aborted) throw new TypeError('Invalid request'); chunks.push(item.value) }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const buffer = new Uint8Array(bytes); let offset = 0
  for (const item of chunks) { buffer.set(item, offset); offset += item.byteLength }
  return categoryBodySchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)))
}
function createHandler(executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string,
  action: 'list' | 'detail' | 'create' | 'update') {
  if (!uuid.test(defaultOrganisationId)) throw new TypeError('Explicit server organisation required')
  const expectedMethod = action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : 'GET'
  return async (request: Request, route?: CategoryRouteContext): Promise<Response> => {
    if (request.method !== expectedMethod) { const denied = unavailable(405); denied.headers.set('Allow', expectedMethod); return denied }
    const authorization = request.headers.get('authorization') ?? ''
    if (!/^Bearer [^\s]{1,8192}$/.test(authorization)) return unavailable(401)
    let organisationId: string, payload: CategoryOperationInput
    try {
      const query = new URL(request.url).searchParams
      if ([...query.keys()].some(key => key !== 'organisationId') || query.getAll('organisationId').length > 1) return unavailable(400)
      organisationId = query.get('organisationId') ?? defaultOrganisationId
      if (!uuid.test(organisationId)) return unavailable(400)
      if (action === 'list') payload = { action, categoryId: null, body: null }
      else if (action === 'create') payload = { action, categoryId: randomUUID(), body: await readBody(request) }
      else {
        const selected = route?.params.categoryId
        if (typeof selected !== 'string' || !categoryId.test(selected)) return unavailable(400)
        payload = action === 'detail' ? { action, categoryId: selected, body: null }
          : { action, categoryId: selected, body: await readBody(request) }
      }
    } catch { return unavailable(400) }
    // Preserve the actual ingress authority for the existing deployment-owned
    // public request boundary. It validates Host/Origin before SDK verification;
    // forwarding hints, cookies and caller identity/role headers confer nothing.
    const identityHeaders = new Headers({ authorization })
    for (const name of ['host', 'origin']) {
      const value = request.headers.get(name)
      if (value !== null) identityHeaders.set(name, value)
    }
    const authenticatedRequest = new Request(request.url, { method: 'GET', signal: request.signal, headers: identityHeaders })
    let businessFailure: { code: keyof typeof CATEGORY_BUSINESS_ERRORS; requestId: string; reason: 'CONTEXT_INVALID' | 'RESOURCE_SCOPE_MISMATCH' } | undefined
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        request: authenticatedRequest, organisationId, operation: categoryOperation(payload),
        resourceId: categoryResourceId(payload, organisationId), payload }, async (context, transaction) => {
        const selected = readCategoryOperation(context.payload)
        const options = { transaction, ...(selected.action === 'create' ? { newCategoryId: selected.categoryId } : {}) }
        try {
          let body: unknown
          if (selected.action === 'list') body = { items: await listCategories(context.organisationId!, options) }
          else if (selected.action === 'detail') body = await getCategory(context.organisationId!, selected.categoryId, options)
          else body = await createOrUpdateCategory({ organizationId: context.organisationId!,
            userId: context.subjectUserId ?? context.actorId, ...(selected.action === 'update' ? { categoryId: selected.categoryId } : {}),
            ...selected.body }, options)
          return Response.json(body, { status: selected.action === 'create' ? 201 : 200, headers: CATEGORY_HEADERS })
        } catch (error) {
          if (!(error instanceof CategoryAppError) || !Object.hasOwn(CATEGORY_BUSINESS_ERRORS, error.code)) throw error
          const safe = CATEGORY_BUSINESS_ERRORS[error.code as keyof typeof CATEGORY_BUSINESS_ERRORS]
          if (error.status !== safe.status) throw error
          const reason = safe.status === 400 ? 'CONTEXT_INVALID' : 'RESOURCE_SCOPE_MISMATCH'
          businessFailure = { code: error.code as keyof typeof CATEGORY_BUSINESS_ERRORS, requestId: context.correlationId, reason }
          // A mapper/refetch error may occur after writes. Throw through the
          // common transaction so all effects roll back before an error reply.
          throw new OperationDenied(reason)
        }
      })
      return result.value
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      if (businessFailure && isOperationDenied(error) && reason === businessFailure.reason) {
        const safe = CATEGORY_BUSINESS_ERRORS[businessFailure.code]
        return Response.json({ error: safe.message, code: businessFailure.code, requestId: businessFailure.requestId,
          timestamp: new Date().toISOString() }, { status: safe.status, headers: CATEGORY_HEADERS })
      }
      return unavailable(reason === 'UNVERIFIED_IDENTITY' ? 401 : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason)
        ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}
export function createOperationCategoryCollectionHandlers(executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string) {
  return Object.freeze({ GET: createHandler(executor, defaultOrganisationId, 'list'), POST: createHandler(executor, defaultOrganisationId, 'create') })
}
export function createOperationCategoryDetailHandlers(executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string) {
  return Object.freeze({ GET: createHandler(executor, defaultOrganisationId, 'detail'), PATCH: createHandler(executor, defaultOrganisationId, 'update') })
}
