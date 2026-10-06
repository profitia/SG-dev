export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const from = new URL(origin);
    const host = request.headers.get("host") ?? new URL(request.url).host;
    return from.host === host && (from.protocol === "https:" ||
      (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && from.protocol === "http:"));
  } catch { return false; }
}
