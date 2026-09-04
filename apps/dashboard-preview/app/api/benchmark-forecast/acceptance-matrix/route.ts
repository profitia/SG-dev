import { NextRequest, NextResponse } from 'next/server'

import { getForecastAcceptanceMatrixReport } from '@/lib/benchmark-forecast/acceptance-matrix'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId')?.trim() ?? ''

  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getForecastAcceptanceMatrixReport(seriesId))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast acceptance matrix failed.' }, { status: 500 })
  }
}