// VECTOR Execution Cognition — Project Health Scoring

import type {
  CognitionInput,
  CognitionTask,
  CognitionEtap,
  ProjectHealth,
  HealthLevel,
} from "./signals"
import { daysSince, isActive } from "./signals"

const STALE_TASK_DAYS = 14
const LONG_BLOCKED_DAYS = 7
const MAX_PARALLEL_ETAPS = 3
const STALE_ETAP_DAYS = 14

function getEtapLastUpdate(tasks: CognitionTask[], etapId: string): number {
  const etapTasks = tasks.filter((t) => t.etapId === etapId)
  if (etapTasks.length === 0) return 0
  return Math.max(...etapTasks.map((t) => new Date(t.updatedAt).getTime()))
}

export function scoreProject(
  project: CognitionProject,
  tasks: CognitionTask[],
  etaps: CognitionEtap[]
): ProjectHealth {
  const reasons: string[] = []
  let score = 100

  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const projectEtaps = etaps.filter((e) => e.projectId === project.id)

  // ── Blockers ──────────────────────────────────────────────────────────────
  const blockers = projectTasks.filter((t) => t.status === "BLOCKED")
  const criticalBlockers = blockers.filter((t) => t.priority === "CRITICAL")

  if (criticalBlockers.length > 0) {
    score -= criticalBlockers.length * 20
    reasons.push(
      `${criticalBlockers.length} critical blocker${criticalBlockers.length > 1 ? "s" : ""}`
    )
  } else if (blockers.length > 0) {
    score -= blockers.length * 10
    reasons.push(`${blockers.length} active blocker${blockers.length > 1 ? "s" : ""}`)
  }

  // ── Long-running blockers ─────────────────────────────────────────────────
  const longBlockers = blockers.filter(
    (t) => daysSince(new Date(t.updatedAt)) > LONG_BLOCKED_DAYS
  )
  if (longBlockers.length > 0 && longBlockers.length < blockers.length) {
    score -= longBlockers.length * 5
    reasons.push(
      `${longBlockers.length} task${longBlockers.length > 1 ? "s" : ""} blocked >${LONG_BLOCKED_DAYS} days`
    )
  }

  // ── Stale tasks ───────────────────────────────────────────────────────────
  const staleTasks = projectTasks.filter(
    (t) => isActive(t.status) && daysSince(new Date(t.updatedAt)) > STALE_TASK_DAYS
  )
  if (staleTasks.length > 0) {
    score -= staleTasks.length * 5
    reasons.push(`${staleTasks.length} stale task${staleTasks.length > 1 ? "s" : ""}`)
  }

  // ── Parallel ETAP overload ────────────────────────────────────────────────
  const activeEtaps = projectEtaps.filter((e) =>
    projectTasks.some((t) => t.etapId === e.id && isActive(t.status))
  )
  if (activeEtaps.length > MAX_PARALLEL_ETAPS) {
    score -= (activeEtaps.length - MAX_PARALLEL_ETAPS) * 8
    reasons.push(`${activeEtaps.length} ETAPs active in parallel`)
  }

  // ── Stale ETAPs ───────────────────────────────────────────────────────────
  projectEtaps.forEach((e) => {
    const etapTasks = projectTasks.filter((t) => t.etapId === e.id)
    if (etapTasks.length === 0) return
    if (!etapTasks.some((t) => isActive(t.status))) return
    const lastUpdate = getEtapLastUpdate(projectTasks, e.id)
    const days = daysSince(new Date(lastUpdate))
    if (days > STALE_ETAP_DAYS) {
      score -= 8
      reasons.push(`ETAP "${e.name}" stale for ${days} days`)
    }
  })

  score = Math.max(0, Math.min(100, score))
  const level: HealthLevel = score >= 70 ? "healthy" : score >= 40 ? "warning" : "critical"

  return {
    projectId: project.id,
    projectSlug: project.slug,
    projectName: project.name,
    level,
    reasons,
    blockerCount: blockers.length,
    staleCount: staleTasks.length,
    score,
  }
}

interface CognitionProject {
  id: string
  name: string
  slug: string
  status: string
}

export function scoreAllProjects(input: CognitionInput): ProjectHealth[] {
  return input.projects
    .filter((p) => p.status !== "ARCHIVED")
    .map((p) => scoreProject(p, input.tasks, input.etaps))
    .sort((a, b) => a.score - b.score) // worst health first
}
