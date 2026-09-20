#!/usr/bin/env tsx

import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { type CloseoutEvidence, verifyTextIntegrity } from '../../../packages/governance/src'

import { atomicWriteJsonFile, readJsonFileSafe } from '../src/lib/pmos/atomic-io'
import { buildCanonicalConversationReadModel, readCanonicalFlightRecord } from '../src/lib/pmos/flight-record-read'
import {
  buildRuntimeAuthorityIntegrity,
  readRuntimeAuthoritySnapshot,
  renderRuntimeAuthorityMarkdown,
} from '../src/lib/pmos/runtime-authority'
import { repairRuntimeContextArtifacts } from '../src/lib/pmos/runtime-context-write'
import { assertDatabaseUrl } from '../src/lib/pmos/operator-preflight'

type SupportedArea = 'archive' | 'runtime' | 'closeout' | 'integrity' | 'all'

type ParsedArgs = {
  requestedAreas: SupportedArea[]
}

type RepairRunRecord = {
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  requestedAreas: string[]
  baseName: string | null
  repairedArtifacts: string[]
  preservedArtifacts: string[]
  failures: string[]
  repairReason: string
  repairResult: 'PASS' | 'FAIL'
  repairCount: number
}

const prisma = new PrismaClient()

const SG_DEV_ROOT = path.resolve(__dirname, '../../..')
const PMOS_DIR = path.join(SG_DEV_ROOT, 'apps/pmos/.pmos')
const CONVERSATIONS_DIR = path.join(PMOS_DIR, 'conversations')
const LOGS_DIR = path.join(CONVERSATIONS_DIR, 'logs')
const RECOVERY_DIR = path.join(PMOS_DIR, 'recovery')
const CLOSEOUTS_DIR = path.join(RECOVERY_DIR, 'closeouts')
const FAILED_ARTIFACTS_DIR = path.join(RECOVERY_DIR, 'failed-artifacts')
const REPAIRS_DIR = path.join(RECOVERY_DIR, 'repairs')
const RUNTIME_RECOVERY_DIR = path.join(RECOVERY_DIR, 'runtime-context')
const PENDING_FILE = path.join(PMOS_DIR, 'pending-artifact.json')
const ACTIVE_CLOSEOUT_FILE = path.join(RECOVERY_DIR, 'active-closeout.json')
const CONTEXT_FILE = path.resolve(__dirname, '../.context/runtime-context.md')
const CONTEXT_INTEGRITY_FILE = path.resolve(__dirname, '../.context/runtime-context.integrity.json')

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function buildRepairTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function formatTimestampForFilename(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}:${get('minute')}`
}

function buildArtifactBaseName(artifact: PendingArtifact): string {
  const date = new Date(artifact.metadata.timestamp)
  const prefix = formatTimestampForFilename(date)
  const slug = artifact.metadata.taskId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${prefix}_${slug}`
}

type PendingArtifact = NonNullable<ReturnType<typeof readCanonicalFlightRecord>>

function relativize(filePath: string): string {
  return path.relative(SG_DEV_ROOT, filePath).replace(/\\/g, '/')
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  const requestedAreas: SupportedArea[] = []

  for (const arg of args) {
    if (arg === '--archive') requestedAreas.push('archive')
    else if (arg === '--runtime') requestedAreas.push('runtime')
    else if (arg === '--closeout') requestedAreas.push('closeout')
    else if (arg === '--integrity') requestedAreas.push('integrity')
    else if (arg === '--all') requestedAreas.push('all')
    else throw new Error(`Unsupported argument: ${arg}`)
  }

  if (requestedAreas.length === 0) {
    throw new Error('Expected one of --archive, --runtime, --closeout, --integrity, or --all')
  }

  return { requestedAreas }
}

function expandRequestedAreas(requestedAreas: SupportedArea[]): Array<'archive' | 'runtime' | 'closeout' | 'integrity'> {
  if (requestedAreas.includes('all')) {
    return ['archive', 'runtime', 'closeout', 'integrity']
  }

  return [...new Set(requestedAreas)] as Array<'archive' | 'runtime' | 'closeout' | 'integrity'>
}

function readPendingArtifactOrThrow(): PendingArtifact {
  const parsed = readJsonFileSafe<PendingArtifact>(PENDING_FILE)
  if (!parsed.value) {
    throw new Error(parsed.error ?? `Pending artifact not found: ${PENDING_FILE}`)
  }
  return parsed.value
}

function readCloseoutEvidenceOrThrow(closeoutPath: string): CloseoutEvidence {
  const parsed = readJsonFileSafe<CloseoutEvidence>(closeoutPath)
  if (!parsed.value) {
    throw new Error(parsed.error ?? `Closeout evidence unreadable: ${closeoutPath}`)
  }
  return parsed.value
}

function moveIfExists(sourcePath: string, targetPath: string, repairedArtifacts: string[], preservedArtifacts: string[]): void {
  if (!fs.existsSync(sourcePath)) {
    return
  }

  ensureDir(path.dirname(targetPath))
  fs.renameSync(sourcePath, targetPath)
  repairedArtifacts.push(relativize(sourcePath))
  preservedArtifacts.push(relativize(targetPath))
}

function resolveLatestCompletedBaseName(taskId: string, conversationId: string, excludedBaseName: string): string | null {
  const entries = fs.existsSync(CONVERSATIONS_DIR)
    ? fs.readdirSync(CONVERSATIONS_DIR).filter((entry) => entry.endsWith('.json') && !entry.endsWith('.integrity.json') && !entry.endsWith('.lock.json'))
    : []

  const matches = entries
    .map((entry) => entry.replace(/\.json$/, ''))
    .filter((baseName) => baseName !== excludedBaseName)
    .map((baseName) => {
      const artifactPath = path.join(CONVERSATIONS_DIR, `${baseName}.json`)
      const closeoutPath = path.join(CLOSEOUTS_DIR, `${baseName}.closeout.json`)
      const artifactRaw = readJsonFileSafe<unknown>(artifactPath).value
      const artifact = buildCanonicalConversationReadModel(artifactRaw)
      const closeout = fs.existsSync(closeoutPath) ? readJsonFileSafe<CloseoutEvidence>(closeoutPath).value : null
      return { baseName, artifact, closeout }
    })
    .filter(({ artifact, closeout }) => {
      return artifact.available
        && artifact.metadata.taskId === taskId
        && artifact.metadata.conversationId === conversationId
        && closeout?.closeoutState === 'CLOSEOUT_COMPLETE'
        && closeout?.pmosSaveStatus === 'SUCCEEDED'
        && closeout?.handoffPublicationStatus === 'SUCCEEDED'
        && closeout?.recoveryRequired === false
    })
    .sort((left, right) => {
      const leftTs = left.artifact.metadata.timestamp ?? ''
      const rightTs = right.artifact.metadata.timestamp ?? ''
      return rightTs.localeCompare(leftTs)
    })

  return matches[0]?.baseName ?? null
}

function repairDuplicateCloseoutResidue(repairedArtifacts: string[], preservedArtifacts: string[]): string | null {
  if (!fs.existsSync(PENDING_FILE)) {
    return null
  }

  const pending = readPendingArtifactOrThrow()
  const pendingBaseName = buildArtifactBaseName(pending)
  const pendingCloseoutPath = path.join(CLOSEOUTS_DIR, `${pendingBaseName}.closeout.json`)
  const pendingCloseout = readCloseoutEvidenceOrThrow(pendingCloseoutPath)

  if (!pendingCloseout.recoveryRequired) {
    throw new Error(`Pending artifact ${pendingBaseName} is not in a recovery-required closeout state.`)
  }

  const completedBaseName = resolveLatestCompletedBaseName(
    pending.metadata.taskId,
    pending.metadata.conversationId,
    pendingBaseName,
  )

  if (!completedBaseName) {
    throw new Error(`No completed closeout exists for ${pending.metadata.taskId}/${pending.metadata.conversationId}; refusing to clear pending residue.`)
  }

  const repairStamp = buildRepairTimestamp()
  const repairBundleDir = path.join(REPAIRS_DIR, `closeout-repair-${pendingBaseName}-${repairStamp}`)
  ensureDir(repairBundleDir)

  moveIfExists(PENDING_FILE, path.join(repairBundleDir, 'pending-artifact.json'), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(CONVERSATIONS_DIR, `${pendingBaseName}.md`), path.join(repairBundleDir, `${pendingBaseName}.md`), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(CONVERSATIONS_DIR, `${pendingBaseName}.json`), path.join(repairBundleDir, `${pendingBaseName}.json`), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(CONVERSATIONS_DIR, `${pendingBaseName}.integrity.json`), path.join(repairBundleDir, `${pendingBaseName}.integrity.json`), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(CONVERSATIONS_DIR, `${pendingBaseName}.lock.json`), path.join(repairBundleDir, `${pendingBaseName}.lock.json`), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(CLOSEOUTS_DIR, `${pendingBaseName}.closeout.json`), path.join(repairBundleDir, `${pendingBaseName}.closeout.json`), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(LOGS_DIR, `${pendingBaseName}.execution-trail.jsonl`), path.join(repairBundleDir, `${pendingBaseName}.execution-trail.jsonl`), repairedArtifacts, preservedArtifacts)
  moveIfExists(path.join(LOGS_DIR, `${pendingBaseName}.execution-trail.md`), path.join(repairBundleDir, `${pendingBaseName}.execution-trail.md`), repairedArtifacts, preservedArtifacts)

  if (fs.existsSync(ACTIVE_CLOSEOUT_FILE)) {
    moveIfExists(ACTIVE_CLOSEOUT_FILE, path.join(repairBundleDir, 'active-closeout.json'), repairedArtifacts, preservedArtifacts)
  }

  return pendingBaseName
}

async function rebuildRuntimeContext(repairedArtifacts: string[], preservedArtifacts: string[]): Promise<void> {
  assertDatabaseUrl('repair:runtime')
  ensureDir(RUNTIME_RECOVERY_DIR)

  const snapshot = await readRuntimeAuthoritySnapshot(prisma)
  const content = renderRuntimeAuthorityMarkdown(snapshot)
  const integrity = buildRuntimeAuthorityIntegrity(snapshot, content)
  const result = repairRuntimeContextArtifacts({
    contextFilePath: CONTEXT_FILE,
    integrityFilePath: CONTEXT_INTEGRITY_FILE,
    recoveryDir: RUNTIME_RECOVERY_DIR,
    content,
    integrity: integrity as unknown as Record<string, unknown>,
    label: `repair-${buildRepairTimestamp()}`,
  })

  if (!result.verificationPassed) {
    throw new Error('Runtime context verification failed after repair.')
  }

  const verification = verifyTextIntegrity(fs.readFileSync(CONTEXT_FILE, 'utf-8'), integrity)
  if (!verification.valid) {
    throw new Error('Runtime integrity remained invalid after repair.')
  }

  repairedArtifacts.push(relativize(CONTEXT_FILE))
  repairedArtifacts.push(relativize(CONTEXT_INTEGRITY_FILE))
  preservedArtifacts.push(...result.quarantinedPaths.map(relativize))
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString()
  const { requestedAreas } = parseArgs()
  const areas = expandRequestedAreas(requestedAreas)
  const repairedArtifacts: string[] = []
  const preservedArtifacts: string[] = []
  const failures: string[] = []
  let baseName: string | null = null

  ensureDir(REPAIRS_DIR)

  try {
    if (areas.includes('closeout') || areas.includes('archive')) {
      baseName = repairDuplicateCloseoutResidue(repairedArtifacts, preservedArtifacts)
    }

    if (areas.includes('runtime') || areas.includes('integrity')) {
      await rebuildRuntimeContext(repairedArtifacts, preservedArtifacts)
    }

    const record: RepairRunRecord = {
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: new Date().getTime() - new Date(startedAt).getTime(),
      requestedAreas: areas,
      baseName,
      repairedArtifacts,
      preservedArtifacts,
      failures,
      repairReason: 'operator-requested canonical PMOS recovery',
      repairResult: 'PASS',
      repairCount: repairedArtifacts.length,
    }

    atomicWriteJsonFile(path.join(REPAIRS_DIR, `repair-run-${buildRepairTimestamp()}.json`), record, {
      label: `repair-run:${baseName ?? 'pmos'}`,
    })
    console.log(`[repair-pmos-artifacts] PASS repaired=${repairedArtifacts.length} preserved=${preservedArtifacts.length}`)
  } catch (error) {
    failures.push((error as Error).message)

    const record: RepairRunRecord = {
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: new Date().getTime() - new Date(startedAt).getTime(),
      requestedAreas: areas,
      baseName,
      repairedArtifacts,
      preservedArtifacts,
      failures,
      repairReason: 'operator-requested canonical PMOS recovery',
      repairResult: 'FAIL',
      repairCount: repairedArtifacts.length,
    }

    atomicWriteJsonFile(path.join(REPAIRS_DIR, `repair-run-${buildRepairTimestamp()}.json`), record, {
      label: `repair-run:${baseName ?? 'pmos'}:failed`,
    })
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`[repair-pmos-artifacts] ERROR: ${(error as Error).message}`)
  process.exit(1)
})