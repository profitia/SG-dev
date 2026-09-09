import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import { buildForecastHistoryFingerprint } from '../lib/forecast/history-fingerprint'
import { resolveForecastTechnicalMinimumObservations } from '../lib/forecast/current-fast-policy'
import { createRecentVerificationStatisticalCompatibility } from '../lib/forecast/identity'
import {
  buildLiveForecastBridgePayloadFromHistory,
  selectMinimalLawfulCurrentTrainingPayload,
} from '../lib/forecast/live-market-input'
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
  const selectedEopPayload = selectMinimalLawfulCurrentTrainingPayload(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'END_OF_PERIOD',
      now,
    }),
    resolveForecastTechnicalMinimumObservations({ targetSemantics: 'END_OF_PERIOD', modelId: 'arima' }),
  )
  const eopFingerprint = buildForecastHistoryFingerprint(
    selectedEopPayload.history,
  )
  const fullEopHistoricalFingerprint = buildForecastHistoryFingerprint(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'END_OF_PERIOD',
      now,
    }).history,
  )
  const selectedMonthlyAveragePayload = selectMinimalLawfulCurrentTrainingPayload(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'MONTHLY_AVERAGE',
      now,
    }),
    resolveForecastTechnicalMinimumObservations({ targetSemantics: 'MONTHLY_AVERAGE', modelId: 'ets' }),
  )
  const monthlyAverageFingerprint = buildForecastHistoryFingerprint(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'MONTHLY_AVERAGE',
      now,
    }).history,
  )
  const selectedMonthlyAverageFingerprint = buildForecastHistoryFingerprint(
    selectedMonthlyAveragePayload.history,
  )
  const recentEopCompatibility = createRecentVerificationStatisticalCompatibility({
    sourceFrequency: 'DAILY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'END_OF_PERIOD',
  })
  const recentMonthlyAverageCompatibility = createRecentVerificationStatisticalCompatibility({
    sourceFrequency: 'DAILY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
  })
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
            return {
              status: 'AVAILABLE',
              historyFingerprint: eopFingerprint,
              frequency: 'MONTHLY',
              points: [{ forecastValue: 123 }],
            }
          }
          if (where.targetBasis === 'MONTHLY_AVERAGE' && where.modelId === 'ets') {
            return {
              status: 'AVAILABLE',
              historyFingerprint: 'stale-monthly-average',
              frequency: 'MONTHLY',
              points: [{ forecastValue: 123 }],
            }
          }
          return null
        },
      },
      forecastVerificationRun: {
        async findFirst({ where }: { where: Record<string, string> }) {
          if (
            where.targetBasis === 'END_OF_PERIOD'
            && where.modelId === 'arima'
            && where.trainingWindowPolicyId === recentEopCompatibility.trainingWindowPolicyId
            && where.effectiveTrainingPolicyId === recentEopCompatibility.effectiveTrainingPolicyId
          ) {
            return { status: 'AVAILABLE', historyFingerprint: eopFingerprint, frequency: 'MONTHLY' }
          }
          if (
            where.targetBasis === 'MONTHLY_AVERAGE'
            && where.modelId === 'ets'
            && where.trainingWindowPolicyId === recentMonthlyAverageCompatibility.trainingWindowPolicyId
            && where.effectiveTrainingPolicyId === recentMonthlyAverageCompatibility.effectiveTrainingPolicyId
          ) {
            return { status: 'AVAILABLE', historyFingerprint: selectedMonthlyAverageFingerprint, frequency: 'MONTHLY' }
          }
          return null
        },
      },
      rollingDailyCurrentForecastSnapshot: {
        async findUnique({ where }: { where: { seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint: Record<string, string> } }) {
          return where.seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint.modelId === 'naive'
            ? {
                status: 'AVAILABLE',
                payloadJson: {
                  audit: { sourceHistoryFingerprint: rollingFingerprint },
                  path: [
                    {
                      date: '2025-01-16',
                      pointForecast: 123,
                    },
                  ],
                },
              }
            : null
        },
        async findFirst({ where }: { where: Record<string, string> }) {
          return where.modelId === 'naive'
            ? {
                status: 'AVAILABLE',
                payloadJson: {
                  audit: { sourceHistoryFingerprint: rollingFingerprint },
                  path: [
                    {
                      date: '2025-01-16',
                      pointForecast: 123,
                    },
                  ],
                },
              }
            : null
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique({ where }: { where: { seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: Record<string, string> } }) {
          return where.seriesId_inputSource_targetBasis_methodId_methodVersion_modelId.modelId === 'naive'
            ? {
                latestSourceHistoryFingerprint: rollingFingerprint,
                latestSourceObservationAt: '2024-12-20T00:00:00.000Z',
                lastProcessedOriginAt: '2024-12-20T00:00:00.000Z',
                lastMaintenanceStatus: 'SUCCEEDED',
              }
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
  assert.notEqual(fullEopHistoricalFingerprint, eopFingerprint)
  assert.notEqual(monthlyAverageFingerprint, selectedMonthlyAverageFingerprint)
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
      rollingDailyCurrentForecastSnapshot: {
        async findUnique() { return null },
        async findFirst() { return null }
      },
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
            const payload = selectMinimalLawfulCurrentTrainingPayload(
              buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
                targetBasis: 'END_OF_PERIOD',
                targetCadence: sourceFrequency,
                now: new Date('2025-01-15T00:00:00.000Z'),
              }),
              resolveForecastTechnicalMinimumObservations({ targetSemantics: 'END_OF_PERIOD', modelId: 'naive' }),
            )
            return where.targetBasis === 'END_OF_PERIOD' && where.modelId === 'naive'
              ? { status: 'AVAILABLE', historyFingerprint: buildForecastHistoryFingerprint(
                  { ...payload.history, cadence: { sourceFrequency, targetCadence: sourceFrequency } },
                ), frequency: artifactFrequency, points: [{ forecastValue: 123 }] }
              : null
          },
        },
        forecastVerificationRun: {
          async findFirst() { return null },
        },
        rollingDailyCurrentForecastSnapshot: {
          async findUnique() { return null },
          async findFirst() { return null }
        },
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

test('monthly current artifacts without renderable forecast points cannot satisfy READY', async () => {
  const history = createHistory()
  const now = new Date('2025-01-15T00:00:00.000Z')
  const eopFingerprint = buildForecastHistoryFingerprint(
    buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId, history, {
      targetBasis: 'END_OF_PERIOD',
      now,
    }).history,
  )

  const variants = await readForecastPreparedVariants(history.providerSeries.providerSeriesId, history, {
    now,
    prisma: {
      forecastCurrentRun: {
        async findFirst({ where }: { where: Record<string, string> }) {
          if (where.targetBasis === 'END_OF_PERIOD' && where.modelId === 'arima') {
            return {
              status: 'AVAILABLE',
              historyFingerprint: eopFingerprint,
              frequency: 'MONTHLY',
              points: [],
            }
          }

          return null
        },
      },
      forecastVerificationRun: { async findFirst() { return null } },
      rollingDailyCurrentForecastSnapshot: {
        async findUnique() { return null },
        async findFirst() { return null }
      },
      rollingDailyMaintenanceState: { async findUnique() { return null } },
      rollingDailyVerificationRecord: { async count() { return 0 } },
    } as never,
  })

  assert.equal(
    variants.find((variant) => variant.identity.targetSemantics === 'END_OF_PERIOD' && variant.identity.modelId === 'arima')?.current,
    'STALE',
  )
})

test('point-in-time snapshots without a renderable path cannot satisfy READY', async () => {
  const history = createHistory()
  const now = new Date('2025-01-15T00:00:00.000Z')
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
      forecastCurrentRun: { async findFirst() { return null } },
      forecastVerificationRun: { async findFirst() { return null } },
      rollingDailyCurrentForecastSnapshot: {
        async findUnique({ where }: { where: { seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint: Record<string, string> } }) {
          return where.seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint.modelId === 'naive'
            ? { status: 'AVAILABLE', payloadJson: { audit: { sourceHistoryFingerprint: rollingFingerprint }, path: [] } }
            : null
        },
        async findFirst({ where }: { where: Record<string, string> }) {
          return where.modelId === 'naive'
            ? { status: 'AVAILABLE', payloadJson: { audit: { sourceHistoryFingerprint: rollingFingerprint }, path: [] } }
            : null
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: rollingFingerprint,
            latestSourceObservationAt: '2024-12-20T00:00:00.000Z',
            lastProcessedOriginAt: '2024-12-20T00:00:00.000Z',
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
      rollingDailyVerificationRecord: { async count() { return 0 } },
    } as never,
  })

  assert.equal(
    variants.find((variant) => variant.identity.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME' && variant.identity.modelId === 'naive')?.current,
    'STALE',
  )
})

test('point-in-time historical variants stay STALE while the maintenance checkpoint is partial', async () => {
  const history = createHistory()
  const now = new Date('2025-01-15T00:00:00.000Z')
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
      forecastCurrentRun: { async findFirst() { return null } },
      forecastVerificationRun: { async findFirst() { return null } },
      rollingDailyCurrentForecastSnapshot: {
        async findUnique() { return null },
        async findFirst() { return null }
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: rollingFingerprint,
            latestSourceObservationAt: '2024-12-20T00:00:00.000Z',
            lastProcessedOriginAt: '2024-11-20T00:00:00.000Z',
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
      rollingDailyVerificationRecord: { async count() { return 4 } },
    } as never,
  })

  assert.equal(
    variants.find((variant) => variant.identity.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME' && variant.identity.modelId === 'naive')?.historical,
    'STALE',
  )
})