declare const quantityKind: unique symbol

/** Distinct numeric quantities: index points, percent changes and percentage points. */
export type CciIndex = number & { readonly [quantityKind]: 'CCI_INDEX' }
export type PercentChange = number & { readonly [quantityKind]: 'PERCENT_CHANGE' }
export type PercentagePoints = number & { readonly [quantityKind]: 'PERCENTAGE_POINTS' }

/** A validated calendar month, represented at the boundary as YYYY-MM. */
export type MonthlyPeriod = string

/**
 * The caller prepares comparable monthly levels before calling the core.
 * These declarations record that policy; the core cannot verify economic
 * suitability, FX provenance or the upstream aggregation from numbers alone.
 * Every output is dimensionless, including when inputs were converted to a
 * common currency. No currency amount is calculated here.
 */
export interface CciInputSemantics {
  readonly frequency: 'MONTHLY'
  readonly monthlyPreparationPolicyId: string
  readonly currencyPolicy:
    | { readonly kind: 'NATIVE_CURRENCY_RELATIVES' }
    | {
        readonly kind: 'PRECONVERTED_COMMON_CURRENCY'
        readonly currency: string
        readonly conversionPolicyId: string
      }
}

export interface CciObservation {
  readonly period: MonthlyPeriod
  /** Null is an explicitly missing observation, never a zero price. */
  readonly value: number | null
}

export interface CciComponentInput {
  readonly componentId: string
  /** Fixed base-period share; decimals and zero are supported. */
  readonly weightPercent: number
  readonly observations: readonly CciObservation[]
}

export interface CciInput {
  readonly basePeriod: MonthlyPeriod
  readonly inputSemantics: CciInputSemantics
  readonly components: readonly CciComponentInput[]
}

interface ComponentIdentity {
  readonly componentId: string
  readonly weightPercent: number
}

export type CciComponentResult = ComponentIdentity & (
  | {
      readonly status: 'COMPLETE'
      readonly benchmarkValue: number
      readonly benchmarkRelative: number
      readonly componentIndex: CciIndex
      readonly contributionPercentagePoints: PercentagePoints
    }
  | {
      readonly status: 'MISSING_OBSERVATION'
      readonly benchmarkValue: null
      readonly benchmarkRelative: null
      readonly componentIndex: null
      readonly contributionPercentagePoints: null
    }
  | {
      readonly status: 'EXCLUDED_ZERO_WEIGHT'
      readonly benchmarkValue: number | null
      readonly benchmarkRelative: null
      readonly componentIndex: null
      readonly contributionPercentagePoints: PercentagePoints
    }
)

interface MonthlyResultIdentity {
  readonly period: MonthlyPeriod
  readonly components: readonly CciComponentResult[]
}

export type CciMonthlyResult = MonthlyResultIdentity & (
  | {
      readonly status: 'COMPLETE'
      readonly cci: CciIndex
      readonly cumulativeChangePercent: PercentChange
      readonly monthOverMonthChangePercent: PercentChange | null
      readonly monthOverMonthUnavailableReason: 'BASE_PERIOD' | 'PREVIOUS_MONTH_INCOMPLETE' | null
      readonly missingComponentIds: readonly []
    }
  | {
      readonly status: 'INCOMPLETE'
      readonly cci: null
      readonly cumulativeChangePercent: null
      readonly monthOverMonthChangePercent: null
      readonly monthOverMonthUnavailableReason: 'CURRENT_MONTH_INCOMPLETE'
      readonly missingComponentIds: readonly string[]
    }
)

export interface CciResult {
  readonly methodologyVersion: 'CCI_FIXED_BASE_V1'
  readonly outputSemantics: 'DIMENSIONLESS_BASE_100_INDEX'
  readonly basePeriod: MonthlyPeriod
  readonly inputSemantics: CciInputSemantics
  readonly components: readonly ComponentIdentity[]
  readonly status: 'COMPLETE' | 'INCOMPLETE'
  readonly monthly: readonly CciMonthlyResult[]
}

export type CciValidationCode =
  | 'INVALID_MODEL'
  | 'INVALID_INPUT_SEMANTICS'
  | 'INVALID_PERIOD'
  | 'INVALID_COMPONENT_ID'
  | 'DUPLICATE_COMPONENT_ID'
  | 'INVALID_WEIGHT'
  | 'INVALID_WEIGHT_SUM'
  | 'INVALID_OBSERVATION'
  | 'DUPLICATE_PERIOD'
  | 'INVALID_BENCHMARK_VALUE'
  | 'MISSING_BASE_PERIOD'
  | 'NUMERIC_RANGE'

export interface CciValidationIssue {
  readonly code: CciValidationCode
  readonly message: string
  readonly componentId?: string
  readonly period?: MonthlyPeriod
}
