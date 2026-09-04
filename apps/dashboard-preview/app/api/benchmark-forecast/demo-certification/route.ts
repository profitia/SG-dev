import { NextRequest, NextResponse } from 'next/server'

import {
  createDemoCertificationService,
  type DemoCertificationMode,
  type DemoCertificationSnapshot,
} from '@/lib/benchmark-forecast/demo-certification'

export const dynamic = 'force-dynamic'

type DemoCertificationRequestBody = {
  mode?: DemoCertificationMode
  seriesIds?: string[]
  includeFallback?: boolean
  priorSnapshots?: DemoCertificationSnapshot[]
}

function isMode(value: unknown): value is DemoCertificationMode {
  return value === 'CERTIFY' || value === 'REVALIDATE'
}

function normalizeBody(body: unknown): DemoCertificationRequestBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }

  const candidate = body as Record<string, unknown>
  return {
    mode: isMode(candidate.mode) ? candidate.mode : undefined,
    seriesIds: Array.isArray(candidate.seriesIds)
      ? candidate.seriesIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined,
    includeFallback: typeof candidate.includeFallback === 'boolean' ? candidate.includeFallback : undefined,
    priorSnapshots: Array.isArray(candidate.priorSnapshots)
      ? candidate.priorSnapshots.filter((snapshot): snapshot is DemoCertificationSnapshot => (
        Boolean(snapshot)
        && typeof snapshot === 'object'
        && typeof (snapshot as DemoCertificationSnapshot).seriesId === 'string'
      ))
      : undefined,
  }
}

export async function POST(request: NextRequest) {
  let body: unknown = {}

  try {
    const contentLength = request.headers.get('content-length')
    if (!contentLength || contentLength !== '0') {
      body = await request.json()
    }
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const payload = normalizeBody(body)

  try {
    const report = await createDemoCertificationService().run(payload)
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Demo certification failed.' },
      { status: 500 },
    )
  }
}