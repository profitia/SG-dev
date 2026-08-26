import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { cpus, totalmem } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

import {
  PHASE_2_1_DATABASE_CLONE_ALIAS,
  assertPhase21DatabaseTarget,
  phase21DatabaseName,
} from './phase-2-1-database-guard.mjs'

const PERFORMANCE_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(PERFORMANCE_DIR, '..', '..', '..')
const RUNTIME_ROOT = path.join(REPOSITORY_ROOT, '.phase-2-1-runtime')
const POSTGRES_DATA = path.join(RUNTIME_ROOT, 'postgres')
const POSTGRES_LOG = path.join(RUNTIME_ROOT, 'postgres.log')
const SNAPSHOT_ROOT = path.join(RUNTIME_ROOT, 'snapshots-v1')
const MC_SNAPSHOT_ROOT = path.join(RUNTIME_ROOT, 'snapshots-mc-r2')
const ENVIRONMENT_MANIFEST = path.join(PERFORMANCE_DIR, 'phase-2-1-environment.json')
const SNAPSHOT_MANIFEST = path.join(PERFORMANCE_DIR, 'phase-2-1-snapshots.json')
const MC_SNAPSHOT_MANIFEST = path.join(PERFORMANCE_DIR, 'phase-2-1b-mc-snapshots.json')
const SG_RUNTIME_ROOT = path.join(REPOSITORY_ROOT, 'apps', 'sg-runtime')
const DATABASE_OBSERVABILITY_EVIDENCE = path.join(
  REPOSITORY_ROOT,
  'tooling',
  'Benchmark-Forecasting',
  'validation',
  'forecast-phase-2-1a-database-observability.json',
)
const PORT = 55421
const HOST = '127.0.0.1'
const USER = 'phase21'
const POSTGRES_BIN = process.env.PHASE_2_1_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@18/bin'
const PRIMARY_COHORT = ['wocaes0074', 'wocaes0280', 'usnaac0169']
const ALL_COHORT = [...PRIMARY_COHORT, 'istrad0862', 'chpric0077', 'cndemo0001', 'trsurv1145']

const SNAPSHOTS = [
  { snapshotId: 'SNAPSHOT_HOT_READY', databaseRole: 'marketData', mutation: null },
  { snapshotId: 'SNAPSHOT_WARM_CURRENT_MISS', databaseRole: 'marketData', mutation: 'warm' },
  { snapshotId: 'SNAPSHOT_COLD_CURRENT_MISS', databaseRole: 'marketData', mutation: 'cold' },
  { snapshotId: 'SNAPSHOT_VERIFICATION_READY', databaseRole: 'marketData', mutation: null },
  { snapshotId: 'SNAPSHOT_VERIFICATION_MISS', databaseRole: 'marketData', mutation: 'verification-miss' },
  { snapshotId: 'SNAPSHOT_UX_READY', databaseRole: 'application', mutation: null },
]

function executable(name) {
  const preferred = path.join(POSTGRES_BIN, name)
  if (existsSync(preferred)) return preferred

  const result = spawnSync('/usr/bin/which', [name], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Required executable is unavailable: ${name}`)
  return result.stdout.trim()
}

function sourceConnection(value, label) {
  if (!value) throw new Error(`${label} is required for read-only clone provisioning.`)
  const url = new URL(value)
  return {
    args: ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username), '-d', decodeURIComponent(url.pathname.slice(1))],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
  }
}

function localUrl(role) {
  return `postgresql://${USER}@${HOST}:${PORT}/${phase21DatabaseName(role)}`
}

function localArgs(role, databaseOverride) {
  assertPhase21DatabaseTarget({
    databaseUrl: localUrl(role),
    cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    role,
  })
  return ['-h', HOST, '-p', String(PORT), '-U', USER, '-d', databaseOverride ?? phase21DatabaseName(role)]
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed: ${(result.stderr || result.stdout).trim()}`)
  }
  return result.stdout.trim()
}

async function waitForPostgres(pgIsReady) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = spawnSync(pgIsReady, ['-h', HOST, '-p', String(PORT), '-U', USER], { stdio: 'ignore' })
    if (result.status === 0) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Isolated PostgreSQL did not become ready.')
}

async function ensurePostgres() {
  const initdb = executable('initdb')
  const postgres = executable('postgres')
  const pgIsReady = executable('pg_isready')
  await mkdir(RUNTIME_ROOT, { recursive: true })

  if (!existsSync(path.join(POSTGRES_DATA, 'PG_VERSION'))) {
    run(initdb, ['-D', POSTGRES_DATA, '--username', USER, '--auth-local=trust', '--auth-host=trust', '--no-instructions'])
  }

  const ready = spawnSync(pgIsReady, ['-h', HOST, '-p', String(PORT), '-U', USER], { stdio: 'ignore' })
  if (ready.status !== 0) {
    const logHandle = await import('node:fs').then(({ openSync }) => openSync(POSTGRES_LOG, 'a'))
    const child = spawn(postgres, [
      '-D', POSTGRES_DATA,
      '-p', String(PORT),
      '-c', `listen_addresses=${HOST}`,
      '-c', `unix_socket_directories=${RUNTIME_ROOT}`,
    ], { detached: true, stdio: ['ignore', logHandle, logHandle] })
    child.unref()
    await waitForPostgres(pgIsReady)
  }
}

function databaseExists(databaseName) {
  const output = run(executable('psql'), [
    '-h', HOST, '-p', String(PORT), '-U', USER, '-d', 'postgres', '-X', '-Atc',
    `SELECT 1 FROM pg_database WHERE datname = '${databaseName}'`,
  ])
  return output === '1'
}

function recreateDatabase(role) {
  const databaseName = phase21DatabaseName(role)
  const psql = executable('psql')
  if (databaseExists(databaseName)) {
    run(psql, ['-h', HOST, '-p', String(PORT), '-U', USER, '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c',
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`])
    run(psql, ['-h', HOST, '-p', String(PORT), '-U', USER, '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c',
      `DROP DATABASE "${databaseName}"`])
  }
  run(executable('createdb'), ['-h', HOST, '-p', String(PORT), '-U', USER, databaseName])
}

function cloneSource(sourceUrl, role) {
  const archive = path.join(RUNTIME_ROOT, `${role}-source.dump`)
  const source = sourceConnection(sourceUrl, role)
  run(executable('pg_dump'), [...source.args, '--format=custom', '--no-owner', '--no-privileges', '--file', archive], { env: source.env })
  recreateDatabase(role)
  run(executable('pg_restore'), [...localArgs(role), '--no-owner', '--no-privileges', '--exit-on-error', archive])
}

function mutateMarketState(mutation) {
  if (!mutation) return
  const seriesList = (mutation === 'cold' ? ['wocaes0074'] : PRIMARY_COHORT)
    .map((seriesId) => `'${seriesId}'`).join(',')
  const statements = []
  if (mutation === 'warm' || mutation === 'cold') {
    statements.push(`DELETE FROM forecast_current_runs WHERE lower("seriesId") IN (${seriesList})`)
  }
  if (mutation === 'verification-miss' || mutation === 'cold') {
    statements.push(`DELETE FROM forecast_verification_runs WHERE lower("seriesId") IN (${seriesList})`)
  }
  if (mutation === 'cold') {
    statements.push(`DELETE FROM market_series WHERE lower("providerSeriesId") IN (${seriesList})`)
  }
  run(executable('psql'), [...localArgs('marketData'), '-X', '-v', 'ON_ERROR_STOP=1', '-c', `BEGIN; ${statements.join('; ')}; COMMIT;`])
}

function restoreArchive(role, archive) {
  recreateDatabase(role)
  run(executable('pg_restore'), [...localArgs(role), '--no-owner', '--no-privileges', '--exit-on-error', archive])
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function queryJson(role, sql) {
  const output = run(executable('psql'), [...localArgs(role), '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql])
  return output ? JSON.parse(output) : null
}

function marketState() {
  const seriesList = ALL_COHORT.map((seriesId) => `'${seriesId}'`).join(',')
  return queryJson('marketData', `
    SELECT json_build_object(
      'cohort', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x."seriesId") FROM (
        SELECT lower(s."providerSeriesId") AS "seriesId", count(o.id)::int AS "observationCount",
          min(o."observedAt") AS "historyStart", max(o."observedAt") AS "historyEnd",
          md5(COALESCE(string_agg(o."observedAt"::text || ':' || COALESCE(o.value::text, 'null'), '|' ORDER BY o."observedAt"), '')) AS "historyFingerprint"
        FROM market_series s LEFT JOIN market_observations o ON o."seriesId" = s.id
        WHERE lower(s."providerSeriesId") IN (${seriesList}) GROUP BY lower(s."providerSeriesId")
      ) x), '[]'::json),
      'currentRuns', (SELECT count(*)::int FROM forecast_current_runs),
      'verificationRuns', (SELECT count(*)::int FROM forecast_verification_runs),
      'currentBySeries', COALESCE((SELECT json_object_agg(x."seriesId", x."runCount") FROM (
        SELECT lower("seriesId") AS "seriesId", count(*)::int AS "runCount" FROM forecast_current_runs
        WHERE lower("seriesId") IN (${seriesList}) GROUP BY lower("seriesId") ORDER BY lower("seriesId")
      ) x), '{}'::json),
      'verificationBySeries', COALESCE((SELECT json_object_agg(x."seriesId", x."runCount") FROM (
        SELECT lower("seriesId") AS "seriesId", count(*)::int AS "runCount" FROM forecast_verification_runs
        WHERE lower("seriesId") IN (${seriesList}) GROUP BY lower("seriesId") ORDER BY lower("seriesId")
      ) x), '{}'::json)
    )`)
}

function exactCurrentState() {
  return queryJson('marketData', `
    SELECT json_build_object(
      'daily', COALESCE((SELECT json_agg(row_to_json(x)) FROM (
        SELECT 'rolling_daily_current_forecast_snapshots' AS "store", "seriesId", "targetBasis", "methodId",
          "methodVersion", "modelId", 'DAILY' AS "frequencyIdentity", status,
          "payloadJson"->'audit'->>'sourceHistoryFingerprint' AS "historyFingerprint", "forecastOriginAt" AS "forecastOrigin"
        FROM rolling_daily_current_forecast_snapshots
        WHERE lower("seriesId") = 'wocaes0074' AND "targetBasis" = 'POINT_IN_TIME'
          AND "methodId" = 'ROLLING_DAILY_POINT_IN_TIME' AND "methodVersion" = 'rolling-daily-point-in-time-v1'
          AND "modelId" = 'ets' AND status = 'AVAILABLE'
      ) x), '[]'::json),
      'monthly', COALESCE((SELECT json_agg(row_to_json(x)) FROM (
        SELECT 'forecast_current_runs' AS "store", "seriesId", "targetBasis", "methodId", "methodVersion",
          "modelId", frequency AS "frequencyIdentity", status, "historyFingerprint", "forecastOriginAt" AS "forecastOrigin"
        FROM forecast_current_runs
        WHERE lower("seriesId") = 'wocaes0280' AND "targetBasis" = 'MONTHLY_AVERAGE'
          AND "methodId" = 'MONTHLY_AVERAGE' AND "methodVersion" = 'benchmark-forecasting-mvp-phase2-v1'
          AND "modelId" = 'ets' AND frequency = 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY'
          AND status = 'AVAILABLE'
      ) x), '[]'::json),
      'quarterly', COALESCE((SELECT json_agg(row_to_json(x)) FROM (
        SELECT 'forecast_current_runs' AS "store", "seriesId", "targetBasis", "methodId", "methodVersion",
          "modelId", frequency AS "frequencyIdentity", status, "historyFingerprint", "forecastOriginAt" AS "forecastOrigin"
        FROM forecast_current_runs
        WHERE lower("seriesId") = 'usnaac0169' AND "targetBasis" = 'END_OF_PERIOD'
          AND "methodId" = 'END_OF_PERIOD' AND "methodVersion" = 'benchmark-forecasting-mvp-phase2-v1'
          AND "modelId" = 'ets' AND frequency = 'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY'
          AND status = 'AVAILABLE'
      ) x), '[]'::json)
    )`)
}

function assertMeasurementSnapshotContract(snapshotId, state) {
  const counts = ['daily', 'monthly', 'quarterly'].map((key) => state[key]?.length ?? 0)
  if (snapshotId === 'SNAPSHOT_HOT_READY' && counts.some((count) => count !== 1)) {
    throw new Error('Measurement HOT snapshot must contain exactly one exact prepared artifact for each primary target.')
  }
  if (snapshotId === 'SNAPSHOT_WARM_CURRENT_MISS' && counts.some((count) => count !== 0)) {
    throw new Error('Measurement WARM snapshot must remove Current artifacts from every owning store.')
  }
}

function applicationState() {
  return queryJson('application', `
    SELECT json_build_object(
      'dashboardSchemaPresent', count(*) FILTER (WHERE table_name = 'dr_dashboard_index_records') = 1,
      'requiredTableCount', count(*)::int
    ) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      'dr_connectors', 'dr_sources', 'dr_datasets', 'dr_pipelines', 'dr_runs',
      'dr_run_datasets', 'dr_watermarks', 'dr_raw_records',
      'dr_dashboard_index_records', 'dr_forecast_accuracy_records'
    )`)
}

async function writeEnvironmentManifest() {
  const manifest = {
    contractVersion: 1,
    environmentId: 'phase-2-1-local-isolated-v1',
    environmentType: 'LOCAL_NON_PRODUCTION_ISOLATED',
    nonProductionConfirmed: true,
    L1: { id: 'LOCAL_COMPONENT_ISOLATED', role: 'Forecast component runtime', runtime: process.version },
    L2: { id: 'PHASE_2_1_NON_PRODUCTION_HTTP', role: 'Local SG Runtime HTTP service', endpointRole: 'http://127.0.0.1:3001' },
    L3: { id: 'PHASE_2_1_NON_PRODUCTION_DASHBOARD', role: 'Local Dashboard Preview user flow', endpointRole: 'http://127.0.0.1:3002' },
    resources: { cpuAllocation: `${cpus().length} local logical CPUs`, memoryAllocationBytes: totalmem() },
    database: {
      cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
      applicationDatabase: phase21DatabaseName('application'),
      marketDataDatabase: phase21DatabaseName('marketData'),
      host: HOST,
      port: PORT,
      isolationProof: 'Fail-closed guard requires loopback host, exact clone alias, and exact database names.',
      schemaMigration: false,
    },
    providerPolicy: 'DENY_BY_DEFAULT; exact-series allowlist only in separately authorized cold probes',
    stressTelemetry: { flag: 'FORECAST_STRESS_TELEMETRY_ENABLED', default: false },
    writeScope: 'Exact controlled identities in the local clone only',
    credentialsIncluded: false,
    validatedAt: new Date().toISOString(),
  }
  await writeFile(ENVIRONMENT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function createSnapshots() {
  const pgDump = executable('pg_dump')
  await rm(SNAPSHOT_ROOT, { recursive: true, force: true })
  await mkdir(SNAPSHOT_ROOT, { recursive: true })
  const baseMarketArchive = path.join(RUNTIME_ROOT, 'marketData-source.dump')
  const entries = []

  for (const snapshot of SNAPSHOTS) {
    const role = snapshot.databaseRole
    const baseArchive = role === 'marketData' ? baseMarketArchive : path.join(RUNTIME_ROOT, 'application-source.dump')
    restoreArchive(role, baseArchive)
    if (role === 'marketData') mutateMarketState(snapshot.mutation)
    const archive = path.join(SNAPSHOT_ROOT, `${snapshot.snapshotId.toLowerCase()}.dump`)
    run(pgDump, [...localArgs(role), '--format=custom', '--no-owner', '--no-privileges', '--file', archive])
    await chmod(archive, 0o444)
    entries.push({
      snapshotId: snapshot.snapshotId,
      snapshotVersion: 1,
      databaseCloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
      databaseRole: role,
      archiveFile: path.relative(REPOSITORY_ROOT, archive),
      sha256: sha256(archive),
      state: role === 'marketData' ? marketState() : applicationState(),
      immutable: true,
    })
  }

  restoreArchive('application', path.join(RUNTIME_ROOT, 'application-source.dump'))
  restoreArchive('marketData', baseMarketArchive)
  const manifest = {
    contractVersion: 1,
    snapshotManifestVersion: 1,
    databaseCloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    deterministicRestore: true,
    restoreCommand: 'node tooling/Benchmark-Forecasting/performance/phase-2-1-environment.mjs restore <SNAPSHOT_ID>',
    credentialsIncluded: false,
    createdAt: new Date().toISOString(),
    snapshots: entries,
  }
  await writeFile(SNAPSHOT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function restoreSnapshot(snapshotId) {
  const manifest = JSON.parse(await readFile(SNAPSHOT_MANIFEST, 'utf8'))
  const snapshot = manifest.snapshots.find((entry) => entry.snapshotId === snapshotId)
  if (!snapshot) throw new Error(`Unknown Phase 2.1 snapshot: ${snapshotId}`)
  const archive = path.join(REPOSITORY_ROOT, snapshot.archiveFile)
  if (sha256(archive) !== snapshot.sha256) throw new Error(`Snapshot checksum mismatch: ${snapshotId}`)
  restoreArchive(snapshot.databaseRole, archive)
}

async function createMeasurementControlSnapshots() {
  const pgDump = executable('pg_dump')
  if (existsSync(MC_SNAPSHOT_ROOT) || existsSync(MC_SNAPSHOT_MANIFEST)) {
    throw new Error('Measurement-control snapshot revision 2 already exists and is immutable.')
  }
  await mkdir(MC_SNAPSHOT_ROOT, { recursive: true })
  await restoreSnapshot('SNAPSHOT_HOT_READY')
  run(process.execPath, ['--import', 'tsx', 'scripts/prepare-phase-2-1b-mc-hot.ts'], {
    cwd: SG_RUNTIME_ROOT,
    env: {
      ...process.env,
      APP_ENV: 'development',
      NODE_ENV: 'development',
      DATABASE_URL: localUrl('application'),
      SG_RUNTIME_DATABASE_URL: localUrl('application'),
      MARKET_DATA_DATABASE_URL: localUrl('marketData'),
      FORECAST_STRESS_TELEMETRY_ENABLED: 'true',
      FORECAST_STRESS_ENVIRONMENT_ID: 'phase-2-1-local-isolated-v1',
      FORECAST_STRESS_DATABASE_CLONE_ALIAS: PHASE_2_1_DATABASE_CLONE_ALIAS,
      FORECAST_STRESS_PROVIDER_ENABLED: 'false',
    },
  })

  const hotState = exactCurrentState()
  assertMeasurementSnapshotContract('SNAPSHOT_HOT_READY', hotState)
  const hotArchive = path.join(MC_SNAPSHOT_ROOT, 'snapshot_hot_ready.dump')
  run(pgDump, [...localArgs('marketData'), '--format=custom', '--no-owner', '--no-privileges', '--file', hotArchive])
  await chmod(hotArchive, 0o444)

  const seriesList = PRIMARY_COHORT.map((seriesId) => `'${seriesId}'`).join(',')
  run(executable('psql'), [...localArgs('marketData'), '-X', '-v', 'ON_ERROR_STOP=1', '-c', `BEGIN;
    DELETE FROM forecast_current_runs WHERE lower("seriesId") IN (${seriesList});
    DELETE FROM rolling_daily_current_forecast_snapshots WHERE lower("seriesId") IN (${seriesList});
    COMMIT;`])
  const warmState = exactCurrentState()
  assertMeasurementSnapshotContract('SNAPSHOT_WARM_CURRENT_MISS', warmState)
  const warmArchive = path.join(MC_SNAPSHOT_ROOT, 'snapshot_warm_current_miss.dump')
  run(pgDump, [...localArgs('marketData'), '--format=custom', '--no-owner', '--no-privileges', '--file', warmArchive])
  await chmod(warmArchive, 0o444)

  const manifest = {
    contractVersion: 1,
    measurementControlRevision: 2,
    databaseCloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    immutable: true,
    providerCallsDuringPreparation: 0,
    createdAt: new Date().toISOString(),
    snapshots: [
      { snapshotId: 'SNAPSHOT_HOT_READY', snapshotVersion: 2, archiveFile: path.relative(REPOSITORY_ROOT, hotArchive), sha256: sha256(hotArchive), exactCurrentState: hotState },
      { snapshotId: 'SNAPSHOT_WARM_CURRENT_MISS', snapshotVersion: 2, archiveFile: path.relative(REPOSITORY_ROOT, warmArchive), sha256: sha256(warmArchive), exactCurrentState: warmState },
    ],
  }
  await writeFile(MC_SNAPSHOT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  await restoreMeasurementSnapshot('SNAPSHOT_HOT_READY')
  process.stdout.write(`${JSON.stringify({ measurementSnapshots: 'PASS', revision: 2, snapshots: manifest.snapshots.map(({ snapshotId }) => snapshotId) })}\n`)
}

async function restoreMeasurementSnapshot(snapshotId) {
  const manifest = JSON.parse(await readFile(MC_SNAPSHOT_MANIFEST, 'utf8'))
  const snapshot = manifest.snapshots.find((entry) => entry.snapshotId === snapshotId)
  if (!snapshot) return restoreSnapshot(snapshotId)
  const archive = path.join(REPOSITORY_ROOT, snapshot.archiveFile)
  if (sha256(archive) !== snapshot.sha256) throw new Error(`Measurement snapshot checksum mismatch: ${snapshotId}`)
  restoreArchive('marketData', archive)
  const actualState = exactCurrentState()
  if (JSON.stringify(actualState) !== JSON.stringify(snapshot.exactCurrentState)) {
    throw new Error(`Restored exact Current state does not match measurement snapshot: ${snapshotId}`)
  }
  assertMeasurementSnapshotContract(snapshotId, actualState)
}

async function validateMeasurementState(snapshotId) {
  const state = exactCurrentState()
  assertMeasurementSnapshotContract(snapshotId, state)
  process.stdout.write(`${JSON.stringify({ measurementState: 'PASS', snapshotId, exactCurrentState: state })}\n`)
}

function assertSnapshotContract(snapshotId, state) {
  const cohortIds = new Set(state.cohort?.map(({ seriesId }) => seriesId) ?? [])
  const hasPrimaryHistory = PRIMARY_COHORT.every((seriesId) => cohortIds.has(seriesId))

  if (snapshotId === 'SNAPSHOT_HOT_READY') {
    if (!hasPrimaryHistory || !PRIMARY_COHORT.every((seriesId) => (state.currentBySeries?.[seriesId] ?? 0) > 0)) {
      throw new Error('HOT snapshot does not contain ready history and Current artifacts for the primary cohort.')
    }
  } else if (snapshotId === 'SNAPSHOT_WARM_CURRENT_MISS') {
    if (!hasPrimaryHistory || !PRIMARY_COHORT.every((seriesId) => (state.currentBySeries?.[seriesId] ?? 0) === 0)) {
      throw new Error('WARM snapshot does not preserve history while removing primary Current artifacts.')
    }
  } else if (snapshotId === 'SNAPSHOT_COLD_CURRENT_MISS') {
    if (cohortIds.has('wocaes0074') || (state.currentBySeries?.wocaes0074 ?? 0) !== 0) {
      throw new Error('COLD snapshot still contains the dedicated cold identity.')
    }
  } else if (snapshotId === 'SNAPSHOT_VERIFICATION_READY') {
    if (!hasPrimaryHistory || !PRIMARY_COHORT.every((seriesId) => (state.verificationBySeries?.[seriesId] ?? 0) > 0)) {
      throw new Error('Verification READY snapshot lacks primary verification artifacts.')
    }
  } else if (snapshotId === 'SNAPSHOT_VERIFICATION_MISS') {
    if (!hasPrimaryHistory || !PRIMARY_COHORT.every((seriesId) => (state.verificationBySeries?.[seriesId] ?? 0) === 0)) {
      throw new Error('Verification MISS snapshot still contains primary verification artifacts.')
    }
  } else if (snapshotId === 'SNAPSHOT_UX_READY') {
    if (!state.dashboardSchemaPresent || state.requiredTableCount !== 10) {
      throw new Error('UX snapshot lacks the complete Dashboard data-runtime schema.')
    }
  }
}

async function verifySnapshotRestores() {
  const manifest = JSON.parse(await readFile(SNAPSHOT_MANIFEST, 'utf8'))
  const verified = []
  for (const snapshot of manifest.snapshots) {
    await restoreSnapshot(snapshot.snapshotId)
    const actualState = snapshot.databaseRole === 'marketData' ? marketState() : applicationState()
    if (JSON.stringify(actualState) !== JSON.stringify(snapshot.state)) {
      throw new Error(`Restored state does not match manifest: ${snapshot.snapshotId}`)
    }
    assertSnapshotContract(snapshot.snapshotId, actualState)
    verified.push(snapshot.snapshotId)
  }
  await restoreSnapshot('SNAPSHOT_HOT_READY')
  process.stdout.write(`${JSON.stringify({ deterministicRestore: 'PASS', verified })}\n`)
}

async function validateSnapshotState(snapshotId) {
  const manifest = JSON.parse(await readFile(SNAPSHOT_MANIFEST, 'utf8'))
  const snapshot = manifest.snapshots.find((entry) => entry.snapshotId === snapshotId)
  if (!snapshot) throw new Error(`Unknown Phase 2.1 snapshot: ${snapshotId}`)
  const actualState = snapshot.databaseRole === 'marketData' ? marketState() : applicationState()
  assertSnapshotContract(snapshotId, actualState)
  process.stdout.write(`${JSON.stringify({ snapshotState: 'PASS', snapshotId })}\n`)
}

function databaseMetrics(role) {
  return queryJson(role, `
    SELECT json_build_object(
      'databaseRole', '${role}',
      'databaseName', current_database(),
      'connectionCount', (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()),
      'activeConnectionCount', (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'),
      'waitingConnectionCount', (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND wait_event IS NOT NULL),
      'transactionCommits', xact_commit,
      'transactionRollbacks', xact_rollback,
      'blocksRead', blks_read,
      'blocksHit', blks_hit,
      'rowsReturned', tup_returned,
      'rowsFetched', tup_fetched,
      'rowsInserted', tup_inserted,
      'rowsUpdated', tup_updated,
      'rowsDeleted', tup_deleted,
      'deadlocks', deadlocks
    ) FROM pg_stat_database WHERE datname = current_database()`)
}

async function collectDatabaseObservability() {
  const evidence = {
    task: 'FORECAST_PHASE_2_1A_ENVIRONMENT_INSTRUMENTATION_READINESS',
    contractVersion: 1,
    environmentId: 'phase-2-1-local-isolated-v1',
    cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS,
    collectionMethod: 'PostgreSQL pg_stat_database and pg_stat_activity on guarded loopback targets',
    collectedAt: new Date().toISOString(),
    credentialsIncluded: false,
    databases: [databaseMetrics('application'), databaseMetrics('marketData')],
  }
  await writeFile(DATABASE_OBSERVABILITY_EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ databaseObservability: 'PASS', databaseCount: evidence.databases.length })}\n`)
}

async function validateEnvironment() {
  const environment = JSON.parse(await readFile(ENVIRONMENT_MANIFEST, 'utf8'))
  const snapshots = JSON.parse(await readFile(SNAPSHOT_MANIFEST, 'utf8'))
  assertPhase21DatabaseTarget({ databaseUrl: localUrl('application'), cloneAlias: environment.database.cloneAlias, role: 'application' })
  assertPhase21DatabaseTarget({ databaseUrl: localUrl('marketData'), cloneAlias: environment.database.cloneAlias, role: 'marketData' })
  for (const role of ['application', 'marketData']) {
    const identity = queryJson(role, `SELECT json_build_object(
      'databaseName', current_database(),
      'serverAddress', host(inet_server_addr()),
      'serverPort', inet_server_port()
    )`)
    if (identity?.databaseName !== phase21DatabaseName(role)
      || identity?.serverAddress !== HOST
      || identity?.serverPort !== PORT) {
      throw new Error(`Live ${role} database identity does not match the isolated Phase 2.1 target.`)
    }
  }
  if (snapshots.snapshots.length !== SNAPSHOTS.length) throw new Error('Phase 2.1 snapshot family is incomplete.')
  for (const snapshot of snapshots.snapshots) {
    const archive = path.join(REPOSITORY_ROOT, snapshot.archiveFile)
    if (!snapshot.immutable || sha256(archive) !== snapshot.sha256) throw new Error(`Invalid snapshot: ${snapshot.snapshotId}`)
  }
  process.stdout.write(`${JSON.stringify({ environment: 'PASS', connectivity: 'PASS', databases: 'PASS', snapshots: 'PASS', cloneAlias: environment.database.cloneAlias })}\n`)
}

async function provision() {
  await ensurePostgres()
  cloneSource(process.env.PHASE_2_1_SOURCE_APPLICATION_DATABASE_URL, 'application')
  cloneSource(process.env.PHASE_2_1_SOURCE_MARKET_DATA_DATABASE_URL, 'marketData')
  await writeEnvironmentManifest()
  await createSnapshots()
  await validateEnvironment()
}

async function startEnvironment() {
  await ensurePostgres()
  await validateEnvironment()
  process.stdout.write(`${JSON.stringify({ environmentStart: 'PASS', host: HOST, port: PORT, cloneAlias: PHASE_2_1_DATABASE_CLONE_ALIAS })}\n`)
}

async function main() {
  const command = process.argv[2]
  if (command === 'provision') return provision()
  if (command === 'start') return startEnvironment()
  if (command === 'validate') return validateEnvironment()
  if (command === 'restore') return restoreSnapshot(process.argv[3])
  if (command === 'create-mc-snapshots') return createMeasurementControlSnapshots()
  if (command === 'restore-mc') return restoreMeasurementSnapshot(process.argv[3])
  if (command === 'validate-mc-state') return validateMeasurementState(process.argv[3])
  if (command === 'validate-state') return validateSnapshotState(process.argv[3])
  if (command === 'verify-snapshots') return verifySnapshotRestores()
  if (command === 'collect-db-metrics') return collectDatabaseObservability()
  throw new Error('Usage: phase-2-1-environment.mjs provision|start|validate|verify-snapshots|collect-db-metrics|create-mc-snapshots|restore|restore-mc|validate-state|validate-mc-state <SNAPSHOT_ID>')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}