export function createCanonicalFlightRecordPayload<T>(artifact: T): T {
  return JSON.parse(JSON.stringify(artifact)) as T
}