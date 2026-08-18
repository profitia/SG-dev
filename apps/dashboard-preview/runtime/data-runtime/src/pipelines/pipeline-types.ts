export const KNOWN_PIPELINE_CODES = ["dashboard", "forecast-accuracy"] as const;

export type DataRuntimePipelineCode = (typeof KNOWN_PIPELINE_CODES)[number];

export function isDataRuntimePipelineCode(value: string): value is DataRuntimePipelineCode {
  return KNOWN_PIPELINE_CODES.includes(value as DataRuntimePipelineCode);
}