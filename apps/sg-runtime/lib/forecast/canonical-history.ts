import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import { parseBenchmarkObservationDate } from '@/lib/benchmark/observation-date'
import {
  createCalendarTargetPeriod,
  createFutureForecastTargetPeriods,
  getLawfulObservationsInForecastTargetPeriod,
  normalizeForecastSourceFrequency,
  reduceForecastPeriodAverage,
  reduceForecastPeriodEndOfPeriod,
  type ForecastTargetCadence,
  type ForecastTargetPeriod,
} from '@/lib/forecast/cadence'
import type { ForecastTargetBasis } from '@/lib/forecast/contracts'

export const LIVE_FORECAST_INPUT_SOURCE_KIND = 'DYNAMIC_MARKET_DATA_STORE'
export const DAILY_MARKET_PRICE_MONTHLY_METHOD = 'AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS'
export const DAILY_MARKET_PRICE_MONTHLY_VERSION = 'daily-market-price-monthly-average-v2'
export const DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD = 'LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD'
export const DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION = 'daily-market-price-end-of-period-v1'
export const WEEKLY_LEVEL_END_OF_PERIOD_METHOD = 'LAST_LAWFUL_WEEKLY_LEVEL_IN_CLOSED_PERIOD'
export const WEEKLY_LEVEL_END_OF_PERIOD_VERSION = 'weekly-level-end-of-period-v1'
export const NATIVE_MONTHLY_END_OF_PERIOD_METHOD = 'VALIDATE_NATIVE_MONTHLY_END_OF_PERIOD'
export const NATIVE_MONTHLY_END_OF_PERIOD_VERSION = 'native-monthly-end-of-period-v1'
export const NATIVE_MONTHLY_AVERAGE_METHOD = 'VALIDATE_NATIVE_MONTHLY_AVERAGE'
export const NATIVE_MONTHLY_AVERAGE_VERSION = 'native-monthly-average-v1'
export const NATIVE_PERIOD_END_OF_PERIOD_METHOD = 'VALIDATE_NATIVE_PERIOD_END_OF_PERIOD'
export const NATIVE_PERIOD_END_OF_PERIOD_VERSION = 'native-period-end-of-period-v1'
export const NATIVE_PERIOD_AVERAGE_METHOD = 'VALIDATE_NATIVE_PERIOD_AVERAGE'
export const NATIVE_PERIOD_AVERAGE_VERSION = 'native-period-average-v1'

type CanonicalMonthlyMethod =
  | typeof DAILY_MARKET_PRICE_MONTHLY_METHOD
  | typeof DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD
  | typeof WEEKLY_LEVEL_END_OF_PERIOD_METHOD
  | typeof NATIVE_MONTHLY_END_OF_PERIOD_METHOD
  | typeof NATIVE_MONTHLY_AVERAGE_METHOD

type CanonicalMonthlyVersion =
  | typeof DAILY_MARKET_PRICE_MONTHLY_VERSION
  | typeof DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION
  | typeof WEEKLY_LEVEL_END_OF_PERIOD_VERSION
  | typeof NATIVE_MONTHLY_END_OF_PERIOD_VERSION
  | typeof NATIVE_MONTHLY_AVERAGE_VERSION

export type CanonicalMonthlyObservation = {
  date: string
  value: number
  sourceObservedAt: string | null
}

type MonthlyContinuityPolicy = 'REQUIRE_FULL' | 'ALLOW_GAPS'

export type CanonicalMonthlySeries = {
  frequency: 'MONTHLY'
  targetBasis: ForecastTargetBasis
  method: CanonicalMonthlyMethod
  version: CanonicalMonthlyVersion
  partialMonthRule: 'EXCLUDE_OPEN_CALENDAR_MONTH'
  missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY'
  sourceObservationCount: number
  sourceObservationsUsed: number
  excludedPartialPeriods: number
  historical: CanonicalMonthlyObservation[]
}

type DailyCanonicalMonthlySeries = Omit<CanonicalMonthlySeries, 'method' | 'version'> & {
  method: typeof DAILY_MARKET_PRICE_MONTHLY_METHOD | typeof DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD
  version: typeof DAILY_MARKET_PRICE_MONTHLY_VERSION | typeof DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION
}

type ClosedMonthlyPeriodGroup = {
  period: ForecastTargetPeriod
  observations: BenchmarkHistoricalSeriesResult['historical']
}

export type CanonicalNativePeriodSeries = {
  frequency: ForecastTargetCadence
  targetBasis: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE'
  method: typeof NATIVE_PERIOD_END_OF_PERIOD_METHOD | typeof NATIVE_PERIOD_AVERAGE_METHOD
  version: typeof NATIVE_PERIOD_END_OF_PERIOD_VERSION | typeof NATIVE_PERIOD_AVERAGE_VERSION
  partialPeriodRule: 'EXCLUDE_OPEN_TARGET_PERIOD'
  missingObservationRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY'
  sourceObservationCount: number
  sourceObservationsUsed: number
  excludedPartialPeriods: number
  historical: CanonicalMonthlyObservation[]
}

function toMonthKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function assertRegularMonthlyCadence(seriesId: string, points: CanonicalMonthlyObservation[]) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = parseBenchmarkObservationDate(points[index - 1].date)
    const current = parseBenchmarkObservationDate(points[index].date)
    const expectedNext = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 1))

    if (current.getTime() !== expectedNext.getTime()) {
      throw new Error(
        `Canonical monthly forecast input for ${seriesId} has a gap between ${points[index - 1].date} and ${points[index].date}.`,
      )
    }
  }
}

export function selectLatestContiguousMonthlySuffix(points: CanonicalMonthlyObservation[]) {
  if (points.length < 2) {
    return [...points]
  }

  let suffixStartIndex = points.length - 1

  for (let index = points.length - 1; index > 0; index -= 1) {
    const previous = parseBenchmarkObservationDate(points[index - 1].date)
    const current = parseBenchmarkObservationDate(points[index].date)
    const expectedCurrent = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 1))

    if (current.getTime() !== expectedCurrent.getTime()) {
      break
    }

    suffixStartIndex = index - 1
  }

  return points.slice(suffixStartIndex)
}

function finalizeMonthlyHistory(
  seriesId: string,
  historical: CanonicalMonthlyObservation[],
  continuityPolicy: MonthlyContinuityPolicy,
) {
  if (continuityPolicy === 'REQUIRE_FULL') {
    assertRegularMonthlyCadence(seriesId, historical)
  }

  return historical
}

function assertRegularNativeCadence(
  seriesId: string,
  cadence: ForecastTargetCadence,
  points: CanonicalMonthlyObservation[],
) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = parseBenchmarkObservationDate(points[index - 1].date)
    const current = parseBenchmarkObservationDate(points[index].date)
    const expectedNext = createFutureForecastTargetPeriods(previous, cadence, 1)[0]?.start

    if (!expectedNext || current.getTime() !== expectedNext.getTime()) {
      throw new Error(
        `Canonical ${cadence} forecast input for ${seriesId} has a gap between ${points[index - 1].date} and ${points[index].date}.`,
      )
    }
  }
}

function assertDailyFrequency(history: BenchmarkHistoricalSeriesResult) {
  if (normalizeForecastSourceFrequency(history.frequency) !== 'DAILY') {
    throw new Error(`Daily market-price canonicalization requires a DAILY source frequency, received ${history.frequency ?? 'null'}.`)
  }
}

function assertSourceFrequency(history: BenchmarkHistoricalSeriesResult, expected: 'WEEKLY' | 'MONTHLY') {
  if (normalizeForecastSourceFrequency(history.frequency) !== expected) {
    throw new Error(`Provenance-qualified preparation requires ${expected} source frequency, received ${history.frequency ?? 'null'}.`)
  }
}

function assertFiniteObservation(seriesId: string, pointDate: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Canonical monthly forecast input for ${seriesId} cannot include non-finite daily observations at ${pointDate}.`)
  }
}

function groupClosedMonthlyPeriods(
  history: BenchmarkHistoricalSeriesResult,
  now: Date,
): { groups: ClosedMonthlyPeriodGroup[]; excludedPartialPeriods: number } {
  const openPeriod = createCalendarTargetPeriod(now, 'MONTHLY')
  const groupsByStart = new Map<string, ClosedMonthlyPeriodGroup>()
  const excludedPeriods = new Set<string>()

  for (const observation of history.historical) {
    const observedAt = parseBenchmarkObservationDate(observation.date)
    const period = createCalendarTargetPeriod(observedAt, 'MONTHLY')
    const periodKey = period.start.toISOString()

    if (period.start.getTime() >= openPeriod.start.getTime()) {
      excludedPeriods.add(periodKey)
      continue
    }

    if (observation.value !== null) {
      assertFiniteObservation(history.providerSeries.providerSeriesId, observation.date, observation.value)
    }

    const existing = groupsByStart.get(periodKey)
    if (existing) {
      existing.observations.push(observation)
    } else {
      groupsByStart.set(periodKey, { period, observations: [observation] })
    }
  }

  return {
    groups: [...groupsByStart.values()].sort((left, right) => (
      left.period.start.getTime() - right.period.start.getTime()
    )),
    excludedPartialPeriods: excludedPeriods.size,
  }
}

export function canonicalizeDailyMarketPriceToMonthly(
  history: BenchmarkHistoricalSeriesResult,
  options: { now?: Date; continuityPolicy?: MonthlyContinuityPolicy } = {},
): DailyCanonicalMonthlySeries {
  assertDailyFrequency(history)

  const now = options.now ?? new Date()
  const continuityPolicy = options.continuityPolicy ?? 'REQUIRE_FULL'
  const { groups, excludedPartialPeriods } = groupClosedMonthlyPeriods(history, now)
  let sourceObservationsUsed = 0
  const historical = finalizeMonthlyHistory(history.providerSeries.providerSeriesId, groups.flatMap(({ period, observations }) => {
    const lawful = getLawfulObservationsInForecastTargetPeriod(observations, period)
    const value = reduceForecastPeriodAverage(lawful)
    sourceObservationsUsed += lawful.length
    return value === null ? [] : [{
      date: period.start.toISOString(),
      value,
      sourceObservedAt: null,
    }]
  }), continuityPolicy)

  return {
    frequency: 'MONTHLY',
    targetBasis: 'MONTHLY_AVERAGE',
    method: DAILY_MARKET_PRICE_MONTHLY_METHOD,
    version: DAILY_MARKET_PRICE_MONTHLY_VERSION,
    partialMonthRule: 'EXCLUDE_OPEN_CALENDAR_MONTH',
    missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
    sourceObservationCount: history.historical.length,
    sourceObservationsUsed,
    excludedPartialPeriods,
    historical,
  }
}

export function canonicalizeDailyMarketPriceToEndOfPeriod(
  history: BenchmarkHistoricalSeriesResult,
  options: { now?: Date; continuityPolicy?: MonthlyContinuityPolicy } = {},
): DailyCanonicalMonthlySeries {
  assertDailyFrequency(history)
  const prepared = canonicalizeEndOfPeriodLevels(history, options)
  return {
    ...prepared,
    method: DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD,
    version: DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION,
  }
}

export function canonicalizeProvenanceQualifiedWeeklyEndOfPeriod(
  history: BenchmarkHistoricalSeriesResult,
  options: { now?: Date; continuityPolicy?: MonthlyContinuityPolicy } = {},
): CanonicalMonthlySeries {
  assertSourceFrequency(history, 'WEEKLY')
  const prepared = canonicalizeEndOfPeriodLevels(history, options)

  return {
    ...prepared,
    method: WEEKLY_LEVEL_END_OF_PERIOD_METHOD,
    version: WEEKLY_LEVEL_END_OF_PERIOD_VERSION,
  }
}

function canonicalizeEndOfPeriodLevels(
  history: BenchmarkHistoricalSeriesResult,
  options: { now?: Date; continuityPolicy?: MonthlyContinuityPolicy } = {},
): CanonicalMonthlySeries {
  const now = options.now ?? new Date()
  const continuityPolicy = options.continuityPolicy ?? 'REQUIRE_FULL'
  const { groups, excludedPartialPeriods } = groupClosedMonthlyPeriods(history, now)
  let sourceObservationsUsed = 0
  const historical = finalizeMonthlyHistory(history.providerSeries.providerSeriesId, groups.flatMap(({ period, observations }) => {
    const lawful = getLawfulObservationsInForecastTargetPeriod(observations, period)
    const endOfPeriod = reduceForecastPeriodEndOfPeriod(lawful)
    sourceObservationsUsed += lawful.length
    return endOfPeriod === null ? [] : [{
      date: period.start.toISOString(),
      value: endOfPeriod.value,
      sourceObservedAt: endOfPeriod.observedAt.toISOString(),
    }]
  }), continuityPolicy)

  return {
    frequency: 'MONTHLY',
    targetBasis: 'END_OF_PERIOD',
    method: DAILY_MARKET_PRICE_END_OF_PERIOD_METHOD,
    version: DAILY_MARKET_PRICE_END_OF_PERIOD_VERSION,
    partialMonthRule: 'EXCLUDE_OPEN_CALENDAR_MONTH',
    missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
    sourceObservationCount: history.historical.length,
    sourceObservationsUsed,
    excludedPartialPeriods,
    historical,
  }
}

export function canonicalizeProvenanceQualifiedNativeMonthly(
  history: BenchmarkHistoricalSeriesResult,
  targetBasis: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
  options: { now?: Date; continuityPolicy?: MonthlyContinuityPolicy } = {},
): CanonicalMonthlySeries {
  assertSourceFrequency(history, 'MONTHLY')
  const now = options.now ?? new Date()
  const continuityPolicy = options.continuityPolicy ?? 'REQUIRE_FULL'
  const { groups, excludedPartialPeriods } = groupClosedMonthlyPeriods(history, now)
  const historical: CanonicalMonthlyObservation[] = []
  let sourceObservationsUsed = 0

  for (const { period, observations } of groups) {
    const lawful = getLawfulObservationsInForecastTargetPeriod(observations, period)
    if (lawful.length > 1) {
      throw new Error(`Native MONTHLY Forecast input for ${history.providerSeries.providerSeriesId} has duplicate target month ${toMonthKey(period.start)}.`)
    }

    const observation = reduceForecastPeriodEndOfPeriod(lawful)
    if (!observation) continue
    sourceObservationsUsed += lawful.length
    historical.push({
      date: period.start.toISOString(),
      value: targetBasis === 'END_OF_PERIOD'
        ? observation.value
        : reduceForecastPeriodAverage(lawful) as number,
      sourceObservedAt: targetBasis === 'END_OF_PERIOD' ? observation.observedAt.toISOString() : null,
    })
  }

  historical.sort((left, right) => left.date.localeCompare(right.date))
  finalizeMonthlyHistory(history.providerSeries.providerSeriesId, historical, continuityPolicy)

  return {
    frequency: 'MONTHLY',
    targetBasis,
    method: targetBasis === 'END_OF_PERIOD'
      ? NATIVE_MONTHLY_END_OF_PERIOD_METHOD
      : NATIVE_MONTHLY_AVERAGE_METHOD,
    version: targetBasis === 'END_OF_PERIOD'
      ? NATIVE_MONTHLY_END_OF_PERIOD_VERSION
      : NATIVE_MONTHLY_AVERAGE_VERSION,
    partialMonthRule: 'EXCLUDE_OPEN_CALENDAR_MONTH',
    missingDayRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
    sourceObservationCount: history.historical.length,
    sourceObservationsUsed,
    excludedPartialPeriods,
    historical,
  }
}

export function canonicalizeProvenanceQualifiedNativePeriod(
  history: BenchmarkHistoricalSeriesResult,
  targetBasis: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
  targetCadence: ForecastTargetCadence,
  options: { now?: Date } = {},
): CanonicalNativePeriodSeries {
  const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
  if (sourceFrequency !== targetCadence) {
    throw new Error(
      `Native period preparation requires matching ${targetCadence} source frequency, received ${history.frequency ?? 'null'}.`,
    )
  }

  const openPeriod = createCalendarTargetPeriod(options.now ?? new Date(), targetCadence)
  const groupsByStart = new Map<string, ClosedMonthlyPeriodGroup>()
  const excludedPeriods = new Set<string>()

  for (const observation of history.historical) {
    const observedAt = parseBenchmarkObservationDate(observation.date)
    const period = createCalendarTargetPeriod(observedAt, targetCadence)
    const periodKey = period.start.toISOString()

    if (period.start.getTime() >= openPeriod.start.getTime()) {
      excludedPeriods.add(periodKey)
      continue
    }

    if (observation.value !== null) {
      assertFiniteObservation(history.providerSeries.providerSeriesId, observation.date, observation.value)
    }

    const existing = groupsByStart.get(periodKey)
    if (existing) {
      existing.observations.push(observation)
    } else {
      groupsByStart.set(periodKey, { period, observations: [observation] })
    }
  }

  const historical: CanonicalMonthlyObservation[] = []
  let sourceObservationsUsed = 0
  for (const { period, observations } of [...groupsByStart.values()].sort((left, right) => (
    left.period.start.getTime() - right.period.start.getTime()
  ))) {
    const lawful = getLawfulObservationsInForecastTargetPeriod(observations, period)
    if (lawful.length > 1) {
      throw new Error(
        `Native ${targetCadence} Forecast input for ${history.providerSeries.providerSeriesId} has duplicate target period ${period.start.toISOString()}.`,
      )
    }

    const endOfPeriod = reduceForecastPeriodEndOfPeriod(lawful)
    if (!endOfPeriod) continue
    sourceObservationsUsed += lawful.length
    historical.push({
      date: period.start.toISOString(),
      value: targetBasis === 'END_OF_PERIOD'
        ? endOfPeriod.value
        : reduceForecastPeriodAverage(lawful) as number,
      sourceObservedAt: targetBasis === 'END_OF_PERIOD' ? endOfPeriod.observedAt.toISOString() : null,
    })
  }

  assertRegularNativeCadence(history.providerSeries.providerSeriesId, targetCadence, historical)

  return {
    frequency: targetCadence,
    targetBasis,
    method: targetBasis === 'END_OF_PERIOD'
      ? NATIVE_PERIOD_END_OF_PERIOD_METHOD
      : NATIVE_PERIOD_AVERAGE_METHOD,
    version: targetBasis === 'END_OF_PERIOD'
      ? NATIVE_PERIOD_END_OF_PERIOD_VERSION
      : NATIVE_PERIOD_AVERAGE_VERSION,
    partialPeriodRule: 'EXCLUDE_OPEN_TARGET_PERIOD',
    missingObservationRule: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
    sourceObservationCount: history.historical.length,
    sourceObservationsUsed,
    excludedPartialPeriods: excludedPeriods.size,
    historical,
  }
}

export function canonicalizeDailyMarketPriceHistory(
  history: BenchmarkHistoricalSeriesResult,
  targetBasis: ForecastTargetBasis,
  options: { now?: Date; continuityPolicy?: MonthlyContinuityPolicy } = {},
): DailyCanonicalMonthlySeries {
  if (targetBasis === 'END_OF_PERIOD') {
    return canonicalizeDailyMarketPriceToEndOfPeriod(history, options)
  }

  return canonicalizeDailyMarketPriceToMonthly(history, options)
}