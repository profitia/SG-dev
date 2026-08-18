import { ComposedPipelineStage } from "./composed-stage.ts";
import type { ExecutionContext } from "../execution-context.ts";
import type { MappedPayload, MappedPayloadRecord } from "../mapped-payload.ts";
import type { RawPayloadRecord } from "../raw-payload.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

export class MappingStageRepository extends StubPipelineStageRepository {
  constructor() {
    super("mapping");
  }
}

export class MappingStageResolver extends StubPipelineStageResolver {
  constructor(repository: MappingStageRepository) {
    super("mapping", repository);
  }

  override resolve(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const rawPayload = state.rawPayload;

    if (!rawPayload) {
      throw new Error("Mapping stage requires rawPayload from RawStage.");
    }

    if (rawPayload.recordCount !== rawPayload.records.length) {
      throw new Error("Mapping stage requires rawPayload with a consistent recordCount.");
    }
  }
}

export class MappingStageEngine extends StubPipelineStageEngine {
  constructor(repository: MappingStageRepository) {
    super("mapping", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const rawPayload = state.rawPayload;

    if (!rawPayload) {
      throw new Error("Mapping stage requires rawPayload prepared by RawStage.");
    }

    state.mappedPayload = createMappedPayload(rawPayload.sourceQuery, rawPayload.sourceRecordCount, rawPayload.records);
  }
}

export class MappingStageWriter extends StubPipelineStageWriter {
  constructor(repository: MappingStageRepository) {
    super("mapping", repository);
  }

  override write(_context: ExecutionContext, state: RuntimeState): void {
    if (!state.mappedPayload) {
      throw new Error("Mapping stage writer requires mappedPayload produced by MappingStageEngine.");
    }
  }
}

export class MappingStage extends ComposedPipelineStage {
  constructor() {
    const repository = new MappingStageRepository();

    super("mapping", {
      resolver: new MappingStageResolver(repository),
      engine: new MappingStageEngine(repository),
      writer: new MappingStageWriter(repository),
    });
  }
}

function createMappedPayload(
  sourceQuery: string | null,
  sourceRecordCount: number,
  records: RawPayloadRecord[],
): MappedPayload {
  const mappedRecords: MappedPayloadRecord[] = records.map((record) => ({
    position: record.position,
    fields: { ...record.values },
  }));

  return {
    sourceQuery,
    sourceRecordCount,
    records: mappedRecords,
    recordCount: mappedRecords.length,
  };
}