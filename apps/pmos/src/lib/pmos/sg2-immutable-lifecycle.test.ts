import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createArtifactLock, createObjectIntegrityMetadata, hashObject, type FlightRecordV1 } from '../../../../../packages/governance/src'
import { assertSnapshotPreserved, finalPersistenceForProfile, nextLifecycleEvent, readSnapshotSeal, validateLifecycle } from './sg2-immutable-lifecycle'

export function fixture(project = 'SpendGuru 2.0') {
  const snapshot = {
    metadata: { project, taskId: 'SG2-ISOLATED-TEST', conversationId: 'isolated:test', timestamp: '2026-10-09T12:00:00.000Z' },
    task: { originalTaskRequest: 'Isolated immutable persistence test' },
    analysis: { executionSummary: 'Immutable content', reasoningSummary: 'Independent test' },
    findings: { findings: [], blockers: [], residualRisks: [] }, decisions: { decisions: [] },
    actions: { validationsExecuted: [], artifactsCreated: [] }, result: { finalStatus: 'SUCCESS' },
    completionEvidence: { closeoutState: 'PMOS_SAVE_SUCCEEDED', pmosSaveStatus: 'SUCCEEDED', runtimeContextRefreshStatus: 'NOT_STARTED' },
  } as unknown as FlightRecordV1
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg2-immutable-fixture-'))
  const paths = { jsonPath: path.join(dir, 'flight.json'), integrityPath: path.join(dir, 'flight.integrity.json'), lockPath: path.join(dir, 'flight.lock.json') }
  fs.writeFileSync(paths.jsonPath, JSON.stringify(snapshot))
  fs.writeFileSync(paths.integrityPath, JSON.stringify(createObjectIntegrityMetadata(snapshot, { generatedBy: 'isolated-test', sourceRuntime: 'PMOS', sourceProjection: 'isolated-fixture' })))
  fs.writeFileSync(paths.lockPath, JSON.stringify(createArtifactLock(snapshot)))
  return { snapshot, dir, paths, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

test('original JSON, hash and lock bytes survive completion; new hashes cannot excuse mutation', () => {
  const f = fixture()
  try {
    const seal = readSnapshotSeal(f.snapshot, f.paths)
    assertSnapshotPreserved(f.snapshot, f.paths, seal)
    const changed = structuredClone(f.snapshot)
    changed.completionEvidence.closeoutState = 'CLOSEOUT_COMPLETE' as never
    fs.writeFileSync(f.paths.jsonPath, JSON.stringify(changed))
    fs.writeFileSync(f.paths.integrityPath, JSON.stringify(createObjectIntegrityMetadata(changed, { generatedBy: 'isolated-test', sourceRuntime: 'PMOS', sourceProjection: 'isolated-fixture' })))
    fs.writeFileSync(f.paths.lockPath, JSON.stringify(createArtifactLock(changed)))
    assert.throws(() => assertSnapshotPreserved(changed, f.paths, seal), /changed/)
    assert.notEqual(hashObject(changed), seal.fingerprint)
  } finally { f.cleanup() }
})

for (const target of ['jsonPath', 'integrityPath', 'lockPath'] as const) {
  test(`missing or corrupt ${target} fails closed`, () => {
    const f = fixture()
    try {
      const seal = readSnapshotSeal(f.snapshot, f.paths)
      fs.writeFileSync(f.paths[target], '{}')
      assert.throws(() => assertSnapshotPreserved(f.snapshot, f.paths, seal))
      fs.unlinkSync(f.paths[target])
      assert.throws(() => assertSnapshotPreserved(f.snapshot, f.paths, seal))
    } finally { f.cleanup() }
  })
}

test('foreign project cannot instantiate an SG2 seal', () => {
  const f = fixture('SRM')
  try { assert.throws(() => readSnapshotSeal(f.snapshot, f.paths), /foreign project/) } finally { f.cleanup() }
})

test('ordering, missing evidence, altered source and event hashes are rejected', () => {
  const f = fixture()
  try {
    const seal = readSnapshotSeal(f.snapshot, f.paths)
    const first = nextLifecycleEvent([], seal, 'PMOS_SAVE', { status: 'SUCCEEDED', conversationArtifactId: 'isolated-record' })
    const runtime = nextLifecycleEvent([first], seal, 'RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'PASS' })
    validateLifecycle([first, runtime], seal)
    assert.throws(() => nextLifecycleEvent([first], seal, 'CLOSEOUT_COMPLETE', { closeoutState: 'CLOSEOUT_COMPLETE', pending: 'CLEAR', recoveryRequired: false }))
    assert.throws(() => validateLifecycle([runtime, first], seal))
    assert.throws(() => validateLifecycle([{ ...first, receipt: { status: 'FORGED' } }], seal))
    assert.throws(() => validateLifecycle([first], { ...seal, taskId: 'WRONG-TASK' }))
    assert.throws(() => nextLifecycleEvent([first], seal, 'RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'FAIL' }))
  } finally { f.cleanup() }
})

test('SG2 final projection excludes JSON; SRM projection retains exactly the prior object', () => {
  const projection = { flightRecordJson: { completionEvidence: { closeoutState: 'CLOSEOUT_COMPLETE' } }, summary: 'derived' }
  assert.deepEqual(finalPersistenceForProfile('SG2', projection), { summary: 'derived' })
  assert.strictEqual(finalPersistenceForProfile('SRM', projection), projection)
  assert.strictEqual(finalPersistenceForProfile('CIC', projection), projection)
})


test('fresh event hashes do not authorize false or foreign publication receipts', () => {
  const f = fixture()
  try {
    const seal = readSnapshotSeal(f.snapshot, f.paths)
    const save = nextLifecycleEvent([], seal, 'PMOS_SAVE', { status: 'SUCCEEDED', conversationArtifactId: 'base-id' })
    const runtime = nextLifecycleEvent([save], seal, 'RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'PASS' })
    const intent = nextLifecycleEvent([save, runtime], seal, 'MEMOROS_INTENT', { provider: 'MEMOROS', snapshotHash: seal.fingerprint })
    assert.throws(() => nextLifecycleEvent([save, runtime, intent], seal, 'MEMOROS_ACK', { ack: { projectId: 'FOREIGN', threadId: 'thread', sourceRecordId: 'source', sourceTable: 'conversation_artifacts', sourceRecordExternalId: 'conversation_artifacts:base-id' }, publicationArtifact: { id: `${seal.conversationId}:PUBLICATION:MEMOROS:v1` } }), /receipt/)
    assert.throws(() => nextLifecycleEvent([save, runtime, intent], seal, 'MEMOROS_ACK', {}), /receipt/)
  } finally { f.cleanup() }
})
