import assert from 'node:assert/strict'
import test from 'node:test'

import { createForecastLibraryService, type ForecastBridge, type ForecastLibraryRepository, buildForecastHistoryFingerprint } from '../lib/forecast/service'

function createHistoryResponse() {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    benchmark: {
      seriesId: 'wocaes0280',
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    history: {
      seriesId: 'wocaes0280',
      benchmarkName: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      start: '2021-01-01T00:00:00',
      end: '2026-04-01T00:00:00',
      observations: 64,
      points: [
        { date: '2021-01-01T00:00:00', value: 1000 },
        { date: '2026-04-01T00:00:00', value: 1125 },
      ],
    },
  }
}

function createCurrentResponse(modelId = 'ets') {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    benchmark: {
      seriesId: 'wocaes0280',
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    model: {
      id: modelId,
      userFacing: true,
    },
    result: {
      benchmarkId: 'wocaes0280',
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      model: modelId,
      history: createHistoryResponse().history,
      currentForecast: {
        '1M': {
          horizon: '1M',
          horizonSteps: 1,
          forecastDate: '2026-05-01T00:00:00',
          forecastValue: 1132.5,
          metadata: {
            modelFamily: 'ets',
            selectedVariant: 'ETS(A,N,N)',
            selectedParameters: {},
            selectionScore: 0.12,
            selectionMetric: 'rmse',
            fitStatus: 'SUCCEEDED',
            failureReason: null,
          },
          failureReason: null,
        },
        '3M': {
          horizon: '3M',
          horizonSteps: 3,
          forecastDate: '2026-07-01T00:00:00',
          forecastValue: 1144.5,
          metadata: {
            modelFamily: 'ets',
            selectedVariant: 'ETS(A,N,N)',
            selectedParameters: {},
            selectionScore: 0.12,
            selectionMetric: 'rmse',
            fitStatus: 'SUCCEEDED',
            failureReason: null,
          },
          failureReason: null,
        },
      },
      runtimeSeconds: 0.084,
    },
  }
}

function createVerificationResponse(modelId = 'ets') {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    benchmark: {
      seriesId: 'wocaes0280',
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    model: {
      id: modelId,
      userFacing: true,
    },
    result: {
      benchmarkId: 'wocaes0280',
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      model: modelId,
      history: createHistoryResponse().history,
      backtest: {
        '1M': {
          origins: 28,
          expectedOrigins: 28,
          successfulOrigins: 28,
          failedOrigins: 0,
          coverage: 1,
          metrics: {
            mae: 10.5,
            rmse: 12.4,
            mase: 0.81,
            smape: 0.073,
            directional_accuracy: 0.64,
            bias: -1.2,
          },
          records: [
            {
              benchmarkId: 'wocaes0280',
              modelId,
              forecastOrigin: '2025-01-01T00:00:00',
              horizon: '1M',
              horizonSteps: 1,
              forecastDate: '2025-02-01T00:00:00',
              actualObservedAt: '2025-02-28T00:00:00',
              originValue: 1000,
              forecastValue: 1012,
              actualValue: 1008,
              error: 4,
              absoluteError: 4,
              delta: 12,
              deltaPct: 0.012,
              maseScale: 14.2,
              metadata: {
                modelFamily: 'ets',
                selectedVariant: 'ETS(A,N,N)',
                selectedParameters: {},
                selectionScore: 0.12,
                selectionMetric: 'rmse',
                fitStatus: 'SUCCEEDED',
                failureReason: null,
              },
            },
          ],
          failures: [],
        },
      },
      runtimeSeconds: 2.48,
    },
  }
}

function createEndOfPeriodHistoryResponse() {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'DYNAMIC_MARKET_DATA_STORE',
      runId: null,
    },
    benchmark: {
      seriesId: 'wocaes0074',
      component: 'BRENT_SPOT',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    history: {
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent, Spot, FOB North Sea',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'MONTHLY',
      start: '2021-01-01T00:00:00.000Z',
      end: '2026-04-01T00:00:00.000Z',
      observations: 64,
      canonicalization: {
        method: 'LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD',
        version: 'daily-market-price-end-of-period-v1',
      },
      points: [
        {
          date: '2025-02-01T00:00:00.000Z',
          value: 1008,
          sourceObservedAt: '2025-02-28T00:00:00.000Z',
        },
        {
          date: '2026-04-01T00:00:00.000Z',
          value: 1125,
          sourceObservedAt: '2026-04-30T00:00:00.000Z',
        },
      ],
    },
  }
}

function createEndOfPeriodCurrentResponse(modelId = 'ets') {
  const history = createEndOfPeriodHistoryResponse().history

  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'DYNAMIC_MARKET_DATA_STORE',
      runId: null,
    },
    benchmark: {
      seriesId: 'wocaes0074',
      component: 'BRENT_SPOT',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    model: {
      id: modelId,
      userFacing: true,
    },
    result: {
      benchmarkId: 'wocaes0074',
      component: 'BRENT_SPOT',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'MONTHLY',
      model: modelId,
      history,
      currentForecast: {
        '1M': {
          horizon: '1M',
          horizonSteps: 1,
          forecastDate: '2026-05-01T00:00:00.000Z',
          forecastValue: 1132.5,
          metadata: {
            modelFamily: 'ets',
            selectedVariant: 'ETS(A,N,N)',
            selectedParameters: {},
            selectionScore: 0.12,
            selectionMetric: 'rmse',
            fitStatus: 'SUCCEEDED',
            failureReason: null,
          },
          failureReason: null,
        },
      },
      runtimeSeconds: 0.084,
    },
  }
}

function createEndOfPeriodVerificationResponse(modelId = 'ets') {
  const history = createEndOfPeriodHistoryResponse().history

  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'DYNAMIC_MARKET_DATA_STORE',
      runId: null,
    },
    benchmark: {
      seriesId: 'wocaes0074',
      component: 'BRENT_SPOT',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    model: {
      id: modelId,
      userFacing: true,
    },
    result: {
      benchmarkId: 'wocaes0074',
      component: 'BRENT_SPOT',
      description: 'Brent, Spot, FOB North Sea',
      frequency: 'MONTHLY',
      model: modelId,
      history,
      backtest: {
        '1M': {
          origins: 28,
          expectedOrigins: 28,
          successfulOrigins: 28,
          failedOrigins: 0,
          coverage: 1,
          metrics: {
            mae: 10.5,
            rmse: 12.4,
            mase: 0.81,
            smape: 0.073,
            directional_accuracy: 0.64,
            bias: -1.2,
          },
          records: [
            {
              benchmarkId: 'wocaes0074',
              modelId,
              forecastOrigin: '2025-01-01T00:00:00.000Z',
              horizon: '1M',
              horizonSteps: 1,
              forecastDate: '2025-02-01T00:00:00.000Z',
              actualObservedAt: null,
              originValue: 1000,
              forecastValue: 1012,
              actualValue: 1008,
              error: 4,
              absoluteError: 4,
              delta: 12,
              deltaPct: 0.012,
              maseScale: 14.2,
              metadata: {
                modelFamily: 'ets',
                selectedVariant: 'ETS(A,N,N)',
                selectedParameters: {},
                selectionScore: 0.12,
                selectionMetric: 'rmse',
                fitStatus: 'SUCCEEDED',
                failureReason: null,
              },
            },
          ],
          failures: [],
        },
      },
      runtimeSeconds: 2.48,
    },
  }
}

function persistedIdentity(targetBasis: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD') {
  return {
    targetSemantics: targetBasis,
    methodId: targetBasis,
    preparation: null,
    cadence: null,
    frequencyIdentity: 'MONTHLY',
  } as const
}

test('forecast library current path returns cached artifact without invoking compute bridge', async () => {
  const history = createHistoryResponse()
  let currentCalls = 0
  let verificationCalls = 0

  const bridge: ForecastBridge = {
    async exportHistory() {
      return history
    },
    async exportCurrent() {
      currentCalls += 1
      return createCurrentResponse()
    },
    async exportVerification() {
      verificationCalls += 1
      return createVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun(key) {
      assert.equal(key.historyFingerprint, buildForecastHistoryFingerprint(history.history))
      assert.equal(key.targetBasis, 'MONTHLY_AVERAGE')
      assert.equal(key.targetSemantics, 'MONTHLY_AVERAGE')
      assert.equal(key.methodId, 'MONTHLY_AVERAGE')
      return {
        seriesId: 'wocaes0280',
        modelId: 'ets',
        displayName: 'FRACHT_DRY',
        description: 'Baltic Exchange, Dry Index (BDI), USD',
        targetBasis: 'MONTHLY_AVERAGE',
        ...persistedIdentity('MONTHLY_AVERAGE'),
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        source: {
          kind: 'POSTGRES_RUNTIME_SNAPSHOT',
          runId: 'cmrd3xvlu0000cedt8gczw378',
        },
        historyFingerprint: buildForecastHistoryFingerprint(history.history),
        history: {
          frequency: 'MONTHLY',
          start: '2021-01-01T00:00:00',
          end: '2026-04-01T00:00:00',
          observations: 64,
        },
        forecastOrigin: '2026-04-01T00:00:00',
        runtimeSeconds: 0.02,
        currentForecast: createCurrentResponse().result.currentForecast,
      }
    },
    async writeCurrentRun() {
      throw new Error('should not persist cache hit')
    },
    async readVerificationRun(key) {
      assert.equal(key.targetSemantics, 'MONTHLY_AVERAGE')
      assert.equal(key.methodId, 'MONTHLY_AVERAGE')
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecast('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'hit')
  assert.equal(result.displayName, 'FRACHT_DRY')
  assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(result.targetSemantics, 'MONTHLY_AVERAGE')
  assert.equal(result.methodId, 'MONTHLY_AVERAGE')
  assert.equal(result.targetSemantics, 'MONTHLY_AVERAGE')
  assert.equal(result.methodId, 'MONTHLY_AVERAGE')
  assert.equal(result.alignment.status, 'ALIGNED')
  assert.equal(result.alignment.lastHistoricalPeriod, '2026-04-01T00:00:00')
  assert.equal(result.alignment.forecastOrigin, '2026-04-01T00:00:00')
  assert.equal(result.alignment.firstForecastTarget, '2026-05-01T00:00:00')
  assert.equal(currentCalls, 0)
  assert.equal(verificationCalls, 0)
})

test('prepared-only Forecast Library reads never invoke history, model, verification, or writes', async () => {
  let bridgeCalls = 0
  let writeCalls = 0
  const history = createHistoryResponse()
  const currentArtifact = {
    seriesId: 'wocaes0280',
    modelId: 'arima',
    displayName: 'FRACHT_DRY',
    description: null,
    targetBasis: 'END_OF_PERIOD' as const,
    ...persistedIdentity('END_OF_PERIOD'),
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: { kind: 'DYNAMIC_MARKET_DATA_STORE', runId: null },
    historyFingerprint: 'prepared-eop',
    history: { frequency: 'MONTHLY', start: '2021-01-01', end: '2026-04-01', observations: 64 },
    forecastOrigin: '2026-04-01',
    runtimeSeconds: 1,
    currentForecast: createCurrentResponse('arima').result.currentForecast,
  }
  const verificationArtifact = {
    ...currentArtifact,
    currentForecast: undefined,
    verification: {},
  }
  delete (verificationArtifact as { currentForecast?: unknown }).currentForecast

  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { bridgeCalls += 1; return history },
      async exportCurrent() { bridgeCalls += 1; return createCurrentResponse('arima') },
      async exportVerification() { bridgeCalls += 1; return createVerificationResponse('arima') },
    },
    repository: {
      async readCurrentRun() { throw new Error('exact-history lookup is not a prepared read') },
      async readVerificationRun() { throw new Error('exact-history lookup is not a prepared read') },
      async writeCurrentRun() { writeCalls += 1 },
      async writeVerificationRun() { writeCalls += 1 },
      async readLatestCurrentRun(key) {
        assert.equal(key.methodId, 'END_OF_PERIOD')
        assert.equal(key.modelId, 'arima')
        assert.equal(key.frequencyIdentity, 'MONTHLY')
        return currentArtifact
      },
      async readLatestVerificationRun(key) {
        assert.equal(key.methodId, 'END_OF_PERIOD')
        assert.equal(key.modelId, 'arima')
        assert.equal(key.frequencyIdentity, 'MONTHLY')
        return verificationArtifact
      },
    },
    logEvent: () => {},
  })

  const current = await service.readPreparedCurrentForecastRequest({ seriesId: 'wocaes0280', modelId: 'arima', targetBasis: 'END_OF_PERIOD' })
  const verification = await service.readPreparedVerificationRequest({ seriesId: 'wocaes0280', modelId: 'arima', targetBasis: 'END_OF_PERIOD' })

  assert.equal(current.status, 'AVAILABLE')
  assert.equal(verification.status, 'AVAILABLE')
  assert.equal(bridgeCalls, 0)
  assert.equal(writeCalls, 0)
})

test('prepared-only lookup selects the exact source-frequency and target-cadence cohort before latest', async () => {
  let sideEffects = 0
  const expectedFrequencyIdentity = 'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY'
  const requestedMethodVersion = 'benchmark-forecasting-mvp-phase2-v1'
  const artifacts = [
    { frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=QUARTERLY', methodVersion: requestedMethodVersion, updatedAt: 5, marker: 'A' },
    { frequencyIdentity: expectedFrequencyIdentity, methodVersion: requestedMethodVersion, updatedAt: 1, marker: 'B-OLDER' },
    { frequencyIdentity: expectedFrequencyIdentity, methodVersion: 'benchmark-forecasting-mvp-phase2-v2', updatedAt: 4, marker: 'C' },
    { frequencyIdentity: expectedFrequencyIdentity, methodVersion: requestedMethodVersion, updatedAt: 2, marker: 'B-LATEST' },
  ]
  const exactArtifact = {
    seriesId: 'generic.series',
    modelId: 'ets',
    displayName: 'Generic quarterly series',
    description: null,
    targetBasis: 'MONTHLY_AVERAGE' as const,
    ...persistedIdentity('MONTHLY_AVERAGE'),
    methodVersion: requestedMethodVersion,
    source: { kind: 'CONTROLLED_FIXTURE', runId: null },
    historyFingerprint: 'quarterly-history',
    cadence: { sourceFrequency: 'QUARTERLY', targetCadence: 'QUARTERLY' } as const,
    frequencyIdentity: expectedFrequencyIdentity,
    history: { frequency: 'QUARTERLY', start: '2025-01-01', end: '2025-10-01', observations: 4 },
    forecastOrigin: '2025-10-01',
    runtimeSeconds: 0.1,
    currentForecast: {},
  }

  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { sideEffects += 1; return createHistoryResponse() },
      async exportCurrent() { sideEffects += 1; return createCurrentResponse() },
      async exportVerification() { sideEffects += 1; return createVerificationResponse() },
    },
    repository: {
      async readCurrentRun() { throw new Error('unused') },
      async readVerificationRun() { throw new Error('unused') },
      async writeCurrentRun() { sideEffects += 1 },
      async writeVerificationRun() { sideEffects += 1 },
      async readLatestCurrentRun(key) {
        const selected = artifacts
          .filter((artifact) => (
            artifact.frequencyIdentity === key.frequencyIdentity
            && artifact.methodVersion === key.methodVersion
          ))
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .at(0)
        assert.equal(selected?.marker, 'B-LATEST')
        return exactArtifact
      },
      async readLatestVerificationRun() { return null },
    },
    logEvent: () => {},
  })

  const result = await service.readPreparedCurrentForecastRequest({
    seriesId: 'generic.series',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(sideEffects, 0)
  if (result.status !== 'AVAILABLE') return
  assert.equal(result.lineage.sourceFrequency, 'QUARTERLY')
  assert.equal(result.history.frequency, 'QUARTERLY')
})

test('prepared-only lookup rejects partial cadence identity without compute or fallback', async () => {
  let sideEffects = 0
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { sideEffects += 1; return createHistoryResponse() },
      async exportCurrent() { sideEffects += 1; return createCurrentResponse() },
      async exportVerification() { sideEffects += 1; return createVerificationResponse() },
    },
    repository: {
      async readCurrentRun() { throw new Error('unused') },
      async readVerificationRun() { throw new Error('unused') },
      async writeCurrentRun() { sideEffects += 1 },
      async writeVerificationRun() { sideEffects += 1 },
      async readLatestCurrentRun() { throw new Error('must fail before lookup') },
      async readLatestVerificationRun() { throw new Error('unused') },
    },
    logEvent: () => {},
  })

  await assert.rejects(
    () => service.readPreparedCurrentForecastRequest({
      seriesId: 'generic.series',
      modelId: 'ets',
      targetBasis: 'MONTHLY_AVERAGE',
      sourceFrequency: 'QUARTERLY',
    }),
    /requires sourceFrequency and targetCadence together/,
  )
  assert.equal(sideEffects, 0)
})

test('prepared-only Forecast Library miss is explicit and performs no compute or write', async () => {
  let sideEffects = 0
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { sideEffects += 1; return createHistoryResponse() },
      async exportCurrent() { sideEffects += 1; return createCurrentResponse() },
      async exportVerification() { sideEffects += 1; return createVerificationResponse() },
    },
    repository: {
      async readCurrentRun() { throw new Error('unused') },
      async readVerificationRun() { throw new Error('unused') },
      async writeCurrentRun() { sideEffects += 1 },
      async writeVerificationRun() { sideEffects += 1 },
      async readLatestCurrentRun() { return null },
      async readLatestVerificationRun() { return null },
    },
    logEvent: () => {},
  })

  const current = await service.readPreparedCurrentForecastRequest({ seriesId: 'missing', modelId: 'ets', targetBasis: 'MONTHLY_AVERAGE' })
  const verification = await service.readPreparedVerificationRequest({ seriesId: 'missing', modelId: 'ets', targetBasis: 'MONTHLY_AVERAGE' })

  assert.equal(current.status, 'NOT_AVAILABLE')
  assert.equal(verification.status, 'NOT_AVAILABLE')
  assert.match(current.reason, /PREPARATION_REQUIRED/)
  assert.match(verification.reason, /PREPARATION_REQUIRED/)
  assert.equal(sideEffects, 0)
})

test('forecast library current path computes and persists on cache miss', async () => {
  let persistedFingerprint: string | null = null
  let persistedHorizons = 0
  let persistedTargetBasis: string | null = null

  const bridge: ForecastBridge = {
    async exportHistory() {
      return createHistoryResponse()
    },
    async exportCurrent() {
      return createCurrentResponse()
    },
    async exportVerification() {
      return createVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun(artifact) {
      persistedFingerprint = artifact.historyFingerprint
      persistedHorizons = Object.keys(artifact.currentForecast).length
      persistedTargetBasis = artifact.targetBasis
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecast('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(result.historyFingerprint, buildForecastHistoryFingerprint(createHistoryResponse().history))
  assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(result.targetSemantics, 'MONTHLY_AVERAGE')
  assert.equal(result.methodId, 'MONTHLY_AVERAGE')
  assert.equal(result.lineage.preparation?.provenanceStatus, 'LEGACY_UNRESOLVED')
  assert.equal(result.alignment.status, 'ALIGNED')
  assert.equal(result.alignment.lastHistoricalPeriod, '2026-04-01T00:00:00')
  assert.equal(result.alignment.forecastOrigin, '2026-04-01T00:00:00')
  assert.equal(result.alignment.firstForecastTarget, '2026-05-01T00:00:00')
  assert.equal(persistedFingerprint, result.historyFingerprint)
  assert.equal(persistedHorizons, 2)
  assert.equal(persistedTargetBasis, 'MONTHLY_AVERAGE')
})

test('forecast library Current exact-key misses use one owner, nine waiters, and one write', async () => {
  const events: Array<{ event: string; metrics: Record<string, string | number | boolean | null> }> = []
  let computes = 0
  let writes = 0
  let releaseCompute: (() => void) | undefined
  const computeGate = new Promise<void>((resolve) => {
    releaseCompute = resolve
  })
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { return createHistoryResponse() },
      async exportCurrent() {
        computes += 1
        await computeGate
        return createCurrentResponse()
      },
      async exportVerification() { throw new Error('Verification must remain outside Current single-flight.') },
    },
    repository: {
      async readCurrentRun() { return null },
      async writeCurrentRun() { writes += 1 },
      async readVerificationRun() { return null },
      async writeVerificationRun() { throw new Error('Verification persistence must remain unused.') },
    },
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) { events.push({ event, metrics: metrics ?? {} }) },
    },
  })

  const requests = Array.from({ length: 10 }, () => service.resolveCurrentForecast('wocaes0280', 'ets'))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(computes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_owner_acquired').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_waiter_joined').length, 9)

  releaseCompute?.()
  const results = await Promise.all(requests)

  assert.equal(computes, 1)
  assert.equal(writes, 1)
  assert.ok(results.every((result) => result === results[0]))
  assert.equal(events.filter(({ event }) => event === 'current_compute_start').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 1)
  assert.ok(events.some(({ event, metrics }) =>
    event === 'single_flight_entry_released' && metrics.activeCurrentSingleFlightEntries === 0))
})

test('forecast library Current owner remains in flight through persistence settlement', async () => {
  const events: Array<{ event: string; metrics: Record<string, string | number | boolean | null> }> = []
  let computes = 0
  let writes = 0
  let releasePersistence: (() => void) | undefined
  const persistenceGate = new Promise<void>((resolve) => {
    releasePersistence = resolve
  })
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { return createHistoryResponse() },
      async exportCurrent() {
        computes += 1
        return createCurrentResponse()
      },
      async exportVerification() { throw new Error('unused') },
    },
    repository: {
      async readCurrentRun() { return null },
      async writeCurrentRun() {
        writes += 1
        if (writes === 1) await persistenceGate
      },
      async readVerificationRun() { return null },
      async writeVerificationRun() { throw new Error('unused') },
    },
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) { events.push({ event, metrics: metrics ?? {} }) },
    },
  })

  const owner = service.resolveCurrentForecast('wocaes0280', 'ets')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(writes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 0)

  const lateWaiter = service.resolveCurrentForecast('wocaes0280', 'ets')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(computes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_waiter_joined').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 0)

  releasePersistence?.()
  const settled = await Promise.all([owner, lateWaiter])
  assert.ok(settled.every((result) => result === settled[0]))
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 1)

  const postRelease = await service.resolveCurrentForecast('wocaes0280', 'ets')
  assert.equal(postRelease.status, 'AVAILABLE')
  assert.equal(computes, 2)
  assert.equal(writes, 2)
  assert.equal(events.filter(({ event }) => event === 'single_flight_owner_acquired').length, 2)
})

test('forecast library current path marks cached payload unaligned when forecast origin drifts from lawful history end', async () => {
  const history = createHistoryResponse()

  const bridge: ForecastBridge = {
    async exportHistory() {
      return history
    },
    async exportCurrent() {
      throw new Error('should not compute on cache hit')
    },
    async exportVerification() {
      throw new Error('unused')
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return {
        seriesId: 'wocaes0280',
        modelId: 'ets',
        displayName: 'FRACHT_DRY',
        description: 'Baltic Exchange, Dry Index (BDI), USD',
        targetBasis: 'MONTHLY_AVERAGE',
        ...persistedIdentity('MONTHLY_AVERAGE'),
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        source: {
          kind: 'POSTGRES_RUNTIME_SNAPSHOT',
          runId: 'cmrd3xvlu0000cedt8gczw378',
        },
        historyFingerprint: buildForecastHistoryFingerprint(history.history),
        history: {
          frequency: 'MONTHLY',
          start: '2021-01-01T00:00:00',
          end: '2026-04-01T00:00:00',
          observations: 64,
        },
        forecastOrigin: '2026-03-01T00:00:00',
        runtimeSeconds: 0.02,
        currentForecast: createCurrentResponse().result.currentForecast,
      }
    },
    async writeCurrentRun() {
      throw new Error('should not persist cache hit')
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecast('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'hit')
  assert.equal(result.alignment.status, 'UNALIGNED')
  assert.equal(result.alignment.lastHistoricalPeriod, '2026-04-01T00:00:00')
  assert.equal(result.alignment.forecastOrigin, '2026-03-01T00:00:00')
  assert.equal(result.alignment.firstForecastTarget, '2026-05-01T00:00:00')
})

test('forecast library verification path normalizes metrics and persists heavier results separately', async () => {
  let persistedVerification = 0
  let persistedTargetBasis: string | null = null

  const bridge: ForecastBridge = {
    async exportHistory() {
      return createHistoryResponse()
    },
    async exportCurrent() {
      return createCurrentResponse()
    },
    async exportVerification() {
      return createVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun(artifact) {
      persistedVerification = Object.keys(artifact.verification).length
      persistedTargetBasis = artifact.targetBasis
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerification('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(result.verification['1M']?.metrics?.directionalAccuracy, 0.64)
  assert.equal(result.verification['1M']?.records.length, 1)
  assert.equal(result.verification['1M']?.records[0]?.actualObservedAt, '2025-02-28T00:00:00')
  assert.equal(persistedVerification, 1)
  assert.equal(persistedTargetBasis, 'MONTHLY_AVERAGE')
})

test('forecast library Verification exact-key misses use one owner, one waiter, and one write', async () => {
  const events: Array<{ event: string; metrics: Record<string, string | number | boolean | null> }> = []
  let computes = 0
  let writes = 0
  let releaseCompute: (() => void) | undefined
  const computeGate = new Promise<void>((resolve) => {
    releaseCompute = resolve
  })
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { return createHistoryResponse() },
      async exportCurrent() { throw new Error('Current must remain outside Verification single-flight.') },
      async exportVerification() {
        computes += 1
        await computeGate
        return createVerificationResponse()
      },
    },
    repository: {
      async readCurrentRun() { return null },
      async writeCurrentRun() { throw new Error('Current persistence must remain unused.') },
      async readVerificationRun() { return null },
      async writeVerificationRun() { writes += 1 },
    },
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) { events.push({ event, metrics: metrics ?? {} }) },
    },
  })

  const owner = service.resolveVerification('wocaes0280', 'ets')
  const waiter = service.resolveVerification('wocaes0280', 'ets')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(computes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_owner_acquired').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_waiter_joined').length, 1)

  releaseCompute?.()
  const results = await Promise.all([owner, waiter])

  assert.equal(computes, 1)
  assert.equal(writes, 1)
  assert.ok(results.every((result) => result === results[0]))
  assert.equal(events.filter(({ event }) => event === 'verification_compute_start').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 1)
  assert.ok(events.some(({ event, metrics }) =>
    event === 'single_flight_entry_released'
    && metrics.operationFamily === 'VERIFICATION'
    && metrics.activeVerificationSingleFlightEntries === 0))
})

test('forecast library Verification owner remains in flight through persistence settlement', async () => {
  const events: Array<{ event: string; metrics: Record<string, string | number | boolean | null> }> = []
  let computes = 0
  let writes = 0
  let releasePersistence: (() => void) | undefined
  const persistenceGate = new Promise<void>((resolve) => {
    releasePersistence = resolve
  })
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { return createHistoryResponse() },
      async exportCurrent() { throw new Error('unused') },
      async exportVerification() {
        computes += 1
        return createVerificationResponse()
      },
    },
    repository: {
      async readCurrentRun() { return null },
      async writeCurrentRun() { throw new Error('unused') },
      async readVerificationRun() { return null },
      async writeVerificationRun() {
        writes += 1
        if (writes === 1) await persistenceGate
      },
    },
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) { events.push({ event, metrics: metrics ?? {} }) },
    },
  })

  const owner = service.resolveVerification('wocaes0280', 'ets')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(writes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 0)

  const lateWaiter = service.resolveVerification('wocaes0280', 'ets')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(computes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_waiter_joined').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 0)

  releasePersistence?.()
  const settled = await Promise.all([owner, lateWaiter])
  assert.ok(settled.every((result) => result === settled[0]))
  assert.equal(events.filter(({ event }) => event === 'single_flight_entry_released').length, 1)

  const postRelease = await service.resolveVerification('wocaes0280', 'ets')
  assert.equal(postRelease.status, 'AVAILABLE')
  assert.equal(computes, 2)
  assert.equal(writes, 2)
  assert.equal(events.filter(({ event }) => event === 'single_flight_owner_acquired').length, 2)
})

test('forecast library Verification owner failure releases, writes nothing, and permits retry', async () => {
  const events: Array<{ event: string; metrics: Record<string, string | number | boolean | null> }> = []
  const failure = new Error('controlled-verification-bridge-failure')
  let computes = 0
  let writes = 0
  let shouldFail = true
  let releaseFailure: (() => void) | undefined
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve
  })
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { return createHistoryResponse() },
      async exportCurrent() { throw new Error('unused') },
      async exportVerification() {
        computes += 1
        if (shouldFail) {
          await failureGate
          throw failure
        }
        return createVerificationResponse()
      },
    },
    repository: {
      async readCurrentRun() { return null },
      async writeCurrentRun() { throw new Error('unused') },
      async readVerificationRun() { return null },
      async writeVerificationRun() { writes += 1 },
    },
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) { events.push({ event, metrics: metrics ?? {} }) },
    },
  })

  const owner = service.resolveVerification('wocaes0280', 'ets')
  const waiter = service.resolveVerification('wocaes0280', 'ets')
  await new Promise((resolve) => setImmediate(resolve))
  releaseFailure?.()
  const failed = await Promise.allSettled([owner, waiter])

  assert.equal(computes, 1)
  assert.equal(writes, 0)
  assert.ok(failed.every((result) => result.status === 'rejected' && result.reason === failure))
  assert.equal(events.filter(({ event }) => event === 'single_flight_owner_failed').length, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_waiter_failed').length, 1)
  assert.ok(events.some(({ event, metrics }) =>
    event === 'single_flight_entry_released'
    && metrics.activeVerificationSingleFlightEntries === 0))

  shouldFail = false
  const retry = await service.resolveVerification('wocaes0280', 'ets')
  assert.equal(retry.status, 'AVAILABLE')
  assert.equal(computes, 2)
  assert.equal(writes, 1)
  assert.equal(events.filter(({ event }) => event === 'single_flight_owner_acquired').length, 2)
  assert.ok(events.some(({ event, metrics }) =>
    event === 'single_flight_entry_released'
    && metrics.activeVerificationSingleFlightEntries === 0))
})

test('forecast library current path does not reuse cache across target bases', async () => {
  let currentCalls = 0

  const bridge: ForecastBridge = {
    async exportHistory() {
      return createHistoryResponse()
    },
    async exportCurrent() {
      currentCalls += 1
      return createCurrentResponse()
    },
    async exportVerification() {
      throw new Error('unused')
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun(key) {
      if (key.targetBasis === 'END_OF_PERIOD') {
        return {
          seriesId: 'wocaes0280',
          modelId: 'ets',
          displayName: 'FRACHT_DRY',
          description: 'Baltic Exchange, Dry Index (BDI), USD',
          targetBasis: 'END_OF_PERIOD',
          ...persistedIdentity('END_OF_PERIOD'),
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
          source: {
            kind: 'POSTGRES_RUNTIME_SNAPSHOT',
            runId: 'cmrd3xvlu0000cedt8gczw378',
          },
          historyFingerprint: buildForecastHistoryFingerprint(createHistoryResponse().history),
          history: {
            frequency: 'MONTHLY',
            start: '2021-01-01T00:00:00',
            end: '2026-04-01T00:00:00',
            observations: 64,
          },
          forecastOrigin: '2026-04-01T00:00:00',
          runtimeSeconds: 0.02,
          currentForecast: createCurrentResponse().result.currentForecast,
        }
      }

      assert.equal(key.targetBasis, 'MONTHLY_AVERAGE')
      return null
    },
    async writeCurrentRun() {},
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecast('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(currentCalls, 1)
})

test('forecast library verification path does not reuse cache across target bases', async () => {
  let verificationCalls = 0

  const bridge: ForecastBridge = {
    async exportHistory() {
      return createHistoryResponse()
    },
    async exportCurrent() {
      throw new Error('unused')
    },
    async exportVerification() {
      verificationCalls += 1
      return createVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun(key) {
      if (key.targetBasis === 'END_OF_PERIOD') {
        return {
          seriesId: 'wocaes0280',
          modelId: 'ets',
          displayName: 'FRACHT_DRY',
          description: 'Baltic Exchange, Dry Index (BDI), USD',
          targetBasis: 'END_OF_PERIOD',
          ...persistedIdentity('END_OF_PERIOD'),
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
          source: {
            kind: 'POSTGRES_RUNTIME_SNAPSHOT',
            runId: 'cmrd3xvlu0000cedt8gczw378',
          },
          historyFingerprint: buildForecastHistoryFingerprint(createHistoryResponse().history),
          history: {
            frequency: 'MONTHLY',
            start: '2021-01-01T00:00:00',
            end: '2026-04-01T00:00:00',
            observations: 64,
          },
          forecastOrigin: '2026-04-01T00:00:00',
          runtimeSeconds: 0.02,
          verification: {
            '1M': {
              horizon: '1M',
              horizonSteps: 1,
              origins: 28,
              expectedOrigins: 28,
              successfulOrigins: 28,
              failedOrigins: 0,
              coverage: 1,
              metrics: {
                mae: 10.5,
                rmse: 12.4,
                mase: 0.81,
                smape: 0.073,
                directionalAccuracy: 0.64,
                bias: -1.2,
              },
              records: createVerificationResponse().result.backtest['1M'].records,
              failures: [],
            },
          },
        }
      }

      assert.equal(key.targetBasis, 'MONTHLY_AVERAGE')
      return null
    },
    async writeVerificationRun() {},
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerification('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(result.targetBasis, 'MONTHLY_AVERAGE')
  assert.equal(verificationCalls, 1)
})

test('forecast library current path serves compute result when datastore is unavailable', async () => {
  let persisted = false

  const bridge: ForecastBridge = {
    async exportHistory() {
      return createHistoryResponse()
    },
    async exportCurrent() {
      return createCurrentResponse()
    },
    async exportVerification() {
      return createVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      throw new Error('db offline')
    },
    async writeCurrentRun() {
      persisted = true
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecast('wocaes0280', 'ets')

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'db-unavailable')
  assert.equal(persisted, false)
})

test('forecast library short-circuits unsupported benchmarks before compute', async () => {
  let currentCalls = 0

  const bridge: ForecastBridge = {
    async exportHistory() {
      return {
        status: 'UNSUPPORTED' as const,
        reason: 'Unsupported benchmark series for the current forecasting laboratory phase.',
        seriesId: 'unsupported-series',
        supportedSeriesIds: ['wocaes0280'],
        supportedModels: ['naive', 'damped_holt', 'ets', 'arima'],
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        source: {
          kind: 'POSTGRES_RUNTIME_SNAPSHOT',
          runId: 'cmrd3xvlu0000cedt8gczw378',
        },
      }
    },
    async exportCurrent() {
      currentCalls += 1
      return createCurrentResponse()
    },
    async exportVerification() {
      return createVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      throw new Error('should not read repository on unsupported history')
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun() {
      throw new Error('unused')
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecast('unsupported-series', 'ets')

  assert.equal(result.status, 'UNSUPPORTED')
  assert.deepEqual(result.supportedSeriesIds, ['wocaes0280'])
  assert.equal(currentCalls, 0)
})

test('forecast library current path computes END_OF_PERIOD for live-input series without short-circuiting', async () => {
  let currentCalls = 0
  let persistedTargetBasis: string | null = null

  const bridge: ForecastBridge = {
    async exportHistory(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodHistoryResponse()
    },
    async exportCurrent(input) {
      currentCalls += 1
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodCurrentResponse()
    },
    async exportVerification() {
      throw new Error('unused')
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun(key) {
      assert.equal(key.targetBasis, 'END_OF_PERIOD')
      assert.equal(key.targetSemantics, 'END_OF_PERIOD')
      assert.equal(key.methodId, 'END_OF_PERIOD')
      return null
    },
    async writeCurrentRun(artifact) {
      persistedTargetBasis = artifact.targetBasis
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecastRequest({
    seriesId: 'wocaes0074',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(result.targetBasis, 'END_OF_PERIOD')
  assert.equal(result.targetSemantics, 'END_OF_PERIOD')
  assert.equal(result.methodId, 'END_OF_PERIOD')
  assert.equal(currentCalls, 1)
  assert.equal(persistedTargetBasis, 'END_OF_PERIOD')
})

test('forecast library current path reuses prepared selected live history and executes only the requested model', async () => {
  let prepareCalls = 0
  let historyCalls = 0
  let historyMode: 'current' | 'verification' | null = null
  let currentCalls = 0
  let verificationCalls = 0

  const bridge: ForecastBridge = {
    async prepareExecutionContext(input) {
      prepareCalls += 1
      assert.equal(input.seriesId, 'wocaes0074')
      assert.equal(input.targetBasis, 'END_OF_PERIOD')

      return {
        async exportHistory(mode) {
          historyCalls += 1
          historyMode = mode ?? null
          return createEndOfPeriodHistoryResponse()
        },
        async exportCurrent(modelId) {
          currentCalls += 1
          assert.equal(modelId, 'naive')
          return createEndOfPeriodCurrentResponse(modelId)
        },
        async exportVerification() {
          verificationCalls += 1
          return createEndOfPeriodVerificationResponse()
        },
      }
    },
    async exportHistory() {
      throw new Error('should use prepared execution context history')
    },
    async exportCurrent() {
      throw new Error('should use prepared execution context current')
    },
    async exportVerification() {
      throw new Error('should not invoke verification for current request')
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {},
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {
      throw new Error('unused')
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveCurrentForecastRequest({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.modelId, 'naive')
  assert.equal(result.targetBasis, 'END_OF_PERIOD')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(prepareCalls, 1)
  assert.equal(historyCalls, 1)
  assert.equal(historyMode, 'current')
  assert.equal(currentCalls, 1)
  assert.equal(verificationCalls, 0)
})

test('forecast library verification path reuses prepared selected live history and does not invoke unrelated current compute', async () => {
  let prepareCalls = 0
  let historyCalls = 0
  let historyMode: 'current' | 'verification' | null = null
  let currentCalls = 0
  let verificationCalls = 0

  const bridge: ForecastBridge = {
    async prepareExecutionContext(input) {
      prepareCalls += 1
      assert.equal(input.seriesId, 'wocaes0074')
      assert.equal(input.targetBasis, 'END_OF_PERIOD')

      return {
        async exportHistory(mode) {
          historyCalls += 1
          historyMode = mode ?? null
          return createEndOfPeriodHistoryResponse()
        },
        async exportCurrent() {
          currentCalls += 1
          return createEndOfPeriodCurrentResponse()
        },
        async exportVerification(modelId) {
          verificationCalls += 1
          assert.equal(modelId, 'damped_holt')
          return createEndOfPeriodVerificationResponse(modelId)
        },
      }
    },
    async exportHistory() {
      throw new Error('should use prepared execution context history')
    },
    async exportCurrent() {
      throw new Error('should not invoke current compute for verification request')
    },
    async exportVerification() {
      throw new Error('should use prepared execution context verification')
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun() {},
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerificationRequest({
    seriesId: 'wocaes0074',
    modelId: 'damped_holt',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.modelId, 'damped_holt')
  assert.equal(result.targetBasis, 'END_OF_PERIOD')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(prepareCalls, 1)
  assert.equal(historyCalls, 1)
  assert.equal(historyMode, 'verification')
  assert.equal(currentCalls, 0)
  assert.equal(verificationCalls, 1)
})

test('forecast library verification path backfills END_OF_PERIOD actualObservedAt from canonical history provenance', async () => {
  let persistedActualObservedAt: string | null = null

  const bridge: ForecastBridge = {
    async exportHistory(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodHistoryResponse()
    },
    async exportCurrent() {
      throw new Error('unused')
    },
    async exportVerification(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun(key) {
      assert.equal(key.targetBasis, 'END_OF_PERIOD')
      return null
    },
    async writeVerificationRun(artifact) {
      persistedActualObservedAt = artifact.verification['1M']?.records[0]?.actualObservedAt ?? null
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerificationRequest({
    seriesId: 'wocaes0074',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.targetBasis, 'END_OF_PERIOD')
  assert.equal(result.verification['1M']?.records[0]?.actualObservedAt, '2025-02-28T00:00:00.000Z')
  assert.equal(persistedActualObservedAt, '2025-02-28T00:00:00.000Z')
})

test('forecast library verification path backfills END_OF_PERIOD actualObservedAt for date-only target periods', async () => {
  let persistedActualObservedAt: string | null = null

  const baseResponse = createEndOfPeriodVerificationResponse()

  const bridge: ForecastBridge = {
    async exportHistory(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodHistoryResponse()
    },
    async exportCurrent() {
      throw new Error('unused')
    },
    async exportVerification(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return {
        ...baseResponse,
        result: {
          ...baseResponse.result,
          backtest: {
            '1M': {
              ...baseResponse.result.backtest['1M'],
              records: [
                {
                  ...baseResponse.result.backtest['1M'].records[0],
                  forecastDate: '2025-02-01',
                  actualObservedAt: null,
                },
              ],
            },
          },
        },
      }
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun(artifact) {
      persistedActualObservedAt = artifact.verification['1M']?.records[0]?.actualObservedAt ?? null
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerificationRequest({
    seriesId: 'wocaes0074',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.verification['1M']?.records[0]?.actualObservedAt, '2025-02-28T00:00:00.000Z')
  assert.equal(persistedActualObservedAt, '2025-02-28T00:00:00.000Z')
})

test('forecast library verification path uses exportHistory provenance when verification response history omits sourceObservedAt', async () => {
  let persistedActualObservedAt: string | null = null

  const baseResponse = createEndOfPeriodVerificationResponse()

  const bridge: ForecastBridge = {
    async exportHistory(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodHistoryResponse()
    },
    async exportCurrent() {
      throw new Error('unused')
    },
    async exportVerification(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return {
        ...baseResponse,
        result: {
          ...baseResponse.result,
          history: {
            ...baseResponse.result.history,
            points: baseResponse.result.history.points.map((point) => ({
              date: point.date,
              value: point.value,
            })),
          },
          backtest: {
            '1M': {
              ...baseResponse.result.backtest['1M'],
              records: [
                {
                  ...baseResponse.result.backtest['1M'].records[0],
                  forecastDate: '2025-02-01',
                  actualObservedAt: null,
                },
              ],
            },
          },
        },
      }
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun() {
      return null
    },
    async writeVerificationRun(artifact) {
      persistedActualObservedAt = artifact.verification['1M']?.records[0]?.actualObservedAt ?? null
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerificationRequest({
    seriesId: 'wocaes0074',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.verification['1M']?.records[0]?.actualObservedAt, '2025-02-28T00:00:00.000Z')
  assert.equal(persistedActualObservedAt, '2025-02-28T00:00:00.000Z')
})

test('forecast library verification path rebuilds stale END_OF_PERIOD cache entries missing actualObservedAt', async () => {
  let verificationCalls = 0
  let persistedActualObservedAt: string | null = null

  const bridge: ForecastBridge = {
    async exportHistory(input) {
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodHistoryResponse()
    },
    async exportCurrent() {
      throw new Error('unused')
    },
    async exportVerification(input) {
      verificationCalls += 1
      assert.equal(input.targetBasis, 'END_OF_PERIOD')
      return createEndOfPeriodVerificationResponse()
    },
  }

  const repository: ForecastLibraryRepository = {
    async readCurrentRun() {
      return null
    },
    async writeCurrentRun() {
      throw new Error('unused')
    },
    async readVerificationRun(key) {
      assert.equal(key.targetBasis, 'END_OF_PERIOD')
      return {
        seriesId: 'wocaes0074',
        modelId: 'ets',
        displayName: 'Brent, Spot, FOB North Sea',
        description: 'Brent, Spot, FOB North Sea',
        targetBasis: 'END_OF_PERIOD',
        ...persistedIdentity('END_OF_PERIOD'),
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        source: {
          kind: 'DYNAMIC_MARKET_DATA_STORE',
          runId: null,
        },
        historyFingerprint: buildForecastHistoryFingerprint(createEndOfPeriodHistoryResponse().history),
        history: {
          frequency: 'MONTHLY',
          start: '2021-01-01T00:00:00.000Z',
          end: '2026-04-01T00:00:00.000Z',
          observations: 64,
        },
        forecastOrigin: '2026-04-01T00:00:00.000Z',
        runtimeSeconds: 0.02,
        verification: {
          '1M': {
            horizon: '1M',
            horizonSteps: 1,
            origins: 28,
            expectedOrigins: 28,
            successfulOrigins: 28,
            failedOrigins: 0,
            coverage: 1,
            metrics: {
              mae: 10.5,
              rmse: 12.4,
              mase: 0.81,
              smape: 0.073,
              directionalAccuracy: 0.64,
              bias: -1.2,
            },
            records: [
              {
                ...createEndOfPeriodVerificationResponse().result.backtest['1M'].records[0],
                actualObservedAt: null,
              },
            ],
            failures: [],
          },
        },
      }
    },
    async writeVerificationRun(artifact) {
      persistedActualObservedAt = artifact.verification['1M']?.records[0]?.actualObservedAt ?? null
    },
  }

  const service = createForecastLibraryService({ bridge, repository, logEvent: () => {} })
  const result = await service.resolveVerificationRequest({
    seriesId: 'wocaes0074',
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
  })

  assert.equal(result.status, 'AVAILABLE')
  assert.equal(result.cacheStatus, 'miss')
  assert.equal(verificationCalls, 1)
  assert.equal(result.verification['1M']?.records[0]?.actualObservedAt, '2025-02-28T00:00:00.000Z')
  assert.equal(persistedActualObservedAt, '2025-02-28T00:00:00.000Z')
})

test('forecast library emits prepared, compute, model-fit, verification, and persistence counters', async () => {
  const events: Array<{ event: string; metrics: Record<string, string | number | boolean | null> }> = []
  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() { return createHistoryResponse() },
      async exportCurrent() { return createCurrentResponse() },
      async exportVerification() { return createVerificationResponse() },
    },
    repository: {
      async readCurrentRun() { return null },
      async writeCurrentRun() {},
      async readVerificationRun() { return null },
      async writeVerificationRun() {},
    },
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) { events.push({ event, metrics: metrics ?? {} }) },
    },
  })

  const current = await service.resolveCurrentForecast('wocaes0280', 'ets')
  const verification = await service.resolveVerification('wocaes0280', 'ets')

  assert.equal(current.status, 'AVAILABLE')
  assert.equal(verification.status, 'AVAILABLE')
  assert.ok(events.some(({ event, metrics }) => event === 'prepared_read' && metrics.kind === 'current' && metrics.hit === false))
  assert.ok(events.some(({ event }) => event === 'current_compute_end'))
  assert.ok(events.some(({ event, metrics }) => event === 'model_fit' && metrics.operation === 'current' && metrics.count === 1))
  assert.ok(events.some(({ event, metrics }) => event === 'verification_compute_end' && metrics.originCount === 28))
  assert.ok(events.some(({ event, metrics }) => event === 'model_fit' && metrics.operation === 'verification' && metrics.count === 28))
  assert.ok(events.some(({ event, metrics }) => event === 'persistence' && metrics.operation === 'current' && metrics.pointWrites === 2))
  assert.ok(events.some(({ event, metrics }) => event === 'persistence' && metrics.operation === 'verification' && metrics.verificationRecordWrites === 1))
})

test('stress telemetry leaves Forecast values and identity unchanged', async () => {
  function createService(emit: (event: string, metrics?: Record<string, string | number | boolean | null>) => void) {
    return createForecastLibraryService({
      bridge: {
        async exportHistory() { return createHistoryResponse() },
        async exportCurrent() { return createCurrentResponse() },
        async exportVerification() { return createVerificationResponse() },
      },
      repository: {
        async readCurrentRun() { return null },
        async writeCurrentRun() {},
        async readVerificationRun() { return null },
        async writeVerificationRun() {},
      },
      logEvent: () => {},
      telemetry: { emit },
    })
  }

  const telemetryEvents: string[] = []
  const withoutTelemetry = await createService(() => {}).resolveCurrentForecast('wocaes0280', 'ets')
  const withTelemetry = await createService((event) => telemetryEvents.push(event)).resolveCurrentForecast('wocaes0280', 'ets')

  assert.deepEqual(withTelemetry, withoutTelemetry)
  assert.ok(telemetryEvents.includes('current_compute_end'))
  assert.ok(telemetryEvents.includes('model_fit'))
  assert.ok(telemetryEvents.includes('persistence'))
})