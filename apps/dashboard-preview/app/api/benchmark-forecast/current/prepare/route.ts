import { NextRequest, NextResponse } from 'next/server'

import {
  extractForecastBridgeErrorTrace,
  FORECAST_TRACE_HEADER,
  SgRuntimeForecastPreparationAuthError,
  parseBenchmarkForecastCurrentPreparationRequest,
  prepareInteractiveCurrentForecast,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

export const dynamic = 'force-dynamic'

type PreparationGateway = (
  input: Parameters<typeof prepareInteractiveCurrentForecast>[0],
  traceEnabled?: Parameters<typeof prepareInteractiveCurrentForecast>[1],
  signal?: Parameters<typeof prepareInteractiveCurrentForecast>[2],
) => ReturnType<typeof prepareInteractiveCurrentForecast>

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
      return NextResponse.json(await gateway(parsed.data, traceEnabled, request.signal))
    } catch (error) {
      const traceEnabled = request.headers.get(FORECAST_TRACE_HEADER) === '1'
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }

      const bridgeFailure = traceEnabled ? extractForecastBridgeErrorTrace(error) : { trace: null, attempts: [] }

      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Forecast preparation failed.',
        ...(traceEnabled && bridgeFailure.trace ? { trace: bridgeFailure.trace } : {}),
        ...(traceEnabled && bridgeFailure.attempts.length > 0 ? { bridgeAttempts: bridgeFailure.attempts } : {}),
      }, { status: 500 })
    }
  }
}

export const POST = createPrepareCurrentForecastRouteHandler()