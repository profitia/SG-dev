import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import {
  MAXIMUM_RELEASE_SPREAD_MS,
  STRESS_TEST_CONTRACT_VERSION,
  runBarrierDryRun,
} from './stress-test-harness.mjs'

const ROOT = new URL('./', import.meta.url)

const EXACT_STATES = [
  'HOT_READY',
  'WARM_INPUT_READY_ARTIFACT_MISS',
  'COLD_INPUT_AND_ARTIFACT_MISS',
  'VERIFICATION_READY',
  'VERIFICATION_MISS',
  'UX_SEARCH_EXPAND_HISTORICAL',
]

const EXACT_SCENARIOS = [
  'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11',
]

const EXACT_PRIMARY_COHORT = ['wocaes0074', 'wocaes0280', 'usnaac0169']
const EXACT_COMPATIBILITY_COHORT = ['usnaac0169', 'istrad0862', 'chpric0077', 'cndemo0001', 'trsurv1145']
const EXACT_SNAPSHOTS = [
  'SNAPSHOT_HOT_READY',
  'SNAPSHOT_WARM_CURRENT_MISS',
  'SNAPSHOT_COLD_CURRENT_MISS',
  'SNAPSHOT_VERIFICATION_READY',
  'SNAPSHOT_VERIFICATION_MISS',
  'SNAPSHOT_UX_READY',
]
const REQUIRED_TELEMETRY_EVENTS = [
  'prepared_read',
  'current_compute_end',
  'model_fit',
  'verification_compute_end',
  'provider_call',
  'persistence',
  'database_read',
  'resource_sample',
]
const REQUIRED_CORRELATION_FIELDS = [
  'stressRunId',
  'scenarioId',
  'virtualUserId',
  'requestId',
  'forecastIdentity',
  'logicalArtifactKey',
]

const REPOSITORY_ROOT = new URL('../../../', ROOT)
const ENVIRONMENT_MANIFEST = new URL('./phase-2-1-environment.json', ROOT)
const SNAPSHOT_MANIFEST = new URL('./phase-2-1-snapshots.json', ROOT)
const TELEMETRY_EVIDENCE = new URL('../validation/forecast-phase-2-1a-telemetry.json', ROOT)
const DATABASE_EVIDENCE = new URL('../validation/forecast-phase-2-1a-database-observability.json', ROOT)
const CORRECTNESS_EVIDENCE = new URL('../validation/forecast-phase-2-1a-correctness.json', ROOT)
const RUNTIME_SMOKE_EVIDENCE = new URL('../validation/forecast-phase-2-1a-runtime-smoke.json', ROOT)
const RESULT_SCHEMA_EVIDENCE = new URL('../validation/forecast-phase-2-1a-result-schema-validation.json', ROOT)

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, ROOT), 'utf8'))
}

async function readOptionalJson(url) {
  try {
    return JSON.parse(await readFile(url, 'utf8'))
  } catch {
    return null
  }
}

function sameValues(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function condition(id, description, status, evidence) {
  return { id, description, status, evidence }
}

function evidenceStatus(evidence, valid) {
  if (!evidence) return 'BLOCKED'
  return valid ? 'PASS' : 'FAIL'
}

async function sha256(url) {
  return createHash('sha256').update(await readFile(url)).digest('hex')
}

async function validateSnapshots(manifest) {
  if (!manifest || !Array.isArray(manifest.snapshots)) return false
  const shapeValid = manifest.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && manifest.snapshotManifestVersion === 1
    && manifest.databaseCloneAlias === 'phase-2-1-local-clone-v1'
    && manifest.deterministicRestore === true
    && manifest.credentialsIncluded === false
    && sameValues(manifest.snapshots.map(({ snapshotId }) => snapshotId), EXACT_SNAPSHOTS)
    && manifest.snapshots.every((snapshot) => snapshot.snapshotVersion === 1
      && snapshot.databaseCloneAlias === manifest.databaseCloneAlias
      && snapshot.immutable === true
      && /^[a-f0-9]{64}$/.test(snapshot.sha256)
      && snapshot.state && Object.keys(snapshot.state).length > 0)
  if (!shapeValid) return false

  try {
    const checksums = await Promise.all(manifest.snapshots.map(async (snapshot) => ({
      expected: snapshot.sha256,
      actual: await sha256(new URL(snapshot.archiveFile, REPOSITORY_ROOT)),
    })))
    return checksums.every(({ expected, actual }) => expected === actual)
  } catch {
    return false
  }
}

function validateEnvironment(manifest) {
  return manifest?.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && manifest.environmentId === 'phase-2-1-local-isolated-v1'
    && manifest.environmentType === 'LOCAL_NON_PRODUCTION_ISOLATED'
    && manifest.nonProductionConfirmed === true
    && manifest.database?.cloneAlias === 'phase-2-1-local-clone-v1'
    && manifest.database?.applicationDatabase === 'sg_phase_2_1_app'
    && manifest.database?.marketDataDatabase === 'sg_phase_2_1_market_data'
    && manifest.database?.host === '127.0.0.1'
    && manifest.database?.port === 55421
    && manifest.database?.schemaMigration === false
    && manifest.stressTelemetry?.default === false
    && manifest.providerPolicy?.startsWith('DENY_BY_DEFAULT')
    && manifest.credentialsIncluded === false
}

function validateRuntimeSmoke(evidence) {
  return evidence?.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && evidence.environmentId === 'phase-2-1-local-isolated-v1'
    && evidence.cloneAlias === 'phase-2-1-local-clone-v1'
    && evidence.L1?.passed === true
    && evidence.L2?.passed === true
    && evidence.L3?.passed === true
    && evidence.loadRequestsExecuted === 0
    && evidence.phase21BStarted === false
    && evidence.credentialsIncluded === false
}

function telemetryChecks(evidence) {
  const eventTypes = evidence?.onProof?.eventTypes ?? []
  const sampleEvents = evidence?.sampleEvents ?? []
  const correlation = evidence?.correlation?.fields ?? []
  return {
    safe: evidence?.contractVersion === STRESS_TEST_CONTRACT_VERSION
      && evidence.classification === 'READINESS_PROBE_NOT_PERFORMANCE_EVIDENCE'
      && evidence.loadRequestsExecuted === 0
      && evidence.phase21BStarted === false
      && evidence.credentialsIncluded === false,
    defaultOff: evidence?.defaultOff?.passed === true && evidence.defaultOff.emittedEvents === 0,
    on: evidence?.onProof?.passed === true
      && REQUIRED_TELEMETRY_EVENTS.every((event) => eventTypes.includes(event)),
    neutral: evidence?.behaviorNeutral?.passed === true && evidence.behaviorNeutral.outputsDeepEqual === true,
    correlation: evidence?.correlation?.passed === true
      && REQUIRED_CORRELATION_FIELDS.every((field) => correlation.includes(field))
      && sampleEvents.length > 0
      && sampleEvents.every((event) => REQUIRED_CORRELATION_FIELDS.every((field) => Boolean(event[field]))),
    compute: evidence?.counters?.currentCompute === true
      && evidence?.duplicateComputeAggregation?.passed === true
      && evidence.duplicateComputeAggregation.expectedLogicalComputeCount === 1
      && evidence.duplicateComputeAggregation.actualComputeCount === 2
      && evidence.duplicateComputeAggregation.duplicateComputeCount === 1,
    modelFit: evidence?.counters?.modelFit === true,
    verification: evidence?.counters?.verification === true,
    provider: evidence?.counters?.provider === true,
    persistence: evidence?.counters?.persistence === true,
    preparedRead: evidence?.counters?.preparedRead === true,
    cpu: evidence?.resources?.cpu === true,
    memory: evidence?.resources?.memory === true,
  }
}

function validateDatabaseEvidence(evidence) {
  const expectedNames = ['sg_phase_2_1_app', 'sg_phase_2_1_market_data']
  const numericMetrics = [
    'connectionCount', 'activeConnectionCount', 'waitingConnectionCount', 'transactionCommits',
    'transactionRollbacks', 'blocksRead', 'blocksHit', 'rowsReturned', 'rowsFetched', 'rowsInserted',
    'rowsUpdated', 'rowsDeleted', 'deadlocks',
  ]
  return evidence?.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && evidence.environmentId === 'phase-2-1-local-isolated-v1'
    && evidence.cloneAlias === 'phase-2-1-local-clone-v1'
    && evidence.credentialsIncluded === false
    && sameValues(evidence.databases?.map(({ databaseName }) => databaseName), expectedNames)
    && evidence.databases.every((database) => numericMetrics.every((metric) => (
      Number.isFinite(database[metric]) && database[metric] >= 0
    )))
}

function validateCorrectness(evidence) {
  return evidence?.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && evidence.telemetryOffOnDeepEqual === true
    && evidence.forecastTests?.passed === 21
    && evidence.forecastTests?.failed === 0
    && evidence.loadRequestsExecuted === 0
    && evidence.phase21BStarted === false
}

function validateResultSchema(schema) {
  const required = schema.required ?? []
  return schema.type === 'object'
    && schema.additionalProperties === false
    && schema.properties?.contractVersion?.const === STRESS_TEST_CONTRACT_VERSION
    && required.length > 40
    && required.every((property) => Object.hasOwn(schema.properties, property))
    && schema.properties?.scenarioId?.pattern === '^(P(0[1-9]|1[01])|E0[1-3])$'
    && sameValues(schema.properties?.concurrency?.enum, [10, 100, 1000])
}

function validateResultSchemaEvidence(evidence, schema) {
  return evidence?.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && evidence.schemaId === schema.$id
    && evidence.completeGeneratedSamplePassed === true
    && evidence.requiredProperties === schema.required.length
    && evidence.propertyCount === Object.keys(schema.properties).length
    && evidence.validationErrors?.length === 0
    && evidence.loadRequestsExecuted === 0
    && evidence.phase21BStarted === false
}

export async function evaluatePhase21Readiness() {
  const [contract, scenarios, resultSchema, observability, environment, snapshots, telemetry, database, correctness, runtimeSmoke, resultSchemaEvidence] = await Promise.all([
    readJson('stress-test-contract.json'),
    readJson('stress-test-scenarios.json'),
    readJson('stress-test-result.schema.json'),
    readJson('observability-matrix.json'),
    readOptionalJson(ENVIRONMENT_MANIFEST),
    readOptionalJson(SNAPSHOT_MANIFEST),
    readOptionalJson(TELEMETRY_EVIDENCE),
    readOptionalJson(DATABASE_EVIDENCE),
    readOptionalJson(CORRECTNESS_EVIDENCE),
    readOptionalJson(RUNTIME_SMOKE_EVIDENCE),
    readOptionalJson(RESULT_SCHEMA_EVIDENCE),
  ])
  const barrier = await runBarrierDryRun({ virtualUsers: 4 })
  const [environmentValid, snapshotsValid, runtimeSmokeValid] = await Promise.all([
    Promise.resolve(validateEnvironment(environment)),
    validateSnapshots(snapshots),
    Promise.resolve(validateRuntimeSmoke(runtimeSmoke)),
  ])
  const telemetryState = telemetryChecks(telemetry)
  const databaseValid = validateDatabaseEvidence(database)
  const correctnessValid = validateCorrectness(correctness)
  const resultSchemaValid = validateResultSchema(resultSchema)
    && validateResultSchemaEvidence(resultSchemaEvidence, resultSchema)
  const statesMatch = sameValues(Object.keys(contract.states), EXACT_STATES)
  const scenariosMatch = sameValues(scenarios.scenarios.map(({ scenarioId }) => scenarioId), EXACT_SCENARIOS)
  const primaryMatches = sameValues(contract.cohorts.primary.map(({ seriesId }) => seriesId), EXACT_PRIMARY_COHORT)
  const compatibilityMatches = sameValues(
    contract.cohorts.compatibility.map(({ seriesId }) => seriesId),
    EXACT_COMPATIBILITY_COHORT,
  )
  const contractVersionMatches = contract.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && scenarios.contractVersion === STRESS_TEST_CONTRACT_VERSION
    && resultSchema.properties.contractVersion.const === STRESS_TEST_CONTRACT_VERSION
  const contractShapeMatches = contractVersionMatches
    && statesMatch
    && scenariosMatch
    && sameValues(contract.concurrencyLevels, [10, 100, 1000])
    && contract.loadShapes.primary.releaseWindowMsMaximum === MAXIMUM_RELEASE_SPREAD_MS
    && primaryMatches
    && compatibilityMatches

  const environmentReady = environmentValid && runtimeSmokeValid
  const protectedStateValid = environmentValid && snapshotsValid
  const observabilityValid = observability.metrics.every(({ availableNow, missing }) => availableNow === true && missing === false)
    && observability.functionalBehaviorChange === false
    && observability.optimizationImplemented === false
  const conditions = [
    condition(1, 'Contract v1 parsed unchanged.', contractVersionMatches ? 'PASS' : 'FAIL', 'Frozen JSON authorities parsed successfully.'),
    condition(2, 'Six states match exactly.', statesMatch ? 'PASS' : 'FAIL', Object.keys(contract.states)),
    condition(3, 'P01-P11 match exactly.', scenariosMatch ? 'PASS' : 'FAIL', scenarios.scenarios.map(({ scenarioId }) => scenarioId)),
    condition(4, 'Concurrency 10/100/1000 match exactly.', sameValues(contract.concurrencyLevels, [10, 100, 1000]) ? 'PASS' : 'FAIL', contract.concurrencyLevels),
    condition(5, 'Burst release maximum remains 250 ms.', contract.loadShapes.primary.releaseWindowMsMaximum === 250 ? 'PASS' : 'FAIL', contract.loadShapes.primary.releaseWindowMsMaximum),
    condition(6, 'Primary cohort matches exactly.', primaryMatches ? 'PASS' : 'FAIL', contract.cohorts.primary.map(({ seriesId }) => seriesId)),
    condition(7, 'Compatibility cohort matches exactly.', compatibilityMatches ? 'PASS' : 'FAIL', contract.cohorts.compatibility.map(({ seriesId }) => seriesId)),
    condition(8, 'Non-production L1/L2/L3 environment confirmed.', !environment ? 'BLOCKED' : !environmentValid ? 'FAIL' : evidenceStatus(runtimeSmoke, runtimeSmokeValid), runtimeSmoke ?? environment),
    condition(9, 'Isolated DB clone confirmed.', evidenceStatus(environment, environmentValid), environment ?? 'Required environment manifest is absent.'),
    condition(10, 'Six immutable scenario snapshots and checksums are valid.', evidenceStatus(snapshots, snapshotsValid), snapshots ? snapshots.snapshots.map(({ snapshotId, sha256: checksum }) => ({ snapshotId, checksum })) : 'Required snapshot manifest is absent.'),
    condition(11, 'Accepted Stage C/D data remains protected.', (!environment || !snapshots) ? 'BLOCKED' : protectedStateValid ? 'PASS' : 'FAIL', { localIsolation: environmentValid, immutableSnapshots: snapshotsValid }),
    condition(12, 'Stress telemetry defaults OFF.', telemetry && observability.defaultTelemetryFlag === 'FORECAST_STRESS_TELEMETRY_ENABLED=false' && telemetryState.defaultOff ? 'PASS' : telemetry ? 'FAIL' : 'BLOCKED', observability.defaultTelemetryFlag),
    condition(13, 'Telemetry ON works in isolated readiness mode.', evidenceStatus(telemetry, telemetryState.safe && telemetryState.on && telemetryState.neutral), telemetry?.onProof ?? 'Telemetry evidence is absent.'),
    condition(14, 'Request correlation works.', evidenceStatus(telemetry, telemetryState.correlation), telemetry?.correlation ?? 'Telemetry evidence is absent.'),
    condition(15, 'Compute counters work.', evidenceStatus(telemetry, telemetryState.compute), telemetry?.counters ?? 'Telemetry evidence is absent.'),
    condition(16, 'Model-fit counters work.', evidenceStatus(telemetry, telemetryState.modelFit), telemetry?.counters ?? 'Telemetry evidence is absent.'),
    condition(17, 'Verification counters work.', evidenceStatus(telemetry, telemetryState.verification), telemetry?.counters ?? 'Telemetry evidence is absent.'),
    condition(18, 'Provider counters work.', evidenceStatus(telemetry, telemetryState.provider), telemetry?.counters ?? 'Telemetry evidence is absent.'),
    condition(19, 'Persistence counters work.', evidenceStatus(telemetry, telemetryState.persistence), telemetry?.counters ?? 'Telemetry evidence is absent.'),
    condition(20, 'Prepared hit/miss counters work.', evidenceStatus(telemetry, telemetryState.preparedRead), telemetry?.counters ?? 'Telemetry evidence is absent.'),
    condition(21, 'CPU sampling works.', evidenceStatus(telemetry, telemetryState.cpu), telemetry?.resources ?? 'Telemetry evidence is absent.'),
    condition(22, 'Memory and event-loop sampling work.', evidenceStatus(telemetry, telemetryState.memory && telemetry?.resources?.eventLoop === true), telemetry?.resources ?? 'Telemetry evidence is absent.'),
    condition(23, 'DB metric collection works to documented capability.', evidenceStatus(database, databaseValid), database?.databases ?? 'Database observability evidence is absent.'),
    condition(24, 'Result schema validation passes.', evidenceStatus(resultSchemaEvidence, resultSchemaValid), resultSchemaEvidence ?? 'Result schema validation evidence is absent.'),
    condition(25, 'Forecast correctness is equivalent with telemetry OFF and ON.', evidenceStatus(correctness, correctnessValid), correctness ?? 'Correctness evidence is absent.'),
    condition(26, 'Harness barrier dry smoke passes.', barrier.passed ? 'PASS' : 'FAIL', { releaseSpreadMs: barrier.releaseSpreadMs, actualRequests: barrier.actualRequests }),
    condition(27, 'No optimization or Phase 2.1B load was introduced.', observabilityValid && telemetryState.safe ? 'PASS' : 'FAIL', { optimizationImplemented: observability.optimizationImplemented, phase21BStarted: telemetry?.phase21BStarted, loadRequestsExecuted: telemetry?.loadRequestsExecuted }),
  ]
  const failures = conditions.filter(({ status }) => status === 'FAIL')
  const blockers = conditions.filter(({ status }) => status === 'BLOCKED')

  return {
    contractVersion: STRESS_TEST_CONTRACT_VERSION,
    contractDrift: !contractShapeMatches,
    gate: failures.length > 0 ? 'FAIL' : blockers.length > 0 ? 'BLOCKED' : 'PASS',
    fullBaselineStarted: false,
    loadRequestsExecuted: 0,
    environment: {
      manifest: 'performance/phase-2-1-environment.json',
      present: Boolean(environment),
      nonProductionConfirmed: environmentReady,
      isolatedDatabaseConfirmed: environmentValid,
      runtimeSmokeConfirmed: runtimeSmokeValid,
    },
    snapshots: {
      manifest: 'performance/phase-2-1-snapshots.json',
      present: Boolean(snapshots),
      immutableSnapshotsConfirmed: snapshotsValid,
    },
    evidence: {
      telemetry: Boolean(telemetry),
      databaseObservability: Boolean(database),
      correctness: Boolean(correctness),
      runtimeSmoke: Boolean(runtimeSmoke),
      resultSchemaValidation: Boolean(resultSchemaEvidence),
    },
    barrierSmoke: barrier,
    conditions,
  }
}
