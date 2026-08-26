import type {
  ForecastMethodId,
  ForecastSourceLineage,
  ForecastTargetSemantics,
} from '@/lib/forecast/identity'

export const USER_FACING_FORECAST_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const
export const FORECAST_TARGET_BASES = ['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD'] as const
export const PRODUCTION_FORECAST_METHODS = ['MONTHLY_AVERAGE', 'END_OF_PERIOD', 'ROLLING_DAILY_POINT_IN_TIME'] as const

export type UserFacingForecastModelId = (typeof USER_FACING_FORECAST_MODELS)[number]
export type ForecastTargetBasis = (typeof FORECAST_TARGET_BASES)[number]
export type ProductionForecastMethod = (typeof PRODUCTION_FORECAST_METHODS)[number]
export const DEFAULT_FORECAST_TARGET_BASIS: ForecastTargetBasis = 'MONTHLY_AVERAGE'

export type ForecastCapabilityStatus = 'AVAILABLE' | 'NOT_AVAILABLE' | 'UNSUPPORTED' | 'FAILED'

export type ForecastCacheStatus = 'hit' | 'miss' | 'db-unavailable' | 'persist-failed'

export interface ForecastSourceRef {
  kind: string
  runId: string | null
}

export interface ForecastHistorySummary {
  frequency: string | null
  start: string | null
  end: string | null
  observations: number
}

export type ForecastCurrentAlignmentStatus = 'ALIGNED' | 'UNALIGNED' | 'INDETERMINATE'

export interface ForecastCurrentAlignment {
  status: ForecastCurrentAlignmentStatus
  trainingFrequency: string | null
  lastHistoricalPeriod: string | null
  forecastOrigin: string | null
  firstForecastTarget: string | null
}

export interface ForecastSelectionMetadata {
  modelFamily: string
  selectedVariant: string
  selectedParameters: Record<string, unknown>
  selectionScore: number | null
  selectionMetric: string | null
  fitStatus: string
  failureReason: string | null
}

export interface ForecastCurrentPoint {
  horizon: string
  horizonSteps: number
  forecastDate: string
  forecastValue: number | null
  metadata: ForecastSelectionMetadata | null
  failureReason: string | null
}

export interface ForecastVerificationMetrics {
  mae: number | null
  rmse: number | null
  mase: number | null
  smape: number | null
  directionalAccuracy: number | null
  bias: number | null
}

export interface ForecastVerificationFailure {
  benchmarkId: string
  modelId: string
  forecastOrigin: string
  horizon: string
  horizonSteps: number
  forecastDate: string
  failureReason: string
}

export interface ForecastVerificationRecord {
  benchmarkId: string
  modelId: string
  forecastOrigin: string
  horizon: string
  horizonSteps: number
  forecastDate: string
  actualObservedAt: string | null
  originValue: number
  forecastValue: number
  actualValue: number
  error: number
  absoluteError: number
  delta: number
  deltaPct: number | null
  maseScale: number
  metadata: ForecastSelectionMetadata | null
}

export interface ForecastVerificationHorizon {
  horizon: string
  horizonSteps: number
  origins: number
  expectedOrigins: number
  successfulOrigins: number
  failedOrigins: number
  coverage: number
  metrics: ForecastVerificationMetrics | null
  records: ForecastVerificationRecord[]
  failures: ForecastVerificationFailure[]
}

export interface ForecastCapabilityBase {
  status: ForecastCapabilityStatus
  seriesId: string
  modelId: string
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
}

export interface ForecastAvailableBase extends ForecastCapabilityBase {
  status: 'AVAILABLE'
  displayName: string
  description: string | null
  userFacingModel: boolean
  methodVersion: string
  source: ForecastSourceRef
  lineage: ForecastSourceLineage
  historyFingerprint: string
  history: ForecastHistorySummary
  forecastOrigin: string | null
  runtimeSeconds: number | null
  cacheStatus: ForecastCacheStatus
}

export interface BenchmarkForecastCurrentAvailableResult extends ForecastAvailableBase {
  alignment: ForecastCurrentAlignment
  currentForecast: Record<string, ForecastCurrentPoint>
}

export interface BenchmarkForecastVerificationAvailableResult extends ForecastAvailableBase {
  verification: Record<string, ForecastVerificationHorizon>
}

export interface ForecastNotAvailableResult extends ForecastCapabilityBase {
  status: 'NOT_AVAILABLE'
  reason: string
}

export interface ForecastUnsupportedResult extends ForecastCapabilityBase {
  status: 'UNSUPPORTED'
  reason: string
  supportedSeriesIds: string[]
  supportedModels: string[]
  methodVersion?: string
  source?: ForecastSourceRef
}

export interface ForecastFailedResult extends ForecastCapabilityBase {
  status: 'FAILED'
  reason: string
  methodVersion?: string
  source?: ForecastSourceRef
  historyFingerprint?: string
}

export type BenchmarkForecastCurrentResult =
  | BenchmarkForecastCurrentAvailableResult
  | ForecastNotAvailableResult
  | ForecastUnsupportedResult
  | ForecastFailedResult

export type BenchmarkForecastVerificationResult =
  | BenchmarkForecastVerificationAvailableResult
  | ForecastNotAvailableResult
  | ForecastUnsupportedResult
  | ForecastFailedResult

export type MonthlyProductionForecastResult = BenchmarkForecastCurrentResult & {
  productionMethod: ForecastTargetBasis
}