export type ProjectStatus = "ACTIVE" | "PAUSED" | "DONE" | "ARCHIVED"
export type TaskType = "TASK" | "BLOCKER" | "IDEA" | "DECISION" | "BUG" | "NOTE" | "REFACTOR"
export type TaskStatus = "PLANNED" | "ACTIVE" | "BLOCKED" | "REVIEW" | "DONE" | "ARCHIVED"
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface Project {
  id: string
  name: string
  slug: string
  description?: string | null
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
  etaps?: Etap[]
  tasks?: Task[]
  _count?: { tasks: number; etaps: number }
}

export interface Etap {
  id: string
  name: string
  order: number
  projectId: string
  subetaps?: Subetap[]
  tasks?: Task[]
  _count?: { tasks: number }
}

export interface Subetap {
  id: string
  name: string
  order: number
  etapId: string
  tasks?: Task[]
  _count?: { tasks: number }
}

export interface Task {
  id: string
  title: string
  description?: string | null
  type: TaskType
  status: TaskStatus
  priority: Priority
  projectId: string
  etapId?: string | null
  subetapId?: string | null
  createdAt: Date
  updatedAt: Date
  project?: Project
  etap?: Etap
  subetap?: Subetap
}

export interface Dependency {
  id: string
  blockingTaskId: string
  blockedTaskId: string
  blockingTask?: Task
  blockedTask?: Task
}

export interface InboxItem {
  id: string
  rawInput: string
  interpretedTitle: string
  type: TaskType
  processed: boolean
  projectId?: string | null
  taskId?: string | null
  createdAt: Date
  processedAt?: Date | null
}

