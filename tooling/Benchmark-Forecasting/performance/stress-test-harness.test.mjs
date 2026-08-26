import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  MANDATORY_CONCURRENCY_LEVELS,
  MAXIMUM_RELEASE_SPREAD_MS,
  STRESS_TEST_CONTRACT_VERSION,
  runBarrierDryRun,
  runSynchronizedBurst,
} from './stress-test-harness.mjs'

const ROOT = new URL('./', import.meta.url)

const REQUIRED_REPORT_HEADINGS = [
  'Executive Summary', 'Phase 2.0 Objective', 'Accepted Functional Preconditions', 'Scope Boundary',
  'Three Equal Product Principles', 'Current User Flow', 'Performance State Taxonomy', 'HOT_READY Definition',
  'WARM_INPUT_READY_ARTIFACT_MISS Definition', 'COLD_INPUT_AND_ARTIFACT_MISS Definition',
  'VERIFICATION_READY Definition', 'VERIFICATION_MISS Definition', 'UX Flow Definition', 'Concurrency Levels',
  'Load Shapes', 'Key Distributions', 'Same-Key Herd Contract', 'Provider-Safety Contract',
  'Verification-Safety Contract', 'Primary Stress Cohort', 'Compatibility Cohort', 'Deterministic State Setup',
  'Measurement Layers', 'UX Metrics', 'Service Metrics', 'Compute Metrics', 'Database Metrics', 'Provider Metrics',
  'Memory Metrics', 'CPU Metrics', 'Reliability Metrics', 'Duplicate Compute Metrics', 'Persistence Metrics',
  'Cost Proxy Metrics', 'Financial Cost Model', 'Trace / Correlation Contract', 'Timing Contract', 'Scenario Matrix',
  'Repetition Policy', 'Cooldown Policy', 'Outlier / Exclusion Policy', 'State Validation Rules', 'Safety Abort Rules',
  'Performance Result Schema', 'Observability Inventory', 'Instrumentation Gap Analysis',
  'Execution Environment Contract', 'Dataset / Fingerprint Contract', 'Functional Correctness Checks',
  'Baseline Classification Framework', 'Bottleneck Attribution Framework', 'Future Optimization Comparison Framework',
  'Phase 2 Workflow', 'Migration Readiness Delta', 'Phase 2.0 Acceptance Gate', 'STOP',
]

async function readJson(name) {
  return JSON.parse(await readFile(new URL(name, ROOT), 'utf8'))
}

test('frozen contract and P01-P11 manifest remain complete', async () => {
  const contract = await readJson('stress-test-contract.json')
  const manifest = await readJson('stress-test-scenarios.json')
  const schema = await readJson('stress-test-result.schema.json')
  const observability = await readJson('observability-matrix.json')

  assert.equal(contract.contractVersion, STRESS_TEST_CONTRACT_VERSION)
  assert.deepEqual(contract.concurrencyLevels, [10, 100, 1000])
  assert.equal(contract.loadShapes.primary.releaseWindowMsMaximum, MAXIMUM_RELEASE_SPREAD_MS)
  assert.equal(Object.keys(contract.states).length, 6)
  assert.equal(manifest.scenarios.length, 11)
  assert.deepEqual(manifest.scenarios.map(({ scenarioId }) => scenarioId), [
    'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11',
  ])
  for (const scenario of manifest.scenarios) {
    assert.deepEqual(scenario.concurrencyLevels, [10, 100, 1000])
    assert.equal(scenario.loadShape, 'SYNCHRONIZED_BURST')
    assert.equal(scenario.releaseWindowMs, 250)
  }
  assert.equal(schema.properties.contractVersion.const, 1)
  assert.ok(schema.required.includes('duplicateComputeCount'))
  assert.ok(schema.required.includes('memoryDeltaAfterCooldownMb'))
  assert.equal(observability.inventoryComplete, true)
  assert.equal(observability.runtimeInstrumentationRequiredForPhase21, true)
})

test('human report and machine acceptance gate have exact required counts', async () => {
  const report = await readFile(new URL('../FORECAST_PHASE_2_0_STRESS_TEST_CONTRACT_FREEZE.md', ROOT), 'utf8')
  const evidence = await readJson('../validation/forecast-phase-2-0-stress-test-contract.json')
  const migration = await readJson('../validation/forecast-phase-2-0-migration-readiness.json')
  const headings = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]

  assert.deepEqual(headings.map((match) => match[2]), REQUIRED_REPORT_HEADINGS)
  assert.deepEqual(headings.map((match) => Number(match[1])), Array.from({ length: 56 }, (_, index) => index + 1))
  assert.equal(evidence.acceptanceConditions.expected, 70)
  assert.equal(evidence.acceptanceConditions.passed, 70)
  assert.equal(evidence.acceptanceConditions.conditions.length, 70)
  assert.ok(evidence.acceptanceConditions.conditions.every((condition, index) => (
    condition.id === index + 1 && condition.status === 'PASS'
  )))
  assert.equal(migration.paths.length, migration.summary.task_attributed_paths)
  assert.equal(evidence.phase20Gate, 'PASS')
  assert.equal(evidence.phase21Authorized, false)
})

test('barrier dry run uses no load level and meets release window', async () => {
  const result = await runBarrierDryRun({ virtualUsers: 4 })

  assert.equal(result.mode, 'DRY_RUN_NO_NETWORK')
  assert.equal(result.actualRequests, 4)
  assert.equal(result.fullStressExecuted, false)
  assert.equal(result.passed, true)
  assert.ok(result.releaseSpreadMs <= MAXIMUM_RELEASE_SPREAD_MS)
})

test('dry-run guard rejects mandatory stress concurrency', async () => {
  await assert.rejects(() => runBarrierDryRun({ virtualUsers: 10 }), /Phase 2\.0 dry-run/)
})

test('synchronized burst releases exact mandatory concurrency with correlated results', async () => {
  const result = await runSynchronizedBurst({
    virtualUsers: 10,
    stressRunId: 'phase-2-1b-test-run',
    scenarioId: 'P01',
    operation: async (context) => context.requestId,
  })

  assert.deepEqual(MANDATORY_CONCURRENCY_LEVELS, [10, 100, 1000])
  assert.equal(result.virtualUsers, 10)
  assert.equal(result.successCount, 10)
  assert.equal(result.failureCount, 0)
  assert.equal(result.releaseWindowPassed, true)
  assert.ok(result.releaseSpreadMs <= MAXIMUM_RELEASE_SPREAD_MS)
  assert.equal(new Set(result.results.map(({ requestId }) => requestId)).size, 10)
})

test('synchronized burst preserves request failures and rejects non-contract levels', async () => {
  const result = await runSynchronizedBurst({
    virtualUsers: 10,
    stressRunId: 'phase-2-1b-failure-test',
    scenarioId: 'P03',
    operation: async ({ virtualUserId }) => {
      if (virtualUserId === 'vu-3') throw new Error('controlled failure')
      return 'ok'
    },
  })

  assert.equal(result.successCount, 9)
  assert.equal(result.failureCount, 1)
  assert.equal(result.results[2].error, 'controlled failure')
  await assert.rejects(() => runSynchronizedBurst({
    virtualUsers: 9,
    stressRunId: 'invalid',
    scenarioId: 'P01',
    operation: async () => null,
  }), /exactly 10, 100, or 1000/)
})