import { CCI_WEIGHT_SUM_TOLERANCE, sum } from './cci-math'
import type { CciNodesResult } from './cci-node-contracts'
import type { CciIndexedComponentPrice, CciIndexedPriceInput, CciIndexedPriceLimitation, CciIndexedPriceNode,
  CciIndexedPriceResult, CciIndexedPriceValidationCode, CciIndexedPriceValidationIssue, CciPurchasePriceAmount,
  CciPurchasePriceAnchor } from './cci-indexed-price-contracts'

/** IEEE-754 modelling, not ledger settlement. No rounding, residual allocation or decimal library.
 * Every nonzero monetary value must be normal and at most MAX_SAFE_INTEGER in magnitude.
 * Reconciliation uses 256 epsilons times the relevant gross price/allocation scale, including
 * cancellation around zero change and the existing Core's weight-sum tolerance. No absolute floor.
 */
export const CCI_PRICE_NUMERIC_POLICY = Object.freeze({
  relativeReconciliationTolerance: 256 * Number.EPSILON,
  minimumNonzeroMagnitude: 2 ** -1022,
  maximumMagnitude: Number.MAX_SAFE_INTEGER,
})

export class CciIndexedPriceValidationError extends Error {
  readonly issue: CciIndexedPriceValidationIssue
  constructor(issue: CciIndexedPriceValidationIssue) {
    super(issue.message)
    this.name = 'CciIndexedPriceValidationError'
    this.issue = Object.freeze({ ...issue })
  }
}
function invalid(code: CciIndexedPriceValidationCode, message: string, period?: string, componentId?: string): never {
  throw new CciIndexedPriceValidationError({ code, message, ...(period === undefined ? {} : { period }), ...(componentId === undefined ? {} : { componentId }) })
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value && !/\p{C}/u.test(value)
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function money(value: number, positive = false, period?: string, componentId?: string): CciPurchasePriceAmount {
  const magnitude = Math.abs(value)
  if (!finite(value) || (positive && value <= 0) || magnitude > CCI_PRICE_NUMERIC_POLICY.maximumMagnitude
    || (value !== 0 && magnitude < CCI_PRICE_NUMERIC_POLICY.minimumNonzeroMagnitude)) {
    invalid('NUMERIC_RANGE', 'Monetary arithmetic exceeded the supported normal, finite, safe-magnitude range.', period, componentId)
  }
  return (value === 0 ? 0 : value) as CciPurchasePriceAmount
}
function reconcile(left: number, right: number, scale: number, period?: string, componentId?: string): void {
  if (!finite(left) || !finite(right) || Math.abs(left - right) > scale * CCI_PRICE_NUMERIC_POLICY.relativeReconciliationTolerance) {
    invalid('RECONCILIATION_FAILED', 'Monetary decomposition does not reconcile with the authoritative CCI result.', period, componentId)
  }
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

function validateAnchor(price: CciPurchasePriceAnchor, calculation: CciNodesResult): void {
  if (!record(price) || !finite(price.amount) || price.amount <= 0) invalid('INVALID_PRICE', 'A finite positive historical purchase price is required.')
  money(price.amount, true)
  if (typeof price.currency !== 'string' || !/^[A-Z]{3}$/.test(price.currency)) invalid('INVALID_CURRENCY', 'Use a three-letter uppercase purchase currency code; codes are not catalogued or converted here.')
  if (!text(price.unit, 64)) invalid('INVALID_UNIT', 'An explicit, nonblank purchase unit is required.')
  if (!['NET', 'GROSS'].includes(price.taxBasis) || !record(price.deliveryBasis)
    || !(price.deliveryBasis.kind === 'UNKNOWN' || (price.deliveryBasis.kind === 'DECLARED' && text(price.deliveryBasis.description)))
    || price.modeledPriceScope !== 'FULL_PURCHASE_PRICE_ALLOCATED_TO_DECLARED_COMPONENTS') {
    invalid('INVALID_PRICE_ASSUMPTIONS', 'Explicit tax, delivery and full purchase-price allocation assumptions are required.')
  }
  if (price.referenceNodeStart !== calculation.baseNode.start) invalid('BASE_REFERENCE_MISMATCH', 'The price must reference exactly the existing CCI base; the base is never moved.')
  if (typeof price.purchaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(price.purchaseDate)) invalid('INVALID_PURCHASE_DATE', 'Use the actual civil purchase date YYYY-MM-DD.')
  const day = `${price.purchaseDate}T00:00:00.000Z`, date = new Date(day)
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 100 || date.toISOString() !== day) invalid('INVALID_PURCHASE_DATE', 'The purchase date is not a valid calendar day.')
  if (day < calculation.baseNode.start || day >= calculation.baseNode.endExclusive) invalid('PURCHASE_OUTSIDE_BASE_PERIOD', 'The actual purchase date must belong to the explicitly associated base period.')
  const mapping = price.periodMapping
  const exactDay = record(mapping) && mapping.kind === 'EXACT_PURCHASE_DAY' && calculation.analysisCadence === 'DAILY'
  const declaredPeriod = record(mapping) && mapping.kind === 'EXPLICIT_ECONOMIC_PERIOD' && text(mapping.policyId) && text(mapping.approvalRef)
    && mapping.interpretation === 'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE'
  if (!exactDay && !declaredPeriod) invalid('UNAPPROVED_PERIOD_MAPPING', 'Non-daily periods require an explicit caller-approved economic-period association and interpretation; no mapping is inferred.')
}

/** Checks the consumed result boundary, not provider histories or the Core's calendar/reduction algorithm. */
function validateCalculation(c: CciNodesResult): void {
  if (!record(c) || c.methodologyVersion !== 'CCI_FIXED_BASE_NODES_V1' || c.outputSemantics !== 'DIMENSIONLESS_BASE_100_INDEX'
    || !text(c.modelKey) || !record(c.baseNode) || c.baseNode.cadence !== c.analysisCadence
    || !record(c.inputSemantics) || !text(c.inputSemantics.preparationPolicyId) || !record(c.inputSemantics.currencyPolicy)
    || !Array.isArray(c.nodes) || !c.nodes.length || !Array.isArray(c.components) || !c.components.length || !Array.isArray(c.missingIntervals)) {
    invalid('INVALID_CCI_RESULT', 'An existing typed CCI Nodes Core result is required.')
  }
  const currency = c.inputSemantics.currencyPolicy
  if (!(currency.kind === 'NATIVE_CURRENCY_RELATIVES' || (currency.kind === 'PRECONVERTED_COMMON_CURRENCY' && text(currency.currency) && text(currency.conversionPolicyId)))) invalid('INVALID_CCI_RESULT', 'CCI currency semantics must remain explicit.')
  const ids = new Set<string>()
  for (const component of c.components) {
    if (!record(component) || !text(component.componentId) || ids.has(component.componentId) || !finite(component.weightPercent) || component.weightPercent < 0) invalid('INVALID_CCI_RESULT', 'Invalid CCI component identity or fixed weight.')
    ids.add(component.componentId)
  }
  if (Math.abs(sum(c.components.map(x => x.weightPercent)) - 100) > CCI_WEIGHT_SUM_TOLERANCE) invalid('INVALID_CCI_RESULT', 'The supplied fixed weights must already sum to 100%; no normalization occurs here.')
  const base = c.nodes.filter(n => n.period.start === c.baseNode.start)
  if (base.length !== 1 || base[0].status !== 'COMPLETE' || base[0].cci !== 100 || base[0].cumulativeChangePercent !== 0
    || base[0].period.endExclusive !== c.baseNode.endExclusive || base[0].period.cadence !== c.baseNode.cadence) invalid('INVALID_CCI_RESULT', 'A unique, complete base-100 CCI node is required.')
  for (const node of c.nodes) {
    if (!['COMPLETE', 'INCOMPLETE'].includes(node.status) || !Array.isArray(node.components) || node.components.length !== c.components.length || !Array.isArray(node.missingComponentIds)) invalid('INVALID_CCI_RESULT', 'Invalid CCI node status or component coverage.')
    for (const [i, component] of node.components.entries()) {
      const identity = c.components[i]
      if (component.componentId !== identity.componentId || component.weightPercent !== identity.weightPercent) invalid('INVALID_CCI_RESULT', 'CCI component ordering, identities and fixed weights must be preserved.')
      if (component.status === 'COMPLETE') {
        if (component.weightPercent === 0 || !finite(component.benchmarkRelative) || component.benchmarkRelative <= 0 || !finite(component.contributionPercentagePoints)
          || (node.period.start === c.baseNode.start && (component.benchmarkRelative !== 1 || component.contributionPercentagePoints !== 0))) invalid('INVALID_CCI_RESULT', 'Invalid authoritative relative or contribution.')
      } else if (component.status === 'EXCLUDED_ZERO_WEIGHT') {
        if (component.weightPercent !== 0 || component.benchmarkRelative !== null || component.contributionPercentagePoints !== 0) invalid('INVALID_CCI_RESULT', 'Zero-weight components must remain explicitly excluded.')
      } else if (component.status !== 'MISSING_OBSERVATION' || component.weightPercent <= 0 || component.benchmarkRelative !== null || component.contributionPercentagePoints !== null) invalid('INVALID_CCI_RESULT', 'Missing components require explicit null results.')
    }
    const sourceComponents: CciNodesResult['nodes'][number]['components'] = node.components
    const missing = sourceComponents.filter(x => x.status === 'MISSING_OBSERVATION').map(x => x.componentId)
    if (missing.length !== node.missingComponentIds.length || missing.some((id, i) => id !== node.missingComponentIds[i])
      || (missing.length > 0) !== (node.status === 'INCOMPLETE')) invalid('INVALID_CCI_RESULT', 'CCI completeness must agree with its explicit missing components.')
    if (node.status === 'COMPLETE' ? !finite(node.cci) || node.cci <= 0 || !finite(node.cumulativeChangePercent) : node.cci !== null || node.cumulativeChangePercent !== null) invalid('INVALID_CCI_RESULT', 'Unavailable CCI values must remain null; complete indices must be positive and finite.')
  }
  if (c.status !== (c.missingIntervals.length || c.nodes.some(n => n.status === 'INCOMPLETE') ? 'INCOMPLETE' : 'COMPLETE')) invalid('INVALID_CCI_RESULT', 'Model completeness must preserve missing nodes and intervals.')
}

/** Indexes an explicitly associated historical purchase price. No I/O, FX, clock or CCI recomputation. */
export function calculateCciIndexedPrice(input: CciIndexedPriceInput): CciIndexedPriceResult {
  if (!record(input)) invalid('INVALID_PRICE', 'A calculation and explicit purchase price anchor are required.')
  validateCalculation(input.calculation)
  validateAnchor(input.basePrice, input.calculation)
  // Never freeze or retain caller-owned data; the copy is provenance, not a provider vintage snapshot.
  const source = structuredClone(input.calculation), price = structuredClone(input.basePrice)
  const fxSemantics = source.inputSemantics.currencyPolicy.kind === 'NATIVE_CURRENCY_RELATIVES'
    ? 'NATIVE_CURRENCY_RELATIVES_NO_FX' : 'DECLARED_PRECONVERSION_NOT_VERIFIED'
  const limitations: CciIndexedPriceLimitation[] = ['MODELED_PURCHASE_PRICE_NOT_OBSERVED_MARKET_TRANSACTION',
    'ALLOCATED_PURCHASE_PRICE_NOT_INDEPENDENT_PRODUCTION_COST', 'HISTORICAL_PUBLICATION_AVAILABILITY_NOT_VERIFIED',
    'NO_IMMUTABLE_DATA_SNAPSHOT_ATTESTATION', fxSemantics,
    ...(price.periodMapping.kind === 'EXPLICIT_ECONOMIC_PERIOD' ? ['PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE' as const] : [])]
  const nodes: CciIndexedPriceNode[] = source.nodes.map(node => {
    const period = node.period.start
    const components: CciIndexedComponentPrice[] = node.components.map(component => {
      const { componentId, weightPercent } = component
      const baseAllocatedPrice = money(price.amount * (weightPercent / 100), weightPercent > 0, period, componentId)
      const identity = { componentId, weightPercent, baseAllocatedPrice }
      if (component.status === 'MISSING_OBSERVATION') return { ...identity, status: 'MISSING_OBSERVATION', benchmarkRelative: null,
        indexedComponentPrice: null, componentPriceChange: null, contributionPercentagePoints: null, contributionAmount: null }
      if (component.status === 'EXCLUDED_ZERO_WEIGHT') return { ...identity, status: 'EXCLUDED_ZERO_WEIGHT', benchmarkRelative: null,
        indexedComponentPrice: money(0), componentPriceChange: money(0), contributionPercentagePoints: component.contributionPercentagePoints, contributionAmount: money(0) }
      const indexedComponentPrice = money(baseAllocatedPrice * component.benchmarkRelative, true, period, componentId)
      const componentPriceChange = money(indexedComponentPrice - baseAllocatedPrice, false, period, componentId)
      const contributionAmount = money(price.amount * (component.contributionPercentagePoints / 100), false, period, componentId)
      // A nonzero source effect may not silently underflow to a zero monetary effect.
      if (component.contributionPercentagePoints !== 0 && contributionAmount === 0) invalid('NUMERIC_RANGE', 'A nonzero contribution underflowed.', period, componentId)
      reconcile(componentPriceChange, contributionAmount, Math.max(baseAllocatedPrice, indexedComponentPrice), period, componentId)
      return { ...identity, status: node.status === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL_NODE', benchmarkRelative: component.benchmarkRelative,
        indexedComponentPrice, componentPriceChange, contributionPercentagePoints: component.contributionPercentagePoints, contributionAmount }
    })
    const identity = { period: node.period, components, missingComponentIds: node.missingComponentIds }
    if (node.status === 'INCOMPLETE') return { ...identity, status: 'INCOMPLETE', cci: null, categoryIndexedPrice: null,
      categoryPriceChange: null, categoryPriceChangePercent: null, limitations: [...limitations, 'PARTIAL_COMPONENTS_NOT_A_CATEGORY_TOTAL'] }
    const categoryIndexedPrice = money(price.amount * (node.cci / 100), true, period)
    const categoryPriceChange = money(categoryIndexedPrice - price.amount, false, period)
    const scale = Math.max(price.amount, categoryIndexedPrice)
    reconcile(sum(components.map(c => c.indexedComponentPrice!)), categoryIndexedPrice, scale, period)
    reconcile(sum(components.map(c => c.componentPriceChange!)), categoryPriceChange, scale, period)
    return { ...identity, status: 'COMPLETE', cci: node.cci, categoryIndexedPrice, categoryPriceChange,
      categoryPriceChangePercent: node.cumulativeChangePercent, limitations }
  })
  return freeze({ methodologyId: 'CCI_INDEXED_PURCHASE_PRICE_V1', outputSemantics: 'MODELED_REFERENCE_PURCHASE_PRICE_PER_BUYER_UNIT',
    modelKey: source.modelKey, cciMethodologyVersion: source.methodologyVersion, preparationPolicyId: source.inputSemantics.preparationPolicyId,
    baseNode: source.baseNode, analysisCadence: source.analysisCadence, nodeBasis: source.nodeBasis, inputSemantics: source.inputSemantics,
    basePrice: price, currency: price.currency, unit: price.unit, taxBasis: price.taxBasis, deliveryBasis: price.deliveryBasis,
    fxSemantics, limitations, status: source.status, missingIntervals: source.missingIntervals, sourceCalculation: source, nodes })
}
