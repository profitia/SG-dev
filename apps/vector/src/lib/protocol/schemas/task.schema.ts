import { z } from "zod"

export const TaskTypeSchema = z.enum([
  "TASK",
  "BLOCKER",
  "IDEA",
  "DECISION",
  "BUG",
  "NOTE",
  "REFACTOR",
])

export const TaskStatusSchema = z.enum([
  "PLANNED",
  "ACTIVE",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "ARCHIVED",
])

export const PrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])

export const TaskSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  priority: PrioritySchema,
  projectId: z.string(),
  etapId: z.string().optional(),
  subetapId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const TaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  priority: PrioritySchema,
  projectId: z.string(),
  etapId: z.string().optional(),
})

export type Task = z.infer<typeof TaskSchema>
export type TaskSummary = z.infer<typeof TaskSummarySchema>
export type TaskType = z.infer<typeof TaskTypeSchema>
export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type Priority = z.infer<typeof PrioritySchema>
