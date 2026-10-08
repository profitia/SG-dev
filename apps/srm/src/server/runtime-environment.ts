export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
const projectId = "snowy-breeze-40315151";
const destinations = {
  development: {
    branchId: "br-dark-surf-b1vrhda9",
    host: "ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech",
  },
  staging: {
    branchId: "br-broad-butterfly-b11t4v01",
    host: "ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech",
  },
} as const;
export function productEnvironmentReady(
  env: RuntimeEnvironment = process.env,
): boolean {
  return (
    (env.TARGET_ENVIRONMENT === "development" &&
      (!env.SRM_NEON_PROJECT_ID || env.SRM_NEON_PROJECT_ID === projectId) &&
      (!env.SRM_NEON_BRANCH_ID ||
        env.SRM_NEON_BRANCH_ID === destinations.development.branchId)) ||
    (env.TARGET_ENVIRONMENT === "staging" &&
      env.SRM_NEON_PROJECT_ID === projectId &&
      env.SRM_NEON_BRANCH_ID === destinations.staging.branchId)
  );
}
export function productOrganizationId(
  env: RuntimeEnvironment = process.env,
): string | undefined {
  return productEnvironmentReady(env)
    ? env.TARGET_ENVIRONMENT === "staging"
      ? env.SRM_STAGING_ORGANIZATION_ID
      : env.SRM_DEVELOPMENT_ORGANIZATION_ID
    : undefined;
}
export function assertProductConnection(
  connection: string,
  env: RuntimeEnvironment,
): void {
  const target = env.TARGET_ENVIRONMENT ?? "development";
  if (target !== "development" && target !== "staging")
    throw new Error("SRM product target is not supported");
  if (target === "staging" && !productEnvironmentReady(env))
    throw new Error("SRM Staging environment identity is required");
  if (env.SRM_NEON_PROJECT_ID && env.SRM_NEON_PROJECT_ID !== projectId)
    throw new Error("SRM product project identity mismatch");
  const expected = destinations[target];
  if (env.SRM_NEON_BRANCH_ID && env.SRM_NEON_BRANCH_ID !== expected.branchId)
    throw new Error("SRM product branch identity mismatch");
  const url = new URL(connection);
  const host = url.hostname.replace(/-pooler(?=\.)/, "");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.password ||
    (url.port && url.port !== "5432") ||
    url.hash ||
    url.searchParams.getAll("sslmode").length !== 1 ||
    [...url.searchParams.keys()].some(
      (key) => !["sslmode", "channel_binding"].includes(key),
    ) ||
    (url.searchParams.has("channel_binding") &&
      url.searchParams.get("channel_binding") !== "require") ||
    host !== expected.host ||
    url.pathname !== "/srm_app" ||
    url.username !== "srm_app_runtime" ||
    url.searchParams.get("sslmode") !== "require"
  )
    throw new Error("SRM product connection violates environment isolation");
}
