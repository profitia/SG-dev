import type { CciComponentResult, CciIndex, CciValidationCode, CciValidationIssue, PercentChange, PercentagePoints } from './contracts'

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

export function invalid(code: CciValidationCode, message: string, componentId?: string, period?: string): never {
  throw new CciValidationError({ code, message, ...(componentId === undefined ? {} : { componentId }), ...(period === undefined ? {} : { period }) })
}

/** Compensated addition preserves precision; it does not round or rescale weights. */
export function sum(values: readonly number[]): number {
  let total = 0
  let correction = 0
  for (const value of values) {
    const next = total + value
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total
    total = next
  }
  return total + correction
}

export function computed(value: number, positive: boolean, period: string, componentId?: string): number {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    return invalid('NUMERIC_RANGE', 'Calculation exceeds the supported finite numeric range.', componentId, period)
  }
  return value
}

export function calculateFixedBaseComponent(component: { componentId: string; weightPercent: number }, benchmarkValue: number | null, baseValue: number | null, period: string): CciComponentResult {
  // Do not leak caller-private preparation maps/base levels into the public result.
  const identity = { componentId: component.componentId, weightPercent: component.weightPercent }
  if (identity.weightPercent === 0) {
    return { ...identity, status: 'EXCLUDED_ZERO_WEIGHT', benchmarkValue, benchmarkRelative: null,
      componentIndex: null, contributionPercentagePoints: 0 as PercentagePoints }
  }
  if (benchmarkValue === null) {
    return { ...identity, status: 'MISSING_OBSERVATION', benchmarkValue: null, benchmarkRelative: null,
      componentIndex: null, contributionPercentagePoints: null }
  }
  // Both callers validate a strictly positive base for every active component.
  const relative = computed(benchmarkValue / baseValue!, true, period, identity.componentId)
  return { ...identity, status: 'COMPLETE', benchmarkValue, benchmarkRelative: relative,
    componentIndex: computed(100 * relative, true, period, identity.componentId) as CciIndex,
    contributionPercentagePoints: computed(identity.weightPercent * (relative - 1), false, period, identity.componentId) as PercentagePoints }
}

/** Shared fixed-base index; callers decide calendar coverage and missing-data status. */
export function calculateFixedBaseIndex(components: readonly CciComponentResult[], isBase: boolean, period: string): CciIndex {
  const weightedRelatives = components.flatMap(component => component.status === 'COMPLETE'
    ? [(component.weightPercent / 100) * component.benchmarkRelative] : [])
  return computed(isBase ? 100 : 100 * sum(weightedRelatives), true, period) as CciIndex
}

export function calculatePeriodChange(current: CciIndex, previous: CciIndex, period: string): PercentChange {
  return computed((current / previous - 1) * 100, false, period) as PercentChange
}
