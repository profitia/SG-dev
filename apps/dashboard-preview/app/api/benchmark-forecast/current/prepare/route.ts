import { NextRequest, NextResponse } from 'next/server'

import {
  FORECAST_TRACE_HEADER,
  SgRuntimeForecastPreparationAuthError,
  parseBenchmarkForecastCurrentPreparationRequest,
  prepareInteractiveCurrentForecast,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

export const dynamic = 'force-dynamic'

type PreparationGateway = typeof prepareInteractiveCurrentForecast

export function createPrepareCurrentForecastRouteHandler(
  gateway: PreparationGateway = prepareInteractiveCurrentForecast,
) {
  return async function POST(request: NextRequest) {
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
    }

    const parsed = parseBenchmarkForecastCurrentPreparationRequest(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    try {
      const traceEnabled = request.headers.get(FORECAST_TRACE_HEADER) === '1'
      return NextResponse.json(await gateway(parsed.data, traceEnabled))
    } catch (error) {
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }

      return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast preparation failed.' }, { status: 500 })
    }
  }
}

export const POST = createPrepareCurrentForecastRouteHandler()