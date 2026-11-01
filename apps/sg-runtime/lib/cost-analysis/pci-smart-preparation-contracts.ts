import { z } from 'zod'
import { pciAnalysisRequest } from './price-change-index-contracts'
import type { CciCadence, CciNodeBasis, CciPeriodIdentity } from './market-data-contracts'
import type { CciNodeInput, CciNodesResult } from './cci-node-contracts'
import type { CciIndexedPriceResult } from './cci-indexed-price-contracts'

/** A new consumer contract. The original journey/1.0.0 remains accepted unchanged. */
export const PCI_SMART_VERSION = 'sg2.price-change-index.smart/1.0.0' as const
export const PCI_PREPARATION_METHOD = 'PCI_SMART_PREPARATION_V1' as const
export const PCI_PROXY_LOOKBACK = 'THREE_FULL_CALENDAR_MONTHS_V1' as const
export const smartMethodSchema = z.object({
  componentId: z.string().min(1).max(128),
  valueKind: z.enum(['PRICE_LEVEL', 'PRICE_INDEX']).optional(),
  // Already-open Smart clients can send the select's empty placeholder. It is
  // an unanswered declaration, never approval or an invented observation basis.
  periodBasis: z.preprocess(value=>value===''?undefined:value,
    z.enum(['POINT_IN_TIME', 'END_OF_PERIOD', 'PERIOD_AVERAGE']).optional()),
  reduction: z.enum(['AUTO', 'NATIVE_VALUE', 'END_OF_PERIOD', 'AVAILABLE_OBSERVATION_AVERAGE']).default('AUTO'),
  verified: z.boolean().default(false),
}).strict()
export const pciSmartRequest = z.object({
  contractVersion: z.literal(PCI_SMART_VERSION),
  mode: z.enum(['PREPARE', 'ANALYSE']),
  locale: z.enum(['pl', 'en']).default('pl'),
  organisationId: pciAnalysisRequest.shape.organisationId,
  category: pciAnalysisRequest.shape.category,
  purchase: pciAnalysisRequest.shape.purchase.omit({ referenceDate: true, economicPeriodApproved: true }),
  declarations: z.array(smartMethodSchema).min(2).max(12),
  /** Deliberate discovery only; never extends automatic proxy recommendations. */
  olderYear: z.number().int().min(100).max(9999).optional(),
  reference: z.object({
    candidateId: z.string().min(1).max(128),
    preparationId: z.string().min(1).max(128),
    strictPeriodAccepted: z.boolean().default(false),
    proxyMarketOnlyAccepted: z.boolean().default(false),
  }).strict().optional(),
}).strict()
export const pciOperationRequest = z.discriminatedUnion('contractVersion', [pciAnalysisRequest, pciSmartRequest])
export type SmartPciRequest = z.infer<typeof pciSmartRequest>
export type SmartMethodDeclaration = z.infer<typeof smartMethodSchema>
export type SmartReferenceMode = 'STRICT_PURCHASE_REFERENCE' | 'EARLIER_MARKET_PROXY'
export type SmartQuality = 'QUALIFIED_COMPLETE' | 'QUALIFIED_PARTIAL_DISCLOSED' | 'INSUFFICIENT' | 'NOT_ASSESSED'
export interface SmartIssue {
  code: string; message: string; componentId?: string; period?: string
  /** A diagnostic outside the declared window remains visible but does not veto it. */
  usedInWindow?: boolean
}
export interface SmartComponentView {
  id: string; benchmark: string; seriesId: string; provider: string; weightPercent: number
  valueKind: 'PRICE_LEVEL' | 'PRICE_INDEX' | null; nativeCadence: CciCadence | null
  periodBasis: CciNodeBasis | null; evidence: readonly string[]; verificationRequired: boolean
  firstDate: string | null; lastDate: string | null; unit: string | null; currency: string | null
  historyFingerprint: string | null; sourceObservations: readonly {date:string;value:number|null}[]; sourceRevision:'UNAVAILABLE'; historicalPublicationAvailability:'UNKNOWN'; expectedObservations: 'UNKNOWN'; warnings: readonly SmartIssue[]
}
export interface SmartPreparedComponent {
  id: string; method: string; methodVersion: typeof PCI_PREPARATION_METHOD
  sourceBasis: CciNodeBasis | null; targetBasis: CciNodeBasis
  sourceDates: readonly string[]; sourceCount: number; expectedObservations: 'UNKNOWN'
  quality: SmartQuality; value: number | null; historyFingerprint: string | null
  issues: readonly SmartIssue[]
}
export interface SmartCandidate {
  id: string; mode: SmartReferenceMode; period: CciPeriodIdentity; basis: CciNodeBasis
  quality: Exclude<SmartQuality, 'INSUFFICIENT' | 'NOT_ASSESSED'>
  recommended: boolean; requiresApproval: boolean; olderExplicitSelection: boolean; lagDays: number
  canCalculateMarketIndex: true; canCalculateIndexedPrice: boolean
  analysisWindow: { start: string; endExclusive: string }
  components: readonly SmartPreparedComponent[]
}
export interface SmartPreparation {
  version: typeof PCI_PREPARATION_METHOD; id: string; purchaseDate: string; cutoff: string
  state: SmartReferenceMode | 'NO_QUALIFIED_REFERENCE' | 'VERIFICATION_REQUIRED'
  recommendedCandidateId: string | null; candidates: readonly SmartCandidate[]
  components: readonly SmartComponentView[]; issues: readonly SmartIssue[]
  historicalDiagnostics: readonly SmartIssue[]; availableYears: readonly number[]
  recommendationPolicy: typeof PCI_PROXY_LOOKBACK; recommendationStart: string
  analysisWindow: { start: string; endExclusive: string }
  limitations: readonly string[]
}
export interface SmartPreparedContext {
  candidate: SmartCandidate; input: CciNodeInput
  nodeProvenance: readonly { period: CciPeriodIdentity; components: readonly SmartPreparedComponent[] }[]
}
export interface SmartPrepared {
  preparation: SmartPreparation; contexts: ReadonlyMap<string, SmartPreparedContext>
}
export type SmartPciResponse = { contractVersion: typeof PCI_SMART_VERSION; preparation: SmartPreparation } & (
  | { status: 'PREPARED' }
  | { status: 'REFUSED'; issues: readonly SmartIssue[] }
  | { status: 'CALCULATED'; variant: 'STRICT_PURCHASE_REFERENCE'; calculation: CciNodesResult; indexedPrice: CciIndexedPriceResult; reference: SmartCandidate }
  | { status: 'PROXY_MARKET_ONLY'; variant: 'EARLIER_MARKET_PROXY'; calculation: CciNodesResult; reference: SmartCandidate
      comparisonStatus: 'COMPARISON_AVAILABLE' | 'NO_LATER_COMPARISON_POINT'
      purchaseContext: SmartPciRequest['purchase']; indexedPrice?: never }
)
