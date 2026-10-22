import type { CciIndex, PercentagePoints, PercentChange } from './contracts'
import type { CciNodesResult } from './cci-node-contracts'
import type { CciPeriodIdentity } from './market-data-contracts'

declare const moneyKind: unique symbol
/** Amount per purchase unit, in the buyer's declared currency; not a physical benchmark price. */
export type CciPurchasePriceAmount = number & { readonly [moneyKind]: 'MODELED_PURCHASE_PRICE_AMOUNT' }

export interface CciPurchasePriceAnchor {
  readonly amount: number
  /** Three uppercase letters, syntactically checked only; no currency catalogue or conversion. */
  readonly currency: string
  readonly unit: string
  /** Actual civil transaction date YYYY-MM-DD, checked against the explicitly selected UTC period. */
  readonly purchaseDate: string
  readonly referenceNodeStart: string
  readonly taxBasis: 'NET' | 'GROSS'
  readonly deliveryBasis: { readonly kind: 'UNKNOWN' } | { readonly kind: 'DECLARED'; readonly description: string }
  readonly modeledPriceScope: 'FULL_PURCHASE_PRICE_ALLOCATED_TO_DECLARED_COMPONENTS'
  /** Caller-approved association, never a request to find/shift a period or infer data availability. */
  readonly periodMapping:
    | { readonly kind: 'EXACT_PURCHASE_DAY' }
    | { readonly kind: 'EXPLICIT_ECONOMIC_PERIOD'; readonly policyId: string; readonly approvalRef: string
        readonly interpretation: 'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE' }
}

export interface CciIndexedPriceInput {
  /** Trusted in-process output of the existing Core; this layer is not an untrusted JSON deserializer. */
  readonly calculation: CciNodesResult
  readonly basePrice: CciPurchasePriceAnchor
}

export type CciIndexedPriceLimitation =
  | 'MODELED_PURCHASE_PRICE_NOT_OBSERVED_MARKET_TRANSACTION'
  | 'ALLOCATED_PURCHASE_PRICE_NOT_INDEPENDENT_PRODUCTION_COST'
  | 'HISTORICAL_PUBLICATION_AVAILABILITY_NOT_VERIFIED'
  | 'NO_IMMUTABLE_DATA_SNAPSHOT_ATTESTATION'
  | 'NATIVE_CURRENCY_RELATIVES_NO_FX'
  | 'DECLARED_PRECONVERSION_NOT_VERIFIED'
  | 'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE'
  | 'PARTIAL_COMPONENTS_NOT_A_CATEGORY_TOTAL'

interface ComponentIdentity {
  readonly componentId: string
  readonly weightPercent: number
  readonly baseAllocatedPrice: CciPurchasePriceAmount
}
export type CciIndexedComponentPrice = ComponentIdentity & (
  | { readonly status: 'COMPLETE' | 'PARTIAL_NODE'; readonly benchmarkRelative: number
      readonly indexedComponentPrice: CciPurchasePriceAmount; readonly componentPriceChange: CciPurchasePriceAmount
      readonly contributionPercentagePoints: PercentagePoints; readonly contributionAmount: CciPurchasePriceAmount }
  | { readonly status: 'MISSING_OBSERVATION'; readonly benchmarkRelative: null
      readonly indexedComponentPrice: null; readonly componentPriceChange: null
      readonly contributionPercentagePoints: null; readonly contributionAmount: null }
  | { readonly status: 'EXCLUDED_ZERO_WEIGHT'; readonly benchmarkRelative: null
      readonly indexedComponentPrice: CciPurchasePriceAmount; readonly componentPriceChange: CciPurchasePriceAmount
      readonly contributionPercentagePoints: PercentagePoints; readonly contributionAmount: CciPurchasePriceAmount }
)

interface NodeIdentity {
  readonly period: CciPeriodIdentity
  readonly components: readonly CciIndexedComponentPrice[]
  readonly missingComponentIds: readonly string[]
  readonly limitations: readonly CciIndexedPriceLimitation[]
}
export type CciIndexedPriceNode = NodeIdentity & (
  | { readonly status: 'COMPLETE'; readonly cci: CciIndex; readonly categoryIndexedPrice: CciPurchasePriceAmount
      readonly categoryPriceChange: CciPurchasePriceAmount; readonly categoryPriceChangePercent: PercentChange }
  | { readonly status: 'INCOMPLETE'; readonly cci: null; readonly categoryIndexedPrice: null
      readonly categoryPriceChange: null; readonly categoryPriceChangePercent: null }
)

export interface CciIndexedPriceResult {
  readonly methodologyId: 'CCI_INDEXED_PURCHASE_PRICE_V1'
  readonly outputSemantics: 'MODELED_REFERENCE_PURCHASE_PRICE_PER_BUYER_UNIT'
  readonly modelKey: string
  readonly cciMethodologyVersion: CciNodesResult['methodologyVersion']
  readonly preparationPolicyId: string
  readonly baseNode: CciPeriodIdentity
  readonly analysisCadence: CciNodesResult['analysisCadence']
  readonly nodeBasis: CciNodesResult['nodeBasis']
  readonly inputSemantics: CciNodesResult['inputSemantics']
  readonly basePrice: CciPurchasePriceAnchor
  readonly currency: string
  readonly unit: string
  readonly taxBasis: CciPurchasePriceAnchor['taxBasis']
  readonly deliveryBasis: CciPurchasePriceAnchor['deliveryBasis']
  readonly fxSemantics: 'NATIVE_CURRENCY_RELATIVES_NO_FX' | 'DECLARED_PRECONVERSION_NOT_VERIFIED'
  readonly limitations: readonly CciIndexedPriceLimitation[]
  readonly status: CciNodesResult['status']
  readonly missingIntervals: CciNodesResult['missingIntervals']
  readonly nodes: readonly CciIndexedPriceNode[]
  /** Owned, frozen copy of the authoritative result; no provider snapshot identity is manufactured. */
  readonly sourceCalculation: CciNodesResult
}

export type CciIndexedPriceValidationCode =
  | 'INVALID_PRICE' | 'INVALID_CURRENCY' | 'INVALID_UNIT' | 'INVALID_PURCHASE_DATE' | 'INVALID_PRICE_ASSUMPTIONS'
  | 'BASE_REFERENCE_MISMATCH' | 'UNAPPROVED_PERIOD_MAPPING' | 'PURCHASE_OUTSIDE_BASE_PERIOD'
  | 'INVALID_CCI_RESULT' | 'NUMERIC_RANGE' | 'RECONCILIATION_FAILED'

export interface CciIndexedPriceValidationIssue {
  readonly code: CciIndexedPriceValidationCode
  readonly message: string
  readonly period?: string
  readonly componentId?: string
}
