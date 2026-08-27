import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { fileURLToPath } from "url"

import {
  ExecutionTrailAppendInput,
  ExecutionTrailEvent,
  ExecutionTrailEventSeverity,
  ExecutionTrailEventStatus,
  ExecutionTrailEventType,
  ExecutionTrailPaths,
  ExecutionTrailStatus,
  ExecutionTrailValidationResult,
  FactPreservationStatus,
  validateExecutionTrailEvent,
} from "../../../../../packages/governance/src/index.ts"

import { atomicWriteFileSet } from "./atomic-io.ts"

const PMOS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const LOGS_DIR = path.join(PMOS_ROOT, ".pmos/conversations/logs")

const REQUIRED_BASELINE_EVENTS: ExecutionTrailEventType[] = [
  ExecutionTrailEventType.TASK_RECEIVED,
  ExecutionTrailEventType.PROMPT_CAPTURED,
  ExecutionTrailEventType.PLAN_DECLARED,
  ExecutionTrailEventType.PMOS_SAVE_STARTED,
]

const COMPLETION_EVENTS: ExecutionTrailEventType[] = [
  ExecutionTrailEventType.PMOS_SAVE_SUCCEEDED,
  ExecutionTrailEventType.PMOS_SAVE_FAILED,
  ExecutionTrailEventType.HANDOFF_PUBLICATION_SUCCEEDED,
  ExecutionTrailEventType.HANDOFF_PUBLICATION_FAILED,
  ExecutionTrailEventType.TASK_COMPLETED,
  ExecutionTrailEventType.TASK_INCOMPLETE,
  ExecutionTrailEventType.CLOSEOUT_COMPLETED,
]

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function getExecutionTrailPaths(baseName: string): ExecutionTrailPaths {
  ensureDir(LOGS_DIR)
  return {
    jsonlPath: path.join(LOGS_DIR, `${baseName}.execution-trail.jsonl`),
    markdownPath: path.join(LOGS_DIR, `${baseName}.execution-trail.md`),
  }
}

export function readExecutionTrailEvents(baseName: string): ExecutionTrailEvent[] {
  const { jsonlPath } = getExecutionTrailPaths(baseName)
  if (!fs.existsSync(jsonlPath)) return []
  const raw = fs.readFileSync(jsonlPath, "utf-8").trim()
  if (!raw) return []
  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ExecutionTrailEvent)
}

export function renderExecutionTrailMarkdown(events: ExecutionTrailEvent[]): string {
  const lines: string[] = ["# PMOS Execution Trail", ""]
  if (events.length === 0) return [...lines, "_No execution trail events recorded._"].join("\n")
  lines.push(`- Task ID: ${events[0].taskId}`)
  lines.push(`- Event count: ${events.length}`)
  lines.push("")
  lines.push("| Timestamp | Type | Status | Severity | Summary |")
  lines.push("|---|---|---|---|---|")
  for (const event of events) {
    lines.push(`| ${event.timestamp} | ${event.eventType} | ${event.status} | ${event.severity} | ${event.summary.replace(/\|/g, "\\|")} |`)
    if (event.relatedFiles.length > 0) lines.push(`|  | files |  |  | ${event.relatedFiles.join(", ").replace(/\|/g, "\\|")} |`)
    if (event.relatedCommands.length > 0) lines.push(`|  | commands |  |  | ${event.relatedCommands.join(" ; ").replace(/\|/g, "\\|")} |`)
    if (event.details) lines.push(`|  | details |  |  | ${JSON.stringify(event.details).replace(/\|/g, "\\|")} |`)
  }
  return lines.join("\n")
}

function buildJsonl(events: ExecutionTrailEvent[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n") + (events.length > 0 ? "\n" : "")
}

export function writeExecutionTrailArtifacts(baseName: string, events: ExecutionTrailEvent[]): void {
  const { jsonlPath, markdownPath } = getExecutionTrailPaths(baseName)
  atomicWriteFileSet([
    { filePath: jsonlPath, content: buildJsonl(events) },
    { filePath: markdownPath, content: renderExecutionTrailMarkdown(events) },
  ], {
    label: `execution-trail:${baseName}`,
    journalPath: path.join(LOGS_DIR, `${baseName}.execution-trail.write.json`),
  })
}

export function appendExecutionTrailEvent(input: ExecutionTrailAppendInput): ExecutionTrailEvent {
  const event: ExecutionTrailEvent = {
    eventId: randomUUID(),
    taskId: input.taskId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    eventType: input.eventType,
    actor: input.actor ?? "github-copilot",
    summary: input.summary,
    details: input.details ?? null,
    relatedFiles: input.relatedFiles ?? [],
    relatedCommands: input.relatedCommands ?? [],
    status: input.status ?? ExecutionTrailEventStatus.RECORDED,
    severity: input.severity ?? ExecutionTrailEventSeverity.INFO,
    correlationId: input.correlationId ?? input.baseName,
    source: input.source ?? "pmos/manual",
  }

  const validation = validateExecutionTrailEvent(event)
  if (!validation.valid) throw new Error(`Execution trail event invalid: ${validation.errors.join(" | ")}`)

  const events = readExecutionTrailEvents(input.baseName)
  events.push(event)
  writeExecutionTrailArtifacts(input.baseName, events)
  return event
}

export function validateExecutionTrail(baseName: string): ExecutionTrailValidationResult {
  const { jsonlPath, markdownPath } = getExecutionTrailPaths(baseName)
  const issues: ExecutionTrailValidationResult["issues"] = []
  if (!fs.existsSync(jsonlPath)) {
    return {
      baseName,
      status: ExecutionTrailStatus.MISSING,
      factPreservationStatus: FactPreservationStatus.MISSING,
      jsonlPath,
      markdownPath,
      issues: [{ severity: "ERROR", message: "Execution trail JSONL file missing" }],
      eventCount: 0,
      presentEventTypes: [],
    }
  }

  let events: ExecutionTrailEvent[] = []
  try {
    events = readExecutionTrailEvents(baseName)
  } catch (error) {
    return {
      baseName,
      status: ExecutionTrailStatus.MISSING,
      factPreservationStatus: FactPreservationStatus.MISSING,
      jsonlPath,
      markdownPath,
      issues: [{ severity: "ERROR", message: `Execution trail JSONL invalid: ${(error as Error).message}` }],
      eventCount: 0,
      presentEventTypes: [],
    }
  }

  if (events.length === 0) issues.push({ severity: "ERROR", message: "Execution trail exists but has no events" })
  const presentEventTypes = Array.from(new Set(events.map((event) => event.eventType)))

  for (const event of events) {
    const validation = validateExecutionTrailEvent(event)
    if (!validation.valid) validation.errors.forEach((error) => issues.push({ severity: "ERROR", message: `${event.eventId}: ${error}` }))
  }

  for (const requiredEvent of REQUIRED_BASELINE_EVENTS) {
    if (!presentEventTypes.includes(requiredEvent)) issues.push({ severity: "WARN", message: `Missing baseline event: ${requiredEvent}` })
  }

  if (!presentEventTypes.includes(ExecutionTrailEventType.VECTOR_REBUILD_STARTED)) {
    issues.push({ severity: "WARN", message: "Missing VECTOR_REBUILD_STARTED event or explicit non-applicable reason" })
  }
  if (!presentEventTypes.some((eventType) => COMPLETION_EVENTS.includes(eventType))) {
    issues.push({ severity: "WARN", message: "Missing completion event (PMOS save, closeout, or task completion)" })
  }

  const hasWorkingEvent = presentEventTypes.some((eventType) => [
    ExecutionTrailEventType.FILE_READ,
    ExecutionTrailEventType.FILE_SEARCHED,
    ExecutionTrailEventType.COMMAND_EXECUTED,
    ExecutionTrailEventType.VALIDATION_STARTED,
    ExecutionTrailEventType.DECISION_RECORDED,
    ExecutionTrailEventType.ARTIFACT_CREATED,
    ExecutionTrailEventType.PATCH_APPLIED,
  ].includes(eventType))
  if (!hasWorkingEvent) issues.push({ severity: "WARN", message: "No execution activity event recorded beyond prompt/plan/save" })

  for (let index = 1; index < events.length; index += 1) {
    const prev = new Date(events[index - 1].timestamp).getTime()
    const current = new Date(events[index].timestamp).getTime()
    if (current < prev) {
      issues.push({ severity: "ERROR", message: `Events out of order at index ${index}` })
      break
    }
  }

  if (!fs.existsSync(markdownPath)) issues.push({ severity: "WARN", message: "Execution trail markdown mirror missing" })
  const hasErrors = issues.some((issue) => issue.severity === "ERROR")
  const hasWarnings = issues.some((issue) => issue.severity === "WARN")

  return {
    baseName,
    status: hasErrors ? ExecutionTrailStatus.MISSING : hasWarnings ? ExecutionTrailStatus.PARTIAL : ExecutionTrailStatus.PRESENT,
    factPreservationStatus: hasErrors ? FactPreservationStatus.MISSING : hasWarnings ? FactPreservationStatus.PARTIAL : FactPreservationStatus.BASELINE_PRESENT,
    jsonlPath,
    markdownPath,
    issues,
    eventCount: events.length,
    presentEventTypes,
  }
}