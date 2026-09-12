import { type NextRequest } from 'next/server'

import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody, parseSearchParams } from '@/lib/api/middleware'
import {
  InteractiveForecastIdentitySchema,
  type InteractiveForecastIdentity,
  prepareInteractiveCurrentForecast,
  resolveInteractiveForecastCapability,
  type InteractiveForecastCapabilityResult,
  type InteractiveForecastPreparationResult,
} from '@/lib/forecast/interactive-preparation'
import {
  progressiveForecastPreparationService,
  type ProgressiveForecastPreparationRequest,
  type ProgressiveForecastPreparationSnapshot,
} from '@/lib/forecast/progressive-preparation'
import {
  appendForecastRequestDiagnosticsHeader,
  isForecastRequestDiagnosticsEnabled,
  noteForecastRequestDiagnosticsEvent,
  runWithForecastRequestDiagnostics,
  traceForecastRequestDiagnosticsSpan,
  updateForecastRequestDiagnosticsIdentity,
} from '@/lib/forecast/request-diagnostics'

type CapabilityResolver = (input: InteractiveForecastIdentity) => Promise<InteractiveForecastCapabilityResult>
type CurrentPreparationResolver = (input: InteractiveForecastIdentity) => Promise<InteractiveForecastPreparationResult>
type ProgressivePreparationResolver = (input: ProgressiveForecastPreparationRequest) => Promise<ProgressiveForecastPreparationSnapshot>
const FORECAST_TRACE_HEADER = 'x-sg-forecast-trace'
const SG_RUNTIME_CAPABILITY_TOTAL_MS_HEADER = 'x-sg-runtime-capability-total-ms'

function internalRouteError(error: unknown, requestId: string) {
  return cognitionError(
    'INTERNAL_FORECAST_OPERATION_FAILED',
    error instanceof Error ? error.message : 'Internal Forecast operation failed.',
    500,
    requestId,
  )
}

export function createInternalForecastCapabilityRouteHandler(
  resolveCapability: CapabilityResolver = resolveInteractiveForecastCapability,
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    return runWithForecastRequestDiagnostics({
      enabled: isForecastRequestDiagnosticsEnabled(request.headers),
      requestId: principal.requestId,
      route: request.nextUrl.pathname,
      method: request.method,
      operationType: 'CAPABILITY',
    }, async () => {
      noteForecastRequestDiagnosticsEvent('handler_entered', 'HTTP', { requestId: principal.requestId })
      const parsed = parseSearchParams(request, InteractiveForecastIdentitySchema)
      if (!parsed.ok) return appendForecastRequestDiagnosticsHeader(cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId))

      updateForecastRequestDiagnosticsIdentity({
        operationType: 'CAPABILITY',
        seriesId: parsed.data.seriesId,
        modelId: parsed.data.modelId,
        targetSemantics: parsed.data.targetSemantics,
      })

      try {
        const result = await traceForecastRequestDiagnosticsSpan(
          'capability_resolution',
          'APPLICATION',
          () => resolveCapability(parsed.data),
          {
            seriesId: parsed.data.seriesId,
            modelId: parsed.data.modelId,
            targetSemantics: parsed.data.targetSemantics,
          },
        )
        const response = cognitionOk(result)
        if (request.headers.get(FORECAST_TRACE_HEADER) === '1') {
          response.headers.set(SG_RUNTIME_CAPABILITY_TOTAL_MS_HEADER, String(result.timingMs))
        }
        return appendForecastRequestDiagnosticsHeader(response)
      } catch (error) {
        return appendForecastRequestDiagnosticsHeader(internalRouteError(error, principal.requestId))
      }
    })
  })
}

export function createInternalCurrentForecastPreparationRouteHandler(
  prepareCurrent: CurrentPreparationResolver = prepareInteractiveCurrentForecast,
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    return runWithForecastRequestDiagnostics({
      enabled: isForecastRequestDiagnosticsEnabled(request.headers),
      requestId: principal.requestId,
      route: request.nextUrl.pathname,
      method: request.method,
      operationType: 'CURRENT_MATERIALIZATION',
    }, async () => {
      noteForecastRequestDiagnosticsEvent('handler_entered', 'HTTP', { requestId: principal.requestId })
      const parsed = await parseJsonBody(request, InteractiveForecastIdentitySchema)
      if (!parsed.ok) return appendForecastRequestDiagnosticsHeader(cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId))

      updateForecastRequestDiagnosticsIdentity({
        operationType: 'CURRENT_MATERIALIZATION',
        seriesId: parsed.data.seriesId,
        modelId: parsed.data.modelId,
        targetSemantics: parsed.data.targetSemantics,
      })

      try {
        const result = await traceForecastRequestDiagnosticsSpan(
          'current_materialization',
          'APPLICATION',
          () => prepareCurrent(parsed.data),
          {
            seriesId: parsed.data.seriesId,
            modelId: parsed.data.modelId,
            targetSemantics: parsed.data.targetSemantics,
          },
        )
        return appendForecastRequestDiagnosticsHeader(cognitionOk(result))
      } catch (error) {
        return appendForecastRequestDiagnosticsHeader(internalRouteError(error, principal.requestId))
      }
    })
  })
}

export function createInternalProgressiveForecastPreparationRouteHandler(
  prepareProgressively: ProgressivePreparationResolver = progressiveForecastPreparationService.snapshotAndKickoff,
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    return runWithForecastRequestDiagnostics({
      enabled: isForecastRequestDiagnosticsEnabled(request.headers),
      requestId: principal.requestId,
      route: request.nextUrl.pathname,
      method: request.method,
      operationType: 'OTHER',
    }, async () => {
      noteForecastRequestDiagnosticsEvent('handler_entered', 'HTTP', { requestId: principal.requestId })
      const parsed = await parseJsonBody(request, InteractiveForecastIdentitySchema)
      if (!parsed.ok) return appendForecastRequestDiagnosticsHeader(cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId))

      updateForecastRequestDiagnosticsIdentity({
        operationType: 'OTHER',
        seriesId: parsed.data.seriesId,
        modelId: parsed.data.modelId,
        targetSemantics: parsed.data.targetSemantics,
      })

      try {
        const result = await traceForecastRequestDiagnosticsSpan(
          'progressive_preparation_snapshot',
          'APPLICATION',
          () => prepareProgressively({
            seriesId: parsed.data.seriesId,
            preferredModelId: parsed.data.modelId,
            preferredTargetBasis: parsed.data.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
              ? 'POINT_IN_TIME'
              : parsed.data.targetSemantics,
          }),
          {
            seriesId: parsed.data.seriesId,
            modelId: parsed.data.modelId,
            targetSemantics: parsed.data.targetSemantics,
          },
        )
        return appendForecastRequestDiagnosticsHeader(cognitionOk(result))
      } catch (error) {
        return appendForecastRequestDiagnosticsHeader(internalRouteError(error, principal.requestId))
      }
    })
  })
}