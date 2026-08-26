import { z } from "zod"

export const DependencyTypeSchema = z.enum([
  "runtime",
  "orchestration",
  "ui",
  "infra",
  "cognition",
  "ai",
  "localization",
  "deployment",
])

export const CriticalitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])

// Task-level dependency
export const DependencySchema = z.object({
  id: z.string().cuid(),
  blockingTaskId: z.string(),
  blockedTaskId: z.string(),
})

// Project-level dependency
export const ProjectDependencySchema = z.object({
  id: z.string().cuid(),
  sourceProjectId: z.string(),
  targetProjectId: z.string(),
  dependencyType: DependencyTypeSchema,
  criticality: CriticalitySchema,
  description: z.string().optional(),
  createdAt: z.coerce.date(),
})

export type Dependency = z.infer<typeof DependencySchema>
export type ProjectDependency = z.infer<typeof ProjectDependencySchema>
export type DependencyType = z.infer<typeof DependencyTypeSchema>
export type Criticality = z.infer<typeof CriticalitySchema>
