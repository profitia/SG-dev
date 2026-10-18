import { type NextRequest, type NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { cognitionError, cognitionOk, privateApiResponse } from '@/lib/api/middleware'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { ForecastCurrentSelection, forecastCurrentResourceId, type ForecastCurrentSelectionValue } from '@/lib/platform/forecast-current'
import { ForecastRouteQuerySchema, toForecastRequestInput } from './request-contract'
import { createCurrentForecastRouteHandler } from './route-handlers'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The original handler, parser, defaults and computation remain the explicit
 * legacy implementation; native reads never invoke it as an error fallback. */
export const createLegacyForecastCurrentHandler = createCurrentForecastRouteHandler

export function createOperationForecastCurrentHandler(
  executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string,
  current: (selection: ForecastCurrentSelectionValue) => Promise<unknown>,
) {
  if (!uuid.test(defaultOrganisationId) || typeof current !== 'function') throw new TypeError('Explicit stored forecast host required')
  return async (request: NextRequest): Promise<NextResponse> => {
    const respond = (code: string, message: string, status: number) => privateApiResponse(cognitionError(code, message, status))
    if (request.method !== 'GET') {
      const response = respond('METHOD_NOT_ALLOWED', 'Use GET.', 405); response.headers.set('Allow', 'GET'); return response
    }
    const parameters = request.nextUrl.searchParams
    if ([...parameters.keys()].some(key => !['seriesId','model','targetBasis','sourceFrequency','targetCadence','organisationId'].includes(key))
      || [...new Set(parameters.keys())].some(key => parameters.getAll(key).length !== 1)
      || [...request.headers.keys()].some(key => key.startsWith('x-sg-prepared-'))) {
      return respond('VALIDATION_ERROR', 'Invalid current forecast selection.', 400)
    }
    const query = Object.fromEntries([...parameters].filter(([key]) => key !== 'organisationId'))
    const parsed = ForecastRouteQuerySchema.safeParse(query)
    const organisationId = parameters.get('organisationId') ?? defaultOrganisationId
    if (!parsed.success || !uuid.test(organisationId)) return respond('VALIDATION_ERROR', 'Invalid current forecast selection.', 400)
    const input = toForecastRequestInput(parsed.data)
    // Original parser/defaults remain authoritative; the source resolves and
    // verifies cadence and prepared evidence, never client prepared headers.
    const selected = ForecastCurrentSelection.safeParse({ seriesId: input.seriesId, modelId: input.modelId, targetBasis: input.targetBasis,
      ...(input.sourceFrequency ? { sourceFrequency: input.sourceFrequency, targetCadence: input.targetCadence } : {}) })
    if (!selected.success) return respond('VALIDATION_ERROR', 'Invalid current forecast selection.', 400)
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'forecast.read', organisationId, resourceId: forecastCurrentResourceId(selected.data), payload: selected.data, request,
      }, async () => cognitionOk(await current(selected.data)))
      return privateApiResponse(result.value)
    } catch (error) {
      if (error instanceof BenchmarkAppError) return respond(error.code, error.message, error.status)
      const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE'
      return respond('OPERATION_DENIED', 'Operation unavailable.', reason === 'UNVERIFIED_IDENTITY' ? 401
        : ['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

export function createRuntimeForecastCurrentHandler(
  resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime, legacy = createLegacyForecastCurrentHandler(),
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy(request)
      const forecast = runtime.provider === 'clerk' ? runtime.forecastRead : undefined
      if (runtime.provider !== 'clerk' || !forecast) return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503))
      return await createOperationForecastCurrentHandler(forecast.executor, runtime.defaultOrganisationId, forecast.current)(request)
    } catch { return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503)) }
  }
}
