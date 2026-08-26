import { z } from "zod"

export const ProjectStatusSchema = z.enum(["ACTIVE", "PAUSED", "DONE", "ARCHIVED"])

export const ProjectSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().optional(),
  status: ProjectStatusSchema,
  workspaceId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const ProjectRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: ProjectStatusSchema,
})

export type Project = z.infer<typeof ProjectSchema>
export type ProjectRef = z.infer<typeof ProjectRefSchema>
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>
