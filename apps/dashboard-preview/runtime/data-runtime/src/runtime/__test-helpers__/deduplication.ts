import type { DeduplicationAcceptedRecord, DeduplicationDuplicateRecord, DeduplicationResult } from "../deduplication-result.ts";
import type { NormalizedRecord } from "../normalization-result.ts";

export function createDeduplicationResult(records: NormalizedRecord[]): DeduplicationResult {
  const acceptedRecords: DeduplicationAcceptedRecord[] = records.map((record, index) => ({
    position: record.position,
    duplicateKey: record.duplicateKey,
    duplicateStatus: index === 0 && records.length > 1 ? "DUPLICATE" : record.duplicateStatus,
    fields: record.fields,
  }));
  const duplicateRecords: DeduplicationDuplicateRecord[] = records.slice(1).map((record) => ({
    position: record.position,
    duplicateKey: record.duplicateKey,
    duplicateStatus: "DUPLICATE",
    duplicateReason: "duplicate-record-content",
    fields: record.fields,
  }));

  return {
    acceptedRecords,
    duplicateRecords,
    duplicateKeys: Array.from(new Set(duplicateRecords.map((record) => record.duplicateKey))),
    duplicateReasons: duplicateRecords.length > 0 ? ["duplicate-record-content"] : [],
    statistics: {
      sourceRecordCount: records.length,
      acceptedRecordCount: acceptedRecords.length,
      duplicateRecordCount: duplicateRecords.length,
      duplicateKeyCount: duplicateRecords.length > 0 ? 1 : 0,
      duplicateReasonCount: duplicateRecords.length > 0 ? 1 : 0,
    },
  };
}