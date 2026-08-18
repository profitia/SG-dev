import { ComposedPipelineStage } from "./composed-stage.ts";
import type { ExecutionContext } from "../execution-context.ts";
import { DefaultConnectorFactory } from "../connectors/connector-factory.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

export class ConnectorStageRepository extends StubPipelineStageRepository {
  constructor() {
    super("connector");
  }
}

export class ConnectorStageResolver extends StubPipelineStageResolver {
  constructor(repository: ConnectorStageRepository) {
    super("connector", repository);
  }

  override resolve(context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    if (!state.resolvedConfiguration) {
      throw new Error("Connector stage requires resolvedConfiguration from RegistryStage.");
    }

    state.connectorInput = {
      connector: state.resolvedConfiguration.connector,
      source: state.resolvedConfiguration.source,
      dataset: state.resolvedConfiguration.dataset,
      pipeline: state.resolvedConfiguration.pipeline,
      environment: context.environment.environment,
    };

    state.sourceId = state.connectorInput.source.id;
    state.datasetId = state.connectorInput.dataset.id;
    state.pipelineId = state.connectorInput.pipeline.id;
    state.pipelineConfigFingerprint = state.connectorInput.pipeline.configFingerprint;
    state.pipelineVersion = state.connectorInput.pipeline.version;
    state.watermarkColumn = state.connectorInput.dataset.watermarkColumn;
    state.watermarkType = state.connectorInput.dataset.watermarkType;
  }
}

export class ConnectorStageEngine extends StubPipelineStageEngine {
  private readonly connectorFactory = new DefaultConnectorFactory();

  constructor(repository: ConnectorStageRepository) {
    super("connector", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const input = state.connectorInput;

    if (!input) {
      throw new Error("Connector stage requires prepared connector input from ConnectorStageResolver.");
    }

    const result = this.connectorFactory.create(input).run();

    state.connectorResult = result;
    state.connectorMetadata = result.metadata;
    state.connectorPayload = result.payload;
    applyWatermarkMetadataFallback(state);

    if (result.status !== "connected") {
      state.warnings.push(result.message);
    }
  }
}

export class ConnectorStageWriter extends StubPipelineStageWriter {
  constructor(repository: ConnectorStageRepository) {
    super("connector", repository);
  }

  override async write(_context: ExecutionContext, state: RuntimeState): Promise<void> {
    if (!state.connectorResult) {
      throw new Error("Connector stage writer requires connectorResult produced by ConnectorStageEngine.");
    }
  }
}

export class ConnectorStage extends ComposedPipelineStage {
  constructor() {
    const repository = new ConnectorStageRepository();

    super("connector", {
      resolver: new ConnectorStageResolver(repository),
      engine: new ConnectorStageEngine(repository),
      writer: new ConnectorStageWriter(repository),
    });
  }
}

const FALLBACK_WATERMARK_COLUMN = "sourceUpdatedAt";

function applyWatermarkMetadataFallback(state: RuntimeState): void {
  if (state.watermarkColumn && state.watermarkType) {
    return;
  }

  const records = state.connectorPayload?.records;
  const hasSourceUpdatedAt = records?.some((record) => typeof record.sourceUpdatedAt === "string" && record.sourceUpdatedAt.length > 0);

  if (!hasSourceUpdatedAt) {
    return;
  }

  state.watermarkColumn ??= FALLBACK_WATERMARK_COLUMN;
  state.watermarkType ??= "TIMESTAMP";
}