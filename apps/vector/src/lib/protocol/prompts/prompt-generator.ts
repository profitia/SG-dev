import type { PromptContract } from "../schemas/prompt.schema"
import { formatPromptBlock } from "./prompt-formatter"

// ── Built-in execution template definitions ───────────────────────────────────

export type TemplateCategory =
  | "planning"
  | "implementation"
  | "refactor"
  | "architecture"
  | "blocker-resolution"
  | "topology-update"
  | "cognition-analysis"
  | "roadmap-definition"

export interface BuiltInTemplate {
  name: string
  category: TemplateCategory
  description: string
  defaults: Partial<PromptContract>
  runtimeRules: string[]
  successCriteria: string[]
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    name: "planning",
    category: "planning",
    description: "Plan a new ETAP or project phase with explicit scope and success criteria.",
    defaults: { type: "planning" },
    runtimeRules: [
      "All tasks must map to an explicit ETAP",
      "Dependencies must be declared before implementation begins",
      "Success criteria must be measurable and binary",
    ],
    successCriteria: [
      "ETAP structure defined and visible in VECTOR",
      "All dependencies declared",
      "Execution timeline agreed",
    ],
  },
  {
    name: "implementation",
    category: "implementation",
    description: "Execute a defined ETAP — standard delivery protocol.",
    defaults: { type: "implementation" },
    runtimeRules: [
      "Work only within declared ETAP scope",
      "Create tasks in VECTOR before starting",
      "Surface blockers immediately — do not work around them silently",
    ],
    successCriteria: [
      "All tasks in DONE status",
      "No unresolved blockers",
      "Output matches declared OUTPUTS",
    ],
  },
  {
    name: "refactor",
    category: "refactor",
    description: "Refactor existing code or architecture without adding new features.",
    defaults: { type: "refactor" },
    runtimeRules: [
      "Zero new features — strictly scope-locked",
      "Preserve all existing public interfaces",
      "Type check and build must pass after every change",
    ],
    successCriteria: [
      "0 TypeScript errors",
      "Clean production build",
      "No regressions in existing functionality",
    ],
  },
  {
    name: "architecture",
    category: "architecture",
    description: "Design or evolve system architecture — high-impact, reversibility required.",
    defaults: { type: "architecture" },
    runtimeRules: [
      "Document architectural decisions before implementation",
      "Consider topology impact across all dependent projects",
      "All breaking changes must be declared as dependencies",
    ],
    successCriteria: [
      "Architecture documented and observable in VECTOR",
      "All affected projects updated",
      "No hidden coupling introduced",
    ],
  },
  {
    name: "blocker-resolution",
    category: "blocker-resolution",
    description: "Resolve an active blocker — focused, minimal, reversible.",
    defaults: { type: "blocker-resolution" },
    runtimeRules: [
      "Do not introduce scope beyond the blocker",
      "Verify resolution does not create downstream blockers",
      "Update VECTOR execution state immediately after resolution",
    ],
    successCriteria: [
      "Blocker marked RESOLVED in VECTOR",
      "Downstream dependencies unblocked",
      "No new blockers introduced",
    ],
  },
  {
    name: "topology-update",
    category: "topology-update",
    description: "Add or modify project dependencies in the execution topology.",
    defaults: { type: "topology-update" },
    runtimeRules: [
      "Topology changes must be explicit and declared",
      "Assess cascade risk before adding CRITICAL dependencies",
      "Update shared blockers if topology creates new shared pressure",
    ],
    successCriteria: [
      "Topology updated in VECTOR",
      "Cascade risk assessed",
      "No unintended isolation created",
    ],
  },
  {
    name: "cognition-analysis",
    category: "cognition-analysis",
    description: "Run execution cognition analysis — drift, overload, fragmentation.",
    defaults: { type: "cognition-analysis" },
    runtimeRules: [
      "Analysis is read-only — no execution changes during cognition run",
      "All signals must map to observable execution state",
      "Recommendations must be actionable and explicit",
    ],
    successCriteria: [
      "Cognition snapshot captured",
      "All signals classified by severity",
      "At least 1 actionable recommendation produced",
    ],
  },
  {
    name: "roadmap-definition",
    category: "roadmap-definition",
    description: "Define the execution roadmap for a project — ETAPs, milestones, dependencies.",
    defaults: { type: "roadmap-definition" },
    runtimeRules: [
      "Roadmap must be expressible as a DAG",
      "All ETAPs must have explicit success criteria",
      "No circular dependencies allowed",
    ],
    successCriteria: [
      "Roadmap visible as topology in VECTOR",
      "All ETAPs sequenced and ordered",
      "Dependencies declared and validated",
    ],
  },
]

export const TEMPLATE_BY_NAME = Object.fromEntries(
  BUILT_IN_TEMPLATES.map((t) => [t.name, t])
) as Record<string, BuiltInTemplate>

// ── Generate a prompt from template + partial contract ───────────────────────

export interface GeneratePromptInput {
  templateName: TemplateCategory
  project: string
  workspace?: string
  etap?: string
  subetap?: string
  node?: string
  domain?: string
  goal: string
  inputs?: string[]
  outputs?: string[]
  dependencies?: string[]
}

export function generatePrompt(input: GeneratePromptInput): string {
  const template = TEMPLATE_BY_NAME[input.templateName]

  const contract: PromptContract = {
    type: template?.defaults.type ?? input.templateName,
    project: input.project,
    workspace: input.workspace,
    etap: input.etap,
    subetap: input.subetap,
    node: input.node,
    domain: input.domain,
    goal: input.goal,
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    dependencies: input.dependencies ?? [],
    successCriteria: template?.successCriteria ?? [],
    runtimeRules: template?.runtimeRules ?? [],
  }

  return formatPromptBlock(contract)
}
