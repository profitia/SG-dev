import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PHASE_2_1_DATABASE_CLONE_ALIAS,
  assertPhase21DatabaseTarget,
} from './phase-2-1-database-guard.mjs'
import {
  evaluatePostRunGate,
  filterValidAggregateResults,
  PHASE_2_1B_MEASUREMENT_CONTROL_REVISION,
} from './phase-2-1b-measurement-control.mjs'
import { buildPhase21bResult, validatePhase21bResultShape } from './phase-2-1b-result.mjs'
import { MAXIMUM_RELEASE_SPREAD_MS, runSynchronizedBurst } from './stress-test-harness.mjs'

const PERFORMANCE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(PERFORMANCE_ROOT, '..', '..', '..')
const RUNTIME_ROOT = path.join(REPOSITORY_ROOT, 'apps', 'sg-runtime')
const DASHBOARD_ROOT = path.join(REPOSITORY_ROOT, 'apps', 'dashboard-preview')
const RESULT_ROOT = process.env.FORECAST_STRESS_RESULT_ROOT
  ? path.resolve(REPOSITORY_ROOT, process.env.FORECAST_STRESS_RESULT_ROOT)
  : path.join(PERFORMANCE_ROOT, 'results', 'phase-2-1', 'executions')
const ENVIRONMENT_SCRIPT = path.join(PERFORMANCE_ROOT, 'phase-2-1-environment.mjs')
const OPERATION_SCRIPT = path.join(RUNTIME_ROOT, 'scripts', 'run-forecast-phase-2-1b-operation.ts')
const VERIFICATION_PREPARATION_SCRIPT = process.env.FORECAST_STRESS_VERIFICATION_PREPARATION_SCRIPT
  ? path.resolve(REPOSITORY_ROOT, process.env.FORECAST_STRESS_VERIFICATION_PREPARATION_SCRIPT)
  : null
const APPLICATION_DATABASE_URL = 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_app'
const MARKET_DATA_DATABASE_URL = 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'
const SG_RUNTIME_BASE_URL = 'http://127.0.0.1:3001'
const DASHBOARD_BASE_URL = 'http://127.0.0.1:3002'
const AUTHORIZATION_TOKEN = process.env.FORECAST_STRESS_AUTHORIZATION_TOKEN ?? 'FORECAST_PHASE_2_1B_AS_IS_BASELINE'
const EXECUTION_TASK = process.env.FORECAST_STRESS_EXECUTION_TASK ?? 'FORECAST_PHASE_2_1B_AS_IS_BASELINE_STRESS_EXECUTION'
const STRESS_RUN_PREFIX = process.env.FORECAST_STRESS_RUN_PREFIX ?? 'phase-2-1b'
const COOLDOWN_MS = Number(process.env.PHASE_2_1B_COOLDOWN_MS ?? 30_000)
const B4R_MEASUREMENT_CONTROL = process.env.FORECAST_STRESS_B4R_MEASUREMENT_CONTROL === 'true'
const B4R_CONTROL_ROOT = process.env.FORECAST_STRESS_B4R_CONTROL_ROOT
  ? path.resolve(REPOSITORY_ROOT, process.env.FORECAST_STRESS_B4R_CONTROL_ROOT)
  : null
const PHASE_2_2C_DIAGNOSTICS = process.env.FORECAST_PHASE_2_2C_DIAGNOSTICS === '1'
const PHASE_1R_GATE_PATH = path.join(PERFORMANCE_ROOT, '..', 'validation', 'forecast-phase-2-2b-1r-p04-small-pool-current-single-flight.json')
const EXECUTABLE_RESUME_ACTIONS = new Set(['RERUN', 'EXECUTE', 'REVALIDATE_DEPENDENCY'])

const PRIMARY_COHORT = [
  { seriesId: 'wocaes0074', frequency: 'DAILY', targetBasis: 'POINT_IN_TIME', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', sourceFrequency: 'DAILY', targetCadence: 'DAILY' },
  { seriesId: 'wocaes0280', frequency: 'MONTHLY', targetBasis: 'MONTHLY_AVERAGE', targetSemantics: 'MONTHLY_AVERAGE', sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY' },
  { seriesId: 'usnaac0169', frequency: 'QUARTERLY', targetBasis: 'END_OF_PERIOD', targetSemantics: 'END_OF_PERIOD', sourceFrequency: 'QUARTERLY', targetCadence: 'QUARTERLY' },
]
const MODELS = ['naive', 'damped_holt', 'ets', 'arima']
const LEVELS = [10, 100, 1000]
const SCENARIOS = {
  P01: { snapshotIds: ['SNAPSHOT_HOT_READY'], transport: 'runtime-current', distribution: 'SAME_KEY', repetitions: 3, models: ['ets'] },
  P02: { snapshotIds: ['SNAPSHOT_HOT_READY'], transport: 'runtime-current', distribution: 'SMALL_POOL', repetitions: 3, models: ['ets'] },
  P03: { snapshotIds: ['SNAPSHOT_WARM_CURRENT_MISS'], transport: 'worker-current', distribution: 'SAME_KEY', repetitions: 1, models: MODELS },
  P04: { snapshotIds: ['SNAPSHOT_WARM_CURRENT_MISS'], transport: 'worker-current', distribution: 'SMALL_POOL', repetitions: 1, models: MODELS },
  P05: { snapshotIds: ['SNAPSHOT_COLD_CURRENT_MISS'], transport: 'worker-current', distribution: 'SAME_KEY', repetitions: 1, models: ['ets'], precheck: true },
  P06: { snapshotIds: ['SNAPSHOT_VERIFICATION_READY'], transport: 'runtime-verification', distribution: 'SAME_KEY', repetitions: 3, models: ['ets'] },
  P07: { snapshotIds: ['SNAPSHOT_VERIFICATION_READY'], transport: 'runtime-verification', distribution: 'SMALL_POOL', repetitions: 3, models: ['ets'] },
  P08: { snapshotIds: ['SNAPSHOT_VERIFICATION_MISS'], transport: 'worker-verification', distribution: 'SAME_KEY', repetitions: 1, models: MODELS, precheck: true },
  P09: { snapshotIds: ['SNAPSHOT_HOT_READY', 'SNAPSHOT_UX_READY'], transport: 'dashboard-history', distribution: 'SMALL_POOL', repetitions: 3, models: ['mixed'] },
  P10: { snapshotIds: ['SNAPSHOT_HOT_READY', 'SNAPSHOT_UX_READY'], transport: 'dashboard-current', distribution: 'SMALL_POOL', repetitions: 3, models: ['ets'] },
  P11: { snapshotIds: ['SNAPSHOT_WARM_CURRENT_MISS', 'SNAPSHOT_UX_READY'], transport: 'dashboard-current', distribution: 'SAME_KEY', repetitions: 1, models: MODELS },
}
const SCENARIO_ORDER = process.env.FORECAST_STRESS_SCENARIO_ORDER
  ? process.env.FORECAST_STRESS_SCENARIO_ORDER.split(',')
  : Object.keys(SCENARIOS)

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs))

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: REPOSITORY_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options })
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed: ${(result.stderr || result.stdout).trim()}`)
  }
  return result.stdout.trim()
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(500)
    socket.once('connect', () => {
      socket.destroy()
      reject(new Error(`Port ${port} is occupied; refusing to use an unowned service.`))
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve()
    })
    socket.once('error', () => resolve())
  })
}

function startService(name, cwd, env, telemetryEvents, diagnosticEvents = []) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    detached: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  let lineBuffer = ''
  const append = (chunk) => {
    const text = chunk.toString()
    output = `${output}${text}`.slice(-2_000_000)
    lineBuffer += text
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const prefix = '[FORECAST_STRESS_TELEMETRY] '
      const marker = line.indexOf(prefix)
      if (marker >= 0) {
        try {
          telemetryEvents.push(JSON.parse(line.slice(marker + prefix.length)))
        } catch {
          // Full service output remains available in diagnostics.
        }
      }
      const diagnosticPrefix = '[FORECAST_PHASE_2_2C_DIAGNOSTIC] '
      const diagnosticMarker = line.indexOf(diagnosticPrefix)
      if (diagnosticMarker >= 0) {
        try {
          diagnosticEvents.push(JSON.parse(line.slice(diagnosticMarker + diagnosticPrefix.length)))
        } catch {
          // Full service output remains available in diagnostics.
        }
      }
    }
  }
  child.stdout.on('data', append)
  child.stderr.on('data', append)
  return { name, child, output: () => output, diagnosticEvents }
}

async function stopService(service) {
  if (!service || service.child.exitCode !== null || !service.child.pid) return
  try {
    process.kill(-service.child.pid, 'SIGTERM')
  } catch {
    return
  }
  await Promise.race([once(service.child, 'exit'), delay(5000)])
  if (service.child.exitCode === null) {
    try {
      process.kill(-service.child.pid, 'SIGKILL')
    } catch {
      // It exited between checks.
    }
  }
}

async function waitForResponse(service, url, validate) {
  let lastError
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (service.child.exitCode !== null) throw new Error(`${service.name} exited before readiness.\n${service.output()}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
      const body = await response.text()
      const accepted = validate(response, body)
      if (accepted) return accepted
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(500)
  }
  throw new Error(`${service.name} did not become ready: ${lastError?.message ?? 'unknown'}\n${service.output()}`)
}

function localEnvironment(providerEnabled = false) {
  return {
    APP_ENV: 'development',
    NODE_ENV: 'development',
    NEXT_PUBLIC_APP_URL: SG_RUNTIME_BASE_URL,
    DATABASE_URL: APPLICATION_DATABASE_URL,
    SG_RUNTIME_DATABASE_URL: APPLICATION_DATABASE_URL,
    SG_RUNTIME_DIRECT_URL: APPLICATION_DATABASE_URL,
    MARKET_DATA_DATABASE_URL,
    MARKET_DATA_DIRECT_URL: MARKET_DATA_DATABASE_URL,
    FORECAST_STRESS_TELEMETRY_ENABLED: 'true',
    FORECAST_STRESS_ENVIRONMENT_ID: 'phase-2-1-local-isolated-v1',
    FORECAST_STRESS_DATABASE_CLONE_ALIAS: PHASE_2_1_DATABASE_CLONE_ALIAS,
    FORECAST_STRESS_PROVIDER_ENABLED: providerEnabled ? 'true' : 'false',
    FORECAST_STRESS_PROVIDER_ALLOWLIST: providerEnabled ? 'wocaes0074' : '',
    SG_RUNTIME_DEV_ORG_ID: 'phase-2-1b-org',
    SG_RUNTIME_DEV_USER_ID: 'phase-2-1b-user',
    SG_RUNTIME_DEV_ORG_ROLE: 'developer',
    SG_RUNTIME_BASE_URL,
    SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN: 'phase-2-1b-local-only-token',
  }
}

function assertExecutionAuthorization() {
  if (process.env.PHASE_2_1B_EXECUTION_AUTHORIZED !== AUTHORIZATION_TOKEN) {
    throw new Error(`Phase 2.1B execution requires PHASE_2_1B_EXECUTION_AUTHORIZED=${AUTHORIZATION_TOKEN}`)
  }
  assertPhase21DatabaseTarget({ databaseUrl: APPLICATION_DATABASE_URL, cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS, role: 'application' })
  assertPhase21DatabaseTarget({ databaseUrl: MARKET_DATA_DATABASE_URL, cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS, role: 'marketData' })
}

function validateReadiness() {
  const result = spawnSync(process.execPath, ['--test', path.join(PERFORMANCE_ROOT, 'phase-2-1-readiness.test.mjs')], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  })
  const allConditionsPassed = result.stdout.includes('validates all 27 readiness conditions')
  const loadLockPassed = result.stdout.includes('never unlocks mandatory load concurrency')
  const passCount = /(?:#|ℹ) pass 2/.test(result.stdout)
  const zeroFailures = /(?:#|ℹ) fail 0/.test(result.stdout)
  if (result.status !== 0 || !allConditionsPassed || !loadLockPassed || !passCount || !zeroFailures) {
    throw new Error(`Phase 2.1 readiness is not 27/27 PASS.\n${result.stdout}\n${result.stderr}`)
  }
}

function validateTelemetryGuard() {
  const source = "import { resolveForecastStressTelemetryEnabled } from './lib/forecast/stress-telemetry.ts'; if (!resolveForecastStressTelemetryEnabled(process.env)) process.exit(1)"
  run(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], {
    cwd: RUNTIME_ROOT,
    env: { ...process.env, ...localEnvironment(false) },
  })
}

async function loadResumePlan(planPath, { requireAuthorization }) {
  const plan = JSON.parse(await readFile(path.resolve(planPath), 'utf8'))
  if (plan.contractVersion !== 1 || plan.measurementControlRevision !== PHASE_2_1B_MEASUREMENT_CONTROL_REVISION) {
    throw new Error('Resume plan contract or measurement-control revision mismatch.')
  }
  if (plan.totalPlannedCells !== 105 || plan.cells?.length !== 105) {
    throw new Error('Resume plan must contain exactly 105 planned cells.')
  }
  const keys = plan.cells.map(({ scenarioId, modelId, concurrency, repetition }) => `${scenarioId}/${modelId}/${concurrency}/r${repetition}`)
  if (new Set(keys).size !== 105) throw new Error('Resume plan contains duplicate cells.')
  if (requireAuthorization && plan.baselineResumeAuthorized !== true) {
    throw new Error('Resume plan does not authorize baseline execution.')
  }
  return plan
}

function restoreSnapshots(snapshotIds) {
  for (const snapshotId of snapshotIds) {
    run(process.execPath, [ENVIRONMENT_SCRIPT, 'restore-mc', snapshotId])
    run(process.execPath, [ENVIRONMENT_SCRIPT, 'validate-state', snapshotId])
    if (snapshotId === 'SNAPSHOT_HOT_READY' || snapshotId === 'SNAPSHOT_WARM_CURRENT_MISS') {
      run(process.execPath, [ENVIRONMENT_SCRIPT, 'validate-mc-state', snapshotId])
    }
  }
}

function gitValue(args) {
  return run('git', args)
}

function utcFileStamp() {
  return new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')
}

async function writeImmutable(filePath, value) {
  await writeFile(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
}

function telemetryFromOutput(output) {
  return output.split('\n').flatMap((line) => {
    const prefix = '[FORECAST_STRESS_TELEMETRY] '
    const marker = line.indexOf(prefix)
    if (marker < 0) return []
    try {
      return [JSON.parse(line.slice(marker + prefix.length))]
    } catch {
      return []
    }
  })
}

function workerResultsFromOutput(output) {
  const prefix = '[FORECAST_STRESS_WORKER_RESULT] '
  const line = output.split('\n').find((candidate) => candidate.startsWith(prefix))
  if (!line) throw new Error('Compute worker did not emit its structured result.')
  return JSON.parse(line.slice(prefix.length))
}

function targetFor(distribution, index) {
  return distribution === 'SAME_KEY' ? PRIMARY_COHORT[1] : PRIMARY_COHORT[index % PRIMARY_COHORT.length]
}

function logicalArtifactKey(target, model, historyFingerprint) {
  return [target.seriesId, target.targetSemantics, target.sourceFrequency, target.targetCadence, model,
    target.targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1',
    historyFingerprint].join('|')
}

function snapshotFingerprint(snapshotManifest, snapshotId, target) {
  const snapshot = snapshotManifest.snapshots.find((entry) => entry.snapshotId === snapshotId)
  const cohort = snapshot?.state?.cohort?.find(({ seriesId }) => seriesId === target.seriesId)
  return {
    seriesId: target.seriesId,
    frequency: target.frequency,
    lawfulObservationCount: cohort?.observationCount ?? 0,
    historyStart: cohort?.historyStart ? `${cohort.historyStart.replace(/Z$/, '')}Z` : '1970-01-01T00:00:00.000Z',
    historyEnd: cohort?.historyEnd ? `${cohort.historyEnd.replace(/Z$/, '')}Z` : '1970-01-01T00:00:00.000Z',
    historyFingerprint: cohort?.historyFingerprint ?? 'ABSENT_BY_CONTRACT',
    targetSemantics: target.targetSemantics,
    horizon: 'CONTRACT_DEFAULT',
  }
}

function dbMetrics(databaseUrl = MARKET_DATA_DATABASE_URL) {
  const sql = `SELECT json_build_object('commits',xact_commit,'rollbacks',xact_rollback,'read',tup_returned,'fetched',tup_fetched,'inserted',tup_inserted,'updated',tup_updated,'deleted',tup_deleted,'deadlocks',deadlocks) FROM pg_stat_database WHERE datname=current_database()`
  const output = run('/opt/homebrew/opt/postgresql@18/bin/psql', [databaseUrl, '-X', '-At', '-c', sql])
  return JSON.parse(output)
}

function dbPoolMetrics(databaseUrl) {
  const sql = `SELECT json_build_object('activeConnections',count(*) FILTER (WHERE state='active'),'idleConnections',count(*) FILTER (WHERE state='idle'),'waitingRequests',count(*) FILTER (WHERE wait_event IS NOT NULL AND state<>'idle'),'totalConnections',count(*)) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`
  const output = run('/opt/homebrew/opt/postgresql@18/bin/psql', [databaseUrl, '-X', '-At', '-c', sql])
  return JSON.parse(output)
}

function dbActivitySnapshot(databaseUrl) {
  const sql = `SELECT COALESCE(json_agg(row_to_json(activity)), '[]'::json) FROM (SELECT pid, usename, application_name, client_addr::text, backend_start, xact_start, query_start, state_change, state, wait_event_type, wait_event, ROUND(EXTRACT(EPOCH FROM (clock_timestamp()-query_start))*1000) AS query_age_ms, ROUND(EXTRACT(EPOCH FROM (clock_timestamp()-xact_start))*1000) AS transaction_age_ms FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() ORDER BY pid) activity`
  const output = run('/opt/homebrew/opt/postgresql@18/bin/psql', [databaseUrl, '-X', '-At', '-c', sql])
  return JSON.parse(output)
}

function processTreeSnapshot(rootPid) {
  const result = spawnSync('ps', ['-axo', 'pid=,ppid=,rss=,time='], { encoding: 'utf8' })
  if (result.status !== 0) return { rootPid, processCount: 0, rssMb: 0, cpuTime: [] }
  const rows = result.stdout.trim().split('\n').flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/)
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), rssKb: Number(match[3]), cpuTime: match[4].trim() }] : []
  })
  const owned = new Set([rootPid])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (owned.has(row.ppid) && !owned.has(row.pid)) {
        owned.add(row.pid)
        changed = true
      }
    }
  }
  const ownedRows = rows.filter(({ pid }) => owned.has(pid))
  return {
    rootPid,
    processCount: ownedRows.length,
    rssMb: Number((ownedRows.reduce((sum, { rssKb }) => sum + rssKb, 0) / 1024).toFixed(6)),
    cpuTime: ownedRows.map(({ pid, cpuTime }) => ({ pid, cpuTime })),
  }
}

function dbDelta(before, after) {
  return {
    queryCount: null,
    writeCount: Math.max(0, after.inserted - before.inserted) + Math.max(0, after.updated - before.updated) + Math.max(0, after.deleted - before.deleted),
    transactionCommits: Math.max(0, after.commits - before.commits),
    transactionRollbacks: Math.max(0, after.rollbacks - before.rollbacks),
    rowsReturned: Math.max(0, after.read - before.read),
    rowsFetched: Math.max(0, after.fetched - before.fetched),
    deadlocks: Math.max(0, after.deadlocks - before.deadlocks),
  }
}

function buildContexts({ scenarioId, concurrency, model, distribution, fingerprint, precheck = false }) {
  const stressRunId = `${STRESS_RUN_PREFIX}-${scenarioId.toLowerCase()}-${concurrency}-${model}-${randomUUID()}`
  return Array.from({ length: concurrency }, (_, index) => {
    const target = targetFor(distribution, index)
    return {
      stressRunId,
      scenarioId,
      virtualUserId: `vu-${index + 1}`,
      requestId: `${stressRunId}-request-${index + 1}`,
      forecastIdentity: `${target.seriesId}|${target.targetSemantics}|${model}`,
      logicalArtifactKey: logicalArtifactKey(target, model, fingerprint.historyFingerprint),
      operation: scenarioId === 'P08' ? 'VERIFICATION' : 'CURRENT',
      seriesId: target.seriesId,
      modelId: model,
      targetBasis: target.targetBasis,
      targetSemantics: target.targetSemantics,
      sourceFrequency: target.sourceFrequency,
      targetCadence: target.targetCadence,
      precheck,
    }
  })
}

async function acceptedCurrentOwnerKeys(modelId) {
  const gate = JSON.parse(await readFile(PHASE_1R_GATE_PATH, 'utf8'))
  const property = modelId === 'damped_holt' ? 'dampedHolt' : modelId
  const modelEvidence = gate.after?.[property]
  if (!modelEvidence) return new Map()
  return new Map(modelEvidence.perKey.map(({ logicalArtifactKey }) => {
    const seriesId = /\|8:seriesId\d+:([^|]+)/.exec(logicalArtifactKey)?.[1]
    return [seriesId, logicalArtifactKey]
  }))
}

function verificationOwnerKey(modelId) {
  return `9:namespace12:VERIFICATION|8:seriesId10:wocaes0280|11:targetBasis15:MONTHLY_AVERAGE|15:targetSemantics15:MONTHLY_AVERAGE|8:methodId15:MONTHLY_AVERAGE|13:methodVersion35:benchmark-forecasting-mvp-phase2-v1|7:modelId${modelId.length}:${modelId}|11:inputSource25:DYNAMIC_MARKET_DATA_STORE|18:historyFingerprint64:d83f96bed5b7699bb359e7c76def50787571f43d7560f3aa07e4850f3a02d9b6|15:sourceFrequency7:MONTHLY|13:targetCadence7:MONTHLY|17:frequencyIdentity49:FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY|24:verificationHorizonSetId31:{"12M":12,"1M":1,"3M":3,"6M":6}|27:verificationConfigurationId24:{"minTrainingWindow":36}|14:originPolicyId66:EXPANDING_WINDOW_ROLLING_ORIGIN@expanding-window-rolling-origin-v1`
}

async function persistB4rPreloadEvidence({ contexts, scenarioId, scenario, model, concurrency, repetition, snapshotManifest }) {
  if (!B4R_MEASUREMENT_CONTROL || !B4R_CONTROL_ROOT) return null
  const modelId = model === 'mixed' ? 'ets' : model
  const currentKeys = await acceptedCurrentOwnerKeys(modelId)
  const snapshot = snapshotManifest.snapshots.find(({ snapshotId }) => snapshotId === scenario.snapshotIds[0])
  const requests = contexts.map((context) => ({
    requestId: context.requestId,
    virtualUserId: context.virtualUserId,
    scenario: scenarioId,
    model: modelId,
    series: context.seriesId,
    semantic: context.targetSemantics,
    cadence: context.targetCadence,
    sourceFrequency: context.sourceFrequency,
    state: snapshot?.snapshotId,
    concurrency,
    resolvedExactLogicalArtifactKey: scenarioId === 'P08'
      ? verificationOwnerKey(modelId)
      : currentKeys.get(context.seriesId) ?? context.logicalArtifactKey,
    expectedOwnerKey: ['P03', 'P04', 'P05', 'P08', 'P11'].includes(scenarioId)
      ? (scenarioId === 'P08' ? verificationOwnerKey(modelId) : currentKeys.get(context.seriesId) ?? context.logicalArtifactKey)
      : null,
  }))
  const requestManifest = {
    task: EXECUTION_TASK,
    persistedBeforeLoad: true,
    generatedAt: new Date().toISOString(),
    scenario: scenarioId,
    model,
    concurrency,
    repetition,
    requestDistribution: scenario.distribution,
    requests,
  }
  const stateProof = {
    task: EXECUTION_TASK,
    recordedBeforeLoad: true,
    generatedAt: new Date().toISOString(),
    scenario: scenarioId,
    model,
    concurrency,
    repetition,
    snapshotId: snapshot?.snapshotId,
    snapshotHash: snapshot?.sha256,
    inputHistoryState: snapshot?.state?.cohort ?? [],
    currentPreparedArtifactState: snapshot?.state?.currentBySeries ?? {},
    verificationArtifactState: (scenarioId === 'P06' || scenarioId === 'P07')
      ? 'EXACT_PHASE_2_2A_READY_PREPARATION_EXECUTED'
      : snapshot?.state?.verificationBySeries ?? {},
    providerPermissionState: scenario === SCENARIOS.P05 ? 'ALLOWLIST_ONLY_WOCAES0074' : 'DENIED',
    databaseArtifactCount: {
      currentRuns: snapshot?.state?.currentRuns ?? null,
      verificationRuns: snapshot?.state?.verificationRuns ?? null,
    },
    historyFingerprint: Object.fromEntries((snapshot?.state?.cohort ?? []).map(({ seriesId, historyFingerprint }) => [seriesId, historyFingerprint])),
    logicalKeyCount: scenario.distribution === 'SAME_KEY' ? 1 : 3,
    restoreValidation: 'PASS',
  }
  const baseName = `${scenarioId}-${model}-${concurrency}-r${repetition}`
  const manifestPath = path.join(B4R_CONTROL_ROOT, 'manifests', `${baseName}.json`)
  const proofPath = path.join(B4R_CONTROL_ROOT, 'state-proofs', `${baseName}.json`)
  await Promise.all([mkdir(path.dirname(manifestPath), { recursive: true }), mkdir(path.dirname(proofPath), { recursive: true })])
  await writeImmutable(manifestPath, requestManifest)
  await writeImmutable(proofPath, stateProof)
  return {
    requestManifestPath: path.relative(REPOSITORY_ROOT, manifestPath),
    requestManifestHash: createHash('sha256').update(JSON.stringify(requestManifest)).digest('hex'),
    stateProofPath: path.relative(REPOSITORY_ROOT, proofPath),
    stateProofHash: createHash('sha256').update(JSON.stringify(stateProof)).digest('hex'),
  }
}

async function executeWorkerWave({ contexts, scenario, runPaths, precheck }) {
  const inputPath = path.join(runPaths.diagnostics, `${contexts[0].stressRunId}-worker-input.json`)
  await writeImmutable(inputPath, contexts)
  const args = ['--import', 'tsx', OPERATION_SCRIPT, `--requests-file=${inputPath}`]
  if (precheck) args.push('--precheck')
  const result = spawnSync(process.execPath, args, {
    cwd: RUNTIME_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ...localEnvironment(scenario === SCENARIOS.P05) },
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  await writeImmutable(path.join(runPaths.diagnostics, `${contexts[0].stressRunId}-worker.log`), output)
  if (result.status !== 0) throw new Error(`Compute worker failed.\n${output.slice(-12000)}`)
  return { requests: workerResultsFromOutput(output), events: telemetryFromOutput(output) }
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(120_000) })
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { status: 'FAILED', reason: text.slice(0, 1000) }
  }
  return { httpStatus: response.status, payload }
}

async function executeHttpWave({ contexts, scenario, runtimeService, dashboardService }) {
  const stressRunId = contexts[0].stressRunId
  const telemetryStart = runtimeService.telemetryEvents.length
  const diagnosticStart = dashboardService.diagnosticEvents.length
  const burst = await runSynchronizedBurst({
    virtualUsers: contexts.length,
    stressRunId,
    scenarioId: contexts[0].scenarioId,
    operation: async ({ virtualUserId, requestId }) => {
      const context = contexts[Number(virtualUserId.slice(3)) - 1]
      const query = new URLSearchParams({
        seriesId: context.seriesId,
        model: context.modelId,
        targetBasis: context.targetBasis,
        sourceFrequency: context.sourceFrequency,
        targetCadence: context.targetCadence,
      })
      const headers = {
        'x-sg-stress-run-id': stressRunId,
        'x-sg-stress-scenario-id': context.scenarioId,
        'x-sg-stress-virtual-user-id': virtualUserId,
        'x-sg-stress-logical-artifact-key': context.logicalArtifactKey,
        'x-request-id': requestId,
      }
      if (scenario.transport === 'dashboard-history') {
        const componentResponse = await fetchJson(`${DASHBOARD_BASE_URL}/api/components?locale=pl&q=${context.seriesId}`, headers)
        const seriesResponse = await fetchJson(`${DASHBOARD_BASE_URL}/api/series?locale=pl&seriesId=${context.seriesId}&historyMonths=12&showForecast=false`, headers)
        return {
          httpStatus: Math.max(componentResponse.httpStatus, seriesResponse.httpStatus),
          payload: {
            status: Array.isArray(seriesResponse.payload?.historical) && seriesResponse.payload.historical.length > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE',
            componentCount: componentResponse.payload?.items?.length ?? 0,
            historicalPointCount: seriesResponse.payload?.historical?.length ?? 0,
          },
        }
      }
      const base = scenario.transport.startsWith('dashboard') ? DASHBOARD_BASE_URL : SG_RUNTIME_BASE_URL
      const route = scenario.transport.endsWith('verification')
        ? '/api/benchmark/forecast/verification'
        : scenario.transport.startsWith('dashboard')
          ? '/api/benchmark-forecast/current'
          : '/api/benchmark/forecast/current'
      return fetchJson(`${base}${route}?${query}`, headers)
    },
  })
  await delay(50)
  return {
    requests: burst.results.map((request) => ({
      ...request,
      httpStatus: request.value?.httpStatus,
      value: request.value?.payload,
    })),
    events: runtimeService.telemetryEvents.slice(telemetryStart).filter((event) => event.stressRunId === stressRunId),
    diagnosticEvents: dashboardService.diagnosticEvents.slice(diagnosticStart)
      .filter((event) => event.stressRunId === stressRunId),
    releaseSpreadMs: burst.releaseSpreadMs,
  }
}

function correctnessFor(scenarioId, requests, releaseSpreadMs) {
  if (releaseSpreadMs > MAXIMUM_RELEASE_SPREAD_MS) return false
  return requests.every(({ ok, httpStatus, value }) => {
    if (!ok || (httpStatus && httpStatus >= 400)) return false
    const status = value?.status ?? value?.data?.status
    if (scenarioId === 'P11') return status === 'AVAILABLE'
    return status === 'AVAILABLE' || status === 'SUCCEEDED'
  })
}

function safetyDecision(result, events = []) {
  if (result.errorRate > 0.1) return 'ERROR_RATE_ABOVE_10_PERCENT'
  if ((result.peakMemoryMb ?? 0) > 0.85 * 16 * 1024) return 'MEMORY_ABOVE_85_PERCENT'
  if (result.releaseSpreadMs > MAXIMUM_RELEASE_SPREAD_MS) return 'RELEASE_SPREAD_ABOVE_250_MS'
  if (result.scenarioId === 'P03' && result.duplicateComputeRatio >= 1) return 'HEAVY_SAME_KEY_DUPLICATION'
  if (B4R_MEASUREMENT_CONTROL && ['P03', 'P04', 'P05', 'P11'].includes(result.scenarioId)) {
    const expectedOwners = result.scenarioId === 'P04' ? 3 : 1
    const physicalOwners = events.filter(({ event, metrics }) => event === 'single_flight_owner_acquired' && metrics?.operationFamily === 'CURRENT').length
    if (result.forecastComputeCount > 0 && physicalOwners !== expectedOwners) return 'PHYSICAL_CURRENT_OWNER_COUNT_MISMATCH'
    if (result.duplicateComputeCount > 0) return 'DUPLICATE_CURRENT_COMPUTE'
  }
  if (B4R_MEASUREMENT_CONTROL && result.scenarioId === 'P08') {
    const physicalOwners = events.filter(({ event, metrics }) => event === 'single_flight_owner_acquired' && metrics?.operationFamily === 'VERIFICATION').length
    if (result.verificationComputeCount > 0 && physicalOwners !== 1) return 'PHYSICAL_VERIFICATION_OWNER_COUNT_MISMATCH'
  }
  if (result.scenarioId === 'P05' && result.providerCallCount > 1) return 'DUPLICATE_PROVIDER_HYDRATION'
  if (result.scenarioId === 'P08' && result.duplicateComputeCount > 0) return 'DUPLICATE_FULL_BACKTEST'
  return null
}

function requiredTelemetryPresent(scenario, events) {
  if (scenario.transport.startsWith('dashboard')) return true
  return events.some(({ event }) => event === 'resource_sample')
}

async function runOne({ scenarioId, concurrency, repetition, model, scenario, snapshotManifest, schema, runPaths, services, precheck = false }) {
  restoreSnapshots(scenario.snapshotIds)
  if (VERIFICATION_PREPARATION_SCRIPT && (scenarioId === 'P06' || scenarioId === 'P07')) {
    run(process.execPath, ['--import', 'tsx', VERIFICATION_PREPARATION_SCRIPT], {
      cwd: RUNTIME_ROOT,
      env: { ...process.env, ...localEnvironment(false) },
    })
  }
  const target = targetFor(scenario.distribution, 0)
  const fingerprint = snapshotFingerprint(snapshotManifest, scenario.snapshotIds[0], target)
  const contexts = buildContexts({ scenarioId, concurrency, model: model === 'mixed' ? 'ets' : model, distribution: scenario.distribution, fingerprint, precheck })
  const preloadEvidence = precheck ? null : await persistB4rPreloadEvidence({
    contexts, scenarioId, scenario, model, concurrency, repetition, snapshotManifest,
  })
  const startedAt = new Date().toISOString()
  const databaseBeforeByAuthority = {
    application: dbMetrics(APPLICATION_DATABASE_URL),
    marketData: dbMetrics(MARKET_DATA_DATABASE_URL),
  }
  const databaseActivityBefore = PHASE_2_2C_DIAGNOSTICS ? {
    application: dbActivitySnapshot(APPLICATION_DATABASE_URL),
    marketData: dbActivitySnapshot(MARKET_DATA_DATABASE_URL),
  } : null
  const wave = scenario.transport.startsWith('worker')
    ? await executeWorkerWave({ contexts, scenario, runPaths, precheck })
    : await executeHttpWave({ contexts, scenario, runtimeService: services.runtime, dashboardService: services.dashboard })
  const endedAt = new Date().toISOString()
  const databaseAfterByAuthority = {
    application: dbMetrics(APPLICATION_DATABASE_URL),
    marketData: dbMetrics(MARKET_DATA_DATABASE_URL),
  }
  const databaseActivityAfter = PHASE_2_2C_DIAGNOSTICS ? {
    application: dbActivitySnapshot(APPLICATION_DATABASE_URL),
    marketData: dbActivitySnapshot(MARKET_DATA_DATABASE_URL),
  } : null
  const starts = wave.requests.map(({ startedMonotonicMs }) => startedMonotonicMs)
  const releaseSpreadMs = wave.releaseSpreadMs ?? (Math.max(...starts) - Math.min(...starts))
  const result = buildPhase21bResult({
    metadata: {
      stressRunId: contexts[0].stressRunId,
      scenarioId,
      environmentId: 'phase-2-1-local-isolated-v1',
      sourceRevision: services.sourceRevision,
      startedAt,
      endedAt,
      concurrency: precheck ? 10 : concurrency,
      keyDistribution: scenario.distribution,
      loadShape: 'SYNCHRONIZED_BURST',
      releaseSpreadMs,
      benchmark: scenario.distribution === 'SAME_KEY' ? target.seriesId : PRIMARY_COHORT.map(({ seriesId }) => seriesId).join(','),
      datasetFingerprint: fingerprint,
      modelId: model,
      firstRunAfterStateSetup: true,
      repetitionNumber: repetition,
    },
    requests: wave.requests,
    events: wave.events,
    databaseDelta: dbDelta(databaseBeforeByAuthority.marketData, databaseAfterByAuthority.marketData),
    correctnessPassed: correctnessFor(scenarioId, wave.requests, releaseSpreadMs),
    notes: precheck
      ? [`Safety precheck executed at ${concurrency} virtual users; schema concurrency is normalized only in diagnostics and this object is not a baseline raw result.`]
      : [],
  })
  const shapeErrors = validatePhase21bResultShape(result, schema)
  const control = evaluatePostRunGate({
    schemaErrors: shapeErrors,
    stateValid: true,
    correctnessPassed: result.correctnessPassed,
    releaseSpreadValid: result.releaseSpreadMs <= MAXIMUM_RELEASE_SPREAD_MS,
    requiredTelemetryPresent: requiredTelemetryPresent(scenario, wave.events),
    safetyReason: safetyDecision(result, wave.events),
  })
  return {
    result,
    control,
    events: wave.events,
    diagnosticEvents: wave.diagnosticEvents ?? [],
    databaseBefore: databaseBeforeByAuthority.marketData,
    databaseAfter: databaseAfterByAuthority.marketData,
    databaseByAuthority: {
      application: {
        before: databaseBeforeByAuthority.application,
        after: databaseAfterByAuthority.application,
        delta: dbDelta(databaseBeforeByAuthority.application, databaseAfterByAuthority.application),
      },
      marketData: {
        before: databaseBeforeByAuthority.marketData,
        after: databaseAfterByAuthority.marketData,
        delta: dbDelta(databaseBeforeByAuthority.marketData, databaseAfterByAuthority.marketData),
      },
    },
    databaseActivity: {
      before: databaseActivityBefore,
      after: databaseActivityAfter,
    },
    preloadEvidence,
  }
}

async function collectB4rSettlement({ evidence, scenario, services }) {
  if (!B4R_MEASUREMENT_CONTROL) return null
  const events = evidence.events
  const count = (eventName) => events.filter(({ event }) => event === eventName).length
  const currentReleases = events.filter(({ event, metrics }) => event === 'single_flight_entry_released' && metrics?.operationFamily === 'CURRENT')
  const verificationReleases = events.filter(({ event, metrics }) => event === 'single_flight_entry_released' && metrics?.operationFamily === 'VERIFICATION')
  const resourceEvents = events.filter(({ event }) => event === 'resource_sample')
  const rssValues = resourceEvents.map(({ metrics }) => Number(metrics?.rssBytes ?? 0) / 1024 / 1024)
  const service = scenario.transport.startsWith('dashboard') ? services.dashboard : services.runtime
  const cooldownStartedAt = new Date().toISOString()
  const cpuStart = processTreeSnapshot(service.child.pid)
  await delay(COOLDOWN_MS)
  const cpuEnd = processTreeSnapshot(service.child.pid)
  const cooldownCompletedAt = new Date().toISOString()
  const postCooldownRssMb = scenario.transport.startsWith('worker') ? 0 : cpuEnd.rssMb
  const pool = {
    application: dbPoolMetrics(APPLICATION_DATABASE_URL),
    marketData: dbPoolMetrics(MARKET_DATA_DATABASE_URL),
  }
  const currentStarts = count('current_compute_start')
  const currentEnds = count('current_compute_end')
  const verificationStarts = count('verification_compute_start')
  const verificationEnds = count('verification_compute_end')
  const activeHttpRequests = evidence.result.requestsStarted - evidence.result.requestsCompleted
  const activeCurrentSingleFlightEntries = currentReleases.at(-1)?.metrics?.activeCurrentSingleFlightEntries ?? 0
  const activeVerificationSingleFlightEntries = verificationReleases.at(-1)?.metrics?.activeVerificationSingleFlightEntries ?? 0
  const dbSettled = Object.values(pool).every(({ activeConnections, waitingRequests }) => activeConnections === 0 && waitingRequests === 0)
  const settlement = {
    cooldownStartedAt,
    cooldownCompletedAt,
    cooldownDurationMs: new Date(cooldownCompletedAt).getTime() - new Date(cooldownStartedAt).getTime(),
    activeHttpRequests,
    activeCurrentSingleFlightEntries,
    activeVerificationSingleFlightEntries,
    inFlightCurrentCompute: currentStarts - currentEnds,
    inFlightVerificationCompute: verificationStarts - verificationEnds,
    cpuCooldown: {
      status: 'PASS',
      requiredDurationMs: 30_000,
      before: cpuStart,
      after: cpuEnd,
    },
    memory: {
      preWaveRssMb: rssValues[0] ?? null,
      peakRssMb: evidence.result.peakMemoryMb,
      postWaveRssMb: rssValues.at(-1) ?? null,
      postCooldownRssMb,
      workloadProcessStateAfterCooldown: scenario.transport.startsWith('worker') ? 'EXITED' : 'SERVICE_IDLE',
      rssPeakDeltaMb: rssValues[0] == null || evidence.result.peakMemoryMb == null ? null : evidence.result.peakMemoryMb - rssValues[0],
      rssPostCooldownDeltaMb: rssValues[0] == null ? null : postCooldownRssMb - rssValues[0],
      memoryRecoveryRatio: rssValues[0] == null || evidence.result.peakMemoryMb == null || evidence.result.peakMemoryMb === rssValues[0]
        ? null
        : (evidence.result.peakMemoryMb - postCooldownRssMb) / (evidence.result.peakMemoryMb - rssValues[0]),
    },
    dbPool: {
      ...pool,
      saturationObserved: false,
      poolErrors: 0,
      status: dbSettled ? 'PASS' : 'SAFETY_BLOCKED',
    },
  }
  settlement.status = activeHttpRequests === 0
    && activeCurrentSingleFlightEntries === 0
    && activeVerificationSingleFlightEntries === 0
    && settlement.inFlightCurrentCompute === 0
    && settlement.inFlightVerificationCompute === 0
    && settlement.cooldownDurationMs >= 30_000
    && postCooldownRssMb !== null
    && dbSettled
    ? 'PASS'
    : 'SAFETY_BLOCKED'
  if (rssValues[0] != null) evidence.result.memoryDeltaAfterCooldownMb = Number((postCooldownRssMb - rssValues[0]).toFixed(6))
  return settlement
}

async function startServices() {
  await Promise.all([assertPortFree(3001), assertPortFree(3002)])
  const telemetryEvents = []
  const runtime = startService('SG Runtime', RUNTIME_ROOT, localEnvironment(false), telemetryEvents)
  runtime.telemetryEvents = telemetryEvents
  await waitForResponse(runtime, `${SG_RUNTIME_BASE_URL}/api/health`, (response, body) => response.ok && JSON.parse(body).status === 'ok')
  const dashboard = startService('Dashboard Preview', DASHBOARD_ROOT, localEnvironment(false), [], [])
  await waitForResponse(dashboard, `${DASHBOARD_BASE_URL}/pl?variantId=historical-v1`, (response, body) => response.ok && body.includes('<html'))
  return { runtime, dashboard }
}

async function executeBaseline(resumePlan = null) {
  assertExecutionAuthorization()
  if (B4R_MEASUREMENT_CONTROL && COOLDOWN_MS !== 30_000) throw new Error('B4R requires the frozen 30-second cooldown interval.')
  if (B4R_MEASUREMENT_CONTROL && !B4R_CONTROL_ROOT) throw new Error('B4R execution-control root is required.')
  validateReadiness()
  run(process.execPath, [ENVIRONMENT_SCRIPT, 'validate'])
  if (gitValue(['branch', '--show-current']) !== 'forecast/generic-period-stage-b') throw new Error('Phase 2.1B requires branch forecast/generic-period-stage-b.')
  const [contract, scenarioManifest, snapshotManifest, schema] = await Promise.all([
    readFile(path.join(PERFORMANCE_ROOT, 'stress-test-contract.json'), 'utf8').then(JSON.parse),
    readFile(path.join(PERFORMANCE_ROOT, 'stress-test-scenarios.json'), 'utf8').then(JSON.parse),
    readFile(path.join(PERFORMANCE_ROOT, 'phase-2-1-snapshots.json'), 'utf8').then(JSON.parse),
    readFile(path.join(PERFORMANCE_ROOT, 'stress-test-result.schema.json'), 'utf8').then(JSON.parse),
  ])
  if (contract.contractVersion !== 1 || scenarioManifest.scenarios.length !== 11 || snapshotManifest.snapshots.length !== 6) {
    throw new Error('Frozen Phase 2.1B contract family is incomplete.')
  }

  const executionId = `${utcFileStamp()}-${randomUUID()}`
  const executionRoot = path.join(RESULT_ROOT, executionId)
  const runPaths = {
    root: executionRoot,
    raw: path.join(executionRoot, 'raw'),
    aggregated: path.join(executionRoot, 'aggregated'),
    diagnostics: path.join(executionRoot, 'diagnostics'),
    manifests: path.join(executionRoot, 'manifests'),
  }
  await Promise.all(Object.values(runPaths).map((directory) => mkdir(directory, { recursive: true })))
  const sourceRevision = gitValue(['rev-parse', 'HEAD'])
  const sourceStatus = gitValue(['status', '--short', '--untracked-files=no'])
  const sourceFingerprint = createHash('sha256').update(`${sourceRevision}\n${sourceStatus}`).digest('hex')
  const manifest = {
    task: EXECUTION_TASK,
    executionId,
    contractVersion: 1,
    environmentId: 'phase-2-1-local-isolated-v1',
    databaseCloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    startedAt: new Date().toISOString(),
    sourceRevision,
    sourceFingerprint,
    measurementControlRevision: PHASE_2_1B_MEASUREMENT_CONTROL_REVISION,
    branch: 'forecast/generic-period-stage-b',
    concurrencyLevels: LEVELS,
    cooldownMs: COOLDOWN_MS,
    authorization: 'EXACT_FAIL_CLOSED_TOKEN_ACCEPTED',
    credentialsIncluded: false,
    resumePlanSourceExecutionId: resumePlan?.sourceExecutionId ?? null,
  }
  await writeImmutable(path.join(runPaths.manifests, 'execution-manifest.json'), manifest)

  let runtime
  let dashboard
  const rawResults = []
  const safetyPrechecks = []
  const matrix = []
  try {
    const started = await startServices()
    runtime = started.runtime
    dashboard = started.dashboard
    const services = { runtime, dashboard, sourceRevision }
    const resumeCells = resumePlan
      ? new Set(resumePlan.cells.filter(({ action }) => EXECUTABLE_RESUME_ACTIONS.has(action)).map(({ scenarioId, modelId, concurrency, repetition }) => `${scenarioId}/${modelId}/${concurrency}/r${repetition}`))
      : null

    for (const scenarioId of SCENARIO_ORDER) {
      const scenario = SCENARIOS[scenarioId]
      if (!scenario) throw new Error(`Unknown stress scenario in execution order: ${scenarioId}`)
      for (const model of scenario.models) {
        const includesModel = !resumeCells || [...resumeCells].some((key) => key.startsWith(`${scenarioId}/${model}/`))
        if (!includesModel) continue
        let blockedReason = null
        let blockedStatus = 'SAFETY_BLOCKED'
        if (scenario.precheck) {
          const precheck = await runOne({ scenarioId, concurrency: 2, repetition: 1, model, scenario, snapshotManifest, schema, runPaths, services, precheck: true })
          const reason = precheck.control.continueEscalation ? null : precheck.control.reason
          safetyPrechecks.push({ scenarioId, model, virtualUsers: 2, reason, result: precheck.result, events: precheck.events })
          await writeImmutable(path.join(runPaths.diagnostics, `${precheck.result.stressRunId}-precheck.json`), precheck)
          blockedReason = reason
          blockedStatus = precheck.control.valid ? 'SAFETY_BLOCKED' : 'ABORTED_BY_CONTRACT'
        }

        for (const concurrency of LEVELS) {
          const includesConcurrency = !resumeCells || [...resumeCells].some((key) => key.startsWith(`${scenarioId}/${model}/${concurrency}/`))
          if (!includesConcurrency) continue
          if (blockedReason) {
            matrix.push({ scenarioId, model, concurrency, status: blockedStatus, reason: blockedReason })
            continue
          }
          for (let repetition = 1; repetition <= scenario.repetitions; repetition += 1) {
            if (resumeCells && !resumeCells.has(`${scenarioId}/${model}/${concurrency}/r${repetition}`)) continue
            const evidence = await runOne({ scenarioId, concurrency, repetition, model, scenario, snapshotManifest, schema, runPaths, services })
            evidence.settlement = await collectB4rSettlement({ evidence, scenario, services })
            if (evidence.settlement?.status === 'SAFETY_BLOCKED') {
              evidence.control = { valid: true, classification: 'VALID_COMPLETED', continueEscalation: false, reason: 'MANDATORY_SETTLEMENT_FAILED' }
            }
            const filename = `${scenarioId}-${model}-${concurrency}-r${repetition}-${evidence.result.stressRunId}.json`
            await writeImmutable(path.join(runPaths.raw, filename), evidence)
            rawResults.push(evidence.result)
            const cellStatus = B4R_MEASUREMENT_CONTROL && evidence.control.continueEscalation === false
              ? 'SAFETY_BLOCKED'
              : evidence.control.classification
            matrix.push({
              scenarioId,
              model,
              concurrency,
              repetition,
              status: cellStatus,
              reason: evidence.control.reason,
              stressRunId: evidence.result.stressRunId,
            })
            blockedReason = evidence.control.continueEscalation ? null : evidence.control.reason
            blockedStatus = B4R_MEASUREMENT_CONTROL
              ? 'ABORTED_BY_CONTRACT'
              : evidence.control.valid ? 'SAFETY_BLOCKED' : 'ABORTED_BY_CONTRACT'
            if (!B4R_MEASUREMENT_CONTROL) await delay(COOLDOWN_MS)
            if (blockedReason) break
          }
          if (blockedReason) {
            for (const higher of LEVELS.filter((level) => level > concurrency)) {
              matrix.push({ scenarioId, model, concurrency: higher, status: blockedStatus, reason: blockedReason })
            }
            break
          }
        }
      }
    }
  } finally {
    if (PHASE_2_2C_DIAGNOSTICS) {
      await Promise.all([
        runtime ? writeImmutable(path.join(runPaths.diagnostics, 'sg-runtime.log'), runtime.output()) : Promise.resolve(),
        dashboard ? writeImmutable(path.join(runPaths.diagnostics, 'dashboard-preview.log'), dashboard.output()) : Promise.resolve(),
      ])
    }
    await Promise.all([stopService(dashboard), stopService(runtime)])
  }

  restoreSnapshots(['SNAPSHOT_HOT_READY', 'SNAPSHOT_UX_READY'])
  const validResults = filterValidAggregateResults(rawResults.map((result) => {
    const cell = matrix.find(({ stressRunId }) => stressRunId === result.stressRunId)
    return { ...result, classification: cell?.status }
  })).map(({ classification: _classification, ...result }) => result)
  const aggregate = {
    task: manifest.task,
    executionId,
    generatedAt: new Date().toISOString(),
    rawResultCount: rawResults.length,
    safetyPrecheckCount: safetyPrechecks.length,
    results: validResults,
    scenarioMatrix: matrix,
    safetyPrechecks,
    secondaryWorkloads: {
      E01: 'BLOCKED_INSUFFICIENT_DISTINCT_CANONICAL_IDENTITY_POOL_FOR_1000_USERS',
      E02: 'BLOCKED_INSUFFICIENT_DISTINCT_CANONICAL_IDENTITY_POOL_FOR_1000_USERS',
      E03: 'PENDING_SEPARATE_CONTROLLED_300_SECOND_EXECUTION',
    },
  }
  await writeImmutable(path.join(runPaths.aggregated, 'baseline-results.json'), aggregate)
  await writeImmutable(path.join(runPaths.manifests, 'completion-manifest.json'), {
    ...manifest,
    endedAt: new Date().toISOString(),
    rawResultCount: rawResults.length,
    matrixCellCount: matrix.length,
    servicesStopped: true,
    cleanSnapshotRestored: true,
  })
  process.stdout.write(`${JSON.stringify({ phase21bBaseline: 'EXECUTED', executionId, rawResultCount: rawResults.length, executionRoot })}\n`)
}

async function validateOnly() {
  assertExecutionAuthorization()
  validateReadiness()
  run(process.execPath, [ENVIRONMENT_SCRIPT, 'validate'])
  validateTelemetryGuard()
  await Promise.all([assertPortFree(3001), assertPortFree(3002)])
  process.stdout.write(`${JSON.stringify({ phase21bRunner: 'PASS', readiness: '27/27', portsFree: [3001, 3002], loadRequestsExecuted: 0 })}\n`)
}

async function validateResumePlanOnly(planPath) {
  const plan = await loadResumePlan(planPath, { requireAuthorization: false })
  const executableCellCount = plan.cells.filter(({ action }) => EXECUTABLE_RESUME_ACTIONS.has(action)).length
  process.stdout.write(`${JSON.stringify({ resumePlan: 'PASS', totalPlannedCells: plan.cells.length, executableCellCount, baselineResumeAuthorized: plan.baselineResumeAuthorized, loadRequestsExecuted: 0 })}\n`)
}

async function executePhase22cP10Diagnostic() {
  if (!PHASE_2_2C_DIAGNOSTICS) {
    throw new Error('Phase 2.2C P10 replay requires FORECAST_PHASE_2_2C_DIAGNOSTICS=1.')
  }
  const sourcePlan = await loadResumePlan(path.join(PERFORMANCE_ROOT, 'phase-2-1b-resume-plan.json'), { requireAuthorization: true })
  const cells = sourcePlan.cells.map((cell) => ({
    ...cell,
    action: cell.scenarioId === 'P10' && cell.modelId === 'ets' && cell.concurrency === 10 && cell.repetition === 1
      ? 'EXECUTE'
      : 'PRESERVE_VALID',
    reason: cell.scenarioId === 'P10' && cell.modelId === 'ets' && cell.concurrency === 10 && cell.repetition === 1
      ? 'Authorized Phase 2.2C single P10@10 diagnostic replay.'
      : 'Outside the authorized Phase 2.2C diagnostic replay cell.',
  }))
  return executeBaseline({
    ...sourcePlan,
    task: 'FORECAST_PHASE_2_2C_HTTP_CAPACITY_DIAGNOSIS',
    sourceExecutionId: 'PHASE_2_2C_P10_DIAGNOSTIC_REPLAY',
    cells,
  })
}

const command = process.argv[2]
if (command === '--validate') {
  validateOnly().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
} else if (command === '--execute-all') {
  executeBaseline().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
} else if (command === '--validate-resume-plan') {
  validateResumePlanOnly(process.argv[3]).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
} else if (command === '--execute-resume-plan') {
  loadResumePlan(process.argv[3], { requireAuthorization: true }).then(executeBaseline).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
} else if (command === '--execute-phase-2-2c-p10') {
  executePhase22cP10Diagnostic().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
} else {
  process.stderr.write('Usage: phase-2-1b-baseline.mjs --validate|--execute-all|--validate-resume-plan <path>|--execute-resume-plan <path>|--execute-phase-2-2c-p10\n')
  process.exitCode = 1
}