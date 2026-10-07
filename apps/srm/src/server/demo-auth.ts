export const SRM_SESSION_COOKIE = "srm_demo_session";
export const SRM_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type Session = { aud: "srm-demo"; iat: number; exp: number; nonce: string };
type AuthEnvironment = { SRM_DEMO_PASSWORD?: string; SRM_DEMO_SESSION_SECRET?: string };
const runtimeEnvironment = (): AuthEnvironment => ({
  SRM_DEMO_PASSWORD: process.env.SRM_DEMO_PASSWORD,
  SRM_DEMO_SESSION_SECRET: process.env.SRM_DEMO_SESSION_SECRET,
});

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const decoded = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return base64url(decoded) === value ? decoded : null;
  } catch { return null; }
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

export function demoAuthReady(env: AuthEnvironment = runtimeEnvironment()): boolean {
  return Boolean(env.SRM_DEMO_PASSWORD && env.SRM_DEMO_PASSWORD.length >= 16 &&
    env.SRM_DEMO_SESSION_SECRET && env.SRM_DEMO_SESSION_SECRET.length >= 32);
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!input || input.length > 512 || !expected) return false;
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return constantTimeEqual(new Uint8Array(left), new Uint8Array(right));
}

export async function createDemoSession(secret: string, now = Date.now()): Promise<string> {
  if (secret.length < 32) throw new Error("Session secret is not configured");
  const issuedAt = Math.floor(now / 1000);
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload: Session = { aud: "srm-demo", iat: issuedAt, exp: issuedAt + SRM_SESSION_MAX_AGE_SECONDS, nonce };
  const encoded = base64url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${base64url(await hmac(secret, encoded))}`;
}

export async function verifyDemoSession(secret: string, token: string | null, now = Date.now()): Promise<boolean> {
  if (secret.length < 32 || !token || token.length > 2000) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const decoded = decodeBase64url(payload);
  const providedSignature = decodeBase64url(signature);
  if (!decoded || !providedSignature) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as Partial<Session>;
    const current = Math.floor(now / 1000);
    if (parsed.aud !== "srm-demo" || typeof parsed.iat !== "number" || typeof parsed.exp !== "number" ||
      typeof parsed.nonce !== "string" || parsed.iat > current + 60 || parsed.exp <= current ||
      parsed.exp - parsed.iat !== SRM_SESSION_MAX_AGE_SECONDS) return false;
    return constantTimeEqual(providedSignature, await hmac(secret, payload));
  } catch { return false; }
}

export async function hasDemoSession(request: Request, env: AuthEnvironment = runtimeEnvironment()): Promise<boolean> {
  if (!demoAuthReady(env)) return false;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SRM_SESSION_COOKIE}=`));
  return verifyDemoSession(env.SRM_DEMO_SESSION_SECRET!, cookie?.slice(SRM_SESSION_COOKIE.length + 1) ?? null);
}
