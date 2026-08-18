import { throwIfExecutionAborted, type ExecutionContext, type PipelineStageName, type PipelineStageResult } from "../execution-context.ts";
import type { PipelineStage } from "../pipeline-stage.ts";
import type { RuntimeState } from "../runtime-state.ts";
import type { PipelineStageImplementation } from "./stage-component-contracts.ts";

function buildStageResult(context: ExecutionContext, stage: PipelineStageName): PipelineStageResult {
  return {
    stage,
    status: "succeeded",
    message: `Stage \"${stage}\" completed for ${context.pipeline} pipeline execution in ${context.environment.environment}.`,
  };
}

export class ComposedPipelineStage implements PipelineStage {
  constructor(
    readonly name: PipelineStageName,
    private readonly implementation: PipelineStageImplementation,
  ) {}

  async execute(context: ExecutionContext, state: RuntimeState): Promise<void> {
    state.currentStage = this.name;
    throwIfExecutionAborted(context);
    await this.implementation.resolver.resolve(context, state);
    throwIfExecutionAborted(context);
    await this.implementation.engine.run(context, state);
    throwIfExecutionAborted(context);
    await this.implementation.writer.write(context, state);
    throwIfExecutionAborted(context);
    state.stageResults.push(buildStageResult(context, this.name));
  }
}