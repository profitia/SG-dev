import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
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
  promotionExecutorEnvironment,
} from "./staging-migrate.mjs";
import {
  buildPlan,
  verifyPasswordSmoke,
  assertRenderService,
  assertDispatchTarget,
  selectReusableDeploy,
  inspectProductDatabase,
} from "./promote-staging.mjs";
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

// Copy real modules into a disposable fixture root; production routing gains no override.
async function isolatedTopologyPromotion(t, active = false) {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "srm-promotion-topology-test-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  for (const relative of ["apps/srm/scripts", "apps/srm/deployment", "apps/srm/db/migrations", "scripts/governance"]) {
    fs.cpSync(path.join(sourceRoot, relative), path.join(temporaryRoot, relative), { recursive: true });
  }
  fs.symlinkSync(path.join(sourceRoot, "apps/srm/node_modules"), path.join(temporaryRoot, "apps/srm/node_modules"), "dir");
  const topology = JSON.parse(fs.readFileSync(path.join(sourceRoot, "Canon/registries/srm-environment-topology-v1.json"), "utf8"));
  topology.environments.staging = {
  "status": "RESERVED",
  "activationStatus": "NOT_ONBOARDED",
  "github": {
    "environmentName": "srm-staging",
    "environmentId": null,
    "exclusiveProjectKey": "SRM",
    "status": "NOT_PROVISIONED"
  },
  "render": {
    "workspaceId": "tea-d7lps8rbc2fs73cn80dg",
    "projectId": "prj-dapbd3hsrm7s73es53fg",
    "environmentId": "evm-dapbdbbbc2fs73f4g7gg",
    "providerLabel": "Staging",
    "networkIsolation": "ENABLED",
    "services": {}
  },
  "neon": {
    "projectId": "snowy-breeze-40315151",
    "branchId": "br-broad-butterfly-b11t4v01",
    "branchName": "Staging",
    "parentBranchId": "br-nameless-bar-b1wlhjhx",
    "branchState": "ready",
    "branchProtected": false,
    "applicationDatabaseName": null,
    "applicationDatabaseStatus": "NOT_CREATED"
  },
  "domains": [],
  "deploymentPolicy": "NOT_ACTIVATED"
};
  if (active) {
    const stage = topology.environments.staging;
    stage.status = "ACTIVE";
    stage.verificationStatus = "VERIFIED";
    stage.github.environmentId = 1234;
    stage.neon.databaseId = 4321;
    stage.render.services.runtime = { serviceId: "srv-synthetic" };
  }
  const target = path.join(temporaryRoot, "Canon/registries/srm-environment-topology-v1.json");
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, JSON.stringify(topology));
  return import(pathToFileURL(path.join(temporaryRoot, "apps/srm/scripts/promote-staging.mjs")).href);
}

test("deterministic RESERVED first-deployment simulation lists all pending gates and never writes", async (t) => {
  const {buildPlan} = await isolatedTopologyPromotion(t);
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
test("ordinary push cannot enter Staging jobs; manual jobs require explicit authorization and pre-environment guard", () => {
  const workflow = fs.readFileSync(
    new URL("../../../.github/workflows/srm-ci.yml", import.meta.url),
    "utf8",
  );
  assert.ok(!workflow.includes("trigger_deploy"));
  assert.ok(
    workflow.includes(
      "if: github.event_name == 'workflow_dispatch' && inputs.staging_deployment_authorized == 'YES'",
    ),
  );
  assert.ok(workflow.includes("needs: srm-staging-guard"));
  assert.ok(workflow.includes("assertDispatchTarget();"));
  assert.ok(workflow.includes("environment: srm-staging"));
  assert.ok(workflow.includes("needs: srm-build"));
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

test("password smoke uses real form protocol and verifies denial, invalid password, secure session and page", async () => {
  const calls = [];
  const url = "https://srm-staging-test.onrender.com";
  const stub = async (u, init = {}) => {
    calls.push([u, init]);
    if (u.endsWith("/report-data")) return new Response("{}", { status: 401 });
    if (u.endsWith("/login")) {
      assert.ok(init.body instanceof URLSearchParams);
      const valid = init.body.get("password") === "isolated-test-secret";
      return new Response(null, {
        status: 303,
        headers: {
          location: url + (valid ? "/" : "/login?error=invalid"),
          ...(valid
            ? {
                "set-cookie":
                  "srm_demo_session=test; HttpOnly; Secure; SameSite=Lax; Path=/",
              }
            : {}),
        },
      });
    }
    assert.equal(init.headers.cookie, "srm_demo_session=test");
    return new Response("page");
  };
  const result = await verifyPasswordSmoke(url, "isolated-test-secret", stub);
  assert.equal(result.secureCookie, "PASS");
  assert.equal(calls.length, 4);
});
test("password smoke rejects a public API before attempting login", async () => {
  let n = 0;
  await assert.rejects(
    verifyPasswordSmoke("https://staging.test", "test", async () => {
      n++;
      return new Response("{}");
    }),
    /Unauthenticated/,
  );
  assert.equal(n, 1);
});
test("CLI simulation never calls providers and cannot combine with apply", () => {
  const cwd = new URL("..", import.meta.url);
  const args = ["scripts/promote-staging.mjs", "--simulate", "--sha", sha];
  const r = spawnSync(process.execPath, args, {
    cwd,
    env: { PATH: process.env.PATH },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.equal(p.mode, "SIMULATION_SYNTHETIC_EVIDENCE");
  assert.equal(p.releaseProvenance, "NOT_VERIFIED");
  assert.equal(p.stagingMutated, false);
  assert.notEqual(p.readiness, "READY");
  assert.notEqual(
    spawnSync(process.execPath, [...args, "--apply"], {
      cwd,
      env: { PATH: process.env.PATH },
    }).status,
    0,
  );
});

const serviceFixture = () => ({
  id: "srv-test",
  ownerId: contract.render.workspaceId,
  environmentId: contract.render.environmentId,
  repo: "https://github.com/" + contract.repository,
  autoDeployTrigger: "off",
  branch: "main",
  rootDir: contract.render.rootDir,
  type: "web_service",
  serviceDetails: {
    region: contract.render.region,
    plan: contract.render.plan,
    runtime: "node",
    numInstances: contract.render.numInstances,
    healthCheckPath: contract.render.healthCheckPath,
    envSpecificDetails: {
      buildCommand: contract.render.buildCommand,
      startCommand: contract.render.startCommand,
    },
    previews: { generation: "off" },
  },
});
test("exact Render runtime contract is accepted", () =>
  assert.doesNotThrow(() => assertRenderService(serviceFixture())));
for (const [field, value] of Object.entries({
  region: "oregon",
  plan: "free",
  runtime: "docker",
  numInstances: 2,
  healthCheckPath: "/wrong",
}))
  test("Render contract rejects " + field, () => {
    const s = serviceFixture();
    s.serviceDetails[field] = value;
    assert.throws(() => assertRenderService(s));
  });
test("Render contract rejects altered build, start, root directory and previews", () => {
  for (const field of ["buildCommand", "startCommand"]) {
    const s = serviceFixture();
    s.serviceDetails.envSpecificDetails[field] = "wrong";
    assert.throws(() => assertRenderService(s));
  }
  const s = serviceFixture();
  s.rootDir = "apps/sg2";
  assert.throws(() => assertRenderService(s));
  const p = serviceFixture();
  p.serviceDetails.previews.generation = "automatic";
  assert.throws(() => assertRenderService(p));
});

test("RESERVED cannot enter a protected deployment job even with a forged environment response", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t);
  assert.throws(() => assertDispatchTarget({id:1,protection_rules:[{type:"required_reviewers"}]}), /Canonical first onboarding/);
});
test("ACTIVE fixture accepts its exact protected GitHub environment", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t,true);
  assert.doesNotThrow(() => assertDispatchTarget({id:1234,name:"srm-staging",protection_rules:[{type:"required_reviewers",prevent_self_review:true,reviewers:[{type:"User",reviewer:{id:123,login:"synthetic"}}]}],deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}}));
});
test("ACTIVE fixture rejects forged protected GitHub identity", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t,true);
  assert.throws(() => assertDispatchTarget({id:1,protection_rules:[{type:"required_reviewers"}]}), /Exact protected GitHub environment/);
});
test("dispatch rejects empty review rules and self-review on another environment ID", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t,true);
  const ge={id:1234,name:"srm-staging",protection_rules:[{type:"required_reviewers",prevent_self_review:false,reviewers:[{type:"User",reviewer:{id:275643368,login:"profitia"}}]}],deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}};
  assert.throws(()=>assertDispatchTarget(ge),/only for the existing/);
  ge.protection_rules[0].prevent_self_review=true;
  ge.protection_rules[0].reviewers=[];
  assert.throws(()=>assertDispatchTarget(ge),/Required reviewer/);
});
test("promotion reports the actual permitted executor and rejects foreign or local hosts", () => {
  assert.equal(
    promotionExecutorEnvironment({
      GITHUB_ACTIONS: "true",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: contract.repository,
      GITHUB_WORKFLOW: "SRM CI",
      GITHUB_JOB: "srm-staging-promote",
    }),
    "github-actions",
  );
  assert.equal(
    promotionExecutorEnvironment({
      CODESPACES: "true",
      CODESPACE_NAME: "test-only",
      PMOS_PROJECT_NAME: "SRM",
      PMOS_WORKSPACE_NAME: "SG-dev Codespaces SRM",
    }),
    "codespaces",
  );
  assert.throws(() => promotionExecutorEnvironment({}));
  assert.throws(() =>
    promotionExecutorEnvironment({
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "profitia/other",
      GITHUB_WORKFLOW: "SRM CI",
      GITHUB_JOB: "srm-staging-promote",
    }),
  );
  assert.throws(() =>
    promotionExecutorEnvironment({
      CODESPACES: "true",
      CODESPACE_NAME: "test-only",
      PMOS_PROJECT_NAME: "SG2",
      PMOS_WORKSPACE_NAME: "SG-dev Codespaces SRM",
    }),
  );
});

test("organization variable alone is not proof of database readiness", async () => {
  assert.deepEqual(
    await inspectProductDatabase(false, {
      SRM_STAGING_ORGANIZATION_ID: "test-only",
    }),
    {
      status: "BINDING_PENDING",
      runtimeRoleReady: false,
      organizationReady: false,
    },
  );
  assert.equal(
    (await inspectProductDatabase(true, {})).organizationReady,
    false,
  );
});
test("metadata inspection validates destination before connecting", async () => {
  let connected = false;
  await assert.rejects(
    inspectProductDatabase(
      true,
      { ...migrationEnv(), SRM_NEON_BRANCH_ID: contract.development.branchId },
      () => {
        connected = true;
        return {};
      },
    ),
  );
  assert.equal(connected, false);
});
test("metadata proof is read-only and checks actual role privileges and tenant record", async () => {
  const sqls = [];
  const c = {
    async connect() {},
    async end() {},
    async query(sql) {
      sqls.push(sql);
      return {
        rows: sql.includes("current_database")
          ? [{ name: "srm_app" }]
          : sql.includes("rolcanlogin")
            ? [
                {
                  rolcanlogin: true,
                  rolsuper: false,
                  rolbypassrls: false,
                  rolcreatedb: false,
                  rolcreaterole: false,
                  rolreplication: false,
                },
              ]
            : sql.includes("to_regclass")
              ? [{ table_name: "srm.organizations" }]
              : sql.startsWith("SELECT id FROM")
                ? [{ id: "test-only" }]
                : [],
      };
    },
  };
  const r = await inspectProductDatabase(
    true,
    {
      ...migrationEnv(),
      SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
    },
    () => c,
  );
  assert.equal(r.status, "READ_ONLY_VERIFIED");
  assert.equal(r.runtimeRoleReady, true);
  assert.equal(r.organizationReady, true);
  assert.equal(sqls[0], "BEGIN READ ONLY");
  assert.equal(sqls.at(-1), "ROLLBACK");
  assert.ok(
    !sqls.some((s) => /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|GRANT)\b/.test(s)),
  );
});

test("rollback creates a new deployment rather than reusing a deactivated old SHA", () => {
  assert.equal(
    selectReusableDeploy(
      [{ id: "old", status: "deactivated", commit: { id: sha } }],
      sha,
    ),
    null,
  );
  assert.equal(
    selectReusableDeploy(
      [{ id: "failed", status: "build_failed", commit: { id: sha } }],
      sha,
    ),
    null,
  );
});
test("retry reuses only matching live/inflight deployment and blocks unknown state", () => {
  const d = { id: "pending", status: "build_in_progress", commit: { id: sha } };
  assert.equal(selectReusableDeploy([{ deploy: d }], sha), d);
  assert.equal(
    selectReusableDeploy([{ ...d, commit: { id: "b".repeat(40) } }], sha),
    null,
  );
  assert.throws(
    () => selectReusableDeploy([{ ...d, status: "unknown" }], sha),
    /Unknown/,
  );
});
