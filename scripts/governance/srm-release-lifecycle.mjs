import { createHash } from "node:crypto";
import {
  compareProviderSnapshot,
  validateEnvironmentTopology,
} from "./environment-profile.mjs";
export const statePath = "Canon/registries/srm-staging-release-state-v1.json";
export const topologyPath = "Canon/registries/srm-environment-topology-v1.json";
export const operations = [
  "github-environment",
  "github-bindings",
  "release-pointer",
  "database",
  "schema",
  "service",
  "deploy",
  "source-rebind",
  "verify",
  "reconcile",
];
export const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requireFact = (ok, message) => {
  if (!ok) throw Error(message);
};
export function assertLifecycleAuthorization(a, m, c, now = Date.now()) {
  requireFact(
    a?.schemaVersion === "2.0" &&
      a.projectKey === "SRM" &&
      a.targetEnvironment === "staging" &&
      a.stagingDeploymentAuthorized === true &&
      a.stagingMutationsAllowed === true &&
      a.productionMutationsAllowed === false,
    "Explicit SRM Staging lifecycle authorization required",
  );
  requireFact(
    m?.projectKey === "SRM" &&
      m.targetEnvironment === "staging" &&
      /^[a-f0-9]{40}$/.test(m.sha) &&
      m.repository === c.repository &&
      a.releaseSha === m.sha &&
      a.manifestDigest === digest(m),
    "Approved immutable manifest required",
  );
  requireFact(
    a.repository === c.repository &&
      a.repositoryId === c.repositoryId &&
      a.renderWorkspaceId === c.render.workspaceId &&
      a.renderProjectId === c.render.projectId &&
      a.renderEnvironmentId === c.render.environmentId &&
      a.neonProjectId === c.neon.projectId &&
      a.neonBranchId === c.neon.branchId &&
      a.neonEndpointId === c.neon.endpointId &&
      a.databaseName === "srm_app",
    "Authorization resource identity mismatch",
  );
  requireFact(
    a.approvalId &&
      a.approvedBy &&
      a.costOwner &&
      Number.isFinite(Date.parse(a.expiresAt)) &&
      Date.parse(a.expiresAt) > now &&
      Date.parse(a.expiresAt) - now <= 86400000,
    "Approval expired or owner missing",
  );
  requireFact(
    Array.isArray(a.operations) &&
      a.operations.length === operations.length &&
      operations.every((x) => a.operations.includes(x)),
    "Bounded operation authorization required",
  );
  requireFact(
    a.budget?.renderPlan === c.render.plan &&
      a.budget.renderInstances === 1 &&
      a.budget.renderMonthlyComputeUsd >= c.render.estimatedMonthlyComputeUsd &&
      a.budget.renderMonthlyComputeUsd <= 7 &&
      a.budget.neonMaxCu > 0 &&
      a.budget.neonMaxCu <= 8 &&
      a.budget.neonExistingEndpointOnly === true &&
      a.budget.providerEntitlementsAccepted === true &&
      a.budget.storageEgressBuildCostsAccepted === true &&
      Number.isSafeInteger(a.budget.maxDeploymentAttempts) &&
      a.budget.maxDeploymentAttempts >= 1 &&
      a.budget.maxDeploymentAttempts <= 3,
    "Explicit cost envelope required",
  );
  requireFact(
    m.migrations?.length > 0 &&
      m.migrations.every(
        (x) =>
          typeof x.version === "string" && /^[a-f0-9]{64}$/.test(x.checksum),
      ),
    "Schema manifest missing",
  );
  requireFact(
    m.source?.repositoryId === c.repositoryId &&
      m.source.approvedMainAncestor === true &&
      m.source.ciPassed === true &&
      (a.mode === "rollback"
        ? a.rollbackSchemaCompatible === true
        : m.source.developmentLiveSha === m.sha),
    "Release provenance missing",
  );
  requireFact(
    a.mode === "onboard" || a.mode === "promote" || a.mode === "rollback",
    "Unknown lifecycle mode",
  );
  if (a.mode === "onboard")
    requireFact(
      a.firstOnboardingAuthorized === true &&
        Array.isArray(a.githubReviewerIds) &&
        a.githubReviewerIds.length > 0 &&
        a.githubReviewerIds.every(Number.isSafeInteger),
      "First onboarding approval and exact reviewers required",
    );

  if (a.mode === "onboard")
    requireFact(
      a.costEvidence?.source === "PRIMARY_PROVIDER_QUOTE" &&
        [
          "https://render.com/pricing",
          "https://dashboard.render.com/billing",
        ].includes(a.costEvidence.url) &&
        Date.parse(a.costEvidence.verifiedAt) <= now &&
        now - Date.parse(a.costEvidence.verifiedAt) <= 86400000 &&
        a.costEvidence.monthlyComputeUsd > 0 &&
        a.costEvidence.monthlyComputeUsd <= a.budget.renderMonthlyComputeUsd &&
        a.githubReviewerIds.length <= 6 &&
        new Set(a.githubReviewerIds).size === a.githubReviewerIds.length &&
        a.githubReviewerIds.every((x) => x > 0),
      "Fresh provider price evidence and bounded exact reviewers required",
    );
  return true;
}
export function assertSnapshot(s, c, now = Date.now()) {
  requireFact(
    s?.source === "LIVE_PROVIDER_APIS" &&
      Number.isFinite(Date.parse(s.capturedAt)) &&
      Date.parse(s.capturedAt) <= now &&
      now - Date.parse(s.capturedAt) <= 900000,
    "Fresh live provider snapshot required",
  );
  requireFact(
    s.repository?.id === c.repositoryId &&
      s.repository.full_name === c.repository,
    "Repository identity drift",
  );
  requireFact(
    s.renderProject?.id === c.render.projectId &&
      s.renderProject.owner?.id === c.render.workspaceId,
    "Render project identity drift",
  );
  requireFact(
    s.renderEnvironment?.id === c.render.environmentId &&
      s.renderEnvironment.projectId === c.render.projectId &&
      s.renderEnvironment.networkIsolationEnabled === true,
    "Render environment identity or network drift",
  );
  requireFact(
    s.neonBranch?.id === c.neon.branchId &&
      s.neonBranch.project_id === c.neon.projectId &&
      s.neonBranch.name === "Staging" &&
      s.neonBranch.protected === false,
    "Neon branch identity drift",
  );
  requireFact(
    s.neonEndpoint?.id === c.neon.endpointId &&
      s.neonEndpoint.branch_id === c.neon.branchId &&
      s.neonEndpoint.host === c.neon.directHost,
    "Neon endpoint identity drift",
  );
  requireFact(
    Array.isArray(s.services) &&
      Array.isArray(s.databases) &&
      Array.isArray(s.domains) &&
      s.domains.length === 0,
    "Complete provider scope and empty domain binding required",
  );
  requireFact(
    s.services.every((x) => x.environmentId === c.render.environmentId) &&
      s.services.length <= 1,
    "Unexpected or ambiguous Staging resources",
  );
  const db = s.databases.find((x) => x.name === "srm_app");
  if (db)
    requireFact(
      db.branch_id === c.neon.branchId &&
        db.owner_name === "neondb_owner" &&
        Number.isSafeInteger(db.id),
      "Product database identity drift",
    );
  if (s.githubEnvironment)
    requireFact(
      s.githubEnvironment.name === "srm-staging" &&
        Number.isSafeInteger(s.githubEnvironment.id),
      "GitHub environment identity drift",
    );
  return true;
}
export function assertOperation({
  operation,
  authorization: a,
  manifest: m,
  contract: c,
  registry: r,
  snapshot: s,
  journal: j,
  owner,
  now = Date.now(),
}) {
  assertLifecycleAuthorization(a, m, c, now);
  assertSnapshot(s, c, now);
  requireFact(operations.includes(operation), "Operation is outside lifecycle");
  requireFact(
    r.projectKey === "SRM" &&
      r.policy.sourceAuthority === c.repository &&
      r.environments.staging.github.exclusiveProjectKey === "SRM" &&
      r.environments.staging.render.environmentId === c.render.environmentId &&
      r.environments.staging.neon.branchId === c.neon.branchId &&
      r.environments.staging.neon.projectId === c.neon.projectId &&
      r.environments.staging.render.workspaceId === c.render.workspaceId &&
      r.environments.staging.render.projectId === c.render.projectId &&
      r.environments.staging.github.environmentName ===
        c.github.environmentName,
    "Canonical SRM routing required",
  );
  requireFact(
    j?.release?.approvalId === a.approvalId &&
      j.release.manifestDigest === digest(m) &&
      j.release.owner === owner &&
      j.release.phase !== "VERIFIED",
    "Exclusive current release ownership required",
  );
  requireFact(
    s.neonEndpoint.autoscaling_limit_max_cu <= a.budget.neonMaxCu,
    "Neon cost cap drift",
  );
  const t = r.environments.staging;
  if (t.status === "ACTIVE")
    requireFact(
      t.github.environmentId === s.githubEnvironment?.id &&
        t.neon.databaseId === s.databases.find((x) => x.name === "srm_app")?.id,
      "Canonical application resource identity drift",
    );
  if (t.status === "ACTIVE" && s.liveDeploy)
    requireFact(
      [t.render.services?.runtime?.baselineSha, m.sha].includes(
        s.liveDeploy.commit?.id,
      ),
      "Unexpected deployed source drift",
    );
  if (t.status === "RESERVED")
    requireFact(
      a.mode === "onboard" &&
        a.firstOnboardingAuthorized === true &&
        t.activationStatus === "NOT_ONBOARDED",
      "Reserved environment requires legal first onboarding",
    );
  else
    requireFact(
      t.status === "ACTIVE" &&
        t.verificationStatus === "VERIFIED" &&
        a.mode !== "onboard",
      "Normal release requires ACTIVE VERIFIED",
    );
  const service = s.services[0],
    known =
      j.release.resources?.serviceId ?? t.render.services?.runtime?.serviceId;
  if (service)
    requireFact(
      service.id === known || j.release.steps?.service?.status === "INTENT",
      "Unregistered service cannot be adopted",
    );
  if (known) requireFact(service?.id === known, "Approved service missing");
  if (t.status === "ACTIVE" && !j.release.steps.deploy) {
    const p = {
      capturedAt: s.capturedAt,
      source: { render: "render-api", neon: "neon-api" },
      renderServices: s.services.map((x) => ({
        id: x.id,
        environmentId: x.environmentId,
        repo: x.repo,
        autoDeploy: x.autoDeployTrigger !== "off",
        liveStatus: s.liveDeploy?.status,
        liveDeployId: s.liveDeploy?.id,
        liveSha: s.liveDeploy?.commit?.id,
      })),
      neonBranches: [
        {
          id: s.neonBranch.id,
          projectId: s.neonBranch.project_id,
          name: s.neonBranch.name,
        },
      ],
    };
    requireFact(
      compareProviderSnapshot(r, "staging", p, now).valid,
      "Previous canonical baseline drift",
    );
  }
  return {
    status: "PASS",
    operation,
    targetEnvironment: "staging",
    standardPreflightUnchanged: true,
  };
}
export function claimRelease(
  state,
  a,
  m,
  owner,
  previousExecutorStopped = false,
) {
  requireFact(
    state?.schemaVersion === "1.0" &&
      state.projectKey === "SRM" &&
      state.targetEnvironment === "staging" &&
      Number.isSafeInteger(state.generation),
    "Invalid release journal",
  );
  const next = structuredClone(state),
    old = next.release;
  const authorizationDigest = digest({
    ...a,
    expiresAt: undefined,
    costEvidence: a.costEvidence
      ? { ...a.costEvidence, verifiedAt: undefined }
      : undefined,
  });
  if (old && old.phase !== "VERIFIED") {
    requireFact(
      old.approvalId === a.approvalId &&
        old.manifestDigest === digest(m) &&
        old.authorizationDigest === authorizationDigest,
      "Concurrent or different release blocked",
    );
    requireFact(
      old.owner === owner || previousExecutorStopped,
      "Previous executor must be provably stopped before takeover",
    );
    old.owner = owner;
  } else {
    requireFact(
      !old || old.approvalId !== a.approvalId,
      "Completed release cannot be reused",
    );
    next.release = {
      authorizationDigest,
      authorization: { ...a, manifest: undefined },
      approvalId: a.approvalId,
      manifestDigest: digest(m),
      manifest: m,
      mode: a.mode,
      owner,
      phase: "ONBOARDING_AUTHORIZED",
      resources: {},
      steps: {},
      lastKnownGood: next.baseline ?? null,
    };
  }
  next.generation++;
  return next;
}
export function recordStep(
  state,
  owner,
  operation,
  status,
  snapshot,
  result = {},
) {
  requireFact(
    state.release.owner === owner &&
      operations.includes(operation) &&
      ["INTENT", "DONE"].includes(status),
    "Fenced journal operation required",
  );
  const next = structuredClone(state);
  next.release.phase =
    operation === "verify" || operation === "reconcile"
      ? "VERIFYING"
      : "PROVISIONING";
  next.release.steps[operation] = {
    status,
    before:
      next.release.steps[operation]?.before ??
      next.release.steps[operation]?.snapshot ??
      snapshot,
    snapshotDigest: digest(snapshot),
    snapshot,
    result,
  };
  next.generation++;
  return next;
}
export function reconciliation(
  registry,
  state,
  snapshot,
  proof,
  contract,
  authorization,
  manifest,
  owner,
) {
  assertOperation({
    operation: "reconcile",
    authorization,
    manifest,
    contract,
    registry,
    snapshot,
    journal: state,
    owner,
  });
  const service = snapshot.services[0],
    d = snapshot.liveDeploy,
    db = snapshot.databases.find((x) => x.name === "srm_app"),
    ge = snapshot.githubEnvironment;
  requireFact(
    service?.id === state.release.resources.serviceId &&
      service.branch === "main" &&
      service.autoDeployTrigger === "off" &&
      d?.id &&
      d.status === "live" &&
      d.commit?.id === manifest.sha,
    "Actual live deployment must match release",
  );
  requireFact(
    ge?.id === state.release.resources.githubEnvironmentId &&
      db?.id === state.release.resources.databaseId,
    "Observed provider IDs must match provisioning journal",
  );
  requireFact(
    proof?.source === "LIVE_RUNTIME_AND_SQL" &&
      proof.serviceId === service.id &&
      proof.deployId === d.id &&
      proof.sha === d.commit.id &&
      proof.branchId === contract.neon.branchId &&
      proof.databaseId === db.id &&
      proof.githubEnvironmentId === ge.id,
    "Verification proof identity mismatch",
  );
  requireFact(
    [
      "configuration",
      "githubProtection",
      "schema",
      "runtimeRole",
      "tenantIsolation",
      "health",
      "authentication",
      "persistence",
    ].every((x) => proof[x] === "PASS"),
    "Incomplete verification proof",
  );
  requireFact(
    digest(proof.migrations) === digest(manifest.migrations),
    "Schema ledger does not match release manifest",
  );
  const r = structuredClone(registry),
    j = structuredClone(state),
    t = r.environments.staging;
  Object.assign(t, {
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    activationStatus: "ONBOARDED",
    schemaStatus: "INITIALIZED",
    deploymentPolicy: "EXPLICIT_APPROVED_REVISION_ONLY",
  });
  Object.assign(t.github, {
    environmentId: ge.id,
    repository: contract.repository,
    repositoryId: contract.repositoryId,
    protectionStatus: "REQUIRED_REVIEWERS_MAIN_ONLY",
    status: "PROVISIONED",
  });
  t.render.services.runtime = {
    serviceId: service.id,
    name: service.name,
    url: service.serviceDetails.url,
    autoDeploy: false,
    baselineSha: d.commit.id,
    baselineDeployId: d.id,
  };
  Object.assign(t.neon, {
    databaseId: db.id,
    databaseName: "srm_app",
    applicationDatabaseName: "srm_app",
    applicationDatabaseStatus: "CREATED",
    databaseOwner: db.owner_name,
    runtimeRole: "srm_app_runtime",
    purpose: "SRM_APPLICATION_DATA",
  });
  requireFact(
    validateEnvironmentTopology(r).valid,
    "Reconciled topology invalid",
  );
  j.baseline = {
    generation: j.generation + 1,
    sha: d.commit.id,
    deployId: d.id,
    serviceId: service.id,
    evidenceDigest: digest(proof),
    verifiedAt: snapshot.capturedAt,
  };
  j.release.phase = "VERIFIED";
  j.release.proof = proof;
  j.generation++;
  return { registry: r, state: j };
}
// GitHub alone supplies the transaction boundary. Provider operations remain separately journaled.
export async function casPublish(store, expectedHead, files, message) {
  requireFact(
    /^[a-f0-9]{40}$/.test(expectedHead),
    "Expected GitHub head required",
  );
  const current = await store.read();
  requireFact(
    current.head === expectedHead,
    "Baseline update conflict; reread and revalidate",
  );
  return store.commit({ expectedHead, files, message });
}
