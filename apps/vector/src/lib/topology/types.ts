// VECTOR Topology Engine — Core Types

export type DependencyType =
  | "runtime"
  | "orchestration"
  | "ui"
  | "infra"
  | "cognition"
  | "ai"
  | "localization"
  | "deployment"

export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type TopologySignalType =
  | "bottleneck"
  | "domain_concentration"
  | "shared_blocker"
  | "isolated"
  | "critical_path"
  | "cascade_risk"

// ---- Input types (plain objects from DB) ------------------------------------

export interface TopologyProject {
  id: string
  name: string
  slug: string
  status: string
}

export interface TopologyDependency {
  id: string
  sourceProjectId: string
  targetProjectId: string
  dependencyType: DependencyType
  criticality: Criticality
  description: string | null
}

export interface TopologyDomain {
  id: string
  name: string
  description: string | null
  projectIds: string[]
}

export interface TopologySharedBlocker {
  id: string
  title: string
  severity: Criticality
  description: string | null
  resolved: boolean
  affectedProjectIds: string[]
}

export interface TopologyInput {
  projects: TopologyProject[]
  dependencies: TopologyDependency[]
  domains: TopologyDomain[]
  sharedBlockers: TopologySharedBlocker[]
}

// ---- Analysis output types --------------------------------------------------

export interface TopologyNode {
  projectId: string
  projectName: string
  projectSlug: string
  projectStatus: string
  layer: number           // topological depth (0 = core dependency)
  inDegree: number        // projects depending ON this one
  outDegree: number       // projects this one depends ON
  domainNames: string[]
  isBottleneck: boolean
}

export interface TopologyEdge {
  id: string
  sourceProjectId: string
  targetProjectId: string
  sourceProjectName: string
  targetProjectName: string
  dependencyType: DependencyType
  criticality: Criticality
  description: string | null
}

export interface Bottleneck {
  projectId: string
  projectName: string
  projectSlug: string
  dependentCount: number
  dependencyTypes: DependencyType[]
}

export interface CriticalPath {
  projectIds: string[]
  projectNames: string[]
  reason: string
}

export interface TopologySignal {
  type: TopologySignalType
  level: "healthy" | "warning" | "critical"
  message: string
  projectIds?: string[]
  domainName?: string
}

export interface TopologyRecommendation {
  title: string
  reasoning: string
  priority: "high" | "medium"
}

export interface TopologyAnalysis {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  bottlenecks: Bottleneck[]
  criticalPaths: CriticalPath[]
  isolatedProjectIds: string[]
  domains: TopologyDomain[]
  sharedBlockers: TopologySharedBlocker[]
  signals: TopologySignal[]
  recommendations: TopologyRecommendation[]
  generatedAt: Date
}
