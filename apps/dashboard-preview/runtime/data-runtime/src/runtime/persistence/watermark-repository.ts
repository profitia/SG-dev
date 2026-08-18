import type { DrWatermark, DrWatermarkType } from "@prisma/client";

import { createDataRuntimePrismaClient, type DataRuntimePrismaClient } from "./prisma-client.ts";
import type { ExpectedExecutionLeaseInput } from "./execution-lifecycle-store.ts";

export interface WatermarkScope {
  organizationId: string;
  sourceId: string;
  datasetId: string;
  pipelineId: string;
}

export interface CreateWatermarkInput extends WatermarkScope {
  watermarkColumn: string;
  watermarkType: DrWatermarkType;
  lastValue?: string | null;
  lastSyncedAt?: Date | null;
  updatedByRunId?: string | null;
}

export interface UpdateWatermarkInput extends WatermarkScope {
  watermarkColumn?: string;
  watermarkType?: DrWatermarkType;
  lastValue?: string | null;
  lastSyncedAt?: Date | null;
  updatedByRunId?: string | null;
}

export interface UpdateWatermarkOptimisticInput extends UpdateWatermarkInput {
  expectedUpdatedAt: Date;
}

export interface UpsertWatermarkWithExecutionLeaseInput extends WatermarkScope {
  watermarkColumn: string;
  watermarkType: DrWatermarkType;
  lastValue?: string | null;
  lastSyncedAt?: Date | null;
  updatedByRunId: string;
  expectedExecutionLease: ExpectedExecutionLeaseInput;
}

export interface OptimisticWatermarkUpdateResult {
  updated: boolean;
  record: DrWatermark | null;
}

export class WatermarkRepository {
  constructor(private readonly prisma: DataRuntimePrismaClient = createDataRuntimePrismaClient()) {}

  async getWatermark(scope: WatermarkScope): Promise<DrWatermark | null> {
    return this.prisma.drWatermark.findUnique({
      where: {
        organizationId_sourceId_datasetId_pipelineId: {
          organizationId: scope.organizationId,
          sourceId: scope.sourceId,
          datasetId: scope.datasetId,
          pipelineId: scope.pipelineId,
        },
      },
    });
  }

  async createWatermark(input: CreateWatermarkInput): Promise<DrWatermark> {
    return this.prisma.drWatermark.create({
      data: {
        organizationId: input.organizationId,
        sourceId: input.sourceId,
        datasetId: input.datasetId,
        pipelineId: input.pipelineId,
        watermarkColumn: input.watermarkColumn,
        watermarkType: input.watermarkType,
        lastValue: input.lastValue,
        lastSyncedAt: input.lastSyncedAt,
        updatedByRunId: input.updatedByRunId,
      },
    });
  }

  async updateWatermark(input: UpdateWatermarkInput): Promise<DrWatermark> {
    return this.prisma.drWatermark.update({
      where: {
        organizationId_sourceId_datasetId_pipelineId: {
          organizationId: input.organizationId,
          sourceId: input.sourceId,
          datasetId: input.datasetId,
          pipelineId: input.pipelineId,
        },
      },
      data: {
        watermarkColumn: input.watermarkColumn,
        watermarkType: input.watermarkType,
        lastValue: input.lastValue,
        lastSyncedAt: input.lastSyncedAt,
        updatedByRunId: input.updatedByRunId,
      },
    });
  }

  async updateWatermarkOptimistic(input: UpdateWatermarkOptimisticInput): Promise<OptimisticWatermarkUpdateResult> {
    const updateResult = await this.prisma.drWatermark.updateMany({
      where: {
        organizationId: input.organizationId,
        sourceId: input.sourceId,
        datasetId: input.datasetId,
        pipelineId: input.pipelineId,
        updatedAt: input.expectedUpdatedAt,
      },
      data: {
        watermarkColumn: input.watermarkColumn,
        watermarkType: input.watermarkType,
        lastValue: input.lastValue,
        lastSyncedAt: input.lastSyncedAt,
        updatedByRunId: input.updatedByRunId,
      },
    });

    const record = await this.getWatermark(input);
    return {
      updated: updateResult.count === 1,
      record,
    };
  }

  async upsertWatermarkWithExecutionLease(input: UpsertWatermarkWithExecutionLeaseInput): Promise<DrWatermark> {
    return await this.prisma.$transaction(async (tx) => {
      const matched = await tx.$queryRaw<Array<{ matched: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM "dr_runs"
          WHERE "id" = ${input.updatedByRunId}
            AND "organization_id" = ${input.organizationId}
            AND "status" = 'RUNNING'
            AND "deleted_at" IS NULL
            AND "lease_owner_id" = ${input.expectedExecutionLease.ownerId}
            AND "lease_token_hash" = ${input.expectedExecutionLease.tokenHash}
            AND "lease_epoch" = ${input.expectedExecutionLease.epoch}
            AND "lease_expires_at" > clock_timestamp()
        ) AS matched
      `;

      if (matched[0]?.matched !== true) {
        throw new Error(`Watermark persistence rejected run "${input.updatedByRunId}" because the execution lease is no longer active.`);
      }

      const existing = await tx.drWatermark.findUnique({
        where: {
          organizationId_sourceId_datasetId_pipelineId: {
            organizationId: input.organizationId,
            sourceId: input.sourceId,
            datasetId: input.datasetId,
            pipelineId: input.pipelineId,
          },
        },
      });

      if (existing) {
        return await tx.drWatermark.update({
          where: {
            organizationId_sourceId_datasetId_pipelineId: {
              organizationId: input.organizationId,
              sourceId: input.sourceId,
              datasetId: input.datasetId,
              pipelineId: input.pipelineId,
            },
          },
          data: {
            watermarkColumn: input.watermarkColumn,
            watermarkType: input.watermarkType,
            lastValue: input.lastValue,
            lastSyncedAt: input.lastSyncedAt,
            updatedByRunId: input.updatedByRunId,
          },
        });
      }

      return await tx.drWatermark.create({
        data: {
          organizationId: input.organizationId,
          sourceId: input.sourceId,
          datasetId: input.datasetId,
          pipelineId: input.pipelineId,
          watermarkColumn: input.watermarkColumn,
          watermarkType: input.watermarkType,
          lastValue: input.lastValue,
          lastSyncedAt: input.lastSyncedAt,
          updatedByRunId: input.updatedByRunId,
        },
      });
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}