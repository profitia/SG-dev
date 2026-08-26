import { NextRequest, NextResponse } from 'next/server'

import {
  phase22cDiagnosticSpan,
  phase22cDiagnosticSyncSpan,
  runPhase22cDiagnosticRequest,
} from '@/lib/phase-2-2c/diagnostics'
import { getComponentList } from '@/lib/time-series/series-query'

export const dynamic = 'force-dynamic'

function readLocale(request: NextRequest): 'pl' | 'en' {
  const locale = request.nextUrl.searchParams.get('locale')
  return locale === 'en' ? 'en' : 'pl'
}

export async function GET(request: NextRequest) {
  return runPhase22cDiagnosticRequest(request, 'P09_COMPONENTS', async () => {
    try {
      const payload = await phase22cDiagnosticSpan(
        'component_list_resolve',
        () => getComponentList(request.nextUrl.searchParams, readLocale(request)),
      )
      return phase22cDiagnosticSyncSpan('response_serialize', () => NextResponse.json(payload))
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message.includes('DATABASE_URL') ? 503 : 500 },
      )
    }
  })
}
