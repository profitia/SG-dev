import { z } from "zod"

export const EventCategorySchema = z.enum([
  "PLANNING",
  "EXECUTION",
  "COGNITION",
  "AI",
  "TOPOLOGY",
  "GOVERNANCE",
])

export const ExecutionEventTypeSchema = z.enum([
  // Planning
  "ROADMAP_CREATED",
  "ETAP_DEFINED",
  "SUBETAP_DEFINED",
  "DEPENDENCY_DECLARED",
  // Execution
  "TASK_STARTED",
  "TASK_COMPLETED",
  "BLOCKER_CREATED",
  "BLOCKER_RESOLVED",
  "PRIORITY_CHANGED",
  // Cognition
  "DRIFT_DETECTED",
  "OVERLOAD_DETECTED",
  "FRAGMENTATION_DETECTED",
  "EXECUTION_WARNING",
  // AI
  "AI_INTERPRETATION_ACCEPTED",
  "AI_MAPPING_FAILED",
  "AI_CONFIDENCE_LOW",
  // Topology
  "SHARED_RUNTIME_PRESSURE",
  "CASCADE_RISK",
  "CRITICAL_PATH_CHANGED",
  // Governance
  "CONVENTION_UPDATED",
  "PROMPT_PROTOCOL_UPDATED",
])

export const ExecutionEventSchema = z.object({
  id: z.string().cuid(),
  category: EventCategorySchema,
  type: ExecutionEventTypeSchema,
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  source: z.string().default("vector"),
  createdAt: z.coerce.date(),
})

export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>
export type EventCategory = z.infer<typeof EventCategorySchema>
export type ExecutionEventType = z.infer<typeof ExecutionEventTypeSchema>
