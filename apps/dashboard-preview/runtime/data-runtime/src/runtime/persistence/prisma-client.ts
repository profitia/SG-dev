import "../../load-local-env.ts";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { resolveDataRuntimeEnvironment } from "../env.ts";

export type DataRuntimePrismaClient = PrismaClient;

export function createDataRuntimePrismaClient(): DataRuntimePrismaClient {
  const environment = resolveDataRuntimeEnvironment();

  if (!environment.databaseUrl) {
    throw new Error("Runtime persistence repositories require DATABASE_URL in apps/data-runtime/.env.local.");
  }

  const adapter = new PrismaPg({ connectionString: environment.databaseUrl });
  return new PrismaClient({ adapter });
}