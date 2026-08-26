import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const performanceRoot = path.dirname(fileURLToPath(import.meta.url))
const forecastRoot = path.resolve(performanceRoot, '..')
const gatePath = path.join(forecastRoot, 'validation', 'forecast-phase-2-3r-napi-root-cause-repair.json')
const migrationPath = path.join(forecastRoot, 'validation', 'forecast-phase-2-3r-migration-readiness.json')
const accountingPath = path.join(forecastRoot, 'validation', 'phase-2-3r', 'execution-control', 'execution-accounting.json')
const reportPath = path.join(forecastRoot, 'FORECAST_PHASE_2_3R_P09_1000_DOWNSTREAM_SG_RUNTIME_NAPI_ROOT_CAUSE_REPAIR.md')

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))

const [gate, migration, accounting, report] = await Promise.all([
  readJson(gatePath), readJson(migrationPath), readJson(accountingPath), readFile(reportPath, 'utf8'),
])

assert.equal(gate.phase23rGate, 'PASS')
assert.equal(gate.repairComplete, true)
assert.equal(gate.napiRepairAccepted, 'YES')
assert.equal(gate.c01CacheMissCoalescingAccepted, 'YES')
assert.deepEqual(
  { expected: gate.acceptanceConditions.expected, passed: gate.acceptanceConditions.passed, blocked: gate.acceptanceConditions.blocked, failed: gate.acceptanceConditions.failed },
  { expected: 100, passed: 100, blocked: 0, failed: 0 },
)
assert.equal(gate.acceptanceConditions.conditions.length, 100)
assert.equal((report.match(/^## \d+\. /gm) ?? []).length, 68)
assert.ok(report.trim().endsWith('STOP — PHASE 2.3R P09@1000 DOWNSTREAM SG RUNTIME N-API FAILURE ROOT-CAUSE & REPAIR COMPLETE. PHASE 2.4 NOT AUTHORIZED.'))
assert.equal(gate.validation.p09At1000.executionCount, 1)
assert.equal(accounting.cells['p09-1000'].attempts, 1)
assert.equal(gate.validation.p09At1000.napiFailures, 0)
assert.equal(gate.validation.p09At1000.result.successes, 1000)
assert.equal(gate.validation.p10.result.forecastCompute, 0)
assert.equal(gate.scopeGuards.C01Changed, false)
assert.equal(migration.status, 'PASS')
assert.equal(migration.newNestedGitRepositories, 0)
assert.equal(migration.newExternalSourceRepositories, 0)
assert.equal(gate.phase23SeriesComplete, true)
assert.equal(gate.phase24ReadyForAuthorization, true)
assert.equal(gate.phase24Authorized, false)
assert.equal(gate.phase24Started, false)

process.stdout.write(`${JSON.stringify({ phase23rGate: gate.phase23rGate, acceptance: '100/100 PASS', reportSections: '68/68', migrationPaths: migration.taskAttributedPathCount, p09At1000Executions: 1, phase24ReadyForAuthorization: true, phase24Authorized: false, phase24Started: false }, null, 2)}\n`)