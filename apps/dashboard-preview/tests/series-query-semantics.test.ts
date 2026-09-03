import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bySourceDateAsc,
  filterBusinessRecords,
  filterScenario,
  findBenchmarkVariants,
  getSeries,
} from '@/lib/time-series/series-query'
import { toBusinessSafeDashboardRecord, type DashboardRecordSource } from '@/lib/raw-data/dashboard-record-mapper'

function createRecord(overrides: Partial<DashboardRecordSource> = {}): DashboardRecordSource {
  return {
    id: 'record-1',
    organizationId: 'org-1',
    sourceId: 'market-indexes',
    datasetId: 'index-data',
    pipelineId: 'dashboard',
    latestRunId: 'run-1',
    dedupeKey: 'key-1',
    scenarioType: 'UNCLASSIFIED',
    componentId: 'component-1',
    componentName: 'record-1',
    componentCode: null,
    metricValue: null,
    unit: 'MWh',
    currency: 'PLN',
    sourceDate: null,
    market: 'PL',
    country: 'PL',
    qualityStatus: 'VALID',
    duplicateStatus: null,
    rawRecordCount: 1,
    duplicateCount: 0,
    lineageJson: null,
    metadataJson: {
      fields: {
        valueType: 'Historical',
        indeks: 'VESPER-ABC',
        value: 125.5,
        date: '2026-07-02T00:00:00.000Z',
        nazwaSkAdnika: 'energia elektryczna',
        descriptionPl: 'Polski opis energii',
        descriptionEng: 'English electricity description',
      },
    },
    lastSyncedAt: '2026-07-09T00:00:00.000Z',
    ...overrides,
  }
}

test('preserves PL and EN component search across business-safe name, code, and description fallbacks', () => {
  const fallback = createRecord()
  const other = createRecord({
    id: 'record-2',
    componentId: 'component-2',
    componentName: 'Copper',
    componentCode: 'LME-CU',
    metadataJson: { fields: { valueType: 'Historical', descriptionPl: 'Miedź', descriptionEng: 'Copper' } },
  })
  const records = [fallback, other]

  assert.deepEqual(filterBusinessRecords(records, { q: 'energia' }, 'pl'), [fallback])
  assert.deepEqual(filterBusinessRecords(records, { q: 'electricity' }, 'en'), [fallback])
  assert.deepEqual(filterBusinessRecords(records, { q: 'vesper-abc' }, 'pl'), [fallback])
  assert.deepEqual(filterBusinessRecords(records, { q: 'missing' }, 'en'), [])

  const mappedPl = toBusinessSafeDashboardRecord(fallback, { locale: 'pl' })
  const mappedEn = toBusinessSafeDashboardRecord(fallback, { locale: 'en' })
  assert.equal(mappedPl.componentName, 'energia elektryczna')
  assert.equal(mappedEn.componentName, 'energia elektryczna')
  assert.equal(mappedPl.componentCode, 'VESPER-ABC')
  assert.equal(mappedEn.descriptionEn, 'English electricity description')
})

test('preserves benchmark identity, Historical selection, and ascending series ordering', () => {
  const laterHistorical = createRecord({ id: 'historical-2' })
  const earlierHistorical = createRecord({
    id: 'historical-1',
    metadataJson: {
      fields: {
        valueType: 'Historical',
        indeks: 'VESPER-ABC',
        value: 120,
        date: '2026-07-01T00:00:00.000Z',
        nazwaSkAdnika: 'energia elektryczna',
        descriptionPl: 'Polski opis energii',
        descriptionEng: 'English electricity description',
      },
    },
  })
  const forecast = createRecord({
    id: 'forecast-1',
    metadataJson: {
      fields: {
        valueType: 'Forecast',
        indeks: 'VESPER-ABC',
        value: 130,
        date: '2026-08-01T00:00:00.000Z',
        nazwaSkAdnika: 'energia elektryczna',
      },
    },
  })
  const records = [laterHistorical, forecast, earlierHistorical]

  const variants = findBenchmarkVariants(records)
  assert.deepEqual([...variants.keys()], ['VESPER-ABC'])
  assert.deepEqual(variants.get('VESPER-ABC'), records)

  const historical = filterScenario(records, 'historical').sort(bySourceDateAsc('pl'))
  assert.deepEqual(historical.map(({ id }) => id), ['historical-1', 'historical-2'])
  assert.deepEqual(filterScenario(records, 'forecast').map(({ id }) => id), ['forecast-1'])
  assert.ok(historical.every((record) => toBusinessSafeDashboardRecord(record, { locale: 'pl' }).scenarioType === 'Historical'))
})

test('forwards only the shared PORR demo cookie to SG Runtime benchmark analytics requests', async () => {
  const previousBaseUrl = process.env.SG_RUNTIME_BASE_URL
  const previousFetch = global.fetch
  let capturedCookieHeader: string | null = null

  process.env.SG_RUNTIME_BASE_URL = 'https://demo-sg-porr.spenduru.app'
  global.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    capturedCookieHeader = new Headers(init?.headers).get('Cookie')

    return new Response(JSON.stringify({
      providerSeries: { providerSeriesId: 'wocaes0074' },
      displayName: 'Brent, Spot, FOB North Sea',
      latestValue: 101,
      frequency: 'monthly',
      currency: 'USD',
      unit: 'bbl',
      source: 'Macrobond',
      range: '1Y',
      historical: [{ date: '2026-08-01T00:00:00.000Z', value: 101 }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof global.fetch

  try {
    await getSeries(
      new URLSearchParams('seriesId=wocaes0074&range=1Y&displayName=Brent'),
      'pl',
      'other=value; sg_porr_demo_session=signed.token; extra=1',
    )

    assert.equal(capturedCookieHeader, 'sg_porr_demo_session=signed.token')
  } finally {
    global.fetch = previousFetch
    if (previousBaseUrl === undefined) delete process.env.SG_RUNTIME_BASE_URL
    else process.env.SG_RUNTIME_BASE_URL = previousBaseUrl
  }
})