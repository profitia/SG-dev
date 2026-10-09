import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertProductSecretIsolation,
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
  const { resolveEnvironmentProfile } =
    await import("./environment-profile.mjs");
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

test("negative generation and unknown lifecycle phase fail closed", () => {
  const s = {
    schemaVersion: "1.0",
    projectKey: "SRM",
    targetEnvironment: "staging",
    generation: -1,
    release: null,
    baseline: null,
  };
  assert.throws(() => claimRelease(s, approval(), m, "test"));
  assert.throws(() =>
    claimRelease(
      { ...s, generation: 0, release: { phase: "UNREVIEWED" } },
      approval(),
      m,
      "test",
    ),
  );
});

const supplierNow = Date.parse('2026-10-10T00:00:00Z');
function supplierBindings() {
  const development = Object.fromEntries(c.requiredSecrets.map(k => [k, 'synthetic-development-' + k]));
  const values = Object.fromEntries(c.requiredSecrets.map(k => [k, 'synthetic-staging-' + k]));
  values.TARGET_ENVIRONMENT = 'staging';
  for (const k of ['MGBI_API_KEY', 'VERCLY_API_KEY', 'CEIDG_API_KEY']) values[k] = development[k];
  return { development, values };
}
test('owner-approved three supplier keys may be shared in exact SRM Staging only', () => {
  const {values, development} = supplierBindings();
  assert.equal(assertProductSecretIsolation(c, values, development, supplierNow), true);
});
test('fully isolated product secrets work without an exception or after its expiry', () => {
  const {values, development} = supplierBindings();
  for (const k of c.requiredSecrets) values[k] = 'isolated-stage-' + k;
  assert.equal(assertProductSecretIsolation({...c, vendorCredentialReuse:null}, values, development, supplierNow), true);
  assert.equal(assertProductSecretIsolation(c, values, development, Date.parse('2027-01-01')), true);
});
for (const key of ['SRM_APP_DATABASE_PASSWORD', 'SRM_DEMO_PASSWORD', 'SRM_DEMO_SESSION_SECRET']) {
  test('supplier approval never permits sharing ' + key, () => {
    const {values, development} = supplierBindings(); values[key] = development[key];
    assert.throws(() => assertProductSecretIsolation(c, values, development, supplierNow));
  });
}
for (const [field, value] of Object.entries({id:'other',projectKey:'SG2',targetEnvironment:'production',sourceEnvironment:'staging',owner:'other',approvedBy:null,approvalSource:'ENV_OVERRIDE',repository:'profitia/other',repositoryId:1,developmentServiceId:'other',renderEnvironmentId:'production',neonProjectId:'bold-breeze-68888550',neonBranchId:'br-nameless-bar-b1wlhjhx',approvedAt:'2026-10-11',expiresAt:'2026-11-10',sharedSecretNames:['MGBI_API_KEY','VERCLY_API_KEY','CEIDG_API_KEY','SRM_APP_DATABASE_PASSWORD'],rollback:'',monitoring:'',expiryAction:''})) {
  test('invalid supplier exception fails closed: ' + field, () => {
    const {values, development} = supplierBindings();
    assert.throws(() => assertProductSecretIsolation({...c,vendorCredentialReuse:{...c.vendorCredentialReuse,[field]:value}},values,development,supplierNow));
  });
}
test('missing canonical exception cannot be replaced by operator environment variables', () => {
  const {values,development} = supplierBindings(); values.SRM_ALLOW_SHARED_SECRETS='true';
  assert.throws(() => assertProductSecretIsolation({...c,vendorCredentialReuse:null},values,development,supplierNow));
});
test('shared supplier approval expires exactly at its recorded deadline', () => {
  const {values,development} = supplierBindings();
  assert.throws(() => assertProductSecretIsolation(c,values,development,Date.parse(c.vendorCredentialReuse.expiresAt)));
});
test('missing Development comparison and empty Stage credentials fail closed', () => {
  const {values,development} = supplierBindings();
  assert.throws(() => assertProductSecretIsolation(c,values,{...development,MGBI_API_KEY:undefined},supplierNow));
  assert.throws(() => assertProductSecretIsolation(c,{...values,MGBI_API_KEY:''},development,supplierNow));
});
for (const environment of ['development','production']) test('supplier exception cannot target ' + environment, () => {
  const {values,development}=supplierBindings();
  assert.throws(() => assertProductSecretIsolation(c,{...values,TARGET_ENVIRONMENT:environment},development,supplierNow));
});
for (const [field,value] of Object.entries({projectKey:'CIC',repository:'profitia/other',repositoryId:1})) test('foreign product identity rejects supplier sharing: ' + field, () => {
  const {values,development}=supplierBindings();
  assert.throws(() => assertProductSecretIsolation({...c,[field]:value},values,development,supplierNow));
});
