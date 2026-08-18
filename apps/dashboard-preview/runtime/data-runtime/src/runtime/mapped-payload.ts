export type MappedPayloadValue = string | number | boolean | null;

export type MappedPayloadRecordFields = Record<string, MappedPayloadValue>;

export interface MappedPayloadRecord {
  position: number;
  fields: MappedPayloadRecordFields;
}

export interface MappedPayload {
  sourceQuery: string | null;
  sourceRecordCount: number;
  records: MappedPayloadRecord[];
  recordCount: number;
}