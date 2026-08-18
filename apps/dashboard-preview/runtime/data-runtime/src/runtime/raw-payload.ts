export type RawPayloadValue = string | number | boolean | null;

export type RawPayloadRecordValues = Record<string, RawPayloadValue>;

export interface RawPayloadRecord {
  position: number;
  sourceRowId: string | null;
  sourceUpdatedAt: string | null;
  payloadHash: string;
  values: RawPayloadRecordValues;
}

export interface RawPayload {
  sourceQuery: string | null;
  sourceRecordCount: number;
  records: RawPayloadRecord[];
  recordCount: number;
}