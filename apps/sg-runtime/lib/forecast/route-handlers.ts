import { type NextRequest } from 'next/server'

import type {
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationResult,
} from '@/lib/forecast/contracts'
import { withInternalForecastServiceAuth } from '@/lib/api/internal-forecast-service-auth'
import { cognitionError, cognitionOk, parseSearchParams, withCognitionAuth } from '@/lib/api/middleware'
import { resolveProductionForecast, type ProductionForecastResult } from '@/lib/forecast/production-routing'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { buildRollingDailyHistoryFingerprint } from '@/lib/forecast/rolling-daily-maintenance'
import { readPreparedRollingDailyForecastVerification } from '@/lib/forecast/rolling-daily-verification'
import {
  ForecastRouteQuerySchema,
  ProductionForecastRouteQuerySchema,
  toForecastRequestInput,
  toProductionForecastRequestInput,
  type ForecastRequestInput,
  type ProductionForecastRequestInput,
} from '@/lib/forecast/request-contract'
import {
  readPreparedBenchmarkCurrentForecast,
  readPreparedBenchmarkForecastVerification,
} from '@/lib/forecast/service'
import {
  forecastStressContextFromHeaders,
  forecastStressTelemetry,
  type ForecastStressTelemetry,
} from '@/lib/forecast/stress-telemetry'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'

type PreparedCurrentResult = BenchmarkForecastCurrentResult | Awaited<ReturnType<typeof readPreparedRollingDailyCurrentForecast>>
type CurrentForecastResolver = (input: ForecastRequestInput) => Promise<PreparedCurrentResult>
type ForecastVerificationResolver = (input: ForecastRequestInput) => Promise<BenchmarkForecastVerificationResult>
type ProductionForecastResolver = (input: ProductionForecastRequestInput) => Promise<ProductionForecastResult>

type PreparedVerificationDependencies = {
  readRollingDailyVerification: ForecastVerificationResolver
  readGenericPeriodVerification: ForecastVerificationResolver
}

const preparedVerificationDependencies: PreparedVerificationDependencies = {
  readRollingDailyVerification: readPreparedRollingDailyForecastVerification,
  readGenericPeriodVerification: readPreparedBenchmarkForecastVerification,
}

async function readPreparedRollingDailyCurrentForecast(input: ForecastRequestInput) {
  const { history } = await resolveBenchmarkHistoricalSeries(input.seriesId, 'ALL')
  const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: input.seriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.historical,
  })
  const snapshot = await readRollingDailyCurrentForecastSnapshot({
    seriesId: input.seriesId,
    modelId: input.modelId,
    sourceHistoryFingerprint,
  })
  forecastStressTelemetry.emit('prepared_read', {
    kind: 'current',
    store: 'rolling_daily_current_forecast_snapshots',
    hit: snapshot.status === 'HIT',
    stale: snapshot.status === 'STALE',
  })
  if (snapshot.status === 'HIT') return snapshot.payload
  return {
    status: 'NOT_AVAILABLE' as const,
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: 'POINT_IN_TIME' as const,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    methodId: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    reason: `PREPARATION_REQUIRED: Rolling Daily prepared Current snapshot is ${snapshot.status}.`,
  }
}

async function readPreparedCurrentForecast(input: ForecastRequestInput): Promise<PreparedCurrentResult> {
  return input.targetBasis === 'POINT_IN_TIME'
    ? readPreparedRollingDailyCurrentForecast(input)
    : readPreparedBenchmarkCurrentForecast(input)
}

export async function resolvePreparedForecastVerification(
  input: ForecastRequestInput,
  dependencies: PreparedVerificationDependencies = preparedVerificationDependencies,
) {
  return input.targetBasis === 'POINT_IN_TIME'
    ? dependencies.readRollingDailyVerification(input)
    : dependencies.readGenericPeriodVerification(input)
}

export function createCurrentForecastRouteHandler(
  resolveCurrentForecast: CurrentForecastResolver = readPreparedCurrentForecast,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withCognitionAuth(async (_auth, request: NextRequest) => {
    const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
    if (!parsed.ok) {
      return cognitionError('VALIDATION_ERROR', parsed.message, 400)
    }

    const input = toForecastRequestInput(parsed.data)
    const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
      telemetry.sampleResources()
      const resolved = await resolveCurrentForecast(input)
      telemetry.sampleResources()
      return resolved
    })
    return cognitionOk(result)
  })
}

export function createForecastVerificationRouteHandler(
  resolveForecastVerification: ForecastVerificationResolver = resolvePreparedForecastVerification,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withCognitionAuth(async (_auth, request: NextRequest) => {
    const parsed = parseSearchParams(request, ForecastRouteQuerySchema)
    if (!parsed.ok) {
      return cognitionError('VALIDATION_ERROR', parsed.message, 400)
    }

    const input = toForecastRequestInput(parsed.data)
    const result = await telemetry.run(forecastStressContextFromHeaders(request, input), async () => {
      telemetry.sampleResources()
      const resolved = await resolveForecastVerification(input)
      telemetry.sampleResources()
      return resolved
    })
    return cognitionOk(result)
  })
}

export function createInternalProductionForecastRouteHandler(
  resolveInternalProductionForecast: ProductionForecastResolver = resolveProductionForecast,
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> = forecastStressTelemetry,
) {
  return withInternalForecastServiceAuth(async (_principal, request: NextRequest) => {
    const parsed = parseSearchParams(request, ProductionForecastRouteQuerySchema)
    if (!parsed.ok) {
      return cognitionError('VALIDATION_ERROR', parsed.message, 400)
    }

    const input = toProductionForecastRequestInput(parsed.data)
    const result = await telemetry.run(forecastStressContextFromHeaders(request, {
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.forecastMethod,
    }), async () => {
      telemetry.sampleResources()
      const resolved = await resolveInternalProductionForecast(input)
      telemetry.sampleResources()
      return resolved
    })
    return cognitionOk(result)
  })
}