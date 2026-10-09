import assert from 'node:assert/strict'
import test from 'node:test'
import { hashObject } from '../../../../../packages/governance/src'
import { buildNamespacedPublicationId, requireCanonicalMemorosProjectId, resolvePmosProjectProfile } from './project-profile'
import { nextLifecycleEvent, SG2_LIFECYCLE_VERSION, type LifecycleEvent, type PersistedLifecycleRow } from './sg2-immutable-lifecycle'
import { buildCanonicalConversationReadModel, buildSg2LifecycleReadModel } from './flight-record-read'

function fixture() {
  const flightRecordJson = {
    metadata: { project: 'SpendGuru 2.0', taskId: 'SG2-READ-TEST', conversationId: 'read:test' },
    task: { originalTaskRequest: 'Read only' }, analysis: {}, findings: {}, decisions: {}, actions: {}, result: { finalStatus: 'SUCCESS' },
    completionEvidence: { closeoutState: 'PMOS_SAVE_SUCCEEDED', pmosSaveStatus: 'SUCCEEDED', runtimeContextRefreshStatus: 'NOT_STARTED' },
  }
  const source = { id: 'base', project: 'SpendGuru 2.0', taskId: 'SG2-READ-TEST', conversationId: 'read:test', flightRecordJson }
  const seal = { taskId: source.taskId, conversationId: source.conversationId, fingerprint: hashObject(flightRecordJson), jsonBytesHash: '1'.repeat(64), integrityBytesHash: '2'.repeat(64), lockBytesHash: '3'.repeat(64) }
  const receipts = [
    ['PMOS_SAVE', { status: 'SUCCEEDED', conversationArtifactId: source.id }],
    ['RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'PASS' }],
    ['MEMOROS_INTENT', { provider: 'MEMOROS', snapshotHash: seal.fingerprint }],
    ['MEMOROS_ACK', { ack: { projectId: requireCanonicalMemorosProjectId(resolvePmosProjectProfile({ projectName: 'SG2' })), threadId: 'thread', sourceRecordId: 'record', sourceTable: 'conversation_artifacts', sourceRecordExternalId: 'conversation_artifacts:base' }, publicationArtifact: { id: `${source.conversationId}:PUBLICATION:MEMOROS:v1` }, consumerReadiness: { status: 'READY' } }],
    ['PHR_INTENT', { provider: 'PHR', snapshotHash: seal.fingerprint }],
    ['PHR_ACK', { publication: { result: { status: 'PUBLISHED', taskId: source.taskId, publicationId: buildNamespacedPublicationId('SG2', source.taskId), commitSha: 'fixture-commit' } } }],
    ['CLOSEOUT_COMPLETE', { closeoutState: 'CLOSEOUT_COMPLETE', pending: 'CLEAR', recoveryRequired: false }],
  ] as const
  const events: LifecycleEvent[] = []
  for (const [step, receipt] of receipts) events.push(nextLifecycleEvent(events, seal, step, receipt))
  const rows: PersistedLifecycleRow[] = events.map(event => ({ id: `${source.conversationId}:SG2_LIFECYCLE:v1:${event.step}`, taskId: source.taskId, conversationId: source.conversationId, artifactKind: 'EXECUTION_TRAIL', artifactNature: 'DERIVED', status: 'GENERATED', version: SG2_LIFECYCLE_VERSION, payload: event, sourceRefs: seal }))
  return { source, seal, events, rows }
}

test('complete SG2 chain yields current completion without modifying immutable completionEvidence', () => {
  const f = fixture(); const before = JSON.stringify(f.source.flightRecordJson)
  const model = buildSg2LifecycleReadModel(f.source, [...f.rows].reverse())!
  assert.equal(model.currentState, 'CLOSEOUT_COMPLETE')
  assert.equal(model.snapshotState.closeoutState, 'PMOS_SAVE_SUCCEEDED')
  assert.equal(model.snapshotState.runtimeContextRefreshStatus, 'NOT_STARTED')
  assert.equal(model.evidenceIntegrity, 'PASS')
  assert.equal(model.verificationScope, 'POSTGRESQL_EVIDENCE_ONLY')
  assert.equal(model.immutableIntegrity, 'NOT_VERIFIED')
  assert.equal(model.memorosPublication, 'DELIVERED')
  assert.equal(model.memorosConsumerReadiness, 'NOT_VERIFIED') // even with historical READY in ACK
  assert.equal(model.phrPublication, 'PUBLISHED')
  assert.equal(JSON.stringify(f.source.flightRecordJson), before)
})

test('every valid incomplete prefix is PARTIAL; recovery is shown from validated events', () => {
  const f = fixture()
  for (let length = 1; length < 7; length++) assert.equal(buildSg2LifecycleReadModel(f.source, f.rows.slice(0, length))!.currentState, 'PARTIAL')
  const event = nextLifecycleEvent(f.events.slice(0, 3), f.seal, 'RECOVERY_REQUIRED', { status: 'RECOVERY_REQUIRED' })
  const row = { ...f.rows[0], id: `${f.source.conversationId}:SG2_LIFECYCLE:v1:RECOVERY_REQUIRED`, payload: event }
  const model = buildSg2LifecycleReadModel(f.source, [...f.rows.slice(0, 3), row])!
  assert.equal(model.currentState, 'RECOVERY_REQUIRED'); assert.equal(model.recoveryRequired, true)
})

const invalidCases: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
  ['missing event', f => { f.rows.splice(2, 1) }],
  ['standalone closeout', f => { f.rows = f.rows.slice(-1) }],
  ['wrong order', f => { f.events[1].sequence = 3 }],
  ['wrong task', f => { f.source.taskId = 'FOREIGN' }],
  ['wrong project', f => { f.source.project = 'SRM' }],
  ['wrong conversation', f => { f.source.conversationId = 'foreign' }],
  ['wrong event project', f => { (f.events[1] as any).projectKey = 'SRM' }],
  ['corrupt hash', f => { f.events[3].eventHash = 'a'.repeat(64) }],
  ['wrong previousHash', f => { f.events[2].previousHash = 'b'.repeat(64) }],
  ['foreign snapshot', f => { f.source.flightRecordJson.task.originalTaskRequest = 'foreign' }],
  ['duplicate event', f => { f.rows.push(structuredClone(f.rows[0])) }],
  ['wrong row identity', f => { f.rows[0].id = 'foreign' }],
  ['wrong row conversation', f => { f.rows[0].conversationId = 'foreign' }],
  ['wrong envelope nature', f => { f.rows[0].artifactNature = 'PRIMARY' }],
  ['wrong sourceRefs', f => { f.rows[0].sourceRefs = {} }],
  ['missing payload', f => { f.rows[0].payload = null }],
  ['missing byte fingerprints', f => { f.seal.lockBytesHash = '' }],
]
for (const [name, change] of invalidCases) test(`invalid ${name} never yields lifecycle success or publication proof`, () => {
  const f = fixture(); change(f)
  const model = buildSg2LifecycleReadModel(f.source, f.rows)!
  assert.equal(model.currentState, 'NOT_VERIFIED'); assert.equal(model.evidenceIntegrity, 'FAIL')
  assert.equal(model.memorosPublication, 'NOT_VERIFIED'); assert.equal(model.phrPublication, 'NOT_VERIFIED')
})

test('historical SG2 snapshot status has explicit provenance and no synthetic events', () => {
  const f = fixture(); f.source.flightRecordJson.completionEvidence.closeoutState = 'CLOSEOUT_COMPLETE'
  const model = buildSg2LifecycleReadModel(f.source, [])!
  assert.equal(model.mode, 'HISTORICAL_SNAPSHOT_ONLY'); assert.equal(model.currentState, 'NOT_VERIFIED')
  assert.equal(model.snapshotState.closeoutState, 'CLOSEOUT_COMPLETE'); assert.equal(model.evidenceIntegrity, 'NOT_VERIFIED')
  assert.equal(model.immutableIntegrity, 'NOT_VERIFIED'); assert.equal(model.eventCount, 0)
})

test('historical Stage1 integrity exception is retained as FAIL', () => {
  const f = fixture(); f.source.taskId = f.source.flightRecordJson.metadata.taskId = 'SG2-RELEASE-HARDENING-STAGE1-20261008'
  f.source.flightRecordJson.completionEvidence.closeoutState = 'CLOSEOUT_COMPLETE'
  const model = buildSg2LifecycleReadModel(f.source, [])!
  assert.equal(model.immutableIntegrity, 'FAIL'); assert.match(model.historicalException!, /integrity-exception/)
  assert.equal(model.currentState, 'NOT_VERIFIED')
})

test('SRM and CIC use the exact legacy canonical read model with no SG2 evidence obligation', () => {
  for (const project of ['SRM', 'Conversational Intelligence Core']) {
    const f = fixture(); f.source.project = f.source.flightRecordJson.metadata.project = project
    f.source.flightRecordJson.completionEvidence.closeoutState = 'CLOSEOUT_COMPLETE'
    const legacy = buildCanonicalConversationReadModel(f.source.flightRecordJson)
    assert.equal(buildSg2LifecycleReadModel(f.source, []), null)
    assert.deepEqual(legacy.completionEvidence, { closeoutState: 'CLOSEOUT_COMPLETE', pmosSaveStatus: 'SUCCEEDED', runtimeContextRefreshStatus: 'NOT_STARTED', archiveCompletenessStatus: null, executionTrailStatus: null })
    assert.deepEqual(buildCanonicalConversationReadModel(f.source.flightRecordJson), legacy)
  }
})
