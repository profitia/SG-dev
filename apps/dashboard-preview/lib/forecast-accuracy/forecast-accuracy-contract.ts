export const FORECAST_ACCURACY_HORIZONS = [1, 3, 6, 12] as const

export type ForecastAccuracyHorizonMonths = (typeof FORECAST_ACCURACY_HORIZONS)[number]

export type ForecastAccuracyErrorCode =
  | 'INVALID_HORIZON'
  | 'BENCHMARK_REQUIRED'
  | 'NO_ACCURACY_DATA'
  | 'INVALID_DATE_RANGE'
  | 'INTERNAL_ERROR'

export interface ForecastAccuracySelection {
  componentName: string | null
  benchmarkCode: string
  horizonMonths: ForecastAccuracyHorizonMonths | null
}

export interface ForecastAccuracyPoint {
  targetDate: string
  actualValue: number | null
  forecastValue: number
  sourceDifferenceValue: number | null
  sourceErrorType: string | null
}

export interface ForecastAccuracySourceInfo {
  sourceTableName: string | null
  sourceBusinessName: string | null
  latestRunId: string | null
  lastSyncedAt: string | null
}

export interface ForecastAccuracyCoverage {
  firstDate: string | null
  lastDate: string | null
  pointCount: number
  missingPointCount: number | null
}

export interface ForecastAccuracyProfiling {
  dbQueryMs: number
  mappingMs: number
  sortingMs: number
  coverageMs: number
  responseSerializationMs: number
  totalServerMs: number
  responseSizeBytes: number
  recordCount: number
  cacheHit: boolean
}

export interface ForecastAccuracyResponse {
  selection: ForecastAccuracySelection
  availableHorizons: ForecastAccuracyHorizonMonths[]
  points: ForecastAccuracyPoint[]
  sourceInfo: ForecastAccuracySourceInfo
  coverage: ForecastAccuracyCoverage
  profiling?: ForecastAccuracyProfiling
}

export type ForecastAccuracyBaseResponse = Omit<ForecastAccuracyResponse, 'profiling'>

export interface ForecastAccuracyErrorResponse {
  error: {
    code: ForecastAccuracyErrorCode
    message: string
  }
}

export interface ForecastAccuracyHistoricalAlignmentExample {
  targetDate: string
  actualValue: number | null
  historicalValue: number | null
  differenceValue: number | null
  status: 'MATCH' | 'MISMATCH' | 'MISSING_HISTORICAL' | 'MISSING_ACTUAL'
}

export interface ForecastAccuracyHistoricalAlignment {
  benchmarkCode: string
  organizationId: string | null
  tolerance: number
  accuracyDateCount: number
  historicalDateCount: number
  matchedDateCount: number
  missingHistoricalCount: number
  actualMatchCount: number
  actualMismatchCount: number
  examples: ForecastAccuracyHistoricalAlignmentExample[]
}

export class ForecastAccuracyRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ForecastAccuracyErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ForecastAccuracyRequestError'
  }

  toResponse(): ForecastAccuracyErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    }
  }
}

export function isForecastAccuracyHorizonMonths(value: number): value is ForecastAccuracyHorizonMonths {
  return FORECAST_ACCURACY_HORIZONS.includes(value as ForecastAccuracyHorizonMonths)
}