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
// Preserve published digests: JSON property order is part of the historical
// digest contract. The journal omits manifest, so reconstruct its original slot.
export function authorizationFromRelease(release) {
  const stored = release?.authorization;
  requireFact(stored && release.manifest && release.authorizationDigest, "Stored release authorization unavailable");
  const keys = release.authorizationKeyOrder ?? Object.keys(stored).filter(k => k !== "manifest").flatMap(k => k === "manifestDigest" ? ["manifest",k] : [k]);
  requireFact(Array.isArray(keys) && keys.length === new Set(keys).size && keys.includes("manifest") && keys.every(k => k === "manifest" || Object.hasOwn(stored,k)), "Stored authorization order invalid");
  const a = Object.fromEntries(keys.map(k => [k,k === "manifest" ? release.manifest : stored[k]]));
  requireFact(Object.keys(stored).every(k => k === "manifest" || Object.hasOwn(a,k)), "Stored authorization fields missing");
  requireFact(digest({...a,expiresAt:undefined,costEvidence:a.costEvidence ? {...a.costEvidence,verifiedAt:undefined} : undefined}) === release.authorizationDigest, "Stored authorization scope mismatch");
  return a;
}
const requireFact = (ok, message) => {
  if (!ok) throw Error(message);
};
// SRM-only protection policy. This validates observed state; it never changes GitHub.
export function assertStagingGitHubProtection(ge, c, reviewerIds = null) {
  requireFact(
    c.projectKey === "SRM" && c.repository === "profitia/SG-dev" &&
      c.repositoryId === 1247665550 && c.github.environmentName === "srm-staging" &&
      ge?.name === c.github.environmentName && Number.isSafeInteger(ge.id) && ge.id > 0,
    "Exact SRM Staging GitHub environment required",
  );
  const rules = ge.protection_rules?.filter((x) => x.type === "required_reviewers");
  const rule = rules?.[0];
  requireFact(
    rules?.length === 1 && Array.isArray(rule.reviewers) && rule.reviewers.length > 0 &&
      rule.reviewers.every((r) => ["User", "Team"].includes(r.type) &&
        Number.isSafeInteger(r.reviewer?.id) && r.reviewer.id > 0) &&
      typeof rule.prevent_self_review === "boolean" &&
      ge.deployment_branch_policy?.custom_branch_policies === true &&
      ge.deployment_branch_policy.protected_branches === false,
    "Required reviewer and main-only branch protection required",
  );
  const policy = c.github.soloOperatorApproval;
  if (policy) {
    requireFact(
      policy.id === "SRM-STAGING-SOLO-OPERATOR-20261009" &&
        policy.projectKey === "SRM" && policy.targetEnvironment === "staging" &&
        policy.repository === c.repository && policy.repositoryId === c.repositoryId &&
        policy.environmentName === "srm-staging" && policy.environmentId === 23853126630 &&
        policy.requiredReviewer?.type === "User" && policy.requiredReviewer.id === 275643368 &&
        policy.requiredReviewer.login === "profitia" && policy.preventSelfReview === false &&
        policy.applicationGate === "SEPARATE_EXPLICIT_OWNER_APPROVAL_REQUIRED",
      "Invalid canonical SRM solo-operator approval policy",
    );
    if (ge.id === policy.environmentId) {
      requireFact(
        rule.reviewers.length === 1 && rule.reviewers[0].type === "User" &&
          rule.reviewers[0].reviewer.id === policy.requiredReviewer.id &&
          rule.reviewers[0].reviewer.login === policy.requiredReviewer.login,
        "Exact profitia owner reviewer required",
      );
    }
  }
  requireFact(
    rule.prevent_self_review === true || (policy && ge.id === policy.environmentId),
    "Self-review is allowed only for the existing canonical SRM Staging environment",
  );
  if (reviewerIds) requireFact(
    digest(rule.reviewers.map((r) => r.reviewer.id).sort((a, b) => a - b)) ===
      digest([...reviewerIds].sort((a, b) => a - b)),
    "Approved exact reviewers required",
  );
  return {
    environmentId: ge.id,
    reviewerIds: rule.reviewers.map((r) => r.reviewer.id),
    preventSelfReview: rule.prevent_self_review,
    mode: rule.prevent_self_review ? "INDEPENDENT_REVIEW" : "SOLO_OPERATOR_OWNER_REVIEW",
  };
}
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
// Observe an existing binding only. No domain or DNS operation is authorized here.
export function assertStagingDomainBinding(s, c) {
  requireFact(Array.isArray(s?.domains) && Array.isArray(s?.services), "Complete domain inventory required");
  const p = c.existingDomainBinding;
  if (p) requireFact(
    c.projectKey === "SRM" && c.repository === "profitia/SG-dev" && c.repositoryId === 1247665550 &&
      p.id === "SRM-STAGING-EXISTING-DOMAIN-20261009" && p.projectKey === "SRM" &&
      p.targetEnvironment === "staging" && p.repository === c.repository && p.repositoryId === c.repositoryId &&
      p.renderWorkspaceId === c.render.workspaceId && p.renderWorkspaceId === "tea-d7lps8rbc2fs73cn80dg" &&
      p.renderProjectId === c.render.projectId && p.renderProjectId === "prj-dapbd3hsrm7s73es53fg" &&
      p.renderEnvironmentId === c.render.environmentId && p.renderEnvironmentId === "evm-dapbdbbbc2fs73f4g7gg" &&
      p.serviceId === "srv-db496b3tqb8s73eh5sfg" && p.mode === "OBSERVE_EXISTING_ONLY" &&
      Array.isArray(p.domains) && p.domains.length === 1 && p.domains[0].id === "cdm-db4btcvlk1mc73fhn7sg" &&
      p.domains[0].name === "demo-srm-porr.spendguru.app" && p.domains[0].verificationStatus === "verified",
    "Invalid canonical SRM existing domain policy",
  );
  if (!p || !s.services.some(x => x.id === p.serviceId)) {
    requireFact(s.domains.length === 0, "Domain binding is outside the exact existing SRM service");
    return [];
  }
  requireFact(s.services.length === 1 && s.services[0].environmentId === p.renderEnvironmentId &&
    s.domains.length === 1, "Exact existing SRM domain inventory required");
  const d = s.domains[0]?.customDomain ?? s.domains[0];
  requireFact(d?.id === p.domains[0].id && d.name === p.domains[0].name &&
    d.verificationStatus === "verified" && d.redirectForName === "" &&
    (!Object.hasOwn(d, "serviceId") || d.serviceId === p.serviceId),
    "Existing SRM domain identity, verification or redirect drift");
  return [{ id: d.id, name: d.name, verificationStatus: d.verificationStatus, serviceId: p.serviceId }];
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
      Array.isArray(s.domains),
    "Complete provider scope required",
  );
  assertStagingDomainBinding(s, c);
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
  requireFact(Array.isArray(t.domains) && digest(t.domains) === digest(assertStagingDomainBinding(s, c)), "Canonical Staging domain binding drift");
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
      Number.isSafeInteger(state.generation) &&
      state.generation >= 0 &&
      (!state.release ||
        [
          "ONBOARDING_AUTHORIZED",
          "PROVISIONING",
          "VERIFYING",
          "VERIFIED",
        ].includes(state.release.phase)),
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
    if (old.authorization.expiresAt !== a.expiresAt) {
      requireFact(Date.parse(a.expiresAt) > Date.parse(old.authorization.expiresAt), "Authorization renewal must not shorten or invalidate the approved window");
      old.authorizationRenewals = [...(old.authorizationRenewals ?? []), {previousExpiresAt:old.authorization.expiresAt,expiresAt:a.expiresAt,owner,approvalId:a.approvalId,manifestDigest:old.manifestDigest}];
      old.authorization.expiresAt = a.expiresAt;
    }
  } else {
    requireFact(
      !old || old.approvalId !== a.approvalId,
      "Completed release cannot be reused",
    );
    next.release = {
      authorizationDigest,
      authorizationKeyOrder: Object.keys(a).filter(k => a[k] !== undefined),
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
  const domains = assertStagingDomainBinding(snapshot, contract);
  if (domains.length) requireFact(Array.isArray(proof.domainBindings) && digest(proof.domainBindings) === digest(domains), "Domain verification proof mismatch");
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
  t.domains = domains;
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

export function assertProductSecretIsolation(c, values, development, now = Date.now()) {
  requireFact(c?.projectKey === 'SRM' && c.repository === 'profitia/SG-dev' && c.repositoryId === 1247665550 && values?.TARGET_ENVIRONMENT === 'staging', 'Exact SRM Staging credential scope required');
  requireFact(Array.isArray(c.requiredSecrets) && c.requiredSecrets.length > 0 && c.requiredSecrets.every(k => typeof values[k] === 'string' && values[k].length > 0 && typeof development[k] === 'string' && development[k].length > 0), 'Product secret presence and Development comparison required');
  const shared = c.requiredSecrets.filter(k => values[k] === development[k]);
  if (shared.length === 0) return true;
  const suppliers = ['MGBI_API_KEY', 'VERCLY_API_KEY', 'CEIDG_API_KEY'];
  requireFact(shared.every(k => suppliers.includes(k) || k === 'SRM_DEMO_PASSWORD'), 'Database, session and unsupported product secrets cannot be shared');
  const validate = (e, id, names) => {
    requireFact(e?.id === id && e.projectKey === 'SRM' && e.targetEnvironment === 'staging' && e.sourceEnvironment === 'development' && e.owner === 'Profit.ia' && e.approvedBy === 'Tomasz Uscinski' && e.approvalSource === 'EXPLICIT_BUSINESS_OWNER_REQUEST', 'Explicit canonical credential exception required');
    requireFact(e.repository === c.repository && e.repositoryId === c.repositoryId && e.developmentServiceId === c.development.renderServiceId && e.renderEnvironmentId === c.render.environmentId && e.neonProjectId === c.neon.projectId && e.neonBranchId === c.neon.branchId && c.development.renderServiceId === 'srv-db1vu6gm7kps73d0e3r0' && c.render.environmentId === 'evm-dapbdbbbc2fs73f4g7gg' && c.neon.projectId === 'snowy-breeze-40315151' && c.neon.branchId === 'br-broad-butterfly-b11t4v01', 'Canonical credential exception resource identity mismatch');
    const start = Date.parse(e.approvedAt), end = Date.parse(e.expiresAt);
    requireFact(Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && start <= now && end > now && end - start <= 31 * 86400000 && end > start, 'Credential exception expired or unbounded');
    requireFact(Array.isArray(e.sharedSecretNames) && e.sharedSecretNames.length === names.length && names.every(k => e.sharedSecretNames.includes(k)) && ['rollback', 'monitoring', 'expiryAction'].every(k => typeof e[k] === 'string' && e[k].trim().length > 0), 'Exact secret allowlist with rollback and monitoring required');
  };
  if (shared.some(k => suppliers.includes(k))) validate(c.vendorCredentialReuse, 'SRM-STAGING-VENDOR-REUSE-20261009', suppliers);
  if (shared.includes('SRM_DEMO_PASSWORD')) {
    validate(c.demoPasswordReuse, 'SRM-STAGING-DEMO-PASSWORD-REUSE-20261009', ['SRM_DEMO_PASSWORD']);
    requireFact(c.demoPasswordReuse.stagingServiceId === 'srv-db496b3tqb8s73eh5sfg' && c.demoPasswordReuse.githubEnvironmentId === 23853126630 && c.demoPasswordReuse.sessionSecretMustRemainSeparate === true && c.demoPasswordReuse.databaseCredentialsMustRemainSeparate === true, 'Demo password exception requires exact onboarded Stage identities and isolated session/database credentials');
  }
  return true;
}
