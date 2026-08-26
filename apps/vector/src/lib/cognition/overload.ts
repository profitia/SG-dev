// VECTOR Execution Cognition — Overload Detection
// Detects: too many active tasks, critical priorities, blocker accumulation, excessive parallel ETAPs

import type { CognitionInput, Signal } from "./signals"
import { isActive } from "./signals"

const MAX_ACTIVE_TASKS = 8
const MAX_CRITICAL_TASKS = 3
const BLOCKER_PRESSURE_THRESHOLD = 3
const MAX_PARALLEL_ETAPS_GLOBAL = 5

export function detectOverload(input: CognitionInput): Signal[] {
  const signals: Signal[] = []
  const { tasks, etaps, projects } = input

  // ── 1. Too many active tasks globally ────────────────────────────────────
  const activeTasks = tasks.filter((t) => t.status === "ACTIVE")
  if (activeTasks.length > MAX_ACTIVE_TASKS) {
    signals.push({
      type: "overload",
      level: activeTasks.length > MAX_ACTIVE_TASKS * 1.5 ? "critical" : "warning",
      message: `Masz ${activeTasks.length} aktywnych tasków jednocześnie`,
    })
  }

  // ── 2. Too many critical priorities globally ───────────────────────────────
  const criticalActive = tasks.filter(
    (t) => t.priority === "CRITICAL" && isActive(t.status)
  )
  if (criticalActive.length > MAX_CRITICAL_TASKS) {
    signals.push({
      type: "overload",
      level: "warning",
      message: `Masz ${criticalActive.length} krytycznych tasków jednocześnie`,
    })
  }

  // ── 3. Blocker accumulation per project ───────────────────────────────────
  projects
    .filter((p) => p.status === "ACTIVE")
    .forEach((p) => {
      const projectBlockers = tasks.filter(
        (t) => t.projectId === p.id && t.status === "BLOCKED"
      )
      if (projectBlockers.length >= BLOCKER_PRESSURE_THRESHOLD) {
        signals.push({
          type: "blocker_pressure",
          level: projectBlockers.length >= BLOCKER_PRESSURE_THRESHOLD * 2 ? "critical" : "warning",
          message: `${p.name} ma ${projectBlockers.length} aktywnych blockerów`,
          projectSlug: p.slug,
          projectName: p.name,
        })
      }
    })

  // ── 4. Too many active ETAPs globally ────────────────────────────────────
  const activeEtapIds = new Set(
    tasks
      .filter((t) => isActive(t.status) && t.etapId)
      .map((t) => t.etapId as string)
  )
  if (activeEtapIds.size > MAX_PARALLEL_ETAPS_GLOBAL) {
    signals.push({
      type: "overload",
      level: "warning",
      message: `${activeEtapIds.size} ETAPów aktywnych jednocześnie`,
    })
  }

  return signals
}
