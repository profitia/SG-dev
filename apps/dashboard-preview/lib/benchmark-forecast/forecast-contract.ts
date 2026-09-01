export const FORECAST_PORTFOLIO_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const
export const FORECAST_TARGET_BASES = ['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD'] as const
export const FORECAST_TARGET_SEMANTICS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE', 'ROLLING_DAILY_POINT_IN_TIME'] as const
export const FORECAST_METHOD_IDS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE', 'ROLLING_DAILY_POINT_IN_TIME'] as const
export const DEFAULT_FORECAST_TARGET_BASIS = 'MONTHLY_AVERAGE' as const

export type ForecastPortfolioModelId = (typeof FORECAST_PORTFOLIO_MODELS)[number]
export type ForecastTargetBasis = (typeof FORECAST_TARGET_BASES)[number]
export type ForecastTargetSemantics = (typeof FORECAST_TARGET_SEMANTICS)[number]
export type ForecastMethodId = (typeof FORECAST_METHOD_IDS)[number]
export type ForecastCurrentUiState = 'IDLE' | 'READING' | 'AVAILABLE' | 'NOT_PREPARED' | 'PREPARING' | 'FAILED' | 'UNSUPPORTED'
export type InteractiveForecastCapabilityStatus =
  | 'READY'
  | 'NOT_PREPARED'
  | 'PREPARATION_REQUIRED'
  | 'DATA_NOT_AVAILABLE'
  | 'INSUFFICIENT_HISTORY'
  | 'NOT_LAWFUL'
  | 'PROVENANCE_REQUIRED'
  | 'NOT_IMPLEMENTED'
  | 'FAILED'
export type InteractiveForecastPreparationStatus = InteractiveForecastCapabilityStatus | 'REUSED'

export interface BenchmarkForecastCurrentPreparationRequest {
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
}

export interface InteractiveForecastCapabilityResult {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  modelId: ForecastPortfolioModelId
  sourceFrequency: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  lawfulTargetSemantics: string | null
  status: InteractiveForecastCapabilityStatus
  currentReadiness: 'READY' | 'NOT_PREPARED'
  verificationReadiness: 'READY' | 'NOT_PREPARED'
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
}

export interface InteractiveForecastPreparationResult {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  modelId: ForecastPortfolioModelId
  operation: 'CURRENT_FORECAST'
  status: InteractiveForecastPreparationStatus
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
}

export interface BenchmarkForecastCurrentPreparationResult {
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  state: 'READY' | 'NOT_PREPARED' | 'UNSUPPORTED' | 'FAILED'
  capabilityStatus: InteractiveForecastCapabilityStatus
  currentReadiness: 'READY' | 'NOT_PREPARED'
  prepareAttempted: boolean
  prepareStatus: InteractiveForecastPreparationStatus | null
  reason: string | null
  timingMs: number
}

export function resolveForecastTargetSemantics(targetBasis: ForecastTargetBasis): ForecastTargetSemantics {
  if (targetBasis === 'POINT_IN_TIME') {
    return 'ROLLING_DAILY_POINT_IN_TIME'
  }

  if (targetBasis === 'END_OF_PERIOD') {
    return 'END_OF_PERIOD'
  }

  return 'MONTHLY_AVERAGE'
}

export interface ForecastIdentity {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  methodVersion: string
  modelId: ForecastPortfolioModelId
}

export interface ForecastSourceLineage {
  inputSource: string
  inputRunId: string | null
  sourceSeriesId: string
  sourceFrequency: string | null
  historyFingerprint: string
  preparation: {
    method: string
    version: string
    provenanceStatus: 'PROVEN' | 'NOT_REQUIRED' | 'LEGACY_UNRESOLVED'
  } | null
}

export interface ForecastPreparedSnapshotIdentity {
  forecastIdentity: ForecastIdentity
  inputSource: string
  sourceHistoryFingerprint: string
  forecastOrigin: string | null
}

export interface ForecastPredictionBandIdentity {
  forecastIdentity: ForecastIdentity
  horizon: string
  targetDate: string | null
  calibrationMethod: string
  calibrationVersion: string
}

export type ForecastCapabilityStatus = 'AVAILABLE' | 'NOT_AVAILABLE' | 'UNSUPPORTED' | 'FAILED'

export interface ForecastHistorySummary {
  frequency: string | null
  start: string | null
  end: string | null
  observations: number
}

export interface ForecastCurrentPoint {
  horizon: string
  horizonSteps: number
  forecastDate: string
  forecastValue: number | null
}

export type ForecastCurrentFreshnessStatus = 'FRESH' | 'STALE'

export type ForecastCurrentFreshnessReason =
  | 'SOURCE_HISTORY_FINGERPRINT_MISSING'
  | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH'
  | 'CURRENT_SOURCE_HISTORY_FINGERPRINT_MISSING'

export interface ForecastCurrentFreshness {
  identity: ForecastPreparedSnapshotIdentity
  status: ForecastCurrentFreshnessStatus
  reason: ForecastCurrentFreshnessReason | null
  snapshotSourceHistoryFingerprint: string | null
  currentSourceHistoryFingerprint: string | null
}

export type RollingDailyProductionForecastBandReasonCode =
  | 'INSUFFICIENT_CALIBRATION_HISTORY'
  | 'CALIBRATION_NOT_AVAILABLE'
  | 'CALIBRATION_STALE'
  | 'BEFORE_FIRST_EMPIRICAL_ANCHOR'
  | 'INSUFFICIENT_ANCHOR_CALIBRATION'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_FIT_FAILED'
  | 'INSUFFICIENT_TECHNICAL_TRAINING_HISTORY'
  | 'METHOD_NOT_ELIGIBLE'
  | 'SOURCE_DATA_UNAVAILABLE'
  | 'UNSUPPORTED_FREQUENCY'

export type RollingDailyProductionForecastBandSource = 'EMPIRICAL_ANCHOR' | 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS'

export interface RollingDailyProductionForecastBand {
  status: 'AVAILABLE' | 'NOT_AVAILABLE'
  reasonCode: RollingDailyProductionForecastBandReasonCode | null
  source: RollingDailyProductionForecastBandSource | null
  lower: number | null
  upper: number | null
}

export interface RollingDailyProductionForecastPathPoint {
  date: string
  pointForecast: number
  band: RollingDailyProductionForecastBand
}

export interface RollingDailyProductionForecastAnchor {
  horizon: '1M' | '3M' | '6M' | '12M'
  horizonMonths: number
  targetCalendarDate: string
  pointForecast: number
  band: RollingDailyProductionForecastBand & {
    sampleCount: number | null
    p10ResidualOffset: number | null
    p90ResidualOffset: number | null
  }
}

export interface RollingDailyProductionForecastWarning {
  code: 'CALIBRATION_STALE' | 'PARTIAL_BAND_AVAILABILITY'
  message: string | null
}

export interface RollingDailyProductionForecastCalibration {
  availabilityStatus: 'AVAILABLE' | 'INSUFFICIENT_CALIBRATION_HISTORY' | 'NOT_AVAILABLE'
  freshnessStatus: 'FRESH' | 'STALE' | null
  quantileConvention: string
  coverageLabel: string
  methodologicalMinimumStatus: string
  updatedAt: string | null
  processedThrough: string | null
  lastResidualAvailabilityDate: string | null
}

export interface RollingDailyProductionForecastAudit {
  sourceHistoryFingerprint: string | null
  generatedAt: string
  sourceLatestObservationDate: string | null
  calendarProjectionMode: string | null
  projectionCalendarStrategy: string
  technicalMinimumTrainingObservations: number
  methodologicalTrainingEligibilityStatus: string
  calibrationUpdatedAt: string | null
  calibrationLastResidualAvailabilityDate: string | null
  inputSource: string | null
}

export interface RollingDailyProductionForecastBenchmark {
  benchmarkId: string
  displayName: string
  frequency: 'DAILY'
  unit: string | null
  currency: string | null
  provider: string | null
  providerSeriesId: string | null
}

export interface RollingDailyProductionForecastMethod {
  id: 'ROLLING_DAILY_POINT_IN_TIME'
  version: string
}

export interface RollingDailyProductionForecastModel {
  id: ForecastPortfolioModelId
  selectedCandidate: string | null
}

export interface RollingDailyProductionForecastOrigin {
  date: string
  value: number
}

export interface RollingDailyProductionForecastAvailableResult {
  productionMethod: 'ROLLING_DAILY_POINT_IN_TIME'
  contractVersion: string
  status: 'AVAILABLE'
  benchmark: RollingDailyProductionForecastBenchmark
  forecastMethod: RollingDailyProductionForecastMethod
  model: RollingDailyProductionForecastModel
  origin: RollingDailyProductionForecastOrigin
  maxHorizonMonths: 12
  anchors: RollingDailyProductionForecastAnchor[]
  path: RollingDailyProductionForecastPathPoint[]
  calibration: RollingDailyProductionForecastCalibration
  audit: RollingDailyProductionForecastAudit
  warnings: RollingDailyProductionForecastWarning[]
}

export interface RollingDailyProductionForecastUnavailableResult {
  productionMethod: 'ROLLING_DAILY_POINT_IN_TIME'
  contractVersion: string
  status: 'NOT_AVAILABLE' | 'FAILED'
  benchmark: RollingDailyProductionForecastBenchmark
  forecastMethod: RollingDailyProductionForecastMethod
  model: RollingDailyProductionForecastModel
  reasonCode: RollingDailyProductionForecastBandReasonCode
  message: string | null
  audit: RollingDailyProductionForecastAudit
  warnings: RollingDailyProductionForecastWarning[]
}

export type RollingDailyProductionForecastResult =
  | RollingDailyProductionForecastAvailableResult
  | RollingDailyProductionForecastUnavailableResult

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
}

export interface ForecastVerificationHorizon {
  horizon: string
  horizonSteps: number
  origins: number
  expectedOrigins: number
  successfulOrigins: number
  failedOrigins: number
  coverage: number
  records: ForecastVerificationRecord[]
}

export interface ForecastAvailableBase {
  status: 'AVAILABLE'
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  displayName: string
  description: string | null
  methodVersion: string
  lineage: ForecastSourceLineage
  history: ForecastHistorySummary
  forecastOrigin: string | null
}

export interface BenchmarkForecastCurrentAvailableResult extends ForecastAvailableBase {
  currentForecast: Record<string, ForecastCurrentPoint>
  rollingDailySnapshot?: RollingDailyProductionForecastAvailableResult | null
  freshness?: ForecastCurrentFreshness | null
}

export interface BenchmarkForecastVerificationAvailableResult extends ForecastAvailableBase {
  verification: Record<string, ForecastVerificationHorizon>
}

export interface ForecastUnavailableResult {
  status: Exclude<ForecastCapabilityStatus, 'AVAILABLE'>
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  reason: string
}

export type BenchmarkForecastCurrentResult = BenchmarkForecastCurrentAvailableResult | ForecastUnavailableResult
export type BenchmarkForecastVerificationResult = BenchmarkForecastVerificationAvailableResult | ForecastUnavailableResult

export function isAvailableCurrentResult(
  result: BenchmarkForecastCurrentResult | null,
): result is BenchmarkForecastCurrentAvailableResult {
  return result?.status === 'AVAILABLE'
}

export function isAvailableVerificationResult(
  result: BenchmarkForecastVerificationResult | null,
): result is BenchmarkForecastVerificationAvailableResult {
  return result?.status === 'AVAILABLE'
}
