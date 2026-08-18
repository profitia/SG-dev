import { randomUUID } from "node:crypto";

import type { DrRunDatasetStatus, DrRunMode, DrRunStatus, DrWatermarkType, Prisma } from "@prisma/client";

import type { ExecutionContext, PipelineStageName, PipelineStageResult } from "./execution-context.ts";
import type { ConnectorMetadata, ConnectorPayload, ConnectorResult, ConnectorStageInput } from "./connectors/connector-contracts.ts";
import type { DashboardStoreResult } from "./dashboard-store-result.ts";
import type { DeduplicationResult } from "./deduplication-result.ts";
import type { ForecastAccuracyStoreResult } from "./forecast-accuracy-records.ts";
import type { MappedPayload } from "./mapped-payload.ts";
import type { NormalizationResult } from "./normalization-result.ts";
import type { RawPayload } from "./raw-payload.ts";
import type { ExecutionLeaseRuntimeConfig } from "./execution-lease.ts";
import type { ResolvedRuntimeConfiguration } from "./runtime-configuration.ts";

export interface RuntimeExecutionLeaseState {
  config: ExecutionLeaseRuntimeConfig;
  ownerId: string | null;
  rawToken: Buffer | null;
  tokenHash: Uint8Array | null;
  epoch: bigint;
  acquiredAt: Date | null;
  heartbeatAt: Date | null;
  expiresAt: Date | null;
  releasedAt: Date | null;
  lost: boolean;
  abortController: AbortController | null;
}

export interface RuntimeState {
  currentStage: PipelineStageName | null;
  stageResults: PipelineStageResult[];
  warnings: string[];
  lifecyclePersisted: boolean;
  organizationId: string | null;
  triggeredBy: string | null;
  runMode: DrRunMode | null;
  replayOfRunId: string | null;
  sourceId: string | null;
  datasetId: string | null;
  pipelineId: string | null;
  pipelineConfigFingerprint: string | null;
  pipelineVersion: string | null;
  registrySnapshotJson: Prisma.JsonValue | null;
  runId: string | null;
  runStatus: DrRunStatus | null;
  runStartedAt: Date | null;
  runCompletedAt: Date | null;
  runFailedAt: Date | null;
  runErrorMessage: string | null;
  runStatsJson: Prisma.JsonValue | null;
  runDatasetId: string | null;
  runDatasetStatus: DrRunDatasetStatus | null;
  runDatasetStartedAt: Date | null;
  runDatasetCompletedAt: Date | null;
  runDatasetErrorMessage: string | null;
  rowsRead: number;
  rowsWrittenRaw: number;
  rowsWrittenDashboard: number;
  rowsDeduplicated: number;
  rowsFailed: number;
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  watermarkColumn: string | null;
  watermarkType: DrWatermarkType | null;
  watermarkValue: string | null;
  watermarkLastSyncedAt: Date | null;
  rawIngestedAt: Date | null;
  resolvedConfiguration: ResolvedRuntimeConfiguration | null;
  connectorInput: ConnectorStageInput | null;
  connectorResult: ConnectorResult | null;
  connectorMetadata: ConnectorMetadata | null;
  connectorPayload: ConnectorPayload | null;
  rawPayload: RawPayload | null;
  mappedPayload: MappedPayload | null;
  deduplicationResult: DeduplicationResult | null;
  normalizationResult: NormalizationResult | null;
  dashboardStoreResult: DashboardStoreResult | null;
  forecastAccuracyStoreResult: ForecastAccuracyStoreResult | null;
  executionLease: RuntimeExecutionLeaseState | null;
}

type RuntimeStateExecutionSeed = Pick<ExecutionContext, "organizationId" | "triggeredBy" | "runMode" | "replayOfRunId">;

export function createRuntimeState(seed?: RuntimeStateExecutionSeed): RuntimeState {
  return {
    currentStage: null,
    stageResults: [],
    warnings: [],
    lifecyclePersisted: false,
    organizationId: seed?.organizationId ?? null,
    triggeredBy: seed?.triggeredBy ?? null,
    runMode: seed?.runMode ?? null,
    replayOfRunId: seed?.replayOfRunId ?? null,
    sourceId: null,
    datasetId: null,
    pipelineId: null,
    pipelineConfigFingerprint: null,
    pipelineVersion: null,
    registrySnapshotJson: null,
    runId: null,
    runStatus: null,
    runStartedAt: null,
    runCompletedAt: null,
    runFailedAt: null,
    runErrorMessage: null,
    runStatsJson: null,
    runDatasetId: null,
    runDatasetStatus: null,
    runDatasetStartedAt: null,
    runDatasetCompletedAt: null,
    runDatasetErrorMessage: null,
    rowsRead: 0,
    rowsWrittenRaw: 0,
    rowsWrittenDashboard: 0,
    rowsDeduplicated: 0,
    rowsFailed: 0,
    watermarkBefore: null,
    watermarkAfter: null,
    watermarkColumn: null,
    watermarkType: null,
    watermarkValue: null,
    watermarkLastSyncedAt: null,
    rawIngestedAt: null,
    resolvedConfiguration: null,
    connectorInput: null,
    connectorResult: null,
    connectorMetadata: null,
    connectorPayload: null,
    rawPayload: null,
    mappedPayload: null,
    deduplicationResult: null,
    normalizationResult: null,
    dashboardStoreResult: null,
    forecastAccuracyStoreResult: null,
    executionLease: null,
  };
}

export function ensureRuntimeLifecycle(state: RuntimeState, startedAt: Date = new Date()): void {
  state.runId ??= randomUUID();
  state.runDatasetId ??= randomUUID();
  state.runStartedAt ??= startedAt;
  state.runDatasetStartedAt ??= startedAt;
  state.runStatus = "RUNNING";
  state.runDatasetStatus = "RUNNING";
  state.runCompletedAt = null;
  state.runFailedAt = null;
  state.runErrorMessage = null;
  state.runDatasetCompletedAt = null;
  state.runDatasetErrorMessage = null;
}

export function markRuntimeLifecycleSucceeded(state: RuntimeState, completedAt: Date = new Date()): void {
  state.runStatus = "SUCCEEDED";
  state.runDatasetStatus = "SUCCEEDED";
  state.runCompletedAt = completedAt;
  state.runDatasetCompletedAt = completedAt;
  state.runFailedAt = null;
  state.runErrorMessage = null;
  state.runDatasetErrorMessage = null;
  state.watermarkAfter = state.watermarkValue;
  state.watermarkLastSyncedAt = completedAt;
}

export function markRuntimeLifecycleFailed(
  state: RuntimeState,
  errorMessage: string,
  completedAt: Date = new Date(),
): void {
  state.runStatus = "FAILED";
  state.runDatasetStatus = "FAILED";
  state.runCompletedAt = completedAt;
  state.runFailedAt = completedAt;
  state.runDatasetCompletedAt = completedAt;
  state.runErrorMessage = errorMessage;
  state.runDatasetErrorMessage = errorMessage;
}