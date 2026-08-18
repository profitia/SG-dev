import type { DrRunMode } from "@prisma/client";

import type { DataRuntimePipelineCode } from "../pipelines/pipeline-types.ts";
import type { DataRuntimeSourceCode } from "../sources/source-types.ts";
import type { DataRuntimeEnvironmentConfig } from "./env.ts";
import { throwIfExecutionLeaseAborted } from "./execution-lease.ts";
import type { SynchronizationServiceMode } from "./synchronization-service.ts";

export const PIPELINE_STAGE_ORDER = [
  "registry",
  "connector",
  "raw",
  "mapping",
  "deduplication",
  "normalization",
  "dashboard-store",
  "forecast-accuracy-store",
] as const;

export const PIPELINE_AUXILIARY_STAGE_NAMES = ["watermark", "run-finalization"] as const;

export type PipelineStageName = (typeof PIPELINE_STAGE_ORDER)[number] | (typeof PIPELINE_AUXILIARY_STAGE_NAMES)[number];

export interface ExecutionContext {
  readonly action: "run-source-sync" | "run-pipeline";
  readonly source: DataRuntimeSourceCode;
  readonly pipeline: DataRuntimePipelineCode;
  readonly mode: SynchronizationServiceMode;
  readonly environment: Readonly<DataRuntimeEnvironmentConfig>;
  readonly organizationId: string | null;
  readonly triggeredBy: string | null;
  readonly runMode: DrRunMode;
  readonly replayOfRunId: string | null;
  readonly abortSignal?: AbortSignal;
}

export interface PipelineStageResult {
  stage: PipelineStageName;
  status: "succeeded";
  message: string;
}

export interface PipelineExecutionResult {
  context: ExecutionContext;
  state: import("./runtime-state.ts").RuntimeState;
  stages: PipelineStageResult[];
}

export function createExecutionContext(input: ExecutionContext): ExecutionContext {
  return Object.freeze({
    ...input,
    environment: Object.freeze({ ...input.environment }),
  });
}

export function withExecutionAbortSignal(
  context: ExecutionContext,
  abortSignal: AbortSignal | null | undefined,
): ExecutionContext {
  if (!abortSignal || context.abortSignal === abortSignal) {
    return context;
  }

  return createExecutionContext({
    ...context,
    abortSignal,
  });
}

export function throwIfExecutionAborted(context: ExecutionContext): void {
  throwIfExecutionLeaseAborted(context.abortSignal);
}