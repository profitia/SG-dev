import type { ExecutionContext, PipelineStageName } from "../execution-context.ts";
import type { RuntimeState } from "../runtime-state.ts";

export type StageStepResult = void | Promise<void>;

export interface PipelineStageRepository {
  readonly stage: PipelineStageName;
}

export interface PipelineStageResolver {
  readonly stage: PipelineStageName;
  resolve(context: ExecutionContext, state: RuntimeState): StageStepResult;
}

export interface PipelineStageEngine {
  readonly stage: PipelineStageName;
  run(context: ExecutionContext, state: RuntimeState): StageStepResult;
}

export interface PipelineStageWriter {
  readonly stage: PipelineStageName;
  write(context: ExecutionContext, state: RuntimeState): StageStepResult;
}

export interface PipelineStageImplementation {
  readonly resolver: PipelineStageResolver;
  readonly engine: PipelineStageEngine;
  readonly writer: PipelineStageWriter;
}