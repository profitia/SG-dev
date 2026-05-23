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
 * checkpoints, roadmap transitions) so that development continuity is
 * maintained across sessions without requiring a running PMOS server.
 *
 * Storage: .pmos/conversations/logs/<id>.json
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

// ── Type ──────────────────────────────────────────────────────────────────────

export type ConversationEntryType =
  | 'architecture'  // architectural decision or ADR discussion
  | 'governance'    // principle enforcement, warning resolution
  | 'decision'      // implementation decision with rationale
  | 'runtime'       // runtime state change, ETAP transition, node completion
  | 'warning'       // new risk or warning discovered
  | 'roadmap'       // roadmap update, ETAP created or re-scoped

export interface ConversationEntry {
  id: string
  timestamp: string
  type: ConversationEntryType
  title: string
  summary: string
  tags?: string[]
}

// ── Paths ─────────────────────────────────────────────────────────────────────

function resolveLogsDir(): string {
  // This file lives at: apps/pmos/src/lib/pmos/
  // logs dir is at:     apps/pmos/.pmos/conversations/logs/
  const thisDir = dirname(new URL(import.meta.url).pathname)
  const pmosRoot = resolve(thisDir, '../../../../')
  return resolve(pmosRoot, '.pmos/conversations/logs')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureLogsDir(logsDir: string): boolean {
  try {
    mkdirSync(logsDir, { recursive: true })
    return true
  } catch (err) {
    console.warn('[PMOS] conversation-persistence: could not create logs dir:', (err as Error).message)
    return false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Appends a new lineage event to the conversation log.
 * Returns the written entry, or null if the write failed.
 */
export function appendConversationEntry(
  input: Omit<ConversationEntry, 'id' | 'timestamp'>,
): ConversationEntry | null {
  const entry: ConversationEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...input,
  }

  const logsDir = resolveLogsDir()
  if (!ensureLogsDir(logsDir)) return null

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
