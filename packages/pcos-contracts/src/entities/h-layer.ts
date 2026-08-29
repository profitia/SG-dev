// =============================================================================
// PCOS Contracts - H-layer Entity Interfaces
// Source of truth: apps/pcos-runtime/prisma/schema.prisma
//
// Naming convention: interface names match Prisma model names exactly.
// This enables drift detection in scripts/generate.mjs.
//
// Runtime WRITES. Explorer READS via these contracts.
// No Prisma dependency. Pure TypeScript.
// =============================================================================

import type {
  CognitionEnvironment,
  HydrationRunStatus,
  HydrationStage,
  IngestBatchStatus,
  ValidationRunStatus,
} from "../enums/hydration";

// - PCOS-H1: Hydration Run ----------------------------------------------------

export interface HydrationRun {
  id: string;
  orgId: string;
  environment: CognitionEnvironment;
  stage: HydrationStage;
  status: HydrationRunStatus;
  isDryRun: boolean;
  replayToken: string | null;
  currentPhase: string | null;
  batchSize: number;
  recordsProcessed: number;
  errorMessage: string | null;
  stateMetadata: unknown | null;
  promotionSourceId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationWatermark {
  id: string;
  orgId: string;
  environment: CognitionEnvironment;
  stage: HydrationStage;
  hydrationRunId: string;
  entityType: string;
  lastHydratedAt: Date | null;
  lastValue: string | null;
  isReset: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CognitionEnvironmentState {
  id: string;
  orgId: string;
  environment: CognitionEnvironment;
  lastHydrationRunId: string | null;
  lastHydrationAt: Date | null;
  lastPromotionAt: Date | null;
  cognitionMaturityScore: number | null;
  isPromotionReady: boolean;
  topologyVersion: string | null;
  stateMetadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// - PCOS-H3: Cognition Substrate ----------------------------------------------

export interface HydrationIngestBatch {
  id: string;
  orgId: string;
  hydrationRunId: string;
  batchIndex: number;
  source: string;
  recordsFetched: number;
  recordsAccepted: number;
  recordsRejected: number;
  cursorStart: string | null;
  cursorEnd: string | null;
  processingMs: number | null;
  status: IngestBatchStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationEntityRecord {
  id: string;
  orgId: string;
  hydrationRunId: string;
  entityType: string;
  externalId: string;
  canonicalId: string | null;
  resolutionStatus: string;
  confidenceScore: number | null;
  resolutionStrategy: string | null;
  entityMetadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationOntologyNode {
  id: string;
  orgId: string;
  hydrationRunId: string;
  nodeType: string;
  nodeKey: string;
  nodePayload: unknown;
  vectorEmbedding: number[];
  ontologyVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationCognitionMemory {
  id: string;
  orgId: string;
  hydrationRunId: string;
  memoryType: string;
  subjectId: string;
  memoryKey: string;
  memoryPayload: unknown;
  temporalContext: string | null;
  confidenceScore: number;
  sourceRunId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationIntelligenceUnit {
  id: string;
  orgId: string;
  hydrationRunId: string;
  intelligenceType: string;
  subjectId: string;
  intelligencePayload: unknown;
  validFrom: Date | null;
  validUntil: Date | null;
  confidenceScore: number;
  dataQualityScore: number;
  sourceRunId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationRetrievalDocument {
  id: string;
  orgId: string;
  hydrationRunId: string;
  indexType: string;
  documentId: string;
  documentType: string;
  documentPayload: unknown;
  searchableTokens: string[];
  embeddingRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationEmbeddingRecord {
  id: string;
  orgId: string;
  hydrationRunId: string;
  documentId: string;
  documentType: string;
  modelId: string;
  vectorJson: string;
  dimensions: number;
  tokenCount: number;
  sourceRunId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface HydrationLineageEvent {
  id: string;
  orgId: string;
  hydrationRunId: string;
  stage: HydrationStage;
  eventType: string;
  entityRef: string | null;
  sourceRef: string | null;
  payload: unknown | null;
  createdAt: Date;
}

export interface HydrationCheckpoint {
  id: string;
  orgId: string;
  hydrationRunId: string;
  stage: HydrationStage;
  checkpointKey: string;
  checkpointData: unknown;
  isConsumed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HydrationTelemetryEvent {
  id: string;
  orgId: string;
  hydrationRunId: string;
  stage: HydrationStage;
  metricName: string;
  metricValue: number;
  tags: unknown | null;
  recordedAt: Date;
}

// - PCOS-H4: Validation & Quality ---------------------------------------------

export interface CognitionValidationRun {
  id: string;
  orgId: string;
  hydrationRunId: string;
  environment: CognitionEnvironment;
  status: ValidationRunStatus;
  currentPhase: string | null;
  overallScore: number | null;
  isPromotionReady: boolean;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CognitionQualityScore {
  id: string;
  orgId: string;
  validationRunId: string;
  dimension: string;
  score: number;
  confidence: number;
  metadata: unknown | null;
  createdAt: Date;
}

export interface PromotionReadinessEvaluation {
  id: string;
  orgId: string;
  validationRunId: string;
  isReady: boolean;
  readinessScore: number;
  blockers: unknown;
  warnings: unknown;
  reasoning: string;
  classifiedAs: string;
  evaluatedAt: Date;
}

export interface CognitionMaturityScore {
  id: string;
  orgId: string;
  validationRunId: string;
  overallScore: number;
  erScore: number;
  ontologyScore: number;
  retrievalScore: number;
  embeddingsScore: number;
  intelligenceScore: number;
  graphScore: number;
  benchmarkScore: number;
  maturityClass: string;
  scoringVersion: string;
  createdAt: Date;
}

export interface ValidationTelemetryEvent {
  id: string;
  orgId: string;
  validationRunId: string;
  phase: string;
  metricName: string;
  metricValue: number;
  tags: unknown | null;
  recordedAt: Date;
}

export interface ValidationLineageEvent {
  id: string;
  orgId: string;
  validationRunId: string;
  phase: string;
  eventType: string;
  entityRef: string | null;
  payload: unknown | null;
  createdAt: Date;
}

// - PCOS-H5: Cognition Promotion ----------------------------------------------

export interface CognitionSnapshot {
  id: string;
  orgId: string;
  promotionRunId: string;
  hydrationRunId: string;
  validationRunId: string;
  status: string;
  snapshotVersion: string;
  integrityHash: string;
  metadata: unknown;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CognitionVersion {
  id: string;
  orgId: string;
  promotionRunId: string;
  snapshotId: string;
  versionString: string;
  semverMajor: number;
  semverMinor: number;
  semverPatch: number;
  versionLabel: string;
  previousVersionId: string | null;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionExecution {
  id: string;
  orgId: string;
  sourceHydrationRunId: string;
  sourceValidationRunId: string;
  currentPhase: string;
  status: string;
  isPromoted: boolean;
  productionVersionId: string | null;
  failureReason: string | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionTelemetryEvent {
  id: string;
  orgId: string;
  promotionRunId: string;
  phase: string;
  eventType: string;
  metricName: string;
  metricValue: number | null;
  tags: unknown | null;
  createdAt: Date;
}

export interface PromotionLineageEvent {
  id: string;
  orgId: string;
  promotionRunId: string;
  phase: string;
  eventType: string;
  entityRef: string | null;
  payload: unknown | null;
  createdAt: Date;
}

// - PCOS-H6: Sandbox / Cognition Branch ---------------------------------------

export interface CognitionBranch {
  id: string;
  orgId: string;
  sandboxId: string;
  sandboxRunId: string;
  sourceRunId: string;
  branchRunId: string;
  branchVersion: string;
  status: string;
  mergedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}