import fs from "fs"
import path from "path"

import { ArchiveCompletenessStatus } from "../../../../../packages/governance/src/index.ts"

export interface ArchiveCompletenessIssue {
  severity: "ERROR" | "WARN"
  message: string
}

export interface ArchiveCompletenessResult {
  status: ArchiveCompletenessStatus
  baseName: string
  issues: ArchiveCompletenessIssue[]
  mdPath: string
  jsonPath: string
  integrityPath: string
  lockPath: string
}

function parseFilenameTimestamp(baseName: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}_.+$/.test(baseName)
}

function readIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, "utf-8")
}

function addIssue(issues: ArchiveCompletenessIssue[], severity: "ERROR" | "WARN", message: string): void {
  issues.push({ severity, message })
}

export function validateConversationArtifactSet(basePath: string): ArchiveCompletenessResult {
  const mdPath = `${basePath}.md`
  const jsonPath = `${basePath}.json`
  const integrityPath = `${basePath}.integrity.json`
  const lockPath = `${basePath}.lock.json`
  const baseName = path.basename(basePath)
  const issues: ArchiveCompletenessIssue[] = []

  if (!parseFilenameTimestamp(baseName)) addIssue(issues, "ERROR", `Filename timestamp not parseable: ${baseName}`)

  for (const filePath of [mdPath, jsonPath]) {
    if (!fs.existsSync(filePath)) {
      addIssue(issues, "ERROR", `Missing required artifact file: ${path.basename(filePath)}`)
      continue
    }
    if (fs.statSync(filePath).size <= 0) addIssue(issues, "ERROR", `Artifact file is empty: ${path.basename(filePath)}`)
  }

  for (const filePath of [integrityPath, lockPath]) {
    if (!fs.existsSync(filePath)) {
      addIssue(issues, "WARN", `Missing sidecar file: ${path.basename(filePath)}`)
      continue
    }
    if (fs.statSync(filePath).size <= 0) addIssue(issues, "ERROR", `Sidecar file is empty: ${path.basename(filePath)}`)
  }

  const rawJson = readIfExists(jsonPath)
  let taskId: string | null = null
  let timestamp: string | null = null

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as {
        taskId?: string
        timestamp?: string
        metadata?: { taskId?: string; timestamp?: string }
      }
      taskId = typeof parsed.taskId === "string" ? parsed.taskId : typeof parsed.metadata?.taskId === "string" ? parsed.metadata.taskId : null
      timestamp = typeof parsed.timestamp === "string" ? parsed.timestamp : typeof parsed.metadata?.timestamp === "string" ? parsed.metadata.timestamp : null
      if (!taskId) addIssue(issues, "ERROR", "JSON artifact missing taskId")
      if (!timestamp) addIssue(issues, "ERROR", "JSON artifact missing timestamp")
      if (timestamp && Number.isNaN(new Date(timestamp).getTime())) addIssue(issues, "ERROR", `JSON artifact timestamp invalid: ${timestamp}`)
    } catch (error) {
      addIssue(issues, "ERROR", `JSON artifact invalid: ${(error as Error).message}`)
    }
  }

  const rawMd = readIfExists(mdPath)
  if (rawMd && taskId && !rawMd.includes(taskId)) addIssue(issues, "WARN", `Markdown artifact does not contain taskId: ${taskId}`)
  if (rawMd && timestamp && !rawMd.includes(timestamp)) addIssue(issues, "WARN", `Markdown artifact does not contain timestamp: ${timestamp}`)

  const rawIntegrity = readIfExists(integrityPath)
  if (rawIntegrity) {
    try {
      const parsed = JSON.parse(rawIntegrity) as { contentHash?: string }
      if (!parsed.contentHash) addIssue(issues, "WARN", "Integrity sidecar missing contentHash")
    } catch (error) {
      addIssue(issues, "ERROR", `Integrity sidecar invalid: ${(error as Error).message}`)
    }
  }

  const rawLock = readIfExists(lockPath)
  if (rawLock) {
    try {
      const parsed = JSON.parse(rawLock) as { immutableSince?: string; integrityHash?: string }
      if (!parsed.immutableSince) addIssue(issues, "WARN", "Lock sidecar missing immutableSince")
      if (!parsed.integrityHash) addIssue(issues, "WARN", "Lock sidecar missing integrityHash")
    } catch (error) {
      addIssue(issues, "ERROR", `Lock sidecar invalid: ${(error as Error).message}`)
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "ERROR")
  const hasWarnings = issues.some((issue) => issue.severity === "WARN")

  return {
    status: hasErrors ? "FAIL" : hasWarnings ? "WARNING" : "PASS",
    baseName,
    issues,
    mdPath,
    jsonPath,
    integrityPath,
    lockPath,
  }
}