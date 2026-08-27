/**
 * Canonical Governance Registries — SpendGuru 2.0
 * @package @sg/governance
 */

import { PipelineStatus, ReadinessState, RoadmapPosition, ScopeClassification } from "../enums/index.js"

export interface CanonicalEtapEntry {
  readonly name: string
  readonly order: number
  readonly roadmapPosition: RoadmapPosition
  readonly pipeline: string
}

export const CANONICAL_ETAPS: readonly CanonicalEtapEntry[] = Object.freeze([
  { name: "MVP-0 — Scope & Client Setup", order: 100, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-1 — Minimal Tenant Foundation", order: 101, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-2 — App Shell + AI Workspace Lite", order: 102, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-3 — Snowflake Direct/Cache v1", order: 103, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-4 — Supplier Registry v1", order: 104, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-5 — AI Runtime / Action Pipeline v1", order: 105, roadmapPosition: RoadmapPosition.DEPENDENCY_UNLOCK, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-6 — Category + Cost Components", order: 106, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-7 — SMART Offer Analysis Cut", order: 107, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-8 — Negotiation Brief v1", order: 108, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-10 — Demo Home + Client Flow", order: 110, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "MVP-11 — Stabilizacja / Deploy", order: 111, roadmapPosition: RoadmapPosition.CRITICAL_PATH_GATE, pipeline: "MVP-SEPTEMBER-2026" },
  { name: "SAAS-1 — Self-service Account & Onboarding", order: 121, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "SAAS-2 — Enterprise Identity & Security", order: 122, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "SAAS-3 — Data Platform Hardening", order: 123, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "SAAS-4 — Offer Intelligence Full", order: 124, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "SAAS-5 — AI Orchestration Runtime", order: 125, roadmapPosition: RoadmapPosition.DEPENDENCY_UNLOCK, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "SAAS-6 — Product Workflows Expansion", order: 126, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "SAAS-7 — Daily Engagement & Enterprise", order: 127, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "FULL-SAAS-ROADMAP" },
  { name: "PCOS-1 — Raw Operational Landing Zone", order: 201, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-2 — Entity Resolution + Canonicalization", order: 202, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-3 — Canonical Procurement Normalization", order: 203, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-4 — Ontology Runtime Domain", order: 204, roadmapPosition: RoadmapPosition.DEPENDENCY_UNLOCK, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-5 — Memory Runtime Domain", order: 205, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-6 — Intelligence Runtime Domain", order: 206, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-7 — AI Retrieval Runtime Domain", order: 207, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-8 — SG2 Integration Runtime Domain", order: 208, roadmapPosition: RoadmapPosition.CRITICAL_PATH_GATE, pipeline: "PCOS-RUNTIME" },
  { name: "PCOS-H1 — Operational Topology Bootstrap", order: 301, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "PCOS-HYDRATION-LIFECYCLE" },
  { name: "PCOS-H2 — Real Snowflake Connectivity Runtime", order: 302, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "PCOS-HYDRATION-LIFECYCLE" },
  { name: "PCOS-H3 — LAB Hydration Runtime", order: 303, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-HYDRATION-LIFECYCLE" },
  { name: "PCOS-H4 — Cognition Validation & Quality Runtime", order: 304, roadmapPosition: RoadmapPosition.DEPENDENCY_UNLOCK, pipeline: "PCOS-HYDRATION-LIFECYCLE" },
  { name: "PCOS-H5 — Cognition Promotion Runtime", order: 305, roadmapPosition: RoadmapPosition.CRITICAL_PATH_GATE, pipeline: "PCOS-HYDRATION-LIFECYCLE" },
  { name: "PCOS-H6 — Sandbox Runtime Orchestration", order: 306, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-HYDRATION-LIFECYCLE" },
  { name: "PCOS-LIVE-1 — Operational Persistence Activation", order: 401, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-2 — Controlled Snowflake Connectivity", order: 402, roadmapPosition: RoadmapPosition.INFRA_FOUNDATION, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-3 — Discovery Integration Bridge", order: 403, roadmapPosition: RoadmapPosition.DEPENDENCY_UNLOCK, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-4 — First Real LAB Hydration Execution", order: 404, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-5 — Cognition Validation & Maturity", order: 405, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-6 — LAB Runtime Simulation", order: 406, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-7 — Controlled Promotion LAB to PROD", order: 407, roadmapPosition: RoadmapPosition.CRITICAL_PATH_GATE, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-8 — SG2 + CIC Runtime Integration", order: 408, roadmapPosition: RoadmapPosition.CRITICAL_PATH, pipeline: "PCOS-LIVE-EXECUTION" },
  { name: "PCOS-LIVE-9 — Continuous Cognition Evolution", order: 409, roadmapPosition: RoadmapPosition.PARALLEL_PATH, pipeline: "PCOS-LIVE-EXECUTION" },
] as const)

export const CANONICAL_ETAP_NAMES: ReadonlySet<string> = new Set(CANONICAL_ETAPS.map((entry) => entry.name))

export interface CanonicalPipelineEntry {
  readonly name: string
  readonly order: number
  readonly status: PipelineStatus
  readonly taskCount: number
  readonly targetDate: string
}

export const CANONICAL_PIPELINES: readonly CanonicalPipelineEntry[] = Object.freeze([
  { name: "MVP-SEPTEMBER-2026", order: 10, status: PipelineStatus.ACTIVE, taskCount: 61, targetDate: "2026-09-01" },
  { name: "FULL-SAAS-ROADMAP", order: 11, status: PipelineStatus.PLANNED, taskCount: 25, targetDate: "post-MVP" },
  { name: "PCOS-RUNTIME", order: 12, status: PipelineStatus.ACTIVE, taskCount: 8, targetDate: "2026-Q4" },
  { name: "PCOS-HYDRATION-LIFECYCLE", order: 13, status: PipelineStatus.COMPLETE, taskCount: 6, targetDate: "2026-05-28" },
  { name: "PCOS-LIVE-EXECUTION", order: 14, status: PipelineStatus.PLANNED, taskCount: 9, targetDate: "2026-Q3" },
] as const)

export const CANONICAL_PIPELINE_NAMES: ReadonlySet<string> = new Set(CANONICAL_PIPELINES.map((entry) => entry.name))
export const CANONICAL_ROADMAP_POSITIONS: ReadonlySet<string> = new Set(Object.values(RoadmapPosition))
export const CANONICAL_READINESS_STATES: ReadonlySet<string> = new Set(Object.values(ReadinessState))
export const CANONICAL_SCOPE_CLASSIFICATIONS: ReadonlySet<string> = new Set(Object.values(ScopeClassification))
export const LEGACY_ETAP_PREFIXES: readonly string[] = Object.freeze([
  "ETAP 0",
  "ETAP 1",
  "ETAP 2",
  "ETAP 3",
  "ETAP 4",
  "ETAP 5",
  "ETAP 6",
  "ETAP 7",
  "ETAP 8",
  "ETAP 9",
  "ETAP 10",
  "ETAP 11",
  "ETAP 12",
  "ETAP 01",
  "ETAP 02",
])