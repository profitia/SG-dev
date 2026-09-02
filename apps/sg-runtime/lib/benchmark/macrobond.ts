import { serverEnv } from '@/lib/env'
import { normalizeBenchmarkObservationDate, parseBenchmarkObservationDate } from '@/lib/benchmark/observation-date'
import type {
  BenchmarkCandidate,
  BenchmarkMetadataDefinition,
  BenchmarkMetadataValue,
  BenchmarkHistoricalSeriesResult,
  BenchmarkPreviewPoint,
  BenchmarkPreviewResult,
  BenchmarkRangePreset,
  BenchmarkSearchFilter,
  BenchmarkSearchRequest,
  BenchmarkSemanticContext,
  BenchmarkSemanticEntity,
  ProviderRef,
} from '@/lib/benchmark/contracts'
import { BenchmarkAppError } from '@/lib/benchmark/errors'

const MACROBOND_PROVIDER: ProviderRef = {
  providerCode: 'MACROBOND',
  displayName: 'Macrobond',
}

const DEFAULT_MACROBOND_API_BASE_URL = 'https://api.macrobondfinancial.com'
const DEFAULT_MACROBOND_TOKEN_URL = 'https://apiauth.macrobondfinancial.com/mbauth/connect/token'

type TokenCache = {
  accessToken: string
  expiresAt: number
}

type CacheEntry<T> = {
  value: T
  expiresAt: number
  weight?: number
}

type MacrobondSearchDisplayResult = Record<string, unknown>
type MacrobondMetadataRecord = Record<string, unknown>
type MacrobondFetchEntityResult = {
  name?: string
  metadata?: Record<string, unknown>
  errorCode?: number
  errorText?: string
}
type MacrobondAttributeInfo = {
  name: string
  description: string | null
  usesValueList: boolean
  canListValues: boolean
  canHaveMultipleValues: boolean
  appliesTo: string[]
}

let tokenCache: TokenCache | null = null
let metadataDefinitionCache: CacheEntry<BenchmarkMetadataDefinition[]> | null = null
const metadataValuesCache = new Map<string, CacheEntry<BenchmarkMetadataValue[]>>()
const semanticContextCache = new Map<string, CacheEntry<BenchmarkSemanticContext>>()
const semanticEntityCache = new Map<string, CacheEntry<Record<string, unknown> | null>>()

const METADATA_CACHE_TTL_MS = 30 * 60 * 1000
const METADATA_VALUES_CACHE_MAX_ENTRIES = 24
const SEMANTIC_CONTEXT_CACHE_MAX_ENTRIES = 256
const SEMANTIC_ENTITY_CACHE_MAX_ENTRIES = 512
const MAX_METADATA_VALUES_CACHEABLE_ITEMS = 10_000
const MEMORY_LOG_MIN_VALUE_COUNT = 1_000
const SMART_RECALL_STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'the', 'to'])
const SMART_RECALL_MAX_SEEDS = 4
const CANONICAL_MACROBOND_FREQUENCY_FILTER_VALUES = new Set([
  'annual',
  'bimonthly',
  'daily',
  'monthly',
  'quadmonthly',
  'quarterly',
  'semiannual',
  'weekly',
])

const SEARCHABLE_ATTRIBUTE_CANDIDATES: Array<{
  key: string
  label: string
  category: 'business' | 'technical'
  featured: boolean
}> = [
  { key: 'Region', label: 'Region', category: 'business', featured: true },
  { key: 'Source', label: 'Source', category: 'business', featured: true },
  { key: 'Frequency', label: 'Frequency', category: 'business', featured: true },
  { key: 'Currency', label: 'Currency', category: 'business', featured: true },
  { key: 'TitleUnit', label: 'Unit', category: 'business', featured: true },
  { key: 'Release', label: 'Release', category: 'business', featured: false },
  { key: 'Category', label: 'Category', category: 'business', featured: true },
  { key: 'AlternativeCategory', label: 'Alternative category', category: 'business', featured: false },
  { key: 'Class', label: 'Series class', category: 'technical', featured: false },
  { key: 'DataType', label: 'Data type', category: 'technical', featured: false },
  { key: 'PriceType', label: 'Price type', category: 'technical', featured: false },
  { key: 'RateType', label: 'Rate type', category: 'technical', featured: false },
  { key: 'Exchange', label: 'Exchange', category: 'technical', featured: false },
]

function isCacheExpired<T>(entry: CacheEntry<T> | null | undefined) {
  return !entry || Date.now() >= entry.expiresAt
}

function logPerf(event: string, data: Record<string, string | number | boolean | null>) {
  const payload = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

  console.info(`[${event}] ${payload}`)
}

function toMb(value: number) {
  return Math.round((value / (1024 * 1024)) * 10) / 10
}

function logMemory(event: string, data: Record<string, string | number | boolean | null>) {
  const usage = process.memoryUsage()
  logPerf(event, {
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    externalMb: toMb(usage.external),
    ...data,
  })
}

function getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key)
  if (isCacheExpired(entry)) {
    if (entry) {
      cache.delete(key)
    }
    return null
  }

  if (!entry) {
    return null
  }

  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function trimCache<T>(cache: Map<string, CacheEntry<T>>, maxEntries: number, cacheName: string) {
  let evicted = 0
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
    evicted += 1
  }

  if (evicted > 0) {
    logPerf('BENCHMARK_CACHE_EVICT', {
      cache: cacheName,
      evicted,
      size: cache.size,
      maxEntries,
    })
  }
}

function setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, maxEntries: number, cacheName: string, weight?: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + METADATA_CACHE_TTL_MS,
    weight,
  })
  trimCache(cache, maxEntries, cacheName)
}

function getMacrobondConfig() {
  const clientId = serverEnv.MACROBOND_CLIENT_ID
  const clientSecret = serverEnv.MACROBOND_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new BenchmarkAppError(
      'PROVIDER_UNAVAILABLE',
      'Macrobond credentials are not configured on the server.',
      503,
    )
  }

  return {
    clientId,
    clientSecret,
    baseUrl: serverEnv.MACROBOND_BASE_URL ?? DEFAULT_MACROBOND_API_BASE_URL,
    tokenUrl: serverEnv.MACROBOND_TOKEN_URL ?? DEFAULT_MACROBOND_TOKEN_URL,
  }
}

function isExpired(cache: TokenCache | null) {
  if (!cache) return true
  return Date.now() >= cache.expiresAt
}

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && !isExpired(tokenCache)) {
    return tokenCache!.accessToken
  }

  const config = getMacrobondConfig()
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new BenchmarkAppError('PROVIDER_AUTH_FAILED', 'Macrobond authentication failed.', 502)
  }

  const payload = await response.json() as { access_token: string; expires_in?: number }
  const expiresIn = Math.max(60, payload.expires_in ?? 3600)
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (expiresIn - Math.min(60, Math.max(5, Math.floor(expiresIn / 10)))) * 1000,
  }

  return tokenCache.accessToken
}

async function macrobondRequest<T>(path: string, init: RequestInit): Promise<T> {
  const config = getMacrobondConfig()
  let token = await getAccessToken(false)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    })

    if (response.status === 401 && attempt === 0) {
      token = await getAccessToken(true)
      continue
    }

    if (response.status === 429) {
      throw new BenchmarkAppError('RATE_LIMITED', 'Macrobond rate limit exceeded.', 429)
    }

    if (response.status === 403) {
      throw new BenchmarkAppError('FORBIDDEN', 'Macrobond denied access to the requested resource.', 502)
    }

    if (!response.ok) {
      const body = await response.text()
      throw new BenchmarkAppError(
        'PROVIDER_UNAVAILABLE',
        body || `Macrobond request failed with status ${response.status}.`,
        502,
      )
    }

    return response.json() as Promise<T>
  }

  throw new BenchmarkAppError('PROVIDER_AUTH_FAILED', 'Macrobond authentication failed.', 502)
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getString(metadata, key)
    if (value) {
      return value
    }
  }
  return null
}

function getMetadataValue(metadata: Record<string, unknown>, key: string): string | string[] | null {
  const value = metadata[key]

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (Array.isArray(value)) {
    const normalized = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    return normalized.length > 0 ? normalized : null
  }

  return null
}

function getMetadataStringArray(metadata: Record<string, unknown>, key: string) {
  const value = getMetadataValue(metadata, key)
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function toCandidateMetadata(metadata: Record<string, unknown>) {
  const result: Record<string, string | string[]> = {}

  for (const attribute of SEARCHABLE_ATTRIBUTE_CANDIDATES) {
    const value = getMetadataValue(metadata, attribute.key)
    if (value) {
      result[attribute.key] = value
    }
  }

  return result
}

function getFirstMetadataValue(metadata: Record<string, unknown>, key: string) {
  const value = getMetadataValue(metadata, key)
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value
}

function splitFullDescriptionPath(value: string | null) {
  if (!value) {
    return [] as string[]
  }

  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
}

function normalizeEntityLabel(metadata: Record<string, unknown>) {
  return getMetadataString(metadata, ['FullDescription', 'Description', 'Abbreviation', 'PrimName', 'Name'])
}

function normalizeEntityDescription(metadata: Record<string, unknown>) {
  return getMetadataString(metadata, ['Description', 'FullDescription'])
}

function normalizeEntityDetails(id: string | null, metadata: Record<string, unknown> | null | undefined): BenchmarkSemanticEntity | null {
  if (!id) {
    return null
  }

  if (!metadata) {
    return {
      id,
      label: id,
      description: null,
      domicile: null,
      infoUrl: null,
      historyUrl: null,
      methodologyUrl: null,
      calendarUrl: null,
      lastReleaseAt: null,
      nextReleaseAt: null,
    }
  }

  return {
    id,
    label: normalizeEntityLabel(metadata),
    description: normalizeEntityDescription(metadata),
    domicile: getMetadataString(metadata, ['CountryOfDomicile']),
    infoUrl: getMetadataString(metadata, ['InfoUrl', 'InfoURL', 'Url', 'URL']),
    historyUrl: getMetadataString(metadata, ['HistoryUrl', 'HistoricalDataUrl', 'HistoricalDataURL']),
    methodologyUrl: getMetadataString(metadata, ['MethodologyUrl', 'MethodologyURL']),
    calendarUrl: getMetadataString(metadata, ['CalendarUrl']),
    lastReleaseAt: getMetadataString(metadata, ['LastReleaseEventTime']),
    nextReleaseAt: getMetadataString(metadata, ['NextReleaseEventTime']),
  }
}

function buildTechnicalMetadata(metadata: Record<string, unknown>) {
  const result: Record<string, string | string[]> = {}

  for (const key of ['Region', 'Source', 'Release', 'Category', 'AlternativeCategory', 'EuroStatCode', 'EuroStatBulkCode', 'Class', 'DataType', 'SamplingPeriod', 'Currency']) {
    const value = getMetadataValue(metadata, key)
    if (value) {
      result[key] = value
    }
  }

  return result
}

function deriveSemanticContext(metadata: Record<string, unknown>, relatedEntities: Map<string, Record<string, unknown> | null>): BenchmarkSemanticContext {
  const fullDescription = getMetadataString(metadata, ['FullDescription'])
  const path = splitFullDescriptionPath(fullDescription)
  const sourceId = getMetadataString(metadata, ['Source'])
  const releaseId = getMetadataString(metadata, ['Release'])
  const categoryId = getMetadataString(metadata, ['Category'])
  const conceptId = getMetadataString(metadata, ['Concept'])
  const alternativeCategoryIds = getMetadataStringArray(metadata, 'AlternativeCategory')

  const source = normalizeEntityDetails(sourceId, relatedEntities.get(sourceId ?? '') ?? null)
  const release = normalizeEntityDetails(releaseId, relatedEntities.get(releaseId ?? '') ?? null)
  const category = normalizeEntityDetails(categoryId, relatedEntities.get(categoryId ?? '') ?? null)
  const concept = conceptId ? normalizeEntityDetails(conceptId, relatedEntities.get(conceptId) ?? null) : null
  const alternativeCategories = alternativeCategoryIds
    .map((id) => normalizeEntityDetails(id, relatedEntities.get(id) ?? null))
    .filter((item): item is BenchmarkSemanticEntity => item !== null)

  const currencyCode = getMetadataString(metadata, ['Currency'])?.toUpperCase() ?? null
  const sourceLabel = source?.label?.trim() ?? null
  const description = getMetadataString(metadata, ['LongDescription', 'Comment'])
  const pathWithoutCurrency = path.filter((token, index) => !(currencyCode && index === path.length - 1 && token.toUpperCase() === currencyCode))
  const descriptionTokens = splitFullDescriptionPath(getMetadataString(metadata, ['Description']))
  const sourceIndex = sourceLabel ? pathWithoutCurrency.findIndex((token) => token.toLowerCase() === sourceLabel.toLowerCase()) : -1

  let primaryTitle = descriptionTokens.length > 1 ? descriptionTokens.join(', ') : (descriptionTokens[0] ?? null)
  let hierarchy = pathWithoutCurrency.filter((_, index) => index > 0)

  if (sourceIndex === 1 && pathWithoutCurrency.length > sourceIndex + 1) {
    primaryTitle = pathWithoutCurrency[sourceIndex + 1]
    hierarchy = pathWithoutCurrency.slice(sourceIndex + 2)
  } else if (descriptionTokens.length > 0) {
    const descriptionSet = new Set(descriptionTokens.map((token) => token.toLowerCase()))
    hierarchy = pathWithoutCurrency.filter((token, index) => index > 0 && (!sourceLabel || token.toLowerCase() !== sourceLabel.toLowerCase()) && !descriptionSet.has(token.toLowerCase()))
  }

  if (!primaryTitle && pathWithoutCurrency.length > 1) {
    primaryTitle = pathWithoutCurrency[1]
  }

  return {
    primaryTitle,
    description,
    fullDescription,
    hierarchy,
    path,
    source,
    release,
    category,
    alternativeCategories,
    concept,
    technicalMetadata: buildTechnicalMetadata(metadata),
  }
}

async function resolveMetadataDisplayLabel(metadataKey: string, value: string | null) {
  if (!value) {
    return null
  }

  try {
    const result = await getMacrobondMetadataValues(metadataKey, [])
    return result.items.find((item) => item.value === value)?.label ?? value
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      logPerf('BENCHMARK_LABEL_ENRICHMENT_FALLBACK', {
        metadataKey,
        code: error.code,
      })
      return value
    }

    throw error
  }
}

async function fetchMacrobondEntityMetadataBatch(names: string[]) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (uniqueNames.length === 0) {
    return new Map<string, Record<string, unknown>>()
  }

  const payload = await macrobondRequest<MacrobondFetchEntityResult[]>('/v1/series/fetchentities', {
    method: 'POST',
    body: JSON.stringify(uniqueNames.map((name) => ({ name }))),
  })

  const byName = new Map<string, Record<string, unknown>>()
  for (let index = 0; index < uniqueNames.length; index += 1) {
    const requestedName = uniqueNames[index]
    const item = payload[index]
    if (item && !item.errorCode && item.metadata) {
      byName.set(requestedName, item.metadata)
    }
  }

  return byName
}

async function fetchMacrobondSeriesMetadataBatch(names: string[]) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (uniqueNames.length === 0) {
    return new Map<string, Record<string, unknown>>()
  }

  const payload = await macrobondRequest<Array<{ metadata?: Record<string, unknown>; errorCode?: number }>>('/v1/series/fetchseries', {
    method: 'POST',
    body: JSON.stringify(uniqueNames.map((name) => ({ name, dateEndOfPeriod: true }))),
  })

  const byName = new Map<string, Record<string, unknown>>()
  for (let index = 0; index < uniqueNames.length; index += 1) {
    const requestedName = uniqueNames[index]
    const item = payload[index]
    if (item && !item.errorCode && item.metadata) {
      byName.set(requestedName, item.metadata)
    }
  }

  return byName
}

async function resolveSemanticEntityMetadata(ids: string[]) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  const result = new Map<string, Record<string, unknown> | null>()
  const missingIds: string[] = []

  for (const id of uniqueIds) {
    const cached = getCacheValue(semanticEntityCache, id)
    if (cached !== null || semanticEntityCache.has(id)) {
      result.set(id, cached)
      continue
    }

    missingIds.push(id)
  }

  if (missingIds.length > 0) {
    const fetched = await fetchMacrobondEntityMetadataBatch(missingIds)
    for (const id of missingIds) {
      const metadata = fetched.get(id) ?? null
      setCacheValue(semanticEntityCache, id, metadata, SEMANTIC_ENTITY_CACHE_MAX_ENTRIES, 'semanticEntity')
      result.set(id, metadata)
    }
  }

  return result
}

function normalizeCandidate(
  result: MacrobondSearchDisplayResult,
  options?: {
    metadata?: MacrobondMetadataRecord
    exactMatch?: boolean
  },
): BenchmarkCandidate | null {
  const seriesName = getString(result, 'Name')
  if (!seriesName) {
    return null
  }

  const title = getString(result, 'Title')
    ?? getString(result, 'FullDescription')
    ?? getString(result, 'Description')
    ?? seriesName
  const metadata = options?.metadata ?? {}

  return {
    candidateId: `macrobond:${seriesName}`,
    displayName: title,
    description: getString(result, 'Description') ?? null,
    provider: MACROBOND_PROVIDER,
    providerSeries: {
      provider: MACROBOND_PROVIDER,
      providerSeriesId: seriesName,
      providerSeriesKey: seriesName,
    },
    frequency: getString(result, 'Frequency'),
    currency: getString(result, 'Currency'),
    unit: getString(result, 'Unit'),
    source: getString(result, 'Source'),
    region: getString(result, 'Region') ?? getFirstMetadataValue(metadata, 'Region'),
    titleUnit: getFirstMetadataValue(metadata, 'TitleUnit'),
    lastObservationDate: getMetadataString(metadata, ['LastValueDate', 'EndDate']),
    exactMatch: options?.exactMatch ?? false,
    metadata: Object.keys(metadata).length > 0 ? toCandidateMetadata(metadata) : undefined,
  }
}

async function enrichCandidateDisplayLabels(candidate: BenchmarkCandidate) {
  const rawRegion = candidate.region
  const rawSource = candidate.source
  const rawFrequency = candidate.frequency
  const rawCurrency = candidate.currency

  const [resolvedRegion, resolvedSource, resolvedFrequency, resolvedCurrency] = await Promise.all([
    resolveMetadataDisplayLabel('Region', rawRegion),
    resolveMetadataDisplayLabel('Source', rawSource),
    resolveMetadataDisplayLabel('Frequency', rawFrequency),
    resolveMetadataDisplayLabel('Currency', rawCurrency),
  ])

  return {
    ...candidate,
    region: resolvedRegion ?? rawRegion,
    source: resolvedSource ?? rawSource,
    frequency: resolvedFrequency ?? rawFrequency,
    currency: resolvedCurrency ?? rawCurrency,
  }
}

function normalizeAttributeInfo(payload: unknown, attribute: { key: string; label: string; category: 'business' | 'technical'; featured: boolean }): BenchmarkMetadataDefinition | null {
  const item = Array.isArray(payload) ? payload[0] : null
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>
  const appliesTo = Array.isArray(record.appliesTo) ? record.appliesTo.filter((value): value is string => typeof value === 'string') : []
  const canListValues = Boolean(record.canListValues)

  if (!canListValues || !appliesTo.includes('TimeSeries')) {
    return null
  }

  return {
    key: attribute.key,
    label: attribute.label,
    description: getString(record, 'description'),
    searchable: true,
    featured: attribute.featured,
    category: attribute.category,
    controlType: Boolean(record.canHaveMultipleValues) ? 'multi-select' : 'single-select',
    allowMultipleValues: Boolean(record.canHaveMultipleValues),
    providerKey: attribute.key,
  }
}

function normalizeAttributeValues(payload: unknown): BenchmarkMetadataValue[] {
  const items = extractAttributeValueItems(payload)

  return items
    .map((item) => normalizeAttributeValue(item))
    .filter((item): item is BenchmarkMetadataValue => item !== null)
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }) || left.value.localeCompare(right.value, undefined, { sensitivity: 'base' }))
}

function extractAttributeValueItems(payload: unknown) {
  const items = Array.isArray(payload)
    ? payload
    : (payload as { values?: unknown[]; items?: unknown[] } | null)?.values
      ?? (payload as { values?: unknown[]; items?: unknown[] } | null)?.items
      ?? []

  if (!Array.isArray(items)) {
    return []
  }

  return items
}

function normalizeAttributeValue(item: unknown): BenchmarkMetadataValue | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>
  const value = getString(record, 'value') ?? getString(record, 'Value')
  if (!value) {
    return null
  }

  return {
    value,
    label: getString(record, 'description') ?? getString(record, 'Description') ?? value,
  }
}

function normalizeMacrobondFilterValue(metadataKey: string, value: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return null
  }

  if (metadataKey === 'Frequency') {
    const canonicalFrequencyValue = normalizedValue.toLowerCase()
    if (CANONICAL_MACROBOND_FREQUENCY_FILTER_VALUES.has(canonicalFrequencyValue)) {
      return canonicalFrequencyValue
    }
  }

  return normalizedValue
}

function collectFilteredMetadataValues(payload: unknown, query: string) {
  const items = extractAttributeValueItems(payload)
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    const values = normalizeAttributeValues(payload)
    return {
      totalCount: values.length,
      filteredValues: values,
    }
  }

  const filteredValues: BenchmarkMetadataValue[] = []
  for (const item of items) {
    const normalized = normalizeAttributeValue(item)
    if (!normalized) {
      continue
    }

    const normalizedLabel = normalized.label.toLowerCase()
    const normalizedValue = normalized.value.toLowerCase()
    if (normalizedLabel.includes(normalizedQuery) || normalizedValue.includes(normalizedQuery)) {
      filteredValues.push(normalized)
    }
  }

  return {
    totalCount: items.length,
    filteredValues: filterMetadataValues(filteredValues, query),
  }
}

function normalizeSearchFilters(filters: BenchmarkSearchFilter[]) {
  const mustHaveValues: Record<string, string[]> = {}

  for (const filter of filters) {
    const values = [filter.value, ...(filter.values ?? [])]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => normalizeMacrobondFilterValue(filter.metadataKey, value))
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (values.length > 0) {
      mustHaveValues[filter.metadataKey] = [...new Set(values)]
    }
  }

  return mustHaveValues
}

function filterMetadataValues(items: BenchmarkMetadataValue[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
  }

  return items
    .filter((item) => item.label.toLowerCase().includes(normalizedQuery) || item.value.toLowerCase().includes(normalizedQuery))
    .map((item) => {
      const normalizedLabel = item.label.toLowerCase()
      const normalizedValue = item.value.toLowerCase()
      const labelIndex = normalizedLabel.indexOf(normalizedQuery)
      const valueIndex = normalizedValue.indexOf(normalizedQuery)
      const wordStartMatch = normalizedLabel.split(/[^\p{L}\p{N}]+/u).some((token) => token.startsWith(normalizedQuery))

      let rank = 5
      if (labelIndex === 0) {
        rank = 0
      } else if (wordStartMatch) {
        rank = 1
      } else if (valueIndex === 0) {
        rank = 2
      } else if (labelIndex >= 0) {
        rank = 3
      } else if (valueIndex >= 0) {
        rank = 4
      }

      return {
        item,
        rank,
        labelIndex: labelIndex === -1 ? Number.MAX_SAFE_INTEGER : labelIndex,
        valueIndex: valueIndex === -1 ? Number.MAX_SAFE_INTEGER : valueIndex,
      }
    })
    .sort((left, right) => left.rank - right.rank
      || left.labelIndex - right.labelIndex
      || left.valueIndex - right.valueIndex
      || left.item.label.length - right.item.label.length
      || left.item.label.localeCompare(right.item.label, undefined, { sensitivity: 'base' })
      || left.item.value.localeCompare(right.item.value, undefined, { sensitivity: 'base' }))
    .map((entry) => entry.item)
}

function buildSmartRecallQueries(query: string) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return []
  }

  const cleanedQuery = normalizedQuery.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
  const lowerTokens = cleanedQuery
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9/+.-]/g, ''))
    .filter(Boolean)

  const significantTokens = lowerTokens.filter((token) => token.length > 2 && !SMART_RECALL_STOP_WORDS.has(token))
  const recallQueries = new Set<string>()

  if (/\blabor\b/i.test(cleanedQuery)) {
    recallQueries.add(cleanedQuery.replace(/\blabor\b/gi, 'labour'))
  }

  if (/\blabour\b/i.test(cleanedQuery)) {
    recallQueries.add(cleanedQuery.replace(/\blabour\b/gi, 'labor'))
  }

  if (significantTokens.length > 0 && significantTokens.join(' ') !== lowerTokens.join(' ')) {
    recallQueries.add(significantTokens.join(' '))
  }

  if (significantTokens.length >= 2) {
    for (let index = 0; index < significantTokens.length - 1; index += 1) {
      recallQueries.add(`${significantTokens[index]} ${significantTokens[index + 1]}`)
    }
  }

  const acronym = significantTokens.map((token) => token[0]).join('')
  if (acronym.length >= 3 && acronym.length <= 6) {
    recallQueries.add(acronym.toUpperCase())
  }

  return Array.from(recallQueries)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0 && candidate.toLowerCase() !== normalizedQuery.toLowerCase())
    .slice(0, SMART_RECALL_MAX_SEEDS)
}

async function searchMacrobondAdvancedEntities(text: string, mustHaveValues: Record<string, string[]>, limit: number) {
  const payload = await macrobondRequest<{ results?: MacrobondSearchDisplayResult[]; entities?: MacrobondSearchDisplayResult[]; isTruncated?: boolean }>('/v1/search/entities', {
    method: 'POST',
    body: JSON.stringify({
      includeDiscontinued: true,
      limit,
      filters: [{
        entityTypes: ['TimeSeries'],
        text,
        mustHaveValues,
      }],
    }),
  })

  return (payload.results ?? payload.entities ?? [])
    .map((result) => normalizeCandidate(result, { metadata: result }))
    .filter((item): item is BenchmarkCandidate => item !== null)
}

async function searchMacrobondDisplayEntities(text: string) {
  return macrobondRequest<{ results?: MacrobondSearchDisplayResult[] }>('/v1/search/entitiesfordisplay', {
    method: 'POST',
    body: JSON.stringify({
      includeDiscontinued: true,
      filters: [{ entityTypes: ['TimeSeries'], text }],
      attributesForDisplayFormat: ['Name', 'Region', 'Frequency', 'Currency', 'Unit', 'Source', 'Exchange'],
    }),
  })
}

function coerceSeriesPoint(date: unknown, value: unknown): BenchmarkPreviewPoint | null {
  if (typeof date !== 'string') {
    return null
  }

  return {
    date: normalizeBenchmarkObservationDate(date),
    value: typeof value === 'number' ? value : null,
  }
}

function sliceByRange(points: BenchmarkPreviewPoint[], range: BenchmarkRangePreset) {
  if (points.length === 0) {
    return points
  }

  if (range === 'ALL') {
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

function lastNonNullValue(points: BenchmarkPreviewPoint[]) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = points[index]?.value
    if (typeof value === 'number') {
      return value
    }
  }
  return null
}

function findLastPointOnOrBefore(points: BenchmarkPreviewPoint[], thresholdTime: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    if (point.value === null) {
      continue
    }

    const pointTime = parseBenchmarkObservationDate(point.date).getTime()
    if (pointTime <= thresholdTime) {
      return point
    }
  }

  return null
}

function computeChangeMetrics(points: BenchmarkPreviewPoint[]) {
  const latestPoint = [...points].reverse().find((point) => typeof point.value === 'number')
  if (!latestPoint || latestPoint.value === null) {
    return {}
  }

  const latestTime = new Date(latestPoint.date).getTime()
  const dayWindows = {
    '1M': 31,
    '3M': 92,
    '1Y': 366,
  } as const

  const metrics: Partial<Record<'1M' | '3M' | '1Y', number>> = {}

  for (const [key, days] of Object.entries(dayWindows) as Array<['1M' | '3M' | '1Y', number]>) {
    const thresholdTime = latestTime - (days * 24 * 60 * 60 * 1000)
    const baselinePoint = findLastPointOnOrBefore(points, thresholdTime)

    if (!baselinePoint || baselinePoint.value === null || baselinePoint.value === 0) {
      continue
    }

    metrics[key] = ((latestPoint.value - baselinePoint.value) / Math.abs(baselinePoint.value)) * 100
  }

  return metrics
}

export async function searchMacrobondBenchmarks(request: BenchmarkSearchRequest) {
  const normalizedQuery = request.query?.trim() ?? ''
  if (!normalizedQuery) {
    return []
  }

  const normalizedFilters = normalizeSearchFilters(request.filters ?? [])
  const hasMetadataFilters = Object.keys(normalizedFilters).length > 0
  const limit = request.limit ?? 8

  const startedAt = Date.now()

  if (!hasMetadataFilters) {
    const payload = await searchMacrobondDisplayEntities(normalizedQuery)

    const displayResults = payload.results ?? []
    const requestedResults = displayResults.slice(0, Math.max(limit * 3, limit))
    const metadataBySeriesName = await fetchMacrobondSeriesMetadataBatch(
      requestedResults
        .map((result) => getString(result, 'Name'))
        .filter((seriesName): seriesName is string => Boolean(seriesName)),
    )

    const items = requestedResults
      .map((result) => {
        const seriesName = getString(result, 'Name')
        if (!seriesName || !metadataBySeriesName.has(seriesName)) {
          return null
        }

        return normalizeCandidate(result, {
          metadata: metadataBySeriesName.get(seriesName),
        })
      })
      .filter((item): item is BenchmarkCandidate => item !== null)
      .slice(0, limit)

    logPerf('BENCHMARK_SEARCH_PERF', {
      mode: 'simple',
      providerMs: Date.now() - startedAt,
      resultCount: items.length,
      filterCount: 0,
      filteredAliases: requestedResults.length - items.length,
    })

    return items
  }

  const directItems = (await searchMacrobondAdvancedEntities(normalizedQuery, normalizedFilters, limit)).slice(0, limit)

  const recallQueries = directItems.length === 0 ? buildSmartRecallQueries(normalizedQuery) : []
  const recallItems = recallQueries.length > 0
    ? await Promise.all(recallQueries.map((query) => searchMacrobondAdvancedEntities(query, normalizedFilters, limit)))
    : []

  const dedupedItems = new Map<string, BenchmarkCandidate>()
  for (const item of directItems) {
    dedupedItems.set(item.providerSeries.providerSeriesId, item)
  }

  for (const group of recallItems) {
    for (const item of group) {
      if (!dedupedItems.has(item.providerSeries.providerSeriesId)) {
        dedupedItems.set(item.providerSeries.providerSeriesId, item)
      }

      if (dedupedItems.size >= limit) {
        break
      }
    }

    if (dedupedItems.size >= limit) {
      break
    }
  }

  const items = Array.from(dedupedItems.values()).slice(0, limit)

  const enrichedItems = await Promise.all(items.map((item) => enrichCandidateDisplayLabels(item)))

  logPerf('BENCHMARK_SEARCH_PERF', {
    mode: 'advanced',
    providerMs: Date.now() - startedAt,
    resultCount: enrichedItems.length,
    filterCount: Object.keys(normalizedFilters).length,
    recallUsed: recallQueries.length > 0,
  })

  return enrichedItems
}

export async function lookupMacrobondSeriesExact(seriesName: string): Promise<BenchmarkCandidate | null> {
  const normalizedSeriesName = seriesName.trim()
  if (!normalizedSeriesName) {
    return null
  }

  const startedAt = Date.now()
  const [payload, displayPayload] = await Promise.all([
    macrobondRequest<Array<{ metadata?: Record<string, unknown>; errorCode?: number; errorText?: string }>>('/v1/series/fetchentities', {
      method: 'POST',
      body: JSON.stringify([{ name: normalizedSeriesName }]),
    }),
    searchMacrobondDisplayEntities(normalizedSeriesName),
  ])

  const item = payload[0]
  const found = Boolean(item && !item.errorCode && item.metadata)

  logPerf('EXACT_BENCHMARK_LOOKUP_PERF', {
    providerMs: Date.now() - startedAt,
    found,
  })

  if (!found) {
    return null
  }

  const metadata = item.metadata ?? {}
  const displayResult = (displayPayload.results ?? []).find((result) => getString(result, 'Name') === normalizedSeriesName)
  const rawRegion = getString(displayResult ?? {}, 'Region') ?? getFirstMetadataValue(metadata, 'Region')
  const rawSource = getString(displayResult ?? {}, 'Source') ?? getMetadataString(metadata, ['Source'])
  const rawFrequency = getString(displayResult ?? {}, 'Frequency') ?? getMetadataString(metadata, ['Frequency', 'SamplingPeriod'])
  const rawCurrency = getString(displayResult ?? {}, 'Currency') ?? getMetadataString(metadata, ['Currency'])
  const [resolvedRegion, resolvedSource, resolvedFrequency, resolvedCurrency] = await Promise.all([
    resolveMetadataDisplayLabel('Region', rawRegion),
    resolveMetadataDisplayLabel('Source', rawSource),
    resolveMetadataDisplayLabel('Frequency', rawFrequency),
    resolveMetadataDisplayLabel('Currency', rawCurrency),
  ])

  return normalizeCandidate(
    {
      Name: normalizedSeriesName,
      Title: getString(displayResult ?? {}, 'Title')
        ?? getMetadataString(metadata, ['Title', 'PrimName', 'Description', 'Name'])
        ?? normalizedSeriesName,
      Description: getMetadataString(metadata, ['Description', 'FullDescription']),
      Frequency: resolvedFrequency,
      Currency: resolvedCurrency,
      Unit: getString(displayResult ?? {}, 'Unit') ?? getMetadataString(metadata, ['DisplayUnit', 'TitleUnit']),
      Source: resolvedSource,
      Region: resolvedRegion,
    },
    { metadata, exactMatch: true },
  )
}

export async function getMacrobondMetadataDefinitions(): Promise<BenchmarkMetadataDefinition[]> {
  if (!isCacheExpired(metadataDefinitionCache)) {
    return metadataDefinitionCache!.value
  }

  const startedAt = Date.now()
  const definitions = (
    await Promise.all(
      SEARCHABLE_ATTRIBUTE_CANDIDATES.map(async (attribute) => {
        const payload = await macrobondRequest<unknown>(`/v1/metadata/getattributeinformation?n=${encodeURIComponent(attribute.key)}`, {
          method: 'GET',
        })

        return normalizeAttributeInfo(payload, attribute)
      }),
    )
  ).filter((item): item is BenchmarkMetadataDefinition => item !== null)

  metadataDefinitionCache = {
    value: definitions,
    expiresAt: Date.now() + METADATA_CACHE_TTL_MS,
  }

  logPerf('BENCHMARK_METADATA_PERF', {
    operation: 'definitions',
    providerMs: Date.now() - startedAt,
    cacheHit: false,
    valueCount: definitions.length,
  })

  return definitions
}

export async function getMacrobondMetadataValues(
  metadataKey: string,
  filters: BenchmarkSearchFilter[],
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
  const normalizedFilters = normalizeSearchFilters(filters.filter((filter) => filter.metadataKey !== metadataKey))
  const cacheKey = JSON.stringify({ metadataKey, filters: normalizedFilters })
  const normalizedQuery = options?.query?.trim() ?? ''
  const cached = getCacheValue(metadataValuesCache, cacheKey)
  let allValues: BenchmarkMetadataValue[]

  if (cached) {
    logPerf('BENCHMARK_METADATA_PERF', {
      operation: `values:${metadataKey}`,
      providerMs: 0,
      cacheHit: true,
      valueCount: cached.length,
      cacheEntries: metadataValuesCache.size,
    })
    allValues = cached
  } else {
    const params = new URLSearchParams({ n: metadataKey })
    for (const [key, values] of Object.entries(normalizedFilters)) {
      for (const value of values) {
        params.append(key, value)
      }
    }

    const startedAt = Date.now()
    logMemory('BENCHMARK_MEMORY', {
      operation: `values:${metadataKey}`,
      stage: 'before-fetch',
      filterCount: Object.keys(normalizedFilters).length,
      cacheEntries: metadataValuesCache.size,
      queryLength: options?.query?.trim().length ?? 0,
    })
    const payload = await macrobondRequest<unknown>(`/v1/metadata/listattributevalues?${params.toString()}`, {
      method: 'GET',
    })
    if (normalizedQuery) {
      const { totalCount, filteredValues } = collectFilteredMetadataValues(payload, normalizedQuery)
      const limit = typeof options?.limit === 'number' && Number.isFinite(options.limit)
        ? Math.max(1, Math.floor(options.limit))
        : filteredValues.length

      logPerf('BENCHMARK_METADATA_PERF', {
        operation: `values:${metadataKey}`,
        providerMs: Date.now() - startedAt,
        cacheHit: false,
        valueCount: totalCount,
        filteredCount: filteredValues.length,
        cacheStored: false,
        cacheEntries: metadataValuesCache.size,
      })

      if (totalCount >= MEMORY_LOG_MIN_VALUE_COUNT || metadataKey === 'Region') {
        logMemory('BENCHMARK_MEMORY', {
          operation: `values:${metadataKey}`,
          stage: 'after-filtered-normalize',
          valueCount: totalCount,
          filteredCount: filteredValues.length,
          cacheStored: false,
          cacheEntries: metadataValuesCache.size,
        })
      }

      return {
        items: filteredValues.slice(0, limit),
        totalCount,
        filteredCount: filteredValues.length,
        query: normalizedQuery,
        limited: filteredValues.length > limit,
      }
    }

    const values = normalizeAttributeValues(payload)

    const shouldCacheValues = values.length <= MAX_METADATA_VALUES_CACHEABLE_ITEMS
    if (shouldCacheValues) {
      setCacheValue(metadataValuesCache, cacheKey, values, METADATA_VALUES_CACHE_MAX_ENTRIES, 'metadataValues', values.length)
    }

    logPerf('BENCHMARK_METADATA_PERF', {
      operation: `values:${metadataKey}`,
      providerMs: Date.now() - startedAt,
      cacheHit: false,
      valueCount: values.length,
      cacheStored: shouldCacheValues,
      cacheEntries: metadataValuesCache.size,
    })

    if (values.length >= MEMORY_LOG_MIN_VALUE_COUNT || metadataKey === 'Region') {
      logMemory('BENCHMARK_MEMORY', {
        operation: `values:${metadataKey}`,
        stage: 'after-normalize',
        valueCount: values.length,
        cacheStored: shouldCacheValues,
        cacheEntries: metadataValuesCache.size,
      })
    }

    allValues = values
  }

  const filteredValues = normalizedQuery ? filterMetadataValues(allValues, normalizedQuery) : allValues
  const limit = typeof options?.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : filteredValues.length

  return {
    items: filteredValues.slice(0, limit),
    totalCount: allValues.length,
    filteredCount: filteredValues.length,
    query: normalizedQuery,
    limited: filteredValues.length > limit,
  }
}

export async function fetchMacrobondEntityMetadata(seriesName: string) {
  const payload = await macrobondRequest<Array<{ metadata?: Record<string, unknown>; errorCode?: number; errorText?: string }>>('/v1/series/fetchentities', {
    method: 'POST',
    body: JSON.stringify([{ name: seriesName }]),
  })

  const item = payload[0]
  if (!item || item.errorCode) {
    throw new BenchmarkAppError('PROVIDER_SERIES_NOT_FOUND', `Macrobond series ${seriesName} was not found.`, 404)
  }

  return item.metadata ?? {}
}

export async function getMacrobondSemanticContexts(seriesNames: string[]) {
  const uniqueSeriesNames = [...new Set(seriesNames.map((name) => name.trim()).filter(Boolean))]
  const contexts = new Map<string, BenchmarkSemanticContext>()
  const missingSeriesNames: string[] = []

  for (const seriesName of uniqueSeriesNames) {
    const cached = getCacheValue(semanticContextCache, seriesName)
    if (cached) {
      contexts.set(seriesName, cached)
      continue
    }

    missingSeriesNames.push(seriesName)
  }

  if (missingSeriesNames.length === 0) {
    return Object.fromEntries(contexts.entries())
  }

  const seriesMetadata = await fetchMacrobondEntityMetadataBatch(missingSeriesNames)
  const relatedEntityIds = new Set<string>()

  logMemory('BENCHMARK_MEMORY', {
    operation: 'semanticContext',
    stage: 'before-resolve',
    seriesCount: missingSeriesNames.length,
    contextCacheEntries: semanticContextCache.size,
    entityCacheEntries: semanticEntityCache.size,
  })

  for (const metadata of seriesMetadata.values()) {
    for (const key of ['Source', 'Release', 'Category', 'Concept']) {
      const value = getMetadataString(metadata, [key])
      if (value) {
        relatedEntityIds.add(value)
      }
    }

    for (const value of getMetadataStringArray(metadata, 'AlternativeCategory')) {
      relatedEntityIds.add(value)
    }
  }

  const relatedEntities = await resolveSemanticEntityMetadata([...relatedEntityIds])

  for (const seriesName of missingSeriesNames) {
    const metadata = seriesMetadata.get(seriesName)
    if (!metadata) {
      continue
    }

    const context = deriveSemanticContext(metadata, relatedEntities)
    setCacheValue(semanticContextCache, seriesName, context, SEMANTIC_CONTEXT_CACHE_MAX_ENTRIES, 'semanticContext')
    contexts.set(seriesName, context)
  }

  logMemory('BENCHMARK_MEMORY', {
    operation: 'semanticContext',
    stage: 'after-resolve',
    seriesCount: missingSeriesNames.length,
    relatedEntityCount: relatedEntityIds.size,
    contextCacheEntries: semanticContextCache.size,
    entityCacheEntries: semanticEntityCache.size,
  })

  return Object.fromEntries(contexts.entries())
}

export async function fetchMacrobondSeriesHistory(seriesName: string): Promise<BenchmarkHistoricalSeriesResult> {
  const payload = await macrobondRequest<Array<{ metadata?: Record<string, unknown>; dates?: unknown[]; values?: unknown[]; errorCode?: number }>>('/v1/series/fetchseries', {
    method: 'POST',
    body: JSON.stringify([{ name: seriesName, dateEndOfPeriod: true }]),
  })

  const item = payload[0]
  if (!item || item.errorCode) {
    throw new BenchmarkAppError('PROVIDER_SERIES_NOT_FOUND', `Macrobond series ${seriesName} could not be loaded.`, 404)
  }

  const metadata = item.metadata ?? {}
  const rawDates = Array.isArray(item.dates) ? item.dates : []
  const rawValues = Array.isArray(item.values) ? item.values : []
  const historical = rawDates
    .map((date, index) => coerceSeriesPoint(date, rawValues[index]))
    .filter((point): point is BenchmarkPreviewPoint => point !== null)

  const displayName = getMetadataString(metadata, ['Title', 'Description', 'PrimName', 'Name']) ?? seriesName

  return {
    providerSeries: {
      provider: MACROBOND_PROVIDER,
      providerSeriesId: seriesName,
      providerSeriesKey: seriesName,
    },
    displayName,
    frequency: getMetadataString(metadata, ['Frequency', 'SamplingPeriod']),
    currency: getMetadataString(metadata, ['Currency']),
    unit: getMetadataString(metadata, ['Unit']),
    source: getMetadataString(metadata, ['Source']),
    historical,
  }
}

export async function previewMacrobondSeries(seriesName: string, range: BenchmarkRangePreset): Promise<BenchmarkPreviewResult> {
  const history = await fetchMacrobondSeriesHistory(seriesName)
  const sliced = sliceByRange(history.historical, range)

  return {
    providerSeries: history.providerSeries,
    displayName: history.displayName,
    latestValue: lastNonNullValue(sliced),
    frequency: history.frequency,
    currency: history.currency,
    unit: history.unit,
    source: history.source,
    range,
    changeMetrics: computeChangeMetrics(history.historical),
    historical: sliced,
  }
}