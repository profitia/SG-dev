type VerclyTechnicalLog = {
  event: string;
  endpoint: string;
  httpStatus?: number | null;
  correlationId?: string | null;
  message?: string | null;
};

function shortenMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  const trimmed = message.replace(/\s+/g, " ").trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

export function logVerclyTechnicalEvent(entry: VerclyTechnicalLog) {
  console.info("[vercly]", {
    event: entry.event,
    endpoint: entry.endpoint,
    httpStatus: entry.httpStatus ?? null,
    correlationId: entry.correlationId ?? null,
    message: shortenMessage(entry.message),
  });
}