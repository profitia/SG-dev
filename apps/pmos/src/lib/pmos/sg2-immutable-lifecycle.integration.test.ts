import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PrismaClient, type Prisma } from '@prisma/client'
import { hashObject, createArtifactLock, createObjectIntegrityMetadata, type FlightRecordV1 } from '../../../../../packages/governance/src'
import { buildNamespacedPublicationId, requireCanonicalMemorosProjectId, resolvePmosProjectProfile } from './project-profile'
import { createRequire } from 'node:module'
// CLI scripts are deliberately excluded from the Next app compilation. The test
// runner loads the canonical writer rather than defining another persistence path.
const { createInitialConversationArtifact } = createRequire(import.meta.url)('../../../scripts/pmos-save.ts') as {
  createInitialConversationArtifact: (client: PrismaClient, data: Prisma.ConversationArtifactCreateInput) => Promise<{ id: string }>
}
import { Sg2ImmutableLifecycle } from './sg2-immutable-lifecycle'
import os from 'node:os'
import path from 'node:path'

function fixture(project = 'SpendGuru 2.0') {
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

const url = process.env.SG2_IMMUTABLE_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/sg2_immutable_test') {
    throw new Error('Integration writes require the isolated local sg2_immutable_test database.')
  }
}

test('PostgreSQL: persistence, crash, retry, publication ownership and exact sealed preservation', { skip: !url }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  const f = fixture()
  f.snapshot.metadata.conversationId = `isolated:${randomUUID()}`
  // Establish the independent baseline once, before any lifecycle event.
  fs.writeFileSync(f.paths.jsonPath, JSON.stringify(f.snapshot))
  fs.writeFileSync(f.paths.integrityPath, JSON.stringify(createObjectIntegrityMetadata(f.snapshot, { generatedBy: 'isolated-test', sourceRuntime: 'PMOS', sourceProjection: 'isolated-fixture' })))
  fs.writeFileSync(f.paths.lockPath, JSON.stringify(createArtifactLock(f.snapshot)))
  const beforeBytes = Object.values(f.paths).map(p => fs.readFileSync(p))
  const beforeHash = hashObject(f.snapshot)
  let baseId = ''
  const receipt = () => ({ ack: { projectId: requireCanonicalMemorosProjectId(resolvePmosProjectProfile({ projectName: 'SG2' })), threadId: 'isolated-thread', sourceRecordId: 'isolated-source', sourceTable: 'conversation_artifacts', sourceRecordExternalId: `conversation_artifacts:${baseId}` }, publicationArtifact: { id: `${f.snapshot.metadata.conversationId}:PUBLICATION:MEMOROS:v1` } })
  try {
    const row = await createInitialConversationArtifact(prisma, {
      conversationId: f.snapshot.metadata.conversationId, taskId: f.snapshot.metadata.taskId,
      project: 'SpendGuru 2.0', timestamp: new Date(f.snapshot.metadata.timestamp),
      domains: [], tags: [], userPrompt: 'isolated test', llmResponse: 'isolated', summary: 'isolated',
      flightRecordJson: f.snapshot as never,
    })
    baseId = row.id
    const lifecycle = new Sg2ImmutableLifecycle(prisma, f.snapshot, f.paths)
    // Simulate a crash immediately after DB persistence, then resume from the same base.
    const resumed = new Sg2ImmutableLifecycle(prisma, f.snapshot, f.paths)
    assert.equal((await resumed.events()).length, 0)
    const save = { status: 'SUCCEEDED', conversationArtifactId: baseId }
    await Promise.all([lifecycle.append('PMOS_SAVE', save), resumed.append('PMOS_SAVE', save)])
    assert.equal((await resumed.events()).length, 1)
    await assert.rejects(() => resumed.append('PMOS_SAVE', { ...save, conversationArtifactId: 'wrong' }), /another persisted row/)
    await assert.rejects(() => resumed.append('CLOSEOUT_COMPLETE', { closeoutState: 'CLOSEOUT_COMPLETE', pending: 'CLEAR', recoveryRequired: false }))
    await resumed.append('RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'PASS' })
    let publications = 0
    const action = async () => { publications++; return receipt() }
    const results = await Promise.allSettled([lifecycle.publishOnce('MEMOROS', action, () => true), resumed.publishOnce('MEMOROS', action, () => true)])
    assert.equal(results.filter(r => r.status === 'fulfilled').length >= 1, true)
    assert.equal(publications, 1)
    const ack = await resumed.publishOnce('MEMOROS', action, () => true)
    assert.deepEqual(ack, receipt())
    assert.equal(publications, 1)
    let phr = 0
    await resumed.publishOnce('PHR', async () => { phr++; return { publication: { result: { status: 'PUBLISHED', taskId: f.snapshot.metadata.taskId, publicationId: buildNamespacedPublicationId('SG2', f.snapshot.metadata.taskId), commitSha: 'isolated-commit' } } } }, () => true)
    await lifecycle.publishOnce('PHR', async () => { throw new Error('Duplicate PHR called') }, () => true)
    assert.equal(phr, 1)
    await resumed.append('CLOSEOUT_COMPLETE', { closeoutState: 'CLOSEOUT_COMPLETE', pending: 'CLEAR', recoveryRequired: false })
    const final = await prisma.conversationArtifact.findUniqueOrThrow({ where: { conversationId: f.snapshot.metadata.conversationId } })
    assert.deepEqual(final.flightRecordJson, f.snapshot)
    assert.equal(hashObject(final.flightRecordJson), beforeHash)
    Object.values(f.paths).forEach((p, i) => assert.deepEqual(fs.readFileSync(p), beforeBytes[i]))
    assert.deepEqual((await resumed.events()).map(e => e.step), ['PMOS_SAVE', 'RUNTIME_VERIFIED', 'MEMOROS_INTENT', 'MEMOROS_ACK', 'PHR_INTENT', 'PHR_ACK', 'CLOSEOUT_COMPLETE'])
    await assert.rejects(() => resumed.append('RECOVERY_REQUIRED', { status: 'RECOVERY_REQUIRED' }))
    // A changed DB base cannot be legitimized by generating fresh sidecars.
    const foreign = structuredClone(f.snapshot)
    foreign.task.originalTaskRequest = 'foreign incoming snapshot'
    fs.writeFileSync(f.paths.jsonPath, JSON.stringify(foreign))
    fs.writeFileSync(f.paths.integrityPath, JSON.stringify(createObjectIntegrityMetadata(foreign, { generatedBy: 'isolated-test', sourceRuntime: 'PMOS', sourceProjection: 'test' })))
    fs.writeFileSync(f.paths.lockPath, JSON.stringify(createArtifactLock(foreign)))
    const foreignLifecycle = new Sg2ImmutableLifecycle(prisma, foreign, f.paths)
    await assert.rejects(() => foreignLifecycle.events(), /identity mismatch/)
  } finally {
    await prisma.conversationArtifact.deleteMany({ where: { conversationId: f.snapshot.metadata.conversationId } })
    await prisma.$disconnect(); f.cleanup()
  }
})

test('PostgreSQL: lost publication response blocks replay and retains recovery evidence', { skip: !url }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  const f = fixture()
  try {
    const row = await createInitialConversationArtifact(prisma, { conversationId: f.snapshot.metadata.conversationId, taskId: f.snapshot.metadata.taskId, project: 'SpendGuru 2.0', timestamp: new Date(), domains: [], tags: [], userPrompt: 'isolated', llmResponse: 'isolated', summary: 'isolated', flightRecordJson: f.snapshot as never })
    const l = new Sg2ImmutableLifecycle(prisma, f.snapshot, f.paths)
    await l.append('PMOS_SAVE', { status: 'SUCCEEDED', conversationArtifactId: row.id })
    await l.append('RUNTIME_VERIFIED', { status: 'SUCCEEDED', integrityStatus: 'PASS' })
    let calls = 0
    await assert.rejects(() => l.publishOnce('MEMOROS', async () => { calls++; throw new Error('lost response') }, () => true), /lost response/)
    await l.append('RECOVERY_REQUIRED', { status: 'RECOVERY_REQUIRED' })
    await assert.rejects(() => l.publishOnce('MEMOROS', async () => { calls++; return {} }, () => true), /outcome unknown/)
    assert.equal(calls, 1)
    assert.deepEqual((await l.events()).map(e => e.step), ['PMOS_SAVE', 'RUNTIME_VERIFIED', 'MEMOROS_INTENT', 'RECOVERY_REQUIRED'])
    l.verify()
  } finally { await prisma.conversationArtifact.deleteMany({ where: { conversationId: f.snapshot.metadata.conversationId } }); await prisma.$disconnect(); f.cleanup() }
})
