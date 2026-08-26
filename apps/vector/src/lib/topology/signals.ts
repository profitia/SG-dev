// VECTOR Topology Engine — Topology Signals
// Detects: bottlenecks, domain concentration, shared blockers, cascade risk, isolation

import type {
  TopologyInput,
  TopologyNode,
  TopologyEdge,
  Bottleneck,
  TopologySignal,
  TopologyDomain,
} from "./types"

const BOTTLENECK_THRESHOLD = 2        // 2+ dependents = bottleneck
const DOMAIN_CONCENTRATION_THRESHOLD = 3  // 3+ projects in one domain

export function generateTopologySignals(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  bottlenecks: Bottleneck[],
  input: TopologyInput
): TopologySignal[] {
  const signals: TopologySignal[] = []

  // ── 1. Topology bottlenecks ──────────────────────────────────────────────
  bottlenecks.forEach((b) => {
    signals.push({
      type: "bottleneck",
      level: b.dependentCount >= 4 ? "critical" : "warning",
      message: `${b.dependentCount} project${b.dependentCount > 1 ? "y" : ""} zależy od ${b.projectName}`,
      projectIds: [b.projectId],
    })
  })

  // ── 2. Cascade risk — if a bottleneck project has active blockers ────────
  const blockedProjectIds = new Set(
    input.sharedBlockers
      .filter((b) => !b.resolved)
      .flatMap((b) => b.affectedProjectIds)
  )
  bottlenecks.forEach((b) => {
    if (blockedProjectIds.has(b.projectId)) {
      signals.push({
        type: "cascade_risk",
        level: "critical",
        message: `${b.projectName} jest bottleneckiem I ma aktywny shared blocker — ryzyko cascade`,
        projectIds: [b.projectId],
      })
    }
  })

  // ── 3. Shared blockers affecting multiple projects ────────────────────────
  const activeSharedBlockers = input.sharedBlockers.filter((b) => !b.resolved)
  activeSharedBlockers.forEach((blocker) => {
    if (blocker.affectedProjectIds.length >= 2) {
      const affectedNames = blocker.affectedProjectIds
        .map((id) => input.projects.find((p) => p.id === id)?.name ?? id)
        .join(", ")
      signals.push({
        type: "shared_blocker",
        level: blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "critical" : "warning",
        message: `"${blocker.title}" blokuje: ${affectedNames}`,
        projectIds: blocker.affectedProjectIds,
      })
    }
  })

  // ── 4. Domain concentration ───────────────────────────────────────────────
  input.domains.forEach((domain) => {
    if (domain.projectIds.length >= DOMAIN_CONCENTRATION_THRESHOLD) {
      signals.push({
        type: "domain_concentration",
        level: "warning",
        message: `${domain.name} obejmuje ${domain.projectIds.length} projekty — wysoka koncentracja`,
        domainName: domain.name,
        projectIds: domain.projectIds,
      })
    }
  })

  // ── 5. Isolated projects (no topology connections) ────────────────────────
  const connectedIds = new Set([
    ...edges.map((e) => e.sourceProjectId),
    ...edges.map((e) => e.targetProjectId),
  ])
  const isolated = nodes.filter(
    (n) => !connectedIds.has(n.projectId) && n.projectStatus === "ACTIVE"
  )
  if (isolated.length > 0) {
    isolated.forEach((n) => {
      signals.push({
        type: "isolated",
        level: "healthy",
        message: `${n.projectName} jest izolowany od topologii — brak zależności`,
        projectIds: [n.projectId],
      })
    })
  }

  // ── 6. Long dependency chains (depth ≥ 3) — potential coupling ────────────
  const maxLayer = Math.max(...nodes.map((n) => n.layer), 0)
  if (maxLayer >= 3) {
    signals.push({
      type: "cascade_risk",
      level: "warning",
      message: `Łańcuch zależności głębokości ${maxLayer} — ryzyko propagacji problemów`,
    })
  }

  return signals
}
