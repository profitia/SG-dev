import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

import {
  buildLogicalKey,
  canonicalCurrentIdentity,
  canonicalVerificationIdentity,
} from './phase-2-2b-single-flight-contract.mjs'

const root = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(`${root}/${relativePath}`, 'utf8'))
const exists = (relativePath) => fs.existsSync(`${root}/${relativePath}`)
const hash = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(`${root}/${relativePath}`)).digest('hex')

const paths = {
  contract: 'tooling/Benchmark-Forecasting/performance/phase-2-2b-single-flight-experiment-contract.json',
  before: 'tooling/Benchmark-Forecasting/performance/phase-2-2b-before-evidence.json',
  safety: 'tooling/Benchmark-Forecasting/performance/phase-2-2b-safety-matrix.json',
  matrix: 'tooling/Benchmark-Forecasting/performance/phase-2-2b-experiment-matrix.json',
  report: 'tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2B_0_SINGLE_FLIGHT_EXPERIMENT_DESIGN_FREEZE.md',
  evidence: 'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-0-single-flight-design-freeze.json',
  migration: 'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-0-migration-readiness.json',
}

for (const relativePath of Object.values(paths)) assert.equal(exists(relativePath), true, `missing ${relativePath}`)

const contract = readJson(paths.contract)
const before = readJson(paths.before)
const safety = readJson(paths.safety)
const matrix = readJson(paths.matrix)
const evidence = readJson(paths.evidence)
const migration = readJson(paths.migration)

assert.equal(contract.contract.version, 1)
assert.equal(contract.contract.stressTestContractVersion, 1)
assert.equal(contract.contract.measurementControlRevision, 2)
assert.equal(contract.contract.contractDrift, false)
assert.equal(Object.values(contract.implementation).some(Boolean), false)
assert.equal(Object.values(contract.loadBoundary).some((value) => value !== 0), false)
assert.notEqual(contract.logicalKeys.current.namespace, contract.logicalKeys.verification.namespace)
assert.equal(contract.structuralInvariants.sameKey.expectedComputeOwnerCount, 1)
assert.equal(contract.structuralInvariants.sameKey.expectedDuplicateComputeCount, 0)

const currentKey = buildLogicalKey('current', canonicalCurrentIdentity)
assert.equal(currentKey, buildLogicalKey('current', { ...canonicalCurrentIdentity }))
assert.notEqual(currentKey, buildLogicalKey('current', { ...canonicalCurrentIdentity, modelId: 'arima' }))
assert.notEqual(currentKey, buildLogicalKey('current', { ...canonicalCurrentIdentity, historyFingerprint: 'fingerprint-b' }))
assert.notEqual(currentKey, buildLogicalKey('current', { ...canonicalCurrentIdentity, targetBasis: 'END_OF_PERIOD', targetSemantics: 'END_OF_PERIOD', methodId: 'END_OF_PERIOD' }))
assert.notEqual(currentKey, buildLogicalKey('current', { ...canonicalCurrentIdentity, sourceFrequency: 'QUARTERLY', targetCadence: 'QUARTERLY', frequencyIdentity: 'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY' }))
assert.notEqual(currentKey, buildLogicalKey('verification', canonicalVerificationIdentity))

const references = [
  ...Object.values(before.authorities),
  ...before.scenarios.P03.modelEvidence,
  ...before.scenarios.P04.evidence,
  before.scenarios.P05.evidence,
  ...before.scenarios.P08.probeEvidence,
  before.scenarios.P11.evidence,
]
for (const reference of references) {
  assert.equal(exists(reference.path), true, `missing evidence ${reference.path}`)
  assert.equal(hash(reference.path), reference.sha256, `evidence hash drift ${reference.path}`)
}
assert.deepEqual(Object.keys(before.scenarios), ['P03', 'P04', 'P05', 'P08', 'P11'])
assert.equal(before.scenarios.P08.aggregateAdmission, 'NOT_ADMITTED_AS_NUMERIC_BASELINE_CELL')
assert.equal(before.scenarios.P11.performanceEvidence, 'NOT_MEASURED')

const safetyIds = new Set(safety.rules.map(({ id }) => id))
assert.equal(safetyIds.size, safety.rules.length)
for (const category of safety.requiredCategories) assert.equal(safety.rules.some((rule) => rule.category === category), true, `missing safety category ${category}`)

const experimentIds = matrix.rows.map(({ experimentId }) => experimentId)
assert.equal(new Set(experimentIds).size, experimentIds.length)
const requiredRowFields = ['experimentId', 'phase', 'scenario', 'state', 'keyDistribution', 'modelScope', 'concurrency', 'precondition', 'expectedStructuralInvariant', 'metrics', 'safetyGate', 'evidenceClass']
for (const row of matrix.rows) {
  for (const field of requiredRowFields) assert.notEqual(row[field], undefined, `${row.experimentId} missing ${field}`)
  for (const safetyId of row.safetyGate) assert.equal(safetyIds.has(safetyId), true, `${row.experimentId} unknown ${safetyId}`)
  assert.equal(row.safetyGate.includes('SAFE-CORRECTNESS'), true, `${row.experimentId} missing correctness gate`)
}
assert.equal(matrix.guards.allRowsUnexecuted, true)
assert.equal(matrix.guards.newLoadExecuted, 0)
assert.equal(matrix.guards.phase22b1Authorized, false)

const report = fs.readFileSync(`${root}/${paths.report}`, 'utf8')
const reportHeadings = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
const expectedHeadings = ['Executive Summary','Objective','Accepted Phase State','Scope Boundary','Why Single-Flight Is Being Tested','Three Evaluation Axes','Frozen Forecast Invariants','Phase 2.1 BEFORE Evidence','Phase 2.2A Correctness Carry-Forward','Experiment Contract Version','Logical Artifact Identity Principle','Current Logical Artifact Key','Verification Logical Artifact Key','Provider-History Key','Persistence Ownership Key','Owner Role','Waiter Role','Prepared Reader Role','SAME_KEY Structural Invariant','SMALL_POOL Structural Invariant','Current Ownership Scope','Verification Ownership Scope','Persistence Ownership Scope','Initial Low-Cost Hypothesis','Single-Process Boundary','Multi-Instance Limitation','Owner Success Semantics','Owner Failure Semantics','Waiter Cancellation Semantics','Owner Disconnect Semantics','Timeout Semantics','Late Arrival Semantics','Owner Release Race','Fingerprint Change Isolation','Model Isolation','Semantic Isolation','Cadence Isolation','Current-vs-Verification Isolation','Telemetry Contract','Ownership Metrics','Persistence Metrics','Waiter UX Metrics','Correctness Equivalence','Prepared-Serving Regression Contract','P03 Experiment Design','P04 Experiment Design','P05 Experiment Design','P08 Experiment Design','P11 Experiment Design','Phase 2.2B-1 Design','Phase 2.2B-2 Design','Phase 2.2B-3 Design','Phase 2.2B-4 Design','Safety and Acceptance Model','Recommended Next Decision','STOP']
assert.equal(reportHeadings.length, 56)
reportHeadings.forEach((heading, index) => {
  assert.equal(Number(heading[1]), index + 1)
  assert.equal(heading[2], expectedHeadings[index])
})
assert.equal(report.trimEnd().endsWith('STOP — PHASE 2.2B-0 SINGLE-FLIGHT EXPERIMENT DESIGN FROZEN. PHASE 2.2B-1 NOT AUTHORIZED.'), true)

const conditions = evidence.acceptanceConditions.conditions
assert.equal(conditions.length, 64)
conditions.forEach((condition, index) => {
  assert.equal(condition.id, index + 1)
  assert.equal(condition.status, 'PASS')
})
assert.deepEqual({ expected: evidence.acceptanceConditions.expected, passed: evidence.acceptanceConditions.passed, blocked: evidence.acceptanceConditions.blocked, failed: evidence.acceptanceConditions.failed }, { expected: 64, passed: 64, blocked: 0, failed: 0 })
assert.equal(Object.values(evidence.scopeGuards).some(Boolean), false)
assert.equal(Object.values(evidence.loadBoundary).some((value) => value !== 0), false)
assert.equal(evidence.phase22b0Gate, 'PASS')
assert.equal(evidence.experimentContractFrozen, true)
assert.equal(evidence.phase22b1ReadyForAuthorization, true)
assert.equal(evidence.phase22b1Authorized, false)
assert.equal(evidence.phase22b1Started, false)

assert.equal(migration.status, 'PASS')
assert.equal(migration.paths.length, migration.taskAttributedPathCount)
assert.equal(migration.taskAttributedPathCount, 12)
assert.equal(new Set(migration.paths.map(({ path: relativePath }) => relativePath)).size, migration.paths.length)
for (const entry of migration.paths) {
  assert.equal(exists(entry.path), true, `missing migration path ${entry.path}`)
  assert.equal(entry.change, 'CREATED')
  assert.equal(entry.tracking, 'untracked')
  if (entry.classification === 'PMOS_RUNTIME') {
    assert.equal(entry.includeInFutureSgDev, false)
    assert.equal(entry.path.startsWith('apps/pmos/.pmos/'), true)
  } else {
    assert.equal(entry.includeInFutureSgDev, true)
    assert.equal(entry.path.startsWith('tooling/Benchmark-Forecasting/'), true)
  }
}
assert.equal(migration.newNestedGitRepositories, 0)
assert.equal(migration.newExternalSourceRepositories, 0)
assert.equal(migration.runtimeSourcePathsChanged, 0)

console.log(JSON.stringify({
  phase22b0Gate: evidence.phase22b0Gate,
  acceptance: '64 / 64 PASS',
  reportSections: '56 / 56',
  immutableEvidenceReferences: references.length,
  experimentRows: matrix.rows.length,
  safetyRules: safety.rules.length,
  taskAttributedPaths: migration.paths.length,
  phase22b1Authorized: evidence.phase22b1Authorized,
  phase22b1Started: evidence.phase22b1Started,
}, null, 2))