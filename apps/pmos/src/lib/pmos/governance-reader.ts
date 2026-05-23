/**
 * PMOS Governance Reader
 * ──────────────────────
 * Defensively reads governance artifacts from the local .pmos/governance/
 * filesystem. Used by the offline fallback in build-pmos-context.ts to
 * surface whatever governance state is available without requiring a running
 * PMOS server.
 *
 * Design constraints:
 * - Never throws. Every function returns a typed result or safe empty state.
 * - Skips unreadable or malformed files silently.
 * - Works with zero governance files present (just .gitkeep directories).
 *
 * File format: each governance item is a single .json file in its directory.
 * The file name is arbitrary — content is validated by shape, not by name.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GovernancePrinciple {
  title: string
  description?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
}

export interface GovernanceWarning {
  title: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  area?: string
  description?: string
}

export interface GovernanceDecision {
  title: string
  rationale?: string
  status?: string
  date?: string
}

export interface GovernanceState {
  principles: GovernancePrinciple[]
  warnings: GovernanceWarning[]
  decisions: GovernanceDecision[]
  /** True if at least one governance directory had readable JSON files */
  hasData: boolean
}

// ── Reader ────────────────────────────────────────────────────────────────────

function readJsonFiles<T>(dir: string, validate: (obj: unknown) => obj is T): T[] {
  if (!existsSync(dir)) return []

  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }

  const results: T[] = []
  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), 'utf-8')
      const obj = JSON.parse(raw)
      if (validate(obj)) {
        results.push(obj)
      }
    } catch {
      // Skip malformed file — non-fatal
    }
  }
  return results
}

function isPrinciple(obj: unknown): obj is GovernancePrinciple {
  return typeof obj === 'object' && obj !== null && typeof (obj as Record<string, unknown>).title === 'string'
}

function isWarning(obj: unknown): obj is GovernanceWarning {
  return typeof obj === 'object' && obj !== null && typeof (obj as Record<string, unknown>).title === 'string'
}

function isDecision(obj: unknown): obj is GovernanceDecision {
  return typeof obj === 'object' && obj !== null && typeof (obj as Record<string, unknown>).title === 'string'
}

/**
 * Reads all available governance artifacts from the filesystem.
 * Safe to call when directories are empty or contain only .gitkeep files.
 * Always returns a valid GovernanceState — never throws.
 */
export function readGovernanceState(governanceRoot: string): GovernanceState {
  const principles = readJsonFiles(join(governanceRoot, 'principles'), isPrinciple)
  const warnings = readJsonFiles(join(governanceRoot, 'warnings'), isWarning)
  const decisions = readJsonFiles(join(governanceRoot, 'decisions'), isDecision)

  return {
    principles,
    warnings,
    decisions,
    hasData: principles.length > 0 || warnings.length > 0 || decisions.length > 0,
  }
}
