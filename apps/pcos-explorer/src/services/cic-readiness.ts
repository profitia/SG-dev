// PCOS Cognition Explorer — CIC Readiness Analysis
//
// This file documents the integration readiness assessment for:
//   PCOS Runtime → Cognition Runtime → CIC → Explorer
//
// STATUS: ANALYSIS ONLY. No CIC integration is implemented here.
// This file is a living architectural contract — update as integration evolves.
//
// ─────────────────────────────────────────────────────────────────────────────
// TARGET INTEGRATION TOPOLOGY:
//
//   PCOS Runtime (H1–H6)
//     ↓ writes cognition substrate to PostgreSQL
//   Cognition Runtime (CR)
//     ↓ runs inference, retrieval, reasoning on top of substrate
//   Conversational Intelligence Core (CIC)
//     ↓ provides conversational interface over CR + substrate
//   PCOS Explorer
//     ↓ observes, explores, validates, promotes cognition artifacts
// ─────────────────────────────────────────────────────────────────────────────

// ── Integration Point Types ───────────────────────────────────────────────────

export interface CICIntegrationPoint {
  /** Unique identifier for this integration point */
  id: string;
  /** Human-readable description */
  description: string;
  /** Current Explorer capability that maps to this integration point */
  explorerCapability: string;
  /** What CIC would need from Explorer */
  cicNeeds: string;
  /** What Explorer would need from CIC */
  explorerNeeds: string;
  /** Readiness status */
  status:
    | "ready"         // Explorer can serve this immediately
    | "partial"       // Capability exists, needs adaptation
    | "missing"       // Integration point not yet implemented
    | "out-of-scope"; // Not required for Explorer↔CIC integration
  /** What must be built before this is ready */
  blockers: string[];
}

// ── Current Integration Point Analysis ───────────────────────────────────────

export const CIC_INTEGRATION_POINTS: CICIntegrationPoint[] = [
  {
    id: "artifact-query-api",
    description:
      "CIC needs to query cognition artifacts (ontology nodes, memory, intelligence units) to ground its responses.",
    explorerCapability:
      "Domain queries via DomainEngine + Prisma (structured data access to all H-layer artifacts).",
    cicNeeds:
      "REST or RPC endpoint returning typed artifact data per domain and entityRef.",
    explorerNeeds:
      "CIC session context (orgId, environment, active hydrationRunId).",
    status: "partial",
    blockers: [
      "Explorer has no REST API layer — only Next.js Server Components.",
      "Need: src/app/api/artifacts/[domain]/route.ts",
    ],
  },
  {
    id: "lineage-trace-api",
    description:
      "CIC needs to trace artifact provenance to answer 'why does this intelligence unit say X?'",
    explorerCapability:
      "LineageService.resolveArtifactProvenance() covers H3→H4→H5 chain.",
    cicNeeds:
      "REST endpoint: GET /api/lineage/artifact/{artifactType}?entityRef={id}",
    explorerNeeds: "Artifact entityRef from CIC context.",
    status: "partial",
    blockers: [
      "LineageService exists but is not exposed as an API route.",
      "Need: src/app/api/lineage/route.ts wrapping lineage-service.ts",
    ],
  },
  {
    id: "health-status-api",
    description:
      "CIC needs to know current cognition substrate health before answering confidence-sensitive questions.",
    explorerCapability:
      "RuntimeHealthService.computePlatformRuntimeHealth() computes real DB health.",
    cicNeeds:
      "REST endpoint: GET /api/health → PlatformRuntimeHealth JSON.",
    explorerNeeds: "Nothing — health is self-contained.",
    status: "partial",
    blockers: [
      "Health service exists but is not exposed as an API route.",
      "Need: src/app/api/health/route.ts",
    ],
  },
  {
    id: "domain-registry-api",
    description:
      "CIC needs to understand which domains and artifact types are available.",
    explorerCapability:
      "Domain Registry + Artifact Registry (getAllDomains, getAllArtifacts).",
    cicNeeds:
      "REST endpoint: GET /api/registry → domains + artifacts JSON manifest.",
    explorerNeeds: "Nothing — registry is self-contained.",
    status: "partial",
    blockers: [
      "Registry exists but is not exposed as an API route.",
      "Need: src/app/api/registry/route.ts",
    ],
  },
  {
    id: "observability-events",
    description:
      "CIC should emit usage events back to Explorer for observability.",
    explorerCapability:
      "Observability Service (recordQueryExecution, recordRenderCompletion) exists.",
    cicNeeds: "POST endpoint: POST /api/metrics — accepts MetricEvent[].",
    explorerNeeds: "Nothing — observability layer is architecture-ready.",
    status: "missing",
    blockers: [
      "No inbound metrics endpoint exists.",
      "Need: src/app/api/metrics/route.ts accepting external MetricEvent[]",
      "Need: auth/signature on inbound endpoint (prevent arbitrary metric injection).",
    ],
  },
  {
    id: "org-scoping",
    description:
      "CIC operates in a multi-org context. Explorer must scope all queries to the correct org.",
    explorerCapability:
      "EXPLORER_ORG_ID env var is used in every query. Single-org per deployment.",
    cicNeeds:
      "Either: org-scoped deployment of Explorer, or: orgId param in API calls.",
    explorerNeeds: "Auth context from CIC (orgId per request).",
    status: "partial",
    blockers: [
      "Explorer is currently single-org per deployment.",
      "For multi-org CIC integration: need orgId extracted from JWT/session, not env var.",
      "Refactor: replace EXPLORER_ORG_ID with extractOrgId(request) pattern.",
    ],
  },
  {
    id: "environment-scoping",
    description:
      "CIC operates across LAB/PROD/SANDBOX environments. Explorer must support multi-env queries.",
    explorerCapability:
      "EXPLORER_ENV env var — single environment per deployment.",
    cicNeeds:
      "Environment param in API calls (environment: 'LAB' | 'PROD' | 'SANDBOX').",
    explorerNeeds: "Auth context with env claim.",
    status: "partial",
    blockers: [
      "Explorer is single-env per deployment.",
      "Need: environment extracted from CIC request context.",
    ],
  },
  {
    id: "websocket-streaming",
    description:
      "CIC conversations may need real-time updates on artifact freshness or hydration status.",
    explorerCapability: "None — Explorer is request/response only.",
    cicNeeds: "WebSocket or SSE stream for live substrate status updates.",
    explorerNeeds: "Nothing.",
    status: "missing",
    blockers: [
      "Not implemented.",
      "Not required for initial CIC integration.",
      "Future: Next.js Route Handler + SSE for hydration run progress.",
    ],
  },
  {
    id: "contract-sharing",
    description:
      "CIC must use the same H-layer type contracts as Explorer to avoid type drift.",
    explorerCapability:
      "@sg/pcos-contracts package — 25 H-layer interfaces, versioned, drift-detected.",
    cicNeeds:
      "Import @sg/pcos-contracts as a shared package (monorepo or npm package).",
    explorerNeeds: "Nothing — contracts are already exported.",
    status: "ready",
    blockers: [],
  },
  {
    id: "lineage-rendering",
    description:
      "Explorer must be able to render lineage chains requested by CIC for visualization.",
    explorerCapability:
      "LineageService provides LineageChain and ArtifactProvenance data.",
    cicNeeds:
      "Deep-link to Explorer lineage view: /lineage/{artifactType}?entityRef={id}",
    explorerNeeds: "A dedicated Lineage domain page (currently not a route).",
    status: "missing",
    blockers: [
      "No /lineage route exists yet.",
      "LineageService is fully implemented — route + renderer needed.",
      "Effort: ~2h (definition + query + renderer + page = same pattern as Promotion).",
    ],
  },
];

// ── Readiness Summary ─────────────────────────────────────────────────────────

export interface CICReadinessSummary {
  totalPoints: number;
  readyPoints: number;
  partialPoints: number;
  missingPoints: number;
  outOfScopePoints: number;
  readinessPercent: number;
  criticalMissing: string[];
  immediateActions: string[];
}

export function assessCICReadiness(): CICReadinessSummary {
  const total = CIC_INTEGRATION_POINTS.length;
  const ready = CIC_INTEGRATION_POINTS.filter((p) => p.status === "ready").length;
  const partial = CIC_INTEGRATION_POINTS.filter((p) => p.status === "partial").length;
  const missing = CIC_INTEGRATION_POINTS.filter((p) => p.status === "missing").length;
  const outOfScope = CIC_INTEGRATION_POINTS.filter(
    (p) => p.status === "out-of-scope"
  ).length;

  const criticalMissing = CIC_INTEGRATION_POINTS.filter(
    (p) => p.status === "missing" && p.id !== "websocket-streaming"
  ).map((p) => p.id);

  const immediateActions = [
    "Add src/app/api/artifacts/[domain]/route.ts (artifact query API)",
    "Add src/app/api/lineage/route.ts (lineage trace API)",
    "Add src/app/api/health/route.ts (health status API)",
    "Add src/app/api/registry/route.ts (domain + artifact manifest)",
    "Refactor orgId extraction: env var → request context for multi-org CIC",
    "Add /lineage route + renderer (enables CIC deep-links)",
  ];

  return {
    totalPoints: total,
    readyPoints: ready,
    partialPoints: partial,
    missingPoints: missing,
    outOfScopePoints: outOfScope,
    readinessPercent: Math.round(((ready + partial * 0.5) / total) * 100),
    criticalMissing,
    immediateActions,
  };
}
