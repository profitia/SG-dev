import type {
  CciComponentInput,
  CciComponentResult,
  CciIndex,
  CciInput,
  CciInputSemantics,
  CciMonthlyResult,
  CciResult,
  CciValidationCode,
  CciValidationIssue,
  PercentChange,
  PercentagePoints,
} from './contracts'

/** Absolute tolerance in percentage points, approximately 64 ulps at 100. */
export const CCI_WEIGHT_SUM_TOLERANCE = 64 * Number.EPSILON * 100

export class CciValidationError extends Error {
  readonly issue: CciValidationIssue

  constructor(issue: CciValidationIssue) {
    super(issue.message)
    this.name = 'CciValidationError'
    this.issue = Object.freeze({ ...issue })
  }
}

function invalid(code: CciValidationCode, message: string, componentId?: string, period?: string): never {
  throw new CciValidationError({ code, message, ...(componentId === undefined ? {} : { componentId }), ...(period === undefined ? {} : { period }) })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function monthNumber(period: unknown): number {
  if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return invalid('INVALID_PERIOD', 'Periods must be calendar months in YYYY-MM format.')
  }
  return Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1
}

function monthLabel(month: number): string {
  return `${String(Math.floor(month / 12)).padStart(4, '0')}-${String(month % 12 + 1).padStart(2, '0')}`
}

function copySemantics(value: unknown): CciInputSemantics {
  if (!isRecord(value) || value.frequency !== 'MONTHLY' || !nonBlank(value.monthlyPreparationPolicyId) || !isRecord(value.currencyPolicy)) {
    return invalid('INVALID_INPUT_SEMANTICS', 'Explicit monthly preparation and currency policies are required.')
  }
  const policy = value.currencyPolicy
  if (policy.kind === 'NATIVE_CURRENCY_RELATIVES') {
    return { frequency: 'MONTHLY', monthlyPreparationPolicyId: value.monthlyPreparationPolicyId, currencyPolicy: { kind: policy.kind } }
  }
  if (policy.kind === 'PRECONVERTED_COMMON_CURRENCY' && nonBlank(policy.currency) && nonBlank(policy.conversionPolicyId)) {
    return { frequency: 'MONTHLY', monthlyPreparationPolicyId: value.monthlyPreparationPolicyId,
      currencyPolicy: { kind: policy.kind, currency: policy.currency, conversionPolicyId: policy.conversionPolicyId } }
  }
  return invalid('INVALID_INPUT_SEMANTICS', 'Currency policy must declare native relatives or already converted common-currency levels.')
}

/** Compensated addition preserves precision; it does not round or rescale weights. */
function sum(values: readonly number[]): number {
  let total = 0
  let correction = 0
  for (const value of values) {
    const next = total + value
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total
    total = next
  }
  return total + correction
}

function computed(value: number, positive: boolean, period: string, componentId?: string): number {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    return invalid('NUMERIC_RANGE', 'Calculation exceeds the supported finite numeric range.', componentId, period)
  }
  return value
}

type PreparedComponent = {
  componentId: string
  weightPercent: number
  values: Map<string, number | null>
  baseValue: number | null
}

function prepareComponents(input: CciInput, baseMonth: number): { components: PreparedComponent[]; lastMonth: number } {
  if (!Array.isArray(input.components) || input.components.length === 0) {
    return invalid('INVALID_MODEL', 'At least one component is required.')
  }
  const ids = new Set<string>()
  let lastMonth = baseMonth
  const components = input.components.map((component: CciComponentInput) => {
    if (!isRecord(component) || !nonBlank(component.componentId)) {
      return invalid('INVALID_COMPONENT_ID', 'Each component requires a non-blank stable identifier.')
    }
    const { componentId, weightPercent } = component
    if (ids.has(componentId)) return invalid('DUPLICATE_COMPONENT_ID', 'Component identifiers must be unique.', componentId)
    ids.add(componentId)
    if (typeof weightPercent !== 'number' || !Number.isFinite(weightPercent) || weightPercent < 0) {
      return invalid('INVALID_WEIGHT', 'Weights must be finite non-negative percentages.', componentId)
    }
    if (!Array.isArray(component.observations)) return invalid('INVALID_OBSERVATION', 'A monthly observation array is required.', componentId)
    const values = new Map<string, number | null>()
    for (const observation of component.observations) {
      if (!isRecord(observation)) return invalid('INVALID_OBSERVATION', 'Each observation must contain a period and a value.', componentId)
      const month = monthNumber(observation.period)
      const period = observation.period as string
      if (values.has(period)) return invalid('DUPLICATE_PERIOD', 'A component cannot have duplicate months.', componentId, period)
      const value = observation.value
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
        return invalid('INVALID_BENCHMARK_VALUE', 'Benchmark levels must be finite and strictly positive, or null for missing data.', componentId, period)
      }
      values.set(period, value as number | null)
      if (weightPercent > 0) lastMonth = Math.max(lastMonth, month)
    }
    const baseValue = values.get(input.basePeriod) ?? null
    if (weightPercent > 0 && baseValue === null) return invalid('MISSING_BASE_PERIOD', 'Every active component requires a non-missing base-period level.', componentId, input.basePeriod)
    return { componentId, weightPercent, values, baseValue }
  })
  const total = sum(components.map(component => component.weightPercent))
  if (!Number.isFinite(total) || Math.abs(total - 100) > CCI_WEIGHT_SUM_TOLERANCE) {
    return invalid('INVALID_WEIGHT_SUM', 'Component weights must sum to 100%; weights are never automatically normalized.')
  }
  // Code-point ordering, independent of the host locale or original input order.
  components.sort((left, right) => left.componentId < right.componentId ? -1 : left.componentId > right.componentId ? 1 : 0)
  return { components, lastMonth }
}

function componentResult(component: PreparedComponent, period: string): CciComponentResult {
  const identity = { componentId: component.componentId, weightPercent: component.weightPercent }
  const benchmarkValue = component.values.get(period) ?? null
  if (component.weightPercent === 0) {
    return { ...identity, status: 'EXCLUDED_ZERO_WEIGHT', benchmarkValue, benchmarkRelative: null,
      componentIndex: null, contributionPercentagePoints: 0 as PercentagePoints }
  }
  if (benchmarkValue === null) {
    return { ...identity, status: 'MISSING_OBSERVATION', benchmarkValue: null, benchmarkRelative: null,
      componentIndex: null, contributionPercentagePoints: null }
  }
  // prepareComponents has established a strictly positive base for active components.
  const relative = computed(benchmarkValue / component.baseValue!, true, period, component.componentId)
  return { ...identity, status: 'COMPLETE', benchmarkValue, benchmarkRelative: relative,
    componentIndex: computed(100 * relative, true, period, component.componentId) as CciIndex,
    contributionPercentagePoints: computed(component.weightPercent * (relative - 1), false, period, component.componentId) as PercentagePoints }
}

/**
 * Fixed base-weight CCI on prepared monthly levels, with no I/O or hidden clock.
 * The output covers every month from basePeriod through the latest month of an
 * active component. Pre-base data are validated but excluded from the result.
 * Gaps are explicit; neither prices nor weights are filled or rebalanced.
 * No intermediate or output value is rounded for display.
 */
export function calculateCci(input: CciInput): CciResult {
  if (!isRecord(input)) return invalid('INVALID_MODEL', 'A CCI model is required.')
  const baseMonth = monthNumber(input.basePeriod)
  const inputSemantics = copySemantics(input.inputSemantics)
  const { components, lastMonth } = prepareComponents(input, baseMonth)
  const monthly: CciMonthlyResult[] = []
  for (let month = baseMonth; month <= lastMonth; month++) {
    const period = monthLabel(month)
    const results = components.map(component => componentResult(component, period))
    const missingComponentIds = results.filter(component => component.status === 'MISSING_OBSERVATION').map(component => component.componentId)
    if (missingComponentIds.length > 0) {
      monthly.push({ period, status: 'INCOMPLETE', cci: null, cumulativeChangePercent: null,
        monthOverMonthChangePercent: null, monthOverMonthUnavailableReason: 'CURRENT_MONTH_INCOMPLETE', missingComponentIds, components: results })
      continue
    }
    const weightedRelatives = results.flatMap(component => component.status === 'COMPLETE'
      ? [(component.weightPercent / 100) * component.benchmarkRelative] : [])
    const cci = computed(month === baseMonth ? 100 : 100 * sum(weightedRelatives), true, period) as CciIndex
    const previous = monthly.at(-1)
    const monthOverMonthChangePercent = previous?.status === 'COMPLETE'
      ? computed((cci / previous.cci - 1) * 100, false, period) as PercentChange : null
    monthly.push({ period, status: 'COMPLETE', cci, cumulativeChangePercent: (cci - 100) as PercentChange,
      monthOverMonthChangePercent, monthOverMonthUnavailableReason: month === baseMonth ? 'BASE_PERIOD' : previous?.status !== 'COMPLETE' ? 'PREVIOUS_MONTH_INCOMPLETE' : null,
      missingComponentIds: [], components: results })
  }
  return { methodologyVersion: 'CCI_FIXED_BASE_V1', outputSemantics: 'DIMENSIONLESS_BASE_100_INDEX',
    basePeriod: input.basePeriod, inputSemantics, components: components.map(({ componentId, weightPercent }) => ({ componentId, weightPercent })),
    status: monthly.some(month => month.status === 'INCOMPLETE') ? 'INCOMPLETE' : 'COMPLETE', monthly }
}
