import { z } from "zod"

export const WorkspaceArchetypeSchema = z.enum([
  "SaaS",
  "Startup",
  "Agency",
  "InternalProduct",
  "AIPlatform",
])

export const WorkspaceIdentityModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: WorkspaceArchetypeSchema,
  protocolVersion: z.string().default("1.0.0"),
  runtimeVersion: z.string().default("1.0.0"),
  conventions: z.record(z.string(), z.string()).default({}),
})

export const WorkspaceProtocolSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string(),
  protocolVersion: z.string(),
  runtimeVersion: z.string(),
  identity: WorkspaceIdentityModelSchema,
  conventions: z.record(z.string(), z.string()),
  updatedAt: z.coerce.date(),
})

export type WorkspaceArchetype = z.infer<typeof WorkspaceArchetypeSchema>
export type WorkspaceIdentityModel = z.infer<typeof WorkspaceIdentityModelSchema>
export type WorkspaceProtocol = z.infer<typeof WorkspaceProtocolSchema>
