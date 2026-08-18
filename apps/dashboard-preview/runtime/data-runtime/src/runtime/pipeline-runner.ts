import { throwIfExecutionAborted, withExecutionAbortSignal, type ExecutionContext, type PipelineExecutionResult } from "./execution-context.ts";
import { createDefaultHydrationExecutionLifecycle, type HydrationExecutionLifecycle } from "./execution-lifecycle.ts";
import type { PipelineStage } from "./pipeline-stage.ts";
import { createDefaultPipelineStages } from "./pipeline-stages.ts";
import { createRuntimeState } from "./runtime-state.ts";
import { createFailureFinalizationError } from "./hydration-execution-error.ts";

export class PipelineExecutor {
  constructor(
    private readonly stages: readonly PipelineStage[] = createDefaultPipelineStages(),
    private readonly lifecycle: HydrationExecutionLifecycle = createDefaultHydrationExecutionLifecycle(),
  ) {}

  async execute(context: ExecutionContext): Promise<PipelineExecutionResult> {
    const state = createRuntimeState(context);

    try {
      for (const stage of this.stages) {
          const stageContext = withExecutionAbortSignal(context, state.executionLease?.abortController?.signal ?? context.abortSignal);
        state.currentStage = stage.name;

        if (state.resolvedConfiguration && !state.lifecyclePersisted) {
            await this.lifecycle.ensureRunning(stageContext, state);
        }

          throwIfExecutionAborted(stageContext);
          await this.lifecycle.assertCanContinue(stageContext, state);

        try {
            await stage.execute(stageContext, state);
            throwIfExecutionAborted(stageContext);
            await this.lifecycle.assertCanContinue(stageContext, state);
        } catch (error) {
          try {
              await this.lifecycle.finalizeFailure(stageContext, state, error);
          } catch (finalizationError) {
            throw createFailureFinalizationError(error, finalizationError, state.currentStage);
          }

          throw error;
        }
      }

      state.currentStage = "run-finalization";
        const finalizationContext = withExecutionAbortSignal(context, state.executionLease?.abortController?.signal ?? context.abortSignal);
        throwIfExecutionAborted(finalizationContext);
        await this.lifecycle.assertCanContinue(finalizationContext, state);

      try {
          await this.lifecycle.finalizeSuccess(finalizationContext, state);
      } catch (error) {
        try {
            await this.lifecycle.finalizeFailure(finalizationContext, state, error);
        } catch (finalizationError) {
          throw createFailureFinalizationError(error, finalizationError, state.currentStage);
        }

        throw error;
      }

      return {
        context,
        state,
        stages: state.stageResults,
      };
    } finally {
      await this.lifecycle.disconnect();
    }
  }
}