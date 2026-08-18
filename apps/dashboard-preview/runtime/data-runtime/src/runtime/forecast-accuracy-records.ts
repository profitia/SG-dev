import type { Prisma } from "@prisma/client";

import type { DeduplicationResult } from "./deduplication-result.ts";
import type { NormalizedRecord, NormalizedValue } from "./normalization-result.ts";

export const FORECAST_ACCURACY_HORIZONS = [1, 3, 6, 12] as const;

export interface ForecastAccuracyIssue {
  code: string;
  message: string;
  position: number | null;
  field: string | null;
}

export interface ForecastAccuracyStoreRecord {
  position: number;
  dedupeKey: string;
  benchmarkCode: string;
  sourceTableName: string;
  orgTableName: string | null;
  targetDate: Date;
  horizonMonths: (typeof FORECAST_ACCURACY_HORIZONS)[number];
  actualValue: Prisma.Decimal | number | string;
  forecastValue: Prisma.Decimal | number | string;
  differenceValue: Prisma.Decimal | number | string | null;
  errorType: string | null;
  duplicateStatus: string;
  rawRecordCount: number;
  duplicateCount: number;
  lineageJson: Record<string, unknown>;
  metadataJson: Record<string, unknown>;
  lastSyncedAt: Date;
}

export interface ForecastAccuracyStoreStatistics {
  normalizedRecordCount: number;
  expandedRecordCount: number;
  forecastAccuracyRecordCount: number;
  warningCount: number;
  errorCount: number;
}

export interface ForecastAccuracyStoreResult {
  preparedRecords: ForecastAccuracyStoreRecord[];
  preparedRecordCount: number;
  forecastAccuracyRecords: ForecastAccuracyStoreRecord[];
  affectedRows: number;
  statistics: ForecastAccuracyStoreStatistics;
  warnings: ForecastAccuracyIssue[];
  errors: ForecastAccuracyIssue[];
}

const SOURCE_TABLE_PREFIX = "MACROBOND_SERIES_";
const INVALID_DATE_ERROR = "forecast-accuracy-invalid-date";
const INVALID_BENCHMARK_ERROR = "forecast-accuracy-invalid-benchmark";
const MISSING_ACTUAL_ERROR = "forecast-accuracy-missing-actual";

export function createForecastAccuracyStoreResult(
  normalizedRecords: NormalizedRecord[],
  deduplicationResult: DeduplicationResult,
): ForecastAccuracyStoreResult {
  const warnings: ForecastAccuracyIssue[] = [];
  const errors: ForecastAccuracyIssue[] = [];
  const duplicateCounts = countDuplicateRecordsByKey(deduplicationResult);
  const preparedAt = new Date();

  const preparedRecords = normalizedRecords.flatMap((record) =>
    expandForecastAccuracyRecord(record, duplicateCounts, preparedAt, warnings, errors),
  );

  return {
    preparedRecords,
    preparedRecordCount: preparedRecords.length,
    forecastAccuracyRecords: preparedRecords,
    affectedRows: 0,
    statistics: {
      normalizedRecordCount: normalizedRecords.length,
      expandedRecordCount: preparedRecords.length,
      forecastAccuracyRecordCount: preparedRecords.length,
      warningCount: warnings.length,
      errorCount: errors.length,
    },
    warnings,
    errors,
  };
}

export function normalizeForecastAccuracyBenchmarkCode(tableName: string): string | null {
  const trimmed = tableName.trim();

  if (!trimmed) {
    return null;
  }

  const stripped = trimmed.startsWith(SOURCE_TABLE_PREFIX)
    ? trimmed.slice(SOURCE_TABLE_PREFIX.length)
    : trimmed;

  const normalized = stripped
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  return normalized;
}

export function createForecastAccuracyDedupeKey(
  benchmarkCode: string,
  targetDate: Date,
  horizonMonths: (typeof FORECAST_ACCURACY_HORIZONS)[number],
): string {
  return [benchmarkCode, targetDate.toISOString().slice(0, 10), String(horizonMonths)].join("|");
}

function expandForecastAccuracyRecord(
  record: NormalizedRecord,
  duplicateCounts: Map<string, number>,
  preparedAt: Date,
  warnings: ForecastAccuracyIssue[],
  errors: ForecastAccuracyIssue[],
): ForecastAccuracyStoreRecord[] {
  void warnings;

  const sourceTableName = readStringField(record.fields, "tableName");
  const benchmarkCode = sourceTableName ? normalizeForecastAccuracyBenchmarkCode(sourceTableName) : null;

  if (!sourceTableName || !benchmarkCode) {
    errors.push({
      code: INVALID_BENCHMARK_ERROR,
      message: "Forecast Accuracy record is missing a mappable TABLE_NAME benchmark identifier.",
      position: record.position,
      field: "tableName",
    });
    return [];
  }

  const targetDate = readDateField(record.fields, "targetDate");

  if (!targetDate) {
    errors.push({
      code: INVALID_DATE_ERROR,
      message: "Forecast Accuracy record has an invalid or missing TARGET_DATE.",
      position: record.position,
      field: "targetDate",
    });
    return [];
  }

  const actualValue = readNumericLikeField(record.fields, "wartoscRzeczywista");

  if (actualValue === null) {
    errors.push({
      code: MISSING_ACTUAL_ERROR,
      message: "Forecast Accuracy record is missing WARTOSC_RZECZYWISTA.",
      position: record.position,
      field: "wartoscRzeczywista",
    });
    return [];
  }

  const duplicateCount = duplicateCounts.get(record.duplicateKey) ?? 0;
  const orgTableName = readOptionalStringField(record.fields, "orgTableName");

  return FORECAST_ACCURACY_HORIZONS.flatMap((horizonMonths) => {
    const forecastValue = readNumericLikeFieldVariants(record.fields, [
      `prognoza${horizonMonths}m`,
      `prognoza${horizonMonths}M`,
    ]);

    if (forecastValue === null) {
      return [];
    }

    const differenceValue = readNumericLikeFieldVariants(record.fields, [
      `roznica${horizonMonths}m`,
      `roznica${horizonMonths}M`,
    ]);
    const errorType = readOptionalStringFieldVariants(record.fields, [
      `rodzajBledu${horizonMonths}m`,
      `rodzajBledu${horizonMonths}M`,
    ]);
    const dedupeKey = createForecastAccuracyDedupeKey(benchmarkCode, targetDate, horizonMonths);

    return [
      {
        position: record.position,
        dedupeKey,
        benchmarkCode,
        sourceTableName,
        orgTableName,
        targetDate,
        horizonMonths,
        actualValue,
        forecastValue,
        differenceValue,
        errorType,
        duplicateStatus: record.duplicateStatus,
        rawRecordCount: duplicateCount + 1,
        duplicateCount,
        lineageJson: {
          normalizedPosition: record.position,
          duplicateKey: record.duplicateKey,
          duplicateStatus: record.duplicateStatus,
          sourceTableName,
          horizonMonths,
        },
        metadataJson: {
          benchmarkCode,
          orgTableName,
          semanticCarryVersion: 1,
        },
        lastSyncedAt: preparedAt,
      },
    ];
  });
}

function countDuplicateRecordsByKey(deduplicationResult: DeduplicationResult): Map<string, number> {
  const counts = new Map<string, number>();

  for (const duplicateRecord of deduplicationResult.duplicateRecords) {
    counts.set(duplicateRecord.duplicateKey, (counts.get(duplicateRecord.duplicateKey) ?? 0) + 1);
  }

  return counts;
}

function readStringField(fields: Record<string, NormalizedValue>, fieldName: string): string | null {
  const value = fields[fieldName];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readOptionalStringField(fields: Record<string, NormalizedValue>, fieldName: string): string | null {
  return readStringField(fields, fieldName);
}

function readOptionalStringFieldVariants(
  fields: Record<string, NormalizedValue>,
  fieldNames: readonly string[],
): string | null {
  for (const fieldName of fieldNames) {
    const value = readOptionalStringField(fields, fieldName);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readDateField(fields: Record<string, NormalizedValue>, fieldName: string): Date | null {
  const value = fields[fieldName];

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readNumericLikeField(fields: Record<string, NormalizedValue>, fieldName: string): string | number | null {
  const value = fields[fieldName];

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? trimmed : null;
  }

  return null;
}

function readNumericLikeFieldVariants(
  fields: Record<string, NormalizedValue>,
  fieldNames: readonly string[],
): string | number | null {
  for (const fieldName of fieldNames) {
    const value = readNumericLikeField(fields, fieldName);

    if (value !== null) {
      return value;
    }
  }

  return null;
}