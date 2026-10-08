import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {
  contract,
  migrationManifest,
  assertAuthorization,
  assertMigrationDestination,
  inspectLedger,
  runMigrations,
  initializationConfig,
} from "./staging-migrate.mjs";
import { buildPlan } from "./promote-staging.mjs";
const sha = "a".repeat(40);
const approval = () => ({
  schemaVersion: "1.0",
  projectKey: "SRM",
  repository: contract.repository,
  targetEnvironment: "staging",
  stagingDeploymentAuthorized: true,
  productionMutationsAllowed: false,
  releaseSha: sha,
  neonProjectId: contract.neon.projectId,
  neonBranchId: contract.neon.branchId,
  databaseName: "srm_app",
  approvalId: "SRM-STAGING-EXPLICIT-TEST",
  approvedBy: "test-only",
  costOwner: "test-only",
  operations: ["deploy", "migrate"],
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
});
const evidence = () => ({
  repositoryId: contract.repositoryId,
  approvedMainAncestor: true,
  ciPassed: true,
  developmentLiveSha: sha,
  neonProjectId: contract.neon.projectId,
  neonBranchId: contract.neon.branchId,
  databaseName: "srm_app",
  databaseExists: false,
  runtimeRoleReady: false,
  organizationReady: false,
  secretsIsolated: false,
  githubProtected: false,
  service: null,
});
test("deterministic first-deployment simulation lists all pending gates and never writes", () => {
  const a = buildPlan(evidence(), { sha });
  assert.equal(a.stagingMutated, false);
  assert.ok(a.blockers.includes("S0_EXACT_PROVIDER_ONBOARDING"));
  assert.ok(a.blockers.includes("FIRST_SERVICE_CREATION_WITH_PINNED_SOURCE"));
  assert.deepEqual(a, buildPlan(evidence(), { sha }));
});
for (const [key, value] of Object.entries({
  projectKey: "SG2",
  repository: "profitia/other",
  targetEnvironment: "production",
  stagingDeploymentAuthorized: false,
  productionMutationsAllowed: true,
  releaseSha: "b".repeat(40),
  neonProjectId: "bold-breeze-68888550",
  neonBranchId: "br-nameless-bar-b1wlhjhx",
  databaseName: "srm_pmos",
  approvedBy: null,
  costOwner: null,
  operations: ["rollback"],
  expiresAt: "2000-01-01",
}))
  test("authorization rejects " + key, () =>
    assert.throws(() =>
      assertAuthorization({ ...approval(), [key]: value }, sha, "deploy"),
    ),
  );
test("explicit authorization validates but cannot bypass RESERVED", () => {
  assert.doesNotThrow(() => assertAuthorization(approval(), sha, "deploy"));
  assert.throws(
    () =>
      buildPlan(evidence(), { sha, authorization: approval(), apply: true }),
    /Deployment-time gate/,
  );
});
for (const [key, value] of Object.entries({
  repositoryId: 0,
  approvedMainAncestor: false,
  ciPassed: false,
  developmentLiveSha: "b".repeat(40),
  neonProjectId: "wrong",
  neonBranchId: contract.development.branchId,
  databaseName: "srm_pmos",
}))
  test("promotion rejects " + key, () =>
    assert.throws(() => buildPlan({ ...evidence(), [key]: value }, { sha })),
  );
for (const [key, value] of Object.entries({
  ownerId: "wrong",
  environmentId: "production",
  repo: "https://github.com/profitia/other",
  autoDeployTrigger: "commit",
  branch: "staging",
}))
  test("Render routing rejects " + key, () => {
    const service = {
      id: "srv-test",
      ownerId: contract.render.workspaceId,
      environmentId: contract.render.environmentId,
      repo: "https://github.com/" + contract.repository,
      autoDeployTrigger: "off",
      branch: "main",
      [key]: value,
    };
    assert.throws(() => buildPlan({ ...evidence(), service }, { sha }));
  });
const migrationEnv = () => ({
  TARGET_ENVIRONMENT: "staging",
  SRM_NEON_PROJECT_ID: contract.neon.projectId,
  SRM_NEON_BRANCH_ID: contract.neon.branchId,
  SRM_APP_DIRECT_URL:
    "postgresql://neondb_owner:test-only@" +
    contract.neon.directHost +
    "/srm_app?sslmode=require",
});
test("exact Staging migration destination accepted", () =>
  assert.doesNotThrow(() => assertMigrationDestination(migrationEnv())));
for (const [key, value] of Object.entries({
  TARGET_ENVIRONMENT: "development",
  SRM_NEON_PROJECT_ID: "bold-breeze-68888550",
  SRM_NEON_BRANCH_ID: contract.development.branchId,
  SRM_APP_DIRECT_URL:
    "postgresql://neondb_owner:test-only@" +
    contract.development.directHost +
    "/srm_app?sslmode=require",
}))
  test("migration rejects " + key, () =>
    assert.throws(() =>
      assertMigrationDestination({ ...migrationEnv(), [key]: value }),
    ),
  );
for (const dest of [
  "postgresql://neondb_owner:test-only@" +
    contract.neon.directHost.replace(".", "-pooler.") +
    "/srm_app?sslmode=require",
  "postgresql://neondb_owner:test-only@" +
    contract.neon.directHost +
    "/srm_pmos?sslmode=require",
  "postgresql://srm_app_runtime:test-only@" +
    contract.neon.directHost +
    "/srm_app?sslmode=require",
])
  test(
    "migration refuses pooler, PMOS or runtime role " + dest.split("@")[1],
    () =>
      assert.throws(() =>
        assertMigrationDestination({
          ...migrationEnv(),
          SRM_APP_DIRECT_URL: dest,
        }),
      ),
  );
test("checksums and contiguous prefix support exact idempotent retry", () => {
  const ms = migrationManifest();
  assert.equal(ms.length, 11);
  const rows = ms.map((m) => ({
    version: m.version,
    checksum_sha256: m.checksum,
  }));
  assert.deepEqual(inspectLedger(rows), []);
  assert.equal(inspectLedger(rows.slice(0, 5)).length, 6);
  assert.throws(() => inspectLedger(rows.slice(1)), /prefix/);
  assert.throws(
    () =>
      inspectLedger([
        { version: rows[0].version, checksum_sha256: "0".repeat(64) },
      ]),
    /drift/,
  );
  assert.throws(
    () =>
      inspectLedger([
        { version: "9999_foreign", checksum_sha256: "0".repeat(64) },
      ]),
    /Unknown/,
  );
});
test("SQL failure rolls the transaction back", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("current_database"))
        return { rows: [{ name: "srm_app" }] };
      if (sql.includes("to_regclass")) return { rows: [{ ledger: null }] };
      if (sql.includes("pg_namespace")) return { rows: [{ exists: false }] };
      if (sql.startsWith("CREATE")) throw new Error("test SQL failure");
      return { rows: [] };
    },
  };
  await assert.rejects(runMigrations(client), /test SQL failure/);
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(!queries.includes("COMMIT"));
});
test("read-only migration inspection cannot run DDL", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return {
        rows: sql.includes("current_database")
          ? [{ name: "srm_app" }]
          : sql.includes("to_regclass")
            ? [{ ledger: null }]
            : sql.includes("pg_namespace")
              ? [{ exists: false }]
              : [],
      };
    },
  };
  const r = await runMigrations(client, { dryRun: true });
  assert.equal(r.applied.length, 0);
  assert.equal(queries[0], "BEGIN READ ONLY");
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(
    !queries.some((q) => q.startsWith("CREATE") || q.startsWith("INSERT")),
  );
});
test("ordinary CI has no deployment job or environment activation", () => {
  const workflow = fs.readFileSync(
    new URL("../../../.github/workflows/srm-ci.yml", import.meta.url),
    "utf8",
  );
  assert.ok(!workflow.includes("trigger_deploy"));
  assert.ok(!workflow.includes("environment: srm-staging"));
  assert.ok(!workflow.includes("promote:staging -- --apply"));
});
test("missing authorization fails before any provider call", () => {
  const r = spawnSync(
    process.execPath,
    ["scripts/promote-staging.mjs", "--apply", "--sha", sha],
    {
      cwd: new URL("..", import.meta.url),
      env: { PATH: process.env.PATH },
      encoding: "utf8",
    },
  );
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes("failed closed"));
});
test(
  "real local Postgres: first initialization, retry and checksum drift",
  { skip: !process.env.SRM_MIGRATION_TEST_URL },
  async () => {
    const u = new URL(process.env.SRM_MIGRATION_TEST_URL);
    if (
      !["localhost", "127.0.0.1"].includes(u.hostname) ||
      u.pathname != "/srm_migration_test"
    )
      throw new Error(
        "Migration integration test requires isolated localhost srm_migration_test",
      );
    const c = new pg.Client({ connectionString: u.toString() });
    await c.connect();
    try {
      await c.query("DROP SCHEMA IF EXISTS srm CASCADE");
      await c.query("DROP ROLE IF EXISTS srm_app_runtime");
      const initialize = initializationConfig({
        SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
        SRM_APP_DATABASE_PASSWORD: "isolated-local-only-password-at-least-32",
      });
      const faulty = {
        query: (sql, params) =>
          c.query(
            sql.includes("CREATE TABLE srm.catalog_financial_indicators")
              ? "SELECT 1/0"
              : sql,
            params,
          ),
      };
      await assert.rejects(runMigrations(faulty, { initialize }));
      assert.equal(
        (
          await c.query(
            "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='srm') AS exists",
          )
        ).rows[0].exists,
        false,
      );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int AS n FROM pg_roles WHERE rolname='srm_app_runtime'",
          )
        ).rows[0].n,
        0,
      );
      let r = await runMigrations(c, { initialize });
      assert.equal(r.applied.length, 11);
      r = await runMigrations(c);
      assert.equal(r.applied.length, 0);
      const tables = await c.query(
        "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind='r' AND c.relname<>'schema_migrations' AND c.relrowsecurity AND c.relforcerowsecurity",
      );
      assert.equal(tables.rows[0].count, 15);
      const role = (
        await c.query(
          "SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='srm_app_runtime'",
        )
      ).rows[0];
      assert.equal(role.rolcanlogin, true);
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
      await c.query("SET ROLE srm_app_runtime");
      assert.equal(
        (await c.query("SELECT count(*)::int AS n FROM srm.organizations"))
          .rows[0].n,
        0,
      );
      await c.query("SELECT set_config('srm.organization_id',$1,false)", [
        initialize.organizationId,
      ]);
      assert.equal(
        (await c.query("SELECT count(*)::int AS n FROM srm.organizations"))
          .rows[0].n,
        1,
      );
      await c.query(
        "SELECT set_config('srm.organization_id','00000000-0000-4000-8000-000000000009',false)",
      );
      assert.equal(
        (await c.query("SELECT count(*)::int AS n FROM srm.organizations"))
          .rows[0].n,
        0,
      );
      await c.query("RESET ROLE");
      await c.query(
        "UPDATE srm.schema_migrations SET checksum_sha256=repeat('0',64) WHERE version='0001_xray_foundation'",
      );
      await assert.rejects(runMigrations(c), /drift/);
    } finally {
      await c.end();
    }
  },
);

for (const suffix of [
  "&host=evil.example",
  "&sslmode=disable",
  "&options=-c%20search_path%3Devil",
  "#fragment",
])
  test("migration refuses URL override " + suffix, () =>
    assert.throws(() =>
      assertMigrationDestination({
        ...migrationEnv(),
        SRM_APP_DIRECT_URL: migrationEnv().SRM_APP_DIRECT_URL + suffix,
      }),
    ),
  );
test("initialization refuses absent, Development tenant and weak secret", () => {
  assert.throws(() => initializationConfig({}));
  assert.throws(() =>
    initializationConfig({
      SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
      SRM_APP_DATABASE_PASSWORD: "short",
    }),
  );
  assert.throws(() =>
    initializationConfig({
      SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
      SRM_APP_DATABASE_PASSWORD: "test-only-at-least-32-characters-password",
      SRM_DEVELOPMENT_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000001",
    }),
  );
});
test("rollback approval does not bypass RESERVED or fabricate Development provenance", () => {
  const e = { ...evidence(), developmentLiveSha: "b".repeat(40) };
  const a = {
    ...approval(),
    operations: ["rollback"],
    rollbackSchemaCompatible: true,
  };
  const plan = buildPlan(e, { sha, rollback: true });
  assert.equal(plan.manifest.developmentLiveSha, e.developmentLiveSha);
  assert.throws(
    () => buildPlan(e, { sha, authorization: a, rollback: true, apply: true }),
    /Deployment-time gate/,
  );
});
