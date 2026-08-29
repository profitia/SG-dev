// =============================================================================
// @sg/pcos-contracts - Contract Governance Version
//
// CONTRACT_VERSION: Semantic version of the contracts package itself.
//   Bump MAJOR on any breaking interface change (removed field, changed type).
//   Bump MINOR on any additive change (new interface, new optional field).
//   Bump PATCH for documentation or annotation updates.
//
// COMPATIBILITY_VERSION: Minimum runtime schema version this contract requires.
//   "PCOS Runtime schema must be at or above this version for these contracts
//    to be valid."
//
// SCHEMA_BASELINE: Number of H-layer models this version declares.
//   Used by drift detection to confirm expected model count.
// =============================================================================

export const CONTRACT_VERSION = "1.2.0" as const;
export const COMPATIBILITY_VERSION = "1.0.0" as const;
export const SCHEMA_BASELINE = 25 as const;

export interface ContractManifest {
  contractVersion: string;
  compatibilityVersion: string;
  schemaBaseline: number;
  releasedAt: string;
  hlayerModels: string[];
  breakingChanges: BreakingChange[];
  changelog: ChangelogEntry[];
}

export interface BreakingChange {
  version: string;
  description: string;
  affectedModels: string[];
  migrationNote: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "breaking" | "additive" | "patch";
  description: string;
}

export const CONTRACT_MANIFEST: ContractManifest = {
  contractVersion: CONTRACT_VERSION,
  compatibilityVersion: COMPATIBILITY_VERSION,
  schemaBaseline: SCHEMA_BASELINE,
  releasedAt: "2026-05-29T00:00:00Z",
  hlayerModels: [
    "HydrationRun",
    "HydrationWatermark",
    "CognitionEnvironmentState",
    "HydrationIngestBatch",
    "HydrationEntityRecord",
    "HydrationOntologyNode",
    "HydrationLineageEvent",
    "HydrationCheckpoint",
    "HydrationTelemetryEvent",
    "HydrationCognitionMemory",
    "HydrationIntelligenceUnit",
    "HydrationRetrievalDocument",
    "HydrationEmbeddingRecord",
    "CognitionValidationRun",
    "CognitionQualityScore",
    "PromotionReadinessEvaluation",
    "CognitionMaturityScore",
    "ValidationTelemetryEvent",
    "ValidationLineageEvent",
    "CognitionSnapshot",
    "CognitionVersion",
    "PromotionExecution",
    "PromotionTelemetryEvent",
    "PromotionLineageEvent",
    "CognitionBranch",
  ],
  breakingChanges: [],
  changelog: [
    {
      version: "1.0.0",
      date: "2026-05-28",
      type: "additive",
      description: "Initial contract layer - 25 H-layer interfaces, ArtifactContract, ArtifactLineage.",
    },
    {
      version: "1.1.0",
      date: "2026-05-29",
      type: "additive",
      description: "Added ValidationLineageEvent, PromotionLineageEvent, PromotionTelemetryEvent, CognitionSnapshot, CognitionVersion, PromotionExecution to schema baseline.",
    },
    {
      version: "1.2.0",
      date: "2026-05-29",
      type: "additive",
      description: "Added ContractManifest, contract versioning, compatibility version, changelog.",
    },
  ],
};