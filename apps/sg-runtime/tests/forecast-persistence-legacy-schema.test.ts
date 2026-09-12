import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildForecastArtifactCadenceIdentity,
  createCurrentForecastStatisticalCompatibility,
  createFullVerificationStatisticalCompatibility,
} from '../lib/forecast/identity'
import {
  readPreparedBenchmarkCurrentForecast,
  readPreparedBenchmarkForecastVerification,
  writeCurrentRunWithPrisma,
  writeVerificationRunWithPrisma,
  type PersistedCurrentArtifact,
  type PersistedVerificationArtifact,
} from '../lib/forecast/service'

function createCurrentArtifact(): PersistedCurrentArtifact {
  return {
    seriesId: 'wocaes0074',
    modelId: 'ets',
    displayName: 'Brent',
    description: null,
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'run-current-source',
    },
    preparation: null,
    historyFingerprint: 'history-current',
    cadence: null,
    frequencyIdentity: 'MONTHLY',
    statisticalCompatibility: createCurrentForecastStatisticalCompatibility({
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
    }),
    history: {
      frequency: 'MONTHLY',
      start: '2025-01-01T00:00:00.000Z',
      end: '2026-01-01T00:00:00.000Z',
      observations: 12,
    },
    forecastOrigin: '2026-01-01T00:00:00.000Z',
    runtimeSeconds: 1.5,
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-02-01T00:00:00.000Z',
        forecastValue: 95.1,
      },
    },
  }
}

function createVerificationArtifact(): PersistedVerificationArtifact {
  return {
    seriesId: 'wocaes0074',
    modelId: 'ets',
    displayName: 'Brent',
    description: null,
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'run-verification-source',
    },
    preparation: null,
    historyFingerprint: 'history-verification',
    cadence: null,
    frequencyIdentity: 'MONTHLY',
    statisticalCompatibility: createFullVerificationStatisticalCompatibility({
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
    }),
    history: {
      frequency: 'MONTHLY',
      start: '2024-01-01T00:00:00.000Z',
      end: '2026-01-01T00:00:00.000Z',
      observations: 24,
    },
    forecastOrigin: '2026-01-01T00:00:00.000Z',
    runtimeSeconds: 2.5,
    verification: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        origins: 2,
        expectedOrigins: 2,
        successfulOrigins: 2,
        failedOrigins: 0,
        coverage: 1,
        metrics: {
          mae: 0.1,
          rmse: 0.2,
          mase: 0.3,
          smape: 0.4,
          directionalAccuracy: 1,
          bias: 0,
        },
        records: [],
        failures: [],
      },
    },
  }
}

test('writeCurrentRunWithPrisma falls back to legacy writes when training policy columns are absent', async () => {
  const previousUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousPrisma = globalThis.__sgRuntimeMarketDataPrisma__
  const artifact = createCurrentArtifact()
  const currentRunCalls: string[] = []
  let queryRawCount = 0
  let observedQuery = ''
  let deletedRunId: string | undefined
  let createdPointCount = 0

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-current.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $on() {},
    async $queryRaw(query: { strings?: string[] }) {
      queryRawCount += 1
      observedQuery = Array.isArray(query.strings) ? query.strings.join(' ') : ''
      if (observedQuery.includes('information_schema.columns')) {
        return [{ columnCount: 0 }]
      }
      if (observedQuery.includes('SELECT "id"') && observedQuery.includes('forecast_current_runs')) {
        return [{ id: 'legacy-current-run' }]
      }
      if (observedQuery.includes('UPDATE "forecast_current_runs"')) {
        return [{ id: 'legacy-current-run' }]
      }
      throw new Error(`Unexpected raw query: ${observedQuery}`)
    },
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<void>) => callback({
      $queryRaw: async (query: { strings?: string[] }) => globalThis.__sgRuntimeMarketDataPrisma__!.$queryRaw(query),
      forecastCurrentRun: {
        async upsert() {
          currentRunCalls.push('upsert')
          throw new Error('Invalid `prisma.forecastCurrentRun.upsert()` invocation:\n\nThe column `trainingWindowPolicyId` does not exist in the current database.')
        },
      },
      forecastCurrentPoint: {
        async deleteMany(input: { where: { runId: string } }) {
          deletedRunId = input.where.runId
        },
        async createMany(input: { data: unknown[] }) {
          createdPointCount = input.data.length
        },
      },
    }),
  } as never

  try {
    await writeCurrentRunWithPrisma(artifact)

    assert.deepEqual(currentRunCalls, [])
    assert.equal(queryRawCount >= 3, true)
    assert.equal(deletedRunId, 'legacy-current-run')
    assert.equal(createdPointCount, 1)
  } finally {
    if (previousUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousUrl
    }

    globalThis.__sgRuntimeMarketDataPrisma__ = previousPrisma
  }
})

test('writeVerificationRunWithPrisma falls back to legacy writes when training policy columns are absent', async () => {
  const previousUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousPrisma = globalThis.__sgRuntimeMarketDataPrisma__
  const artifact = createVerificationArtifact()
  const verificationRunCalls: string[] = []
  let queryRawCount = 0
  let observedQuery = ''
  let deletedMetricRunId: string | undefined
  let deletedPointRunId: string | undefined
  let createdMetricCount = 0

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-verification.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $on() {},
    async $queryRaw(query: { strings?: string[] }) {
      queryRawCount += 1
      observedQuery = Array.isArray(query.strings) ? query.strings.join(' ') : ''
      if (observedQuery.includes('information_schema.columns')) {
        return [{ columnCount: 0 }]
      }
      if (observedQuery.includes('SELECT "id"') && observedQuery.includes('forecast_verification_runs')) {
        return []
      }
      if (observedQuery.includes('INSERT INTO "forecast_verification_runs"')) {
        return [{ id: 'legacy-verification-run' }]
      }
      throw new Error(`Unexpected raw query: ${observedQuery}`)
    },
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<void>) => callback({
      $queryRaw: async (query: { strings?: string[] }) => globalThis.__sgRuntimeMarketDataPrisma__!.$queryRaw(query),
      forecastVerificationRun: {
        async upsert() {
          verificationRunCalls.push('upsert')
          throw new Error('Invalid `prisma.forecastVerificationRun.upsert()` invocation:\n\nThe column `trainingWindowPolicyId` does not exist in the current database.')
        },
      },
      forecastVerificationMetric: {
        async deleteMany(input: { where: { runId: string } }) {
          deletedMetricRunId = input.where.runId
        },
        async createMany(input: { data: unknown[] }) {
          createdMetricCount = input.data.length
        },
      },
      forecastVerificationPoint: {
        async deleteMany(input: { where: { runId: string } }) {
          deletedPointRunId = input.where.runId
        },
        async createMany() {},
      },
    }),
  } as never

  try {
    await writeVerificationRunWithPrisma(artifact)

    assert.deepEqual(verificationRunCalls, [])
    assert.equal(queryRawCount >= 3, true)
    assert.equal(deletedMetricRunId, 'legacy-verification-run')
    assert.equal(deletedPointRunId, 'legacy-verification-run')
    assert.equal(createdMetricCount, 1)
  } finally {
    if (previousUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousUrl
    }

    globalThis.__sgRuntimeMarketDataPrisma__ = previousPrisma
  }
})

test('readPreparedBenchmarkCurrentForecast falls back to legacy latest lookup when training policy columns are absent', async () => {
  const previousUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousPrisma = globalThis.__sgRuntimeMarketDataPrisma__
  const artifact = {
    ...createCurrentArtifact(),
    cadence: { sourceFrequency: 'MONTHLY' as const, targetCadence: 'MONTHLY' as const },
    frequencyIdentity: buildForecastArtifactCadenceIdentity({ sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY' }),
  }
  const findFirstCalls: Array<Record<string, unknown>> = []

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-current-read.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $on() {},
    forecastCurrentRun: {
      async findFirst(input: { where: Record<string, unknown>, select: Record<string, unknown> }) {
        findFirstCalls.push(input)

        if ('trainingWindowPolicyId' in input.where || 'effectiveTrainingPolicyId' in input.where) {
          throw new Error('Invalid `prisma.forecastCurrentRun.findFirst()` invocation:\n\nThe column `trainingWindowPolicyId` does not exist in the current database.')
        }

        if ('displayName' in input.select) {
          return {
            seriesId: artifact.seriesId,
            modelId: artifact.modelId,
            displayName: artifact.displayName,
            description: artifact.description,
            targetBasis: artifact.targetBasis,
            methodVersion: artifact.methodVersion,
            inputSource: artifact.source.kind,
            inputRunId: artifact.source.runId,
            historyFingerprint: artifact.historyFingerprint,
            frequency: artifact.frequencyIdentity,
            historyStartAt: new Date(artifact.history.start),
            historyEndAt: new Date(artifact.history.end),
            observationCount: artifact.history.observations,
            forecastOriginAt: new Date(artifact.forecastOrigin),
            runtimeSeconds: artifact.runtimeSeconds,
            points: [{
              horizonLabel: '1M',
              horizonSteps: 1,
              forecastDate: new Date('2026-02-01T00:00:00.000Z'),
              forecastValue: 95.1,
              metadataJson: null,
              failureReason: null,
            }],
          }
        }

        return {
          inputSource: artifact.source.kind,
          historyFingerprint: artifact.historyFingerprint,
        }
      },
    },
  } as never

  try {
    const result = await readPreparedBenchmarkCurrentForecast({
      seriesId: artifact.seriesId,
      modelId: artifact.modelId,
      targetBasis: artifact.targetBasis,
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      preparedReadAuthority: {
        seriesId: artifact.seriesId,
        modelId: artifact.modelId,
        targetBasis: artifact.targetBasis,
        sourceFrequency: 'MONTHLY',
        targetCadence: 'MONTHLY',
        expectedHistoryFingerprint: artifact.historyFingerprint,
      },
    })

    assert.equal(result.status, 'AVAILABLE')
    assert.equal(findFirstCalls.length, 4)
  } finally {
    if (previousUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousUrl
    }

    globalThis.__sgRuntimeMarketDataPrisma__ = previousPrisma
  }
})

test('readPreparedBenchmarkForecastVerification falls back to legacy latest lookup when training policy columns are absent', async () => {
  const previousUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousPrisma = globalThis.__sgRuntimeMarketDataPrisma__
  const artifact = {
    ...createVerificationArtifact(),
    cadence: { sourceFrequency: 'MONTHLY' as const, targetCadence: 'MONTHLY' as const },
    frequencyIdentity: buildForecastArtifactCadenceIdentity({ sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY' }),
  }
  const findFirstCalls: Array<Record<string, unknown>> = []

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-verification-read.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $on() {},
    forecastVerificationRun: {
      async findFirst(input: { where: Record<string, unknown>, select: Record<string, unknown> }) {
        findFirstCalls.push(input)

        if ('trainingWindowPolicyId' in input.where || 'effectiveTrainingPolicyId' in input.where) {
          throw new Error('Invalid `prisma.forecastVerificationRun.findFirst()` invocation:\n\nThe column `trainingWindowPolicyId` does not exist in the current database.')
        }

        if ('displayName' in input.select) {
          return {
            seriesId: artifact.seriesId,
            modelId: artifact.modelId,
            displayName: artifact.displayName,
            description: artifact.description,
            targetBasis: artifact.targetBasis,
            methodVersion: artifact.methodVersion,
            inputSource: artifact.source.kind,
            inputRunId: artifact.source.runId,
            historyFingerprint: artifact.historyFingerprint,
            frequency: artifact.frequencyIdentity,
            historyStartAt: new Date(artifact.history.start),
            historyEndAt: new Date(artifact.history.end),
            observationCount: artifact.history.observations,
            forecastOriginAt: new Date(artifact.forecastOrigin),
            runtimeSeconds: artifact.runtimeSeconds,
            metrics: [{
              horizonLabel: '1M',
              horizonSteps: 1,
              origins: 2,
              expectedOrigins: 2,
              failedOrigins: 0,
              coverage: 1,
              mae: 0.1,
              rmse: 0.2,
              mase: 0.3,
              smape: 0.4,
              directionalAccuracy: 1,
              bias: 0,
              failureSummaryJson: [],
            }],
            points: [],
          }
        }

        return {
          inputSource: artifact.source.kind,
          historyFingerprint: artifact.historyFingerprint,
        }
      },
    },
  } as never

  try {
    const result = await readPreparedBenchmarkForecastVerification({
      seriesId: artifact.seriesId,
      modelId: artifact.modelId,
      targetBasis: artifact.targetBasis,
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      preparedReadAuthority: {
        seriesId: artifact.seriesId,
        modelId: artifact.modelId,
        targetBasis: artifact.targetBasis,
        sourceFrequency: 'MONTHLY',
        targetCadence: 'MONTHLY',
        expectedHistoryFingerprint: artifact.historyFingerprint,
      },
    })

    assert.equal(result.status, 'AVAILABLE')
    assert.equal(findFirstCalls.length, 4)
  } finally {
    if (previousUrl === undefined) {
      delete process.env.MARKET_DATA_DATABASE_URL
    } else {
      process.env.MARKET_DATA_DATABASE_URL = previousUrl
    }

    globalThis.__sgRuntimeMarketDataPrisma__ = previousPrisma
  }
})