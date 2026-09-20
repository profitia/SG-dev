import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseJsonBody } from '@/lib/api/middleware'
import { readForecastActionTimeline, recordForecastUiVisibleAck } from '@/lib/forecast/forecast-action-trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UiVisibleAckSchema = z.object({
  correlationId: z.string().min(3).max(200),
  layer: z.enum(['CURRENT', 'VERIFICATION']),
  seriesId: z.string().min(1).max(300),
  targetBasis: z.enum(['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD']),
  targetSemantics: z.string().min(1).max(100),
  modelId: z.string().min(1).max(100),
  pageInstanceId: z.string().min(3).max(200),
  clientVisibleAt: z.string().datetime(),
  responseToVisibleMs: z.number().finite().nonnegative().nullable(),
}).strict()

export const POST = withInternalForecastServiceAuth(async (principal, request: NextRequest) => {
  const parsed = await parseJsonBody(request, UiVisibleAckSchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, principal.requestId)
  if (parsed.data.correlationId !== principal.requestId) {
    return cognitionError('CORRELATION_ID_MISMATCH', 'Telemetry correlation identity does not match the authenticated request identity.', 409, principal.requestId)
  }
  const recorded = await recordForecastUiVisibleAck(parsed.data)
  return cognitionOk({ recorded, correlationId: principal.requestId })
})

export const GET = withInternalForecastServiceAuth(async (principal) => {
  const timeline = await readForecastActionTimeline(principal.requestId)
  if (!timeline) return cognitionError('FORECAST_ACTION_TRACE_NOT_FOUND', 'No Forecast action trace exists for this correlation ID.', 404, principal.requestId)
  return cognitionOk(timeline)
})
