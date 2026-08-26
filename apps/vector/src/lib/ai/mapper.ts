import { type Interpretation } from "./schemas"
import { type Task, type Project } from "@/types"

/**
 * Maps an AI Interpretation to a partial Task create payload.
 * The user remains the final decision-maker — this is a suggested default.
 */
export function interpretationToTaskPayload(
  interpretation: Interpretation,
  projects: Pick<Project, "id" | "name" | "slug">[]
): {
  title: string
  type: Interpretation["taskType"]
  priority: Interpretation["priority"]
  projectId: string | null
  etapHint: string | null
  subetapHint: string | null
} {
  // Resolve project slug → project id
  const matchedProject = interpretation.project
    ? projects.find(
        (p) =>
          p.slug === interpretation.project ||
          p.slug.includes(interpretation.project ?? "") ||
          p.name.toLowerCase().includes((interpretation.project ?? "").toLowerCase())
      ) ?? null
    : null

  return {
    title: interpretation.summary,
    type: interpretation.taskType,
    priority: interpretation.priority,
    projectId: matchedProject?.id ?? null,
    etapHint: interpretation.etap,
    subetapHint: interpretation.subetap,
  }
}

/**
 * Lightweight keyword duplicate detection.
 * Returns tasks that share significant keywords with the interpretation.
 * No embeddings — pure string matching.
 */
export function findPossibleDuplicates(
  interpretation: Interpretation,
  existingTasks: Pick<Task, "id" | "title" | "type" | "status">[]
): Pick<Task, "id" | "title" | "type" | "status">[] {
  const hints = interpretation.possibleDuplicateHints
  if (hints.length === 0) return []

  const summaryWords = tokenize(interpretation.summary)
  const hintTokens = hints.flatMap(tokenize)
  const searchTerms = [...new Set([...summaryWords, ...hintTokens])].filter(
    (w) => w.length > 3
  )

  if (searchTerms.length === 0) return []

  return existingTasks
    .filter((task) => {
      if (task.status === "DONE" || task.status === "ARCHIVED") return false
      const taskTokens = tokenize(task.title)
      const matches = searchTerms.filter((term) =>
        taskTokens.some((t) => t.includes(term) || term.includes(t))
      )
      return matches.length >= Math.min(2, searchTerms.length)
    })
    .slice(0, 3)
}

/**
 * Detect execution health signals without AI.
 * Returns tasks that show staleness or drift patterns.
 */
export function detectDriftSignals(
  tasks: Pick<Task, "id" | "title" | "status" | "type" | "updatedAt">[]
): {
  stale: typeof tasks
  blockedTooLong: typeof tasks
} {
  const now = Date.now()
  const STALE_DAYS = 14
  const BLOCKED_DAYS = 7

  const stale = tasks.filter((t) => {
    if (t.status !== "ACTIVE" && t.status !== "PLANNED") return false
    const daysSince = (now - new Date(t.updatedAt).getTime()) / 86_400_000
    return daysSince > STALE_DAYS
  })

  const blockedTooLong = tasks.filter((t) => {
    if (t.status !== "BLOCKED") return false
    const daysSince = (now - new Date(t.updatedAt).getTime()) / 86_400_000
    return daysSince > BLOCKED_DAYS
  })

  return { stale, blockedTooLong }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
}
