import type { DataRuntimeEnvironment } from "../env.ts";
import type { ResolvedConnectorConfig, ResolvedDatasetConfig, ResolvedPipelineConfig, ResolvedSourceConfig } from "../runtime-configuration.ts";

export type ConnectorPayloadValue = string | number | boolean | null;

export interface ConnectorPayloadRecord {
  values: Record<string, ConnectorPayloadValue>;
  sourceRowId: string | null;
  sourceUpdatedAt: string | null;
}

export interface ConnectorPayload {
  query: string | null;
  records: ConnectorPayloadRecord[];
  recordCount: number;
}

export interface ConnectorStageInput {
  connector: ResolvedConnectorConfig;
  source: ResolvedSourceConfig;
  dataset: ResolvedDatasetConfig;
  pipeline: ResolvedPipelineConfig;
  environment: DataRuntimeEnvironment;
}

export type ConnectorResultStatus = "connected" | "unconfigured" | "failed";

export interface ConnectorMetadata {
  connectorCode: ResolvedConnectorConfig["code"];
  connectorKind: ResolvedConnectorConfig["kind"];
  testedAt: string;
  environment: DataRuntimeEnvironment;
  probeQuery: string | null;
  account: string | null;
  warehouse: string | null;
  database: string | null;
  schema: string | null;
  version: string | null;
}

export interface ConnectorResult {
  status: ConnectorResultStatus;
  message: string;
  metadata: ConnectorMetadata;
  payload: ConnectorPayload | null;
}

export interface RuntimeConnector {
  run(): ConnectorResult;
}

export interface ConnectorFactory {
  create(input: ConnectorStageInput): RuntimeConnector;
}