import assert from 'node:assert/strict'
import test from 'node:test'

process.env.APP_ENV = 'development'
process.env.MACROBOND_CLIENT_ID = 'test-client-id'
process.env.MACROBOND_CLIENT_SECRET = 'test-client-secret'
process.env.MARKET_DATA_DATABASE_URL = 'postgresql://local-test/market-data'

type FacetRow = {
  providerCode: string
  key: string
  label: string
  description: string | null
  searchable: boolean
  featured: boolean
  category: string
  controlType: string
  allowMultipleValues: boolean
  providerKey: string
  active: boolean
}

type ValueRow = {
  providerCode: string
  facetKey: string
  providerValueId: string
  label: string
  normalizedLabel: string
  active: boolean
}

type MetadataValueWhere = {
  providerCode?: string
  facetKey?: string
  active?: boolean
  OR?: Array<{
    label?: { contains?: string; equals?: string; mode?: 'insensitive' }
    providerValueId?: { contains?: string; equals?: string; mode?: 'insensitive' } | string
    normalizedLabel?: { contains?: string } | string
  }>
}

const facetRows: FacetRow[] = [
  {
    providerCode: 'MACROBOND',
    key: 'Region',
    label: 'Region',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'multi-select',
    allowMultipleValues: true,
    providerKey: 'Region',
    active: true,
  },
  {
    providerCode: 'MACROBOND',
    key: 'Frequency',
    label: 'Frequency',
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: 'Frequency',
    active: true,
  },
]

const valueRows: ValueRow[] = [
  {
    providerCode: 'MACROBOND',
    facetKey: 'Frequency',
    providerValueId: 'daily',
    label: 'Daily',
    normalizedLabel: 'daily',
    active: true,
  },
  {
    providerCode: 'MACROBOND',
    facetKey: 'Frequency',
    providerValueId: 'monthly',
    label: 'Monthly',
    normalizedLabel: 'monthly',
    active: true,
  },
  {
    providerCode: 'MACROBOND',
    facetKey: 'Region',
    providerValueId: 'state_br_acr',
    label: 'Acre',
    normalizedLabel: 'acre',
    active: true,
  },
  {
    providerCode: 'MACROBOND',
    facetKey: 'Source',
    providerValueId: 'src_cncisa',
    label: 'China Iron & Steel Association',
    normalizedLabel: 'china iron & steel association',
    active: true,
  },
  {
    providerCode: 'MACROBOND',
    facetKey: 'Currency',
    providerValueId: 'usd',
    label: 'US Dollar',
    normalizedLabel: 'us dollar',
    active: true,
  },
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installFetchMock(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.toString()
        : input

    return handler(url, init)
  }) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}

function matchesString(candidate: string, matcher: { contains?: string; equals?: string; mode?: 'insensitive' } | string | undefined) {
  if (typeof matcher === 'undefined') {
    return true
  }

  if (typeof matcher === 'string') {
    return candidate === matcher
  }

  const left = matcher.mode === 'insensitive' ? candidate.toLowerCase() : candidate
  if (typeof matcher.equals === 'string') {
    const right = matcher.mode === 'insensitive' ? matcher.equals.toLowerCase() : matcher.equals
    return left === right
  }

  if (typeof matcher.contains === 'string') {
    const right = matcher.mode === 'insensitive' ? matcher.contains.toLowerCase() : matcher.contains
    return left.includes(right)
  }

  return true
}

function matchesMetadataValueWhere(row: ValueRow, where: MetadataValueWhere) {
  if (where.providerCode && row.providerCode !== where.providerCode) {
    return false
  }

  if (where.facetKey && row.facetKey !== where.facetKey) {
    return false
  }

  if (typeof where.active === 'boolean' && row.active !== where.active) {
    return false
  }

  if (!where.OR || where.OR.length === 0) {
    return true
  }

  return where.OR.some((matcher) => (
    matchesString(row.label, matcher.label)
    && matchesString(row.providerValueId, matcher.providerValueId)
    && matchesString(row.normalizedLabel, matcher.normalizedLabel)
  ))
}

function installMarketDataPrisma() {
  const prisma = {
    benchmarkMetadataFacetRecord: {
      async findMany({ where }: { where: { providerCode: string; active: boolean; key: { in: string[] } } }) {
        return facetRows.filter((row) => (
          row.providerCode === where.providerCode
          && row.active === where.active
          && where.key.in.includes(row.key)
        ))
      },
    },
    benchmarkMetadataValueRecord: {
      async count({ where }: { where: MetadataValueWhere }) {
        return valueRows.filter((row) => matchesMetadataValueWhere(row, where)).length
      },
      async findMany({ where, take }: { where: MetadataValueWhere; take: number }) {
        return valueRows
          .filter((row) => matchesMetadataValueWhere(row, where))
          .sort((left, right) => left.label.localeCompare(right.label) || left.providerValueId.localeCompare(right.providerValueId))
          .slice(0, take)
          .map((row) => ({ providerValueId: row.providerValueId, label: row.label }))
      },
      async findFirst({ where }: { where: MetadataValueWhere }) {
        const row = valueRows.find((candidate) => matchesMetadataValueWhere(candidate, where))
        return row ? { label: row.label } : null
      },
    },
  }

  globalThis.__sgRuntimeMarketDataPrisma__ = prisma as never

  return () => {
    delete globalThis.__sgRuntimeMarketDataPrisma__
  }
}

test('metadata definitions and unfiltered values use the local metadata store before provider calls', async () => {
  const restorePrisma = installMarketDataPrisma()
  const requests: string[] = []
  const restoreFetch = installFetchMock(async (url) => {
    requests.push(url)
    throw new Error(`Unexpected provider call: ${url}`)
  })

  try {
    const { getBenchmarkMetadataDefinitions, getBenchmarkMetadataValues } = await import('../lib/benchmark/service')

    const definitions = await getBenchmarkMetadataDefinitions()
    const values = await getBenchmarkMetadataValues('Frequency', [], undefined)

    assert.deepEqual(definitions.map((item) => item.key), ['Region', 'Frequency'])
    assert.deepEqual(values.items, [
      { value: 'daily', label: 'Daily' },
      { value: 'monthly', label: 'Monthly' },
    ])
    assert.equal(values.totalCount, 2)
    assert.equal(values.filteredCount, 2)
    assert.equal(requests.length, 0)
  } finally {
    restoreFetch()
    restorePrisma()
  }
})

test('metadata values fall back to the provider when sibling filters require live narrowing', async () => {
  const restorePrisma = installMarketDataPrisma()
  const requests: string[] = []
  const restoreFetch = installFetchMock(async (url) => {
    requests.push(url)

    if (url.includes('/mbauth/connect/token')) {
      return jsonResponse({ access_token: 'token', expires_in: 3600 })
    }

    if (url.includes('/v1/metadata/listattributevalues')) {
      return jsonResponse([
        { value: 'state_br_acr', description: 'Acre' },
      ])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { getBenchmarkMetadataValues } = await import('../lib/benchmark/service')

    const values = await getBenchmarkMetadataValues(
      'Region',
      [{ metadataKey: 'Frequency', operator: 'equals', values: ['Daily'] }],
      { query: 'acr', limit: 25 },
    )

    assert.deepEqual(values.items, [{ value: 'state_br_acr', label: 'Acre' }])
    assert.ok(requests.some((url) => url.includes('/v1/metadata/listattributevalues')))
  } finally {
    restoreFetch()
    restorePrisma()
  }
})

test('exact lookup resolves display labels from the local metadata store before metadata provider hydration', async () => {
  const restorePrisma = installMarketDataPrisma()
  const requests: string[] = []
  const restoreFetch = installFetchMock(async (url, init) => {
    requests.push(url)

    if (url.includes('/mbauth/connect/token')) {
      return jsonResponse({ access_token: 'token', expires_in: 3600 })
    }

    if (url.includes('/v1/search/entities')) {
      return jsonResponse({
        results: [{
          Name: 'cnprod4162',
          Title: 'China, Steel Inventory',
          Description: 'Daily steel inventory',
          Frequency: 'daily',
          Region: 'state_br_acr',
          Currency: 'usd',
          Source: 'src_cncisa',
        }],
      })
    }

    if (url.includes('/v1/search/entitiesfordisplay')) {
      return jsonResponse({
        results: [{
          Name: 'cnprod4162',
          Title: 'China, Steel Inventory',
          Frequency: 'daily',
          Region: 'state_br_acr',
          Unit: 'Tons (Metric)',
          Currency: 'usd',
          Source: 'src_cncisa',
        }],
      })
    }

    if (url.includes('/v1/series/fetchseries')) {
      return jsonResponse([{ metadata: {
        Title: 'China, Steel Inventory',
        Description: 'Daily steel inventory',
        Frequency: 'daily',
        Region: 'state_br_acr',
        Currency: 'usd',
        Source: 'src_cncisa',
      } }])
    }

    if (url.includes('/v1/series/fetchentities')) {
      return jsonResponse([{ metadata: {
        Title: 'China, Steel Inventory',
        Description: 'Daily steel inventory',
        Frequency: 'daily',
        Region: 'state_br_acr',
        Currency: 'usd',
        Source: 'src_cncisa',
      } }])
    }

    if (url.includes('/v1/metadata/listattributevalues')) {
      throw new Error(`Unexpected metadata provider hydration: ${url} body=${typeof init?.body === 'string' ? init.body : ''}`)
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { lookupMacrobondSeriesExact } = await import('../lib/benchmark/macrobond')

    const item = await lookupMacrobondSeriesExact('cnprod4162')

    assert.ok(item)
    assert.equal(item?.frequency, 'Daily')
    assert.equal(item?.region, 'Acre')
    assert.equal(item?.currency, 'US Dollar')
    assert.equal(item?.source, 'China Iron & Steel Association')
    assert.ok(!requests.some((url) => url.includes('/v1/metadata/listattributevalues')))
  } finally {
    restoreFetch()
    restorePrisma()
  }
})