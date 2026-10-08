import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertLifecycleAuthorization,
  assertSnapshot,
  claimRelease,
  digest,
  operations,
  casPublish,
} from "./srm-release-lifecycle.mjs";
const c = JSON.parse(
  fs.readFileSync("apps/srm/deployment/staging-contract.json", "utf8"),
);
const m = {
  projectKey: "SRM",
  targetEnvironment: "staging",
  repository: c.repository,
  sha: "a".repeat(40),
  source: {
    repositoryId: c.repositoryId,
    approvedMainAncestor: true,
    ciPassed: true,
    developmentLiveSha: "a".repeat(40),
  },
  migrations: [{ version: "0001", checksum: "b".repeat(64) }],
};
const approval = () => ({
  schemaVersion: "2.0",
  projectKey: "SRM",
  targetEnvironment: "staging",
  stagingDeploymentAuthorized: true,
  stagingMutationsAllowed: true,
  productionMutationsAllowed: false,
  releaseSha: m.sha,
  manifestDigest: digest(m),
  repository: c.repository,
  repositoryId: c.repositoryId,
  renderWorkspaceId: c.render.workspaceId,
  renderProjectId: c.render.projectId,
  renderEnvironmentId: c.render.environmentId,
  neonProjectId: c.neon.projectId,
  neonBranchId: c.neon.branchId,
  neonEndpointId: c.neon.endpointId,
  databaseName: "srm_app",
  approvalId: "future-approved-test",
  approvedBy: "synthetic-test",
  costOwner: "synthetic-test",
  costEvidence: {
    source: "PRIMARY_PROVIDER_QUOTE",
    url: "https://render.com/pricing",
    verifiedAt: new Date().toISOString(),
    monthlyComputeUsd: 7,
  },
  operations,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  mode: "onboard",
  firstOnboardingAuthorized: true,
  githubReviewerIds: [123],
  budget: {
    renderPlan: c.render.plan,
    renderInstances: 1,
    renderMonthlyComputeUsd: 7,
    neonMaxCu: 8,
    neonExistingEndpointOnly: true,
    providerEntitlementsAccepted: true,
    storageEgressBuildCostsAccepted: true,
    maxDeploymentAttempts: 3,
  },
});
test("narrow future first-onboarding authorization passes", () =>
  assert.equal(assertLifecycleAuthorization(approval(), m, c), true));
for (const [key, value] of Object.entries({
  projectKey: "SG2",
  targetEnvironment: "production",
  stagingDeploymentAuthorized: false,
  stagingMutationsAllowed: false,
  productionMutationsAllowed: true,
  releaseSha: "c".repeat(40),
  manifestDigest: "manual-sha",
  repositoryId: 1,
  renderWorkspaceId: "other",
  renderProjectId: "other",
  renderEnvironmentId: "production",
  neonProjectId: "bold-breeze-68888550",
  neonBranchId: "br-nameless-bar-b1wlhjhx",
  neonEndpointId: "other",
  databaseName: "srm_pmos",
  approvedBy: null,
  costOwner: null,
  operations: ["reset"],
  expiresAt: "2000-01-01",
  mode: "production",
  firstOnboardingAuthorized: false,
  githubReviewerIds: [],
  budget: {},
}))
  test("fail closed " + key, () =>
    assert.throws(() =>
      assertLifecycleAuthorization({ ...approval(), [key]: value }, m, c),
    ),
  );
test("concurrent promotion and expired executor cannot take lease", () => {
  const s = {
    schemaVersion: "1.0",
    projectKey: "SRM",
    targetEnvironment: "staging",
    generation: 0,
    release: null,
  };
  const a = approval(),
    j = claimRelease(s, a, m, "github-run:1");
  assert.throws(() => claimRelease(j, a, m, "github-run:2"));
  assert.throws(() =>
    claimRelease(j, { ...a, approvalId: "different" }, m, "github-run:1"),
  );
  assert.equal(
    claimRelease(j, a, m, "github-run:2", true).release.owner,
    "github-run:2",
  );
});
test("CAS never publishes stale or concurrent baseline", async () => {
  let head = "a".repeat(40);
  const store = {
    read: async () => ({ head }),
    commit: async (x) => {
      assert.equal(x.expectedHead, head);
      head = "b".repeat(40);
      return head;
    },
  };
  await casPublish(store, head, {}, "test");
  await assert.rejects(casPublish(store, "a".repeat(40), {}, "stale"));
});
test("ordinary ACTIVE gate retains RESERVED rejection", async () => {
  const { resolveEnvironmentProfile } = await import(
    "./environment-profile.mjs"
  );
  assert.throws(
    () =>
      resolveEnvironmentProfile({
        profile: {
          projectKey: "SRM",
          repository: {
            environmentTopologyRegistry:
              "Canon/registries/srm-environment-topology-v1.json",
          },
        },
        targetEnvironment: "staging",
        governanceRoot: process.cwd(),
      }),
    /not ACTIVE/,
  );
});
