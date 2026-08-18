import type { DrForecastAccuracyRecord, Prisma } from "@prisma/client";

import { createDataRuntimePrismaClient, type DataRuntimePrismaClient } from "./prisma-client.ts";

const FORECAST_ACCURACY_STORE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 120_000,
} as const;
const FORECAST_ACCURACY_STORE_BATCH_SIZE = 25;

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export interface ForecastAccuracyStoreRecordInput {
  organizationId: string;
  sourceId: string;
  datasetId: string;
  pipelineId: string;
  latestRunId: string;
  dedupeKey: string;
  benchmarkCode: string;
  sourceTableName: string;
  orgTableName?: string | null;
  targetDate: Date;
  horizonMonths: number;
  actualValue: Prisma.Decimal | number | string;
  forecastValue: Prisma.Decimal | number | string;
  differenceValue?: Prisma.Decimal | number | string | null;
  errorType?: string | null;
  duplicateStatus?: string | null;
  rawRecordCount?: number;
  duplicateCount?: number;
  lineageJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  metadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  lastSyncedAt: Date;
}

export class ForecastAccuracyStoreRepository {
  constructor(private readonly prisma: DataRuntimePrismaClient = createDataRuntimePrismaClient()) {}

  async upsertBatch(records: ForecastAccuracyStoreRecordInput[]): Promise<DrForecastAccuracyRecord[]> {
    const persisted: DrForecastAccuracyRecord[] = [];

    for (const batch of splitIntoBatches(records, FORECAST_ACCURACY_STORE_BATCH_SIZE)) {
      const batchRecords = await this.prisma.$transaction(
        batch.map((record) =>
          this.prisma.drForecastAccuracyRecord.upsert({
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
              benchmarkCode: record.benchmarkCode,
              sourceTableName: record.sourceTableName,
              orgTableName: record.orgTableName,
              targetDate: record.targetDate,
              horizonMonths: record.horizonMonths,
              actualValue: record.actualValue,
              forecastValue: record.forecastValue,
              differenceValue: record.differenceValue,
              errorType: record.errorType,
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
              benchmarkCode: record.benchmarkCode,
              sourceTableName: record.sourceTableName,
              orgTableName: record.orgTableName,
              targetDate: record.targetDate,
              horizonMonths: record.horizonMonths,
              actualValue: record.actualValue,
              forecastValue: record.forecastValue,
              differenceValue: record.differenceValue,
              errorType: record.errorType,
              duplicateStatus: record.duplicateStatus,
              rawRecordCount: record.rawRecordCount,
              duplicateCount: record.duplicateCount,
              lineageJson: record.lineageJson,
              metadataJson: record.metadataJson,
              lastSyncedAt: record.lastSyncedAt,
            },
          }),
        ),
        FORECAST_ACCURACY_STORE_TRANSACTION_OPTIONS,
      );

      persisted.push(...batchRecords);
    }

    return persisted;
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}