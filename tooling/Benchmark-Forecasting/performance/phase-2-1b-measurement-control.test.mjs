import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildResumePlan,
  compareExactIdentity,
  evaluatePostRunGate,
  filterValidAggregateResults,
  PHASE_2_1B_MEASUREMENT_CONTROL_REVISION,
  RECOVERY_CLASSIFICATIONS,
  resolveCurrentExecutionFamily,
  validateMeasurementPreflight,
} from './phase-2-1b-measurement-control.mjs'

const validPreflight = {
  database: {
    alias: 'phase-2-1-local-clone-v1', host: '127.0.0.1', port: 55421,
    applicationDatabase: 'sg_phase_2_1_app', marketDataDatabase: 'sg_phase_2_1_market_data', live: true,
  },
  snapshotAvailable: true,
  stateValidatorAvailable: true,
  stateValid: true,
  telemetryGuardValid: true,
  l2Required: true,
  l2Available: true,
  l3Required: true,
  l3Available: true,
}

test('measurement revision and recovery classifications remain explicit', () => {
  assert.equal(PHASE_2_1B_MEASUREMENT_CONTROL_REVISION, 2)
  assert.equal(RECOVERY_CLASSIFICATIONS.length, 9)
})

test('scenario resolver preserves Daily, Monthly, and Quarterly execution families', () => {
  assert.equal(resolveCurrentExecutionFamily({ seriesId: 'wocaes0074', targetBasis: 'POINT_IN_TIME', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', sourceFrequency: 'DAILY', targetCadence: 'DAILY' }), 'ROLLING_DAILY_PRODUCTION_OPERATIONS')
  assert.equal(resolveCurrentExecutionFamily({ seriesId: 'wocaes0280', targetBasis: 'MONTHLY_AVERAGE', targetSemantics: 'MONTHLY_AVERAGE', sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY' }), 'GENERIC_PERIOD_CURRENT')
  assert.equal(resolveCurrentExecutionFamily({ seriesId: 'usnaac0169', targetBasis: 'END_OF_PERIOD', targetSemantics: 'END_OF_PERIOD', sourceFrequency: 'QUARTERLY', targetCadence: 'QUARTERLY' }), 'GENERIC_PERIOD_CURRENT')
})

test('preflight passes only with every live dependency and state prerequisite', () => {
  assert.deepEqual(validateMeasurementPreflight(validPreflight), { passed: true, errors: [] })
  const failures = [
    ['database', { ...validPreflight.database, live: false }, 'DATABASE_LIVE_CONNECTIVITY_FAILED'],
    ['database', { ...validPreflight.database, port: 5432 }, 'DATABASE_PORT_MISMATCH'],
    ['database', { ...validPreflight.database, alias: 'wrong' }, 'DATABASE_ALIAS_MISMATCH'],
    ['database', { ...validPreflight.database, marketDataDatabase: 'wrong' }, 'DATABASE_MARKETDATADATABASE_MISMATCH'],
    ['database', { ...validPreflight.database, host: 'localhost' }, 'DATABASE_HOST_MISMATCH'],
    ['snapshotAvailable', false, 'SNAPSHOT_UNAVAILABLE'],
    ['stateValid', false, 'SCENARIO_STATE_INVALID'],
    ['telemetryGuardValid', false, 'TELEMETRY_GUARD_INVALID'],
    ['l2Available', false, 'L2_UNAVAILABLE'],
    ['l3Available', false, 'L3_UNAVAILABLE'],
  ]
  for (const [field, value, error] of failures) {
    const input = { ...validPreflight, [field]: value }
    assert.equal(validateMeasurementPreflight(input).passed, false)
    assert.ok(validateMeasurementPreflight(input).errors.includes(error))
  }
})

test('post-run gate invalidates correctness failure and stops escalation', () => {
  const base = { schemaErrors: [], stateValid: true, correctnessPassed: true, releaseSpreadValid: true, requiredTelemetryPresent: true, safetyReason: null }
  assert.deepEqual(evaluatePostRunGate(base), { valid: true, classification: 'VALID_COMPLETED', continueEscalation: true, reason: null })
  assert.deepEqual(evaluatePostRunGate({ ...base, correctnessPassed: false }), { valid: false, classification: 'INVALID_STATE', continueEscalation: false, reason: 'CORRECTNESS_FAILED' })
})

test('aggregate filtering excludes every invalid and blocked classification', () => {
  const entries = RECOVERY_CLASSIFICATIONS.map((classification) => ({ classification }))
  assert.deepEqual(filterValidAggregateResults(entries), [{ classification: 'VALID_COMPLETED' }])
})

test('resume planner preserves reusable evidence and schedules all other cells deterministically', () => {
  const planned = RECOVERY_CLASSIFICATIONS.map((classification, index) => ({ scenarioId: 'P01', modelId: 'ets', concurrency: 10, repetition: index + 1 }))
  const previous = new Map(planned.map((cell, index) => [`P01/ets/10/r${cell.repetition}`, { classification: RECOVERY_CLASSIFICATIONS[index], stressRunId: `run-${index}` }]))
  const actions = buildResumePlan(planned, previous).map(({ action }) => action)
  assert.deepEqual(actions, ['PRESERVE', 'RERUN', 'RERUN', 'RERUN', 'RERUN', 'PRESERVE_SAFETY_BLOCK', 'EXECUTE', 'RERUN', 'RERUN'])
})

test('exact identity comparison reports field-level mismatch without weakening identity', () => {
  const expected = { seriesId: 'wocaes0280', frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY' }
  const actual = { seriesId: 'wocaes0280', frequencyIdentity: 'MONTHLY' }
  const comparison = compareExactIdentity(expected, actual)
  assert.equal(comparison.matches, false)
  assert.deepEqual(comparison.comparisons.filter(({ matches }) => !matches).map(({ field }) => field), ['frequencyIdentity'])
})