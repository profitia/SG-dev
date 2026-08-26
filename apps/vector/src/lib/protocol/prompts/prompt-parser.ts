import type { PromptContract } from "../schemas/prompt.schema"

// ── Parse the structured [EXECUTION] prompt block format ─────────────────────
//
// Expected format:
//   [EXECUTION]
//   PROJECT: My Project
//   WORKSPACE: Profitia
//   ETAP: ETAP-07
//   GOAL: Build the protocol layer
//   ...

export interface ParseResult {
  success: boolean
  contract?: PromptContract
  errors: string[]
  raw: string
}

const FIELD_MAP: Record<string, keyof PromptContract> = {
  PROJECT: "project",
  WORKSPACE: "workspace",
  ETAP: "etap",
  SUBETAP: "subetap",
  NODE: "node",
  TYPE: "type",
  DOMAIN: "domain",
  GOAL: "goal",
  INPUTS: "inputs",
  OUTPUTS: "outputs",
  DEPENDENCIES: "dependencies",
  "SUCCESS_CRITERIA": "successCriteria",
  "RUNTIME_RULES": "runtimeRules",
}

const LIST_FIELDS: Array<keyof PromptContract> = [
  "inputs",
  "outputs",
  "dependencies",
  "successCriteria",
  "runtimeRules",
]

export function parsePromptBlock(raw: string): ParseResult {
  const errors: string[] = []
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  // Must start with [EXECUTION]
  if (!lines[0]?.startsWith("[EXECUTION]")) {
    return {
      success: false,
      errors: ["Prompt block must start with [EXECUTION]"],
      raw,
    }
  }

  const fields: Record<string, string[]> = {}
  let currentKey: string | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    // Check for KEY: value pattern
    const colonIdx = line.indexOf(":")
    if (colonIdx > 0) {
      const maybeKey = line.slice(0, colonIdx).trim().toUpperCase().replace(/ /g, "_")
      if (FIELD_MAP[maybeKey] !== undefined) {
        currentKey = maybeKey
        const value = line.slice(colonIdx + 1).trim()
        fields[currentKey] = value ? [value] : []
        continue
      }
    }

    // Continuation line — append to current field
    if (currentKey) {
      if (line.startsWith("-")) {
        fields[currentKey].push(line.slice(1).trim())
      } else {
        // Append to last entry if it exists
        const last = fields[currentKey].at(-1)
        if (last !== undefined) {
          fields[currentKey][fields[currentKey].length - 1] = last + " " + line
        } else {
          fields[currentKey].push(line)
        }
      }
    }
  }

  // Validate required fields
  if (!fields["PROJECT"]?.length) errors.push("PROJECT is required")
  if (!fields["TYPE"]?.length) errors.push("TYPE is required")
  if (!fields["GOAL"]?.length) errors.push("GOAL is required")

  if (errors.length > 0) {
    return { success: false, errors, raw }
  }

  const contract: PromptContract = {
    project: fields["PROJECT"]?.[0] ?? "",
    workspace: fields["WORKSPACE"]?.[0],
    etap: fields["ETAP"]?.[0],
    subetap: fields["SUBETAP"]?.[0],
    node: fields["NODE"]?.[0],
    type: fields["TYPE"]?.[0] ?? "",
    domain: fields["DOMAIN"]?.[0],
    goal: fields["GOAL"]?.[0] ?? "",
    inputs: fields["INPUTS"] ?? [],
    outputs: fields["OUTPUTS"] ?? [],
    dependencies: fields["DEPENDENCIES"] ?? [],
    successCriteria: fields["SUCCESS_CRITERIA"] ?? [],
    runtimeRules: fields["RUNTIME_RULES"] ?? [],
  }

  return { success: true, contract, errors: [], raw }
}
