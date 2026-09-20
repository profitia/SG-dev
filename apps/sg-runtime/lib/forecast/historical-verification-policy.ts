import type {
  BenchmarkForecastVerificationResult,
  ForecastVerificationHorizon,
  ForecastVerificationQualitySummary,
  HistoricalVerificationHorizonSummary,
  HistoricalVerificationSummary,
} from '@/lib/forecast/contracts'
import { MINIMUM_ADAPTIVE_HISTORICAL_VERIFICATION_ORIGINS } from '@/lib/forecast/historical-verification-origin-policy'

export const HISTORICAL_VERIFICATION_CONTRACT_VERSION = 'HISTORICAL_VERIFICATION_V2' as const
export const MIN_HISTORICAL_VERIFICATION_ORIGINS = MINIMUM_ADAPTIVE_HISTORICAL_VERIFICATION_ORIGINS
export const FORECAST_VERIFICATION_QUALITY_POLICY_VERSION = 'FORECAST_VERIFICATION_QUALITY_V1' as const

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function resolveForecastVerificationQuality(
  horizon: ForecastVerificationHorizon,
): ForecastVerificationQualitySummary {
  const comparableOriginCount = Math.max(0, horizon.successfulOrigins)
  const sampleCompletenessPercent = clamp(
    (comparableOriginCount / MIN_HISTORICAL_VERIFICATION_ORIGINS) * 100,
    0,
    100,
  )
  const smape = horizon.metrics?.smape
  const directionalAccuracy = horizon.metrics?.directionalAccuracy
  const hasLawfulMetrics = comparableOriginCount > 0
    && smape !== null
    && smape !== undefined
    && Number.isFinite(smape)

  if (!hasLawfulMetrics) {
    return {
      policyVersion: FORECAST_VERIFICATION_QUALITY_POLICY_VERSION,
      averageVerificationPercent: null,
      directionalAccuracyPercent: null,
      confidenceCode: 'UNAVAILABLE',
      confidenceLevel: null,
      comparableOriginCount,
      requiredOriginCount: MIN_HISTORICAL_VERIFICATION_ORIGINS,
      sampleCompletenessPercent,
    }
  }

  const confidence = sampleCompletenessPercent < 30
    ? { confidenceCode: 'LIMITED' as const, confidenceLevel: 1 as const }
    : sampleCompletenessPercent < 70
      ? { confidenceCode: 'MODERATE' as const, confidenceLevel: 2 as const }
      : { confidenceCode: 'SUFFICIENT' as const, confidenceLevel: 3 as const }

  return {
    policyVersion: FORECAST_VERIFICATION_QUALITY_POLICY_VERSION,
    averageVerificationPercent: clamp(100 - smape, 0, 100),
    directionalAccuracyPercent: directionalAccuracy !== null
      && directionalAccuracy !== undefined
      && Number.isFinite(directionalAccuracy)
      ? clamp(directionalAccuracy * 100, 0, 100)
      : null,
    ...confidence,
    comparableOriginCount,
    requiredOriginCount: MIN_HISTORICAL_VERIFICATION_ORIGINS,
    sampleCompletenessPercent,
  }
}

function attachForecastVerificationQuality(
  result: BenchmarkForecastVerificationResult,
): BenchmarkForecastVerificationResult {
  if (result.status !== 'AVAILABLE') {
    return result
  }

  return {
    ...result,
    verification: Object.fromEntries(
      Object.entries(result.verification).map(([horizonLabel, horizon]) => [
        horizonLabel,
        {
          ...horizon,
          quality: resolveForecastVerificationQuality(horizon),
        },
      ]),
    ),
  }
}

export function createUnavailableHistoricalVerificationSummary(
  status: Extract<HistoricalVerificationSummary['status'], 'NOT_PREPARED' | 'FAILED'>,
): HistoricalVerificationSummary {
  return {
    contractVersion: HISTORICAL_VERIFICATION_CONTRACT_VERSION,
    status,
    originCount: 0,
    expectedOriginCount: 0,
    failedOriginCount: 0,
    pendingOriginCount: 0,
    coverage: 0,
    horizons: {},
  }
}

export function ensureHistoricalVerificationContract(
  result: BenchmarkForecastVerificationResult,
): BenchmarkForecastVerificationResult & { historicalVerification: HistoricalVerificationSummary } {
  const resultWithQuality = attachForecastVerificationQuality(result)
  if (resultWithQuality.historicalVerification) {
    return resultWithQuality as BenchmarkForecastVerificationResult & { historicalVerification: HistoricalVerificationSummary }
  }
  return {
    ...resultWithQuality,
    historicalVerification: createUnavailableHistoricalVerificationSummary(
      resultWithQuality.status === 'FAILED' ? 'FAILED' : 'NOT_PREPARED',
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
      pendingOriginCount: horizon.pendingOrigins ?? 0,
      minimumOriginCount: MIN_HISTORICAL_VERIFICATION_ORIGINS,
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
      pendingOriginCount: horizon.pendingOrigins ?? 0,
      minimumOriginCount: MIN_HISTORICAL_VERIFICATION_ORIGINS,
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
      pendingOriginCount: horizon.pendingOrigins ?? 0,
      minimumOriginCount: MIN_HISTORICAL_VERIFICATION_ORIGINS,
      coverage: horizon.coverage,
      warningCode: 'SMALL_SAMPLE',
    }
  }

  return {
    status: 'AVAILABLE',
    originCount: horizon.successfulOrigins,
    expectedOriginCount: horizon.expectedOrigins,
    failedOriginCount: horizon.failedOrigins,
    pendingOriginCount: horizon.pendingOrigins ?? 0,
    minimumOriginCount: MIN_HISTORICAL_VERIFICATION_ORIGINS,
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
      pendingOriginCount: 0,
      coverage: 0,
      horizons,
    }
  }

  const originCount = values.reduce((sum, horizon) => sum + horizon.originCount, 0)
  const expectedOriginCount = values.reduce((sum, horizon) => sum + horizon.expectedOriginCount, 0)
  const failedOriginCount = values.reduce((sum, horizon) => sum + horizon.failedOriginCount, 0)
  const pendingOriginCount = values.reduce((sum, horizon) => sum + horizon.pendingOriginCount, 0)
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
    pendingOriginCount,
    coverage: expectedOriginCount === 0 ? 0 : originCount / expectedOriginCount,
    horizons,
  }
}
