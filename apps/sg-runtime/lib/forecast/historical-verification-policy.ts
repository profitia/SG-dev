import type {
  BenchmarkForecastVerificationResult,
  ForecastVerificationHorizon,
  HistoricalVerificationHorizonSummary,
  HistoricalVerificationSummary,
} from '@/lib/forecast/contracts'

export const HISTORICAL_VERIFICATION_CONTRACT_VERSION = 'HISTORICAL_VERIFICATION_V1' as const
export const MIN_HISTORICAL_VERIFICATION_ORIGINS = 24

export function createUnavailableHistoricalVerificationSummary(
  status: Extract<HistoricalVerificationSummary['status'], 'NOT_PREPARED' | 'FAILED'>,
): HistoricalVerificationSummary {
  return {
    contractVersion: HISTORICAL_VERIFICATION_CONTRACT_VERSION,
    status,
    originCount: 0,
    expectedOriginCount: 0,
    failedOriginCount: 0,
    coverage: 0,
    horizons: {},
  }
}

export function ensureHistoricalVerificationContract(
  result: BenchmarkForecastVerificationResult,
): BenchmarkForecastVerificationResult & { historicalVerification: HistoricalVerificationSummary } {
  if (result.historicalVerification) {
    return result as BenchmarkForecastVerificationResult & { historicalVerification: HistoricalVerificationSummary }
  }
  return {
    ...result,
    historicalVerification: createUnavailableHistoricalVerificationSummary(
      result.status === 'FAILED' ? 'FAILED' : 'NOT_PREPARED',
    ),
  }
}

export function resolveHistoricalVerificationHorizon(
  horizon: ForecastVerificationHorizon,
): HistoricalVerificationHorizonSummary {
  if (horizon.expectedOrigins === 0) {
    return {
      status: 'INSUFFICIENT_HISTORY',
      originCount: 0,
      expectedOriginCount: 0,
      failedOriginCount: 0,
      coverage: 0,
      warningCode: 'NO_LAWFUL_OUT_OF_SAMPLE_ORIGIN',
    }
  }

  if (horizon.successfulOrigins === 0 && horizon.failedOrigins > 0) {
    return {
      status: 'FAILED',
      originCount: 0,
      expectedOriginCount: horizon.expectedOrigins,
      failedOriginCount: horizon.failedOrigins,
      coverage: horizon.coverage,
      warningCode: 'ALL_ORIGINS_FAILED',
    }
  }

  if (horizon.successfulOrigins < MIN_HISTORICAL_VERIFICATION_ORIGINS) {
    return {
      status: 'LIMITED_SAMPLE',
      originCount: horizon.successfulOrigins,
      expectedOriginCount: horizon.expectedOrigins,
      failedOriginCount: horizon.failedOrigins,
      coverage: horizon.coverage,
      warningCode: 'SMALL_SAMPLE',
    }
  }

  return {
    status: 'AVAILABLE',
    originCount: horizon.successfulOrigins,
    expectedOriginCount: horizon.expectedOrigins,
    failedOriginCount: horizon.failedOrigins,
    coverage: horizon.coverage,
    warningCode: null,
  }
}

export function resolveHistoricalVerificationSummary(
  verification: Record<string, ForecastVerificationHorizon>,
): HistoricalVerificationSummary {
  const horizons = Object.fromEntries(
    Object.entries(verification).map(([label, horizon]) => [
      label,
      resolveHistoricalVerificationHorizon(horizon),
    ]),
  )
  const values = Object.values(horizons)
  if (values.length === 0) {
    return {
      contractVersion: HISTORICAL_VERIFICATION_CONTRACT_VERSION,
      status: 'NOT_PREPARED',
      originCount: 0,
      expectedOriginCount: 0,
      failedOriginCount: 0,
      coverage: 0,
      horizons,
    }
  }

  const originCount = values.reduce((sum, horizon) => sum + horizon.originCount, 0)
  const expectedOriginCount = values.reduce((sum, horizon) => sum + horizon.expectedOriginCount, 0)
  const failedOriginCount = values.reduce((sum, horizon) => sum + horizon.failedOriginCount, 0)
  const status = values.every((horizon) => horizon.status === 'AVAILABLE')
    ? 'AVAILABLE'
    : values.every((horizon) => horizon.status === 'INSUFFICIENT_HISTORY')
      ? 'INSUFFICIENT_HISTORY'
      : values.every((horizon) => horizon.status === 'FAILED')
        ? 'FAILED'
        : 'LIMITED_SAMPLE'

  return {
    contractVersion: HISTORICAL_VERIFICATION_CONTRACT_VERSION,
    status,
    originCount,
    expectedOriginCount,
    failedOriginCount,
    coverage: expectedOriginCount === 0 ? 0 : originCount / expectedOriginCount,
    horizons,
  }
}
