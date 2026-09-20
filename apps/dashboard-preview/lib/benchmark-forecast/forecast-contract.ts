export const FORECAST_PORTFOLIO_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const
export const FORECAST_TARGET_BASES = ['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD'] as const
export const FORECAST_TARGET_SEMANTICS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE', 'ROLLING_DAILY_POINT_IN_TIME'] as const
export const FORECAST_METHOD_IDS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE', 'ROLLING_DAILY_POINT_IN_TIME'] as const
export const DEFAULT_FORECAST_TARGET_BASIS = 'MONTHLY_AVERAGE' as const

export type ForecastPortfolioModelId = (typeof FORECAST_PORTFOLIO_MODELS)[number]
export type ForecastTargetBasis = (typeof FORECAST_TARGET_BASES)[number]
export type ForecastTargetSemantics = (typeof FORECAST_TARGET_SEMANTICS)[number]
export type ForecastMethodId = (typeof FORECAST_METHOD_IDS)[number]
export type ForecastCurrentUiState = 'IDLE' | 'READING' | 'AVAILABLE' | 'NOT_PREPARED' | 'PREPARING' | 'QUEUED' | 'FAILED' | 'UNSUPPORTED'
export type ProgressiveForecastPreparationState = 'READY' | 'NOT_PREPARED' | 'PREPARING' | 'QUEUED' | 'UNSUPPORTED' | 'FAILED'
export type BenchmarkForecastPreparationState = 'READY' | 'NOT_PREPARED' | 'PREPARING' | 'QUEUED' | 'UNSUPPORTED' | 'FAILED'
export type InteractiveForecastCapabilityStatus =
  | 'AVAILABLE'
  | 'READY'
  | 'STALE'
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
  sourceFrequency?: string
  targetCadence?: string
}

export interface InteractiveForecastCapabilityResult {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  modelId: ForecastPortfolioModelId
  preparedReadAuthority?: {
    sourceFrequency: string
    targetCadence: string
    expectedHistoryFingerprint: string
  } | null
  sourceFrequency: string | null
  targetCadence: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  lawfulTargetSemantics: string | null
  status: InteractiveForecastCapabilityStatus
  currentReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  verificationReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  recentVerificationReadiness?: 'READY' | 'NOT_PREPARED' | 'STALE'
  fullVerificationReadiness?: 'READY' | 'NOT_PREPARED' | 'STALE'
  predictionBandResidualCount?: number
  predictionBandState?: 'AVAILABLE' | 'INSUFFICIENT_SAMPLE' | 'NOT_AVAILABLE'
  readiness?: {
    fastReady: boolean
    bandsReady: boolean
    calibratedReady: boolean
    fullReady: boolean
    blockers: string[]
  }
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  reason: string | null
}

export interface InteractiveForecastCapabilitySeriesSnapshot {
  seriesId: string
  sourceFrequency: string | null
  sourceAvailability: 'AVAILABLE' | 'DATA_NOT_AVAILABLE' | 'FAILED'
  status: 'AVAILABLE' | 'FAILED'
  reason: string | null
  targetedDataScope: 'SINGLE_SERIES'
  timingMs: number
  variants: InteractiveForecastCapabilityResult[]
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
  correlationId?: string
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  state: BenchmarkForecastPreparationState
  capabilityStatus: InteractiveForecastCapabilityStatus
  currentReadiness: 'READY' | 'NOT_PREPARED' | 'STALE'
  prepareAttempted: boolean
  prepareStatus: InteractiveForecastPreparationStatus | null
  reason: string | null
  timingMs: number
}

export interface ProgressiveForecastVariantSnapshot {
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  currentState: ProgressiveForecastPreparationState
  currentReason: string | null
  verificationState: ProgressiveForecastPreparationState
  verificationReason: string | null
}

export interface ProgressiveForecastPreparationSnapshot {
  correlationId?: string
  seriesId: string
  variants: ProgressiveForecastVariantSnapshot[]
  firstReadyCurrent: {
    modelId: ForecastPortfolioModelId
    targetBasis: ForecastTargetBasis
    targetSemantics: ForecastTargetSemantics
  } | null
  activeItem: {
    modelId: ForecastPortfolioModelId
    targetBasis: ForecastTargetBasis
    kind: 'CURRENT' | 'VERIFICATION'
  } | null
  queuedCount: number
  currentReadyCount: number
  verificationReadyCount: number
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
  inputSource: string
  sourceFrequency: string
  targetCadence: string
  horizonLabel: string
  horizonSteps: number
  targetDate: string | null
  sourceHistoryFingerprint: string
  trainingWindowPolicyId: string
  effectiveTrainingPolicyId: string
  bandPolicyVersion: string
  bandSource: ForecastUncertaintyBandSource | null
  calibrationMethod: string
  calibrationVersion: string
  calibrationCutoff: string | null
}

export type ForecastUncertaintyBandSource = 'EMPIRICAL_EXACT_RESIDUALS' | 'MODEL_NATIVE_SHORT_HISTORY'

export interface ForecastUncertaintyBand {
  status: 'AVAILABLE' | 'NOT_AVAILABLE'
  source: ForecastUncertaintyBandSource | null
  policyVersion: string
  coverage: 0.8
  lower: number | null
  upper: number | null
  sampleCount: number
  calibrationStatus: 'CALIBRATED' | 'INSUFFICIENT_SAMPLE' | 'NOT_AVAILABLE'
  calibrationMethod: string | null
  calibrationVersion: string | null
  reasonCode: string | null
  identity?: ForecastPredictionBandIdentity
}

export interface ForecastSelectionMetadata {
  modelFamily: string
  selectedVariant: string
  selectedParameters: Record<string, unknown>
  selectionScore: number | null
  selectionMetric: string | null
  fitStatus: string
  failureReason: string | null
  uncertaintyBand?: ForecastUncertaintyBand | null
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
  metadata?: ForecastSelectionMetadata | null
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

export type RollingDailyProductionForecastBandSource =
  | 'EMPIRICAL_ANCHOR'
  | 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS'
  | ForecastUncertaintyBandSource

export interface RollingDailyProductionForecastBand {
  status: 'AVAILABLE' | 'NOT_AVAILABLE'
  reasonCode: RollingDailyProductionForecastBandReasonCode | null
  source: RollingDailyProductionForecastBandSource | null
  lower: number | null
  upper: number | null
  policyVersion?: string
  coverage?: 0.8
  sampleCount?: number | null
  calibrationStatus?: 'CALIBRATED' | 'INSUFFICIENT_SAMPLE' | 'NOT_AVAILABLE'
  calibrationMethod?: string | null
  calibrationVersion?: string | null
  rollingDailySource?: 'EMPIRICAL_ANCHOR' | 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS' | 'MODEL_NATIVE_SHORT_HISTORY' | null
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

export interface ForecastVerificationMetrics {
  mae: number | null
  rmse: number | null
  mase: number | null
  smape: number | null
  directionalAccuracy: number | null
  bias: number | null
}

export type ForecastVerificationConfidenceCode =
  | 'LIMITED'
  | 'MODERATE'
  | 'SUFFICIENT'
  | 'UNAVAILABLE'

export interface ForecastVerificationQualitySummary {
  policyVersion: 'FORECAST_VERIFICATION_QUALITY_V1'
  averageVerificationPercent: number | null
  directionalAccuracyPercent: number | null
  confidenceCode: ForecastVerificationConfidenceCode
  confidenceLevel: 1 | 2 | 3 | null
  comparableOriginCount: number
  requiredOriginCount: number
  sampleCompletenessPercent: number
}

export interface ForecastVerificationHorizon {
  horizon: string
  horizonSteps: number
  origins: number
  expectedOrigins: number
  successfulOrigins: number
  failedOrigins: number
  pendingOrigins?: number
  coverage: number
  metrics?: ForecastVerificationMetrics | null
  quality?: ForecastVerificationQualitySummary
  records: ForecastVerificationRecord[]
}

export type HistoricalVerificationStatus =
  | 'AVAILABLE'
  | 'LIMITED_SAMPLE'
  | 'INSUFFICIENT_HISTORY'
  | 'NOT_PREPARED'
  | 'FAILED'

export interface HistoricalVerificationHorizonSummary {
  status: Exclude<HistoricalVerificationStatus, 'NOT_PREPARED'>
  originCount: number
  expectedOriginCount: number
  failedOriginCount: number
  pendingOriginCount: number
  minimumOriginCount: number
  coverage: number
  warningCode: 'SMALL_SAMPLE' | 'NO_LAWFUL_OUT_OF_SAMPLE_ORIGIN' | 'ALL_ORIGINS_FAILED' | null
}

export interface HistoricalVerificationSummary {
  contractVersion: 'HISTORICAL_VERIFICATION_V2'
  status: HistoricalVerificationStatus
  originCount: number
  expectedOriginCount: number
  failedOriginCount: number
  pendingOriginCount: number
  coverage: number
  horizons: Record<string, HistoricalVerificationHorizonSummary>
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
  historicalVerification?: HistoricalVerificationSummary
}

export interface ForecastUnavailableResult {
  status: Exclude<ForecastCapabilityStatus, 'AVAILABLE'>
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  reason: string
  historicalVerification?: HistoricalVerificationSummary
}

export type BenchmarkForecastCurrentResult = BenchmarkForecastCurrentAvailableResult | ForecastUnavailableResult
export type BenchmarkForecastVerificationResult = BenchmarkForecastVerificationAvailableResult | ForecastUnavailableResult

function hasRenderableMonthlyCurrentForecast(result: BenchmarkForecastCurrentAvailableResult) {
  return Object.values(result.currentForecast).some((point) => (
    point.forecastValue !== null && Number.isFinite(point.forecastValue)
  ))
}

function hasRenderablePointInTimeCurrentForecast(result: BenchmarkForecastCurrentAvailableResult) {
  return (result.rollingDailySnapshot?.path ?? []).some((point) => Number.isFinite(point.pointForecast))
}

export function isRenderableCurrentResult(
  result: BenchmarkForecastCurrentResult | null,
): result is BenchmarkForecastCurrentAvailableResult {
  if (result?.status !== 'AVAILABLE') {
    return false
  }

  if (result.targetBasis === 'POINT_IN_TIME') {
    return hasRenderablePointInTimeCurrentForecast(result)
  }

  return hasRenderableMonthlyCurrentForecast(result)
}

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
