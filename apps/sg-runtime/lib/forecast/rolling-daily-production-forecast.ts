import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { z } from 'zod'

import { getMarketDataPrisma } from '@/lib/market-data/client'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'
import { serverEnv } from '@/lib/env'
import type { ForecastTargetBasis } from '@/lib/forecast/contracts'
import {
  ROLLING_DAILY_INSUFFICIENT_TECHNICAL_TRAINING_REASON,
  ROLLING_DAILY_METHODOLOGICAL_CALIBRATION_MINIMUM_STATUS,
  ROLLING_DAILY_TARGET_BASIS,
  ROLLING_DAILY_METHODOLOGICAL_TRAINING_ELIGIBILITY_STATUS,
  ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
} from '@/lib/forecast/rolling-daily-policy'
import {
  buildRollingDailyHistoryFingerprint,
  DEFAULT_ROLLING_DAILY_MINIMUM_CALIBRATION_SAMPLES,
  DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  type RollingDailyHistoryPayload,
  type RollingDailyCalibrationGroupArtifact,
  type RollingDailyMaintenanceStateArtifact,
} from '@/lib/forecast/rolling-daily-maintenance'

const execFileAsync = promisify(execFile)
const DEFAULT_FORECASTING_LAB_ROOT = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting')
const DEFAULT_FORECASTING_PYTHON = path.join(DEFAULT_FORECASTING_LAB_ROOT, '.venv', 'bin', 'python')
const ROLLING_DAILY_CURRENT_FORECAST_SCRIPT = ['scripts', 'export_rolling_daily_current_forecast.py']
const BRIDGE_BUFFER_BYTES = 25 * 1024 * 1024

export const ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION = '1'
export const ROLLING_DAILY_PREDICTION_BAND_COVERAGE_LABEL = '80% empirical prediction band'
export const ROLLING_DAILY_QUANTILE_CONVENTION = 'HF7_LINEAR_INTERPOLATION'

export const RollingDailyProductionReasonCodeSchema = z.enum([
  'INSUFFICIENT_CALIBRATION_HISTORY',
  'CALIBRATION_NOT_AVAILABLE',
  'CALIBRATION_STALE',
  'BEFORE_FIRST_EMPIRICAL_ANCHOR',
  'INSUFFICIENT_ANCHOR_CALIBRATION',
  'MODEL_UNAVAILABLE',
  'MODEL_FIT_FAILED',
  'INSUFFICIENT_TECHNICAL_TRAINING_HISTORY',
  'METHOD_NOT_ELIGIBLE',
  'SOURCE_DATA_UNAVAILABLE',
  'UNSUPPORTED_FREQUENCY',
])

export const RollingDailyProductionWarningCodeSchema = z.enum([
  'CALIBRATION_STALE',
  'PARTIAL_BAND_AVAILABILITY',
])

const RollingDailyContractBandSourceSchema = z.enum([
  'EMPIRICAL_ANCHOR',
  'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS',
])

const RollingDailyContractBandBaseSchema = z.object({
  status: z.enum(['AVAILABLE', 'NOT_AVAILABLE']),
  reasonCode: RollingDailyProductionReasonCodeSchema.nullable(),
  source: RollingDailyContractBandSourceSchema.nullable(),
  lower: z.number().nullable(),
  upper: z.number().nullable(),
})

const RollingDailyContractBandSchema = RollingDailyContractBandBaseSchema.superRefine((value, context) => {
  if (value.status === 'AVAILABLE') {
    if (value.lower === null || value.upper === null || value.source === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AVAILABLE band requires lower, upper, and source.',
      })
      return
    }

    if (value.reasonCode !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AVAILABLE band cannot carry a reasonCode.',
      })
    }

    if (value.lower > value.upper) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AVAILABLE band must satisfy lower <= upper.',
      })
    }

    return
  }

  if (value.lower !== null || value.upper !== null || value.source !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'NOT_AVAILABLE band cannot expose lower, upper, or source.',
    })
  }

  if (value.reasonCode === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'NOT_AVAILABLE band requires a reasonCode.',
    })
  }
})

const RollingDailyProductionPathPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pointForecast: z.number(),
  band: RollingDailyContractBandSchema,
})

const RollingDailyProductionAnchorSchema = z.object({
  horizon: z.enum(['1M', '3M', '6M', '12M']),
  horizonMonths: z.number().int().positive(),
  targetCalendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pointForecast: z.number(),
  band: RollingDailyContractBandBaseSchema.extend({
    sampleCount: z.number().int().nonnegative().nullable(),
    p10ResidualOffset: z.number().nullable(),
    p90ResidualOffset: z.number().nullable(),
  }).superRefine((value, context) => {
    RollingDailyContractBandSchema.safeParse(value).success || context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Anchor band must satisfy the rolling-daily band contract.',
    })
  }),
})

const RollingDailyProductionWarningSchema = z.object({
  code: RollingDailyProductionWarningCodeSchema,
  message: z.string().nullable(),
})

const RollingDailyProductionCalibrationSchema = z.object({
  availabilityStatus: z.enum(['AVAILABLE', 'INSUFFICIENT_CALIBRATION_HISTORY', 'NOT_AVAILABLE']),
  freshnessStatus: z.enum(['FRESH', 'STALE']).nullable(),
  quantileConvention: z.string(),
  coverageLabel: z.string(),
  methodologicalMinimumStatus: z.string(),
  updatedAt: z.string().datetime().nullable(),
  processedThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  lastResidualAvailabilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

const RollingDailyProductionBenchmarkSchema = z.object({
  benchmarkId: z.string(),
  displayName: z.string(),
  frequency: z.literal('DAILY'),
  unit: z.string().nullable(),
  currency: z.string().nullable(),
  provider: z.string().nullable(),
  providerSeriesId: z.string().nullable(),
})

const RollingDailyProductionMethodSchema = z.object({
  id: z.literal(ROLLING_DAILY_METHOD_ID),
  version: z.string(),
})

const RollingDailyProductionModelSchema = z.object({
  id: z.string(),
  selectedCandidate: z.string().nullable(),
  selectionMetric: z.string().nullable(),
  selectionScore: z.number().nullable(),
  selectedParameters: z.record(z.string(), z.unknown()).nullable(),
})

const RollingDailyProductionOriginSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
})

const RollingDailyProductionAuditSchema = z.object({
  generatedAt: z.string().datetime(),
  sourceLatestObservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calendarProjectionMode: z.string(),
  projectionCalendarStrategy: z.string(),
  technicalMinimumTrainingObservations: z.number().int().positive(),
  methodologicalTrainingEligibilityStatus: z.string(),
  calibrationUpdatedAt: z.string().datetime().nullable(),
  calibrationLastResidualAvailabilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  inputSource: z.string(),
  sourceHistoryFingerprint: z.string().nullable(),
})

export const RollingDailyProductionForecastAvailableSchema = z.object({
  contractVersion: z.literal(ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION),
  status: z.literal('AVAILABLE'),
  benchmark: RollingDailyProductionBenchmarkSchema,
  forecastMethod: RollingDailyProductionMethodSchema,
  model: RollingDailyProductionModelSchema,
  origin: RollingDailyProductionOriginSchema,
  maxHorizonMonths: z.literal(12),
  anchors: z.array(RollingDailyProductionAnchorSchema).length(4),
  path: z.array(RollingDailyProductionPathPointSchema).min(1),
  calibration: RollingDailyProductionCalibrationSchema,
  audit: RollingDailyProductionAuditSchema,
  warnings: z.array(RollingDailyProductionWarningSchema),
}).superRefine((value, context) => {
  const anchorDates = new Map(value.anchors.map((anchor) => [anchor.targetCalendarDate, anchor]))
  for (const [index, point] of value.path.entries()) {
    const anchor = anchorDates.get(point.date)
    if (!anchor) {
      continue
    }

    if (anchor.pointForecast !== point.pointForecast) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Anchor/path pointForecast mismatch at ${point.date}.`,
        path: ['path', index, 'pointForecast'],
      })
    }

    if (JSON.stringify(anchor.band) !== JSON.stringify({
      ...point.band,
      sampleCount: anchor.band.sampleCount,
      p10ResidualOffset: anchor.band.p10ResidualOffset,
      p90ResidualOffset: anchor.band.p90ResidualOffset,
    })) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Anchor/path band mismatch at ${point.date}.`,
        path: ['path', index, 'band'],
      })
    }
  }

  const lastPathPoint = value.path[value.path.length - 1]
  const anchor12m = value.anchors.find((anchor) => anchor.horizon === '12M')
  if (anchor12m && lastPathPoint?.date !== anchor12m.targetCalendarDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Path must terminate at the exact 12M anchor date.',
      path: ['path'],
    })
  }
})

export const RollingDailyProductionForecastUnavailableSchema = z.object({
  contractVersion: z.literal(ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION),
  status: z.enum(['NOT_AVAILABLE', 'FAILED']),
  benchmark: RollingDailyProductionBenchmarkSchema,
  forecastMethod: RollingDailyProductionMethodSchema,
  model: RollingDailyProductionModelSchema,
  reasonCode: RollingDailyProductionReasonCodeSchema,
  message: z.string().nullable(),
  audit: RollingDailyProductionAuditSchema.partial({
    sourceLatestObservationDate: true,
    calendarProjectionMode: true,
    calibrationUpdatedAt: true,
    calibrationLastResidualAvailabilityDate: true,
    inputSource: true,
  }).extend({
    generatedAt: z.string().datetime(),
    sourceLatestObservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    calendarProjectionMode: z.string().nullable(),
    calibrationUpdatedAt: z.string().datetime().nullable(),
    calibrationLastResidualAvailabilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    inputSource: z.string().nullable(),
  }),
  warnings: z.array(RollingDailyProductionWarningSchema),
})

export const RollingDailyProductionForecastResultSchema = z.union([
  RollingDailyProductionForecastAvailableSchema,
  RollingDailyProductionForecastUnavailableSchema,
])

export type RollingDailyProductionReasonCode = z.infer<typeof RollingDailyProductionReasonCodeSchema>
export type RollingDailyProductionForecastResult = z.infer<typeof RollingDailyProductionForecastResultSchema>

type RollingDailyProductionHistoryPoint = {
  date: string
  value: number | null
}

type RollingDailyProductionHistoryPayload = {
  seriesId: string
  displayName: string
  description: string | null
  frequency: string
  source: string | null
  points: RollingDailyProductionHistoryPoint[]
}

type RollingDailyCurrentForecastBridgeCalibrationGroup = {
  horizonLabel: string
  horizonMonths: number
  sampleCount: number
  residualP10: number | null
  residualP90: number | null
  status: 'AVAILABLE' | 'INSUFFICIENT_CALIBRATION_HISTORY'
}

type RollingDailyCurrentForecastBridgeRequest = {
  seriesId: string
  modelId: string
  methodId: string
  methodVersion: string
  minimumTrainingObservations: number
  minimumCalibrationSamples: number
  history: RollingDailyProductionHistoryPayload
  calibrationGroups: RollingDailyCurrentForecastBridgeCalibrationGroup[]
}

type RollingDailyCurrentForecastBridgeBandSource = 'EMPIRICAL_ANCHOR' | 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS'
type RollingDailyCurrentForecastBridgeBandStatus =
  | 'AVAILABLE'
  | 'INSUFFICIENT_CALIBRATION_HISTORY'
  | 'NOT_AVAILABLE'
  | 'NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR'
  | 'NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION'

type RollingDailyCurrentForecastBridgePathPoint = {
  date: string
  pointForecast: number
  lowerP10: number | null
  upperP90: number | null
  bandStatus: RollingDailyCurrentForecastBridgeBandStatus
  bandSource: RollingDailyCurrentForecastBridgeBandSource | null
  p10ResidualOffset: number | null
  p90ResidualOffset: number | null
}

type RollingDailyCurrentForecastBridgeAnchor = {
  horizon: '1M' | '3M' | '6M' | '12M'
  horizonMonths: number
  targetCalendarDate: string
  pointForecast: number
  lowerP10: number | null
  upperP90: number | null
  bandStatus: RollingDailyCurrentForecastBridgeBandStatus
  bandSource: RollingDailyCurrentForecastBridgeBandSource | null
  p10ResidualOffset: number | null
  p90ResidualOffset: number | null
}

type RollingDailyCurrentForecastBridgeResponse = {
  status: 'AVAILABLE' | 'UNSUPPORTED_FREQUENCY' | 'INSUFFICIENT_HISTORY' | 'MODEL_NOT_AVAILABLE' | 'FAILED'
  reason?: string
  methodId: string
  methodVersion: string
  modelId: string
  sourceHistory: {
    startDate: string | null
    latestObservationDate: string | null
    observationCount: number
    filteredNullCount: number
    filteredDuplicateCount: number
  }
  currentForecast: {
    originDate: string | null
    calendarProjectionMode: string | null
    maxHorizonMonths: number
    selectedCandidate: string | null
    selectionMetric: string | null
    selectionScore: number | null
    selectedParameters: Record<string, unknown> | null
    path: RollingDailyCurrentForecastBridgePathPoint[]
    anchors: RollingDailyCurrentForecastBridgeAnchor[]
  }
}

type RollingDailyProductionBenchmarkContext = {
  benchmark: {
    benchmarkId: string
    displayName: string
    frequency: 'DAILY'
    unit: string | null
    currency: string | null
    provider: string | null
    providerSeriesId: string | null
  }
  history: RollingDailyProductionHistoryPayload
  sourceLatestObservationDate: string | null
  sourceLatestObservationValue: number | null
}

export type RollingDailyProductionForecastRequest = {
  seriesId: string
  modelId: string
  targetBasis?: ForecastTargetBasis
  minimumTrainingObservations?: number
  minimumCalibrationSamples?: number
  preparedHistory?: RollingDailyHistoryPayload
}

type RollingDailyProductionCalibrationAuthority = {
  groups: RollingDailyCalibrationGroupArtifact[]
  state: RollingDailyMaintenanceStateArtifact | null
}

export type RollingDailyProductionForecastRepository = {
  readCalibrationAuthority(identity: RollingDailyProductionIdentity): Promise<RollingDailyProductionCalibrationAuthority>
}

export type RollingDailyCurrentForecastRunner = {
  run(request: RollingDailyCurrentForecastBridgeRequest): Promise<RollingDailyCurrentForecastBridgeResponse>
}

type RollingDailyProductionIdentity = {
  seriesId: string
  inputSource: string
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: string
}

type RollingDailyProductionForecastDependencies = {
  repository: RollingDailyProductionForecastRepository
  runner: RollingDailyCurrentForecastRunner
  loadBenchmarkContext: (seriesId: string) => Promise<RollingDailyProductionBenchmarkContext>
  now: () => Date
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function toIsoDateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null
}

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

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function differenceInUtcDays(left: string, right: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((toUtcDate(left).getTime() - toUtcDate(right).getTime()) / millisecondsPerDay)
}

function inferSupportedWeekdays(points: RollingDailyProductionHistoryPoint[]) {
  const weekdays = [...new Set(points.map((point) => toUtcDate(point.date).getUTCDay()))].sort((left, right) => left - right)
  if (weekdays.length === 0) {
    throw new Error('Cannot infer lawful DAILY projection weekdays from an empty history.')
  }
  return weekdays
}

function buildProjectedStepCounts(
  originDate: string,
  maxTargetDate: string,
  supportedWeekdays: number[],
) {
  const calendarDates: string[] = []
  const stepCounts = new Map<string, number>()
  const supportedWeekdaySet = new Set(supportedWeekdays)
  let current = nextCalendarDay(originDate)
  let stepCount = 0

  while (current <= maxTargetDate) {
    if (supportedWeekdaySet.has(toUtcDate(current).getUTCDay())) {
      stepCount += 1
    }
    calendarDates.push(current)
    stepCounts.set(current, stepCount)
    current = nextCalendarDay(current)
  }

  return { calendarDates, stepCounts }
}

function buildBenchmarkContextFromPreparedHistory(history: RollingDailyHistoryPayload): RollingDailyProductionBenchmarkContext {
  const lawfulPoints = history.points
    .filter((point): point is { date: string; value: number } => point.value !== null)
    .sort((left, right) => normalizeDailyObservationDay(left.date).localeCompare(normalizeDailyObservationDay(right.date)))

  const latestLawfulPoint = lawfulPoints.at(-1) ?? null

  return {
    benchmark: {
      benchmarkId: history.seriesId,
      displayName: history.displayName,
      frequency: 'DAILY',
      unit: null,
      currency: null,
      provider: history.source,
      providerSeriesId: history.seriesId,
    },
    history,
    sourceLatestObservationDate: latestLawfulPoint ? normalizeDailyObservationDay(latestLawfulPoint.date) : null,
    sourceLatestObservationValue: latestLawfulPoint?.value ?? null,
  }
}

function normalizePreparedHistoryForNaiveCurrent(input: {
  history: RollingDailyHistoryPayload
  minimumTrainingObservations: number
}): {
  status: 'AVAILABLE'
  sourceHistory: RollingDailyCurrentForecastBridgeResponse['sourceHistory']
  originDate: string
  originValue: number
  points: Array<{ date: string; value: number }>
} | {
  status: 'UNSUPPORTED_FREQUENCY' | 'INSUFFICIENT_HISTORY' | 'FAILED'
  reason: string
  sourceHistory: RollingDailyCurrentForecastBridgeResponse['sourceHistory']
} {
  const pointsPayload = input.history.points
  const sortedPoints = [...pointsPayload].sort((left, right) => normalizeDailyObservationDay(left.date).localeCompare(normalizeDailyObservationDay(right.date)))
  const seenDates = new Set<string>()
  let filteredNullCount = 0
  let filteredDuplicateCount = 0
  const points: Array<{ date: string; value: number }> = []

  for (const point of sortedPoints) {
    const date = normalizeDailyObservationDay(point.date)
    if (point.value === null) {
      filteredNullCount += 1
      continue
    }
    if (!Number.isFinite(point.value)) {
      return {
        status: 'FAILED',
        reason: `Non-finite DAILY value encountered on ${date}.`,
        sourceHistory: {
          startDate: null,
          latestObservationDate: null,
          observationCount: 0,
          filteredNullCount,
          filteredDuplicateCount,
        },
      }
    }
    if (seenDates.has(date)) {
      filteredDuplicateCount += 1
      continue
    }
    seenDates.add(date)
    points.push({ date, value: point.value })
  }

  const sourceHistory = {
    startDate: points[0]?.date ?? null,
    latestObservationDate: points.at(-1)?.date ?? null,
    observationCount: points.length,
    filteredNullCount,
    filteredDuplicateCount,
  }

  if (input.history.frequency.trim().toUpperCase() !== 'DAILY') {
    return {
      status: 'UNSUPPORTED_FREQUENCY',
      reason: 'UNSUPPORTED_FREQUENCY',
      sourceHistory,
    }
  }

  if (points.length === 0) {
    return {
      status: 'FAILED',
      reason: 'SOURCE_DATA_UNAVAILABLE: No lawful numeric DAILY observations are available for the requested benchmark.',
      sourceHistory,
    }
  }

  if (points.length < input.minimumTrainingObservations) {
    return {
      status: 'INSUFFICIENT_HISTORY',
      reason: `INSUFFICIENT_HISTORY: ${points.length} observations remain after filtering.`,
      sourceHistory,
    }
  }

  return {
    status: 'AVAILABLE',
    sourceHistory,
    originDate: points[points.length - 1]!.date,
    originValue: points[points.length - 1]!.value,
    points,
  }
}

function isAvailableCalibrationGroup(
  group: RollingDailyCurrentForecastBridgeCalibrationGroup | undefined,
): group is RollingDailyCurrentForecastBridgeCalibrationGroup & { residualP10: number; residualP90: number } {
  return group?.status === 'AVAILABLE' && group.residualP10 !== null && group.residualP90 !== null
}

function requireAvailableCalibrationGroup(
  group: RollingDailyCurrentForecastBridgeCalibrationGroup | undefined,
): (RollingDailyCurrentForecastBridgeCalibrationGroup & { residualP10: number; residualP90: number }) | null {
  return isAvailableCalibrationGroup(group) ? group : null
}

function buildNaiveBand(input: {
  originDate: string
  targetDate: string
  pointForecast: number
  anchorDates: Record<'1M' | '3M' | '6M' | '12M', string>
  calibrationSummaries: Map<string, RollingDailyCurrentForecastBridgeCalibrationGroup>
  orderedHorizons: Array<['1M' | '3M' | '6M' | '12M', number]>
}): Omit<RollingDailyCurrentForecastBridgePathPoint, 'date' | 'pointForecast'> {
  const exactAnchor = input.orderedHorizons.find(([horizon]) => input.anchorDates[horizon] === input.targetDate)
  if (exactAnchor) {
    const [horizon] = exactAnchor
    const summary = input.calibrationSummaries.get(horizon)
    const availableSummary = requireAvailableCalibrationGroup(summary)
    if (!availableSummary) {
      return {
        lowerP10: null,
        upperP90: null,
        bandStatus: summary ? 'INSUFFICIENT_CALIBRATION_HISTORY' : 'NOT_AVAILABLE',
        bandSource: null,
        p10ResidualOffset: null,
        p90ResidualOffset: null,
      }
    }

    return {
      lowerP10: input.pointForecast + availableSummary.residualP10,
      upperP90: input.pointForecast + availableSummary.residualP90,
      bandStatus: 'AVAILABLE',
      bandSource: 'EMPIRICAL_ANCHOR',
      p10ResidualOffset: availableSummary.residualP10,
      p90ResidualOffset: availableSummary.residualP90,
    }
  }

  const [firstHorizon] = input.orderedHorizons[0]!
  const firstAnchorDate = input.anchorDates[firstHorizon]
  const firstSummary = requireAvailableCalibrationGroup(input.calibrationSummaries.get(firstHorizon))

  if (input.targetDate < firstAnchorDate) {
    if (input.originDate < input.targetDate && firstSummary) {
      const totalDays = differenceInUtcDays(firstAnchorDate, input.originDate)
      const elapsedDays = differenceInUtcDays(input.targetDate, input.originDate)
      const fraction = elapsedDays / totalDays
      const p10ResidualOffset = fraction * firstSummary.residualP10
      const p90ResidualOffset = fraction * firstSummary.residualP90
      return {
        lowerP10: input.pointForecast + p10ResidualOffset,
        upperP90: input.pointForecast + p90ResidualOffset,
        bandStatus: 'AVAILABLE',
        bandSource: 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS',
        p10ResidualOffset,
        p90ResidualOffset,
      }
    }

    return {
      lowerP10: null,
      upperP90: null,
      bandStatus: 'NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR',
      bandSource: null,
      p10ResidualOffset: null,
      p90ResidualOffset: null,
    }
  }

  for (let index = 0; index < input.orderedHorizons.length - 1; index += 1) {
    const [leftHorizon] = input.orderedHorizons[index]!
    const [rightHorizon] = input.orderedHorizons[index + 1]!
    const leftDate = input.anchorDates[leftHorizon]
    const rightDate = input.anchorDates[rightHorizon]
    if (!(leftDate < input.targetDate && input.targetDate < rightDate)) {
      continue
    }

    const leftSummary = requireAvailableCalibrationGroup(input.calibrationSummaries.get(leftHorizon))
    const rightSummary = requireAvailableCalibrationGroup(input.calibrationSummaries.get(rightHorizon))
    if (!leftSummary || !rightSummary) {
      return {
        lowerP10: null,
        upperP90: null,
        bandStatus: 'NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION',
        bandSource: null,
        p10ResidualOffset: null,
        p90ResidualOffset: null,
      }
    }

    const totalDays = differenceInUtcDays(rightDate, leftDate)
    const elapsedDays = differenceInUtcDays(input.targetDate, leftDate)
    const fraction = elapsedDays / totalDays
    const p10ResidualOffset = leftSummary.residualP10 + fraction * (rightSummary.residualP10 - leftSummary.residualP10)
    const p90ResidualOffset = leftSummary.residualP90 + fraction * (rightSummary.residualP90 - leftSummary.residualP90)
    return {
      lowerP10: input.pointForecast + p10ResidualOffset,
      upperP90: input.pointForecast + p90ResidualOffset,
      bandStatus: 'AVAILABLE',
      bandSource: 'INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS',
      p10ResidualOffset,
      p90ResidualOffset,
    }
  }

  return {
    lowerP10: null,
    upperP90: null,
    bandStatus: 'NOT_AVAILABLE',
    bandSource: null,
    p10ResidualOffset: null,
    p90ResidualOffset: null,
  }
}

function buildNaiveCurrentBridgeResponse(input: {
  history: RollingDailyHistoryPayload
  modelId: string
  methodId: string
  methodVersion: string
  minimumTrainingObservations: number
  calibrationGroups: RollingDailyCurrentForecastBridgeCalibrationGroup[]
}): RollingDailyCurrentForecastBridgeResponse {
  const normalized = normalizePreparedHistoryForNaiveCurrent({
    history: input.history,
    minimumTrainingObservations: input.minimumTrainingObservations,
  })

  if (normalized.status !== 'AVAILABLE') {
    return {
      status: normalized.status,
      reason: normalized.reason,
      methodId: input.methodId,
      methodVersion: input.methodVersion,
      modelId: input.modelId,
      sourceHistory: normalized.sourceHistory,
      currentForecast: {
        originDate: normalized.sourceHistory.latestObservationDate,
        calendarProjectionMode: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
        maxHorizonMonths: 12,
        selectedCandidate: null,
        selectionMetric: null,
        selectionScore: null,
        selectedParameters: {},
        path: [],
        anchors: [],
      },
    }
  }

  const orderedHorizons: Array<['1M' | '3M' | '6M' | '12M', number]> = [
    ['1M', 1],
    ['3M', 3],
    ['6M', 6],
    ['12M', 12],
  ]
  const anchorDates = Object.fromEntries(
    orderedHorizons.map(([horizon, months]) => [horizon, addCalendarMonthsClamped(normalized.originDate, months)]),
  ) as Record<'1M' | '3M' | '6M' | '12M', string>
  const maxTargetDate = anchorDates['12M']
  const supportedWeekdays = inferSupportedWeekdays(normalized.points)
  const { calendarDates, stepCounts } = buildProjectedStepCounts(normalized.originDate, maxTargetDate, supportedWeekdays)
  const calibrationSummaries = new Map(input.calibrationGroups.map((group) => [group.horizonLabel, group]))

  const path = calendarDates.map((targetDate) => {
    const band = buildNaiveBand({
      originDate: normalized.originDate,
      targetDate,
      pointForecast: normalized.originValue,
      anchorDates,
      calibrationSummaries,
      orderedHorizons,
    })
    return {
      date: targetDate,
      pointForecast: normalized.originValue,
      ...band,
    }
  })

  const anchors = orderedHorizons.map(([horizon, horizonMonths]) => {
    const targetDate = anchorDates[horizon]
    const band = buildNaiveBand({
      originDate: normalized.originDate,
      targetDate,
      pointForecast: normalized.originValue,
      anchorDates,
      calibrationSummaries,
      orderedHorizons,
    })

    return {
      horizon,
      horizonMonths,
      targetCalendarDate: targetDate,
      pointForecast: normalized.originValue,
      lowerP10: band.lowerP10,
      upperP90: band.upperP90,
      bandStatus: band.bandStatus,
      bandSource: band.bandSource,
      p10ResidualOffset: band.p10ResidualOffset,
      p90ResidualOffset: band.p90ResidualOffset,
      projectedStepCount: stepCounts.get(targetDate) ?? 0,
    }
  })

  return {
    status: 'AVAILABLE',
    methodId: input.methodId,
    methodVersion: input.methodVersion,
    modelId: input.modelId,
    sourceHistory: normalized.sourceHistory,
    currentForecast: {
      originDate: normalized.originDate,
      calendarProjectionMode: ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
      maxHorizonMonths: 12,
      selectedCandidate: 'NAIVE_LAST_VALUE',
      selectionMetric: null,
      selectionScore: null,
      selectedParameters: {},
      path,
      anchors,
    },
  }
}

function resolveRollingDailyBridgeConfiguration() {
  const labRoot = normalizeOptionalString(serverEnv.FORECASTING_LAB_ROOT) ?? DEFAULT_FORECASTING_LAB_ROOT
  const pythonBin = normalizeOptionalString(serverEnv.FORECASTING_PYTHON_BIN) ?? DEFAULT_FORECASTING_PYTHON
  const scriptPath = path.join(labRoot, ...ROLLING_DAILY_CURRENT_FORECAST_SCRIPT)

  if (!existsSync(labRoot)) {
    return { ok: false as const, reason: `Forecasting laboratory root is unavailable at ${labRoot}.` }
  }

  if (!existsSync(scriptPath)) {
    return { ok: false as const, reason: `Rolling daily current forecast bridge is unavailable at ${scriptPath}.` }
  }

  if (!existsSync(pythonBin)) {
    return { ok: false as const, reason: `Forecasting Python interpreter is unavailable at ${pythonBin}.` }
  }

  return { ok: true as const, labRoot, pythonBin, scriptPath }
}

function mapCalibrationGroup(record: any): RollingDailyCalibrationGroupArtifact {
  return {
    seriesId: record.seriesId,
    inputSource: record.inputSource,
    inputRunId: record.inputRunId,
    targetBasis: record.targetBasis,
    methodId: record.methodId,
    methodVersion: record.methodVersion,
    modelId: record.modelId,
    horizonLabel: record.horizonLabel,
    horizonMonths: record.horizonMonths,
    calibrationOriginAt: record.calibrationOriginAt.toISOString(),
    sampleCount: record.sampleCount,
    residualP10: record.residualP10 === null ? null : Number(record.residualP10),
    residualP90: record.residualP90 === null ? null : Number(record.residualP90),
    quantileMethod: record.quantileMethod,
    status: record.status,
    lastResidualObservedAt: record.lastResidualObservedAt?.toISOString() ?? null,
    refreshedAt: record.refreshedAt.toISOString(),
  }
}

function mapMaintenanceState(record: any): RollingDailyMaintenanceStateArtifact {
  return {
    seriesId: record.seriesId,
    inputSource: record.inputSource,
    inputRunId: record.inputRunId,
    targetBasis: record.targetBasis,
    methodId: record.methodId,
    methodVersion: record.methodVersion,
    modelId: record.modelId,
    historicalOriginStartAt: record.historicalOriginStartAt.toISOString(),
    minimumTrainingObservations: record.minimumTrainingObservations,
    minimumCalibrationSamples: record.minimumCalibrationSamples,
    latestSourceObservationAt: record.latestSourceObservationAt?.toISOString() ?? null,
    latestSourceHistoryStartAt: record.latestSourceHistoryStartAt?.toISOString() ?? null,
    latestSourceObservationCount: record.latestSourceObservationCount,
    latestSourceHistoryFingerprint: record.latestSourceHistoryFingerprint,
    lastProcessedOriginAt: record.lastProcessedOriginAt?.toISOString() ?? null,
    lastMaturedObservedAt: record.lastMaturedObservedAt?.toISOString() ?? null,
    lastMaintenanceAt: record.lastMaintenanceAt?.toISOString() ?? null,
    lastMaintenanceStatus: record.lastMaintenanceStatus,
    lastFailureReason: record.lastFailureReason,
  }
}

async function readCalibrationAuthorityWithPrisma(identity: RollingDailyProductionIdentity): Promise<RollingDailyProductionCalibrationAuthority> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    return {
      groups: [],
      state: null,
    }
  }

  const [groups, state] = await Promise.all([
    prisma.rollingDailyCalibrationGroup.findMany({
      where: identity,
      orderBy: [
        { horizonMonths: 'asc' },
        { horizonLabel: 'asc' },
      ],
    }),
    prisma.rollingDailyMaintenanceState.findUnique({
      where: {
        seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: identity,
      },
    }),
  ])

  return {
    groups: groups.map(mapCalibrationGroup),
    state: state ? mapMaintenanceState(state) : null,
  }
}

async function loadBenchmarkContextFromMarketData(seriesId: string): Promise<RollingDailyProductionBenchmarkContext> {
  const { history } = await resolveBenchmarkHistoricalSeries(seriesId, 'ALL')
  const lawfulPoints = history.historical.filter((point) => point.value !== null)
  const latestLawfulPoint = lawfulPoints[lawfulPoints.length - 1] ?? null

  return {
    benchmark: {
      benchmarkId: history.providerSeries.providerSeriesId,
      displayName: history.displayName,
      frequency: 'DAILY',
      unit: history.unit,
      currency: history.currency,
      provider: history.providerSeries.provider.providerCode,
      providerSeriesId: history.providerSeries.providerSeriesId,
    },
    history: {
      seriesId: history.providerSeries.providerSeriesId,
      displayName: history.displayName,
      description: history.displayName,
      frequency: history.frequency ?? 'DAILY',
      source: history.source,
      points: history.historical.map((point) => ({
        date: point.date,
        value: point.value,
      })),
    },
    sourceLatestObservationDate: latestLawfulPoint ? latestLawfulPoint.date.slice(0, 10) : null,
    sourceLatestObservationValue: latestLawfulPoint?.value ?? null,
  }
}

function createDefaultRepository(): RollingDailyProductionForecastRepository {
  return {
    readCalibrationAuthority(identity) {
      return readCalibrationAuthorityWithPrisma(identity)
    },
  }
}

function createDefaultRunner(): RollingDailyCurrentForecastRunner {
  return {
    async run(request) {
      const configuration = resolveRollingDailyBridgeConfiguration()
      if (!configuration.ok) {
        return {
          status: 'FAILED',
          reason: configuration.reason,
          methodId: request.methodId,
          methodVersion: request.methodVersion,
          modelId: request.modelId,
          sourceHistory: {
            startDate: null,
            latestObservationDate: null,
            observationCount: 0,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
          },
          currentForecast: {
            originDate: null,
            calendarProjectionMode: null,
            maxHorizonMonths: 12,
            selectedCandidate: null,
            selectionMetric: null,
            selectionScore: null,
            selectedParameters: null,
            path: [],
            anchors: [],
          },
        }
      }

      const tempDirectory = await mkdtemp(path.join(tmpdir(), 'sg-runtime-rolling-daily-current-'))
      const inputPath = path.join(tempDirectory, 'input.json')
      const outputPath = path.join(tempDirectory, 'output.json')

      try {
        await writeFile(inputPath, JSON.stringify(request), 'utf8')
        const { stderr } = await execFileAsync(
          configuration.pythonBin,
          [
            configuration.scriptPath,
            '--input-json',
            inputPath,
            '--output-json',
            outputPath,
          ],
          {
            cwd: configuration.labRoot,
            maxBuffer: BRIDGE_BUFFER_BYTES,
          },
        )

        const output = JSON.parse(await readFile(outputPath, 'utf8')) as RollingDailyCurrentForecastBridgeResponse
        if (output.status === 'FAILED' && stderr.trim().length > 0 && !output.reason) {
          output.reason = stderr.trim()
        }
        return output
      } finally {
        await rm(tempDirectory, { recursive: true, force: true })
      }
    },
  }
}

function mapUnavailableReasonCode(status: RollingDailyCurrentForecastBridgeResponse['status'], reason?: string): RollingDailyProductionReasonCode {
  if (status === 'UNSUPPORTED_FREQUENCY') {
    return 'UNSUPPORTED_FREQUENCY'
  }

  if (status === 'INSUFFICIENT_HISTORY') {
    return ROLLING_DAILY_INSUFFICIENT_TECHNICAL_TRAINING_REASON
  }

  if (status === 'MODEL_NOT_AVAILABLE') {
    return 'MODEL_UNAVAILABLE'
  }

  if (reason?.includes('SOURCE_DATA_UNAVAILABLE')) {
    return 'SOURCE_DATA_UNAVAILABLE'
  }

  return 'MODEL_FIT_FAILED'
}

function mapBandReasonCode(status: RollingDailyCurrentForecastBridgeBandStatus): RollingDailyProductionReasonCode | null {
  switch (status) {
    case 'AVAILABLE':
      return null
    case 'INSUFFICIENT_CALIBRATION_HISTORY':
      return 'INSUFFICIENT_CALIBRATION_HISTORY'
    case 'NOT_AVAILABLE':
      return 'CALIBRATION_NOT_AVAILABLE'
    case 'NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR':
      return 'BEFORE_FIRST_EMPIRICAL_ANCHOR'
    case 'NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION':
      return 'INSUFFICIENT_ANCHOR_CALIBRATION'
  }
}

function mapBand(point: {
  lowerP10: number | null
  upperP90: number | null
  bandStatus: RollingDailyCurrentForecastBridgeBandStatus
  bandSource: RollingDailyCurrentForecastBridgeBandSource | null
}) {
  if (point.bandStatus === 'AVAILABLE') {
    return {
      status: 'AVAILABLE' as const,
      reasonCode: null,
      source: point.bandSource,
      lower: point.lowerP10,
      upper: point.upperP90,
    }
  }

  return {
    status: 'NOT_AVAILABLE' as const,
    reasonCode: mapBandReasonCode(point.bandStatus),
    source: null,
    lower: null,
    upper: null,
  }
}

function deriveCalibrationAvailabilityStatus(groups: RollingDailyCalibrationGroupArtifact[]) {
  if (groups.length === 0) {
    return 'NOT_AVAILABLE' as const
  }

  if (groups.some((group) => group.status === 'AVAILABLE')) {
    return 'AVAILABLE' as const
  }

  if (groups.every((group) => group.status === 'INSUFFICIENT_CALIBRATION_HISTORY')) {
    return 'INSUFFICIENT_CALIBRATION_HISTORY' as const
  }

  return 'NOT_AVAILABLE' as const
}

function deriveCalibrationFreshnessStatus(
  groups: RollingDailyCalibrationGroupArtifact[],
  state: RollingDailyMaintenanceStateArtifact | null,
  sourceLatestObservationDate: string | null,
) {
  if (groups.length === 0) {
    return null
  }

  if (!state || !sourceLatestObservationDate) {
    return 'STALE' as const
  }

  const latestSourceDate = toIsoDateOnly(state.latestSourceObservationAt)
  const latestProcessedOrigin = toIsoDateOnly(state.lastProcessedOriginAt)
  const status = state.lastMaintenanceStatus

  if (status === 'SUCCEEDED' && latestSourceDate === sourceLatestObservationDate && latestProcessedOrigin === sourceLatestObservationDate) {
    return 'FRESH' as const
  }

  return 'STALE' as const
}

function maxDateTime(values: Array<string | null>) {
  const filtered = values.filter((value): value is string => value !== null)
  if (filtered.length === 0) {
    return null
  }
  return filtered.sort()[filtered.length - 1] ?? null
}

function maxDateOnly(values: Array<string | null>) {
  const filtered = values.filter((value): value is string => value !== null)
  if (filtered.length === 0) {
    return null
  }
  return filtered.sort()[filtered.length - 1] ?? null
}

function buildWarnings(
  calibrationGroups: RollingDailyCalibrationGroupArtifact[],
  freshnessStatus: 'FRESH' | 'STALE' | null,
) {
  const warnings: Array<{ code: 'CALIBRATION_STALE' | 'PARTIAL_BAND_AVAILABILITY'; message: string | null }> = []

  if (freshnessStatus === 'STALE') {
    warnings.push({
      code: 'CALIBRATION_STALE',
      message: 'Prepared calibration authority lags the latest lawful source observation, but last-good bands remain usable.',
    })
  }

  if (calibrationGroups.some((group) => group.status !== 'AVAILABLE') && calibrationGroups.some((group) => group.status === 'AVAILABLE')) {
    warnings.push({
      code: 'PARTIAL_BAND_AVAILABILITY',
      message: 'Some empirical anchor horizons remain unavailable while others are served.',
    })
  }

  return warnings
}

function mapAvailableResult(input: {
  benchmark: RollingDailyProductionBenchmarkContext['benchmark']
  benchmarkContext: RollingDailyProductionBenchmarkContext
  bridgeResponse: RollingDailyCurrentForecastBridgeResponse
  calibrationGroups: RollingDailyCalibrationGroupArtifact[]
  maintenanceState: RollingDailyMaintenanceStateArtifact | null
  sourceLatestObservationDate: string
  sourceLatestObservationValue: number
  generatedAt: string
}) {
  const calibrationAvailabilityStatus = deriveCalibrationAvailabilityStatus(input.calibrationGroups)
  const freshnessStatus = deriveCalibrationFreshnessStatus(
    input.calibrationGroups,
    input.maintenanceState,
    input.sourceLatestObservationDate,
  )
  const calibrationGroupsByHorizon = new Map(input.calibrationGroups.map((group) => [group.horizonLabel, group]))

  const path = input.bridgeResponse.currentForecast.path.map((point) => ({
    date: point.date,
    pointForecast: point.pointForecast,
    band: mapBand(point),
  }))

  const anchors = input.bridgeResponse.currentForecast.anchors.map((anchor) => {
    const group = calibrationGroupsByHorizon.get(anchor.horizon) ?? null
    return {
      horizon: anchor.horizon,
      horizonMonths: anchor.horizonMonths,
      targetCalendarDate: anchor.targetCalendarDate,
      pointForecast: anchor.pointForecast,
      band: {
        ...mapBand(anchor),
        sampleCount: group?.sampleCount ?? null,
        p10ResidualOffset: anchor.p10ResidualOffset,
        p90ResidualOffset: anchor.p90ResidualOffset,
      },
    }
  })

  const result = {
    contractVersion: ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION,
    status: 'AVAILABLE' as const,
    benchmark: input.benchmark,
    forecastMethod: {
      id: ROLLING_DAILY_METHOD_ID,
      version: input.bridgeResponse.methodVersion,
    },
    model: {
      id: input.bridgeResponse.modelId,
      selectedCandidate: input.bridgeResponse.currentForecast.selectedCandidate,
      selectionMetric: input.bridgeResponse.currentForecast.selectionMetric,
      selectionScore: input.bridgeResponse.currentForecast.selectionScore,
      selectedParameters: input.bridgeResponse.currentForecast.selectedParameters,
    },
    origin: {
      date: input.bridgeResponse.currentForecast.originDate ?? input.sourceLatestObservationDate,
      value: input.sourceLatestObservationValue,
    },
    maxHorizonMonths: 12 as const,
    anchors,
    path,
    calibration: {
      availabilityStatus: calibrationAvailabilityStatus,
      freshnessStatus,
      quantileConvention: ROLLING_DAILY_QUANTILE_CONVENTION,
      coverageLabel: ROLLING_DAILY_PREDICTION_BAND_COVERAGE_LABEL,
      methodologicalMinimumStatus: ROLLING_DAILY_METHODOLOGICAL_CALIBRATION_MINIMUM_STATUS,
      updatedAt: maxDateTime(input.calibrationGroups.map((group) => group.refreshedAt)),
      processedThrough: toIsoDateOnly(input.maintenanceState?.latestSourceObservationAt ?? null),
      lastResidualAvailabilityDate: maxDateOnly(input.calibrationGroups.map((group) => toIsoDateOnly(group.lastResidualObservedAt))),
    },
    audit: {
      generatedAt: input.generatedAt,
      sourceLatestObservationDate: input.sourceLatestObservationDate,
      calendarProjectionMode: input.bridgeResponse.currentForecast.calendarProjectionMode ?? ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
      projectionCalendarStrategy: input.bridgeResponse.currentForecast.calendarProjectionMode ?? ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY,
      technicalMinimumTrainingObservations: input.maintenanceState?.minimumTrainingObservations ?? DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
      methodologicalTrainingEligibilityStatus: ROLLING_DAILY_METHODOLOGICAL_TRAINING_ELIGIBILITY_STATUS,
      calibrationUpdatedAt: maxDateTime(input.calibrationGroups.map((group) => group.refreshedAt)),
      calibrationLastResidualAvailabilityDate: maxDateOnly(input.calibrationGroups.map((group) => toIsoDateOnly(group.lastResidualObservedAt))),
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      sourceHistoryFingerprint: buildRollingDailyHistoryFingerprint(input.benchmarkContext.history),
    },
    warnings: buildWarnings(input.calibrationGroups, freshnessStatus),
  }

  return RollingDailyProductionForecastAvailableSchema.parse(result)
}

function mapUnavailableResult(input: {
  benchmark: RollingDailyProductionBenchmarkContext['benchmark']
  benchmarkContext: RollingDailyProductionBenchmarkContext
  bridgeResponse: RollingDailyCurrentForecastBridgeResponse
  generatedAt: string
  sourceLatestObservationDate: string | null
}) {
  return RollingDailyProductionForecastUnavailableSchema.parse({
    contractVersion: ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION,
    status: input.bridgeResponse.status === 'FAILED' ? 'FAILED' : 'NOT_AVAILABLE',
    benchmark: input.benchmark,
    forecastMethod: {
      id: ROLLING_DAILY_METHOD_ID,
      version: input.bridgeResponse.methodVersion,
    },
    model: {
      id: input.bridgeResponse.modelId,
      selectedCandidate: null,
      selectionMetric: input.bridgeResponse.currentForecast.selectionMetric,
      selectionScore: input.bridgeResponse.currentForecast.selectionScore,
      selectedParameters: input.bridgeResponse.currentForecast.selectedParameters,
    },
    reasonCode: mapUnavailableReasonCode(input.bridgeResponse.status, input.bridgeResponse.reason),
    message: input.bridgeResponse.reason ?? null,
    audit: {
      generatedAt: input.generatedAt,
      sourceLatestObservationDate: input.sourceLatestObservationDate,
      calendarProjectionMode: input.bridgeResponse.currentForecast.calendarProjectionMode,
      projectionCalendarStrategy: input.bridgeResponse.currentForecast.calendarProjectionMode,
      technicalMinimumTrainingObservations: DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
      methodologicalTrainingEligibilityStatus: ROLLING_DAILY_METHODOLOGICAL_TRAINING_ELIGIBILITY_STATUS,
      calibrationUpdatedAt: null,
      calibrationLastResidualAvailabilityDate: null,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      sourceHistoryFingerprint: buildRollingDailyHistoryFingerprint(input.benchmarkContext.history),
    },
    warnings: [],
  })
}

export function createRollingDailyProductionForecastService(
  dependencies: Partial<RollingDailyProductionForecastDependencies> = {},
) {
  const resolvedDependencies: RollingDailyProductionForecastDependencies = {
    repository: dependencies.repository ?? createDefaultRepository(),
    runner: dependencies.runner ?? createDefaultRunner(),
    loadBenchmarkContext: dependencies.loadBenchmarkContext ?? loadBenchmarkContextFromMarketData,
    now: dependencies.now ?? (() => new Date()),
  }

  return {
    async getRollingDailyProductionForecast(
      input: RollingDailyProductionForecastRequest,
    ): Promise<RollingDailyProductionForecastResult> {
      const targetBasis = input.targetBasis ?? ROLLING_DAILY_TARGET_BASIS
      const identity: RollingDailyProductionIdentity = {
        seriesId: input.seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: input.modelId,
      }

      const [benchmarkContext, calibrationAuthority] = await Promise.all([
        input.preparedHistory
          ? Promise.resolve(buildBenchmarkContextFromPreparedHistory(input.preparedHistory))
          : resolvedDependencies.loadBenchmarkContext(input.seriesId),
        resolvedDependencies.repository.readCalibrationAuthority(identity),
      ])

      const latestObservationDate = benchmarkContext.sourceLatestObservationDate
      const latestObservationValue = benchmarkContext.sourceLatestObservationValue
      const generatedAt = resolvedDependencies.now().toISOString()

      if (!latestObservationDate || latestObservationValue === null) {
        return RollingDailyProductionForecastUnavailableSchema.parse({
          contractVersion: ROLLING_DAILY_PRODUCTION_CONTRACT_VERSION,
          status: 'FAILED',
          benchmark: benchmarkContext.benchmark,
          forecastMethod: {
            id: ROLLING_DAILY_METHOD_ID,
            version: ROLLING_DAILY_METHOD_VERSION,
          },
          model: {
            id: input.modelId,
            selectedCandidate: null,
            selectionMetric: null,
            selectionScore: null,
            selectedParameters: null,
          },
          reasonCode: 'SOURCE_DATA_UNAVAILABLE',
          message: 'No lawful numeric DAILY observations are available for the requested benchmark.',
          audit: {
            generatedAt,
            sourceLatestObservationDate: null,
            calendarProjectionMode: null,
            projectionCalendarStrategy: null,
            technicalMinimumTrainingObservations: DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
            methodologicalTrainingEligibilityStatus: ROLLING_DAILY_METHODOLOGICAL_TRAINING_ELIGIBILITY_STATUS,
            calibrationUpdatedAt: null,
            calibrationLastResidualAvailabilityDate: null,
            inputSource: null,
            sourceHistoryFingerprint: buildRollingDailyHistoryFingerprint(benchmarkContext.history),
          },
          warnings: [],
        })
      }

      const bridgeRequest = {
        seriesId: input.seriesId,
        modelId: input.modelId,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        minimumTrainingObservations: input.minimumTrainingObservations ?? DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
        minimumCalibrationSamples: input.minimumCalibrationSamples ?? DEFAULT_ROLLING_DAILY_MINIMUM_CALIBRATION_SAMPLES,
        history: benchmarkContext.history,
        calibrationGroups: calibrationAuthority.groups.map((group) => ({
          horizonLabel: group.horizonLabel,
          horizonMonths: group.horizonMonths,
          sampleCount: group.sampleCount,
          residualP10: group.residualP10,
          residualP90: group.residualP90,
          status: group.status,
        })),
      }

      const bridgeResponse = input.modelId === 'naive' && input.preparedHistory
        ? buildNaiveCurrentBridgeResponse(bridgeRequest)
        : await resolvedDependencies.runner.run(bridgeRequest)

      if (bridgeResponse.status !== 'AVAILABLE') {
        return mapUnavailableResult({
          benchmark: benchmarkContext.benchmark,
          benchmarkContext,
          bridgeResponse,
          generatedAt,
          sourceLatestObservationDate: latestObservationDate,
        })
      }

      return mapAvailableResult({
        benchmark: benchmarkContext.benchmark,
        benchmarkContext,
        bridgeResponse,
        calibrationGroups: calibrationAuthority.groups,
        maintenanceState: calibrationAuthority.state,
        sourceLatestObservationDate: latestObservationDate,
        sourceLatestObservationValue: latestObservationValue,
        generatedAt,
      })
    },
  }
}