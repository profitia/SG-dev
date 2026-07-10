import { subMonths } from './time-utils'

import { listDashboardRecords } from '@/lib/raw-data/dashboard-record-query'
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

import type { ComponentListResponse, RecordsResponse, SeriesResponse } from './series-contract'

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
  const filters: SeriesFilters = {
    organizationId: params.get('organizationId') ?? undefined,
    pipelineId: params.get('pipelineId') ?? undefined,
    componentName: params.get('componentName') ?? undefined,
    componentCode: params.get('componentCode') ?? undefined,
    historyMonths: readNumberQuery(params.get('historyMonths'), 12),
    showForecast: readBooleanQuery(params.get('showForecast'), false),
  }

  const records = filterBusinessRecords(
    await listDashboardRecords({
      organizationId: filters.organizationId,
      pipelineId: filters.pipelineId,
    }),
    {
      componentName: filters.componentName,
      componentCode: filters.componentCode,
    },
    locale,
  )

  const variants = findBenchmarkVariants(records)
  const selectedVariant =
    filters.componentCode !== undefined
      ? variants.get(filters.componentCode ?? '__null__') ?? []
      : variants.size === 1
        ? Array.from(variants.values())[0]
        : []

  const availableBenchmarks = Array.from(variants.values()).map((group) => toComponentListItem(group, { locale }).availableBenchmarks[0])
  const benchmarkSelectionRequired = variants.size > 1 && !filters.componentCode

  if (benchmarkSelectionRequired || selectedVariant.length === 0) {
    return {
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
  }

  const historicalBoundary = subMonths(new Date(), filters.historyMonths ?? 12)
  const historicalRecords = filterScenario(selectedVariant, 'historical').filter((record) => {
    const date = toBusinessSafeDashboardRecord(record, { locale }).sourceDate
    return date ? new Date(date) >= historicalBoundary : false
  }).sort(bySourceDateAsc(locale))
  const forecastRecords = filters.showForecast ? filterScenario(selectedVariant, 'forecast').sort(bySourceDateAsc(locale)) : []
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
    selection: toSeriesSelection(selectedVariant[0] ?? null, { locale }),
    benchmarkSelectionRequired: false,
    availableBenchmarks,
    sourceInfo,
    detailSummary,
    forecastAnchor,
    historicalWindow: {
      from: historicalRecords[0] ? toBusinessSafeDashboardRecord(historicalRecords[0], { locale }).sourceDate : null,
      to: historicalRecords[historicalRecords.length - 1]
        ? toBusinessSafeDashboardRecord(historicalRecords[historicalRecords.length - 1], { locale }).sourceDate
        : null,
    },
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
