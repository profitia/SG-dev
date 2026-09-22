import { type NextRequest } from 'next/server'

import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody, parseSearchParams } from '@/lib/api/middleware'
import {
  InteractiveForecastIdentitySchema,
  InteractiveForecastSeriesRequestSchema,
  type InteractiveForecastIdentity,
  prepareInteractiveCurrentForecast,
  resolveInteractiveForecastCapability,
  resolveInteractiveForecastCapabilitySnapshotBySeriesId,
  resolveInteractiveForecastReadinessSnapshotBySeriesId,
  type InteractiveForecastCapabilityResult,
  type InteractiveForecastCapabilitySeriesSnapshot,
  type InteractiveForecastPreparationResult,
} from '@/lib/forecast/interactive-preparation'
import {
  type ProgressiveForecastPreparationRequest,
  type ProgressiveForecastPreparationSnapshot,
} from '@/lib/forecast/progressive-preparation'
import { createForecastPreparationQueueService } from '@/lib/forecast/preparation-queue'
import {
  appendForecastRequestDiagnosticsHeader,
  isForecastRequestDiagnosticsEnabled,
  noteForecastRequestDiagnosticsEvent,
  runWithForecastRequestDiagnostics,
  traceForecastRequestDiagnosticsSpan,
  updateForecastRequestDiagnosticsIdentity,
} from '@/lib/forecast/request-diagnostics'

type CapabilityResolver = (input: InteractiveForecastIdentity) => Promise<InteractiveForecastCapabilityResult>
type CapabilitySnapshotResolver = (seriesId: string) => Promise<InteractiveForecastCapabilitySeriesSnapshot>
type CurrentPreparationResolver = (input: InteractiveForecastIdentity) => Promise<InteractiveForecastPreparationResult>
type ProgressivePreparationResolver = (input: ProgressiveForecastPreparationRequest) => Promise<ProgressiveForecastPreparationSnapshot>
const FORECAST_TRACE_HEADER = 'x-sg-forecast-trace'
const SG_RUNTIME_CAPABILITY_TOTAL_MS_HEADER = 'x-sg-runtime-capability-total-ms'

const durableProgressivePreparationSnapshot: ProgressivePreparationResolver = async (input) => {
  const targetSemantics = input.preferredTargetBasis === 'POINT_IN_TIME'
    ? 'ROLLING_DAILY_POINT_IN_TIME'
    : input.preferredTargetBasis
  const snapshot = await createForecastPreparationQueueService().snapshot({
    seriesId: input.seriesId,
    modelId: input.preferredModelId,
    targetSemantics,
  })
  const activeJob = snapshot.current.job?.status === 'RUNNING'
    ? snapshot.current.job
    : snapshot.verification.job?.status === 'RUNNING'
      ? snapshot.verification.job
      : null
  const queuedCount = [snapshot.current.job, snapshot.verification.job]
    .filter((job) => job && (job.status === 'QUEUED' || job.status === 'RETRY_WAIT')).length
  return {
    seriesId: snapshot.seriesId,
    variants: [{
      seriesId: snapshot.seriesId,
      modelId: snapshot.modelId,
      targetBasis: snapshot.targetBasis,
      targetSemantics: snapshot.targetSemantics,
      currentState: snapshot.current.state,
      currentReason: snapshot.current.reason,
      verificationState: snapshot.verification.state,
      verificationReason: snapshot.verification.reason,
      verificationProgress: snapshot.verification.job?.verificationProgress ?? null,
      currentCorrelationId: snapshot.current.job?.latestCorrelationId
        ?? snapshot.current.job?.originCorrelationId
        ?? null,
      verificationCorrelationId: snapshot.verification.job?.latestCorrelationId
        ?? snapshot.verification.job?.originCorrelationId
        ?? null,
    }],
    firstReadyCurrent: snapshot.current.state === 'READY'
      ? { modelId: snapshot.modelId, targetBasis: snapshot.targetBasis, targetSemantics: snapshot.targetSemantics }
      : null,
    activeItem: activeJob
      ? { modelId: snapshot.modelId, targetBasis: snapshot.targetBasis, kind: activeJob.kind }
      : null,
    queuedCount,
    currentReadyCount: snapshot.current.state === 'READY' ? 1 : 0,
    verificationReadyCount: snapshot.verification.state === 'READY' ? 1 : 0,
  }
}

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

export function createInternalForecastCapabilitiesRouteHandler(
  resolveCapabilities: CapabilitySnapshotResolver = resolveInteractiveForecastCapabilitySnapshotBySeriesId,
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
      const parsed = parseSearchParams(request, InteractiveForecastSeriesRequestSchema)
      if (!parsed.ok) return appendForecastRequestDiagnosticsHeader(cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId))

      updateForecastRequestDiagnosticsIdentity({
        operationType: 'CAPABILITY',
        seriesId: parsed.data.seriesId,
      })

      try {
        const result = await traceForecastRequestDiagnosticsSpan(
          'capability_resolution_series_snapshot',
          'APPLICATION',
          () => resolveCapabilities(parsed.data.seriesId),
          {
            seriesId: parsed.data.seriesId,
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

export function createInternalForecastReadinessSnapshotRouteHandler(
  resolveReadiness: CapabilitySnapshotResolver = resolveInteractiveForecastReadinessSnapshotBySeriesId,
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
      const parsed = parseSearchParams(request, InteractiveForecastSeriesRequestSchema)
      if (!parsed.ok) return appendForecastRequestDiagnosticsHeader(cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId))

      updateForecastRequestDiagnosticsIdentity({
        operationType: 'CAPABILITY',
        seriesId: parsed.data.seriesId,
      })

      try {
        const result = await traceForecastRequestDiagnosticsSpan(
          'prepared_readiness_resolution_series_snapshot',
          'APPLICATION',
          () => resolveReadiness(parsed.data.seriesId),
          { seriesId: parsed.data.seriesId },
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
  prepareProgressively: ProgressivePreparationResolver = durableProgressivePreparationSnapshot,
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
