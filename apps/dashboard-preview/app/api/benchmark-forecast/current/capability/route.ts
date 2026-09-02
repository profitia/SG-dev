import { NextRequest, NextResponse } from 'next/server'

import {
  parseBenchmarkForecastCurrentPreparationRequest,
  readInteractiveForecastCapability,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

export const dynamic = 'force-dynamic'

type CapabilityReader = typeof readInteractiveForecastCapability

export function createReadCurrentForecastCapabilityRouteHandler(
  reader: CapabilityReader = readInteractiveForecastCapability,
) {
  return async function GET(request: NextRequest) {
    const parsed = parseBenchmarkForecastCurrentPreparationRequest({
      seriesId: request.nextUrl.searchParams.get('seriesId'),
      modelId: request.nextUrl.searchParams.get('modelId'),
      targetBasis: request.nextUrl.searchParams.get('targetBasis'),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    try {
      return NextResponse.json(await reader(parsed.data))
    } catch (error) {
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }

      return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast capability failed.' }, { status: 500 })
    }
  }
}

export const GET = createReadCurrentForecastCapabilityRouteHandler()