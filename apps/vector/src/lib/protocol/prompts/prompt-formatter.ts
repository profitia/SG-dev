import type { PromptContract } from "../schemas/prompt.schema"

// ── Format a PromptContract back to the canonical [EXECUTION] block ───────────

function formatList(items: string[], indent = "- "): string {
  if (!items.length) return "  (none)"
  return items.map((item) => `${indent}${item}`).join("\n")
}

export function formatPromptBlock(contract: PromptContract): string {
  const lines: string[] = [
    "[EXECUTION]",
    "",
    `PROJECT:\n${contract.project}`,
  ]

  if (contract.workspace) lines.push(`WORKSPACE:\n${contract.workspace}`)
  if (contract.etap) lines.push(`ETAP:\n${contract.etap}`)
  if (contract.subetap) lines.push(`SUBETAP:\n${contract.subetap}`)
  if (contract.node) lines.push(`NODE:\n${contract.node}`)

  lines.push(`TYPE:\n${contract.type}`)

  if (contract.domain) lines.push(`DOMAIN:\n${contract.domain}`)

  lines.push(`GOAL:\n${contract.goal}`)

  if (contract.inputs.length) {
    lines.push(`INPUTS:\n${formatList(contract.inputs)}`)
  }
  if (contract.outputs.length) {
    lines.push(`OUTPUTS:\n${formatList(contract.outputs)}`)
  }
  if (contract.dependencies.length) {
    lines.push(`DEPENDENCIES:\n${formatList(contract.dependencies)}`)
  }
  if (contract.successCriteria.length) {
    lines.push(`SUCCESS_CRITERIA:\n${formatList(contract.successCriteria)}`)
  }
  if (contract.runtimeRules.length) {
    lines.push(`RUNTIME_RULES:\n${formatList(contract.runtimeRules)}`)
  }

  return lines.join("\n")
}

// ── Format as compact single-line annotation (for inline comments/labels) ─────

export function formatPromptSummary(contract: PromptContract): string {
  const parts = [`[${contract.type.toUpperCase()}]`, contract.project]
  if (contract.etap) parts.push(contract.etap)
  parts.push("→", contract.goal.slice(0, 80))
  return parts.join(" / ")
}
