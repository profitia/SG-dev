// VECTOR Execution Cognition — Drift Detection
// Detects: stale tasks, untouched ETAPs, dormant projects, long-running blocked/review

import type { CognitionInput, Signal } from "./signals"
import { daysSince, isActive } from "./signals"

const STALE_TASK_DAYS = 14
const LONG_BLOCKED_DAYS = 14
const LONG_REVIEW_DAYS = 7
const STALE_ETAP_DAYS = 14
const DORMANT_PROJECT_DAYS = 21

export function detectDrift(input: CognitionInput): Signal[] {
  const signals: Signal[] = []
  const { tasks, etaps, projects } = input

  // ── 1. Stale active/planned tasks globally ────────────────────────────────
  const staleTasks = tasks.filter(
    (t) => isActive(t.status) && daysSince(new Date(t.updatedAt)) > STALE_TASK_DAYS
  )
  if (staleTasks.length > 0) {
    signals.push({
      type: "drift",
      level: staleTasks.length >= 5 ? "critical" : "warning",
      message: `${staleTasks.length} task${staleTasks.length > 1 ? "i" : ""} bez aktualizacji od >${STALE_TASK_DAYS} dni`,
    })
  }

  // ── 2. Long-running blocked tasks ─────────────────────────────────────────
  const longBlocked = tasks.filter(
    (t) => t.status === "BLOCKED" && daysSince(new Date(t.updatedAt)) > LONG_BLOCKED_DAYS
  )
  if (longBlocked.length > 0) {
    signals.push({
      type: "drift",
      level: "warning",
      message: `${longBlocked.length} task${longBlocked.length > 1 ? "i" : ""} pozostają blocked >${LONG_BLOCKED_DAYS} dni`,
    })
  }

  // ── 3. Tasks stuck in REVIEW ──────────────────────────────────────────────
  const reviewStuck = tasks.filter(
    (t) => t.status === "REVIEW" && daysSince(new Date(t.updatedAt)) > LONG_REVIEW_DAYS
  )
  if (reviewStuck.length > 0) {
    signals.push({
      type: "drift",
      level: "warning",
      message: `${reviewStuck.length} task${reviewStuck.length > 1 ? "i" : ""} w REVIEW bez aktualizacji od >${LONG_REVIEW_DAYS} dni`,
    })
  }

  // ── 4. Stale ETAPs (per project) ─────────────────────────────────────────
  etaps.forEach((e) => {
    const etapTasks = tasks.filter((t) => t.etapId === e.id)
    if (etapTasks.length === 0) return
    if (!etapTasks.some((t) => isActive(t.status))) return

    const lastUpdate = Math.max(...etapTasks.map((t) => new Date(t.updatedAt).getTime()))
    const days = daysSince(new Date(lastUpdate))

    if (days > STALE_ETAP_DAYS && e.project) {
      signals.push({
        type: "drift",
        level: "warning",
        message: `"${e.name}" nie był aktualizowany od ${days} dni`,
        projectSlug: e.project.slug,
        projectName: e.project.name,
      })
    }
  })

  // ── 5. Dormant active projects ────────────────────────────────────────────
  projects
    .filter((p) => p.status === "ACTIVE")
    .forEach((p) => {
      const projectTasks = tasks.filter((t) => t.projectId === p.id && isActive(t.status))
      if (projectTasks.length === 0) return
      const lastUpdate = Math.max(...projectTasks.map((t) => new Date(t.updatedAt).getTime()))
      const days = daysSince(new Date(lastUpdate))
      if (days > DORMANT_PROJECT_DAYS) {
        signals.push({
          type: "drift",
          level: "warning",
          message: `Projekt "${p.name}" nieaktywny od ${days} dni`,
          projectSlug: p.slug,
          projectName: p.name,
        })
      }
    })

  return signals
}
