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

async function flushProgressiveQueue() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function createMonthlyHarness(options: {
  gateFirstCurrentForSeriesId?: string
  markAllCurrentReadyOnCurrentSuccess?: Set<string>
  failCurrentOnceByCall?: Map<string, string>
} = {}) {
  const currentCalls: string[] = []
  const historicalCalls: string[] = []
  const operationLog: string[] = []
  const currentReadyBySeries = new Map<string, Set<string>>()
  const historicalReadyBySeries = new Map<string, Set<string>>()
  const pendingGateBySeriesId = new Map<string, Promise<void>>()
  const releaseGateBySeriesId = new Map<string, () => void>()
  const gatedSeriesIds = new Set<string>()
  const remainingFailures = new Map(options.failCurrentOnceByCall ?? [])

  if (options.gateFirstCurrentForSeriesId) {
    pendingGateBySeriesId.set(options.gateFirstCurrentForSeriesId, new Promise<void>((resolve) => {
      releaseGateBySeriesId.set(options.gateFirstCurrentForSeriesId!, resolve)
    }))
  }

  function callKey(input: { targetBasis: string, modelId: string }) {
    return `${input.targetBasis}:${input.modelId}`
  }

  function getReadySet(store: Map<string, Set<string>>, seriesId: string) {
    let existing = store.get(seriesId)
    if (!existing) {
      existing = new Set<string>()
      store.set(seriesId, existing)
    }
    return existing
  }

  function markAllCurrentReady(seriesId: string) {
    getReadySet(currentReadyBySeries, seriesId).add('END_OF_PERIOD:naive')
    getReadySet(currentReadyBySeries, seriesId).add('END_OF_PERIOD:damped_holt')
    getReadySet(currentReadyBySeries, seriesId).add('END_OF_PERIOD:ets')
    getReadySet(currentReadyBySeries, seriesId).add('END_OF_PERIOD:arima')
    getReadySet(currentReadyBySeries, seriesId).add('MONTHLY_AVERAGE:naive')
    getReadySet(currentReadyBySeries, seriesId).add('MONTHLY_AVERAGE:damped_holt')
    getReadySet(currentReadyBySeries, seriesId).add('MONTHLY_AVERAGE:ets')
    getReadySet(currentReadyBySeries, seriesId).add('MONTHLY_AVERAGE:arima')
  }

  const service = createProgressiveForecastPreparationService({
    async resolveCapabilities(seriesId) {
      const resolution = capabilityResolution(seriesId)
      const currentReady = currentReadyBySeries.get(seriesId) ?? new Set<string>()
      const historicalReady = historicalReadyBySeries.get(seriesId) ?? new Set<string>()

      return {
        ...resolution,
        capabilities: resolution.capabilities.map((capability) => {
          const key = `${capability.identity.targetSemantics}:${capability.identity.modelId}`
          const currentKey = `${TARGET_BASIS_BY_TEST_SEMANTICS[capability.identity.targetSemantics]}:${capability.identity.modelId}`
          const currentPreparedState = currentReady.has(currentKey) ? 'READY' as const : capability.currentPreparedState
          const historicalPreparedState = historicalReady.has(currentKey) ? 'READY' as const : capability.historicalPreparedState
          return {
            ...capability,
            currentPreparedState,
            historicalPreparedState,
            historyFingerprint: key,
          }
        }),
      }
    },
    async prepareMonthlyCurrent(input) {
      const key = callKey(input)
      currentCalls.push(`${input.seriesId}:${key}`)
      operationLog.push(`CURRENT:${input.seriesId}:${key}`)

      const gatedSeriesId = options.gateFirstCurrentForSeriesId
      if (gatedSeriesId === input.seriesId && !gatedSeriesIds.has(input.seriesId)) {
        gatedSeriesIds.add(input.seriesId)
        await pendingGateBySeriesId.get(input.seriesId)
      }

      const failureKey = `${input.seriesId}:${key}`
      const failureMessage = remainingFailures.get(failureKey)
      if (failureMessage) {
        remainingFailures.delete(failureKey)
        throw new Error(failureMessage)
      }

      if (options.markAllCurrentReadyOnCurrentSuccess?.has(input.seriesId)) {
        markAllCurrentReady(input.seriesId)
      } else {
        getReadySet(currentReadyBySeries, input.seriesId).add(key)
      }

      return availableCurrent({
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
      }) as never
    },
    async prepareMonthlyHistorical(input) {
      historicalCalls.push(`${input.seriesId}:${callKey(input)}`)
      operationLog.push(`VERIFICATION:${input.seriesId}:${callKey(input)}`)
      getReadySet(historicalReadyBySeries, input.seriesId).add(callKey(input))
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

  return {
    service,
    currentCalls,
    historicalCalls,
    operationLog,
    releaseSeries(seriesId: string) {
      releaseGateBySeriesId.get(seriesId)?.()
    },
  }
}

const TARGET_BASIS_BY_TEST_SEMANTICS = {
  END_OF_PERIOD: 'END_OF_PERIOD',
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
} as const

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

test('selected current transitions from queued to preparing to ready and is then reused', async () => {
  const harness = createMonthlyHarness({ gateFirstCurrentForSeriesId: 'series-a' })

  const queuedSnapshot = await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'naive',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  const queuedVariant = queuedSnapshot.variants.find((variant) => variant.modelId === 'naive' && variant.targetBasis === 'END_OF_PERIOD')
  assert.ok(['QUEUED', 'PREPARING'].includes(queuedVariant?.currentState ?? 'FAILED'))

  await new Promise((resolve) => setImmediate(resolve))

  const preparingSnapshot = await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'naive',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  const preparingVariant = preparingSnapshot.variants.find((variant) => variant.modelId === 'naive' && variant.targetBasis === 'END_OF_PERIOD')
  assert.equal(preparingVariant?.currentState, 'PREPARING')

  harness.releaseSeries('series-a')
  await flushProgressiveQueue()

  const readySnapshot = await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'naive',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  const readyVariant = readySnapshot.variants.find((variant) => variant.modelId === 'naive' && variant.targetBasis === 'END_OF_PERIOD')
  assert.equal(readyVariant?.currentState, 'READY')
  assert.equal(harness.currentCalls.filter((call) => call === 'series-a:END_OF_PERIOD:naive').length, 1)
})

test('active series item may finish, then a newly selected series current becomes next before stale backlog', async () => {
  const harness = createMonthlyHarness({ gateFirstCurrentForSeriesId: 'series-a' })

  await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'naive',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  await new Promise((resolve) => setImmediate(resolve))

  const seriesBSnapshot = await harness.service.snapshotAndKickoff({
    seriesId: 'series-b',
    preferredModelId: 'arima',
    preferredTargetBasis: 'MONTHLY_AVERAGE',
  })
  const seriesBVariant = seriesBSnapshot.variants.find((variant) => variant.modelId === 'arima' && variant.targetBasis === 'MONTHLY_AVERAGE')
  assert.ok(['QUEUED', 'PREPARING', 'READY'].includes(seriesBVariant?.currentState ?? 'FAILED'))

  harness.releaseSeries('series-a')
  await flushProgressiveQueue()

  assert.deepEqual(harness.currentCalls.slice(0, 2), [
    'series-a:END_OF_PERIOD:naive',
    'series-b:MONTHLY_AVERAGE:arima',
  ])
  assert.deepEqual(harness.operationLog.slice(0, 2), [
    'CURRENT:series-a:END_OF_PERIOD:naive',
    'CURRENT:series-b:MONTHLY_AVERAGE:arima',
  ])
})

test('queued verification does not outrank a newly selected current from another series', async () => {
  const harness = createMonthlyHarness({
    gateFirstCurrentForSeriesId: 'series-a',
    markAllCurrentReadyOnCurrentSuccess: new Set(['series-a']),
  })

  await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'naive',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  await new Promise((resolve) => setImmediate(resolve))

  await harness.service.snapshotAndKickoff({
    seriesId: 'series-b',
    preferredModelId: 'arima',
    preferredTargetBasis: 'END_OF_PERIOD',
  })

  harness.releaseSeries('series-a')
  await flushProgressiveQueue()

  assert.deepEqual(harness.currentCalls.slice(0, 2), [
    'series-a:END_OF_PERIOD:naive',
    'series-b:END_OF_PERIOD:arima',
  ])
  assert.deepEqual(harness.operationLog.slice(0, 2), [
    'CURRENT:series-a:END_OF_PERIOD:naive',
    'CURRENT:series-b:END_OF_PERIOD:arima',
  ])
})

test('same identity requested twice does not duplicate compute', async () => {
  const harness = createMonthlyHarness({ gateFirstCurrentForSeriesId: 'series-a' })

  await Promise.all([
    harness.service.snapshotAndKickoff({
      seriesId: 'series-a',
      preferredModelId: 'naive',
      preferredTargetBasis: 'END_OF_PERIOD',
    }),
    harness.service.snapshotAndKickoff({
      seriesId: 'series-a',
      preferredModelId: 'naive',
      preferredTargetBasis: 'END_OF_PERIOD',
    }),
  ])

  harness.releaseSeries('series-a')
  await flushProgressiveQueue()

  assert.equal(harness.currentCalls.filter((call) => call === 'series-a:END_OF_PERIOD:naive').length, 1)
})

test('failed preparation records the exact reason and does not auto-retry on ordinary polling', async () => {
  const harness = createMonthlyHarness({
    failCurrentOnceByCall: new Map([
      ['series-a:END_OF_PERIOD:arima', 'simulated current failure'],
    ]),
  })

  await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'arima',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  await flushProgressiveQueue()

  const failedSnapshot = await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'arima',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  const failedVariant = failedSnapshot.variants.find((variant) => variant.modelId === 'arima' && variant.targetBasis === 'END_OF_PERIOD')
  assert.equal(failedVariant?.currentState, 'FAILED')
  assert.equal(failedVariant?.currentReason, 'simulated current failure')

  const polledSnapshot = await harness.service.snapshotAndKickoff({
    seriesId: 'series-a',
    preferredModelId: 'arima',
    preferredTargetBasis: 'END_OF_PERIOD',
  })
  const polledVariant = polledSnapshot.variants.find((variant) => variant.modelId === 'arima' && variant.targetBasis === 'END_OF_PERIOD')
  assert.equal(polledVariant?.currentState, 'FAILED')
  assert.equal(polledVariant?.currentReason, 'simulated current failure')
  assert.equal(harness.currentCalls.filter((call) => call === 'series-a:END_OF_PERIOD:arima').length, 1)
})
