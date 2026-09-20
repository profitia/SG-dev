import { NextRequest, NextResponse } from 'next/server'

import {
  durableSnapshotToProgressiveSnapshot,
  parseBenchmarkForecastCurrentPreparationRequest,
  readDurableForecastPreparationSnapshot,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'
import type { BenchmarkForecastCurrentPreparationRequest, ProgressiveForecastPreparationSnapshot } from '@/lib/benchmark-forecast/forecast-contract'
import {
  buildForecastCorrelationHeaders,
  createForecastCorrelationId,
  FORECAST_CORRELATION_HEADER,
} from '@/lib/benchmark-forecast/forecast-correlation'

export const dynamic = 'force-dynamic'

type ProgressiveSnapshotReader = (
  input: BenchmarkForecastCurrentPreparationRequest,
  traceOptions?: unknown,
  options?: { signal?: AbortSignal, headers?: Record<string, string> },
) => Promise<ProgressiveForecastPreparationSnapshot>

const readDurableProgressiveSnapshot: ProgressiveSnapshotReader = async (input, _traceOptions, options) => (
  durableSnapshotToProgressiveSnapshot(await readDurableForecastPreparationSnapshot(input, undefined, options))
)

export function createProgressiveForecastPreparationRouteHandler(
  reader: ProgressiveSnapshotReader = readDurableProgressiveSnapshot,
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

    const correlationId = createForecastCorrelationId(request.headers.get(FORECAST_CORRELATION_HEADER))
    const responseHeaders = { [FORECAST_CORRELATION_HEADER]: correlationId }

    try {
      const result = await reader(parsed.data, undefined, {
        signal: request.signal,
        headers: buildForecastCorrelationHeaders(correlationId),
      })
      return NextResponse.json({ ...result, correlationId }, { headers: responseHeaders })
    } catch (error) {
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message, correlationId }, { status: error.statusCode, headers: responseHeaders })
      }

      return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast progressive preparation failed.', correlationId }, { status: 500, headers: responseHeaders })
    }
  }
}

export const POST = createProgressiveForecastPreparationRouteHandler()
