import type { DrRawRecord, Prisma } from "@prisma/client";

import { createDataRuntimePrismaClient, type DataRuntimePrismaClient } from "./prisma-client.ts";

export interface CreateRawRecordInput {
  organizationId: string;
  runId: string;
  runDatasetId: string;
  sourceId: string;
  datasetId: string;
  pipelineId: string;
  connectorKey: string;
  sourceDatabase: string;
  sourceSchema: string;
  sourceObject: string;
  sourceRowId?: string | null;
  sourceUpdatedAt?: Date | null;
  payloadJson: Prisma.InputJsonValue;
  payloadHash: string;
  ingestedAt: Date;
  isReplayed?: boolean;
  replayOfRunId?: string | null;
}

export interface RawRecordReplayFilter {
  organizationId: string;
  replayOfRunId: string;
}

export interface RawRecordRunFilter {
  organizationId: string;
  runId: string;
}

export class RawRepository {
  constructor(private readonly prisma: DataRuntimePrismaClient = createDataRuntimePrismaClient()) {}

  async insertRawRecord(input: CreateRawRecordInput): Promise<DrRawRecord> {
    return this.prisma.drRawRecord.create({
      data: {
        organizationId: input.organizationId,
        runId: input.runId,
        runDatasetId: input.runDatasetId,
        sourceId: input.sourceId,
        datasetId: input.datasetId,
        pipelineId: input.pipelineId,
        connectorKey: input.connectorKey,
        sourceDatabase: input.sourceDatabase,
        sourceSchema: input.sourceSchema,
        sourceObject: input.sourceObject,
        sourceRowId: input.sourceRowId,
        sourceUpdatedAt: input.sourceUpdatedAt,
        payloadJson: input.payloadJson,
        payloadHash: input.payloadHash,
        ingestedAt: input.ingestedAt,
        isReplayed: input.isReplayed,
        replayOfRunId: input.replayOfRunId,
      },
    });
  }

  async insertRawBatch(inputs: CreateRawRecordInput[]): Promise<Prisma.BatchPayload> {
    return this.prisma.drRawRecord.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId,
        runId: input.runId,
        runDatasetId: input.runDatasetId,
        sourceId: input.sourceId,
        datasetId: input.datasetId,
        pipelineId: input.pipelineId,
        connectorKey: input.connectorKey,
        sourceDatabase: input.sourceDatabase,
        sourceSchema: input.sourceSchema,
        sourceObject: input.sourceObject,
        sourceRowId: input.sourceRowId,
        sourceUpdatedAt: input.sourceUpdatedAt,
        payloadJson: input.payloadJson,
        payloadHash: input.payloadHash,
        ingestedAt: input.ingestedAt,
        isReplayed: input.isReplayed,
        replayOfRunId: input.replayOfRunId,
      })),
    });
  }

  async getRawRecordsByReplayRun(filter: RawRecordReplayFilter): Promise<DrRawRecord[]> {
    return this.prisma.drRawRecord.findMany({
      where: {
        organizationId: filter.organizationId,
        replayOfRunId: filter.replayOfRunId,
      },
      orderBy: [{ ingestedAt: "asc" }, { id: "asc" }],
    });
  }

  async getRawRecordsByRun(filter: RawRecordRunFilter): Promise<DrRawRecord[]> {
    return this.prisma.drRawRecord.findMany({
      where: {
        organizationId: filter.organizationId,
        runId: filter.runId,
      },
      orderBy: [{ ingestedAt: "asc" }, { id: "asc" }],
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}