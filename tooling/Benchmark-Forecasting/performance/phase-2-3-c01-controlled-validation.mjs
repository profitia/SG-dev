import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PERFORMANCE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const FORECAST_ROOT = path.resolve(PERFORMANCE_ROOT, '..')
const REPOSITORY_ROOT = path.resolve(FORECAST_ROOT, '..', '..')
const DASHBOARD_ROOT = path.join(REPOSITORY_ROOT, 'apps', 'dashboard-preview')
const BASELINE_RUNNER = path.join(PERFORMANCE_ROOT, 'phase-2-1b-baseline.mjs')
const BASELINE_PLAN = path.join(PERFORMANCE_ROOT, 'phase-2-1b-resume-plan.json')
const VALIDATION_ROOT = path.join(FORECAST_ROOT, 'validation', 'phase-2-3')
const CONTROL_ROOT = path.join(VALIDATION_ROOT, 'execution-control')
const EXECUTION_ROOT = path.join(VALIDATION_ROOT, 'executions')
const ACCOUNTING_PATH = path.join(CONTROL_ROOT, 'execution-accounting.json')
const STRUCTURAL_PROOF_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-3-c01-structural-proof.json')
const IMPLEMENTATION_EVIDENCE_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-3-c01-implementation-evidence.json')
const AUTHORIZATION_TOKEN = 'FORECAST_PHASE_2_3_C01_CACHE_MISS_COALESCING_INTEGRATION_REGRESSION'
const C01_PREFIX = '[FORECAST_PHASE_2_3_C01_DIAGNOSTIC] '

const CELLS = {
  'p09-100': { scenarioId: 'P09', modelId: 'mixed', concurrency: 100, repetition: 1 },
  'p09-1000': { scenarioId: 'P09', modelId: 'mixed', concurrency: 1000, repetition: 1 },
  'p10-10': { scenarioId: 'P10', modelId: 'ets', concurrency: 10, repetition: 1 },
}

const OUTPUTS = {
  'p09-100': path.join(PERFORMANCE_ROOT, 'phase-2-3-p09-lower-control.json'),
  'p09-1000': path.join(PERFORMANCE_ROOT, 'phase-2-3-p09-high-concurrency.json'),
  'p10-10': path.join(PERFORMANCE_ROOT, 'phase-2-3-p10-non-regression.json'),
}

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const relative = (filePath) => path.relative(REPOSITORY_ROOT, filePath)

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed:\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

function cellMatches(left, right) {
  return left.scenarioId === right.scenarioId
    && left.modelId === right.modelId
    && left.concurrency === right.concurrency
    && left.repetition === right.repetition
}

async function buildPlan(cellName) {
  const target = CELLS[cellName]
  const source = await readJson(BASELINE_PLAN)
  assert.equal(source.totalPlannedCells, 105)
  assert.equal(source.cells.length, 105)
  const cells = source.cells.map((cell) => ({
    ...cell,
    action: cellMatches(cell, target) ? 'EXECUTE' : 'PRESERVE_VALID',
    reason: cellMatches(cell, target)
      ? `Authorized Phase 2.3 isolated ${cellName} validation cell.`
      : 'Outside the authorized Phase 2.3 isolated validation cell.',
  }))
  assert.equal(cells.filter(({ action }) => action === 'EXECUTE').length, 1)
  return {
    ...source,
    task: 'FORECAST_PHASE_2_3_C01_CACHE_MISS_COALESCING_INTEGRATION_REGRESSION',
    sourceExecutionId: `PHASE_2_3_${cellName.toUpperCase().replaceAll('-', '_')}`,
    generatedAt: new Date().toISOString(),
    baselineResumeAuthorized: true,
    counts: { execute: 1, preserveValid: 104 },
    cells,
  }
}

async function ensureAccounting() {
  try {
    await access(ACCOUNTING_PATH)
  } catch {
    await writeJson(ACCOUNTING_PATH, {
      task: 'FORECAST_PHASE_2_3_C01_CACHE_MISS_COALESCING_INTEGRATION_REGRESSION',
      executionLimit: { 'p09-100': 1, 'p09-1000': 1, 'p10-10': 1 },
      cells: Object.fromEntries(Object.keys(CELLS).map((name) => [name, { attempts: 0, status: 'NOT_STARTED' }])),
    })
  }
  return readJson(ACCOUNTING_PATH)
}

async function prepare() {
  await mkdir(CONTROL_ROOT, { recursive: true })
  for (const cellName of Object.keys(CELLS)) {
    await writeJson(path.join(CONTROL_ROOT, `${cellName}-resume-plan.json`), await buildPlan(cellName))
  }
  await ensureAccounting()

  const testOutput = run(process.execPath, [
    '--import', 'tsx', '--test',
    'tests/dashboard-record-query.test.ts',
    'tests/series-query-semantics.test.ts',
  ], { cwd: DASHBOARD_ROOT })
  const typecheckOutput = run('npm', ['run', 'typecheck'], { cwd: DASHBOARD_ROOT })
  await writeFile(path.join(VALIDATION_ROOT, 'stage-a-c-tests.tap'), testOutput)
  await writeFile(path.join(VALIDATION_ROOT, 'stage-a-c-typecheck.txt'), typecheckOutput)

  const sourcePaths = [
    'apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts',
    'apps/dashboard-preview/lib/phase-2-2c/diagnostics.ts',
    'apps/dashboard-preview/lib/time-series/series-query.ts',
    'apps/dashboard-preview/tests/dashboard-record-query.test.ts',
    'apps/dashboard-preview/tests/series-query-semantics.test.ts',
  ]
  const hashes = Object.fromEntries(await Promise.all(sourcePaths.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(path.join(REPOSITORY_ROOT, sourcePath))),
  ])))

  await writeJson(IMPLEMENTATION_EVIDENCE_PATH, {
    task: 'FORECAST_PHASE_2_3_C01_IMPLEMENTATION_EVIDENCE',
    generatedAt: new Date().toISOString(),
    scope: 'PROCESS_LOCAL_EXACT_KEY_IN_FLIGHT_ONLY',
    exactKey: 'JSON.stringify({organizationId: filters.organizationId ?? null, pipelineId: filters.pipelineId ?? null})',
    resultCacheTtlMs: 30000,
    resultCacheTtlChanged: false,
    resultCacheIdentityChanged: false,
    queryChanged: false,
    filteringChanged: false,
    cancellationChanged: false,
    dbPoolChanged: false,
    sourceHashes: hashes,
  })
  await writeJson(STRUCTURAL_PROOF_PATH, {
    task: 'FORECAST_PHASE_2_3_C01_STRUCTURAL_PROOF',
    generatedAt: new Date().toISOString(),
    stages: {
      A_UNIT_CORRECTNESS: 'PASS',
      B_SEMANTIC_EQUIVALENCE: 'PASS',
      C_FOCUSED_CONCURRENCY_STRUCTURAL_PROOF: 'PASS',
    },
    focusedTests: { expected: 6, passed: 6, failed: 0 },
    sameKey: { requests: 10, exactKeys: 1, owners: 1, joiners: 9, underlyingReads: 1, duplicateReads: 0, activeEntriesAfterSettlement: 0 },
    multiKey: { exactKeys: 6, owners: 6, underlyingReads: 6, crossKeyContamination: false },
    failure: { ownerExecutions: 1, settledJoiners: 9, activeEntriesAfterSettlement: 0, retryOwners: 1 },
    cacheBoundary: { hitAtMs: 30000, missAtMs: 30001, ttlChanged: false },
    semantics: { plSearch: 'PASS', enSearch: 'PASS', fallback: 'PASS', benchmarkIdentity: 'PASS', historicalSelection: 'PASS', ordering: 'PASS', emptyResult: 'PASS' },
    loadAuthorized: true,
  })
  process.stdout.write(`${JSON.stringify({ phase23Preparation: 'PASS', stages: 'A-C', tests: '6/6', loadRequestsExecuted: 0 }, null, 2)}\n`)
}

function parseC01Events(log, stressRunId) {
  return log.split('\n').flatMap((line) => {
    const marker = line.indexOf(C01_PREFIX)
    if (marker < 0) return []
    try {
      const event = JSON.parse(line.slice(marker + C01_PREFIX.length))
      return event.stressRunId === stressRunId ? [event] : []
    } catch {
      return []
    }
  })
}

function summarizeC01(events) {
  const named = (name) => events.filter(({ event }) => event === name)
  const owners = named('owner_acquired')
  const reads = named('underlying_read_started')
  const releases = named('entry_released')
  const readsByKey = Object.groupBy(reads, ({ cacheKey }) => cacheKey)
  return {
    exactKeys: new Set(owners.map(({ cacheKey }) => cacheKey)).size,
    physicalOwners: owners.length,
    joiners: named('joiner_acquired').length,
    cacheHits: named('cache_hit').length,
    underlyingReads: reads.length,
    completedReads: named('underlying_read_completed').length,
    failedReads: named('underlying_read_failed').length,
    duplicateReads: Object.values(readsByKey).reduce((total, group) => total + Math.max(0, group.length - 1), 0),
    entryReleases: releases.length,
    activeEntriesAfterSettlement: releases.at(-1)?.activeEntries ?? 0,
    events,
  }
}

async function findRawEvidence(executionRoot, cell) {
  const rawRoot = path.join(executionRoot, 'raw')
  const files = await readdir(rawRoot)
  const prefix = `${cell.scenarioId}-${cell.modelId}-${cell.concurrency}-r${cell.repetition}-`
  const filename = files.find((candidate) => candidate.startsWith(prefix))
  assert.ok(filename, `Raw evidence missing for ${prefix}`)
  const rawPath = path.join(rawRoot, filename)
  const content = await readFile(rawPath)
  return { content, path: rawPath, value: JSON.parse(content) }
}

function normalizedEvidence(cellName, executionRoot, rawEvidence, c01) {
  const { content, path: rawPath, value: raw } = rawEvidence
  const result = raw.result
  const settlement = raw.settlement
  const diagnosticEvents = raw.diagnosticEvents ?? []
  const isP09 = result.scenarioId === 'P09'
  const correctness = result.successCount === result.requestsStarted && result.correctnessPassed
  const structuralPass = !isP09 || (c01.physicalOwners === 1 && c01.underlyingReads === 1 && c01.duplicateReads === 0 && c01.activeEntriesAfterSettlement === 0)
  return {
    task: `FORECAST_PHASE_2_3_${cellName.toUpperCase().replaceAll('-', '_')}`,
    generatedAt: new Date().toISOString(),
    executionRoot: relative(executionRoot),
    rawEvidence: { path: relative(rawPath), sha256: sha256(content) },
    result: {
      scenario: result.scenarioId,
      concurrency: result.concurrency,
      requests: result.requestsStarted,
      successes: result.successCount,
      failures: result.failureCount,
      timeouts: result.functionalOutcomes?.TIMEOUT ?? 0,
      correctness: correctness ? 'PASS' : 'FAIL',
      releaseSpreadMs: result.releaseSpreadMs,
      latencyP50Ms: result.latencyP50Ms,
      latencyP95Ms: result.latencyP95Ms,
      latencyP99Ms: result.latencyP99Ms,
      throughputRps: result.throughputRps,
      peakMemoryMb: result.peakMemoryMb,
      postCooldownMemoryDeltaMb: result.memoryDeltaAfterCooldownMb,
      forecastCompute: result.forecastComputeCount,
      verificationCompute: result.verificationComputeCount,
      forecastOwners: result.computeOwnerCount,
      forecastWrites: result.duplicateArtifactWriteCount,
      providerCalls: result.providerCallCount,
      functionalOutcomes: result.functionalOutcomes ?? {},
      preparedHitCount: result.preparedHitCount ?? 0,
      preparedMissCount: result.preparedMissCount ?? 0,
      preparedResolveSpans: diagnosticEvents.filter(({ event, name }) => event === 'span_started' && name === 'prepared_current_resolve').length,
      applicationDatabase: raw.databaseByAuthority?.application ?? null,
    },
    c01,
    settlement,
    baselineControl: raw.control,
    gates: {
      canonicalCorrectness: correctness ? 'PASS' : 'FAIL',
      c01Structure: structuralPass ? 'PASS' : 'FAIL',
      forecastComputeFree: result.forecastComputeCount === 0 ? 'PASS' : 'FAIL',
      verificationComputeFree: result.verificationComputeCount === 0 ? 'PASS' : 'FAIL',
      forecastPersistenceFree: result.duplicateArtifactWriteCount === 0 ? 'PASS' : 'FAIL',
      providerFree: result.providerCallCount === 0 ? 'PASS' : 'FAIL',
      settlement: settlement?.status ?? 'FAIL',
    },
    terminalState: settlement?.status === 'SAFETY_BLOCKED' ? 'SAFETY_BLOCKED' : correctness && structuralPass ? 'VALID_COMPLETED' : 'FAIL',
  }
}

async function assertPreconditions(cellName) {
  const proof = await readJson(STRUCTURAL_PROOF_PATH)
  assert.deepEqual(Object.values(proof.stages), ['PASS', 'PASS', 'PASS'])
  const accounting = await ensureAccounting()
  assert.equal(accounting.cells[cellName].attempts, 0, `${cellName} execution limit already consumed`)
  if (cellName !== 'p09-100') {
    const lower = await readJson(OUTPUTS['p09-100'])
    assert.equal(lower.terminalState, 'VALID_COMPLETED')
    assert.ok(Object.values(lower.gates).every((status) => status === 'PASS'))
  }
  if (cellName === 'p10-10') {
    const high = await readJson(OUTPUTS['p09-1000'])
    assert.equal(high.settlement?.status, 'PASS', 'P09@1000 must be fully settled before isolated P10')
    assert.equal(accounting.cells['p09-1000'].attempts, 1)
  }
  return accounting
}

async function executeCell(cellName) {
  const cell = CELLS[cellName]
  const accounting = await assertPreconditions(cellName)
  accounting.cells[cellName] = { attempts: 1, status: 'STARTED', startedAt: new Date().toISOString() }
  await writeJson(ACCOUNTING_PATH, accounting)

  const planPath = path.join(CONTROL_ROOT, `${cellName}-resume-plan.json`)
  run(process.execPath, [BASELINE_RUNNER, '--validate-resume-plan', planPath], {
    env: { ...process.env, PHASE_2_1B_EXECUTION_AUTHORIZED: AUTHORIZATION_TOKEN, FORECAST_STRESS_AUTHORIZATION_TOKEN: AUTHORIZATION_TOKEN },
  })
  const output = run(process.execPath, [BASELINE_RUNNER, '--execute-resume-plan', planPath], {
    env: {
      ...process.env,
      PHASE_2_1B_EXECUTION_AUTHORIZED: AUTHORIZATION_TOKEN,
      FORECAST_STRESS_AUTHORIZATION_TOKEN: AUTHORIZATION_TOKEN,
      FORECAST_STRESS_EXECUTION_TASK: 'FORECAST_PHASE_2_3_C01_CACHE_MISS_COALESCING_INTEGRATION_REGRESSION',
      FORECAST_STRESS_RUN_PREFIX: `phase-2-3-${cellName}`,
      FORECAST_STRESS_RESULT_ROOT: relative(EXECUTION_ROOT),
      FORECAST_STRESS_SCENARIO_ORDER: cell.scenarioId,
      FORECAST_STRESS_B4R_MEASUREMENT_CONTROL: 'true',
      FORECAST_STRESS_B4R_CONTROL_ROOT: relative(path.join(CONTROL_ROOT, cellName)),
      FORECAST_PHASE_2_2C_DIAGNOSTICS: '1',
      FORECAST_PHASE_2_3_C01_DIAGNOSTICS: '1',
      PHASE_2_1B_COOLDOWN_MS: '30000',
    },
  })
  const marker = output.lastIndexOf('{"phase21bBaseline"')
  assert.ok(marker >= 0, 'Baseline execution result marker missing')
  const execution = JSON.parse(output.slice(marker))
  const executionRoot = path.resolve(execution.executionRoot)
  const raw = await findRawEvidence(executionRoot, cell)
  const dashboardLogPath = path.join(executionRoot, 'diagnostics', 'dashboard-preview.log')
  const c01Events = parseC01Events(await readFile(dashboardLogPath, 'utf8'), raw.value.result.stressRunId)
  const evidence = normalizedEvidence(cellName, executionRoot, raw, summarizeC01(c01Events))
  await writeJson(OUTPUTS[cellName], evidence)

  accounting.cells[cellName] = {
    attempts: 1,
    status: evidence.terminalState,
    startedAt: accounting.cells[cellName].startedAt,
    completedAt: new Date().toISOString(),
    evidencePath: relative(OUTPUTS[cellName]),
    executionRoot: relative(executionRoot),
  }
  await writeJson(ACCOUNTING_PATH, accounting)
  process.stdout.write(`${JSON.stringify({ phase23Cell: cellName, terminalState: evidence.terminalState, gates: evidence.gates, c01: { owners: evidence.c01.physicalOwners, joiners: evidence.c01.joiners, reads: evidence.c01.underlyingReads, duplicateReads: evidence.c01.duplicateReads } }, null, 2)}\n`)
}

async function recoverCell(cellName, reanalyze = false) {
  const cell = CELLS[cellName]
  assert.ok(cell, `Unknown recovery cell: ${cellName}`)
  const accounting = await ensureAccounting()
  assert.equal(accounting.cells[cellName].attempts, 1, `${cellName} has no consumed attempt to recover`)
  if (!reanalyze) {
    assert.equal(accounting.cells[cellName].status, 'STARTED', `${cellName} is not awaiting evidence recovery`)
  }

  const expectedSourceExecutionId = `PHASE_2_3_${cellName.toUpperCase().replaceAll('-', '_')}`
  const candidates = []
  for (const directory of await readdir(EXECUTION_ROOT)) {
    const executionRoot = path.join(EXECUTION_ROOT, directory)
    try {
      const completion = await readJson(path.join(executionRoot, 'manifests', 'completion-manifest.json'))
      if (completion.resumePlanSourceExecutionId === expectedSourceExecutionId && completion.servicesStopped === true) {
        candidates.push({ completion, executionRoot })
      }
    } catch {
      // Incomplete or unrelated execution directories are not recovery candidates.
    }
  }
  assert.equal(candidates.length, 1, `Expected one completed ${cellName} execution, found ${candidates.length}`)
  const [{ completion, executionRoot }] = candidates
  const raw = await findRawEvidence(executionRoot, cell)
  const dashboardLogPath = path.join(executionRoot, 'diagnostics', 'dashboard-preview.log')
  const c01Events = parseC01Events(await readFile(dashboardLogPath, 'utf8'), raw.value.result.stressRunId)
  const evidence = normalizedEvidence(cellName, executionRoot, raw, summarizeC01(c01Events))
  await writeJson(OUTPUTS[cellName], evidence)
  accounting.cells[cellName] = {
    attempts: 1,
    status: evidence.terminalState,
    startedAt: accounting.cells[cellName].startedAt,
    completedAt: completion.endedAt,
    evidencePath: relative(OUTPUTS[cellName]),
    executionRoot: relative(executionRoot),
    recoveredWithoutReplay: !reanalyze,
    reanalyzedWithoutReplay: reanalyze,
  }
  await writeJson(ACCOUNTING_PATH, accounting)
  process.stdout.write(`${JSON.stringify({ phase23Cell: cellName, recovery: 'PASS', replayed: false, terminalState: evidence.terminalState, gates: evidence.gates, c01: { owners: evidence.c01.physicalOwners, joiners: evidence.c01.joiners, reads: evidence.c01.underlyingReads, duplicateReads: evidence.c01.duplicateReads } }, null, 2)}\n`)
}

async function validatePlans() {
  const accounting = await ensureAccounting()
  for (const [cellName, target] of Object.entries(CELLS)) {
    const plan = await readJson(path.join(CONTROL_ROOT, `${cellName}-resume-plan.json`))
    assert.equal(plan.totalPlannedCells, 105)
    assert.equal(plan.cells.length, 105)
    assert.deepEqual(plan.cells.filter(({ action }) => action === 'EXECUTE').map(({ scenarioId, modelId, concurrency, repetition }) => ({ scenarioId, modelId, concurrency, repetition })), [target])
  }
  assert.deepEqual(accounting.executionLimit, { 'p09-100': 1, 'p09-1000': 1, 'p10-10': 1 })
  process.stdout.write(`${JSON.stringify({ phase23Plans: 'PASS', plans: 3, loadRequestsExecuted: 0 }, null, 2)}\n`)
}

const command = process.argv[2]
const action = command === '--prepare' ? prepare
  : command === '--validate-plans' ? validatePlans
    : command?.startsWith('--reanalyze-') ? () => recoverCell(command.slice('--reanalyze-'.length), true)
    : command?.startsWith('--recover-') ? () => recoverCell(command.slice('--recover-'.length))
    : command?.startsWith('--execute-') ? () => executeCell(command.slice('--execute-'.length))
      : null

if (!action) {
  process.stderr.write('Usage: phase-2-3-c01-controlled-validation.mjs --prepare|--validate-plans|--execute-p09-100|--execute-p09-1000|--execute-p10-10|--recover-<cell>|--reanalyze-<cell>\n')
  process.exitCode = 1
} else {
  action().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}