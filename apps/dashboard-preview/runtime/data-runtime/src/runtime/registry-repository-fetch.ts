import "../load-local-env.ts";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { DataRuntimePipelineCode } from "../pipelines/pipeline-types.ts";
import type { DataRuntimeSourceCode } from "../sources/source-types.ts";
import { resolveDataRuntimeEnvironment } from "./env.ts";
import type { RegistryReadResult } from "./registry-repository.ts";

const REGISTRY_FETCH_RESULT_PREFIX = "__DATA_RUNTIME_REGISTRY_FETCH_RESULT__";

interface RegistryFetchInput {
  source: DataRuntimeSourceCode;
  pipeline: DataRuntimePipelineCode;
}

function readPipelineVersion(configJson: unknown): string | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }

  const version = (configJson as { version?: unknown }).version;

  return typeof version === "string" && version.trim() ? version : null;
}

function readInput(): RegistryFetchInput {
  const rawInput = process.env["DATA_RUNTIME_REGISTRY_FETCH_INPUT"];

  if (!rawInput) {
    throw new Error("Registry repository fetch requires DATA_RUNTIME_REGISTRY_FETCH_INPUT.");
  }

  return JSON.parse(rawInput) as RegistryFetchInput;
}

async function main(): Promise<void> {
  const environment = resolveDataRuntimeEnvironment();

  if (!environment.databaseUrl) {
    throw new Error("Registry repository fetch requires DATABASE_URL in apps/data-runtime/.env.local.");
  }

  const input = readInput();
  const adapter = new PrismaPg({ connectionString: environment.databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const source = await prisma.drSource.findUnique({
      where: { code: input.source },
      include: {
        connector: true,
        datasets: {
          where: { isActive: true },
        },
        pipelines: {
          where: { isActive: true },
          include: {
            dataset: true,
          },
        },
      },
    });

    const pipeline = source?.pipelines.find((candidate) => candidate.code === input.pipeline) ?? null;
    const dataset = pipeline?.dataset ?? null;

    const result: RegistryReadResult = {
      connector: source?.connector
        ? {
            code: source.connector.code,
            name: source.connector.name,
            kind: source.connector.kind,
            isActive: source.connector.isActive,
          }
        : null,
      source: source
        ? {
            id: source.id,
            code: source.code,
            name: source.name,
            connectorCode: source.connector.code,
            isActive: source.isActive,
          }
        : null,
      dataset: dataset
        ? {
            id: dataset.id,
            code: dataset.code,
            name: dataset.name,
            sourceCode: source!.code,
            datasetType: dataset.datasetType,
            sourceDatabase: dataset.sourceDatabase,
            sourceSchema: dataset.sourceSchema,
            sourceObject: dataset.sourceObject,
            watermarkColumn: dataset.watermarkColumn,
            watermarkType: dataset.watermarkType,
            fetchConfigJson: dataset.fetchConfigJson,
            isActive: dataset.isActive,
          }
        : null,
      pipeline: pipeline
        ? {
            id: pipeline.id,
            code: pipeline.code,
            name: pipeline.name,
            sourceCode: source!.code,
            datasetCode: pipeline.dataset.code,
            targetStore: pipeline.targetStore,
            configFingerprint: pipeline.configFingerprint,
            version: readPipelineVersion(pipeline.configJson),
            isActive: pipeline.isActive,
          }
        : null,
      sourceDatasetCodes: source?.datasets.map((candidate) => candidate.code) ?? [],
      sourcePipelineCodes: source?.pipelines.map((candidate) => candidate.code) ?? [],
      datasetPipelineCodes: source?.pipelines
        .filter((candidate) => candidate.dataset.code === dataset?.code)
        .map((candidate) => candidate.code) ?? [],
      pipelineDatasetCodes: pipeline ? [pipeline.dataset.code] : [],
    };

    console.log(`${REGISTRY_FETCH_RESULT_PREFIX}${JSON.stringify(result)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
