import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const migrationsUrl = new URL("../db/migrations/", import.meta.url);
const migrations = readdirSync(migrationsUrl).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
if (!migrations.length || migrations[0] !== "0001_xray_foundation.sql") throw new Error("SRM migration foundation is missing");
const topology = JSON.parse(readFileSync(new URL("../../../Canon/registries/srm-environment-topology-v1.json", import.meta.url), "utf8"));
const expected = topology.environments.development.neon;
const connectionString = process.env.SRM_APP_DIRECT_URL;

if (process.env.TARGET_ENVIRONMENT !== "development") throw new Error("SRM migration is Development-only");
if (!connectionString) throw new Error("SRM_APP_DIRECT_URL is required");
if (process.env.SRM_NEON_PROJECT_ID !== expected.projectId || process.env.SRM_NEON_BRANCH_ID !== expected.branchId) {
  throw new Error("SRM Neon project/branch identity mismatch");
}
const url = new URL(connectionString);
if (url.pathname !== "/" + expected.databaseName || url.hostname.includes("-pooler")) {
  throw new Error("Migration requires the direct srm_app connection");
}

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  await client.query("BEGIN");
  const identity = await client.query("SELECT current_database() AS database_name");
  if (identity.rows[0]?.database_name !== expected.databaseName) throw new Error("Connected database identity mismatch");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('srm-xray-migration'))");
  let ledgerExists = Boolean((await client.query("SELECT to_regclass('srm.schema_migrations') AS ledger")).rows[0]?.ledger);
  for (const file of migrations) {
    const version = file.slice(0, -4);
    const sql = readFileSync(new URL(file, migrationsUrl), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = ledgerExists
      ? await client.query("SELECT checksum_sha256 FROM srm.schema_migrations WHERE version = $1", [version])
      : { rows: [] };
    if (applied.rows.length) {
      if (applied.rows[0].checksum_sha256 !== checksum) throw new Error(`Migration checksum drift: ${version}`);
      console.log(`Verified ${version}`);
      continue;
    }
    if (ledgerExists && version === "0001_xray_foundation") throw new Error("SRM foundation schema exists without its migration ledger entry");
    if (!ledgerExists && version !== "0001_xray_foundation") throw new Error("SRM migration ledger is missing");
    await client.query(sql);
    ledgerExists = true;
    await client.query("INSERT INTO srm.schema_migrations(version, checksum_sha256) VALUES ($1, $2)", [version, checksum]);
    console.log(`Applied ${version} to SRM Development srm_app`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
