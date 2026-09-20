import { NextRequest, NextResponse } from 'next/server'

import {
  parseBenchmarkForecastCurrentPreparationRequest,
  requestDurableForecastPreparation,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'
import {
  buildForecastCorrelationHeaders,
  createForecastCorrelationId,
  FORECAST_CORRELATION_HEADER,
} from '@/lib/benchmark-forecast/forecast-correlation'

export const dynamic = 'force-dynamic'

export function createPrepareVerificationRouteHandler(
  enqueue = requestDurableForecastPreparation,
) {
  return async function POST(request: NextRequest) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
    }
    const parsed = parseBenchmarkForecastCurrentPreparationRequest(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const correlationId = createForecastCorrelationId(request.headers.get(FORECAST_CORRELATION_HEADER))
    const responseHeaders = { [FORECAST_CORRELATION_HEADER]: correlationId }

    try {
      const result = await enqueue(parsed.data, 'VERIFICATION', undefined, {
        signal: request.signal,
        headers: buildForecastCorrelationHeaders(correlationId),
      })
      return NextResponse.json({ ...result, correlationId }, { headers: responseHeaders })
    } catch (error) {
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message, correlationId }, { status: error.statusCode, headers: responseHeaders })
      }
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Historical Verification queue request failed.',
      }, { status: 500, headers: responseHeaders })
    }
  }
}

export const POST = createPrepareVerificationRouteHandler()
