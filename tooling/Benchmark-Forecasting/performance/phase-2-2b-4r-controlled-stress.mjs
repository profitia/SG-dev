import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PERFORMANCE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const FORECAST_ROOT = path.resolve(PERFORMANCE_ROOT, '..')
const REPOSITORY_ROOT = path.resolve(FORECAST_ROOT, '..', '..')
const BASELINE_PLAN_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-1b-resume-plan.json')
const BEFORE_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2b-before-evidence.json')
const MATRIX_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2b-experiment-matrix.json')
const SAFETY_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2b-safety-matrix.json')
const ORIGINAL_B4_GATE_PATH = path.join(FORECAST_ROOT, 'validation', 'forecast-phase-2-2b-4-before-after-comparative-stress.json')
const PHASE_1R_GATE_PATH = path.join(FORECAST_ROOT, 'validation', 'forecast-phase-2-2b-1r-p04-small-pool-current-single-flight.json')
const PLAN_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2b-4r-execution-plan.json')
const BASELINE_RUNNER_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-1b-baseline.mjs')
const EVIDENCE_ROOT = path.join(FORECAST_ROOT, 'validation', 'phase-2-2b-4r')
const EXECUTION_ROOT = path.join(EVIDENCE_ROOT, 'executions')
const CONTROL_ROOT = path.join(EVIDENCE_ROOT, 'execution-control')
const ADAPTER_PATH = path.join(CONTROL_ROOT, 'baseline-execution-adapter.json')
const ACCOUNTING_PATH = path.join(CONTROL_ROOT, 'execution-accounting.json')
const ESCALATION_PATH = path.join(CONTROL_ROOT, 'escalation-audit.json')
const SOURCE_HASH_PATH = path.join(CONTROL_ROOT, 'source-hash-guard.json')
const AUTHORIZATION_TOKEN = 'FORECAST_PHASE_2_2B_4R_CONTROLLED_BEFORE_AFTER_COMPARATIVE_STRESS_RERUN'

const MODELS = ['naive', 'damped_holt', 'ets', 'arima']
const CONCURRENCY_LEVELS = [10, 100, 1000]
const TERMINAL_STATES = ['VALID_COMPLETED', 'SAFETY_BLOCKED', 'INVALID_STATE', 'CONTRACT_ABORTED']
const EXECUTION_SCENARIO_ORDER = ['P03', 'P04', 'P05', 'P08', 'P11', 'P01', 'P02', 'P06', 'P07', 'P09', 'P10']
const IMMUTABLE_ORIGINAL_B4_HASHES = {
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4-after-aggregate.json': '1e62ef689f27816cb777c711f6e9060627e898c6bb59811b358f137cc6584b8d',
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4-before-after-comparison.json': '028ad4fc879810a7819888085e205ac2b3fef5c151dac57ff9b3512dca1dc896',
  'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4-before-after-comparative-stress.json': 'c1d34137b9e279257c91aec2b765c73246534bbab88b590f49a0222fe5a70bbb',
}
const BEHAVIOR_SOURCE_PATHS = [
  'apps/sg-runtime/lib/forecast/current-single-flight.ts',
  'apps/sg-runtime/lib/forecast/rolling-daily-current-ownership.ts',
  'apps/sg-runtime/lib/forecast/rolling-daily-production-operations.ts',
  'apps/sg-runtime/lib/forecast/verification-single-flight.ts',
  'apps/sg-runtime/lib/forecast/service.ts',
]

const TARGETS = [
  {
    seriesId: 'wocaes0074',
    sourceFrequency: 'DAILY',
    targetCadence: 'DAILY',
    semantic: 'ROLLING_DAILY_POINT_IN_TIME',
    targetBasis: 'POINT_IN_TIME',
  },
  {
    seriesId: 'wocaes0280',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    semantic: 'MONTHLY_AVERAGE',
    targetBasis: 'MONTHLY_AVERAGE',
  },
  {
    seriesId: 'usnaac0169',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
    semantic: 'END_OF_PERIOD',
    targetBasis: 'END_OF_PERIOD',
  },
]

const SCENARIOS = {
  P01: scenario('HOT_READY', 'SAME_KEY', 'CURRENT', 1, 0, 'DENIED', 'STRUCTURALLY_COMPARABLE_ONLY'),
  P02: scenario('HOT_READY', 'SMALL_POOL', 'CURRENT', 3, 0, 'DENIED', 'STRUCTURALLY_COMPARABLE_ONLY'),
  P03: scenario('WARM_INPUT_READY_ARTIFACT_MISS', 'SAME_KEY', 'CURRENT', 1, 1, 'DENIED', 'FULLY_COMPARABLE'),
  P04: scenario('WARM_INPUT_READY_ARTIFACT_MISS', 'SMALL_POOL', 'CURRENT', 3, 3, 'DENIED', 'FULLY_COMPARABLE'),
  P05: scenario('COLD_INPUT_AND_ARTIFACT_MISS', 'SAME_KEY', 'CURRENT', 1, 1, 'ALLOWLIST_ONLY', 'FULLY_COMPARABLE'),
  P06: scenario('VERIFICATION_READY', 'SAME_KEY', 'VERIFICATION', 1, 0, 'DENIED', 'AFTER_ONLY'),
  P07: scenario('VERIFICATION_READY', 'SMALL_POOL', 'VERIFICATION', 3, 0, 'DENIED', 'AFTER_ONLY'),
  P08: scenario('VERIFICATION_MISS', 'SAME_KEY', 'VERIFICATION', 1, 1, 'DENIED', 'STRUCTURALLY_COMPARABLE_ONLY'),
  P09: scenario('UX_SEARCH_EXPAND_HISTORICAL', 'SMALL_POOL', 'NONE', 3, 0, 'DENIED', 'AFTER_ONLY'),
  P10: scenario('HOT_READY', 'SMALL_POOL', 'CURRENT', 3, 0, 'DENIED', 'STRUCTURALLY_COMPARABLE_ONLY'),
  P11: scenario('WARM_INPUT_READY_ARTIFACT_MISS', 'SAME_KEY', 'CURRENT', 1, 1, 'DENIED', 'STRUCTURALLY_COMPARABLE_ONLY'),
}

function scenario(state, distribution, operationFamily, expectedLogicalKeys, expectedOwners, providerPermission, beforeEvidenceClass) {
  return { state, distribution, operationFamily, expectedLogicalKeys, expectedOwners, providerPermission, beforeEvidenceClass }
}

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const relative = (filePath) => path.relative(REPOSITORY_ROOT, filePath)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  })
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed: ${(result.stderr || result.stdout).trim()}`)
  return result.stdout.trim()
}

async function writeJson(filePath, value, options) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, options)
}

async function sourceHashes() {
  return Object.fromEntries(await Promise.all(BEHAVIOR_SOURCE_PATHS.map(async (sourcePath) => [
    sourcePath,
    sha256(await readFile(path.join(REPOSITORY_ROOT, sourcePath))),
  ])))
}

async function verifyReference(reference) {
  const content = await readFile(path.join(REPOSITORY_ROOT, reference.path))
  assert.equal(sha256(content), reference.sha256, `Immutable BEFORE evidence changed: ${reference.path}`)
}

async function immutableBeforeReferences() {
  const before = await readJson(BEFORE_PATH)
  const references = []
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (typeof value.path === 'string' && typeof value.sha256 === 'string') references.push(value)
    Object.values(value).forEach(visit)
  }
  visit(before)
  await Promise.all(references.map(verifyReference))
  assert.equal(references.length, 22)
  return references
}

async function verifyHistoricalAuthorities() {
  const [originalGate, phase1rGate] = await Promise.all([
    readJson(ORIGINAL_B4_GATE_PATH),
    readJson(PHASE_1R_GATE_PATH),
  ])
  assert.equal(originalGate.phase22b4Gate, 'FAIL')
  assert.equal(originalGate.acceptanceConditions.passed, 92)
  assert.equal(originalGate.acceptanceConditions.expected, 96)
  assert.equal(phase1rGate.phase22b1rGate, 'PASS')
  for (const [authorityPath, expectedHash] of Object.entries(IMMUTABLE_ORIGINAL_B4_HASHES)) {
    const content = await readFile(path.join(REPOSITORY_ROOT, authorityPath))
    assert.equal(sha256(content), expectedHash, `Original B4 authority changed: ${authorityPath}`)
  }
  return {
    originalB4Gate: originalGate.phase22b4Gate,
    originalB4Conditions: `${originalGate.acceptanceConditions.passed}/${originalGate.acceptanceConditions.expected}`,
    phase22b1rGate: phase1rGate.phase22b1rGate,
  }
}

function selectedTargets(distribution) {
  return distribution === 'SAME_KEY' ? [TARGETS[1]] : TARGETS
}

function cellManifest(cell, metadata) {
  const modelId = cell.modelId === 'mixed' ? 'ets' : cell.modelId
  return {
    requestCount: cell.concurrency,
    distribution: metadata.distribution,
    assignment: metadata.distribution === 'SAME_KEY'
      ? `all ${cell.concurrency} requests target ${TARGETS[1].seriesId}`
      : `round-robin across ${TARGETS.map(({ seriesId }) => seriesId).join(', ')}`,
    targets: selectedTargets(metadata.distribution).map((target) => ({ ...target, modelId })),
    requestIdentityFields: [
      'requestId', 'virtualUserId', 'scenario', 'model', 'series', 'semantic', 'sourceFrequency',
      'targetCadence', 'state', 'concurrency', 'resolvedExactLogicalArtifactKey', 'expectedOwnerKey',
    ],
    persistencePath: `tooling/Benchmark-Forecasting/validation/phase-2-2b-4r/manifests/${cell.scenarioId}-${cell.modelId}-${cell.concurrency}-r${cell.repetition}.json`,
    status: 'MUST_PERSIST_BEFORE_WORKLOAD',
  }
}

function buildCells(baselineCells, matrixRows) {
  const matrixByScenario = new Map(matrixRows
    .filter(({ phase }) => phase === '2.2B-4')
    .flatMap((row) => row.experimentId === 'B4-PREPARED-REGRESSIONS'
      ? ['P01', 'P02', 'P06', 'P07', 'P09', 'P10'].map((scenarioId) => [scenarioId, row])
      : [[row.experimentId.slice(3, 6), row]]))
  let executionOrder = 0
  const ordered = [...baselineCells].sort((left, right) => {
    const scenarioDelta = EXECUTION_SCENARIO_ORDER.indexOf(left.scenarioId) - EXECUTION_SCENARIO_ORDER.indexOf(right.scenarioId)
    if (scenarioDelta !== 0) return scenarioDelta
    const modelDelta = MODELS.indexOf(left.modelId) - MODELS.indexOf(right.modelId)
    if (modelDelta !== 0) return modelDelta
    return left.concurrency - right.concurrency || left.repetition - right.repetition
  })
  return ordered.map((cell) => {
    const metadata = SCENARIOS[cell.scenarioId]
    const matrixRow = matrixByScenario.get(cell.scenarioId)
    assert.ok(metadata && matrixRow, `Missing frozen metadata for ${cell.scenarioId}`)
    executionOrder += 1
    return {
      cellId: `B4R-${cell.scenarioId}-${cell.modelId}-${cell.concurrency}-R${cell.repetition}`,
      scenario: cell.scenarioId,
      model: cell.modelId,
      state: metadata.state,
      sourceFrequency: selectedTargets(metadata.distribution).map(({ sourceFrequency }) => sourceFrequency),
      targetCadence: selectedTargets(metadata.distribution).map(({ targetCadence }) => targetCadence),
      semantic: selectedTargets(metadata.distribution).map(({ semantic }) => semantic),
      concurrency: cell.concurrency,
      repetition: cell.repetition,
      beforeEvidenceAuthority: `${relative(BEFORE_PATH)}#/scenarios/${cell.scenarioId}`,
      beforeEvidenceClass: metadata.beforeEvidenceClass,
      expectedLogicalKeys: metadata.expectedLogicalKeys,
      expectedOwnerRule: metadata.expectedOwners === 0
        ? 'ZERO_OWNERS_PREPARED_OR_COMPUTE_FREE'
        : `ONE_PHYSICAL_OWNER_PER_EXACT_CONCURRENTLY_MISSING_KEY; EXPECTED=${metadata.expectedOwners}`,
      derivedExpectedOwnerCount: metadata.expectedOwners,
      providerPermission: metadata.providerPermission,
      correctnessPrecondition: 'Exact canonical identity, values, semantics, cadence, method version, fingerprint, and response class must match the frozen state.',
      structuralPrecondition: matrixRow.precondition,
      stateProofRequired: [
        'inputHistoryState', 'currentPreparedArtifactState', 'verificationArtifactState', 'providerPermissionState',
        'databaseArtifactCount', 'historyFingerprint', 'logicalKeyCount',
      ],
      requestManifest: cellManifest(cell, metadata),
      safetyRules: matrixRow.safetyGate,
      cooldownRequirements: {
        activeHttpRequests: 0,
        activeCurrentSingleFlightEntries: 0,
        activeVerificationSingleFlightEntries: 0,
        inFlightCurrentCompute: 0,
        inFlightVerificationCompute: 0,
        cpuSettledDurationSeconds: 30,
        postCooldownRss: 'REQUIRED',
        dbPoolSettlement: 'REQUIRED',
      },
      executionOrder,
      escalationPredecessor: cell.concurrency === 10
        ? null
        : `B4R-${cell.scenarioId}-${cell.modelId}-${cell.concurrency === 100 ? 10 : 100}`,
      terminalStatus: 'NOT_STARTED',
      terminalReason: null,
    }
  })
}

async function createPlan() {
  const [baselinePlan, experimentMatrix, safetyMatrix, beforeReferences, historical] = await Promise.all([
    readJson(BASELINE_PLAN_PATH),
    readJson(MATRIX_PATH),
    readJson(SAFETY_PATH),
    immutableBeforeReferences(),
    verifyHistoricalAuthorities(),
  ])
  assert.equal(baselinePlan.totalPlannedCells, 105)
  assert.equal(baselinePlan.cells.length, 105)
  assert.equal(experimentMatrix.matrix.version, 1)
  assert.equal(safetyMatrix.matrix.version, 1)
  const cells = buildCells(baselinePlan.cells, experimentMatrix.rows)
  const plan = {
    plan: {
      name: 'FORECAST_PHASE_2_2B_4R_EXECUTION_PLAN',
      version: 1,
      phase: '2.2B-4R',
      authorized: true,
      measurementOnly: true,
      executionStarted: false,
      createdAt: new Date().toISOString(),
      plannedCellCount: cells.length,
      terminalCellCount: 0,
      contractVersions: {
        stressTestContractVersion: 1,
        measurementControlRevision: 2,
        singleFlightExperimentContractVersion: 1,
        contractDrift: false,
      },
      environment: {
        environmentId: 'phase-2-1-local-isolated-v1',
        databaseCloneAlias: 'phase-2-1-local-clone-v1',
        databaseHost: '127.0.0.1',
        databasePort: 55421,
        productionDatabaseMutation: false,
        remoteDatabaseMutation: false,
      },
      immutableEvidence: {
        beforeManifest: relative(BEFORE_PATH),
        beforeReferenceCount: beforeReferences.length,
        beforeHashVerification: 'PASS',
        originalB4Hashes: IMMUTABLE_ORIGINAL_B4_HASHES,
        originalB4HashVerification: 'PASS',
        historical,
      },
      executionRules: {
        scenarioOrder: EXECUTION_SCENARIO_ORDER,
        concurrencyOrder: CONCURRENCY_LEVELS,
        strictSequentialEscalation: true,
        noEscalationAfterStructuralCorrectnessOrSafetyStop: true,
        physicalOwnerTelemetryRequired: true,
        derivedOwnerTelemetryIsPrimary: false,
        stateResetBeforeEveryMissCell: true,
        p06p07ReadyPreparationBeforeLoad: true,
        terminalStates: TERMINAL_STATES,
      },
      runtimeBehaviorChangeExpected: false,
      executionPlanImmutableAfterFirstLoad: true,
    },
    cells,
  }
  await writeFile(PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' })
  return validatePlan()
}

async function validatePlan() {
  const [plan, baselinePlan, experimentMatrix] = await Promise.all([
    readJson(PLAN_PATH),
    readJson(BASELINE_PLAN_PATH),
    readJson(MATRIX_PATH),
  ])
  assert.equal(plan.plan.phase, '2.2B-4R')
  assert.equal(plan.plan.measurementOnly, true)
  assert.equal(plan.plan.executionStarted, false)
  assert.equal(plan.plan.plannedCellCount, 105)
  assert.equal(plan.cells.length, 105)
  assert.equal(new Set(plan.cells.map(({ cellId }) => cellId)).size, 105)
  assert.deepEqual(new Set(plan.cells.map(({ terminalStatus }) => terminalStatus)), new Set(['NOT_STARTED']))
  assert.deepEqual(new Set(plan.cells.map(({ concurrency }) => concurrency)), new Set(CONCURRENCY_LEVELS))
  assert.equal(plan.cells.filter(({ scenario }) => scenario === 'P04').length, 12)
  assert.ok(plan.cells.filter(({ scenario, concurrency }) => scenario === 'P04' && concurrency === 10)
    .every(({ expectedLogicalKeys, derivedExpectedOwnerCount }) => expectedLogicalKeys === 3 && derivedExpectedOwnerCount === 3))
  assert.ok(plan.cells.every(({ requestManifest }) => requestManifest.status === 'MUST_PERSIST_BEFORE_WORKLOAD'))
  assert.ok(plan.cells.every(({ cooldownRequirements }) => cooldownRequirements.postCooldownRss === 'REQUIRED'
    && cooldownRequirements.dbPoolSettlement === 'REQUIRED'))
  assert.equal(baselinePlan.cells.length, plan.cells.length)
  const frozenB4Rows = experimentMatrix.rows.filter(({ phase }) => phase === '2.2B-4')
  assert.equal(frozenB4Rows.length, 6)
  await Promise.all([immutableBeforeReferences(), verifyHistoricalAuthorities()])
  process.stdout.write(`${JSON.stringify({
    phase22b4rExecutionPlan: 'PASS',
    plannedCells: plan.cells.length,
    terminalNotStarted: plan.cells.length,
    p04Cells: 12,
    physicalOwnerTelemetryRequired: true,
    strictEscalation: true,
    loadRequestsExecuted: 0,
  }, null, 2)}\n`)
  return plan
}

function normalizeStatus(status) {
  if (status === 'ABORTED_BY_CONTRACT') return 'CONTRACT_ABORTED'
  if (TERMINAL_STATES.includes(status)) return status
  if (status === 'INVALID_MEASUREMENT' || status === 'INVALID_BURST_RUN') return 'INVALID_STATE'
  throw new Error(`Unknown terminal status ${status}`)
}

function terminalCells(planCells, matrix) {
  const observed = new Map(matrix
    .filter(({ repetition }) => repetition != null)
    .map((cell) => [`${cell.scenarioId}/${cell.model}/${cell.concurrency}/r${cell.repetition}`, cell]))
  const generic = new Map(matrix
    .filter(({ repetition }) => repetition == null)
    .map((cell) => [`${cell.scenarioId}/${cell.model}/${cell.concurrency}`, cell]))
  return planCells.map((cell) => {
    const model = cell.model
    const exact = observed.get(`${cell.scenario}/${model}/${cell.concurrency}/r${cell.repetition}`)
    const blocked = generic.get(`${cell.scenario}/${model}/${cell.concurrency}`)
    if (exact) {
      return {
        ...cell,
        terminalStatus: normalizeStatus(exact.status),
        terminalReason: exact.reason,
        stressRunId: exact.stressRunId,
      }
    }
    if (blocked) {
      return {
        ...cell,
        terminalStatus: normalizeStatus(blocked.status),
        terminalReason: blocked.reason,
        stressRunId: null,
      }
    }
    const earlierStop = matrix.find((candidate) => candidate.scenarioId === cell.scenario
      && candidate.model === model
      && (candidate.concurrency < cell.concurrency
        || (candidate.concurrency === cell.concurrency && (candidate.repetition ?? 0) < cell.repetition))
      && candidate.status !== 'VALID_COMPLETED')
    assert.ok(earlierStop, `No terminal evidence for ${cell.cellId}`)
    return {
      ...cell,
      terminalStatus: 'CONTRACT_ABORTED',
      terminalReason: `MANDATORY_STOP_AFTER_${earlierStop.status}:${earlierStop.reason ?? 'UNSPECIFIED'}`,
      stressRunId: null,
    }
  })
}

function buildEscalationAudit(cells) {
  const groups = Object.groupBy(cells, ({ scenario, model }) => `${scenario}/${model}`)
  return Object.entries(groups).map(([scenarioModel, group]) => {
    const [scenario, model] = scenarioModel.split('/')
    const levels = Object.fromEntries(CONCURRENCY_LEVELS.map((concurrency) => {
      const levelCells = group.filter((cell) => cell.concurrency === concurrency)
      const executed = levelCells.filter(({ stressRunId }) => stressRunId != null)
      const statuses = [...new Set(levelCells.map(({ terminalStatus }) => terminalStatus))]
      return [concurrency, {
        authorization: concurrency === 10
          ? 'AUTHORIZED_BY_PREFLIGHT'
          : levelCells.every(({ terminalStatus }) => terminalStatus === 'CONTRACT_ABORTED')
            ? 'DENIED_BY_PRECEDING_MANDATORY_STOP'
            : 'AUTHORIZED_BY_PRECEDING_LEVEL_PASS',
        executedCells: executed.length,
        terminalStatuses: statuses,
        reasons: [...new Set(levelCells.map(({ terminalReason }) => terminalReason).filter(Boolean))],
      }]
    }))
    return { scenario, model, levels }
  })
}

async function execute() {
  const plan = await validatePlan()
  const preflight = await readJson(path.join(EVIDENCE_ROOT, 'structural-preflight.json'))
  assert.equal(preflight.phase22b4rLoadAuthorizedByPreflight, true)
  assert.equal(preflight.tests.failed, 0)
  const beforeHashes = await sourceHashes()
  await writeJson(SOURCE_HASH_PATH, {
    task: 'FORECAST_PHASE_2_2B_4R_SOURCE_HASH_GUARD',
    capturedBeforeLoadAt: new Date().toISOString(),
    before: beforeHashes,
    after: null,
    behaviorSourceHashDrift: null,
  }, { flag: 'wx' })
  const baselinePlan = await readJson(BASELINE_PLAN_PATH)
  const adapter = {
    task: 'FORECAST_PHASE_2_2B_4R_CONTROLLED_BEFORE_AFTER_COMPARATIVE_STRESS_RERUN',
    contractVersion: 1,
    measurementControlRevision: 2,
    sourceExecutionId: null,
    generatedAt: new Date().toISOString(),
    baselineResumeAuthorized: true,
    originalEvidenceMutable: false,
    totalPlannedCells: 105,
    counts: { execute: 105 },
    cells: baselinePlan.cells.map((cell) => ({
      ...cell,
      previousRunId: null,
      previousClassification: null,
      action: 'EXECUTE',
      reason: 'Authorized by immutable B4R execution plan.',
      comparabilityClassification: 'B4R_FROZEN_MATRIX_CELL',
      futureStressRunIdRequired: true,
      mayReusePreviousStressRunId: false,
    })),
  }
  await writeJson(ADAPTER_PATH, adapter, { flag: 'wx' })
  const output = run(process.execPath, [BASELINE_RUNNER_PATH, '--execute-resume-plan', ADAPTER_PATH], {
    env: {
      ...process.env,
      PHASE_2_1B_EXECUTION_AUTHORIZED: AUTHORIZATION_TOKEN,
      FORECAST_STRESS_AUTHORIZATION_TOKEN: AUTHORIZATION_TOKEN,
      FORECAST_STRESS_EXECUTION_TASK: 'FORECAST_PHASE_2_2B_4R_CONTROLLED_BEFORE_AFTER_COMPARATIVE_STRESS_RERUN',
      FORECAST_STRESS_RUN_PREFIX: 'phase-2-2b-4r',
      FORECAST_STRESS_RESULT_ROOT: relative(EXECUTION_ROOT),
      FORECAST_STRESS_SCENARIO_ORDER: EXECUTION_SCENARIO_ORDER.join(','),
      FORECAST_STRESS_VERIFICATION_PREPARATION_SCRIPT: 'apps/sg-runtime/scripts/prepare-phase-2-2a-verification-ready.ts',
      FORECAST_STRESS_B4R_MEASUREMENT_CONTROL: 'true',
      FORECAST_STRESS_B4R_CONTROL_ROOT: relative(EVIDENCE_ROOT),
    },
  })
  const markerIndex = output.indexOf('{"phase21bBaseline"')
  assert.ok(markerIndex >= 0, 'B4R execution marker missing')
  const execution = JSON.parse(output.slice(markerIndex))
  const aggregatePath = path.join(EXECUTION_ROOT, execution.executionId, 'aggregated', 'baseline-results.json')
  const aggregate = await readJson(aggregatePath)
  const completedCells = terminalCells(plan.cells, aggregate.scenarioMatrix)
  assert.equal(completedCells.length, 105)
  assert.ok(completedCells.every(({ terminalStatus }) => TERMINAL_STATES.includes(terminalStatus)))
  const counts = Object.fromEntries(TERMINAL_STATES.map((status) => [status, completedCells.filter(({ terminalStatus }) => terminalStatus === status).length]))
  const accounting = {
    task: 'FORECAST_PHASE_2_2B_4R_EXECUTION_ACCOUNTING',
    generatedAt: new Date().toISOString(),
    executionId: execution.executionId,
    plannedCells: 105,
    validCompleted: counts.VALID_COMPLETED,
    safetyBlocked: counts.SAFETY_BLOCKED,
    invalidState: counts.INVALID_STATE,
    contractAborted: counts.CONTRACT_ABORTED,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    allTerminal: true,
    cells: completedCells.map(({ cellId, scenario, model, concurrency, repetition, terminalStatus, terminalReason, stressRunId }) => ({
      cellId, scenario, model, concurrency, repetition, terminalStatus, terminalReason, stressRunId,
    })),
  }
  assert.equal(accounting.total, accounting.plannedCells)
  const escalationAudit = {
    task: 'FORECAST_PHASE_2_2B_4R_ESCALATION_AUDIT',
    generatedAt: accounting.generatedAt,
    strictSequentialEscalation: true,
    noHigherLevelAfterMandatoryStop: true,
    scenarios: buildEscalationAudit(completedCells),
  }
  const afterHashes = await sourceHashes()
  assert.deepEqual(afterHashes, beforeHashes, 'Forecast behavior source drifted during B4R')
  await Promise.all([
    writeJson(ACCOUNTING_PATH, accounting, { flag: 'wx' }),
    writeJson(ESCALATION_PATH, escalationAudit, { flag: 'wx' }),
    writeJson(SOURCE_HASH_PATH, {
      task: 'FORECAST_PHASE_2_2B_4R_SOURCE_HASH_GUARD',
      capturedBeforeLoadAt: (await readJson(SOURCE_HASH_PATH)).capturedBeforeLoadAt,
      capturedAfterLoadAt: accounting.generatedAt,
      before: beforeHashes,
      after: afterHashes,
      behaviorSourceHashDrift: false,
    }),
    writeFile(PLAN_PATH, `${JSON.stringify({
      ...plan,
      plan: {
        ...plan.plan,
        executionStarted: true,
        executionId: execution.executionId,
        completedAt: accounting.generatedAt,
        terminalCellCount: 105,
      },
      cells: completedCells,
    }, null, 2)}\n`),
  ])
  process.stdout.write(`${JSON.stringify({ phase22b4r: 'EXECUTED', ...accounting }, null, 2)}\n`)
}

const command = process.argv[2]
if (command === '--create-plan') createPlan().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else if (command === '--validate-plan') validatePlan().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else if (command === '--execute') execute().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else {
  process.stderr.write('Usage: phase-2-2b-4r-controlled-stress.mjs --create-plan|--validate-plan|--execute\n')
  process.exitCode = 1
}