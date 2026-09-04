import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getBenchmarkForecastCurrent,
  getBenchmarkForecastVerification,
  getRollingDailyPointInTimeProductionForecast,
  resolveShowForecastCurrent,
} from '@/lib/benchmark-forecast/runtime-query'

const mutableEnv = process.env as Record<string, string | undefined>

test('explicit Show Forecast preserves prepared hits and returns prepared misses without compute fallback', async () => {
  const calls: string[] = []
  const available = { status: 'AVAILABLE', seriesId: 'wocaes0280', marker: 'prepared' }
  const missing = {
    status: 'NOT_AVAILABLE',
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    reason: 'PREPARATION_REQUIRED: No exact prepared Current Forecast is available.',
  }

  const preparedResult = await resolveShowForecastCurrent('wocaes0280', 'ets', 'MONTHLY_AVERAGE', {
    readPrepared: async () => {
      calls.push('prepared-hit')
      return available
    },
  })
  const computedResult = await resolveShowForecastCurrent('wocaes0280', 'ets', 'MONTHLY_AVERAGE', {
    readPrepared: async () => {
      calls.push('prepared-miss')
      return missing
    },
  })

  assert.equal(preparedResult, available)
  assert.equal(computedResult, missing)
  assert.deepEqual(calls, ['prepared-hit', 'prepared-miss'])
})

test('runtime query returns preparation-required without fetching when current datastore is unavailable', async () => {
  const originalFetch = global.fetch
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousNodeEnv = mutableEnv.NODE_ENV
  let fetchCalls = 0

  mutableEnv.NODE_ENV = 'production'
  delete process.env.MARKET_DATA_DATABASE_URL
  delete process.env.DATABASE_URL

  global.fetch = (async (input: URL | RequestInfo | string) => {
    fetchCalls += 1
    return new Response(JSON.stringify({ status: 'UNSUPPORTED', seriesId: 'wocaes0074', modelId: 'ets', targetBasis: 'END_OF_PERIOD', reason: 'unsupported' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const result = await getBenchmarkForecastCurrent('wocaes0074', 'ets', 'END_OF_PERIOD')
    assert.equal(result.status, 'NOT_AVAILABLE')
    assert.equal(result.targetBasis, 'END_OF_PERIOD')
    assert.equal(result.targetSemantics, 'END_OF_PERIOD')
    assert.equal(result.methodId, 'END_OF_PERIOD')
    assert.match(result.reason, /PREPARATION_REQUIRED/)
  } finally {
    global.fetch = originalFetch
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    if (previousNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV
    } else {
      mutableEnv.NODE_ENV = previousNodeEnv
    }
  }

  assert.equal(fetchCalls, 0)
})

test('runtime query returns preparation-required without fetching when verification datastore is unavailable', async () => {
  const originalFetch = global.fetch
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousNodeEnv = mutableEnv.NODE_ENV
  let fetchCalls = 0

  mutableEnv.NODE_ENV = 'production'
  delete process.env.MARKET_DATA_DATABASE_URL
  delete process.env.DATABASE_URL

  global.fetch = (async (input: URL | RequestInfo | string) => {
    fetchCalls += 1
    return new Response(JSON.stringify({ status: 'UNSUPPORTED', seriesId: 'wocaes0074', modelId: 'ets', targetBasis: 'MONTHLY_AVERAGE', reason: 'unsupported' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const result = await getBenchmarkForecastVerification('wocaes0074', 'ets')
    assert.equal(result.status, 'NOT_AVAILABLE')
    assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
    assert.equal(result.targetSemantics, 'MONTHLY_AVERAGE')
    assert.equal(result.methodId, 'MONTHLY_AVERAGE')
    assert.match(result.reason, /PREPARATION_REQUIRED/)
  } finally {
    global.fetch = originalFetch
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    if (previousNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV
    } else {
      mutableEnv.NODE_ENV = previousNodeEnv
    }
  }

  assert.equal(fetchCalls, 0)
})

test('point-in-time current forecast fails closed as unsupported for non-daily capability before snapshot lookup', async () => {
  const originalFetch = global.fetch
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  const previousBaseUrl = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_URL
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: {
      rollingDailyCurrentForecastSnapshot: {
        findFirst: () => Promise<Record<string, unknown> | null>
      }
    }
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousPrismaConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString
  let snapshotReads = 0

  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'test-internal-token'
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_URL = 'https://sg-runtime.example.invalid'
  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://market-data-present'
  delete process.env.DATABASE_URL

  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    rollingDailyCurrentForecastSnapshot: {
      async findFirst() {
        snapshotReads += 1
        return null
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  global.fetch = (async (input: URL | RequestInfo | string) => {
    const url = new URL(String(input))
    assert.equal(url.pathname, '/api/internal/forecast/capability')
    assert.equal(url.searchParams.get('seriesId'), 'ussurv0303')
    assert.equal(url.searchParams.get('modelId'), 'arima')
    assert.equal(url.searchParams.get('targetSemantics'), 'ROLLING_DAILY_POINT_IN_TIME')

    return new Response(JSON.stringify({
      seriesId: 'ussurv0303',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      modelId: 'arima',
      sourceFrequency: 'SEMIANNUAL',
      sourceAvailability: 'AVAILABLE',
      lawfulTargetSemantics: 'NOT_LAWFUL',
      status: 'NOT_LAWFUL',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'NOT_PREPARED',
      targetedDataScope: 'SINGLE_SERIES',
      timingMs: 12,
      reason: 'NOT_LAWFUL',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const result = await getBenchmarkForecastCurrent('ussurv0303', 'arima', 'POINT_IN_TIME')
    assert.deepEqual(result, {
      status: 'UNSUPPORTED',
      seriesId: 'ussurv0303',
      modelId: 'arima',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      reason: 'UNSUPPORTED_FREQUENCY',
    })
    assert.equal(snapshotReads, 0)
  } finally {
    global.fetch = originalFetch
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
    if (previousBaseUrl === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_URL
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_URL = previousBaseUrl
    }
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousPrismaConnectionString
  }
})

test('monthly prepared read filters by canonical method identity and returns an unambiguous DTO', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: unknown
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString
  let capturedArgs: { where: Record<string, unknown>; orderBy?: unknown } = { where: {} }

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://phase3-monthly-method-identity'
  delete process.env.DATABASE_URL
  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    forecastCurrentRun: {
      async findFirst(args: { where: Record<string, unknown>; orderBy?: unknown }) {
        capturedArgs = args
        return {
          seriesId: 'wocaes0074',
          modelId: 'arima',
          targetBasis: 'END_OF_PERIOD',
          methodId: 'END_OF_PERIOD',
          status: 'AVAILABLE',
          failureReason: null,
          displayName: 'Brent',
          description: null,
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
          inputSource: 'DYNAMIC_MARKET_DATA_STORE',
          inputRunId: null,
          historyFingerprint: 'eop-history-fingerprint',
          frequency: 'MONTHLY',
          historyStartAt: new Date('2020-01-01T00:00:00.000Z'),
          historyEndAt: new Date('2026-07-01T00:00:00.000Z'),
          observationCount: 79,
          forecastOriginAt: new Date('2026-07-01T00:00:00.000Z'),
          points: [],
        }
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  try {
    const result = await getBenchmarkForecastCurrent('wocaes0074', 'arima', 'END_OF_PERIOD')
    assert.equal(result.status, 'NOT_AVAILABLE')
    assert.equal(capturedArgs.where.methodId, 'END_OF_PERIOD')
    assert.equal(capturedArgs.where.methodVersion, 'benchmark-forecasting-mvp-phase2-v1')
    assert.ok((capturedArgs.where.frequency as { in: string[] }).in.includes('MONTHLY'))
    assert.ok((capturedArgs.where.frequency as { in: string[] }).in.includes(
      'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY',
    ))
    assert.deepEqual(capturedArgs.orderBy, [{ updatedAt: 'desc' }])
    if (result.status !== 'NOT_AVAILABLE') return
    assert.match(result.reason, /missing renderable forecast points/i)
  } finally {
    if (previousMarketDataUrl === undefined) delete process.env.MARKET_DATA_DATABASE_URL
    else process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousConnectionString
  }
})

test('monthly prepared verification filters canonical method identity and does not accept legacy unresolved rows', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: unknown
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString
  let capturedWhere: Record<string, unknown> = {}

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://phase8-monthly-verification'
  delete process.env.DATABASE_URL
  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    forecastVerificationRun: {
      async findFirst(args: { where: Record<string, unknown> }) {
        capturedWhere = args.where
        return null
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  try {
    const result = await getBenchmarkForecastVerification('generic.series', 'arima', 'END_OF_PERIOD')
    assert.equal(result.status, 'NOT_AVAILABLE')
    assert.equal(capturedWhere.methodId, 'END_OF_PERIOD')
    assert.equal(capturedWhere.methodVersion, 'benchmark-forecasting-mvp-phase2-v1')
    assert.ok((capturedWhere.frequency as { in: string[] }).in.includes('MONTHLY'))
    assert.ok((capturedWhere.frequency as { in: string[] }).in.includes(
      'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY',
    ))
    assert.notEqual(capturedWhere.methodId, 'LEGACY_UNRESOLVED')
  } finally {
    if (previousMarketDataUrl === undefined) delete process.env.MARKET_DATA_DATABASE_URL
    else process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousConnectionString
  }
})

test('internal production forecast adapter uses bearer auth and preserves the canonical point-in-time contract', async () => {
  const originalFetch = global.fetch
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  let capturedUrl: URL | null = null
  let capturedInit: RequestInit | undefined
  const responsePayload = {
    productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
    contractVersion: '1',
    status: 'AVAILABLE',
    benchmark: {
      benchmarkId: 'wocaes0074',
      displayName: 'Brent, Spot, FOB North Sea',
      frequency: 'DAILY',
      unit: 'USD/bbl',
      currency: 'USD',
      provider: 'macrobond',
      providerSeriesId: 'wocaes0074',
    },
    forecastMethod: {
      id: 'ROLLING_DAILY_POINT_IN_TIME',
      version: 'rolling-daily-point-in-time-v1',
    },
    model: {
      id: 'ets',
      selectedCandidate: 'ETS_AUTO',
    },
    origin: {
      date: '2026-08-19',
      value: 72.5,
    },
    maxHorizonMonths: 12,
    anchors: [
      {
        horizon: '1M',
        horizonMonths: 1,
        targetCalendarDate: '2026-09-19',
        pointForecast: 73,
        band: {
          status: 'AVAILABLE',
          reasonCode: null,
          source: 'EMPIRICAL_ANCHOR',
          lower: 70,
          upper: 75,
          sampleCount: 25,
          p10ResidualOffset: -3,
          p90ResidualOffset: 2,
        },
      },
    ],
    path: [
      {
        date: '2026-08-20',
        pointForecast: 72.8,
        band: {
          status: 'NOT_AVAILABLE',
          reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
          source: null,
          lower: null,
          upper: null,
        },
      },
      {
        date: '2026-09-19',
        pointForecast: 73,
        band: {
          status: 'AVAILABLE',
          reasonCode: null,
          source: 'EMPIRICAL_ANCHOR',
          lower: 70,
          upper: 75,
        },
      },
    ],
    calibration: {
      availabilityStatus: 'AVAILABLE',
      freshnessStatus: 'FRESH',
      quantileConvention: 'HF7_LINEAR_INTERPOLATION',
      coverageLabel: '80% empirical prediction band',
      methodologicalMinimumStatus: 'MET',
      updatedAt: '2026-08-20T00:00:00.000Z',
      processedThrough: '2026-08-19',
      lastResidualAvailabilityDate: '2026-08-19',
    },
    audit: {
      generatedAt: '2026-08-20T00:00:00.000Z',
      sourceLatestObservationDate: '2026-08-19',
      calendarProjectionMode: 'CALENDAR_MONTH_CLAMP',
      projectionCalendarStrategy: 'CALENDAR_MONTH_CLAMP',
      technicalMinimumTrainingObservations: 60,
      methodologicalTrainingEligibilityStatus: 'ELIGIBLE',
      calibrationUpdatedAt: '2026-08-20T00:00:00.000Z',
      calibrationLastResidualAvailabilityDate: '2026-08-19',
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
    },
    warnings: [],
  } as const

  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = 'dashboard-preview-token'
  global.fetch = (async (input: URL | RequestInfo | string, init?: RequestInit) => {
    capturedUrl = new URL(String(input))
    capturedInit = init
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const result = await getRollingDailyPointInTimeProductionForecast('wocaes0074', 'ets')
    assert.deepEqual(result, responsePayload)
  } finally {
    global.fetch = originalFetch
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }

  if (!capturedUrl || !capturedInit) {
    throw new Error('Expected runtime query to issue an internal production forecast request.')
  }

  const currentUrl = capturedUrl as URL
  const currentInit = capturedInit as RequestInit

  assert.equal(currentUrl.pathname, '/api/internal/forecast/production')
  assert.equal(currentUrl.searchParams.get('seriesId'), 'wocaes0074')
  assert.equal(currentUrl.searchParams.get('model'), 'ets')
  assert.equal(currentUrl.searchParams.get('forecastMethod'), 'ROLLING_DAILY_POINT_IN_TIME')
  assert.equal(currentUrl.searchParams.get('token'), null)
  assert.equal((currentInit.headers as Record<string, string>).Authorization, 'Bearer dashboard-preview-token')
  assert.equal((currentInit.headers as Record<string, string>).Accept, 'application/json')
  assert.equal(currentInit.body, undefined)
})

test('internal production forecast adapter fails closed when the service credential is missing', async () => {
  const previousToken = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN

  try {
    await assert.rejects(
      () => getRollingDailyPointInTimeProductionForecast('wocaes0074', 'ets'),
      /SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured/,
    )
  } finally {
    if (previousToken === undefined) {
      delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
    } else {
      process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = previousToken
    }
  }
})

test('point-in-time current forecast fails closed without snapshot datastore authority', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousRenderExternalUrl = process.env.RENDER_EXTERNAL_URL
  const previousVercelUrl = process.env.VERCEL_URL
  const previousNodeEnv = mutableEnv.NODE_ENV
  const originalFetch = global.fetch
  let fetchCalled = false

  mutableEnv.NODE_ENV = 'production'
  delete process.env.MARKET_DATA_DATABASE_URL
  delete process.env.DATABASE_URL
  delete process.env.RENDER_EXTERNAL_URL
  delete process.env.VERCEL_URL
  global.fetch = (async () => {
    fetchCalled = true
    throw new Error('legacy fallback should not run for POINT_IN_TIME')
  }) as typeof fetch

  try {
    await assert.rejects(
      () => getBenchmarkForecastCurrent('wocaes0074', 'damped_holt', 'POINT_IN_TIME'),
      /MARKET_DATA_DATABASE_URL or DATABASE_URL is required for POINT_IN_TIME dashboard snapshot reads/,
    )
    assert.equal(fetchCalled, false)
  } finally {
    global.fetch = originalFetch
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    if (previousNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV
    } else {
      mutableEnv.NODE_ENV = previousNodeEnv
    }
    if (previousRenderExternalUrl === undefined) {
      delete process.env.RENDER_EXTERNAL_URL
    } else {
      process.env.RENDER_EXTERNAL_URL = previousRenderExternalUrl
    }
    if (previousVercelUrl === undefined) {
      delete process.env.VERCEL_URL
    } else {
      process.env.VERCEL_URL = previousVercelUrl
    }
  }
})

test('point-in-time current forecast uses the persisted snapshot seam without fetch fallback when datastore authority is present', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const originalFetch = global.fetch
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: {
      rollingDailyCurrentForecastSnapshot: {
        findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
      }
      rollingDailyMaintenanceState: {
        findUnique: () => Promise<{ latestSourceHistoryFingerprint: string | null } | null>
      }
    }
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousPrismaConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString
  let fetchCalled = false

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://stage11-prepared-read'
  delete process.env.DATABASE_URL

  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    rollingDailyCurrentForecastSnapshot: {
      async findFirst() {
        return {
          payloadJson: {
            contractVersion: '1',
            status: 'AVAILABLE',
            benchmark: {
              benchmarkId: 'wocaes0074',
              displayName: 'Brent, Spot, FOB North Sea',
              frequency: 'DAILY',
              unit: 'USD/bbl',
              currency: 'USD',
              provider: 'macrobond',
              providerSeriesId: 'wocaes0074',
            },
            forecastMethod: {
              id: 'ROLLING_DAILY_POINT_IN_TIME',
              version: 'rolling-daily-point-in-time-v1',
            },
            model: {
              id: 'arima',
              selectedCandidate: 'ARIMA(2,1,2)',
            },
            origin: {
              date: '2026-08-20',
              value: 91.48,
            },
            maxHorizonMonths: 12,
            anchors: [
              {
                horizon: '1M',
                horizonMonths: 1,
                targetCalendarDate: '2026-09-20',
                pointForecast: 91.7,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 84.2,
                  upper: 99.1,
                  sampleCount: 659,
                  p10ResidualOffset: -7.5,
                  p90ResidualOffset: 7.4,
                },
              },
              {
                horizon: '3M',
                horizonMonths: 3,
                targetCalendarDate: '2026-11-20',
                pointForecast: 92.4,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 79.8,
                  upper: 109.3,
                  sampleCount: 615,
                  p10ResidualOffset: -12.6,
                  p90ResidualOffset: 16.9,
                },
              },
              {
                horizon: '6M',
                horizonMonths: 6,
                targetCalendarDate: '2027-02-20',
                pointForecast: 93.1,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 80.7,
                  upper: 124.1,
                  sampleCount: 553,
                  p10ResidualOffset: -12.4,
                  p90ResidualOffset: 31.0,
                },
              },
              {
                horizon: '12M',
                horizonMonths: 12,
                targetCalendarDate: '2027-08-20',
                pointForecast: 94.3,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 74.8,
                  upper: 125.3,
                  sampleCount: 423,
                  p10ResidualOffset: -19.5,
                  p90ResidualOffset: 31.0,
                },
              },
            ],
            path: [
              {
                date: '2026-08-21',
                pointForecast: 91.5,
                band: {
                  status: 'NOT_AVAILABLE',
                  reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
                  source: null,
                  lower: null,
                  upper: null,
                },
              },
              {
                date: '2027-08-20',
                pointForecast: 94.3,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 74.8,
                  upper: 125.3,
                },
              },
            ],
            calibration: {
              availabilityStatus: 'AVAILABLE',
              freshnessStatus: 'FRESH',
              quantileConvention: 'HF7_LINEAR_INTERPOLATION',
              coverageLabel: '80% empirical prediction band',
              methodologicalMinimumStatus: 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',
              updatedAt: '2026-08-21T19:48:07.942Z',
              processedThrough: '2026-08-20',
              lastResidualAvailabilityDate: '2026-08-20',
            },
            audit: {
              generatedAt: '2026-08-21T19:48:07.942Z',
              sourceLatestObservationDate: '2026-08-20',
              calendarProjectionMode: 'OBSERVED_WEEKDAY_SET_V1',
              projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1',
              technicalMinimumTrainingObservations: 60,
              methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
              calibrationUpdatedAt: '2026-08-21T19:48:07.942Z',
              calibrationLastResidualAvailabilityDate: '2026-08-20',
              inputSource: 'DYNAMIC_MARKET_DATA_STORE',
              sourceHistoryFingerprint: 'history-fingerprint-fresh',
            },
            warnings: [],
          },
          message: null,
          reasonCode: null,
          status: 'AVAILABLE',
        }
      },
    },
    rollingDailyMaintenanceState: {
      async findUnique() {
        return {
          latestSourceHistoryFingerprint: 'history-fingerprint-fresh',
        }
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  global.fetch = (async () => {
    fetchCalled = true
    throw new Error('POINT_IN_TIME should not hit fetch when persisted snapshot datastore is available')
  }) as typeof fetch

  try {
    const result = await getBenchmarkForecastCurrent('wocaes0074', 'arima', 'POINT_IN_TIME')
    assert.equal(result.status, 'AVAILABLE')
    if (result.status !== 'AVAILABLE') {
      return
    }
    assert.equal(fetchCalled, false)
    assert.equal(result.forecastOrigin, '2026-08-20')
    assert.equal(result.rollingDailySnapshot?.model.id, 'arima')
    assert.equal(result.rollingDailySnapshot?.audit.sourceLatestObservationDate, '2026-08-20')
    assert.deepEqual(result.freshness, {
      identity: {
        forecastIdentity: {
          seriesId: 'wocaes0074',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
          methodId: 'ROLLING_DAILY_POINT_IN_TIME',
          methodVersion: 'rolling-daily-point-in-time-v1',
          modelId: 'arima',
        },
        inputSource: 'DYNAMIC_MARKET_DATA_STORE',
        sourceHistoryFingerprint: 'history-fingerprint-fresh',
        forecastOrigin: '2026-08-20',
      },
      status: 'FRESH',
      reason: null,
      snapshotSourceHistoryFingerprint: 'history-fingerprint-fresh',
      currentSourceHistoryFingerprint: 'history-fingerprint-fresh',
    })
  } finally {
    global.fetch = originalFetch
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousPrismaConnectionString
  }
})

test('point-in-time current forecast marks the prepared snapshot stale when the canonical source fingerprint differs', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const originalFetch = global.fetch
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: {
      rollingDailyCurrentForecastSnapshot: {
        findFirst: () => Promise<Record<string, unknown> | null>
      }
      rollingDailyMaintenanceState: {
        findUnique: () => Promise<{ latestSourceHistoryFingerprint: string | null } | null>
      }
    }
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousPrismaConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString
  let fetchCalled = false

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://stage12-1-stale-read'
  delete process.env.DATABASE_URL

  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    rollingDailyCurrentForecastSnapshot: {
      async findFirst() {
        return {
          payloadJson: {
            contractVersion: '1',
            status: 'AVAILABLE',
            benchmark: {
              benchmarkId: 'wocaes0074',
              displayName: 'Brent, Spot, FOB North Sea',
              frequency: 'DAILY',
              unit: 'USD/bbl',
              currency: 'USD',
              provider: 'macrobond',
              providerSeriesId: 'wocaes0074',
            },
            forecastMethod: {
              id: 'ROLLING_DAILY_POINT_IN_TIME',
              version: 'rolling-daily-point-in-time-v1',
            },
            model: {
              id: 'naive',
              selectedCandidate: 'naive',
            },
            origin: {
              date: '2026-08-20',
              value: 91.48,
            },
            maxHorizonMonths: 12,
            anchors: [
              {
                horizon: '1M',
                horizonMonths: 1,
                targetCalendarDate: '2026-09-20',
                pointForecast: 91.7,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 84.2,
                  upper: 99.1,
                  sampleCount: 659,
                  p10ResidualOffset: -7.5,
                  p90ResidualOffset: 7.4,
                },
              },
            ],
            path: [
              {
                date: '2026-08-21',
                pointForecast: 91.5,
                band: {
                  status: 'NOT_AVAILABLE',
                  reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
                  source: null,
                  lower: null,
                  upper: null,
                },
              },
            ],
            calibration: {
              availabilityStatus: 'AVAILABLE',
              freshnessStatus: 'FRESH',
              quantileConvention: 'HF7_LINEAR_INTERPOLATION',
              coverageLabel: '80% empirical prediction band',
              methodologicalMinimumStatus: 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',
              updatedAt: '2026-08-21T19:48:07.942Z',
              processedThrough: '2026-08-20',
              lastResidualAvailabilityDate: '2026-08-20',
            },
            audit: {
              generatedAt: '2026-08-21T19:48:07.942Z',
              sourceLatestObservationDate: '2026-08-20',
              calendarProjectionMode: 'OBSERVED_WEEKDAY_SET_V1',
              projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1',
              technicalMinimumTrainingObservations: 60,
              methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
              calibrationUpdatedAt: '2026-08-21T19:48:07.942Z',
              calibrationLastResidualAvailabilityDate: '2026-08-20',
              inputSource: 'DYNAMIC_MARKET_DATA_STORE',
              sourceHistoryFingerprint: 'fixture-snapshot-fingerprint-a',
            },
            warnings: [],
          },
          message: null,
          reasonCode: null,
          status: 'AVAILABLE',
        }
      },
    },
    rollingDailyMaintenanceState: {
      async findUnique() {
        return {
          latestSourceHistoryFingerprint: 'fixture-current-fingerprint-b',
        }
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  global.fetch = (async () => {
    fetchCalled = true
    throw new Error('POINT_IN_TIME stale detection should not hit fetch fallback')
  }) as typeof fetch

  try {
    const first = await getBenchmarkForecastCurrent('wocaes0074', 'naive', 'POINT_IN_TIME')
    const second = await getBenchmarkForecastCurrent('wocaes0074', 'naive', 'POINT_IN_TIME')
    assert.equal(fetchCalled, false)
    assert.equal(first.status, 'AVAILABLE')
    assert.equal(second.status, 'AVAILABLE')
    if (first.status !== 'AVAILABLE' || second.status !== 'AVAILABLE') {
      return
    }
    assert.equal(first.modelId, 'naive')
    assert.equal(first.rollingDailySnapshot?.model.id, 'naive')
    assert.equal(first.currentForecast['1M']?.forecastValue, 91.7)
    assert.equal(first.rollingDailySnapshot?.path[0]?.band.reasonCode, 'BEFORE_FIRST_EMPIRICAL_ANCHOR')
    assert.deepEqual(first, second)
    assert.deepEqual(first.freshness, {
      identity: {
        forecastIdentity: {
          seriesId: 'wocaes0074',
          targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
          methodId: 'ROLLING_DAILY_POINT_IN_TIME',
          methodVersion: 'rolling-daily-point-in-time-v1',
          modelId: 'naive',
        },
        inputSource: 'DYNAMIC_MARKET_DATA_STORE',
        sourceHistoryFingerprint: 'fixture-snapshot-fingerprint-a',
        forecastOrigin: '2026-08-20',
      },
      status: 'STALE',
      reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
      snapshotSourceHistoryFingerprint: 'fixture-snapshot-fingerprint-a',
      currentSourceHistoryFingerprint: 'fixture-current-fingerprint-b',
    })
  } finally {
    global.fetch = originalFetch
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousPrismaConnectionString
  }
})

test('point-in-time current forecast preserves miss semantics and does not classify a missing snapshot as stale', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: {
      rollingDailyCurrentForecastSnapshot: {
        findFirst: () => Promise<Record<string, unknown> | null>
      }
      rollingDailyMaintenanceState: {
        findUnique: () => Promise<{ latestSourceHistoryFingerprint: string | null } | null>
      }
    }
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousPrismaConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://stage12-1-miss-read'
  delete process.env.DATABASE_URL

  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    rollingDailyCurrentForecastSnapshot: {
      async findFirst() {
        return null
      },
    },
    rollingDailyMaintenanceState: {
      async findUnique() {
        throw new Error('maintenance fingerprint should not be read when the snapshot is missing')
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  try {
    const result = await getBenchmarkForecastCurrent('wocaes0074', 'ets', 'POINT_IN_TIME')
    assert.deepEqual(result, {
      status: 'NOT_AVAILABLE',
      seriesId: 'wocaes0074',
      modelId: 'ets',
      targetBasis: 'POINT_IN_TIME',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      methodId: 'ROLLING_DAILY_POINT_IN_TIME',
      reason: 'No persisted point-in-time current forecast snapshot is available for the selected series and model.',
    })
  } finally {
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousPrismaConnectionString
  }
})

test('point-in-time current forecast freshness contract is generic across all four accepted models with no cross-model fallback', async () => {
  const previousMarketDataUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousDatabaseUrl = process.env.DATABASE_URL
  const marketDataGlobal = globalThis as typeof globalThis & {
    dashboardPreviewMarketDataPrisma?: {
      rollingDailyCurrentForecastSnapshot: {
        findFirst: (args: { where?: { modelId?: string } }) => Promise<Record<string, unknown> | null>
      }
      rollingDailyMaintenanceState: {
        findUnique: () => Promise<{ latestSourceHistoryFingerprint: string | null } | null>
      }
    }
    dashboardPreviewMarketDataPrismaConnectionString?: string
  }
  const previousPrisma = marketDataGlobal.dashboardPreviewMarketDataPrisma
  const previousPrismaConnectionString = marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString
  const requestedModels = ['naive', 'damped_holt', 'ets', 'arima'] as const
  const seenModels: string[] = []

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://stage12-1-four-models'
  delete process.env.DATABASE_URL

  marketDataGlobal.dashboardPreviewMarketDataPrisma = {
    rollingDailyCurrentForecastSnapshot: {
      async findFirst(args) {
        const modelId = String(args.where?.modelId)
        seenModels.push(modelId)
        return {
          payloadJson: {
            contractVersion: '1',
            status: 'AVAILABLE',
            benchmark: {
              benchmarkId: 'wocaes0074',
              displayName: 'Brent, Spot, FOB North Sea',
              frequency: 'DAILY',
              unit: 'USD/bbl',
              currency: 'USD',
              provider: 'macrobond',
              providerSeriesId: 'wocaes0074',
            },
            forecastMethod: {
              id: 'ROLLING_DAILY_POINT_IN_TIME',
              version: 'rolling-daily-point-in-time-v1',
            },
            model: {
              id: modelId,
              selectedCandidate: modelId === 'arima' ? 'ARIMA(2,1,2)' : modelId,
            },
            origin: {
              date: '2026-08-20',
              value: 91.48,
            },
            maxHorizonMonths: 12,
            anchors: [
              {
                horizon: '1M',
                horizonMonths: 1,
                targetCalendarDate: '2026-09-20',
                pointForecast: 91.7,
                band: {
                  status: 'AVAILABLE',
                  reasonCode: null,
                  source: 'EMPIRICAL_ANCHOR',
                  lower: 84.2,
                  upper: 99.1,
                  sampleCount: 659,
                  p10ResidualOffset: -7.5,
                  p90ResidualOffset: 7.4,
                },
              },
            ],
            path: [
              {
                date: '2026-08-21',
                pointForecast: 91.5,
                band: {
                  status: 'NOT_AVAILABLE',
                  reasonCode: 'BEFORE_FIRST_EMPIRICAL_ANCHOR',
                  source: null,
                  lower: null,
                  upper: null,
                },
              },
            ],
            calibration: {
              availabilityStatus: 'AVAILABLE',
              freshnessStatus: 'FRESH',
              quantileConvention: 'HF7_LINEAR_INTERPOLATION',
              coverageLabel: '80% empirical prediction band',
              methodologicalMinimumStatus: 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',
              updatedAt: '2026-08-21T19:48:07.942Z',
              processedThrough: '2026-08-20',
              lastResidualAvailabilityDate: '2026-08-20',
            },
            audit: {
              generatedAt: '2026-08-21T19:48:07.942Z',
              sourceLatestObservationDate: '2026-08-20',
              calendarProjectionMode: 'OBSERVED_WEEKDAY_SET_V1',
              projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1',
              technicalMinimumTrainingObservations: 60,
              methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
              calibrationUpdatedAt: '2026-08-21T19:48:07.942Z',
              calibrationLastResidualAvailabilityDate: '2026-08-20',
              inputSource: 'DYNAMIC_MARKET_DATA_STORE',
              sourceHistoryFingerprint: 'shared-fingerprint',
            },
            warnings: [],
          },
          message: null,
          reasonCode: null,
          status: 'AVAILABLE',
        }
      },
    },
    rollingDailyMaintenanceState: {
      async findUnique() {
        return {
          latestSourceHistoryFingerprint: 'shared-fingerprint',
        }
      },
    },
  }
  marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = process.env.MARKET_DATA_DATABASE_URL

  try {
    for (const modelId of requestedModels) {
      const result = await getBenchmarkForecastCurrent('wocaes0074', modelId, 'POINT_IN_TIME')
      assert.equal(result.status, 'AVAILABLE')
      if (result.status !== 'AVAILABLE') {
        continue
      }
      assert.equal(result.modelId, modelId)
      assert.equal(result.rollingDailySnapshot?.model.id, modelId)
      assert.equal(result.freshness?.status, 'FRESH')
      assert.equal(result.rollingDailySnapshot?.audit.inputSource, 'DYNAMIC_MARKET_DATA_STORE')
      assert.equal(result.rollingDailySnapshot?.forecastMethod.id, 'ROLLING_DAILY_POINT_IN_TIME')
      assert.equal(result.methodVersion, 'rolling-daily-point-in-time-v1')
      assert.equal(result.targetBasis, 'POINT_IN_TIME')
    }

    assert.deepEqual(seenModels, ['naive', 'damped_holt', 'ets', 'arima'])
  } finally {
    if (previousMarketDataUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousMarketDataUrl
    }
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
    marketDataGlobal.dashboardPreviewMarketDataPrisma = previousPrisma
    marketDataGlobal.dashboardPreviewMarketDataPrismaConnectionString = previousPrismaConnectionString
  }
})