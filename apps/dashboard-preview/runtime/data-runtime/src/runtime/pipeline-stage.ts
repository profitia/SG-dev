import type { ExecutionContext, PipelineStageResult } from "./execution-context.ts";
import type { RuntimeState } from "./runtime-state.ts";

export interface PipelineStage {
  readonly name: PipelineStageResult["stage"];
  execute(context: ExecutionContext, state: RuntimeState): void | Promise<void>;
}