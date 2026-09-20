import { type NextRequest, NextResponse } from 'next/server'

import { forwardForecastUiVisibleTelemetry, type ForecastUiVisibleTelemetry } from '@/lib/benchmark-forecast/forecast-action-telemetry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePayload(value: unknown): ForecastUiVisibleTelemetry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (
    typeof input.correlationId !== 'string'
    || (input.layer !== 'CURRENT' && input.layer !== 'VERIFICATION')
    || typeof input.seriesId !== 'string'
    || !['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD'].includes(String(input.targetBasis))
    || typeof input.targetSemantics !== 'string'
    || typeof input.modelId !== 'string'
    || typeof input.pageInstanceId !== 'string'
    || typeof input.clientVisibleAt !== 'string'
    || !(typeof input.responseToVisibleMs === 'number' || input.responseToVisibleMs === null)
  ) return null
  return input as ForecastUiVisibleTelemetry
}

export async function POST(request: NextRequest) {
  const payload = parsePayload(await request.json().catch(() => null))
  if (!payload) return NextResponse.json({ error: 'A valid Forecast UI telemetry payload is required.' }, { status: 400 })
  try {
    return NextResponse.json(await forwardForecastUiVisibleTelemetry(payload))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Forecast UI telemetry failed.' }, { status: 502 })
  }
}
