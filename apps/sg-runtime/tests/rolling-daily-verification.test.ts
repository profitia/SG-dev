import assert from 'node:assert/strict'
import test from 'node:test'

import { buildRollingDailyHistoryFingerprint } from '../lib/forecast/rolling-daily-maintenance'
import { createPreparedRollingDailyForecastVerificationReader } from '../lib/forecast/rolling-daily-verification'

function createHistory() {
  return {
    providerSeries: {
      provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
      providerSeriesId: 'wocaes0074',
      providerSeriesKey: 'wocaes0074',
    },
    displayName: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    currency: null,
    unit: null,
    source: 'controlled-source',
    historical: [
      { date: '2024-01-01T00:00:00.000Z', value: 100 },
      { date: '2024-01-02T00:00:00.000Z', value: 101 },
      { date: '2024-01-03T00:00:00.000Z', value: 102 },
      { date: '2024-01-04T00:00:00.000Z', value: 103 },
      { date: '2024-01-05T00:00:00.000Z', value: 104 },
    ],
  }
}

function createPersistedRecord() {
  return {
    seriesId: 'wocaes0074',
    inputSource: 'DYNAMIC_MARKET_DATA_STORE',
    inputRunId: null,
    targetBasis: 'POINT_IN_TIME',
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    methodVersion: 'rolling-daily-point-in-time-v1',
    modelId: 'naive',
    forecastOriginAt: new Date('2024-01-04T00:00:00.000Z'),
    horizonLabel: '1M',
    horizonMonths: 1,
    horizonSteps: 21,
    targetCalendarDate: new Date('2024-02-05T00:00:00.000Z'),
    verificationObservedAt: new Date('2024-02-05T00:00:00.000Z'),
    maturityStatus: 'MATURED',
    originValue: 103,
    forecastValue: 104,
    actualValue: 105,
    errorValue: -1,
    absoluteErrorValue: 1,
    deltaValue: 1,
    deltaPct: 0.01,
    residualValue: 1,
    maseScale: 1,
    trainingHistoryStartAt: new Date('2024-01-01T00:00:00.000Z'),
    trainingHistoryEndAt: new Date('2024-01-04T00:00:00.000Z'),
    trainingObservationCount: 4,
    sourceHistoryFingerprint: 'ignored-in-test',
    metadataJson: null,
  }
}

function createRecentPersistedRecords() {
  return [1, 3, 6, 12].map((horizonMonths) => ({
    ...createPersistedRecord(),
    forecastOriginAt: new Date(`2023-${String(13 - horizonMonths).padStart(2, '0')}-05T00:00:00.000Z`),
    horizonLabel: `${horizonMonths}M`,
    horizonMonths,
    horizonSteps: horizonMonths * 21,
    targetCalendarDate: new Date('2024-01-05T00:00:00.000Z'),
    verificationObservedAt: new Date('2024-01-05T00:00:00.000Z'),
  }))
}

test('prepared rolling daily verification stays NOT_AVAILABLE while the checkpoint is partial', async () => {
  const events: Array<{ event: string, metrics: Record<string, unknown> }> = []
  const exactFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'controlled-source',
    points: createHistory().historical,
  })
  const reader = createPreparedRollingDailyForecastVerificationReader({
    prisma: {
      rollingDailyVerificationRecord: {
        async findMany() {
          return [createPersistedRecord()]
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: exactFingerprint,
            latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
            lastProcessedOriginAt: '2024-01-04T00:00:00.000Z',
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
    } as never,
    resolveHistory: async () => ({ history: createHistory() }) as never,
    emitPreparedRead(event, metrics) {
      events.push({ event, metrics: metrics as Record<string, unknown> })
    },
  })

  const result = await reader({ seriesId: 'wocaes0074', modelId: 'naive', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' } as never)

  assert.equal(result.status, 'NOT_AVAILABLE')
  assert.equal(result.reason, 'PREPARATION_REQUIRED: Prepared Rolling Daily Historical Verification is incomplete for the latest lawful source observation.')
  assert.deepEqual(events, [{
    event: 'prepared_read',
    metrics: {
      kind: 'verification',
      store: 'rolling_daily_verification_records',
      hit: false,
      stale: true,
    },
  }])
})

test('prepared rolling daily verification becomes AVAILABLE only after the checkpoint reaches the latest source observation', async () => {
  const exactFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'controlled-source',
    points: createHistory().historical,
  })
  const reader = createPreparedRollingDailyForecastVerificationReader({
    prisma: {
      rollingDailyVerificationRecord: {
        async findMany() {
          return [createPersistedRecord()]
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: exactFingerprint,
            latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
            lastProcessedOriginAt: '2024-01-05T00:00:00.000Z',
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
    } as never,
    resolveHistory: async () => ({ history: createHistory() }) as never,
  })

  const result = await reader({ seriesId: 'wocaes0074', modelId: 'naive', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' } as never)

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.historyFingerprint.length > 0, true)
  assert.equal(result.verification['1M']?.successfulOrigins, 1)
  assert.equal(result.forecastOrigin, '2024-01-04T00:00:00.000Z')
})

test('prepared rolling daily verification serves an exact recent four-horizon artifact before full enrichment completes', async () => {
  const history = createHistory()
  history.historical = Array.from({ length: 370 }, (_, index) => {
    const date = new Date(Date.UTC(2023, 0, 1 + index))
    return { date: date.toISOString(), value: 100 + index }
  })
  const exactFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'controlled-source',
    points: history.historical,
  })
  const recentRecords = createRecentPersistedRecords().map((record) => ({
    ...record,
    sourceHistoryFingerprint: exactFingerprint,
    targetCalendarDate: new Date('2024-01-05T00:00:00.000Z'),
    verificationObservedAt: new Date('2024-01-05T00:00:00.000Z'),
  }))
  const reader = createPreparedRollingDailyForecastVerificationReader({
    prisma: {
      rollingDailyVerificationRecord: {
        async findMany() {
          return recentRecords
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: exactFingerprint,
            latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
            lastProcessedOriginAt: null,
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
    } as never,
    resolveHistory: async () => ({ history }) as never,
  })

  const result = await reader({ seriesId: 'wocaes0074', modelId: 'naive', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' } as never)

  assert.equal(result.status, 'AVAILABLE')
  assert.deepEqual(Object.keys(result.verification).sort(), ['12M', '1M', '3M', '6M'])
  assert.equal(result.lineage.statisticalCompatibility.artifactScope, 'RECENT_VERIFICATION')
  assert.equal(result.historicalVerification?.status, 'LIMITED_SAMPLE')
})
