// =============================================================================
// PCOS Contracts - H-layer Enums
// Source of truth: apps/pcos-runtime/prisma/schema.prisma
// DO NOT edit manually - use `npm run generate` to regenerate from runtime.
// =============================================================================

export type CognitionEnvironment = "LAB" | "PROD" | "SANDBOX";

export type HydrationRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "PROMOTED"
  | "CHECKPOINTED";

export type HydrationStage =
  | "H2_SNOWFLAKE_CONNECTIVITY"
  | "H3_LAB_HYDRATION"
  | "H4_COGNITION_VALIDATION"
  | "H5_COGNITION_PROMOTION"
  | "H6_SANDBOX_ORCHESTRATION";

export type IngestBatchStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type ValidationRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CHECKPOINTED";