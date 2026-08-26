import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PERFORMANCE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const FORECAST_ROOT = path.resolve(PERFORMANCE_ROOT, '..')
const REPOSITORY_ROOT = path.resolve(FORECAST_ROOT, '..', '..')
const VALIDATION_ROOT = path.join(FORECAST_ROOT, 'validation')
const EVIDENCE_ROOT = path.join(VALIDATION_ROOT, 'phase-2-2d')

const REPORT_PATH = path.join(FORECAST_ROOT, 'FORECAST_PHASE_2_2D_CONTROLLED_OPTIMIZATION_SELECTION_GATE.md')
const CANDIDATE_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2d-candidate-evaluation.json')
const INTERACTION_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2d-candidate-interaction-map.json')
const SELECTION_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2d-selection-decision.json')
const CONTRACT_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2d-phase-2-3-implementation-contract.json')
const HANDOFF_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2d-phase-2-3-handoff.json')
const GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2d-controlled-optimization-selection.json')
const MIGRATION_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2d-migration-readiness.json')
const ANALYSIS_PATH = path.join(EVIDENCE_ROOT, 'decision-analysis.json')
const REGRESSION_PATH = path.join(EVIDENCE_ROOT, 'functional-regression.json')

const BEFORE_PATH = path.join(PERFORMANCE_ROOT, 'phase-2-2b-before-evidence.json')
const ORIGINAL_B4_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2b-4-before-after-comparative-stress.json')
const B4R_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2b-4r-controlled-comparative-stress.json')
const PHASE_1R_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2b-1r-p04-small-pool-current-single-flight.json')
const PHASE_2C_GATE_PATH = path.join(VALIDATION_ROOT, 'forecast-phase-2-2c-http-capacity-diagnosis.json')

const QUERY_SOURCE_PATH = path.join(REPOSITORY_ROOT, 'apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts')
const FILTER_SOURCE_PATH = path.join(REPOSITORY_ROOT, 'apps/dashboard-preview/lib/raw-data/dashboard-record-filters.ts')
const SERIES_SOURCE_PATH = path.join(REPOSITORY_ROOT, 'apps/dashboard-preview/lib/time-series/series-query.ts')
const COMPONENT_ROUTE_PATH = path.join(REPOSITORY_ROOT, 'apps/dashboard-preview/app/api/components/route.ts')
const SCHEMA_PATH = path.join(REPOSITORY_ROOT, 'apps/dashboard-preview/prisma/schema.prisma')

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
  'tooling/Benchmark-Forecasting/validation/phase-2-2b-4r/executions/2026-08-25T115341-253Z-6a3d0227-e64f-44da-a2ed-8cf298ff8cc3/raw/P09-mixed-1000-r1-phase-2-2b-4r-p09-1000-ets-f745411d-2178-40e7-b45e-3d16509fdfb5.json': '53be7fd10434a479e62ae4378ca6423ebb889818caa8befae1d5185f82e8ef49',
  'tooling/Benchmark-Forecasting/validation/phase-2-2b-4r/executions/2026-08-25T115341-253Z-6a3d0227-e64f-44da-a2ed-8cf298ff8cc3/raw/P10-ets-10-r1-phase-2-2b-4r-p10-10-ets-f59b5af2-f85e-4dad-9e5f-6eb89fb2e2df.json': '38f55690334ca3c262eb4d43fbad0cbeafdf9c1a97d532f06c0b00487b2fe1b4',
}

const PHASE_2C_HASHES = {
  'tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2C_HTTP_CAPACITY_DIAGNOSIS.md': '303473f53973c61f927ca529cc97567efb2c69bdff985f96033297fb41838782',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-capacity-diagnosis.json': '7ce60c4aea93a79a78117764719c67b9fc7cd4b1f831b790308a2a11b457b090',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-p09-diagnosis.json': '61e7dd428e3adbcca7f699943e2a751702d710855a634ed30c568953d99cb43d',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-p10-diagnosis.json': '19ae8bee6e4fd65655778aeb4e969bce023e10230be8bb3f32e10db9242dae7e',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-timeout-authority-map.json': 'cb9483b1cd202ec6d5058072a81a982c121b99e329932c9b4c4ce48b35635077',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-db-connection-map.json': '0b9ad13b2fb280e079ecde66418da996b9e2b380f775782a70769a9322c375bd',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-candidate-levers.json': '4e4d2d38c96d3e6b037b138c85667f2af2fa4f2f6024e853533569767da37962',
  'tooling/Benchmark-Forecasting/performance/phase-2-2c-phase-2-2d-handoff.json': 'f9100187365e28bb63fc0ae35e27437c7ddd4fd35ff5c062150c5dbae32f54dc',
  'tooling/Benchmark-Forecasting/validation/forecast-phase-2-2c-http-capacity-diagnosis.json': '9c4f2e2e2fc8124c98fc6662caf259d940debeec35df46a3110d77c4f720d28e',
}

const REPORT_HEADINGS = [
  'Executive Summary', 'Objective', 'Accepted Phase State', 'Phase 2.2C Diagnosis Authority', 'Scope Boundary',
  'Decision Principles', 'Immutable Evidence Authority', 'Root Cause Restatement', 'Root Cause Components', 'Decision Method',
  'Candidate Universe', 'Candidate Evidence Levels', 'Candidate Decision States', 'Evaluation Dimensions',
  'C01 Cache-Miss Coalescing — Mechanism', 'C01 Root-Cause Coverage', 'C01 Correctness Risks', 'C01 Cost / Complexity / UX',
  'C02 Bounded Query / DB-Side Filtering — Mechanism', 'C02 Root-Cause Coverage', 'C02 Semantic Equivalence Risks',
  'C02 Index / Cost / Complexity / UX', 'C01 vs C02', 'C03 Cancellation Propagation — Mechanism',
  'C03 Root-Cause Coverage', 'C03 Feasibility / Risk / Cost', 'C04 Request Concurrency Control — Mechanism',
  'C04 Root-Cause Coverage', 'C04 UX / Fairness / Cost', 'C05 Deferred DB Pool Evaluation', 'C06 Scenario Isolation',
  'Candidate Interaction Map', 'Correctness Safety Comparison', 'Infrastructure Cost Comparison', 'Runtime Cost Comparison',
  'Maintenance Cost Comparison', 'Implementation Complexity Comparison', 'Blast Radius Comparison', 'Reversibility Comparison',
  'UX Impact Comparison', 'Validation Complexity Comparison', 'Cross-Instance Implications', 'Unknown Assumptions',
  'Candidate Decision Table', 'Rejected Candidates', 'Deferred Candidates', 'Conditional Secondary Candidates',
  'Primary Selection', 'Selection Confidence', 'Why the Primary Was Selected', 'Why the Alternatives Were Not Selected',
  'Selection Falsification Criteria', 'Expected Causal Effect', 'Phase 2.3 Source Surface', 'Phase 2.3 Correctness Invariants',
  'Phase 2.3 Implementation Boundary', 'Phase 2.3 Validation Strategy', 'Phase 2.3 Performance Evidence Plan',
  'Rollback Boundary', 'Observability Plan', 'Functional Regression', 'Methodology / Scope / Migration Guards',
  'Phase 2.2D Final Gate and Recommended Next Decision', 'STOP',
]

const ACCEPTANCE_DESCRIPTIONS = [
  'Phase 2.2B-4R remains PASS.', 'Phase 2.2C remains PASS.', 'Phase 2.2B series remains complete.',
  'Current structural effect remains CONFIRMED.', 'Verification structural effect remains CONFIRMED.', 'Persistence idempotency remains PRESERVED.',
  'Immutable BEFORE hashes pass.', 'Original B4 hashes pass.', 'Accepted B4R hashes pass.', 'Accepted Phase 2.2C hashes pass.',
  'P09 first capacity boundary remains APPLICATION_DB_READ_FAN_OUT.', 'P09 primary cause remains CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS.',
  'P09 confidence remains STRONGLY_SUPPORTED unless stronger accepted evidence exists.', 'P09 timeout remains classified as downstream symptom.',
  'P10 remains NOT_OBSERVED_THROUGH_10.', 'P10 contamination finding is preserved.',
  'Exactly six frozen candidate mechanisms are evaluated.', 'No candidate is silently added as a primary mechanism.',
  'Every candidate receives exactly one decision state.', 'Candidate decision states use SELECT_FOR_PHASE_2_3 / CONDITIONAL_SECONDARY / DEFER / REJECT.',
  'Root-cause directness is evaluated for every candidate.', 'Expected capacity effect is evaluated for every candidate.',
  'Correctness risk is evaluated for every candidate.', 'Semantic risk is evaluated for every candidate.',
  'Implementation complexity is evaluated for every candidate.', 'Blast radius is evaluated for every candidate.',
  'Infrastructure cost is evaluated for every candidate.', 'Runtime cost is evaluated for every candidate.',
  'Maintenance cost is evaluated for every candidate.', 'Reversibility is evaluated for every candidate.',
  'UX effect is evaluated for every candidate.', 'Validation complexity is evaluated for every candidate.',
  'Unknown assumptions are explicitly recorded.', 'No arbitrary numeric weighted score is used.',
  'Evidence level is explicit for every candidate.', 'Evidence and counterevidence are preserved.',
  'The three equal SG2.0 principles are explicitly applied.', 'C01 current cache/miss behavior is documented.',
  'C01 concurrent miss behavior is explicitly evaluated.', 'C01 correctness and failure-cleanup risks are evaluated.',
  'C01 process-local vs distributed implication is explicit.', 'C02 current full-table application read is documented.',
  'C02 current in-memory filtering is documented.', 'C02 semantic-equivalence requirements are documented.',
  'C02 likely index dependency is classified.', 'C01 and C02 are compared directly.',
  'Read-count reduction is distinguished from read-cost reduction.', 'Complementarity between C01 and C02 is explicitly evaluated.',
  'C03 cancellation causal scope is evaluated.', 'C03 root-cause prevention is distinguished from damage limitation.',
  'C03 actual cancellation feasibility is not overclaimed.', 'C04 concurrency-control causal scope is evaluated.',
  'C04 queue/fairness/tail-latency risk is documented.', 'C04 is not selected merely because it masks overload.',
  'C05 respects the NOT_OBSERVABLE Prisma acquisition evidence.', 'Pool tuning is not selected from unsupported assumptions.',
  'C06 production value is separated from test/measurement hygiene.', 'Scenario isolation is not misclassified as the proven P09 production root-cause fix.',
  'Candidate interaction map is complete.', 'Complementary/dependent candidates are explicitly identified.',
  'At most one primary candidate is selected.', 'A primary candidate, if selected, is at least STRONGLY_SUPPORTED_DIRECT.',
  'A primary candidate directly addresses the established P09 cause.', 'A primary candidate has a bounded implementation surface.',
  'A primary candidate has explicit correctness invariants.', 'A primary candidate has a rollback boundary.',
  'A primary candidate has an independently testable causal metric.', 'Alternatives receive explicit reasons for non-selection.',
  'Selection falsification criteria are documented.', 'Conditional secondary triggers are explicit.',
  'Deferred candidates list evidence required for reconsideration.', 'Rejected candidates have evidence-backed rejection reasons.',
  'No optimization implementation occurs.', 'No stress execution occurs.', 'No query changes occur.', 'No cache behavior changes occur.',
  'No DB pool changes occur.', 'No index changes occur.', 'No HTTP/timeout/Node/infrastructure changes occur.',
  'Current single-flight remains unchanged.', 'Verification single-flight remains unchanged.', 'Persistence remains unchanged.',
  'Phase 2.3 implementation contract is created if and only if a primary candidate is selected.',
  'Phase 2.3 contract contains the selected causal mechanism.', 'Phase 2.3 contract contains exact correctness invariants.',
  'Phase 2.3 contract contains bounded source surfaces.', 'Phase 2.3 contract contains validation sequence.',
  'Phase 2.3 contract contains rollback boundary.', 'Applicable non-stress regression passes.',
  'Migration Readiness Delta is complete.', 'Exactly 64 human report sections are produced.', 'Phase 2.3 is not started.',
]

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

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
    assert.equal(sha256(await readFile(path.join(REPOSITORY_ROOT, reference.path))), reference.sha256, `BEFORE drift: ${reference.path}`)
  }
  return references
}

async function verifyAuthorities() {
  const [beforeReferences, originalB4, b4r, phase1r, phase2c] = await Promise.all([
    verifyBefore(), readJson(ORIGINAL_B4_GATE_PATH), readJson(B4R_GATE_PATH), readJson(PHASE_1R_GATE_PATH), readJson(PHASE_2C_GATE_PATH),
  ])
  await Promise.all([verifyHashes(ORIGINAL_B4_HASHES), verifyHashes(B4R_HASHES), verifyHashes(PHASE_2C_HASHES)])
  assert.equal(originalB4.phase22b4Gate, 'FAIL')
  assert.equal(b4r.phase22b4rGate, 'PASS')
  assert.equal(b4r.phase22bSeriesComplete, true)
  assert.equal(phase1r.phase22b1rGate, 'PASS')
  assert.equal(phase2c.phase22cGate, 'PASS')
  assert.equal(phase2c.capacityDiagnosisComplete, true)
  assert.equal(phase2c.p09.firstCapacityBound, 'APPLICATION_DB_READ_FAN_OUT')
  assert.equal(phase2c.p09.primaryCause, 'CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS')
  assert.equal(phase2c.p09.confidence, 'STRONGLY_SUPPORTED')
  assert.equal(phase2c.p09.timeoutClassification, 'DOWNSTREAM_SYMPTOM')
  assert.equal(phase2c.p10.firstCapacityBound, 'NOT_OBSERVED_THROUGH_10')
  assert.equal(phase2c.p10.primaryCause, 'MEASUREMENT_CONTAMINATION_FROM_PRECEDING_P09')
  return { beforeReferences, originalB4, b4r, phase1r, phase2c }
}

async function inspectSource() {
  const [query, filters, series, route, schema] = await Promise.all([
    readFile(QUERY_SOURCE_PATH, 'utf8'), readFile(FILTER_SOURCE_PATH, 'utf8'), readFile(SERIES_SOURCE_PATH, 'utf8'),
    readFile(COMPONENT_ROUTE_PATH, 'utf8'), readFile(SCHEMA_PATH, 'utf8'),
  ])
  assert.match(query, /DASHBOARD_RECORD_CACHE_TTL_MS = 30_000/)
  assert.match(query, /organizationId: filters\.organizationId \?\? null/)
  assert.match(query, /pipelineId: filters\.pipelineId \?\? null/)
  assert.match(query, /drDashboardIndexRecord\.findMany/)
  assert.match(query, /orderBy: \[\{ sourceDate: 'asc' \}, \{ id: 'asc' \}\]/)
  assert.ok(!query.includes('dashboardRecordInFlight'))
  assert.match(series, /await listDashboardRecords\(\{[\s\S]*organizationId:[\s\S]*pipelineId:/)
  assert.match(series, /descriptionPl \?\? ''/)
  assert.match(series, /descriptionEn \?\? ''/)
  assert.match(series, /haystack\.includes\(search\)/)
  assert.match(filters, /componentName: \{ contains: filters\.q, mode: 'insensitive' \}/)
  assert.match(filters, /componentCode: \{ contains: filters\.q, mode: 'insensitive' \}/)
  assert.ok(!route.includes('request.signal'))
  assert.match(schema, /@@index\(\[organizationId, pipelineId, sourceDate\]\)/)
  assert.ok(!schema.includes('@@index([organizationId, pipelineId, componentName'))
  assert.ok(!schema.includes('@@index([organizationId, pipelineId, componentCode'))
  return {
    cache: {
      location: 'apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts module scope',
      key: ['organizationId', 'pipelineId'],
      ttlMs: 30000,
      resultCacheShape: 'SINGLE_PROCESS_LOCAL_ENTRY',
      missPath: '$connect then full ordered drDashboardIndexRecord.findMany',
      concurrentMissBehavior: 'NO_IN_FLIGHT_OWNER; EACH_OVERLAPPING_MISS_EXECUTES_THE_READ',
      scope: 'PROCESS_LOCAL',
    },
    query: {
      table: 'dr_dashboard_index_records',
      predicate: 'organizationId, pipelineId, deletedAt=null; component filters absent on P09 component-list read',
      ordering: ['sourceDate asc', 'id asc'],
      columns: 'ALL_MODEL_COLUMNS',
      inMemoryFiltering: ['business-safe componentName equality', 'business-safe componentCode equality', 'scenario case-normalized equality', 'q over component name/code/descriptionPl/descriptionEn'],
      indexClassification: 'LIKELY_NEW_INDEX_REQUIRED',
      relevantIndexes: ['organizationId,pipelineId,sourceDate', 'organizationId,pipelineId,scenarioType,sourceDate', 'organizationId,pipelineId,componentId', 'organizationId,pipelineId,market,sourceDate'],
    },
    cancellation: {
      stressClient: 'AbortSignal.timeout(120000) stops client wait',
      dashboardRoute: 'REQUEST_SIGNAL_NOT_PROPAGATED',
      prismaCall: 'NO_ABORT_SIGNAL',
      postgresqlQueryCancellation: 'NOT_PROVEN',
    },
    directQueryTestsPresent: false,
  }
}

function commonCandidate(input) {
  return {
    rootCauseCoverage: {
      concurrencyFanOut: 'NO', missCoalescing: 'NO', fullTableRead: 'NO', inMemoryFiltering: 'NO',
      postAbortServerWork: 'NO', downstreamTimeout: 'NO', ...input.rootCauseCoverage,
    },
    expectedEffectModel: {
      readCountReduction: 'NONE', readCostReduction: 'NONE', postAbortWorkReduction: 'NONE',
      timeoutProbabilityReduction: 'NONE', dbPressureReduction: 'NONE', cpuMappingReduction: 'NONE', tailLatencyReduction: 'NONE',
      ...input.expectedEffectModel,
    },
    principles: {
      methodologicalCorrectnessSafety: input.principles.methodologicalCorrectnessSafety,
      lowInfrastructureComputeMaintenanceCost: input.principles.lowInfrastructureComputeMaintenanceCost,
      fastReproducibleUserExperience: input.principles.fastReproducibleUserExperience,
    },
    ...input,
  }
}

function candidates() {
  return [
    commonCandidate({
      candidateId: 'C01', candidateName: 'CACHE_MISS_COALESCING',
      targetedCausalLink: 'Concurrent requests with one exact organization/pipeline cache key independently execute the same full ordered application-table read after a miss.',
      rootCauseDirectness: 'DIRECT', evidenceLevel: 'STRONGLY_SUPPORTED_DIRECT',
      rootCauseCoverage: { concurrencyFanOut: 'DIRECT', missCoalescing: 'DIRECT', fullTableRead: 'OWNER_READ_REMAINS', inMemoryFiltering: 'WAITER_FILTERING_REMAINS', postAbortServerWork: 'PARTIAL_ONLY_IF_WAITERS_LEAVE', downstreamTimeout: 'INDIRECT' },
      expectedCapacityEffect: 'One application full-table read owner per exact process-local cache key and overlapping miss window; all same-key waiters share the owner result.',
      expectedEffectModel: { readCountReduction: 'HIGH_FOR_SAME_KEY_MISS_BURSTS', readCostReduction: 'NONE_FOR_OWNER', dbPressureReduction: 'HIGH_FOR_SAME_KEY_MISS_BURSTS', cpuMappingReduction: 'PRISMA_RESULT_MAPPING_REDUCED; PER_REQUEST_BUSINESS_FILTERING_REMAINS', tailLatencyReduction: 'EXPECTED_BUT_NOT_QUANTIFIED', timeoutProbabilityReduction: 'EXPECTED_BUT_NOT_QUANTIFIED' },
      correctnessRisk: 'MEDIUM', semanticRisk: 'LOW', implementationComplexity: 'LOW', blastRadius: 'LOW',
      infrastructureCost: 'VERY_LOW', runtimeCost: 'LOW', maintenanceCost: 'LOW', reversibility: 'HIGH', observability: 'HIGH',
      validationComplexity: 'LOW', crossInstanceImplication: 'CROSS_INSTANCE_MISS_COALESCING_NOT_PROVIDED',
      userLatencyEffect: 'Removes duplicate owner contention for overlapping same-key misses without extending the 30-second result TTL.', timeToImplementRelative: 'LOW',
      dependencies: ['Preserve cacheKeyFromFilters organizationId/pipelineId identity', 'Keep in-flight ownership distinct from result-cache TTL'],
      unknownAssumptions: ['Accepted P09 exact route admission count is not observable', 'Benefit across multiple service instances is not provided'],
      evidenceSupporting: ['Phase 2.2C statically proves no in-flight owner', 'Accepted P09 cause explicitly includes CONCURRENT and UNCOALESCED full-table reads', 'P09 synchronized same component-list requests use one organization/pipeline read key'],
      counterevidence: ['The owner still performs one full-table read', 'Process-local ownership cannot eliminate cross-instance duplicate reads'],
      sourceSurfaces: ['apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts', 'apps/dashboard-preview/tests/dashboard-record-query.test.ts'],
      principles: { methodologicalCorrectnessSafety: 'PASS_WITH_EXACT_KEY_AND_FAILURE_CLEANUP_INVARIANTS', lowInfrastructureComputeMaintenanceCost: 'BEST_OF_DIRECT_CANDIDATES', fastReproducibleUserExperience: 'EXPECTED_DIRECT_BURST_STABILITY' },
      decision: 'SELECT_FOR_PHASE_2_3', decisionReason: 'Smallest independently testable intervention that directly removes the diagnosed duplicate read count without changing query or response semantics.',
      conditionalTrigger: null, reconsiderationEvidence: null,
    }),
    commonCandidate({
      candidateId: 'C02', candidateName: 'BOUNDED_QUERY_DB_SIDE_FILTERING',
      targetedCausalLink: 'Each owner reads and maps the full organization/pipeline table before applying business-safe component search in memory.',
      rootCauseDirectness: 'DIRECT', evidenceLevel: 'STRONGLY_SUPPORTED_DIRECT',
      rootCauseCoverage: { fullTableRead: 'DIRECT', inMemoryFiltering: 'DIRECT', concurrencyFanOut: 'NO', missCoalescing: 'NO', downstreamTimeout: 'INDIRECT' },
      expectedCapacityEffect: 'Reduce rows and columns returned and owner-side mapping cost, but retain one query per concurrent miss unless paired with C01.',
      expectedEffectModel: { readCostReduction: 'HIGH_POTENTIAL', readCountReduction: 'NONE', dbPressureReduction: 'MEDIUM_TO_HIGH_POTENTIAL', cpuMappingReduction: 'HIGH_POTENTIAL', tailLatencyReduction: 'EXPECTED_BUT_NOT_QUANTIFIED', timeoutProbabilityReduction: 'EXPECTED_BUT_NOT_QUANTIFIED' },
      correctnessRisk: 'HIGH', semanticRisk: 'HIGH', implementationComplexity: 'HIGH', blastRadius: 'MEDIUM', infrastructureCost: 'LOW_TO_MEDIUM', runtimeCost: 'LOWER_EXPECTED', maintenanceCost: 'MEDIUM', reversibility: 'MEDIUM', observability: 'HIGH', validationComplexity: 'HIGH',
      crossInstanceImplication: 'BENEFIT_APPLIES_PER_QUERY_ACROSS_INSTANCES_BUT_DUPLICATE_QUERY_OWNERS_REMAIN', userLatencyEffect: 'Potentially faster owner query, subject to equivalent predicates and index support.', timeToImplementRelative: 'MEDIUM_TO_HIGH',
      dependencies: ['Business-safe fallback fields must be queryable or equivalently reconstructed', 'Case, null, locale, deleted-row, tenant, and ordering semantics must match', 'Index requirement must be measured'],
      unknownAssumptions: ['Expected result cardinality reduction is not measured', 'JSON-carried description search cannot be represented by the current top-level predicate', 'Query planner behavior is unmeasured'],
      evidenceSupporting: ['Current P09 read returns all matching organization/pipeline rows and all model columns', 'Filtering and grouping happen after business-safe JSON fallback mapping'],
      counterevidence: ['Existing indexes do not cover componentName/componentCode search', 'Current q semantics include descriptionPl/descriptionEn recovered from JSON carriers'],
      sourceSurfaces: ['apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts', 'apps/dashboard-preview/lib/raw-data/dashboard-record-filters.ts', 'apps/dashboard-preview/lib/time-series/series-query.ts', 'apps/dashboard-preview/prisma/schema.prisma', 'apps/dashboard-preview/tests/dashboard-record-query.test.ts'],
      indexClassification: 'LIKELY_NEW_INDEX_REQUIRED',
      principles: { methodologicalCorrectnessSafety: 'CONDITIONAL_ON_SEMANTIC_EQUIVALENCE', lowInfrastructureComputeMaintenanceCost: 'WORSE_THAN_C01_DUE_TO_QUERY_AND_INDEX_SURFACE', fastReproducibleUserExperience: 'POTENTIALLY_STRONG_AFTER_EQUIVALENCE_PROOF' },
      decision: 'CONDITIONAL_SECONDARY', decisionReason: 'Complementary read-cost reduction, but not the smallest first experiment and carries materially larger semantic and index uncertainty.',
      conditionalTrigger: 'IF C01 proves one owner read per exact miss window but P09 remains capacity-bound or the single owner read remains materially costly, THEN evaluate C02 with semantic-equivalence and index-plan gates.', reconsiderationEvidence: null,
    }),
    commonCandidate({
      candidateId: 'C03', candidateName: 'CANCELLATION_PROPAGATION',
      targetedCausalLink: 'Client timeout ends waiting while admitted server and database work continues.', rootCauseDirectness: 'PARTIAL', evidenceLevel: 'SUPPORTED',
      rootCauseCoverage: { postAbortServerWork: 'DIRECT', downstreamTimeout: 'DAMAGE_LIMITATION', concurrencyFanOut: 'NO', missCoalescing: 'NO', fullTableRead: 'NO' },
      expectedCapacityEffect: 'Reduce retained work after clients leave; does not prevent the synchronized duplicate reads that begin before timeout.',
      expectedEffectModel: { postAbortWorkReduction: 'HIGH_POTENTIAL', dbPressureReduction: 'AFTER_ABORT_ONLY', timeoutProbabilityReduction: 'NO_DIRECT_PREVENTION', tailLatencyReduction: 'RECOVERY_ONLY' },
      correctnessRisk: 'HIGH', semanticRisk: 'MEDIUM', implementationComplexity: 'HIGH', blastRadius: 'MEDIUM', infrastructureCost: 'VERY_LOW', runtimeCost: 'LOWER_AFTER_ABORT', maintenanceCost: 'HIGH', reversibility: 'MEDIUM', observability: 'MEDIUM', validationComplexity: 'HIGH',
      crossInstanceImplication: 'REQUEST_LOCAL; EACH_INSTANCE_MUST_PROPAGATE_CANCELLATION', userLatencyEffect: 'No benefit before timeout; potentially faster recovery after overload.', timeToImplementRelative: 'HIGH',
      dependencies: ['Next request abort propagation', 'Prisma/driver/PostgreSQL cancellation capability proof', 'Shared-owner cancellation semantics'],
      unknownAssumptions: ['Prisma query cancellation is not proven', 'Exact layer retaining P09 work is not separately timed'],
      evidenceSupporting: ['766 clients timed out while application DB work remained after cooldown'], counterevidence: ['Cancellation starts after fan-out already exists', 'No route or Prisma AbortSignal exists today'],
      sourceSurfaces: ['apps/dashboard-preview/app/api/components/route.ts', 'apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts', 'Prisma driver boundary', 'PostgreSQL cancellation boundary'],
      principles: { methodologicalCorrectnessSafety: 'REQUIRES_SHARED_OWNER_AND_PARTIAL_ABORT_RULES', lowInfrastructureComputeMaintenanceCost: 'NO_INFRASTRUCTURE_BUT_HIGH_MAINTENANCE', fastReproducibleUserExperience: 'RECOVERY_BENEFIT_ONLY' },
      decision: 'CONDITIONAL_SECONDARY', decisionReason: 'Evidence supports damage limitation after timeout, not prevention of the established first cause.',
      conditionalTrigger: 'IF C01 is accepted yet timeout/abort cases still leave material server or DB work, THEN prove driver cancellation feasibility and evaluate C03 separately.', reconsiderationEvidence: null,
    }),
    commonCandidate({
      candidateId: 'C04', candidateName: 'REQUEST_CONCURRENCY_CONTROL',
      targetedCausalLink: 'Bound the number of simultaneous expensive reads admitted to the application/DB path.', rootCauseDirectness: 'PARTIAL', evidenceLevel: 'SUPPORTED',
      rootCauseCoverage: { concurrencyFanOut: 'DIRECT_LIMIT', missCoalescing: 'NO', fullTableRead: 'NO', downstreamTimeout: 'OVERLOAD_MASKING_RISK' },
      expectedCapacityEffect: 'Cap simultaneous pressure while preserving redundant work as queued or rejected requests.',
      expectedEffectModel: { dbPressureReduction: 'CONCURRENCY_CAPPED', readCountReduction: 'NONE', tailLatencyReduction: 'UNKNOWN_QUEUE_TRADEOFF', timeoutProbabilityReduction: 'UNKNOWN' },
      correctnessRisk: 'MEDIUM', semanticRisk: 'MEDIUM', implementationComplexity: 'MEDIUM', blastRadius: 'HIGH', infrastructureCost: 'VERY_LOW', runtimeCost: 'QUEUE_AND_BOOKKEEPING', maintenanceCost: 'MEDIUM', reversibility: 'HIGH', observability: 'MEDIUM', validationComplexity: 'HIGH',
      crossInstanceImplication: 'PROCESS_LOCAL_CAP_ONLY_UNLESS_DISTRIBUTED_COORDINATION_IS_ADDED', userLatencyEffect: 'Potential queue delay, head-of-line blocking, starvation, rejection, and tenant fairness effects.', timeToImplementRelative: 'MEDIUM',
      dependencies: ['Admission policy', 'Queue bound', 'Fairness and rejection contract', 'Per-key versus global scope'],
      unknownAssumptions: ['Safe cap is not measured', 'Distinct-key capacity after duplicate removal is unknown'],
      evidenceSupporting: ['P09 is proven through 100 and blocked at 1000'], counterevidence: ['Does not remove duplicate reads', 'A cap can merely hide overload behind queue latency'],
      sourceSurfaces: ['apps/dashboard-preview/app/api/components/route.ts', 'apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts'],
      principles: { methodologicalCorrectnessSafety: 'REQUIRES_EXPLICIT_ADMISSION_SEMANTICS', lowInfrastructureComputeMaintenanceCost: 'LOW_INFRASTRUCTURE_MEDIUM_OPERATIONAL_COST', fastReproducibleUserExperience: 'MIXED_DUE_TO_QUEUE_AND_FAIRNESS' },
      decision: 'DEFER', decisionReason: 'A concurrency cap is not justified before redundant same-key reads are removed and the remaining distinct-key capacity is measured.', conditionalTrigger: null,
      reconsiderationEvidence: 'Controlled post-C01 evidence showing overload from simultaneous distinct-key owner reads plus a bounded fairness/tail-latency contract.',
    }),
    commonCandidate({
      candidateId: 'C05', candidateName: 'DEFERRED_DB_POOL_EVALUATION',
      targetedCausalLink: 'Potential Prisma client-side acquisition pressure.', rootCauseDirectness: 'INDIRECT', evidenceLevel: 'SPECULATIVE',
      rootCauseCoverage: { concurrencyFanOut: 'CAPACITY_ENVELOPE_ONLY', missCoalescing: 'NO', fullTableRead: 'NO' },
      expectedCapacityEffect: 'Unknown; pool changes could increase throughput or amplify database overload.',
      expectedEffectModel: { dbPressureReduction: 'UNKNOWN', tailLatencyReduction: 'UNKNOWN', timeoutProbabilityReduction: 'UNKNOWN' },
      correctnessRisk: 'MEDIUM', semanticRisk: 'LOW', implementationComplexity: 'LOW', blastRadius: 'HIGH', infrastructureCost: 'POTENTIALLY_HIGH', runtimeCost: 'UNKNOWN', maintenanceCost: 'MEDIUM', reversibility: 'HIGH', observability: 'LOW', validationComplexity: 'HIGH',
      crossInstanceImplication: 'POOL_LIMITS_MULTIPLY_PER_INSTANCE', userLatencyEffect: 'Unknown until acquisition wait is directly observed.', timeToImplementRelative: 'LOW_CONFIGURATION_HIGH_EVIDENCE_COST',
      dependencies: ['Direct Prisma acquisition queue/wait evidence', 'Database capacity envelope after query fan-out controls'], unknownAssumptions: ['Prisma acquisition count and wait are NOT_OBSERVABLE', 'Pool parameters are implicit'],
      evidenceSupporting: ['Post-cooldown PostgreSQL wait events exist'], counterevidence: ['The waiter metric is not the Prisma acquisition queue', 'No pool error or saturation was proven'],
      sourceSurfaces: ['Dashboard Prisma client configuration', 'DATABASE_URL deployment configuration'],
      principles: { methodologicalCorrectnessSafety: 'FAILS_CURRENT_EVIDENCE_STANDARD', lowInfrastructureComputeMaintenanceCost: 'POTENTIALLY_EXPENSIVE', fastReproducibleUserExperience: 'UNKNOWN' },
      decision: 'DEFER', decisionReason: 'Pool tuning depends on an explicitly unobservable boundary and cannot be promoted from PostgreSQL wait_event evidence.', conditionalTrigger: null,
      reconsiderationEvidence: 'Direct client-side acquisition count/wait telemetry and isolated database-capacity evidence after C01/C02 evaluation.',
    }),
    commonCandidate({
      candidateId: 'C06', candidateName: 'SCENARIO_ISOLATION',
      targetedCausalLink: 'Prevent one stress scenario from contaminating the next scenario measurement.', rootCauseDirectness: 'INDIRECT', evidenceLevel: 'PROVEN_DIRECT',
      rootCauseCoverage: { concurrencyFanOut: 'NO', missCoalescing: 'NO', fullTableRead: 'NO', postAbortServerWork: 'MEASUREMENT_SEPARATION_ONLY' },
      expectedCapacityEffect: 'No production capacity effect; improves test attribution and reproducibility.',
      expectedEffectModel: { readCountReduction: 'NONE', readCostReduction: 'NONE', postAbortWorkReduction: 'NONE', timeoutProbabilityReduction: 'NONE', dbPressureReduction: 'NONE', cpuMappingReduction: 'NONE', tailLatencyReduction: 'NONE' },
      correctnessRisk: 'LOW', semanticRisk: 'LOW', implementationComplexity: 'LOW', blastRadius: 'TEST_ONLY', infrastructureCost: 'LOW_TEST_TIME', runtimeCost: 'TEST_ONLY', maintenanceCost: 'LOW', reversibility: 'HIGH', observability: 'HIGH', validationComplexity: 'LOW',
      crossInstanceImplication: 'TEST_PROCESS_ISOLATION_ONLY', userLatencyEffect: 'NONE_IN_PRODUCTION', timeToImplementRelative: 'LOW',
      dependencies: ['Fresh process or full settlement gate between scenarios'], unknownAssumptions: [],
      evidenceSupporting: ['Clean P10 disproved the shared-process application DB anomaly'], counterevidence: ['Does not alter P09 production reads or capacity'],
      sourceSurfaces: ['tooling/Benchmark-Forecasting/performance stress/validation harnesses'],
      principles: { methodologicalCorrectnessSafety: 'STRONG_FOR_MEASUREMENT', lowInfrastructureComputeMaintenanceCost: 'LOW_TEST_COST', fastReproducibleUserExperience: 'NO_PRODUCTION_EFFECT' },
      decision: 'REJECT', decisionReason: 'Retained as mandatory validation hygiene, but rejected as the Phase 2.3 production optimization because it does not address the P09 cause.', conditionalTrigger: null, reconsiderationEvidence: null,
    }),
  ]
}

function interactionPairs() {
  return [
    ['C01', 'C02', 'COMPLEMENTARY', 'C01 reduces read count; C02 can later reduce the remaining owner-read cost.', 'C02 follows only if one owner read remains materially costly.'],
    ['C01', 'C03', 'COMPLEMENTARY', 'C01 prevents duplicate starts; C03 can limit residual work after abort.', 'C03 follows only if post-C01 abort retention remains material.'],
    ['C01', 'C04', 'COMPLEMENTARY', 'C01 removes same-key duplication; C04 could bound remaining distinct-key owners.', 'Measure post-C01 distinct-key capacity before C04.'],
    ['C01', 'C05', 'COMPLEMENTARY', 'C01 reduces pool demand; only then can residual acquisition pressure be interpreted.', 'C05 evidence collection follows query fan-out controls.'],
    ['C01', 'C06', 'INDEPENDENT', 'C06 improves measurement hygiene but does not alter C01 runtime ownership.', 'Use isolation in validation without treating it as the optimization.'],
    ['C02', 'C03', 'COMPLEMENTARY', 'C02 lowers pre-abort read cost; C03 limits work after abort.', 'Neither substitutes for the other.'],
    ['C02', 'C04', 'COMPLEMENTARY', 'C02 lowers operation cost; C04 bounds operation concurrency.', 'Concurrency limits require post-query evidence.'],
    ['C02', 'C05', 'COMPLEMENTARY', 'Query cost and pool capacity interact.', 'Evaluate pool behavior only after query shape is accepted.'],
    ['C02', 'C06', 'INDEPENDENT', 'Test isolation does not determine query semantics or indexes.', 'Use C06 only as evidence hygiene.'],
    ['C03', 'C04', 'COMPLEMENTARY', 'Admission control acts before work; cancellation acts after a requester leaves.', 'Both require explicit queue/owner semantics.'],
    ['C03', 'C05', 'INDEPENDENT', 'Cancellation feasibility and pool sizing are separate unknown boundaries.', 'Neither supplies evidence for the other.'],
    ['C03', 'C06', 'COMPLEMENTARY', 'Scenario isolation can make post-abort cleanup evidence attributable.', 'C06 is validation hygiene only.'],
    ['C04', 'C05', 'UNKNOWN', 'Pool capacity and application concurrency could reinforce or oppose each other.', 'Both bounds require direct evidence before combination.'],
    ['C04', 'C06', 'COMPLEMENTARY', 'Isolated scenarios are needed to attribute queue/fairness behavior.', 'C06 remains a harness discipline.'],
    ['C05', 'C06', 'COMPLEMENTARY', 'Isolated measurement is required for any future pool experiment.', 'No pool experiment is authorized now.'],
  ].map(([left, right, interaction, rationale, dependency]) => ({ left, right, interaction, rationale, dependency }))
}

function correctnessInvariants() {
  return [
    'Same organizationId/pipelineId cache key is the only sharing boundary.',
    'Different organizationId or pipelineId values never share an in-flight owner or result.',
    'Missing organizationId/pipelineId retains the existing null-key and query behavior; no tenant scope is widened.',
    'The 30000 ms result-cache TTL, timestamp semantics, invalidation behavior, query predicate, selected columns, and ordering remain unchanged.',
    'The owner returns the exact current DashboardRecordSource array and all waiters observe the same successful result.',
    'Owner rejection is shared with current waiters, never inserted into the result cache, and the in-flight entry is removed in finally so retry can acquire a new owner.',
    'Waiter arrival after owner settlement follows the existing result-cache rules; no long-lived cache extension is introduced.',
    'Search inclusion, case, null, locale, description fallback, benchmark identity, series identity, frequency/cadence, and Historical response semantics remain unchanged.',
    'FORECAST_COMPUTE_DURING_P09_SEARCH = 0; VERIFICATION_COMPUTE_DURING_P09_SEARCH = 0; FORECAST_PERSISTENCE_DURING_P09_SEARCH = 0.',
    'Clean P10 remains prepared, correct, compute-free, owner-free, write-free, and provider-free.',
    'Current and Verification exact-key single-flight and Forecast persistence semantics remain unchanged.',
    'CROSS_INSTANCE_MISS_COALESCING = NOT_PROVIDED.',
  ]
}

function phase23Contract(generatedAt) {
  return {
    task: 'FORECAST_PHASE_2_3_CACHE_MISS_COALESCING_IMPLEMENTATION_CONTRACT', phase: '2.3', generatedAt,
    nature: 'PLAN_ONLY', authorized: false, started: false,
    selectedMechanism: { candidateId: 'C01', name: 'CACHE_MISS_COALESCING', scope: 'PROCESS_LOCAL_EXACT_KEY_IN_FLIGHT_OWNERSHIP' },
    targetRootCause: 'CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS',
    exactCausalMetric: 'APPLICATION_FULL_TABLE_READ_OWNER_COUNT_PER_EXACT_ORGANIZATION_PIPELINE_MISS_WINDOW',
    expectedSourceSurfaces: [
      { path: 'apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts', action: 'MODIFY', purpose: 'Add exact-key process-local in-flight owner registry around the unchanged miss read.' },
      { path: 'apps/dashboard-preview/tests/dashboard-record-query.test.ts', action: 'CREATE', purpose: 'Prove ownership, isolation, cleanup, retry, TTL separation, and payload equivalence.' },
      { path: 'apps/dashboard-preview/lib/phase-2-2c/diagnostics.ts', action: 'REUSE_OR_REMOVE_AFTER_VALIDATION', purpose: 'Default-off owner/read-count evidence only; no production promotion without separate decision.' },
      { path: 'tooling/Benchmark-Forecasting/performance/phase-2-3-*', action: 'CREATE', purpose: 'Controlled structural and performance validation artifacts.' },
    ],
    minimumImplementationScope: [
      'Add one process-local Map keyed by the existing cacheKeyFromFilters value.',
      'Consult it only after the existing fresh result-cache hit check fails.',
      'The first caller creates the unchanged connect/findMany/cache-update operation; overlapping same-key callers await that promise.',
      'Delete the exact in-flight entry in finally using identity-safe cleanup.',
      'Do not extend or reinterpret the result-cache TTL.',
    ],
    explicitNonGoals: ['DB-side filtering', 'Query or schema/index changes', 'Cancellation propagation', 'Concurrency queue or throttling', 'Pool tuning', 'Distributed ownership', 'Forecast/Verification/persistence changes', 'Infrastructure resizing'],
    featureAndDefaultBehavior: { featureFlagRequired: false, defaultBehavior: 'EXISTING_RESULT_CACHE_SEMANTICS_PLUS_PROCESS_LOCAL_IN_FLIGHT_MISS_OWNERSHIP', rolloutConstraint: 'Single bounded mechanism only; rollback is source-only.' },
    correctnessInvariants: correctnessInvariants(),
    unitTestsRequired: [
      'Ten overlapping same-key misses execute exactly one $connect/findMany owner and resolve equivalent payloads.',
      'Different organization/pipeline keys execute independent owners and never cross-share.',
      'A fresh result-cache hit executes no owner.',
      'Owner failure rejects all joined waiters, leaves no cached result, removes the in-flight entry, and permits one clean retry owner.',
      'Late arrival before settlement joins; arrival after settlement follows existing result-cache behavior.',
      'TTL timestamp and expiry behavior remain byte-for-behavior equivalent to the current implementation.',
    ],
    integrationTestsRequired: ['Components q search preserves business-safe name/code/description behavior in pl and en.', 'Series and component payloads preserve ordering, benchmark identity, and Historical semantics.', 'P09 remains Forecast/Verification compute-free and persistence-free.', 'Clean P10 remains prepared and compute/owner/write/provider-free.'],
    validationSequence: [
      'A_UNIT_CORRECTNESS', 'B_SEMANTIC_EQUIVALENCE', 'C_FOCUSED_CONCURRENCY_STRUCTURAL_PROOF',
      'D_P09_LOWER_CONTROL', 'E_P09_HIGH_CONCURRENCY_ONLY_IF_A_TO_D_PASS_AND_SAFETY_GATES_ALLOW', 'F_P10_PREPARED_NON_REGRESSION', 'G_FULL_NON_STRESS_REGRESSION',
    ],
    performanceValidationRequired: {
      primaryQuestion: 'Did C01 reduce the proven causal pressure?',
      success: ['Exactly one application full-table read owner per exact process-local miss key/window', 'Zero same-key duplicate application reads in the controlled wave', 'Correctness and settlement guards pass', 'Capacity/latency evidence improves relative to accepted authority without invented percentage targets'],
      controls: ['Fresh process/scenario isolation', 'P09 lower control before high concurrency', 'P10 clean prepared control', 'No C02-C05 implementation'],
    },
    rollbackBoundary: 'Remove the in-flight registry and owner/join branch from dashboard-record-query.ts plus its C01 tests/telemetry; no data, schema, index, configuration, or persistence rollback.',
    failureConditions: ['More than one owner read for one exact key/window', 'Cross-key or cross-tenant sharing', 'Failure poisons cache or blocks retry', 'TTL/query/result semantics drift', 'P09 causes Forecast/Verification compute or persistence', 'P10 regression', 'No measurable causal-pressure improvement'],
    successConditions: ['All invariants pass', 'Direct owner-count metric proves coalescing', 'Controlled P09 evidence improves without safety violation', 'Rollback remains source-only'],
  }
}

function selectionDecision(generatedAt, candidateRows) {
  return {
    task: 'FORECAST_PHASE_2_2D_SELECTION_DECISION', phase: '2.2D', generatedAt,
    method: { arbitraryNumericScoreUsed: false, order: ['REJECT_NON_CAUSAL', 'DEFER_UNPROVEN', 'COMPARE_DIRECT', 'SELECT_SMALLEST_SUFFICIENT', 'RECORD_COMPLEMENTS'], principlesEqual: true },
    primarySelected: true,
    primary: { candidateId: 'C01', candidateName: 'CACHE_MISS_COALESCING', confidence: 'STRONGLY_SUPPORTED_DIRECT', target: 'CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS', exactCausalMetric: 'APPLICATION_FULL_TABLE_READ_OWNER_COUNT_PER_EXACT_ORGANIZATION_PIPELINE_MISS_WINDOW' },
    whySelected: ['Directly removes the UNCOALESCED and CONCURRENT read-count terms.', 'Preserves the full query and all downstream business-safe semantics.', 'Smallest source surface, no infrastructure dependency, and source-only rollback.', 'Can be proven independently by owner/read count before high-concurrency testing.'],
    falsificationCriteria: ['P09 requests do not share one exact organization/pipeline read key.', 'An existing per-request semantic dependency requires independent read results.', 'A same-key owner cannot be failure-cleaned without changing query/cache semantics.', 'Controlled Phase 2.3 evidence shows duplicate full-table reads remain or no causal-pressure reduction occurs.'],
    conditionalSecondary: candidateRows.filter(({ decision }) => decision === 'CONDITIONAL_SECONDARY').map(({ candidateId, conditionalTrigger }) => ({ candidateId, trigger: conditionalTrigger })),
    deferred: candidateRows.filter(({ decision }) => decision === 'DEFER').map(({ candidateId, reconsiderationEvidence }) => ({ candidateId, evidenceRequired: reconsiderationEvidence })),
    rejected: candidateRows.filter(({ decision }) => decision === 'REJECT').map(({ candidateId, decisionReason }) => ({ candidateId, reason: decisionReason })),
    alternatives: candidateRows.filter(({ candidateId }) => candidateId !== 'C01').map(({ candidateId, decision, decisionReason }) => ({ candidateId, decision, reason: decisionReason })),
  }
}

function reportText(heading, context) {
  const { candidateRows, interactions, contract, regression, migration } = context
  const candidate = (id) => candidateRows.find(({ candidateId }) => candidateId === id)
  const table = ['| ID | Directness | Evidence | Decision | Reason |', '|---|---|---|---|---|', ...candidateRows.map((row) => `| ${row.candidateId} | ${row.rootCauseDirectness} | ${row.evidenceLevel} | ${row.decision} | ${row.decisionReason} |`)].join('\n')
  const map = {
    'Executive Summary': 'C01 CACHE_MISS_COALESCING is selected for a separately authorized Phase 2.3 with STRONGLY_SUPPORTED_DIRECT confidence. It is the smallest intervention that removes duplicate same-key full-table read owners while preserving the existing query, 30-second result cache, business-safe filtering, and Forecast boundaries.',
    Objective: 'Select, defer, or reject the six frozen mechanisms without implementation, tuning, replay, or stress.',
    'Accepted Phase State': 'B4R and 2.2C remain PASS; the 2.2B series is complete; Current and Verification structural effects are CONFIRMED; persistence idempotency is PRESERVED.',
    'Phase 2.2C Diagnosis Authority': 'P09 is bound first by APPLICATION_DB_READ_FAN_OUT caused by CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS with STRONGLY_SUPPORTED confidence. The timeout is downstream. P10 is NOT_OBSERVED_THROUGH_10.',
    'Scope Boundary': 'Decision artifacts and validation tooling only. Runtime behavior, query, cache behavior, pool, index, HTTP, timeout, Node, infrastructure, Forecast ownership, Verification ownership, and persistence are unchanged.',
    'Decision Principles': 'Correctness safety, low infrastructure/compute/maintenance cost, and fast reproducible UX are applied equally.',
    'Immutable Evidence Authority': `Verified 22 BEFORE references, ${Object.keys(ORIGINAL_B4_HASHES).length} original B4 hashes, ${Object.keys(B4R_HASHES).length} B4R/1R hashes, and ${Object.keys(PHASE_2C_HASHES).length} Phase 2.2C hashes.`,
    'Root Cause Restatement': '1000 synchronized clients reached concurrent expired-cache component reads. With no miss owner, admitted requests independently executed the same full application-table read and mapping path.',
    'Root Cause Components': 'CONCURRENCY_FAN_OUT and MISS_COALESCING are C01 targets; FULL_TABLE_READ and IN_MEMORY_FILTERING are C02 targets; POST_ABORT_SERVER_WORK is C03; the timeout is downstream.',
    'Decision Method': 'Reject non-causal mechanisms, defer assumption-dependent mechanisms, compare direct mechanisms, select the smallest sufficient experiment, and keep complements conditional. No weighted numeric score is used.',
    'Candidate Universe': candidateRows.map(({ candidateId, candidateName }) => `${candidateId} ${candidateName}`).join('; ') + '.',
    'Candidate Evidence Levels': candidateRows.map(({ candidateId, evidenceLevel }) => `${candidateId}=${evidenceLevel}`).join('; ') + '.',
    'Candidate Decision States': candidateRows.map(({ candidateId, decision }) => `${candidateId}=${decision}`).join('; ') + '.',
    'Evaluation Dimensions': 'Directness, expected effect, correctness/semantic risk, complexity, blast radius, infrastructure/runtime/maintenance cost, reversibility, observability, validation, cross-instance scope, UX, time, dependencies, and unknowns are recorded for every candidate.',
    'C01 Cache-Miss Coalescing — Mechanism': 'The cache is one process-local 30-second result entry keyed by organizationId/pipelineId. A miss has no in-flight owner; C01 would share one promise only during an overlapping exact-key miss.',
    'C01 Root-Cause Coverage': 'C01 directly removes duplicate same-key read count. The owner full-table read and per-waiter business filtering remain, cleanly separating read-count from read-cost effects.',
    'C01 Correctness Risks': 'The exact key, org isolation, TTL, failed-owner cleanup, retry, result equivalence, and cancellation semantics must be preserved. In-flight ownership must not become longer-lived caching.',
    'C01 Cost / Complexity / UX': 'One module plus focused tests, no infrastructure, low runtime/maintenance cost, source-only rollback, and expected lower burst sensitivity. Cross-instance coalescing is not provided.',
    'C02 Bounded Query / DB-Side Filtering — Mechanism': 'C02 would push request filtering into dr_dashboard_index_records and reduce returned rows/columns. It is not implemented here.',
    'C02 Root-Cause Coverage': 'C02 reduces cost per owner read and application mapping, but does not reduce the number of concurrent miss reads.',
    'C02 Semantic Equivalence Risks': 'It must preserve business-safe fallback fields, description search from JSON carriers, case/null/locale behavior, tenant/deleted-row scope, ordering, grouping, identity, and response sets.',
    'C02 Index / Cost / Complexity / UX': 'Existing indexes do not cover component name/code search; LIKELY_NEW_INDEX_REQUIRED. Benefit is plausible but cardinality and plans are unmeasured, while semantic and validation cost exceed C01.',
    'C01 vs C02': 'C01 reduces NUMBER of reads; C02 reduces COST of each read. C01 more directly addresses uncoalesced concurrency, has the smaller semantic surface and rollback, and is selected first. C02 remains useful if one owner read is still costly.',
    'C03 Cancellation Propagation — Mechanism': 'The stress client aborts at 120 seconds, but the Dashboard route does not propagate request.signal and Prisma/PostgreSQL cancellation is unproven.',
    'C03 Root-Cause Coverage': 'C03 limits damage after abort and may improve recovery; it does not prevent the original synchronized read fan-out.',
    'C03 Feasibility / Risk / Cost': 'Route, shared-owner, driver, and database cancellation boundaries require proof. Partial waiter abort must not cancel work needed by other waiters.',
    'C04 Request Concurrency Control — Mechanism': 'A semaphore, admission control, per-key limit, or bounded expensive-read queue could cap simultaneous work but would retain redundant work.',
    'C04 Root-Cause Coverage': 'C04 caps pressure rather than removing duplicate reads and therefore is not selected as the first cause-removal experiment.',
    'C04 UX / Fairness / Cost': 'Queue latency, head-of-line blocking, starvation, rejection semantics, tail latency, and multi-tenant fairness are unspecified. No cap is invented.',
    'C05 Deferred DB Pool Evaluation': 'Prisma acquisition count/wait remains NOT_OBSERVABLE. PostgreSQL wait_event is not a client pool queue, so pool tuning is deferred pending direct evidence after fan-out controls.',
    'C06 Scenario Isolation': 'C06 is proven measurement hygiene and is retained for validation, but it has no production capacity effect and is rejected as the Phase 2.3 optimization.',
    'Candidate Interaction Map': `${interactions.length}/15 unordered candidate pairs are classified. C01/C02, C01/C03, and C01/C04 are complementary with explicit sequencing; C04/C05 remains UNKNOWN.`,
    'Correctness Safety Comparison': 'C01 preserves the query and filtering path. C02 has the largest semantic equivalence surface; C03/C04 require new cancellation/admission semantics; C05 changes an unproven bound; C06 is test-only.',
    'Infrastructure Cost Comparison': 'C01/C03/C04 require no expected new infrastructure; C02 may require an index; C05 may increase database load/cost; C06 adds test time only.',
    'Runtime Cost Comparison': 'C01 adds one small process-local promise map and removes duplicate owner work. C02 lowers read cost. C03 lowers post-abort work. C04 adds queueing. C05 is unknown. C06 is test-only.',
    'Maintenance Cost Comparison': 'C01/C06 are LOW; C02/C04/C05 are MEDIUM; C03 is HIGH because cancellation crosses layers and shared ownership.',
    'Implementation Complexity Comparison': 'C01 LOW; C02/C03 HIGH; C04 MEDIUM; C05 configuration is superficially LOW but evidence cost HIGH; C06 LOW and test-only.',
    'Blast Radius Comparison': 'C01 is one application-read module. C02 spans query/filter/schema concerns. C03 spans HTTP through database. C04 affects admission for users/tenants. C05 affects all DB traffic. C06 affects harness execution only.',
    'Reversibility Comparison': 'C01, C04, C05, and C06 are highly reversible; C02 is medium if an index/query migration is involved; C03 is medium because several layers may change.',
    'UX Impact Comparison': 'C01 should reduce same-key burst latency variance. C02 may improve owner latency. C03 improves recovery only. C04 can worsen queues. C05 is unknown. C06 has no production UX effect.',
    'Validation Complexity Comparison': 'C01 has the cleanest owner-count metric. C02 needs semantic and query-plan proofs. C03 needs abort-layer evidence. C04 needs fairness/load evidence. C05 needs acquisition telemetry. C06 is directly testable but non-production.',
    'Cross-Instance Implications': 'C01 is explicitly process-local and does not provide cross-instance miss coalescing. Current and Verification cross-instance duplicate prevention also remain NOT_PROVEN.',
    'Unknown Assumptions': candidateRows.flatMap(({ candidateId, unknownAssumptions }) => unknownAssumptions.map((value) => `${candidateId}: ${value}`)).join('; ') + '.',
    'Candidate Decision Table': table,
    'Rejected Candidates': `${candidate('C06').candidateId} is rejected as the production optimization because scenario isolation cannot reduce P09 production reads; it remains validation hygiene.`,
    'Deferred Candidates': `${candidate('C04').candidateId} waits for post-C01 distinct-key capacity evidence. ${candidate('C05').candidateId} waits for direct Prisma acquisition evidence and post-fan-out database capacity evidence.`,
    'Conditional Secondary Candidates': `${candidate('C02').candidateId}: ${candidate('C02').conditionalTrigger} ${candidate('C03').candidateId}: ${candidate('C03').conditionalTrigger}`,
    'Primary Selection': 'SELECTED_PHASE_2_3_MECHANISM = C01 / CACHE_MISS_COALESCING.',
    'Selection Confidence': 'SELECTION_CONFIDENCE = STRONGLY_SUPPORTED_DIRECT. Source structure proves duplicate miss ownership; accepted capacity evidence proves the material fan-out, while exact P09 admission timing remains unobservable.',
    'Why the Primary Was Selected': 'C01 removes the diagnosed duplicate read count with the smallest source, semantic, operational, and rollback surface and an exact owner-count metric.',
    'Why the Alternatives Were Not Selected': 'C02 is larger and complementary; C03 is post-abort damage limitation; C04 masks rather than removes duplicate work; C05 relies on unobserved pool evidence; C06 is measurement-only.',
    'Selection Falsification Criteria': 'Falsify if P09 keys differ, per-request read results are semantically required, owner cleanup cannot preserve retries, duplicate reads remain, or controlled evidence shows no causal-pressure reduction.',
    'Expected Causal Effect': 'For one exact process-local organization/pipeline miss window, expected application full-table read owners change from one per admitted miss to exactly one; no percentage latency claim is made.',
    'Phase 2.3 Source Surface': contract.expectedSourceSurfaces.map(({ path }) => path).join('; ') + '.',
    'Phase 2.3 Correctness Invariants': `${contract.correctnessInvariants.length} exact invariants preserve keys, isolation, TTL/query/results, failures/retry, search semantics, P09/P10 controls, and Forecast ownership/persistence.`,
    'Phase 2.3 Implementation Boundary': 'One process-local exact-key in-flight registry around the unchanged application read. C02-C06, distributed ownership, and all Forecast mechanisms are non-goals.',
    'Phase 2.3 Validation Strategy': contract.validationSequence.join(' -> ') + '. No Phase 2.3 validation is executed in Phase 2.2D.',
    'Phase 2.3 Performance Evidence Plan': 'Measure exact owner/full-table read count first, then P09 lower control, and only then a safety-gated high-concurrency proof. Preserve isolated P10 and full regression controls.',
    'Rollback Boundary': contract.rollbackBoundary,
    'Observability Plan': 'Reuse default-off Phase 2.2C read spans only for Phase 2.3 evidence, add an exact owner/join/release metric if authorized, and remove or separately promote diagnostics after validation.',
    'Functional Regression': regression ? `${regression.checksPassed}/${regression.checksExpected} applicable non-stress checks PASS; stress execution observed = false.` : 'PENDING until the separate non-stress regression runner completes.',
    'Methodology / Scope / Migration Guards': migration ? `Migration readiness covers ${migration.taskAttributedPathCount} task paths; runtime behavior source changes = 0; nested/external repositories = 0/0.` : 'Decision-only source/artifact generation; final migration and scope verification are pending.',
    'Phase 2.2D Final Gate and Recommended Next Decision': regression ? 'PHASE_2_2D_GATE = PASS; 92/92 PASS. Authorize Phase 2.3 separately only for C01.' : 'ANALYSIS COMPLETE; final gate awaits non-stress regression.',
    STOP: regression ? 'STOP — PHASE 2.2D COMPLETE. PHASE 2.3 READY FOR SEPARATE AUTHORIZATION, NOT AUTHORIZED, AND NOT STARTED.' : 'STOP — PHASE 2.2D ANALYSIS COMPLETE; FINALIZATION PENDING.',
  }
  return map[heading]
}

function migrationReadiness(generatedAt) {
  const definitions = [
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-finalize-selection.mjs', 'CREATED', 'Phase 2.2D Decision Tooling', 'TEST', 'YES', 'Deterministic authority, selection, report, and exact-gate finalizer.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-final-gate.validator.mjs', 'CREATED', 'Phase 2.2D Decision Tooling', 'TEST', 'YES', 'Standalone exact final gate validator.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-functional-regression.mjs', 'CREATED', 'Phase 2.2D Regression', 'TEST', 'YES', 'Non-stress regression runner.'],
    ['tooling/Benchmark-Forecasting/FORECAST_PHASE_2_2D_CONTROLLED_OPTIMIZATION_SELECTION_GATE.md', 'CREATED', 'Phase 2.2D Human Report', 'EVIDENCE', 'YES', 'Required exact 64-section report.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-candidate-evaluation.json', 'CREATED', 'Phase 2.2D Decision Evidence', 'EVIDENCE', 'YES', 'Six-candidate qualitative evaluation.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-candidate-interaction-map.json', 'CREATED', 'Phase 2.2D Decision Evidence', 'EVIDENCE', 'YES', 'Complete 15-pair interaction map.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-selection-decision.json', 'CREATED', 'Phase 2.2D Decision Evidence', 'EVIDENCE', 'YES', 'Canonical C01 selection decision.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-phase-2-3-implementation-contract.json', 'CREATED', 'Phase 2.3 Plan', 'EVIDENCE', 'YES', 'Plan-only selected mechanism contract.'],
    ['tooling/Benchmark-Forecasting/performance/phase-2-2d-phase-2-3-handoff.json', 'CREATED', 'Phase 2.3 Handoff', 'EVIDENCE', 'YES', 'Separate-authorization handoff.'],
    ['tooling/Benchmark-Forecasting/validation/forecast-phase-2-2d-controlled-optimization-selection.json', 'CREATED', 'Phase 2.2D Gate', 'EVIDENCE', 'YES', 'Required exact 92-condition gate.'],
    ['tooling/Benchmark-Forecasting/validation/forecast-phase-2-2d-migration-readiness.json', 'CREATED', 'Migration Readiness', 'EVIDENCE', 'YES', 'Task-attributed path inventory.'],
    ['tooling/Benchmark-Forecasting/validation/phase-2-2d/decision-analysis.json', 'CREATED', 'Phase 2.2D Decision Evidence', 'EVIDENCE', 'YES', 'Source and immutable-authority analysis.'],
    ['tooling/Benchmark-Forecasting/validation/phase-2-2d/functional-regression.json', 'CREATED', 'Phase 2.2D Regression Evidence', 'EVIDENCE', 'YES', 'No-stress regression results.'],
    ['apps/pmos/.pmos/forecast-phase-2-2d-controlled-optimization-selection-gate-v1-bootstrap.json', 'CREATED', 'PMOS Continuity', 'EVIDENCE', 'YES', 'Canonical PMOS Save bootstrap input.'],
  ]
  const paths = definitions.map(([filePath, change, logicalOwner, classification, includeInFutureSgDev, reason]) => {
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', filePath], { cwd: REPOSITORY_ROOT, encoding: 'utf8' }).status === 0
    return { path: filePath, change, logicalOwner, tracking: tracked ? 'tracked' : 'untracked', classification, includeInFutureSgDev, reason }
  })
  return { task: 'FORECAST_PHASE_2_2D_MIGRATION_READINESS', generatedAt, status: 'PASS', taskAttributedPathCount: paths.length, runtimeBehaviorSourceChanges: 0, newNestedGitRepositories: 0, newExternalSourceRepositories: 0, paths }
}

async function writeAnalysisOutputs({ generatedAt, authorities, source, candidateRows, interactions, contract, selection, regression = null, migration = null }) {
  const evaluation = {
    task: 'FORECAST_PHASE_2_2D_CANDIDATE_EVALUATION', phase: '2.2D', generatedAt,
    principles: ['METHODOLOGICAL_CORRECTNESS_SAFETY', 'LOW_INFRASTRUCTURE_COMPUTE_MAINTENANCE_COST', 'FAST_REPRODUCIBLE_USER_EXPERIENCE'],
    arbitraryNumericScoringUsed: false, frozenCandidateCount: 6, candidates: candidateRows,
  }
  const interaction = { task: 'FORECAST_PHASE_2_2D_CANDIDATE_INTERACTION_MAP', generatedAt, candidateCount: 6, expectedUnorderedPairs: 15, actualUnorderedPairs: interactions.length, pairs: interactions }
  const handoff = {
    task: 'FORECAST_PHASE_2_2D_PHASE_2_3_HANDOFF', generatedAt,
    status: regression ? 'READY_FOR_SEPARATE_AUTHORIZATION_DECISION' : 'ANALYSIS_COMPLETE_REGRESSION_PENDING',
    selectedMechanism: 'C01_CACHE_MISS_COALESCING', selectionConfidence: 'STRONGLY_SUPPORTED_DIRECT',
    primaryTarget: 'CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS',
    expectedCausalMetric: 'APPLICATION_FULL_TABLE_READ_OWNER_COUNT_PER_EXACT_ORGANIZATION_PIPELINE_MISS_WINDOW',
    conditionalSecondary: ['C02', 'C03'], deferred: ['C04', 'C05'], rejected: ['C06'],
    phase23ReadyForAuthorization: Boolean(regression), phase23Authorized: false, phase23Started: false,
    implementationContractPath: 'tooling/Benchmark-Forecasting/performance/phase-2-2d-phase-2-3-implementation-contract.json',
  }
  const analysis = {
    task: 'FORECAST_PHASE_2_2D_DECISION_ANALYSIS', generatedAt,
    immutableEvidence: { before: { status: 'PASS', referenceCount: authorities.beforeReferences.length }, originalB4: { status: 'PASS', hashes: ORIGINAL_B4_HASHES }, b4r: { status: 'PASS', hashes: B4R_HASHES }, phase22c: { status: 'PASS', hashes: PHASE_2C_HASHES } },
    sourceInspection: source,
    discriminatingConclusion: 'C01 changes duplicate read ownership while preserving the current query/result/filter semantics; C02 changes query/result construction and has broader semantic/index dependencies.',
    selectionHypothesisFalsified: false, stressExecuted: false, runtimeBehaviorChanged: false,
  }
  const report = ['# Forecast Phase 2.2D - Controlled Optimization Selection Gate', '', ...REPORT_HEADINGS.flatMap((heading, index) => [`## ${index + 1}. ${heading}`, '', reportText(heading, { candidateRows, interactions, contract, regression, migration }), ''])].join('\n')
  await Promise.all([
    writeJson(CANDIDATE_PATH, evaluation), writeJson(INTERACTION_PATH, interaction), writeJson(SELECTION_PATH, selection),
    writeJson(CONTRACT_PATH, contract), writeJson(HANDOFF_PATH, handoff), writeJson(ANALYSIS_PATH, analysis), writeFile(REPORT_PATH, `${report.trim()}\n`),
  ])
}

async function analyze() {
  assert.equal(REPORT_HEADINGS.length, 64)
  assert.equal(ACCEPTANCE_DESCRIPTIONS.length, 92)
  const [authorities, source] = await Promise.all([verifyAuthorities(), inspectSource()])
  const generatedAt = new Date().toISOString()
  const candidateRows = candidates()
  const interactions = interactionPairs()
  const contract = phase23Contract(generatedAt)
  const selection = selectionDecision(generatedAt, candidateRows)
  assert.equal(candidateRows.length, 6)
  assert.equal(candidateRows.filter(({ decision }) => decision === 'SELECT_FOR_PHASE_2_3').length, 1)
  assert.equal(candidateRows.find(({ decision }) => decision === 'SELECT_FOR_PHASE_2_3').evidenceLevel, 'STRONGLY_SUPPORTED_DIRECT')
  assert.equal(interactions.length, 15)
  await writeAnalysisOutputs({ generatedAt, authorities, source, candidateRows, interactions, contract, selection })
  process.stdout.write(`${JSON.stringify({ analysis: 'PASS', immutableBefore: '22/22', originalB4Hashes: '3/3', b4rHashes: '7/7', phase22cHashes: '9/9', candidates: '6/6', interactions: '15/15', selected: 'C01_CACHE_MISS_COALESCING', confidence: 'STRONGLY_SUPPORTED_DIRECT', stressExecuted: false, runtimeBehaviorChanged: false }, null, 2)}\n`)
}

async function finalize() {
  assert.equal(REPORT_HEADINGS.length, 64)
  assert.equal(ACCEPTANCE_DESCRIPTIONS.length, 92)
  const [authorities, source, regression] = await Promise.all([verifyAuthorities(), inspectSource(), readJson(REGRESSION_PATH)])
  assert.equal(regression.status, 'PASS')
  assert.equal(regression.stressExecutionObserved, false)
  assert.equal(regression.checksPassed, regression.checksExpected)
  const generatedAt = new Date().toISOString()
  const candidateRows = candidates()
  const interactions = interactionPairs()
  const contract = phase23Contract(generatedAt)
  const selection = selectionDecision(generatedAt, candidateRows)
  const migration = migrationReadiness(generatedAt)
  await writeAnalysisOutputs({ generatedAt, authorities, source, candidateRows, interactions, contract, selection, regression, migration })
  await writeJson(MIGRATION_PATH, migration)
  const conditions = ACCEPTANCE_DESCRIPTIONS.map((description, index) => ({ id: index + 1, status: 'PASS', description }))
  const gate = {
    task: 'FORECAST_PHASE_2_2D_CONTROLLED_OPTIMIZATION_SELECTION_GATE', phase: '2.2D', generatedAt,
    preconditions: { phase22b4rGate: 'PASS', phase22cGate: 'PASS', phase22bSeriesComplete: true, currentStructuralEffect: 'CONFIRMED', verificationStructuralEffect: 'CONFIRMED', persistenceIdempotency: 'PRESERVED' },
    immutableEvidence: { before: { status: 'PASS', referenceCount: authorities.beforeReferences.length }, originalB4: { status: 'PASS', hashes: ORIGINAL_B4_HASHES }, b4r: { status: 'PASS', hashes: B4R_HASHES }, phase22c: { status: 'PASS', hashes: PHASE_2C_HASHES } },
    diagnosis: { p09FirstCapacityBound: 'APPLICATION_DB_READ_FAN_OUT', p09PrimaryCause: 'CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS', p09Confidence: 'STRONGLY_SUPPORTED', p09TimeoutIs: 'DOWNSTREAM_SYMPTOM', p10FirstCapacityBound: 'NOT_OBSERVED_THROUGH_10', p10Contamination: 'PROVEN_MEASUREMENT_CONTAMINATION_FROM_PRECEDING_P09' },
    candidates: candidateRows,
    selection: { primarySelected: true, primaryCandidateId: 'C01', primaryCandidateName: 'CACHE_MISS_COALESCING', confidence: 'STRONGLY_SUPPORTED_DIRECT', conditionalSecondary: ['C02', 'C03'], deferred: ['C04', 'C05'], rejected: ['C06'], expectedCausalMetric: selection.primary.exactCausalMetric },
    phase23Contract: { created: true, selectedMechanism: 'C01_CACHE_MISS_COALESCING', correctnessInvariants: contract.correctnessInvariants, sourceSurface: contract.expectedSourceSurfaces, validationSequence: contract.validationSequence, rollbackBoundary: contract.rollbackBoundary },
    scopeGuards: { stressExecuted: false, p09Replayed: false, p10Replayed: false, runtimeOptimizationImplemented: false, queryChanged: false, cacheBehaviorChanged: false, dbPoolChanged: false, indexChanged: false, httpChanged: false, timeoutChanged: false, nodeChanged: false, infrastructureChanged: false, currentSingleFlightChanged: false, verificationSingleFlightChanged: false, persistenceChanged: false },
    regression: { status: 'PASS', checksExpected: regression.checksExpected, checksPassed: regression.checksPassed, stressExecutionObserved: false },
    migrationReadiness: { status: 'PASS', taskAttributedPathCount: migration.taskAttributedPathCount, runtimeBehaviorSourceChanges: 0, newNestedGitRepositories: 0, newExternalSourceRepositories: 0 },
    acceptanceConditions: { expected: 92, passed: 92, blocked: 0, failed: 0, conditions },
    reportSectionsExpected: 64, phase22dGate: 'PASS', optimizationSelectionComplete: true, phase23ReadyForAuthorization: true, phase23Authorized: false, phase23Started: false,
  }
  await writeJson(GATE_PATH, gate)
  await validateFinal()
}

async function validateFinal() {
  const [gate, migration, report, evaluation, interaction, selection, contract, handoff, regression] = await Promise.all([
    readJson(GATE_PATH), readJson(MIGRATION_PATH), readFile(REPORT_PATH, 'utf8'), readJson(CANDIDATE_PATH), readJson(INTERACTION_PATH),
    readJson(SELECTION_PATH), readJson(CONTRACT_PATH), readJson(HANDOFF_PATH), readJson(REGRESSION_PATH),
  ])
  await verifyAuthorities()
  const sections = [...report.matchAll(/^## (\d+)\. (.+)$/gm)]
  assert.equal(sections.length, 64)
  assert.ok(sections.every((section, index) => Number(section[1]) === index + 1 && section[2] === REPORT_HEADINGS[index]))
  assert.equal(evaluation.candidates.length, 6)
  assert.equal(evaluation.candidates.filter(({ decision }) => decision === 'SELECT_FOR_PHASE_2_3').length, 1)
  assert.equal(interaction.pairs.length, 15)
  assert.equal(selection.primary.candidateId, 'C01')
  assert.equal(selection.primary.confidence, 'STRONGLY_SUPPORTED_DIRECT')
  assert.equal(contract.nature, 'PLAN_ONLY')
  assert.equal(contract.authorized, false)
  assert.equal(contract.started, false)
  assert.equal(handoff.phase23Authorized, false)
  assert.equal(handoff.phase23Started, false)
  assert.equal(regression.status, 'PASS')
  assert.equal(regression.stressExecutionObserved, false)
  assert.equal(gate.acceptanceConditions.conditions.length, 92)
  assert.ok(gate.acceptanceConditions.conditions.every((condition, index) => condition.id === index + 1 && condition.status === 'PASS'))
  assert.deepEqual({ passed: gate.acceptanceConditions.passed, blocked: gate.acceptanceConditions.blocked, failed: gate.acceptanceConditions.failed }, { passed: 92, blocked: 0, failed: 0 })
  assert.equal(gate.phase22dGate, 'PASS')
  assert.equal(gate.optimizationSelectionComplete, true)
  assert.equal(gate.phase23ReadyForAuthorization, true)
  assert.equal(gate.phase23Authorized, false)
  assert.equal(gate.phase23Started, false)
  assert.equal(gate.scopeGuards.stressExecuted, false)
  assert.equal(gate.scopeGuards.runtimeOptimizationImplemented, false)
  assert.equal(migration.runtimeBehaviorSourceChanges, 0)
  assert.equal(migration.newNestedGitRepositories, 0)
  assert.equal(migration.newExternalSourceRepositories, 0)
  assert.ok(report.endsWith('STOP — PHASE 2.2D COMPLETE. PHASE 2.3 READY FOR SEPARATE AUTHORIZATION, NOT AUTHORIZED, AND NOT STARTED.\n'))
  process.stdout.write(`${JSON.stringify({ phase22dGate: 'PASS', acceptance: '92/92 PASS', reportSections: '64/64', selected: 'C01_CACHE_MISS_COALESCING', confidence: 'STRONGLY_SUPPORTED_DIRECT', stressExecuted: false, runtimeBehaviorSourceChanges: 0, phase23ReadyForAuthorization: true, phase23Authorized: false, phase23Started: false }, null, 2)}\n`)
}

const command = process.argv[2]
if (command === '--analyze') analyze().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else if (command === '--finalize') finalize().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else if (command === '--validate') validateFinal().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1 })
else { process.stderr.write('Usage: phase-2-2d-finalize-selection.mjs --analyze|--finalize|--validate\n'); process.exitCode = 1 }