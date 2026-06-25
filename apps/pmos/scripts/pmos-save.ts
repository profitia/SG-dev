#!/usr/bin/env tsx
// pmos-save.ts — PMOS Automated Persistence Utility (GOV-3-2 hardened)
//
// Reads from apps/pmos/.pmos/pending-artifact.json
// Inserts ConversationArtifact into PMOS DB
// Writes .md and .json lineage artifacts to apps/pmos/.pmos/conversations/
//
// GOVERNANCE: Hard validates ETAP, pipeline, conversationType, importanceLevel
//             before any DB write. Invalid governance = FAIL SAVE.
//
// Usage:
//   npx tsx scripts/pmos-save.ts
//   npm run pmos:save
//
// The pending-artifact.json file must be placed at:
//   apps/pmos/.pmos/pending-artifact.json
// before running this script. It is cleared after successful save.

import {
  PrismaClient,
  Prisma,
  ConversationType as PrismaConversationType,
  ImportanceLevel as PrismaImportanceLevel,
  ArtifactKind as PrismaArtifactKind,
  ArtifactNature as PrismaArtifactNature,
  ArtifactStatus as PrismaArtifactStatus,
} from '@prisma/client'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ── Governance import (canonical single source of truth) ─────────────────────
import {
  ArtifactKind,
  ArtifactNature,
  ArtifactStatus,
  CANONICAL_ETAP_NAMES,
  CANONICAL_SCOPE_CLASSIFICATIONS,
  type CloseoutEvidence,
  ConversationType,
  type FlightRecordV1,
  type GptHandoffArtifactV1,
  type PendingArtifact,
  ExecutionTrailEventSeverity,
  ExecutionTrailEventStatus,
  ExecutionTrailEventType,
  ExecutionTrailStatus,
  FactPreservationStatus,
  validatePendingArtifact,
  createObjectIntegrityMetadata,
  createArtifactLock,
  verifyArtifactLock,
  verifyObjectIntegrity,
  hashObject,
  CloseoutState,
  verifyTextIntegrity,
  type ArtifactLockMetadata,
  type IntegrityMetadata,
  validateGptHandoffArtifact,
} from '../../../packages/governance/src'

import { validateConversationArtifactSet } from '../src/lib/pmos/archive-completeness'
import {
  appendExecutionTrailEvent,
  getExecutionTrailPaths,
  readExecutionTrailEvents,
  validateExecutionTrail,
} from '../src/lib/pmos/execution-trail'
import {
  buildRuntimeAuthorityIntegrity,
  readRuntimeAuthoritySnapshot,
  renderRuntimeAuthorityMarkdown,
} from '../src/lib/pmos/runtime-authority'
import { createCanonicalFlightRecordPayload } from '../src/lib/pmos/flight-record-snapshot'
import { assertDatabaseUrl } from '../src/lib/pmos/operator-preflight'
import {
  atomicCopyFile,
  atomicWriteFileSet,
  atomicWriteJsonFile,
  quarantineTextArtifact,
  readJsonFileSafe,
} from '../src/lib/pmos/atomic-io'
import { repairRuntimeContextArtifacts } from '../src/lib/pmos/runtime-context-write'

const prisma = new PrismaClient()
const SG_DEV_ROOT = path.resolve(__dirname, '../../..')

const PMOS_DIR = path.resolve(__dirname, '../.pmos')
const PENDING_FILE = path.join(PMOS_DIR, 'pending-artifact.json')
const CONVERSATIONS_DIR = path.join(PMOS_DIR, 'conversations')
const RECOVERY_DIR = path.join(PMOS_DIR, 'recovery')
const PENDING_BACKUP_DIR = path.join(RECOVERY_DIR, 'pending-artifacts')
const FAILED_ARTIFACTS_DIR = path.join(RECOVERY_DIR, 'failed-artifacts')
const QUARANTINE_DIR = path.join(RECOVERY_DIR, 'quarantine')
const CLOSEOUTS_DIR = path.join(RECOVERY_DIR, 'closeouts')
const OPERATIONS_DIR = path.join(RECOVERY_DIR, 'operations')
const RUNTIME_RECOVERY_DIR = path.join(RECOVERY_DIR, 'runtime')
const ACTIVE_CLOSEOUT_FILE = path.join(RECOVERY_DIR, 'active-closeout.json')
const RUNTIME_CONTEXT_FILE = path.resolve(__dirname, '../.context/runtime-context.md')
const RUNTIME_CONTEXT_INTEGRITY_FILE = path.resolve(__dirname, '../.context/runtime-context.integrity.json')

const CANONICAL_PROJECT_NAMES: ReadonlySet<string> = new Set([
  'SpendGuru 2.0',
])

const CANONICAL_WORKSPACE_NAMES: ReadonlySet<string> = new Set([
  'SG-dev',
  'sg2-pcog-runtime',
])

const CANONICAL_CONVERSATION_TYPE_NAMES: ReadonlySet<string> = new Set(
  Object.values(ConversationType),
)

// ── Advisory File Lock ────────────────────────────────────────────────────────
// Prevents concurrent pmos-save invocations from racing on the same artifact.
// This is a simple filesystem advisory lock — not a distributed/Redis lock.
// Stale lock detection: lock older than LOCK_STALE_MS is treated as abandoned.
const ADVISORY_LOCK_FILE = path.join(PMOS_DIR, '.pmos-save.lock')
const LOCK_STALE_MS = 60_000 // 60 seconds — enough for any normal save operation

// ── Filename Helpers ──────────────────────────────────────────────────────────

function formatTimestampForFilename(date: Date): string {
  // Always use Polish local time (Europe/Warsaw = CET UTC+1 / CEST UTC+2)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}:${get('minute')}`
}

function buildArtifactBaseName(artifact: PendingArtifact): string {
  const date = new Date(artifact.metadata.timestamp)
  const prefix = formatTimestampForFilename(date)
  const slug = artifact.metadata.taskId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${prefix}_${slug}`
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return value
  const normalized = normalizeWhitespace(value)
  return normalized.length > 0 ? normalized : undefined
}

function normalizeStringList(values: string[]): string[] {
  return values
    .map((value) => normalizeWhitespace(value))
    .filter((value) => value.length > 0)
}

function normalizeProjectName(project: string): string {
  const normalized = normalizeWhitespace(project).replace(/\s*\[[^\]]+\]\s*$/g, '')
  const key = normalized.toLowerCase()

  if (
    key === 'spendguru 2.0'
    || key === 'spend guru'
    || key === 'spendguru'
    || key === 'spendguru 2 0'
    || key === 'spendguru-2'
    || key === 'sg2-discovery-runtime'
    || key === 'sg-dev'
    || key === 'spendguru 2.0 - pmos'
    || key === 'spendguru 2.0 - pcos runtime'
    || key === 'spendguru 2.0 — pmos'
    || key === 'spendguru 2.0 — pcos runtime'
  ) {
    return 'SpendGuru 2.0'
  }

  return normalized
}

function normalizeWorkspaceName(workspace: string): string {
  const normalized = normalizeWhitespace(workspace).replace(/\s*\[[^\]]+\]\s*$/g, '')
  const key = normalized.toLowerCase()

  if (key === 'sg-dev' || key === 'sg dev' || key === 'sgdev') {
    return 'SG-dev'
  }

  if (key === 'sg2-pcog-runtime' || key === 'sg2 pcog runtime' || key === 'sg2_pcog_runtime') {
    return 'sg2-pcog-runtime'
  }

  return normalized
}

function normalizeScopeValue(scope: string): string {
  const normalized = normalizeWhitespace(scope).toLowerCase()

  if (normalized === 'impl') return 'implementation'
  if (normalized === 'gov') return 'governance'
  if (normalized === 'arch') return 'architecture'
  if (normalized === 'doc' || normalized === 'docs') return 'documentation'

  return normalized
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeEtapName(etap: string): string {
  return normalizeWhitespace(etap)
}

function normalizeSubetapName(subetap: string, taskId: string): string {
  const normalized = normalizeWhitespace(subetap).replace(/\s*\[[^\]]+\]\s*$/g, '')
  const taskPrefix = new RegExp(`^${escapeRegExp(taskId)}\s+-\s+`)

  if (normalized === taskId) {
    return taskId
  }

  if (taskPrefix.test(normalized)) {
    return normalized.replace(taskPrefix, `${taskId} — `)
  }

  return normalized
}

function normalizeConversationTypeValue(conversationType: string | undefined): string | undefined {
  if (typeof conversationType !== 'string') return conversationType

  const normalized = normalizeWhitespace(conversationType).toLowerCase()

  if (normalized === 'impl') return ConversationType.IMPLEMENTATION
  if (normalized === 'arch') return ConversationType.ARCHITECTURE
  if (normalized === 'debug') return ConversationType.DEBUGGING
  if (normalized === 'runtime analysis' || normalized === 'runtime-analysis') return ConversationType.RUNTIME_ANALYSIS
  if (normalized === 'orchestrator') return ConversationType.ORCHESTRATION
  if (normalized === 'ui') return ConversationType.UX
  if (normalized === 'gov') return ConversationType.GOVERNANCE
  if (normalized === 'infra') return ConversationType.INFRASTRUCTURE

  return normalized.length > 0 ? normalized : undefined
}

function validateCanonicalizedMetadata(artifact: PendingArtifact): string[] {
  const errors: string[] = []
  const rawMetadata = artifact.metadata as Record<string, unknown>
  const workspace = typeof rawMetadata.workspace === 'string' ? rawMetadata.workspace : undefined

  if (!CANONICAL_PROJECT_NAMES.has(artifact.metadata.project)) {
    errors.push(`metadata.project normalization failed: "${artifact.metadata.project}" is not canonical — valid: ${[...CANONICAL_PROJECT_NAMES].join(', ')}`)
  }

  if (workspace !== undefined && !CANONICAL_WORKSPACE_NAMES.has(workspace)) {
    errors.push(`metadata.workspace normalization failed: "${workspace}" is not canonical — valid: ${[...CANONICAL_WORKSPACE_NAMES].join(', ')}`)
  }

  if (!CANONICAL_SCOPE_CLASSIFICATIONS.has(artifact.metadata.scope)) {
    errors.push(`metadata.scope normalization failed: "${artifact.metadata.scope}" is not canonical — valid: ${[...CANONICAL_SCOPE_CLASSIFICATIONS].join(', ')}`)
  }

  if (!CANONICAL_ETAP_NAMES.has(artifact.metadata.etap)) {
    errors.push(`metadata.etap normalization failed: "${artifact.metadata.etap}" is not canonical`)
  }

  if (
    artifact.metadata.conversationType !== undefined
    && !CANONICAL_CONVERSATION_TYPE_NAMES.has(artifact.metadata.conversationType)
  ) {
    errors.push(`metadata.conversationType normalization failed: "${artifact.metadata.conversationType}" is not canonical — valid: ${[...CANONICAL_CONVERSATION_TYPE_NAMES].join(', ')}`)
  }

  return errors
}

function normalizePendingArtifact(artifact: PendingArtifact): PendingArtifact {
  const rawMetadata = artifact.metadata as Record<string, unknown>
  const rawWorkspace = typeof rawMetadata.workspace === 'string' ? rawMetadata.workspace : undefined

  return {
    ...artifact,
    metadata: {
      ...artifact.metadata,
      conversationId: normalizeWhitespace(artifact.metadata.conversationId),
      project: normalizeProjectName(artifact.metadata.project),
      taskId: normalizeWhitespace(artifact.metadata.taskId),
      etap: normalizeEtapName(artifact.metadata.etap),
      scope: normalizeScopeValue(artifact.metadata.scope),
      timestamp: normalizeWhitespace(artifact.metadata.timestamp),
      subetap: typeof artifact.metadata.subetap === 'string'
        ? normalizeSubetapName(artifact.metadata.subetap, normalizeWhitespace(artifact.metadata.taskId))
        : normalizeOptionalString(artifact.metadata.subetap),
      conversationType: normalizeConversationTypeValue(artifact.metadata.conversationType),
      importanceLevel: normalizeOptionalString(artifact.metadata.importanceLevel),
      ...(rawWorkspace ? { workspace: normalizeWorkspaceName(rawWorkspace) } : {}),
    },
    task: {
      ...artifact.task,
      originalTaskRequest: artifact.task.originalTaskRequest.trim(),
    },
    analysis: {
      ...artifact.analysis,
      executionSummary: artifact.analysis.executionSummary.trim(),
      reasoningSummary: artifact.analysis.reasoningSummary.trim(),
    },
    findings: {
      findings: normalizeStringList(artifact.findings.findings),
      blockers: normalizeStringList(artifact.findings.blockers),
      residualRisks: normalizeStringList(artifact.findings.residualRisks),
    },
    decisions: {
      decisions: normalizeStringList(artifact.decisions.decisions),
    },
    actions: {
      recommendations: normalizeStringList(artifact.actions.recommendations),
      validationsExecuted: normalizeStringList(artifact.actions.validationsExecuted),
      validationsNotExecuted: normalizeStringList(artifact.actions.validationsNotExecuted),
      artifactsCreated: normalizeStringList(artifact.actions.artifactsCreated),
      artifactsModified: normalizeStringList(artifact.actions.artifactsModified),
    },
    result: {
      ...artifact.result,
    },
    completionEvidence: {
      ...artifact.completionEvidence,
    },
    ...(artifact.contextLinks ? { contextLinks: { ...artifact.contextLinks } } : {}),
  }
}

interface AdvisoryLock {
  pid: number
  hostname: string
  startedAt: string
  conversationId?: string
}

function acquireAdvisoryLock(conversationId: string): void {
  while (true) {
    const lock: AdvisoryLock = {
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: new Date().toISOString(),
      conversationId,
    }

    try {
      const fd = fs.openSync(ADVISORY_LOCK_FILE, 'wx')
      fs.writeFileSync(fd, JSON.stringify(lock, null, 2), 'utf-8')
      fs.closeSync(fd)
      console.log(`[pmos-save] ✓ Advisory lock acquired (pid=${lock.pid})`)
      return
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'EEXIST') {
        throw error
      }

      const raw = fs.readFileSync(ADVISORY_LOCK_FILE, 'utf-8')
      let existing: AdvisoryLock
      try {
        existing = JSON.parse(raw)
      } catch {
        console.warn('[pmos-save] ⚠️  Advisory lock file corrupt — treating as stale, removing.')
        fs.unlinkSync(ADVISORY_LOCK_FILE)
        continue
      }

      const lockedAt = new Date(existing.startedAt).getTime()
      const ageMs = Date.now() - lockedAt

      if (ageMs > LOCK_STALE_MS) {
        console.warn(`[pmos-save] ⚠️  Stale advisory lock detected (age: ${Math.round(ageMs / 1000)}s, limit: ${LOCK_STALE_MS / 1000}s)`)
        console.warn(`[pmos-save]    Previous lock: pid=${existing.pid}, host=${existing.hostname}, conversation=${existing.conversationId ?? 'unknown'}`)
        console.warn('[pmos-save]    Removing stale lock and continuing.')
        fs.unlinkSync(ADVISORY_LOCK_FILE)
        continue
      }

      console.error('[pmos-save] ❌ ADVISORY LOCK HELD: another pmos-save is already running.')
      console.error(`[pmos-save]    Lock held by: pid=${existing.pid}, host=${existing.hostname}`)
      console.error(`[pmos-save]    Started at: ${existing.startedAt} (${Math.round(ageMs / 1000)}s ago)`)
      console.error(`[pmos-save]    Conversation: ${existing.conversationId ?? 'unknown'}`)
      console.error('[pmos-save]    Wait for the other process to finish or remove the lock:')
      console.error(`[pmos-save]    rm ${ADVISORY_LOCK_FILE}`)
      process.exit(1)
    }
  }
}

function releaseAdvisoryLock(): void {
  if (fs.existsSync(ADVISORY_LOCK_FILE)) {
    fs.unlinkSync(ADVISORY_LOCK_FILE)
    console.log('[pmos-save] ✓ Advisory lock released')
  }
}

let artifact: PendingArtifact | null = null
let baseName = 'unknown-artifact'
let closeoutEvidencePath: string | null = null
let evidence: CloseoutEvidence | null = null
let pendingBackupPath: string | null = null
let persistedDbRecordId: string | null = null

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function relativize(filePath: string): string {
  return path.relative(SG_DEV_ROOT, filePath)
}

function buildRecoverySuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '__')
}

function appendState(evidence: CloseoutEvidence, state: CloseoutState): void {
  if (!evidence.stateHistory) evidence.stateHistory = []
  if (evidence.stateHistory[evidence.stateHistory.length - 1] !== state) {
    evidence.stateHistory.push(state)
  }
  evidence.closeoutState = state
}

function createInitialEvidence(backupPath: string): CloseoutEvidence {
  const now = new Date().toISOString()
  return {
    closeoutState: CloseoutState.INITIATED,
    closeoutStartedAt: now,
    closeoutCompletedAt: null,
    pmosSaveStatus: 'NOT_STARTED',
    pmosSaveStartedAt: null,
    pmosSaveCompletedAt: null,
    pmosSaveError: null,
    pmosSaveArtifactPaths: [],
    pmosSaveDbRecordId: null,
    pmosSaveConversationMdPath: null,
    pmosSaveConversationJsonPath: null,
    pmosSaveIntegrityPath: null,
    pmosSaveLockPath: null,
    vectorRebuildStatus: 'NOT_STARTED',
    vectorRebuildStartedAt: null,
    vectorRebuildCompletedAt: null,
    vectorRebuildError: null,
    runtimeContextPath: null,
    runtimeContextIntegrityPath: null,
    runtimeContextIntegrityStatus: 'UNKNOWN',
    runtimeContextVerificationSource: null,
    archiveCompletenessStatus: 'UNKNOWN',
    archiveCompletenessErrors: [],
    executionTrailPath: null,
    executionTrailMarkdownPath: null,
    executionTrailStatus: ExecutionTrailStatus.MISSING,
    factPreservationStatus: FactPreservationStatus.MISSING,
    factPreservationNotes: [],
    pendingArtifactBackupPath: relativize(backupPath),
    recoveryRequired: false,
    recoveryReason: null,
    manualRecoveryInstructions: [
      'Do not call task_complete until closeoutState = CLOSEOUT_COMPLETE.',
      'If PMOS save fails or is partial, inspect the recovery sidecar and restore from pending-artifact backup or quarantine copy.',
      'If runtime-context finalization fails after PMOS save, rerun cd apps/pmos && npm run pmos:context and treat the task as INCOMPLETE until verification passes.',
    ],
    stateHistory: [CloseoutState.INITIATED],
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath))
  atomicWriteJsonFile(filePath, data, {
    label: `json:${path.basename(filePath)}`,
    journalPath: path.join(OPERATIONS_DIR, `${path.basename(filePath)}.json-write.json`),
  })
}

function hasCompletedExecutionTrail(baseName: string): boolean {
  try {
    const events = readExecutionTrailEvents(baseName)
    return events.some((event) => event.eventType === ExecutionTrailEventType.TASK_COMPLETED && event.status === ExecutionTrailEventStatus.SUCCEEDED)
  } catch {
    return false
  }
}

function hasMatchingPendingArtifactBackup(baseName: string, artifact: PendingArtifact): boolean {
  if (!fs.existsSync(PENDING_BACKUP_DIR)) return false

  const entryPrefix = `${baseName}__backup_`
  const entries = fs.readdirSync(PENDING_BACKUP_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(entryPrefix) || !entry.name.endsWith('.json')) {
      continue
    }

    const candidate = readJsonFileSafe<PendingArtifact>(path.join(PENDING_BACKUP_DIR, entry.name))
    if (!candidate.value) continue

    const normalizedCandidate = normalizePendingArtifact(candidate.value)
    if (hashObject(normalizedCandidate) === hashObject(artifact)) {
      return true
    }
  }

  return false
}

function copyToRecoveryTarget(sourcePath: string, targetDir: string, fileName: string): string | null {
  if (!fs.existsSync(sourcePath)) return null
  ensureDir(targetDir)
  const targetPath = path.join(targetDir, fileName)
  atomicCopyFile(sourcePath, targetPath, {
    label: `recovery-copy:${fileName}`,
    journalPath: path.join(OPERATIONS_DIR, `${fileName}.copy.json`),
  })
  return targetPath
}

function writeConversationArtifactFiles(params: {
  artifact: FlightRecordV1
  baseName: string
  mdPath: string
  jsonPath: string
  integrityPath: string
  lockPath: string
  recoveryDir: string
  handoff?: GptHandoffArtifactV1 | null
  traceability: {
    executionTrailPath?: string | null
    executionTrailMarkdownPath?: string | null
    closeoutEvidencePath?: string | null
    pendingArtifactBackupPath?: string | null
  }
}): void {
  const { artifact, baseName, mdPath, jsonPath, integrityPath, lockPath, recoveryDir, handoff, traceability } = params
  const nextMarkdown = `${buildMarkdown(artifact, traceability, handoff ?? null)}\n`
  const currentMarkdown = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : null
  const currentJson = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf-8') : null
  const currentIntegrity = readJsonFileSafe<IntegrityMetadata>(integrityPath)
  const currentLock = readJsonFileSafe<ArtifactLockMetadata>(lockPath)
  const markdownMatches = currentMarkdown === nextMarkdown
  const jsonMatches = currentJson ? hashObject(JSON.parse(currentJson)) === hashObject(artifact) : false
  const integrityMatches = currentIntegrity.value ? verifyObjectIntegrity(artifact, currentIntegrity.value).valid : false
  const lockMatches = currentLock.value ? verifyArtifactLock(artifact, currentLock.value).valid : false

  if (markdownMatches && jsonMatches && integrityMatches && lockMatches) {
    return
  }

  if (currentIntegrity.error) quarantineTextArtifact(integrityPath, recoveryDir, `${baseName}-corrupt-integrity`)
  if (currentLock.error) quarantineTextArtifact(lockPath, recoveryDir, `${baseName}-corrupt-lock`)

  atomicWriteFileSet([
    { filePath: mdPath, content: nextMarkdown },
    { filePath: jsonPath, content: `${JSON.stringify(artifact, null, 2)}\n` },
    {
      filePath: integrityPath,
      content: `${JSON.stringify(createObjectIntegrityMetadata(artifact, {
        generatedBy: 'pmos-save.ts',
        sourceRuntime: 'PMOS',
        sourceProjection: `conversation-artifact:${artifact.metadata.conversationId}`,
      }), null, 2)}\n`,
    },
    { filePath: lockPath, content: `${JSON.stringify(createArtifactLock(artifact), null, 2)}\n` },
  ], {
    label: `conversation-artifact:${artifact.metadata.conversationId}`,
    journalPath: path.join(OPERATIONS_DIR, `${baseName}.conversation-write.json`),
  })
}

function pushMarkdownListSection(lines: string[], title: string, items: string[], emptyLabel: string): void {
  lines.push(title)
  lines.push('')
  if (items.length > 0) {
    items.forEach((item) => lines.push(`- ${item}`))
  } else {
    lines.push(emptyLabel)
  }
  lines.push('')
}

function buildMarkdown(
  artifact: FlightRecordV1,
  traceability?: {
    executionTrailPath?: string | null
    executionTrailMarkdownPath?: string | null
    closeoutEvidencePath?: string | null
    pendingArtifactBackupPath?: string | null
  },
  handoff?: GptHandoffArtifactV1 | null,
): string {
  const lines: string[] = []

  lines.push(`# PMOS Flight Record — ${artifact.metadata.taskId}`)
  lines.push('')
  lines.push(`> **Conversation ID:** ${artifact.metadata.conversationId}`)
  lines.push(`> **Timestamp:** ${artifact.metadata.timestamp}`)
  lines.push(`> **Project:** ${artifact.metadata.project}`)
  lines.push(`> **ETAP:** ${artifact.metadata.etap}`)
  lines.push(`> **Scope:** ${artifact.metadata.scope}`)
  if (artifact.metadata.subetap) lines.push(`> **Node:** ${artifact.metadata.subetap}`)
  if (artifact.metadata.conversationType) lines.push(`> **Type:** ${artifact.metadata.conversationType}`)
  if (artifact.metadata.importanceLevel) lines.push(`> **Importance:** ${artifact.metadata.importanceLevel}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## Task')
  lines.push('')
  lines.push(artifact.task.originalTaskRequest)
  lines.push('')

  lines.push('## Analysis')
  lines.push('')
  lines.push('### Execution Summary')
  lines.push('')
  lines.push(artifact.analysis.executionSummary)
  lines.push('')
  lines.push('### Reasoning Summary')
  lines.push('')
  lines.push(artifact.analysis.reasoningSummary)
  lines.push('')

  lines.push('## Findings')
  lines.push('')
  lines.push('### Findings')
  lines.push('')
  if (artifact.findings.findings.length > 0) {
    artifact.findings.findings.forEach((finding) => lines.push(`- ${finding}`))
  } else {
    lines.push('_None recorded._')
  }
  lines.push('')
  lines.push('### Blockers')
  lines.push('')
  if (artifact.findings.blockers.length > 0) {
    artifact.findings.blockers.forEach((blocker) => lines.push(`- ${blocker}`))
  } else {
    lines.push('_None._')
  }
  lines.push('')
  lines.push('### Residual Risks')
  lines.push('')
  if (artifact.findings.residualRisks.length > 0) {
    artifact.findings.residualRisks.forEach((risk) => lines.push(`- ${risk}`))
  } else {
    lines.push('_None._')
  }
  lines.push('')

  lines.push('## Decisions')
  lines.push('')
  if (artifact.decisions.decisions.length > 0) {
    artifact.decisions.decisions.forEach((decision) => lines.push(`- ${decision}`))
  } else {
    lines.push('_None recorded._')
  }
  lines.push('')

  lines.push('## Actions')
  lines.push('')
  lines.push('### Recommendations')
  lines.push('')
  if (artifact.actions.recommendations.length > 0) {
    artifact.actions.recommendations.forEach((recommendation) => lines.push(`- ${recommendation}`))
  } else {
    lines.push('_None recorded._')
  }
  lines.push('')
  lines.push('### Validations Executed')
  lines.push('')
  if (artifact.actions.validationsExecuted.length > 0) {
    artifact.actions.validationsExecuted.forEach((validation) => lines.push(`- ${validation}`))
  } else {
    lines.push('_None recorded._')
  }
  lines.push('')
  lines.push('### Validations Not Executed')
  lines.push('')
  if (artifact.actions.validationsNotExecuted.length > 0) {
    artifact.actions.validationsNotExecuted.forEach((validation) => lines.push(`- ${validation}`))
  } else {
    lines.push('_None._')
  }
  lines.push('')
  lines.push('### Artifacts Created')
  lines.push('')
  if (artifact.actions.artifactsCreated.length > 0) {
    artifact.actions.artifactsCreated.forEach((createdArtifact) => lines.push(`- ${createdArtifact}`))
  } else {
    lines.push('_None recorded._')
  }
  lines.push('')
  lines.push('### Artifacts Modified')
  lines.push('')
  if (artifact.actions.artifactsModified.length > 0) {
    artifact.actions.artifactsModified.forEach((modifiedArtifact) => lines.push(`- ${modifiedArtifact}`))
  } else {
    lines.push('_None recorded._')
  }
  lines.push('')

  lines.push('## Result')
  lines.push('')
  lines.push(`Final status: ${artifact.result.finalStatus}`)
  lines.push('')

  lines.push('## Completion Evidence')
  lines.push('')
  lines.push(`- closeoutState: ${artifact.completionEvidence.closeoutState}`)
  lines.push(`- pmosSaveStatus: ${artifact.completionEvidence.pmosSaveStatus}`)
  lines.push(`- vectorRebuildStatus: ${artifact.completionEvidence.vectorRebuildStatus}`)
  lines.push(`- archiveCompletenessStatus: ${artifact.completionEvidence.archiveCompletenessStatus}`)
  lines.push(`- executionTrailStatus: ${artifact.completionEvidence.executionTrailStatus}`)
  lines.push('')

  if (handoff) {
    lines.push('## GPT HANDOFF')
    lines.push('')
    lines.push(`Artifact ID: ${handoff.id}`)
    lines.push('Persistence: POSTGRESQL')
    lines.push(`Status: ${handoff.status}`)
    lines.push('Source: Closeout')
    lines.push(`Conversation ID: ${handoff.conversationId}`)
    lines.push(`Task ID: ${handoff.taskId}`)
    lines.push(`Artifact Nature: ${handoff.artifactNature}`)
    lines.push(`Artifact Kind: ${handoff.artifactKind}`)
    lines.push(`Created At: ${handoff.createdAt}`)
    lines.push('Lineage:')
    lines.push('Conversation')
    lines.push('→ Flight Record')
    lines.push('→ Closeout')
    lines.push('→ HANDOFF')
    lines.push('')

    lines.push('## HANDOFF SUMMARY')
    lines.push('')
    lines.push('### Original Objective')
    lines.push('')
    lines.push(handoff.payload.originalObjective)
    lines.push('')
    pushMarkdownListSection(lines, '### CURRENT STATE', handoff.payload.currentState ?? [], '_None recorded._')
    pushMarkdownListSection(lines, '### Completed Work', handoff.payload.completedWork, '_None recorded._')
    pushMarkdownListSection(lines, '### Not Completed', handoff.payload.notCompleted, '_None recorded._')
    pushMarkdownListSection(lines, '### Key Findings', handoff.payload.keyFindings, '_None recorded._')
    pushMarkdownListSection(lines, '### Decisions', handoff.payload.decisions, '_None recorded._')
    pushMarkdownListSection(lines, '### Blockers', handoff.payload.blockers, '_None recorded._')
    pushMarkdownListSection(lines, '### Residual Risks', handoff.payload.residualRisks, '_None recorded._')
    pushMarkdownListSection(lines, '### Open Questions', handoff.payload.openQuestions, '_None recorded._')
    pushMarkdownListSection(lines, '### Outstanding Topics', handoff.payload.outstandingTopics, '_None recorded._')

    lines.push('## GPT BRIDGE PAYLOAD')
    lines.push('')
    lines.push(handoff.payload.bridgePayloadText)
    lines.push('')
  }

  if (
    traceability?.executionTrailPath ||
    traceability?.executionTrailMarkdownPath ||
    traceability?.closeoutEvidencePath ||
    traceability?.pendingArtifactBackupPath
  ) {
    lines.push('## Traceability Links')
    lines.push('')
    if (traceability.executionTrailPath) lines.push(`- Execution trail JSONL: ${traceability.executionTrailPath}`)
    if (traceability.executionTrailMarkdownPath) lines.push(`- Execution trail Markdown: ${traceability.executionTrailMarkdownPath}`)
    if (traceability.closeoutEvidencePath) lines.push(`- Closeout evidence: ${traceability.closeoutEvidencePath}`)
    if (traceability.pendingArtifactBackupPath) lines.push(`- Pending artifact backup: ${traceability.pendingArtifactBackupPath}`)
    lines.push('')
  }

  lines.push('---')
  return lines.join('\n')
}

function appendTrailEventSafe(
  baseName: string,
  taskId: string,
  eventType: ExecutionTrailEventType,
  summary: string,
  options: Partial<{
    details: string | Record<string, unknown> | null
    relatedFiles: string[]
    relatedCommands: string[]
    status: ExecutionTrailEventStatus
    severity: ExecutionTrailEventSeverity
    source: string
  }> = {},
): void {
  try {
    appendExecutionTrailEvent({
      baseName,
      taskId,
      eventType,
      summary,
      details: options.details,
      relatedFiles: options.relatedFiles,
      relatedCommands: options.relatedCommands,
      status: options.status,
      severity: options.severity,
      source: options.source ?? 'pmos-save',
    })
  } catch (error) {
    console.warn(`[pmos-save] ⚠️  Execution trail append failed for ${eventType}: ${(error as Error).message}`)
  }
}

function bootstrapExecutionTrail(baseName: string, artifact: PendingArtifact): void {
  if (readExecutionTrailEvents(baseName).length > 0) return

  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.TASK_RECEIVED, 'Task received into PMOS persistence flow.', {
    details: { conversationId: artifact.metadata.conversationId, project: artifact.metadata.project },
    status: ExecutionTrailEventStatus.RECORDED,
    source: 'pmos-save/bootstrap',
  })
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PROMPT_CAPTURED, 'Initial prompt captured in pending artifact.', {
    details: { originalTaskRequest: artifact.task.originalTaskRequest },
    status: ExecutionTrailEventStatus.RECORDED,
    source: 'pmos-save/bootstrap',
  })
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PLAN_DECLARED, 'Plan baseline captured from pending artifact recommendations and validations.', {
    details: {
      recommendations: artifact.actions.recommendations,
      validationsExecuted: artifact.actions.validationsExecuted,
      validationsNotExecuted: artifact.actions.validationsNotExecuted,
    },
    status: ExecutionTrailEventStatus.RECORDED,
    source: 'pmos-save/bootstrap',
  })
}

function formatJsonValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  return JSON.stringify(value)
}

function collectJsonDiffs(expected: unknown, actual: unknown, currentPath = 'flightRecordJson', diffs: string[] = []): string[] {
  if (diffs.length >= 50) return diffs

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      diffs.push(`${currentPath}: expected ${Array.isArray(expected) ? 'array' : typeof expected}, got ${Array.isArray(actual) ? 'array' : typeof actual}`)
      return diffs
    }

    if (expected.length !== actual.length) {
      diffs.push(`${currentPath}.length: expected ${expected.length}, got ${actual.length}`)
    }

    const maxLength = Math.max(expected.length, actual.length)
    for (let index = 0; index < maxLength && diffs.length < 50; index += 1) {
      collectJsonDiffs(expected[index], actual[index], `${currentPath}[${index}]`, diffs)
    }

    return diffs
  }

  const expectedIsObject = typeof expected === 'object' && expected !== null
  const actualIsObject = typeof actual === 'object' && actual !== null

  if (expectedIsObject || actualIsObject) {
    if (!expectedIsObject || !actualIsObject) {
      diffs.push(`${currentPath}: expected ${expectedIsObject ? 'object' : typeof expected}, got ${actualIsObject ? 'object' : typeof actual}`)
      return diffs
    }

    const expectedKeys = Object.keys(expected as Record<string, unknown>).sort()
    const actualKeys = Object.keys(actual as Record<string, unknown>).sort()
    const allKeys = Array.from(new Set([...expectedKeys, ...actualKeys])).sort()

    for (const key of allKeys) {
      if (diffs.length >= 50) break
      const hasExpectedKey = Object.prototype.hasOwnProperty.call(expected, key)
      const hasActualKey = Object.prototype.hasOwnProperty.call(actual, key)

      if (!hasExpectedKey) {
        diffs.push(`${currentPath}.${key}: unexpected value ${formatJsonValue((actual as Record<string, unknown>)[key])}`)
        continue
      }

      if (!hasActualKey) {
        diffs.push(`${currentPath}.${key}: missing value, expected ${formatJsonValue((expected as Record<string, unknown>)[key])}`)
        continue
      }

      collectJsonDiffs(
        (expected as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
        `${currentPath}.${key}`,
        diffs,
      )
    }

    return diffs
  }

  if (!Object.is(expected, actual)) {
    diffs.push(`${currentPath}: expected ${formatJsonValue(expected)}, got ${formatJsonValue(actual)}`)
  }

  return diffs
}

function collectMissingFactPaths(expected: unknown, actual: unknown, currentPath = 'artifact', diffs: string[] = []): string[] {
  if (diffs.length >= 50) return diffs

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push(`${currentPath}: expected array, got ${typeof actual}`)
      return diffs
    }

    for (let index = 0; index < expected.length && diffs.length < 50; index += 1) {
      if (index >= actual.length) {
        diffs.push(`${currentPath}[${index}]: missing array item`)
        continue
      }
      collectMissingFactPaths(expected[index], actual[index], `${currentPath}[${index}]`, diffs)
    }

    return diffs
  }

  const expectedIsObject = typeof expected === 'object' && expected !== null
  if (!expectedIsObject) {
    if (actual === undefined) {
      diffs.push(`${currentPath}: missing value`)
    }
    return diffs
  }

  if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
    diffs.push(`${currentPath}: expected object, got ${Array.isArray(actual) ? 'array' : typeof actual}`)
    return diffs
  }

  for (const key of Object.keys(expected as Record<string, unknown>).sort()) {
    if (diffs.length >= 50) break
    if (!Object.prototype.hasOwnProperty.call(actual, key)) {
      diffs.push(`${currentPath}.${key}: missing field`)
      continue
    }

    collectMissingFactPaths(
      (expected as Record<string, unknown>)[key],
      (actual as Record<string, unknown>)[key],
      `${currentPath}.${key}`,
      diffs,
    )
  }

  return diffs
}

function stripCompletionEvidence(artifact: FlightRecordV1): Omit<FlightRecordV1, 'completionEvidence'> {
  const { completionEvidence, ...rest } = artifact
  void completionEvidence
  return rest
}

function projectConversationArtifactScalarParity(record: {
  conversationId: string
  timestamp: Date
  project: string
  taskId: string
  scope: string
  etap: string
  subetap: string | null
  conversationType: PrismaConversationType | null
  importanceLevel: PrismaImportanceLevel | null
  userPrompt: string
  llmResponse: string
  summary: string
  filesPath: string | null
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    conversationId: record.conversationId,
    project: record.project,
    taskId: record.taskId,
    etap: record.etap,
    scope: record.scope,
    timestamp: record.timestamp.toISOString(),
  }

  if (record.subetap !== null) {
    metadata.subetap = record.subetap
  }

  if (record.conversationType !== null) {
    metadata.conversationType = record.conversationType
  }

  if (record.importanceLevel !== null) {
    metadata.importanceLevel = record.importanceLevel
  }

  return {
    metadata,
    task: {
      originalTaskRequest: record.userPrompt,
    },
    analysis: {
      executionSummary: record.llmResponse,
      reasoningSummary: record.summary,
    },
    summary: record.summary,
    filesPath: record.filesPath,
  }
}

function projectFlightRecordCompletionEvidence(closeout: CloseoutEvidence): FlightRecordV1['completionEvidence'] {
  return {
    closeoutState: closeout.closeoutState,
    pmosSaveStatus: closeout.pmosSaveStatus,
    vectorRebuildStatus: closeout.vectorRebuildStatus,
    archiveCompletenessStatus: closeout.archiveCompletenessStatus,
    executionTrailStatus: closeout.executionTrailStatus,
  }
}

function readConversationJsonArtifactOrThrow(jsonPath: string): FlightRecordV1 {
  const artifact = readJsonFileSafe<FlightRecordV1>(jsonPath)
  if (!artifact.value) {
    throw new Error(artifact.error ?? `Conversation JSON artifact missing at ${jsonPath}`)
  }

  const validation = validatePendingArtifact(artifact.value)
  if (!validation.valid) {
    throw new Error(`Conversation JSON artifact failed ValidatorV2: ${validation.errors.join(' | ')}`)
  }

  return artifact.value
}

function buildConversationArtifactProjection(
  artifact: FlightRecordV1,
  filesPath: string,
  flightRecordPayload: FlightRecordV1,
  closeout: CloseoutEvidence,
) {
  const summary = buildConversationArtifactSummary(artifact, closeout)

  return {
    timestamp: new Date(artifact.metadata.timestamp),
    project: artifact.metadata.project,
    taskId: artifact.metadata.taskId,
    scope: artifact.metadata.scope,
    etap: artifact.metadata.etap,
    subetap: artifact.metadata.subetap ?? null,
    domains: [],
    conversationType: (artifact.metadata.conversationType ?? null) as PrismaConversationType | null,
    importanceLevel: (artifact.metadata.importanceLevel ?? null) as PrismaImportanceLevel | null,
    userPrompt: artifact.task.originalTaskRequest,
    llmResponse: artifact.analysis.executionSummary,
    summary,
    tags: [],
    chronologyOrder: 0,
    flightRecordJson: flightRecordPayload as unknown as Prisma.InputJsonValue,
    filesPath,
  }
}

function buildConversationArtifactMutableProjection(
  artifact: FlightRecordV1,
  filesPath: string,
  closeout: CloseoutEvidence,
) {
  const summary = buildConversationArtifactSummary(artifact, closeout)

  return {
    timestamp: new Date(artifact.metadata.timestamp),
    project: artifact.metadata.project,
    taskId: artifact.metadata.taskId,
    scope: artifact.metadata.scope,
    etap: artifact.metadata.etap,
    subetap: artifact.metadata.subetap ?? null,
    domains: [],
    conversationType: (artifact.metadata.conversationType ?? null) as PrismaConversationType | null,
    importanceLevel: (artifact.metadata.importanceLevel ?? null) as PrismaImportanceLevel | null,
    userPrompt: artifact.task.originalTaskRequest,
    llmResponse: artifact.analysis.executionSummary,
    summary,
    tags: [],
    chronologyOrder: 0,
    filesPath,
  }
}

function uniqueIds(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return []
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)))
}

function buildConversationArtifactRelationCreateWrites(artifact: FlightRecordV1) {
  const links = artifact.contextLinks

  return {
    linkedDecisions: {
      create: uniqueIds(links?.decisionIds).map((decisionId) => ({
        decision: { connect: { id: decisionId } },
      })),
    },
    linkedWarnings: {
      create: uniqueIds(links?.warningIds).map((warningId) => ({
        warning: { connect: { id: warningId } },
      })),
    },
    linkedNodes: {
      create: uniqueIds(links?.nodeIds).map((nodeId) => ({
        node: { connect: { id: nodeId } },
      })),
    },
    linkedLogs: {
      create: uniqueIds(links?.logIds).map((logId) => ({
        log: { connect: { id: logId } },
      })),
    },
    linkedPrinciples: {
      create: uniqueIds(links?.principleIds).map((principleId) => ({
        principle: { connect: { id: principleId } },
      })),
    },
    linkedPrompts: {
      create: uniqueIds(links?.promptExecutionIds).map((promptExecutionId) => ({
        promptExecution: { connect: { id: promptExecutionId } },
      })),
    },
  }
}

function buildConversationArtifactRelationUpdateWrites(artifact: FlightRecordV1) {
  const createWrites = buildConversationArtifactRelationCreateWrites(artifact)

  return {
    linkedDecisions: {
      deleteMany: {},
      create: createWrites.linkedDecisions.create,
    },
    linkedWarnings: {
      deleteMany: {},
      create: createWrites.linkedWarnings.create,
    },
    linkedNodes: {
      deleteMany: {},
      create: createWrites.linkedNodes.create,
    },
    linkedLogs: {
      deleteMany: {},
      create: createWrites.linkedLogs.create,
    },
    linkedPrinciples: {
      deleteMany: {},
      create: createWrites.linkedPrinciples.create,
    },
    linkedPrompts: {
      deleteMany: {},
      create: createWrites.linkedPrompts.create,
    },
  }
}

function reconstructFlightRecordFromDbOrThrow(dbRecord: { conversationId: string; flightRecordJson: unknown }): FlightRecordV1 {
  if (typeof dbRecord.flightRecordJson !== 'object' || dbRecord.flightRecordJson === null) {
    throw new Error(`DB record ${dbRecord.conversationId} does not contain flightRecordJson`)
  }

  const reconstructed = dbRecord.flightRecordJson as FlightRecordV1
  const validation = validatePendingArtifact(reconstructed)
  if (!validation.valid) {
    throw new Error(`DB flightRecordJson failed ValidatorV2: ${validation.errors.join(' | ')}`)
  }

  if (reconstructed.metadata.conversationId !== dbRecord.conversationId) {
    throw new Error(
      `DB conversationId mismatch: row=${dbRecord.conversationId}, flightRecord=${reconstructed.metadata.conversationId}`,
    )
  }

  return reconstructed
}

function syncFlightRecordCompletionEvidence(artifact: FlightRecordV1, closeout: CloseoutEvidence): FlightRecordV1 {
  artifact.completionEvidence.closeoutState = closeout.closeoutState
  artifact.completionEvidence.pmosSaveStatus = closeout.pmosSaveStatus
  artifact.completionEvidence.vectorRebuildStatus = closeout.vectorRebuildStatus
  artifact.completionEvidence.archiveCompletenessStatus = closeout.archiveCompletenessStatus
  artifact.completionEvidence.executionTrailStatus = closeout.executionTrailStatus
  return artifact
}

function syncFactPreservationEvidence(baseName: string, evidence: CloseoutEvidence): void {
  const trailValidation = validateExecutionTrail(baseName)
  evidence.executionTrailPath = relativize(trailValidation.jsonlPath)
  evidence.executionTrailMarkdownPath = relativize(trailValidation.markdownPath)
  evidence.executionTrailStatus = trailValidation.status
  evidence.factPreservationStatus = trailValidation.factPreservationStatus
  evidence.factPreservationNotes = trailValidation.issues.map((issue) => `${issue.severity}: ${issue.message}`)
}

function buildHandoffTextSection(title: string, items: string[]): string {
  if (items.length === 0) {
    return `${title}:\n- None recorded.`
  }

  return `${title}:\n${items.map((item) => `- ${item}`).join('\n')}`
}

function buildDerivedHandoffPayload(artifact: FlightRecordV1, closeout: CloseoutEvidence) {
  const completedWork = [
    ...artifact.findings.findings,
    ...artifact.actions.artifactsCreated.map((item) => `Created: ${item}`),
    ...artifact.actions.artifactsModified.map((item) => `Modified: ${item}`),
    ...artifact.actions.validationsExecuted.map((item) => `Validated: ${item}`),
  ]

  const notCompleted = [
    ...artifact.actions.validationsNotExecuted.map((item) => `Validation not executed: ${item}`),
    ...(closeout.recoveryRequired ? [`Recovery required: ${closeout.recoveryReason ?? 'unknown reason'}`] : []),
  ]

  const openQuestions = artifact.actions.recommendations.filter((item) => item.trim().endsWith('?'))
  const outstandingTopics = artifact.actions.recommendations.filter((item) => !item.trim().endsWith('?'))
  const unresolvedAreas = [
    ...artifact.findings.blockers,
    ...artifact.findings.residualRisks,
    ...artifact.actions.validationsNotExecuted,
  ]
  const recommendedNextDecision = outstandingTopics[0] ?? openQuestions[0] ?? 'None recorded.'
  const currentState = buildCurrentStateSnapshot(artifact, closeout)
  const bridgePayloadText = buildBridgePayloadText({
    originalObjective: artifact.task.originalTaskRequest,
    resultStatus: artifact.result.finalStatus,
    currentState,
    completedWork,
    notCompleted,
    keyFindings: artifact.findings.findings,
    decisions: artifact.decisions.decisions,
    residualRisks: artifact.findings.residualRisks,
    openQuestions,
    recommendedNextDecision,
  })

  return {
    originalObjective: artifact.task.originalTaskRequest,
    resultStatus: artifact.result.finalStatus,
    currentState,
    completedWork,
    notCompleted,
    keyFindings: artifact.findings.findings,
    decisions: artifact.decisions.decisions,
    blockers: artifact.findings.blockers,
    residualRisks: artifact.findings.residualRisks,
    openQuestions,
    outstandingTopics,
    unresolvedAreas,
    recommendedNextDecision,
    bridgePayloadText,
    copyReadyText: bridgePayloadText,
  }
}

function buildConversationArtifactSummary(artifact: FlightRecordV1, closeout: CloseoutEvidence): string {
  const payload = buildDerivedHandoffPayload(artifact, closeout)

  return [
    artifact.analysis.reasoningSummary,
    '',
    'Handoff:',
    payload.bridgePayloadText,
  ].join('\n').trim()
}

function buildCurrentStateSnapshot(artifact: FlightRecordV1, closeout: CloseoutEvidence): string[] {
  const currentState: string[] = []

  currentState.push(`Persisted HANDOFF: ${closeout.pmosSaveStatus === 'SUCCEEDED' ? 'ACTIVE' : closeout.pmosSaveStatus === 'FAILED' ? 'FAILED' : 'PENDING'}`)
  currentState.push(`PostgreSQL Persistence: ${closeout.pmosSaveStatus === 'SUCCEEDED' ? 'ACTIVE' : closeout.pmosSaveStatus === 'FAILED' ? 'FAILED' : 'PENDING'}`)

  const eventLedgerVisibility = artifact.actions.validationsExecuted.some((item) => /event details|event ledger/i.test(item))
    ? 'ACTIVE'
    : artifact.actions.validationsNotExecuted.some((item) => /event details|event ledger/i.test(item))
      ? 'PENDING'
      : 'UNKNOWN'
  currentState.push(`Event Ledger Visibility: ${eventLedgerVisibility}`)

  const isHostedRenderValidation = (value: string): boolean => /render-hosted|onrender|deployed build|render ui verification|shared render environment/i.test(value)

  const renderValidation = artifact.actions.validationsExecuted.some((item) => isHostedRenderValidation(item))
    ? 'VERIFIED'
    : artifact.actions.validationsNotExecuted.some((item) => isHostedRenderValidation(item))
      ? 'PENDING'
      : artifact.findings.blockers.some((item) => isHostedRenderValidation(item))
        ? 'FAILED'
        : 'PENDING'
  currentState.push(`Render Validation: ${renderValidation}`)

  return currentState
}

function buildBridgePayloadText(payload: {
  originalObjective: string
  resultStatus: string
  currentState?: string[]
  completedWork: string[]
  notCompleted: string[]
  keyFindings: string[]
  decisions: string[]
  residualRisks: string[]
  openQuestions: string[]
  recommendedNextDecision: string
}): string {
  return [
    `Task:\n${payload.originalObjective}`,
    '',
    `Result:\n${payload.resultStatus}`,
    '',
    buildHandoffTextSection('CURRENT STATE', payload.currentState ?? []),
    '',
    buildHandoffTextSection('Completed', payload.completedWork),
    '',
    buildHandoffTextSection('Not Completed', payload.notCompleted),
    '',
    buildHandoffTextSection('Findings', payload.keyFindings),
    '',
    buildHandoffTextSection('Decisions', payload.decisions),
    '',
    buildHandoffTextSection('Risks', payload.residualRisks),
    '',
    buildHandoffTextSection('Open Questions', payload.openQuestions),
    '',
    `Recommended Next Decision:\n- ${payload.recommendedNextDecision}`,
  ].join('\n')
}

type PersistedHandoffArtifact = GptHandoffArtifactV1 & {
  createdAtDate: Date
}

function readPersistedHandoffArtifactOrThrow(row: {
  id: string
  artifactKind: PrismaArtifactKind
  artifactNature: PrismaArtifactNature
  version: string
  status: PrismaArtifactStatus
  taskId: string
  conversationId: string
  sourceRefs: Prisma.JsonValue
  payload: Prisma.JsonValue
  createdAt: Date
}): PersistedHandoffArtifact {
  if (!Array.isArray(row.sourceRefs)) {
    throw new Error(`Persisted handoff artifact ${row.id} has invalid sourceRefs`)
  }
  if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
    throw new Error(`Persisted handoff artifact ${row.id} has invalid payload`)
  }

  const candidate: GptHandoffArtifactV1 = {
    id: row.id,
    artifactKind: row.artifactKind,
    artifactNature: row.artifactNature,
    version: row.version,
    status: row.status,
    taskId: row.taskId,
    conversationId: row.conversationId,
    createdAt: row.createdAt.toISOString(),
    sourceRefs: row.sourceRefs as unknown as GptHandoffArtifactV1['sourceRefs'],
    payload: row.payload as unknown as GptHandoffPayloadV1,
  }

  const validation = validateGptHandoffArtifact(candidate)
  if (!validation.valid) {
    throw new Error(`Persisted handoff artifact validation failed: ${validation.errors.join(' | ')}`)
  }

  return {
    ...candidate,
    createdAtDate: row.createdAt,
  }
}

function buildGptHandoffArtifact(artifact: FlightRecordV1, closeout: CloseoutEvidence, closeoutRef: string): GptHandoffArtifactV1 {
  const payload = buildDerivedHandoffPayload(artifact, closeout)

  return {
    id: `${artifact.metadata.conversationId}:${ArtifactKind.HANDOFF}:v1`,
    artifactKind: ArtifactKind.HANDOFF,
    artifactNature: ArtifactNature.DERIVED,
    version: 'v1',
    status: ArtifactStatus.GENERATED,
    taskId: artifact.metadata.taskId,
    conversationId: artifact.metadata.conversationId,
    createdAt: new Date().toISOString(),
    sourceRefs: [
      {
        sourceArtifactKind: ArtifactKind.CLOSEOUT,
        sourceArtifactRef: closeoutRef,
      },
    ],
    payload,
  }
}

async function persistGptHandoffArtifact(params: {
  artifact: FlightRecordV1
  closeout: CloseoutEvidence
  closeoutRef: string
}): Promise<GptHandoffArtifactV1> {
  const handoffArtifact = buildGptHandoffArtifact(params.artifact, params.closeout, params.closeoutRef)
  const validation = validateGptHandoffArtifact(handoffArtifact)

  if (!validation.valid) {
    throw new Error(`GPT handoff artifact validation failed: ${validation.errors.join(' | ')}`)
  }

  await prisma.artifact.upsert({
    where: { id: handoffArtifact.id },
    update: {
      artifactKind: PrismaArtifactKind.HANDOFF,
      artifactNature: PrismaArtifactNature.DERIVED,
      version: handoffArtifact.version,
      status: PrismaArtifactStatus.GENERATED,
      taskId: handoffArtifact.taskId,
      conversationId: handoffArtifact.conversationId,
      sourceRefs: handoffArtifact.sourceRefs as unknown as Prisma.InputJsonValue,
      payload: handoffArtifact.payload as unknown as Prisma.InputJsonValue,
      copyReadyText: handoffArtifact.payload.copyReadyText,
    },
    create: {
      id: handoffArtifact.id,
      artifactKind: PrismaArtifactKind.HANDOFF,
      artifactNature: PrismaArtifactNature.DERIVED,
      version: handoffArtifact.version,
      status: PrismaArtifactStatus.GENERATED,
      taskId: handoffArtifact.taskId,
      conversationId: handoffArtifact.conversationId,
      sourceRefs: handoffArtifact.sourceRefs as unknown as Prisma.InputJsonValue,
      payload: handoffArtifact.payload as unknown as Prisma.InputJsonValue,
      copyReadyText: handoffArtifact.payload.copyReadyText,
    },
  })

  const persisted = await prisma.artifact.findUnique({
    where: { id: handoffArtifact.id },
    select: {
      id: true,
      artifactKind: true,
      artifactNature: true,
      version: true,
      status: true,
      taskId: true,
      conversationId: true,
      sourceRefs: true,
      payload: true,
      createdAt: true,
    },
  })

  if (!persisted) {
    throw new Error(`GPT handoff artifact persistence failed: ${handoffArtifact.id} not found in PostgreSQL after upsert.`)
  }

  const persistedArtifact = readPersistedHandoffArtifactOrThrow(persisted)
  const { createdAtDate: _createdAtDate, createdAt: _persistedCreatedAt, ...persistedComparable } = persistedArtifact
  const { createdAt: _expectedCreatedAt, ...expectedComparable } = handoffArtifact
  const handoffParityDiffs = collectJsonDiffs(expectedComparable, persistedComparable, 'gptHandoffArtifact')
  if (handoffParityDiffs.length > 0) {
    throw new Error([
      `GPT handoff artifact parity failed for ${handoffArtifact.id}`,
      ...handoffParityDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  return handoffArtifact
}

async function finalizeRuntimeContextCloseout(params: {
  artifact: FlightRecordV1
  conversationArtifactSnapshot: FlightRecordV1
  evidence: CloseoutEvidence
  baseName: string
  mdPath: string
  jsonPath: string
  integrityPath: string
  lockPath: string
  traceability: {
    executionTrailPath: string
    executionTrailMarkdownPath: string
    closeoutEvidencePath: string
    pendingArtifactBackupPath: string
  }
}): Promise<void> {
  const { artifact, conversationArtifactSnapshot, evidence, baseName, mdPath, jsonPath, integrityPath, lockPath, traceability } = params

  evidence.vectorRebuildStatus = 'STARTED'
  evidence.vectorRebuildStartedAt = new Date().toISOString()
  appendState(evidence, CloseoutState.VECTOR_REBUILD_STARTED)
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.VECTOR_REBUILD_STARTED, 'PMOS runtime-context rebuild started from canonical PMOS authority.', {
    relatedCommands: ['cd apps/pmos && npm run pmos:context'],
    status: ExecutionTrailEventStatus.STARTED,
    source: 'pmos-save/runtime-context',
  })
  syncFactPreservationEvidence(baseName, evidence)
  writeJson(closeoutEvidencePath!, evidence)

  const snapshot = await readRuntimeAuthoritySnapshot(prisma)
  const runtimeContextContent = renderRuntimeAuthorityMarkdown(snapshot)
  const runtimeContextIntegrity = buildRuntimeAuthorityIntegrity(snapshot, runtimeContextContent)

  ensureDir(path.dirname(RUNTIME_CONTEXT_FILE))
  const runtimeRepair = repairRuntimeContextArtifacts({
    contextFilePath: RUNTIME_CONTEXT_FILE,
    integrityFilePath: RUNTIME_CONTEXT_INTEGRITY_FILE,
    recoveryDir: RUNTIME_RECOVERY_DIR,
    content: runtimeContextContent,
    integrity: runtimeContextIntegrity as unknown as Record<string, unknown>,
    label: baseName,
  })

  const persistedRuntimeIntegrity = readJsonFileSafe<IntegrityMetadata & { runtimeStateHash?: string }>(RUNTIME_CONTEXT_INTEGRITY_FILE)
  if (!persistedRuntimeIntegrity.value) {
    throw new Error(persistedRuntimeIntegrity.error ?? 'Runtime context integrity file missing after write.')
  }

  const verification = verifyTextIntegrity(
    fs.readFileSync(RUNTIME_CONTEXT_FILE, 'utf-8'),
    persistedRuntimeIntegrity.value,
  )

  evidence.vectorRebuildCompletedAt = new Date().toISOString()
  evidence.runtimeContextPath = relativize(RUNTIME_CONTEXT_FILE)
  evidence.runtimeContextIntegrityPath = relativize(RUNTIME_CONTEXT_INTEGRITY_FILE)
  evidence.runtimeContextVerificationSource = 'PMOS runtime authority'
  evidence.runtimeContextIntegrityStatus = verification.status === 'FAIL' ? 'FAIL' : 'PASS'
  if (runtimeRepair.quarantinedPaths.length > 0) {
    evidence.factPreservationNotes.push(`runtime quarantine: ${runtimeRepair.quarantinedPaths.map(relativize).join(', ')}`)
  }

  if (!verification.valid) {
    evidence.vectorRebuildStatus = 'FAILED'
    evidence.vectorRebuildError = 'PMOS runtime-context integrity verification failed after write.'
    appendState(evidence, CloseoutState.VECTOR_REBUILD_FAILED)
    appendState(evidence, CloseoutState.RUNTIME_CONTEXT_VERIFICATION_FAILED)
    appendState(evidence, CloseoutState.CLOSEOUT_FAILED)
    appendState(evidence, CloseoutState.RECOVERY_REQUIRED)
    evidence.recoveryRequired = true
    evidence.recoveryReason = evidence.vectorRebuildError
    evidence.manualRecoveryInstructions = [
      'Inspect apps/pmos/.context/runtime-context.md and its .integrity.json companion.',
      'Rerun cd apps/pmos && npm run pmos:context after resolving the integrity mismatch.',
      'Do not call task_complete. Task state is INCOMPLETE - RECOVERY REQUIRED.',
    ]
    appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.VECTOR_REBUILD_FAILED, 'PMOS runtime-context verification failed.', {
      details: { integrityStatus: verification.status, findings: verification.findings },
      relatedFiles: [evidence.runtimeContextPath, evidence.runtimeContextIntegrityPath].filter(Boolean) as string[],
      status: ExecutionTrailEventStatus.FAILED,
      severity: ExecutionTrailEventSeverity.ERROR,
      source: 'pmos-save/runtime-context',
    })
    syncFactPreservationEvidence(baseName, evidence)
    syncFlightRecordCompletionEvidence(artifact, evidence)
    writeConversationArtifactFiles({ artifact: conversationArtifactSnapshot, baseName, mdPath, jsonPath, integrityPath, lockPath, recoveryDir: QUARANTINE_DIR, traceability })
    writeJson(closeoutEvidencePath!, evidence)
    throw new Error(evidence.vectorRebuildError)
  }

  evidence.vectorRebuildStatus = 'SUCCEEDED'
  evidence.vectorRebuildError = null
  appendState(evidence, CloseoutState.VECTOR_REBUILD_SUCCEEDED)
  appendState(evidence, CloseoutState.RUNTIME_CONTEXT_VERIFIED)
  appendState(evidence, CloseoutState.CLOSEOUT_COMPLETE)
  evidence.closeoutCompletedAt = new Date().toISOString()
  evidence.recoveryRequired = false
  evidence.recoveryReason = null
  evidence.manualRecoveryInstructions = ['Closeout completed in PMOS. No recovery action required.']

  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.VECTOR_REBUILD_SUCCEEDED, 'PMOS runtime-context rebuild succeeded.', {
    details: { runtimeContextPath: evidence.runtimeContextPath },
    relatedFiles: [evidence.runtimeContextPath, evidence.runtimeContextIntegrityPath].filter(Boolean) as string[],
    status: ExecutionTrailEventStatus.SUCCEEDED,
    source: 'pmos-save/runtime-context',
  })
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.CLOSEOUT_COMPLETED, 'Closeout completed after PMOS runtime-context verification passed.', {
    details: { closeoutState: evidence.closeoutState },
    relatedFiles: [traceability.closeoutEvidencePath, evidence.runtimeContextPath, evidence.runtimeContextIntegrityPath].filter(Boolean) as string[],
    status: ExecutionTrailEventStatus.SUCCEEDED,
    source: 'pmos-save/runtime-context',
  })
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.TASK_COMPLETED, 'Task completed with PMOS save and PMOS-owned runtime-context rebuild success.', {
    details: { closeoutState: evidence.closeoutState, runtimeContextIntegrityStatus: evidence.runtimeContextIntegrityStatus },
    status: ExecutionTrailEventStatus.SUCCEEDED,
    source: 'pmos-save/runtime-context',
  })

  syncFactPreservationEvidence(baseName, evidence)
  syncFlightRecordCompletionEvidence(artifact, evidence)

  writeConversationArtifactFiles({ artifact: conversationArtifactSnapshot, baseName, mdPath, jsonPath, integrityPath, lockPath, recoveryDir: QUARANTINE_DIR, traceability })

  writeJson(closeoutEvidencePath!, evidence)
}

async function main() {
  assertDatabaseUrl('pmos:save')
  console.log('[pmos-save] Starting PMOS persistence routine...')

  // 1. Read pending artifact
  if (!fs.existsSync(PENDING_FILE)) {
    console.error(`[pmos-save] ERROR: No pending artifact found at ${PENDING_FILE}`)
    console.error('[pmos-save] Create .pmos/pending-artifact.json before running pmos:save')
    process.exit(1)
  }

  const raw = fs.readFileSync(PENDING_FILE, 'utf-8')
  try {
    artifact = JSON.parse(raw)
  } catch (error) {
    ensureDir(QUARANTINE_DIR)
    const quarantinedPending = quarantineTextArtifact(PENDING_FILE, QUARANTINE_DIR, 'corrupt-pending-artifact')
    console.error('[pmos-save] ❌ CORRUPT PENDING ARTIFACT: pending-artifact.json is not valid JSON.')
    console.error(`[pmos-save]    Parse error: ${(error as Error).message}`)
    if (quarantinedPending) {
      console.error(`[pmos-save]    Quarantined copy: ${relativize(quarantinedPending)}`)
    }
    console.error('[pmos-save]    Fix or replace pending-artifact.json, then rerun npm run pmos:save.')
    process.exit(1)
  }
  if (!artifact) {
    throw new Error('Pending artifact payload is empty.')
  }
  artifact = normalizePendingArtifact(artifact)
  const normalizedPendingArtifactPayload = createCanonicalFlightRecordPayload(artifact)
  const canonicalizationErrors = validateCanonicalizedMetadata(artifact)
  baseName = buildArtifactBaseName(artifact)

  ensureDir(PENDING_BACKUP_DIR)
  ensureDir(FAILED_ARTIFACTS_DIR)
  ensureDir(QUARANTINE_DIR)
  ensureDir(CLOSEOUTS_DIR)
  ensureDir(OPERATIONS_DIR)
  ensureDir(RUNTIME_RECOVERY_DIR)

  console.log(`[pmos-save] Artifact: ${artifact.metadata.conversationId}`)
  console.log(`[pmos-save] Task: ${artifact.metadata.taskId}`)
  console.log(`[pmos-save] ETAP: ${artifact.metadata.etap}`)

  // ── Acquire advisory lock (prevents concurrent pmos-save for same artifact) ─
  acquireAdvisoryLock(artifact.metadata.conversationId)

  const orphanReplayDetected = (
    !fs.existsSync(ACTIVE_CLOSEOUT_FILE)
    && hasCompletedExecutionTrail(baseName)
    && hasMatchingPendingArtifactBackup(baseName, artifact)
  )

  if (orphanReplayDetected) {
    fs.unlinkSync(PENDING_FILE)
    console.log('[pmos-save] ✓ Reconciled orphaned pending-artifact from completed closeout evidence')
    console.log('[pmos-save] ✓ Cleared pending-artifact.json')
    releaseAdvisoryLock()
    console.log('[pmos-save] PMOS persistence COMPLETE.')
    return
  }

  pendingBackupPath = path.join(PENDING_BACKUP_DIR, `${baseName}__backup_${buildRecoverySuffix()}.json`)
  closeoutEvidencePath = path.join(CLOSEOUTS_DIR, `${baseName}.closeout.json`)
  evidence = createInitialEvidence(pendingBackupPath)
  writeJson(closeoutEvidencePath, evidence)

  atomicCopyFile(PENDING_FILE, pendingBackupPath, {
    label: `pending-backup:${baseName}`,
    journalPath: path.join(OPERATIONS_DIR, `${baseName}.pending-backup.json`),
  })
  appendState(evidence, CloseoutState.PENDING_ARTIFACT_CREATED)
  writeJson(closeoutEvidencePath, evidence)
  bootstrapExecutionTrail(baseName, artifact)
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PENDING_ARTIFACT_CREATED, 'Pending artifact created and backed up before PMOS save.', {
    details: { pendingArtifactBackupPath: relativize(pendingBackupPath) },
    status: ExecutionTrailEventStatus.SUCCEEDED,
  })

  // ── GOV-3-2 Hard Governance Validation ─────────────────────────────────────
  // Invalid governance = FAIL SAVE. No warnings. Hard stop.
  console.log('[pmos-save] Running governance validation (GOV-3-2)...')
  const validation = validatePendingArtifact(artifact)
  appendState(evidence, CloseoutState.PMOS_SAVE_STARTED)
  evidence.pmosSaveStatus = 'STARTED'
  evidence.pmosSaveStartedAt = new Date().toISOString()
  syncFactPreservationEvidence(baseName, evidence)
  writeJson(closeoutEvidencePath, evidence)
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PMOS_SAVE_STARTED, 'PMOS save started.', {
    relatedCommands: ['cd apps/pmos && npm run pmos:save'],
    status: ExecutionTrailEventStatus.STARTED,
  })

  if (!validation.valid) {
    // Filter: legacy ETAPs in artifacts are warnings only (historical linege protection)
    const hardErrors = validation.errors.filter((e) => {
      // Allow legacy ETAP names — they are immutable historical records
      if (e.includes('legacy ETAP')) return false
      return true
    })

    if (hardErrors.length > 0) {
      const quarantinePath = copyToRecoveryTarget(
        pendingBackupPath,
        QUARANTINE_DIR,
        `${baseName}__validation-failed_${buildRecoverySuffix()}.json`,
      )
      evidence.pmosSaveStatus = 'FAILED'
      evidence.pmosSaveError = hardErrors.join(' | ')
      evidence.recoveryRequired = true
      evidence.recoveryReason = 'Pending artifact failed governance validation.'
      evidence.manualRecoveryInstructions = [
        'Fix pending-artifact.json and rerun cd apps/pmos && npm run pmos:save.',
        `Inspect backup: ${relativize(pendingBackupPath)}.`,
        quarantinePath ? `Inspect quarantine copy: ${relativize(quarantinePath)}.` : 'Quarantine copy unavailable.',
        'Do not call task_complete. Task state is INCOMPLETE — RECOVERY REQUIRED.',
      ]
      appendState(evidence, CloseoutState.PMOS_SAVE_FAILED)
      appendState(evidence, CloseoutState.RECOVERY_REQUIRED)
      syncFactPreservationEvidence(baseName, evidence)
      writeJson(closeoutEvidencePath, evidence)
      appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PMOS_SAVE_FAILED, 'PMOS save failed governance validation.', {
        details: { errors: hardErrors },
        status: ExecutionTrailEventStatus.FAILED,
        severity: ExecutionTrailEventSeverity.ERROR,
      })
      appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.TASK_INCOMPLETE, 'Task incomplete because PMOS save governance validation failed.', {
        details: { recoveryRequired: true },
        status: ExecutionTrailEventStatus.INCOMPLETE,
        severity: ExecutionTrailEventSeverity.ERROR,
      })
      console.error('\n[pmos-save] ❌ GOVERNANCE FAIL — invalid artifact:')
      hardErrors.forEach((e) => console.error(`  → ${e}`))
      console.error('\n[pmos-save] Fix pending-artifact.json before retrying.')
      console.error('[pmos-save] Run: npm run audit:governance to see full report.')
      throw new Error(`Governance validation failed: ${hardErrors.join(' | ')}`)
    }

    // Legacy ETAPs: warn but allow (immutable historical lineage)
    const legacyWarnings = validation.errors.filter((e) => e.includes('legacy ETAP'))
    if (legacyWarnings.length > 0) {
      console.warn('[pmos-save] ⚠️  Legacy ETAP detected (historical artifact — allowed):')
      legacyWarnings.forEach((w) => console.warn(`  → ${w}`))
    }
  }

  if (canonicalizationErrors.length > 0) {
    const quarantinePath = copyToRecoveryTarget(
      pendingBackupPath,
      QUARANTINE_DIR,
      `${baseName}__canonicalization-failed_${buildRecoverySuffix()}.json`,
    )
    evidence.pmosSaveStatus = 'FAILED'
    evidence.pmosSaveError = canonicalizationErrors.join(' | ')
    evidence.recoveryRequired = true
    evidence.recoveryReason = 'Pending artifact normalization did not resolve to canonical PMOS metadata.'
    evidence.manualRecoveryInstructions = [
      'Fix the non-canonical metadata values in pending-artifact.json and rerun cd apps/pmos && npm run pmos:save.',
      `Inspect backup: ${relativize(pendingBackupPath)}.`,
      quarantinePath ? `Inspect quarantine copy: ${relativize(quarantinePath)}.` : 'Quarantine copy unavailable.',
      'Do not call task_complete. Task state is INCOMPLETE — RECOVERY REQUIRED.',
    ]
    appendState(evidence, CloseoutState.PMOS_SAVE_FAILED)
    appendState(evidence, CloseoutState.RECOVERY_REQUIRED)
    syncFactPreservationEvidence(baseName, evidence)
    writeJson(closeoutEvidencePath, evidence)
    appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PMOS_SAVE_FAILED, 'Pending artifact normalization did not resolve to canonical PMOS metadata.', {
      details: { errors: canonicalizationErrors },
      status: ExecutionTrailEventStatus.FAILED,
      severity: ExecutionTrailEventSeverity.ERROR,
    })
    appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.TASK_INCOMPLETE, 'Task incomplete because PMOS normalization did not resolve to canonical metadata.', {
      details: { recoveryRequired: true },
      status: ExecutionTrailEventStatus.INCOMPLETE,
      severity: ExecutionTrailEventSeverity.ERROR,
    })
    console.error('\n[pmos-save] ❌ CANONICALIZATION FAIL — normalized metadata is still non-canonical:')
    canonicalizationErrors.forEach((error) => console.error(`  → ${error}`))
    throw new Error(`Canonicalization validation failed: ${canonicalizationErrors.join(' | ')}`)
  }
  appendState(evidence, CloseoutState.PENDING_ARTIFACT_VALIDATED)
  writeJson(closeoutEvidencePath, evidence)
  console.log('[pmos-save] ✓ Governance validation passed.')

  // 2. Write auxiliary archive artifacts first. Postgres remains the only
  // canonical source of truth, but helper artifacts can be generated before the
  // final DB upsert as long as DB persistence stays fail-closed.
  if (!fs.existsSync(CONVERSATIONS_DIR)) {
    fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true })
  }

  const mdPath = path.join(CONVERSATIONS_DIR, `${baseName}.md`)
  const jsonPath = path.join(CONVERSATIONS_DIR, `${baseName}.json`)
  const lockPath = path.join(CONVERSATIONS_DIR, `${baseName}.lock.json`)
  const integrityPath = path.join(CONVERSATIONS_DIR, `${baseName}.integrity.json`)
  console.log(`[pmos-save] Artifact filename base: ${baseName}`)
  const conversationMdPath = `apps/pmos/.pmos/conversations/${buildArtifactBaseName(artifact)}.md`

  const trailPaths = getExecutionTrailPaths(baseName)
  // Phase D — Immutable artifact lock: if lock already exists, verify before overwriting
  if (fs.existsSync(lockPath)) {
    const existingLock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'))
    const lockResult = verifyArtifactLock(artifact, existingLock)
    if (!lockResult.valid) {
      evidence.pmosSaveStatus = 'FAILED'
      evidence.pmosSaveError = 'Immutable artifact violation — artifact content changed since lock.'
      evidence.recoveryRequired = true
      evidence.recoveryReason = 'Artifact content changed after immutable lock.'
      appendState(evidence, CloseoutState.PMOS_SAVE_FAILED)
      appendState(evidence, CloseoutState.RECOVERY_REQUIRED)
      writeJson(closeoutEvidencePath, evidence)
      console.error(`[pmos-save] ❌ IMMUTABLE ARTIFACT VIOLATION: artifact ${artifact.metadata.conversationId} has been mutated since lock`)
      console.error(`[pmos-save]   Expected hash: ${existingLock.integrityHash}`)
      console.error(`[pmos-save]   Actual hash:   ${lockResult.computedHash}`)
      console.error(`[pmos-save]   Locked since:  ${existingLock.immutableSince}`)
      throw new Error('Immutable artifact violation')
    }
    console.log(`[pmos-save] ✓ Immutable artifact lock verified (no mutation)`)
  }

  const traceability = {
    executionTrailPath: relativize(trailPaths.jsonlPath),
    executionTrailMarkdownPath: relativize(trailPaths.markdownPath),
    closeoutEvidencePath: relativize(closeoutEvidencePath),
    pendingArtifactBackupPath: relativize(pendingBackupPath),
  }

  syncFlightRecordCompletionEvidence(artifact, evidence)
  writeConversationArtifactFiles({ artifact, baseName, mdPath, jsonPath, integrityPath, lockPath, recoveryDir: QUARANTINE_DIR, traceability })

  console.log(`[pmos-save] ✓ .md artifact: ${mdPath}`)
  console.log(`[pmos-save] ✓ .json artifact: ${jsonPath}`)
  console.log(`[pmos-save] ✓ .integrity.json: ${integrityPath}`)
  console.log(`[pmos-save] ✓ .lock.json: ${lockPath}`)

  evidence.pmosSaveConversationMdPath = relativize(mdPath)
  evidence.pmosSaveConversationJsonPath = relativize(jsonPath)
  evidence.pmosSaveIntegrityPath = relativize(integrityPath)
  evidence.pmosSaveLockPath = relativize(lockPath)
  evidence.pmosSaveArtifactPaths = [
    evidence.pmosSaveConversationMdPath,
    evidence.pmosSaveConversationJsonPath,
    evidence.pmosSaveIntegrityPath,
    evidence.pmosSaveLockPath,
  ]

  const archiveCheck = validateConversationArtifactSet(path.join(CONVERSATIONS_DIR, baseName))
  evidence.archiveCompletenessStatus = archiveCheck.status
  evidence.archiveCompletenessErrors = archiveCheck.issues.map((issue) => `${issue.severity}: ${issue.message}`)
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.ARTIFACT_CREATED, 'Conversation archive artifacts written.', {
    relatedFiles: [relativize(mdPath), relativize(jsonPath), relativize(integrityPath), relativize(lockPath)],
    status: ExecutionTrailEventStatus.SUCCEEDED,
  })

  if (archiveCheck.status !== 'PASS') {
    evidence.pmosSaveStatus = 'PARTIAL'
    evidence.recoveryRequired = true
    evidence.recoveryReason = 'Archive completeness check did not pass for the freshly written artifact.'
    evidence.manualRecoveryInstructions = [
      'Inspect the freshly written archive artifact and sidecars.',
      'Run npm run recovery:check-archive -- --base ' + baseName,
      'Do not delete pending-artifact.json. Task state is INCOMPLETE — RECOVERY REQUIRED.',
    ]
    appendState(evidence, CloseoutState.PMOS_SAVE_PARTIAL)
    appendState(evidence, CloseoutState.CLOSEOUT_PARTIAL)
    appendState(evidence, CloseoutState.RECOVERY_REQUIRED)
    syncFactPreservationEvidence(baseName, evidence)
    writeJson(closeoutEvidencePath, evidence)
    appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PMOS_SAVE_FAILED, 'Archive completeness check did not pass for the freshly written artifact.', {
      details: { archiveCompletenessStatus: archiveCheck.status, archiveCompletenessErrors: evidence.archiveCompletenessErrors },
      status: ExecutionTrailEventStatus.PARTIAL,
      severity: ExecutionTrailEventSeverity.ERROR,
    })
    throw new Error(`Archive completeness check ${archiveCheck.status}`)
  }

  evidence.pmosSaveStatus = 'SUCCEEDED'
  evidence.pmosSaveCompletedAt = new Date().toISOString()
  evidence.recoveryRequired = false
  evidence.recoveryReason = null
  evidence.manualRecoveryInstructions = [
    'Continue closeout with PMOS-owned runtime-context finalization inside pmos-save.',
    'Do not call task_complete until closeoutState = CLOSEOUT_COMPLETE.',
  ]
  appendState(evidence, CloseoutState.PMOS_SAVE_SUCCEEDED)
  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PMOS_SAVE_SUCCEEDED, 'PMOS save succeeded and archive artifacts passed completeness check.', {
    details: { archiveCompletenessStatus: archiveCheck.status },
    relatedFiles: evidence.pmosSaveArtifactPaths,
    status: ExecutionTrailEventStatus.SUCCEEDED,
  })
  syncFactPreservationEvidence(baseName, evidence)
  syncFlightRecordCompletionEvidence(artifact, evidence)

  writeConversationArtifactFiles({ artifact, baseName, mdPath, jsonPath, integrityPath, lockPath, traceability })

  // 3. Persist the final canonical FlightRecordV1 to Postgres.
  const canonicalFlightRecordPayload = createCanonicalFlightRecordPayload(artifact)
  const pendingArtifactSharedDiffs = collectJsonDiffs(
    stripCompletionEvidence(normalizedPendingArtifactPayload),
    stripCompletionEvidence(canonicalFlightRecordPayload),
    'pendingArtifact',
  )
  if (pendingArtifactSharedDiffs.length > 0) {
    throw new Error([
      `PendingArtifact parity failed for ${artifact.metadata.conversationId}`,
      ...pendingArtifactSharedDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  const closeoutCompletionDiffs = collectJsonDiffs(
    canonicalFlightRecordPayload.completionEvidence,
    projectFlightRecordCompletionEvidence(evidence),
    'completionEvidence',
  )
  if (closeoutCompletionDiffs.length > 0) {
    throw new Error([
      `Closeout completion evidence drift detected for ${artifact.metadata.conversationId}`,
      ...closeoutCompletionDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  const jsonMirrorBeforeDb = readConversationJsonArtifactOrThrow(jsonPath)
  const preDbMirrorDiffs = collectJsonDiffs(canonicalFlightRecordPayload, jsonMirrorBeforeDb, 'conversationJsonMirror')
  if (preDbMirrorDiffs.length > 0) {
    throw new Error([
      `Conversation JSON mirror drift detected before DB persistence for ${artifact.metadata.conversationId}`,
      ...preDbMirrorDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  const persistenceProjection = buildConversationArtifactProjection(artifact, conversationMdPath, canonicalFlightRecordPayload, evidence)
  const mutableProjection = buildConversationArtifactMutableProjection(artifact, conversationMdPath, evidence)
  const relationCreateWrites = buildConversationArtifactRelationCreateWrites(artifact)
  const relationUpdateWrites = buildConversationArtifactRelationUpdateWrites(artifact)
  const existing = await prisma.conversationArtifact.findUnique({
    where: { conversationId: artifact.metadata.conversationId },
    select: {
      id: true,
      conversationId: true,
      flightRecordJson: true,
    },
  })

  if (existing) {
    if (existing.flightRecordJson != null) {
      const immutableSnapshotDiffs = collectJsonDiffs(canonicalFlightRecordPayload, existing.flightRecordJson)
      if (immutableSnapshotDiffs.length > 0) {
        throw new Error([
          `Immutable flightRecordJson violation for ${artifact.metadata.conversationId}`,
          'ConversationArtifact already contains a canonical PMOS snapshot and the incoming save would change it.',
          ...immutableSnapshotDiffs.map((diff) => `- ${diff}`),
        ].join('\n'))
      }

      const updated = await prisma.conversationArtifact.update({
        where: { conversationId: artifact.metadata.conversationId },
        data: {
          ...mutableProjection,
          ...relationUpdateWrites,
        },
      })
      persistedDbRecordId = updated.id
    } else {
      const updated = await prisma.conversationArtifact.update({
        where: { conversationId: artifact.metadata.conversationId },
        data: {
          ...persistenceProjection,
          ...relationUpdateWrites,
        },
      })
      persistedDbRecordId = updated.id
    }
  } else {
    const created = await prisma.conversationArtifact.create({
      data: {
        conversationId: artifact.metadata.conversationId,
        ...persistenceProjection,
        ...relationCreateWrites,
      },
    })
    persistedDbRecordId = created.id
  }

  evidence.pmosSaveDbRecordId = persistedDbRecordId
  writeJson(closeoutEvidencePath, evidence)

  const persistedRecord = await prisma.conversationArtifact.findUnique({
    where: { conversationId: artifact.metadata.conversationId },
    select: {
      conversationId: true,
      timestamp: true,
      project: true,
      taskId: true,
      scope: true,
      etap: true,
      subetap: true,
      conversationType: true,
      importanceLevel: true,
      userPrompt: true,
      llmResponse: true,
      summary: true,
      filesPath: true,
      flightRecordJson: true,
    },
  })

  if (!persistedRecord) {
    throw new Error(`DB read-back failed for ${artifact.metadata.conversationId}`)
  }

  const saveIntegrityDiffs = collectJsonDiffs(canonicalFlightRecordPayload, persistedRecord.flightRecordJson)
  if (saveIntegrityDiffs.length > 0) {
    throw new Error([
      `Save integrity validation failed for ${artifact.metadata.conversationId}`,
      ...saveIntegrityDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  const dbScalarParityDiffs = collectJsonDiffs(
    {
      metadata: canonicalFlightRecordPayload.metadata,
      task: canonicalFlightRecordPayload.task,
      analysis: {
        ...canonicalFlightRecordPayload.analysis,
        reasoningSummary: buildConversationArtifactSummary(canonicalFlightRecordPayload, evidence),
      },
      summary: buildConversationArtifactSummary(canonicalFlightRecordPayload, evidence),
      filesPath: conversationMdPath,
    },
    projectConversationArtifactScalarParity(persistedRecord),
    'conversationArtifactRow',
  )
  if (dbScalarParityDiffs.length > 0) {
    throw new Error([
      `ConversationArtifact scalar parity failed for ${artifact.metadata.conversationId}`,
      ...dbScalarParityDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  const reconstructedFlightRecord = reconstructFlightRecordFromDbOrThrow(persistedRecord)
  const postDbMirrorDiffs = collectJsonDiffs(canonicalFlightRecordPayload, readConversationJsonArtifactOrThrow(jsonPath), 'conversationJsonMirror')
  if (postDbMirrorDiffs.length > 0) {
    throw new Error([
      `Conversation JSON mirror drift detected after DB persistence for ${artifact.metadata.conversationId}`,
      ...postDbMirrorDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  console.log('[pmos-save] ✓ DB record persisted.')
  writeJson(closeoutEvidencePath, evidence)

  writeJson(ACTIVE_CLOSEOUT_FILE, {
    conversationId: artifact.metadata.conversationId,
    taskId: artifact.metadata.taskId,
    closeoutEvidencePath: relativize(closeoutEvidencePath),
    createdAt: new Date().toISOString(),
  })

  await finalizeRuntimeContextCloseout({
    artifact,
    conversationArtifactSnapshot: canonicalFlightRecordPayload,
    evidence,
    baseName,
    mdPath,
    jsonPath,
    integrityPath,
    lockPath,
    traceability,
  })

  const postCloseoutMirrorDiffs = collectJsonDiffs(canonicalFlightRecordPayload, readConversationJsonArtifactOrThrow(jsonPath), 'conversationJsonMirror')
  if (postCloseoutMirrorDiffs.length > 0) {
    throw new Error([
      `Conversation JSON mirror drift detected after runtime-context closeout for ${artifact.metadata.conversationId}`,
      ...postCloseoutMirrorDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  const persistedHandoff = await persistGptHandoffArtifact({
    artifact,
    closeout: evidence,
    closeoutRef: relativize(closeoutEvidencePath),
  })

  writeConversationArtifactFiles({
    artifact: canonicalFlightRecordPayload,
    baseName,
    mdPath,
    jsonPath,
    integrityPath,
    lockPath,
    recoveryDir: QUARANTINE_DIR,
    handoff: persistedHandoff,
    traceability,
  })

  const postHandoffMirrorDiffs = collectJsonDiffs(canonicalFlightRecordPayload, readConversationJsonArtifactOrThrow(jsonPath), 'conversationJsonMirror')
  if (postHandoffMirrorDiffs.length > 0) {
    throw new Error([
      `Conversation JSON mirror drift detected after GPT handoff persistence for ${artifact.metadata.conversationId}`,
      ...postHandoffMirrorDiffs.map((diff) => `- ${diff}`),
    ].join('\n'))
  }

  appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.ARTIFACT_CREATED, 'GPT handoff artifact generated from finalized closeout state.', {
    details: {
      artifactKind: ArtifactKind.HANDOFF,
      artifactId: persistedHandoff.id,
      closeoutState: evidence.closeoutState,
    },
    status: ExecutionTrailEventStatus.SUCCEEDED,
    source: 'pmos-save/handoff',
  })

  writeJson(closeoutEvidencePath, evidence)

  // 4. Clear pending artifact
  fs.unlinkSync(PENDING_FILE)
  console.log('[pmos-save] ✓ Cleared pending-artifact.json')

  if (fs.existsSync(ACTIVE_CLOSEOUT_FILE)) {
    fs.unlinkSync(ACTIVE_CLOSEOUT_FILE)
  }

  // 5. Release advisory lock
  releaseAdvisoryLock()

  console.log('[pmos-save] PMOS persistence COMPLETE.')
}

main()
  .catch((e) => {
    const error = e as Error
    if (artifact && evidence && closeoutEvidencePath) {
      const recoveryCopy = copyToRecoveryTarget(
        pendingBackupPath ?? PENDING_FILE,
        evidence.pmosSaveStatus === 'FAILED' ? QUARANTINE_DIR : FAILED_ARTIFACTS_DIR,
        `${baseName}__recovery_${buildRecoverySuffix()}.json`,
      )

      if (evidence.pmosSaveStatus !== 'PARTIAL' && evidence.pmosSaveStatus !== 'FAILED') {
        evidence.pmosSaveStatus = persistedDbRecordId || evidence.pmosSaveConversationMdPath ? 'PARTIAL' : 'FAILED'
      }
      if (!evidence.pmosSaveError) evidence.pmosSaveError = error.message
      evidence.recoveryRequired = true
      if (!evidence.recoveryReason) evidence.recoveryReason = error.message
      evidence.manualRecoveryInstructions = [
        'Inspect the closeout evidence sidecar and archive paths recorded in recovery/closeouts.',
        pendingBackupPath ? `Restore or inspect backup: ${relativize(pendingBackupPath)}.` : 'Pending-artifact backup unavailable.',
        recoveryCopy ? `Inspect recovery copy: ${relativize(recoveryCopy)}.` : 'Recovery copy unavailable.',
        'Do not call task_complete. Task state is INCOMPLETE — RECOVERY REQUIRED.',
      ]

      if (evidence.pmosSaveStatus === 'PARTIAL') {
        appendState(evidence, CloseoutState.PMOS_SAVE_PARTIAL)
        appendState(evidence, CloseoutState.CLOSEOUT_PARTIAL)
      } else {
        appendState(evidence, CloseoutState.PMOS_SAVE_FAILED)
        appendState(evidence, CloseoutState.CLOSEOUT_FAILED)
      }
      appendState(evidence, CloseoutState.RECOVERY_REQUIRED)
      appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.PMOS_SAVE_FAILED, 'PMOS save failed or produced a partial result.', {
        details: { error: error.message, pmosSaveStatus: evidence.pmosSaveStatus },
        status: evidence.pmosSaveStatus === 'PARTIAL' ? ExecutionTrailEventStatus.PARTIAL : ExecutionTrailEventStatus.FAILED,
        severity: ExecutionTrailEventSeverity.ERROR,
      })
      appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.RECOVERY_REQUIRED, 'Recovery required after PMOS save failure or partial state.', {
        details: { recoveryReason: evidence.recoveryReason },
        status: ExecutionTrailEventStatus.BLOCKED,
        severity: ExecutionTrailEventSeverity.CRITICAL,
      })
      appendTrailEventSafe(baseName, artifact.metadata.taskId, ExecutionTrailEventType.TASK_INCOMPLETE, 'Task incomplete because PMOS closeout did not complete.', {
        details: { closeoutEvidencePath: closeoutEvidencePath ? relativize(closeoutEvidencePath) : null },
        status: ExecutionTrailEventStatus.INCOMPLETE,
        severity: ExecutionTrailEventSeverity.ERROR,
      })
      syncFactPreservationEvidence(baseName, evidence)
      writeJson(closeoutEvidencePath, evidence)
    }

    console.error('[pmos-save] FATAL:', e)
    releaseAdvisoryLock()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
