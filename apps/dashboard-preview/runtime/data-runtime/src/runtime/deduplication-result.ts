import type { MappedPayloadRecord, MappedPayloadRecordFields, MappedPayloadValue } from "./mapped-payload.ts";

export type DeduplicationValue = MappedPayloadValue;

export type DeduplicationRecordFields = MappedPayloadRecordFields;

export type DeduplicationDuplicateStatus = "UNIQUE" | "DUPLICATE";

export interface DeduplicationAcceptedRecord extends MappedPayloadRecord {
  duplicateKey: string;
  duplicateStatus: DeduplicationDuplicateStatus;
}

export interface DeduplicationDuplicateRecord extends MappedPayloadRecord {
  duplicateKey: string;
  duplicateStatus: DeduplicationDuplicateStatus;
  duplicateReason: string | null;
}

export interface DeduplicationStatistics {
  sourceRecordCount: number;
  acceptedRecordCount: number;
  duplicateRecordCount: number;
  duplicateKeyCount: number;
  duplicateReasonCount: number;
}

export interface DeduplicationResult {
  acceptedRecords: DeduplicationAcceptedRecord[];
  duplicateRecords: DeduplicationDuplicateRecord[];
  duplicateKeys: string[];
  duplicateReasons: string[];
  statistics: DeduplicationStatistics;
}