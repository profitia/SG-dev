import { createClerkClient } from "@clerk/backend";
import type { IdentityApplication } from "@profitia/platform-contracts/identity-provider";

type EnvironmentInput = Readonly<Record<string, string | undefined>>;
export type SrmIdentityRuntime = Readonly<
  { provider: "legacy_demo" } |
  { provider: "clerk"; publishableKey: string; application: Readonly<IdentityApplication> }
>;

// This module is imported only by server code. Public configuration deliberately
// contains neither the backend credential nor a database connection.
export class IdentityConfigurationUnavailable extends Error {
  constructor() { super("Identity configuration unavailable"); }
}
function unavailable(): never { throw new IdentityConfigurationUnavailable(); }
function exactOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && !url.username && !url.password && !url.hostname.includes("*") &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch { return false; }
}

/** Deployment-owned configuration; an incomplete explicit Clerk mode never falls back to demo. */
export function readSrmIdentityRuntime(env: EnvironmentInput = process.env): SrmIdentityRuntime {
  if (typeof window !== "undefined") unavailable();
  const provider = env.SRM_AUTH_PROVIDER ?? "legacy_demo";
  if (provider === "legacy_demo") return Object.freeze({ provider });
  if (provider !== "clerk") unavailable();
  const environment = env.TARGET_ENVIRONMENT;
  const issuer = env.PROFITIA_CLERK_ISSUER ?? "";
  const publishableKey = env.PROFITIA_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = env.PROFITIA_CLERK_SECRET_KEY ?? "";
  let authorizedParties: unknown;
  try { authorizedParties = JSON.parse(env.PROFITIA_CLERK_AUTHORIZED_PARTIES ?? ""); }
  catch { unavailable(); }
  if (!["development", "staging", "production"].includes(environment ?? "") ||
      !exactOrigin(issuer) || !issuer.startsWith("https:") ||
      !Array.isArray(authorizedParties) || !authorizedParties.length || authorizedParties.length > 16 ||
      authorizedParties.some(value => typeof value !== "string" || !exactOrigin(value)) ||
      new Set(authorizedParties).size !== authorizedParties.length ||
      !/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(publishableKey) ||
      !/^sk_(test|live)_[A-Za-z0-9_-]+$/.test(secret)) unavailable();
  const isTest = publishableKey.startsWith("pk_test_");
  if (isTest !== secret.startsWith("sk_test_") ||
      (environment !== "development" && (isTest || new URL(issuer).hostname.endsWith(".accounts.dev") || authorizedParties.some(value => !value.startsWith("https:"))))) unavailable();
  // Clerk publishable keys encode their Frontend API host, terminated by '$'.
  const frontendHost = Buffer.from(publishableKey.replace(/^pk_(test|live)_/, ""), "base64url").toString("utf8");
  if (frontendHost !== `${new URL(issuer).host}$`) unavailable();
  const application = Object.freeze({ appId: "srm", environment: environment as IdentityApplication["environment"], issuer,
    authorizedParties: Object.freeze([...authorizedParties]) as unknown as string[] });
  return Object.freeze({ provider, publishableKey, application });
}

/** Official SDK only; authority, internal identity mapping and membership stay in the existing private host. */
export function createSrmClerkClient(env: EnvironmentInput = process.env) {
  const config = readSrmIdentityRuntime(env);
  if (config.provider !== "clerk") unavailable();
  return createClerkClient({ publishableKey: config.publishableKey, secretKey: env.PROFITIA_CLERK_SECRET_KEY, telemetry: { disabled: true } });
}
