import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  runLifecycle,
  manifestFrom,
  releasePointer,
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
test("protected authority main blocks publication without weakening protection", async () => {
  const calls = [];
  const store = githubStore(async (base, url, method = "GET") => {
    calls.push(method);
    return { protected: true, commit: { sha } };
  });
  await assert.rejects(store.read(), /Protected main/);
  assert.deepEqual(calls, ["GET"]);
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
