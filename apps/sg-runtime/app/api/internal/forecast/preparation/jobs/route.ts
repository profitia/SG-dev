import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody, parseSearchParams } from '@/lib/api/middleware'
import { InteractiveForecastIdentitySchema } from '@/lib/forecast/interactive-preparation'
import {
  createForecastPreparationQueueService,
  ForecastPreparationCommandSchema,
} from '@/lib/forecast/preparation-queue'

export const dynamic = 'force-dynamic'

function createForecastPreparationJobsPostHandler(
  enqueue = (input: Parameters<ReturnType<typeof createForecastPreparationQueueService>['enqueue']>[0]) => createForecastPreparationQueueService().enqueue(input),
) {
  return withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
    const parsed = await parseJsonBody(request, ForecastPreparationCommandSchema)
    if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId)
    try {
      return cognitionOk(await enqueue(parsed.data))
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

function createForecastPreparationJobsGetHandler(
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

export const POST = createForecastPreparationJobsPostHandler()
export const GET = createForecastPreparationJobsGetHandler()
