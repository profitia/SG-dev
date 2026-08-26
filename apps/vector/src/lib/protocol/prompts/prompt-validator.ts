import { PromptContractSchema, type PromptContract } from "../schemas/prompt.schema"

// ── Validate a parsed PromptContract against the schema ───────────────────────

export interface ValidationResult {
  valid: boolean
  contract?: PromptContract
  errors: string[]
}

export function validatePromptContract(input: unknown): ValidationResult {
  const result = PromptContractSchema.safeParse(input)

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    )
    return { valid: false, errors }
  }

  return { valid: true, contract: result.data, errors: [] }
}

// ── Validate a raw prompt string end-to-end ───────────────────────────────────

import { parsePromptBlock } from "./prompt-parser"

export function validateRawPrompt(raw: string): ValidationResult {
  const parsed = parsePromptBlock(raw)
  if (!parsed.success || !parsed.contract) {
    return { valid: false, errors: parsed.errors }
  }
  return validatePromptContract(parsed.contract)
}
