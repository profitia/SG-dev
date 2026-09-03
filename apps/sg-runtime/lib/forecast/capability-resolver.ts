import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import {
  USER_FACING_FORECAST_MODELS,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import {
  canonicalizeDailyMarketPriceToEndOfPeriod,
  canonicalizeDailyMarketPriceToMonthly,
  canonicalizeProvenanceQualifiedNativePeriod,
  canonicalizeProvenanceQualifiedNativeMonthly,
  canonicalizeProvenanceQualifiedWeeklyEndOfPeriod,
  selectLatestContiguousMonthlySuffix,
} from '@/lib/forecast/canonical-history'
import {
  FORECAST_NATIVE_FREQUENCIES,
  isForecastExecutableNativeSparseFrequency,
  mapLegacyCalendarMonthHorizonToNativeSteps,
  normalizeForecastSourceFrequency,
  type ForecastSourceFrequency,
  type ForecastTargetCadence,
} from '@/lib/forecast/cadence'
import {
  createForecastIdentity,
  type ForecastIdentity,
  type ForecastPreparationIdentity,
  type ForecastTargetSemantics,
} from '@/lib/forecast/identity'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'
import { readForecastPreparedVariants } from '@/lib/forecast/prepared-state'
import { resolveMacrobondForecastProvenance } from '@/lib/forecast/provider-provenance'

export const FORECAST_SOURCE_FREQUENCIES = FORECAST_NATIVE_FREQUENCIES
export { normalizeForecastSourceFrequency }
export type { ForecastSourceFrequency }
export type ForecastSemanticLawfulness = 'LAWFUL' | 'LAWFUL_WITH_PROVENANCE' | 'NOT_LAWFUL'
export type ForecastAdmissionState = 'ADMITTED' | 'PROVENANCE_REQUIRED' | 'NOT_LAWFUL'
export type ForecastImplementationState = 'SUPPORTED' | 'NOT_IMPLEMENTED' | 'NOT_APPLICABLE'
export type ForecastHistoryEligibilityState = 'ELIGIBLE' | 'INSUFFICIENT_HISTORY' | 'DATA_NOT_AVAILABLE'
export type ForecastTargetPreparationState = 'PREPARED' | 'PREPARATION_REQUIRED' | 'NOT_SUPPORTED'
export type ForecastPreparedState = 'READY' | 'NOT_PREPARED' | 'STALE'
export type ForecastBusinessTarget = 'DAILY' | 'AVERAGE' | 'END_OF_PERIOD'
export type ForecastHorizonSupportState = 'SUPPORTED' | 'UNSUPPORTED' | 'NOT_REQUESTED'
export type ForecastVerificationEvidenceState = 'SUFFICIENT' | 'LIMITED_SAMPLE' | 'NOT_AVAILABLE'
export type ForecastPredictionBandEvidenceState = 'AVAILABLE' | 'INSUFFICIENT_SAMPLE' | 'NOT_AVAILABLE'
export type ForecastCapabilityResolutionState =
  | 'AVAILABLE'
  | 'NOT_PREPARED'
  | 'STALE'
  | 'PREPARATION_REQUIRED'
  | 'INSUFFICIENT_HISTORY'
  | 'DATA_NOT_AVAILABLE'
  | 'NOT_IMPLEMENTED'
  | 'PROVENANCE_REQUIRED'
  | 'NOT_LAWFUL'

export type ForecastCapabilityProvenance = {
  targetSemantics: ForecastTargetSemantics
  sourceFrequency: ForecastSourceFrequency
  preparation: ForecastPreparationIdentity
  sourceLineage: string | null
  closedPeriod: boolean
  levelAtTimestamp: boolean | null
  exactSourceObservedAt: boolean | null
  aggregation: 'ARITHMETIC_MEAN' | null
  underlyingObservationFrequency: ForecastSourceFrequency | null
  missingObservationPolicy: string | null
  syntheticObservations: boolean | null
}

export type ForecastPreparedVariant = {
  identity: ForecastIdentity
  current: ForecastPreparedState
  historical: ForecastPreparedState
}

export type ForecastCapabilityResolverInput = {
  seriesId: string
  sourceFrequency: ForecastSourceFrequency | null
  sourceObservationCount: number
  preparedObservationCounts: Partial<Record<ForecastTargetSemantics, number>>
  provenance: readonly ForecastCapabilityProvenance[]
  preparedVariants: readonly ForecastPreparedVariant[]
  horizonSteps?: number
  horizonMonths?: number
  verificationOriginCounts?: Partial<Record<ForecastTargetSemantics, number>>
  predictionBandResidualCounts?: Partial<Record<ForecastTargetSemantics, number>>
}

export type ForecastVariantCapability = {
  identity: ForecastIdentity
  sourceFrequency: ForecastSourceFrequency | null
  sourceFrequencyRecognized: boolean
  businessTarget: ForecastBusinessTarget
  targetCadence: ForecastTargetCadence | null
  targetSemanticsSupported: boolean
  horizonSupportState: ForecastHorizonSupportState
  horizonMonths: number | null
  horizonSteps: number | null
  semanticLawfulness: ForecastSemanticLawfulness
  admissionState: ForecastAdmissionState
  provenanceStatus: ForecastPreparationIdentity['provenanceStatus']
  implementationState: ForecastImplementationState
  historyEligibility: ForecastHistoryEligibilityState
  minimumRequiredObservations: number
  availableObservations: number
  modelEligible: boolean
  currentForecastEligible: boolean
  verificationOriginCount: number
  verificationEvidenceState: ForecastVerificationEvidenceState
  predictionBandResidualCount: number
  predictionBandState: ForecastPredictionBandEvidenceState
  targetPreparationState: ForecastTargetPreparationState
  currentPreparedState: ForecastPreparedState
  historicalPreparedState: ForecastPreparedState
  capabilityState: ForecastCapabilityResolutionState
}

export type ForecastCapabilitySourceMetadata = {
  seriesId: string
  providerCode: string | null
  source: string | null
  sourceFrequency: ForecastSourceFrequency | null
  rawFrequency: string | null
  sourceObservationCount: number | null
  fullHistoryObservationCount: number | null
}

export type ForecastCapabilityResolution = {
  status: 'AVAILABLE' | 'FAILED'
  reason: string | null
  sourceMetadata: ForecastCapabilitySourceMetadata
  targetedHydration: {
    scope: 'SINGLE_SERIES'
    requestedSeriesId: string
    source: 'postgres' | 'macrobond' | null
    cacheStatus: 'hit' | 'miss' | 'partial' | 'stale' | 'db-unavailable' | 'unavailable'
  }
  preparationFailures: Partial<Record<ForecastTargetSemantics, string>>
  capabilities: ForecastVariantCapability[]
}

export type ExactForecastCapabilityInput = {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  modelId: UserFacingForecastModelId
}

export type ExactForecastCapabilityTrace = {
  sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY'
  sourceFrequencyLookupMs: number
  sourceFrequencyLookupExternalIo: boolean
  provenanceReadMs: number
  provenanceReadCount: number
  preparedVariantReadMs: number
  preparedVariantReadCount: number
  prepareCount: number
  modelFitCount: number
  exactUnsupportedFastPathTaken: boolean
  capabilityTotalMs: number
}

export type ExactForecastCapabilityResolution = {
  resolution: ForecastCapabilityResolution
  capability: ForecastVariantCapability | null
  trace: ExactForecastCapabilityTrace
}

type HistoricalSeriesResolution = {
  history: BenchmarkHistoricalSeriesResult
  marketDataSource: 'postgres' | 'macrobond'
  cacheStatus: 'hit' | 'miss' | 'partial' | 'stale' | 'db-unavailable'
}

type ForecastCapabilityServiceDependencies = {
  resolveHistoricalSeries: (seriesId: string, requestedRange: 'ALL') => Promise<HistoricalSeriesResolution>
  resolveProvenance: (
    seriesId: string,
    history: BenchmarkHistoricalSeriesResult,
  ) => Promise<readonly ForecastCapabilityProvenance[]>
  readPreparedVariants: (
    seriesId: string,
    history: BenchmarkHistoricalSeriesResult,
  ) => Promise<readonly ForecastPreparedVariant[]>
  now: () => Date
}

type TimedAsyncResult<T> = {
  value: T
  durationMs: number
}

const MONTHLY_MINIMUM_OBSERVATIONS = 36
const ROLLING_DAILY_MINIMUM_OBSERVATIONS = 60
export const MIN_BACKTEST_ORIGINS_POINT_METRICS = 24
export const MIN_EMPIRICAL_BAND_RESIDUALS = 30

const TARGET_BASIS_BY_SEMANTICS = {
  END_OF_PERIOD: 'END_OF_PERIOD',
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
  ROLLING_DAILY_POINT_IN_TIME: 'POINT_IN_TIME',
} as const

function resolveSemanticLawfulness(
  sourceFrequency: ForecastSourceFrequency | null,
  targetSemantics: ForecastTargetSemantics,
): ForecastSemanticLawfulness {
  if (sourceFrequency === 'DAILY') {
    return 'LAWFUL'
  }

  if (sourceFrequency) {
    return targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? 'NOT_LAWFUL'
      : 'LAWFUL_WITH_PROVENANCE'
  }

  return 'NOT_LAWFUL'
}

function resolveBusinessTarget(targetSemantics: ForecastTargetSemantics): ForecastBusinessTarget {
  if (targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') return 'DAILY'
  if (targetSemantics === 'MONTHLY_AVERAGE') return 'AVERAGE'
  return 'END_OF_PERIOD'
}

function resolveTargetCadence(
  sourceFrequency: ForecastSourceFrequency | null,
  targetSemantics: ForecastTargetSemantics,
): ForecastTargetCadence | null {
  if (!sourceFrequency) return null
  if (targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') return 'DAILY'
  if (sourceFrequency === 'DAILY' || sourceFrequency === 'MONTHLY') return 'MONTHLY'
  if (sourceFrequency === 'WEEKLY' && targetSemantics === 'END_OF_PERIOD') return 'MONTHLY'
  return sourceFrequency
}

function resolveHorizonSupport(
  targetCadence: ForecastTargetCadence | null,
  requestedHorizonSteps: number | undefined,
  horizonMonths: number | undefined,
) {
  if (requestedHorizonSteps !== undefined && horizonMonths !== undefined) {
    throw new Error('Forecast capability horizon must use either native steps or legacy calendar months, not both.')
  }
  if (requestedHorizonSteps !== undefined) {
    if (!Number.isInteger(requestedHorizonSteps) || requestedHorizonSteps < 1 || !targetCadence) {
      return { state: 'UNSUPPORTED' as const, horizonMonths: null, horizonSteps: null }
    }
    return { state: 'SUPPORTED' as const, horizonMonths: null, horizonSteps: requestedHorizonSteps }
  }
  if (horizonMonths === undefined) {
    return { state: 'NOT_REQUESTED' as const, horizonMonths: null, horizonSteps: null }
  }
  if (!targetCadence) {
    return { state: 'UNSUPPORTED' as const, horizonMonths, horizonSteps: null }
  }

  const horizonSteps = mapLegacyCalendarMonthHorizonToNativeSteps(targetCadence, horizonMonths)
  return horizonSteps === null
    ? { state: 'UNSUPPORTED' as const, horizonMonths, horizonSteps: null }
    : { state: 'SUPPORTED' as const, horizonMonths, horizonSteps }
}

function resolveVerificationEvidenceState(count: number): ForecastVerificationEvidenceState {
  if (count === 0) return 'NOT_AVAILABLE'
  return count < MIN_BACKTEST_ORIGINS_POINT_METRICS ? 'LIMITED_SAMPLE' : 'SUFFICIENT'
}

function resolvePredictionBandState(count: number): ForecastPredictionBandEvidenceState {
  if (count === 0) return 'NOT_AVAILABLE'
  return count < MIN_EMPIRICAL_BAND_RESIDUALS ? 'INSUFFICIENT_SAMPLE' : 'AVAILABLE'
}

function findProvenance(
  input: ForecastCapabilityResolverInput,
  targetSemantics: ForecastTargetSemantics,
) {
  return input.provenance.find((candidate) => (
    candidate.targetSemantics === targetSemantics
    && candidate.sourceFrequency === input.sourceFrequency
  ))?.preparation
}

function hasRequiredProvenance(
  input: ForecastCapabilityResolverInput,
  targetSemantics: ForecastTargetSemantics,
) {
  const candidate = input.provenance.find((item) => (
    item.targetSemantics === targetSemantics
    && item.sourceFrequency === input.sourceFrequency
  ))

  if (
    !candidate
    || candidate.preparation.provenanceStatus !== 'PROVEN'
    || !candidate.preparation.method
    || !candidate.preparation.version
    || !candidate.sourceLineage
    || !candidate.closedPeriod
  ) {
    return false
  }

  if (targetSemantics === 'END_OF_PERIOD') {
    return candidate.levelAtTimestamp === true && candidate.exactSourceObservedAt === true
  }

  if (targetSemantics === 'MONTHLY_AVERAGE') {
    return candidate.aggregation === 'ARITHMETIC_MEAN'
      && candidate.underlyingObservationFrequency !== null
      && candidate.missingObservationPolicy !== null
      && candidate.syntheticObservations === false
  }

  return false
}

function resolveAdmissionState(
  input: ForecastCapabilityResolverInput,
  targetSemantics: ForecastTargetSemantics,
  semanticLawfulness: ForecastSemanticLawfulness,
): ForecastAdmissionState {
  if (semanticLawfulness === 'NOT_LAWFUL') {
    return 'NOT_LAWFUL'
  }

  if (semanticLawfulness === 'LAWFUL_WITH_PROVENANCE' && !hasRequiredProvenance(input, targetSemantics)) {
    return 'PROVENANCE_REQUIRED'
  }

  return 'ADMITTED'
}

function resolveImplementationState(
  sourceFrequency: ForecastSourceFrequency | null,
  targetSemantics: ForecastTargetSemantics,
  semanticLawfulness: ForecastSemanticLawfulness,
): ForecastImplementationState {
  if (semanticLawfulness === 'NOT_LAWFUL') {
    return 'NOT_APPLICABLE'
  }

  if (sourceFrequency === 'DAILY') {
    return 'SUPPORTED'
  }

  if (sourceFrequency === 'WEEKLY' && targetSemantics === 'END_OF_PERIOD') {
    return 'SUPPORTED'
  }

  if (
    sourceFrequency === 'MONTHLY'
    && (targetSemantics === 'END_OF_PERIOD' || targetSemantics === 'MONTHLY_AVERAGE')
  ) {
    return 'SUPPORTED'
  }

  if (
    isForecastExecutableNativeSparseFrequency(sourceFrequency)
    && (targetSemantics === 'END_OF_PERIOD' || targetSemantics === 'MONTHLY_AVERAGE')
  ) {
    return 'SUPPORTED'
  }

  return 'NOT_IMPLEMENTED'
}

function resolvePreparedVariant(
  input: ForecastCapabilityResolverInput,
  identity: ForecastIdentity,
): ForecastPreparedVariant | undefined {
  return input.preparedVariants.find((candidate) => (
    candidate.identity.seriesId === identity.seriesId
    && candidate.identity.targetSemantics === identity.targetSemantics
    && candidate.identity.methodId === identity.methodId
    && candidate.identity.methodVersion === identity.methodVersion
    && candidate.identity.modelId === identity.modelId
  ))
}

function resolveCapabilityState(input: {
  admissionState: ForecastAdmissionState
  implementationState: ForecastImplementationState
  historyEligibility: ForecastHistoryEligibilityState
  targetPreparationState: ForecastTargetPreparationState
  currentPreparedState: ForecastPreparedState
  historicalPreparedState: ForecastPreparedState
}): ForecastCapabilityResolutionState {
  if (input.admissionState !== 'ADMITTED') {
    return input.admissionState
  }

  if (input.implementationState !== 'SUPPORTED') {
    return 'NOT_IMPLEMENTED'
  }

  if (input.historyEligibility !== 'ELIGIBLE') {
    return input.historyEligibility
  }

  if (input.targetPreparationState !== 'PREPARED') {
    return 'PREPARATION_REQUIRED'
  }

  if (input.currentPreparedState === 'STALE' || input.historicalPreparedState === 'STALE') {
    return 'STALE'
  }

  if (input.currentPreparedState !== 'READY' || input.historicalPreparedState !== 'READY') {
    return 'NOT_PREPARED'
  }

  return 'AVAILABLE'
}

function resolveVariant(
  input: ForecastCapabilityResolverInput,
  targetSemantics: ForecastTargetSemantics,
  modelId: UserFacingForecastModelId,
): ForecastVariantCapability {
  const identity = createForecastIdentity({
    seriesId: input.seriesId,
    targetBasis: TARGET_BASIS_BY_SEMANTICS[targetSemantics],
    modelId,
  })
  const semanticLawfulness = resolveSemanticLawfulness(input.sourceFrequency, targetSemantics)
  const businessTarget = resolveBusinessTarget(targetSemantics)
  const targetCadence = resolveTargetCadence(input.sourceFrequency, targetSemantics)
  const horizon = resolveHorizonSupport(targetCadence, input.horizonSteps, input.horizonMonths)
  const admissionState = resolveAdmissionState(input, targetSemantics, semanticLawfulness)
  const provenance = findProvenance(input, targetSemantics)
  const provenanceStatus = semanticLawfulness === 'LAWFUL_WITH_PROVENANCE'
    ? provenance?.provenanceStatus ?? 'LEGACY_UNRESOLVED'
    : 'NOT_REQUIRED'
  const implementationState = resolveImplementationState(input.sourceFrequency, targetSemantics, semanticLawfulness)
  const isRollingDaily = targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
  const minimumRequiredObservations = isRollingDaily
    ? ROLLING_DAILY_MINIMUM_OBSERVATIONS
    : MONTHLY_MINIMUM_OBSERVATIONS
  const availableObservations = isRollingDaily || targetCadence === input.sourceFrequency
    ? input.sourceObservationCount
    : input.preparedObservationCounts[targetSemantics] ?? 0
  const historyEligibility: ForecastHistoryEligibilityState = availableObservations === 0
    ? 'DATA_NOT_AVAILABLE'
    : availableObservations < minimumRequiredObservations
      ? 'INSUFFICIENT_HISTORY'
      : 'ELIGIBLE'
  const modelEligible = historyEligibility === 'ELIGIBLE'
  const currentForecastEligible = admissionState === 'ADMITTED'
    && implementationState === 'SUPPORTED'
    && modelEligible
    && horizon.state !== 'UNSUPPORTED'
  const verificationOriginCount = input.verificationOriginCounts?.[targetSemantics] ?? 0
  const predictionBandResidualCount = input.predictionBandResidualCounts?.[targetSemantics] ?? 0
  const targetPreparationState: ForecastTargetPreparationState = admissionState !== 'ADMITTED' || implementationState !== 'SUPPORTED'
    ? 'NOT_SUPPORTED'
    : availableObservations > 0
      ? 'PREPARED'
      : 'PREPARATION_REQUIRED'
  const prepared = admissionState === 'ADMITTED' ? resolvePreparedVariant(input, identity) : undefined
  const currentPreparedState = prepared?.current ?? 'NOT_PREPARED'
  const historicalPreparedState = prepared?.historical ?? 'NOT_PREPARED'
  const capabilityState = resolveCapabilityState({
    admissionState,
    implementationState,
    historyEligibility,
    targetPreparationState,
    currentPreparedState,
    historicalPreparedState,
  })

  return {
    identity,
    sourceFrequency: input.sourceFrequency,
    sourceFrequencyRecognized: input.sourceFrequency !== null,
    businessTarget,
    targetCadence,
    targetSemanticsSupported: semanticLawfulness !== 'NOT_LAWFUL',
    horizonSupportState: horizon.state,
    horizonMonths: horizon.horizonMonths,
    horizonSteps: horizon.horizonSteps,
    semanticLawfulness,
    admissionState,
    provenanceStatus,
    implementationState,
    historyEligibility,
    minimumRequiredObservations,
    availableObservations,
    modelEligible,
    currentForecastEligible,
    verificationOriginCount,
    verificationEvidenceState: resolveVerificationEvidenceState(verificationOriginCount),
    predictionBandResidualCount,
    predictionBandState: resolvePredictionBandState(predictionBandResidualCount),
    targetPreparationState,
    currentPreparedState,
    historicalPreparedState,
    capabilityState,
  }
}

export function resolveForecastCapabilities(
  input: ForecastCapabilityResolverInput,
): ForecastVariantCapability[] {
  const targetSemantics: ForecastTargetSemantics[] = [
    'END_OF_PERIOD',
    'MONTHLY_AVERAGE',
    'ROLLING_DAILY_POINT_IN_TIME',
  ]

  return targetSemantics.flatMap((target) => (
    USER_FACING_FORECAST_MODELS.map((modelId) => resolveVariant(input, target, modelId))
  ))
}

function countLawfulSourceObservations(history: BenchmarkHistoricalSeriesResult) {
  return history.historical.filter((point) => point.value !== null && Number.isFinite(point.value)).length
}

function countLatestContiguousMonthlyObservations(points: Array<{ date: string; value: number; sourceObservedAt: string | null }>) {
  return selectLatestContiguousMonthlySuffix(points).length
}

function failedCapabilityResolution(seriesId: string, reason: string): ForecastCapabilityResolution {
  return {
    status: 'FAILED',
    reason,
    sourceMetadata: {
      seriesId,
      providerCode: null,
      source: null,
      sourceFrequency: null,
      rawFrequency: null,
      sourceObservationCount: null,
      fullHistoryObservationCount: null,
    },
    targetedHydration: {
      scope: 'SINGLE_SERIES',
      requestedSeriesId: seriesId,
      source: null,
      cacheStatus: 'unavailable',
    },
    preparationFailures: {},
    capabilities: [],
  }
}

function buildCapabilityResolution(
  seriesId: string,
  resolution: HistoricalSeriesResolution,
  history: BenchmarkHistoricalSeriesResult,
  sourceFrequency: ForecastSourceFrequency,
  sourceObservationCount: number,
  preparationFailures: ForecastCapabilityResolution['preparationFailures'],
  capabilities: ForecastVariantCapability[],
): ForecastCapabilityResolution {
  return {
    status: 'AVAILABLE',
    reason: null,
    sourceMetadata: {
      seriesId,
      providerCode: history.providerSeries.provider.providerCode,
      source: history.source,
      sourceFrequency,
      rawFrequency: history.frequency,
      sourceObservationCount,
      fullHistoryObservationCount: history.historical.length,
    },
    targetedHydration: {
      scope: 'SINGLE_SERIES',
      requestedSeriesId: seriesId,
      source: resolution.marketDataSource,
      cacheStatus: resolution.cacheStatus,
    },
    preparationFailures,
    capabilities,
  }
}

async function measureAsync<T>(operation: () => Promise<T>): Promise<TimedAsyncResult<T>> {
  const startedAtMs = Date.now()
  const value = await operation()
  return {
    value,
    durationMs: Math.max(0, Date.now() - startedAtMs),
  }
}

export function createForecastCapabilityService(
  dependencies: Partial<ForecastCapabilityServiceDependencies> = {},
) {
  const resolvedDependencies: ForecastCapabilityServiceDependencies = {
    resolveHistoricalSeries: dependencies.resolveHistoricalSeries ?? resolveBenchmarkHistoricalSeries,
    resolveProvenance: dependencies.resolveProvenance ?? resolveMacrobondForecastProvenance,
    readPreparedVariants: dependencies.readPreparedVariants ?? ((seriesId, history) => (
      readForecastPreparedVariants(seriesId, history)
    )),
    now: dependencies.now ?? (() => new Date()),
  }

  return {
    async resolveBySeriesId(seriesId: string): Promise<ForecastCapabilityResolution> {
      let resolution: HistoricalSeriesResolution
      try {
        resolution = await resolvedDependencies.resolveHistoricalSeries(seriesId, 'ALL')
      } catch (error) {
        return failedCapabilityResolution(
          seriesId,
          error instanceof Error ? error.message : String(error),
        )
      }

      const history = resolution.history
      if (history.providerSeries.providerSeriesId !== seriesId) {
        return failedCapabilityResolution(seriesId, `Forecast capability source identity mismatch for ${seriesId}.`)
      }

      const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
      if (!sourceFrequency) {
        return failedCapabilityResolution(
          seriesId,
          `Forecast capability source frequency is unavailable or unsupported for ${seriesId}.`,
        )
      }

      const sourceObservationCount = countLawfulSourceObservations(history)
      const preparedObservationCounts: ForecastCapabilityResolverInput['preparedObservationCounts'] = {}
      const preparationFailures: ForecastCapabilityResolution['preparationFailures'] = {}
      let provenance: readonly ForecastCapabilityProvenance[]
      let preparedVariants: readonly ForecastPreparedVariant[]
      try {
        [provenance, preparedVariants] = await Promise.all([
          sourceFrequency !== 'DAILY'
            ? resolvedDependencies.resolveProvenance(seriesId, history)
            : Promise.resolve([]),
          resolvedDependencies.readPreparedVariants(seriesId, history),
        ])
      } catch (error) {
        return failedCapabilityResolution(
          seriesId,
          error instanceof Error ? error.message : String(error),
        )
      }
      const admissionInput: ForecastCapabilityResolverInput = {
        seriesId,
        sourceFrequency,
        sourceObservationCount,
        preparedObservationCounts,
        provenance,
        preparedVariants,
      }

      if (sourceFrequency === 'DAILY') {
        try {
          preparedObservationCounts.END_OF_PERIOD = canonicalizeDailyMarketPriceToEndOfPeriod(history, {
            now: resolvedDependencies.now(),
          }).historical.length
        } catch (error) {
          preparationFailures.END_OF_PERIOD = error instanceof Error ? error.message : String(error)
        }

        try {
          preparedObservationCounts.MONTHLY_AVERAGE = canonicalizeDailyMarketPriceToMonthly(history, {
            now: resolvedDependencies.now(),
          }).historical.length
        } catch (error) {
          preparationFailures.MONTHLY_AVERAGE = error instanceof Error ? error.message : String(error)
        }

        preparedObservationCounts.ROLLING_DAILY_POINT_IN_TIME = sourceObservationCount
      }

      if (
        sourceFrequency === 'WEEKLY'
        && hasRequiredProvenance(admissionInput, 'END_OF_PERIOD')
      ) {
        try {
          preparedObservationCounts.END_OF_PERIOD = canonicalizeProvenanceQualifiedWeeklyEndOfPeriod(history, {
            now: resolvedDependencies.now(),
          }).historical.length
        } catch (error) {
          preparationFailures.END_OF_PERIOD = error instanceof Error ? error.message : String(error)
        }
      }

      if (sourceFrequency === 'MONTHLY') {
        for (const targetSemantics of ['END_OF_PERIOD', 'MONTHLY_AVERAGE'] as const) {
          if (!hasRequiredProvenance(admissionInput, targetSemantics)) {
            continue
          }

          try {
            preparedObservationCounts[targetSemantics] = canonicalizeProvenanceQualifiedNativeMonthly(
              history,
              targetSemantics,
              { now: resolvedDependencies.now() },
            ).historical.length
          } catch (error) {
            preparationFailures[targetSemantics] = error instanceof Error ? error.message : String(error)
          }
        }
      }


      if (isForecastExecutableNativeSparseFrequency(sourceFrequency)) {
        for (const targetSemantics of ['END_OF_PERIOD', 'MONTHLY_AVERAGE'] as const) {
          if (!hasRequiredProvenance(admissionInput, targetSemantics)) {
            continue
          }

          try {
            preparedObservationCounts[targetSemantics] = canonicalizeProvenanceQualifiedNativePeriod(
              history,
              targetSemantics,
              sourceFrequency,
              { now: resolvedDependencies.now() },
            ).historical.length
          } catch (error) {
            preparationFailures[targetSemantics] = error instanceof Error ? error.message : String(error)
          }
        }
      }

      return buildCapabilityResolution(
        seriesId,
        resolution,
        history,
        sourceFrequency,
        sourceObservationCount,
        preparationFailures,
        resolveForecastCapabilities({
          seriesId,
          sourceFrequency,
          sourceObservationCount,
          preparedObservationCounts,
          provenance,
          preparedVariants,
        }),
      )
    },

    async resolveExact(input: ExactForecastCapabilityInput): Promise<ExactForecastCapabilityResolution> {
      const capabilityStartedAtMs = Date.now()
      let sourceFrequencyLookupMs = 0
      let resolution: HistoricalSeriesResolution
      try {
        const historicalSeries = await measureAsync(() => resolvedDependencies.resolveHistoricalSeries(input.seriesId, 'ALL'))
        resolution = historicalSeries.value
        sourceFrequencyLookupMs = historicalSeries.durationMs
      } catch (error) {
        return {
          resolution: failedCapabilityResolution(
            input.seriesId,
            error instanceof Error ? error.message : String(error),
          ),
          capability: null,
          trace: {
            sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
            sourceFrequencyLookupMs,
            sourceFrequencyLookupExternalIo: true,
            provenanceReadMs: 0,
            provenanceReadCount: 0,
            preparedVariantReadMs: 0,
            preparedVariantReadCount: 0,
            prepareCount: 0,
            modelFitCount: 0,
            exactUnsupportedFastPathTaken: false,
            capabilityTotalMs: Math.max(0, Date.now() - capabilityStartedAtMs),
          },
        }
      }

      const history = resolution.history
      if (history.providerSeries.providerSeriesId !== input.seriesId) {
        return {
          resolution: failedCapabilityResolution(input.seriesId, `Forecast capability source identity mismatch for ${input.seriesId}.`),
          capability: null,
          trace: {
            sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
            sourceFrequencyLookupMs,
            sourceFrequencyLookupExternalIo: true,
            provenanceReadMs: 0,
            provenanceReadCount: 0,
            preparedVariantReadMs: 0,
            preparedVariantReadCount: 0,
            prepareCount: 0,
            modelFitCount: 0,
            exactUnsupportedFastPathTaken: false,
            capabilityTotalMs: Math.max(0, Date.now() - capabilityStartedAtMs),
          },
        }
      }

      const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
      if (!sourceFrequency) {
        return {
          resolution: failedCapabilityResolution(
            input.seriesId,
            `Forecast capability source frequency is unavailable or unsupported for ${input.seriesId}.`,
          ),
          capability: null,
          trace: {
            sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
            sourceFrequencyLookupMs,
            sourceFrequencyLookupExternalIo: true,
            provenanceReadMs: 0,
            provenanceReadCount: 0,
            preparedVariantReadMs: 0,
            preparedVariantReadCount: 0,
            prepareCount: 0,
            modelFitCount: 0,
            exactUnsupportedFastPathTaken: false,
            capabilityTotalMs: Math.max(0, Date.now() - capabilityStartedAtMs),
          },
        }
      }

      const sourceObservationCount = countLawfulSourceObservations(history)

      if (input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME' && sourceFrequency !== 'DAILY') {
        const capability = resolveVariant({
          seriesId: input.seriesId,
          sourceFrequency,
          sourceObservationCount,
          preparedObservationCounts: {},
          provenance: [],
          preparedVariants: [],
        }, input.targetSemantics, input.modelId)

        return {
          resolution: buildCapabilityResolution(
            input.seriesId,
            resolution,
            history,
            sourceFrequency,
            sourceObservationCount,
            {},
            [capability],
          ),
          capability,
          trace: {
            sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
            sourceFrequencyLookupMs,
            sourceFrequencyLookupExternalIo: true,
            provenanceReadMs: 0,
            provenanceReadCount: 0,
            preparedVariantReadMs: 0,
            preparedVariantReadCount: 0,
            prepareCount: 0,
            modelFitCount: 0,
            exactUnsupportedFastPathTaken: true,
            capabilityTotalMs: Math.max(0, Date.now() - capabilityStartedAtMs),
          },
        }
      }

      const preparedObservationCounts: ForecastCapabilityResolverInput['preparedObservationCounts'] = {}
      const preparationFailures: ForecastCapabilityResolution['preparationFailures'] = {}
      let provenance: readonly ForecastCapabilityProvenance[]
      let preparedVariants: readonly ForecastPreparedVariant[]
      let provenanceReadMs = 0
      let preparedVariantReadMs = 0
      try {
        const [provenanceResult, preparedVariantResult] = await Promise.all([
          sourceFrequency !== 'DAILY'
            ? measureAsync(() => resolvedDependencies.resolveProvenance(input.seriesId, history))
            : Promise.resolve({ value: [] as readonly ForecastCapabilityProvenance[], durationMs: 0 }),
          measureAsync(() => resolvedDependencies.readPreparedVariants(input.seriesId, history)),
        ])
        provenance = provenanceResult.value
        preparedVariants = preparedVariantResult.value
        provenanceReadMs = provenanceResult.durationMs
        preparedVariantReadMs = preparedVariantResult.durationMs
      } catch (error) {
        return {
          resolution: failedCapabilityResolution(
            input.seriesId,
            error instanceof Error ? error.message : String(error),
          ),
          capability: null,
          trace: {
            sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
            sourceFrequencyLookupMs,
            sourceFrequencyLookupExternalIo: true,
            provenanceReadMs,
            provenanceReadCount: sourceFrequency !== 'DAILY' ? 1 : 0,
            preparedVariantReadMs,
            preparedVariantReadCount: 1,
            prepareCount: 0,
            modelFitCount: 0,
            exactUnsupportedFastPathTaken: false,
            capabilityTotalMs: Math.max(0, Date.now() - capabilityStartedAtMs),
          },
        }
      }

      const admissionInput: ForecastCapabilityResolverInput = {
        seriesId: input.seriesId,
        sourceFrequency,
        sourceObservationCount,
        preparedObservationCounts,
        provenance,
        preparedVariants,
      }

      if (sourceFrequency === 'DAILY') {
        if (input.targetSemantics === 'END_OF_PERIOD') {
          try {
            preparedObservationCounts.END_OF_PERIOD = countLatestContiguousMonthlyObservations(canonicalizeDailyMarketPriceToEndOfPeriod(history, {
              now: resolvedDependencies.now(),
              continuityPolicy: 'ALLOW_GAPS',
            }).historical)
          } catch (error) {
            preparationFailures.END_OF_PERIOD = error instanceof Error ? error.message : String(error)
          }
        }

        if (input.targetSemantics === 'MONTHLY_AVERAGE') {
          try {
            preparedObservationCounts.MONTHLY_AVERAGE = countLatestContiguousMonthlyObservations(canonicalizeDailyMarketPriceToMonthly(history, {
              now: resolvedDependencies.now(),
              continuityPolicy: 'ALLOW_GAPS',
            }).historical)
          } catch (error) {
            preparationFailures.MONTHLY_AVERAGE = error instanceof Error ? error.message : String(error)
          }
        }

        if (input.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
          preparedObservationCounts.ROLLING_DAILY_POINT_IN_TIME = sourceObservationCount
        }
      }

      if (
        sourceFrequency === 'WEEKLY'
        && input.targetSemantics === 'END_OF_PERIOD'
        && hasRequiredProvenance(admissionInput, 'END_OF_PERIOD')
      ) {
        try {
          preparedObservationCounts.END_OF_PERIOD = countLatestContiguousMonthlyObservations(canonicalizeProvenanceQualifiedWeeklyEndOfPeriod(history, {
            now: resolvedDependencies.now(),
            continuityPolicy: 'ALLOW_GAPS',
          }).historical)
        } catch (error) {
          preparationFailures.END_OF_PERIOD = error instanceof Error ? error.message : String(error)
        }
      }

      if (
        sourceFrequency === 'MONTHLY'
        && input.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME'
        && hasRequiredProvenance(admissionInput, input.targetSemantics)
      ) {
        try {
          preparedObservationCounts[input.targetSemantics] = countLatestContiguousMonthlyObservations(canonicalizeProvenanceQualifiedNativeMonthly(
            history,
            input.targetSemantics,
            {
              now: resolvedDependencies.now(),
              continuityPolicy: 'ALLOW_GAPS',
            },
          ).historical)
        } catch (error) {
          preparationFailures[input.targetSemantics] = error instanceof Error ? error.message : String(error)
        }
      }

      if (
        isForecastExecutableNativeSparseFrequency(sourceFrequency)
        && input.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME'
        && hasRequiredProvenance(admissionInput, input.targetSemantics)
      ) {
        try {
          preparedObservationCounts[input.targetSemantics] = canonicalizeProvenanceQualifiedNativePeriod(
            history,
            input.targetSemantics,
            sourceFrequency,
            { now: resolvedDependencies.now() },
          ).historical.length
        } catch (error) {
          preparationFailures[input.targetSemantics] = error instanceof Error ? error.message : String(error)
        }
      }

      const capability = resolveVariant({
        seriesId: input.seriesId,
        sourceFrequency,
        sourceObservationCount,
        preparedObservationCounts,
        provenance,
        preparedVariants,
      }, input.targetSemantics, input.modelId)

      return {
        resolution: buildCapabilityResolution(
          input.seriesId,
          resolution,
          history,
          sourceFrequency,
          sourceObservationCount,
          preparationFailures,
          [capability],
        ),
        capability,
        trace: {
          sourceFrequencyAuthority: 'HISTORICAL_SERIES_FREQUENCY',
          sourceFrequencyLookupMs,
          sourceFrequencyLookupExternalIo: true,
          provenanceReadMs,
          provenanceReadCount: sourceFrequency !== 'DAILY' ? 1 : 0,
          preparedVariantReadMs,
          preparedVariantReadCount: 1,
          prepareCount: 0,
          modelFitCount: 0,
          exactUnsupportedFastPathTaken: false,
          capabilityTotalMs: Math.max(0, Date.now() - capabilityStartedAtMs),
        },
      }
    },
  }
}

const forecastCapabilityService = createForecastCapabilityService()

export async function resolveForecastCapabilitiesBySeriesId(seriesId: string) {
  return forecastCapabilityService.resolveBySeriesId(seriesId)
}

export async function resolveExactForecastCapability(input: ExactForecastCapabilityInput) {
  return forecastCapabilityService.resolveExact(input)
}