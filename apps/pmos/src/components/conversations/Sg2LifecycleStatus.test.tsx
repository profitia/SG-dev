import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sg2LifecycleStatus } from './Sg2LifecycleStatus'
import { buildSg2LifecycleReadModel } from '../../lib/pmos/flight-record-read'
import { hashObject } from '../../../../../packages/governance/src'
import { nextLifecycleEvent, SG2_LIFECYCLE_VERSION, type LifecycleEvent } from '../../lib/pmos/sg2-immutable-lifecycle'
import { buildNamespacedPublicationId, requireCanonicalMemorosProjectId, resolvePmosProjectProfile } from '../../lib/pmos/project-profile'

function fixture() {
  const source = { id: 'ui-base', project: 'SpendGuru 2.0', taskId: 'SG2-UI-TEST', conversationId: 'ui:test', flightRecordJson: {
    metadata: { project: 'SpendGuru 2.0', taskId: 'SG2-UI-TEST', conversationId: 'ui:test' },
    task: {}, analysis: {}, findings: {}, decisions: {}, actions: {}, result: {},
    completionEvidence: { closeoutState: 'PMOS_SAVE_SUCCEEDED', runtimeContextRefreshStatus: 'NOT_STARTED' },
  } }
  const seal = { taskId: source.taskId, conversationId: source.conversationId, fingerprint: hashObject(source.flightRecordJson), jsonBytesHash: '1'.repeat(64), integrityBytesHash: '2'.repeat(64), lockBytesHash: '3'.repeat(64) }
  const events: LifecycleEvent[] = []
  const add = (step: LifecycleEvent['step'], receipt: unknown) => events.push(nextLifecycleEvent(events, seal, step, receipt))
  add('PMOS_SAVE', { status: 'SUCCEEDED', conversationArtifactId: source.id })
  add('RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'PASS' })
  add('MEMOROS_INTENT', { provider: 'MEMOROS', snapshotHash: seal.fingerprint })
  add('MEMOROS_ACK', { ack: { projectId: requireCanonicalMemorosProjectId(resolvePmosProjectProfile({ projectName: 'SG2' })), threadId: 'thread', sourceRecordId: 'record', sourceTable: 'conversation_artifacts', sourceRecordExternalId: 'conversation_artifacts:ui-base' }, publicationArtifact: { id: `${source.conversationId}:PUBLICATION:MEMOROS:v1` } })
  add('PHR_INTENT', { provider: 'PHR', snapshotHash: seal.fingerprint })
  add('PHR_ACK', { publication: { result: { status: 'PUBLISHED', taskId: source.taskId, publicationId: buildNamespacedPublicationId('SG2', source.taskId), commitSha: 'fixture' } } })
  add('CLOSEOUT_COMPLETE', { closeoutState: 'CLOSEOUT_COMPLETE', pending: 'CLEAR', recoveryRequired: false })
  const rows = events.map(event => ({ id: `${source.conversationId}:SG2_LIFECYCLE:v1:${event.step}`, taskId: source.taskId, conversationId: source.conversationId, artifactKind: 'EXECUTION_TRAIL', artifactNature: 'DERIVED', version: SG2_LIFECYCLE_VERSION, status: 'GENERATED', sourceRefs: seal, payload: event }))
  return { source, rows }
}

test('rendered SG2 completed chain shows separate current/snapshot states and bounded integrity', () => {
  const f = fixture(); const model = buildSg2LifecycleReadModel(f.source, f.rows)!
  const html = renderToStaticMarkup(<Sg2LifecycleStatus model={model} />)
  assert.match(html, /Immutable FlightRecord — state at persistence/)
  assert.match(html, /PMOS_SAVE_SUCCEEDED/); assert.match(html, /Current lifecycle/); assert.match(html, /CLOSEOUT_COMPLETE/)
  assert.match(html, /MEMOROS publication.*DELIVERED/); assert.match(html, /consumer readiness.*NOT_VERIFIED/)
  assert.match(html, /POSTGRESQL_EVIDENCE_ONLY/); assert.match(html, /files were not inspected/)
  assert.match(html, /PHR publication.*PUBLISHED/)
})

test('rendered incomplete or invalid evidence does not claim completed lifecycle', () => {
  const f = fixture()
  const incomplete = renderToStaticMarkup(<Sg2LifecycleStatus model={buildSg2LifecycleReadModel(f.source, f.rows.slice(0, 2))!} />)
  assert.match(incomplete, /PARTIAL/); assert.doesNotMatch(incomplete, /CLOSEOUT_COMPLETE/)
  f.rows[6].payload.eventHash = 'corrupt'
  const invalid = renderToStaticMarkup(<Sg2LifecycleStatus model={buildSg2LifecycleReadModel(f.source, f.rows)!} />)
  assert.match(invalid, /NOT_VERIFIED/); assert.match(invalid, /Evidence integrity.*FAIL/); assert.doesNotMatch(invalid, /CLOSEOUT_COMPLETE/)
})

test('historical Stage1 UI preserves integrity/authorization FAIL and labels snapshot-only provenance', () => {
  const f = fixture(); f.source.taskId = f.source.flightRecordJson.metadata.taskId = 'SG2-RELEASE-HARDENING-STAGE1-20261008'
  f.source.flightRecordJson.completionEvidence.closeoutState = 'CLOSEOUT_COMPLETE'
  const html = renderToStaticMarkup(<Sg2LifecycleStatus model={buildSg2LifecycleReadModel(f.source, [])!} />)
  assert.match(html, /Historical FlightRecord — recorded snapshot/); assert.match(html, /Historical snapshot-only read/)
  assert.match(html, /Stage 1 immutable integrity: FAIL/); assert.match(html, /recovery authorization: FAIL/)
  assert.match(html, /Verified current state.*NOT_VERIFIED/)
})
