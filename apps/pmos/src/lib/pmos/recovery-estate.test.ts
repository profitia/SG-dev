import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { classifyPendingArtifactBackups } from './recovery-estate'

function fixture(): { backupsDir: string; closeoutsDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-recovery-estate-'))
  const backupsDir = path.join(root, 'pending-artifacts')
  const closeoutsDir = path.join(root, 'closeouts')
  fs.mkdirSync(backupsDir, { recursive: true })
  fs.mkdirSync(closeoutsDir, { recursive: true })
  return { backupsDir, closeoutsDir }
}

function writeCompletedPair(paths: ReturnType<typeof fixture>, baseName: string, backupName: string): void {
  fs.writeFileSync(path.join(paths.backupsDir, backupName), '{}\n')
  fs.writeFileSync(path.join(paths.closeoutsDir, `${baseName}.closeout.json`), JSON.stringify({
    closeoutState: 'CLOSEOUT_COMPLETE',
    pmosSaveStatus: 'SUCCEEDED',
    runtimeContextRefreshStatus: 'SUCCEEDED',
    handoffPublicationStatus: 'SUCCEEDED',
    archiveCompletenessStatus: 'PASS',
    executionTrailStatus: 'PRESENT',
    pendingArtifactBackupPath: `apps/pmos/.pmos/recovery/pending-artifacts/${backupName}`,
    recoveryRequired: false,
  }))
}

test('classifies a backup referenced by a completed closeout as retained forensic evidence', () => {
  const paths = fixture()
  const baseName = '2026-09-22-13:55_completed-task'
  const backupName = `${baseName}__backup_2026-09-22__11-55-18-249Z.json`
  writeCompletedPair(paths, baseName, backupName)

  const result = classifyPendingArtifactBackups(paths.backupsDir, paths.closeoutsDir)
  assert.equal(result.totalBackups, 1)
  assert.deepEqual(result.retainedCompletedBackups, [backupName])
  assert.deepEqual(result.unresolvedPendingBackups, [])
})

test('recognizes a completed pre-refresh closeout with verified PMOS runtime context', () => {
  const paths = fixture()
  const baseName = '2026-09-15-16:22_srm-completed-task'
  const backupName = `${baseName}__backup_2026-09-15__14-22-44-679Z.json`
  writeCompletedPair(paths, baseName, backupName)
  const closeoutPath = path.join(paths.closeoutsDir, `${baseName}.closeout.json`)
  const closeout = JSON.parse(fs.readFileSync(closeoutPath, 'utf8'))
  delete closeout.runtimeContextRefreshStatus
  closeout.vectorRebuildStatus = 'SUCCEEDED'
  closeout.runtimeContextIntegrityStatus = 'PASS'
  closeout.runtimeContextVerificationSource = 'PMOS runtime authority'
  fs.writeFileSync(closeoutPath, JSON.stringify(closeout))

  const result = classifyPendingArtifactBackups(paths.backupsDir, paths.closeoutsDir)
  assert.deepEqual(result.retainedCompletedBackups, [backupName])
  assert.deepEqual(result.unresolvedPendingBackups, [])
})

test('keeps a legacy closeout without verified PMOS runtime context unresolved', () => {
  const paths = fixture()
  const baseName = '2026-09-15-16:22_srm-unverified-task'
  const backupName = `${baseName}__backup_2026-09-15__14-22-44-679Z.json`
  writeCompletedPair(paths, baseName, backupName)
  const closeoutPath = path.join(paths.closeoutsDir, `${baseName}.closeout.json`)
  const closeout = JSON.parse(fs.readFileSync(closeoutPath, 'utf8'))
  delete closeout.runtimeContextRefreshStatus
  closeout.vectorRebuildStatus = 'SUCCEEDED'
  closeout.runtimeContextIntegrityStatus = 'FAIL'
  closeout.runtimeContextVerificationSource = 'PMOS runtime authority'
  fs.writeFileSync(closeoutPath, JSON.stringify(closeout))

  const result = classifyPendingArtifactBackups(paths.backupsDir, paths.closeoutsDir)
  assert.deepEqual(result.retainedCompletedBackups, [])
  assert.deepEqual(result.unresolvedPendingBackups, [backupName])
})

test('a failed modern refresh cannot be overridden by historical fields', () => {
  const paths = fixture()
  const baseName = '2026-09-22-13:55_failed-refresh'
  const backupName = `${baseName}__backup_2026-09-22__11-55-18-249Z.json`
  writeCompletedPair(paths, baseName, backupName)
  const closeoutPath = path.join(paths.closeoutsDir, `${baseName}.closeout.json`)
  const closeout = JSON.parse(fs.readFileSync(closeoutPath, 'utf8'))
  closeout.runtimeContextRefreshStatus = 'FAILED'
  closeout.vectorRebuildStatus = 'SUCCEEDED'
  closeout.runtimeContextIntegrityStatus = 'PASS'
  closeout.runtimeContextVerificationSource = 'PMOS runtime authority'
  fs.writeFileSync(closeoutPath, JSON.stringify(closeout))

  const result = classifyPendingArtifactBackups(paths.backupsDir, paths.closeoutsDir)
  assert.deepEqual(result.retainedCompletedBackups, [])
  assert.deepEqual(result.unresolvedPendingBackups, [backupName])
})

test('keeps orphaned and malformed backups visible as unresolved recovery debt', () => {
  const paths = fixture()
  fs.writeFileSync(path.join(paths.backupsDir, '2026-09-22-13:55_orphan__backup_stamp.json'), '{}\n')
  fs.writeFileSync(path.join(paths.backupsDir, 'unexpected.json'), '{}\n')

  const result = classifyPendingArtifactBackups(paths.backupsDir, paths.closeoutsDir)
  assert.equal(result.totalBackups, 2)
  assert.equal(result.retainedCompletedBackups.length, 0)
  assert.deepEqual(result.unresolvedPendingBackups, [
    '2026-09-22-13:55_orphan__backup_stamp.json',
    'unexpected.json',
  ])
})

test('keeps recovery-required or mismatched closeouts visible as unresolved debt', () => {
  const paths = fixture()
  const baseName = '2026-09-22-13:55_incomplete-task'
  const backupName = `${baseName}__backup_stamp.json`
  writeCompletedPair(paths, baseName, backupName)
  const closeoutPath = path.join(paths.closeoutsDir, `${baseName}.closeout.json`)
  const closeout = JSON.parse(fs.readFileSync(closeoutPath, 'utf8'))
  closeout.recoveryRequired = true
  closeout.pendingArtifactBackupPath = 'apps/pmos/.pmos/recovery/pending-artifacts/different.json'
  fs.writeFileSync(closeoutPath, JSON.stringify(closeout))

  const result = classifyPendingArtifactBackups(paths.backupsDir, paths.closeoutsDir)
  assert.deepEqual(result.retainedCompletedBackups, [])
  assert.deepEqual(result.unresolvedPendingBackups, [backupName])
})
