import type { EventCategory, ExecutionEventType } from "../schemas/event.schema"

// ── Event taxonomy: full map of all event types ───────────────────────────────

export interface EventDefinition {
  type: ExecutionEventType
  category: EventCategory
  label: string
  description: string
  payloadFields: string[]
}

export const EVENT_TAXONOMY: EventDefinition[] = [
  // ── Planning ──────────────────────────────────────────────────────────────
  {
    type: "ROADMAP_CREATED",
    category: "PLANNING",
    label: "Roadmap Created",
    description: "A new project roadmap was defined.",
    payloadFields: ["projectId", "projectName", "etapCount"],
  },
  {
    type: "ETAP_DEFINED",
    category: "PLANNING",
    label: "ETAP Defined",
    description: "A new execution ETAP was added to a project.",
    payloadFields: ["projectId", "etapId", "etapName", "order"],
  },
  {
    type: "SUBETAP_DEFINED",
    category: "PLANNING",
    label: "Subetap Defined",
    description: "A subetap was defined under an ETAP.",
    payloadFields: ["etapId", "subetapId", "subetapName"],
  },
  {
    type: "DEPENDENCY_DECLARED",
    category: "PLANNING",
    label: "Dependency Declared",
    description: "A project or task dependency was explicitly declared.",
    payloadFields: ["sourceId", "targetId", "dependencyType", "criticality"],
  },

  // ── Execution ─────────────────────────────────────────────────────────────
  {
    type: "TASK_STARTED",
    category: "EXECUTION",
    label: "Task Started",
    description: "A task moved to ACTIVE status.",
    payloadFields: ["taskId", "taskTitle", "projectId", "etapId"],
  },
  {
    type: "TASK_COMPLETED",
    category: "EXECUTION",
    label: "Task Completed",
    description: "A task was marked as DONE.",
    payloadFields: ["taskId", "taskTitle", "projectId", "etapId"],
  },
  {
    type: "BLOCKER_CREATED",
    category: "EXECUTION",
    label: "Blocker Created",
    description: "A new blocker was registered in the execution flow.",
    payloadFields: ["taskId", "blockerTitle", "projectId", "severity"],
  },
  {
    type: "BLOCKER_RESOLVED",
    category: "EXECUTION",
    label: "Blocker Resolved",
    description: "An existing blocker was resolved.",
    payloadFields: ["taskId", "projectId"],
  },
  {
    type: "PRIORITY_CHANGED",
    category: "EXECUTION",
    label: "Priority Changed",
    description: "A task's priority was explicitly changed.",
    payloadFields: ["taskId", "from", "to", "projectId"],
  },

  // ── Cognition ─────────────────────────────────────────────────────────────
  {
    type: "DRIFT_DETECTED",
    category: "COGNITION",
    label: "Drift Detected",
    description: "Execution drift was detected: tasks active without clear structure.",
    payloadFields: ["projectId", "driftScore", "affectedTaskCount"],
  },
  {
    type: "OVERLOAD_DETECTED",
    category: "COGNITION",
    label: "Overload Detected",
    description: "Execution overload detected: too many concurrent active items.",
    payloadFields: ["projectId", "activeTaskCount", "threshold"],
  },
  {
    type: "FRAGMENTATION_DETECTED",
    category: "COGNITION",
    label: "Fragmentation Detected",
    description: "Execution fragmentation: work scattered across too many ETAPs.",
    payloadFields: ["projectId", "activeEtapCount"],
  },
  {
    type: "EXECUTION_WARNING",
    category: "COGNITION",
    label: "Execution Warning",
    description: "A general execution health warning was raised.",
    payloadFields: ["projectId", "warningType", "message"],
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  {
    type: "AI_INTERPRETATION_ACCEPTED",
    category: "AI",
    label: "AI Interpretation Accepted",
    description: "An AI-generated task interpretation was accepted by the operator.",
    payloadFields: ["rawInput", "interpretedTitle", "taskId", "confidence"],
  },
  {
    type: "AI_MAPPING_FAILED",
    category: "AI",
    label: "AI Mapping Failed",
    description: "AI could not map input to an existing project/ETAP context.",
    payloadFields: ["rawInput", "reason"],
  },
  {
    type: "AI_CONFIDENCE_LOW",
    category: "AI",
    label: "AI Confidence Low",
    description: "AI produced an interpretation below confidence threshold.",
    payloadFields: ["rawInput", "confidence", "threshold"],
  },

  // ── Topology ──────────────────────────────────────────────────────────────
  {
    type: "SHARED_RUNTIME_PRESSURE",
    category: "TOPOLOGY",
    label: "Shared Runtime Pressure",
    description: "Multiple projects share critical execution pressure on a dependency.",
    payloadFields: ["projectIds", "dependencyType", "pressureScore"],
  },
  {
    type: "CASCADE_RISK",
    category: "TOPOLOGY",
    label: "Cascade Risk",
    description: "A blocker has downstream cascade risk across multiple projects.",
    payloadFields: ["sourceProjectId", "affectedProjectIds", "chainDepth"],
  },
  {
    type: "CRITICAL_PATH_CHANGED",
    category: "TOPOLOGY",
    label: "Critical Path Changed",
    description: "The critical execution path in the topology was altered.",
    payloadFields: ["previousPath", "newPath"],
  },

  // ── Governance ────────────────────────────────────────────────────────────
  {
    type: "CONVENTION_UPDATED",
    category: "GOVERNANCE",
    label: "Convention Updated",
    description: "A workspace convention was added or modified.",
    payloadFields: ["workspaceId", "key", "from", "to"],
  },
  {
    type: "PROMPT_PROTOCOL_UPDATED",
    category: "GOVERNANCE",
    label: "Prompt Protocol Updated",
    description: "A prompt template or protocol definition was modified.",
    payloadFields: ["templateName", "category"],
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export const EVENT_BY_TYPE = Object.fromEntries(
  EVENT_TAXONOMY.map((e) => [e.type, e])
) as Record<ExecutionEventType, EventDefinition>

export const EVENTS_BY_CATEGORY = EVENT_TAXONOMY.reduce<
  Record<EventCategory, EventDefinition[]>
>(
  (acc, event) => {
    if (!acc[event.category]) acc[event.category] = []
    acc[event.category].push(event)
    return acc
  },
  {} as Record<EventCategory, EventDefinition[]>
)

export const EVENT_CATEGORIES: EventCategory[] = [
  "PLANNING",
  "EXECUTION",
  "COGNITION",
  "AI",
  "TOPOLOGY",
  "GOVERNANCE",
]
