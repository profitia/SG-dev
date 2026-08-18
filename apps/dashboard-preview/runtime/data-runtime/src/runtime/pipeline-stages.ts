import type { PipelineStage } from "./pipeline-stage.ts";
import {
  ConnectorStage,
  DashboardStoreStage,
  DeduplicationStage,
  ForecastAccuracyStoreStage,
  MappingStage,
  NormalizationStage,
  RawStage,
  RegistryStage,
} from "./stages/index.ts";

export function createDefaultPipelineStages(): readonly PipelineStage[] {
  return [
    new RegistryStage(),
    new ConnectorStage(),
    new RawStage(),
    new MappingStage(),
    new DeduplicationStage(),
    new NormalizationStage(),
    new DashboardStoreStage(),
    new ForecastAccuracyStoreStage(),
  ];
}