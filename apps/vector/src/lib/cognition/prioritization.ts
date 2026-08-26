// VECTOR Execution Cognition — Priority Conflict Detection
// Detects: everything critical, blocked high-priority tasks, stale critical tasks

import type { CognitionInput, Signal } from "./signals"
import { daysSince, isActive } from "./signals"

const STALE_CRITICAL_DAYS = 10
const CRITICAL_RATIO_THRESHOLD = 0.7
const MIN_CRITICAL_FOR_INFLATION = 3

export function detectPriorityConflicts(input: CognitionInput): Signal[] {
  const signals: Signal[] = []
  const { tasks, projects } = input

  // ── 1. Priority inflation — everything marked CRITICAL in a project ────────
  projects
    .filter((p) => p.status === "ACTIVE")
    .forEach((p) => {
      const activeTasks = tasks.filter((t) => t.projectId === p.id && isActive(t.status))
      if (activeTasks.length < 3) return
      const criticalCount = activeTasks.filter((t) => t.priority === "CRITICAL").length
      const ratio = criticalCount / activeTasks.length
      if (ratio >= CRITICAL_RATIO_THRESHOLD && criticalCount >= MIN_CRITICAL_FOR_INFLATION) {
        signals.push({
          type: "priority_conflict",
          level: "warning",
          message: `${p.name}: ${criticalCount}/${activeTasks.length} tasków oznaczonych jako CRITICAL`,
          projectSlug: p.slug,
          projectName: p.name,
        })
      }
    })

  // ── 2. Blocked tasks still marked HIGH or CRITICAL ────────────────────────
  const highPriorityBlocked = tasks.filter(
    (t) => t.status === "BLOCKED" && ["CRITICAL", "HIGH"].includes(t.priority)
  )
  if (highPriorityBlocked.length > 0) {
    signals.push({
      type: "priority_conflict",
      level: "warning",
      message: `${highPriorityBlocked.length} task${highPriorityBlocked.length > 1 ? "i HIGH/CRITICAL" : " HIGH/CRITICAL"} pozostają zablokowane`,
    })
  }

  // ── 3. Stale critical tasks — critical but untouched ─────────────────────
  const staleCritical = tasks.filter(
    (t) =>
      t.priority === "CRITICAL" &&
      isActive(t.status) &&
      daysSince(new Date(t.updatedAt)) > STALE_CRITICAL_DAYS
  )
  if (staleCritical.length > 0) {
    signals.push({
      type: "priority_conflict",
      level: "critical",
      message: `${staleCritical.length} krytyczn${staleCritical.length > 1 ? "ych tasków" : "y task"} bez aktualizacji od >${STALE_CRITICAL_DAYS} dni`,
    })
  }

  return signals
}
