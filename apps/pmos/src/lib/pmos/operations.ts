import fs from 'fs'
import path from 'path'

import {
  verifyArtifactLock,
  verifyObjectIntegrity,
  verifyTextIntegrity,
  type ArtifactLockMetadata,
  type CloseoutEvidence,
  type IntegrityMetadata,
} from '../../../../../packages/governance/src'

import { validateConversationArtifactSet } from './archive-completeness'
import { readJsonFileSafe } from './atomic-io'
import { readCanonicalFlightRecord } from './flight-record-read'

const APP_ROOT = process.cwd()
const PMOS_DIR = path.join(APP_ROOT, '.pmos')
const CONVERSATIONS_DIR = path.join(PMOS_DIR, 'conversations')
const RECOVERY_DIR = path.join(PMOS_DIR, 'recovery')
const CLOSEOUTS_DIR = path.join(RECOVERY_DIR, 'closeouts')
const REPAIRS_DIR = path.join(RECOVERY_DIR, 'repairs')
const PENDING_BACKUP_DIR = path.join(RECOVERY_DIR, 'pending-artifacts')
const FAILED_ARTIFACTS_DIR = path.join(RECOVERY_DIR, 'failed-artifacts')
const QUARANTINE_DIR = path.join(RECOVERY_DIR, 'quarantine')
const PENDING_ARTIFACT_FILE = path.join(PMOS_DIR, 'pending-artifact.json')
const CONTEXT_DIR = path.join(APP_ROOT, '.context')
const CONTEXT_FILE = path.join(CONTEXT_DIR, 'runtime-context.md')
const CONTEXT_INTEGRITY_FILE = path.join(CONTEXT_DIR, 'runtime-context.integrity.json')
const ADVISORY_LOCK_FILE = path.join(PMOS_DIR, '.pmos-save.lock')

export type VerificationStatus = 'PASS' | 'WARN' | 'FAIL'

export interface PmosLifecyclePolicy {
  archiveRetention: string
  archiveCompaction: string
  archiveHousekeeping: string
}

export interface PmosMetrics {
  conversationArtifacts: number
  closeouts: number
  recoveryArtifacts: number
  repairActions: number
  repairFailures: number
  archiveGrowthBytes: number
  runtimeRebuildCount: number
}

export interface RuntimeVerificationSnapshot {
  status: VerificationStatus
  runtime: {
    status: VerificationStatus
    contextExists: boolean
    integrityExists: boolean
    integrityVerified: boolean
    lastGeneratedAt: string | null
  }
  handoff: {
    status: VerificationStatus
    pendingArtifactExists: boolean
    pendingArtifactOccupied: boolean
    pendingArtifactValid: boolean
    advisoryLockPresent: boolean
  }
  lifecycle: PmosLifecyclePolicy
}

export interface EstateAuditSnapshot {
  status: VerificationStatus
  archive: {
    status: VerificationStatus
    conversationCount: number
    invalidArtifacts: number
    warnings: number
  }
  integrity: {
    status: VerificationStatus
    missingIntegrity: number
    missingLocks: number
    corruptedIntegrity: number
    corruptedLocks: number
  }
  closeouts: {
    status: VerificationStatus
    expected: number
    present: number
    missing: number
    recoveryRequired: number
  }
  recovery: {
    status: VerificationStatus
    pendingBackups: number
    failedArtifacts: number
    quarantinedArtifacts: number
    repairRuns: number
    latestRepairAt: string | null
  }
  maintenance: {
    status: VerificationStatus
    staleLocks: number
    orphanTempFiles: number
    abandonedJournals: number
  }
  metrics: PmosMetrics
  lifecycle: PmosLifecyclePolicy
}

export interface PmosStatusSnapshot {
  status: VerificationStatus
  runtimeVerification: RuntimeVerificationSnapshot
  estateAudit: EstateAuditSnapshot
}

export interface RepairRunRecord {
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
  evidencePath: string
}

export interface MaintenanceResult {
  staleLocksRemoved: string[]
  orphanTempFilesRemoved: string[]
  abandonedJournalsRemoved: string[]
}

function safeListDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []

  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else {
      results.push(fullPath)
    }
  }

  return results
}

function countFilesRecursively(dir: string): { count: number; bytes: number } {
  if (!fs.existsSync(dir)) return { count: 0, bytes: 0 }

  let count = 0
  let bytes = 0

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = countFilesRecursively(fullPath)
      count += nested.count
      bytes += nested.bytes
    } else {
      count += 1
      bytes += fs.statSync(fullPath).size
    }
  }

  return { count, bytes }
}

function resolveStatus(hasErrors: boolean, hasWarnings: boolean): VerificationStatus {
  if (hasErrors) return 'FAIL'
  if (hasWarnings) return 'WARN'
  return 'PASS'
}

export function deriveRuntimeVerificationStatus(sectionStatuses: VerificationStatus[]): VerificationStatus {
  return resolveStatus(sectionStatuses.includes('FAIL'), sectionStatuses.includes('WARN'))
}

export function deriveEstateAuditStatus(sectionStatuses: VerificationStatus[]): VerificationStatus {
  return resolveStatus(sectionStatuses.includes('FAIL'), sectionStatuses.includes('WARN'))
}

export function deriveOperatorSummaryStatus(runtimeStatus: VerificationStatus, estateStatus: VerificationStatus): VerificationStatus {
  return resolveStatus(runtimeStatus === 'FAIL', runtimeStatus === 'WARN' || estateStatus !== 'PASS')
}

export function deriveHealthStatus(runtimeStatus: VerificationStatus): VerificationStatus {
  return runtimeStatus
}

export function shouldExitOnStrictVerification(status: VerificationStatus): boolean {
  return status !== 'PASS'
}

function collectConversationBaseNames(): string[] {
  return safeListDir(CONVERSATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.json') && !fileName.endsWith('.integrity.json') && !fileName.endsWith('.lock.json'))
    .map((fileName) => fileName.replace(/\.json$/, ''))
    .sort()
}

function readRuntimeIntegrityMeta(): (IntegrityMetadata & { generatedAt?: string }) | null {
  return readJsonFileSafe<IntegrityMetadata & { generatedAt?: string }>(CONTEXT_INTEGRITY_FILE).value
}

export function readRepairHistory(limit = 500): RepairRunRecord[] {
  return safeListDir(REPAIRS_DIR)
    .filter((fileName) => /^repair-run-.*\.json$/.test(fileName))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((fileName) => {
      const fullPath = path.join(REPAIRS_DIR, fileName)
      const parsed = readJsonFileSafe<{
        startedAt: string
        completedAt: string | null
        durationMs?: number | null
        requestedAreas: string[]
        baseName: string | null
        repairedArtifacts: string[]
        preservedArtifacts: string[]
        failures: string[]
        repairReason?: string
        repairResult?: 'PASS' | 'FAIL'
        repairCount?: number
      }>(fullPath)

      const value = parsed.value ?? {
        startedAt: new Date(0).toISOString(),
        completedAt: null,
        requestedAreas: [],
        baseName: null,
        repairedArtifacts: [],
        preservedArtifacts: [],
        failures: [parsed.error ?? 'Unreadable repair evidence'],
      }

      return {
        startedAt: value.startedAt,
        completedAt: value.completedAt,
        durationMs: typeof value.durationMs === 'number'
          ? value.durationMs
          : value.completedAt
            ? new Date(value.completedAt).getTime() - new Date(value.startedAt).getTime()
            : null,
        requestedAreas: value.requestedAreas,
        baseName: value.baseName,
        repairedArtifacts: value.repairedArtifacts,
        preservedArtifacts: value.preservedArtifacts,
        failures: value.failures,
        repairReason: value.repairReason ?? 'operator-requested',
        repairResult: value.repairResult ?? (value.failures.length > 0 ? 'FAIL' : 'PASS'),
        repairCount: value.repairCount ?? value.repairedArtifacts.length,
        evidencePath: fullPath,
      }
    })
}

export function buildLifecyclePolicy(): PmosLifecyclePolicy {
  return {
    archiveRetention: 'retain canonical conversation artifacts indefinitely; retain recovery and repair evidence for operator forensics',
    archiveCompaction: 'compact only operational residue and stale journals outside canonical archive artifacts',
    archiveHousekeeping: 'use pmos:maintenance to clean stale locks, orphan temp files, and abandoned journals without mutating canonical archive history',
  }
}

export function findMaintenanceCandidates(): {
  staleLocks: string[]
  orphanTempFiles: string[]
  abandonedJournals: string[]
} {
  const staleLocks: string[] = []
  const orphanTempFiles: string[] = []
  const abandonedJournals: string[] = []
  const staleThresholdMs = 24 * 60 * 60 * 1000

  if (fs.existsSync(ADVISORY_LOCK_FILE)) {
    const ageMs = Date.now() - fs.statSync(ADVISORY_LOCK_FILE).mtimeMs
    if (ageMs > staleThresholdMs) {
      staleLocks.push(ADVISORY_LOCK_FILE)
    }
  }

  for (const filePath of [...walkDir(PMOS_DIR), ...walkDir(CONTEXT_DIR)]) {
    const name = path.basename(filePath)
    if (name.includes('.pmos-tmp-')) {
      orphanTempFiles.push(filePath)
    }
    if (name.endsWith('.write.json') || name.endsWith('.copy.json') || name.endsWith('.archive-repair.json') || name.endsWith('.closeout-repair.json')) {
      const ageMs = Date.now() - fs.statSync(filePath).mtimeMs
      if (ageMs > staleThresholdMs) {
        abandonedJournals.push(filePath)
      }
    }
  }

  return { staleLocks, orphanTempFiles, abandonedJournals }
}

function readPendingArtifactState(): {
  status: VerificationStatus
  exists: boolean
  occupied: boolean
  valid: boolean
} {
  if (!fs.existsSync(PENDING_ARTIFACT_FILE)) {
    return { status: 'PASS', exists: false, occupied: false, valid: true }
  }

  const raw = fs.readFileSync(PENDING_ARTIFACT_FILE, 'utf-8').trim()
  if (raw.length === 0) {
    return { status: 'PASS', exists: true, occupied: false, valid: true }
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return { status: 'FAIL', exists: true, occupied: true, valid: false }
    }

    const occupied = Object.keys(parsed).length > 0
    return {
      status: occupied ? 'FAIL' : 'PASS',
      exists: true,
      occupied,
      valid: true,
    }
  } catch {
    return { status: 'FAIL', exists: true, occupied: true, valid: false }
  }
}

export function performMaintenanceCleanup(): MaintenanceResult {
  const candidates = findMaintenanceCandidates()
  const remove = (filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  candidates.staleLocks.forEach(remove)
  candidates.orphanTempFiles.forEach(remove)
  candidates.abandonedJournals.forEach(remove)

  return {
    staleLocksRemoved: candidates.staleLocks,
    orphanTempFilesRemoved: candidates.orphanTempFiles,
    abandonedJournalsRemoved: candidates.abandonedJournals,
  }
}

export function collectRuntimeVerificationSnapshot(): RuntimeVerificationSnapshot {
  const runtimeContextExists = fs.existsSync(CONTEXT_FILE)
  const runtimeIntegrityExists = fs.existsSync(CONTEXT_INTEGRITY_FILE)
  const runtimeIntegrityMeta = readRuntimeIntegrityMeta()
  const runtimeContent = runtimeContextExists ? fs.readFileSync(CONTEXT_FILE, 'utf-8') : null
  const runtimeIntegrityVerified = Boolean(runtimeContent && runtimeIntegrityMeta && verifyTextIntegrity(runtimeContent, runtimeIntegrityMeta).valid)
  const pendingArtifactState = readPendingArtifactState()

  const runtimeStatus = resolveStatus(
    !runtimeContextExists || !runtimeIntegrityExists || !runtimeIntegrityVerified,
    false,
  )
  const handoffStatus = resolveStatus(
    !pendingArtifactState.valid || pendingArtifactState.occupied,
    false,
  )

  return {
    status: deriveRuntimeVerificationStatus([runtimeStatus, handoffStatus]),
    runtime: {
      status: runtimeStatus,
      contextExists: runtimeContextExists,
      integrityExists: runtimeIntegrityExists,
      integrityVerified: runtimeIntegrityVerified,
      lastGeneratedAt: runtimeIntegrityMeta?.generatedAt ?? null,
    },
    handoff: {
      status: handoffStatus,
      pendingArtifactExists: pendingArtifactState.exists,
      pendingArtifactOccupied: pendingArtifactState.occupied,
      pendingArtifactValid: pendingArtifactState.valid,
      advisoryLockPresent: fs.existsSync(ADVISORY_LOCK_FILE),
    },
    lifecycle: buildLifecyclePolicy(),
  }
}

export function collectEstateAuditSnapshot(): EstateAuditSnapshot {
  const baseNames = collectConversationBaseNames()
  let invalidArtifacts = 0
  let archiveWarnings = 0
  let missingIntegrity = 0
  let missingLocks = 0
  let corruptedIntegrity = 0
  let corruptedLocks = 0
  let closeoutsMissing = 0
  let closeoutsRecoveryRequired = 0

  for (const baseName of baseNames) {
    const basePath = path.join(CONVERSATIONS_DIR, baseName)
    const archiveResult = validateConversationArtifactSet(basePath)
    if (archiveResult.status === 'FAIL') invalidArtifacts += 1
    if (archiveResult.status === 'WARNING') archiveWarnings += 1

    const jsonPath = `${basePath}.json`
    const integrityPath = `${basePath}.integrity.json`
    const lockPath = `${basePath}.lock.json`
    const closeoutPath = path.join(CLOSEOUTS_DIR, `${baseName}.closeout.json`)

    const artifactRaw = readJsonFileSafe<unknown>(jsonPath)
    const artifact = artifactRaw.value ? readCanonicalFlightRecord(artifactRaw.value) : null
    const integrity = readJsonFileSafe<IntegrityMetadata>(integrityPath)
    const lock = readJsonFileSafe<ArtifactLockMetadata>(lockPath)

    if (!fs.existsSync(integrityPath)) missingIntegrity += 1
    if (!fs.existsSync(lockPath)) missingLocks += 1
    if (fs.existsSync(integrityPath) && (!integrity.value || !artifact || !verifyObjectIntegrity(artifact, integrity.value).valid)) corruptedIntegrity += 1
    if (fs.existsSync(lockPath) && (!lock.value || !artifact || !verifyArtifactLock(artifact, lock.value).valid)) corruptedLocks += 1

    if (!fs.existsSync(closeoutPath)) {
      closeoutsMissing += 1
    } else {
      const closeout = readJsonFileSafe<CloseoutEvidence>(closeoutPath)
      if (!closeout.value || closeout.value.recoveryRequired) {
        closeoutsRecoveryRequired += 1
      }
    }
  }

  const repairHistory = readRepairHistory(500)
  const maintenanceCandidates = findMaintenanceCandidates()
  const recoveryArtifacts = countFilesRecursively(PENDING_BACKUP_DIR).count
    + countFilesRecursively(FAILED_ARTIFACTS_DIR).count
    + countFilesRecursively(QUARANTINE_DIR).count
  const repairsCount = repairHistory.length
  const repairFailures = repairHistory.filter((repair) => repair.repairResult === 'FAIL').length
  const archiveGrowth = countFilesRecursively(CONVERSATIONS_DIR).bytes
  const runtimeRebuildCount = repairHistory.filter((repair) => repair.requestedAreas.includes('runtime')).length

  const archiveStatus = resolveStatus(invalidArtifacts > 0, archiveWarnings > 0)
  const integrityStatus = resolveStatus(corruptedIntegrity > 0 || corruptedLocks > 0, missingIntegrity > 0 || missingLocks > 0)
  const closeoutStatus = resolveStatus(closeoutsMissing > 0, closeoutsRecoveryRequired > 0)
  const recoveryStatus = resolveStatus(repairFailures > 0, recoveryArtifacts > 0)
  const maintenanceStatus = resolveStatus(false, maintenanceCandidates.staleLocks.length > 0 || maintenanceCandidates.orphanTempFiles.length > 0 || maintenanceCandidates.abandonedJournals.length > 0)

  const metrics: PmosMetrics = {
    conversationArtifacts: baseNames.length,
    closeouts: safeListDir(CLOSEOUTS_DIR).filter((name) => name.endsWith('.closeout.json')).length,
    recoveryArtifacts,
    repairActions: repairsCount,
    repairFailures,
    archiveGrowthBytes: archiveGrowth,
    runtimeRebuildCount,
  }

  return {
    status: deriveEstateAuditStatus([archiveStatus, integrityStatus, closeoutStatus, recoveryStatus, maintenanceStatus]),
    archive: {
      status: archiveStatus,
      conversationCount: baseNames.length,
      invalidArtifacts,
      warnings: archiveWarnings,
    },
    integrity: {
      status: integrityStatus,
      missingIntegrity,
      missingLocks,
      corruptedIntegrity,
      corruptedLocks,
    },
    closeouts: {
      status: closeoutStatus,
      expected: baseNames.length,
      present: safeListDir(CLOSEOUTS_DIR).filter((name) => name.endsWith('.closeout.json')).length,
      missing: closeoutsMissing,
      recoveryRequired: closeoutsRecoveryRequired,
    },
    recovery: {
      status: recoveryStatus,
      pendingBackups: countFilesRecursively(PENDING_BACKUP_DIR).count,
      failedArtifacts: countFilesRecursively(FAILED_ARTIFACTS_DIR).count,
      quarantinedArtifacts: countFilesRecursively(QUARANTINE_DIR).count,
      repairRuns: repairsCount,
      latestRepairAt: repairHistory[0]?.completedAt ?? repairHistory[0]?.startedAt ?? null,
    },
    maintenance: {
      status: maintenanceStatus,
      staleLocks: maintenanceCandidates.staleLocks.length,
      orphanTempFiles: maintenanceCandidates.orphanTempFiles.length,
      abandonedJournals: maintenanceCandidates.abandonedJournals.length,
    },
    metrics,
    lifecycle: buildLifecyclePolicy(),
  }
}

export function collectPmosStatusSnapshot(): PmosStatusSnapshot {
  const runtimeVerification = collectRuntimeVerificationSnapshot()
  const estateAudit = collectEstateAuditSnapshot()

  return {
    status: deriveOperatorSummaryStatus(runtimeVerification.status, estateAudit.status),
    runtimeVerification,
    estateAudit,
  }
}

export function formatOperatorStatus(snapshot: PmosStatusSnapshot): string {
  const lines: string[] = []
  lines.push(`[pmos:status] ${snapshot.status}`)
  lines.push(` - runtime-verification: ${snapshot.runtimeVerification.status}`)
  lines.push(` - runtime: ${snapshot.runtimeVerification.runtime.status} | context=${snapshot.runtimeVerification.runtime.contextExists ? 'present' : 'missing'} | integrity=${snapshot.runtimeVerification.runtime.integrityVerified ? 'verified' : snapshot.runtimeVerification.runtime.integrityExists ? 'present-unverified' : 'missing'}`)
  lines.push(` - handoff: ${snapshot.runtimeVerification.handoff.status} | pending-artifact=${snapshot.runtimeVerification.handoff.pendingArtifactOccupied ? 'occupied' : 'clear'} | pending-valid=${snapshot.runtimeVerification.handoff.pendingArtifactValid ? 'yes' : 'no'} | advisory-lock=${snapshot.runtimeVerification.handoff.advisoryLockPresent ? 'present' : 'clear'}`)
  lines.push(` - estate-audit: ${snapshot.estateAudit.status}`)
  lines.push(` - archive: ${snapshot.estateAudit.archive.status} | conversations=${snapshot.estateAudit.archive.conversationCount} | invalid=${snapshot.estateAudit.archive.invalidArtifacts} | warnings=${snapshot.estateAudit.archive.warnings}`)
  lines.push(` - integrity: ${snapshot.estateAudit.integrity.status} | missing-integrity=${snapshot.estateAudit.integrity.missingIntegrity} | missing-locks=${snapshot.estateAudit.integrity.missingLocks} | corrupt-integrity=${snapshot.estateAudit.integrity.corruptedIntegrity} | corrupt-locks=${snapshot.estateAudit.integrity.corruptedLocks}`)
  lines.push(` - closeouts: ${snapshot.estateAudit.closeouts.status} | present=${snapshot.estateAudit.closeouts.present}/${snapshot.estateAudit.closeouts.expected} | missing=${snapshot.estateAudit.closeouts.missing} | recovery-required=${snapshot.estateAudit.closeouts.recoveryRequired}`)
  lines.push(` - recovery: ${snapshot.estateAudit.recovery.status} | pending-backups=${snapshot.estateAudit.recovery.pendingBackups} | failed=${snapshot.estateAudit.recovery.failedArtifacts} | quarantined=${snapshot.estateAudit.recovery.quarantinedArtifacts} | repairs=${snapshot.estateAudit.recovery.repairRuns}`)
  lines.push(` - maintenance: ${snapshot.estateAudit.maintenance.status} | stale-locks=${snapshot.estateAudit.maintenance.staleLocks} | orphan-temp=${snapshot.estateAudit.maintenance.orphanTempFiles} | abandoned-journals=${snapshot.estateAudit.maintenance.abandonedJournals}`)
  lines.push(` - metrics: conversations=${snapshot.estateAudit.metrics.conversationArtifacts} | closeouts=${snapshot.estateAudit.metrics.closeouts} | recovery-actions=${snapshot.estateAudit.metrics.recoveryArtifacts} | repair-actions=${snapshot.estateAudit.metrics.repairActions} | archive-growth-bytes=${snapshot.estateAudit.metrics.archiveGrowthBytes} | runtime-rebuilds=${snapshot.estateAudit.metrics.runtimeRebuildCount}`)
  return lines.join('\n')
}

export function formatHealthStatus(runtimeSnapshot: RuntimeVerificationSnapshot, estateSnapshot: EstateAuditSnapshot): string {
  const lines: string[] = []
  lines.push(`[pmos:health] ${deriveHealthStatus(runtimeSnapshot.status)}`)
  lines.push(` - runtime: ${runtimeSnapshot.runtime.status} | context=${runtimeSnapshot.runtime.contextExists ? 'present' : 'missing'} | integrity=${runtimeSnapshot.runtime.integrityVerified ? 'verified' : runtimeSnapshot.runtime.integrityExists ? 'present-unverified' : 'missing'}`)
  lines.push(` - handoff: ${runtimeSnapshot.handoff.status} | pending-artifact=${runtimeSnapshot.handoff.pendingArtifactOccupied ? 'occupied' : 'clear'} | pending-valid=${runtimeSnapshot.handoff.pendingArtifactValid ? 'yes' : 'no'} | advisory-lock=${runtimeSnapshot.handoff.advisoryLockPresent ? 'present' : 'clear'}`)
  if (estateSnapshot.status !== 'PASS') {
    lines.push(` - estate-advisory: ${estateSnapshot.status} | closeouts=${estateSnapshot.closeouts.status} | recovery=${estateSnapshot.recovery.status} | maintenance=${estateSnapshot.maintenance.status}`)
  }
  lines.push(` - lifecycle: retention=${runtimeSnapshot.lifecycle.archiveRetention}`)
  lines.push(` - lifecycle: compaction=${runtimeSnapshot.lifecycle.archiveCompaction}`)
  lines.push(` - lifecycle: housekeeping=${runtimeSnapshot.lifecycle.archiveHousekeeping}`)
  return lines.join('\n')
}

export function formatRuntimeVerificationStatus(snapshot: RuntimeVerificationSnapshot, mode: 'verify-runtime' | 'verify' = 'verify-runtime'): string {
  const lines: string[] = []
  lines.push(`[pmos:${mode}] ${snapshot.status}`)
  lines.push(` - runtime: ${snapshot.runtime.status} | context=${snapshot.runtime.contextExists ? 'present' : 'missing'} | integrity=${snapshot.runtime.integrityVerified ? 'verified' : snapshot.runtime.integrityExists ? 'present-unverified' : 'missing'}`)
  lines.push(` - handoff: ${snapshot.handoff.status} | pending-artifact=${snapshot.handoff.pendingArtifactOccupied ? 'occupied' : 'clear'} | pending-valid=${snapshot.handoff.pendingArtifactValid ? 'yes' : 'no'} | advisory-lock=${snapshot.handoff.advisoryLockPresent ? 'present' : 'clear'}`)
  lines.push(` - lifecycle: retention=${snapshot.lifecycle.archiveRetention}`)
  lines.push(` - lifecycle: compaction=${snapshot.lifecycle.archiveCompaction}`)
  lines.push(` - lifecycle: housekeeping=${snapshot.lifecycle.archiveHousekeeping}`)
  return lines.join('\n')
}

export function formatEstateAuditStatus(snapshot: EstateAuditSnapshot): string {
  const lines: string[] = []
  lines.push(`[pmos:audit-estate] ${snapshot.status}`)
  lines.push(` - archive: ${snapshot.archive.status} | conversations=${snapshot.archive.conversationCount} | invalid=${snapshot.archive.invalidArtifacts} | warnings=${snapshot.archive.warnings}`)
  lines.push(` - integrity: ${snapshot.integrity.status} | missing-integrity=${snapshot.integrity.missingIntegrity} | missing-locks=${snapshot.integrity.missingLocks} | corrupt-integrity=${snapshot.integrity.corruptedIntegrity} | corrupt-locks=${snapshot.integrity.corruptedLocks}`)
  lines.push(` - closeouts: ${snapshot.closeouts.status} | present=${snapshot.closeouts.present}/${snapshot.closeouts.expected} | missing=${snapshot.closeouts.missing} | recovery-required=${snapshot.closeouts.recoveryRequired}`)
  lines.push(` - recovery: ${snapshot.recovery.status} | pending-backups=${snapshot.recovery.pendingBackups} | failed=${snapshot.recovery.failedArtifacts} | quarantined=${snapshot.recovery.quarantinedArtifacts} | repairs=${snapshot.recovery.repairRuns}`)
  lines.push(` - maintenance: ${snapshot.maintenance.status} | stale-locks=${snapshot.maintenance.staleLocks} | orphan-temp=${snapshot.maintenance.orphanTempFiles} | abandoned-journals=${snapshot.maintenance.abandonedJournals}`)
  lines.push(` - metrics: conversations=${snapshot.metrics.conversationArtifacts} | closeouts=${snapshot.metrics.closeouts} | recovery-actions=${snapshot.metrics.recoveryArtifacts} | repair-actions=${snapshot.metrics.repairActions} | archive-growth-bytes=${snapshot.metrics.archiveGrowthBytes} | runtime-rebuilds=${snapshot.metrics.runtimeRebuildCount}`)
  lines.push(` - lifecycle: retention=${snapshot.lifecycle.archiveRetention}`)
  lines.push(` - lifecycle: compaction=${snapshot.lifecycle.archiveCompaction}`)
  lines.push(` - lifecycle: housekeeping=${snapshot.lifecycle.archiveHousekeeping}`)
  return lines.join('\n')
}

export function formatOperationalStatus(snapshot: PmosStatusSnapshot, mode: 'status' | 'health' | 'verify'): string {
  if (mode === 'health') {
    return formatHealthStatus(snapshot.runtimeVerification, snapshot.estateAudit)
  }

  if (mode === 'verify') {
    return formatRuntimeVerificationStatus(snapshot.runtimeVerification, 'verify')
  }

  return formatOperatorStatus(snapshot)
}