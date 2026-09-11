import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCurrentForecastStatisticalCompatibility,
  createFullVerificationStatisticalCompatibility,
} from '../lib/forecast/identity'
import {
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
  let legacyWhere: Record<string, unknown> | undefined
  let legacyUpdateData: Record<string, unknown> | undefined
  let deletedRunId: string | undefined
  let createdPointCount = 0

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-current.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<void>) => callback({
      forecastCurrentRun: {
        async upsert() {
          currentRunCalls.push('upsert')
          throw new Error('Invalid `prisma.forecastCurrentRun.upsert()` invocation:\n\nThe column `trainingWindowPolicyId` does not exist in the current database.')
        },
        async findFirst(input: { where: Record<string, unknown> }) {
          currentRunCalls.push('findFirst')
          legacyWhere = input.where
          return { id: 'legacy-current-run' }
        },
        async update(input: { data: Record<string, unknown> }) {
          currentRunCalls.push('update')
          legacyUpdateData = input.data
          return { id: 'legacy-current-run' }
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

    assert.deepEqual(currentRunCalls, ['upsert', 'findFirst', 'update'])
    assert.equal(legacyWhere?.frequency, artifact.frequencyIdentity)
    assert.equal('trainingWindowPolicyId' in (legacyWhere ?? {}), false)
    assert.equal('effectiveTrainingPolicyId' in (legacyWhere ?? {}), false)
    assert.equal(legacyUpdateData?.trainingWindowPolicyId, undefined)
    assert.equal(legacyUpdateData?.effectiveTrainingPolicyId, undefined)
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
  let legacyCreateData: Record<string, unknown> | undefined
  let deletedMetricRunId: string | undefined
  let deletedPointRunId: string | undefined
  let createdMetricCount = 0

  process.env.MARKET_DATA_DATABASE_URL = 'postgresql://legacy-verification.invalid/market-data'
  globalThis.__sgRuntimeMarketDataPrisma__ = {
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<void>) => callback({
      forecastVerificationRun: {
        async upsert() {
          verificationRunCalls.push('upsert')
          throw new Error('Invalid `prisma.forecastVerificationRun.upsert()` invocation:\n\nThe column `trainingWindowPolicyId` does not exist in the current database.')
        },
        async findFirst() {
          verificationRunCalls.push('findFirst')
          return null
        },
        async create(input: { data: Record<string, unknown> }) {
          verificationRunCalls.push('create')
          legacyCreateData = input.data
          return { id: 'legacy-verification-run' }
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

    assert.deepEqual(verificationRunCalls, ['upsert', 'findFirst', 'create'])
    assert.equal(legacyCreateData?.trainingWindowPolicyId, undefined)
    assert.equal(legacyCreateData?.effectiveTrainingPolicyId, undefined)
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