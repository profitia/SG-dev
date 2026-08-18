import type { DrDashboardIndexRecord, Prisma } from "@prisma/client";

import { createDataRuntimePrismaClient, type DataRuntimePrismaClient } from "./prisma-client.ts";

const DASHBOARD_STORE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 120_000,
} as const;
const DASHBOARD_STORE_BATCH_SIZE = 25;

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export interface DashboardStoreRecordKey {
  organizationId: string;
  pipelineId: string;
  dedupeKey: string;
}

export interface DashboardStoreRecordInput {
  organizationId: string;
  sourceId: string;
  datasetId: string;
  pipelineId: string;
  latestRunId: string;
  dedupeKey: string;
  scenarioType: string;
  componentId: string;
  componentName: string;
  componentCode?: string | null;
  metricValue?: Prisma.Decimal | number | string | null;
  unit?: string | null;
  currency?: string | null;
  sourceDate?: Date | null;
  market?: string | null;
  country?: string | null;
  qualityStatus?: string | null;
  duplicateStatus?: string | null;
  rawRecordCount?: number;
  duplicateCount?: number;
  lineageJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  metadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  lastSyncedAt: Date;
}

export interface DashboardStoreQuery {
  organizationId?: string;
  sourceId?: string;
  datasetId?: string;
  pipelineId?: string;
  latestRunId?: string;
  dedupeKeys?: string[];
}

export interface DashboardStoreUpdateInput extends DashboardStoreRecordKey {
  data: Omit<Partial<DashboardStoreRecordInput>, "organizationId" | "pipelineId" | "dedupeKey">;
}

export class DashboardStoreRepository {
  constructor(private readonly prisma: DataRuntimePrismaClient = createDataRuntimePrismaClient()) {}

  async insertBatch(records: DashboardStoreRecordInput[]): Promise<Prisma.BatchPayload> {
    return this.prisma.drDashboardIndexRecord.createMany({
      data: records.map((record) => ({
        organizationId: record.organizationId,
        sourceId: record.sourceId,
        datasetId: record.datasetId,
        pipelineId: record.pipelineId,
        latestRunId: record.latestRunId,
        dedupeKey: record.dedupeKey,
        scenarioType: record.scenarioType,
        componentId: record.componentId,
        componentName: record.componentName,
        componentCode: record.componentCode,
        metricValue: record.metricValue,
        unit: record.unit,
        currency: record.currency,
        sourceDate: record.sourceDate,
        market: record.market,
        country: record.country,
        qualityStatus: record.qualityStatus,
        duplicateStatus: record.duplicateStatus,
        rawRecordCount: record.rawRecordCount,
        duplicateCount: record.duplicateCount,
        lineageJson: record.lineageJson,
        metadataJson: record.metadataJson,
        lastSyncedAt: record.lastSyncedAt,
      })),
    });
  }

  async updateBatch(updates: DashboardStoreUpdateInput[]): Promise<DrDashboardIndexRecord[]> {
    const records: DrDashboardIndexRecord[] = [];

    for (const batch of splitIntoBatches(updates, DASHBOARD_STORE_BATCH_SIZE)) {
      const batchRecords = await this.prisma.$transaction(
        batch.map((update) =>
          this.prisma.drDashboardIndexRecord.update({
            where: {
              organizationId_pipelineId_dedupeKey: {
                organizationId: update.organizationId,
                pipelineId: update.pipelineId,
                dedupeKey: update.dedupeKey,
              },
            },
            data: update.data,
          }),
        ),
        DASHBOARD_STORE_TRANSACTION_OPTIONS,
      );

      records.push(...batchRecords);
    }

    return records;
  }

  async upsertBatch(records: DashboardStoreRecordInput[]): Promise<DrDashboardIndexRecord[]> {
    const persisted: DrDashboardIndexRecord[] = [];

    for (const batch of splitIntoBatches(records, DASHBOARD_STORE_BATCH_SIZE)) {
      const batchRecords = await this.prisma.$transaction(
        batch.map((record) =>
          this.prisma.drDashboardIndexRecord.upsert({
            where: {
              organizationId_pipelineId_dedupeKey: {
                organizationId: record.organizationId,
                pipelineId: record.pipelineId,
                dedupeKey: record.dedupeKey,
              },
            },
            create: {
              organizationId: record.organizationId,
              sourceId: record.sourceId,
              datasetId: record.datasetId,
              pipelineId: record.pipelineId,
              latestRunId: record.latestRunId,
              dedupeKey: record.dedupeKey,
              scenarioType: record.scenarioType,
              componentId: record.componentId,
              componentName: record.componentName,
              componentCode: record.componentCode,
              metricValue: record.metricValue,
              unit: record.unit,
              currency: record.currency,
              sourceDate: record.sourceDate,
              market: record.market,
              country: record.country,
              qualityStatus: record.qualityStatus,
              duplicateStatus: record.duplicateStatus,
              rawRecordCount: record.rawRecordCount,
              duplicateCount: record.duplicateCount,
              lineageJson: record.lineageJson,
              metadataJson: record.metadataJson,
              lastSyncedAt: record.lastSyncedAt,
            },
            update: {
              sourceId: record.sourceId,
              datasetId: record.datasetId,
              latestRunId: record.latestRunId,
              scenarioType: record.scenarioType,
              componentId: record.componentId,
              componentName: record.componentName,
              componentCode: record.componentCode,
              metricValue: record.metricValue,
              unit: record.unit,
              currency: record.currency,
              sourceDate: record.sourceDate,
              market: record.market,
              country: record.country,
              qualityStatus: record.qualityStatus,
              duplicateStatus: record.duplicateStatus,
              rawRecordCount: record.rawRecordCount,
              duplicateCount: record.duplicateCount,
              lineageJson: record.lineageJson,
              metadataJson: record.metadataJson,
              lastSyncedAt: record.lastSyncedAt,
            },
          }),
        ),
        DASHBOARD_STORE_TRANSACTION_OPTIONS,
      );

      persisted.push(...batchRecords);
    }

    return persisted;
  }

  async getRecords(query: DashboardStoreQuery = {}): Promise<DrDashboardIndexRecord[]> {
    return this.prisma.drDashboardIndexRecord.findMany({
      where: {
        organizationId: query.organizationId,
        sourceId: query.sourceId,
        datasetId: query.datasetId,
        pipelineId: query.pipelineId,
        latestRunId: query.latestRunId,
        dedupeKey: query.dedupeKeys ? { in: query.dedupeKeys } : undefined,
      },
      orderBy: [{ sourceDate: "asc" }, { id: "asc" }],
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}