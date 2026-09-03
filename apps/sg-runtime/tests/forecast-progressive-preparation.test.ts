import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveForecastCapabilities } from '../lib/forecast/capability-resolver'
import { createProgressiveForecastPreparationService } from '../lib/forecast/progressive-preparation'

function capabilityResolution(seriesId: string, overrides: Partial<ReturnType<typeof resolveForecastCapabilities>[number]> = {}) {
  return {
    status: 'AVAILABLE' as const,
    reason: null,
    sourceMetadata: {
      seriesId,
      providerCode: 'MACROBOND',
      source: 'postgres',
      sourceFrequency: 'MONTHLY' as const,
      rawFrequency: 'monthly',
      sourceObservationCount: 120,
      fullHistoryObservationCount: 120,
    },
    targetedHydration: {
      scope: 'SINGLE_SERIES' as const,
      requestedSeriesId: seriesId,
      source: 'postgres' as const,
      cacheStatus: 'hit' as const,
    },
    preparationFailures: {},
    capabilities: resolveForecastCapabilities({
      seriesId,
      sourceFrequency: 'MONTHLY',
      sourceObservationCount: 120,
      preparedObservationCounts: {},
      provenance: [
        {
          targetSemantics: 'END_OF_PERIOD',
          sourceFrequency: 'MONTHLY',
          preparation: { method: 'CONTROLLED_EOP', version: 'test-v1', provenanceStatus: 'PROVEN' },
          sourceLineage: 'lineage',
          closedPeriod: true,
          levelAtTimestamp: true,
          exactSourceObservedAt: true,
          aggregation: null,
          underlyingObservationFrequency: null,
          missingObservationPolicy: null,
          syntheticObservations: null,
        },
        {
          targetSemantics: 'MONTHLY_AVERAGE',
          sourceFrequency: 'MONTHLY',
          preparation: { method: 'CONTROLLED_AVERAGE', version: 'test-v1', provenanceStatus: 'PROVEN' },
          sourceLineage: 'lineage',
          closedPeriod: true,
          levelAtTimestamp: null,
          exactSourceObservedAt: null,
          aggregation: 'ARITHMETIC_MEAN',
          underlyingObservationFrequency: 'MONTHLY',
          missingObservationPolicy: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
          syntheticObservations: false,
        },
      ],
      preparedVariants: [],
    }).map((capability) => ({ ...capability, ...overrides })),
  }
}

function availableCurrent(input: { seriesId: string, modelId: string, targetBasis: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE' }) {
  return {
    status: 'AVAILABLE' as const,
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: input.targetBasis,
    methodId: input.targetBasis,
    userFacingModel: true,
    displayName: 'Series',
    description: null,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: { kind: 'DYNAMIC_MARKET_DATA_STORE', runId: null },
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: null,
      sourceSeriesId: input.seriesId,
      sourceFrequency: 'MONTHLY',
      historyFingerprint: `${input.targetBasis}-${input.modelId}`,
      preparation: null,
    },
    historyFingerprint: `${input.targetBasis}-${input.modelId}`,
    history: { frequency: 'MONTHLY', start: '2020-01-01', end: '2026-08-01', observations: 80 },
    forecastOrigin: '2026-08-01',
    runtimeSeconds: 1,
    cacheStatus: 'miss' as const,
    alignment: { status: 'ALIGNED' as const, trainingFrequency: 'MONTHLY', lastHistoricalPeriod: null, forecastOrigin: null, firstForecastTarget: null },
    currentForecast: {},
  }
}

function availableVerification(input: { seriesId: string, modelId: string, targetBasis: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE' }) {
  return {
    ...availableCurrent(input),
    verification: {},
  }
}

test('snapshotAndKickoff prioritizes current work before verification and elevates the selected identity', async () => {
  const currentCalls: string[] = []
  const historicalCalls: string[] = []
  let prepared = new Set<string>()
  let releaseFirstCurrent: (() => void) | null = null
  let firstCurrentPending = true
  const firstCurrentGate = new Promise<void>((resolve) => {
    releaseFirstCurrent = resolve
  })

  const service = createProgressiveForecastPreparationService({
    async resolveCapabilities(seriesId) {
      const resolution = capabilityResolution(seriesId)
      return {
        ...resolution,
        capabilities: resolution.capabilities.map((capability) => {
          const key = `${capability.identity.targetSemantics}:${capability.identity.modelId}`
          const ready = prepared.has(key)
          return {
            ...capability,
            currentPreparedState: ready ? 'READY' as const : capability.currentPreparedState,
            historicalPreparedState: ready ? 'READY' as const : capability.historicalPreparedState,
          }
        }),
      }
    },
    async prepareMonthlyCurrent(input) {
      currentCalls.push(`${input.targetBasis}:${input.modelId}`)
      if (firstCurrentPending) {
        firstCurrentPending = false
        await firstCurrentGate
      }
      prepared = new Set([...prepared, `${input.targetBasis}:${input.modelId}`])
      return availableCurrent({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
      }) as never
    },
    async prepareMonthlyHistorical(input) {
      historicalCalls.push(`${input.targetBasis}:${input.modelId}`)
      prepared = new Set([...prepared, `${input.targetBasis}:${input.modelId}`])
      return availableVerification({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
      }) as never
    },
    async runRollingDaily() {
      throw new Error('Rolling Daily should not run in this monthly test.')
    },
  })

  const first = await service.snapshotAndKickoff({
    seriesId: 'generic.series',
    preferredModelId: 'naive',
    preferredTargetBasis: 'END_OF_PERIOD',
  })

  const selected = first.variants.find((variant) => variant.modelId === 'naive' && variant.targetBasis === 'END_OF_PERIOD')
  assert.ok(['QUEUED', 'PREPARING'].includes(selected?.currentState ?? 'FAILED'))
  assert.equal(first.firstReadyCurrent, null)

  await new Promise((resolve) => setImmediate(resolve))

  const second = await service.snapshotAndKickoff({
    seriesId: 'generic.series',
    preferredModelId: 'arima',
    preferredTargetBasis: 'MONTHLY_AVERAGE',
  })

  const reprioritized = second.variants.find((variant) => variant.modelId === 'arima' && variant.targetBasis === 'MONTHLY_AVERAGE')
  assert.ok(['QUEUED', 'PREPARING', 'READY'].includes(reprioritized?.currentState ?? 'FAILED'))

  releaseFirstCurrent?.()

  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(currentCalls.slice(0, 2), [
    'END_OF_PERIOD:naive',
    'MONTHLY_AVERAGE:arima',
  ])
  assert.equal(historicalCalls.length, 0)
})

test('snapshot maps unsupported identities without collapsing them into queued work', async () => {
  const service = createProgressiveForecastPreparationService({
    async resolveCapabilities(seriesId) {
      return capabilityResolution(seriesId, {
        admissionState: 'NOT_LAWFUL',
        capabilityState: 'NOT_LAWFUL',
        currentForecastEligible: false,
      } as never)
    },
    async prepareMonthlyCurrent() {
      throw new Error('Should not prepare unsupported capability.')
    },
    async prepareMonthlyHistorical() {
      throw new Error('Should not prepare unsupported capability.')
    },
    async runRollingDaily() {
      throw new Error('unused')
    },
  })

  const snapshot = await service.snapshotAndKickoff({
    seriesId: 'unsupported.series',
    preferredModelId: 'arima',
    preferredTargetBasis: 'END_OF_PERIOD',
  })

  assert.ok(snapshot.variants.every((variant) => variant.currentState === 'UNSUPPORTED'))
  assert.ok(snapshot.variants.every((variant) => variant.verificationState === 'UNSUPPORTED'))
  assert.equal(snapshot.queuedCount, 0)
})
