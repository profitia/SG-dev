import "../load-local-env.ts";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { DrDatasetType, DrWatermarkType } from "@prisma/client";

import type { DataRuntimePipelineCode } from "../pipelines/pipeline-types.ts";
import type { DataRuntimeSourceCode } from "../sources/source-types.ts";
import type { ExecutionContext } from "./execution-context.ts";

export interface RegistryConnectorRecord {
  code: string;
  name: string;
  kind: string;
  isActive: boolean;
}

export interface RegistrySourceRecord {
  id: string;
  code: string;
  name: string;
  connectorCode: string;
  isActive: boolean;
}

export interface RegistryDatasetRecord {
  id: string;
  code: string;
  name: string;
  sourceCode: string;
  datasetType: DrDatasetType;
  sourceDatabase: string;
  sourceSchema: string;
  sourceObject: string;
  watermarkColumn: string | null;
  watermarkType: DrWatermarkType | null;
  fetchConfigJson: unknown;
  isActive: boolean;
}

export interface RegistryPipelineRecord {
  id: string;
  code: string;
  name: string;
  sourceCode: string;
  datasetCode: string;
  targetStore: string;
  configFingerprint: string | null;
  version: string | null;
  isActive: boolean;
}

export interface RegistryReadResult {
  connector: RegistryConnectorRecord | null;
  source: RegistrySourceRecord | null;
  dataset: RegistryDatasetRecord | null;
  pipeline: RegistryPipelineRecord | null;
  sourceDatasetCodes: string[];
  sourcePipelineCodes: string[];
  datasetPipelineCodes: string[];
  pipelineDatasetCodes: string[];
}

const REGISTRY_FETCH_RESULT_PREFIX = "__DATA_RUNTIME_REGISTRY_FETCH_RESULT__";

function getTsxCliPath(): string {
  return fileURLToPath(import.meta.resolve("tsx/cli"));
}

function getRegistryFetchScriptPath(): string {
  return fileURLToPath(new URL("./registry-repository-fetch.ts", import.meta.url));
}

function readRegistryFromPostgres(source: DataRuntimeSourceCode, pipeline: DataRuntimePipelineCode): RegistryReadResult {
  const output = execFileSync(process.execPath, [getTsxCliPath(), getRegistryFetchScriptPath()], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATA_RUNTIME_REGISTRY_FETCH_INPUT: JSON.stringify({ source, pipeline }),
    },
  });

  const resultLine = output
    .split(/\r?\n/)
    .find((line) => line.startsWith(REGISTRY_FETCH_RESULT_PREFIX));

  if (!resultLine) {
    throw new Error("Registry repository fetch did not produce a readable result payload.");
  }

  return JSON.parse(resultLine.slice(REGISTRY_FETCH_RESULT_PREFIX.length)) as RegistryReadResult;
}

export class RegistryRepository {
  read(context: ExecutionContext): RegistryReadResult {
    return readRegistryFromPostgres(context.source, context.pipeline);
  }
}
