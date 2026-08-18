export const KNOWN_SOURCE_CODES = ["market-indexes"] as const;

export type DataRuntimeSourceCode = (typeof KNOWN_SOURCE_CODES)[number];

export function isDataRuntimeSourceCode(value: string): value is DataRuntimeSourceCode {
  return KNOWN_SOURCE_CODES.includes(value as DataRuntimeSourceCode);
}