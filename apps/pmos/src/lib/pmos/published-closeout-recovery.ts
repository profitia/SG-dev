import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { CloseoutState, ExecutionTrailStatus, type CloseoutEvidence, type FlightRecordV1, type GptHandoffArtifactV1 } from '../../../../../packages/governance/src'
import { atomicWriteJsonFile } from './atomic-io'
import { acquirePmosLock } from './advisory-lock'

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T
export function sameRecoverySource(left: FlightRecordV1, right: FlightRecordV1): boolean {
  const { completionEvidence: _left, ...a } = left
  const { completionEvidence: _right, ...b } = right
  return isDeepStrictEqual(a, b)
}
function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`PHR verification failed: git ${args[0]}: ${result.stderr.trim()}`)
  return result.stdout
}

function recoveryArtifactBase(artifact: FlightRecordV1): string {
  const metadata = artifact.metadata
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(metadata.timestamp))
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}-${part('hour')}:${part('minute')}_${metadata.taskId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export type PublishedProof = {
  publicationId: string; taskId: string; projectId: string; conversationId: string
  commitSha: string; bundlePath: string; manifestPath: string; bundleHash: string
  sourceSha256: string; verifiedAt: string; artifact: FlightRecordV1
  closeout: CloseoutEvidence; files: Map<string, string>
}

/** Read-only. No publisher call, checkout, commit, push or rewrite is possible here. */
export async function verifyPublishedCloseout(params: {
  repositoryPath: string; commitSha: string; bundlePath: string
  projectKey: string; taskId: string; conversationId: string; source: FlightRecordV1
}): Promise<PublishedProof> {
  if (!/^[a-f0-9]{40}$/.test(params.commitSha)) throw new Error('An exact PHR commit is required.')
  if (!/^history\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]+$/.test(params.bundlePath)) throw new Error('Invalid PHR bundle path.')
  const root = fs.realpathSync(params.repositoryPath)
  const origin = git(root, ['remote', 'get-url', 'origin']).trim()
  // Local test remotes are selected through their own Git checkout, never a production CLI override.
  if (!/profitia[\/]project-history-repository(?:\.git)?$/.test(origin)) throw new Error('Wrong PHR repository authority.')
  if (git(root, ['status', '--porcelain']).trim()) throw new Error('PHR checkout must be clean for verification.')
  git(root, ['fetch', '--quiet', 'origin', 'main'])
  git(root, ['merge-base', '--is-ancestor', params.commitSha, 'origin/main'])
  const introducingCommit = git(root, ['log', '-1', '--format=%H', '--diff-filter=A', params.commitSha, '--', `${params.bundlePath}/manifest.json`]).trim()
  if (introducingCommit !== params.commitSha) throw new Error('The supplied commit is not the original bundle publication commit.')
  const names = git(root, ['ls-tree', '-r', '--name-only', params.commitSha, '--', params.bundlePath]).trim().split('\n')
  const expected = ['closeout-evidence.json', 'conversation-artifact.json', 'flight-record.json', 'handoff.md', 'integrity.json', 'manifest.json']
  if (!isDeepStrictEqual(names.map(n => n.slice(params.bundlePath.length + 1)).sort(), expected)) throw new Error('Unexpected PHR artifact set.')
  const files = new Map<string, string>()
  for (const name of expected) {
    const relative = `${params.bundlePath}/${name}`
    const mode = git(root, ['ls-tree', params.commitSha, '--', relative]).split(' ')[0]
    if (mode !== '100644') throw new Error('PHR artifacts must be ordinary files.')
    const original = git(root, ['show', `${params.commitSha}:${relative}`])
    if (original !== git(root, ['show', `origin/main:${relative}`]) || original !== fs.readFileSync(path.join(root, relative), 'utf8')) throw new Error('Published PHR bytes changed or checkout is stale.')
    files.set(name, original)
  }
  // Use the PHR authority's existing validator; never introduce another bundle format.
  const core = await import(pathToFileURL(path.join(root, 'scripts/phr-core.mjs')).href)
  const validation = core.validateBundleDirectory(path.join(root, params.bundlePath)) as { issues: string[] }
  if (validation.issues.length) throw new Error(`Invalid published bundle: ${validation.issues.join('; ')}`)
  const manifest = JSON.parse(files.get('manifest.json')!)
  const publicationId = `${params.projectKey}:${params.taskId}`
  if (manifest.publicationId !== publicationId || manifest.projectId !== params.projectKey || manifest.taskId !== params.taskId || manifest.sourceSystem !== 'PMOS' || manifest.closeoutState !== 'CLOSEOUT_COMPLETE') throw new Error('Published identity or finalization candidate mismatch.')
  const artifact = JSON.parse(files.get('conversation-artifact.json')!) as FlightRecordV1
  if (files.get('conversation-artifact.json') !== files.get('flight-record.json')) throw new Error('Published source artifacts disagree.')
  if (artifact.metadata.taskId !== params.taskId || artifact.metadata.conversationId !== params.conversationId || !sameRecoverySource(artifact, params.source)) throw new Error('Published source does not match the original registered artifact.')
  const closeout = JSON.parse(files.get('closeout-evidence.json')!) as CloseoutEvidence
  if (closeout.closeoutState !== 'CLOSEOUT_COMPLETE' || closeout.pmosSaveStatus !== 'SUCCEEDED' || closeout.runtimeContextRefreshStatus !== 'SUCCEEDED' || closeout.handoffPublicationStatus !== 'SUCCEEDED' || closeout.recoveryRequired || closeout.archiveCompletenessStatus !== 'PASS' || closeout.runtimeContextIntegrityStatus !== 'PASS') throw new Error('Published closeout candidate is incomplete.')
  const handoff = files.get('handoff.md')!
  for (const line of [`Artifact ID: ${params.conversationId}:HANDOFF:v1`, `Conversation ID: ${params.conversationId}`, `Task ID: ${params.taskId}`]) if (!handoff.split('\n').includes(line)) throw new Error('Published HANDOFF identity mismatch.')
  if (manifest.createdAt !== artifact.metadata.timestamp || manifest.result !== artifact.result.finalStatus || manifest.publishedAt !== closeout.closeoutCompletedAt || path.resolve(core.bundleDirForInput(root, manifest)) !== path.resolve(root, params.bundlePath)) throw new Error('Published timestamp/result/path lineage mismatch.')
  const descriptorTypes = manifest.artifacts.map((a: { type: string }) => a.type).sort()
  if (!isDeepStrictEqual(descriptorTypes, ['closeout-evidence.json','conversation-artifact.json','flight-record.json','handoff.json','handoff.md','integrity.json'])) throw new Error('Published manifest descriptor set mismatch.')
  for (const a of manifest.artifacts) {
    const absent = a.type === 'handoff.json'
    if (a.status !== (absent ? 'ABSENT' : 'PRESENT') || a.path !== (absent ? null : a.type)) throw new Error('Invalid published artifact descriptor.')
    if (a.type === 'handoff.md' && a.sourceId !== `${params.conversationId}:HANDOFF:v1`) throw new Error('Published HANDOFF lineage mismatch.')
  }
  const descriptor = manifest.artifacts.find((a: { type: string }) => a.type === 'conversation-artifact.json')
  const base = recoveryArtifactBase(artifact)
  const sourceRef = `apps/pmos/.pmos/conversations/${base}.json`
  if (descriptor?.sourceId !== sourceRef || manifest.artifacts.find((a: { type: string }) => a.type === 'flight-record.json')?.sourceId !== sourceRef || manifest.artifacts.find((a: { type: string }) => a.type === 'closeout-evidence.json')?.sourceId !== `apps/pmos/.pmos/recovery/closeouts/${base}.closeout.json`) throw new Error('Published source lineage mismatch.')
  return { publicationId, projectId: params.projectKey, taskId: params.taskId, conversationId: params.conversationId, commitSha: params.commitSha, bundlePath: params.bundlePath, manifestPath: `${params.bundlePath}/manifest.json`, bundleHash: JSON.parse(files.get('integrity.json')!).bundleHash, sourceSha256: digest(files.get('conversation-artifact.json')!), verifiedAt: new Date().toISOString(), artifact, closeout, files }
}

export type RecoverySnapshot = { registrationStatus: string; artifact: FlightRecordV1; handoff: GptHandoffArtifactV1 | null }
export type RecoveryOperations = {
  load(): Promise<RecoverySnapshot>
  assertIdentity(snapshot: RecoverySnapshot): Promise<void>
  verifyOriginalArchive(artifact: FlightRecordV1): void
  buildHandoff(artifact: FlightRecordV1, closeout: CloseoutEvidence, pending: 'OCCUPIED' | 'CLEAR'): GptHandoffArtifactV1
  acknowledge(proof: PublishedProof, base: string): void
  persist(artifact: FlightRecordV1, closeout: CloseoutEvidence, handoff: GptHandoffArtifactV1): Promise<void>
  writeArchive(artifact: FlightRecordV1, closeout: CloseoutEvidence, handoff: GptHandoffArtifactV1, base: string): void
  refreshRuntime(): Promise<void>
  runtimeValid(): boolean
  completeRegistration(): Promise<void>
  appendCompleted(base: string): void
  trailComplete(base: string): boolean
  checkpoint?(phase: string): Promise<void>
}

/** Additional mode of canonical PMOS closeout. It resumes only verified, already-published work. */
export async function resumePublishedCloseout(params: {
  stateRoot: string; repositoryPath: string; commitSha: string; bundlePath: string
  projectKey: string; taskId: string; operations: RecoveryOperations
}) {
  const ops = params.operations
  const first = await ops.load()
  const release = acquirePmosLock(path.join(params.stateRoot, '.pmos/.pmos-save.lock'), first.artifact.metadata.conversationId)
  try {
    const state = await ops.load()
    await ops.assertIdentity(state)
    if (!['running', 'queued', 'completed'].includes(state.registrationStatus)) throw new Error('Original registration cannot be recovered in its current state.')
    const metadata = state.artifact.metadata
    const base = recoveryArtifactBase(state.artifact)
    const pendingPath = path.join(params.stateRoot, '.pmos/pending-artifact.json')
    const pendingRaw = fs.existsSync(pendingPath) ? fs.readFileSync(pendingPath, 'utf8') : null
    if (pendingRaw !== null) {
      const pending = JSON.parse(pendingRaw) as FlightRecordV1
      if (pending.metadata.taskId !== params.taskId || pending.metadata.conversationId !== metadata.conversationId || !sameRecoverySource(pending, state.artifact)) throw new Error('Foreign or changed pending artifact; nothing may be cleared.')
    }
    ops.verifyOriginalArchive(state.artifact)
    const proof = await verifyPublishedCloseout({ ...params, conversationId: metadata.conversationId, source: state.artifact })
    const closeoutPath = path.join(params.stateRoot, `.pmos/recovery/closeouts/${base}.closeout.json`)
    const local = read<CloseoutEvidence>(closeoutPath)
    const activePath = path.join(params.stateRoot, '.pmos/recovery/active-closeout.json')
    if (fs.existsSync(activePath)) {
      const active = read<{ taskId: string; conversationId: string }>(activePath)
      if (active.taskId !== params.taskId || active.conversationId !== metadata.conversationId) throw new Error('Another task owns the active closeout.')
    }
    ops.acknowledge(proof, base)
    const finalEvidence: CloseoutEvidence = { ...local, closeoutState: CloseoutState.CLOSEOUT_COMPLETE, pmosSaveStatus: 'SUCCEEDED', pmosSaveError: null, runtimeContextRefreshStatus: 'SUCCEEDED', runtimeContextRefreshError: null, runtimeContextIntegrityStatus: 'PASS', handoffPublicationStatus: 'SUCCEEDED', handoffPublicationError: null, closeoutCompletedAt: local.closeoutCompletedAt ?? proof.verifiedAt, handoffPublicationCompletedAt: local.handoffPublicationStatus === 'SUCCEEDED' ? local.handoffPublicationCompletedAt : proof.verifiedAt, recoveryRequired: false, recoveryReason: null, manualRecoveryInstructions: ['Existing PHR publication independently verified; canonical PMOS finalization resumed without publication.'], stateHistory: [...new Set([...(local.stateHistory ?? []), CloseoutState.HANDOFF_PUBLICATION_SUCCEEDED, CloseoutState.CLOSEOUT_COMPLETE])] }
    const artifact = structuredClone(proof.artifact)
    artifact.completionEvidence = { closeoutState: CloseoutState.CLOSEOUT_COMPLETE, pmosSaveStatus: 'SUCCEEDED', runtimeContextRefreshStatus: 'SUCCEEDED', handoffPublicationStatus: 'SUCCEEDED', archiveCompletenessStatus: 'PASS', executionTrailStatus: ExecutionTrailStatus.PRESENT }
    const finalHandoff = ops.buildHandoff(artifact, finalEvidence, 'CLEAR')
    if (state.registrationStatus === 'completed' && pendingRaw === null && local.closeoutState === 'CLOSEOUT_COMPLETE' && !local.recoveryRequired && isDeepStrictEqual(state.artifact, artifact) && isDeepStrictEqual(state.handoff, finalHandoff) && ops.runtimeValid() && ops.trailComplete(base) && !fs.existsSync(activePath)) return { status: 'ALREADY_COMPLETE', proof, base }
    // Preserve the original failure evidence once, within the existing recovery archive.
    const preserved = path.join(params.stateRoot, `.pmos/recovery/closeouts/${base}.before-published-recovery.json`)
    if (!fs.existsSync(preserved)) fs.copyFileSync(closeoutPath, preserved, fs.constants.COPYFILE_EXCL)
    await ops.checkpoint?.('ACK_VERIFIED')
    const occupied = ops.buildHandoff(artifact, finalEvidence, pendingRaw === null ? 'CLEAR' : 'OCCUPIED')
    if (!isDeepStrictEqual(state.artifact, artifact) || !isDeepStrictEqual(state.handoff, occupied)) await ops.persist(artifact, finalEvidence, occupied)
    await ops.checkpoint?.('POSTGRES_FINALIZED')
    // Rebuild from actual PMOS authority, never from the historical candidate.
    if (local.closeoutState !== 'CLOSEOUT_COMPLETE' || !ops.runtimeValid()) {
      finalEvidence.runtimeContextRefreshStartedAt = new Date().toISOString()
      await ops.refreshRuntime()
      finalEvidence.runtimeContextRefreshCompletedAt = new Date().toISOString()
    }
    if (!ops.runtimeValid()) throw new Error('Runtime context integrity did not pass.')
    ops.writeArchive(artifact, finalEvidence, occupied, base)
    atomicWriteJsonFile(closeoutPath, finalEvidence, { label: `published-recovery:${params.taskId}` })
    if (pendingRaw !== null) {
      if (!fs.existsSync(pendingPath) || fs.readFileSync(pendingPath, 'utf8') !== pendingRaw) throw new Error('Pending changed during recovery; refusing to clear it.')
      fs.unlinkSync(pendingPath)
    }
    await ops.checkpoint?.('PENDING_CLEARED')
    await ops.persist(artifact, finalEvidence, finalHandoff)
    // Reconcile the final CLEAR summary with actual PMOS runtime authority.
    // The canonical context writer preserves bytes when its state hash agrees.
    await ops.refreshRuntime()
    if (!ops.runtimeValid()) throw new Error('Final runtime context integrity did not pass.')
    ops.writeArchive(artifact, finalEvidence, finalHandoff, base)
    await ops.completeRegistration()
    await ops.checkpoint?.('REGISTRATION_COMPLETED')
    ops.appendCompleted(base)
    if (fs.existsSync(activePath)) fs.unlinkSync(activePath)
    const verified = await ops.load()
    if (verified.registrationStatus !== 'completed' || !isDeepStrictEqual(verified.artifact, artifact) || !isDeepStrictEqual(verified.handoff, finalHandoff) || fs.existsSync(pendingPath) || !ops.runtimeValid() || !ops.trailComplete(base)) throw new Error('Published recovery postconditions failed.')
    return { status: 'RECOVERED', proof, base }
  } finally { release() }
}
