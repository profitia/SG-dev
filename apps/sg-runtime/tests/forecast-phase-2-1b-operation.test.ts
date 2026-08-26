import assert from 'node:assert/strict'
import test from 'node:test'

import { runForecastStressOperationWave } from '@/scripts/run-forecast-phase-2-1b-operation'
import { CurrentForecastSingleFlight } from '@/lib/forecast/current-single-flight'
import { getActiveCurrentForecastSingleFlightEntryCount } from '@/lib/forecast/service'
import type { ForecastStressContext } from '@/lib/forecast/stress-telemetry'

function preparedDailyCurrentOwnership(seriesId: string, modelId: string) {
  const identity = {
    seriesId,
    targetBasis: 'POINT_IN_TIME' as const,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    methodVersion: 'v1',
    modelId,
    inputSource: 'DYNAMIC_MARKET_DATA_STORE',
    historyFingerprint: `fingerprint-${seriesId}`,
    sourceFrequency: 'DAILY' as const,
    targetCadence: 'DAILY' as const,
    frequencyIdentity: 'FORECAST_CADENCE_V1|source=DAILY|target=DAILY',
    forecastOrigin: '2026-07-31',
    horizonConfigurationId: 'daily-horizon-configuration',
  }
  return {
    history: {
      seriesId,
      displayName: seriesId,
      description: null,
      frequency: 'DAILY',
      source: 'test',
      points: [{ date: '2026-07-31', value: 100 }],
    },
    identity,
    logicalArtifactKey: ['CURRENT_LOGICAL_ARTIFACT_KEY_V1', ...Object.values(identity)].join('|'),
  }
}

function request(index: number) {
  return {
    stressRunId: 'phase-2-1b-operation-test',
    scenarioId: 'P03',
    virtualUserId: `vu-${index}`,
    requestId: `request-${index}`,
    forecastIdentity: 'wocaes0280|MONTHLY_AVERAGE|ets',
    logicalArtifactKey: 'wocaes0280|MONTHLY_AVERAGE|MONTHLY|MONTHLY|ets|v1|fingerprint',
    operation: 'CURRENT' as const,
    seriesId: 'wocaes0280',
    modelId: 'ets' as const,
    targetBasis: 'MONTHLY_AVERAGE' as const,
  }
}

test('operation wave preserves telemetry context and individual failures', async () => {
  const contexts: ForecastStressContext[] = []
  let resourceSamples = 0
  const results = await runForecastStressOperationWave(
    [request(1), request(2), request(3)],
    {
      telemetry: {
        run: (context, operation) => {
          contexts.push(context)
          return operation()
        },
        sampleResources: () => {
          resourceSamples += 1
          return null
        },
      },
      resolveCurrent: async (input) => {
        if (contexts.at(-1)?.virtualUserId === 'vu-2') throw new Error('controlled failure')
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: 'MONTHLY_AVERAGE',
          methodId: 'MONTHLY_AVERAGE',
          reason: 'test',
        }
      },
    },
  )

  assert.equal(results.length, 3)
  assert.equal(results.filter(({ ok }) => ok).length, 2)
  assert.equal(results.find(({ requestId }) => requestId === 'request-2')?.ok, false)
  assert.deepEqual(contexts.map(({ requestId }) => requestId).sort(), ['request-1', 'request-2', 'request-3'])
  assert.equal(resourceSamples, 5)
  assert.ok(results.every(({ endedMonotonicMs, startedMonotonicMs }) => endedMonotonicMs >= startedMonotonicMs))
})

test('operation wave routes Daily Current through Rolling Daily and period targets through Generic Period', async () => {
  const calls: string[] = []
  const events: string[] = []
  const requests = [
    {
      ...request(1), scenarioId: 'P04', seriesId: 'wocaes0074',
      targetBasis: 'POINT_IN_TIME' as const, targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
      sourceFrequency: 'DAILY' as const, targetCadence: 'DAILY' as const,
    },
    {
      ...request(2), scenarioId: 'P04', targetSemantics: 'MONTHLY_AVERAGE' as const,
      sourceFrequency: 'MONTHLY' as const, targetCadence: 'MONTHLY' as const,
    },
    {
      ...request(3), scenarioId: 'P04', seriesId: 'usnaac0169',
      targetBasis: 'END_OF_PERIOD' as const, targetSemantics: 'END_OF_PERIOD' as const,
      sourceFrequency: 'QUARTERLY' as const, targetCadence: 'QUARTERLY' as const,
    },
  ]

  const results = await runForecastStressOperationWave(requests, {
    telemetry: {
      run: (_context, operation) => operation(),
      sampleResources: () => null,
      emit: (event) => events.push(event),
    },
    prepareRollingDailyCurrent: async (input) => preparedDailyCurrentOwnership(input.seriesId, input.modelId),
    resolveRollingDailyCurrent: async (input) => {
      calls.push(`rolling:${input.seriesId}:${input.modelId}`)
      return { status: 'SUCCEEDED', executionFamily: 'ROLLING_DAILY_PRODUCTION_OPERATIONS' }
    },
    resolveCurrent: async (input) => {
      calls.push(`period:${input.seriesId}:${input.targetBasis}`)
      const targetSemantics = input.targetBasis === 'END_OF_PERIOD' ? 'END_OF_PERIOD' : 'MONTHLY_AVERAGE'
      return {
        status: 'NOT_AVAILABLE',
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis: input.targetBasis,
        targetSemantics,
        methodId: targetSemantics,
        reason: 'routing proof',
      }
    },
  })

  assert.ok(results.every(({ ok }) => ok))
  assert.deepEqual(calls.sort(), [
    'period:usnaac0169:END_OF_PERIOD',
    'period:wocaes0280:MONTHLY_AVERAGE',
    'rolling:wocaes0074:ets',
  ])
  assert.deepEqual(events, [
    'single_flight_lookup',
    'single_flight_owner_acquired',
    'current_compute_start',
    'current_compute_end',
    'model_fit',
    'persistence',
    'single_flight_owner_completed',
    'single_flight_entry_released',
  ])
})

test('P04 repair routes ten callers across three exact keys to three owners and three computes', async () => {
  const periodSingleFlight = new CurrentForecastSingleFlight<Awaited<ReturnType<NonNullable<NonNullable<Parameters<typeof runForecastStressOperationWave>[1]>['resolveCurrent']>>>>()
  let physicalComputeCount = 0
  let dailyComputeCount = 0
  let dailyOwnerCount = 0
  let periodComputeCount = 0
  let periodOwnerCount = 0
  let releaseComputes: (() => void) | undefined
  const computeGate = new Promise<void>((resolve) => {
    releaseComputes = resolve
  })
  const recordCompute = () => {
    physicalComputeCount += 1
    if (physicalComputeCount === 3) releaseComputes?.()
  }
  const targets = [
    {
      seriesId: 'wocaes0074', targetBasis: 'POINT_IN_TIME' as const,
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' as const,
      sourceFrequency: 'DAILY' as const, targetCadence: 'DAILY' as const,
    },
    {
      seriesId: 'wocaes0280', targetBasis: 'MONTHLY_AVERAGE' as const,
      targetSemantics: 'MONTHLY_AVERAGE' as const,
      sourceFrequency: 'MONTHLY' as const, targetCadence: 'MONTHLY' as const,
    },
    {
      seriesId: 'usnaac0169', targetBasis: 'END_OF_PERIOD' as const,
      targetSemantics: 'END_OF_PERIOD' as const,
      sourceFrequency: 'QUARTERLY' as const, targetCadence: 'QUARTERLY' as const,
    },
  ]
  const requests = Array.from({ length: 10 }, (_, index) => ({
    ...request(index + 1),
    ...targets[index % targets.length],
    scenarioId: 'P04',
  }))

  const results = await runForecastStressOperationWave(requests, {
    telemetry: {
      run: (_context, operation) => operation(),
      sampleResources: () => null,
      emit: (event) => {
        if (event === 'single_flight_owner_acquired') dailyOwnerCount += 1
      },
    },
    prepareRollingDailyCurrent: async (input) => preparedDailyCurrentOwnership(input.seriesId, input.modelId),
    resolveRollingDailyCurrent: async () => {
      dailyComputeCount += 1
      recordCompute()
      await computeGate
      return { status: 'SUCCEEDED', refreshedSnapshotCount: 1 }
    },
    resolveCurrent: async (input) => periodSingleFlight.run({
      logicalArtifactKey: `${input.seriesId}|${input.targetBasis}|ets`,
      requestId: `period-request-${input.seriesId}-${physicalComputeCount}`,
      emit(event) {
        if (event === 'single_flight_owner_acquired') periodOwnerCount += 1
      },
      operation: async () => {
        periodComputeCount += 1
        recordCompute()
        await computeGate
        const targetSemantics = input.targetBasis === 'END_OF_PERIOD' ? 'END_OF_PERIOD' : 'MONTHLY_AVERAGE'
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics,
          methodId: targetSemantics,
          reason: 'controlled P04 repair proof',
        }
      },
    }),
  })

  assert.equal(results.length, 10)
  assert.ok(results.every(({ ok }) => ok))
  assert.equal(dailyOwnerCount, 1)
  assert.equal(dailyComputeCount, 1)
  assert.equal(periodOwnerCount, 2)
  assert.equal(periodComputeCount, 2)
  assert.equal(physicalComputeCount, 3)
  assert.equal(getActiveCurrentForecastSingleFlightEntryCount(), 0)
  assert.equal(periodSingleFlight.activeEntryCount, 0)
})