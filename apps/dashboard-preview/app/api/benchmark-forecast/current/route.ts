import { NextRequest, NextResponse } from 'next/server'

import {
  DEFAULT_FORECAST_TARGET_BASIS,
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  type ForecastTargetBasis,
  type ForecastPortfolioModelId,
} from '@/lib/benchmark-forecast/forecast-contract'
import { resolveShowForecastCurrent } from '@/lib/benchmark-forecast/runtime-query'
import {
  phase22cDiagnosticSpan,
  phase22cDiagnosticSyncSpan,
  runPhase22cDiagnosticRequest,
} from '@/lib/phase-2-2c/diagnostics'

export const dynamic = 'force-dynamic'

function isForecastPortfolioModelId(value: string): value is ForecastPortfolioModelId {
  return FORECAST_PORTFOLIO_MODELS.includes(value as ForecastPortfolioModelId)
}

function isForecastTargetBasis(value: string): value is ForecastTargetBasis {
  return FORECAST_TARGET_BASES.includes(value as ForecastTargetBasis)
}

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId')?.trim() ?? ''
  const model = request.nextUrl.searchParams.get('model')?.trim() ?? ''
  const targetBasis = request.nextUrl.searchParams.get('targetBasis')?.trim() ?? ''
  const sourceFrequency = request.nextUrl.searchParams.get('sourceFrequency')?.trim() ?? ''
  const targetCadence = request.nextUrl.searchParams.get('targetCadence')?.trim() ?? ''

  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 })
  }

  if (!isForecastPortfolioModelId(model)) {
    return NextResponse.json({ error: `model must be one of: ${FORECAST_PORTFOLIO_MODELS.join(', ')}` }, { status: 400 })
  }

  if (targetBasis && !isForecastTargetBasis(targetBasis)) {
    return NextResponse.json({ error: `targetBasis must be one of: ${FORECAST_TARGET_BASES.join(', ')}` }, { status: 400 })
  }

  if (Boolean(sourceFrequency) !== Boolean(targetCadence)) {
    return NextResponse.json({ error: 'sourceFrequency and targetCadence must be provided together.' }, { status: 400 })
  }

  const normalizedTargetBasis = targetBasis && isForecastTargetBasis(targetBasis)
    ? targetBasis
    : DEFAULT_FORECAST_TARGET_BASIS

  return runPhase22cDiagnosticRequest(request, 'P10_CURRENT', async () => {
    try {
      const correlationHeaders = Object.fromEntries([
        'x-sg-stress-run-id',
        'x-sg-stress-scenario-id',
        'x-sg-stress-virtual-user-id',
        'x-sg-stress-logical-artifact-key',
        'x-request-id',
      ].flatMap((headerName) => {
        const value = request.headers.get(headerName)
        return value ? [[headerName, value]] : []
      }))
      const payload = await phase22cDiagnosticSpan('prepared_current_resolve', () => resolveShowForecastCurrent(
        seriesId,
        model,
        normalizedTargetBasis,
        undefined,
        sourceFrequency && targetCadence ? { sourceFrequency, targetCadence } : undefined,
        correlationHeaders,
      ))
      return phase22cDiagnosticSyncSpan('response_serialize', () => NextResponse.json(payload))
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    }
  })
}
