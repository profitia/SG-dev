import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const hash = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex')

const gate = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-1-current-single-flight.json')
const migration = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-1-migration-readiness.json')
const before = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-before-evidence.json')
const regression = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-1/regression.json')
const prepared = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-1/prepared-search-regressions.json')

const expectedHeadings = [
  'Executive Summary', 'Objective', 'Accepted Phase State', 'Frozen Experiment Contract', 'Scope Boundary',
  'Experiment Hypothesis', 'Three Evaluation Gates', 'Immutable BEFORE Evidence', 'Current Logical Artifact Key',
  'Key Serialization', 'Key Resolution Boundary', 'Current-vs-Verification Isolation', 'Runtime Ownership Location',
  'Registry Architecture', 'Registry Is Not a Cache', 'Owner Role', 'Waiter Role', 'Prepared Reader Role',
  'Daily Ownership Preservation', 'Period Ownership Preservation', 'Prepared-First Flow', 'MISS-to-Ownership Flow',
  'Owner Success Semantics', 'Owner Failure Semantics', 'Failure Retry Semantics', 'Waiter Cancellation Semantics',
  'Owner Disconnect Semantics', 'Timeout Carry-Forward', 'Late Arrival Semantics', 'Release Race',
  'Fingerprint Isolation', 'Origin Isolation', 'Horizon Isolation', 'Model Isolation', 'Semantic Isolation',
  'Cadence Isolation', 'Telemetry Implementation', 'Registry Cleanup Proof', 'Deterministic Ownership Tests',
  'Deterministic Failure Tests', 'Two-User Current Ownership Proof', 'P11 BEFORE', 'P11 AFTER',
  'P11 Correctness Equivalence', 'P03 BEFORE', 'P03 AFTER', 'P03 Model Coverage', 'Structural Ownership Result',
  'Duplicate Compute Result', 'Preliminary UX Evidence', 'Preliminary Resource Evidence', 'Prepared-Serving Regression',
  'Search Compute-Free Regression', 'Phase 2.2A Correctness Regression', 'Forecast Functional Regression',
  'Methodology and Scope Guards', 'Cross-Instance Limitation', 'Migration Readiness', 'Recommended Next Decision', 'STOP',
]
const expectedConditions = [
  'Phase 2.1 gate remains PASS.',
  'Phase 2.2A gate remains PASS.',
  'Phase 2.2B-0 gate remains PASS.',
  'Single-Flight Experiment Contract version remains 1.',
  'Stress Test Contract remains version 1.',
  'Measurement Control remains revision 2.',
  'Contract drift equals NO.',
  'Immutable BEFORE evidence remains unchanged.',
  'Hypothesis is IN_PROCESS_EXACT_KEY_SINGLE_FLIGHT.',
  'Hypothesis scope is CURRENT only.',
  'Production architecture is not selected.',
  'Cross-instance duplicate prevention remains NOT_PROVEN.',
  'CURRENT_LOGICAL_ARTIFACT_KEY_V1 is used exactly.',
  'Same exact Current identity produces the same key.',
  'Different model produces a different key.',
  'Different semantic produces a different key.',
  'Different cadence identity produces a different key.',
  'Different history fingerprint produces a different key.',
  'Different forecast origin produces a different key.',
  'Different horizon configuration produces a different key.',
  'Current and Verification namespaces cannot collide.',
  'Missing required identity fails closed.',
  'Registry stores only in-flight work.',
  'Completed entries are not retained.',
  'Failed entries are not retained.',
  'Global Forecast serialization is not introduced.',
  'Exact same-key OWNER count is one.',
  'Exact same-key waiter joining is implemented.',
  'WAITER does not execute Current compute.',
  'Prepared reader remains compute-free.',
  'Owner success returns canonical result.',
  'Waiters receive canonical equivalent result.',
  'Owner failure propagates lawfully.',
  'Owner failure releases the entry.',
  'Failed key does not remain poisoned.',
  'Retry after failure can acquire a new owner.',
  'Waiter cancellation semantics satisfy the frozen contract or are lawfully classified if not directly observable.',
  'Owner disconnect does not introduce a new cancellation architecture.',
  'No new owner-compute timeout is introduced.',
  'No new waiter timeout is introduced.',
  'Existing 20000 ms HTTP timeout is not tuned.',
  'Late-arrival behavior satisfies the frozen contract.',
  'Release race is observable.',
  'Active entries return to zero after deterministic settlement.',
  'Single-flight telemetry events are implemented or exact repository-native equivalents exist.',
  'Owner/waiter correlation is observable.',
  'Active entry count is observable.',
  'Telemetry does not change Forecast behavior.',
  'Deterministic same-key test passes.',
  'Deterministic different-key/isolation tests pass.',
  'Deterministic owner-failure test passes.',
  'Deterministic retry-after-failure test passes.',
  'Deterministic cleanup/leak test passes.',
  'Small first live ownership proof passes.',
  'First live proof has one exact logical key.',
  'First live proof has one owner.',
  'First live proof has zero duplicate computes.',
  'First live proof returns all canonical responses.',
  'Active entries after live proof equal zero.',
  'Frozen P11 Phase 2.2B-1 experiment passes correctness.',
  'Frozen P11 experiment passes structural ownership.',
  'P11 subsequent prepared read remains compute-free.',
  'Frozen P03 Phase 2.2B-1 rows pass correctness.',
  'Frozen P03 rows pass structural ownership.',
  'P03 duplicate Current compute count equals zero for valid exact-key overlap.',
  'P03 model/key isolation remains correct.',
  'Prepared-serving regressions pass.',
  'Search remains Forecast-compute-free.',
  'Phase 2.2A correctness regressions pass.',
  'Full applicable functional regressions pass.',
  'Migration Readiness Delta is complete.',
  'Phase 2.2B-2 is not started.',
]

const report = fs.readFileSync(path.join(root, 'tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2B_1_CURRENT_FORECAST_SINGLE_FLIGHT_EXPERIMENT.md'), 'utf8')
const headings = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
assert.equal(headings.length, 60)
assert.deepEqual(headings.map(([, , title]) => title), expectedHeadings)
headings.forEach(([, number], index) => assert.equal(Number(number), index + 1))
assert.equal(report.trimEnd().endsWith('STOP - PHASE 2.2B-1 CURRENT FORECAST SINGLE-FLIGHT EXPERIMENT COMPLETE. PHASE 2.2B-2 NOT AUTHORIZED.'), true)

assert.equal(gate.phase22b1Gate, 'PASS')
assert.equal(gate.phase22b1Complete, true)
assert.deepEqual(gate.preconditions, { phase21Gate: 'PASS', phase22aGate: 'PASS', phase22b0Gate: 'PASS' })
assert.deepEqual(gate.contracts, {
  singleFlightExperimentContractVersion: 1,
  stressTestContractVersion: 1,
  measurementControlRevision: 2,
  contractDrift: false,
  immutableBeforeEvidence: 'PASS',
})
assert.equal(gate.implementation.hypothesis, 'IN_PROCESS_EXACT_KEY_SINGLE_FLIGHT')
assert.equal(gate.implementation.scope, 'CURRENT')
assert.equal(gate.implementation.productionArchitectureSelected, false)
assert.equal(gate.implementation.crossInstanceDuplicatePrevention, 'NOT_PROVEN')
assert.equal(gate.implementation.logicalKey, 'CURRENT_LOGICAL_ARTIFACT_KEY_V1')
assert.equal(gate.implementation.registry.contents, 'ACTIVE_PROMISES_ONLY')
assert.equal(gate.implementation.registry.completedEntriesRetained, false)
assert.equal(gate.implementation.registry.failedEntriesRetained, false)
assert.equal(gate.implementation.registry.globalSerialization, false)

const conditions = gate.acceptanceConditions.conditions
assert.equal(expectedConditions.length, 72)
assert.equal(conditions.length, 72)
assert.deepEqual(conditions.map(({ description }) => description), expectedConditions)
conditions.forEach((condition, index) => {
  assert.equal(condition.id, index + 1)
  assert.equal(condition.status, 'PASS')
})
assert.deepEqual({
  expected: gate.acceptanceConditions.expected,
  passed: gate.acceptanceConditions.passed,
  blocked: gate.acceptanceConditions.blocked,
  failed: gate.acceptanceConditions.failed,
}, { expected: 72, passed: 72, blocked: 0, failed: 0 })

assert.deepEqual(gate.liveProofs.classification, ['CURRENT_SINGLE_FLIGHT_EXPERIMENT_EVIDENCE', 'PRELIMINARY_EXPERIMENT_EVIDENCE'])
for (const result of [gate.liveProofs.twoUser, gate.liveProofs.P11, ...gate.liveProofs.P03.models]) {
  assert.equal(result.logicalKeys, 1)
  assert.equal(result.owners, 1)
  assert.equal(result.currentComputes, 1)
  assert.equal(result.waiters, result.requests - 1)
  assert.equal(result.duplicateComputes, 0)
  assert.equal(result.canonicalResponses, result.requests)
  assert.equal(result.activeEntriesAfterSettlement, 0)
  assert.equal(result.correctness, 'PASS')
  assert.equal(result.ownership, 'PASS')
}
assert.equal(gate.liveProofs.P11.preparedRead.currentComputeCount, 0)
assert.deepEqual(gate.liveProofs.P03.models.map(({ modelId }) => modelId), ['naive', 'damped_holt', 'ets', 'arima'])
assert.equal(gate.liveProofs.persistenceIdempotencyProven, false)
assert.equal(Object.values(gate.methodologyGuards).some(Boolean), false)
assert.equal(Object.values(gate.infrastructureGuards).some(Boolean), false)
assert.equal(gate.loadBoundary.new100UserWaves, 0)
assert.equal(gate.loadBoundary.new1000UserWaves, 0)
assert.equal(gate.loadBoundary.P04FormalWaves, 0)
assert.equal(gate.loadBoundary.P05Waves, 0)
assert.equal(gate.loadBoundary.P08Waves, 0)
assert.equal(gate.loadBoundary.fullPhase21BaselineRerun, false)
assert.equal(gate.phase22b2ReadyForAuthorization, true)
assert.equal(gate.phase22b2Authorized, false)
assert.equal(gate.phase22b2Started, false)

for (const reference of [
  ...Object.values(before.authorities),
  ...before.scenarios.P03.modelEvidence,
  ...before.scenarios.P04.evidence,
  before.scenarios.P05.evidence,
  ...before.scenarios.P08.probeEvidence,
  before.scenarios.P11.evidence,
]) assert.equal(hash(reference.path), reference.sha256, `immutable evidence drift: ${reference.path}`)

assert.equal(prepared.status, 'PASS')
assert.equal(regression.status, 'PASS')
assert.deepEqual(regression.suites.forecastCore, { passed: 218, failed: 0 })
assert.deepEqual(regression.suites.sgRuntimeForecastAndMarketData, { passed: 153, failed: 0 })
assert.deepEqual(regression.suites.dashboardForecast, { passed: 100, failed: 0 })
assert.deepEqual(regression.suites.phase22bContractTooling, { passed: 31, failed: 0 })

assert.equal(migration.status, 'PASS')
assert.equal(migration.taskAttributedPathCount, 32)
assert.equal(migration.paths.length, migration.taskAttributedPathCount)
assert.equal(new Set(migration.paths.map(({ path: relativePath }) => relativePath)).size, migration.paths.length)
for (const entry of migration.paths) {
  assert.equal(fs.existsSync(path.join(root, entry.path)), true, `missing migration path: ${entry.path}`)
  assert.equal(['CREATED', 'MODIFIED', 'DELETED'].includes(entry.change), true)
  assert.equal(entry.tracking, 'untracked')
  assert.equal(['CANONICAL_SOURCE', 'TEST', 'EVIDENCE', 'GENERATED'].includes(entry.classification), true)
  assert.equal(typeof entry.includeInFutureSgDev, 'boolean')
  assert.equal(entry.reason.length > 0, true)
}
assert.equal(migration.newNestedGitRepositories, 0)
assert.equal(migration.newExternalSourceRepositories, 0)

console.log(JSON.stringify({
  phase22b1Gate: 'PASS',
  acceptance: '72 / 72 PASS',
  reportSections: '60 / 60',
  immutableEvidenceReferences: 22,
  migrationPaths: migration.paths.length,
  phase22b2ReadyForAuthorization: gate.phase22b2ReadyForAuthorization,
  phase22b2Authorized: gate.phase22b2Authorized,
  phase22b2Started: gate.phase22b2Started,
}, null, 2))