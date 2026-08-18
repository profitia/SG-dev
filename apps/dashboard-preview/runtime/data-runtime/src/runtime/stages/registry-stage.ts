import { ComposedPipelineStage } from "./composed-stage.ts";
import type { ExecutionContext } from "../execution-context.ts";
import type { ResolvedConnectorConfig, ResolvedDatasetConfig, ResolvedPipelineConfig, ResolvedSourceConfig } from "../runtime-configuration.ts";
import { ensureRuntimeLifecycle, type RuntimeState } from "../runtime-state.ts";
import { RegistryRepository } from "../registry-repository.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

export class RegistryStageRepository extends StubPipelineStageRepository {
  private readonly registryRepository = new RegistryRepository();

  constructor() {
    super("registry");
  }

  read(context: ExecutionContext) {
    return this.registryRepository.read(context);
  }
}

export class RegistryStageResolver extends StubPipelineStageResolver {
  constructor(repository: RegistryStageRepository) {
    super("registry", repository);
  }

  override resolve(context: ExecutionContext, state: RuntimeState): void {
    ensureRuntimeLifecycle(state);

    const registry = (this.repository as RegistryStageRepository).read(context);

    const source = registry.source ? this.toResolvedSourceConfig(registry) : null;

    if (!source) {
      throw new Error(`Registry source "${context.source}" is not configured.`);
    }

    if (!source.pipelineCodes.includes(context.pipeline)) {
      throw new Error(
        `Registry source "${source.code}" is not configured for pipeline "${context.pipeline}".`,
      );
    }

    const pipeline = registry.pipeline ? this.toResolvedPipelineConfig(registry) : null;

    if (!pipeline) {
      throw new Error(`Registry pipeline "${context.pipeline}" is not configured.`);
    }

    const connector = this.resolveConnector(registry, source.connectorCode);
    const dataset = this.resolveDataset(registry, source, pipeline);

    this.assertConfigurationConsistency(source, dataset, pipeline, connector);

    state.resolvedConfiguration = {
      connector,
      source,
      dataset,
      pipeline,
    };

    state.runStatsJson = {
      sourceCode: source.code,
      datasetCode: dataset.code,
      pipelineCode: pipeline.code,
      lifecycleCarrierStage: "registry",
    };
  }

  private resolveConnector(
    registry: ReturnType<RegistryStageRepository["read"]>,
    code: ResolvedSourceConfig["connectorCode"],
  ): ResolvedConnectorConfig {
    const connector = registry.connector ? this.toResolvedConnectorConfig(registry) : null;

    if (!connector || connector.code !== code) {
      throw new Error(`Registry connector "${code}" is not configured.`);
    }

    return connector;
  }

  private resolveDataset(
    registry: ReturnType<RegistryStageRepository["read"]>,
    source: ResolvedSourceConfig,
    pipeline: ResolvedPipelineConfig,
  ): ResolvedDatasetConfig {
    const datasetCode = source.datasetCodes.find((code) => pipeline.datasetCodes.includes(code));

    if (!datasetCode) {
      throw new Error(
        `Registry source "${source.code}" has no dataset configured for pipeline "${pipeline.code}".`,
      );
    }

    const dataset = registry.dataset ? this.toResolvedDatasetConfig(registry) : null;

    if (!dataset || dataset.code !== datasetCode) {
      throw new Error(`Registry dataset "${datasetCode}" is not configured.`);
    }

    return dataset;
  }

  private toResolvedConnectorConfig(registry: ReturnType<RegistryStageRepository["read"]>): ResolvedConnectorConfig {
    const connector = registry.connector;

    if (!connector) {
      throw new Error("Registry connector is not configured.");
    }

    if (connector.code !== "snowflake" || connector.kind !== "SNOWFLAKE") {
      throw new Error(
        `Registry connector must resolve to snowflake/SNOWFLAKE. Received ${connector.code}/${connector.kind}.`,
      );
    }

    return {
      code: "snowflake",
      kind: "snowflake",
      name: connector.name as "Snowflake",
    };
  }

  private toResolvedSourceConfig(registry: ReturnType<RegistryStageRepository["read"]>): ResolvedSourceConfig {
    const source = registry.source;

    if (!source) {
      throw new Error("Registry source is not configured.");
    }

    return {
      id: source.id,
      code: source.code as ResolvedSourceConfig["code"],
      name: source.name,
      connectorCode: source.connectorCode as ResolvedSourceConfig["connectorCode"],
      datasetCodes: registry.sourceDatasetCodes as ResolvedSourceConfig["datasetCodes"],
      pipelineCodes: registry.sourcePipelineCodes as ResolvedSourceConfig["pipelineCodes"],
    };
  }

  private toResolvedDatasetConfig(registry: ReturnType<RegistryStageRepository["read"]>): ResolvedDatasetConfig {
    const dataset = registry.dataset;

    if (!dataset) {
      throw new Error("Registry dataset is not configured.");
    }

    return {
      id: dataset.id,
      code: dataset.code as ResolvedDatasetConfig["code"],
      name: dataset.name,
      sourceCode: dataset.sourceCode as ResolvedDatasetConfig["sourceCode"],
      datasetType: dataset.datasetType,
      sourceDatabase: dataset.sourceDatabase,
      sourceSchema: dataset.sourceSchema,
      sourceObject: dataset.sourceObject,
      watermarkColumn: dataset.watermarkColumn,
      watermarkType: dataset.watermarkType,
      fetchConfig: (dataset.fetchConfigJson ?? null) as ResolvedDatasetConfig["fetchConfig"],
      pipelineCodes: registry.datasetPipelineCodes as ResolvedDatasetConfig["pipelineCodes"],
    };
  }

  private toResolvedPipelineConfig(registry: ReturnType<RegistryStageRepository["read"]>): ResolvedPipelineConfig {
    const pipeline = registry.pipeline;

    if (!pipeline) {
      throw new Error("Registry pipeline is not configured.");
    }

    return {
      id: pipeline.id,
      code: pipeline.code as ResolvedPipelineConfig["code"],
      name: pipeline.name,
      targetStore: pipeline.targetStore as ResolvedPipelineConfig["targetStore"],
      configFingerprint: pipeline.configFingerprint,
      version: pipeline.version,
      datasetCodes: registry.pipelineDatasetCodes as ResolvedPipelineConfig["datasetCodes"],
    };
  }

  private assertConfigurationConsistency(
    source: ResolvedSourceConfig,
    dataset: ResolvedDatasetConfig,
    pipeline: ResolvedPipelineConfig,
    connector: ResolvedConnectorConfig,
  ): void {
    if (dataset.sourceCode !== source.code) {
      throw new Error(
        `Registry dataset "${dataset.code}" is assigned to source "${dataset.sourceCode}" instead of "${source.code}".`,
      );
    }

    if (!dataset.pipelineCodes.includes(pipeline.code)) {
      throw new Error(
        `Registry dataset "${dataset.code}" is not assigned to pipeline "${pipeline.code}".`,
      );
    }

    if (!pipeline.datasetCodes.includes(dataset.code)) {
      throw new Error(
        `Registry pipeline "${pipeline.code}" is not assigned to dataset "${dataset.code}".`,
      );
    }

    if (connector.code !== source.connectorCode) {
      throw new Error(
        `Registry source "${source.code}" points to connector "${source.connectorCode}", but resolved connector is "${connector.code}".`,
      );
    }
  }
}

export class RegistryStageEngine extends StubPipelineStageEngine {
  constructor(repository: RegistryStageRepository) {
    super("registry", repository);
  }
}

export class RegistryStageWriter extends StubPipelineStageWriter {
  constructor(repository: RegistryStageRepository) {
    super("registry", repository);
  }
}

export class RegistryStage extends ComposedPipelineStage {
  constructor() {
    const repository = new RegistryStageRepository();

    super("registry", {
      resolver: new RegistryStageResolver(repository),
      engine: new RegistryStageEngine(repository),
      writer: new RegistryStageWriter(repository),
    });
  }
}