import { parseBenchmarkObservationDate } from '@/lib/benchmark/observation-date'

export const FORECAST_NATIVE_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'QUADMONTHLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const

export const FORECAST_NATIVE_SPARSE_FREQUENCIES = [
  'BIMONTHLY',
  'QUARTERLY',
  'QUADMONTHLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const

export const FORECAST_EXECUTABLE_NATIVE_SPARSE_FREQUENCIES = [
  'BIMONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const

export type ForecastNativeFrequency = (typeof FORECAST_NATIVE_FREQUENCIES)[number]
export type ForecastSourceFrequency = ForecastNativeFrequency
export type ForecastTargetCadence = ForecastNativeFrequency
export type ForecastNativeSparseFrequency = (typeof FORECAST_NATIVE_SPARSE_FREQUENCIES)[number]
export type ForecastExecutableNativeSparseFrequency = (typeof FORECAST_EXECUTABLE_NATIVE_SPARSE_FREQUENCIES)[number]

export type ForecastCadence = {
  sourceFrequency: ForecastSourceFrequency
  targetCadence: ForecastTargetCadence
}

export type ForecastTargetPeriod = {
  cadence: ForecastTargetCadence
  start: Date
  endExclusive: Date
}

export type ForecastPeriodObservation = {
  date: string
  value: number | null
}

export type LawfulForecastPeriodObservation = {
  observedAt: Date
  value: number
}

const FORECAST_FREQUENCY_BY_EXACT_VALUE = new Map<string, ForecastNativeFrequency>(
  FORECAST_NATIVE_FREQUENCIES.map((frequency) => [frequency, frequency]),
)

const FORECAST_MONTHS_PER_TARGET_PERIOD = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  QUADMONTHLY: 4,
  SEMIANNUAL: 6,
  ANNUAL: 12,
} as const satisfies Record<Exclude<ForecastTargetCadence, 'DAILY' | 'WEEKLY'>, number>

export function normalizeForecastSourceFrequency(
  value: string | null | undefined,
): ForecastSourceFrequency | null {
  const exactValue = value?.trim().toUpperCase() ?? ''
  return FORECAST_FREQUENCY_BY_EXACT_VALUE.get(exactValue) ?? null
}

export function isForecastNativeSparseFrequency(
  value: ForecastSourceFrequency | null,
): value is ForecastNativeSparseFrequency {
  return value !== null && FORECAST_NATIVE_SPARSE_FREQUENCIES.some((frequency) => frequency === value)
}

export function isForecastExecutableNativeSparseFrequency(
  value: ForecastSourceFrequency | null,
): value is ForecastExecutableNativeSparseFrequency {
  return value !== null && FORECAST_EXECUTABLE_NATIVE_SPARSE_FREQUENCIES.some((frequency) => frequency === value)
}

export function createForecastCadence(
  sourceFrequency: ForecastSourceFrequency,
  targetCadence: ForecastTargetCadence,
): ForecastCadence {
  return { sourceFrequency, targetCadence }
}

function cloneValidDate(value: Date | string, label: string): Date {
  const date = typeof value === 'string'
    ? parseBenchmarkObservationDate(value)
    : new Date(value.getTime())

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Forecast target period ${label} must be a valid timestamp.`)
  }

  return date
}

export function createForecastTargetPeriod(
  cadence: ForecastTargetCadence,
  start: Date | string,
  endExclusive: Date | string,
): ForecastTargetPeriod {
  const normalizedStart = cloneValidDate(start, 'start')
  const normalizedEnd = cloneValidDate(endExclusive, 'end')

  if (normalizedStart.getTime() >= normalizedEnd.getTime()) {
    throw new Error('Forecast target period must use a non-empty half-open interval.')
  }

  return {
    cadence,
    start: normalizedStart,
    endExclusive: normalizedEnd,
  }
}

function toUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function createCalendarTargetPeriod(
  observedAt: Date | string,
  cadence: ForecastTargetCadence,
): ForecastTargetPeriod {
  const date = cloneValidDate(observedAt, 'observation')

  if (cadence === 'DAILY') {
    const start = toUtcDayStart(date)
    const endExclusive = new Date(start.getTime())
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
    return createForecastTargetPeriod(cadence, start, endExclusive)
  }

  if (cadence === 'WEEKLY') {
    const start = toUtcDayStart(date)
    const daysSinceMonday = (start.getUTCDay() + 6) % 7
    start.setUTCDate(start.getUTCDate() - daysSinceMonday)
    const endExclusive = new Date(start.getTime())
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 7)
    return createForecastTargetPeriod(cadence, start, endExclusive)
  }

  const periodMonths = FORECAST_MONTHS_PER_TARGET_PERIOD[cadence]
  const startMonth = Math.floor(date.getUTCMonth() / periodMonths) * periodMonths
  const start = new Date(Date.UTC(date.getUTCFullYear(), startMonth, 1))
  const endExclusive = new Date(Date.UTC(date.getUTCFullYear(), startMonth + periodMonths, 1))
  return createForecastTargetPeriod(cadence, start, endExclusive)
}

export function createFutureForecastTargetPeriods(
  originPeriod: Date | string,
  cadence: ForecastTargetCadence,
  horizonSteps: number,
): ForecastTargetPeriod[] {
  if (!Number.isInteger(horizonSteps) || horizonSteps < 1) {
    throw new Error('Forecast horizon must be a positive integer number of native steps.')
  }

  const targetPeriods: ForecastTargetPeriod[] = []
  let period = createCalendarTargetPeriod(originPeriod, cadence)
  for (let step = 0; step < horizonSteps; step += 1) {
    period = createCalendarTargetPeriod(period.endExclusive, cadence)
    targetPeriods.push(period)
  }
  return targetPeriods
}

export function mapLegacyCalendarMonthHorizonToNativeSteps(
  cadence: ForecastTargetCadence,
  horizonMonths: number,
): number | null {
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1) {
    throw new Error('Legacy Forecast horizon must be a positive integer number of calendar months.')
  }
  if (cadence === 'DAILY' || cadence === 'WEEKLY') return null

  const monthsPerTargetPeriod = FORECAST_MONTHS_PER_TARGET_PERIOD[cadence]
  return horizonMonths % monthsPerTargetPeriod === 0
    ? horizonMonths / monthsPerTargetPeriod
    : null
}

export function isObservationInForecastTargetPeriod(
  observedAt: Date | string,
  period: ForecastTargetPeriod,
): boolean {
  const timestamp = cloneValidDate(observedAt, 'observation').getTime()
  return timestamp >= period.start.getTime() && timestamp < period.endExclusive.getTime()
}

export function getLawfulObservationsInForecastTargetPeriod(
  observations: readonly ForecastPeriodObservation[],
  period: ForecastTargetPeriod,
): LawfulForecastPeriodObservation[] {
  return observations
    .filter((observation) => isObservationInForecastTargetPeriod(observation.date, period))
    .flatMap((observation) => {
      if (observation.value === null) return []
      if (!Number.isFinite(observation.value)) {
        throw new Error(`Forecast target period cannot include a non-finite observation at ${observation.date}.`)
      }
      return [{
        observedAt: parseBenchmarkObservationDate(observation.date),
        value: observation.value,
      }]
    })
    .sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime())
}

export function reduceForecastPeriodAverage(
  observations: readonly LawfulForecastPeriodObservation[],
): number | null {
  if (observations.length === 0) return null
  return observations.reduce((sum, observation) => sum + observation.value, 0) / observations.length
}

export function reduceForecastPeriodEndOfPeriod(
  observations: readonly LawfulForecastPeriodObservation[],
): LawfulForecastPeriodObservation | null {
  return observations.at(-1) ?? null
}