import { z } from "zod"

export const TaskTypeEnum = z.enum([
  "TASK",
  "BLOCKER",
  "IDEA",
  "DECISION",
  "BUG",
  "NOTE",
  "REFACTOR",
])

export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])

export const InterpretationSchema = z.object({
  summary: z
    .string()
    .describe("Concise, actionable task title derived from the raw input. Max 120 chars."),
  taskType: TaskTypeEnum.describe(
    "Task classification: BLOCKER if execution is blocked; BUG if software defect; IDEA if speculative; DECISION if a choice must be made; NOTE if informational; REFACTOR if code improvement; TASK otherwise."
  ),
  priority: PriorityEnum.describe(
    "CRITICAL if explicit urgency/blocking cascade; HIGH if impacts current sprint/milestone; MEDIUM default; LOW if aspirational."
  ),
  project: z
    .string()
    .nullable()
    .describe(
      "Matched project slug (e.g. sg2, cic, pmos, profitia-pl, spendguru-ai, leaxaro). Null if cannot determine with confidence."
    ),
  etap: z
    .string()
    .nullable()
    .describe(
      "Matched ETAP name (e.g. Runtime, UI, AI Layer, Orchestration, Infrastructure). Null if unclear."
    ),
  subetap: z
    .string()
    .nullable()
    .describe("Matched sub-ETAP if evident. Null otherwise."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Confidence in this interpretation: 1.0 = certain, 0.7 = probable, below 0.5 = speculative."
    ),
  suggestedDependencies: z
    .array(z.string())
    .describe(
      "Short descriptions of tasks this likely depends on. Empty array if none evident."
    ),
  possibleDuplicateHints: z
    .array(z.string())
    .describe(
      "Keyword phrases that might match duplicate existing tasks. Empty array if unlikely duplicate."
    ),
  reasoning: z
    .string()
    .describe(
      "One sentence: why you classified it this way. Shown to user for transparency."
    ),
})

export type Interpretation = z.infer<typeof InterpretationSchema>

export const InterpretationJsonSchema = {
  name: "task_interpretation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      taskType: {
        type: "string",
        enum: ["TASK", "BLOCKER", "IDEA", "DECISION", "BUG", "NOTE", "REFACTOR"],
      },
      priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      project: { type: ["string", "null"] },
      etap: { type: ["string", "null"] },
      subetap: { type: ["string", "null"] },
      confidence: { type: "number" },
      suggestedDependencies: { type: "array", items: { type: "string" } },
      possibleDuplicateHints: { type: "array", items: { type: "string" } },
      reasoning: { type: "string" },
    },
    required: [
      "summary",
      "taskType",
      "priority",
      "project",
      "etap",
      "subetap",
      "confidence",
      "suggestedDependencies",
      "possibleDuplicateHints",
      "reasoning",
    ],
    additionalProperties: false,
  },
} as const
