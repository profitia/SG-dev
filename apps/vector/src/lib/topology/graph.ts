// VECTOR Topology Engine — Graph Analysis
// Computes layers, bottlenecks, critical paths from topology input

import type {
  TopologyInput,
  TopologyNode,
  TopologyEdge,
  Bottleneck,
  CriticalPath,
  DependencyType,
} from "./types"

// ---- Layer assignment (longest-path DAG algorithm) --------------------------

function computeTopologicalLayers(
  projectIds: string[],
  edges: { source: string; target: string }[]
): Map<string, number> {
  const layers = new Map<string, number>()
  projectIds.forEach((id) => layers.set(id, 0))

  // Iterative longest-path assignment (handles disconnected subgraphs)
  let changed = true
  let iter = 0
  while (changed && iter < 200) {
    changed = false
    iter++
    edges.forEach((e) => {
      const srcLayer = layers.get(e.source) ?? 0
      const targetLayer = layers.get(e.target) ?? 0
      const newTargetLayer = srcLayer + 1
      if (newTargetLayer > targetLayer) {
        layers.set(e.target, newTargetLayer)
        changed = true
      }
    })
  }

  return layers
}

// ---- Bottleneck detection ---------------------------------------------------

function detectBottlenecks(edges: TopologyEdge[]): Bottleneck[] {
  // A bottleneck is a project that many others depend ON (high in-degree)
  const dependents = new Map<string, Set<string>>()
  const depTypes = new Map<string, Set<DependencyType>>()
  const nameMap = new Map<string, { name: string; slug: string }>()

  edges.forEach((e) => {
    if (!dependents.has(e.targetProjectId)) {
      dependents.set(e.targetProjectId, new Set())
      depTypes.set(e.targetProjectId, new Set())
    }
    dependents.get(e.targetProjectId)!.add(e.sourceProjectId)
    depTypes.get(e.targetProjectId)!.add(e.dependencyType)
    nameMap.set(e.targetProjectId, {
      name: e.targetProjectName,
      slug: e.targetProjectId, // use ID as slug fallback
    })
    nameMap.set(e.sourceProjectId, {
      name: e.sourceProjectName,
      slug: e.sourceProjectId,
    })
  })

  return [...dependents.entries()]
    .filter(([, deps]) => deps.size >= 2)
    .map(([projectId, deps]) => ({
      projectId,
      projectName: nameMap.get(projectId)?.name ?? projectId,
      projectSlug: projectId,
      dependentCount: deps.size,
      dependencyTypes: [...depTypes.get(projectId)!],
    }))
    .sort((a, b) => b.dependentCount - a.dependentCount)
}

// ---- Critical path detection ------------------------------------------------

function findCriticalPaths(edges: TopologyEdge[]): CriticalPath[] {
  // Find chains of HIGH or CRITICAL criticality dependencies
  const criticalEdges = edges.filter(
    (e) => e.criticality === "CRITICAL" || e.criticality === "HIGH"
  )
  if (criticalEdges.length === 0) return []

  const adj = new Map<string, string[]>()
  const nameMap = new Map<string, string>()

  criticalEdges.forEach((e) => {
    if (!adj.has(e.sourceProjectId)) adj.set(e.sourceProjectId, [])
    adj.get(e.sourceProjectId)!.push(e.targetProjectId)
    nameMap.set(e.sourceProjectId, e.sourceProjectName)
    nameMap.set(e.targetProjectId, e.targetProjectName)
  })

  const targetIds = new Set(criticalEdges.map((e) => e.targetProjectId))
  const sourceIds = new Set(criticalEdges.map((e) => e.sourceProjectId))
  // True sources: appear as source but never as target (no incoming)
  const trueSources = [...sourceIds].filter((id) => !targetIds.has(id))

  const paths: CriticalPath[] = []

  function dfs(nodeId: string, currentPath: string[]): void {
    const neighbors = adj.get(nodeId) ?? []
    if (neighbors.length === 0) {
      if (currentPath.length >= 2) {
        paths.push({
          projectIds: [...currentPath],
          projectNames: currentPath.map((id) => nameMap.get(id) ?? id),
          reason:
            "Critical dependency chain: " +
            currentPath.map((id) => nameMap.get(id) ?? id).join(" → "),
        })
      }
      return
    }
    neighbors.forEach((next) => {
      if (!currentPath.includes(next)) {
        dfs(next, [...currentPath, next])
      }
    })
  }

  const startNodes = trueSources.length > 0 ? trueSources : [...sourceIds].slice(0, 3)
  startNodes.forEach((source) => dfs(source, [source]))

  return paths.slice(0, 3)
}

// ---- Main graph builder -----------------------------------------------------

export function buildTopologyGraph(input: TopologyInput): {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  bottlenecks: Bottleneck[]
  criticalPaths: CriticalPath[]
  isolatedProjectIds: string[]
} {
  // Build edge list
  const edges: TopologyEdge[] = input.dependencies.map((d) => {
    const src = input.projects.find((p) => p.id === d.sourceProjectId)
    const tgt = input.projects.find((p) => p.id === d.targetProjectId)
    return {
      id: d.id,
      sourceProjectId: d.sourceProjectId,
      targetProjectId: d.targetProjectId,
      sourceProjectName: src?.name ?? d.sourceProjectId,
      targetProjectName: tgt?.name ?? d.targetProjectId,
      dependencyType: d.dependencyType,
      criticality: d.criticality,
      description: d.description,
    }
  })

  // Topological layers (source depends on target → target at lower layer)
  const layerEdges = edges.map((e) => ({
    source: e.sourceProjectId,
    target: e.targetProjectId,
  }))
  const projectIds = input.projects.map((p) => p.id)
  const layers = computeTopologicalLayers(projectIds, layerEdges)

  // Compute in/out degrees
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  projectIds.forEach((id) => {
    inDegree.set(id, 0)
    outDegree.set(id, 0)
  })
  edges.forEach((e) => {
    inDegree.set(e.targetProjectId, (inDegree.get(e.targetProjectId) ?? 0) + 1)
    outDegree.set(e.sourceProjectId, (outDegree.get(e.sourceProjectId) ?? 0) + 1)
  })

  // Bottlenecks (projects with high in-degree)
  const bottlenecks = detectBottlenecks(edges)
  const bottleneckIds = new Set(bottlenecks.map((b) => b.projectId))

  // Domain membership
  const projectDomainNames = new Map<string, string[]>()
  input.domains.forEach((d) => {
    d.projectIds.forEach((pid) => {
      if (!projectDomainNames.has(pid)) projectDomainNames.set(pid, [])
      projectDomainNames.get(pid)!.push(d.name)
    })
  })

  // Build nodes
  const nodes: TopologyNode[] = input.projects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    projectSlug: p.slug,
    projectStatus: p.status,
    layer: layers.get(p.id) ?? 0,
    inDegree: inDegree.get(p.id) ?? 0,
    outDegree: outDegree.get(p.id) ?? 0,
    domainNames: projectDomainNames.get(p.id) ?? [],
    isBottleneck: bottleneckIds.has(p.id),
  }))

  // Critical paths
  const criticalPaths = findCriticalPaths(edges)

  // Isolated: no dependencies at all
  const connectedIds = new Set([
    ...edges.map((e) => e.sourceProjectId),
    ...edges.map((e) => e.targetProjectId),
  ])
  const isolatedProjectIds = projectIds.filter((id) => !connectedIds.has(id))

  return { nodes, edges, bottlenecks, criticalPaths, isolatedProjectIds }
}
