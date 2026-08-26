import { z } from "zod"

export const SignalTypeSchema = z.enum([
  "bottleneck",
  "cascade_risk",
  "shared_blocker",
  "domain_concentration",
  "isolated",
  "cascade_chain",
  "drift",
  "overload",
  "fragmentation",
])

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])

export const SignalSchema = z.object({
  id: z.string(),
  type: SignalTypeSchema,
  title: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  affectedProjectIds: z.array(z.string()),
  createdAt: z.coerce.date(),
})

export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  rationale: z.string(),
  action: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  relatedSignalIds: z.array(z.string()),
})

export type Signal = z.infer<typeof SignalSchema>
export type Recommendation = z.infer<typeof RecommendationSchema>
export type SignalType = z.infer<typeof SignalTypeSchema>
export type Severity = z.infer<typeof SeveritySchema>
