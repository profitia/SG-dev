import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import {
  root,
  contract,
  migrationManifest,
  assertAuthorization,
  assertMigrationDestination,
  fullPreflight,
  runMigrations,
  initializationConfig,
} from "./staging-migrate.mjs";
const topology = () =>
  JSON.parse(
    fs.readFileSync(
      path.join(root, "Canon/registries/srm-environment-topology-v1.json"),
      "utf8",
    ),
  );
export function buildPlan(
  evidence,
  { sha, authorization = null, apply = false, rollback = false } = {},
) {
  if (
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !evidence?.approvedMainAncestor ||
    !evidence.ciPassed ||
    (!rollback && evidence.developmentLiveSha !== sha)
  )
    throw new Error(
      "Verified approved main revision and Development release required",
    );
  if (apply)
    assertAuthorization(authorization, sha, rollback ? "rollback" : "deploy");
  if (
    evidence.repositoryId !== contract.repositoryId ||
    evidence.neonProjectId !== contract.neon.projectId ||
    evidence.neonBranchId !== contract.neon.branchId ||
    evidence.databaseName !== "srm_app"
  )
    throw new Error("Provider target identity mismatch");
  const s = evidence.service;
  if (
    s &&
    (s.ownerId !== contract.render.workspaceId ||
      s.environmentId !== contract.render.environmentId ||
      s.repo.replace(/\.git$/, "") !==
        "https://github.com/" + contract.repository ||
      s.autoDeployTrigger !== "off" ||
      s.branch !== "main")
  )
    throw new Error("Render service routing or autodeploy mismatch");
  if (s) assertRenderService(s);
  const t = topology().environments.staging;
  const blockers = [];
  if (
    t.status !== "ACTIVE" ||
    t.verificationStatus !== "VERIFIED" ||
    !t.github.environmentId ||
    !t.neon.databaseId
  )
    blockers.push("S0_EXACT_PROVIDER_ONBOARDING");
  if (!s || s.id !== t.render.services?.runtime?.serviceId)
    blockers.push("FIRST_SERVICE_CREATION_WITH_PINNED_SOURCE");
  if (
    !evidence.databaseExists ||
    ((!evidence.runtimeRoleReady || !evidence.organizationReady) &&
      !(
        apply &&
        !rollback &&
        authorization?.operations?.includes("initialize")
      ))
  )
    blockers.push("DATABASE_ROLE_AND_ORGANIZATION_BOOTSTRAP");
  if (!evidence.secretsIsolated) blockers.push("STAGING_CREDENTIALS_ISOLATION");
  if (!evidence.githubProtected) blockers.push("GITHUB_ENVIRONMENT_PROTECTION");
  if (apply && blockers.length)
    throw new Error("Deployment-time gate: " + blockers.join(","));
  const migrations = migrationManifest().map(({ version, checksum }) => ({
    version,
    checksum,
  }));
  const manifest = {
    schemaVersion: "1.0",
    projectKey: "SRM",
    repository: contract.repository,
    sha,
    developmentLiveSha: evidence.developmentLiveSha,
    targetEnvironment: "staging",
    neon: contract.neon,
    serviceId: s?.id ?? null,
    migrations,
    sourceGuarantee: "SAME_SOURCE_SHA",
    artifactDigest: null,
  };
  return {
    manifest,
    digest: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    readiness: blockers.length ? "DEPLOYMENT_TIME_PENDING" : "READY",
    blockers,
    steps: [
      "verify explicit authorization",
      "full governance preflight",
      "verify live provider identity and isolated secrets",
      "transactional migration",
      "deploy exact approved SHA",
      "verify live commit and health",
      "verify password and authenticated read-only smoke",
      "record evidence",
    ],
    stagingMutated: false,
  };
}
async function api(base, resource, token, method = "GET", body) {
  if (!token) throw new Error("Required provider credential absent");
  const r = await fetch(base + resource, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("Provider request failed (" + r.status + ")");
  return r.status === 204 ? null : r.json();
}
async function paged(base, resource, token) {
  let all = [],
    cursor = "";
  for (let page = 0; page < 100; page++) {
    const rows = await api(
      base,
      resource +
        (resource.includes("?") ? "&" : "?") +
        "limit=100" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      token,
    );
    if (!Array.isArray(rows)) throw new Error("Unexpected provider list");
    all.push(...rows);
    if (rows.length < 100) return all;
    const next = rows.at(-1)?.cursor;
    if (!next || next === cursor)
      throw new Error("Provider pagination incomplete");
    cursor = next;
  }
  throw new Error("Provider pagination limit");
}
export async function liveEvidence(sha, env = process.env) {
  const render = "https://api.render.com/v1";
  const neon = "https://console.neon.tech/api/v2";
  const gh = "https://api.github.com";
  const repo = await api(gh, "/repos/" + contract.repository, env.GITHUB_TOKEN);
  const checks = await api(
    gh,
    "/repos/" +
      contract.repository +
      "/commits/" +
      sha +
      "/check-runs?per_page=100",
    env.GITHUB_TOKEN,
  );
  if (checks.total_count > 100) throw new Error("CI pagination required");
  const required = ["srm-build"];
  const ciPassed = required.every(
    (name) =>
      checks.check_runs
        .filter((c) => c.name === name && c.head_sha === sha)
        .sort((a, b) => b.id - a.id)[0]?.conclusion === "success",
  );
  const deployments = await paged(
    render,
    "/services/" + contract.development.renderServiceId + "/deploys",
    env.RENDER_API_KEY,
  );
  const dev = deployments
    .map((x) => x.deploy ?? x)
    .find((d) => d.status === "live");
  const allServices = await paged(
    render,
    "/services?ownerId=" + contract.render.workspaceId,
    env.RENDER_API_KEY,
  );
  const services = allServices
    .map((x) => x.service ?? x)
    .filter(
      (s) =>
        s.environmentId === contract.render.environmentId &&
        s.repo?.replace(/\.git$/, "") ===
          "https://github.com/" + contract.repository,
    );
  if (services.length > 1) throw new Error("Ambiguous Staging service");
  const branches = (
    await api(
      neon,
      "/projects/" + contract.neon.projectId + "/branches",
      env.NEON_API_KEY,
    )
  ).branches;
  const branch = branches.find((b) => b.id === contract.neon.branchId);
  if (
    !branch ||
    branch.project_id !== contract.neon.projectId ||
    branch.name !== "Staging" ||
    branch.protected
  )
    throw new Error("Neon Staging branch mismatch");
  const endpoints = (
    await api(
      neon,
      "/projects/" + contract.neon.projectId + "/endpoints",
      env.NEON_API_KEY,
    )
  ).endpoints;
  if (
    !endpoints.some(
      (e) =>
        e.id === contract.neon.endpointId &&
        e.branch_id === branch.id &&
        e.host === contract.neon.directHost,
    )
  )
    throw new Error("Neon endpoint mismatch");
  const databases = (
    await api(
      neon,
      "/projects/" +
        contract.neon.projectId +
        "/branches/" +
        branch.id +
        "/databases",
      env.NEON_API_KEY,
    )
  ).databases;
  const db = databases.find((d) => d.name === "srm_app");
  const roles = (
    await api(
      neon,
      "/projects/" +
        contract.neon.projectId +
        "/branches/" +
        branch.id +
        "/roles",
      env.NEON_API_KEY,
    )
  ).roles;
  const service = services[0] ?? null;
  let secretsIsolated = false;
  if (service) {
    const pairs = await paged(
      render,
      "/services/" + service.id + "/env-vars",
      env.RENDER_API_KEY,
    );
    const values = Object.fromEntries(
      pairs.map((x) => {
        const e = x.envVar ?? x;
        return [e.key, e.value];
      }),
    );
    const dp = await paged(
      render,
      "/services/" + contract.development.renderServiceId + "/env-vars",
      env.RENDER_API_KEY,
    );
    const dv = Object.fromEntries(
      dp.map((x) => {
        const e = x.envVar ?? x;
        return [e.key, e.value];
      }),
    );
    secretsIsolated =
      contract.requiredSecrets.every((k) => values[k] && values[k] !== dv[k]) &&
      values.TARGET_ENVIRONMENT === "staging" &&
      values.SRM_NEON_PROJECT_ID === contract.neon.projectId &&
      values.SRM_NEON_BRANCH_ID === contract.neon.branchId &&
      values.SRM_APP_DATABASE_HOST === contract.neon.directHost &&
      values.SRM_STAGING_ORGANIZATION_ID === env.SRM_STAGING_ORGANIZATION_ID &&
      values.SRM_STAGING_ORGANIZATION_ID !==
        dv.SRM_DEVELOPMENT_ORGANIZATION_ID &&
      values.SRM_DEMO_PASSWORD?.length >= 16 &&
      values.SRM_DEMO_SESSION_SECRET?.length >= 32 &&
      !values.DATABASE_URL &&
      !values.SRM_DEVELOPMENT_ORGANIZATION_ID &&
      !values.SRM_APP_DATABASE_URL;
  }
  let githubProtected = false;
  try {
    const ge = await api(
      gh,
      "/repos/" + contract.repository + "/environments/srm-staging",
      env.GITHUB_TOKEN,
    );
    githubProtected =
      ge.id === topology().environments.staging.github.environmentId &&
      ge.protection_rules?.some((r) => r.type === "required_reviewers");
  } catch {}
  const databaseInspection = await inspectProductDatabase(!!db, env);
  const git = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", sha, "origin/main"],
    { cwd: root },
  );
  return {
    repositoryId: repo.id,
    approvedMainAncestor: git.status === 0,
    ciPassed,
    developmentLiveSha: dev?.commit?.id,
    neonProjectId: branch.project_id,
    neonBranchId: branch.id,
    databaseName: "srm_app",
    databaseExists: !!db,
    runtimeRoleReady: databaseInspection.runtimeRoleReady,
    organizationReady: databaseInspection.organizationReady,
    secretsIsolated,
    githubProtected,
    service,
    providerSnapshot: {
      capturedAt: new Date().toISOString(),
      source: { render: "render-api", neon: "neon-api" },
      renderServices: allServices
        .map((x) => x.service ?? x)
        .map((s) => ({
          id: s.id,
          environmentId: s.environmentId,
          repo: s.repo,
          autoDeploy: s.autoDeployTrigger !== "off",
          liveStatus: "UNVERIFIED",
        })),
      neonBranches: branches.map((b) => ({
        id: b.id,
        projectId: b.project_id,
        name: b.name,
      })),
    },
  };
}
async function apply(plan, approval, evidence, env, rollback = false) {
  if (!evidence.service || evidence.service.id !== approval.renderServiceId)
    throw new Error("Approved exact service identity required");
  const snapshotPath = path.join(
    root,
    "apps/srm/node_modules/.srm-provider-snapshot.json",
  );
  const all = await paged(
    "https://api.render.com/v1",
    "/services/" + evidence.service.id + "/deploys",
    env.RENDER_API_KEY,
  );
  const latest = all.map((x) => x.deploy ?? x).find((d) => d.status === "live");
  const actual = evidence.providerSnapshot.renderServices.find(
    (s) => s.id === evidence.service.id,
  );
  Object.assign(actual, {
    liveStatus: latest ? "live" : "UNVERIFIED",
    liveDeployId: latest?.id,
    liveSha: latest?.commit?.id,
  });
  fs.writeFileSync(snapshotPath, JSON.stringify(evidence.providerSnapshot));
  fullPreflight({
    sha: plan.manifest.sha,
    taskId: approval.approvalId,
    approvalId: approval.approvalId,
    snapshotPath,
    target: "apps/srm/scripts/promote-staging.mjs",
  });
  if (!rollback) assertAuthorization(approval, plan.manifest.sha, "migrate");
  assertMigrationDestination(env);
  const client = new pg.Client({ connectionString: env.SRM_APP_DIRECT_URL });
  let migration;
  try {
    await client.connect();
    const initialize =
      !rollback && approval.operations.includes("initialize")
        ? initializationConfig(env)
        : null;
    if (initialize)
      assertAuthorization(approval, plan.manifest.sha, "initialize");
    migration = await runMigrations(client, { dryRun: rollback, initialize });
    if (rollback && migration.pending.length)
      throw new Error("Rollback schema is not fully compatible");
  } finally {
    await client.end();
  }
  const runtimeDatabase = await verifyRuntimeDatabase(env);
  let deploy = selectReusableDeploy(all, plan.manifest.sha);
  fullPreflight({
    sha: plan.manifest.sha,
    taskId: approval.approvalId,
    approvalId: approval.approvalId,
    snapshotPath,
    target: "apps/srm/scripts/promote-staging.mjs",
  });
  const fresh = await api(
    "https://api.render.com/v1",
    "/services/" + evidence.service.id,
    env.RENDER_API_KEY,
  );
  if (
    fresh.ownerId !== contract.render.workspaceId ||
    fresh.environmentId !== contract.render.environmentId ||
    fresh.branch !== "main" ||
    fresh.autoDeployTrigger !== "off" ||
    fresh.repo?.replace(/\.git$/, "") !==
      "https://github.com/" + contract.repository
  )
    throw new Error("Provider routing drift");
  assertRenderService(fresh);
  if (!deploy)
    deploy = await api(
      "https://api.render.com/v1",
      "/services/" + evidence.service.id + "/deploys",
      env.RENDER_API_KEY,
      "POST",
      { commitId: plan.manifest.sha, clearCache: "do_not_clear" },
    );
  for (let i = 0; i < 240 && deploy.status !== "live"; i++) {
    if (
      [
        "build_failed",
        "update_failed",
        "canceled",
        "pre_deploy_failed",
        "deactivated",
      ].includes(deploy.status)
    )
      throw new Error(
        "Deployment failed; preserve migration, use explicit compatible-code rollback",
      );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    deploy = await api(
      "https://api.render.com/v1",
      "/services/" + evidence.service.id + "/deploys/" + deploy.id,
      env.RENDER_API_KEY,
    );
  }
  if (deploy.status !== "live" || deploy.commit?.id !== plan.manifest.sha)
    throw new Error("Exact SHA deployment not verified");
  const url = evidence.service.serviceDetails?.url;
  if (
    !url?.startsWith("https://") ||
    new URL(url).hostname !== evidence.service.slug + ".onrender.com"
  )
    throw new Error("Provider URL identity mismatch");
  const health = await fetch(url + "/api/health", {
    signal: AbortSignal.timeout(30000),
  });
  const body = await health.json();
  if (
    health.status !== 200 ||
    body.service !== "srm" ||
    body.environment !== "staging"
  )
    throw new Error("Staging health failed");
  const passwordSmoke = await verifyPasswordSmoke(
    url,
    env.SRM_STAGING_DEMO_PASSWORD,
  );
  return {
    schemaVersion: "1.0",
    sha: plan.manifest.sha,
    deployId: deploy.id,
    serviceId: evidence.service.id,
    migration,
    runtimeDatabase,
    health: "PASS",
    authentication: "PASS",
    passwordSmoke,
    productPersistence: "DEPLOYMENT_TIME_PENDING",
    rollback: {
      sha: latest?.commit?.id ?? null,
      deployId: latest?.id ?? null,
      schemaRollback: false,
    },
    stagingMutated: true,
  };
}
async function main() {
  const args = process.argv.slice(2);
  const value = (k) => args[args.indexOf(k) + 1];
  const sha = value("--sha");
  const authorization = args.includes("--authorization")
    ? JSON.parse(fs.readFileSync(value("--authorization"), "utf8"))
    : null;
  const mutating = args.includes("--apply");
  const rollback = args.includes("--rollback");
  if (args.some((a) => a === "--production" || a === "--target"))
    throw new Error("Only Staging is a supported target");
  if (args.includes("--simulate")) {
    if (mutating || rollback) throw new Error("Simulation cannot mutate");
    console.log(JSON.stringify(simulationPlan(sha), null, 2));
    return;
  }
  if (mutating)
    assertAuthorization(authorization, sha, rollback ? "rollback" : "deploy");
  verifySourceTree(sha);
  const e = await liveEvidence(sha);
  if (rollback && !authorization?.rollbackSchemaCompatible)
    throw new Error("Explicit compatible rollback approval required");
  const plan = buildPlan(e, { sha, authorization, apply: mutating, rollback });
  console.log(
    JSON.stringify(
      mutating
        ? await apply(plan, authorization, e, process.env, rollback)
        : plan,
      null,
      2,
    ),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(() => {
    console.error(
      "SRM promotion failed closed; provider credentials and payloads withheld. Run --plan and review deployment-time gates.",
    );
    process.exitCode = 1;
  });

export function verifySourceTree(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? ""))
    throw new Error("Full release SHA required");
  const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (
    git(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
      .status !== 0 ||
    git(["merge-base", "--is-ancestor", sha, "origin/main"]).status !== 0
  )
    throw new Error("Release is not verified on main");
  if (
    git(["rev-parse", "HEAD"]).stdout.trim() !==
    git(["rev-parse", "origin/main"]).stdout.trim()
  )
    throw new Error(
      "Reviewed promotion mechanism must match current origin/main",
    );
  if (
    git(["cat-file", "-e", sha + ":apps/srm/src/server/runtime-environment.ts"])
      .status !== 0
  )
    throw new Error("Release lacks Staging runtime capability");
  const diff = git([
    "diff",
    "--exit-code",
    sha,
    "HEAD",
    "--",
    "apps/srm/db/migrations",
    "apps/srm/deployment/staging-contract.json",
  ]);
  if (diff.status !== 0)
    throw new Error(
      "Release migration or deployment contract differs from verified mechanism",
    );
}

export async function verifyRuntimeDatabase(env) {
  if (!env.SRM_APP_DATABASE_PASSWORD || !env.SRM_STAGING_ORGANIZATION_ID)
    throw new Error("Staging runtime verification binding missing");
  const u = new URL(
    "postgresql://srm_app_runtime@" +
      contract.neon.directHost +
      "/srm_app?sslmode=require&channel_binding=require",
  );
  u.password = env.SRM_APP_DATABASE_PASSWORD;
  const c = new pg.Client({ connectionString: u.toString() });
  try {
    await c.connect();
    await c.query("BEGIN READ ONLY");
    const r = (
      await c.query(
        "SELECT current_database() AS database_name,current_user AS role_name,r.rolsuper,r.rolbypassrls,pg_has_role(current_user,'neon_superuser','member') AS privileged FROM pg_roles r WHERE r.rolname=current_user",
      )
    ).rows[0];
    if (
      r?.database_name !== "srm_app" ||
      r.role_name !== "srm_app_runtime" ||
      r.rolsuper ||
      r.rolbypassrls ||
      r.privileged
    )
      throw new Error("Unsafe runtime database role");
    await c.query("SELECT set_config('srm.organization_id',$1,true)", [
      env.SRM_STAGING_ORGANIZATION_ID,
    ]);
    const org = await c.query("SELECT id FROM srm.organizations WHERE id=$1", [
      env.SRM_STAGING_ORGANIZATION_ID,
    ]);
    if (org.rows.length !== 1)
      throw new Error("Staging organization not provisioned");
    await c.query("ROLLBACK");
    return { role: "PASS", tenant: "PASS" };
  } finally {
    await c.end();
  }
}

export async function verifyPasswordSmoke(url, password, fetcher = fetch) {
  if (!password) throw new Error("Password smoke credential required");
  const denied = await fetcher(url + "/api/xray/report-data", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (denied.status !== 401)
    throw new Error("Unauthenticated API not protected");
  const loginRequest = (value) =>
    fetcher(url + "/api/auth/login", {
      method: "POST",
      body: new URLSearchParams({ password: value }),
      headers: {
        Origin: url,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  const invalid = await loginRequest("invalid".repeat(100));
  if (
    invalid.status !== 303 ||
    invalid.headers.get("location") !== url + "/login?error=invalid"
  )
    throw new Error("Incorrect password not rejected");
  const login = await loginRequest(password);
  const cookie = login.headers.get("set-cookie");
  if (
    login.status !== 303 ||
    login.headers.get("location") !== url + "/" ||
    !cookie?.startsWith("srm_demo_session=") ||
    !/;\s*HttpOnly(?:;|$)/i.test(cookie) ||
    !/;\s*Secure(?:;|$)/i.test(cookie)
  )
    throw new Error("Password login smoke failed");
  const page = await fetcher(url + "/", {
    headers: { cookie: cookie.split(";")[0] },
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  if (page.status !== 200) throw new Error("Authenticated page failed");
  return {
    unauthenticated: "PASS",
    incorrectPassword: "PASS",
    login: "PASS",
    secureCookie: "PASS",
    authenticatedPage: "PASS",
  };
}
export function simulationPlan(sha) {
  const evidence = {
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
  };
  return {
    mode: "SIMULATION_SYNTHETIC_EVIDENCE",
    releaseProvenance: "NOT_VERIFIED",
    ...buildPlan(evidence, { sha }),
  };
}

export function assertRenderService(service) {
  const c = contract.render,
    d = service?.serviceDetails;
  if (
    service?.ownerId !== c.workspaceId ||
    service.environmentId !== c.environmentId ||
    service.repo?.replace(/\.git$/, "") !==
      "https://github.com/" + contract.repository ||
    service.autoDeployTrigger !== "off" ||
    service.branch !== "main" ||
    service.rootDir !== c.rootDir ||
    service.type !== "web_service" ||
    d?.region !== c.region ||
    d.plan !== c.plan ||
    d.runtime !== "node" ||
    d.numInstances !== c.numInstances ||
    d.healthCheckPath !== c.healthCheckPath ||
    d.envSpecificDetails?.buildCommand !== c.buildCommand ||
    d.envSpecificDetails?.startCommand !== c.startCommand ||
    d.previews?.generation !== "off"
  )
    throw new Error("Render deployment contract mismatch");
}

export function assertDispatchTarget(githubEnvironment = null) {
  const t = topology().environments.staging;
  if (
    t.status !== "ACTIVE" ||
    t.verificationStatus !== "VERIFIED" ||
    !t.github.environmentId ||
    !t.neon.databaseId ||
    !t.render.services?.runtime?.serviceId
  )
    throw new Error(
      "Canonical first onboarding required before protected job activation",
    );
  if (
    githubEnvironment &&
    (githubEnvironment.id !== t.github.environmentId ||
      !githubEnvironment.protection_rules?.some(
        (r) => r.type === "required_reviewers",
      ))
  )
    throw new Error("Exact protected GitHub environment required");
}

export async function inspectProductDatabase(
  databaseExists,
  env,
  clientFactory = (connectionString) => new pg.Client({ connectionString }),
) {
  if (!databaseExists || !env.SRM_APP_DIRECT_URL)
    return {
      status: "BINDING_PENDING",
      runtimeRoleReady: false,
      organizationReady: false,
    };
  assertMigrationDestination(env);
  const c = clientFactory(env.SRM_APP_DIRECT_URL);
  try {
    await c.connect();
    await c.query("BEGIN READ ONLY");
    if (
      (await c.query("SELECT current_database() AS name")).rows[0]?.name !==
      "srm_app"
    )
      throw new Error("Wrong product database");
    const role = (
      await c.query(
        "SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname='srm_app_runtime'",
      )
    ).rows[0];
    let safe = false;
    if (role) {
      const members = await c.query(
        "SELECT rolname FROM pg_roles WHERE (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolname='neon_superuser') AND pg_has_role('srm_app_runtime',oid,'MEMBER')",
      );
      safe =
        role.rolcanlogin &&
        !role.rolsuper &&
        !role.rolbypassrls &&
        !role.rolcreatedb &&
        !role.rolcreaterole &&
        !role.rolreplication &&
        !members.rows.length;
    }
    let organizationReady = false;
    if (
      (await c.query("SELECT to_regclass('srm.organizations') AS table_name"))
        .rows[0]?.table_name &&
      env.SRM_STAGING_ORGANIZATION_ID
    ) {
      organizationReady =
        (
          await c.query("SELECT id FROM srm.organizations WHERE id=$1::uuid", [
            env.SRM_STAGING_ORGANIZATION_ID,
          ])
        ).rows.length === 1;
    }
    await c.query("ROLLBACK");
    return {
      status: "READ_ONLY_VERIFIED",
      runtimeRoleReady: safe,
      organizationReady,
    };
  } finally {
    await c.end();
  }
}

export function selectReusableDeploy(rows, sha) {
  const terminal = new Set([
    "deactivated",
    "build_failed",
    "pre_deploy_failed",
    "update_failed",
    "canceled",
  ]);
  const reusable = new Set([
    "live",
    "created",
    "queued",
    "scheduled",
    "build_in_progress",
    "pre_deploy_in_progress",
    "update_in_progress",
  ]);
  for (const row of rows) {
    const d = row.deploy ?? row;
    if (d.commit?.id !== sha) continue;
    if (reusable.has(d.status)) return d;
    if (!terminal.has(d.status))
      throw new Error(
        "Unknown provider deployment state; do not create a duplicate",
      );
  }
  return null;
}
