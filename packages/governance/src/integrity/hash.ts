import crypto from "crypto"

import { ConversationType, ExecutionType, GovernanceState, ImportanceLevel, PipelineStatus, ReadinessState, RoadmapPosition } from "../enums/index.js"
import { CANONICAL_ETAPS, CANONICAL_PIPELINES } from "../registries/index.js"

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
    etaps: CANONICAL_ETAPS.map((entry) => ({
      name: entry.name,
      order: entry.order,
      pipeline: entry.pipeline,
      roadmapPosition: entry.roadmapPosition,
    })),
    pipelines: CANONICAL_PIPELINES.map((entry) => ({
      name: entry.name,
      order: entry.order,
      status: entry.status,
    })),
    enums: {
      ConversationType: Object.values(ConversationType).sort(),
      ExecutionType: Object.values(ExecutionType).sort(),
      GovernanceState: Object.values(GovernanceState).sort(),
      ImportanceLevel: Object.values(ImportanceLevel).sort(),
      PipelineStatus: Object.values(PipelineStatus).sort(),
      ReadinessState: Object.values(ReadinessState).sort(),
      RoadmapPosition: Object.values(RoadmapPosition).sort(),
    },
  })
}