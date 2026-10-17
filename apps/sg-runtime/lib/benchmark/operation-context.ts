import { type NextRequest, type NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, OperationDenied, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { cognitionError } from '@/lib/api/middleware'
import { createBenchmarkSelectionHandlers } from './selection-handlers'

/** Explicit host adapter. No environment flag enables this on the current demo route. */
export function createOperationBenchmarkSelectionHandlers(executor: OperationExecutor<Prisma.TransactionClient>) {
  return createBenchmarkSelectionHandlers((handler, operation) => async (request: NextRequest): Promise<NextResponse> => {
    const expectedMethod = operation === 'benchmark.selection.read' ? 'GET' : 'POST'
    if (request.method !== expectedMethod) {
      const response = cognitionError('METHOD_NOT_ALLOWED', 'Method not allowed', 405)
      response.headers.set('Allow', expectedMethod)
      return response
    }
    const organisationId = new URL(request.url).searchParams.get('organisationId')
    let payload: null | Record<string, never> = null
    try { if (request.method === 'POST') payload = await request.clone().json() }
    catch { return cognitionError('VALIDATION_ERROR', 'Invalid JSON body', 400) }
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        request, operation,
        organisationId, resourceId: `benchmark-selections:${organisationId ?? ''}`, payload,
      }, async (context, transaction) => {
        const response = await handler({ orgId: context.organisationId!, userId: context.subjectUserId ?? context.actorId, requestId: context.correlationId, transaction }, request)
        if (!response.ok) throw new OperationDenied(response.status === 400 ? 'CONTEXT_INVALID' : 'POLICY_UNAVAILABLE')
        return response
      })
      return result.value
    } catch (error) {
      const code = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      const status = code === 'UNVERIFIED_IDENTITY' ? 401 : ['AUDIT_UNAVAILABLE', 'POLICY_UNAVAILABLE'].includes(code) ? 503 : code === 'CONTEXT_INVALID' ? 400 : 403
      return cognitionError('OPERATION_DENIED', 'Operation unavailable', status)
    }
  })
}
