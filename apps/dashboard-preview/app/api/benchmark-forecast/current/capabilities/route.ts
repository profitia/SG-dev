import { NextRequest, NextResponse } from 'next/server'

import {
  readInteractiveForecastCapabilitySnapshotBySeriesId,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId')?.trim() ?? ''
  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await readInteractiveForecastCapabilitySnapshotBySeriesId(
      seriesId,
      undefined,
      { signal: request.signal },
    ))
  } catch (error) {
    if (error instanceof SgRuntimeForecastPreparationAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Forecast capabilities unavailable.' },
      { status: 500 },
    )
  }
}
