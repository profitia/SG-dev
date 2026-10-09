import pg from "pg";
import { fileURLToPath } from "node:url";

// Post-deployment hardening only: revoking these privileges before replacing
// the old INSERT-based runtime would interrupt existing searches.
export function assertPermissionDestination(env) {
  const url = new URL(env.SRM_APP_DIRECT_URL ?? "");
  if (env.TARGET_ENVIRONMENT !== "development" || env.SRM_NEON_PROJECT_ID !== "snowy-breeze-40315151" || env.SRM_NEON_BRANCH_ID !== "br-dark-surf-b1vrhda9"
    || url.hostname !== "ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech" || url.pathname !== "/srm_app" || url.username !== "neondb_owner"
    || !["postgres:", "postgresql:"].includes(url.protocol) || !url.password || (url.port && url.port !== "5432") || url.hash
    || url.searchParams.getAll("sslmode").length !== 1 || url.searchParams.get("sslmode") !== "require"
    || [...url.searchParams.keys()].some(key => !["sslmode", "channel_binding"].includes(key))
    || (url.searchParams.has("channel_binding") && url.searchParams.get("channel_binding") !== "require")) {
    throw new Error("Exact Development direct migration connection required");
  }
  if (!/^[a-f0-9]{40}$/.test(env.SRM_APPROVED_SHA ?? "") || env.SRM_LIVE_SHA !== env.SRM_APPROVED_SHA) {
    throw new Error("Verified approved Development live SHA required before privilege reconciliation");
  }
}

export async function reconcileOrganizationPermissions(client) {
  await client.query("BEGIN");
  try {
    const identity = (await client.query("SELECT current_database() AS database, current_user AS role")).rows[0];
    if (identity?.database !== "srm_app" || identity.role !== "neondb_owner") throw new Error("Migration database/role identity mismatch");
    await client.query("REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON srm.organizations FROM srm_app_runtime");
    const permission = (await client.query("SELECT has_table_privilege('srm_app_runtime','srm.organizations','SELECT') AS can_read, has_table_privilege('srm_app_runtime','srm.organizations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS can_mutate")).rows[0];
    if (!permission?.can_read || permission.can_mutate) throw new Error("Runtime organization privileges do not meet least privilege");
    await client.query("COMMIT");
    return { organizationSelect: true, organizationMutations: false };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
}

async function main() {
  assertPermissionDestination(process.env);
  if (!process.argv.includes("--apply")) throw new Error("Use --apply only after governance and live SHA verification");
  const client = new pg.Client({ connectionString: process.env.SRM_APP_DIRECT_URL });
  try { await client.connect(); console.log(JSON.stringify(await reconcileOrganizationPermissions(client))); }
  finally { await client.end(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("SRM Development privilege reconciliation failed closed; credentials are never logged."); process.exitCode = 1; });
}
