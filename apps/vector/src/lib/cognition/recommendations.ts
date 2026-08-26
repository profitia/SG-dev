// VECTOR Execution Cognition — Strategic Recommendations + Master Orchestrator
// Generates few, high-value recommendations. Contains runCognition() entry point.

import type {
  CognitionInput,
  CognitionOutput,
  Signal,
  Recommendation,
  FocusSuggestion,
  ProjectHealth,
  HealthLevel,
} from "./signals"
import { daysSince } from "./signals"
import { scoreAllProjects } from "./health"
import { detectDrift } from "./drift"
import { detectOverload } from "./overload"
import { detectFragmentation } from "./fragmentation"
import { detectPriorityConflicts } from "./prioritization"

// ---- Helpers ----------------------------------------------------------------

function resolveOverallHealth(
  projectHealths: ProjectHealth[],
  signals: Signal[]
): HealthLevel {
  const hasCritical =
    projectHealths.some((p) => p.level === "critical") ||
    signals.some((s) => s.level === "critical")
  if (hasCritical) return "critical"
  const hasWarning =
    projectHealths.some((p) => p.level === "warning") ||
    signals.some((s) => s.level === "warning")
  if (hasWarning) return "warning"
  return "healthy"
}

// ---- Recommendation generation ----------------------------------------------

export function generateRecommendations(
  signals: Signal[],
  projectHealths: ProjectHealth[],
  input: CognitionInput
): Recommendation[] {
  const recs: Recommendation[] = []

  // 1. Worst project needs attention
  const criticalProject = projectHealths.find((p) => p.level === "critical")
  if (criticalProject) {
    recs.push({
      title: `Skoncentruj się na ${criticalProject.projectName}`,
      reasoning: criticalProject.reasons.slice(0, 3).join(". ") + ".",
      priority: "high",
    })
  }

  // 2. Long-running blockers — resolve before adding new work
  const longBlockedTasks = input.tasks.filter(
    (t) => t.status === "BLOCKED" && daysSince(new Date(t.updatedAt)) > 7
  )
  if (longBlockedTasks.length > 0) {
    const byProject = new Map<string, typeof longBlockedTasks>()
    longBlockedTasks.forEach((t) => {
      const key = t.project?.name ?? "Unknown"
      if (!byProject.has(key)) byProject.set(key, [])
      byProject.get(key)!.push(t)
    })
    const [topName, topTasks] = [...byProject.entries()].sort(
      (a, b) => b[1].length - a[1].length
    )[0]
    recs.push({
      title: `Odblokuj ${topName} — ${topTasks.length} blokad${topTasks.length > 1 ? "y" : "a"} >7 dni`,
      reasoning:
        "Długo utrzymywane blokery wstrzymują postęp innych tasków. Resolwowanie ich ma wyższy priorytet niż otwieranie nowych wątków.",
      priority: "high",
    })
  }

  // 3. Fragmentation — finish ETAPs before opening new ones
  const fragSignal = signals.find((s) => s.type === "fragmentation")
  if (fragSignal) {
    recs.push({
      title: "Domknij jeden ETAP przed otwarciem kolejnego",
      reasoning: `${fragSignal.message}. Fragmentacja uwagi spowalnia każdy wątek jednocześnie.`,
      priority: "medium",
    })
  }

  // 4. Overload — suggest narrowing scope
  const overloadSignal = signals.find(
    (s) => s.type === "overload" && s.message.includes("aktywnych tasków")
  )
  if (overloadSignal) {
    recs.push({
      title: "Zawęź zakres aktywnej pracy",
      reasoning: `${overloadSignal.message}. Efektywność spada gdy zbyt wiele tasków jest jednocześnie w toku.`,
      priority: "medium",
    })
  }

  // 5. Stale critical tasks — priorities need revision
  const staleCriticalSignal = signals.find(
    (s) => s.type === "priority_conflict" && s.message.includes("bez aktualizacji")
  )
  if (staleCriticalSignal) {
    recs.push({
      title: "Zrewiduj priorytety CRITICAL",
      reasoning:
        "Krytyczne taski bez aktualizacji sygnalizują że priorytety nie odzwierciedlają rzeczywistości. Zaktualizuj statusy lub obniż priorytet.",
      priority: "medium",
    })
  }

  // Limit to 5, high-priority first
  return recs
    .slice(0, 5)
    .sort((a, b) => (a.priority === "high" && b.priority !== "high" ? -1 : 1))
}

// ---- Focus suggestions ------------------------------------------------------

export function generateFocusSuggestions(
  input: CognitionInput,
  projectHealths: ProjectHealth[]
): FocusSuggestion[] {
  const suggestions: FocusSuggestion[] = []
  const { tasks } = input

  // 1. Critical blockers — resolve first
  tasks
    .filter((t) => t.status === "BLOCKED" && t.priority === "CRITICAL")
    .slice(0, 2)
    .forEach((t) => {
      suggestions.push({
        title: t.title,
        projectName: t.project?.name,
        taskId: t.id,
        reason: "Krytyczny blocker — wymaga natychmiastowej uwagi",
      })
    })

  // 2. REVIEW tasks — quick win, close the loop
  tasks
    .filter((t) => t.status === "REVIEW")
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 2)
    .forEach((t) => {
      suggestions.push({
        title: t.title,
        projectName: t.project?.name,
        taskId: t.id,
        reason: "Oczekuje na review — jeden krok do zamknięcia",
      })
    })

  // 3. Critical active tasks in the worst-health project
  const worstProject = projectHealths.find(
    (p) => p.level === "critical" || p.level === "warning"
  )
  if (worstProject) {
    tasks
      .filter(
        (t) =>
          t.projectId === worstProject.projectId &&
          t.status === "ACTIVE" &&
          t.priority === "CRITICAL" &&
          !suggestions.find((s) => s.taskId === t.id)
      )
      .slice(0, 2)
      .forEach((t) => {
        suggestions.push({
          title: t.title,
          projectName: t.project?.name,
          taskId: t.id,
          reason: `Projekt ${worstProject.projectName} wymaga uwagi`,
        })
      })
  }

  // 4. High-priority active tasks (fallback when nothing else surfaces)
  if (suggestions.length < 3) {
    tasks
      .filter(
        (t) =>
          t.status === "ACTIVE" &&
          ["CRITICAL", "HIGH"].includes(t.priority) &&
          !suggestions.find((s) => s.taskId === t.id)
      )
      .sort((a, b) => (a.priority === "CRITICAL" ? -1 : 1))
      .slice(0, 3 - suggestions.length)
      .forEach((t) => {
        suggestions.push({
          title: t.title,
          projectName: t.project?.name,
          taskId: t.id,
          reason: `Wysoki priorytet · aktywny`,
        })
      })
  }

  return suggestions.slice(0, 5)
}

// ---- Master orchestrator ----------------------------------------------------

export function runCognition(input: CognitionInput): CognitionOutput {
  const projectHealths = scoreAllProjects(input)

  const driftSignals = detectDrift(input)
  const overloadSignals = detectOverload(input)
  const fragmentationSignals = detectFragmentation(input)
  const prioritySignals = detectPriorityConflicts(input)

  const allSignals = [
    ...driftSignals,
    ...overloadSignals,
    ...fragmentationSignals,
    ...prioritySignals,
  ]

  const recommendations = generateRecommendations(allSignals, projectHealths, input)
  const focusSuggestions = generateFocusSuggestions(input, projectHealths)

  return {
    overallHealth: resolveOverallHealth(projectHealths, allSignals),
    projectHealths,
    signals: allSignals,
    recommendations,
    focusSuggestions,
    generatedAt: new Date(),
  }
}
