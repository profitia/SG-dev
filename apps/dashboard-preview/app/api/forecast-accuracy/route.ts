import { NextRequest, NextResponse } from 'next/server'

import { ForecastAccuracyRequestError } from '@/lib/forecast-accuracy/forecast-accuracy-contract'
import { forecastAccuracyQueryService } from '@/lib/forecast-accuracy/forecast-accuracy-query'

export const dynamic = 'force-dynamic'

function readLocale(request: NextRequest): 'pl' | 'en' {
  const locale = request.nextUrl.searchParams.get('locale')
  return locale === 'en' ? 'en' : 'pl'
}

export async function GET(request: NextRequest) {
  try {
    const payload = await forecastAccuracyQueryService.getForecastAccuracy(request.nextUrl.searchParams, readLocale(request))
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof ForecastAccuracyRequestError) {
      return NextResponse.json(error.toResponse(), { status: error.status })
    }

    const message = (error as Error).message
    const status = message.includes('DATABASE_URL') ? 503 : 500

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: status === 503
            ? 'Forecast Accuracy service is temporarily unavailable.'
            : 'Forecast Accuracy request failed.',
        },
      },
      { status },
    )
  }
}