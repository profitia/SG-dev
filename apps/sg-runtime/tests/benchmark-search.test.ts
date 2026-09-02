import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

process.env.APP_ENV = 'development'
process.env.MACROBOND_CLIENT_ID = 'test-client-id'
process.env.MACROBOND_CLIENT_SECRET = 'test-client-secret'

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

test('advanced search returns filtered results even when metadata label enrichment fails', async () => {
  const requests: Array<{ url: string; body: string | null }> = []
  const restoreFetch = installFetchMock(async (url, init) => {
    requests.push({ url, body: typeof init?.body === 'string' ? init.body : null })

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
          Region: 'cn',
          Unit: 'Tons (Metric)',
          Source: 'src_cncisa',
        }],
      })
    }

    if (url.includes('/v1/metadata/listattributevalues')) {
      return jsonResponse({ error: 'provider unavailable' }, 502)
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { searchMacrobondBenchmarks } = await import('../lib/benchmark/macrobond')
    const items = await searchMacrobondBenchmarks({
      query: 'steel',
      filters: [{ metadataKey: 'Frequency', operator: 'equals', values: ['Daily'] }],
      limit: 25,
    })

    assert.equal(items.length, 1)
    assert.equal(items[0]?.displayName, 'China, Steel Inventory')
    assert.equal(items[0]?.frequency, 'daily')
    assert.equal(items[0]?.region, 'cn')
    assert.equal(items[0]?.source, 'src_cncisa')

    const providerRequest = requests.find((request) => request.url.includes('/v1/search/entities'))
    assert.ok(providerRequest)
    const providerBody = JSON.parse(providerRequest.body ?? '{}') as {
      filters?: Array<{ mustHaveValues?: Record<string, string[]> }>
    }
    assert.deepEqual(providerBody.filters?.[0]?.mustHaveValues?.Frequency, ['daily'])
    assert.ok(requests.some((request) => request.url.includes('/v1/metadata/listattributevalues')))
  } finally {
    restoreFetch()
  }
})

test('advanced search normalizes human-readable Frequency labels before provider search', async () => {
  const requests: Array<{ url: string; body: string | null }> = []
  const restoreFetch = installFetchMock(async (url, init) => {
    requests.push({ url, body: typeof init?.body === 'string' ? init.body : null })

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
          Region: 'cn',
          Unit: 'Tons (Metric)',
          Source: 'src_cncisa',
        }],
      })
    }

    if (url.includes('/v1/metadata/listattributevalues')) {
      return jsonResponse([])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { searchMacrobondBenchmarks } = await import('../lib/benchmark/macrobond')
    const items = await searchMacrobondBenchmarks({
      query: 'steel',
      filters: [{ metadataKey: 'Frequency', operator: 'equals', values: ['Daily'] }],
      limit: 25,
    })

    assert.equal(items.length, 1)

    const providerRequest = requests.find((request) => request.url.includes('/v1/search/entities'))
    assert.ok(providerRequest)
    const providerBody = JSON.parse(providerRequest.body ?? '{}') as {
      filters?: Array<{ mustHaveValues?: Record<string, string[]> }>
    }
    assert.deepEqual(providerBody.filters?.[0]?.mustHaveValues?.Frequency, ['daily'])
  } finally {
    restoreFetch()
  }
})

test('query with no optional filters stays lawful and returns results', async () => {
  const requests: string[] = []
  const restoreFetch = installFetchMock(async (url) => {
    requests.push(url)

    if (url.includes('/mbauth/connect/token')) {
      return jsonResponse({ access_token: 'token', expires_in: 3600 })
    }

    if (url.includes('/v1/search/entitiesfordisplay')) {
      return jsonResponse({
        results: [{
          Name: 'cnprod4162',
          Title: 'China, Steel Inventory',
          Frequency: 'daily',
          Region: 'China',
          Unit: 'Tons (Metric)',
          Source: 'China Iron & Steel Association',
        }],
      })
    }

    if (url.includes('/v1/series/fetchseries')) {
      return jsonResponse([{ metadata: { Region: 'cn', Frequency: 'daily', Source: 'src_cncisa' } }])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { searchBenchmarks } = await import('../lib/benchmark/service')
    const items = await searchBenchmarks({ query: 'steel', filters: [], limit: 25 })

    assert.equal(items.length, 1)
    assert.ok(requests.some((url) => url.includes('/v1/search/entitiesfordisplay')))
    assert.ok(!requests.some((url) => url.includes('/v1/search/entities') && !url.includes('fordisplay')))
  } finally {
    restoreFetch()
  }
})

test('lawful advanced query returning zero results does not throw', async () => {
  const restoreFetch = installFetchMock(async (url) => {
    if (url.includes('/mbauth/connect/token')) {
      return jsonResponse({ access_token: 'token', expires_in: 3600 })
    }

    if (url.includes('/v1/search/entities')) {
      return jsonResponse({ results: [] })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { searchMacrobondBenchmarks } = await import('../lib/benchmark/macrobond')
    const items = await searchMacrobondBenchmarks({
      query: 'steel',
      filters: [{ metadataKey: 'Frequency', operator: 'equals', values: ['daily'] }],
      limit: 25,
    })

    assert.deepEqual(items, [])
  } finally {
    restoreFetch()
  }
})

test('exact series lookup path remains available', async () => {
  const restoreFetch = installFetchMock(async (url, init) => {
    if (url.includes('/mbauth/connect/token')) {
      return jsonResponse({ access_token: 'token', expires_in: 3600 })
    }

    if (url.includes('/v1/series/fetchentities')) {
      const requestBody = JSON.parse(typeof init?.body === 'string' ? init.body : '[]') as Array<{ name: string }>
      assert.equal(requestBody[0]?.name, 'usfcstpi')
      return jsonResponse([{ metadata: {
        Name: 'usfcstpi',
        Title: 'United States CPI',
        Description: 'United States CPI',
        Frequency: 'daily',
        Region: 'us',
        Source: 'src_usbls',
        DisplayUnit: 'Index',
        LastValueDate: '2026-09-01T00:00:00',
      } }])
    }

    if (url.includes('/v1/search/entitiesfordisplay')) {
      return jsonResponse({
        results: [{
          Name: 'usfcstpi',
          Title: 'United States CPI',
          Frequency: 'daily',
          Region: 'United States',
          Unit: 'Index',
          Source: 'U.S. Bureau of Labor Statistics',
        }],
      })
    }

    if (url.includes('/v1/metadata/listattributevalues')) {
      return jsonResponse([])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })

  try {
    const { searchBenchmarks } = await import('../lib/benchmark/service')
    const items = await searchBenchmarks({ exactSeriesId: 'usfcstpi', limit: 25 })

    assert.equal(items.length, 1)
    assert.equal(items[0]?.providerSeries.providerSeriesId, 'usfcstpi')
    assert.equal(items[0]?.exactMatch, true)
  } finally {
    restoreFetch()
  }
})

test('advanced search route keeps malformed input on validation error', async () => {
  const { POST } = await import('../app/api/benchmark/search/route')
  const response = await POST(new NextRequest('http://localhost:3001/api/benchmark/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clerk-org-id': 'org-1',
      'x-clerk-user-id': 'user-1',
    },
    body: JSON.stringify({
      query: 'steel',
      filters: [{ metadataKey: 'Frequency', operator: 'equals', values: [] }],
      limit: 25,
    }),
  }))

  const payload = await response.json() as { code?: string; error?: string }
  assert.equal(response.status, 400)
  assert.equal(payload.code, 'VALIDATION_ERROR')
  assert.match(payload.error ?? '', /Filter value is required\./)
})