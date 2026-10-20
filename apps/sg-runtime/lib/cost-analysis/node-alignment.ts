import { parseBenchmarkObservationDate } from '../benchmark/observation-date'
import {
  FORECAST_NATIVE_FREQUENCIES, createCalendarTargetPeriod, getLawfulObservationsInForecastTargetPeriod,
  normalizeForecastSourceFrequency, reduceForecastPeriodAverage, reduceForecastPeriodEndOfPeriod,
  type ForecastTargetPeriod,
} from '../forecast/cadence'
import {
  canonicalizeDailyMarketPriceHistory, canonicalizeProvenanceQualifiedNativeMonthly,
  canonicalizeProvenanceQualifiedNativePeriod, DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD,
  DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION, DAILY_MARKET_PRICE_MONTHLY_METHOD, DAILY_MARKET_PRICE_MONTHLY_VERSION,
} from '../forecast/canonical-history'
import { buildForecastHistoryFingerprint } from '../forecast/history-fingerprint'
import type {
  CciAlignedComponentValue, CciAlignedNode, CciAlignmentIssue, CciAlignmentResult, CciCadence,
  CciMarketComponent, CciMarketDataRequest, CciPeriodIdentity, CciPreparedSeries, CciSourceObservation,
} from './market-data-contracts'

export class CciMarketDataValidationError extends Error {
  constructor(readonly code: string, message: string, readonly componentId?: string) {
    super(message)
    this.name = 'CciMarketDataValidationError'
  }
}

function invalid(code: string, message: string, componentId?: string): never {
  throw new CciMarketDataValidationError(code, message, componentId)
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

/** Guard calendar overflow before delegating timezone/naive-UTC handling to the existing parser. */
function instant(value: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
    return invalid('INVALID_DATE', 'Dates must use an ISO date or timestamp.')
  }
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const calendar = new Date(0)
  calendar.setUTCFullYear(year, month - 1, day)
  if (year < 100 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
    || (value.includes('T') && (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59))) {
    return invalid('INVALID_DATE', 'Dates must identify a real calendar day and time in supported years 0100–9999.')
  }
  const date = parseBenchmarkObservationDate(value)
  if (!Number.isFinite(date.getTime())) return invalid('INVALID_DATE', 'Invalid observation timestamp.')
  return date
}

function identity(period: ForecastTargetPeriod): CciPeriodIdentity {
  return { cadence: period.cadence, start: period.start.toISOString(), endExclusive: period.endExclusive.toISOString() }
}

function calendarPeriods(start: Date, end: Date, cadence: CciCadence): ForecastTargetPeriod[] {
  const periods: ForecastTargetPeriod[] = []
  let period = createCalendarTargetPeriod(start, cadence)
  while (period.start < end) {
    periods.push(period)
    period = createCalendarTargetPeriod(period.endExclusive, cadence)
  }
  return periods
}

/** Actual half-open intervals must tile the analysis period; cadence labels alone are insufficient. */
function tiledPeriods(target: ForecastTargetPeriod, source: CciCadence): ForecastTargetPeriod[] | null {
  const periods = calendarPeriods(target.start, target.endExclusive, source)
  return periods[0]?.start.getTime() === target.start.getTime()
    && periods.at(-1)?.endExclusive.getTime() === target.endExclusive.getTime()
    ? periods : null
}

type Prepared = { component: CciMarketComponent; series: CciPreparedSeries; observationsByPeriod: Map<string, CciSourceObservation> }

function prepareSource(component: CciMarketComponent, cutoff: Date): Prepared {
  const id = component.componentId
  const history = component.history
  if (!history || !history.providerSeries || !nonBlank(history.providerSeries.provider?.providerCode)
    || !nonBlank(component.benchmarkSeriesId) || history.providerSeries.providerSeriesId !== component.benchmarkSeriesId
    || !Array.isArray(history.historical)) invalid('SERIES_IDENTITY_MISMATCH', 'An exact provider series and its existing historical contract are required.', id)
  if (!(history.frequency === null || typeof history.frequency === 'string')
    || ![history.currency, history.unit, history.source].every(value => value === null || typeof value === 'string')) {
    invalid('INVALID_SOURCE_METADATA', 'Frequency, currency, unit and source must preserve their string or null metadata.', id)
  }
  const q = component.qualification
  if (!q || !['PRICE_LEVEL', 'PRICE_INDEX'].includes(q.valueKind) || !['POINT_IN_TIME', 'END_OF_PERIOD', 'PERIOD_AVERAGE'].includes(q.periodBasis)
    || q.calendar !== 'UTC_CALENDAR' || !nonBlank(q.evidenceRef)) invalid('INVALID_QUALIFICATION', 'Reviewed price-level and UTC economic-period semantics are required.', id)
  const reduction = component.reduction
  if (!reduction || !['NATIVE_ONLY', 'END_OF_PERIOD', 'OBSERVATION_AVERAGE'].includes(reduction.method)
    || (reduction.method !== 'NATIVE_ONLY' && !nonBlank(reduction.approvalRef))) invalid('INVALID_REDUCTION', 'Reduction requires an explicit approved methodology.', id)
  if (!component.snapshot || !(component.snapshot.revisionRef === null || nonBlank(component.snapshot.revisionRef))) invalid('INVALID_SNAPSHOT', 'Explicit retrieval/revision metadata or null is required.', id)
  const retrievedAt = component.snapshot.retrievedAt === null ? null : instant(component.snapshot.retrievedAt).toISOString()
  const cadence = normalizeForecastSourceFrequency(history.frequency)
  const dates = new Set<string>(), periods = new Set<string>()
  const sourceObservations: CciSourceObservation[] = []
  let excludedOpenPeriodCount = 0
  for (const point of history.historical) {
    if (!point) invalid('INVALID_OBSERVATION', 'Each source observation requires a date and price level.', id)
    const observedAt = instant(point.date)
    const timestamp = observedAt.toISOString()
    if (dates.has(timestamp)) invalid('DUPLICATE_OBSERVATION', 'Duplicate source timestamps are not silently collapsed.', id)
    dates.add(timestamp)
    if (point.value !== null && (typeof point.value !== 'number' || !Number.isFinite(point.value) || point.value <= 0)) invalid('INVALID_PRICE_LEVEL', 'Price levels must be finite and positive, or null for missing data.', id)
    if (!cadence) {
      sourceObservations.push({ originalDate: point.date, observedAt: timestamp, period: null, value: point.value })
      continue
    }
    const period = createCalendarTargetPeriod(observedAt, cadence)
    const periodKey = period.start.toISOString()
    if (periods.has(periodKey)) invalid('DUPLICATE_NATIVE_PERIOD', 'Multiple observations in one declared native period require separate approved preparation.', id)
    periods.add(periodKey)
    sourceObservations.push({ originalDate: point.date, observedAt: timestamp, period: identity(period), value: point.value })
    if (period.endExclusive > cutoff) excludedOpenPeriodCount++
  }
  sourceObservations.sort((a, b) => a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0)
  const historyFingerprint = cadence && sourceObservations.length ? buildForecastHistoryFingerprint({
    seriesId: component.benchmarkSeriesId, frequency: cadence, cadence: { sourceFrequency: cadence, targetCadence: cadence },
    start: sourceObservations[0].period!.start, end: sourceObservations.at(-1)!.period!.start, observations: sourceObservations.length,
    canonicalization: { method: 'CCI_VALIDATED_NATIVE_PERIOD_IDENTITY', version: 'cci-native-period-identity-v1' },
    points: sourceObservations.map(p => ({ date: p.period!.start, value: p.value, sourceObservedAt: p.observedAt })),
  }) : null
  const observationsByPeriod = new Map(sourceObservations.filter(p => p.period !== null).map(p => [p.period!.start, p]))
  return { component, observationsByPeriod, series: { componentId: id, weightPercent: component.weightPercent,
    provider: history.providerSeries.provider.providerCode, seriesId: component.benchmarkSeriesId,
    sourceFrequency: history.frequency, nativeCadence: cadence, currency: history.currency, unit: history.unit, source: history.source,
    qualification: { ...q }, preparationPolicy: { ...reduction }, snapshot: { retrievedAt, revisionRef: component.snapshot.revisionRef }, sourceObservations,
    excludedOpenPeriodCount, historyFingerprint, fingerprintScope: 'CANONICAL_NATIVE_LEVELS_NOT_IMMUTABLE_VINTAGE' } }
}

function permits(prepared: Prepared, target: ForecastTargetPeriod, basis: CciMarketDataRequest['nodeBasis']): boolean {
  const { component, series } = prepared
  const source = series.nativeCadence
  if (!source || !tiledPeriods(target, source)) return false
  if (source === target.cadence) return component.qualification.periodBasis === basis
  if (component.reduction.method === 'NATIVE_ONLY') return false
  if (component.reduction.method === 'OBSERVATION_AVERAGE') {
    // A mean of monthly/quarterly averages is not a time-weighted average of the larger period.
    return source === 'DAILY' && component.qualification.periodBasis !== 'PERIOD_AVERAGE' && basis === 'PERIOD_AVERAGE'
  }
  return component.qualification.periodBasis !== 'PERIOD_AVERAGE' && basis === 'END_OF_PERIOD'
}

function prepareValue(prepared: Prepared, target: ForecastTargetPeriod, cutoff: Date): CciAlignedComponentValue {
  const { component, series } = prepared
  const componentIdentity = { componentId: component.componentId, weightPercent: component.weightPercent }
  if (component.weightPercent === 0) return { ...componentIdentity, value: null, status: 'EXCLUDED_ZERO_WEIGHT', method: null, sourceDates: [], coverage: 'NONE' }
  const source = series.nativeCadence!
  const expected = tiledPeriods(target, source)!
  const selected = expected.flatMap(period => {
    const point = prepared.observationsByPeriod.get(period.start.toISOString())
    return point ? [point] : []
  })
  const sourceDates = selected.map(p => p.originalDate)
  const coverage = source === target.cadence ? 'NATIVE_PERIOD' : source === 'DAILY' ? 'AVAILABLE_DAILY_OBSERVATIONS' : 'ALL_NATIVE_PERIODS'
  const missing = selected.length === 0 || selected.some(p => p.value === null)
  const incomplete = source !== 'DAILY' && selected.length !== expected.length
  if (missing || incomplete) return { ...componentIdentity, value: null, status: incomplete ? 'INCOMPLETE_COVERAGE' : 'MISSING_OBSERVATION', sourceDates, method: null, coverage }
  const targetBasis = component.qualification.periodBasis === 'PERIOD_AVERAGE' ? 'MONTHLY_AVERAGE' : 'END_OF_PERIOD'
  let value: number | null, method: { id: string; version: string; approvalRef: string }
  if (source === target.cadence) {
    const history = { ...component.history, historical: selected.map(p => ({ date: p.observedAt, value: p.value })) }
    const result = source === 'MONTHLY'
      ? canonicalizeProvenanceQualifiedNativeMonthly(history, targetBasis, { now: cutoff, continuityPolicy: 'ALLOW_GAPS' })
      // Single-period validation deliberately avoids the forecast-only contiguous-training-window constraint.
      : canonicalizeProvenanceQualifiedNativePeriod(history, targetBasis, source, { now: cutoff })
    value = result.historical[0]?.value ?? null
    method = { id: component.qualification.periodBasis === 'POINT_IN_TIME' ? 'VALIDATE_NATIVE_POINT_IN_TIME_LEVEL' : result.method,
      version: component.qualification.periodBasis === 'POINT_IN_TIME' ? 'cci-native-point-in-time-v1' : result.version, approvalRef: component.qualification.evidenceRef }
  } else {
    const reduction = component.reduction
    if (reduction.method === 'NATIVE_ONLY') return invalid('INVALID_REDUCTION', 'A reduction policy is required.', component.componentId)
    method = { id: reduction.method === 'END_OF_PERIOD' ? DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD : DAILY_MARKET_PRICE_MONTHLY_METHOD,
      version: reduction.method === 'END_OF_PERIOD' ? DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION : DAILY_MARKET_PRICE_MONTHLY_VERSION, approvalRef: reduction.approvalRef }
    const history = { ...component.history, historical: selected.map(p => ({ date: p.observedAt, value: p.value })) }
    if (source === 'DAILY' && target.cadence === 'MONTHLY') {
      const result = canonicalizeDailyMarketPriceHistory(history, reduction.method === 'END_OF_PERIOD' ? 'END_OF_PERIOD' : 'MONTHLY_AVERAGE', { now: cutoff, continuityPolicy: 'ALLOW_GAPS' })
      value = result.historical[0]?.value ?? null
    } else {
      const lawful = getLawfulObservationsInForecastTargetPeriod(history.historical, target)
      value = reduction.method === 'END_OF_PERIOD' ? reduceForecastPeriodEndOfPeriod(lawful)?.value ?? null : reduceForecastPeriodAverage(lawful)
      // Reuse the reducer, while recording an honest cadence-independent identity rather than a monthly method label.
      method = { id: reduction.method === 'END_OF_PERIOD' ? 'REDUCE_LAWFUL_PERIOD_END_OF_PERIOD' : 'REDUCE_LAWFUL_PERIOD_OBSERVATION_AVERAGE',
        version: 'forecast-cadence-reducer-reuse-v1', approvalRef: reduction.approvalRef }
    }
  }
  if (value !== null && (!Number.isFinite(value) || value <= 0)) invalid('NUMERIC_RANGE', 'Prepared levels exceed the finite positive numeric range.', component.componentId)
  return { ...componentIdentity, value, status: value === null ? 'MISSING_OBSERVATION' : 'COMPLETE', sourceDates, method, coverage }
}

/** Pure preparation of supplied market history. No provider, DB, cache, clock or forecast compute. */
export function alignCciMarketData(input: CciMarketDataRequest): CciAlignmentResult {
  if (!input || !nonBlank(input.modelKey) || input.alignmentPolicy !== 'STRICT_COMMON_NODES'
    || !['POINT_IN_TIME', 'END_OF_PERIOD', 'PERIOD_AVERAGE'].includes(input.nodeBasis)
    || !['RETROSPECTIVE_CURRENT_HISTORY', 'HISTORICAL_AS_OF'].includes(input.availability)
    || !['NATIVE_CURRENCY_RELATIVES', 'PRECONVERTED_COMMON_CURRENCY'].includes(input.currencyPolicy?.kind)) invalid('INVALID_REQUEST', 'Explicit identity, alignment, availability, currency and economic basis policies are required.')
  if (!input.range) invalid('INVALID_RANGE', 'An explicit analysis range is required.')
  const start = instant(input.range.start), end = instant(input.range.endExclusive), cutoff = instant(input.cutoff), base = instant(input.baseNodeStart)
  if (start >= end || base < start || base >= end) invalid('INVALID_RANGE', 'Range must be nonempty and contain the requested base node.')
  if (!Array.isArray(input.components) || input.components.length === 0) invalid('INVALID_COMPONENTS', 'At least one component is required.')
  const ids = new Set<string>()
  for (const c of input.components) {
    if (!c || !nonBlank(c.componentId) || ids.has(c.componentId)) invalid('INVALID_COMPONENT_ID', 'Component IDs must be unique and nonblank.')
    ids.add(c.componentId)
    if (typeof c.weightPercent !== 'number' || !Number.isFinite(c.weightPercent) || c.weightPercent < 0) invalid('INVALID_WEIGHT', 'Weights must be finite nonnegative percentages.', c.componentId)
  }
  const weightSum = input.components.reduce((sum, c) => sum + c.weightPercent, 0)
  if (Math.abs(weightSum - 100) > 64 * Number.EPSILON * 100) invalid('INVALID_WEIGHT_SUM', 'Weights must sum to 100%; preparation never normalizes weights.')
  const prepared = input.components.map(c => prepareSource(c, cutoff)).sort((a, b) => a.component.componentId < b.component.componentId ? -1 : 1)
  const active = prepared.filter(p => p.component.weightPercent > 0)
  const issues: CciAlignmentIssue[] = []
  for (const p of active) if (!p.series.nativeCadence) issues.push({ code: 'UNKNOWN_FREQUENCY', message: 'Unknown native frequency is never silently converted.', componentId: p.component.componentId })
  if (input.availability === 'HISTORICAL_AS_OF') issues.push({ code: 'HISTORICAL_AS_OF_UNSUPPORTED', message: 'Current history has no verified observation publication dates or immutable historical vintages.' })
  if (input.currencyPolicy.kind === 'PRECONVERTED_COMMON_CURRENCY') issues.push({ code: 'FX_CONVERSION_NOT_SUPPORTED', message: 'This adapter consumes native market history; it cannot attest that historical FX conversion occurred.' })
  if (input.analysisCadence && !FORECAST_NATIVE_FREQUENCIES.includes(input.analysisCadence)) invalid('INVALID_ANALYSIS_CADENCE', 'Unknown requested analysis cadence.')
  const candidates = input.analysisCadence ? [input.analysisCadence] : FORECAST_NATIVE_FREQUENCIES
  const supportedCadences = issues.some(i => i.code === 'UNKNOWN_FREQUENCY') ? [] : candidates.filter(candidate => {
    let period = createCalendarTargetPeriod(start, candidate)
    while (period.start < end) {
      if (!active.every(p => permits(p, period, input.nodeBasis))) return false
      period = createCalendarTargetPeriod(period.endExclusive, candidate)
    }
    return true
  })
  // Prefer the finest lawful cadence with genuinely comparable closed data. If none
  // has a complete node, retain the first lawful calendar to expose its missing data.
  const cadence = supportedCadences.find(candidate => calendarPeriods(start, end, candidate)
    .some(period => period.start >= start && period.endExclusive <= end && period.endExclusive <= cutoff
      && active.every(p => prepareValue(p, period, cutoff).status === 'COMPLETE')))
    ?? supportedCadences[0] ?? null
  if (!cadence && !issues.some(i => i.code === 'UNKNOWN_FREQUENCY')) issues.push({ code: input.analysisCadence ? 'UNSUPPORTED_CANONICALIZATION' : 'NO_COMPARABLE_CADENCE', message: 'No approved reduction and exact native-period tiling support the requested common nodes.' })
  const analysisPeriods = cadence ? calendarPeriods(start, end, cadence) : []
  const excludedAnalysisPeriods = analysisPeriods.flatMap(period => {
    const reasons: ('PARTIAL_ANALYSIS_RANGE' | 'OPEN_AT_CUTOFF')[] = []
    if (period.start < start || period.endExclusive > end) reasons.push('PARTIAL_ANALYSIS_RANGE')
    if (period.endExclusive > cutoff) reasons.push('OPEN_AT_CUTOFF')
    return reasons.length ? [{ period: identity(period), reasons }] : []
  })
  const nodes: CciAlignedNode[] = analysisPeriods
    .filter(period => period.start >= start && period.endExclusive <= end && period.endExclusive <= cutoff)
    .map(period => {
      const components = prepared.map(p => prepareValue(p, period, cutoff))
      return { period: identity(period), status: components.every(c => c.status === 'COMPLETE' || c.status === 'EXCLUDED_ZERO_WEIGHT') ? 'COMPLETE' : 'INCOMPLETE', components }
    })
  if (cadence && createCalendarTargetPeriod(base, cadence).start.getTime() !== base.getTime()) issues.push({ code: 'BASE_NODE_NOT_ALIGNED', message: 'The requested base is not a canonical common-node start and is never moved automatically.' })
  const baseNode = nodes.find(node => node.period.start === base.toISOString())
  if (cadence && baseNode?.status !== 'COMPLETE') issues.push({ code: 'MISSING_BASE_NODE', message: 'A complete closed common base node is required.' })
  if (cadence && !nodes.some(node => node.status === 'COMPLETE')) issues.push({ code: 'NO_COMPLETE_NODES', message: 'No complete closed common periods are available in the requested range.' })
  const unsupported = issues.some(i => ['UNKNOWN_FREQUENCY', 'UNSUPPORTED_CANONICALIZATION'].includes(i.code))
  return { methodologyVersion: 'CCI_NATIVE_ALIGNMENT_V1', modelKey: input.modelKey, baseNodeStart: base.toISOString(), cutoff: cutoff.toISOString(),
    range: { start: start.toISOString(), endExclusive: end.toISOString() }, analysisCadence: cadence, nodeBasis: input.nodeBasis,
    availability: { requested: input.availability, supported: 'RETROSPECTIVE_CURRENT_HISTORY_ONLY', historicalPublicationDatesVerified: false, immutableVintagesVerified: false },
    currencyStatus: input.currencyPolicy.kind === 'NATIVE_CURRENCY_RELATIVES' ? 'NATIVE_RELATIVES_FX_NOT_APPLIED' : 'FX_CONVERSION_NOT_SUPPORTED',
    status: unsupported ? 'UNSUPPORTED_CANONICALIZATION' : issues.length ? 'NOT_COMPARABLE' : nodes.some(n => n.status === 'INCOMPLETE') ? 'INCOMPLETE' : 'COMPLETE',
    issues, series: prepared.map(p => p.series), nodes, excludedAnalysisPeriods }
}
