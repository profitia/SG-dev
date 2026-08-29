// =============================================================================
// @sg/pcos-contracts - Barrel Export
// Canonical H-layer contracts for the PCOS platform.
//
// Ownership: PCOS Runtime (apps/pcos-runtime)
// Consumers: PCOS Explorer, CIC Integration, future runtimes
//
// Interface names match Prisma model names exactly.
// No Prisma dependency - pure TypeScript interfaces.
// Drift is detected by: packages/pcos-contracts/scripts/generate.mjs
// =============================================================================

// Enums
export type {
  CognitionEnvironment,
  HydrationRunStatus,
  HydrationStage,
  IngestBatchStatus,
  ValidationRunStatus,
} from "./enums/hydration";

// H-layer entities (interface names = Prisma model names)
export type {
  // H1 - Lifecycle
  HydrationRun,
  HydrationWatermark,
  CognitionEnvironmentState,
  // H3 - Cognition Substrate
  HydrationIngestBatch,
  HydrationEntityRecord,
  HydrationOntologyNode,
  HydrationCognitionMemory,
  HydrationIntelligenceUnit,
  HydrationRetrievalDocument,
  HydrationEmbeddingRecord,
  HydrationLineageEvent,
  HydrationCheckpoint,
  HydrationTelemetryEvent,
  // H4 - Validation
  CognitionValidationRun,
  CognitionQualityScore,
  CognitionMaturityScore,
  PromotionReadinessEvaluation,
  ValidationTelemetryEvent,
  ValidationLineageEvent,
  // H5 - Promotion
  CognitionSnapshot,
  CognitionVersion,
  PromotionExecution,
  PromotionTelemetryEvent,
  PromotionLineageEvent,
  // H6 - Sandbox / Branch
  CognitionBranch,
} from "./entities/h-layer";

// Canonical Artifact contracts
export type {
  ArtifactContract,
  ArtifactMetadata,
  ArtifactLineage,
  ArtifactReadinessState,
  ArtifactViewMode,
  ArtifactType,
} from "./artifacts/artifact-contract";

export { ARTIFACT_TYPES } from "./artifacts/artifact-contract";

// Contract Governance
export type {
  ContractManifest,
  BreakingChange,
  ChangelogEntry,
} from "./governance/version";
export {
  CONTRACT_VERSION,
  COMPATIBILITY_VERSION,
  SCHEMA_BASELINE,
  CONTRACT_MANIFEST,
} from "./governance/version";