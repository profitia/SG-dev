import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import { buildForecastHistoryFingerprint } from '../lib/forecast/history-fingerprint'
import { buildLiveForecastBridgePayloadFromHistory } from '../lib/forecast/live-market-input'
import { readForecastPreparedVariants } from '../lib/forecast/prepared-state'
import { buildRollingDailyHistoryFingerprint } from '../lib/forecast/rolling-daily-maintenance'

function createHistory(): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
      providerSeriesId: 'generic.prepared.series',
      providerSeriesKey: 'generic.prepared.series',
    },
    displayName: 'Generic prepared series',
    frequency: 'DAILY',
    currency: null,
    unit: null,
    source: 'controlled-source',
    historical: Array.from({ length: 48 }, (_, index) => ({
      date: new Date(Date.UTC(2021 + Math.floor(index / 12), index % 12, 20)).toISOString(),
      value: 100 + index,
    })),
  }
}

function createNativeSparseHistory(
  sourceFrequency: 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL',
): BenchmarkHistoricalSeriesResult {
  const monthsPerPeriod = {
    BIMONTHLY: 2,
    QUARTERLY: 3,
    SEMIANNUAL: 6,
    ANNUAL: 12,
  }[sourceFrequency]

  return {
    ...createHistory(),
    frequency: sourceFrequency,
    historical: Array.from({ length: 48 }, (_, index) => ({
      date: new Date(Date.UTC(1970, (index + 1) * monthsPerPeriod, 0)).toISOString(),
      value: 100 + index,
    })),
  }
}

test('prepared-state binding is exact across semantics, models, versions, and current/historical truth', async () => {
  const history = createHistory()
  const now = new Date('2025-01-15T00:00:00.000Z')
  const eopFingerprint = buildForecastHistoryFingerprint(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'END_OF_PERIOD',
      now,
    }).history,
  )
  const monthlyAverageFingerprint = buildForecastHistoryFingerprint(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'MONTHLY_AVERAGE',
      now,
    }).history,
  )
  const rollingFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: history.providerSeries.providerSeriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.historical,
  })

  const variants = await readForecastPreparedVariants(history.providerSeries.providerSeriesId, history, {
    now,
    prisma: {
      forecastCurrentRun: {
        async findFirst({ where }: { where: Record<string, string> }) {
          if (where.targetBasis === 'END_OF_PERIOD' && where.modelId === 'arima') {
            return { status: 'AVAILABLE', historyFingerprint: eopFingerprint, frequency: 'MONTHLY' }
          }
          if (where.targetBasis === 'MONTHLY_AVERAGE' && where.modelId === 'ets') {
            return { status: 'AVAILABLE', historyFingerprint: 'stale-monthly-average', frequency: 'MONTHLY' }
          }
          return null
        },
      },
      forecastVerificationRun: {
        async findFirst({ where }: { where: Record<string, string> }) {
          if (where.targetBasis === 'END_OF_PERIOD' && where.modelId === 'arima') {
            return { status: 'AVAILABLE', historyFingerprint: eopFingerprint, frequency: 'MONTHLY' }
          }
          if (where.targetBasis === 'MONTHLY_AVERAGE' && where.modelId === 'ets') {
            return { status: 'AVAILABLE', historyFingerprint: monthlyAverageFingerprint, frequency: 'MONTHLY' }
          }
          return null
        },
      },
      rollingDailyCurrentForecastSnapshot: {
        async findFirst({ where }: { where: Record<string, string> }) {
          return where.modelId === 'naive'
            ? { status: 'AVAILABLE', payloadJson: { audit: { sourceHistoryFingerprint: rollingFingerprint } } }
            : null
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique({ where }: { where: { seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: Record<string, string> } }) {
          return where.seriesId_inputSource_targetBasis_methodId_methodVersion_modelId.modelId === 'naive'
            ? { latestSourceHistoryFingerprint: rollingFingerprint }
            : null
        },
      },
      rollingDailyVerificationRecord: {
        async count({ where }: { where: Record<string, string> }) {
          return where.modelId === 'naive' ? 4 : 0
        },
      },
    } as never,
  })

  assert.equal(variants.length, 12)
  const find = (targetSemantics: string, modelId: string) => variants.find((item) => (
    item.identity.targetSemantics === targetSemantics && item.identity.modelId === modelId
  ))

  assert.deepEqual(find('END_OF_PERIOD', 'arima'), {
    identity: {
      seriesId: 'generic.prepared.series',
      targetSemantics: 'END_OF_PERIOD',
      methodId: 'END_OF_PERIOD',
      methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
      modelId: 'arima',
    },
    current: 'READY',
    historical: 'READY',
  })
  assert.equal(find('END_OF_PERIOD', 'ets')?.current, 'NOT_PREPARED')
  assert.equal(find('MONTHLY_AVERAGE', 'ets')?.current, 'STALE')
  assert.equal(find('MONTHLY_AVERAGE', 'ets')?.historical, 'READY')
  assert.equal(find('ROLLING_DAILY_POINT_IN_TIME', 'naive')?.current, 'READY')
  assert.equal(find('ROLLING_DAILY_POINT_IN_TIME', 'naive')?.historical, 'READY')
  assert.equal(find('ROLLING_DAILY_POINT_IN_TIME', 'arima')?.current, 'NOT_PREPARED')
})

test('LEGACY_UNRESOLVED rows cannot satisfy canonical monthly prepared-state readiness', async () => {
  const history = createHistory()
  const requestedMethodIds: string[] = []
  const legacyRows = [
    { methodId: 'LEGACY_UNRESOLVED', status: 'AVAILABLE', historyFingerprint: 'legacy' },
  ]

  const variants = await readForecastPreparedVariants(history.providerSeries.providerSeriesId, history, {
    now: new Date('2025-01-15T00:00:00.000Z'),
    prisma: {
      forecastCurrentRun: {
        async findFirst({ where }: { where: Record<string, string> }) {
          requestedMethodIds.push(where.methodId)
          return legacyRows.find((row) => row.methodId === where.methodId) ?? null
        },
      },
      forecastVerificationRun: {
        async findFirst({ where }: { where: Record<string, string> }) {
          requestedMethodIds.push(where.methodId)
          return legacyRows.find((row) => row.methodId === where.methodId) ?? null
        },
      },
      rollingDailyCurrentForecastSnapshot: { async findFirst() { return null } },
      rollingDailyMaintenanceState: { async findUnique() { return null } },
      rollingDailyVerificationRecord: { async count() { return 0 } },
    } as never,
  })

  const monthly = variants.filter((variant) => (
    variant.identity.targetSemantics === 'END_OF_PERIOD'
    || variant.identity.targetSemantics === 'MONTHLY_AVERAGE'
  ))
  assert.equal(monthly.length, 8)
  assert.ok(monthly.every((variant) => variant.current === 'NOT_PREPARED'))
  assert.ok(monthly.every((variant) => variant.historical === 'NOT_PREPARED'))
  assert.ok(requestedMethodIds.includes('END_OF_PERIOD'))
  assert.ok(requestedMethodIds.includes('MONTHLY_AVERAGE'))
  assert.equal(requestedMethodIds.includes('LEGACY_UNRESOLVED'), false)
})

test('native sparse prepared reads use each canonical persisted cadence identity', async () => {
  for (const sourceFrequency of ['BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const) {
    const history = createNativeSparseHistory(sourceFrequency)
    const requestedFrequencies: unknown[] = []
    const artifactFrequency = `FORECAST_CADENCE_V1|source=${sourceFrequency}|target=${sourceFrequency}`
    const variants = await readForecastPreparedVariants(history.providerSeries.providerSeriesId, history, {
      now: new Date('2025-01-15T00:00:00.000Z'),
      prisma: {
        forecastCurrentRun: {
          async findFirst({ where }: { where: Record<string, unknown> }) {
            requestedFrequencies.push(where.frequency)
            return where.targetBasis === 'END_OF_PERIOD' && where.modelId === 'naive'
              ? { status: 'AVAILABLE', historyFingerprint: buildForecastHistoryFingerprint(
                  { ...buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
                    targetBasis: 'END_OF_PERIOD',
                    targetCadence: sourceFrequency,
                    now: new Date('2025-01-15T00:00:00.000Z'),
                  }).history, cadence: { sourceFrequency, targetCadence: sourceFrequency } },
                ), frequency: artifactFrequency }
              : null
          },
        },
        forecastVerificationRun: {
          async findFirst() { return null },
        },
        rollingDailyCurrentForecastSnapshot: { async findFirst() { return null } },
        rollingDailyMaintenanceState: { async findUnique() { return null } },
        rollingDailyVerificationRecord: { async count() { return 0 } },
      } as never,
    })

    const current = variants.find((variant) => (
      variant.identity.targetSemantics === 'END_OF_PERIOD' && variant.identity.modelId === 'naive'
    ))
    assert.equal(variants.length, 8)
    assert.equal(current?.current, 'READY')
    assert.ok(requestedFrequencies.every((frequency) => JSON.stringify(frequency) === JSON.stringify({
      in: [artifactFrequency],
    })))
  }
})