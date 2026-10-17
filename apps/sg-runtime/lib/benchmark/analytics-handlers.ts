import { type NextRequest, type NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'

import { getBenchmarkAnalyticsSeries } from './service'
import { BenchmarkAppError } from './errors'
import { withCognitionAuth, parseSearchParams, cognitionError, cognitionOk, privateApiResponse } from '@/lib/api/middleware'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { MarketPreviewSelection, marketAnalyticsResourceId } from '@/lib/platform/market-preview'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LegacyQuerySchema = z.object({
  seriesId: z.string().trim().min(1),
  range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']).default('1Y'),
})

/** Existing query/error behavior and provider-backed default remain explicit. */
export function createLegacyBenchmarkAnalyticsHandler(series = getBenchmarkAnalyticsSeries) {
  return withCognitionAuth(async (_auth, request: NextRequest) => {
    const parsed = parseSearchParams(request, LegacyQuerySchema)
    if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400)
    try {
      return cognitionOk(await series(parsed.data.seriesId, parsed.data.range ?? '1Y'))
    } catch {
      return cognitionError('INTERNAL_ERROR', 'Benchmark analytics series failed.', 500)
    }
  })
}

export function createOperationBenchmarkAnalyticsHandler(
  executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string,
  series: (selection: z.infer<typeof MarketPreviewSelection>) => Promise<unknown>,
) {
  if (!uuid.test(defaultOrganisationId) || typeof series !== 'function') throw new TypeError('Explicit market analytics host required')
  return async (request: NextRequest): Promise<NextResponse> => {
    const respond = (code: string, message: string, status: number) => privateApiResponse(cognitionError(code, message, status))
    if (request.method !== 'GET') {
      const response = respond('METHOD_NOT_ALLOWED', 'Use GET.', 405)
      response.headers.set('Allow', 'GET')
      return response
    }
    const parameters = request.nextUrl.searchParams
    if ([...parameters.keys()].some(key => !['seriesId', 'range', 'organisationId'].includes(key))
      || [...new Set(parameters.keys())].some(key => parameters.getAll(key).length !== 1)) {
      return respond('VALIDATION_ERROR', 'Invalid analytics selection.', 400)
    }
    const selected = MarketPreviewSelection.safeParse({ seriesName: parameters.get('seriesId'), range: parameters.get('range') ?? '1Y' })
    const organisationId = parameters.get('organisationId') ?? defaultOrganisationId
    if (!selected.success || !uuid.test(organisationId)) return respond('VALIDATION_ERROR', 'Invalid analytics selection.', 400)
    try {
      const result = await executor.execute({
        contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'knowledge.read', organisationId,
        resourceId: marketAnalyticsResourceId(selected.data.seriesName), payload: selected.data, request,
      }, async () => cognitionOk(await series(selected.data)))
      return privateApiResponse(result.value)
    } catch (error) {
      if (error instanceof BenchmarkAppError) return respond(error.code, error.message, error.status)
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return respond('OPERATION_DENIED', 'Operation unavailable.', reason === 'UNVERIFIED_IDENTITY' ? 401
        : ['POLICY_UNAVAILABLE', 'AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

export function createRuntimeBenchmarkAnalyticsHandler(
  resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime, legacy = createLegacyBenchmarkAnalyticsHandler(),
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy(request)
      const analytics = runtime.provider === 'clerk' ? runtime.marketRead?.analytics : undefined
      if (!analytics || runtime.provider !== 'clerk') return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503))
      return await createOperationBenchmarkAnalyticsHandler(analytics.executor, runtime.defaultOrganisationId, analytics.series)(request)
    } catch {
      return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503))
    }
  }
}
