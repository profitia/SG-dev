/**
 * PMOS Conversation Persistence
 * ─────────────────────────────
 * Minimal orchestration lineage persistence — filesystem JSON only.
 *
 * NOT a chat history system.
 * NOT a messaging log.
 * NOT connected to the database.
 *
 * Purpose: persist runtime lineage events (architecture decisions, governance
 * checkpoints, roadmap transitions, task execution artifacts) so that
 * development continuity is maintained across sessions without requiring a
 * running PMOS server.
 *
 * Storage:
 *   .pmos/conversations/logs/<id>.json          — lineage events
 *   .pmos/conversations/<timestamp>_<topic>.md  — task artifacts (markdown)
 *   .pmos/conversations/<timestamp>_<topic>.json — task artifacts (JSON)
 *
 * Runtime context ownership is handled elsewhere by the canonical PMOS runtime builder.
 * Each entry is a single flat JSON file — readable, diffable, git-friendly.
 */

import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from 'fs'
import { join, resolve, dirname } from 'path'
import { randomUUID } from 'crypto'
import { assertNonCanonicalPmosWriteAllowed } from './noncanonical-write-guard'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConversationEntryType =
  | 'architecture'  // architectural decision or ADR discussion
  | 'governance'    // principle enforcement, warning resolution
  | 'decision'      // implementation decision with rationale
  | 'runtime'       // runtime state change, ETAP transition, node completion
  | 'warning'       // new risk or warning discovered
  | 'roadmap'       // roadmap update, ETAP created or re-scoped
  | 'continuity'    // task continuity artifact — prompt + execution lineage

export interface PromptLineage {
  /** Original user intent / request */
  userIntent: string
  /** Generated/expanded prompt sent to copilot/LLM */
  generatedPrompt?: string
  taskId?: string
  etap?: string
  subetap?: string
  node?: string
}

export interface ExecutionLineage {
  /** Relative file paths changed during execution */
  changedFiles?: string[]
  architecturalImpact?: string
  decisions?: string[]
  risks?: string[]
  blockers?: string[]
  nextSteps?: string[]
  executionStatus: 'complete' | 'partial' | 'blocked' | 'failed'
}

export interface ConversationEntry {
  id: string
  timestamp: string
  type: ConversationEntryType
  title: string
  summary: string
  tags?: string[]
  /** Prompt lineage — tracks user intent and generated prompts */
  promptLineage?: PromptLineage
  /** Execution lineage — tracks implementation outcomes */
  executionLineage?: ExecutionLineage
}

export interface TaskArtifactInput {
  taskId: string
  /** Short topic slug used in filename, e.g. "runtime-hardening" */
  topic: string
  /** ISO timestamp — defaults to now */
  timestamp?: string
  task: string
  userPrompt: string
  generatedPrompt?: string
  implementationSummary: string
  changedFiles: string[]
  architecturalImpact?: string
  decisions?: string[]
  risks?: string[]
  blockers?: string[]
  nextSteps?: string[]
  status: 'complete' | 'partial' | 'blocked' | 'failed'
}

export interface SaveArtifactResult {
  mdPath: string | null
  jsonPath: string | null
}

// ── Paths ─────────────────────────────────────────────────────────────────────

function resolvePmosRoot(): string {
  // This file lives at: apps/pmos/src/lib/pmos/
  // PMOS root is at:    apps/pmos/
  const thisDir = dirname(new URL(import.meta.url).pathname)
  return resolve(thisDir, '../../../../')
}

function resolveLogsDir(): string {
  return resolve(resolvePmosRoot(), '.pmos/conversations/logs')
}

function resolveConversationsDir(): string {
  return resolve(resolvePmosRoot(), '.pmos/conversations')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    return true
  } catch (err) {
    console.warn('[PMOS] conversation-persistence: could not create dir:', (err as Error).message)
    return false
  }
}

function formatTimestampForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildArtifactMarkdown(input: TaskArtifactInput, timestamp: string): string {
  const lines: string[] = []

  lines.push(`# PMOS Task Artifact`, ``)
  lines.push(`**TASK_ID:** ${input.taskId}`)
  lines.push(`**Timestamp:** ${timestamp}`)
  lines.push(`**Status:** ${input.status}`)
  lines.push(``, `---`, ``)

  lines.push(`## TASK`, ``, input.task, ``, `---`, ``)

  lines.push(`## USER PROMPT`, ``, input.userPrompt, ``)

  if (input.generatedPrompt) {
    lines.push(`---`, ``, `## GENERATED PROMPT`, ``, input.generatedPrompt, ``)
  }

  lines.push(`---`, ``, `## IMPLEMENTATION SUMMARY`, ``, input.implementationSummary, ``)

  lines.push(`---`, ``, `## FILES CHANGED`, ``)
  if (input.changedFiles.length > 0) {
    input.changedFiles.forEach((f) => lines.push(`- \`${f}\``))
  } else {
    lines.push(`_No files changed._`)
  }
  lines.push(``)

  if (input.architecturalImpact) {
    lines.push(`---`, ``, `## ARCHITECTURAL IMPACT`, ``, input.architecturalImpact, ``)
  }

  if (input.decisions && input.decisions.length > 0) {
    lines.push(`---`, ``, `## DECISIONS`, ``)
    input.decisions.forEach((d) => lines.push(`- ${d}`))
    lines.push(``)
  }

  if (input.risks && input.risks.length > 0) {
    lines.push(`---`, ``, `## RISKS`, ``)
    input.risks.forEach((r) => lines.push(`- ${r}`))
    lines.push(``)
  }

  if (input.blockers && input.blockers.length > 0) {
    lines.push(`---`, ``, `## BLOCKERS`, ``)
    input.blockers.forEach((b) => lines.push(`- ${b}`))
    lines.push(``)
  }

  if (input.nextSteps && input.nextSteps.length > 0) {
    lines.push(`---`, ``, `## NEXT STEPS`, ``)
    input.nextSteps.forEach((s) => lines.push(`- ${s}`))
    lines.push(``)
  }

  lines.push(`---`, ``, `## STATUS`, ``, `**${input.status.toUpperCase()}**`, ``)
  lines.push(`---`, `_Auto-generated by PMOS Runtime Continuity Protocol_`)

  return lines.join('\n')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Appends a new lineage event to the conversation log.
 * Supports prompt lineage and execution lineage for full continuity tracking.
 * Returns the written entry, or null if the write failed.
 */
export function appendConversationEntry(
  input: Omit<ConversationEntry, 'id' | 'timestamp'>,
): ConversationEntry | null {
  assertNonCanonicalPmosWriteAllowed('appendConversationEntry()')

  const entry: ConversationEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...input,
  }

  const logsDir = resolveLogsDir()
  if (!ensureDir(logsDir)) return null

  const filePath = join(logsDir, `${entry.id}.json`)
  try {
    writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')
    return entry
  } catch (err) {
    console.warn('[PMOS] conversation-persistence: write failed:', (err as Error).message)
    return null
  }
}

/**
 * Saves a complete task execution artifact as both .md and .json files.
 * Filename format: YYYY-MM-DD-HH:MM_<topic>.{md,json}
 * Saved to: .pmos/conversations/
 * Never throws — returns null paths on failure.
 */
export function saveTaskArtifact(input: TaskArtifactInput): SaveArtifactResult {
  assertNonCanonicalPmosWriteAllowed('saveTaskArtifact()')

  const result: SaveArtifactResult = { mdPath: null, jsonPath: null }

  const timestamp = input.timestamp ?? new Date().toISOString()
  const date = new Date(timestamp)
  const prefix = formatTimestampForFilename(date)
  const slug = input.topic.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  const baseName = `${prefix}_${slug}`

  const conversationsDir = resolveConversationsDir()
  if (!ensureDir(conversationsDir)) return result

  const jsonPath = join(conversationsDir, `${baseName}.json`)
  try {
    writeFileSync(jsonPath, JSON.stringify({ ...input, timestamp }, null, 2), 'utf-8')
    result.jsonPath = jsonPath
  } catch (err) {
    console.warn('[PMOS] saveTaskArtifact: json write failed:', (err as Error).message)
  }

  const mdPath = join(conversationsDir, `${baseName}.md`)
  try {
    writeFileSync(mdPath, buildArtifactMarkdown(input, timestamp), 'utf-8')
    result.mdPath = mdPath
  } catch (err) {
    console.warn('[PMOS] saveTaskArtifact: md write failed:', (err as Error).message)
  }

  return result
}

/**
 * Returns the N most recent conversation entries, sorted newest first.
 * Skips unreadable or malformed files — does not throw.
 */
export function getRecentConversationEntries(limit = 20): ConversationEntry[] {
  const logsDir = resolveLogsDir()

  if (!existsSync(logsDir)) return []

  let files: string[]
  try {
    files = readdirSync(logsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)
  } catch {
    return []
  }

  const entries: ConversationEntry[] = []
  for (const file of files) {
    try {
      const raw = readFileSync(join(logsDir, file), 'utf-8')
      const entry = JSON.parse(raw) as ConversationEntry
      if (entry.id && entry.timestamp && entry.type && entry.title && entry.summary) {
        entries.push(entry)
      }
    } catch {
      // Skip malformed entries — non-fatal
    }
  }

  return entries
}
