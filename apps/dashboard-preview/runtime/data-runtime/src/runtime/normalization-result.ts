import type { DeduplicationDuplicateStatus, DeduplicationValue } from "./deduplication-result.ts";

export type NormalizedValue = DeduplicationValue;

export type NormalizedRecordFields = Record<string, NormalizedValue>;

export interface NormalizedRecord {
  position: number;
  duplicateKey: string;
  duplicateStatus: DeduplicationDuplicateStatus;
  fields: NormalizedRecordFields;
}

export interface NormalizationIssue {
  code: string;
  message: string;
  position: number | null;
  field: string | null;
}

export interface NormalizationStatistics {
  acceptedRecordCount: number;
  normalizedRecordCount: number;
  warningCount: number;
  errorCount: number;
}

export interface NormalizationResult {
  normalizedRecords: NormalizedRecord[];
  warnings: NormalizationIssue[];
  errors: NormalizationIssue[];
  statistics: NormalizationStatistics;
}