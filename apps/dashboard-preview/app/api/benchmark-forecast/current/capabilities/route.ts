import { createNativeForecastReadHandler } from '@/lib/benchmark-forecast/native-read-relay'
import { NextRequest, NextResponse } from 'next/server'

import {
  readInteractiveForecastReadinessSnapshotBySeriesId,
  SgRuntimeForecastPreparationAuthError,
} from '@/lib/benchmark-forecast/interactive-current-preparation'

export const dynamic = 'force-dynamic'

async function legacyGET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId')?.trim() ?? ''
  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await readInteractiveForecastReadinessSnapshotBySeriesId(
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

const nativeGET = createNativeForecastReadHandler('capabilities')

export async function GET(request: NextRequest) {
  return (process.env.PROFITIA_AUTH_PROVIDER ?? 'legacy_demo') === 'legacy_demo'
    ? legacyGET(request) : nativeGET(request)
}
