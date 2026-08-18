import type { Prisma } from "@prisma/client";

import type { DeduplicationDuplicateStatus } from "./deduplication-result.ts";
import type { NormalizedValue } from "./normalization-result.ts";

export type DashboardStoreValue = NormalizedValue;

export type DashboardStoreRecordFields = Record<string, DashboardStoreValue>;

export interface DashboardStoreRecord {
  position: number;
  dedupeKey: string;
  scenarioType: string;
  componentId: string;
  componentName: string;
  componentCode: string | null;
  metricValue: string | number | null;
  unit: string | null;
  currency: string | null;
  sourceDate: Date | null;
  market: string | null;
  country: string | null;
  qualityStatus: string | null;
  duplicateStatus: DeduplicationDuplicateStatus;
  rawRecordCount: number;
  duplicateCount: number;
  lineageJson: Prisma.JsonValue | null;
  metadataJson: Prisma.JsonValue | null;
  lastSyncedAt: Date;
  fields: DashboardStoreRecordFields;
}

export interface DashboardStoreWarning {
  code: string;
  message: string;
  position: number | null;
}

export interface DashboardStoreError {
  code: string;
  message: string;
  position: number | null;
}

export interface DashboardStoreStatistics {
  normalizedRecordCount: number;
  preparedRecordCount: number;
  dashboardRecordCount: number;
  warningCount: number;
  errorCount: number;
}

export interface DashboardStoreResult {
  preparedRecords: DashboardStoreRecord[];
  preparedRecordCount: number;
  dashboardRecords: DashboardStoreRecord[];
  affectedRows: number;
  statistics: DashboardStoreStatistics;
  warnings: DashboardStoreWarning[];
  errors: DashboardStoreError[];
}