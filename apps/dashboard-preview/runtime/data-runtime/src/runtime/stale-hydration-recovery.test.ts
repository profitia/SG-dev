import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateRunningLifecycleInput,
  ExecutionLifecycleStore,
  PersistTerminalLifecycleInput,
  PersistedLifecycleTransitionResult,
  RecoverStaleExecutionApplyInput,
  RecoverStaleExecutionApplyResult,
  StaleExecutionQueryInput,
  StaleExecutionRecord,
} from "./persistence/execution-lifecycle-store.ts";
import type { PersistedExecutionLease } from "./execution-lease.ts";
import { planStaleHydrationExecutions } from "./stale-hydration-recovery.ts";

class FakeStaleRecoveryStore implements ExecutionLifecycleStore {
  constructor(
    private readonly records: StaleExecutionRecord[],
    private readonly databaseNow: Date,
  ) {}

  async getDatabaseNow(): Promise<Date> {
    return this.databaseNow;
  }

  async createRunningLifecycle(_: CreateRunningLifecycleInput): Promise<PersistedLifecycleTransitionResult> {
    throw new Error("Not used in stale recovery tests.");
  }

  async persistTerminalLifecycle(_: PersistTerminalLifecycleInput): Promise<PersistedLifecycleTransitionResult> {
    throw new Error("Not used in stale recovery tests.");
  }

  async renewRunningLease(): Promise<PersistedExecutionLease> {
    throw new Error("Not used in stale recovery tests.");
  }

  async assertActiveRunLease(): Promise<boolean> {
    throw new Error("Not used in stale recovery tests.");
  }

  async listStaleRunningExecutions(input: StaleExecutionQueryInput): Promise<StaleExecutionRecord[]> {
    return this.records
      .filter((record) => input.pipelineCode ? record.pipelineCode === input.pipelineCode : true)
      .slice(0, input.limit);
  }

  async recoverStaleExecutionApply(_input: RecoverStaleExecutionApplyInput): Promise<RecoverStaleExecutionApplyResult> {
    throw new Error("Not used in stale recovery tests.");
  }

  async disconnect(): Promise<void> {
    return;
  }
}

test("stale recovery plan includes only old RUNNING executions", async () => {
  const store = new FakeStaleRecoveryStore([
    {
      runId: "run-old",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T10:00:00.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-1",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(1),
      leaseHeartbeatAt: new Date("2026-07-22T11:55:00.000Z"),
      leaseExpiresAt: new Date("2026-07-22T11:56:00.000Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-old",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
    {
      runId: "run-fresh",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T11:50:00.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-2",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(1),
      leaseHeartbeatAt: new Date("2026-07-22T11:59:45.000Z"),
      leaseExpiresAt: new Date("2026-07-22T12:01:00.000Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-fresh",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
    {
      runId: "run-succeeded",
      runStatus: "SUCCEEDED",
      runStartedAt: new Date("2026-07-22T09:00:00.000Z"),
      runCompletedAt: new Date("2026-07-22T09:10:00.000Z"),
      runFailedAt: null,
      leaseOwnerId: null,
      leaseTokenHashPresent: false,
      leaseEpoch: BigInt(0),
      leaseHeartbeatAt: null,
      leaseExpiresAt: null,
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-succeeded",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
  ], new Date("2026-07-22T12:00:00.000Z"));

  const plan = await planStaleHydrationExecutions(store, {
    organizationId: "org-test",
    staleThresholdMs: 60 * 60 * 1000,
  });

  assert.equal(plan.mode, "plan-only");
  assert.equal(plan.candidateCount, 3);
  assert.equal(plan.candidates[0]?.runId, "run-old");
  assert.equal(plan.generatedAt, "2026-07-22T12:00:00.000Z");
  assert.equal(plan.candidates[0]?.classification, "LEASE_LOST");
  assert.equal(plan.candidates[0]?.recoveryEligibility, "RECOVERY_ELIGIBLE");
  assert.equal(plan.candidates[1]?.classification, "ACTIVE_LEASE");
  assert.equal(plan.candidates[1]?.recoveryEligibility, "RECOVERY_BLOCKED");
  assert.equal(plan.candidates[2]?.classification, "TERMINAL");
  assert.equal(plan.candidates[2]?.recoveryEligibility, "RECOVERY_BLOCKED");
});

test("stale recovery plan uses database time for classification boundaries", async () => {
  const store = new FakeStaleRecoveryStore([
    {
      runId: "lease-lost-not-old-enough",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T11:45:01.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-1",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(2),
      leaseHeartbeatAt: new Date("2026-07-22T11:55:00.000Z"),
      leaseExpiresAt: new Date("2026-07-22T11:29:59.999Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-1",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
    {
      runId: "exact-grace-threshold",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T11:00:00.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-2",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(3),
      leaseHeartbeatAt: new Date("2026-07-22T11:58:00.000Z"),
      leaseExpiresAt: new Date("2026-07-22T11:59:30.000Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-2",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
    {
      runId: "active-minus-1ms",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T11:00:00.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-3",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(4),
      leaseHeartbeatAt: new Date("2026-07-22T11:59:00.000Z"),
      leaseExpiresAt: new Date("2026-07-22T12:00:00.001Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-3",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
  ], new Date("2026-07-22T12:00:00.000Z"));

  const plan = await planStaleHydrationExecutions(store, {
    organizationId: "org-test",
    staleThresholdMs: 30 * 60 * 1000,
  });

  const byRunId = new Map(plan.candidates.map((candidate) => [candidate.runId, candidate]));
  assert.equal(byRunId.get("lease-lost-not-old-enough")?.classification, "LEASE_LOST");
  assert.equal(byRunId.get("lease-lost-not-old-enough")?.recoveryEligibility, "NOT_OLD_ENOUGH");
  assert.equal(byRunId.get("exact-grace-threshold")?.classification, "EXPIRED_LEASE");
  assert.equal(byRunId.get("exact-grace-threshold")?.recoveryEligibility, "RECOVERY_BLOCKED");
  assert.equal(byRunId.get("active-minus-1ms")?.classification, "ACTIVE_LEASE");
  assert.equal(byRunId.get("active-minus-1ms")?.recoveryEligibility, "RECOVERY_BLOCKED");
});