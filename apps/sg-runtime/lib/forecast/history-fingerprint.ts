import { createHash } from 'node:crypto'

import {
  createCalendarTargetPeriod,
  normalizeForecastSourceFrequency,
  type ForecastCadence,
  type ForecastTargetCadence,
} from '@/lib/forecast/cadence'
import { buildForecastArtifactCadenceIdentity } from '@/lib/forecast/identity'

type ForecastHistoryCanonicalization = {
  method: string
  version: string
}

type ForecastHistoryPoint = {
  date: string
  value: number | null
  sourceObservedAt?: string | null
}

export type ForecastHistoryFingerprintInput = {
  seriesId: string
  frequency: string
  cadence?: ForecastCadence
  start: string
  end: string
  observations: number
  canonicalization?: ForecastHistoryCanonicalization | null
  points: ForecastHistoryPoint[]
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const NAIVE_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/

function padMilliseconds(value?: string) {
  return (value ?? '').padEnd(3, '0').slice(0, 3)
}

function parseIsoLikeInstant(value: string, label: string) {
  const trimmed = value.trim()

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${label} must be a valid ISO date, received ${value}.`)
    }
    return parsed
  }

  const naiveTimestampMatch = NAIVE_TIMESTAMP_PATTERN.exec(trimmed)
  if (naiveTimestampMatch) {
    const [, year, month, day, hour, minute, second, milliseconds] = naiveTimestampMatch
    const parsed = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        Number(padMilliseconds(milliseconds)),
      ),
    )
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${label} must be a valid ISO timestamp, received ${value}.`)
    }
    return parsed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO date or timestamp, received ${value}.`)
  }

  return parsed
}

export function normalizeMonthlyPeriodIdentity(value: string, label: string) {
  const parsed = parseIsoLikeInstant(value, label)

  if (
    parsed.getUTCDate() !== 1
    || parsed.getUTCHours() !== 0
    || parsed.getUTCMinutes() !== 0
    || parsed.getUTCSeconds() !== 0
    || parsed.getUTCMilliseconds() !== 0
  ) {
    throw new Error(
      `${label} must identify a canonical MONTHLY period using the first day of the month at 00:00:00.000Z, received ${value}.`,
    )
  }

  return parsed.toISOString()
}

export function normalizeForecastPeriodIdentity(
  value: string,
  cadence: ForecastTargetCadence,
  label: string,
) {
  const parsed = parseIsoLikeInstant(value, label)
  const period = createCalendarTargetPeriod(parsed, cadence)

  if (parsed.getTime() !== period.start.getTime()) {
    throw new Error(
      `${label} must identify the canonical ${cadence} period start at 00:00:00.000Z, received ${value}.`,
    )
  }

  return parsed.toISOString()
}

export function normalizeSourceObservedAtIdentity(value: string, label: string) {
  return parseIsoLikeInstant(value, label).toISOString()
}

export function buildForecastHistoryFingerprint(history: ForecastHistoryFingerprintInput) {
  const hash = createHash('sha256')
  const targetCadence = history.cadence?.targetCadence
  if (
    history.cadence
    && normalizeForecastSourceFrequency(history.frequency) !== history.cadence.targetCadence
  ) {
    throw new Error(
      `Forecast history frequency ${history.frequency} must match target cadence ${history.cadence.targetCadence}.`,
    )
  }
  const normalizePeriod = (value: string, label: string) => targetCadence
    ? normalizeForecastPeriodIdentity(value, targetCadence, label)
    : normalizeMonthlyPeriodIdentity(value, label)
  const normalizedPoints = [...history.points]
    .map((point) => ({
      date: normalizePeriod(point.date, 'Forecast history point date'),
      value: point.value,
      sourceObservedAt: point.sourceObservedAt
        ? normalizeSourceObservedAtIdentity(point.sourceObservedAt, 'Forecast history point sourceObservedAt')
        : null,
    }))
    .sort((left, right) => left.date.localeCompare(right.date))

  hash.update(history.seriesId)
  if (history.cadence) {
    hash.update('\n')
    hash.update(buildForecastArtifactCadenceIdentity(history.cadence))
  }
  hash.update('\n')
  hash.update(history.frequency)
  hash.update('\n')
  hash.update(normalizePeriod(history.start, 'Forecast history start'))
  hash.update('\n')
  hash.update(normalizePeriod(history.end, 'Forecast history end'))
  hash.update('\n')
  hash.update(String(history.observations))

  if (history.canonicalization) {
    hash.update('\n')
    hash.update(history.canonicalization.method)
    hash.update('\n')
    hash.update(history.canonicalization.version)
  }

  for (const point of normalizedPoints) {
    hash.update('\n')
    hash.update(point.date)
    hash.update('=')
    hash.update(point.value === null ? 'null' : String(point.value))
    if (point.sourceObservedAt) {
      hash.update('@')
      hash.update(point.sourceObservedAt)
    }
  }

  return hash.digest('hex')
}