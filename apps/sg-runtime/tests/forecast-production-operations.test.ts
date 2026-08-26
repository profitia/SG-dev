import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveForecastCapabilities } from '../lib/forecast/capability-resolver'
import { createForecastProductionOperationsService } from '../lib/forecast/production-operations'

function capabilityResolution(seriesId: string) {
  return {
    status: 'AVAILABLE' as const,
    reason: null,
    sourceMetadata: {
      seriesId,
      providerCode: 'MACROBOND',
      source: 'controlled',
      sourceFrequency: 'DAILY' as const,
      rawFrequency: 'daily',
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
      sourceFrequency: 'DAILY',
      sourceObservationCount: 120,
      preparedObservationCounts: {
        END_OF_PERIOD: 48,
        MONTHLY_AVERAGE: 48,
        ROLLING_DAILY_POINT_IN_TIME: 120,
      },
      provenance: [],
      preparedVariants: [],
    }),
  }
}

function available(targetBasis: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE', modelId: string, cacheStatus: 'hit' | 'miss') {
  return {
    status: 'AVAILABLE',
    seriesId: 'generic.operations.series',
    modelId,
    targetBasis,
    targetSemantics: targetBasis,
    methodId: targetBasis,
    userFacingModel: true,
    displayName: 'Generic series',
    description: null,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: { kind: 'DYNAMIC_MARKET_DATA_STORE', runId: null },
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: null,
      sourceSeriesId: 'generic.operations.series',
      sourceFrequency: 'DAILY',
      historyFingerprint: `${targetBasis}-fingerprint`,
      preparation: null,
    },
    historyFingerprint: `${targetBasis}-fingerprint`,
    history: { frequency: 'MONTHLY', start: '2021-01-01', end: '2024-12-01', observations: 48 },
    forecastOrigin: '2024-12-01',
    runtimeSeconds: 1,
    cacheStatus,
  }
}

test('generic operations prepare all selected monthly current variants before optional historical evidence', async () => {
  const calls: string[] = []
  let capabilityCalls = 0
  const service = createForecastProductionOperationsService({
    async resolveCapabilities(seriesId) {
      capabilityCalls += 1
      return capabilityResolution(seriesId)
    },
    async prepareMonthlyCurrent(input) {
      calls.push(`current:${input.targetBasis}:${input.modelId}`)
      return { ...available(input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE', input.modelId, 'miss'), alignment: { status: 'ALIGNED', trainingFrequency: 'MONTHLY', lastHistoricalPeriod: null, forecastOrigin: null, firstForecastTarget: null }, currentForecast: {} } as never
    },
    async prepareMonthlyHistorical(input) {
      calls.push(`historical:${input.targetBasis}:${input.modelId}`)
      return { ...available(input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE', input.modelId, 'miss'), verification: {} } as never
    },
    async runRollingDaily() {
      throw new Error('Rolling Daily should not run for monthly-only request.')
    },
  })

  const result = await service.run({
    seriesId: 'generic.operations.series',
    targetSemantics: ['END_OF_PERIOD', 'MONTHLY_AVERAGE'],
    modelIds: ['naive', 'arima'],
    prepareHistorical: true,
  })

  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(capabilityCalls, 2)
  assert.deepEqual(calls, [
    'current:END_OF_PERIOD:naive',
    'current:END_OF_PERIOD:arima',
    'current:MONTHLY_AVERAGE:naive',
    'current:MONTHLY_AVERAGE:arima',
    'historical:END_OF_PERIOD:naive',
    'historical:END_OF_PERIOD:arima',
    'historical:MONTHLY_AVERAGE:naive',
    'historical:MONTHLY_AVERAGE:arima',
  ])
  assert.ok(result.results.every((item) => item.current === 'READY'))
  assert.ok(result.results.every((item) => item.historical === 'READY'))
})

test('generic operations delegate Rolling Daily to its existing owner and keep historical opt-in', async () => {
  let rollingCalls = 0
  const service = createForecastProductionOperationsService({
    async resolveCapabilities(seriesId) {
      return capabilityResolution(seriesId)
    },
    async prepareMonthlyCurrent() {
      throw new Error('Monthly preparation should not run.')
    },
    async prepareMonthlyHistorical() {
      throw new Error('Historical preparation should not run.')
    },
    async runRollingDaily(request) {
      rollingCalls += 1
      return {
        status: 'NO_OP',
        seriesId: request.seriesId,
        results: [{
          status: 'NO_OP',
          modelId: 'ets',
          maintenance: { status: 'NO_OP', sourceHistoryFingerprint: 'fingerprint' } as never,
          snapshot: { status: 'SKIPPED_ALREADY_FRESH', reason: null, parityStatus: null },
          error: null,
        }],
        refreshedSnapshotCount: 0,
        recoveredSnapshotCount: 0,
        noOpModelCount: 1,
        failedModelCount: 0,
      }
    },
  })

  const result = await service.run({
    seriesId: 'generic.operations.series',
    targetSemantics: ['ROLLING_DAILY_POINT_IN_TIME'],
    modelIds: ['ets'],
    prepareHistorical: false,
  })

  assert.equal(rollingCalls, 1)
  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(result.results[0]?.current, 'REUSED')
  assert.equal(result.results[0]?.historical, 'NOT_REQUESTED')
})

test('generic operations fail closed when current compute is not persisted', async () => {
  const service = createForecastProductionOperationsService({
    async resolveCapabilities(seriesId) {
      return capabilityResolution(seriesId)
    },
    async prepareMonthlyCurrent(input) {
      return { ...available(input.targetBasis as 'END_OF_PERIOD', input.modelId, 'miss'), cacheStatus: 'persist-failed', alignment: { status: 'ALIGNED', trainingFrequency: 'MONTHLY', lastHistoricalPeriod: null, forecastOrigin: null, firstForecastTarget: null }, currentForecast: {} } as never
    },
    async prepareMonthlyHistorical() {
      throw new Error('Historical preparation must not follow failed persistence.')
    },
    async runRollingDaily() {
      throw new Error('unused')
    },
  })

  const result = await service.run({
    seriesId: 'generic.operations.series',
    targetSemantics: ['END_OF_PERIOD'],
    modelIds: ['arima'],
    prepareHistorical: true,
  })

  assert.equal(result.status, 'FAILED')
  assert.equal(result.results[0]?.current, 'FAILED')
  assert.equal(result.results[0]?.historical, 'FAILED')
})

test('generic operations execute admitted Quarterly variants with explicit native cadence', async () => {
  const computeCalls: string[] = []
  const service = createForecastProductionOperationsService({
    async resolveCapabilities(seriesId) {
      const base = capabilityResolution(seriesId)
      return {
        ...base,
        sourceMetadata: { ...base.sourceMetadata, sourceFrequency: 'QUARTERLY' as const },
        capabilities: resolveForecastCapabilities({
          seriesId,
          sourceFrequency: 'QUARTERLY',
          sourceObservationCount: 40,
          preparedObservationCounts: {},
          provenance: [
            {
              sourceFrequency: 'QUARTERLY',
              targetSemantics: 'END_OF_PERIOD',
              preparation: { method: 'CONTROLLED_EOP', version: 'test-v1', provenanceStatus: 'PROVEN' },
              sourceLineage: 'controlled-quarterly-lineage',
              closedPeriod: true,
              levelAtTimestamp: true,
              exactSourceObservedAt: true,
              aggregation: null,
              underlyingObservationFrequency: null,
              missingObservationPolicy: null,
              syntheticObservations: null,
            },
            {
              sourceFrequency: 'QUARTERLY',
              targetSemantics: 'MONTHLY_AVERAGE',
              preparation: { method: 'CONTROLLED_AVERAGE', version: 'test-v1', provenanceStatus: 'PROVEN' },
              sourceLineage: 'controlled-quarterly-lineage',
              closedPeriod: true,
              levelAtTimestamp: null,
              exactSourceObservedAt: null,
              aggregation: 'ARITHMETIC_MEAN',
              underlyingObservationFrequency: 'QUARTERLY',
              missingObservationPolicy: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
              syntheticObservations: false,
            },
          ],
          preparedVariants: [],
        }),
      }
    },
    async prepareMonthlyCurrent(input) {
      computeCalls.push(`current:${input.targetBasis}:${input.modelId}:${input.sourceFrequency}:${input.targetCadence}`)
      return {
        ...available(input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE', input.modelId, 'miss'),
        alignment: { status: 'ALIGNED' },
        currentForecast: {},
      } as never
    },
    async prepareMonthlyHistorical(input) {
      computeCalls.push(`historical:${input.targetBasis}:${input.modelId}:${input.sourceFrequency}:${input.targetCadence}`)
      return {
        ...available(input.targetBasis as 'END_OF_PERIOD' | 'MONTHLY_AVERAGE', input.modelId, 'miss'),
        verification: {},
      } as never
    },
    async runRollingDaily() {
      throw new Error('Rolling Daily is not lawful for Quarterly source.')
    },
  })

  const result = await service.run({
    seriesId: 'generic.quarterly.series',
    targetSemantics: ['END_OF_PERIOD', 'MONTHLY_AVERAGE'],
    modelIds: ['naive', 'damped_holt', 'ets', 'arima'],
    prepareHistorical: true,
  })

  assert.equal(result.status, 'SUCCEEDED')
  assert.equal(computeCalls.length, 16)
  assert.ok(computeCalls.every((call) => call.endsWith(':QUARTERLY:QUARTERLY')))
  assert.ok(result.results.every((item) => item.current === 'READY' && item.historical === 'READY'))
})