import type {
  DrDatasetType,
  DrRun,
  DrRunDataset,
  DrRunDatasetStatus,
  DrRunMode,
  DrRunStatus,
  Prisma,
} from "@prisma/client";

import { createDataRuntimePrismaClient, type DataRuntimePrismaClient } from "./prisma-client.ts";
import { toPrismaBytes, type PersistedExecutionLease } from "../execution-lease.ts";

interface DatabaseNowRow {
  current_time: Date;
}

export interface ExecutionLeasePersistenceInput {
  ownerId: string;
  tokenHash: Uint8Array;
  leaseDurationMs: number;
}

export interface ExpectedExecutionLeaseInput {
  ownerId: string;
  tokenHash: Uint8Array;
  epoch: bigint;
}

export interface CreateRunningLifecycleInput {
  organizationId: string;
  sourceId: string;
  datasetId: string;
  datasetType: DrDatasetType;
  pipelineId: string;
  runMode: DrRunMode;
  triggeredBy: string | null;
  pipelineConfigFingerprint: string | null;
  pipelineVersion: string | null;
  registrySnapshotJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  statsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  startedAt: Date;
  runDatasetId: string;
  executionLease?: ExecutionLeasePersistenceInput;
}

export interface PersistTerminalLifecycleInput {
  runId: string;
  runDatasetId: string;
  runStatus: DrRunStatus;
  runDatasetStatus: DrRunDatasetStatus;
  expectedRunStatuses: readonly DrRunStatus[];
  expectedRunDatasetStatuses: readonly DrRunDatasetStatus[];
  runCompletedAt: Date | null;
  runFailedAt: Date | null;
  runDatasetCompletedAt: Date | null;
  runErrorMessage: string | null;
  runDatasetErrorMessage: string | null;
  statsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  rowsRead: number;
  rowsWrittenRaw: number;
  rowsWrittenDashboard: number;
  rowsDeduplicated: number;
  rowsFailed: number;
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  runDatasetStartedAt: Date | null;
  expectedExecutionLease?: ExpectedExecutionLeaseInput;
}

export interface PersistedLifecycleTransitionResult {
  run: DrRun;
  runDataset: DrRunDataset;
  executionLease: PersistedExecutionLease | null;
}

export interface StaleExecutionQueryInput {
  organizationId: string;
  pipelineCode?: string;
  limit: number;
}

export interface StaleExecutionRecord {
  runId: string;
  runStatus: DrRunStatus;
  runStartedAt: Date | null;
  runCompletedAt: Date | null;
  runFailedAt: Date | null;
  leaseOwnerId: string | null;
  leaseTokenHashPresent: boolean;
  leaseEpoch: bigint;
  leaseHeartbeatAt: Date | null;
  leaseExpiresAt: Date | null;
  leaseReleasedAt: Date | null;
  recoveredAt: Date | null;
  recoveryReasonCode: string | null;
  sourceCode: string;
  pipelineCode: string;
  runDatasetId: string;
  runDatasetStatus: DrRunDatasetStatus;
  datasetCode: string;
}

export interface RecoverStaleExecutionApplyInput {
  organizationId: string;
  runId: string;
  staleThresholdMs: number;
  recoveryGraceMs: number;
  recoveryReasonCode: string;
}

export interface RecoverStaleExecutionApplyResult {
  run: DrRun;
  runDatasets: DrRunDataset[];
}

export interface ExecutionLifecycleStore {
  getDatabaseNow(): Promise<Date>;
  createRunningLifecycle(input: CreateRunningLifecycleInput): Promise<PersistedLifecycleTransitionResult>;
  persistTerminalLifecycle(input: PersistTerminalLifecycleInput): Promise<PersistedLifecycleTransitionResult>;
  renewRunningLease(runId: string, organizationId: string, expectedLease: ExpectedExecutionLeaseInput, leaseDurationMs: number): Promise<PersistedExecutionLease>;
  assertActiveRunLease(runId: string, organizationId: string, expectedLease: ExpectedExecutionLeaseInput): Promise<boolean>;
  listStaleRunningExecutions(input: StaleExecutionQueryInput): Promise<StaleExecutionRecord[]>;
  recoverStaleExecutionApply(input: RecoverStaleExecutionApplyInput): Promise<RecoverStaleExecutionApplyResult>;
  disconnect(): Promise<void>;
}

export class ExecutionLifecycleStateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionLifecycleStateConflictError";
  }
}

export class PrismaExecutionLifecycleStore implements ExecutionLifecycleStore {
  constructor(private readonly prisma: DataRuntimePrismaClient = createDataRuntimePrismaClient()) {}

  async getDatabaseNow(): Promise<Date> {
    return await selectDatabaseNow(this.prisma);
  }

  async createRunningLifecycle(input: CreateRunningLifecycleInput): Promise<PersistedLifecycleTransitionResult> {
    return await this.prisma.$transaction(async (tx) => {
      const databaseNow = input.executionLease ? await selectDatabaseNow(tx) : null;

      const run = await tx.drRun.create({
        data: {
          organizationId: input.organizationId,
          sourceId: input.sourceId,
          pipelineId: input.pipelineId,
          runMode: input.runMode,
          status: "RUNNING",
          triggeredBy: input.triggeredBy,
          pipelineConfigFingerprint: input.pipelineConfigFingerprint,
          pipelineVersion: input.pipelineVersion,
          registrySnapshotJson: input.registrySnapshotJson,
          statsJson: input.statsJson,
          startedAt: input.startedAt,
          leaseOwnerId: input.executionLease?.ownerId,
          leaseTokenHash: input.executionLease ? toPrismaBytes(input.executionLease.tokenHash) : undefined,
          leaseEpoch: input.executionLease ? BigInt(1) : BigInt(0),
          leaseAcquiredAt: databaseNow,
          leaseHeartbeatAt: databaseNow,
          leaseExpiresAt: databaseNow && input.executionLease
            ? new Date(databaseNow.getTime() + input.executionLease.leaseDurationMs)
            : null,
          leaseReleasedAt: null,
          recoveredAt: null,
          recoveryReasonCode: null,
        },
      });

      const runDataset = await tx.drRunDataset.create({
        data: {
          id: input.runDatasetId,
          organizationId: input.organizationId,
          runId: run.id,
          sourceId: input.sourceId,
          datasetId: input.datasetId,
          datasetType: input.datasetType,
          status: "RUNNING",
          rowsRead: 0,
          rowsWrittenRaw: 0,
          rowsWrittenDashboard: 0,
          rowsDeduplicated: 0,
          rowsFailed: 0,
          watermarkBefore: null,
          watermarkAfter: null,
          errorMessage: null,
          startedAt: input.startedAt,
          completedAt: null,
        },
      });

      return {
        run,
        runDataset,
        executionLease: input.executionLease && databaseNow && run.leaseExpiresAt
          ? {
              ownerId: input.executionLease.ownerId,
              tokenHash: toPrismaBytes(input.executionLease.tokenHash),
              epoch: BigInt(run.leaseEpoch),
              acquiredAt: databaseNow,
              heartbeatAt: databaseNow,
              expiresAt: run.leaseExpiresAt,
              releasedAt: null,
            }
          : null,
      };
    });
  }

  async persistTerminalLifecycle(input: PersistTerminalLifecycleInput): Promise<PersistedLifecycleTransitionResult> {
    return await this.prisma.$transaction(async (tx) => {
      const databaseNow = input.expectedExecutionLease ? await selectDatabaseNow(tx) : null;

      await updateRunDatasetConditionally(tx, input);
      await updateRunConditionally(tx, input, databaseNow);

      const [run, runDataset] = await Promise.all([
        tx.drRun.findUniqueOrThrow({ where: { id: input.runId } }),
        tx.drRunDataset.findUniqueOrThrow({ where: { id: input.runDatasetId } }),
      ]);

      return {
        run,
        runDataset,
        executionLease: run.leaseOwnerId && run.leaseTokenHash && run.leaseAcquiredAt && run.leaseHeartbeatAt && run.leaseExpiresAt
          ? {
              ownerId: run.leaseOwnerId,
              tokenHash: toPrismaBytes(run.leaseTokenHash),
              epoch: BigInt(run.leaseEpoch),
              acquiredAt: run.leaseAcquiredAt,
              heartbeatAt: run.leaseHeartbeatAt,
              expiresAt: run.leaseExpiresAt,
              releasedAt: run.leaseReleasedAt,
            }
          : null,
      };
    });
  }

  async renewRunningLease(
    runId: string,
    organizationId: string,
    expectedLease: ExpectedExecutionLeaseInput,
    leaseDurationMs: number,
  ): Promise<PersistedExecutionLease> {
    return await this.prisma.$transaction(async (tx) => {
      const databaseNow = await selectDatabaseNow(tx);
      const expiresAt = new Date(databaseNow.getTime() + leaseDurationMs);
      const updateResult = await tx.drRun.updateMany({
        where: {
          id: runId,
          organizationId,
          status: "RUNNING",
          deletedAt: null,
          leaseOwnerId: expectedLease.ownerId,
          leaseTokenHash: toPrismaBytes(expectedLease.tokenHash),
          leaseEpoch: expectedLease.epoch,
          leaseExpiresAt: { gt: databaseNow },
        },
        data: {
          leaseHeartbeatAt: databaseNow,
          leaseExpiresAt: expiresAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new ExecutionLifecycleStateConflictError(`Cannot renew execution lease for run "${runId}".`);
      }

      const current = await tx.drRun.findUniqueOrThrow({ where: { id: runId } });

      return {
        ownerId: current.leaseOwnerId ?? expectedLease.ownerId,
        tokenHash: toPrismaBytes(current.leaseTokenHash ?? expectedLease.tokenHash),
        epoch: BigInt(current.leaseEpoch),
        acquiredAt: current.leaseAcquiredAt ?? databaseNow,
        heartbeatAt: current.leaseHeartbeatAt ?? databaseNow,
        expiresAt: current.leaseExpiresAt ?? expiresAt,
        releasedAt: current.leaseReleasedAt,
      };
    });
  }

  async assertActiveRunLease(
    runId: string,
    organizationId: string,
    expectedLease: ExpectedExecutionLeaseInput,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ matched: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "dr_runs"
        WHERE "id" = ${runId}
          AND "organization_id" = ${organizationId}
          AND "status" = 'RUNNING'
          AND "deleted_at" IS NULL
          AND "lease_owner_id" = ${expectedLease.ownerId}
          AND "lease_token_hash" = ${toPrismaBytes(expectedLease.tokenHash)}
          AND "lease_epoch" = ${expectedLease.epoch}
          AND "lease_expires_at" > clock_timestamp()
      ) AS matched
    `;

    return rows[0]?.matched === true;
  }

  async listStaleRunningExecutions(input: StaleExecutionQueryInput): Promise<StaleExecutionRecord[]> {
    const runs = await this.prisma.drRun.findMany({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        ...(input.pipelineCode
          ? {
              pipeline: {
                code: input.pipelineCode,
              },
            }
          : {}),
      },
      include: {
        source: { select: { code: true } },
        pipeline: { select: { code: true } },
        runDatasets: {
          where: {
            status: "RUNNING",
            deletedAt: null,
          },
          include: {
            dataset: { select: { code: true } },
          },
        },
      },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      take: input.limit,
    });

    return runs.flatMap((run) =>
      run.runDatasets.map((runDataset) => ({
        runId: run.id,
        runStatus: run.status,
        runStartedAt: run.startedAt,
        runCompletedAt: run.completedAt,
        runFailedAt: run.failedAt,
        leaseOwnerId: run.leaseOwnerId,
        leaseTokenHashPresent: run.leaseTokenHash !== null,
        leaseEpoch: BigInt(run.leaseEpoch),
        leaseHeartbeatAt: run.leaseHeartbeatAt,
        leaseExpiresAt: run.leaseExpiresAt,
        leaseReleasedAt: run.leaseReleasedAt,
        recoveredAt: run.recoveredAt,
        recoveryReasonCode: run.recoveryReasonCode,
        sourceCode: run.source.code,
        pipelineCode: run.pipeline.code,
        runDatasetId: runDataset.id,
        runDatasetStatus: runDataset.status,
        datasetCode: runDataset.dataset.code,
      })),
    );
  }

  async recoverStaleExecutionApply(input: RecoverStaleExecutionApplyInput): Promise<RecoverStaleExecutionApplyResult> {
    return await this.prisma.$transaction(async (tx) => {
      const databaseNow = await selectDatabaseNow(tx);
      const runRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "dr_runs"
        WHERE "id" = ${input.runId}
          AND "organization_id" = ${input.organizationId}
        FOR UPDATE
      `;

      if (runRows.length !== 1) {
        throw new ExecutionLifecycleStateConflictError(`Recovery apply could not lock run "${input.runId}".`);
      }

      const run = await tx.drRun.findUniqueOrThrow({
        where: { id: input.runId },
        include: {
          runDatasets: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      const isLeaseComplete = Boolean(run.leaseOwnerId && run.leaseTokenHash && run.leaseExpiresAt);
      const staleThresholdCutoff = run.startedAt ? new Date(databaseNow.getTime() - input.staleThresholdMs) : null;

      if (run.organizationId !== input.organizationId || run.status !== "RUNNING") {
        throw new ExecutionLifecycleStateConflictError(`Recovery apply rejected run "${input.runId}" because it is no longer RUNNING in the requested organization.`);
      }

      if (!isLeaseComplete || !run.leaseExpiresAt || !run.startedAt || staleThresholdCutoff === null) {
        throw new ExecutionLifecycleStateConflictError(`Recovery apply rejected run "${input.runId}" because it is missing a complete lease identity.`);
      }

      if (run.leaseExpiresAt.getTime() + input.recoveryGraceMs >= databaseNow.getTime()) {
        throw new ExecutionLifecycleStateConflictError(`Recovery apply rejected run "${input.runId}" because the lease has not expired beyond recovery grace.`);
      }

      if (run.startedAt > staleThresholdCutoff) {
        throw new ExecutionLifecycleStateConflictError(`Recovery apply rejected run "${input.runId}" because the stale threshold has not been reached.`);
      }

      const datasetUpdates = await Promise.all(
        run.runDatasets.map(async (dataset) => {
          if (dataset.status !== "RUNNING") {
            return dataset;
          }

          return await tx.drRunDataset.update({
            where: { id: dataset.id },
            data: {
              status: "FAILED",
              completedAt: databaseNow,
              errorMessage: dataset.errorMessage ?? input.recoveryReasonCode,
            },
          });
        }),
      );

      const terminalStatuses = datasetUpdates.map((dataset) => dataset.status);
      const nextRunStatus = terminalStatuses.every((status) => status === "FAILED")
        ? "FAILED"
        : terminalStatuses.every((status) => status === "SUCCEEDED")
          ? null
          : terminalStatuses.includes("RUNNING")
            ? null
            : "PARTIAL";

      if (!nextRunStatus) {
        throw new ExecutionLifecycleStateConflictError(`Recovery apply rejected run "${input.runId}" because dataset terminal state mix is not recoverable.`);
      }

      const updatedRun = await tx.drRun.update({
        where: { id: input.runId },
        data: {
          status: nextRunStatus,
          completedAt: databaseNow,
          failedAt: nextRunStatus === "FAILED" ? databaseNow : run.failedAt,
          recoveredAt: databaseNow,
          recoveryReasonCode: input.recoveryReasonCode,
          leaseEpoch: BigInt(run.leaseEpoch) + BigInt(1),
          leaseOwnerId: null,
          leaseTokenHash: null,
          leaseHeartbeatAt: null,
          leaseExpiresAt: null,
          leaseReleasedAt: databaseNow,
        },
      });

      const refreshedDatasets = await tx.drRunDataset.findMany({
        where: {
          runId: input.runId,
          deletedAt: null,
        },
        orderBy: { id: "asc" },
      });

      return {
        run: updatedRun,
        runDatasets: refreshedDatasets,
      };
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

async function updateRunDatasetConditionally(
  tx: Omit<DataRuntimePrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  input: PersistTerminalLifecycleInput,
): Promise<void> {
  const updateResult = await tx.drRunDataset.updateMany({
    where: {
      id: input.runDatasetId,
      status: { in: [...input.expectedRunDatasetStatuses] },
      deletedAt: null,
    },
    data: {
      status: input.runDatasetStatus,
      rowsRead: input.rowsRead,
      rowsWrittenRaw: input.rowsWrittenRaw,
      rowsWrittenDashboard: input.rowsWrittenDashboard,
      rowsDeduplicated: input.rowsDeduplicated,
      rowsFailed: input.rowsFailed,
      watermarkBefore: input.watermarkBefore,
      watermarkAfter: input.watermarkAfter,
      errorMessage: input.runDatasetErrorMessage,
      startedAt: input.runDatasetStartedAt,
      completedAt: input.runDatasetCompletedAt,
    },
  });

  if (updateResult.count === 1) {
    return;
  }

  const current = await tx.drRunDataset.findUnique({ where: { id: input.runDatasetId } });

  if (current?.status === input.runDatasetStatus) {
    return;
  }

  throw new ExecutionLifecycleStateConflictError(
    `Cannot transition run dataset "${input.runDatasetId}" to ${input.runDatasetStatus} from ${current?.status ?? "missing"}.`,
  );
}

async function updateRunConditionally(
  tx: Omit<DataRuntimePrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  input: PersistTerminalLifecycleInput,
  databaseNow: Date | null,
): Promise<void> {
  const updateResult = await tx.drRun.updateMany({
    where: {
      id: input.runId,
      status: { in: [...input.expectedRunStatuses] },
      deletedAt: null,
      ...(input.expectedExecutionLease && databaseNow
        ? {
            leaseOwnerId: input.expectedExecutionLease.ownerId,
              leaseTokenHash: toPrismaBytes(input.expectedExecutionLease.tokenHash),
            leaseEpoch: input.expectedExecutionLease.epoch,
            leaseExpiresAt: { gt: databaseNow },
          }
        : {}),
    },
    data: {
      status: input.runStatus,
      completedAt: input.runCompletedAt,
      failedAt: input.runFailedAt,
      errorMessage: input.runErrorMessage,
      statsJson: input.statsJson,
      ...(input.expectedExecutionLease && databaseNow
        ? {
            leaseReleasedAt: databaseNow,
          }
        : {}),
    },
  });

  if (updateResult.count === 1) {
    return;
  }

  const current = await tx.drRun.findUnique({ where: { id: input.runId } });

  if (current?.status === input.runStatus) {
    return;
  }

  throw new ExecutionLifecycleStateConflictError(
    `Cannot transition run "${input.runId}" to ${input.runStatus} from ${current?.status ?? "missing"}.`,
  );
}

async function selectDatabaseNow(
  tx: Omit<DataRuntimePrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
): Promise<Date> {
  const rows = await tx.$queryRaw<DatabaseNowRow[]>`SELECT clock_timestamp() AS current_time`;
  const currentTime = rows[0]?.current_time;

  if (!(currentTime instanceof Date)) {
    throw new Error("Execution lifecycle store could not resolve database time.");
  }

  return currentTime;
}