import crypto from "crypto"

import { ConversationType, ExecutionType, GovernanceState, ImportanceLevel, ReadinessState, ScopeClassification } from "../enums/index.js"

export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj)
  if (typeof obj !== "object") return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map((value) => stableStringify(value)).join(",")}]`
  const record = obj as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex")
}

export function hashObject(obj: unknown): string {
  return sha256(stableStringify(obj))
}

export function hashText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return sha256(normalized)
}

export function computeCanonicalGovernanceHash(): string {
  return hashObject({
    enums: {
      ConversationType: Object.values(ConversationType).sort(),
      ExecutionType: Object.values(ExecutionType).sort(),
      GovernanceState: Object.values(GovernanceState).sort(),
      ImportanceLevel: Object.values(ImportanceLevel).sort(),
      ReadinessState: Object.values(ReadinessState).sort(),
      ScopeClassification: Object.values(ScopeClassification).sort(),
    },
  })
}
