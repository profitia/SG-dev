import { getPrismaClient } from '@/lib/db/prisma'
import { listDashboardRecords } from '@/lib/raw-data/dashboard-record-query'
import { toBusinessSafeDashboardRecord, type DashboardRecordSource } from '@/lib/raw-data/dashboard-record-mapper'

import {
  buildForecastAccuracyCacheKey,
  createForecastAccuracyCacheStore,
  type ForecastAccuracyCacheStore,
} from './forecast-accuracy-cache'
import {
  FORECAST_ACCURACY_HORIZONS,
  ForecastAccuracyRequestError,
  type ForecastAccuracyBaseResponse,
  type ForecastAccuracyHistoricalAlignment,
  type ForecastAccuracyHistoricalAlignmentExample,
  type ForecastAccuracyHorizonMonths,
  type ForecastAccuracyProfiling,
  type ForecastAccuracyResponse,
  isForecastAccuracyHorizonMonths,
} from './forecast-accuracy-contract'
import {
  buildAvailableHorizons,
  buildForecastAccuracyBaseResponse,
  buildForecastAccuracyCoverage,
  buildForecastAccuracySourceInfo,
  sortForecastAccuracyRecordsByTargetDate,
  toForecastAccuracyPoint,
  type ForecastAccuracyRecordSource,
} from './forecast-accuracy-mapper'

export interface ForecastAccuracyQueryInput {
  organizationId: string | null
  componentName: string | null
  componentCode: string
  benchmarkCode: string
  horizonMonths: ForecastAccuracyHorizonMonths | null
  dateFrom: string | null
  dateTo: string | null
  profile: boolean
  locale: 'pl' | 'en'
}

export interface ForecastAccuracyRepositoryFilters {
  organizationId: string | null
  benchmarkCode: string
  dateFrom: Date | null
  dateTo: Date | null
}

export interface ForecastAccuracyQueryDependencies {
  fetchRecords?: (filters: ForecastAccuracyRepositoryFilters) => Promise<ForecastAccuracyRecordSource[]>
  fetchHistoricalRecords?: (input: { organizationId: string | null; componentCode: string }) => Promise<DashboardRecordSource[]>
  cache?: ForecastAccuracyCacheStore<ForecastAccuracyBaseResponse>
}

function normalizeString(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseDateBoundary(value: string | null, label: 'dateFrom' | 'dateTo'): Date | null {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    throw new ForecastAccuracyRequestError(400, 'INVALID_DATE_RANGE', `Query parameter ${label} must be a valid ISO date.`)
  }

  return parsed
}

function parseHorizonMonths(value: string | null): ForecastAccuracyHorizonMonths | null {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)

  if (!Number.isInteger(parsed) || !isForecastAccuracyHorizonMonths(parsed)) {
    throw new ForecastAccuracyRequestError(
      400,
      'INVALID_HORIZON',
      `Query parameter horizonMonths must be one of: ${FORECAST_ACCURACY_HORIZONS.join(', ')}.`,
    )
  }

  return parsed
}

function parseProfileMode(value: string | null): boolean {
  return value === '1' || value === 'true'
}

export function parseForecastAccuracyQuery(params: URLSearchParams, locale: 'pl' | 'en'): ForecastAccuracyQueryInput {
  const componentCode = normalizeString(params.get('componentCode'))

  if (!componentCode) {
    throw new ForecastAccuracyRequestError(
      400,
      'BENCHMARK_REQUIRED',
      'componentCode is required because Forecast Accuracy data is keyed by benchmarkCode.',
    )
  }

  const dateFrom = parseDateBoundary(params.get('dateFrom'), 'dateFrom')
  const dateTo = parseDateBoundary(params.get('dateTo'), 'dateTo')

  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new ForecastAccuracyRequestError(400, 'INVALID_DATE_RANGE', 'dateFrom must be less than or equal to dateTo.')
  }

  return {
    organizationId: normalizeString(params.get('organizationId')),
    componentName: normalizeString(params.get('componentName')),
    componentCode,
    benchmarkCode: componentCode,
    horizonMonths: parseHorizonMonths(params.get('horizonMonths')),
    dateFrom: dateFrom?.toISOString() ?? null,
    dateTo: dateTo?.toISOString() ?? null,
    profile: parseProfileMode(params.get('profile')),
    locale,
  }
}

function createDefaultFetchRecords() {
  return async (filters: ForecastAccuracyRepositoryFilters): Promise<ForecastAccuracyRecordSource[]> => {
    const prisma = getPrismaClient()

    const records = await prisma.drForecastAccuracyRecord.findMany({
      where: {
        organizationId: filters.organizationId ?? undefined,
        benchmarkCode: filters.benchmarkCode,
        deletedAt: null,
        targetDate: {
          gte: filters.dateFrom ?? undefined,
          lte: filters.dateTo ?? undefined,
        },
      },
      select: {
        id: true,
        organizationId: true,
        sourceId: true,
        datasetId: true,
        pipelineId: true,
        latestRunId: true,
        dedupeKey: true,
        benchmarkCode: true,
        sourceTableName: true,
        orgTableName: true,
        targetDate: true,
        horizonMonths: true,
        actualValue: true,
        forecastValue: true,
        differenceValue: true,
        errorType: true,
        duplicateStatus: true,
        rawRecordCount: true,
        duplicateCount: true,
        lineageJson: true,
        metadataJson: true,
        lastSyncedAt: true,
      },
      orderBy: [{ targetDate: 'asc' }, { horizonMonths: 'asc' }, { id: 'asc' }],
    })

    return records as ForecastAccuracyRecordSource[]
  }
}

function createDefaultFetchHistoricalRecords() {
  return async (input: { organizationId: string | null; componentCode: string }) => {
    return await listDashboardRecords({
      organizationId: input.organizationId ?? undefined,
      componentCode: input.componentCode,
    })
  }
}

function measure<T>(action: () => T): { value: T; durationMs: number } {
  const startedAt = performance.now()
  const value = action()

  return {
    value,
    durationMs: performance.now() - startedAt,
  }
}

function withProfiling(
  payload: ForecastAccuracyBaseResponse,
  metrics: Omit<ForecastAccuracyProfiling, 'responseSerializationMs' | 'totalServerMs' | 'responseSizeBytes'>,
  totalStartedAt: number,
): ForecastAccuracyResponse {
  const response: ForecastAccuracyResponse = {
    ...payload,
    profiling: {
      ...metrics,
      responseSerializationMs: 0,
      totalServerMs: 0,
      responseSizeBytes: 0,
    },
  }

  const serializationStartedAt = performance.now()
  const responseSizeBytes = Buffer.byteLength(JSON.stringify(response), 'utf8')
  const responseSerializationMs = performance.now() - serializationStartedAt

  response.profiling = {
    ...response.profiling!,
    responseSerializationMs,
    totalServerMs: performance.now() - totalStartedAt,
    responseSizeBytes,
  }

  return response
}

export function createForecastAccuracyQueryService(dependencies: ForecastAccuracyQueryDependencies = {}) {
  const fetchRecords = dependencies.fetchRecords ?? createDefaultFetchRecords()
  const fetchHistoricalRecords = dependencies.fetchHistoricalRecords ?? createDefaultFetchHistoricalRecords()
  const cache = dependencies.cache ?? createForecastAccuracyCacheStore<ForecastAccuracyBaseResponse>()

  async function getForecastAccuracy(params: URLSearchParams, locale: 'pl' | 'en'): Promise<ForecastAccuracyResponse> {
    const request = parseForecastAccuracyQuery(params, locale)
    const totalStartedAt = performance.now()
    const cacheKey = buildForecastAccuracyCacheKey({
      locale: request.locale,
      organizationId: request.organizationId,
      benchmarkCode: request.benchmarkCode,
      horizonMonths: request.horizonMonths,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
    })
    const cached = cache.read(cacheKey, Date.now())

    if (cached) {
      if (!request.profile) {
        return cached
      }

      return withProfiling(cached, {
        dbQueryMs: 0,
        mappingMs: 0,
        sortingMs: 0,
        coverageMs: 0,
        recordCount: cached.points.length,
        cacheHit: true,
      }, totalStartedAt)
    }

    const { payload, metrics } = await cache.withPending(cacheKey, async () => {
      const dbStartedAt = performance.now()
      const allRecords = await fetchRecords({
        organizationId: request.organizationId,
        benchmarkCode: request.benchmarkCode,
        dateFrom: request.dateFrom ? new Date(request.dateFrom) : null,
        dateTo: request.dateTo ? new Date(request.dateTo) : null,
      })
      const dbQueryMs = performance.now() - dbStartedAt

      if (allRecords.length === 0) {
        throw new ForecastAccuracyRequestError(404, 'NO_ACCURACY_DATA', 'No Forecast Accuracy data found for the selected benchmark.')
      }

      const availableHorizons = buildAvailableHorizons(allRecords)

      if (availableHorizons.length === 0) {
        throw new ForecastAccuracyRequestError(404, 'NO_ACCURACY_DATA', 'No Forecast Accuracy forecast points are available for the selected benchmark.')
      }

      if (request.horizonMonths !== null && !availableHorizons.includes(request.horizonMonths)) {
        throw new ForecastAccuracyRequestError(
          404,
          'NO_ACCURACY_DATA',
          `No Forecast Accuracy data found for horizon ${request.horizonMonths}M for the selected benchmark.`,
        )
      }

      const selectedHorizon = request.horizonMonths
      const selectedRecords = selectedHorizon === null
        ? []
        : allRecords.filter((record) => record.horizonMonths === selectedHorizon)

      const mapping = measure(() => selectedRecords.map(toForecastAccuracyPoint).filter((point): point is NonNullable<typeof point> => point !== null))
      const sorting = measure(() => sortForecastAccuracyRecordsByTargetDate(selectedRecords))
      const sortedPoints = sorting.value.map(toForecastAccuracyPoint).filter((point): point is NonNullable<typeof point> => point !== null)
      const coverage = measure(() => buildForecastAccuracyCoverage(sortedPoints))
      const sourceInfo = buildForecastAccuracySourceInfo(selectedHorizon === null ? allRecords : selectedRecords)
      const payload = buildForecastAccuracyBaseResponse({
        componentName: request.componentName ?? request.benchmarkCode,
        benchmarkCode: request.benchmarkCode,
        horizonMonths: selectedHorizon,
        availableHorizons,
        points: sortedPoints,
        sourceInfo,
        coverage: coverage.value,
      })

      cache.write(cacheKey, payload, Date.now())

      return {
        payload,
        metrics: {
          dbQueryMs,
          mappingMs: mapping.durationMs,
          sortingMs: sorting.durationMs,
          coverageMs: coverage.durationMs,
          recordCount: allRecords.length,
          cacheHit: false,
        },
      }
    })

    if (!request.profile) {
      return payload
    }

    return withProfiling(payload, metrics, totalStartedAt)
  }

  async function compareForecastAccuracyActualsToHistorical(input: {
    organizationId: string | null
    componentCode: string
    locale?: 'pl' | 'en'
    tolerance?: number
  }): Promise<ForecastAccuracyHistoricalAlignment> {
    const tolerance = input.tolerance ?? 0.000001
    const locale = input.locale ?? 'pl'
    const accuracyRecords = await fetchRecords({
      organizationId: input.organizationId,
      benchmarkCode: input.componentCode,
      dateFrom: null,
      dateTo: null,
    })

    if (accuracyRecords.length === 0) {
      throw new ForecastAccuracyRequestError(404, 'NO_ACCURACY_DATA', 'No Forecast Accuracy data found for alignment validation.')
    }

    const actualByDate = new Map<string, number | null>()

    for (const record of accuracyRecords) {
      const point = toForecastAccuracyPoint(record)

      if (!point) {
        continue
      }

      if (!actualByDate.has(point.targetDate)) {
        actualByDate.set(point.targetDate, point.actualValue)
      }
    }

    const historicalRecords = await fetchHistoricalRecords({
      organizationId: input.organizationId,
      componentCode: input.componentCode,
    })

    const historicalByDate = new Map<string, number | null>()

    for (const record of historicalRecords) {
      const mapped = toBusinessSafeDashboardRecord(record, { locale })

      if (mapped.componentCode !== input.componentCode || mapped.scenarioType.trim().toLowerCase() !== 'historical' || !mapped.sourceDate) {
        continue
      }

      historicalByDate.set(mapped.sourceDate, mapped.metricValue)
    }

    const examples: ForecastAccuracyHistoricalAlignmentExample[] = []
    let matchedDateCount = 0
    let missingHistoricalCount = 0
    let actualMatchCount = 0
    let actualMismatchCount = 0

    for (const [targetDate, actualValue] of Array.from(actualByDate.entries()).sort(([left], [right]) => left.localeCompare(right))) {
      const historicalValue = historicalByDate.get(targetDate)

      if (historicalValue === undefined) {
        missingHistoricalCount += 1

        if (examples.length < 10) {
          examples.push({
            targetDate,
            actualValue,
            historicalValue: null,
            differenceValue: null,
            status: 'MISSING_HISTORICAL',
          })
        }

        continue
      }

      matchedDateCount += 1

      if (actualValue === null || historicalValue === null) {
        actualMismatchCount += 1

        if (examples.length < 10) {
          examples.push({
            targetDate,
            actualValue,
            historicalValue: historicalValue ?? null,
            differenceValue: null,
            status: 'MISSING_ACTUAL',
          })
        }

        continue
      }

      const differenceValue = actualValue - historicalValue
      const matches = Math.abs(differenceValue) <= tolerance

      if (matches) {
        actualMatchCount += 1
      } else {
        actualMismatchCount += 1
      }

      if (examples.length < 10 && (!matches || examples.length < 3)) {
        examples.push({
          targetDate,
          actualValue,
          historicalValue,
          differenceValue,
          status: matches ? 'MATCH' : 'MISMATCH',
        })
      }
    }

    return {
      benchmarkCode: input.componentCode,
      organizationId: input.organizationId,
      tolerance,
      accuracyDateCount: actualByDate.size,
      historicalDateCount: historicalByDate.size,
      matchedDateCount,
      missingHistoricalCount,
      actualMatchCount,
      actualMismatchCount,
      examples,
    }
  }

  return {
    getForecastAccuracy,
    compareForecastAccuracyActualsToHistorical,
    clearCache() {
      cache.clear()
    },
  }
}

export const forecastAccuracyQueryService = createForecastAccuracyQueryService()