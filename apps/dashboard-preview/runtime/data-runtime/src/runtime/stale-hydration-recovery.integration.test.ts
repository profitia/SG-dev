import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { planStaleHydrationExecutions } from "./stale-hydration-recovery.ts";
import { ExecutionLifecycleStateConflictError } from "./persistence/execution-lifecycle-store.ts";
import {
  cleanupSyntheticRuntimeFixture,
  createBarrier,
  createIntegrationRuntimeHarness,
  createLegacyRunningRun,
  createRunningRunWithLease,
  createSecondaryDataset,
  createSyntheticRuntimeFixture,
  addRunDataset,
  readRun,
  readRunWithDatasets,
  setRunTimingWindowRelativeToNow,
  updateRunStatus,
} from "./test-support/integration-fixtures.ts";
import { resolveLocalIntegrationDatabaseUrl } from "./test-support/local-postgres-test-gate.ts";

const integrationDatabaseUrl = resolveLocalIntegrationDatabaseUrl();
const integrationTest = integrationDatabaseUrl ? test : test.skip;
const STALE_THRESHOLD_MS = 60_000;
const RECOVERY_REASON_CODE = "LEASE_HEARTBEAT_TIMEOUT";

function hashRawToken(rawToken: Uint8Array): Buffer {
  return createHash("sha256").update(rawToken).digest();
}

function assertBufferEqual(actual: Uint8Array | null | undefined, expected: Uint8Array): void {
  assert.ok(actual);
  assert.deepEqual(Buffer.from(actual), Buffer.from(expected));
}

integrationTest("migration compatibility [migration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);

  try {
    const columns = await harness.prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      datetime_precision: number | null;
      is_nullable: "YES" | "NO";
      column_default: string | null;
    }>>`
      SELECT
        column_name,
        data_type,
        datetime_precision,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'dr_runs'
        AND column_name IN (
          'lease_owner_id',
          'lease_token_hash',
          'lease_epoch',
          'lease_acquired_at',
          'lease_heartbeat_at',
          'lease_expires_at',
          'lease_released_at',
          'recovered_at',
          'recovery_reason_code'
        )
      ORDER BY column_name
    `;

    const byName = new Map(columns.map((column) => [column.column_name, column]));
    assert.equal(byName.get("lease_owner_id")?.data_type, "character varying");
    assert.equal(byName.get("lease_owner_id")?.is_nullable, "YES");
    assert.equal(byName.get("lease_token_hash")?.data_type, "bytea");
    assert.equal(byName.get("lease_token_hash")?.is_nullable, "YES");
    assert.equal(byName.get("lease_epoch")?.data_type, "bigint");
    assert.equal(byName.get("lease_epoch")?.is_nullable, "NO");
    assert.match(byName.get("lease_epoch")?.column_default ?? "", /0/);

    for (const columnName of [
      "lease_acquired_at",
      "lease_heartbeat_at",
      "lease_expires_at",
      "lease_released_at",
      "recovered_at",
    ]) {
      assert.equal(byName.get(columnName)?.data_type, "timestamp with time zone");
      assert.equal(byName.get(columnName)?.datetime_precision, 6);
      assert.equal(byName.get(columnName)?.is_nullable, "YES");
    }

    assert.equal(byName.get("recovery_reason_code")?.data_type, "character varying");
    assert.equal(byName.get("recovery_reason_code")?.is_nullable, "YES");

    const indexes = await harness.prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'dr_runs'
      ORDER BY indexname
    `;
    const indexNames = new Set(indexes.map((index) => index.indexname));
    assert.ok(indexNames.has("dr_runs_organization_id_status_lease_expires_at_idx"));
    assert.ok(indexNames.has("dr_runs_organization_id_pipeline_id_status_lease_expires_at_idx"));

    const migrations = await harness.prisma.$queryRaw<Array<{ migration_name: string; completed: boolean }>>`
      SELECT migration_name, finished_at IS NOT NULL AS completed
      FROM _prisma_migrations
      WHERE migration_name = '20260722153000_add_execution_leases_and_recovery_fields'
    `;
    assert.equal(migrations.length, 1);
    assert.equal(migrations[0]?.completed, true);
  } finally {
    await harness.disconnect();
  }
});

integrationTest("lease acquisition [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "lease-acquisition");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    const run = await readRun(harness.prisma, created.run.id);

    assert.equal(run.status, "RUNNING");
    assert.equal(run.leaseOwnerId, created.leaseIdentity.ownerId);
    assertBufferEqual(run.leaseTokenHash, created.leaseIdentity.tokenHash);
    assert.deepEqual(Buffer.from(run.leaseTokenHash ?? []), Buffer.from(hashRawToken(created.leaseIdentity.rawToken)));
    assert.notDeepEqual(Buffer.from(run.leaseTokenHash ?? []), Buffer.from(created.leaseIdentity.rawToken));
    assert.equal("leaseToken" in run, false);
    assert.equal("rawToken" in run, false);
    assert.equal(run.leaseEpoch, BigInt(1));
    assert.ok(run.leaseAcquiredAt instanceof Date);
    assert.ok(run.leaseHeartbeatAt instanceof Date);
    assert.ok(run.leaseExpiresAt instanceof Date);
    assert.equal(run.leaseReleasedAt, null);
    assert.equal(await harness.store.assertActiveRunLease(created.run.id, fixture.organizationId, created.expectedLease), true);
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("duplicate lease acquisition [concurrency]", async () => {
  const harnessA = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const harnessB = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harnessA.prisma, "duplicate-acquisition");
  const runDatasetId = randomUUID();
  const startedAt = new Date("2026-07-22T12:00:00.000Z");
  const barrier = createBarrier(2);

  try {
    const attempt = async (harness: typeof harnessA) => {
      await barrier.wait();
      return await createRunningRunWithLease(harness.store, fixture, { runDatasetId, startedAt });
    };

    const settled = await Promise.allSettled([attempt(harnessA), attempt(harnessB)]);
    const successes = settled.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createRunningRunWithLease>>> => result.status === "fulfilled");
    const failures = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);

    const runs = await harnessA.prisma.drRun.findMany({
      where: {
        organizationId: fixture.organizationId,
        sourceId: fixture.sourceId,
        pipelineId: fixture.pipelineId,
      },
      include: {
        runDatasets: true,
      },
    });

    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.runDatasets.length, 1);
    const persistedRun = runs[0];
    const winningLeaseIdentity = successes[0]?.value.leaseIdentity;

    assert.ok(persistedRun);
    assert.ok(winningLeaseIdentity);
    assert.equal(persistedRun.leaseEpoch, BigInt(1));
    assert.equal(persistedRun.leaseOwnerId, winningLeaseIdentity.ownerId);
    assertBufferEqual(persistedRun.leaseTokenHash, winningLeaseIdentity.tokenHash);
  } finally {
    await cleanupSyntheticRuntimeFixture(harnessA.prisma, fixture);
    await harnessA.disconnect();
    await harnessB.disconnect();
  }
});

integrationTest("heartbeat renewal and lease fencing [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "heartbeat");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 600_000,
      expiresInMs: 15_000,
    });

    const beforeRenewal = await readRun(harness.prisma, created.run.id);
    const renewed = await harness.store.renewRunningLease(created.run.id, fixture.organizationId, created.expectedLease, 120_000);
    const afterRenewal = await readRun(harness.prisma, created.run.id);

    assert.ok((afterRenewal.leaseHeartbeatAt?.getTime() ?? 0) > (beforeRenewal.leaseHeartbeatAt?.getTime() ?? 0));
    assert.ok((afterRenewal.leaseExpiresAt?.getTime() ?? 0) > (beforeRenewal.leaseExpiresAt?.getTime() ?? 0));
    assert.equal(afterRenewal.leaseEpoch, beforeRenewal.leaseEpoch);
    assert.equal(afterRenewal.leaseOwnerId, beforeRenewal.leaseOwnerId);
    assertBufferEqual(afterRenewal.leaseTokenHash, created.leaseIdentity.tokenHash);
    assert.equal(afterRenewal.status, "RUNNING");
    assert.equal(renewed.epoch, created.expectedLease.epoch);

    const guardedSnapshot = await readRun(harness.prisma, created.run.id);

    await assert.rejects(
      () => harness.store.renewRunningLease(created.run.id, fixture.organizationId, {
        ownerId: `${created.expectedLease.ownerId}-other`,
        tokenHash: created.expectedLease.tokenHash,
        epoch: created.expectedLease.epoch,
      }, 120_000),
      ExecutionLifecycleStateConflictError,
    );

    await assert.rejects(
      () => harness.store.renewRunningLease(created.run.id, fixture.organizationId, {
        ownerId: created.expectedLease.ownerId,
        tokenHash: new Uint8Array(created.expectedLease.tokenHash.map((value, index) => index === 0 ? value ^ 0xff : value)),
        epoch: created.expectedLease.epoch,
      }, 120_000),
      ExecutionLifecycleStateConflictError,
    );

    await assert.rejects(
      () => harness.store.renewRunningLease(created.run.id, fixture.organizationId, {
        ownerId: created.expectedLease.ownerId,
        tokenHash: created.expectedLease.tokenHash,
        epoch: created.expectedLease.epoch + BigInt(1),
      }, 120_000),
      ExecutionLifecycleStateConflictError,
    );

    const afterRejectedRenewals = await readRun(harness.prisma, created.run.id);
    assert.equal(afterRejectedRenewals.leaseHeartbeatAt?.toISOString(), guardedSnapshot.leaseHeartbeatAt?.toISOString());
    assert.equal(afterRejectedRenewals.leaseExpiresAt?.toISOString(), guardedSnapshot.leaseExpiresAt?.toISOString());
    assert.equal(afterRejectedRenewals.leaseEpoch, guardedSnapshot.leaseEpoch);

    await updateRunStatus(harness.prisma, created.run.id, "FAILED");
    const terminalBefore = await readRun(harness.prisma, created.run.id);

    await assert.rejects(
      () => harness.store.renewRunningLease(created.run.id, fixture.organizationId, created.expectedLease, 120_000),
      ExecutionLifecycleStateConflictError,
    );

    const terminalAfter = await readRun(harness.prisma, created.run.id);
    assert.equal(terminalAfter.status, "FAILED");
    assert.equal(terminalAfter.leaseHeartbeatAt?.toISOString(), terminalBefore.leaseHeartbeatAt?.toISOString());
    assert.equal(terminalAfter.leaseExpiresAt?.toISOString(), terminalBefore.leaseExpiresAt?.toISOString());
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("recovery planning classifications [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "planning");

  try {
    const active = await createRunningRunWithLease(harness.store, fixture);
    const expiredInGrace = await createRunningRunWithLease(harness.store, fixture);
    const leaseLostNotOldEnough = await createRunningRunWithLease(harness.store, fixture);
    const leaseLostEligible = await createRunningRunWithLease(harness.store, fixture);
    const legacy = await createLegacyRunningRun(harness.prisma, fixture);

    await setRunTimingWindowRelativeToNow(harness.prisma, active.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 5_000,
      expiresInMs: 60_000,
    });
    await setRunTimingWindowRelativeToNow(harness.prisma, expiredInGrace.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 20_000,
      expiresInMs: -5_000,
    });
    await setRunTimingWindowRelativeToNow(harness.prisma, leaseLostNotOldEnough.run.id, {
      startedAgoMs: 10_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });
    await setRunTimingWindowRelativeToNow(harness.prisma, leaseLostEligible.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });
    await harness.prisma.drRun.update({
      where: { id: legacy.run.id },
      data: {
        startedAt: new Date("2026-07-22T10:00:00.000Z"),
      },
    });

    const plan = await planStaleHydrationExecutions(harness.store, {
      organizationId: fixture.organizationId,
      staleThresholdMs: STALE_THRESHOLD_MS,
      limit: 10,
    });

    const byRunId = new Map(plan.candidates.map((candidate) => [candidate.runId, candidate]));
    assert.equal(byRunId.get(active.run.id)?.classification, "ACTIVE_LEASE");
    assert.equal(byRunId.get(active.run.id)?.recoveryEligibility, "RECOVERY_BLOCKED");
    assert.equal(byRunId.get(expiredInGrace.run.id)?.classification, "EXPIRED_LEASE");
    assert.equal(byRunId.get(expiredInGrace.run.id)?.recoveryEligibility, "RECOVERY_BLOCKED");
    assert.equal(byRunId.get(leaseLostNotOldEnough.run.id)?.classification, "LEASE_LOST");
    assert.equal(byRunId.get(leaseLostNotOldEnough.run.id)?.recoveryEligibility, "NOT_OLD_ENOUGH");
    assert.equal(byRunId.get(leaseLostEligible.run.id)?.classification, "LEASE_LOST");
    assert.equal(byRunId.get(leaseLostEligible.run.id)?.recoveryEligibility, "RECOVERY_ELIGIBLE");
    assert.equal(byRunId.get(legacy.run.id)?.classification, "LEGACY_RUNNING_WITHOUT_LEASE");
    assert.equal(byRunId.get(legacy.run.id)?.recoveryEligibility, "RECOVERY_BLOCKED");
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("recovery apply transaction [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "recovery-apply");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });

    const applied = await harness.store.recoverStaleExecutionApply({
      organizationId: fixture.organizationId,
      runId: created.run.id,
      staleThresholdMs: STALE_THRESHOLD_MS,
      recoveryGraceMs: 30_000,
      recoveryReasonCode: RECOVERY_REASON_CODE,
    });

    assert.equal(applied.run.status, "FAILED");
    assert.ok(applied.run.recoveredAt instanceof Date);
    assert.equal(applied.run.recoveryReasonCode, RECOVERY_REASON_CODE);
    assert.equal(applied.run.leaseOwnerId, null);
    assert.equal(applied.run.leaseTokenHash, null);
    assert.equal(applied.run.leaseHeartbeatAt, null);
    assert.equal(applied.run.leaseExpiresAt, null);
    assert.ok(applied.run.leaseReleasedAt instanceof Date);
    assert.equal(applied.run.leaseEpoch, BigInt(2));
    assert.equal(applied.runDatasets.length, 1);
    assert.equal(applied.runDatasets[0]?.status, "FAILED");
    assert.equal(applied.runDatasets[0]?.errorMessage, RECOVERY_REASON_CODE);

    const beforeSecondApply = await readRun(harness.prisma, created.run.id);
    await assert.rejects(
      () => harness.store.recoverStaleExecutionApply({
        organizationId: fixture.organizationId,
        runId: created.run.id,
        staleThresholdMs: STALE_THRESHOLD_MS,
        recoveryGraceMs: 30_000,
        recoveryReasonCode: RECOVERY_REASON_CODE,
      }),
      ExecutionLifecycleStateConflictError,
    );
    const afterSecondApply = await readRun(harness.prisma, created.run.id);
    assert.equal(afterSecondApply.updatedAt.toISOString(), beforeSecondApply.updatedAt.toISOString());
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("wrong organization Recovery Apply [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "wrong-org");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });
    const beforeApply = await readRun(harness.prisma, created.run.id);

    await assert.rejects(
      () => harness.store.recoverStaleExecutionApply({
        organizationId: `${fixture.organizationId}-other`,
        runId: created.run.id,
        staleThresholdMs: STALE_THRESHOLD_MS,
        recoveryGraceMs: 30_000,
        recoveryReasonCode: RECOVERY_REASON_CODE,
      }),
      ExecutionLifecycleStateConflictError,
    );

    const afterApply = await readRun(harness.prisma, created.run.id);
    assert.equal(afterApply.status, beforeApply.status);
    assert.equal(afterApply.leaseEpoch, beforeApply.leaseEpoch);
    assert.equal(afterApply.leaseOwnerId, beforeApply.leaseOwnerId);
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("terminal run Recovery Apply protection [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "terminal-protection");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });
    await updateRunStatus(harness.prisma, created.run.id, "FAILED");
    const beforeApply = await readRunWithDatasets(harness.prisma, created.run.id);

    await assert.rejects(
      () => harness.store.recoverStaleExecutionApply({
        organizationId: fixture.organizationId,
        runId: created.run.id,
        staleThresholdMs: STALE_THRESHOLD_MS,
        recoveryGraceMs: 30_000,
        recoveryReasonCode: RECOVERY_REASON_CODE,
      }),
      ExecutionLifecycleStateConflictError,
    );

    const afterApply = await readRunWithDatasets(harness.prisma, created.run.id);
    assert.equal(afterApply.status, "FAILED");
    assert.equal(afterApply.leaseEpoch, beforeApply.leaseEpoch);
    assert.equal(afterApply.recoveryReasonCode, beforeApply.recoveryReasonCode);
    assert.equal(afterApply.runDatasets[0]?.status, beforeApply.runDatasets[0]?.status);
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("two recovery operators [concurrency]", async () => {
  const harnessA = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const harnessB = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harnessA.prisma, "two-operators");
  const barrier = createBarrier(2);

  try {
    const created = await createRunningRunWithLease(harnessA.store, fixture);
    await setRunTimingWindowRelativeToNow(harnessA.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });

    const apply = async (store: typeof harnessA.store) => {
      await barrier.wait();
      return await store.recoverStaleExecutionApply({
        organizationId: fixture.organizationId,
        runId: created.run.id,
        staleThresholdMs: STALE_THRESHOLD_MS,
        recoveryGraceMs: 30_000,
        recoveryReasonCode: RECOVERY_REASON_CODE,
      });
    };

    const settled = await Promise.allSettled([apply(harnessA.store), apply(harnessB.store)]);
    const successes = settled.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof apply>>> => result.status === "fulfilled");
    const failures = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.ok(failures[0]?.reason instanceof ExecutionLifecycleStateConflictError);

    const finalRun = await readRunWithDatasets(harnessA.prisma, created.run.id);
    assert.equal(finalRun.leaseEpoch, BigInt(2));
    assert.ok(finalRun.recoveredAt instanceof Date);
    assert.equal(finalRun.runDatasets.filter((dataset) => dataset.status === "FAILED").length, 1);
    assert.equal(finalRun.runDatasets.filter((dataset) => dataset.status === "RUNNING").length, 0);
  } finally {
    await cleanupSyntheticRuntimeFixture(harnessA.prisma, fixture);
    await harnessA.disconnect();
    await harnessB.disconnect();
  }
});

integrationTest("plan-to-apply race [concurrency]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "plan-apply-race");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });

    const plan = await planStaleHydrationExecutions(harness.store, {
      organizationId: fixture.organizationId,
      staleThresholdMs: STALE_THRESHOLD_MS,
      limit: 10,
    });
    const plannedCandidate = plan.candidates.find((candidate) => candidate.runId === created.run.id);
    assert.equal(plannedCandidate?.recoveryEligibility, "RECOVERY_ELIGIBLE");

    await harness.prisma.drRun.update({
      where: { id: created.run.id },
      data: {
        status: "FAILED",
        completedAt: new Date("2026-07-22T12:20:00.000Z"),
        failedAt: new Date("2026-07-22T12:20:00.000Z"),
      },
    });

    const beforeApply = await readRunWithDatasets(harness.prisma, created.run.id);

    await assert.rejects(
      () => harness.store.recoverStaleExecutionApply({
        organizationId: fixture.organizationId,
        runId: created.run.id,
        staleThresholdMs: STALE_THRESHOLD_MS,
        recoveryGraceMs: 30_000,
        recoveryReasonCode: RECOVERY_REASON_CODE,
      }),
      ExecutionLifecycleStateConflictError,
    );

    const afterApply = await readRunWithDatasets(harness.prisma, created.run.id);
    assert.equal(afterApply.status, "FAILED");
    assert.equal(afterApply.leaseOwnerId, beforeApply.leaseOwnerId);
    assertBufferEqual(afterApply.leaseTokenHash, created.leaseIdentity.tokenHash);
    assert.equal(afterApply.leaseEpoch, beforeApply.leaseEpoch);
    assert.equal(afterApply.runDatasets[0]?.status, "RUNNING");
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("zombie worker after recovery [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "zombie-worker");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    const secondaryDataset = await createSecondaryDataset(harness.prisma, fixture, "zombie-secondary");
    await addRunDataset(harness.prisma, fixture, {
      runId: created.run.id,
      dataset: secondaryDataset,
      status: "SUCCEEDED",
    });
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });

    const beforeApply = await readRun(harness.prisma, created.run.id);
    assert.equal(beforeApply.leaseEpoch, BigInt(1));

    const applied = await harness.store.recoverStaleExecutionApply({
      organizationId: fixture.organizationId,
      runId: created.run.id,
      staleThresholdMs: STALE_THRESHOLD_MS,
      recoveryGraceMs: 30_000,
      recoveryReasonCode: RECOVERY_REASON_CODE,
    });

    assert.equal(applied.run.status, "PARTIAL");
    assert.equal(applied.run.leaseEpoch, BigInt(2));
    assert.equal(applied.run.leaseOwnerId, null);
    assert.equal(applied.run.leaseTokenHash, null);

    await assert.rejects(
      () => harness.store.renewRunningLease(created.run.id, fixture.organizationId, created.expectedLease, 120_000),
      ExecutionLifecycleStateConflictError,
    );

    await assert.rejects(
      () => harness.watermarkRepository.upsertWatermarkWithExecutionLease({
        organizationId: fixture.organizationId,
        sourceId: fixture.sourceId,
        datasetId: fixture.primaryDataset.id,
        pipelineId: fixture.pipelineId,
        watermarkColumn: "source_updated_at",
        watermarkType: "TIMESTAMP",
        lastValue: "2026-07-22T12:00:00.000Z",
        updatedByRunId: created.run.id,
        expectedExecutionLease: created.expectedLease,
      }),
      /execution lease is no longer active/i,
    );
    const watermark = await harness.watermarkRepository.getWatermark({
      organizationId: fixture.organizationId,
      sourceId: fixture.sourceId,
      datasetId: fixture.primaryDataset.id,
      pipelineId: fixture.pipelineId,
    });
    assert.equal(watermark, null);

    await assert.rejects(
      () => harness.store.persistTerminalLifecycle({
        runId: created.run.id,
        runDatasetId: created.runDataset.id,
        runStatus: "SUCCEEDED",
        runDatasetStatus: "SUCCEEDED",
        expectedRunStatuses: ["RUNNING"],
        expectedRunDatasetStatuses: ["RUNNING"],
        runCompletedAt: new Date("2026-07-22T12:30:00.000Z"),
        runFailedAt: null,
        runDatasetCompletedAt: new Date("2026-07-22T12:30:00.000Z"),
        runErrorMessage: null,
        runDatasetErrorMessage: null,
        rowsRead: 0,
        rowsWrittenRaw: 0,
        rowsWrittenDashboard: 0,
        rowsDeduplicated: 0,
        rowsFailed: 0,
        watermarkBefore: null,
        watermarkAfter: null,
        runDatasetStartedAt: new Date("2026-07-22T12:00:00.000Z"),
        expectedExecutionLease: created.expectedLease,
      }),
      ExecutionLifecycleStateConflictError,
    );

    await assert.rejects(
      () => harness.store.persistTerminalLifecycle({
        runId: created.run.id,
        runDatasetId: created.runDataset.id,
        runStatus: "FAILED",
        runDatasetStatus: "FAILED",
        expectedRunStatuses: ["RUNNING"],
        expectedRunDatasetStatuses: ["RUNNING"],
        runCompletedAt: new Date("2026-07-22T12:30:00.000Z"),
        runFailedAt: new Date("2026-07-22T12:30:00.000Z"),
        runDatasetCompletedAt: new Date("2026-07-22T12:30:00.000Z"),
        runErrorMessage: "zombie failure",
        runDatasetErrorMessage: "zombie failure",
        rowsRead: 0,
        rowsWrittenRaw: 0,
        rowsWrittenDashboard: 0,
        rowsDeduplicated: 0,
        rowsFailed: 0,
        watermarkBefore: null,
        watermarkAfter: null,
        runDatasetStartedAt: new Date("2026-07-22T12:00:00.000Z"),
        expectedExecutionLease: created.expectedLease,
      }),
      ExecutionLifecycleStateConflictError,
    );

    const finalRun = await readRunWithDatasets(harness.prisma, created.run.id);
    assert.equal(finalRun.status, "PARTIAL");
    assert.equal(finalRun.leaseOwnerId, null);
    assert.equal(finalRun.leaseTokenHash, null);
    assert.equal(finalRun.runDatasets.some((dataset) => dataset.status === "RUNNING"), false);
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});

integrationTest("PARTIAL derivation [integration]", async () => {
  const harness = createIntegrationRuntimeHarness(integrationDatabaseUrl as string);
  const fixture = await createSyntheticRuntimeFixture(harness.prisma, "partial-derivation");

  try {
    const created = await createRunningRunWithLease(harness.store, fixture);
    const secondaryDataset = await createSecondaryDataset(harness.prisma, fixture, "partial-secondary");
    await addRunDataset(harness.prisma, fixture, {
      runId: created.run.id,
      dataset: secondaryDataset,
      status: "SUCCEEDED",
    });
    await setRunTimingWindowRelativeToNow(harness.prisma, created.run.id, {
      startedAgoMs: 3_600_000,
      heartbeatAgoMs: 70_000,
      expiresInMs: -60_000,
    });

    const applied = await harness.store.recoverStaleExecutionApply({
      organizationId: fixture.organizationId,
      runId: created.run.id,
      staleThresholdMs: STALE_THRESHOLD_MS,
      recoveryGraceMs: 30_000,
      recoveryReasonCode: RECOVERY_REASON_CODE,
    });

    assert.equal(applied.run.status, "PARTIAL");
    assert.equal(applied.run.leaseEpoch, BigInt(2));
    assert.equal(applied.run.leaseOwnerId, null);
    assert.equal(applied.run.leaseTokenHash, null);
    assert.ok(applied.run.recoveredAt instanceof Date);
    assert.equal(applied.run.recoveryReasonCode, RECOVERY_REASON_CODE);
    assert.equal(applied.runDatasets.some((dataset) => dataset.status === "RUNNING"), false);
    assert.equal(applied.runDatasets.some((dataset) => dataset.status === "SUCCEEDED"), true);
    assert.equal(applied.runDatasets.some((dataset) => dataset.status === "FAILED"), true);
  } finally {
    await cleanupSyntheticRuntimeFixture(harness.prisma, fixture);
    await harness.disconnect();
  }
});