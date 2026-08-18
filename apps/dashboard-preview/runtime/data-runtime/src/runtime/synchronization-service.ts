import type { DrRunMode } from "@prisma/client";

import type { DataRuntimePipelineCode } from "../pipelines/pipeline-types.ts";
import { isDataRuntimePipelineCode } from "../pipelines/pipeline-types.ts";
import type { DataRuntimeSourceCode } from "../sources/source-types.ts";
import { isDataRuntimeSourceCode } from "../sources/source-types.ts";
import { createExecutionContext, type ExecutionContext, type PipelineExecutionResult } from "./execution-context.ts";
import { resolveDataRuntimeEnvironment, type DataRuntimeEnvironmentConfig } from "./env.ts";
import { PipelineExecutor } from "./pipeline-runner.ts";

export const SYNCHRONIZATION_SERVICE_MODES = ["full", "incremental"] as const;

export type SynchronizationServiceMode = (typeof SYNCHRONIZATION_SERVICE_MODES)[number];

export interface SourceSyncRequest {
  source: string;
  mode: string;
}

export interface PipelineRunRequest extends SourceSyncRequest {
  pipeline: string;
}

export interface SourceSyncPlan {
  action: "run-source-sync";
  source: DataRuntimeSourceCode;
  pipeline: DataRuntimePipelineCode;
  mode: SynchronizationServiceMode;
  environment: DataRuntimeEnvironmentConfig;
}

export interface PipelineRunPlan {
  action: "run-pipeline";
  source: DataRuntimeSourceCode;
  pipeline: DataRuntimePipelineCode;
  mode: SynchronizationServiceMode;
  environment: DataRuntimeEnvironmentConfig;
}

export const DEFAULT_SOURCE_PIPELINE: Record<DataRuntimeSourceCode, DataRuntimePipelineCode> = {
  "market-indexes": "dashboard",
};

const SUPPORTED_PIPELINE_CODES: readonly DataRuntimePipelineCode[] = ["dashboard", "forecast-accuracy"];

function toRunMode(plan: SourceSyncPlan | PipelineRunPlan): DrRunMode {
  if (plan.mode === "incremental") {
    return "INCREMENTAL";
  }

  return "MANUAL";
}

function assertSynchronizationMode(value: string): SynchronizationServiceMode {
  if (!SYNCHRONIZATION_SERVICE_MODES.includes(value as SynchronizationServiceMode)) {
    throw new Error(
      `Unsupported synchronization mode \"${value}\". Expected one of: ${SYNCHRONIZATION_SERVICE_MODES.join(", ")}.`,
    );
  }

  return value as SynchronizationServiceMode;
}

function assertSourceCode(value: string): DataRuntimeSourceCode {
  if (!isDataRuntimeSourceCode(value)) {
    throw new Error(`Unsupported source \"${value}\". Expected one of: market-indexes.`);
  }

  return value;
}

function assertPipelineCode(value: string): DataRuntimePipelineCode {
  if (!isDataRuntimePipelineCode(value)) {
    throw new Error(
      `Unsupported pipeline \"${value}\". Expected one of: ${SUPPORTED_PIPELINE_CODES.join(", ")}.`,
    );
  }

  return value;
}

export function planSourceSync(request: SourceSyncRequest): SourceSyncPlan {
  const source = assertSourceCode(request.source);

  return {
    action: "run-source-sync",
    source,
    pipeline: DEFAULT_SOURCE_PIPELINE[source],
    mode: assertSynchronizationMode(request.mode),
    environment: resolveDataRuntimeEnvironment(),
  };
}

export function planPipelineRun(request: PipelineRunRequest): PipelineRunPlan {
  return {
    action: "run-pipeline",
    source: assertSourceCode(request.source),
    pipeline: assertPipelineCode(request.pipeline),
    mode: assertSynchronizationMode(request.mode),
    environment: resolveDataRuntimeEnvironment(),
  };
}

export function buildExecutionContext(plan: SourceSyncPlan | PipelineRunPlan): ExecutionContext {
  return createExecutionContext({
    action: plan.action,
    source: plan.source,
    pipeline: plan.pipeline,
    mode: plan.mode,
    environment: plan.environment,
    organizationId: plan.environment.organizationId,
    triggeredBy: `cli:${plan.action}`,
    runMode: toRunMode(plan),
    replayOfRunId: null,
  });
}

export async function executeSourceSync(request: SourceSyncRequest): Promise<PipelineExecutionResult> {
  const plan = planSourceSync(request);
  const context = buildExecutionContext(plan);

  return await new PipelineExecutor().execute(context);
}

export async function executePipelineRun(request: PipelineRunRequest): Promise<PipelineExecutionResult> {
  const plan = planPipelineRun(request);
  const context = buildExecutionContext(plan);

  return await new PipelineExecutor().execute(context);
}

export function formatExecutionPlan(plan: SourceSyncPlan | PipelineRunPlan | PipelineExecutionResult): string {
  return JSON.stringify(plan, null, 2);
}