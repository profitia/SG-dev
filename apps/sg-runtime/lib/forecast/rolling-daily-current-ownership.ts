import {
  buildCurrentLogicalArtifactKey,
  type CurrentLogicalArtifactIdentity,
} from '@/lib/forecast/current-single-flight'
import {
  buildRollingDailyHistoryFingerprint,
  loadRollingDailyHistory,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  type RollingDailyHistoryPayload,
} from '@/lib/forecast/rolling-daily-maintenance'
import {
  ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
  ROLLING_DAILY_TARGET_BASIS,
} from '@/lib/forecast/rolling-daily-policy'

const ROLLING_DAILY_ANCHOR_HORIZONS = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '12M': 12,
} as const

function normalizeDailyObservationDay(value: string) {
  return value.trim().slice(0, 10)
}

function addCalendarMonthsClamped(value: string, months: number) {
  const source = new Date(`${value}T00:00:00.000Z`)
  const targetMonthIndex = source.getUTCMonth() + months
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(source.getUTCDate(), lastTargetDay)))
    .toISOString()
    .slice(0, 10)
}

function nextCalendarDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function buildRollingDailyCurrentHorizonConfigurationId(forecastOrigin: string) {
  const anchorTargetDates = Object.fromEntries(
    Object.entries(ROLLING_DAILY_ANCHOR_HORIZONS).map(([label, months]) => [
      label,
      addCalendarMonthsClamped(forecastOrigin, months),
    ]),
  )

  return JSON.stringify({
    maxHorizonMonths: 12,
    anchorTargetDates,
    path: {
      startDate: nextCalendarDay(forecastOrigin),
      endDate: anchorTargetDates['12M'],
      calendarDateInclusion: 'EVERY_CALENDAR_DATE',
    },
    projectionCalendarStrategy: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
  })
}

function latestLawfulObservationDate(history: RollingDailyHistoryPayload) {
  const seenDates = new Set<string>()
  const dates = history.points
    .filter(({ value }) => value !== null)
    .map(({ date }) => normalizeDailyObservationDay(date))
    .sort()
    .filter((date) => {
      if (seenDates.has(date)) return false
      seenDates.add(date)
      return true
    })
  const latest = dates.at(-1)
  if (!latest) {
    throw new Error(`Current single-flight identity requires lawful Daily history for ${history.seriesId}.`)
  }
  return latest
}

export async function prepareRollingDailyCurrentOwnership(input: {
  seriesId: string
  modelId: string
  loadHistory?: (seriesId: string) => Promise<RollingDailyHistoryPayload>
}) {
  const history = await (input.loadHistory ?? loadRollingDailyHistory)(input.seriesId)
  if (history.frequency.trim().toUpperCase() !== 'DAILY') {
    throw new Error(`Rolling Daily Current ownership requires DAILY history for ${input.seriesId}.`)
  }
  const forecastOrigin = latestLawfulObservationDate(history)
  const identity = {
    seriesId: input.seriesId,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: input.modelId,
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    historyFingerprint: buildRollingDailyHistoryFingerprint(history),
    sourceFrequency: 'DAILY',
    targetCadence: 'DAILY',
    frequencyIdentity: 'FORECAST_CADENCE_V1|source=DAILY|target=DAILY',
    forecastOrigin,
    horizonConfigurationId: buildRollingDailyCurrentHorizonConfigurationId(forecastOrigin),
  } satisfies CurrentLogicalArtifactIdentity

  return {
    history,
    identity,
    logicalArtifactKey: buildCurrentLogicalArtifactKey(identity),
  }
}