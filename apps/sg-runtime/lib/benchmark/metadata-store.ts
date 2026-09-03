import type {
  BenchmarkMetadataDefinition,
  BenchmarkMetadataValue,
  BenchmarkSearchFilter,
} from '@/lib/benchmark/contracts'

const MACROBOND_PROVIDER_CODE = 'MACROBOND'
const REGION_METADATA_KEY = 'Region'
const DEFAULT_REGION_LIMIT = 200

const LOCAL_METADATA_DEFINITIONS: BenchmarkMetadataDefinition[] = [
  {
    key: 'Region',
    label: 'Region',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'multi-select',
    allowMultipleValues: true,
    providerKey: 'Region',
  },
  {
    key: 'Source',
    label: 'Source',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: 'Source',
  },
  {
    key: 'Frequency',
    label: 'Frequency',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: 'Frequency',
  },
  {
    key: 'Currency',
    label: 'Currency',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: 'Currency',
  },
  {
    key: 'TitleUnit',
    label: 'Unit',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: 'TitleUnit',
  },
  {
    key: 'Category',
    label: 'Category',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: 'Category',
  },
]

const LOCAL_METADATA_KEYS = new Set(LOCAL_METADATA_DEFINITIONS.map((item) => item.key))
const LOCAL_METADATA_ORDER = new Map(LOCAL_METADATA_DEFINITIONS.map((item, index) => [item.key, index]))

async function loadMarketDataPrisma() {
  const { getMarketDataPrisma } = await import('@/lib/market-data/client')
  return getMarketDataPrisma()
}

function normalizeQuery(query?: string) {
  return query?.trim() ?? ''
}

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase()
}

function getEffectiveLimit(metadataKey: string, requestedLimit: number | undefined, filteredCount: number) {
  if (typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)) {
    return Math.max(1, Math.floor(requestedLimit))
  }

  if (metadataKey === REGION_METADATA_KEY) {
    return DEFAULT_REGION_LIMIT
  }

  return filteredCount
}

function canServeLocally(metadataKey: string, filters: BenchmarkSearchFilter[]) {
  if (!LOCAL_METADATA_KEYS.has(metadataKey)) {
    return false
  }

  return filters.every((filter) => filter.metadataKey === metadataKey)
}

function normalizeLocalDefinition(row: {
  key: string
  label: string
  description: string | null
  searchable: boolean
  featured: boolean
  category: string
  controlType: string
  allowMultipleValues: boolean
  providerKey: string
}): BenchmarkMetadataDefinition | null {
  const fallback = LOCAL_METADATA_DEFINITIONS.find((item) => item.key === row.key)
  if (!fallback) {
    return null
  }

  return {
    key: row.key,
    label: row.label || fallback.label,
    description: row.description,
    searchable: row.searchable,
    featured: row.featured,
    category: row.category === 'technical' ? 'technical' : 'business',
    controlType: row.controlType === 'multi-select' ? 'multi-select' : 'single-select',
    allowMultipleValues: row.allowMultipleValues,
    providerKey: row.providerKey || fallback.providerKey,
  }
}

export async function getStoredBenchmarkMetadataDefinitions(): Promise<BenchmarkMetadataDefinition[] | null> {
  const prisma = await loadMarketDataPrisma()
  if (!prisma) {
    return null
  }

  try {
    const rows = await prisma.benchmarkMetadataFacetRecord.findMany({
      where: {
        providerCode: MACROBOND_PROVIDER_CODE,
        active: true,
        key: { in: [...LOCAL_METADATA_KEYS] },
      },
      select: {
        key: true,
        label: true,
        description: true,
        searchable: true,
        featured: true,
        category: true,
        controlType: true,
        allowMultipleValues: true,
        providerKey: true,
      },
    })

    if (rows.length === 0) {
      return null
    }

    return rows
      .map((row) => normalizeLocalDefinition(row))
      .filter((row): row is BenchmarkMetadataDefinition => row !== null)
      .sort((left, right) => (LOCAL_METADATA_ORDER.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (LOCAL_METADATA_ORDER.get(right.key) ?? Number.MAX_SAFE_INTEGER))
  } catch (error) {
    console.warn('[BENCHMARK_METADATA_STORE_READ_FAILED] operation=definitions', error)
    return null
  }
}

export async function getStoredBenchmarkMetadataValues(
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
} | null> {
  if (!canServeLocally(metadataKey, filters)) {
    return null
  }

  const prisma = await loadMarketDataPrisma()
  if (!prisma) {
    return null
  }

  const query = normalizeQuery(options?.query)
  const baseWhere = {
    providerCode: MACROBOND_PROVIDER_CODE,
    facetKey: metadataKey,
    active: true,
  }

  const filteredWhere = query
    ? {
        ...baseWhere,
        OR: [
          { label: { contains: query, mode: 'insensitive' as const } },
          { providerValueId: { contains: query, mode: 'insensitive' as const } },
          { normalizedLabel: { contains: normalizeLookupValue(query) } },
        ],
      }
    : baseWhere

  try {
    const [totalCount, filteredCount] = await Promise.all([
      prisma.benchmarkMetadataValueRecord.count({ where: baseWhere }),
      prisma.benchmarkMetadataValueRecord.count({ where: filteredWhere }),
    ])

    if (totalCount === 0) {
      return null
    }

    if (query && filteredCount === 0) {
      return null
    }

    const limit = getEffectiveLimit(metadataKey, options?.limit, filteredCount)
    const rows = await prisma.benchmarkMetadataValueRecord.findMany({
      where: filteredWhere,
      select: {
        providerValueId: true,
        label: true,
      },
      orderBy: [
        { label: 'asc' },
        { providerValueId: 'asc' },
      ],
      take: limit,
    })

    return {
      items: rows.map((row) => ({
        value: row.providerValueId,
        label: row.label,
      })),
      totalCount,
      filteredCount,
      query,
      limited: filteredCount > limit,
    }
  } catch (error) {
    console.warn(`[BENCHMARK_METADATA_STORE_READ_FAILED] operation=values key=${metadataKey}`, error)
    return null
  }
}

export async function resolveStoredBenchmarkMetadataDisplayLabel(metadataKey: string, value: string | null) {
  const normalizedValue = value?.trim()
  if (!normalizedValue || !LOCAL_METADATA_KEYS.has(metadataKey)) {
    return null
  }

  const prisma = await loadMarketDataPrisma()
  if (!prisma) {
    return null
  }

  try {
    const row = await prisma.benchmarkMetadataValueRecord.findFirst({
      where: {
        providerCode: MACROBOND_PROVIDER_CODE,
        facetKey: metadataKey,
        active: true,
        OR: [
          { providerValueId: normalizedValue },
          { providerValueId: { equals: normalizedValue, mode: 'insensitive' } },
          { label: { equals: normalizedValue, mode: 'insensitive' } },
          { normalizedLabel: normalizeLookupValue(normalizedValue) },
        ],
      },
      select: {
        label: true,
      },
    })

    return row?.label ?? null
  } catch (error) {
    console.warn(`[BENCHMARK_METADATA_STORE_READ_FAILED] operation=label key=${metadataKey}`, error)
    return null
  }
}