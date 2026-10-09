import fs from 'node:fs'
import type { PrismaClient, Prisma } from '@prisma/client'
import {
  hashObject, hashText, verifyArtifactLock, verifyObjectIntegrity,
  type FlightRecordV1, type ArtifactLockMetadata, type IntegrityMetadata,
} from '../../../../../packages/governance/src'
import { buildNamespacedPublicationId, requireCanonicalMemorosProjectId, resolvePmosProjectProfile } from './project-profile'

// SG2 only. This namespace never participates in SRM's existing finalizer.
export const SG2_LIFECYCLE_VERSION = 'sg2-immutable-lifecycle-v1'
export type LifecycleStep = 'PMOS_SAVE' | 'RUNTIME_VERIFIED' | 'MEMOROS_INTENT' | 'MEMOROS_ACK'
  | 'PHR_INTENT' | 'PHR_ACK' | 'CLOSEOUT_COMPLETE' | 'RECOVERY_REQUIRED'
export type SnapshotSeal = {
  taskId: string; conversationId: string; fingerprint: string
  jsonBytesHash: string; integrityBytesHash: string; lockBytesHash: string
}
export type SnapshotPaths = { jsonPath: string; integrityPath: string; lockPath: string }
export type LifecycleEvent = {
  schemaVersion: typeof SG2_LIFECYCLE_VERSION; projectKey: 'SG2'
  source: SnapshotSeal; sequence: number; previousHash: string | null
  step: LifecycleStep; receipt: unknown; eventHash: string
}
const required: Partial<Record<LifecycleStep, LifecycleStep[]>> = {
  RUNTIME_VERIFIED: ['PMOS_SAVE'], MEMOROS_INTENT: ['RUNTIME_VERIFIED'],
  MEMOROS_ACK: ['MEMOROS_INTENT'], PHR_INTENT: ['MEMOROS_ACK'], PHR_ACK: ['PHR_INTENT'],
  CLOSEOUT_COMPLETE: ['PMOS_SAVE', 'RUNTIME_VERIFIED', 'MEMOROS_ACK', 'PHR_ACK'],
}
const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const prefix = (source: SnapshotSeal) => `${source.conversationId}:SG2_LIFECYCLE:v1:`

function verifyReceipt(event: LifecycleEvent, events: LifecycleEvent[]): void {
  const receipt = event.receipt as Record<string, any> | null
  if (!receipt || typeof receipt !== 'object') throw new Error('SG2 lifecycle receipt missing.')
  const baseId = (events.find(e => e.step === 'PMOS_SAVE')?.receipt as Record<string, unknown>)?.conversationArtifactId
  const invalid = event.step === 'PMOS_SAVE' ? receipt.status !== 'SUCCEEDED' || !receipt.conversationArtifactId
    : event.step === 'RUNTIME_VERIFIED' ? receipt.status !== 'SUCCEEDED' || receipt.integrityStatus !== 'PASS'
    : event.step === 'MEMOROS_ACK' ? !receipt.ack?.sourceRecordId || !receipt.ack?.threadId
      || receipt.ack.projectId !== requireCanonicalMemorosProjectId(resolvePmosProjectProfile({ projectName: 'SG2' }))
      || receipt.ack.sourceTable !== 'conversation_artifacts'
      || receipt.ack.sourceRecordExternalId !== `conversation_artifacts:${baseId}`
      || receipt.publicationArtifact?.id !== `${event.source.conversationId}:PUBLICATION:MEMOROS:v1`
    : event.step === 'PHR_ACK' ? !['PUBLISHED', 'IDEMPOTENT'].includes(receipt.publication?.result?.status)
      || receipt.publication.result.taskId !== event.source.taskId || !receipt.publication.result.commitSha
      || receipt.publication.result.publicationId !== buildNamespacedPublicationId('SG2', event.source.taskId)
    : event.step === 'CLOSEOUT_COMPLETE' ? receipt.closeoutState !== 'CLOSEOUT_COMPLETE' || receipt.pending !== 'CLEAR' || receipt.recoveryRequired !== false
    : event.step === 'RECOVERY_REQUIRED' ? receipt.status !== 'RECOVERY_REQUIRED'
    : receipt.provider !== event.step.replace('_INTENT', '') || receipt.snapshotHash !== event.source.fingerprint
  if (invalid) throw new Error(`SG2 ${event.step} receipt does not prove the expected lifecycle identity/status.`)
}

export function readSnapshotSeal(snapshot: FlightRecordV1, paths: SnapshotPaths): SnapshotSeal {
  if (snapshot.metadata.project !== 'SpendGuru 2.0') throw new Error('SG2 lifecycle refuses a foreign project.')
  const json = fs.readFileSync(paths.jsonPath, 'utf8')
  const integrity = fs.readFileSync(paths.integrityPath, 'utf8')
  const lock = fs.readFileSync(paths.lockPath, 'utf8')
  const integrityMetadata = JSON.parse(integrity) as IntegrityMetadata
  const lockMetadata = JSON.parse(lock) as ArtifactLockMetadata
  if (hashObject(JSON.parse(json)) !== hashObject(snapshot)
    || !verifyObjectIntegrity(snapshot, integrityMetadata).valid
    || !verifyArtifactLock(snapshot, lockMetadata).valid || lockMetadata.immutable !== true
    || !Number.isFinite(Date.parse(lockMetadata.immutableSince))
    || !Number.isFinite(Date.parse(integrityMetadata.generatedAt))) {
    throw new Error('SG2 immutable snapshot JSON/hash/lock verification failed.')
  }
  return {
    taskId: snapshot.metadata.taskId, conversationId: snapshot.metadata.conversationId,
    fingerprint: hashObject(snapshot), jsonBytesHash: hashText(json),
    integrityBytesHash: hashText(integrity), lockBytesHash: hashText(lock),
  }
}

export function assertSnapshotPreserved(snapshot: FlightRecordV1, paths: SnapshotPaths, seal: SnapshotSeal): void {
  if (hashObject(readSnapshotSeal(snapshot, paths)) !== hashObject(seal)) {
    throw new Error('SG2 persisted snapshot or immutable sidecar bytes changed.')
  }
}

export function validateLifecycle(events: LifecycleEvent[], source: SnapshotSeal): void {
  const seen = new Set<LifecycleStep>()
  let previousHash: string | null = null
  for (const [index, event] of events.entries()) {
    const { eventHash, ...body } = event
    if (event.schemaVersion !== SG2_LIFECYCLE_VERSION || event.projectKey !== 'SG2'
      || hashObject(event.source) !== hashObject(source)
      || event.sequence !== index + 1 || event.previousHash !== previousHash
      || hashObject(body) !== eventHash || seen.has(event.step)
      || !['PMOS_SAVE', 'RUNTIME_VERIFIED', 'MEMOROS_INTENT', 'MEMOROS_ACK', 'PHR_INTENT', 'PHR_ACK', 'CLOSEOUT_COMPLETE', 'RECOVERY_REQUIRED'].includes(event.step)
      || (index === 0 && event.step !== 'PMOS_SAVE')
      || (required[event.step] ?? []).some(step => !seen.has(step))
      || seen.has('CLOSEOUT_COMPLETE')) {
      throw new Error('SG2 append-only lifecycle identity, ordering or integrity violation.')
    }
    seen.add(event.step)
    verifyReceipt(event, events)
    previousHash = eventHash
  }
}

export function nextLifecycleEvent(events: LifecycleEvent[], source: SnapshotSeal, step: LifecycleStep, receipt: unknown): LifecycleEvent {
  validateLifecycle(events, source)
  const body = {
    schemaVersion: SG2_LIFECYCLE_VERSION as typeof SG2_LIFECYCLE_VERSION, projectKey: 'SG2' as const, source,
    sequence: events.length + 1, previousHash: events.at(-1)?.eventHash ?? null,
    step, receipt: jsonClone(receipt),
  }
  const event = { ...body, eventHash: hashObject(body) }
  validateLifecycle([...events, event], source)
  return event
}

export function finalPersistenceForProfile<T extends { flightRecordJson?: unknown }>(projectKey: string, projection: T): T {
  if (projectKey !== 'SG2') return projection // SRM unchanged, including its completion snapshot.
  const { flightRecordJson: _immutable, ...derived } = projection
  return derived as T
}

export class Sg2ImmutableLifecycle {
  readonly snapshot: FlightRecordV1
  readonly seal: SnapshotSeal
  constructor(private readonly prisma: PrismaClient, snapshot: FlightRecordV1, private readonly paths: SnapshotPaths) {
    this.snapshot = jsonClone(snapshot)
    this.seal = readSnapshotSeal(this.snapshot, paths)
  }
  verify(): void { assertSnapshotPreserved(this.snapshot, this.paths, this.seal) }

  private async transaction<T>(action: (tx: Prisma.TransactionClient, events: LifecycleEvent[], baseId: string) => Promise<T>): Promise<T> {
    this.verify()
    return this.prisma.$transaction(async tx => {
      // Serializes all writers to this task across worktrees/processes, not only file locks.
      await tx.$queryRaw`SELECT conversation_id FROM conversation_artifacts WHERE conversation_id = ${this.seal.conversationId} FOR UPDATE`
      const record = await tx.conversationArtifact.findUnique({ where: { conversationId: this.seal.conversationId }, select: { id: true, taskId: true, project: true, flightRecordJson: true } })
      if (!record || record.taskId !== this.seal.taskId || record.project !== 'SpendGuru 2.0'
        || hashObject(record.flightRecordJson) !== this.seal.fingerprint) throw new Error('SG2 persisted base snapshot identity mismatch.')
      const rows = await tx.artifact.findMany({ where: { conversationId: this.seal.conversationId, id: { startsWith: prefix(this.seal) } } })
      const events = rows.map(row => row.payload as unknown as LifecycleEvent).sort((a, b) => a.sequence - b.sequence)
      validateLifecycle(events, this.seal)
      if (events.length && (events[0].receipt as Record<string, unknown>).conversationArtifactId !== record.id) throw new Error('SG2 PMOS receipt points to another persisted row.')
      for (const row of rows) {
        const event = row.payload as unknown as LifecycleEvent
        if (row.id !== `${prefix(this.seal)}${event.step}` || row.taskId !== this.seal.taskId
          || row.artifactKind !== 'EXECUTION_TRAIL' || row.version !== SG2_LIFECYCLE_VERSION
          || hashObject(row.sourceRefs) !== hashObject(this.seal)) throw new Error('SG2 lifecycle envelope mismatch.')
      }
      return action(tx, events, record.id)
    })
  }
  async events(): Promise<LifecycleEvent[]> { return this.transaction(async (_tx, events) => events) }

  async append(step: LifecycleStep, receipt: unknown): Promise<{ event: LifecycleEvent; inserted: boolean }> {
    return this.transaction(async (tx, events, baseId) => {
      if (step === 'PMOS_SAVE' && (receipt as Record<string, unknown>)?.conversationArtifactId !== baseId) throw new Error('SG2 PMOS receipt points to another persisted row.')
      const existing = events.find(event => event.step === step)
      if (existing) {
        if (hashObject(existing.receipt) !== hashObject(jsonClone(receipt))) throw new Error('SG2 lifecycle replay changes existing evidence.')
        return { event: existing, inserted: false }
      }
      const event = nextLifecycleEvent(events, this.seal, step, receipt)
      await tx.artifact.create({ data: {
        id: `${prefix(this.seal)}${step}`, artifactKind: 'EXECUTION_TRAIL', artifactNature: 'DERIVED',
        version: SG2_LIFECYCLE_VERSION, status: 'GENERATED', taskId: this.seal.taskId,
        conversationId: this.seal.conversationId, sourceRefs: this.seal as unknown as Prisma.InputJsonValue,
        payload: event as unknown as Prisma.InputJsonValue,
      } }) // Deliberately no upsert/update/delete.
      return { event, inserted: true }
    })
  }

  async publishOnce<T>(provider: 'MEMOROS' | 'PHR', publish: () => Promise<T>, successful: (result: T) => boolean): Promise<T> {
    const ack = (await this.events()).find(event => event.step === `${provider}_ACK`)
    if (ack) return jsonClone(ack.receipt) as T
    const intent = await this.append(`${provider}_INTENT`, { provider, snapshotHash: this.seal.fingerprint })
    if (!intent.inserted) throw new Error(`${provider} outcome unknown: reconcile existing intent read-only; automatic republication forbidden.`)
    const result = await publish()
    if (!successful(result)) throw new Error(`${provider} returned no verified success; retain intent for reconciliation.`)
    await this.append(`${provider}_ACK`, result)
    return result
  }
}
