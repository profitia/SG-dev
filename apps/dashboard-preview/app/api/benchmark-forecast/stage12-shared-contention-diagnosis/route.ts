import { NextRequest, NextResponse } from 'next/server'

import { runStage12SharedContentionDiagnosis } from '@/lib/benchmark-forecast/stage12-shared-contention-diagnosis'

export const dynamic = 'force-dynamic'

type DiagnosisRequestBody = {
  seriesId?: string
  staggerMs?: number
}

function normalizeBody(body: unknown): DiagnosisRequestBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }

  const candidate = body as Record<string, unknown>
  return {
    seriesId: typeof candidate.seriesId === 'string' && candidate.seriesId.trim().length > 0
      ? candidate.seriesId.trim()
      : undefined,
    staggerMs: typeof candidate.staggerMs === 'number' && Number.isFinite(candidate.staggerMs) && candidate.staggerMs >= 0
      ? candidate.staggerMs
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

  try {
    return NextResponse.json(await runStage12SharedContentionDiagnosis(normalizeBody(body)))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stage 12 shared contention diagnosis failed.' },
      { status: 500 },
    )
  }
}