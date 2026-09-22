import fs from 'node:fs'
import path from 'node:path'

type CompletedCloseoutEvidence = {
  closeoutState?: string
  pmosSaveStatus?: string
  runtimeContextRefreshStatus?: string
  handoffPublicationStatus?: string
  archiveCompletenessStatus?: string
  executionTrailStatus?: string
  pendingArtifactBackupPath?: string
  recoveryRequired?: boolean
}

export type PendingBackupClassification = {
  totalBackups: number
  retainedCompletedBackups: string[]
  unresolvedPendingBackups: string[]
}

function readJson(filePath: string): CompletedCloseoutEvidence | null {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as CompletedCloseoutEvidence
      : null
  } catch {
    return null
  }
}

function isCompletedCloseoutForBackup(closeout: CompletedCloseoutEvidence | null, backupName: string): boolean {
  return Boolean(
    closeout
    && closeout.closeoutState === 'CLOSEOUT_COMPLETE'
    && closeout.pmosSaveStatus === 'SUCCEEDED'
    && closeout.runtimeContextRefreshStatus === 'SUCCEEDED'
    && closeout.handoffPublicationStatus === 'SUCCEEDED'
    && closeout.archiveCompletenessStatus === 'PASS'
    && closeout.executionTrailStatus === 'PRESENT'
    && closeout.recoveryRequired === false
    && typeof closeout.pendingArtifactBackupPath === 'string'
    && path.basename(closeout.pendingArtifactBackupPath) === backupName
  )
}

export function classifyPendingArtifactBackups(
  pendingBackupDir: string,
  closeoutsDir: string,
): PendingBackupClassification {
  const backupNames = fs.existsSync(pendingBackupDir)
    ? fs.readdirSync(pendingBackupDir).filter((name) => name.endsWith('.json')).sort()
    : []
  const retainedCompletedBackups: string[] = []
  const unresolvedPendingBackups: string[] = []

  for (const backupName of backupNames) {
    const separatorIndex = backupName.indexOf('__backup_')
    if (separatorIndex <= 0) {
      unresolvedPendingBackups.push(backupName)
      continue
    }

    const baseName = backupName.slice(0, separatorIndex)
    const closeout = readJson(path.join(closeoutsDir, `${baseName}.closeout.json`))
    if (isCompletedCloseoutForBackup(closeout, backupName)) {
      retainedCompletedBackups.push(backupName)
    } else {
      unresolvedPendingBackups.push(backupName)
    }
  }

  return {
    totalBackups: backupNames.length,
    retainedCompletedBackups,
    unresolvedPendingBackups,
  }
}
