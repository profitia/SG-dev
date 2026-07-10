import { NextRequest, NextResponse } from 'next/server'

import { getSeries } from '@/lib/time-series/series-query'

export const dynamic = 'force-dynamic'

function readLocale(request: NextRequest): 'pl' | 'en' {
  const locale = request.nextUrl.searchParams.get('locale')
  return locale === 'en' ? 'en' : 'pl'
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getSeries(request.nextUrl.searchParams, readLocale(request))
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: (error as Error).message.includes('DATABASE_URL') ? 503 : 500 },
    )
  }
}
