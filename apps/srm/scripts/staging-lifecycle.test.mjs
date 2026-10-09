import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  runLifecycle,
  manifestFrom,
  releasePointer,
  createProvider,
} from "./staging-lifecycle.mjs";
import { contract } from "./staging-migrate.mjs";
import {
  digest,
  operations,
} from "../../../scripts/governance/srm-release-lifecycle.mjs";
const sha = "a".repeat(40);
const manifest = manifestFrom(
  {
    repositoryId: contract.repositoryId,
    approvedMainAncestor: true,
    ciPassed: true,
    developmentLiveSha: sha,
  },
  sha,
);
const approval = (mode = "onboard") => ({
  schemaVersion: "2.0",
  projectKey: "SRM",
  targetEnvironment: "staging",
  stagingDeploymentAuthorized: true,
  stagingMutationsAllowed: true,
  productionMutationsAllowed: false,
  manifest,
  releaseSha: sha,
  manifestDigest: digest(manifest),
  repository: contract.repository,
  repositoryId: contract.repositoryId,
  renderWorkspaceId: contract.render.workspaceId,
  renderProjectId: contract.render.projectId,
  renderEnvironmentId: contract.render.environmentId,
  neonProjectId: contract.neon.projectId,
  neonBranchId: contract.neon.branchId,
  neonEndpointId: contract.neon.endpointId,
  databaseName: "srm_app",
  approvalId: "synthetic-first",
  approvedBy: "synthetic",
  costOwner: "synthetic",
  costEvidence: {
    source: "PRIMARY_PROVIDER_QUOTE",
    url: "https://render.com/pricing",
    verifiedAt: new Date().toISOString(),
    monthlyComputeUsd: 7,
  },
  operations,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  mode,
  firstOnboardingAuthorized: true,
  githubReviewerIds: [123],
  rollbackSchemaCompatible: true,
  budget: {
    renderPlan: contract.render.plan,
    renderInstances: 1,
    renderMonthlyComputeUsd: 7,
    neonMaxCu: 8,
    neonExistingEndpointOnly: true,
    providerEntitlementsAccepted: true,
    storageEgressBuildCostsAccepted: true,
    maxDeploymentAttempts: 3,
  },
});
function fixture() {
  let registry = JSON.parse(
      fs.readFileSync(
        new URL(
          "../../../Canon/registries/srm-environment-topology-v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
    state = {
      schemaVersion: "1.0",
      projectKey: "SRM",
      targetEnvironment: "staging",
      generation: 0,
      release: null,
      baseline: null,
    },
    head = "0".repeat(40),
    counter = 0;
  // Explicit pre-onboarding fixture; canonical live Stage can now be ACTIVE.
  registry.environments.staging = {
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
  const writes = [];
  let s = {
    source: "LIVE_PROVIDER_APIS",
    capturedAt: new Date().toISOString(),
    repository: { id: contract.repositoryId, full_name: contract.repository },
    renderProject: {
      id: contract.render.projectId,
      owner: { id: contract.render.workspaceId },
    },
    renderEnvironment: {
      id: contract.render.environmentId,
      projectId: contract.render.projectId,
      networkIsolationEnabled: true,
    },
    neonBranch: {
      id: contract.neon.branchId,
      project_id: contract.neon.projectId,
      name: "Staging",
      protected: false,
    },
    neonEndpoint: {
      id: contract.neon.endpointId,
      branch_id: contract.neon.branchId,
      host: contract.neon.directHost,
      autoscaling_limit_max_cu: 8,
    },
    databases: [],
    services: [],
    domains: [],
    liveDeploy: null,
    githubEnvironment: null,
  };
  const done = new Set();
  const p = {
    sourceProof: { source: "SYNTHETIC_ONLY", sha },
    store: {
      read: async () => ({
        head,
        state: structuredClone(state),
        registry: structuredClone(registry),
      }),
      commit: async ({ expectedHead, files }) => {
        assert.equal(expectedHead, head);
        if (files["Canon/registries/srm-staging-release-state-v1.json"])
          state = structuredClone(
            files["Canon/registries/srm-staging-release-state-v1.json"],
          );
        if (files["Canon/registries/srm-environment-topology-v1.json"])
          registry = structuredClone(
            files["Canon/registries/srm-environment-topology-v1.json"],
          );
        head = (++counter).toString(16).padStart(40, "0");
        return head;
      },
    },
    authority: async () => {},
    executorStopped: async () => false,
    snapshot: async () => ({
      ...structuredClone(s),
      capturedAt: new Date().toISOString(),
    }),
    preparationPreflight: async () => ({ source: "SYNTHETIC_ONLY" }),
    githubBindings: async () => {
      writes.push("github-bindings");
      done.add("github-bindings");
      return {};
    },
    githubEnvironment: async () => {
      writes.push("github-environment");
      s.githubEnvironment = { id: 1234, name: "srm-staging" };
      done.add("github-environment");
      return {};
    },
    pinSource: async () => {
      writes.push("release-pointer");
      done.add("release-pointer");
      return { pointer: releasePointer(sha) };
    },
    database: async () => {
      writes.push("database");
      s.databases = [
        {
          id: 4321,
          branch_id: contract.neon.branchId,
          name: "srm_app",
          owner_name: "neondb_owner",
        },
      ];
      done.add("database");
      return {};
    },
    schema: async () => {
      writes.push("schema");
      done.add("schema");
      return {};
    },
    service: async () => {
      writes.push("service");
      s.services = [
        {
          id: "srv-synthetic",
          name: "srm-staging-runtime",
          environmentId: contract.render.environmentId,
          branch: releasePointer(sha),
          autoDeployTrigger: "off",
          serviceDetails: { url: "https://synthetic.onrender.com" },
        },
      ];
      done.add("service");
      return {};
    },
    deploy: async () => {
      writes.push("deploy");
      s.liveDeploy = {
        id: "dep-synthetic",
        status: "live",
        commit: { id: sha },
      };
      done.add("deploy");
      return {};
    },
    rebind: async () => {
      writes.push("source-rebind");
      s.services[0].branch = "main";
      done.add("source-rebind");
      return {};
    },
    verify: async () => {
      done.add("verify");
      return {
        source: "LIVE_RUNTIME_AND_SQL",
        sha: s.liveDeploy.commit.id,
        deployId: s.liveDeploy.id,
        serviceId: s.services[0].id,
        branchId: contract.neon.branchId,
        databaseId: 4321,
        githubEnvironmentId: 1234,
        configuration: "PASS",
        githubProtection: "PASS",
        schema: "PASS",
        runtimeRole: "PASS",
        tenantIsolation: "PASS",
        health: "PASS",
        authentication: "PASS",
        persistence: "PASS",
        migrations: manifest.migrations,
      };
    },
    observe: async (op) => ({
      complete: done.has(op),
      result: { op },
      resources:
        op === "github-environment" && done.has(op)
          ? { githubEnvironmentId: 1234 }
          : op === "database" && done.has(op)
            ? { databaseId: 4321 }
            : op === "service" && done.has(op)
              ? { serviceId: "srv-synthetic" }
              : {},
    }),
  };
  return {
    p,
    writes,
    get state() {
      return state;
    },
    get registry() {
      return registry;
    },
    s,
    done,
  };
}
test("synthetic complete first onboarding publishes VERIFIED only after proof", async () => {
  const f = fixture();
  const r = await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  assert.equal(r.status, "VERIFIED");
  assert.equal(f.registry.environments.staging.status, "ACTIVE");
  assert.equal(f.state.baseline.sha, sha);
  assert.deepEqual(f.writes, [
    "github-environment",
    "github-bindings",
    "release-pointer",
    "database",
    "schema",
    "service",
    "deploy",
    "source-rebind",
  ]);
});
for (const op of operations.filter((x) => x !== "reconcile"))
  test(
    "interruption/retry after " +
      op +
      " keeps first source and avoids duplicate writes",
    async () => {
      const f = fixture();
      await assert.rejects(
        runLifecycle({
          authorization: approval(),
          manifest,
          provider: f.p,
          owner: "github-run:1",
          stopAfter: op,
        }),
      );
      assert.equal(f.registry.environments.staging.status, "RESERVED");
      const before = f.writes.length;
      await runLifecycle({
        authorization: approval(),
        manifest,
        provider: f.p,
        owner: "github-run:1",
      });
      assert.equal(
        f.writes.filter((x) => x === op).length,
        op === "verify" ? 0 : 1,
      );
      assert.ok(f.writes.length >= before);
    },
  );
test("normal promotion and compatible code rollback share lifecycle", async () => {
  const f = fixture();
  await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  const a = { ...approval("promote"), approvalId: "synthetic-second" };
  await runLifecycle({
    authorization: a,
    manifest,
    provider: f.p,
    owner: "github-run:2",
  });
  await runLifecycle({
    authorization: {
      ...approval("rollback"),
      approvalId: "synthetic-rollback",
    },
    manifest,
    provider: f.p,
    owner: "github-run:3",
  });
  assert.equal(f.writes.filter((x) => x === "service").length, 1);
});
test("no authorization reaches any provider write or journal claim", async () => {
  const f = fixture();
  await assert.rejects(
    runLifecycle({
      authorization: { ...approval(), stagingMutationsAllowed: false },
      manifest,
      provider: f.p,
      owner: "x",
    }),
  );
  assert.equal(f.state.generation, 0);
  assert.equal(f.writes.length, 0);
});
test("actual wrong first deployed SHA blocks activation", async () => {
  const f = fixture();
  const deploy = f.p.deploy;
  f.p.deploy = async () => {
    const x = await deploy();
    f.s.liveDeploy.commit.id = "b".repeat(40);
    return x;
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  assert.equal(f.registry.environments.staging.status, "RESERVED");
});
test("schema incompatibility blocks service creation", async () => {
  const f = fixture();
  f.p.schema = async () => {
    throw Error("checksum drift");
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  assert.ok(!f.writes.includes("service"));
});
test("ambiguous accepted create is observed safely on retry", async () => {
  const f = fixture();
  const create = f.p.service;
  f.p.service = async () => {
    await create();
    throw Error("lost provider response");
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  assert.equal(f.writes.filter((x) => x === "service").length, 1);
});
test("ambiguous absent create never retries blindly", async () => {
  const f = fixture();
  f.p.service = async () => {
    throw Error("network timeout");
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
    /Ambiguous provider/,
  );
  assert.equal(f.registry.environments.staging.status, "RESERVED");
});
test("incomplete live proof never activates target", async () => {
  const f = fixture();
  const verify = f.p.verify;
  f.p.verify = async () => ({ ...(await verify()), persistence: "PENDING" });
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  assert.equal(f.registry.environments.staging.status, "RESERVED");
});
test("wrong immutable provider identity rejects before write", async () => {
  const f = fixture();
  f.s.neonBranch.id = "br-nameless-bar-b1wlhjhx";
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  assert.equal(f.writes.length, 0);
});

import pg from "pg";
import { runMigrations, initializationConfig } from "./staging-migrate.mjs";
import {
  runPersistenceProbe,
  assertSchemaCatalog,
  renderServicePayload,
  verifyLifecycleSource,
  githubStore,
} from "./staging-lifecycle.mjs";
test("resume after lost final acknowledgement performs no further provider writes", async () => {
  const f = fixture();
  await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  const n = f.writes.length;
  const result = await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  assert.equal(result.recovered, true);
  assert.equal(f.writes.length, n);
});
test("concurrent promotion is rejected before provider mutation", async () => {
  const f = fixture();
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
      stopAfter: "database",
    }),
  );
  const n = f.writes.length;
  await assert.rejects(
    runLifecycle({
      authorization: { ...approval(), approvalId: "other" },
      manifest,
      provider: f.p,
      owner: "github-run:2",
    }),
    /Concurrent/,
  );
  assert.equal(f.writes.length, n);
});
test("baseline compare-and-swap conflict preserves RESERVED and observed live evidence", async () => {
  const f = fixture();
  const commit = f.p.store.commit;
  f.p.store.commit = async (x) => {
    if (x.files["Canon/registries/srm-environment-topology-v1.json"])
      throw Error("baseline conflict");
    return commit(x);
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
    /conflict/,
  );
  assert.equal(f.registry.environments.staging.status, "RESERVED");
  assert.equal(f.s.liveDeploy.commit.id, sha);
  f.p.store.commit = commit;
  await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  assert.equal(f.writes.filter((x) => x === "deploy").length, 1);
});
test("drift after baseline publication never reports success", async () => {
  const f = fixture();
  const snapshot = f.p.snapshot;
  f.p.snapshot = async () => {
    const s = await snapshot();
    if (f.state.release?.phase === "VERIFIED")
      s.liveDeploy.commit.id = "c".repeat(40);
    return s;
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
    /drift after publication/,
  );
});
test("normal promotion rejects stale baseline before any provider action", async () => {
  const f = fixture();
  await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  f.s.liveDeploy.id = "dep-foreign";
  const n = f.writes.length;
  await assert.rejects(
    runLifecycle({
      authorization: { ...approval("promote"), approvalId: "new" },
      manifest,
      provider: f.p,
      owner: "github-run:2",
    }),
    /baseline drift/,
  );
  assert.equal(f.writes.length, n);
});
test("wrong canonical project blocks even with valid provider IDs", async () => {
  const f = fixture();
  const read = f.p.store.read;
  f.p.store.read = async () => {
    const x = await read();
    x.registry.environments.staging.neon.projectId = "sg2";
    return x;
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
    /routing/,
  );
  assert.equal(f.writes.length, 0);
});
test("moving main cannot alter first creation payload source", () => {
  const p = renderServicePayload(manifest, {}, "approval");
  assert.equal(p.branch, "srm-release-" + sha);
  assert.equal(p.autoDeployTrigger, "off");
  assert.equal(p.environmentId, contract.render.environmentId);
  assert.equal(p.serviceDetails.runtime, "node");
  assert.equal(p.serviceDetails.numInstances, 1);
  assert.equal(p.serviceDetails.previews.generation, "off");
  assert.equal(
    p.serviceDetails.envSpecificDetails.buildCommand,
    contract.render.buildCommand,
  );
  assert.equal(
    p.envVars.find((x) => x.key === "SRM_RELEASE_OPERATION_ID").value,
    "approval",
  );
  assert.throws(() =>
    renderServicePayload({ ...manifest, sha: "main" }, {}, "approval"),
  );
});
test("source preflight permits moving main business code but rejects changed mechanism", () => {
  const calls = [];
  const git = (a) => {
    calls.push(a);
    if (a[0] === "remote")
      return { status: 0, stdout: "https://github.com/" + contract.repository };
    if (a[0] === "show")
      return {
        status: 0,
        stdout: JSON.stringify({
          ...contract,
          lifecycle: undefined,
          deploymentTimeGates: ["old-only"],
          github: { ...contract.github, soloOperatorApproval: undefined },
        }),
      };
    return { status: 0, stdout: "" };
  };
  assert.equal(verifyLifecycleSource(sha, git), true);
  assert.ok(calls.some((x) => x[0] === "merge" && x[1] === "--ff-only"));
  assert.throws(
    () =>
      verifyLifecycleSource(sha, (a) =>
        a[0] === "diff" && a[2] === "HEAD" ? { status: 1, stdout: "" } : git(a),
      ),
    /mechanism changed/,
  );
  assert.throws(
    () =>
      verifyLifecycleSource(sha, (a) =>
        a[0] === "merge-base" ? { status: 1, stdout: "" } : git(a),
      ),
    /authority main/,
  );
});
test("changed approval policy invalidates the old release manifest authorization",async()=>{
  const oldContract=structuredClone(contract);delete oldContract.github.soloOperatorApproval;
  const oldManifest={...manifest,contractDigest:digest(oldContract)};
  const a={...approval("promote"),manifest:oldManifest,manifestDigest:digest(oldManifest)};
  const f=fixture();
  await assert.rejects(runLifecycle({authorization:a,manifest,provider:f.p,owner:"github-run:solo-test"}),/immutable manifest/);
  assert.equal(f.writes.length,0);
});
test("the live provider adapter accepts exact owner review and never changes existing GitHub protection",async()=>{
  const ge={id:23853126630,name:"srm-staging",protection_rules:[{type:"required_reviewers",prevent_self_review:false,reviewers:[{type:"User",reviewer:{id:275643368,login:"profitia"}}]}],deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}};
  const calls=[];
  const provider=createProvider({SRM_RELEASE_GITHUB_TOKEN:"synthetic-only"},approval("promote"),manifest,"github-run:solo-test",async(url,options)=>{
    calls.push({url,method:options.method});
    return new Response(JSON.stringify(url.includes("deployment-branch-policies")?{total_count:1,branch_policies:[{name:"main",type:"branch"}]}:ge),{status:200});
  });
  assert.deepEqual(await provider.githubEnvironment({githubEnvironment:ge},approval("promote")),{protected:true});
  assert.ok(calls.length>0&&calls.every(x=>x.method==="GET"));
});
test("live provider adapter still rejects non-main deployment branch rules",async()=>{
  const ge={id:23853126630,name:"srm-staging",protection_rules:[{type:"required_reviewers",prevent_self_review:false,reviewers:[{type:"User",reviewer:{id:275643368,login:"profitia"}}]}],deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}};
  const provider=createProvider({SRM_RELEASE_GITHUB_TOKEN:"synthetic-only"},approval("promote"),manifest,"github-run:solo-test",async(url)=>new Response(JSON.stringify(url.includes("deployment-branch-policies")?{total_count:1,branch_policies:[{name:"other",type:"branch"}]}:ge),{status:200}));
  await assert.rejects(provider.githubEnvironment({githubEnvironment:ge},approval("promote")),/Main-only/);
});
test("malformed protected authority evidence fails closed without writes", async () => {
  const calls = [];
  const store = githubStore(async (base, url, method = "GET") => {
    calls.push(method);
    return { protected: true, commit: { sha } };
  });
  await assert.rejects(store.read(), /Incomplete authority tree/);
  assert.deepEqual(calls, ["GET", "GET"]);
});
test(
  "real isolated Postgres persistence, idempotency and FORCE RLS catalog",
  { skip: !process.env.SRM_MIGRATION_TEST_URL },
  async () => {
    const u = new URL(process.env.SRM_MIGRATION_TEST_URL);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(u.hostname) &&
        u.pathname === "/srm_migration_test",
      "Disposable localhost database required",
    );
    const c = new pg.Client({ connectionString: u.toString() });
    await c.connect();
    let runtime;
    try {
      await c.query("DROP SCHEMA IF EXISTS srm CASCADE");
      await c.query("DROP ROLE IF EXISTS srm_app_runtime");
      const initialize = initializationConfig({
        SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
        SRM_APP_DATABASE_PASSWORD: "isolated-local-probe-password-only-32plus",
      });
      await runMigrations(c, { initialize });
      await assertSchemaCatalog(c);
      const ru = new URL(u);
      ru.username = "srm_app_runtime";
      ru.password = initialize.password;
      runtime = new pg.Client({ connectionString: ru.toString() });
      await runtime.connect();
      await assert.rejects(
        runPersistenceProbe(runtime, initialize.organizationId, "probe", false),
        /Durable probe absent/,
      );
      const first = await runPersistenceProbe(
        runtime,
        initialize.organizationId,
        "probe",
        true,
      );
      const again = await runPersistenceProbe(
        runtime,
        initialize.organizationId,
        "probe",
        true,
      );
      assert.equal(first.recordId, again.recordId);
      assert.equal(
        (await runPersistenceProbe(runtime, initialize.organizationId, "probe"))
          .persisted,
        true,
      );
      await c.query(
        "ALTER TABLE srm.lookup_requests NO FORCE ROW LEVEL SECURITY",
      );
      await assert.rejects(assertSchemaCatalog(c), /FORCE RLS drift/);
      await c.query("ALTER TABLE srm.lookup_requests FORCE ROW LEVEL SECURITY");
      await assertSchemaCatalog(c);
    } finally {
      if (runtime) await runtime.end();
      await c.end();
    }
  },
);

import { deployRetryEvidence } from "./staging-lifecycle.mjs";
test("terminal provider failure permits bounded retry; ambiguous absence and budget exhaustion do not", () => {
  const a = approval(),
    failed = { id: "dep-failed", status: "build_failed", commit: { id: sha } };
  assert.equal(deployRetryEvidence([failed], manifest, a).recoverable, true);
  assert.equal(deployRetryEvidence([], manifest, a).recoverable, false);
  assert.equal(
    deployRetryEvidence([failed, failed, failed], manifest, a).canCreate,
    false,
  );
  assert.throws(
    () =>
      deployRetryEvidence(
        [{ status: "build_in_progress", commit: { id: "b".repeat(40) } }],
        manifest,
        a,
      ),
    /Concurrent foreign/,
  );
});
test("partial GitHub environment and failed schema action resume safely", async () => {
  const f = fixture();
  const action = f.p.schema;
  let attempts = 0;
  f.p.schema = async () => {
    if (++attempts === 1) throw Error("transaction rolled back");
    return action();
  };
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
  );
  await runLifecycle({
    authorization: approval(),
    manifest,
    provider: f.p,
    owner: "github-run:1",
  });
  assert.equal(attempts, 2);
  assert.equal(f.writes.filter((x) => x === "github-environment").length, 1);
});
test("automatic staging deployment is absent on push and pull request", () => {
  const y = fs.readFileSync(
    new URL("../../../.github/workflows/srm-ci.yml", import.meta.url),
    "utf8",
  );
  const blocks = y.split("  srm-staging-").slice(1);
  assert.equal(blocks.length, 2);
  for (const b of blocks)
    assert.ok(
      b.includes(
        "if: github.event_name == 'workflow_dispatch' && inputs.staging_deployment_authorized == 'YES'",
      ),
    );
  assert.equal(contract.render.autoDeployTrigger, "off");
});

import { assertLifecycleService } from "./staging-lifecycle.mjs";
test("service verification rejects unbudgeted scaling, disk and wrong name", () => {
  const c = contract.render;
  const s = {
    ownerId: c.workspaceId,
    environmentId: c.environmentId,
    repo: "https://github.com/" + contract.repository,
    autoDeployTrigger: "off",
    branch: "main",
    rootDir: c.rootDir,
    type: "web_service",
    name: c.serviceName,
    suspended: "not_suspended",
    serviceDetails: {
      region: c.region,
      plan: c.plan,
      runtime: "node",
      numInstances: 1,
      healthCheckPath: c.healthCheckPath,
      envSpecificDetails: {
        buildCommand: c.buildCommand,
        startCommand: c.startCommand,
      },
      previews: { generation: "off" },
    },
  };
  assert.equal(assertLifecycleService(s, manifest), true);
  for (const change of [
    { name: "foreign" },
    { serviceDetails: { ...s.serviceDetails, disk: { id: "disk-x" } } },
    { serviceDetails: { ...s.serviceDetails, autoscaling: { enabled: true } } },
    { suspended: "suspended" },
  ])
    assert.throws(() => assertLifecycleService({ ...s, ...change }, manifest));
});
test("missing source proof stops before the ownership publication", async () => {
  const f = fixture();
  delete f.p.sourceProof;
  await assert.rejects(
    runLifecycle({
      authorization: approval(),
      manifest,
      provider: f.p,
      owner: "github-run:1",
    }),
    /source evidence/,
  );
  assert.equal(f.state.generation, 0);
  assert.equal(f.writes.length, 0);
});

import { assertDeploymentInventory } from "./staging-lifecycle.mjs";
test("ambiguous or foreign inflight deployment blocks before any schema write", () => {
  assert.equal(assertDeploymentInventory([], sha), null);
  assert.equal(
    assertDeploymentInventory(
      [{ id: "live", status: "live", commit: { id: sha } }],
      sha,
    ).id,
    "live",
  );
  assert.throws(() =>
    assertDeploymentInventory([{ status: "live" }, { status: "live" }], sha),
  );
  for (const status of [
    "created",
    "queued",
    "build_in_progress",
    "pre_deploy_in_progress",
    "update_in_progress",
  ])
    assert.throws(() =>
      assertDeploymentInventory(
        [{ status, commit: { id: "b".repeat(40) } }],
        sha,
      ),
    );
});

import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import {
  publicationFiles,
  assertApprovedRuntimeUrl,
} from "./staging-lifecycle.mjs";
const journalPath = "Canon/registries/srm-staging-release-state-v1.json";
const registryPath = "Canon/registries/srm-environment-topology-v1.json";
test("runtime verification accepts only the explicitly approved Staging URL", () => {
  assert.doesNotThrow(() =>
    assertApprovedRuntimeUrl("https://srm-staging-runtime.onrender.com"),
  );
  for (const url of [
    "https://srm-development-runtime.onrender.com",
    "https://srm-staging-runtime-other.onrender.com",
    "http://srm-staging-runtime.onrender.com",
    "https://example.invalid",
    undefined,
  ])
    assert.throws(
      () => assertApprovedRuntimeUrl(url),
      /approved Staging runtime URL/,
    );
});
function publicationFixture({
  protectedMain = true,
  ciFailure = false,
  pending = false,
} = {}) {
  let head = "0".repeat(40),
    state = { schemaVersion: "1.0", generation: 0 },
    registry = { projectKey: "SRM" },
    candidateFiles = null,
    pr = null;
  const calls = [],
    blobs = new Map(),
    candidate = "1".repeat(40),
    merge = "2".repeat(40);
  let ref = null;
  const request = async (base, url, method = "GET", body) => {
    calls.push({ url, method, body });
    if (url.endsWith("/branches/main"))
      return { protected: protectedMain, commit: { sha: head } };
    if (url.includes("/git/trees/")) {
      const entries = [
        [journalPath, state],
        [registryPath, registry],
      ].map(([path, value]) => {
        const sha = digest(value);
        blobs.set(sha, value);
        return { path, sha, type: "blob" };
      });
      return { tree: entries, truncated: false };
    }
    if (url.includes("/git/blobs/"))
      return {
        content: Buffer.from(
          JSON.stringify(blobs.get(url.split("/").at(-1))),
        ).toString("base64"),
      };
    if (url === "/repos/profitia/SG-dev")
      return {
        id: contract.repositoryId,
        full_name: contract.repository,
        allow_merge_commit: true,
      };
    if (url.includes("/git/ref/heads/")) return ref;
    if (url.endsWith("/git/refs") && method === "POST") {
      ref = { object: { sha: body.sha } };
      return ref;
    }
    if (url === "/graphql") {
      assert.equal(body.variables.input.expectedHeadOid, head);
      candidateFiles = Object.fromEntries(
        body.variables.input.fileChanges.additions.map((f) => [
          f.path,
          JSON.parse(Buffer.from(f.contents, "base64").toString()),
        ]),
      );
      if (!protectedMain) {
        state = candidateFiles[journalPath];
        head = candidate;
      } else ref = { object: { sha: candidate } };
      return { data: { createCommitOnBranch: { commit: { oid: candidate } } } };
    }
    if (url.includes("/pulls?")) return pr ? [pr] : [];
    if (url.includes("/compare/"))
      return {
        status: "ahead",
        ahead_by: 1,
        base_commit: { sha: "0".repeat(40) },
        files: Object.keys(candidateFiles).map((filename) => ({
          filename,
          status: "modified",
        })),
      };
    if (url.includes("/contents/")) {
      const path = url.split("/contents/")[1].split("?")[0];
      return {
        encoding: "base64",
        content: Buffer.from(JSON.stringify(candidateFiles[path])).toString(
          "base64",
        ),
      };
    }
    if (url.endsWith("/pulls") && method === "POST") {
      pr = {
        number: 42,
        html_url: "https://github.com/profitia/SG-dev/pull/42",
        state: "open",
        head: { sha: candidate, repo: { id: contract.repositoryId } },
        base: { ref: "main" },
      };
      return pr;
    }
    if (url.includes("/check-runs?")) {
      if (fixture.onChecks) fixture.onChecks();
      return {
        total_count: fixture.pending ? 0 : 2,
        check_runs: fixture.pending
          ? []
          : ["srm-build", "governance"].map((name, i) => ({
              id: i + 1,
              name,
              head_sha: candidate,
              status: "completed",
              conclusion: ciFailure ? "failure" : "success",
            })),
      };
    }
    if (url.endsWith("/pulls/42/merge") && method === "PUT") {
      assert.equal(body.sha, candidate);
      assert.equal(body.merge_method, "merge");
      state = candidateFiles[journalPath];
      registry = candidateFiles[registryPath] ?? registry;
      head = merge;
      pr.merged_at = new Date().toISOString();
      return { merged: true, sha: merge };
    }
    throw Error("Unexpected provider fixture request: " + method + " " + url);
  };
  const fixture = {
    request,
    calls,
    pending,
    get state() {
      return state;
    },
    get head() {
      return head;
    },
    moveMain() {
      head = "3".repeat(40);
    },
    changeJournal() {
      state = {
        ...state,
        generation: state.generation + 1,
        publicationNonce: "foreign",
      };
      head = "4".repeat(40);
    },
    changeRegistry() {
      registry = { ...registry, changed: true };
      head = "5".repeat(40);
    },
  };
  return fixture;
}
test("protected main publishes a fenced journal through a checked PR without protection writes", async () => {
  const f = publicationFixture(),
    store = githubStore(f.request),
    current = await store.read();
  await store.commit({
    expectedHead: current.head,
    files: { [journalPath]: { ...current.state, generation: 1 } },
    message: "test release intent",
  });
  assert.equal(f.state.generation, 1);
  assert.match(f.state.publicationNonce, /^[a-f0-9]{64}$/);
  assert.ok(f.calls.some((x) => x.url.endsWith("/pulls/42/merge")));
  assert.ok(
    !f.calls.some(
      (x) => /protection|rulesets/.test(x.url) && x.method !== "GET",
    ),
  );
  assert.ok(
    f.calls
      .filter((x) => x.url === "/graphql")
      .every((x) =>
        x.body.variables.input.branch.branchName.startsWith("srm-publication-"),
      ),
  );
});
test("protected publication preserves unrelated movement of main", async () => {
  const f = publicationFixture(),
    store = githubStore(f.request),
    current = await store.read();
  f.onChecks = () => f.moveMain();
  await store.commit({
    expectedHead: current.head,
    files: { [journalPath]: { ...current.state, generation: 1 } },
    message: "intent",
  });
  assert.equal(f.state.generation, 1);
});
for (const mutation of ["changeJournal", "changeRegistry"])
  test("protected publication refuses concurrent " + mutation, async () => {
    const f = publicationFixture(),
      store = githubStore(f.request),
      current = await store.read();
    f.onChecks = () => f[mutation]();
    await assert.rejects(
      store.commit({
        expectedHead: current.head,
        files: { [journalPath]: { ...current.state, generation: 1 } },
        message: "intent",
      }),
      /publication conflict/,
    );
    assert.ok(!f.calls.some((x) => x.url.endsWith("/merge")));
  });
test("failed publication CI keeps its PR and never merges", async () => {
  const f = publicationFixture({ ciFailure: true }),
    store = githubStore(f.request),
    current = await store.read();
  await assert.rejects(
    store.commit({
      expectedHead: current.head,
      files: { [journalPath]: { ...current.state, generation: 1 } },
      message: "intent",
    }),
    /CI failed/,
  );
  assert.equal(f.state.generation, 0);
  assert.ok(!f.calls.some((x) => x.url.endsWith("/merge")));
});
test("pending publication CI times out with the PR preserved", async () => {
  let time = 0;
  const f = publicationFixture({ pending: true });
  const store = githubStore(f.request, {
    now: () => time,
    pause: async () => {
      time++;
    },
    checkTimeoutMs: 2,
  });
  const current = await store.read();
  await assert.rejects(
    store.commit({
      expectedHead: current.head,
      files: { [journalPath]: { ...current.state, generation: 1 } },
      message: "intent",
    }),
    /CI pending/,
  );
  assert.equal(f.state.generation, 0);
  assert.ok(
    f.calls.some((x) => x.url.endsWith("/pulls") && x.method === "POST"),
  );
  f.pending = false;
  await store.commit({
    expectedHead: current.head,
    files: { [journalPath]: { ...current.state, generation: 1 } },
    message: "intent",
  });
  assert.equal(f.state.generation, 1);
  assert.equal(
    f.calls.filter((x) => x.url.endsWith("/pulls") && x.method === "POST")
      .length,
    1,
  );
  assert.equal(f.calls.filter((x) => x.url === "/graphql").length, 1);
});
test("unprotected publication retains exact expected-head CAS", async () => {
  const f = publicationFixture({ protectedMain: false }),
    store = githubStore(f.request),
    current = await store.read();
  f.moveMain();
  await assert.rejects(
    store.commit({
      expectedHead: current.head,
      files: { [journalPath]: { ...current.state, generation: 1 } },
      message: "intent",
    }),
    /Baseline update conflict/,
  );
  assert.ok(f.calls.every((x) => x.method === "GET"));
});
test("publication rejects missing journal, skipped generation and unrelated files", async () => {
  const f = publicationFixture(),
    store = githubStore(f.request),
    current = await store.read();
  for (const files of [
    { [registryPath]: {} },
    { [journalPath]: { generation: 2 } },
    { "apps/srm/src/business.ts": {} },
  ])
    await assert.rejects(
      store.commit({ expectedHead: current.head, files, message: "intent" }),
    );
  assert.ok(f.calls.every((x) => x.method === "GET"));
});
test("real Git three-way merge rejects racing journal proposals and preserves unrelated development", () => {
  const dir = fs.mkdtempSync(os.tmpdir() + "/srm-publication-git-");
  const git = (args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    git(["init", "--initial-branch=main"]);
    git(["config", "user.name", "SRM isolated test"]);
    git(["config", "user.email", "test@example.invalid"]);
    const f = dir + "/journal.json";
    const initial = {
      publicationNonce: "initial",
      schemaVersion: "1.0",
      generation: 0,
    };
    fs.writeFileSync(f, JSON.stringify(initial, null, 2) + "\n");
    git(["add", "."]);
    git(["commit", "-m", "base"]);
    const base = git(["rev-parse", "HEAD"]),
      current = { state: initial };
    const proposals = ["first", "second"].map(
      (owner) =>
        publicationFiles(
          current,
          { [journalPath]: { ...initial, generation: 1, owner } },
          base,
        )[journalPath],
    );
    assert.notEqual(
      proposals[0].publicationNonce,
      proposals[1].publicationNonce,
    );
    git(["switch", "-c", "proposal"]);
    fs.writeFileSync(f, JSON.stringify(proposals[0], null, 2) + "\n");
    git(["commit", "-am", "proposal one"]);
    git(["switch", "main"]);
    fs.writeFileSync(dir + "/unrelated.txt", "parallel development\n");
    git(["add", "."]);
    git(["commit", "-m", "unrelated development"]);
    git(["merge", "--no-ff", "proposal", "-m", "lawful publication"]);
    assert.equal(
      fs.readFileSync(dir + "/unrelated.txt", "utf8"),
      "parallel development\n",
    );
    git(["switch", "-c", "stale", base]);
    fs.writeFileSync(f, JSON.stringify(proposals[1], null, 2) + "\n");
    git(["commit", "-am", "proposal two"]);
    git(["switch", "main"]);
    const rejected = spawnSync(
      "git",
      ["merge", "--no-ff", "stale", "-m", "must conflict"],
      { cwd: dir, encoding: "utf8" },
    );
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stdout, /CONFLICT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
