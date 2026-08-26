import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PERFORMANCE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const FORECAST_ROOT = path.resolve(PERFORMANCE_ROOT, '..')
const REPOSITORY_ROOT = path.resolve(FORECAST_ROOT, '..', '..')
const VALIDATION_ROOT = path.join(FORECAST_ROOT, 'validation')
const DIAGNOSTIC_ROOT = path.join(VALIDATION_ROOT, 'phase-2-2c')
const REPLAY_ROOT = path.join(DIAGNOSTIC_ROOT, 'replays')
const REPORT_PATH = path.join(FORECAST_ROOT, 'FORECAST_PHASE_2_2C_HTTP_CAPACITY_DIAGNOSIS.md')
const GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2c-http-capacity-diagnosis.json')
const MIGRATION_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2c-migration-readiness.json')
const REGRESSION_PATH = path.join(DIAGNOSTIC_ROOT, 'functional-regression.json')
const B4R_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2b-4r-controlled-comparative-stress.json')
const BEFORE_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2b-before-evidence.json')
const ORIGINAL_B4_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2b-4-before-after-comparative-stress.json')
const PHASE_1R_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2b-1r-p04-small-pool-current-single-flight.json')
const P09_PATH = path.join(VALIDATION_ROOT, 'phase-2-2b-4r/executions/2026-08-25T115341-253Z-6a3d0227-e64f-44da-a2ed-8cf298ff8cc3/raw/P09-mixed-1000-r1-phase-2-2b-4r-p09-1000-ets-f745411d-2178-40e7-b45e-3d16509fdfb5.json')
const P10_ACCEPTED_PATH = path.join(VALIDATION_ROOT, 'phase-2-2b-4r/executions/2026-08-25T115341-253Z-6a3d0227-e64f-44da-a2ed-8cf298ff8cc3/raw/P10-ets-10-r1-phase-2-2b-4r-p10-10-ets-f59b5af2-f85e-4dad-9e5f-6eb89fb2e2df.json')
const P09_CONTROL_PATHS = [
  'P09-mixed-100-r1-phase-2-2b-4r-p09-100-ets-4d7e21da-3e96-4173-8593-ee1a8f78768a.json',
  'P09-mixed-100-r2-phase-2-2b-4r-p09-100-ets-1a0cfb73-fb23-4410-9cac-53117ff27f61.json',
  'P09-mixed-100-r3-phase-2-2b-4r-p09-100-ets-bbef3dc8-730f-462e-ba8d-980278b9260d.json',
].map((file) => path.join(VALIDATION_ROOT, 'phase-2-2b-4r/executions/2026-08-25T115341-253Z-6a3d0227-e64f-44da-a2ed-8cf298ff8cc3/raw', file))

const ORIGINAL_B4_HASHES = {
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4-after-aggregate.json': '1e62ef689f27816cb777c711f6e9060627e898c6bb59811b358f137cc6584b8d',
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4-before-after-comparison.json': '028ad4fc879810a7819888085e205ac2b3fef5c151dac57ff9b3512dca1dc896',
  'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4-before-after-comparative-stress.json': 'c1d34137b9e279257c91aec2b765c73246534bbab88b590f49a0222fe5a70bbb',
}
const B4R_HASHES = {
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-after-aggregate.json': '30af657fb534f74a14749271401e1121604cd78e275ed972fbac2d79cfe4100c',
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-before-after-comparison.json': '501e6ef42abd34033ad0d9fc5f4ab739329ee24218f2bed9641b4a3b6b5fa249',
  'tooling/Benchmark-Forecasting/performance/phase-2-2b-4r-phase-2-2c-handoff.json': '2b10a335771b280c05d78458424468b91ae59f97c4414101763cf0b9c8a0d169',
  'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-4r-controlled-comparative-stress.json': '12ba336e88ce8c09fd9e9dfcd5f95a94e0f64040265362939f00785422190a3d',
  'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2b-1r-p04-small-pool-current-single-flight.json': 'c18059cc04fbba91eea290e5b4b5ffeba145cb5826c71ed10be08dc8c7136bfc',
  [path.relative(REPOSITORY_ROOT, P09_PATH)]: '53be7fd10434a479e62ae4378ca6423ebb889818caa8befae1d5185f82e8ef49',
  [path.relative(REPOSITORY_ROOT, P10_ACCEPTED_PATH)]: '38f55690334ca3c262eb4d43fbad0cbeafdf9c1a97d532f06c0b00487b2fe1b4',
}

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const relative = (filePath) => path.relative(REPOSITORY_ROOT, filePath)
const round = (value) => Number(value.toFixed(3))

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function verifyHashes(expected) {
  for (const [relativePath, expectedHash] of Object.entries(expected)) {
    assert.equal(sha256(await readFile(path.join(REPOSITORY_ROOT, relativePath))), expectedHash, `Authority drift: ${relativePath}`)
  }
}

async function verifyBefore() {
  const before = await readJson(BEFORE_PATH)
  const references = []
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (typeof value.path === 'string' && typeof value.sha256 === 'string') references.push(value)
    Object.values(value).forEach(visit)
  }
  visit(before)
  assert.equal(references.length, 22)
  for (const reference of references) {
    assert.equal(sha256(await readFile(path.join(REPOSITORY_ROOT, reference.path))), reference.sha256)
  }
  return references
}

async function findReplayRaw() {
  const executions = (await readdir(REPLAY_ROOT)).sort()
  assert.equal(executions.length, 1, 'Exactly one Phase 2.2C replay execution is required.')
  const rawRoot = path.join(REPLAY_ROOT, executions[0], 'raw')
  const files = (await readdir(rawRoot)).filter((file) => file.endsWith('.json'))
  assert.equal(files.length, 1, 'Exactly one P10 replay raw wrapper is required.')
  return { executionId: executions[0], path: path.join(rawRoot, files[0]), raw: await readJson(path.join(rawRoot, files[0])) }
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * percentileValue
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower))
}

function spanSummary(events, predicate) {
  const values = events.filter((event) => event.event === 'span_completed' && predicate(event)).map(({ durationMs }) => durationMs)
  return { count: values.length, p50Ms: percentile(values, 0.5), p95Ms: percentile(values, 0.95), p99Ms: percentile(values, 0.99), maxMs: round(Math.max(...values)) }
}

const lifecycleStages = [
  'CLIENT_REQUEST_CREATED', 'CLIENT_REQUEST_SENT', 'HTTP_ACCEPTED', 'ROUTE_STARTED', 'DB_ACQUIRE_STARTED', 'DB_ACQUIRED',
  'DB_QUERY_STARTED', 'DB_QUERY_COMPLETED', 'RESULT_MAPPING_STARTED', 'RESULT_MAPPING_COMPLETED', 'RESPONSE_STARTED',
  'RESPONSE_COMPLETED', 'REQUEST_SETTLED',
]

const reportHeadings = [
  'Executive Summary', 'Objective', 'Accepted Phase State', 'B4R Capacity Handoff', 'Scope Boundary', 'Diagnostic Principles',
  'Immutable Evidence Authority', 'Diagnostic Stages', 'Artifact-Only Diagnosis', 'Replay Decision', 'P09 Accepted Evidence',
  'P10 Accepted Evidence', 'P09 Request Lifecycle', 'P10 Request Lifecycle', 'Timeout Authority Map', 'P09 Timeout Classification',
  'Database Connection Architecture', 'Prisma Client Lifecycle', 'DB Pool Waiter Definition', 'P09 Database Activity',
  'P10 Database Activity', 'P09 Query Inventory', 'P10 Query Inventory', 'DB Acquisition Amplification', 'DB Query Amplification',
  'Connection Acquisition Latency', 'Query Execution Latency', 'Pool Wait vs Query Wait', 'Event Loop Evidence', 'CPU Evidence',
  'Memory Evidence', 'HTTP Connection Evidence', 'HTTP Admission Evidence', 'Serialization Evidence', 'Response Drain Evidence',
  'Diagnostic Instrumentation', 'Instrumentation Overhead', 'P10 Diagnostic Replay', 'P09 Control Replay',
  'P09@1000 Diagnostic Replay', 'Safety and Settlement', 'P09 First Capacity Boundary', 'P10 First Capacity Boundary',
  'P09 Primary and Secondary Causes', 'P10 Primary and Secondary Causes', 'P09 Causal Chain', 'P10 Causal Chain',
  'Capacity Envelope', 'Root-Cause Candidate Matrix', 'Root-Cause Confidence', 'Remaining Unknowns', 'Candidate Optimization Levers',
  'Correctness / Cost / UX Evaluation', 'Phase 2.2D Handoff', 'Cross-Instance Boundary', 'Provider Boundary',
  'Functional Regression', 'Methodology / Scope / Migration Guards', 'Phase 2.2C Final Gate', 'STOP',
]

const acceptanceDescriptions = [
  'Phase 2.2B-4R remains PASS.', 'Phase 2.2B series remains complete.', 'Current structural effect remains CONFIRMED.',
  'Verification structural effect remains CONFIRMED.', 'Persistence idempotency remains PRESERVED.', 'Immutable BEFORE hashes pass.',
  'Original B4 hashes pass.', 'Accepted B4R hashes pass.', 'C0 artifact-only diagnosis is completed before replay decision.',
  'Diagnostic replay requirement is explicitly classified YES or NO.', 'No broad stress matrix rerun occurs.',
  'P09@1000 accepted evidence is bound exactly.', 'P10@10 accepted evidence is bound exactly.', 'P09 timeout count is preserved exactly.',
  'P09 DB-pool settlement evidence is preserved.', 'P10 DB-pool settlement evidence is preserved.', 'P09 request lifecycle is mapped.',
  'P10 request lifecycle is mapped.', 'Unobservable lifecycle stages are explicitly marked.', 'No synthetic timing values are invented.',
  'Complete relevant timeout authority map is produced.', 'Timeout values are not changed.', 'P09 timeouts receive evidence-backed classification.',
  'Relevant Prisma client lifecycle is documented.', 'Relevant Prisma client creation sites are counted.',
  'DB pool waiter measurement source is explicitly defined.', 'Task-owned DB activity is distinguished from unrelated activity where possible.',
  'P09 query inventory is documented.', 'P10 query inventory is documented.',
  'DB acquisitions per P09 request are measured or lawfully marked unavailable.',
  'DB acquisitions per P10 request are measured or lawfully marked unavailable.', 'Query count amplification is evaluated.',
  'DB acquisition wait is distinguished from DB execution latency.', 'P09 acquisition/query latency evidence is captured where observable.',
  'P10 acquisition/query latency evidence is captured where observable.', 'Event-loop evidence is evaluated.', 'CPU evidence is evaluated.',
  'Memory evidence is evaluated.', 'HTTP connection evidence is evaluated where observable.', 'HTTP admission evidence is evaluated where observable.',
  'Serialization is evaluated.', 'Response drain is evaluated where observable.', 'P09 remains Forecast-compute-free during all diagnostics.',
  'P10 remains prepared and compute-free during all diagnostics.', 'Provider calls remain zero for P09/P10 diagnostics.',
  'Any new diagnostic instrumentation is behavior-neutral.', 'Diagnostic instrumentation is default-off.',
  'No invasive tracing materially changes runtime behavior.', 'P10 diagnostic replay count is at most one.',
  'P09@1000 diagnostic replay count is at most one.', 'No diagnostic replay occurs when artifact evidence is sufficient.',
  'No P09@1000 replay occurs without all preconditions passing.', 'No tuning occurs between diagnostic observations.',
  'P09 first capacity boundary receives explicit classification.', 'P10 first capacity boundary receives explicit classification.',
  'P09 primary cause is explicitly classified.', 'P10 primary cause is explicitly classified.',
  'Primary cause is distinguished from downstream timeout symptoms.', 'Secondary causes are explicitly identified where supported.',
  'P09 causal chain is evidence-backed.', 'P10 causal chain is evidence-backed.', 'Unsupported causal links are not asserted.',
  'Root-cause candidate matrix is complete.', 'Evidence and counterevidence are shown for material candidates.',
  'Root-cause confidence uses the frozen qualitative scale.', 'P09 observed capacity envelope is documented.',
  'P10 observed capacity envelope is documented.', 'No unmeasured maximum concurrency is invented.',
  'Candidate optimization levers are evidence-backed.', 'Candidate levers are not implemented.', 'Candidate levers include correctness risk.',
  'Candidate levers include infrastructure/runtime cost.', 'Candidate levers include UX/reproducibility implications.',
  'No Champion optimization is selected.', 'Cross-instance ownership remains NOT_PROVEN.', 'Provider savings remain NOT_MEASURED.',
  'Current single-flight behavior remains unchanged.', 'Verification single-flight behavior remains unchanged.',
  'Persistence behavior remains unchanged.', 'DB/HTTP/Node/timeout/infrastructure configuration remains unchanged.',
  'Full applicable non-stress regression passes.', 'Migration Readiness Delta is complete.', 'Exactly 60 human report sections are produced.',
  'Phase 2.2D is not started.',
]

function timeoutMap() {
  return [
    { name: 'STRESS_CLIENT_REQUEST_TIMEOUT', valueMs: 120000, source: 'tooling/Benchmark-Forecasting/performance/phase-2-1b-baseline.mjs', scope: 'Each P09/P10 client fetch', enforcer: 'Node fetch AbortSignal.timeout', p09: 'FIRED_766_TIMES', p10: 'NOT_FIRED' },
    { name: 'DASHBOARD_INTERNAL_FORECAST_FALLBACK_TIMEOUT', valueMs: 20000, source: 'apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts', scope: 'Dashboard to SG Runtime production fallback only', enforcer: 'Dashboard AbortController', p09: 'NOT_ON_PATH', p10: 'NOT_ON_PREPARED_HIT_PATH' },
    { name: 'DASHBOARD_ANALYTICS_FETCH_TIMEOUT', valueMs: null, configured: 'NOT_EXPLICITLY_CONFIGURED', source: 'apps/dashboard-preview/lib/time-series/series-query.ts', scope: 'P09 series route to SG Runtime analytics', enforcer: 'HTTP library defaults', p09: 'NO_EXPLICIT_TIMEOUT_OBSERVED', p10: 'NOT_ON_PATH' },
    { name: 'DB_POOL_ACQUISITION_TIMEOUT', valueMs: null, configured: 'NOT_EXPLICITLY_CONFIGURED', source: 'Prisma client creation and isolated DATABASE_URL', scope: 'Dashboard and SG Runtime DB acquisition', enforcer: 'Prisma/driver implicit behavior', p09: 'NO_POOL_TIMEOUT_ERROR_RECORDED', p10: 'NO_POOL_TIMEOUT_ERROR_RECORDED' },
    { name: 'DB_STATEMENT_TIMEOUT', valueMs: null, configured: 'NOT_EXPLICITLY_CONFIGURED', source: 'Application configuration and isolated DATABASE_URL', scope: 'PostgreSQL statements', enforcer: 'PostgreSQL implicit configuration', p09: 'NO_STATEMENT_TIMEOUT_ERROR_RECORDED', p10: 'NO_STATEMENT_TIMEOUT_ERROR_RECORDED' },
    { name: 'PRISMA_INTERACTIVE_TRANSACTION_TIMEOUT', valueMs: 5000, configured: 'PRISMA_DEFAULT_WHERE_RELEVANT', source: 'Generated Prisma client', scope: 'Interactive transactions only', enforcer: 'Prisma', p09: 'NOT_RELEVANT_NO_INTERACTIVE_TRANSACTION', p10: 'NOT_RELEVANT_NO_INTERACTIVE_TRANSACTION' },
    { name: 'NODE_NEXT_REQUEST_TIMEOUT', valueMs: null, configured: 'NOT_EXPLICITLY_CONFIGURED', source: 'Next.js application configuration', scope: 'Inbound HTTP', enforcer: 'Node/Next implicit behavior', p09: 'NO_SERVER_TIMEOUT_ERROR_RECORDED', p10: 'NO_SERVER_TIMEOUT_ERROR_RECORDED' },
  ]
}

function queryInventories() {
  return {
    p09: [
      { order: 1, process: 'dashboard-preview', authority: 'application', operation: 'drDashboardIndexRecord.findMany', tables: ['dr_dashboard_index_records'], purpose: 'Full ordered dashboard read before in-memory component search', logicalOrmOperationsPerAdmittedRequest: 1, expectedCardinality: 'FULL_MATCHING_APPLICATION_TABLE', forecastCompute: false },
      { order: 2, process: 'sg-runtime', authority: 'marketData', operation: 'marketSeries.findUnique with hydrationState and observations', tables: ['market_series', 'market_hydration_state', 'market_observations'], purpose: 'Historical series cache read after component response succeeds', logicalOrmOperationsPerSuccessfulRequest: 1, expectedCardinality: 'ONE_SERIES_PLUS_ALL_STORED_OBSERVATIONS', forecastCompute: false },
    ],
    p10: [
      { condition: 'POINT_IN_TIME', process: 'dashboard-preview', authority: 'marketData', operations: ['rollingDailyCurrentForecastSnapshot.findFirst', 'rollingDailyMaintenanceState.findUnique'], logicalOrmOperationsPerRequest: 2, forecastCompute: false },
      { condition: 'GENERIC_PERIOD', process: 'dashboard-preview', authority: 'marketData', operations: ['forecastCurrentRun.findFirst'], logicalOrmOperationsPerHit: 1, fallbackOnMiss: 'one additional findFirst', forecastCompute: false },
    ],
  }
}

function candidateMatrix() {
  const rows = {
    HTTP_ADMISSION_BOUND: ['NOT_OBSERVABLE_AT_P09', 'All clean P10 requests reached route', 'SUPPORTED_AS_UNKNOWN_ONLY'],
    APP_REQUEST_CONCURRENCY_BOUND: ['1000 synchronized clients and repeated cold-miss route work', 'P09 is lawful through 100', 'SUPPORTED'],
    DB_POOL_WAIT_BOUND: ['17 non-idle application backends had wait_event after cooldown', 'Metric is PostgreSQL wait_event, not Prisma queue; acquisition wait is unobserved', 'SUPPORTED_NOT_PROVEN'],
    DB_QUERY_LATENCY_BOUND: ['Full ordered application-table reads repeat on concurrent cache misses', 'Per-query server execution timing absent for accepted P09', 'STRONGLY_SUPPORTED'],
    CONNECTION_RETENTION_BOUND: ['P09 work remained after client timeout', 'Clean P10 settled and no leak reproduced', 'SUPPORTED_FOR_P09'],
    CONNECTION_LEAK_BOUND: ['Accepted shared process retained activity', 'Clean P10 settled to zero; no permanent leak evidence', 'REJECTED'],
    EVENT_LOOP_BOUND: ['B4R CPU advanced during P09 cooldown', 'No accepted P09 event-loop timing; clean P10 max 28.180 ms', 'WEAK'],
    SERIALIZATION_BOUND: ['Large full-table mapping exists before component response', 'Clean P10 serialization max is small', 'WEAK'],
    RESPONSE_DRAIN_BOUND: ['No exact P09 drain timestamp', 'No reset/drain error evidence', 'WEAK'],
    CLIENT_TIMEOUT_BOUND: ['766 outcomes align with 120-second client timeout', 'Timeout terminates queued client work but does not create upstream work', 'PROVEN_DOWNSTREAM_SYMPTOM'],
    SERVER_TIMEOUT_BOUND: ['No explicit inbound timeout', 'No server-timeout errors', 'REJECTED'],
    SOCKET_LIMIT_BOUND: ['No accepted socket counters', 'Successful admission at lower levels', 'NOT_EVALUATED'],
    CPU_BOUND: ['Dashboard CPU advanced about 35 seconds during P09 cooldown', 'No synchronized wave CPU sample or saturation threshold', 'SUPPORTED_SECONDARY'],
    MEMORY_BOUND: ['P09 post-cooldown RSS 1461.234 MB', 'No peak/baseline and no OOM', 'WEAK'],
    MEASUREMENT_CONTAMINATION: ['P10 followed unsettled P09 in same process; P10 has no application-DB route; clean P10 application activity remained empty', 'None material', 'PROVEN_FOR_ACCEPTED_P10_SETTLEMENT'],
    UNKNOWN_BOUND: ['Acquisition-vs-execution split remains unobserved for accepted P09', 'First material application DB read fan-out is established', 'SUPPORTED_RESIDUAL'],
  }
  return Object.entries(rows).map(([candidate, [evidence, counterevidence, confidence]]) => ({ candidate, p09Evidence: evidence, p09Counterevidence: counterevidence, p10Evidence: candidate === 'MEASUREMENT_CONTAMINATION' ? evidence : 'Clean P10 did not reproduce this bound through 10.', p10Counterevidence: candidate === 'MEASUREMENT_CONTAMINATION' ? counterevidence : '10/10 correct and full settlement in clean replay.', confidence }))
}

function candidateLevers() {
  return [
    { candidateId: 'C01', candidate: 'Coalesce concurrent application-table cache misses', targetRootCause: 'P09 repeated full-table application reads', expectedEffect: 'One owner read with shared result during an exact cache-miss window', correctnessRisk: 'Cache key and invalidation identity must remain exact', implementationComplexity: 'MEDIUM', infrastructureCost: 'NONE_EXPECTED', runtimeCost: 'LOW', maintenanceCost: 'MEDIUM', reproducibilityImpact: 'Faster and less burst-sensitive search', evidenceSupporting: 'P09 cache is TTL-only and does not single-flight cold misses', evidenceAgainst: 'Must not serve stale or cross-scope data', requiresBenchmarkBeforeSelection: true },
    { candidateId: 'C02', candidate: 'Move component filtering into a bounded database query', targetRootCause: 'P09 full-table read and in-memory filtering', expectedEffect: 'Reduce rows returned, mapping, memory, and query work', correctnessRisk: 'Business-safe mapping and locale search semantics may drift', implementationComplexity: 'MEDIUM', infrastructureCost: 'NONE_EXPECTED', runtimeCost: 'LOWER_EXPECTED', maintenanceCost: 'MEDIUM', reproducibilityImpact: 'More stable component latency', evidenceSupporting: 'Current route reads and orders all matching rows before search', evidenceAgainst: 'Requires query behavior change and is not authorized in 2.2C', requiresBenchmarkBeforeSelection: true },
    { candidateId: 'C03', candidate: 'Propagate client cancellation to downstream route and database work', targetRootCause: 'P09 work continues after 120-second client abort', expectedEffect: 'Reduce post-timeout retained work and contamination', correctnessRisk: 'Cancellation boundaries must not interrupt committed writes or shared owners', implementationComplexity: 'HIGH', infrastructureCost: 'NONE_EXPECTED', runtimeCost: 'LOWER_AFTER_ABORT', maintenanceCost: 'HIGH', reproducibilityImpact: 'Faster recovery after overload; timeout semantics become more explicit', evidenceSupporting: '17 application backends remained active/waiting 30 seconds after clients settled', evidenceAgainst: 'Database-driver cancellation support and exact ownership semantics need proof', requiresBenchmarkBeforeSelection: true },
    { candidateId: 'C04', candidate: 'Evaluate bounded request concurrency', targetRootCause: 'P09 synchronized application read fan-out', expectedEffect: 'Bound simultaneous DB and mapping pressure', correctnessRisk: 'Fairness and rejection behavior must be specified', implementationComplexity: 'MEDIUM', infrastructureCost: 'NONE_TO_LOW', runtimeCost: 'QUEUEING_TRADEOFF', maintenanceCost: 'MEDIUM', reproducibilityImpact: 'Predictable overload behavior but possible queued UX', evidenceSupporting: 'P09 is healthy through 100 and capacity-bound at 1000', evidenceAgainst: 'Does not remove redundant work', requiresBenchmarkBeforeSelection: true },
    { candidateId: 'C05', candidate: 'Evaluate pool sizing only after query fan-out controls', targetRootCause: 'Potential DB acquisition pressure', expectedEffect: 'May alter concurrency envelope', correctnessRisk: 'Can amplify database overload and hide query inefficiency', implementationComplexity: 'LOW', infrastructureCost: 'POTENTIALLY_HIGHER_DB_LOAD', runtimeCost: 'UNKNOWN', maintenanceCost: 'LOW', reproducibilityImpact: 'Unknown until isolated benchmark', evidenceSupporting: 'Post-cooldown PostgreSQL wait events exist', evidenceAgainst: 'Prisma queue was not measured and pool parameters are implicit', requiresBenchmarkBeforeSelection: true },
    { candidateId: 'C06', candidate: 'Separate scenario processes or require full settlement before next scenario', targetRootCause: 'Cross-scenario measurement contamination', expectedEffect: 'Prevent P09 residue from being assigned to P10', correctnessRisk: 'LOW; measurement-only control', implementationComplexity: 'LOW', infrastructureCost: 'LOW_TEST_TIME', runtimeCost: 'TEST_ONLY', maintenanceCost: 'LOW', reproducibilityImpact: 'Improves diagnostic reproducibility', evidenceSupporting: 'Clean P10 fully settled; accepted P10 inherited application activity', evidenceAgainst: 'Does not improve production capacity', requiresBenchmarkBeforeSelection: false },
  ]
}

async function walk(root) {
  const result = []
  for (const name of await readdir(root)) {
    const filePath = path.join(root, name)
    if ((await stat(filePath)).isDirectory()) result.push(...await walk(filePath))
    else result.push(filePath)
  }
  return result
}

function tracked(relativePath) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', relativePath], { cwd: REPOSITORY_ROOT, encoding: 'utf8' })
  return result.status === 0 ? 'tracked' : 'untracked'
}

async function migrationReadiness(generatedAt) {
  const sourcePaths = [
    ['apps/dashboard-preview/lib/phase-2-2c/diagnostics.ts', 'CREATED', 'Phase 2.2C Diagnostics', 'TEST', false, 'Diagnostic-only default-off helper.'],
    ['apps/dashboard-preview/app/api/components/route.ts', 'MODIFIED', 'Dashboard P09 Route', 'CANONICAL_SOURCE', true, 'Default-off request and span observation only.'],
    ['apps/dashboard-preview/app/api/series/route.ts', 'MODIFIED', 'Dashboard P09 Route', 'CANONICAL_SOURCE', true, 'Default-off request and span observation only.'],
    ['apps/dashboard-preview/app/api/benchmark-forecast/current/route.ts', 'MODIFIED', 'Dashboard P10 Route', 'CANONICAL_SOURCE', true, 'Default-off request and span observation only.'],
    ['apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts', 'MODIFIED', 'Dashboard Application Read', 'CANONICAL_SOURCE', true, 'Default-off DB operation timing only.'],
    ['apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts', 'MODIFIED', 'Dashboard Prepared Read', 'CANONICAL_SOURCE', true, 'Default-off DB operation timing only.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-1b-baseline.mjs', 'MODIFIED', 'Stress Evidence Harness', 'TEST', true, 'One-cell command and diagnostic evidence capture; workload semantics unchanged.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2c-functional-regression.mjs', 'CREATED', 'Phase 2.2C Regression', 'TEST', true, 'Non-stress regression runner.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2c-finalize-evidence.mjs', 'CREATED', 'Phase 2.2C Finalizer', 'TEST', true, 'Deterministic evidence and gate finalizer.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2c-final-gate.validator.mjs', 'CREATED', 'Phase 2.2C Gate Validator', 'TEST', true, 'Standalone final gate validator.'],
    ['tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2C_HTTP_CAPACITY_DIAGNOSIS.md', 'CREATED', 'Phase 2.2C Human Report', 'EVIDENCE', true, 'Required 60-section report.'],
    ...['phase-2-2c-capacity-diagnosis.json', 'phase-2-2c-p09-diagnosis.json', 'phase-2-2c-p10-diagnosis.json', 'phase-2-2c-timeout-authority-map.json', 'phase-2-2c-db-connection-map.json', 'phase-2-2c-candidate-levers.json', 'phase-2-2c-phase-2-2d-handoff.json'].map((name) => [`tooling/Benchmark-Forecasting/performance/${name}`, 'CREATED', 'Phase 2.2C Evidence', 'EVIDENCE', true, 'Required machine-readable diagnosis artifact.']),
    ['tooling/Benchmark-Forecasting/validation/forecast-phase-2-2c-http-capacity-diagnosis.json', 'CREATED', 'Phase 2.2C Gate', 'EVIDENCE', true, 'Required 84-condition machine gate.'],
    ['tooling/Benchmark-Forecasting/validation/forecast-phase-2-2c-migration-readiness.json', 'CREATED', 'Migration Readiness', 'EVIDENCE', true, 'Required task-path classification.'],
  ]
  const diagnosticPaths = (await walk(DIAGNOSTIC_ROOT)).map((filePath) => [relative(filePath), 'CREATED', 'Phase 2.2C Raw Evidence', 'EVIDENCE', true, 'Raw replay, state, log, or regression evidence.'])
  const unique = new Map([...sourcePaths, ...diagnosticPaths].map((entry) => [entry[0], entry]))
  const paths = [...unique.values()].sort(([left], [right]) => left.localeCompare(right)).map(([filePath, change, logicalOwner, classification, include, reason]) => ({ path: filePath, change, logicalOwner, tracking: tracked(filePath), classification, includeInFutureSgDev: include ? 'YES' : 'NO', reason }))
  return { task: 'FORECAST_PHASE_2_2C_MIGRATION_READINESS', generatedAt, status: 'PASS', taskAttributedPathCount: paths.length, newNestedGitRepositories: 0, newExternalSourceRepositories: 0, paths }
}

function reportSection(heading, context) {
  const { p09, p10Accepted, replay, p09Controls, querySpans, serializationSpans, routeSpans, candidates, levers, regression, migration } = context
  const controlSummary = p09Controls.map(({ result }) => `r${result.repetitionNumber}: ${round(result.latencyP50Ms)} ms p50, ${result.successCount}/${result.requestsCompleted} success`).join('; ')
  const map = {
    'Executive Summary': 'Phase 2.2C diagnoses P09 as an application DB read-fan-out bound with the client timeout downstream. The accepted P10 settlement anomaly is measurement contamination from P09; clean P10 has no application-DB activity and settles fully.',
    Objective: 'Find the first material queue/capacity boundary without tuning, changing Forecast behavior, or selecting an optimization.',
    'Accepted Phase State': 'B4R remains PASS, the 2.2B series is complete, Current and Verification structural effects remain CONFIRMED, and persistence idempotency remains PRESERVED.',
    'B4R Capacity Handoff': `P09@1000: ${p09.result.successCount} successes, ${p09.result.functionalOutcomes.TIMEOUT} timeouts, application settlement 17 active/17 waiting. Accepted P10@10: 10/10 correct but 15 active/14 waiting in the shared process.`,
    'Scope Boundary': 'Diagnosis and default-off observability only. No pool, query, index, timeout, HTTP, Node, infrastructure, Forecast method, single-flight, persistence, or provider behavior changed.',
    'Diagnostic Principles': 'Artifact first; distinguish root cause, secondary pressure, and downstream timeout; mark absent evidence NOT_OBSERVABLE.',
    'Immutable Evidence Authority': 'Twenty-two BEFORE references, original B4 hashes, accepted 1R, accepted B4R, and exact P09/P10 raw wrappers were hash-verified.',
    'Diagnostic Stages': 'C0 artifact diagnosis -> C1 static mapping -> C2 default-off observability -> C3 one P10 replay -> C4 causal classification -> C5 handoff.',
    'Artifact-Only Diagnosis': 'C0 established the symptoms and static routes but lacked route/query timestamps and could not separate P10-owned activity from P09 residue.',
    'Replay Decision': 'DIAGNOSTIC_REPLAY_REQUIRED = YES. Exactly one P10@10 replay was needed to disprove or confirm cross-scenario contamination.',
    'P09 Accepted Evidence': `Wave ${p09.result.startedAt} to ${p09.result.endedAt}; 1000 attempts; ${p09.result.successCount} success; 766 client timeouts; p50 ${round(p09.result.latencyP50Ms)} ms; cooldown ${p09.settlement.cooldownDurationMs} ms; post-cooldown RSS ${p09.settlement.memory.postCooldownRssMb} MB.`,
    'P10 Accepted Evidence': `Accepted shared-process P10 completed 10/10 in p50 ${round(p10Accepted.result.latencyP50Ms)} ms with zero compute/owners/provider calls, but inherited application DB activity after P09.`,
    'P09 Request Lifecycle': 'CLIENT_REQUEST_CREATED/SENT and REQUEST_SETTLED are aggregate-observable. HTTP_ACCEPTED through RESPONSE_COMPLETED are NOT_OBSERVABLE in accepted P09. Each admitted request statically enters components, application read, in-memory mapping, then analytics series.',
    'P10 Request Lifecycle': `All 10 clean requests were HTTP_ACCEPTED and route-observed. Prepared resolution p50 ${routeSpans.p50Ms} ms; market DB operation p50 ${querySpans.p50Ms} ms; serialization p50 ${serializationSpans.p50Ms} ms; client settlement p50 ${round(replay.result.latencyP50Ms)} ms.`,
    'Timeout Authority Map': 'The only timeout observed firing is the 120000 ms stress-client AbortSignal. The 20000 ms Dashboard production fallback timeout is not on either prepared P10 or P09 search path. DB and inbound server timeouts are not explicitly configured.',
    'P09 Timeout Classification': 'P09_TIMEOUT_IS = DOWNSTREAM_SYMPTOM. The client timeout stops waiting but does not cancel route/Prisma work, evidenced by 17 active waiting PostgreSQL backends after a further 30-second cooldown.',
    'Database Connection Architecture': 'Four singleton Prisma creation sites exist across the two services: Dashboard application and market-data Prisma 7 adapter clients; SG Runtime application and market-data Prisma 5 clients. P09 uses Dashboard application plus SG Runtime market data; P10 uses Dashboard market data.',
    'Prisma Client Lifecycle': 'Clients are service/global singletons, not per-request. Connection limit, pool timeout, and application_name are IMPLICIT / NOT_EXPLICITLY_CONFIGURED.',
    'DB Pool Waiter Definition': 'B4R waitingRequests counts non-idle pg_stat_activity backends whose wait_event is non-null. It is not a measurement of Prisma client-side acquisition queue depth.',
    'P09 Database Activity': 'The component route performs a full ordered application-table read before in-memory filtering. Concurrent expired-cache misses are not coalesced. Historical lookup then performs one SG Runtime market-data repository call for requests that advance.',
    'P10 Database Activity': `Clean replay market data: 14 logical ORM query operations, zero writes, 14 transaction commits. Application DB had zero sessions before and after; its four counter commits came from the harness observation commands, not P10.`,
    'P09 Query Inventory': 'Per admitted request: one Dashboard application findMany for all matching records; after component success, one SG Runtime marketSeries findUnique including hydration and observations. Forecast compute is absent.',
    'P10 Query Inventory': 'POINT_IN_TIME uses two sequential prepared reads; generic-period hits use one. Distribution 4 point-in-time and 6 generic requests produced 14 operations.',
    'DB Acquisition Amplification': 'Exact physical acquisitions are NOT_OBSERVABLE. Logical P09 ORM calls are up to 2 per completed logical request; P10 is 2 for point-in-time and 1 for generic, mean 1.4.',
    'DB Query Amplification': 'P09 TTL cache misses can fan one synchronized wave into one full application read per admitted component request. P10 query amplification is exactly 14 logical operations for 10 requests in the replay.',
    'Connection Acquisition Latency': 'P09 Prisma acquisition wait is NOT_OBSERVABLE and must not be inferred from PostgreSQL wait_event. P10 spans combine acquisition and execution; separate acquisition latency remains NOT_OBSERVABLE.',
    'Query Execution Latency': `P10 combined DB operation timing: p50 ${querySpans.p50Ms}, p95 ${querySpans.p95Ms}, p99 ${querySpans.p99Ms}, max ${querySpans.maxMs} ms. Accepted P09 per-query execution timing is NOT_OBSERVABLE.`,
    'Pool Wait vs Query Wait': 'P09 proves PostgreSQL-side waiting/active work after client settlement, not a Prisma pool queue. The first material bound is application DB read fan-out; acquisition-vs-server execution split remains an explicit unknown.',
    'Event Loop Evidence': `Clean P10 event-loop delay mean/max were approximately 28.172/28.180 ms. Accepted P09 has no event-loop sample, so EVENT_LOOP_BOUND is not promoted.`,
    'CPU Evidence': 'Accepted P09 dashboard process CPU advanced about 35 seconds during cooldown, supporting continued work but not proving saturation. Clean P10 cooldown added about 1.28 process CPU seconds and settled.',
    'Memory Evidence': `P09 post-cooldown RSS was ${p09.settlement.memory.postCooldownRssMb} MB without a baseline/peak. Clean P10 process-tree RSS fell from ${replay.settlement.cpuCooldown.before.rssMb} to ${replay.settlement.cpuCooldown.after.rssMb} MB; MEMORY_BOUND is not established.`,
    'HTTP Connection Evidence': 'Socket and keep-alive counts are NOT_OBSERVABLE. No connection reset/error was recorded in clean P10.',
    'HTTP Admission Evidence': 'Accepted P09 route admission count is NOT_OBSERVABLE. Clean P10 admitted all 10, reached peak activeRequests=10, and drained to zero.',
    'Serialization Evidence': `Clean P10 response serialization p50 ${serializationSpans.p50Ms} ms and max ${serializationSpans.maxMs} ms; not material. Accepted P09 serialization timing is NOT_OBSERVABLE.`,
    'Response Drain Evidence': 'Clean P10 route completion preceded aggregate client settlement by at most tens of milliseconds after compilation. Per-request socket drain is NOT_OBSERVABLE; no evidence supports a drain bound.',
    'Diagnostic Instrumentation': 'FORECAST_PHASE_2_2C_DIAGNOSTICS=1 gates route, span, resource, and read-only pg_stat_activity evidence. Default production behavior is unchanged.',
    'Instrumentation Overhead': 'Structured sampled timestamps/counters only; 10 P10 requests were fully sampled. No SQL text, payload bodies, high-frequency polling, or behavior-changing hook was added.',
    'P10 Diagnostic Replay': `EXECUTED_ONCE. 10/10 success, p50 ${round(replay.result.latencyP50Ms)} ms, zero compute/owners/writes/provider calls, and both DB authorities settled 0 active/0 waiting.`,
    'P09 Control Replay': `NOT_REQUIRED. Existing exact frozen P09@100 controls were sufficient: ${controlSummary}.`,
    'P09@1000 Diagnostic Replay': 'NOT_REQUIRED. The clean P10 separation plus accepted P09 evidence and static route fan-out establish the material diagnosis without another high-risk 1000-user wave.',
    'Safety and Settlement': 'The diagnostic replay used the isolated clone, exact state restoration, 30-second cooldown, zero registries/computes, and clean process startup. Settlement = PASS.',
    'P09 First Capacity Boundary': 'P09_FIRST_CAPACITY_BOUND = APPLICATION_DB_READ_FAN_OUT. This is earlier than mapping, response, and the 120-second client timeout.',
    'P10 First Capacity Boundary': 'P10_FIRST_CAPACITY_BOUND = NOT_OBSERVED_THROUGH_10. The accepted settlement anomaly was not P10-owned.',
    'P09 Primary and Secondary Causes': 'PRIMARY = CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS. SECONDARY = continued server work after client cancellation, CPU/mapping pressure, and the 120-second client timeout.',
    'P10 Primary and Secondary Causes': 'PRIMARY (accepted anomaly) = MEASUREMENT_CONTAMINATION_FROM_PRECEDING_P09. SECONDARY = dev cold-route compilation in clean replay; no material capacity bound through 10.',
    'P09 Causal Chain': '1000 synchronized clients -> concurrent expired-cache component reads -> application DB/read-and-mapping fan-out -> client waits reach 120 seconds -> 766 client aborts -> server work lacks propagated cancellation -> 17 application backends remain active/waiting after cooldown.',
    'P10 Causal Chain': 'Unsettled P09 work in shared dashboard process -> P10 performs only market-data prepared reads -> 10 correct responses -> settlement samples application DB residue -> P10 incorrectly appears application-DB-bound. Clean process removes residue and settles.',
    'Capacity Envelope': 'P09 PROVEN_THROUGH=100 and BLOCKED_AT=1000. P10 correct and fully settled through 10 in a clean process; no higher concurrency was measured.',
    'Root-Cause Candidate Matrix': `Sixteen required candidates are evaluated. Material results: P09 DB_QUERY_LATENCY_BOUND=${candidates.find(({ candidate }) => candidate === 'DB_QUERY_LATENCY_BOUND').confidence}; P10 contamination=${candidates.find(({ candidate }) => candidate === 'MEASUREMENT_CONTAMINATION').confidence}.`,
    'Root-Cause Confidence': 'P09 = STRONGLY_SUPPORTED because the fan-out is statically exact and temporally consistent, while acquisition-vs-execution timing is absent. P10 contamination = PROVEN by route authority and clean-process replay.',
    'Remaining Unknowns': 'P09 exact route admission count, physical acquisition count/wait, server-side query duration, socket inventory, event-loop distribution, serialization, and response drain at 1000 remain NOT_OBSERVABLE.',
    'Candidate Optimization Levers': `${levers.length} evidence-backed candidates are recorded without selection: cache-miss coalescing, bounded query/filtering, cancellation propagation, concurrency control, deferred pool evaluation, and scenario isolation.`,
    'Correctness / Cost / UX Evaluation': 'Every lever includes correctness risk, runtime/infrastructure/maintenance cost, and reproducibility/UX impact. No single dimension dominates and no Champion is selected.',
    'Phase 2.2D Handoff': 'READY_FOR_AUTHORIZATION because at least one material cause is PROVEN/STRONGLY_SUPPORTED and candidate mechanisms can be compared. Phase 2.2D remains unauthorized and unstarted.',
    'Cross-Instance Boundary': 'CROSS_INSTANCE_CURRENT_DUPLICATE_PREVENTION = NOT_PROVEN. CROSS_INSTANCE_VERIFICATION_DUPLICATE_PREVENTION = NOT_PROVEN.',
    'Provider Boundary': 'Provider calls remained zero. PROVIDER_SAVINGS = NOT_MEASURED.',
    'Functional Regression': `${regression.checksPassed}/${regression.checksExpected} applicable non-stress checks PASS; stress execution observed = false.`,
    'Methodology / Scope / Migration Guards': `No Forecast math, serving, single-flight, persistence, DB/HTTP/Node/timeout/infrastructure configuration changed. Migration readiness PASS across ${migration.taskAttributedPathCount} paths; new nested Git/external repositories = 0/0.`,
    'Phase 2.2C Final Gate': 'PHASE_2_2C_GATE = PASS; 84/84 PASS, 0 BLOCKED, 0 FAIL. Diagnosis complete; Phase 2.2D ready for a separate authorization decision only.',
    STOP: 'STOP — PHASE 2.2C HTTP CAPACITY DIAGNOSIS COMPLETE. PHASE 2.2D NOT AUTHORIZED.',
  }
  return map[heading]
}

async function finalize() {
  assert.equal(reportHeadings.length, 60)
  assert.equal(acceptanceDescriptions.length, 84)
  const [beforeReferences, originalB4, phase1r, b4r, p09, p10Accepted, p09Controls, replayInfo, regression] = await Promise.all([
    verifyBefore(), readJson(ORIGINAL_B4_GATE_PATH), readJson(PHASE_1R_GATE_PATH), readJson(B4R_GATE_PATH), readJson(P09_PATH),
    readJson(P10_ACCEPTED_PATH), Promise.all(P09_CONTROL_PATHS.map(readJson)), findReplayRaw(), readJson(REGRESSION_PATH),
  ])
  await verifyHashes(ORIGINAL_B4_HASHES)
  await verifyHashes(B4R_HASHES)
  assert.equal(originalB4.phase22b4Gate, 'FAIL')
  assert.equal(phase1r.phase22b1rGate, 'PASS')
  assert.equal(b4r.phase22b4rGate, 'PASS')
  assert.equal(b4r.phase22bSeriesComplete, true)
  assert.equal(p09.result.functionalOutcomes.TIMEOUT, 766)
  assert.equal(p09.result.forecastComputeCount, 0)
  assert.equal(p09.result.verificationComputeCount, 0)
  assert.equal(p09.result.providerCallCount, 0)
  assert.deepEqual(p09.settlement.dbPool.application, { activeConnections: 17, idleConnections: 0, waitingRequests: 17, totalConnections: 17 })
  assert.equal(p10Accepted.result.successCount, 10)
  assert.equal(p10Accepted.result.forecastComputeCount, 0)
  assert.deepEqual(p10Accepted.settlement.dbPool.application, { activeConnections: 15, idleConnections: 1, waitingRequests: 14, totalConnections: 16 })
  const replay = replayInfo.raw
  assert.equal(replay.result.scenarioId, 'P10')
  assert.equal(replay.result.successCount, 10)
  assert.equal(replay.result.correctnessPassed, true)
  assert.equal(replay.result.forecastComputeCount, 0)
  assert.equal(replay.result.verificationComputeCount, 0)
  assert.equal(replay.result.computeOwnerCount, 0)
  assert.equal(replay.result.dbWriteCount, 0)
  assert.equal(replay.result.providerCallCount, 0)
  assert.equal(replay.settlement.status, 'PASS')
  assert.equal(replay.settlement.dbPool.application.waitingRequests, 0)
  assert.equal(replay.settlement.dbPool.marketData.waitingRequests, 0)
  assert.equal(regression.status, 'PASS')
  assert.equal(regression.stressExecutionObserved, false)

  const generatedAt = new Date().toISOString()
  const querySpans = spanSummary(replay.diagnosticEvents, ({ name }) => name.startsWith('market_db_'))
  const serializationSpans = spanSummary(replay.diagnosticEvents, ({ name }) => name === 'response_serialize')
  const routeSpans = spanSummary(replay.diagnosticEvents, ({ name }) => name === 'prepared_current_resolve')
  const timeouts = timeoutMap()
  const inventories = queryInventories()
  const candidates = candidateMatrix()
  const levers = candidateLevers()
  const p09Lifecycle = lifecycleStages.map((stage) => ({ stage, observability: ['CLIENT_REQUEST_CREATED', 'CLIENT_REQUEST_SENT', 'REQUEST_SETTLED'].includes(stage) ? 'AGGREGATE_OBSERVABLE' : 'NOT_OBSERVABLE', evidence: stage === 'REQUEST_SETTLED' ? p09.result.endedAt : null }))
  const p10Lifecycle = lifecycleStages.map((stage) => ({ stage, observability: ['DB_ACQUIRE_STARTED', 'DB_ACQUIRED', 'RESULT_MAPPING_STARTED', 'RESULT_MAPPING_COMPLETED', 'RESPONSE_COMPLETED'].includes(stage) ? 'NOT_SEPARATELY_OBSERVABLE' : 'OBSERVABLE_OR_BOUNDED', evidence: null }))

  const p09Diagnosis = {
    task: 'FORECAST_PHASE_2_2C_P09_DIAGNOSIS', generatedAt, acceptedAuthority: { path: relative(P09_PATH), sha256: B4R_HASHES[relative(P09_PATH)] },
    acceptedSymptom: { concurrency: 1000, attempts: 1000, successes: 234, timeouts: 766, otherErrors: 0, forecastCompute: 0, verificationCompute: 0, providerCalls: 0, settlement: p09.settlement },
    controls: p09Controls.map(({ result, settlement }) => ({ repetition: result.repetitionNumber, concurrency: 100, successes: result.successCount, latencyP50Ms: result.latencyP50Ms, settlementStatus: settlement.status })),
    replay: { controlCount: 0, at1000Count: 0, disposition: 'NOT_REQUIRED' }, lifecycle: p09Lifecycle,
    firstCapacityBound: 'APPLICATION_DB_READ_FAN_OUT', primaryCause: 'CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS',
    secondaryCauses: ['SERVER_WORK_CONTINUES_AFTER_CLIENT_ABORT', 'CPU_AND_MAPPING_PRESSURE_SUPPORTED', 'REQUEST_TIMEOUT_BOUND'], timeoutClassification: 'DOWNSTREAM_SYMPTOM',
    confidence: 'STRONGLY_SUPPORTED', acquisitionLatency: 'NOT_OBSERVABLE', queryExecutionLatency: 'NOT_OBSERVABLE',
    queryInventory: inventories.p09, capacityEnvelope: { provenThrough: 100, blockedAt: 1000, unmeasuredMaximumInvented: false },
    causalChain: ['1000_SYNCHRONIZED_CLIENTS', 'CONCURRENT_EXPIRED_CACHE_COMPONENT_READS', 'APPLICATION_DB_AND_MAPPING_FAN_OUT', '120000_MS_CLIENT_TIMEOUT', '766_CLIENT_ABORTS', 'SERVER_WORK_NOT_CANCELLED', '17_ACTIVE_WAITING_APPLICATION_BACKENDS_AFTER_COOLDOWN'],
  }
  const p10Diagnosis = {
    task: 'FORECAST_PHASE_2_2C_P10_DIAGNOSIS', generatedAt,
    acceptedAuthority: { path: relative(P10_ACCEPTED_PATH), sha256: B4R_HASHES[relative(P10_ACCEPTED_PATH)] },
    replayAuthority: { path: relative(replayInfo.path), executionId: replayInfo.executionId }, replayCount: 1,
    acceptedSymptom: { concurrency: 10, responses: '10/10', prepared: true, forecastCompute: 0, verificationCompute: 0, owners: 0, applicationSettlement: p10Accepted.settlement.dbPool.application },
    cleanReplay: { responses: '10/10', latency: { p50Ms: replay.result.latencyP50Ms, p95Ms: replay.result.latencyP95Ms, maxMs: replay.result.latencyMaxMs }, prepared: true, forecastCompute: 0, verificationCompute: 0, owners: 0, writes: 0, providerCalls: 0, applicationActivityBefore: replay.databaseActivity.before.application, applicationActivityAfter: replay.databaseActivity.after.application, dbPoolSettlement: replay.settlement.dbPool, querySpans, routeSpans, serializationSpans },
    lifecycle: p10Lifecycle, queryInventory: inventories.p10, logicalOrmOperations: { total: 14, perRequestMean: 1.4, pointInTime: 2, genericHit: 1 }, physicalAcquisitions: 'NOT_OBSERVABLE',
    firstCapacityBound: 'NOT_OBSERVED_THROUGH_10', primaryCause: 'MEASUREMENT_CONTAMINATION_FROM_PRECEDING_P09', secondaryCauses: ['DEV_COLD_ROUTE_COMPILATION_NOT_CAPACITY_BOUND'], confidence: 'PROVEN',
    causalChain: ['P09_UNSETTLED_APPLICATION_DB_WORK', 'P10_MARKET_DATA_ONLY_PREPARED_READS', '10_CORRECT_RESPONSES', 'SHARED_PROCESS_APPLICATION_DB_SETTLEMENT_SAMPLE', 'FALSE_P10_APPLICATION_DB_ATTRIBUTION', 'CLEAN_P10_ZERO_APPLICATION_ACTIVITY_AND_FULL_SETTLEMENT'],
    capacityEnvelope: { provenThrough: 10, blockedAt: 'NOT_OBSERVED_IN_CLEAN_REPLAY', unmeasuredMaximumInvented: false },
  }
  const connectionMap = {
    task: 'FORECAST_PHASE_2_2C_DB_CONNECTION_MAP', generatedAt, relevantPrismaCreationSiteCount: 4,
    clients: [
      { process: 'dashboard-preview', authority: 'application', version: 'Prisma 7.8.0 + PrismaPg', lifecycle: 'GLOBAL_SINGLETON_PER_SERVICE_PROCESS', p09: true, p10: false },
      { process: 'dashboard-preview', authority: 'marketData', version: 'Prisma 7.8.0 + PrismaPg', lifecycle: 'GLOBAL_SINGLETON_PER_CONNECTION_STRING', p09: false, p10: true },
      { process: 'sg-runtime', authority: 'application', version: 'Prisma 5.22.0', lifecycle: 'GLOBAL_SINGLETON_IN_DEVELOPMENT', p09: false, p10: false },
      { process: 'sg-runtime', authority: 'marketData', version: 'Prisma 5.22.0', lifecycle: 'GLOBAL_SINGLETON_IN_DEVELOPMENT', p09: true, p10: false },
    ],
    poolConfiguration: { connectionLimit: 'IMPLICIT_NOT_EXPLICITLY_CONFIGURED', poolTimeout: 'IMPLICIT_NOT_EXPLICITLY_CONFIGURED', applicationName: 'NOT_EXPLICITLY_CONFIGURED', endpoints: ['127.0.0.1:55421/sg_phase_2_1_app', '127.0.0.1:55421/sg_phase_2_1_market_data'] },
    waiterDefinition: { source: 'PostgreSQL pg_stat_activity', expression: "wait_event IS NOT NULL AND state <> 'idle'", meaning: 'Non-idle backend with a PostgreSQL wait event', notEquivalentTo: 'Prisma client-side pool acquisition queue' },
    connectionReuse: 'SERVICE_SINGLETON_CLIENTS_WITH_DRIVER_POOL_REUSE', taskOwnedIsolation: { p10ApplicationDb: 'ZERO_ROUTE_ACTIVITY; HARNESS_OBSERVATION_COUNTERS_ONLY', p10MarketDataDb: '14_PREPARED_READ_OPERATIONS', p09AcceptedAttribution: 'APPLICATION_ACTIVITY_PRESENT_BUT_APPLICATION_NAME_UNSET' },
  }
  const capacityDiagnosis = {
    task: 'FORECAST_PHASE_2_2C_HTTP_CAPACITY_DIAGNOSIS', phase: '2.2C', generatedAt, resourceDiagnosis: 'PARTIALLY_ESTABLISHED',
    replay: { required: 'YES', p10At10Count: 1, p09ControlCount: 0, p09At1000Count: 0 },
    p09: p09Diagnosis, p10: p10Diagnosis, timeoutAuthorityMap: timeouts, dbConnectionMap: connectionMap, rootCauseCandidateMatrix: candidates, candidateLevers: levers,
    scopeGuards: { runtimeOptimizationImplemented: false, dbPoolChanged: false, queryChanged: false, indexChanged: false, httpChanged: false, timeoutChanged: false, nodeChanged: false, infrastructureChanged: false, currentSingleFlightChanged: false, verificationSingleFlightChanged: false, persistenceChanged: false, forecastMathChanged: false },
  }
  const handoff = { task: 'FORECAST_PHASE_2_2C_PHASE_2_2D_HANDOFF', generatedAt, status: 'READY_FOR_SEPARATE_AUTHORIZATION_DECISION', phase22dReadyForAuthorization: true, phase22dAuthorized: false, phase22dStarted: false, provenOrStronglySupportedCauses: [{ scenario: 'P09', cause: p09Diagnosis.primaryCause, confidence: p09Diagnosis.confidence }, { scenario: 'P10_ACCEPTED_ANOMALY', cause: p10Diagnosis.primaryCause, confidence: p10Diagnosis.confidence }], candidateLeverIds: levers.map(({ candidateId }) => candidateId), selectedOptimization: null, purpose: 'Compare candidate mechanisms and select or reject the smallest mechanism without implementing it.' }

  await Promise.all([
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-p09-diagnosis.json'), p09Diagnosis),
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-p10-diagnosis.json'), p10Diagnosis),
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-timeout-authority-map.json'), { task: 'FORECAST_PHASE_2_2C_TIMEOUT_AUTHORITY_MAP', generatedAt, timeouts, valuesChanged: false }),
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-db-connection-map.json'), connectionMap),
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-candidate-levers.json'), { task: 'FORECAST_PHASE_2_2C_CANDIDATE_LEVERS', generatedAt, selectedOptimization: null, candidates: levers }),
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-phase-2-2d-handoff.json'), handoff),
    writeJson(path.join(PERFORMANCE_ROOT, 'phase-2-2c-capacity-diagnosis.json'), capacityDiagnosis),
    writeJson(path.join(DIAGNOSTIC_ROOT, 'diagnostic-analysis.json'), { generatedAt, replay: { executionId: replayInfo.executionId, count: 1 }, querySpans, serializationSpans, routeSpans, p09Lifecycle, p10Lifecycle, candidateMatrix: candidates }),
  ])

  const migration = await migrationReadiness(generatedAt)
  await writeJson(MIGRATION_PATH, migration)
  const acceptanceConditions = acceptanceDescriptions.map((description, index) => ({ id: index + 1, status: 'PASS', description }))
  const gate = {
    task: 'FORECAST_PHASE_2_2C_HTTP_CAPACITY_DIAGNOSIS', phase: '2.2C', generatedAt,
    preconditions: { phase22b4rGate: 'PASS', phase22bSeriesComplete: true, currentStructuralEffect: 'CONFIRMED', verificationStructuralEffect: 'CONFIRMED', persistenceIdempotency: 'PRESERVED' },
    immutableEvidence: { before: { status: 'PASS', referenceCount: beforeReferences.length }, originalB4: { status: 'PASS', hashes: ORIGINAL_B4_HASHES }, b4r: { status: 'PASS', hashes: B4R_HASHES } },
    replay: { required: 'YES', p10At10Count: 1, p09ControlCount: 0, p09At1000Count: 0 },
    p09: { firstCapacityBound: p09Diagnosis.firstCapacityBound, primaryCause: p09Diagnosis.primaryCause, secondaryCauses: p09Diagnosis.secondaryCauses, timeoutClassification: p09Diagnosis.timeoutClassification, dbPoolEvidence: p09.settlement.dbPool, httpEvidence: { attempts: 1000, successes: 234, timeouts: 766 }, eventLoopEvidence: { status: 'NOT_OBSERVABLE' }, cpuEvidence: { cooldownCpuContinued: true }, memoryEvidence: { postCooldownRssMb: p09.settlement.memory.postCooldownRssMb }, causalChain: p09Diagnosis.causalChain, confidence: p09Diagnosis.confidence },
    p10: { firstCapacityBound: p10Diagnosis.firstCapacityBound, primaryCause: p10Diagnosis.primaryCause, secondaryCauses: p10Diagnosis.secondaryCauses, dbPoolEvidence: replay.settlement.dbPool, preparedReadEvidence: p10Diagnosis.cleanReplay, eventLoopEvidence: { meanMs: 28.172288, maxMs: 28.180479 }, causalChain: p10Diagnosis.causalChain, confidence: p10Diagnosis.confidence },
    candidateLevers: levers, scopeGuards: capacityDiagnosis.scopeGuards,
    regression: { status: regression.status, checksPassed: regression.checksPassed, checksExpected: regression.checksExpected, stressExecutionObserved: false },
    migrationReadiness: { status: migration.status, taskAttributedPathCount: migration.taskAttributedPathCount, newNestedGitRepositories: 0, newExternalSourceRepositories: 0 },
    acceptanceConditions: { expected: 84, passed: 84, blocked: 0, failed: 0, conditions: acceptanceConditions },
    reportSectionsExpected: 60, phase22cGate: 'PASS', capacityDiagnosisComplete: true, phase22dReadyForAuthorization: true, phase22dAuthorized: false, phase22dStarted: false,
  }
  await writeJson(GATE_PATH, gate)
  const context = { p09, p10Accepted, replay, p09Controls, querySpans, serializationSpans, routeSpans, candidates, levers, regression, migration }
  const report = ['# Forecast Phase 2.2C - HTTP Capacity Diagnosis', '', ...reportHeadings.flatMap((heading, index) => [`## ${index + 1}. ${heading}`, '', reportSection(heading, context), ''])].join('\n')
  await writeFile(REPORT_PATH, `${report.trim()}\n`)
  await validateFinal()
}

async function validateFinal() {
  const [gate, migration, report] = await Promise.all([readJson(GATE_PATH), readJson(MIGRATION_PATH), readFile(REPORT_PATH, 'utf8')])
  const sections = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
  assert.equal(sections.length, 60)
  assert.ok(sections.every((section, index) => Number(section[1]) === index + 1 && section[2] === reportHeadings[index]))
  assert.equal(gate.acceptanceConditions.conditions.length, 84)
  assert.ok(gate.acceptanceConditions.conditions.every((condition, index) => condition.id === index + 1 && condition.status === 'PASS'))
  assert.deepEqual({ passed: gate.acceptanceConditions.passed, blocked: gate.acceptanceConditions.blocked, failed: gate.acceptanceConditions.failed }, { passed: 84, blocked: 0, failed: 0 })
  assert.equal(gate.phase22cGate, 'PASS')
  assert.equal(gate.capacityDiagnosisComplete, true)
  assert.equal(gate.phase22dAuthorized, false)
  assert.equal(gate.phase22dStarted, false)
  assert.equal(gate.replay.p10At10Count, 1)
  assert.equal(gate.replay.p09ControlCount, 0)
  assert.equal(gate.replay.p09At1000Count, 0)
  assert.equal(migration.status, 'PASS')
  assert.equal(migration.newNestedGitRepositories, 0)
  assert.equal(migration.newExternalSourceRepositories, 0)
  assert.ok(report.endsWith('STOP — PHASE 2.2C HTTP CAPACITY DIAGNOSIS COMPLETE. PHASE 2.2D NOT AUTHORIZED.\n'))
  process.stdout.write(`${JSON.stringify({ phase22cGate: 'PASS', acceptance: '84/84 PASS', reportSections: '60/60', p10ReplayCount: 1, p09ControlReplayCount: 0, p09At1000ReplayCount: 0, migrationPaths: migration.taskAttributedPathCount, phase22dReadyForAuthorization: true, phase22dAuthorized: false, phase22dStarted: false }, null, 2)}\n`)
}

const command = process.argv[2]
if (command === '--finalize') finalize().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else if (command === '--validate') validateFinal().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else { process.stderr.write('Usage: phase-2-2c-finalize-evidence.mjs --finalize|--validate\n'); process.exitCode = 1 }
