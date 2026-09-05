import { NextRequest, NextResponse } from 'next/server'

import {
  parseBenchmarkForecastCurrentPreparationRequest,
  requestProgressiveForecastPreparationSnapshot,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

export const dynamic = 'force-dynamic'

type ProgressiveSnapshotReader = (
  input: Parameters<typeof requestProgressiveForecastPreparationSnapshot>[0],
  traceOptions?: Parameters<typeof requestProgressiveForecastPreparationSnapshot>[1],
  options?: Parameters<typeof requestProgressiveForecastPreparationSnapshot>[2],
) => ReturnType<typeof requestProgressiveForecastPreparationSnapshot>

export function createProgressiveForecastPreparationRouteHandler(
  reader: ProgressiveSnapshotReader = requestProgressiveForecastPreparationSnapshot,
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
      return NextResponse.json(await reader(parsed.data, undefined, { signal: request.signal }))
    } catch (error) {
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }

      return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast progressive preparation failed.' }, { status: 500 })
    }
  }
}

export const POST = createProgressiveForecastPreparationRouteHandler()