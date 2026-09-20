import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody, parseSearchParams } from '@/lib/api/middleware'
import { InteractiveForecastIdentitySchema } from '@/lib/forecast/interactive-preparation'
import {
  createForecastPreparationQueueService,
  ForecastPreparationCommandSchema,
} from '@/lib/forecast/preparation-queue'

export function createForecastPreparationJobsPostHandler(
  enqueue = (
    input: Parameters<ReturnType<typeof createForecastPreparationQueueService>['enqueue']>[0],
    options: Parameters<ReturnType<typeof createForecastPreparationQueueService>['enqueue']>[1],
  ) => createForecastPreparationQueueService().enqueue(input, options),
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    const parsed = await parseJsonBody(request, ForecastPreparationCommandSchema)
    if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId)
    try {
      const result = await enqueue(parsed.data, { correlationId: principal.requestId })
      console.info(JSON.stringify({
        event: 'FORECAST_PREPARATION_REQUEST_ACCEPTED',
        correlationId: principal.requestId,
        seriesId: parsed.data.seriesId,
        modelId: parsed.data.modelId,
        targetSemantics: parsed.data.targetSemantics,
        jobKind: parsed.data.kind,
        state: result.state,
        jobKey: result.job?.jobKey ?? null,
      }))
      return cognitionOk(result)
    } catch (error) {
      return cognitionError(
        'FORECAST_PREPARATION_QUEUE_FAILED',
        error instanceof Error ? error.message : 'Forecast preparation queue command failed.',
        500,
        principal.requestId,
      )
    }
  })
}

export function createForecastPreparationJobsGetHandler(
  snapshot = (input: z.infer<typeof InteractiveForecastIdentitySchema>) => createForecastPreparationQueueService().snapshot(input),
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    const parsed = parseSearchParams(request, InteractiveForecastIdentitySchema)
    if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId)
    try {
      return cognitionOk(await snapshot(parsed.data))
    } catch (error) {
      return cognitionError(
        'FORECAST_PREPARATION_QUEUE_FAILED',
        error instanceof Error ? error.message : 'Forecast preparation queue status failed.',
        500,
        principal.requestId,
      )
    }
  })
}
