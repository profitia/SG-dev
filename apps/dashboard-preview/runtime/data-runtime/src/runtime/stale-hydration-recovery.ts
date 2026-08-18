import type { ExecutionLifecycleStore, StaleExecutionRecord } from "./persistence/execution-lifecycle-store.ts";
import { DEFAULT_EXECUTION_LEASE_RECOVERY_GRACE_MS } from "./execution-lease.ts";

export interface StaleHydrationRecoveryPlanInput {
  organizationId: string;
  staleThresholdMs: number;
  pipelineCode?: string;
  limit?: number;
  databaseNow?: Date;
}

export type StaleHydrationRecoveryClassification =
  | "ACTIVE_LEASE"
  | "EXPIRED_LEASE"
  | "LEASE_LOST"
  | "LEGACY_RUNNING_WITHOUT_LEASE"
  | "TERMINAL"
  | "RECOVERY_BLOCKED";

export type StaleHydrationRecoveryEligibility =
  | "NOT_OLD_ENOUGH"
  | "RECOVERY_ELIGIBLE"
  | "RECOVERY_BLOCKED";

export interface StaleHydrationRecoveryCandidate {
  runId: string;
  runDatasetId: string;
  currentRunStatus: string;
  currentRunDatasetStatus: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  leaseEpoch: string;
  source: string;
  dataset: string;
  pipeline: string;
  classification: StaleHydrationRecoveryClassification;
  recoveryEligibility: StaleHydrationRecoveryEligibility;
  eligibilityReason: string;
}

export interface StaleHydrationRecoveryPlan {
  mode: "plan-only";
  organizationId: string;
  staleThresholdMs: number;
  generatedAt: string;
  candidateCount: number;
  candidates: StaleHydrationRecoveryCandidate[];
}

export async function planStaleHydrationExecutions(
  store: ExecutionLifecycleStore,
  input: StaleHydrationRecoveryPlanInput,
): Promise<StaleHydrationRecoveryPlan> {
  if (!input.organizationId.trim()) {
    throw new Error("Stale recovery planning requires a non-empty organizationId.");
  }

  if (!Number.isFinite(input.staleThresholdMs) || input.staleThresholdMs <= 0) {
    throw new Error("Stale recovery planning requires a positive staleThresholdMs.");
  }

  const databaseNow = input.databaseNow ?? await store.getDatabaseNow();
  const limit = input.limit ?? 100;
  const records = await store.listStaleRunningExecutions({
    organizationId: input.organizationId,
    pipelineCode: input.pipelineCode,
    limit,
  });

  return {
    mode: "plan-only",
    organizationId: input.organizationId,
    staleThresholdMs: input.staleThresholdMs,
    generatedAt: databaseNow.toISOString(),
    candidateCount: records.length,
    candidates: records.map((record) => toRecoveryCandidate(record, databaseNow, input.staleThresholdMs)),
  };
}

function toRecoveryCandidate(
  record: StaleExecutionRecord,
  databaseNow: Date,
  staleThresholdMs: number,
): StaleHydrationRecoveryCandidate {
  const classification = classifyRecord(record, databaseNow);
  const recoveryEligibility = classifyRecoveryEligibility(record, databaseNow, staleThresholdMs);

  return {
    runId: record.runId,
    runDatasetId: record.runDatasetId,
    currentRunStatus: record.runStatus,
    currentRunDatasetStatus: record.runDatasetStatus,
    startedAt: record.runStartedAt?.toISOString() ?? null,
    heartbeatAt: record.leaseHeartbeatAt?.toISOString() ?? null,
    leaseExpiresAt: record.leaseExpiresAt?.toISOString() ?? null,
    leaseEpoch: record.leaseEpoch.toString(),
    source: record.sourceCode,
    dataset: record.datasetCode,
    pipeline: record.pipelineCode,
    classification,
    recoveryEligibility,
    eligibilityReason: toEligibilityReason(classification, recoveryEligibility),
  };
}

function classifyRecord(
  record: StaleExecutionRecord,
  databaseNow: Date,
): StaleHydrationRecoveryClassification {
  if (record.runStatus !== "RUNNING") {
    return "TERMINAL";
  }

  const leaseComplete = Boolean(record.leaseOwnerId && record.leaseTokenHashPresent && record.leaseExpiresAt);

  if (!leaseComplete) {
    return "LEGACY_RUNNING_WITHOUT_LEASE";
  }

  const expiresAt = record.leaseExpiresAt as Date;

  if (expiresAt.getTime() > databaseNow.getTime()) {
    return "ACTIVE_LEASE";
  }

  if (expiresAt.getTime() + DEFAULT_EXECUTION_LEASE_RECOVERY_GRACE_MS < databaseNow.getTime()) {
    return "LEASE_LOST";
  }

  return "EXPIRED_LEASE";
}

function classifyRecoveryEligibility(
  record: StaleExecutionRecord,
  databaseNow: Date,
  staleThresholdMs: number,
): StaleHydrationRecoveryEligibility {
  const classification = classifyRecord(record, databaseNow);

  if (classification === "TERMINAL" || classification === "LEGACY_RUNNING_WITHOUT_LEASE" || classification === "ACTIVE_LEASE") {
    return "RECOVERY_BLOCKED";
  }

  if (!record.runStartedAt) {
    return "RECOVERY_BLOCKED";
  }

  const staleCutoff = databaseNow.getTime() - staleThresholdMs;

  if (record.runStartedAt.getTime() > staleCutoff) {
    return "NOT_OLD_ENOUGH";
  }

  if (classification === "LEASE_LOST") {
    return "RECOVERY_ELIGIBLE";
  }

  return "RECOVERY_BLOCKED";
}

function toEligibilityReason(
  classification: StaleHydrationRecoveryClassification,
  recoveryEligibility: StaleHydrationRecoveryEligibility,
): string {
  if (recoveryEligibility === "RECOVERY_ELIGIBLE") {
    return "Lease expiry, grace, and stale threshold all permit single-run recovery apply.";
  }

  if (recoveryEligibility === "NOT_OLD_ENOUGH") {
    return "Lease authority is no longer active, but the operator stale threshold has not yet been reached.";
  }

  switch (classification) {
    case "ACTIVE_LEASE":
      return "Run is still protected by an active lease.";
    case "EXPIRED_LEASE":
      return "Lease expired, but recovery grace has not elapsed yet.";
    case "LEASE_LOST":
      return "Lease authority was lost and operator review is required.";
    case "LEGACY_RUNNING_WITHOUT_LEASE":
      return "Legacy RUNNING row is missing the complete lease identity required for normal apply.";
    case "TERMINAL":
      return "Run is already terminal and excluded from stale recovery apply.";
    case "RECOVERY_BLOCKED":
      return "Run state is malformed or ambiguous and is blocked from normal apply.";
  }
}