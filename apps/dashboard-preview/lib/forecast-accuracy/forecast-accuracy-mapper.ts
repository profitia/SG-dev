import type {
  ForecastAccuracyBaseResponse,
  ForecastAccuracyCoverage,
  ForecastAccuracyHorizonMonths,
  ForecastAccuracyPoint,
  ForecastAccuracySourceInfo,
} from './forecast-accuracy-contract'

export interface ForecastAccuracyRecordSource {
  id: string
  organizationId: string
  sourceId: string
  datasetId: string
  pipelineId: string
  latestRunId: string
  dedupeKey: string
  benchmarkCode: string
  sourceTableName: string
  orgTableName: string | null
  targetDate: Date | string
  horizonMonths: number
  actualValue: { toString(): string } | number | string | null
  forecastValue: { toString(): string } | number | string | null
  differenceValue: { toString(): string } | number | string | null
  errorType: string | null
  duplicateStatus: string | null
  rawRecordCount: number
  duplicateCount: number
  lineageJson: unknown
  metadataJson: unknown
  lastSyncedAt: Date | string
}

function normalizeNumber(value: ForecastAccuracyRecordSource['actualValue']): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (typeof value === 'object' && value !== null && 'toString' in value && typeof value.toString === 'function') {
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeMonthKey(value: string): number | null {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

export function buildAvailableHorizons(records: ForecastAccuracyRecordSource[]): ForecastAccuracyHorizonMonths[] {
  const horizons = new Set<ForecastAccuracyHorizonMonths>()

  for (const record of records) {
    if (normalizeNumber(record.forecastValue) === null) {
      continue
    }

    if (record.horizonMonths === 1 || record.horizonMonths === 3 || record.horizonMonths === 6 || record.horizonMonths === 12) {
      horizons.add(record.horizonMonths)
    }
  }

  return Array.from(horizons).sort((left, right) => left - right)
}

export function sortForecastAccuracyRecordsByTargetDate(records: ForecastAccuracyRecordSource[]): ForecastAccuracyRecordSource[] {
  return [...records].sort((left, right) => {
    const leftDate = normalizeIsoString(left.targetDate) ?? new Date(0).toISOString()
    const rightDate = normalizeIsoString(right.targetDate) ?? new Date(0).toISOString()

    if (leftDate === rightDate) {
      return left.id.localeCompare(right.id)
    }

    return leftDate.localeCompare(rightDate)
  })
}

export function toForecastAccuracyPoint(record: ForecastAccuracyRecordSource): ForecastAccuracyPoint | null {
  const targetDate = normalizeIsoString(record.targetDate)
  const forecastValue = normalizeNumber(record.forecastValue)

  if (!targetDate || forecastValue === null) {
    return null
  }

  return {
    targetDate,
    actualValue: normalizeNumber(record.actualValue),
    forecastValue,
    sourceDifferenceValue: normalizeNumber(record.differenceValue),
    sourceErrorType: record.errorType ?? null,
  }
}

export function buildForecastAccuracySourceInfo(records: ForecastAccuracyRecordSource[]): ForecastAccuracySourceInfo {
  const latest = [...records].sort((left, right) => {
    const leftSyncedAt = normalizeIsoString(left.lastSyncedAt) ?? new Date(0).toISOString()
    const rightSyncedAt = normalizeIsoString(right.lastSyncedAt) ?? new Date(0).toISOString()
    return rightSyncedAt.localeCompare(leftSyncedAt)
  })[0] ?? null

  return {
    sourceTableName: latest?.sourceTableName ?? null,
    sourceBusinessName: latest?.orgTableName ?? latest?.sourceTableName ?? null,
    latestRunId: latest?.latestRunId ?? null,
    lastSyncedAt: latest ? normalizeIsoString(latest.lastSyncedAt) : null,
  }
}

export function buildForecastAccuracyCoverage(points: ForecastAccuracyPoint[]): ForecastAccuracyCoverage {
  if (points.length === 0) {
    return {
      firstDate: null,
      lastDate: null,
      pointCount: 0,
      missingPointCount: null,
    }
  }

  const firstDate = points[0]?.targetDate ?? null
  const lastDate = points[points.length - 1]?.targetDate ?? null
  const monthKeys = points.map((point) => normalizeMonthKey(point.targetDate)).filter((value): value is number => value !== null)

  let missingPointCount: number | null = null

  if (monthKeys.length === points.length && firstDate && lastDate) {
    const first = normalizeMonthKey(firstDate)
    const last = normalizeMonthKey(lastDate)
    const isMonthly = points.every((point) => {
      const date = new Date(point.targetDate)
      return date.getUTCDate() === 1
        && date.getUTCHours() === 0
        && date.getUTCMinutes() === 0
        && date.getUTCSeconds() === 0
        && date.getUTCMilliseconds() === 0
    })

    if (isMonthly && first !== null && last !== null && last >= first) {
      const expectedCount = last - first + 1
      missingPointCount = Math.max(0, expectedCount - new Set(monthKeys).size)
    }
  }

  return {
    firstDate,
    lastDate,
    pointCount: points.length,
    missingPointCount,
  }
}

export function buildForecastAccuracyBaseResponse(input: {
  componentName: string | null
  benchmarkCode: string
  horizonMonths: ForecastAccuracyHorizonMonths | null
  availableHorizons: ForecastAccuracyHorizonMonths[]
  points: ForecastAccuracyPoint[]
  sourceInfo: ForecastAccuracySourceInfo
  coverage: ForecastAccuracyCoverage
}): ForecastAccuracyBaseResponse {
  return {
    selection: {
      componentName: input.componentName,
      benchmarkCode: input.benchmarkCode,
      horizonMonths: input.horizonMonths,
    },
    availableHorizons: input.availableHorizons,
    points: input.points,
    sourceInfo: input.sourceInfo,
    coverage: input.coverage,
  }
}