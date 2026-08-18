import type { DrDatasetType, DrPipelineTargetStore, DrWatermarkType } from "@prisma/client";

import type { DataRuntimePipelineCode } from "../pipelines/pipeline-types.ts";
import type { DataRuntimeSourceCode } from "../sources/source-types.ts";

export const DATA_RUNTIME_DATASET_CODES = ["index-data", "accuracy-data"] as const;

export interface RuntimeDatasetFetchConfig {
  selectColumns?: readonly string[];
  orderBy?: readonly string[];
}

export type DataRuntimeDatasetCode = (typeof DATA_RUNTIME_DATASET_CODES)[number];

export interface ResolvedConnectorConfig {
  code: "snowflake";
  kind: "snowflake";
  name: "Snowflake";
}

export interface ResolvedSourceConfig {
  id: string;
  code: DataRuntimeSourceCode;
  name: string;
  connectorCode: ResolvedConnectorConfig["code"];
  datasetCodes: readonly DataRuntimeDatasetCode[];
  pipelineCodes: readonly DataRuntimePipelineCode[];
}

export interface ResolvedDatasetConfig {
  id: string;
  code: DataRuntimeDatasetCode;
  name: string;
  sourceCode: DataRuntimeSourceCode;
  datasetType: DrDatasetType;
  sourceDatabase: string;
  sourceSchema: string;
  sourceObject: string;
  watermarkColumn: string | null;
  watermarkType: DrWatermarkType | null;
  fetchConfig: RuntimeDatasetFetchConfig | null;
  pipelineCodes: readonly DataRuntimePipelineCode[];
}

export interface ResolvedPipelineConfig {
  id: string;
  code: DataRuntimePipelineCode;
  name: string;
  targetStore: DrPipelineTargetStore;
  configFingerprint: string | null;
  version: string | null;
  datasetCodes: readonly DataRuntimeDatasetCode[];
}

export interface ResolvedRuntimeConfiguration {
  connector: ResolvedConnectorConfig;
  source: ResolvedSourceConfig;
  dataset: ResolvedDatasetConfig;
  pipeline: ResolvedPipelineConfig;
}

export const IN_MEMORY_RUNTIME_REGISTRY = {
  connectors: {
    snowflake: {
      code: "snowflake",
      kind: "snowflake",
      name: "Snowflake",
    },
  },
  sources: {
    "market-indexes": {
      id: "in-memory-market-indexes",
      code: "market-indexes",
      name: "Market Indexes",
      connectorCode: "snowflake",
      datasetCodes: ["index-data", "accuracy-data"],
      pipelineCodes: ["dashboard", "forecast-accuracy"],
    },
  },
  datasets: {
    "index-data": {
      id: "in-memory-index-data",
      code: "index-data",
      name: "Index Data",
      sourceCode: "market-indexes",
      datasetType: "BUSINESS",
      sourceDatabase: "PROFITIA_DWH",
      sourceSchema: "PUBLIC",
      sourceObject: "INDEX_DATA",
      watermarkColumn: null,
      watermarkType: null,
      fetchConfig: null,
      pipelineCodes: ["dashboard"],
    },
    "accuracy-data": {
      id: "in-memory-accuracy-data",
      code: "accuracy-data",
      name: "Accuracy Data",
      sourceCode: "market-indexes",
      datasetType: "BUSINESS",
      sourceDatabase: "TEMPORARY_ENVIR",
      sourceSchema: "ANALYTICS",
      sourceObject: "ACCURACY_DATA",
      watermarkColumn: null,
      watermarkType: null,
      fetchConfig: {
        selectColumns: [
          "TARGET_DATE",
          "WARTOSC_RZECZYWISTA",
          "PROGNOZA_1M",
          "PROGNOZA_3M",
          "PROGNOZA_6M",
          "PROGNOZA_12M",
          "ROZNICA_1M",
          "ROZNICA_3M",
          "ROZNICA_6M",
          "ROZNICA_12M",
          "RODZAJ_BLEDU_1M",
          "RODZAJ_BLEDU_3M",
          "RODZAJ_BLEDU_6M",
          "RODZAJ_BLEDU_12M",
          "ORG_TABLE_NAME",
          "TABLE_NAME",
        ],
        orderBy: ["TABLE_NAME ASC", "TARGET_DATE ASC"],
      },
      pipelineCodes: ["forecast-accuracy"],
    },
  },
  pipelines: {
    dashboard: {
      id: "in-memory-dashboard",
      code: "dashboard",
      name: "Dashboard Pipeline",
      targetStore: "DASHBOARD_INDEX",
      configFingerprint: null,
      version: null,
      datasetCodes: ["index-data"],
    },
    "forecast-accuracy": {
      id: "in-memory-forecast-accuracy",
      code: "forecast-accuracy",
      name: "Forecast Accuracy Pipeline",
      targetStore: "FORECAST_ACCURACY",
      configFingerprint: null,
      version: null,
      datasetCodes: ["accuracy-data"],
    },
  },
} as const satisfies {
  connectors: Record<ResolvedConnectorConfig["code"], ResolvedConnectorConfig>;
  sources: Record<DataRuntimeSourceCode, ResolvedSourceConfig>;
  datasets: Record<DataRuntimeDatasetCode, ResolvedDatasetConfig>;
  pipelines: Record<DataRuntimePipelineCode, ResolvedPipelineConfig>;
};