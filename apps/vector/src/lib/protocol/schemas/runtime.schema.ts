import { z } from "zod"
import { ProjectRefSchema } from "./project.schema"
import { EtapSchema, SubetapSchema } from "./etap.schema"
import { TaskSummarySchema } from "./task.schema"
import { ProjectDependencySchema } from "./dependency.schema"
import { SignalSchema, RecommendationSchema } from "./signal.schema"
import { ExecutionEventSchema } from "./event.schema"

export const RuntimeExportStatusSchema = z.enum([
  "PENDING",
  "INGESTED",
  "CONFLICT",
  "STALE",
  "REJECTED",
])

export const WorkspaceIdentitySchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: z.string(),
  protocolVersion: z.string().default("1.0.0"),
  runtimeVersion: z.string().default("1.0.0"),
  conventions: z.record(z.string(), z.string()).default({}),
})

export const RuntimeExportPayloadSchema = z.object({
  workspace: WorkspaceIdentitySchema,
  projects: z.array(ProjectRefSchema),
  etaps: z.array(EtapSchema),
  subetaps: z.array(SubetapSchema),
  tasks: z.array(TaskSummarySchema),
  dependencies: z.array(ProjectDependencySchema),
  signals: z.array(SignalSchema),
  recommendations: z.array(RecommendationSchema),
  events: z.array(ExecutionEventSchema),
  exportedAt: z.coerce.date(),
})

export const RuntimeExportSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().optional(),
  source: z.string(),
  version: z.string().default("1.0.0"),
  payload: RuntimeExportPayloadSchema,
  status: RuntimeExportStatusSchema,
  ingestedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RuntimeExportStatus = z.infer<typeof RuntimeExportStatusSchema>
export type WorkspaceIdentity = z.infer<typeof WorkspaceIdentitySchema>
export type RuntimeExportPayload = z.infer<typeof RuntimeExportPayloadSchema>
export type RuntimeExport = z.infer<typeof RuntimeExportSchema>
