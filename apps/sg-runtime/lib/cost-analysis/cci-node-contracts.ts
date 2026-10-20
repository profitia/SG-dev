import type { CciComponentResult, CciIndex, CciInputSemantics, CciValidationCode, PercentChange } from './contracts'
import type { CciAlignedNode, CciCadence, CciNodeBasis, CciPeriodIdentity } from './market-data-contracts'

export interface CciNodeInputSemantics {
  readonly preparationPolicyId: string
  /** Declaration about supplied levels, not attestation of FX or economic suitability. */
  readonly currencyPolicy: CciInputSemantics['currencyPolicy']
}

export interface CciNodeInput {
  readonly modelKey: string
  readonly baseNodeStart: string
  readonly analysisCadence: CciCadence
  readonly nodeBasis: CciNodeBasis
  /** Explicit canonical UTC cutoff; period closure is not historical publication availability. */
  readonly cutoff: string
  readonly inputSemantics: CciNodeInputSemantics
  readonly components: readonly { readonly componentId: string; readonly weightPercent: number }[]
  /** Strict ascending order. All components must be present, with null for missing levels. */
  readonly nodes: readonly CciAlignedNode[]
}

export type CciPeriodChangeUnavailableReason =
  | 'NO_PREVIOUS_NODE' | 'CURRENT_NODE_INCOMPLETE' | 'PREVIOUS_NODE_INCOMPLETE' | 'NON_ADJACENT_PERIODS'

interface NodeResultIdentity {
  readonly period: CciPeriodIdentity
  readonly components: readonly CciComponentResult[]
}

export type CciNodeResult = NodeResultIdentity & (
  | { readonly status: 'COMPLETE'; readonly cci: CciIndex; readonly cumulativeChangePercent: PercentChange
      readonly periodOverPeriodChangePercent: PercentChange | null
      readonly periodOverPeriodUnavailableReason: Exclude<CciPeriodChangeUnavailableReason, 'CURRENT_NODE_INCOMPLETE'> | null
      readonly missingComponentIds: readonly [] }
  | { readonly status: 'INCOMPLETE'; readonly cci: null; readonly cumulativeChangePercent: null
      readonly periodOverPeriodChangePercent: null; readonly periodOverPeriodUnavailableReason: 'CURRENT_NODE_INCOMPLETE'
      readonly missingComponentIds: readonly string[] }
)

export interface CciNodesResult {
  readonly methodologyVersion: 'CCI_FIXED_BASE_NODES_V1'
  readonly outputSemantics: 'DIMENSIONLESS_BASE_100_INDEX'
  readonly modelKey: string
  readonly baseNode: CciPeriodIdentity
  readonly analysisCadence: CciCadence
  readonly nodeBasis: CciNodeBasis
  readonly cutoff: string
  readonly inputSemantics: CciNodeInputSemantics
  readonly components: CciNodeInput['components']
  /** INCOMPLETE also signals omitted calendar intervals; supplied complete nodes still have indices. */
  readonly status: 'COMPLETE' | 'INCOMPLETE'
  readonly nodes: readonly CciNodeResult[]
  /** Half-open ranges of absent expected periods; these are gaps, never synthetic observations. */
  readonly missingIntervals: readonly { readonly start: string; readonly endExclusive: string; readonly cadence: CciCadence }[]
}

export type CciNodeValidationCode = CciValidationCode
  | 'INVALID_CADENCE' | 'INVALID_NODE_BASIS' | 'INVALID_PERIOD_BOUNDARIES' | 'INVALID_PERIOD_ORDER'
  | 'OVERLAPPING_PERIODS' | 'CADENCE_MISMATCH' | 'UNCLOSED_PERIOD' | 'INVALID_NODE_COMPONENTS'
  | 'INCONSISTENT_NODE_STATUS' | 'MISSING_BASE_NODE' | 'INCOMPLETE_BASE_NODE'

export interface CciNodeValidationIssue {
  readonly code: CciNodeValidationCode
  readonly message: string
  readonly componentId?: string
  readonly period?: string
}
