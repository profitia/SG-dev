import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  createForecastStressTelemetry,
  summarizeDuplicateCompute,
  type ForecastStressContext,
  type ForecastStressEvent,
} from '../lib/forecast/stress-telemetry'

const REQUIRED_EVENTS = [
  'prepared_read',
  'current_compute_end',
  'model_fit',
  'verification_compute_end',
  'provider_call',
  'persistence',
  'database_read',
  'resource_sample',
] as const

const context: ForecastStressContext = {
  stressRunId: 'phase-2-1a-readiness-probe-v1',
  scenarioId: 'READINESS_TELEMETRY_PROBE',
  virtualUserId: 'vu-readiness-1',
  requestId: 'request-readiness-1',
  forecastIdentity: 'wocaes0280|MONTHLY_AVERAGE|ets',
  logicalArtifactKey: 'wocaes0280|MONTHLY_AVERAGE|MONTHLY|MONTHLY|ets|benchmark-forecasting-mvp-phase2-v1|readiness',
}

async function main() {
  const offEvents: ForecastStressEvent[] = []
  const offTelemetry = createForecastStressTelemetry({ env: {}, sink: (event) => offEvents.push(event) })
  const unchangedPayload = { status: 'AVAILABLE', value: 42, identity: context.forecastIdentity }
  const offResult = offTelemetry.run(context, () => {
    offTelemetry.emit('current_compute_end', { count: 1 })
    return unchangedPayload
  })
  offTelemetry.close()

  const events: ForecastStressEvent[] = []
  const telemetry = createForecastStressTelemetry({
    env: {
      APP_ENV: process.env.APP_ENV,
      FORECAST_STRESS_TELEMETRY_ENABLED: process.env.FORECAST_STRESS_TELEMETRY_ENABLED,
      FORECAST_STRESS_ENVIRONMENT_ID: process.env.FORECAST_STRESS_ENVIRONMENT_ID,
      FORECAST_STRESS_DATABASE_CLONE_ALIAS: process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS,
      FORECAST_STRESS_PROVIDER_ENABLED: process.env.FORECAST_STRESS_PROVIDER_ENABLED,
      FORECAST_STRESS_PROVIDER_ALLOWLIST: process.env.FORECAST_STRESS_PROVIDER_ALLOWLIST,
      SG_RUNTIME_DATABASE_URL: process.env.SG_RUNTIME_DATABASE_URL,
      MARKET_DATA_DATABASE_URL: process.env.MARKET_DATA_DATABASE_URL,
    },
    sink: (event) => events.push(event),
  })

  const onResult = await telemetry.run(context, async () => {
    telemetry.emit('prepared_read', { kind: 'current', hit: true, durationMs: 0 })
    telemetry.emit('current_compute_end', { modelId: 'ets', count: 1, durationMs: 0, status: 'AVAILABLE' })
    telemetry.emit('model_fit', { operation: 'current', modelId: 'ets', count: 1, durationMs: 0 })
    telemetry.emit('verification_compute_end', { modelId: 'ets', count: 1, originCount: 1, durationMs: 0, status: 'AVAILABLE' })
    telemetry.emit('provider_call', { provider: 'macrobond', operation: 'history', count: 0, durationMs: 0, failures: 0 })
    telemetry.emit('persistence', { operation: 'current', artifactWrites: 0, pointWrites: 0, verificationRecordWrites: 0, writeFailures: 0 })
    telemetry.emit('database_read', { operation: 'readiness_probe', queryCount: 1, durationMs: 0, failed: false })
    telemetry.sampleResources()
    return unchangedPayload
  })
  telemetry.close()

  assert.equal(offTelemetry.enabled, false)
  assert.equal(offEvents.length, 0)
  assert.equal(telemetry.enabled, true)
  assert.deepEqual(onResult, offResult)
  assert.deepEqual(new Set(events.map(({ event }) => event)), new Set(REQUIRED_EVENTS))
  assert.ok(events.every((event) => event.stressRunId === context.stressRunId))
  assert.ok(events.every((event) => event.requestId === context.requestId))
  const duplicateCompute = summarizeDuplicateCompute([1, 2].map((sequence) => ({
    ...context,
    requestId: `duplicate-probe-${sequence}`,
    event: 'current_compute_start',
    timestamp: new Date().toISOString(),
    metrics: { count: 1 },
  })))
  assert.equal(duplicateCompute[0]?.expectedLogicalComputeCount, 1)
  assert.equal(duplicateCompute[0]?.actualComputeCount, 2)
  assert.equal(duplicateCompute[0]?.duplicateComputeCount, 1)

  const evidence = {
    task: 'FORECAST_PHASE_2_1A_ENVIRONMENT_INSTRUMENTATION_READINESS',
    contractVersion: 1,
    classification: 'READINESS_PROBE_NOT_PERFORMANCE_EVIDENCE',
    generatedAt: new Date().toISOString(),
    defaultOff: { passed: true, emittedEvents: offEvents.length },
    onProof: { passed: true, eventCount: events.length, eventTypes: events.map(({ event }) => event) },
    behaviorNeutral: { passed: true, outputsDeepEqual: true },
    correlation: {
      passed: true,
      fields: ['stressRunId', 'scenarioId', 'virtualUserId', 'requestId', 'forecastIdentity', 'logicalArtifactKey'],
    },
    counters: {
      preparedRead: true,
      currentCompute: true,
      modelFit: true,
      verification: true,
      provider: true,
      persistence: true,
      databaseRead: true,
    },
    duplicateComputeAggregation: {
      passed: true,
      ...duplicateCompute[0],
    },
    resources: { cpu: true, memory: true, eventLoop: true },
    loadRequestsExecuted: 0,
    phase21BStarted: false,
    credentialsIncluded: false,
    sampleEvents: events,
  }
  const outputPath = path.resolve(
    process.cwd(),
    '..',
    '..',
    'tooling',
    'Benchmark-Forecasting',
    'validation',
    'forecast-phase-2-1a-telemetry.json',
  )
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ telemetryReadiness: 'PASS', eventCount: events.length, loadRequestsExecuted: 0 })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})