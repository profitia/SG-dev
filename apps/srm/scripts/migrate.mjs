import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const migration = "0001_xray_foundation";
const sql = readFileSync(new URL("../db/migrations/0001_xray_foundation.sql", import.meta.url), "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
const topology = JSON.parse(readFileSync(new URL("../../../Canon/registries/srm-environment-topology-v1.json", import.meta.url), "utf8"));
const expected = topology.environments.development.neon;
const connectionString = process.env.SRM_APP_DIRECT_URL;

if (process.env.TARGET_ENVIRONMENT !== "development") throw new Error("D3 migration is Development-only");
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
  const exists = await client.query("SELECT to_regclass('srm.schema_migrations') AS ledger");
  if (exists.rows[0]?.ledger) {
    const applied = await client.query("SELECT checksum_sha256 FROM srm.schema_migrations WHERE version = $1", [migration]);
    if (applied.rows.length) {
      if (applied.rows[0].checksum_sha256 !== checksum) throw new Error("Migration checksum drift");
      await client.query("COMMIT");
      console.log("Migration already applied with matching checksum");
      process.exitCode = 0;
    } else {
      throw new Error("Schema exists without this migration ledger entry");
    }
  } else {
    await client.query(sql);
    await client.query("INSERT INTO srm.schema_migrations(version, checksum_sha256) VALUES ($1, $2)", [migration, checksum]);
    await client.query("COMMIT");
    console.log("Applied 0001_xray_foundation to SRM Development srm_app");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
