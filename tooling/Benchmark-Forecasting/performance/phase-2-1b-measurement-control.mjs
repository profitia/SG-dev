export const PHASE_2_1B_MEASUREMENT_CONTROL_REVISION = 2

export const RECOVERY_CLASSIFICATIONS = Object.freeze([
  'VALID_COMPLETED',
  'INVALID_STATE',
  'INVALID_MEASUREMENT',
  'INVALID_INTERRUPTED_BY_HOST_RESTART',
  'INVALID_BURST_RUN',
  'SAFETY_BLOCKED',
  'NOT_STARTED',
  'ABORTED_BY_CONTRACT',
  'EXCLUDED_RUN',
])

const EXPECTED_DATABASE = Object.freeze({
  alias: 'phase-2-1-local-clone-v1',
  host: '127.0.0.1',
  port: 55421,
  applicationDatabase: 'sg_phase_2_1_app',
  marketDataDatabase: 'sg_phase_2_1_market_data',
})

export function resolveCurrentExecutionFamily(target) {
  if (target.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    && target.targetBasis === 'POINT_IN_TIME'
    && target.sourceFrequency === 'DAILY'
    && target.targetCadence === 'DAILY') {
    return 'ROLLING_DAILY_PRODUCTION_OPERATIONS'
  }
  if (target.targetSemantics === 'MONTHLY_AVERAGE'
    && target.targetBasis === 'MONTHLY_AVERAGE') {
    return 'GENERIC_PERIOD_CURRENT'
  }
  if (target.targetSemantics === 'END_OF_PERIOD'
    && target.targetBasis === 'END_OF_PERIOD') {
    return 'GENERIC_PERIOD_CURRENT'
  }
  throw new Error(`No lawful Current execution family for ${target.seriesId}/${target.targetSemantics}.`)
}

export function validateMeasurementPreflight(input) {
  const errors = []
  const database = input.database ?? {}
  for (const [field, expected] of Object.entries(EXPECTED_DATABASE)) {
    if (database[field] !== expected) errors.push(`DATABASE_${field.toUpperCase()}_MISMATCH`)
  }
  if (database.live !== true) errors.push('DATABASE_LIVE_CONNECTIVITY_FAILED')
  if (input.snapshotAvailable !== true) errors.push('SNAPSHOT_UNAVAILABLE')
  if (input.stateValidatorAvailable !== true) errors.push('STATE_VALIDATOR_UNAVAILABLE')
  if (input.stateValid !== true) errors.push('SCENARIO_STATE_INVALID')
  if (input.telemetryGuardValid !== true) errors.push('TELEMETRY_GUARD_INVALID')
  if (input.l2Required && input.l2Available !== true) errors.push('L2_UNAVAILABLE')
  if (input.l3Required && input.l3Available !== true) errors.push('L3_UNAVAILABLE')
  return { passed: errors.length === 0, errors }
}

export function evaluatePostRunGate(input) {
  if ((input.schemaErrors?.length ?? 0) > 0) {
    return { valid: false, classification: 'INVALID_MEASUREMENT', continueEscalation: false, reason: 'SCHEMA_INVALID' }
  }
  if (input.stateValid !== true) {
    return { valid: false, classification: 'INVALID_STATE', continueEscalation: false, reason: 'STATE_INVALID' }
  }
  if (input.correctnessPassed !== true) {
    return { valid: false, classification: 'INVALID_STATE', continueEscalation: false, reason: 'CORRECTNESS_FAILED' }
  }
  if (input.releaseSpreadValid !== true) {
    return { valid: false, classification: 'INVALID_BURST_RUN', continueEscalation: false, reason: 'RELEASE_SPREAD_INVALID' }
  }
  if (input.requiredTelemetryPresent !== true) {
    return { valid: false, classification: 'INVALID_MEASUREMENT', continueEscalation: false, reason: 'REQUIRED_TELEMETRY_MISSING' }
  }
  if (input.safetyReason) {
    return { valid: true, classification: 'VALID_COMPLETED', continueEscalation: false, reason: input.safetyReason }
  }
  return { valid: true, classification: 'VALID_COMPLETED', continueEscalation: true, reason: null }
}

export function filterValidAggregateResults(entries) {
  return entries.filter(({ classification }) => classification === 'VALID_COMPLETED')
}

export function resumeActionFor(classification) {
  if (classification === 'VALID_COMPLETED') return 'PRESERVE'
  if (classification === 'SAFETY_BLOCKED') return 'PRESERVE_SAFETY_BLOCK'
  if (classification === 'NOT_STARTED') return 'EXECUTE'
  if (['INVALID_STATE', 'INVALID_MEASUREMENT', 'INVALID_INTERRUPTED_BY_HOST_RESTART', 'INVALID_BURST_RUN', 'ABORTED_BY_CONTRACT', 'EXCLUDED_RUN'].includes(classification)) {
    return 'RERUN'
  }
  throw new Error(`Unsupported recovery classification: ${classification}`)
}

export function buildResumePlan(plannedCells, previousByCell) {
  return plannedCells.map((cell) => {
    const key = `${cell.scenarioId}/${cell.modelId}/${cell.concurrency}/r${cell.repetition}`
    const previous = previousByCell.get(key)
    const previousClassification = previous?.classification ?? 'NOT_STARTED'
    return {
      ...cell,
      previousRunId: previous?.stressRunId ?? null,
      previousClassification,
      action: resumeActionFor(previousClassification),
      reason: previous?.reason ?? (previousClassification === 'NOT_STARTED'
        ? 'No prior run exists for this planned cell.'
        : `Recovery classification is ${previousClassification}.`),
    }
  })
}

export function compareExactIdentity(expected, actual) {
  const fields = ['seriesId', 'targetBasis', 'targetSemantics', 'methodId', 'methodVersion', 'modelId', 'frequencyIdentity', 'historyFingerprint', 'forecastOrigin']
  const comparisons = fields.map((field) => ({ field, expected: expected[field] ?? null, actual: actual[field] ?? null, matches: expected[field] === actual[field] }))
  return { matches: comparisons.every(({ matches }) => matches), comparisons }
}