import { CCI_WEIGHT_SUM_TOLERANCE, CciValidationError, sum, calculateFixedBaseComponent, calculateFixedBaseIndex, calculatePeriodChange } from './cci-math'
import type { CciAlignedNode, CciCadence, CciPeriodIdentity } from './market-data-contracts'
import type { CciNodeInput, CciNodeInputSemantics, CciNodeResult, CciNodesResult, CciNodeValidationCode, CciNodeValidationIssue } from './cci-node-contracts'
import type { PercentChange } from './contracts'

export class CciNodeValidationError extends Error {
  readonly issue: CciNodeValidationIssue
  constructor(issue: CciNodeValidationIssue) {
    super(issue.message)
    this.name = 'CciNodeValidationError'
    this.issue = Object.freeze({ ...issue })
  }
}

function invalid(code: CciNodeValidationCode, message: string, componentId?: string, period?: string): never {
  throw new CciNodeValidationError({ code, message, ...(componentId === undefined ? {} : { componentId }), ...(period === undefined ? {} : { period }) })
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

// Contract validation only. These steps neither align observations nor emit calendar nodes.
const calendarSteps: Record<CciCadence, { readonly unit: 'day' | 'month'; readonly count: number }> = {
  DAILY: { unit: 'day', count: 1 }, WEEKLY: { unit: 'day', count: 7 }, MONTHLY: { unit: 'month', count: 1 },
  BIMONTHLY: { unit: 'month', count: 2 }, QUARTERLY: { unit: 'month', count: 3 }, QUADMONTHLY: { unit: 'month', count: 4 },
  SEMIANNUAL: { unit: 'month', count: 6 }, ANNUAL: { unit: 'month', count: 12 },
}

function utcInstant(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return invalid('INVALID_PERIOD_BOUNDARIES', 'Canonical ISO UTC instants with milliseconds are required.')
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 100 || date.toISOString() !== value) {
    return invalid('INVALID_PERIOD_BOUNDARIES', 'Invalid or overflowing UTC calendar instant.')
  }
  return date
}

function validatePeriod(period: CciPeriodIdentity, cadence: CciCadence, cutoff: Date): void {
  if (!record(period)) invalid('INVALID_PERIOD_BOUNDARIES', 'Every node requires a canonical period.')
  if (period.cadence !== cadence) invalid('CADENCE_MISMATCH', 'All nodes must have the declared analysis cadence.')
  const start = utcInstant(period.start), end = utcInstant(period.endExclusive)
  if (!period.start.endsWith('T00:00:00.000Z') || !period.endExclusive.endsWith('T00:00:00.000Z')) {
    invalid('INVALID_PERIOD_BOUNDARIES', 'Economic period boundaries must be UTC midnight.')
  }
  const step = calendarSteps[cadence]
  if ((cadence === 'WEEKLY' && start.getUTCDay() !== 1)
    || (step.unit === 'month' && (start.getUTCDate() !== 1 || start.getUTCMonth() % step.count !== 0))) {
    invalid('INVALID_PERIOD_BOUNDARIES', 'Period start is not a canonical boundary of its declared cadence.')
  }
  const expectedEnd = new Date(start.getTime())
  if (step.unit === 'day') expectedEnd.setUTCDate(expectedEnd.getUTCDate() + step.count)
  else expectedEnd.setUTCMonth(expectedEnd.getUTCMonth() + step.count)
  if (expectedEnd.getTime() !== end.getTime()) invalid('INVALID_PERIOD_BOUNDARIES', 'Period end must match exactly one declared calendar period.')
  if (end > cutoff) invalid('UNCLOSED_PERIOD', 'Only periods closed by the explicit cutoff may enter the calculation.')
}

function copySemantics(value: CciNodeInputSemantics): CciNodeInputSemantics {
  if (!record(value) || !nonBlank(value.preparationPolicyId) || !record(value.currencyPolicy)) {
    return invalid('INVALID_INPUT_SEMANTICS', 'Explicit preparation and currency semantics are required.')
  }
  const policy = value.currencyPolicy
  if (policy.kind === 'NATIVE_CURRENCY_RELATIVES') return { preparationPolicyId: value.preparationPolicyId, currencyPolicy: { kind: policy.kind } }
  if (policy.kind === 'PRECONVERTED_COMMON_CURRENCY' && nonBlank(policy.currency) && nonBlank(policy.conversionPolicyId)) {
    return { preparationPolicyId: value.preparationPolicyId,
      currencyPolicy: { kind: policy.kind, currency: policy.currency, conversionPolicyId: policy.conversionPolicyId } }
  }
  return invalid('INVALID_INPUT_SEMANTICS', 'Currency semantics must describe native relatives or externally prepared converted levels.')
}

function validate(input: CciNodeInput) {
  if (!record(input) || !nonBlank(input.modelKey) || !Array.isArray(input.components) || !input.components.length || !Array.isArray(input.nodes) || !input.nodes.length) {
    return invalid('INVALID_MODEL', 'Model identity, components and supplied nodes are required.')
  }
  if (!Object.hasOwn(calendarSteps, input.analysisCadence)) invalid('INVALID_CADENCE', 'Unsupported analysis cadence.')
  if (!['POINT_IN_TIME', 'END_OF_PERIOD', 'PERIOD_AVERAGE'].includes(input.nodeBasis)) invalid('INVALID_NODE_BASIS', 'Explicit economic node basis is required.')
  const cutoff = utcInstant(input.cutoff)
  utcInstant(input.baseNodeStart)
  const inputSemantics = copySemantics(input.inputSemantics)
  const weights = new Map<string, number>()
  for (const c of input.components) {
    if (!record(c) || !nonBlank(c.componentId)) invalid('INVALID_COMPONENT_ID', 'Stable nonblank component IDs are required.')
    if (weights.has(c.componentId)) invalid('DUPLICATE_COMPONENT_ID', 'Duplicate component ID.', c.componentId)
    if (typeof c.weightPercent !== 'number' || !Number.isFinite(c.weightPercent) || c.weightPercent < 0) invalid('INVALID_WEIGHT', 'Weights must be finite nonnegative percentages.', c.componentId)
    weights.set(c.componentId, c.weightPercent)
  }
  const total = sum([...weights.values()])
  if (!Number.isFinite(total) || Math.abs(total - 100) > CCI_WEIGHT_SUM_TOLERANCE) invalid('INVALID_WEIGHT_SUM', 'Weights must sum to 100%; no renormalization is performed.')
  const components = [...weights].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([componentId, weightPercent]) => ({ componentId, weightPercent }))
  const missingIntervals: CciNodesResult['missingIntervals'][number][] = []
  let previous: CciAlignedNode | undefined
  for (const node of input.nodes) {
    if (!record(node)) invalid('INVALID_MODEL', 'Every supplied node must be an object.')
    validatePeriod(node.period, input.analysisCadence, cutoff)
    if (previous) {
      if (previous.period.start >= node.period.start) invalid('INVALID_PERIOD_ORDER', 'Nodes must be strictly ascending; the Core never silently sorts them.')
      if (previous.period.endExclusive > node.period.start) invalid('OVERLAPPING_PERIODS', 'Economic periods must not overlap.')
      if (previous.period.endExclusive < node.period.start) missingIntervals.push({ start: previous.period.endExclusive, endExclusive: node.period.start, cadence: input.analysisCadence })
    }
    if (!Array.isArray(node.components) || node.components.length !== components.length) invalid('INVALID_NODE_COMPONENTS', 'Each node must identify every declared component; missing levels are explicit nulls.')
    const seen = new Set<string>()
    let complete = true
    for (const c of node.components) {
      if (!record(c) || !weights.has(c.componentId) || seen.has(c.componentId) || weights.get(c.componentId) !== c.weightPercent) {
        invalid('INVALID_NODE_COMPONENTS', 'Node components must match unique declared identities and fixed weights.')
      }
      seen.add(c.componentId)
      if (c.value !== null && (typeof c.value !== 'number' || !Number.isFinite(c.value) || c.value <= 0)) invalid('INVALID_BENCHMARK_VALUE', 'Levels must be finite and strictly positive, or null.', c.componentId, node.period.start)
      const statusValid = c.weightPercent === 0 ? c.status === 'EXCLUDED_ZERO_WEIGHT'
        : c.value === null ? ['MISSING_OBSERVATION', 'INCOMPLETE_COVERAGE'].includes(c.status) : c.status === 'COMPLETE'
      if (!statusValid) invalid('INCONSISTENT_NODE_STATUS', 'Component status must agree with its supplied value and weight.', c.componentId, node.period.start)
      if (c.weightPercent > 0 && c.value === null) complete = false
    }
    if (node.status !== (complete ? 'COMPLETE' : 'INCOMPLETE')) invalid('INCONSISTENT_NODE_STATUS', 'Node completeness must agree with active component values.')
    previous = node
  }
  const base = input.nodes.find(node => node.period.start === input.baseNodeStart)
  if (!base) invalid('MISSING_BASE_NODE', 'The exact requested base node must be present; it is never moved.')
  if (base.status !== 'COMPLETE') invalid('INCOMPLETE_BASE_NODE', 'Every active component must have a valid base level.')
  return { inputSemantics, components, base, missingIntervals }
}

/** Fixed-base mathematics on supplied nodes only; no I/O, clock, alignment, reduction or new observations. */
export function calculateCciNodes(input: CciNodeInput): CciNodesResult {
  try {
    const { inputSemantics, components, base, missingIntervals } = validate(input)
    const bases = new Map(base.components.map(c => [c.componentId, c.value]))
    const nodes: CciNodeResult[] = []
    for (const node of input.nodes) {
      const values = new Map(node.components.map(c => [c.componentId, c.value]))
      const results = components.map(c => calculateFixedBaseComponent(c, values.get(c.componentId)!, bases.get(c.componentId)!, node.period.start))
      const missingComponentIds = results.filter(c => c.status === 'MISSING_OBSERVATION').map(c => c.componentId)
      const period = { ...node.period }
      if (missingComponentIds.length) {
        nodes.push({ period, status: 'INCOMPLETE', cci: null, cumulativeChangePercent: null, periodOverPeriodChangePercent: null,
          periodOverPeriodUnavailableReason: 'CURRENT_NODE_INCOMPLETE', missingComponentIds, components: results })
        continue
      }
      const cci = calculateFixedBaseIndex(results, node.period.start === input.baseNodeStart, node.period.start)
      const previous = nodes.at(-1)
      const reason = !previous ? 'NO_PREVIOUS_NODE'
        : previous.period.endExclusive !== period.start ? 'NON_ADJACENT_PERIODS'
        : previous.status === 'INCOMPLETE' ? 'PREVIOUS_NODE_INCOMPLETE' : null
      nodes.push({ period, status: 'COMPLETE', cci, cumulativeChangePercent: (cci - 100) as PercentChange,
        periodOverPeriodChangePercent: reason === null && previous?.status === 'COMPLETE' ? calculatePeriodChange(cci, previous.cci, period.start) : null,
        periodOverPeriodUnavailableReason: reason, missingComponentIds: [], components: results })
    }
    return { methodologyVersion: 'CCI_FIXED_BASE_NODES_V1', outputSemantics: 'DIMENSIONLESS_BASE_100_INDEX', modelKey: input.modelKey,
      baseNode: { ...base.period }, analysisCadence: input.analysisCadence, nodeBasis: input.nodeBasis, cutoff: input.cutoff, inputSemantics, components,
      status: missingIntervals.length || nodes.some(node => node.status === 'INCOMPLETE') ? 'INCOMPLETE' : 'COMPLETE', nodes, missingIntervals }
  } catch (error) {
    if (error instanceof CciValidationError) throw new CciNodeValidationError(error.issue)
    throw error
  }
}
