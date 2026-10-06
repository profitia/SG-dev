import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "srm_development_session";
const sessionLifetimeSeconds = 12 * 60 * 60;

function secret(): string | null {
  return process.env.TARGET_ENVIRONMENT === "development" ? process.env.SRM_DEVELOPMENT_ACCESS_TOKEN || null : null;
}

function equal(left: string, right: string): boolean {
  const expected = Buffer.from(left);
  const actual = Buffer.from(right);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signature(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function sessionFrom(request: Request): string | null {
  const cookies = request.headers.get("cookie")?.split(";").map((entry) => entry.trim()) ?? [];
  const matches = cookies.filter((entry) => entry.startsWith(`${cookieName}=`));
  return matches.length === 1 ? matches[0].slice(cookieName.length + 1) : null;
}

export function verifyDevelopmentCode(code: unknown): boolean {
  const configured = secret();
  return Boolean(configured && typeof code === "string" && equal(configured, code));
}

export function issueDevelopmentSession(request: Request, now = Date.now()): string {
  const configured = secret();
  if (!configured) throw new Error("Development access is not configured");
  const expires = Math.floor(now / 1000) + sessionLifetimeSeconds;
  const payload = `v1.${expires}`;
  const value = `${payload}.${signature(payload, configured)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`;
}

export function clearDevelopmentSession(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function hasDevelopmentSession(request: Request, now = Date.now()): boolean {
  const configured = secret();
  const value = sessionFrom(request);
  if (!configured || !value) return false;
  const match = /^(v1\.([0-9]{10}))\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return false;
  const expires = Number(match[2]);
  const seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + sessionLifetimeSeconds) return false;
  return equal(signature(match[1], configured), match[3]);
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const from = new URL(origin);
    const host = request.headers.get("host") ?? new URL(request.url).host;
    return from.host === host && (from.protocol === "https:" ||
      (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && from.protocol === "http:"));
  } catch { return false; }
}

export function hasDevelopmentAccess(request: Request, now = Date.now()): boolean {
  const configured = secret();
  if (!configured) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied && equal(configured, supplied)) return true;
  return isSameOriginRequest(request) && hasDevelopmentSession(request, now);
}
