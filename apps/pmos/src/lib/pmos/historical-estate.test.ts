import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import type { EstateAuditSnapshot } from './operations'
import { applyHistoricalEstateExceptions } from './historical-estate'

const BASE_NAME = '2026-05-23-19:30_continuity-protocol'

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function snapshot(missingCount = 1): EstateAuditSnapshot {
  return {
    status: 'FAIL',
    archive: { status: 'WARN', conversationCount: missingCount, invalidArtifacts: 0, warnings: missingCount },
    integrity: { status: 'WARN', missingIntegrity: missingCount, missingLocks: missingCount, corruptedIntegrity: 0, corruptedLocks: 0 },
    closeouts: { status: 'FAIL', expected: missingCount, present: 0, missing: missingCount, recoveryRequired: 0 },
    recovery: { status: 'PASS', pendingBackups: 0, failedArtifacts: 0, quarantinedArtifacts: 0, repairRuns: 0, latestRepairAt: null },
    maintenance: { status: 'PASS', staleLocks: 0, orphanTempFiles: 0, abandonedJournals: 0 },
    metrics: { conversationArtifacts: missingCount, closeouts: 0, recoveryArtifacts: 0, repairActions: 0, repairFailures: 0, archiveGrowthBytes: 0, runtimeRebuildCount: 0 },
    lifecycle: { archiveRetention: 'test', archiveCompaction: 'test', archiveHousekeeping: 'test' },
  }
}

function fixture(): { root: string; conversationsDir: string; closeoutsDir: string; manifestPath: string; jsonPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-historical-estate-'))
  const conversationsDir = path.join(root, 'conversations')
  const closeoutsDir = path.join(root, 'closeouts')
  const manifestPath = path.join(root, 'manifest.json')
  fs.mkdirSync(conversationsDir, { recursive: true })
  fs.mkdirSync(closeoutsDir, { recursive: true })
  const json = '{"taskId":"PMOS-CONTINUITY-PROTOCOL-V1"}\n'
  const markdown = '# PMOS-CONTINUITY-PROTOCOL-V1\n'
  const jsonPath = path.join(conversationsDir, `${BASE_NAME}.json`)
  fs.writeFileSync(jsonPath, json)
  fs.writeFileSync(path.join(conversationsDir, `${BASE_NAME}.md`), markdown)
  fs.writeFileSync(manifestPath, JSON.stringify({
    schemaVersion: '1.0',
    exceptions: [{
      baseName: BASE_NAME,
      classification: 'PRE_CLOSEOUT_STANDARD_ARTIFACT',
      taskId: 'PMOS-CONTINUITY-PROTOCOL-V1',
      introducedByCommit: 'ada51680b1201eda0053c7208883d31e30647334',
      introducedAt: '2026-05-23T20:06:04.000Z',
      reason: 'This fixture predates the modern PMOS closeout standard and cannot lawfully acquire retrospective completion evidence.',
      expectedMissing: ['integrity', 'lock', 'closeout'],
      contentSha256: { json: hash(json), markdown: hash(markdown) },
    }],
  }))
  return { root, conversationsDir, closeoutsDir, manifestPath, jsonPath }
}

test('acknowledges only an exact pre-standard artifact and clears its aggregate debt', () => {
  const files = fixture()
  const result = applyHistoricalEstateExceptions(snapshot(), files)
  assert.equal(result.snapshot.status, 'PASS')
  assert.equal(result.snapshot.archive.warnings, 0)
  assert.equal(result.snapshot.integrity.missingIntegrity, 0)
  assert.equal(result.snapshot.integrity.missingLocks, 0)
  assert.deepEqual(result.snapshot.closeouts, { status: 'PASS', expected: 0, present: 0, missing: 0, recoveryRequired: 0 })
  assert.equal(result.acknowledgedExceptions.length, 1)
  assert.deepEqual(result.errors, [])
})

test('fails closed when an allowlisted artifact changes', () => {
  const files = fixture()
  fs.appendFileSync(files.jsonPath, '{}\n')
  const result = applyHistoricalEstateExceptions(snapshot(), files)
  assert.equal(result.snapshot.status, 'FAIL')
  assert.equal(result.acknowledgedExceptions.length, 0)
  assert.match(result.errors.join('\n'), /JSON hash drift/)
})

test('keeps unknown historical debt visible after the exact exception is applied', () => {
  const files = fixture()
  const result = applyHistoricalEstateExceptions(snapshot(2), files)
  assert.equal(result.snapshot.status, 'FAIL')
  assert.equal(result.snapshot.integrity.missingIntegrity, 1)
  assert.equal(result.snapshot.integrity.missingLocks, 1)
  assert.equal(result.snapshot.closeouts.missing, 1)
  assert.equal(result.acknowledgedExceptions.length, 1)
})
