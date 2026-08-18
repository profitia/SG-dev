export const DATA_RUNTIME_ENVIRONMENTS = ["STAGING", "PRODUCTION"] as const;

export type DataRuntimeEnvironment = (typeof DATA_RUNTIME_ENVIRONMENTS)[number];

export interface DataRuntimeEnvironmentConfig {
  environment: DataRuntimeEnvironment;
  organizationId: string;
  databaseUrl: string | null;
  directUrl: string | null;
}

export interface RuntimeEnvShape {
  DATA_RUNTIME_ENV?: string;
  DATA_RUNTIME_ORGANIZATION_ID?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
}

export interface ResolveDataRuntimeEnvironmentOptions {
  requireExplicitEnvironment?: boolean;
}

function readTrimmedEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveDataRuntimeEnvironment(
  env: RuntimeEnvShape = process.env,
  options: ResolveDataRuntimeEnvironmentOptions = {},
): DataRuntimeEnvironmentConfig {
  const explicitEnvironment = readTrimmedEnvValue(env.DATA_RUNTIME_ENV);
  const requestedEnvironment = explicitEnvironment ?? "STAGING";
  const organizationId = env.DATA_RUNTIME_ORGANIZATION_ID?.trim();

  if (options.requireExplicitEnvironment && !explicitEnvironment) {
    throw new Error(`Missing DATA_RUNTIME_ENV. Expected one of: ${DATA_RUNTIME_ENVIRONMENTS.join(", ")}.`);
  }

  if (!DATA_RUNTIME_ENVIRONMENTS.includes(requestedEnvironment as DataRuntimeEnvironment)) {
    throw new Error(
      `Unsupported DATA_RUNTIME_ENV \"${requestedEnvironment}\". Expected one of: ${DATA_RUNTIME_ENVIRONMENTS.join(", ")}.`,
    );
  }

  if (!organizationId) {
    throw new Error("Missing DATA_RUNTIME_ORGANIZATION_ID in apps/data-runtime/.env.local.");
  }

  return {
    environment: requestedEnvironment as DataRuntimeEnvironment,
    organizationId,
    databaseUrl: env.DATABASE_URL ?? null,
    directUrl: env.DIRECT_URL ?? null,
  };
}