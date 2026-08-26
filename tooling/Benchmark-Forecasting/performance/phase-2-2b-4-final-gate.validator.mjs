import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const gate = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4-before-after-comparative-stress.json')
const plan = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4-execution-plan.json')
const after = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4-after-aggregate.json')
const comparison = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4-before-after-comparison.json')
const handoff = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4-phase-2-2c-handoff.json')
const migration = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4-migration-readiness.json')
const report = fs.readFileSync(path.join(root, 'tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2B_4_BEFORE_AFTER_COMPARATIVE_STRESS_TEST.md'), 'utf8')

const expectedHeadings = [
  'Executive Summary', 'Objective', 'Accepted Phase State', 'Frozen Contracts', 'Scope Boundary', 'Meaning of the B4 Gate', 'BEFORE Evidence Authority', 'BEFORE Evidence Classes', 'AFTER Architecture', 'Environment Snapshot', 'Environment Comparability', 'Execution Matrix', 'Execution Accounting', 'State Reproduction', 'Safety and Escalation', 'Measurement Contract', 'Correctness Gate', 'Structural Ownership Gate', 'Performance Evidence Gate', 'Current Ownership Metrics', 'Verification Ownership Metrics', 'Persistence Metrics', 'UX Metrics', 'Resource Metrics', 'Error Metrics', 'P03 BEFORE', 'P03 AFTER', 'P03 Comparative Result', 'P04 BEFORE', 'P04 AFTER', 'P04 Comparative Result', 'P05 BEFORE', 'P05 AFTER', 'P05 Comparative Result', 'P08 BEFORE', 'P08 AFTER', 'P08 Comparative Result', 'P11 BEFORE', 'P11 AFTER', 'P11 Comparative Result', 'P01 Prepared Regression', 'P02 Prepared Regression', 'P06 Prepared Verification Regression', 'P07 Prepared Verification Regression', 'P09 Search Regression', 'P10 HOT Show Forecast Regression', 'Compute Reduction', 'Duplicate Persistence Reduction', 'CPU Comparison', 'Memory Comparison', 'Database Activity Comparison', 'Throughput Comparison', 'p50 Comparison', 'p95 Comparison', 'p99 Comparison', 'Capability Recovery', 'Model-Specific Findings', 'Remaining Bottlenecks', 'High-Concurrency HTTP Findings', 'Cross-Instance Limitation', 'Provider Boundary', 'Phase 2.2C Handoff', 'Functional Regression', 'Methodology and Scope Guards', 'Migration Readiness', 'Phase 2.2B-4 Final Gate', 'Recommended Next Decision', 'STOP',
]
const headings = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
assert.equal(headings.length, 68)
headings.forEach((heading, index) => {
  assert.equal(Number(heading[1]), index + 1)
  assert.equal(heading[2], expectedHeadings[index])
})
assert.equal(report.trimEnd().endsWith('STOP — PHASE 2.2B-4 BEFORE vs AFTER COMPARATIVE STRESS TEST COMPLETE. PHASE 2.2C NOT AUTHORIZED.'), true)

assert.equal(plan.rows.length, 6)
assert.equal(plan.plan.plannedRowCount, 6)
assert.equal(plan.plan.terminalRowCount, 6)
assert.ok(plan.rows.every(({ terminalStatus }) => ['VALID_COMPLETED', 'SAFETY_BLOCKED', 'INVALID_STATE', 'CONTRACT_ABORTED'].includes(terminalStatus)))
assert.equal(after.executionAccounting.plannedB4Rows, 6)
assert.equal(after.executionAccounting.allTerminal, true)
assert.ok(after.validNumericResults.every(({ stressRunId }) => !after.excludedResults.some((cell) => cell.stressRunId === stressRunId)))
assert.equal(after.cooldownEvidence.completePreEscalationProof, false)
assert.equal(comparison.scenarios.P04.structural, 'OWNERSHIP_FAIL')
assert.equal(comparison.hardFailure.observedAt.expectedKeys, 3)
assert.equal(comparison.hardFailure.observedAt.computes, 6)
assert.equal(comparison.hardFailure.observedAt.duplicates, 3)
assert.equal(comparison.classifications.currentStructuralEffect, 'NOT_CONFIRMED')
assert.equal(comparison.classifications.verificationStructuralEffect, 'CONFIRMED')
assert.equal(comparison.classifications.persistenceEffectiveIdempotency, 'PRESERVED')
assert.equal(comparison.classifications.crossInstanceDuplicatePrevention, 'NOT_PROVEN')
assert.equal(handoff.phase22cAuthorized, false)
assert.equal(handoff.phase22cStarted, false)
assert.equal(handoff.phase22cReadyForAuthorization, false)

assert.equal(gate.acceptanceConditions.conditions.length, 96)
gate.acceptanceConditions.conditions.forEach((condition, index) => {
  assert.equal(condition.id, index + 1)
  assert.ok(['PASS', 'FAIL'].includes(condition.status))
})
assert.deepEqual({
  expected: gate.acceptanceConditions.expected,
  passed: gate.acceptanceConditions.passed,
  blocked: gate.acceptanceConditions.blocked,
  failed: gate.acceptanceConditions.failed,
}, { expected: 96, passed: 92, blocked: 0, failed: 4 })
assert.deepEqual(gate.acceptanceConditions.conditions.filter(({ status }) => status === 'FAIL').map(({ id }) => id), [35, 36, 47, 75])
assert.equal(gate.phase22b4Gate, 'FAIL')
assert.equal(gate.comparativeExperimentComplete, true)
assert.equal(gate.phase22bSeriesComplete, false)
assert.equal(gate.phase22cReadyForAuthorization, false)
assert.equal(gate.phase22cAuthorized, false)
assert.equal(gate.phase22cStarted, false)
assert.equal(migration.paths.length, migration.taskAttributedPathCount)
assert.equal(migration.newNestedGitRepositories, 0)
assert.equal(migration.newExternalSourceRepositories, 0)
assert.equal(migration.runtimeSourceBehaviorChanged, false)

process.stdout.write(`${JSON.stringify({ phase22b4Gate: gate.phase22b4Gate, acceptance: '92 / 96 PASS; 4 FAIL', failedConditions: [35, 36, 47, 75], reportSections: '68 / 68', plannedRows: 6, phase22cAuthorized: false, phase22cStarted: false }, null, 2)}\n`)