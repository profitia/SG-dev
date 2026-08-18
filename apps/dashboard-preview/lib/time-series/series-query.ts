import { subMonths } from './time-utils'

import { listDashboardRecords, listDashboardRecordsWithMetrics } from '@/lib/raw-data/dashboard-record-query'
import {
  toBackingRecord,
  toBusinessSafeDashboardRecord,
  toChartReadyPoint,
  toComponentListItem,
  toRecordDetail,
  toSeriesSelection,
  type DashboardRecordSource,
} from '@/lib/raw-data/dashboard-record-mapper'
import { readBooleanQuery, readNumberQuery, type SeriesFilters } from '@/lib/raw-data/dashboard-record-filters'
import type { DashboardRecordListFilters } from '@/lib/raw-data/dashboard-record-filters'

import type { ComponentListResponse, RecordsResponse, SeriesProfilingMetrics, SeriesResponse } from './series-contract'

type BenchmarkAnalyticsRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'

type BenchmarkAnalyticsSeriesResponse = {
  providerSeries: {
    providerSeriesId: string
  }
  displayName: string
  latestValue: number | null
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  range: BenchmarkAnalyticsRange
  historical: Array<{
    date: string
    value: number | null
  }>
}

const LOCAL_SG_RUNTIME_BASE_URL = 'http://localhost:3001'
const PRODUCTION_SG_RUNTIME_BASE_URL = 'https://benchmark-finder-category-builder.onrender.com'

function resolveSgRuntimeBaseUrl() {
  if (process.env.SG_RUNTIME_BASE_URL?.trim()) {
    return process.env.SG_RUNTIME_BASE_URL.trim()
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_SG_RUNTIME_BASE_URL
  }

  return LOCAL_SG_RUNTIME_BASE_URL
}

function readBenchmarkAnalyticsRange(params: URLSearchParams): BenchmarkAnalyticsRange {
  const value = params.get('range')?.trim().toUpperCase()

  switch (value) {
    case '1M':
    case '3M':
    case '6M':
    case '1Y':
    case '3Y':
    case '5Y':
    case 'ALL':
      return value
    default:
      return '1Y'
  }
}

function toBenchmarkSeriesResponse(
  payload: BenchmarkAnalyticsSeriesResponse,
  locale: 'pl' | 'en',
  displayNameOverride: string | null,
): SeriesResponse {
  const effectiveName = displayNameOverride?.trim() || payload.displayName
  const latestHistoricalPoint = payload.historical[payload.historical.length - 1] ?? null
  const detailDate = latestHistoricalPoint?.date ?? null
  const detailValue = latestHistoricalPoint?.value ?? payload.latestValue

  return {
    selection: {
      componentName: effectiveName,
      componentId: null,
      componentCode: payload.providerSeries.providerSeriesId,
      sourceLabel: payload.source,
    },
    benchmarkSelectionRequired: false,
    availableBenchmarks: [
      {
        componentCode: payload.providerSeries.providerSeriesId,
        sourceLabel: payload.source,
        descriptionPlAvailable: locale === 'pl',
        descriptionEnAvailable: locale === 'en',
      },
    ],
    sourceInfo: {
      benchmarkCode: payload.providerSeries.providerSeriesId,
      sourceLabel: payload.source,
      descriptionPl: locale === 'pl' ? effectiveName : null,
      descriptionEn: locale === 'en' ? effectiveName : null,
      unit: payload.unit,
      currency: payload.currency,
      market: null,
      country: null,
      qualityStatus: null,
      lastSyncedAt: null,
    },
    detailSummary: {
      componentName: effectiveName,
      componentCode: payload.providerSeries.providerSeriesId,
      sourceDate: detailDate,
      scenarioType: 'historical',
      metricValue: detailValue,
      forecastLower: null,
      forecastUpper: null,
      forecastAccuracyDiff: null,
      unit: payload.unit,
      currency: payload.currency,
      market: null,
      country: null,
      qualityStatus: null,
      descriptionPl: locale === 'pl' ? effectiveName : null,
      descriptionEn: locale === 'en' ? effectiveName : null,
      sourceLabel: payload.source,
      lastSyncedAt: null,
    },
    forecastAnchor: latestHistoricalPoint
      ? {
          date: latestHistoricalPoint.date,
          value: latestHistoricalPoint.value,
        }
      : null,
    historicalWindow: {
      from: payload.historical[0]?.date ?? null,
      to: latestHistoricalPoint?.date ?? null,
    },
    historical: payload.historical.map((point, index) => ({
      date: point.date,
      value: point.value,
      diff: null,
      recordId: `${payload.providerSeries.providerSeriesId}-${index}`,
      dedupeKey: `${payload.providerSeries.providerSeriesId}-${point.date}`,
    })),
    forecast: null,
  }
}

async function getBenchmarkSeries(
  params: URLSearchParams,
  locale: 'pl' | 'en',
): Promise<SeriesResponse> {
  const seriesId = params.get('seriesId')?.trim()

  if (!seriesId) {
    throw new Error('seriesId is required for benchmark analytics mode.')
  }

  const url = new URL('/api/benchmark/analytics-series', resolveSgRuntimeBaseUrl())
  url.searchParams.set('seriesId', seriesId)
  url.searchParams.set('range', readBenchmarkAnalyticsRange(params))

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await response.json() as BenchmarkAnalyticsSeriesResponse | { error?: string }
  if (!response.ok) {
    throw new Error('error' in payload ? payload.error ?? 'Failed to load benchmark analytics series.' : 'Failed to load benchmark analytics series.')
  }

  return toBenchmarkSeriesResponse(payload as BenchmarkAnalyticsSeriesResponse, locale, params.get('displayName'))
}

type ServerSeriesCacheEntry = {
  key: string
  cachedAt: number
  payload: SeriesResponse
}

const SERVER_SERIES_CACHE_TTL_MS = 30_000
const serverSeriesCache = new Map<string, ServerSeriesCacheEntry>()

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function bySourceDateAsc(locale: 'pl' | 'en') {
  return (left: DashboardRecordSource, right: DashboardRecordSource) => {
    const leftDate = toBusinessSafeDashboardRecord(left, { locale }).sourceDate
    const rightDate = toBusinessSafeDashboardRecord(right, { locale }).sourceDate
    return new Date(leftDate ?? 0).getTime() - new Date(rightDate ?? 0).getTime()
  }
}

function filterBusinessRecords(records: DashboardRecordSource[], filters: DashboardRecordListFilters, locale: 'pl' | 'en') {
  const search = filters.q?.trim().toLowerCase() ?? null
  const scenario = filters.scenarioType?.trim().toLowerCase() ?? null

  return records.filter((record) => {
    const business = toBusinessSafeDashboardRecord(record, { locale })

    if (filters.componentName && business.componentName !== filters.componentName) {
      return false
    }

    if (filters.componentCode && business.componentCode !== filters.componentCode) {
      return false
    }

    if (scenario && business.scenarioType.trim().toLowerCase() !== scenario) {
      return false
    }

    if (search) {
      const haystack = [business.componentName, business.componentCode ?? '', business.descriptionPl ?? '', business.descriptionEn ?? '']
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(search)) {
        return false
      }
    }

    return true
  })
}

function filterScenario(records: DashboardRecordSource[], scenario: 'historical' | 'forecast') {
  return records.filter((record) => toBusinessSafeDashboardRecord(record, { locale: 'pl' }).scenarioType.toLowerCase() === scenario)
}

function findBenchmarkVariants(records: DashboardRecordSource[]) {
  const variants = new Map<string, DashboardRecordSource[]>()

  for (const record of records) {
    const mapped = toBusinessSafeDashboardRecord(record, { locale: 'pl' })
    const key = mapped.componentCode ?? '__null__'
    variants.set(key, [...(variants.get(key) ?? []), record])
  }

  return variants
}

function measure<T>(action: () => T) {
  const startedAt = performance.now()
  const value = action()
  return {
    value,
    durationMs: performance.now() - startedAt,
  }
}

function readProfileMode(params: URLSearchParams) {
  return params.get('profile') === '1'
}

function withProfiling(payload: Omit<SeriesResponse, 'profiling'>, profiling: SeriesProfilingMetrics | null): SeriesResponse {
  if (!profiling) {
    return payload
  }

  return {
    ...payload,
    profiling,
  }
}

function buildSeriesCacheKey(filters: SeriesFilters, locale: 'pl' | 'en') {
  return JSON.stringify({
    locale,
    organizationId: filters.organizationId ?? null,
    pipelineId: filters.pipelineId ?? null,
    componentName: filters.componentName ?? null,
    componentCode: filters.componentCode ?? null,
    historyMonths: filters.historyMonths ?? null,
    showForecast: filters.showForecast,
  })
}

export async function getComponentList(params: URLSearchParams, locale: 'pl' | 'en'): Promise<ComponentListResponse> {
  const records = filterBusinessRecords(
    await listDashboardRecords({
      organizationId: params.get('organizationId') ?? undefined,
      pipelineId: params.get('pipelineId') ?? undefined,
    }),
    {
      q: params.get('q') ?? undefined,
    },
    locale,
  )

  const grouped = new Map<string, DashboardRecordSource[]>()

  for (const record of records) {
    const business = toBusinessSafeDashboardRecord(record, { locale })
    const key = business.componentName
    grouped.set(key, [...(grouped.get(key) ?? []), record])
  }

  return {
    items: Array.from(grouped.values())
      .map((group) => toComponentListItem(group, { locale }))
      .sort((left, right) => left.componentName.localeCompare(right.componentName)),
  }
}

export async function getSeries(params: URLSearchParams, locale: 'pl' | 'en'): Promise<SeriesResponse> {
  if (params.get('seriesId')?.trim()) {
    return getBenchmarkSeries(params, locale)
  }

  const profileMode = readProfileMode(params)
  const totalStartedAt = performance.now()
  const filters: SeriesFilters = {
    organizationId: params.get('organizationId') ?? undefined,
    pipelineId: params.get('pipelineId') ?? undefined,
    componentName: params.get('componentName') ?? undefined,
    componentCode: params.get('componentCode') ?? undefined,
    historyMonths: readNumberQuery(params.get('historyMonths'), 12),
    showForecast: readBooleanQuery(params.get('showForecast'), false),
  }

  const cacheKey = buildSeriesCacheKey(filters, locale)
  const cached = serverSeriesCache.get(cacheKey)

  if (cached && Date.now() - cached.cachedAt <= SERVER_SERIES_CACHE_TTL_MS) {
    if (profileMode) {
      const profiling = cached.payload.profiling
      return {
        ...cached.payload,
        profiling: profiling
          ? {
              ...profiling,
              getClientMs: 0,
              dbConnectMs: 0,
              dbQueryMs: 0,
              dbTotalMs: 0,
              businessFilterMs: 0,
              benchmarkVariantMs: 0,
              scenarioFilterMs: 0,
              sortMs: 0,
              seriesBuildMs: 0,
              totalServerMs: performance.now() - totalStartedAt,
            }
          : undefined,
      }
    }

    return cached.payload
  }

  const dbResult = profileMode
    ? await listDashboardRecordsWithMetrics({
      organizationId: filters.organizationId,
      pipelineId: filters.pipelineId,
    })
    : {
      records: await listDashboardRecords({
        organizationId: filters.organizationId,
        pipelineId: filters.pipelineId,
      }),
      metrics: {
        getClientMs: 0,
        dbConnectMs: 0,
        dbQueryMs: 0,
        dbTotalMs: 0,
        fetchedCount: 0,
      },
    }

  const filteredBusiness = measure(() => filterBusinessRecords(
    dbResult.records,
    {
      componentName: filters.componentName,
      componentCode: filters.componentCode,
    },
    locale,
  ))

  const records = filteredBusiness.value
  const variantBuild = measure(() => findBenchmarkVariants(records))
  const variants = variantBuild.value
  const selectedVariant =
    filters.componentCode !== undefined
      ? variants.get(filters.componentCode ?? '__null__') ?? []
      : variants.size === 1
        ? Array.from(variants.values())[0]
        : []

  const availableBenchmarks = Array.from(variants.values()).map((group) => toComponentListItem(group, { locale }).availableBenchmarks[0])
  const benchmarkSelectionRequired = variants.size > 1 && !filters.componentCode

  const emptyPayload: Omit<SeriesResponse, 'profiling'> = {
    selection: toSeriesSelection(records[0] ?? null, { locale }),
    benchmarkSelectionRequired,
    availableBenchmarks,
    sourceInfo: null,
    detailSummary: null,
    forecastAnchor: null,
    historicalWindow: { from: null, to: null },
    historical: [],
    forecast: null,
  }

  if (benchmarkSelectionRequired || selectedVariant.length === 0) {
    const payload = withProfiling(emptyPayload, profileMode ? {
      recordCount: dbResult.metrics.fetchedCount || dbResult.records.length,
      getClientMs: dbResult.metrics.getClientMs,
      dbConnectMs: dbResult.metrics.dbConnectMs,
      dbQueryMs: dbResult.metrics.dbQueryMs,
      dbTotalMs: dbResult.metrics.dbTotalMs,
      businessFilterMs: filteredBusiness.durationMs,
      benchmarkVariantMs: variantBuild.durationMs,
      scenarioFilterMs: 0,
      sortMs: 0,
      seriesBuildMs: 0,
      totalServerMs: 0,
      responseSizeBytes: 0,
    } : null)

    if (payload.profiling) {
      payload.profiling.totalServerMs = performance.now() - totalStartedAt
      payload.profiling.responseSizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8')
    }

    return payload
  }

  const historicalBoundary = subMonths(new Date(), filters.historyMonths ?? 12)
  const historicalScenario = measure(() => filterScenario(selectedVariant, 'historical').filter((record) => {
    const date = toBusinessSafeDashboardRecord(record, { locale }).sourceDate
    return date ? new Date(date) >= historicalBoundary : false
  }))
  const forecastScenario = measure(() => (filters.showForecast ? filterScenario(selectedVariant, 'forecast') : []))
  const historicalSort = measure(() => [...historicalScenario.value].sort(bySourceDateAsc(locale)))
  const forecastSort = measure(() => [...forecastScenario.value].sort(bySourceDateAsc(locale)))
  const historicalRecords = historicalSort.value
  const forecastRecords = forecastSort.value

  const seriesBuild = measure(() => {
    const mappedHistorical = historicalRecords.map((record) => ({
      raw: record,
      mapped: toBusinessSafeDashboardRecord(record, { locale }),
    }))
    const mappedForecast = forecastRecords.map((record) => ({
      raw: record,
      mapped: toBusinessSafeDashboardRecord(record, { locale }),
    }))
    const latestHistorical = mappedHistorical[mappedHistorical.length - 1] ?? null
    const firstForecast = mappedForecast[0] ?? null
    const summaryRecord = latestHistorical?.raw ?? firstForecast?.raw ?? selectedVariant[selectedVariant.length - 1] ?? null
    const summaryMapped = summaryRecord ? toBusinessSafeDashboardRecord(summaryRecord, { locale }) : null
    const forecastAnchor = latestHistorical
      ? {
          date: latestHistorical.mapped.sourceDate,
          value: latestHistorical.mapped.metricValue,
        }
      : firstForecast
        ? {
            date: firstForecast.mapped.sourceDate,
            value: firstForecast.mapped.metricValue,
          }
        : null
    const sourceInfo = summaryRecord && summaryMapped
      ? {
          benchmarkCode: summaryMapped.componentCode,
          sourceLabel: summaryRecord.sourceId,
          descriptionPl: summaryMapped.descriptionPl,
          descriptionEn: summaryMapped.descriptionEn,
          unit: summaryRecord.unit,
          currency: summaryRecord.currency,
          market: summaryRecord.market,
          country: summaryRecord.country,
          qualityStatus: summaryRecord.qualityStatus,
          lastSyncedAt: toIsoString(summaryRecord.lastSyncedAt),
        }
      : null
    const detailSummary = summaryRecord && summaryMapped
      ? {
          componentName: summaryMapped.componentName,
          componentCode: summaryMapped.componentCode,
          sourceDate: forecastAnchor?.date ?? summaryMapped.sourceDate,
          scenarioType: latestHistorical?.mapped.scenarioType ?? summaryMapped.scenarioType,
          metricValue: forecastAnchor?.value ?? summaryMapped.metricValue,
          forecastLower: firstForecast?.mapped.lciValue ?? null,
          forecastUpper: firstForecast?.mapped.uciValue ?? null,
          forecastAccuracyDiff: firstForecast?.mapped.diff ?? null,
          unit: summaryRecord.unit,
          currency: summaryRecord.currency,
          market: summaryRecord.market,
          country: summaryRecord.country,
          qualityStatus: summaryRecord.qualityStatus,
          descriptionPl: summaryMapped.descriptionPl,
          descriptionEn: summaryMapped.descriptionEn,
          sourceLabel: summaryRecord.sourceId,
          lastSyncedAt: toIsoString(summaryRecord.lastSyncedAt),
        }
      : null

    return {
      sourceInfo,
      detailSummary,
      forecastAnchor,
      historical: historicalRecords.map((record) => toChartReadyPoint(record, { locale })),
      forecast: filters.showForecast
        ? {
            from: mappedForecast[0]?.mapped.sourceDate ?? null,
            to: mappedForecast[mappedForecast.length - 1]?.mapped.sourceDate ?? null,
            central: mappedForecast.map(({ raw }) => toChartReadyPoint(raw, { locale })),
            upper: mappedForecast.map(({ raw, mapped }) => ({
              date: mapped.sourceDate ?? new Date(0).toISOString(),
              value: mapped.uciValue,
              diff: mapped.diff,
              recordId: raw.id,
              dedupeKey: raw.dedupeKey,
            })),
            lower: mappedForecast.map(({ raw, mapped }) => ({
              date: mapped.sourceDate ?? new Date(0).toISOString(),
              value: mapped.lciValue,
              diff: mapped.diff,
              recordId: raw.id,
              dedupeKey: raw.dedupeKey,
            })),
          }
        : null,
    }
  })

  const payload = withProfiling({
    selection: toSeriesSelection(selectedVariant[0] ?? null, { locale }),
    benchmarkSelectionRequired: false,
    availableBenchmarks,
    sourceInfo: seriesBuild.value.sourceInfo,
    detailSummary: seriesBuild.value.detailSummary,
    forecastAnchor: seriesBuild.value.forecastAnchor,
    historicalWindow: {
      from: historicalRecords[0] ? toBusinessSafeDashboardRecord(historicalRecords[0], { locale }).sourceDate : null,
      to: historicalRecords[historicalRecords.length - 1]
        ? toBusinessSafeDashboardRecord(historicalRecords[historicalRecords.length - 1], { locale }).sourceDate
        : null,
    },
    historical: seriesBuild.value.historical,
    forecast: seriesBuild.value.forecast,
  }, profileMode ? {
    recordCount: dbResult.metrics.fetchedCount || dbResult.records.length,
    getClientMs: dbResult.metrics.getClientMs,
    dbConnectMs: dbResult.metrics.dbConnectMs,
    dbQueryMs: dbResult.metrics.dbQueryMs,
    dbTotalMs: dbResult.metrics.dbTotalMs,
    businessFilterMs: filteredBusiness.durationMs,
    benchmarkVariantMs: variantBuild.durationMs,
    scenarioFilterMs: historicalScenario.durationMs + forecastScenario.durationMs,
    sortMs: historicalSort.durationMs + forecastSort.durationMs,
    seriesBuildMs: seriesBuild.durationMs,
    totalServerMs: 0,
    responseSizeBytes: 0,
  } : null)

  if (payload.profiling) {
    payload.profiling.totalServerMs = performance.now() - totalStartedAt
    payload.profiling.responseSizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8')
  }

  serverSeriesCache.set(cacheKey, {
    key: cacheKey,
    cachedAt: Date.now(),
    payload,
  })

  return payload
}

export async function getRecords(params: URLSearchParams, locale: 'pl' | 'en'): Promise<RecordsResponse> {
  const rows = filterBusinessRecords(
    await listDashboardRecords({
      organizationId: params.get('organizationId') ?? undefined,
      pipelineId: params.get('pipelineId') ?? undefined,
    }),
    {
      componentName: params.get('componentName') ?? undefined,
      componentCode: params.get('componentCode') ?? undefined,
      scenarioType: params.get('scenarioType') ?? undefined,
    },
    locale,
  )

  const recordId = params.get('recordId')
  const detailRecord = recordId ? rows.find((row) => row.id === recordId) ?? null : null

  return {
    rows: rows.map((record) => toBackingRecord(record, { locale })),
    detail: detailRecord ? toRecordDetail(detailRecord, { locale }) : null,
  }
}
