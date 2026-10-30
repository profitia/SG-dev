import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { PoolConfig } from "pg";
export const binding = JSON.parse(
  fs.readFileSync(
    new URL("../deployment/development-v1.json", import.meta.url),
    "utf8",
  ),
);
export interface Config {
  origin: string;
  issuer: string;
  publishableKey: string;
  secretKey: string;
  commandKey: Buffer;
  sourceSha: string;
  limitsDigest: string;
  identityDigest: string;
  port: number;
  limits: PoolConfig;
  identity: PoolConfig;
}
export function poolConfig(
  raw: string,
  which: "limits" | "identity",
): PoolConfig {
  const b = binding[which];
  const u = new URL(raw);
  const role = which === "limits" ? b.runtime : binding.identity.runtime;
  if (
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    u.username !== role ||
    !u.password ||
    decodeURIComponent(u.pathname.slice(1)) !== b.database ||
    ![b.host, b.host.replace(".c-", "-pooler.c-")].includes(u.hostname) ||
    (u.port && u.port !== "5432") ||
    u.hash ||
    [...u.searchParams].some(
      ([k, v]) =>
        !(
          (k === "sslmode" && ["require", "verify-full"].includes(v)) ||
          (k === "channel_binding" && v === "require")
        ),
    )
  )
    throw Error("EXACT_DATABASE_BINDING_REQUIRED");
  return {
    host: u.hostname,
    port: 5432,
    database: b.database,
    user: role,
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: true },
    max: which === "limits" ? 4 : 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    application_name: "package-limits-development",
    options: "-c timezone=UTC",
  };
}
export function configuration(env: NodeJS.ProcessEnv = process.env): Config {
  if (
    env.TARGET_ENVIRONMENT !== "development" ||
    (env.RENDER_SERVICE_ID &&
      env.RENDER_SERVICE_ID !== binding.render.serviceId)
  )
    throw Error("DEVELOPMENT_SERVICE_REQUIRED");
  const issuer = env.CLERK_ISSUER ?? "",
    pk = env.CLERK_PUBLISHABLE_KEY ?? "",
    key = env.LIMITS_COMMAND_KEY ?? "",
    sk = env.CLERK_SECRET_KEY ?? "";
  if (
    issuer !== "https://unified-drum-7191.clerk.accounts.dev" ||
    !/^pk_test_[A-Za-z0-9_-]+$/.test(pk) ||
    Buffer.from(pk.slice(8), "base64url").toString("utf8") !==
      new URL(issuer).hostname + "$" ||
    !sk.startsWith("sk_test_") ||
    !/^[a-f0-9]{64}$/.test(key)
  )
    throw Error("EXISTING_DEVELOPMENT_IDENTITY_REQUIRED");
  const source = JSON.parse(
    fs.readFileSync(new URL("./source.json", import.meta.url), "utf8"),
  );
  if (
    !/^[a-f0-9]{40}$/.test(env.LIMITS_EXPECTED_SOURCE_SHA ?? "") ||
    source.sha !== env.LIMITS_EXPECTED_SOURCE_SHA ||
    source.dirty
  )
    throw Error("EXACT_ACCEPTED_SOURCE_REQUIRED");
  const schema = JSON.parse(
    fs.readFileSync(new URL("./schema.json", import.meta.url), "utf8"),
  );
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("INVALID_PORT");
  return {
    origin: binding.origin,
    issuer,
    publishableKey: pk,
    secretKey: sk,
    commandKey: Buffer.from(key, "hex"),
    sourceSha: source.sha,
    limitsDigest: schema.limitsDigest,
    identityDigest: schema.identityDigest,
    port,
    limits: poolConfig(env.LIMITS_DATABASE_URL ?? "", "limits"),
    identity: poolConfig(env.IDENTITY_DATABASE_URL ?? "", "identity"),
  };
}
