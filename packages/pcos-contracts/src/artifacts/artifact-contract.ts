// =============================================================================
// PCOS Contracts - Canonical Artifact Contract
// Artifact is a first-class entity in the PCOS platform.
// Every data entity surfaced by the Explorer is an Artifact.
// =============================================================================

// - Artifact Readiness --------------------------------------------------------

export type ArtifactReadinessState =
  | "ready"
  | "partial"
  | "registered"
  | "planned";

// - Artifact Lineage ----------------------------------------------------------

export interface ArtifactLineage {
  /** The H-stage that produces this artifact: H3 | H4 | H5 */
  producedBy: string;
  /** The runtime that writes this artifact */
  writer: "pcos-runtime" | "external";
  /** Whether this artifact has an audit trail via HydrationLineageEvent */
  hasLineageEvents: boolean;
  /** Whether this artifact is versioned (deletedAt pattern) */
  isVersioned: boolean;
}

// - Artifact Metadata ---------------------------------------------------------

export interface ArtifactMetadata {
  /** Human-readable label */
  label: string;
  /** Extended description */
  description: string;
  /** Supported view modes */
  supportedViews: ArtifactViewMode[];
  /** Whether this artifact type supports full-text search */
  isSearchable: boolean;
  /** Whether this artifact carries vector embeddings */
  hasEmbeddings: boolean;
  /** Whether this artifact is shared across multiple domains */
  isCrossDomain: boolean;
}

export type ArtifactViewMode = "table" | "card" | "detail" | "timeline" | "graph";

// - Canonical Artifact Contract -----------------------------------------------

/**
 * ArtifactContract - first-class entity definition for any PCOS cognition artifact.
 *
 * Artifacts are the atomic units of cognition data. Domains aggregate artifacts.
 * The registry is the single source of truth for artifact definitions.
 */
export interface ArtifactContract {
  /** Globally unique artifact type identifier (e.g. "OntologyNode") */
  id: string;
  /** Artifact type string - matches registry key */
  type: string;
  /** Domain this artifact primarily belongs to */
  domain: string;
  /** Prisma model / DB table that backs this artifact */
  source: string;
  /** Renderer id that handles this artifact */
  renderer: string;
  /** Human-readable metadata */
  metadata: ArtifactMetadata;
  /** Current readiness state */
  readiness: ArtifactReadinessState;
  /** Lineage and provenance information */
  lineage: ArtifactLineage;
}

// - Canonical Artifact Type Registry ------------------------------------------
// Exhaustive list of all known PCOS artifact types.
// Planned future artifacts are listed with readiness: "planned".

export const ARTIFACT_TYPES = {
  // H3 - Cognition substrate
  ONTOLOGY_NODE: "OntologyNode",
  COGNITION_MEMORY: "CognitionMemory",
  INTELLIGENCE_UNIT: "IntelligenceUnit",
  RETRIEVAL_DOCUMENT: "RetrievalDocument",
  EMBEDDING_RECORD: "EmbeddingRecord",
  HYDRATION_RUN: "HydrationRun",
  HYDRATION_INGEST_BATCH: "HydrationIngestBatch",
  HYDRATION_LINEAGE_EVENT: "HydrationLineageEvent",

  // H4 - Validation
  VALIDATION_RUN: "ValidationRun",
  QUALITY_SCORE: "QualityScore",
  MATURITY_SCORE: "MaturityScore",
  PROMOTION_EVALUATION: "PromotionEvaluation",

  // H5 - Promotion (planned)
  PROMOTION_ARTIFACT: "PromotionArtifact",

  // Future domains (planned)
  GRAPH_NODE: "GraphNode",
  GRAPH_EDGE: "GraphEdge",
  SIMULATION_RUN: "SimulationRun",
  EVOLUTION_DELTA: "EvolutionDelta",
  LINEAGE_TRACE: "LineageTrace",
} as const;

export type ArtifactType = typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES];