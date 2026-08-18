import type { DrRunStatus, Prisma } from "@prisma/client";

import type { ExecutionContext, PipelineStageName } from "./execution-context.ts";
import {
  abortExecutionLease,
  createExecutionLeaseIdentity,
  LeaseLostError,
  resolveExecutionLeaseRuntimeConfig,
  throwIfExecutionLeaseAborted,
  type ExecutionLeaseRuntimeConfig,
} from "./execution-lease.ts";
import { ExecutionHeartbeatController } from "./execution-heartbeat-controller.ts";
import {
  formatPersistedHydrationFailureMessage,
  normalizeHydrationExecutionError,
} from "./hydration-execution-error.ts";
import {
  PrismaExecutionLifecycleStore,
  type CreateRunningLifecycleInput,
  type ExecutionLifecycleStore,
} from "./persistence/execution-lifecycle-store.ts";
import { ensureRuntimeLifecycle, markRuntimeLifecycleFailed, markRuntimeLifecycleSucceeded, type RuntimeState } from "./runtime-state.ts";

export interface HydrationExecutionLifecycle {
  ensureRunning(context: ExecutionContext, state: RuntimeState): Promise<void>;
  finalizeSuccess(context: ExecutionContext, state: RuntimeState): Promise<void>;
  finalizeFailure(context: ExecutionContext, state: RuntimeState, error: unknown): Promise<void>;
  assertCanContinue(context: ExecutionContext, state: RuntimeState): Promise<void>;
  disconnect(): Promise<void>;
}

export interface HydrationExecutionLifecycleOptions {
  now?: () => Date;
  leaseConfig?: ExecutionLeaseRuntimeConfig;
}

export class DefaultHydrationExecutionLifecycle implements HydrationExecutionLifecycle {
  private readonly now: () => Date;
  private readonly leaseConfig: ExecutionLeaseRuntimeConfig;
  private readonly heartbeatController: ExecutionHeartbeatController;

  constructor(
    private readonly store: ExecutionLifecycleStore = new PrismaExecutionLifecycleStore(),
    options: HydrationExecutionLifecycleOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.leaseConfig = options.leaseConfig ?? resolveExecutionLeaseRuntimeConfig();
    this.heartbeatController = new ExecutionHeartbeatController(this.store, this.leaseConfig, {
      now: this.now,
      onLeaseLost: (state) => {
        markLeaseLost(state);
      },
    });
  }

  async ensureRunning(_context: ExecutionContext, state: RuntimeState): Promise<void> {
    if (state.lifecyclePersisted || !state.resolvedConfiguration || !state.organizationId || !state.runMode) {
      return;
    }

    ensureRuntimeLifecycle(state, state.runStartedAt ?? this.now());

    if (this.leaseConfig.enabled) {
      const identity = createExecutionLeaseIdentity();
      state.executionLease = {
        config: this.leaseConfig,
        ownerId: identity.ownerId,
        rawToken: identity.rawToken,
        tokenHash: identity.tokenHash,
        epoch: BigInt(1),
        acquiredAt: null,
        heartbeatAt: null,
        expiresAt: null,
        releasedAt: null,
        lost: false,
        abortController: new AbortController(),
      };
    }

    const input = createRunningLifecycleInput(state);
    const persisted = await this.store.createRunningLifecycle(input);

    state.sourceId = input.sourceId;
    state.datasetId = input.datasetId;
    state.pipelineId = input.pipelineId;
    state.pipelineConfigFingerprint = input.pipelineConfigFingerprint;
    state.pipelineVersion = input.pipelineVersion;
    state.runId = persisted.run.id;
    state.runDatasetId = persisted.runDataset.id;
    state.lifecyclePersisted = true;

    if (persisted.executionLease && state.executionLease) {
      state.executionLease.epoch = persisted.executionLease.epoch;
      state.executionLease.acquiredAt = persisted.executionLease.acquiredAt;
      state.executionLease.heartbeatAt = persisted.executionLease.heartbeatAt;
      state.executionLease.expiresAt = persisted.executionLease.expiresAt;
      state.executionLease.releasedAt = persisted.executionLease.releasedAt;
      this.heartbeatController.start(state);
    }
  }

  async finalizeSuccess(_context: ExecutionContext, state: RuntimeState): Promise<void> {
    if (!state.lifecyclePersisted || !state.runId || !state.runDatasetId) {
      return;
    }

    const completedAt = this.now();
    markRuntimeLifecycleSucceeded(state, completedAt);
    state.runStatsJson = withLifecycleMetadata(state, {
      finalStatus: "SUCCEEDED",
      failedStage: null,
      errorCode: null,
      errorClass: null,
      recoverability: null,
      sanitizedMessage: null,
    }, completedAt);

    await this.store.persistTerminalLifecycle({
      runId: state.runId,
      runDatasetId: state.runDatasetId,
      runStatus: "SUCCEEDED",
      runDatasetStatus: "SUCCEEDED",
      expectedRunStatuses: ["RUNNING"],
      expectedRunDatasetStatuses: ["RUNNING"],
      runCompletedAt: state.runCompletedAt,
      runFailedAt: state.runFailedAt,
      runDatasetCompletedAt: state.runDatasetCompletedAt,
      runErrorMessage: state.runErrorMessage,
      runDatasetErrorMessage: state.runDatasetErrorMessage,
      statsJson: state.runStatsJson as Prisma.InputJsonValue,
      rowsRead: state.rowsRead,
      rowsWrittenRaw: state.rowsWrittenRaw,
      rowsWrittenDashboard: state.rowsWrittenDashboard,
      rowsDeduplicated: state.rowsDeduplicated,
      rowsFailed: state.rowsFailed,
      watermarkBefore: state.watermarkBefore,
      watermarkAfter: state.watermarkAfter,
      runDatasetStartedAt: state.runDatasetStartedAt,
      expectedExecutionLease: toExpectedExecutionLease(state),
    });

    this.heartbeatController.stop();
  }

  async finalizeFailure(_context: ExecutionContext, state: RuntimeState, error: unknown): Promise<void> {
    const normalized = normalizeHydrationExecutionError(error, state.currentStage);
    const failedAt = this.now();
    const persistedMessage = formatPersistedHydrationFailureMessage(normalized);

    markRuntimeLifecycleFailed(state, persistedMessage, failedAt);
    state.runStatsJson = withLifecycleMetadata(state, {
      finalStatus: "FAILED",
      failedStage: normalized.failedStage,
      errorCode: normalized.code,
      errorClass: normalized.errorClass,
      recoverability: normalized.recoverability,
      sanitizedMessage: normalized.sanitizedMessage,
    }, failedAt);

    if (!state.lifecyclePersisted || !state.runId || !state.runDatasetId) {
      return;
    }

    if (state.executionLease?.lost) {
      this.heartbeatController.stop();
      return;
    }

    await this.store.persistTerminalLifecycle({
      runId: state.runId,
      runDatasetId: state.runDatasetId,
      runStatus: "FAILED",
      runDatasetStatus: "FAILED",
      expectedRunStatuses: ["RUNNING"],
      expectedRunDatasetStatuses: ["RUNNING"],
      runCompletedAt: state.runCompletedAt,
      runFailedAt: state.runFailedAt,
      runDatasetCompletedAt: state.runDatasetCompletedAt,
      runErrorMessage: state.runErrorMessage,
      runDatasetErrorMessage: state.runDatasetErrorMessage,
      statsJson: state.runStatsJson as Prisma.InputJsonValue,
      rowsRead: state.rowsRead,
      rowsWrittenRaw: state.rowsWrittenRaw,
      rowsWrittenDashboard: state.rowsWrittenDashboard,
      rowsDeduplicated: state.rowsDeduplicated,
      rowsFailed: state.rowsFailed,
      watermarkBefore: state.watermarkBefore,
      watermarkAfter: state.watermarkAfter,
      runDatasetStartedAt: state.runDatasetStartedAt,
      expectedExecutionLease: toExpectedExecutionLease(state),
    });

    this.heartbeatController.stop();
  }

  async assertCanContinue(_context: ExecutionContext, state: RuntimeState): Promise<void> {
    throwIfExecutionLeaseAborted(state.executionLease?.abortController?.signal);

    if (!state.executionLease || !state.runId || !state.organizationId) {
      return;
    }

    if (state.executionLease.lost) {
      throw new LeaseLostError();
    }

    const expectedLease = toExpectedExecutionLease(state);

    if (!expectedLease) {
      throw new LeaseLostError();
    }

    const active = await this.store.assertActiveRunLease(state.runId, state.organizationId, expectedLease);

    if (!active) {
      markLeaseLost(state);
      throw new LeaseLostError();
    }
  }

  async disconnect(): Promise<void> {
    this.heartbeatController.stop();
    await this.store.disconnect();
  }
}

export function createDefaultHydrationExecutionLifecycle(): HydrationExecutionLifecycle {
  return new DefaultHydrationExecutionLifecycle();
}

export function deriveRunTerminalStatus(datasetStatuses: readonly ("SUCCEEDED" | "FAILED")[]): DrRunStatus {
  if (datasetStatuses.length === 0) {
    return "FAILED";
  }

  if (datasetStatuses.every((status) => status === "SUCCEEDED")) {
    return "SUCCEEDED";
  }

  if (datasetStatuses.every((status) => status === "FAILED")) {
    return "FAILED";
  }

  return "PARTIAL";
}

function createRunningLifecycleInput(state: RuntimeState): CreateRunningLifecycleInput {
  const resolvedConfiguration = state.resolvedConfiguration;

  if (
    !resolvedConfiguration ||
    !state.organizationId ||
    !state.runMode ||
    !state.runStartedAt ||
    !state.runDatasetId
  ) {
    throw new Error("Hydration lifecycle requires resolved configuration and seeded lifecycle state before persistence.");
  }

  return {
    organizationId: state.organizationId,
    sourceId: resolvedConfiguration.source.id,
    datasetId: resolvedConfiguration.dataset.id,
    datasetType: resolvedConfiguration.dataset.datasetType,
    pipelineId: resolvedConfiguration.pipeline.id,
    runMode: state.runMode,
    triggeredBy: state.triggeredBy,
    pipelineConfigFingerprint: resolvedConfiguration.pipeline.configFingerprint,
    pipelineVersion: resolvedConfiguration.pipeline.version,
    registrySnapshotJson: state.registrySnapshotJson === null ? undefined : (state.registrySnapshotJson as Prisma.InputJsonValue),
    statsJson: state.runStatsJson === null ? undefined : (state.runStatsJson as Prisma.InputJsonValue),
    startedAt: state.runStartedAt,
    runDatasetId: state.runDatasetId,
    executionLease: state.executionLease?.ownerId && state.executionLease.tokenHash
      ? {
          ownerId: state.executionLease.ownerId,
          tokenHash: state.executionLease.tokenHash,
          leaseDurationMs: state.executionLease.config.leaseDurationMs,
        }
      : undefined,
  };
}

function toExpectedExecutionLease(state: RuntimeState) {
  if (!state.executionLease?.ownerId || !state.executionLease.tokenHash) {
    return undefined;
  }

  return {
    ownerId: state.executionLease.ownerId,
    tokenHash: state.executionLease.tokenHash,
    epoch: state.executionLease.epoch,
  };
}

function markLeaseLost(state: RuntimeState): void {
  if (!state.executionLease || state.executionLease.lost) {
    return;
  }

  state.executionLease.lost = true;
  abortExecutionLease(state.executionLease.abortController);
}

function withLifecycleMetadata(
  state: RuntimeState,
  input: {
    finalStatus: DrRunStatus;
    failedStage: PipelineStageName | "unknown" | null;
    errorCode: string | null;
    errorClass: string | null;
    recoverability: string | null;
    sanitizedMessage: string | null;
  },
  finalizedAt: Date,
): Prisma.JsonValue {
  const base = isJsonObject(state.runStatsJson) ? state.runStatsJson : {};
  const lifecycleValue = base["lifecycle"];
  const existingLifecycle = isJsonObject(lifecycleValue) ? lifecycleValue : {};

  return {
    ...base,
    lifecycle: {
      ...existingLifecycle,
      finalStatus: input.finalStatus,
      failedStage: input.failedStage,
      errorCode: input.errorCode,
      errorClass: input.errorClass,
      recoverability: input.recoverability,
      sanitizedMessage: input.sanitizedMessage,
      watermarkApplicable: Boolean(state.watermarkColumn && state.watermarkType),
      watermarkCommitted: Boolean(state.watermarkAfter || state.watermarkLastSyncedAt),
      rawWriteCommitted: state.rowsWrittenRaw > 0,
      targetWriteCommitted: state.rowsWrittenDashboard > 0,
      finalizedAt: finalizedAt.toISOString(),
      completedStages: state.stageResults.map((result) => result.stage),
    },
  } satisfies Prisma.JsonObject;
}

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}