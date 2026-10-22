import type { BenchmarkHistoricalSeriesResult } from '../benchmark/contracts'
import type { ForecastNativeFrequency } from '../forecast/cadence'

export type CciCadence = ForecastNativeFrequency
export type CciNodeBasis = 'POINT_IN_TIME' | 'END_OF_PERIOD' | 'PERIOD_AVERAGE'

/** Declarations must come from reviewed series metadata/methodology, not inferred from numbers. */
export interface CciSeriesQualification {
  readonly valueKind: 'PRICE_LEVEL' | 'PRICE_INDEX'
  readonly periodBasis: CciNodeBasis
  readonly calendar: 'UTC_CALENDAR'
  readonly evidenceRef: string
}

export type CciReductionPolicy =
  | { readonly method: 'NATIVE_ONLY' }
  | { readonly method: 'END_OF_PERIOD' | 'OBSERVATION_AVERAGE'; readonly approvalRef: string }

export interface CciMarketComponent {
  readonly componentId: string
  readonly weightPercent: number
  readonly benchmarkSeriesId: string
  readonly history: BenchmarkHistoricalSeriesResult
  readonly qualification: CciSeriesQualification
  readonly reduction: CciReductionPolicy
  /** Retrieval and revision metadata are not publication dates or immutable vintages. */
  readonly snapshot: { readonly retrievedAt: string | null; readonly revisionRef: string | null }
}

export interface CciMarketDataRequest {
  readonly modelKey: string
  /** Exact requested canonical node start. Never silently moved to an available node. */
  readonly baseNodeStart: string
  readonly range: { readonly start: string; readonly endExclusive: string }
  readonly cutoff: string
  readonly availability: 'RETROSPECTIVE_CURRENT_HISTORY' | 'HISTORICAL_AS_OF'
  readonly alignmentPolicy: 'STRICT_COMMON_NODES'
  readonly analysisCadence?: CciCadence
  readonly nodeBasis: CciNodeBasis
  readonly currencyPolicy:
    | { readonly kind: 'NATIVE_CURRENCY_RELATIVES' }
    | { readonly kind: 'PRECONVERTED_COMMON_CURRENCY'; readonly currency: string; readonly conversionPolicyId: string }
  readonly components: readonly CciMarketComponent[]
}

export interface CciPeriodIdentity {
  readonly cadence: CciCadence
  readonly start: string
  readonly endExclusive: string
}

export interface CciPreparationMethod {
  readonly id: string
  readonly version: string
  readonly approvalRef: string
}

export interface CciSourceObservation {
  readonly originalDate: string
  readonly observedAt: string
  readonly period: CciPeriodIdentity | null
  readonly value: number | null
}

export interface CciAlignedComponentValue {
  readonly componentId: string
  readonly weightPercent: number
  readonly value: number | null
  readonly status: 'COMPLETE' | 'MISSING_OBSERVATION' | 'INCOMPLETE_COVERAGE' | 'EXCLUDED_ZERO_WEIGHT'
  readonly method: CciPreparationMethod | null
  readonly sourceDates: readonly string[]
  /** Daily trading calendars are not available here; approved daily reductions use supplied observations only. */
  readonly coverage: 'NATIVE_PERIOD' | 'ALL_NATIVE_PERIODS' | 'AVAILABLE_DAILY_OBSERVATIONS' | 'NONE'
}

export interface CciAlignedNode {
  readonly period: CciPeriodIdentity
  readonly status: 'COMPLETE' | 'INCOMPLETE'
  readonly components: readonly CciAlignedComponentValue[]
}

export interface CciPreparedSeries {
  readonly componentId: string
  readonly weightPercent: number
  readonly provider: string
  readonly seriesId: string
  readonly sourceFrequency: string | null
  readonly nativeCadence: CciCadence | null
  readonly currency: string | null
  readonly unit: string | null
  readonly source: string | null
  readonly qualification: CciSeriesQualification
  readonly preparationPolicy: CciReductionPolicy
  readonly snapshot: CciMarketComponent['snapshot']
  readonly sourceObservations: readonly CciSourceObservation[]
  readonly excludedOpenPeriodCount: number
  /** Existing forecast fingerprint of canonical native levels, not an immutable source-snapshot identifier. */
  readonly historyFingerprint: string | null
  readonly fingerprintScope: 'CANONICAL_NATIVE_LEVELS_NOT_IMMUTABLE_VINTAGE'
}

export type CciAlignmentIssueCode =
  | 'UNKNOWN_FREQUENCY' | 'UNSUPPORTED_CANONICALIZATION' | 'NO_COMPARABLE_CADENCE'
  | 'NO_COMPLETE_NODES' | 'MISSING_BASE_NODE' | 'BASE_NODE_NOT_ALIGNED'
  | 'HISTORICAL_AS_OF_UNSUPPORTED' | 'FX_CONVERSION_NOT_SUPPORTED'

export interface CciAlignmentIssue {
  readonly code: CciAlignmentIssueCode
  readonly message: string
  readonly componentId?: string
}

export interface CciAlignmentResult {
  readonly methodologyVersion: 'CCI_NATIVE_ALIGNMENT_V1'
  readonly modelKey: string
  readonly baseNodeStart: string
  readonly cutoff: string
  readonly range: { readonly start: string; readonly endExclusive: string }
  readonly availability: {
    readonly requested: CciMarketDataRequest['availability']
    readonly supported: 'RETROSPECTIVE_CURRENT_HISTORY_ONLY'
    readonly historicalPublicationDatesVerified: false
    readonly immutableVintagesVerified: false
  }
  readonly currencyStatus: 'NATIVE_RELATIVES_FX_NOT_APPLIED' | 'FX_CONVERSION_NOT_SUPPORTED'
  readonly analysisCadence: CciCadence | null
  readonly nodeBasis: CciNodeBasis
  readonly status: 'COMPLETE' | 'INCOMPLETE' | 'NOT_COMPARABLE' | 'UNSUPPORTED_CANONICALIZATION'
  readonly issues: readonly CciAlignmentIssue[]
  readonly series: readonly CciPreparedSeries[]
  readonly nodes: readonly CciAlignedNode[]
  readonly excludedAnalysisPeriods: readonly {
    readonly period: CciPeriodIdentity
    readonly reasons: readonly ('PARTIAL_ANALYSIS_RANGE' | 'OPEN_AT_CUTOFF')[]
  }[]
}
