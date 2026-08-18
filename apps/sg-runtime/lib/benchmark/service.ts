import type {
  BenchmarkAnalyticsSeriesResult,
  BenchmarkCandidate,
  BenchmarkPreviewPoint,
  BenchmarkMetadataDefinition,
  BenchmarkMetadataValue,
  BenchmarkRangePreset,
  BenchmarkSemanticContext,
  BenchmarkSearchRequest,
} from '@/lib/benchmark/contracts'
import { parseBenchmarkObservationDate } from '@/lib/benchmark/observation-date'
import {
  fetchMacrobondEntityMetadata,
  getMacrobondMetadataDefinitions,
  getMacrobondMetadataValues,
  getMacrobondSemanticContexts,
  lookupMacrobondSeriesExact,
  searchMacrobondBenchmarks,
} from '@/lib/benchmark/macrobond'
import { listSavedBenchmarksForOrganization, saveBenchmarkSelection } from '@/lib/benchmark/repository'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'

function looksLikeProviderSeriesIdentifier(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.includes(' ')) {
    return false
  }

  if (!/^[a-z0-9_./-]+$/i.test(normalized)) {
    return false
  }

  const separatorCount = (normalized.match(/[_./-]/g) ?? []).length
  return separatorCount >= 2 || (separatorCount >= 1 && normalized.length >= 16)
}

export async function searchBenchmarks(request: BenchmarkSearchRequest) {
  const limit = request.limit ?? 8
  const filters = request.filters ?? []

  if (request.exactSeriesId?.trim()) {
    const exact = await lookupMacrobondSeriesExact(request.exactSeriesId)
    return exact ? [exact] : []
  }

  const query = request.query?.trim() ?? ''
  if (!query) {
    return []
  }

  if (filters.length === 0 && looksLikeProviderSeriesIdentifier(query)) {
    const exact = await lookupMacrobondSeriesExact(query)
    if (exact) {
      const fuzzy = await searchMacrobondBenchmarks({ query, limit: Math.max(limit - 1, 0) })
      return [exact, ...fuzzy.filter((item) => item.providerSeries.providerSeriesId !== exact.providerSeries.providerSeriesId)]
    }
  }

  return searchMacrobondBenchmarks({
    query,
    filters,
    limit,
  })
}

export async function getBenchmarkPreview(seriesName: string, range: BenchmarkRangePreset) {
  const { history } = await resolveBenchmarkHistoricalSeries(seriesName, range)
  const sliced = sliceHistoricalPoints(history.historical, range)

  return {
    providerSeries: history.providerSeries,
    displayName: history.displayName,
    latestValue: lastNonNullHistoricalValue(sliced),
    frequency: history.frequency,
    currency: history.currency,
    unit: history.unit,
    source: history.source,
    range,
    changeMetrics: computeChangeMetrics(history.historical),
    historical: sliced,
  }
}

export async function getBenchmarkHistory(seriesName: string) {
  const { history } = await resolveBenchmarkHistoricalSeries(seriesName, 'ALL')
  return history
}

function sliceHistoricalPoints(points: BenchmarkPreviewPoint[], range: BenchmarkRangePreset) {
  if (points.length === 0 || range === 'ALL') {
    return points
  }

  const days = {
    '1M': 31,
    '3M': 92,
    '6M': 183,
    '1Y': 366,
    '3Y': 366 * 3,
    '5Y': 366 * 5,
  }[range]

  const newestDate = parseBenchmarkObservationDate(points[points.length - 1].date)
  const threshold = new Date(newestDate)
  threshold.setUTCDate(threshold.getUTCDate() - days)

  return points.filter((point) => parseBenchmarkObservationDate(point.date) >= threshold)
}

function lastNonNullHistoricalValue(points: BenchmarkPreviewPoint[]) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = points[index]?.value
    if (typeof value === 'number') {
      return value
    }
  }

  return null
}

function computeChangeMetrics(points: BenchmarkPreviewPoint[]) {
  const latestPoint = [...points].reverse().find((point) => typeof point.value === 'number')
  if (!latestPoint || latestPoint.value === null) {
    return {}
  }

  const latestTime = parseBenchmarkObservationDate(latestPoint.date).getTime()
  const windows: Array<['1M' | '3M' | '1Y', number]> = [
    ['1M', 31],
    ['3M', 92],
    ['1Y', 366],
  ]
  const metrics: Partial<Record<'1M' | '3M' | '1Y', number>> = {}

  for (const [key, days] of windows) {
    const thresholdTime = latestTime - (days * 24 * 60 * 60 * 1000)
    const baselinePoint = [...points]
      .filter((point) => typeof point.value === 'number')
      .reverse()
      .find((point) => parseBenchmarkObservationDate(point.date).getTime() <= thresholdTime && point.value !== null)

    if (!baselinePoint || !baselinePoint.value || baselinePoint.value === 0) {
      continue
    }

    metrics[key] = ((latestPoint.value - baselinePoint.value) / Math.abs(baselinePoint.value)) * 100
  }

  return metrics
}

export { sliceHistoricalPoints }

export async function getBenchmarkAnalyticsSeries(
  seriesName: string,
  range: BenchmarkRangePreset,
): Promise<BenchmarkAnalyticsSeriesResult> {
  const history = await getBenchmarkHistory(seriesName)
  const historical = sliceHistoricalPoints(history.historical, range)

  return {
    providerSeries: history.providerSeries,
    displayName: history.displayName,
    latestValue: lastNonNullHistoricalValue(historical),
    frequency: history.frequency,
    currency: history.currency,
    unit: history.unit,
    source: history.source,
    range,
    historical,
  }
}

export async function selectBenchmark(params: {
  organizationId: string
  userId: string
  candidate: BenchmarkCandidate
}) {
  const metadata = await fetchMacrobondEntityMetadata(params.candidate.providerSeries.providerSeriesId)

  return saveBenchmarkSelection({
    organizationId: params.organizationId,
    userId: params.userId,
    candidate: params.candidate,
    metadata,
  })
}

export async function getSavedBenchmarks(organizationId: string) {
  return listSavedBenchmarksForOrganization(organizationId)
}

export async function getBenchmarkMetadataDefinitions(): Promise<BenchmarkMetadataDefinition[]> {
  return getMacrobondMetadataDefinitions()
}

export async function getBenchmarkMetadataValues(
  metadataKey: string,
  filters: BenchmarkSearchRequest['filters'] = [],
  options?: {
    query?: string
    limit?: number
  },
): Promise<{
  items: BenchmarkMetadataValue[]
  totalCount: number
  filteredCount: number
  query: string
  limited: boolean
}> {
  return getMacrobondMetadataValues(metadataKey, filters ?? [], options)
}

export async function getBenchmarkSemanticContext(seriesIds: string[]): Promise<Record<string, BenchmarkSemanticContext>> {
  return getMacrobondSemanticContexts(seriesIds)
}