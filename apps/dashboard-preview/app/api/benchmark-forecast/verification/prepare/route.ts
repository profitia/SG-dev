import { NextRequest, NextResponse } from 'next/server'

import {
  parseBenchmarkForecastCurrentPreparationRequest,
  requestDurableForecastPreparation,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

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

    try {
      return NextResponse.json(await enqueue(parsed.data, 'VERIFICATION', undefined, { signal: request.signal }))
    } catch (error) {
      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Historical Verification queue request failed.',
      }, { status: 500 })
    }
  }
}

export const POST = createPrepareVerificationRouteHandler()
