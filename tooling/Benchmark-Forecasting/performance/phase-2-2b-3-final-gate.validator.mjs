import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))
const gate = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-3-persistence-ownership-idempotency.json')
const migration = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-3-migration-readiness.json')
const stage = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-3/persistence-stage-a.json')
const prepared = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-3/prepared-search-regressions.json')
const regression = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-3/regression.json')
const report = fs.readFileSync(path.join(root, 'tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2B_3_PERSISTENCE_OWNERSHIP_IDEMPOTENCY_EXPERIMENT.md'), 'utf8')

const expectedHeadings = [
  'Executive Summary', 'Objective', 'Accepted Phase State', 'Frozen Experiment Contract', 'Scope Boundary',
  'Primary Persistence Hypothesis', 'H0 Decision Principle', 'H1 Authorization Boundary', 'Persistence Ownership Key',
  'Persistence Key Semantics', 'Current Persistence Architecture', 'Verification Persistence Architecture',
  'Database Constraint Inspection', 'Current Canonical Persistence Identity', 'Verification Canonical Persistence Identity',
  'Canonical Write-Set Definition', 'Duplicate Write-Set Definition', 'Effective Idempotency Definition',
  'Exactly-Once Claim Boundary', 'Phase 2.2B-1 Current Carry-Forward', 'Phase 2.2B-2 Verification Carry-Forward',
  'Current Normal Success Proof', 'Verification Normal Success Proof', 'Current Sequential Duplicate Write Proof',
  'Verification Sequential Duplicate Write Proof', 'Current Concurrent Persistence Proof',
  'Verification Concurrent Persistence Proof', 'Failure Before Persistence', 'Failure During Persistence',
  'Partial-State Safety', 'Retry After Failure', 'Retry After Uncertain Commit', 'Owner Lifetime and Persistence Settlement',
  'Late Arrival During Persistence', 'Release Race', 'Prepared After Persistence', 'Prepared After Duplicate Persistence',
  'Current Artifact Cardinality', 'Verification Artifact Cardinality', 'Current Child-Row Cardinality',
  'Verification Record Cardinality', 'Cross-Identity Isolation', 'Current-vs-Verification Persistence Isolation',
  'Persistence Operation Isolation', 'Persistence Schema Version', 'Persistence Telemetry', 'Persistence Metrics',
  'H0 Final Result', 'H0 Failure Classification', 'H1 Eligibility Decision', 'H1 Implementation', 'H1 Validation',
  'Additional Persistence Mechanism Decision', 'Current Single-Flight Regression', 'Verification Single-Flight Regression',
  'Prepared Verification Regression', 'Search and Prepared Current Regression', 'Functional Regression',
  'Methodology and Scope Guards', 'Cross-Instance Limitation', 'Migration Readiness', 'Phase 2.2B-3 Final Gate',
  'Recommended Next Decision', 'STOP',
]
const reportHeadings = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
assert.equal(reportHeadings.length, 64)
reportHeadings.forEach((heading, index) => {
  assert.equal(Number(heading[1]), index + 1)
  assert.equal(heading[2], expectedHeadings[index])
})
assert.equal(report.trimEnd().endsWith('STOP — PHASE 2.2B-3 PERSISTENCE OWNERSHIP / IDEMPOTENCY EXPERIMENT COMPLETE. PHASE 2.2B-4 NOT AUTHORIZED.'), true)

assert.equal(gate.acceptanceConditions.conditions.length, 84)
gate.acceptanceConditions.conditions.forEach((condition, index) => {
  assert.equal(condition.id, index + 1)
  assert.equal(condition.status, 'PASS')
  assert.ok(condition.description.length > 0)
})
assert.deepEqual({
  expected: gate.acceptanceConditions.expected,
  passed: gate.acceptanceConditions.passed,
  blocked: gate.acceptanceConditions.blocked,
  failed: gate.acceptanceConditions.failed,
}, { expected: 84, passed: 84, blocked: 0, failed: 0 })
assert.equal(gate.hypotheses.h0Result, 'PASS')
assert.equal(gate.hypotheses.h1Required, false)
assert.equal(gate.hypotheses.h1Implemented, false)
assert.equal(gate.implementation.additionalPersistenceMechanismRequired, false)
assert.equal(gate.implementation.persistenceIdempotencyImplementation, 'NONE')
assert.equal(gate.implementation.persistenceBehaviorChanged, false)
assert.equal(gate.finalState.exactlyOnceDatabaseExecutionClaimed, false)
assert.equal(gate.finalState.effectiveIdempotency, 'PASS')
assert.equal(gate.finalState.duplicateChildRows, 0)
assert.equal(gate.raceSafety.ownerReleasedBeforePersistenceSettled, false)
assert.equal(gate.raceSafety.lateArrivalCreatesSecondPersistenceOwner, false)
assert.equal(gate.raceSafety.partialStateServedReady, false)
assert.equal(gate.phase22b3Gate, 'PASS')
assert.equal(gate.persistenceOwnershipExperimentComplete, true)
assert.equal(gate.phase22b4ReadyForAuthorization, true)
assert.equal(gate.phase22b4Authorized, false)
assert.equal(gate.phase22b4Started, false)

assert.equal(stage.scenarios.length, 10)
assert.ok(stage.scenarios.every(({ status, parentCount, childCount, expectedChildCount }) =>
  status === 'PASS' && parentCount === 1 && childCount === expectedChildCount))
assert.ok(stage.failureEvidence.every(({ failureBeforePersistence, failureDuringPersistence, uncertainCommitReplay }) =>
  failureBeforePersistence.attemptedWriteSets === 0
  && failureDuringPersistence.committedWriteSets === 0
  && failureDuringPersistence.partialReady === false
  && uncertainCommitReplay.canonicalArtifactsAfterReplay === 1))
assert.equal(stage.cleanup.status, 'PASS')
assert.equal(Object.values(stage.cleanup.state).every((count) => count === 0), true)
assert.equal(prepared.status, 'PASS')
assert.equal(prepared.currentAndSearch.counts.currentComputes, 0)
assert.equal(prepared.verificationReady.counts.verificationComputes, 0)
assert.equal(prepared.currentAndSearch.counts.providerCalls, 0)
assert.equal(prepared.verificationReady.counts.providerCalls, 0)
assert.equal(regression.status, 'PASS')
assert.deepEqual([
  regression.forecastCore.passed,
  regression.sgRuntime.passed,
  regression.dashboard.passed,
  regression.phaseTooling.passed,
], [218, 169, 100, 31])

assert.equal(migration.status, 'PASS')
assert.equal(migration.paths.length, migration.taskAttributedPathCount)
assert.equal(new Set(migration.paths.map(({ path: relativePath }) => relativePath)).size, migration.paths.length)
for (const entry of migration.paths) {
  assert.equal(exists(entry.path), true, `Missing migration path ${entry.path}`)
  assert.ok(['CREATED', 'MODIFIED', 'DELETED'].includes(entry.change))
  assert.ok(['CANONICAL_SOURCE', 'TEST', 'EVIDENCE', 'GENERATED'].includes(entry.classification))
  assert.ok(['YES', 'NO'].includes(entry.includeInFutureSgDev))
  assert.equal(entry.tracking, 'untracked')
}
assert.equal(migration.newNestedGitRepositories, 0)
assert.equal(migration.newExternalSourceRepositories, 0)
assert.equal(migration.persistenceSourceBehaviorChanged, false)

process.stdout.write(`${JSON.stringify({
  phase22b3Gate: gate.phase22b3Gate,
  h0: gate.hypotheses.h0Result,
  acceptance: '84 / 84 PASS',
  reportSections: '64 / 64',
  persistenceScenarios: stage.scenarios.length,
  migrationPaths: migration.taskAttributedPathCount,
  phase22b4Authorized: gate.phase22b4Authorized,
  phase22b4Started: gate.phase22b4Started,
}, null, 2)}\n`)