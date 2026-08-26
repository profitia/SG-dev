// VECTOR Execution Cognition — Fragmentation Detection
// Detects: too many active ETAPs, work split across projects, parallel critical efforts

import type { CognitionInput, Signal } from "./signals"
import { isActive } from "./signals"

const MAX_ACTIVE_ETAPS_PER_PROJECT = 3
const MAX_PROJECTS_WITH_ACTIVE_WORK = 4
const MAX_PROJECTS_WITH_CRITICAL = 2

export function detectFragmentation(input: CognitionInput): Signal[] {
  const signals: Signal[] = []
  const { tasks, etaps, projects } = input

  // ── 1. Active work spread across too many projects ────────────────────────
  const projectsWithActiveWork = projects.filter(
    (p) =>
      p.status === "ACTIVE" &&
      tasks.some((t) => t.projectId === p.id && t.status === "ACTIVE")
  )
  if (projectsWithActiveWork.length > MAX_PROJECTS_WITH_ACTIVE_WORK) {
    signals.push({
      type: "fragmentation",
      level: "warning",
      message: `Aktywna praca rozdzielona między ${projectsWithActiveWork.length} projekty`,
    })
  }

  // ── 2. Too many active ETAPs per project ──────────────────────────────────
  projects
    .filter((p) => p.status === "ACTIVE")
    .forEach((p) => {
      const projectEtaps = etaps.filter((e) => e.projectId === p.id)
      const activeEtaps = projectEtaps.filter((e) =>
        tasks.some((t) => t.etapId === e.id && isActive(t.status))
      )
      if (activeEtaps.length > MAX_ACTIVE_ETAPS_PER_PROJECT) {
        signals.push({
          type: "fragmentation",
          level: "warning",
          message: `${p.name} ma ${activeEtaps.length} równoległych ETAPów`,
          projectSlug: p.slug,
          projectName: p.name,
        })
      }
    })

  // ── 3. Critical tasks spread across too many projects ─────────────────────
  const projectsWithCritical = projects.filter((p) =>
    tasks.some((t) => t.projectId === p.id && t.priority === "CRITICAL" && isActive(t.status))
  )
  if (projectsWithCritical.length > MAX_PROJECTS_WITH_CRITICAL) {
    signals.push({
      type: "fragmentation",
      level: "warning",
      message: `Krytyczne zadania aktywne w ${projectsWithCritical.length} projektach jednocześnie`,
    })
  }

  // ── 4. Active tasks spread across more than 3 projects (runtime scatter) ──
  const activeTaskProjectSlugs = new Set(
    tasks
      .filter((t) => t.status === "ACTIVE" && t.project)
      .map((t) => t.project!.slug)
  )
  if (activeTaskProjectSlugs.size > 3 && projectsWithActiveWork.length > MAX_PROJECTS_WITH_ACTIVE_WORK) {
    // Already surfaced by signal #1 — skip duplicate
  } else if (activeTaskProjectSlugs.size > 4) {
    signals.push({
      type: "fragmentation",
      level: "warning",
      message: `Runtime work rozproszony między ${activeTaskProjectSlugs.size} projekty`,
    })
  }

  return signals
}
