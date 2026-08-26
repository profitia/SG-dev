import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createForecastStressTelemetry,
  resolveForecastStressTelemetryEnabled,
  summarizeDuplicateCompute,
  type ForecastStressContext,
  type ForecastStressEvent,
} from '../lib/forecast/stress-telemetry'

const isolatedEnv = {
  APP_ENV: 'development',
  FORECAST_STRESS_TELEMETRY_ENABLED: 'true',
  FORECAST_STRESS_ENVIRONMENT_ID: 'phase-2-1-local-isolated-v1',
  FORECAST_STRESS_DATABASE_CLONE_ALIAS: 'phase-2-1-local-clone-v1',
  SG_RUNTIME_DATABASE_URL: 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_app',
  MARKET_DATA_DATABASE_URL: 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data',
}

const context: ForecastStressContext = {
  stressRunId: 'readiness-probe-1',
  scenarioId: 'READINESS_TELEMETRY_PROBE',
  virtualUserId: 'vu-1',
  requestId: 'request-1',
  forecastIdentity: 'wocaes0280|MONTHLY_AVERAGE|ets',
  logicalArtifactKey: 'wocaes0280|MONTHLY_AVERAGE|ets|fixture',
}

test('stress telemetry defaults off and emits no events', () => {
  const events: ForecastStressEvent[] = []
  const telemetry = createForecastStressTelemetry({ env: {}, sink: (event) => events.push(event) })

  const result = telemetry.run(context, () => {
    telemetry.emit('forecast_compute', { count: 1 })
    return 'unchanged'
  })

  assert.equal(telemetry.enabled, false)
  assert.equal(result, 'unchanged')
  assert.deepEqual(events, [])
})

test('stress telemetry rejects production and non-isolated database targets', () => {
  assert.throws(
    () => resolveForecastStressTelemetryEnabled({ ...isolatedEnv, APP_ENV: 'production' }),
    /forbidden in production/,
  )
  assert.throws(
    () => resolveForecastStressTelemetryEnabled({
      ...isolatedEnv,
      MARKET_DATA_DATABASE_URL: 'postgresql://user:secret@example.neon.tech/neondb',
    }),
    /isolated local market-data database/,
  )
})

test('stress telemetry denies provider access unless the exact series is explicitly allow-listed', () => {
  const denied = createForecastStressTelemetry({ env: isolatedEnv })
  assert.throws(() => denied.assertProviderAllowed('wocaes0074'), /Provider access is denied/)
  denied.close()

  const allowed = createForecastStressTelemetry({
    env: {
      ...isolatedEnv,
      FORECAST_STRESS_PROVIDER_ENABLED: 'true',
      FORECAST_STRESS_PROVIDER_ALLOWLIST: 'wocaes0074',
    },
  })
  assert.doesNotThrow(() => allowed.assertProviderAllowed('wocaes0074'))
  assert.throws(() => allowed.assertProviderAllowed('wocaes0280'), /Provider access is denied/)
  allowed.close()
})

test('stress telemetry emits correlated structured events and resource samples', async () => {
  const events: ForecastStressEvent[] = []
  const telemetry = createForecastStressTelemetry({ env: isolatedEnv, sink: (event) => events.push(event) })

  await telemetry.run(context, async () => {
    telemetry.emit('prepared_read', { hit: true, durationMs: 1 })
    await Promise.resolve()
    telemetry.emit('model_fit', { modelId: 'ets', count: 1 })
    assert.ok(telemetry.sampleResources())
  })
  telemetry.close()

  assert.equal(telemetry.enabled, true)
  assert.deepEqual(events.map(({ event }) => event), ['prepared_read', 'model_fit', 'resource_sample'])
  assert.ok(events.every((event) => event.stressRunId === context.stressRunId))
  assert.ok(events.every((event) => event.logicalArtifactKey === context.logicalArtifactKey))
  assert.equal(typeof events[2]?.metrics.rssBytes, 'number')
  assert.equal(typeof events[2]?.metrics.eventLoopUtilization, 'number')
})

test('duplicate compute summary derives one duplicate from two starts for one logical key', () => {
  const events = [1, 2].map((sequence): ForecastStressEvent => ({
    ...context,
    requestId: `request-${sequence}`,
    event: 'current_compute_start',
    timestamp: `2026-01-01T00:00:0${sequence}.000Z`,
    metrics: { count: 1 },
  }))

  assert.deepEqual(summarizeDuplicateCompute(events), [{
    stressRunId: context.stressRunId,
    logicalArtifactKey: context.logicalArtifactKey,
    expectedLogicalComputeCount: 1,
    actualComputeCount: 2,
    duplicateComputeCount: 1,
    duplicateComputeRatio: 1,
  }])
})