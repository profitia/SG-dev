import type { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { cognitionError, cognitionOk, privateApiResponse } from '@/lib/api/middleware'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { ForecastReadinessSelection, forecastReadinessResourceId, type ForecastReadinessKind, type ForecastReadinessSelectionValue } from '@/lib/platform/forecast-readiness'
import { createInternalForecastCapabilityRouteHandler, createInternalForecastCapabilitiesRouteHandler, createInternalForecastReadinessSnapshotRouteHandler } from './interactive-route-handlers'

export const legacyForecastReadinessHandlers = Object.freeze({ capability: createInternalForecastCapabilityRouteHandler,
  capabilities: createInternalForecastCapabilitiesRouteHandler, readiness: createInternalForecastReadinessSnapshotRouteHandler })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createOperationForecastReadinessHandler(kind: ForecastReadinessKind,
  executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string,
  read: (selection: ForecastReadinessSelectionValue) => Promise<unknown>) {
  if (!Object.hasOwn(legacyForecastReadinessHandlers, kind) || !uuid.test(defaultOrganisationId) || typeof read !== 'function') throw new TypeError('Explicit stored readiness host required')
  return async (request: NextRequest): Promise<NextResponse> => {
    const error = (code: string, message: string, status: number) => privateApiResponse(cognitionError(code, message, status))
    if (request.method !== 'GET') { const response = error('METHOD_NOT_ALLOWED', 'Use GET.', 405); response.headers.set('Allow', 'GET'); return response }
    const parameters = request.nextUrl.searchParams
    const keys = kind === 'capability' ? ['seriesId', 'modelId', 'targetSemantics', 'organisationId'] : ['seriesId', 'organisationId']
    if ([...parameters.keys()].some(key => !keys.includes(key))
      || [...new Set(parameters.keys())].some(key => parameters.getAll(key).length !== 1)
      || [...request.headers.keys()].some(key => key.startsWith('x-sg-prepared-'))) return error('VALIDATION_ERROR', 'Invalid forecast readiness selection.', 400)
    const parsed = ForecastReadinessSelection.safeParse({ ...Object.fromEntries([...parameters].filter(([key]) => key !== 'organisationId')), kind })
    const organisationId = parameters.get('organisationId') ?? defaultOrganisationId
    if (!parsed.success || !uuid.test(organisationId)) return error('VALIDATION_ERROR', 'Invalid forecast readiness selection.', 400)
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'forecast.read', organisationId, resourceId: forecastReadinessResourceId(parsed.data), payload: parsed.data, request,
      }, async () => cognitionOk(await read(parsed.data)))
      return privateApiResponse(result.value)
    } catch (failure) {
      if (failure instanceof BenchmarkAppError) return error(failure.code, failure.message, failure.status)
      const reason = isOperationDenied(failure) ? failure.reasonCode : 'POLICY_UNAVAILABLE'
      return error('OPERATION_DENIED', 'Operation unavailable.', reason === 'UNVERIFIED_IDENTITY' ? 401
        : ['POLICY_UNAVAILABLE', 'AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403)
    }
  }
}

export function createRuntimeForecastReadinessHandler(kind: ForecastReadinessKind,
  resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime, legacy = legacyForecastReadinessHandlers[kind]()) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // The retained dashboard credential is opaque. In native mode it cannot
      // become a user session or a SERVICE_GRANT merely by sharing this URL.
      // This syntax check grants nothing: JWTs/cookies still require current
      // backend identity and all private authority checks. No configured legacy
      // credential is read, compared, forwarded or used as an error fallback.
      const authorization = request.headers.get('authorization')?.trim()
      if ((process.env.PROFITIA_AUTH_PROVIDER ?? 'legacy_demo') !== 'legacy_demo' && authorization
        && !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(authorization)) {
        return privateApiResponse(cognitionError('INTERNAL_SERVICE_AUTH_UNAVAILABLE',
          'Internal forecast service authentication is not configured for this mode.', 403))
      }
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy(request)
      const readiness = runtime.provider === 'clerk' ? runtime.forecastRead?.readiness : undefined
      if (!readiness) return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503))
      return await createOperationForecastReadinessHandler(kind, readiness.executor, runtime.defaultOrganisationId, readiness.read)(request)
    } catch { return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503)) }
  }
}
