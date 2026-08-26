import { BUILT_IN_TEMPLATES, type BuiltInTemplate } from "../prompts/prompt-generator"
import { db } from "@/lib/db/prisma"

// ── Seed built-in prompt templates into the DB ───────────────────────────────

export async function seedBuiltInTemplates() {
  const results = []
  for (const template of BUILT_IN_TEMPLATES) {
    const record = await db.promptTemplate.upsert({
      where: { name: template.name },
      create: {
        name: template.name,
        category: template.category,
        description: template.description,
        template: buildTemplateString(template),
        fields: buildFieldDefinitions(template) as object,
        isBuiltIn: true,
      },
      update: {
        description: template.description,
        template: buildTemplateString(template),
        fields: buildFieldDefinitions(template) as object,
      },
    })
    results.push(record)
  }
  return results
}

export async function getPromptTemplates() {
  return db.promptTemplate.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
}

export async function getPromptTemplate(name: string) {
  return db.promptTemplate.findUnique({ where: { name } })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTemplateString(template: BuiltInTemplate): string {
  const lines = [
    "[EXECUTION]",
    "",
    "PROJECT:",
    "{{project}}",
    "WORKSPACE:",
    "{{workspace}}",
    "ETAP:",
    "{{etap}}",
    `TYPE:\n${template.category}`,
    "GOAL:",
    "{{goal}}",
    "INPUTS:",
    "{{inputs}}",
    "OUTPUTS:",
    "{{outputs}}",
    "DEPENDENCIES:",
    "{{dependencies}}",
    "SUCCESS_CRITERIA:",
    ...template.successCriteria.map((c) => `- ${c}`),
    "RUNTIME_RULES:",
    ...template.runtimeRules.map((r) => `- ${r}`),
  ]
  return lines.join("\n")
}

function buildFieldDefinitions(template: BuiltInTemplate) {
  return [
    { key: "project", label: "Project", required: true },
    { key: "workspace", label: "Workspace", required: false },
    { key: "etap", label: "ETAP", required: false },
    { key: "goal", label: "Goal", required: true },
    { key: "inputs", label: "Inputs", required: false },
    { key: "outputs", label: "Outputs", required: false },
    { key: "dependencies", label: "Dependencies", required: false },
  ]
}

// ── Built-in template lookup (code-level, no DB needed) ───────────────────────

export { BUILT_IN_TEMPLATES } from "../prompts/prompt-generator"
