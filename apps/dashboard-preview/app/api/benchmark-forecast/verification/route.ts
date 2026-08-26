import { NextRequest, NextResponse } from 'next/server'

import {
  DEFAULT_FORECAST_TARGET_BASIS,
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  type ForecastTargetBasis,
  type ForecastPortfolioModelId,
} from '@/lib/benchmark-forecast/forecast-contract'
import { getBenchmarkForecastVerification } from '@/lib/benchmark-forecast/runtime-query'

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

  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 })
  }

  if (!isForecastPortfolioModelId(model)) {
    return NextResponse.json({ error: `model must be one of: ${FORECAST_PORTFOLIO_MODELS.join(', ')}` }, { status: 400 })
  }

  if (targetBasis && !isForecastTargetBasis(targetBasis)) {
    return NextResponse.json({ error: `targetBasis must be one of: ${FORECAST_TARGET_BASES.join(', ')}` }, { status: 400 })
  }

  const normalizedTargetBasis = targetBasis && isForecastTargetBasis(targetBasis)
    ? targetBasis
    : DEFAULT_FORECAST_TARGET_BASIS

  try {
    const payload = await getBenchmarkForecastVerification(
      seriesId,
      model,
      normalizedTargetBasis,
    )
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
