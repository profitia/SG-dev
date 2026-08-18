import type { ExecutionContext, PipelineStageName } from "../execution-context.ts";
import type { RuntimeState } from "../runtime-state.ts";
import type { PipelineStageEngine, PipelineStageRepository, PipelineStageResolver, PipelineStageWriter } from "./stage-component-contracts.ts";

export class StubPipelineStageRepository implements PipelineStageRepository {
  constructor(readonly stage: PipelineStageName) {}
}

export class StubPipelineStageResolver implements PipelineStageResolver {
  constructor(
    readonly stage: PipelineStageName,
    protected readonly repository: PipelineStageRepository,
  ) {}

  resolve(_context: ExecutionContext, _state: RuntimeState): void {
    void this.repository;
  }
}

export class StubPipelineStageEngine implements PipelineStageEngine {
  constructor(
    readonly stage: PipelineStageName,
    protected readonly repository: PipelineStageRepository,
  ) {}

  run(_context: ExecutionContext, _state: RuntimeState): void {
    void this.repository;
  }
}

export class StubPipelineStageWriter implements PipelineStageWriter {
  constructor(
    readonly stage: PipelineStageName,
    protected readonly repository: PipelineStageRepository,
  ) {}

  write(_context: ExecutionContext, _state: RuntimeState): void {
    void this.repository;
  }
}