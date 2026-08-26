import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const resolve = (relativePath) => path.join(root, relativePath)
const readJson = (relativePath) => JSON.parse(fs.readFileSync(resolve(relativePath), 'utf8'))
const sha256 = (relativePath) => createHash('sha256').update(fs.readFileSync(resolve(relativePath))).digest('hex')
const exists = (relativePath) => fs.existsSync(resolve(relativePath))

const plan = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-execution-plan.json')
const before = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-before-evidence.json')
const after = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-after-aggregate.json')
const comparison = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-before-after-comparison.json')
const handoff = readJson('tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-phase-2-2c-handoff.json')
const gate = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4r-controlled-comparative-stress.json')
const migration = readJson('tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4r-migration-readiness.json')
const accounting = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-4r/execution-control/execution-accounting.json')
const regression = readJson('tooling/Benchmark-Forecasting/validation/phase-2-2b-4r/functional-regression.json')
const report = fs.readFileSync(resolve('tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2B_4R_CONTROLLED_BEFORE_AFTER_COMPARATIVE_STRESS_RERUN.md'), 'utf8')

const originalB4Hashes = {
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4-after-aggregate.json': '1e62ef689f27816cb777c711f6e9060627e898c6bb59811b358f137cc6584b8d',
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4-before-after-comparison.json': '028ad4fc879810a7819888085e205ac2b3fef5c151dac57ff9b3512dca1dc896',
  'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4-before-after-comparative-stress.json': 'c1d34137b9e279257c91aec2b765c73246534bbab88b590f49a0222fe5a70bbb',
}
for (const [relativePath, expectedHash] of Object.entries(originalB4Hashes)) {
  assert.equal(sha256(relativePath), expectedHash, `Original B4 authority changed: ${relativePath}`)
}

const beforeReferences = []
const visitBefore = (value) => {
  if (Array.isArray(value)) return value.forEach(visitBefore)
  if (!value || typeof value !== 'object') return
  if (typeof value.path === 'string' && typeof value.sha256 === 'string') beforeReferences.push(value)
  Object.values(value).forEach(visitBefore)
}
visitBefore(before)
assert.equal(beforeReferences.length, 22)
for (const reference of beforeReferences) {
  assert.equal(sha256(reference.path), reference.sha256, `Immutable BEFORE evidence changed: ${reference.path}`)
}

const expectedHeadings = [
  'Executive Summary', 'Objective', 'Accepted Phase State', 'Accepted Phase 2.2B-1R Repair Authority', 'Frozen Contracts', 'Scope Boundary', 'Meaning of the B4R Gate', 'BEFORE Evidence Authority', 'BEFORE Evidence Classes', 'Original B4 Immutable Failure Authority', 'AFTER Architecture', 'Environment Snapshot',
  'Environment Comparability', 'Immutable B4R Execution Plan', 'Execution Matrix', 'Execution Accounting', 'State Reproduction', 'Safety and Escalation', 'Settlement Safety Contract', 'Measurement Contract', 'Correctness Gate', 'Structural Ownership Gate', 'Performance Evidence Gate', 'Current Ownership Metrics',
  'Verification Ownership Metrics', 'Persistence Metrics', 'UX Metrics', 'Resource Metrics', 'Error Metrics', 'P03 BEFORE', 'P03 AFTER', 'P03 Comparative Result', 'P04 BEFORE', 'P04 AFTER', 'P04 Comparative Result', 'P05 BEFORE',
  'P05 AFTER', 'P05 Comparative Result', 'P08 BEFORE', 'P08 AFTER', 'P08 Comparative Result', 'P11 BEFORE', 'P11 AFTER', 'P11 Comparative Result', 'P01 Prepared Regression', 'P02 Prepared Regression', 'P06 Prepared Verification Regression', 'P07 Prepared Verification Regression',
  'P09 Search Regression', 'P10 HOT Show Forecast Regression', 'Compute Reduction', 'Duplicate Persistence Reduction', 'CPU Comparison', 'Memory Comparison', 'Database Activity Comparison', 'Throughput Comparison', 'p50 Comparison', 'p95 Comparison', 'p99 Comparison', 'Capability Recovery',
  'Model-Specific Findings', 'Remaining Bottlenecks', 'High-Concurrency HTTP Findings', 'Cross-Instance Limitation', 'Provider Boundary', 'Phase 2.2C Handoff', 'Functional Regression', 'Methodology and Scope Guards', 'Migration Readiness', 'Phase 2.2B-4R Final Gate', 'Recommended Next Decision', 'STOP',
]
const headings = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
assert.equal(headings.length, 72)
headings.forEach((heading, index) => {
  assert.equal(Number(heading[1]), index + 1)
  assert.equal(heading[2], expectedHeadings[index])
})
assert.equal(report.trimEnd().endsWith('STOP - PHASE 2.2B-4R COMPLETE. PHASE 2.2C NOT AUTHORIZED OR STARTED.'), true)

assert.equal(plan.plan.phase, '2.2B-4R')
assert.equal(plan.plan.plannedCellCount, 105)
assert.equal(plan.plan.terminalCellCount, 105)
assert.equal(plan.cells.length, 105)
assert.deepEqual({
  plannedCells: accounting.plannedCells,
  validCompleted: accounting.validCompleted,
  safetyBlocked: accounting.safetyBlocked,
  invalidState: accounting.invalidState,
  contractAborted: accounting.contractAborted,
  total: accounting.total,
  allTerminal: accounting.allTerminal,
}, { plannedCells: 105, validCompleted: 51, safetyBlocked: 23, invalidState: 0, contractAborted: 31, total: 105, allTerminal: true })

assert.equal(after.executionAccounting.plannedCells, 105)
assert.equal(after.executionAccounting.allTerminal, true)
assert.equal(after.rawExecutedCellCount, 74)
assert.equal(after.validNumericResultCount, 51)
assert.equal(after.validNumericResults.length, 51)
assert.equal(after.structuralCells.length, 21)
assert.ok(after.structuralCells.every(({ logicalKeys, physicalOwners, duplicateComputes, duplicateArtifactWrites }) =>
  logicalKeys === physicalOwners && duplicateComputes === 0 && duplicateArtifactWrites === 0))
assert.deepEqual(after.settlementBlocks.map(({ scenario, concurrency, terminalStatus }) => ({ scenario, concurrency, terminalStatus })), [
  { scenario: 'P09', concurrency: 1000, terminalStatus: 'SAFETY_BLOCKED' },
  { scenario: 'P10', concurrency: 10, terminalStatus: 'SAFETY_BLOCKED' },
])
assert.equal(after.classifications.structural, 'CONFIRMED_AT_LAWFUL_REACHED_LEVELS_P04_THROUGH_100')

assert.equal(comparison.comparableCells.length, 13)
assert.ok(comparison.comparableCells.every(({ structuralOwnership, ownership }) =>
  structuralOwnership === 'OWNERSHIP_PASS' && ownership.duplicateComputes === 0 && ownership.duplicateArtifactWrites === 0))
assert.equal(comparison.scenarios.P04.structural, 'OWNERSHIP_PASS_AT_10_AND_100')
assert.deepEqual(comparison.scenarios.P04.afterComputes, { 10: 3, 100: 3 })
assert.equal(comparison.classifications.crossInstanceDuplicatePrevention, 'NOT_PROVEN')

assert.equal(regression.status, 'PASS')
assert.equal(regression.checksPassed, 11)
assert.equal(regression.checksExpected, 11)
assert.equal(regression.stressExecutionObserved, false)

assert.equal(gate.acceptanceConditions.conditions.length, 104)
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
}, { expected: 104, passed: 104, blocked: 0, failed: 0 })
assert.equal(gate.phase22b4rGate, 'PASS')
assert.equal(gate.comparativeExperimentComplete, true)
assert.equal(gate.phase22bSeriesComplete, true)
assert.equal(gate.originalPhase22b4HistoricalFailPreserved, true)
assert.equal(gate.phase22cReadyForAuthorizationDecision, true)
assert.equal(gate.phase22cAuthorized, false)
assert.equal(gate.phase22cStarted, false)
assert.equal(handoff.phase22cReadyForAuthorizationDecision, true)
assert.equal(handoff.phase22cAuthorized, false)
assert.equal(handoff.phase22cStarted, false)

assert.equal(migration.status, 'PASS')
assert.equal(migration.paths.length, migration.taskAttributedPathCount)
assert.equal(new Set(migration.paths.map(({ path: relativePath }) => relativePath)).size, migration.paths.length)
for (const entry of migration.paths) {
  assert.equal(exists(entry.path), true, `Missing migration path ${entry.path}`)
  assert.ok(['TEST', 'EVIDENCE', 'GENERATED'].includes(entry.classification))
  assert.equal(entry.includeInFutureSgDev, 'YES')
}
assert.equal(migration.originalB4HistoricalEvidenceChanged, false)
assert.equal(migration.runtimeSourceBehaviorChanged, false)
assert.equal(migration.newNestedGitRepositories, 0)
assert.equal(migration.newExternalSourceRepositories, 0)

const jsonFiles = []
const collectJson = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectJson(entryPath)
    else if (entry.name.endsWith('.json')) jsonFiles.push(entryPath)
  }
}
collectJson(resolve('tooling/Benchmark-Forecasting/validation/phase-2-2b-4r'))
for (const filePath of jsonFiles) JSON.parse(fs.readFileSync(filePath, 'utf8'))
assert.ok(jsonFiles.length >= 223)

process.stdout.write(`${JSON.stringify({
  phase22b4rGate: gate.phase22b4rGate,
  acceptance: '104 / 104 PASS',
  reportSections: '72 / 72',
  accounting: '105 / 105 TERMINAL',
  structuralCells: '21 / 21 OWNERSHIP PASS',
  parsedB4rJsonFiles: jsonFiles.length,
  phase22cAuthorized: false,
  phase22cStarted: false,
}, null, 2)}\n`)