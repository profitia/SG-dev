import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export const LOCAL_TEST_DATABASE_URL_MISSING = "LOCAL_TEST_DATABASE_URL_MISSING";
export const MALFORMED_TEST_DATABASE_URL = "MALFORMED_TEST_DATABASE_URL";
export const NON_LOCAL_DATABASE_URL_REJECTED = "NON_LOCAL_DATABASE_URL_REJECTED";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type LocalIntegrationPrismaClient = PrismaClient;

export function resolveLocalIntegrationDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env["ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS"] !== "true") {
    return null;
  }

  const databaseUrl = env["TEST_DATABASE_URL"];

  if (!databaseUrl) {
    throw new Error(LOCAL_TEST_DATABASE_URL_MISSING);
  }

  return validateLocalIntegrationDatabaseUrl(databaseUrl);
}

export function validateLocalIntegrationDatabaseUrl(databaseUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(MALFORMED_TEST_DATABASE_URL);
  }

  const protocol = parsed.protocol.toLowerCase();

  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error(MALFORMED_TEST_DATABASE_URL);
  }

  const hostname = parsed.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(NON_LOCAL_DATABASE_URL_REJECTED);
  }

  return databaseUrl;
}

export function createLocalIntegrationPrismaClient(databaseUrl: string): LocalIntegrationPrismaClient {
  const adapter = new PrismaPg({ connectionString: validateLocalIntegrationDatabaseUrl(databaseUrl) });
  return new PrismaClient({ adapter });
}