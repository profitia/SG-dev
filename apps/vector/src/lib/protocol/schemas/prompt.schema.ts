import { z } from "zod"

// Formal prompt block schema — the structured [EXECUTION] prompt format
export const PromptFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean().default(false),
  description: z.string().optional(),
  placeholder: z.string().optional(),
})

export const PromptContractSchema = z.object({
  type: z.string(),           // e.g. "implementation", "architecture", "blocker-resolution"
  project: z.string(),
  workspace: z.string().optional(),
  etap: z.string().optional(),
  subetap: z.string().optional(),
  node: z.string().optional(),
  domain: z.string().optional(),
  goal: z.string(),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  runtimeRules: z.array(z.string()).default([]),
})

export const PromptTemplateDefinitionSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string().optional(),
  fields: z.array(PromptFieldSchema),
  isBuiltIn: z.boolean().default(false),
})

export type PromptField = z.infer<typeof PromptFieldSchema>
export type PromptContract = z.infer<typeof PromptContractSchema>
export type PromptTemplateDefinition = z.infer<typeof PromptTemplateDefinitionSchema>
