// VECTOR Execution Cognition Engine — Base Types & Utilities

export type HealthLevel = "healthy" | "warning" | "critical"

export type SignalType =
  | "drift"
  | "overload"
  | "blocker_pressure"
  | "fragmentation"
  | "priority_conflict"

export interface Signal {
  type: SignalType
  level: HealthLevel
  message: string
  projectSlug?: string
  projectName?: string
}

export interface ProjectHealth {
  projectId: string
  projectSlug: string
  projectName: string
  level: HealthLevel
  reasons: string[]
  blockerCount: number
  staleCount: number
  score: number // 0–100, higher = healthier
}

export interface Recommendation {
  title: string
  reasoning: string
  priority: "high" | "medium"
}

export interface FocusSuggestion {
  title: string
  projectName?: string
  taskId?: string
  reason: string
}

export interface CognitionOutput {
  overallHealth: HealthLevel
  projectHealths: ProjectHealth[]
  signals: Signal[]
  recommendations: Recommendation[]
  focusSuggestions: FocusSuggestion[]
  generatedAt: Date
}

// ---- Input types for cognition engines ----

export interface CognitionTask {
  id: string
  title: string
  status: string
  priority: string
  type: string
  projectId: string
  etapId: string | null
  createdAt: Date
  updatedAt: Date
  project: { id: string; name: string; slug: string } | null
}

export interface CognitionEtap {
  id: string
  name: string
  order: number
  projectId: string
  project: { id: string; name: string; slug: string } | null
}

export interface CognitionProject {
  id: string
  name: string
  slug: string
  status: string
}

export interface CognitionInput {
  projects: CognitionProject[]
  tasks: CognitionTask[]
  etaps: CognitionEtap[]
}

// ---- Shared utility ----

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function isActive(status: string): boolean {
  return !["DONE", "ARCHIVED"].includes(status)
}
