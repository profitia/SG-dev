import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {diagnosticStage, diagnosticError, ReleaseDiagnosticError, githubResponse} from "./release-diagnostics.mjs";
import {
  root,
  contract,
  migrationManifest,
  assertMigrationDestination,
  runMigrations,
  initializationConfig,
  promotionExecutorEnvironment,
} from "./staging-migrate.mjs";
import {
  assertRenderService,
  verifyRuntimeDatabase,
  verifyPasswordSmoke,
  selectReusableDeploy,
} from "./promote-staging.mjs";
import { runGovernancePreflight } from "../../../scripts/governance/governance-preflight.mjs";
import {
  assertProductSecretIsolation,
  assertStagingGitHubProtection,
  assertLifecycleAuthorization,
  assertSnapshot,
  assertStagingDomainBinding,
  assertOperation,
  claimRelease,
  recordStep,
  reconciliation,
  digest,
  casPublish,
  statePath,
  topologyPath,
  operations,
} from "../../../scripts/governance/srm-release-lifecycle.mjs";
const GH = "https://api.github.com",
  R = "https://api.render.com/v1",
  N = "https://console.neon.tech/api/v2";
const repo = "/repos/" + contract.repository;
const fail = (ok, message) => {
  if (!ok) throw Error(message);
};
export const releasePointer = (sha) => "srm-release-" + sha;
export function manifestFrom(source, sha) {
  return {
    schemaVersion: "2.0",
    projectKey: "SRM",
    repository: contract.repository,
    targetEnvironment: "staging",
    sha,
    contractDigest: digest(contract),
    source,
    migrations: migrationManifest().map(({ version, checksum }) => ({
      version,
      checksum,
    })),
  };
}
export function verifyLifecycleSource(
  sha,
  git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }),
) {
  fail(
    git(["remote", "get-url", "origin"])
      .stdout.trim()
      .replace(/\.git$/, "") ===
      "https://github.com/" + contract.repository,
    "Repository authority identity mismatch",
  );
  fail(/^[a-f0-9]{40}$/.test(sha), "Full approved SHA required");
  fail(
    git(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
      .status === 0,
    "Authority refresh failed",
  );
  fail(
    git(["status", "--porcelain"]).stdout.trim() === "",
    "Clean governed source required",
  );
  fail(
    git(["merge-base", "--is-ancestor", "HEAD", "origin/main"]).status === 0,
    "Executor source must be on authority main",
  );
  fail(
    git([
      "diff",
      "--exit-code",
      "HEAD",
      "origin/main",
      "--",
      "scripts/governance",
      "apps/srm/scripts",
      "apps/srm/deployment/staging-contract.json",
      ".github/workflows/srm-ci.yml",
      "Canon/v1.0-profitia-environment-and-release-promotion-canon.md",
      "Canon/registries/governance-manifest-v2.json",
      "Canon/registries/profitia-projects-v1.json",
      "Canon/adapters/srm-project-adapter-v2.md",
    ]).status === 0,
    "Promotion mechanism changed; restart from reviewed main",
  );
  fail(
    git(["merge", "--ff-only", "origin/main"]).status === 0,
    "Authority integration failed",
  );
  fail(
    git(["merge-base", "--is-ancestor", sha, "origin/main"]).status === 0,
    "Unverified release revision",
  );
  fail(
    git(["diff", "--exit-code", sha, "HEAD", "--", "apps/srm/db/migrations"])
      .status === 0,
    "Approved migration source differs from mechanism",
  );
  const historical = git([
    "show",
    sha + ":apps/srm/deployment/staging-contract.json",
  ]);
  fail(historical.status === 0, "Release contract absent");
  const runtimeContract = (c) =>
    Object.fromEntries(
      [
        "repository",
        "repositoryId",
        "render",
        "neon",
        "development",
        "requiredSecrets",
        "requiredConfiguration",
      ].map((k) => [k, c[k]]),
    );
  fail(
    digest(runtimeContract(JSON.parse(historical.stdout))) ===
      digest(runtimeContract(contract)),
    "Approved runtime contract differs from mechanism",
  );
  fail(
    git(["cat-file", "-e", sha + ":apps/srm/src/server/runtime-environment.ts"])
      .status === 0,
    "Release lacks staging runtime",
  );
  return true;
}
export function lifecyclePreflight(sha, approvalId) {
  verifyLifecycleSource(sha);
  const targets = [
    "apps/srm/scripts/staging-lifecycle.mjs",
    "scripts/governance/srm-release-lifecycle.mjs",
    statePath,
    topologyPath,
  ];
  const result = runGovernancePreflight({
    project: "SRM",
    target_environment: "staging",
    task_id: approvalId,
    title: "SRM explicitly authorized release lifecycle",
    workspace: "SG-dev Codespaces SRM",
    execution_environment: promotionExecutorEnvironment(),
    scope: "implementation",
    mode: "development",
    hostConversationUnavailable: true,
    targets,
    legacyExceptions: [],
    offline: true,
  });
  // Only environment existence/baseline gates are replaced by the narrowly owned lifecycle gate.
  const independent = Object.entries(result.gates).filter(
    ([k]) =>
      !["TARGET_ENVIRONMENT_GATE", "LIVE_PROVIDER_DRIFT_GATE"].includes(k),
  );
  fail(
    independent.every(([, v]) => v.status !== "BLOCKED"),
    "Independent governance preflight blocked",
  );
  return result;
}
export function assertApprovedRuntimeUrl(url) {
  fail(
    url === "https://" + contract.render.serviceName + ".onrender.com",
    "Explicitly approved Staging runtime URL mismatch",
  );
}

export function publicationFiles(current, files, expectedHead) {
  fail(files[statePath], "Every publication requires a journal fence");
  fail(
    files[statePath].generation === current.state.generation + 1,
    "Publication generation must advance exactly once",
  );
  const nonce = digest({ expectedHead, files });
  const { publicationNonce: ignored, ...state } = files[statePath];
  return { ...files, [statePath]: { publicationNonce: nonce, ...state } };
}

export function githubStore(
  request,
  {
    now = Date.now,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    checkTimeoutMs = 600000,
  } = {},
) {
  const read = async () => {
    const b = await request(GH, repo + "/branches/main");
    fail(b?.commit?.sha, "Authority main unavailable");
    const head = b.commit.sha;
    const tree = await request(
      GH,
      repo + "/git/trees/" + head + "?recursive=1",
    );
    fail(
      Array.isArray(tree?.tree) && !tree.truncated,
      "Incomplete authority tree",
    );
    const file = async (p) => {
      const f = tree.tree.find((x) => x.path === p);
      fail(f?.type === "blob", "Canonical journal missing");
      return JSON.parse(
        Buffer.from(
          (await request(GH, repo + "/git/blobs/" + f.sha)).content,
          "base64",
        ).toString(),
      );
    };
    return {
      head,
      protected: b.protected === true,
      state: await file(statePath),
      registry: await file(topologyPath),
    };
  };
  const writeBranch = async (branch, expectedHead, files, message) => {
    const result = await diagnosticStage({stage:"publication-commit",operation:"createCommitOnBranch",branch,expectedSha:expectedHead,effect:"OBSERVATION_REQUIRED"}, () => request(GH, "/graphql", "POST", {
      query:
        "mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}",
      variables: {
        input: {
          branch: {
            repositoryNameWithOwner: contract.repository,
            branchName: branch,
          },
          expectedHeadOid: expectedHead,
          message: { headline: message },
          fileChanges: {
            additions: Object.entries(files).map(([p, v]) => ({
              path: p,
              contents: Buffer.from(JSON.stringify(v, null, 2) + "\n").toString(
                "base64",
              ),
            })),
          },
        },
      },
    }));
    if (result.errors?.length || !result.data?.createCommitOnBranch?.commit?.oid)
      throw new ReleaseDiagnosticError({stage:"publication-commit",operation:"createCommitOnBranch",branch,expectedSha:expectedHead,category:"GRAPHQL_REJECTION",graphqlErrors:result.errors ?? [],requestReachedGitHub:"HTTP_RESPONSE",effect:"OBSERVATION_REQUIRED"});
    return result.data.createCommitOnBranch.commit.oid;
  };
  const sameCanonical = (a, b) =>
    digest(a.state) === digest(b.state) &&
    digest(a.registry) === digest(b.registry);
  const branchFilesMatch = async (branch, files) => {
    for (const [p, value] of Object.entries(files)) {
      const f = await request(GH, repo + "/contents/" + p + "?ref=" + branch);
      fail(
        f?.encoding === "base64" &&
          digest(JSON.parse(Buffer.from(f.content, "base64").toString())) ===
            digest(value),
        "Publication branch content drift",
      );
    }
  };
  const protectedCommit = async (current, expectedHead, files, message) => {
    const nonce = files[statePath].publicationNonce;
    const branch = "srm-publication-" + nonce.slice(0, 24);
    const identity = await request(GH, repo);
    fail(
      identity.id === contract.repositoryId &&
        identity.full_name === contract.repository &&
        identity.allow_merge_commit === true,
      "Lawful merge publication unavailable",
    );
    let ref = await request(GH, repo + "/git/ref/heads/" + branch);
    if (!ref) {
      await request(GH, repo + "/git/refs", "POST", {
        ref: "refs/heads/" + branch,
        sha: expectedHead,
      });
      ref = await request(GH, repo + "/git/ref/heads/" + branch);
    }
    fail(ref?.object?.sha, "Publication branch acknowledgement unavailable");
    let candidate = ref.object.sha;
    if (candidate === expectedHead) {
      try { candidate = await writeBranch(branch, expectedHead, files, message); }
      catch (error) {
        // Observe after rejection/timeout, but never repeat or proceed automatically.
        let observation = {effect:"OBSERVATION_REQUIRED"};
        try {
          const observed = await request(GH, repo + "/git/ref/heads/" + branch);
          observation.observedSha = observed?.object?.sha;
          if (observation.observedSha === expectedHead) observation.effect = "NO_COMMIT_OBSERVED";
          else if (observation.observedSha) {
            await branchFilesMatch(branch, files);
            observation.effect = "COMMIT_OBSERVED";
          }
        } catch { /* Ambiguous observation is retained, never treated as permission to retry. */ }
        throw new ReleaseDiagnosticError({...diagnosticError(error,{stage:"publication-commit",operation:"createCommitOnBranch",branch,expectedSha:expectedHead}).diagnostic,...observation});
      }
    } else await diagnosticStage({stage:"publication-existing-commit",operation:"verify-publication-branch",branch,expectedSha:expectedHead,observedSha:candidate}, () => branchFilesMatch(branch, files));
    const comparison = await request(
      GH,
      repo + "/compare/" + expectedHead + "..." + candidate,
    );
    fail(
      comparison?.status === "ahead" &&
        comparison.ahead_by === 1 &&
        comparison.base_commit?.sha === expectedHead &&
        Array.isArray(comparison.files) &&
        comparison.files.length === Object.keys(files).length &&
        comparison.files.every(
          (f) => Object.hasOwn(files, f.filename) && f.status === "modified",
        ),
      "Publication candidate contains unapproved changes",
    );
    const pulls = await request(
      GH,
      repo +
        "/pulls?state=all&head=" +
        encodeURIComponent(contract.repository.split("/")[0] + ":" + branch) +
        "&base=main&per_page=100",
    );
    fail(Array.isArray(pulls) && pulls.length <= 1, "Ambiguous publication PR");
    let pr = pulls[0];
    if (!pr)
      pr = await request(GH, repo + "/pulls", "POST", {
        title: "[SRM release] " + message,
        head: branch,
        base: "main",
        body:
          "Publish the authorized SRM Staging lifecycle journal through the protected authority branch. " +
          "Only canonical release state and, at final verified reconciliation, environment topology are changed. " +
          "No application runtime deployment is triggered by this PR.\n\n" +
          "Publication fence: `" +
          nonce +
          "`; generation: " +
          files[statePath].generation +
          ". " +
          "The executor requires successful governance and any applicable SRM checks, plus unchanged canonical input before merging.",
      });
    fail(
      pr?.number &&
        pr.head?.sha === candidate &&
        pr.base?.ref === "main" &&
        pr.head.repo?.id === contract.repositoryId,
      "Publication PR identity drift",
    );
    console.error("SRM_PUBLICATION_PR", pr.html_url);
    if (!pr.merged_at) {
      fail(pr.state === "open", "Publication PR was closed without merge");
      const deadline = now() + checkTimeoutMs;
      for (;;) {
        const ci = await request(
          GH,
          repo + "/commits/" + candidate + "/check-runs?per_page=100",
        );
        fail(
          ci?.total_count <= 100 && Array.isArray(ci.check_runs),
          "Incomplete publication CI",
        );
        const latest = (name) =>
          ci.check_runs
            .filter((x) => x.name === name && x.head_sha === candidate)
            .sort((a, b) => b.id - a.id)[0];
        // Journal-only PRs do not match SRM CI's application path filter.
        // Accepted application source and controller CI are verified separately.
        const required = [latest("governance")];
        const srm = latest("srm-build");
        if (srm) required.push(srm);
        fail(
          !required.some(
            (x) => x?.status === "completed" && x.conclusion !== "success",
          ),
          "Publication CI failed; PR preserved",
        );
        if (
          required.every(
            (x) => x?.status === "completed" && x.conclusion === "success",
          )
        )
          break;
        fail(
          now() < deadline,
          "Publication CI pending; resume the preserved PR",
        );
        await pause(5000);
      }
      const fresh = await read();
      fail(
        sameCanonical(current, fresh),
        "Canonical publication conflict; PR preserved",
      );
      // GitHub's normal merge endpoint enforces all existing protection rules.
      // The changed nonce is on one stable line. Concurrent canonical proposals
      // conflict under three-way merge even if they happen after the read above.
      const result = await request(
        GH,
        repo + "/pulls/" + pr.number + "/merge",
        "PUT",
        {
          sha: candidate,
          merge_method: "merge",
          commit_title: message,
        },
      );
      fail(
        result?.merged === true && /^[a-f0-9]{40}$/.test(result.sha),
        "Protected publication not merged; PR preserved",
      );
    }
    const after = await read();
    fail(
      digest(after.state) === digest(files[statePath]) &&
        digest(after.registry) ===
          digest(files[topologyPath] ?? current.registry),
      "Merged canonical publication verification failed",
    );
    return after.head;
  };
  return {
    read,
    async commit({ expectedHead, files, message }) {
      fail(
        Object.keys(files).every((x) => [statePath, topologyPath].includes(x)),
        "Publication outside canonical release surfaces",
      );
      const current = await read();
      fail(
        current.head === expectedHead,
        "Baseline update conflict; reread and revalidate",
      );
      const fenced = publicationFiles(current, files, expectedHead);
      return diagnosticStage({stage:"publication",operation:"publish-journal",expectedSha:expectedHead,generation:fenced[statePath].generation,approvalId:fenced[statePath].release?.approvalId}, () => current.protected
        ? protectedCommit(current, expectedHead, fenced, message)
        : writeBranch("main", expectedHead, fenced, message));
    },
  };
}

export async function runLifecycle({
  authorization: a,
  manifest: m,
  provider: p,
  owner,
  stopAfter = null,
}) {
  assertLifecycleAuthorization(a, m, contract);
  fail(m.contractDigest === digest(contract), "Deployment contract mismatch");
  let current = await p.store.read();
  const before = await p.snapshot();
  assertSnapshot(before, contract);
  await p.preparationPreflight(before);
  fail(
    before.neonEndpoint.autoscaling_limit_max_cu <= a.budget.neonMaxCu,
    "Unapproved compute cap",
  );
  const t = current.registry.environments.staging;
  fail(Array.isArray(t.domains) && digest(t.domains) === digest(assertStagingDomainBinding(before, contract)), "Canonical Staging domain binding drift");
  const prior = current.state.release;
  if (prior?.phase === "VERIFIED" && prior.approvalId === a.approvalId) {
    fail(
      prior.manifestDigest === digest(m) &&
        current.state.baseline?.sha === m.sha &&
        before.liveDeploy?.id === current.state.baseline.deployId,
      "Completed release or provider drift",
    );
    const proof = await p.verify(before, m);
    return {
      status: "VERIFIED",
      sha: m.sha,
      deployId: proof.deployId,
      serviceId: proof.serviceId,
      registryHead: current.head,
      proof,
      recovered: true,
    };
  }
  fail(
    a.mode === "onboard"
      ? t.status === "RESERVED" && t.activationStatus === "NOT_ONBOARDED"
      : t.status === "ACTIVE" && t.verificationStatus === "VERIFIED",
    "Initial environment state or lifecycle mode mismatch",
  );
  const stopped =
    prior && prior.owner !== owner
      ? await p.executorStopped(prior.owner)
      : false;
  let state = claimRelease(current.state, a, m, owner, stopped);
  fail(p.sourceProof?.sha === m.sha, "Verified source evidence required");
  state.release.sourceProof = state.release.sourceProof ?? p.sourceProof;
  await p.authority(m.sha, a.approvalId);
  await casPublish(
    p.store,
    current.head,
    { [statePath]: state },
    "SRM release ownership " + a.approvalId,
  );
  current = await p.store.read();
  const save = async (files, label) => {
    assertLifecycleAuthorization(a, m, contract);
    const observed = await p.store.read();
    fail(
      observed.state.release?.owner === owner &&
        observed.state.release.manifestDigest === digest(m) &&
        observed.state.generation === state.generation,
      "Concurrent journal update",
    );
    await p.authority(m.sha, a.approvalId);
    await casPublish(p.store, observed.head, files, label);
    current = await p.store.read();
    state = current.state;
  };
  const step = async (op, action) => {
    let snap = await p.snapshot();
    assertOperation({
      operation: op,
      authorization: a,
      manifest: m,
      contract,
      registry: current.registry,
      snapshot: snap,
      journal: state,
      owner,
    });
    const old = state.release.steps[op];
    const observed = await p.observe(op, snap, state, m, a);
    if (old?.status === "DONE") {
      fail(observed?.complete, "Completed step drift: " + op);
      return;
    }
    if (!old) {
      const next = recordStep(state, owner, op, "INTENT", snap);
      await save({ [statePath]: next }, "SRM release intent " + op);
    }
    let result = observed?.complete ? observed.result : null;
    if (!result) {
      if (
        old?.status === "INTENT" &&
        ["database", "service", "deploy"].includes(op) &&
        !observed?.recoverable
      )
        throw Error(
          "Ambiguous provider outcome; observe accepted operation before retry: " +
            op,
        );
      snap = await p.snapshot();
      const latest = await p.store.read();
      fail(
        latest.state.generation === state.generation &&
          latest.state.release.owner === owner,
        "Lease fence changed",
      );
      await p.authority(m.sha, a.approvalId);
      assertOperation({
        operation: op,
        authorization: a,
        manifest: m,
        contract,
        registry: latest.registry,
        snapshot: snap,
        journal: state,
        owner,
      });
      result = await action(snap, state);
    }
    snap = await p.snapshot();
    assertSnapshot(snap, contract);
    const after = await p.observe(op, snap, state, m, a);
    fail(after?.complete, "Provider post-operation verification failed: " + op);
    const next = recordStep(
      state,
      owner,
      op,
      "DONE",
      snap,
      after.result ?? result,
    );
    Object.assign(next.release.resources, after.resources ?? {});
    await save({ [statePath]: next }, "SRM release verified " + op);
    if (stopAfter === op) throw Error("Simulated interruption after " + op);
  };
  await step("github-environment", (s) => p.githubEnvironment(s, a));
  await step("github-bindings", () => p.githubBindings());
  if (a.mode === "onboard")
    await step("release-pointer", (s) => p.pinSource(s, m));
  await step("database", (s) => p.database(s));
  await step("schema", () => p.schema(a.mode));
  await step("service", () => p.service(m, a));
  await step("deploy", (s) => p.deploy(s, m));
  await step("source-rebind", (s) => p.rebind(s));
  await step("verify", (s) => p.verify(s, m, true));
  const snap = await p.snapshot(),
    proof = await p.verify(snap, m);
  const latest = await p.store.read();
  fail(
    latest.state.generation === state.generation &&
      latest.state.release.owner === owner,
    "Reconciliation fence changed",
  );
  await p.authority(m.sha, a.approvalId);
  const next = reconciliation(
    latest.registry,
    state,
    snap,
    proof,
    contract,
    a,
    m,
    owner,
  );
  await casPublish(
    p.store,
    latest.head,
    { [topologyPath]: next.registry, [statePath]: next.state },
    "SRM verified provider baseline " + a.approvalId,
  );
  const final = await p.store.read();
  fail(
    final.state.release.phase === "VERIFIED" &&
      final.state.release.manifestDigest === digest(m) &&
      final.state.baseline.deployId === proof.deployId,
    "Canonical reconciliation not verified",
  );
  const after = await p.snapshot();
  assertSnapshot(after, contract);
  fail(
    after.liveDeploy?.id === final.state.baseline.deployId &&
      after.liveDeploy.commit?.id === final.state.baseline.sha &&
      after.services[0]?.id === final.state.baseline.serviceId,
    "Provider drift after publication; preserve evidence and block success",
  );
  await p.verify(after, m);
  return {
    status: "VERIFIED",
    sha: m.sha,
    deployId: proof.deployId,
    serviceId: proof.serviceId,
    registryHead: final.head,
    proof,
    stagingMutated: true,
  };
}
export function createProvider(
  env,
  approval,
  manifest,
  owner,
  fetcher = fetch,
) {
  assertLifecycleAuthorization(approval, manifest, contract);
  const request = async (base, url, method = "GET", body) => {
    if (method !== "GET") {
      assertLifecycleAuthorization(approval, manifest, contract);
      lifecyclePreflight(manifest.sha, approval.approvalId);
    }
    const token =
      base === GH
        ? env.SRM_RELEASE_GITHUB_TOKEN
        : base === R
          ? env.RENDER_API_KEY
          : env.NEON_API_KEY;
    fail(token, "Required scoped management credential missing");
    const options = {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    };
    if (base === GH) return githubResponse(fetcher, base + url, options,
      url === "/graphql" ? "createCommitOnBranch" : url.endsWith("/git/refs") ? "create-publication-branch" : url.endsWith("/merge") ? "merge-publication-pr" : "github-rest");
    const res = await fetcher(base + url, options);
    if (res.status === 404 && method === "GET") return null;
    fail(res.ok, "Provider request rejected (" + res.status + ")");
    return res.status === 204 ? null : res.json();
  };
  const paged = async (url) => {
    let rows = [],
      cursor = "";
    for (let i = 0; i < 100; i++) {
      const part = await request(
        R,
        url +
          (url.includes("?") ? "&" : "?") +
          "limit=100" +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      );
      fail(Array.isArray(part), "Incomplete provider inventory");
      rows.push(...part);
      if (part.length < 100) return rows;
      const next = part.at(-1).cursor;
      fail(next && next !== cursor, "Pagination incomplete");
      cursor = next;
    }
    throw Error("Pagination bound");
  };
  const store = githubStore(request);
  const stageEnv = () =>
    Object.fromEntries(
      [...contract.requiredSecrets, ...contract.requiredConfiguration].map(
        (k) => [
          k,
          k === "TARGET_ENVIRONMENT"
            ? "staging"
            : k === "SRM_NEON_PROJECT_ID"
              ? contract.neon.projectId
              : k === "SRM_NEON_BRANCH_ID"
                ? contract.neon.branchId
                : k === "SRM_APP_DATABASE_HOST"
                  ? contract.neon.directHost
                  : env[k],
        ],
      ),
    );
  const verifyBindings = async (values) => {
    const dp = await paged(
      "/services/" + contract.development.renderServiceId + "/env-vars",
    );
    const dev = Object.fromEntries(
      dp.map((x) => [x.envVar.key, x.envVar.value]),
    );
    assertProductSecretIsolation(contract, values, dev);
    fail(
      contract.requiredSecrets.every((k) => values[k] === stageEnv()[k]),
      "Stage secrets differ from the approved operator bindings",
    );
    fail(
      contract.requiredConfiguration.every(
        (k) => values[k] && values[k] === stageEnv()[k],
      ),
      "Required Stage configuration absent",
    );
    fail(
      values.TARGET_ENVIRONMENT === "staging" &&
        values.SRM_NEON_PROJECT_ID === contract.neon.projectId &&
        values.SRM_NEON_BRANCH_ID === contract.neon.branchId &&
        values.SRM_APP_DATABASE_HOST === contract.neon.directHost &&
        values.SRM_STAGING_ORGANIZATION_ID !==
          dev.SRM_DEVELOPMENT_ORGANIZATION_ID &&
        !values.SRM_DEVELOPMENT_ORGANIZATION_ID &&
        !values.DATABASE_URL &&
        !values.SRM_APP_DATABASE_URL &&
        values.SRM_DEMO_PASSWORD.length >= 16 &&
        values.SRM_DEMO_SESSION_SECRET.length >= 32 &&
        ["raw", "bearer"].includes(values.MGBI_AUTH_SCHEME) &&
        new URL(values.VERCLY_API_BASE_URL).protocol === "https:",
      "Environment configuration isolation failed",
    );
  };
  const assertProtection = async (ge) => {
    assertStagingGitHubProtection(
      ge, contract, approval.mode === "onboard" ? approval.githubReviewerIds : null,
    );
    const b = await request(
      GH,
      repo +
        "/environments/srm-staging/deployment-branch-policies?per_page=100",
    );
    fail(
      b?.total_count === 1 &&
        b.branch_policies[0].name === "main" &&
        b.branch_policies[0].type === "branch",
      "Main-only deployment policy required",
    );
  };
  const snapshot = async () => {
    const capturedAt = new Date().toISOString();
    const project = await request(R, "/projects/" + contract.render.projectId),
      environment = await request(
        R,
        "/environments/" + contract.render.environmentId,
      );
    const rows = await paged(
      "/services?ownerId=" + contract.render.workspaceId,
    );
    const services = rows
      .map((x) => x.service ?? x)
      .filter((x) => x.environmentId === contract.render.environmentId);
    const branch = (
      await request(
        N,
        "/projects/" +
          contract.neon.projectId +
          "/branches/" +
          contract.neon.branchId,
      )
    )?.branch;
    const endpoints = (
      await request(N, "/projects/" + contract.neon.projectId + "/endpoints")
    )?.endpoints;
    const databases = (
      await request(
        N,
        "/projects/" +
          contract.neon.projectId +
          "/branches/" +
          contract.neon.branchId +
          "/databases",
      )
    )?.databases;
    const deployments =
      services.length === 1
        ? (await paged("/services/" + services[0].id + "/deploys")).map(
            (x) => x.deploy ?? x,
          )
        : [];
    const liveDeploy = assertDeploymentInventory(deployments, manifest.sha);
    const domains =
      services.length === 1
        ? await paged("/services/" + services[0].id + "/custom-domains")
        : [];
    for (const service of services) assertLifecycleService(service, manifest);
    const githubEnvironment = await request(
      GH,
      repo + "/environments/srm-staging",
    );
    const githubSecretMetadata = githubEnvironment
      ? await request(
          GH,
          repo + "/environments/srm-staging/secrets?per_page=100",
        )
      : null;
    fail(
      !githubSecretMetadata || githubSecretMetadata.total_count <= 100,
      "Incomplete protected secret snapshot",
    );
    const s = {
      source: "LIVE_PROVIDER_APIS",
      capturedAt,
      repository: await request(GH, repo),
      renderProject: project,
      renderEnvironment: environment,
      neonBranch: branch,
      neonEndpoint: endpoints?.find((x) => x.id === contract.neon.endpointId),
      databases,
      services,
      liveDeploy: liveDeploy ?? null,
      domains,
      githubEnvironment,
      githubSecretMetadata,
    };
    assertSnapshot(s, contract);
    return s;
  };
  const ledger = async (verifyCatalog = false) => {
    assertMigrationDestination(env);
    const c = new pg.Client({ connectionString: env.SRM_APP_DIRECT_URL });
    try {
      await c.connect();
      await c.query("BEGIN READ ONLY");
      const exists = (
        await c.query("SELECT to_regclass('srm.schema_migrations') AS x")
      ).rows[0].x;
      if (!exists) return [];
      if (verifyCatalog) await assertSchemaCatalog(c);
      return (
        await c.query(
          "SELECT version,checksum_sha256 AS checksum FROM srm.schema_migrations ORDER BY version",
        )
      ).rows;
    } finally {
      await c.query("ROLLBACK").catch(() => {});
      await c.end();
    }
  };
  const pin = async () => {
    const pointer = releasePointer(manifest.sha);
    let ref = await request(GH, repo + "/git/ref/heads/" + pointer);
    if (!ref) {
      await request(GH, repo + "/git/refs", "POST", {
        ref: "refs/heads/" + pointer,
        sha: manifest.sha,
      });
      ref = await request(GH, repo + "/git/ref/heads/" + pointer);
    }
    fail(ref.object.sha === manifest.sha, "Release pointer drift");
    await request(GH, repo + "/branches/" + pointer + "/protection", "PUT", {
      required_status_checks: null,
      enforce_admins: true,
      required_pull_request_reviews: null,
      restrictions: null,
      required_linear_history: true,
      allow_force_pushes: false,
      allow_deletions: false,
      lock_branch: true,
    });
    const protection = await request(
      GH,
      repo + "/branches/" + pointer + "/protection",
    );
    fail(
      protection.lock_branch?.enabled &&
        protection.enforce_admins?.enabled &&
        !protection.allow_force_pushes?.enabled &&
        !protection.allow_deletions?.enabled,
      "Immutable source pointer protection unavailable",
    );
    return { pointer, sha: manifest.sha };
  };
  const pinned = async () => {
    const p = releasePointer(manifest.sha);
    const ref = await request(GH, repo + "/git/ref/heads/" + p),
      b = await request(GH, repo + "/branches/" + p + "/protection");
    return !!(
      ref?.object?.sha === manifest.sha &&
      b?.lock_branch?.enabled &&
      b.enforce_admins?.enabled &&
      !b.allow_force_pushes?.enabled &&
      !b.allow_deletions?.enabled
    );
  };
  const verifyService = (s) => assertLifecycleService(s, manifest);

  const mutationFence = async (operation) => {
    assertLifecycleAuthorization(approval, manifest, contract);
    lifecyclePreflight(manifest.sha, approval.approvalId);
    const current = await store.read(),
      s = await snapshot();
    assertOperation({
      operation,
      authorization: approval,
      manifest,
      contract,
      registry: current.registry,
      snapshot: s,
      journal: current.state,
      owner,
    });
  };
  const bindingsProof = async () => {
    const value = await request(
      GH,
      repo + "/environments/srm-staging/variables/SRM_RELEASE_BINDING_RECEIPT",
    );
    if (!value) return null;
    const receipt = JSON.parse(value.value),
      ge = await request(GH, repo + "/environments/srm-staging");
    fail(
      receipt.environmentId === ge?.id,
      "Secret binding environment identity drift",
    );
    const rows = await request(
      GH,
      repo + "/environments/srm-staging/secrets?per_page=100",
    );
    fail(rows.total_count <= 100, "Incomplete secret metadata");
    const keys = [
      ...contract.requiredSecrets,
      "SRM_APP_DIRECT_URL",
      "SRM_RELEASE_GITHUB_TOKEN",
      "RENDER_API_KEY",
      "NEON_API_KEY",
    ];
    fail(
      keys.every(
        (k) =>
          receipt.updates[k] ===
          rows.secrets.find((x) => x.name === k)?.updated_at,
      ),
      "Secret metadata changed after publication",
    );
    for (const name of contract.requiredConfiguration) {
      const v = await request(
        GH,
        repo + "/environments/srm-staging/variables/" + name,
      );
      fail(v?.value === stageEnv()[name], "Environment variable binding drift");
    }
    return receipt;
  };
  const provider = {
    store,
    authority: lifecyclePreflight,
    snapshot,

    async preparationPreflight(snapshot) {
      assertMigrationDestination(env);
      initializationConfig(env);
      await verifyBindings(stageEnv());
      fail(
        ["RENDER_API_KEY", "NEON_API_KEY", "SRM_RELEASE_GITHUB_TOKEN"].every(
          (k) => env[k],
        ),
        "Management credentials missing",
      );
      if (approval.mode === "onboard")
        fail(
          spawnSync("gh", ["--version"], { encoding: "utf8" }).status === 0,
          "Official GitHub CLI required for encrypted environment secret upload",
        );
      if (snapshot.services[0]) {
        const values = Object.fromEntries(
          (
            await paged("/services/" + snapshot.services[0].id + "/env-vars")
          ).map((x) => [x.envVar.key, x.envVar.value]),
        );
        await verifyBindings(values);
      }
    },
    async githubBindings() {
      fail(
        approval.mode === "onboard",
        "Existing environment binding drift requires a separate approved repair",
      );
      const keys = [
        ...contract.requiredSecrets,
        "SRM_APP_DIRECT_URL",
        "SRM_RELEASE_GITHUB_TOKEN",
        "RENDER_API_KEY",
        "NEON_API_KEY",
      ];
      for (const key of keys) {
        await mutationFence("github-bindings");
        const q = spawnSync(
          "gh",
          [
            "secret",
            "set",
            key,
            "--repo",
            contract.repository,
            "--env",
            "srm-staging",
          ],
          {
            input: env[key],
            env: {
              ...env,
              GH_TOKEN: env.SRM_RELEASE_GITHUB_TOKEN,
              GH_DEBUG: "",
              GH_PROMPT_DISABLED: "1",
            },
            encoding: "utf8",
          },
        );
        fail(q.status === 0, "Encrypted environment secret upload rejected");
      }
      for (const [name, value] of Object.entries(stageEnv()).filter(([name]) =>
        contract.requiredConfiguration.includes(name),
      )) {
        const existing = await request(
          GH,
          repo + "/environments/srm-staging/variables/" + name,
        );
        await request(
          GH,
          repo +
            "/environments/srm-staging/variables" +
            (existing ? "/" + name : ""),
          existing ? "PATCH" : "POST",
          { name, value },
        );
      }
      const rows = await request(
        GH,
        repo + "/environments/srm-staging/secrets?per_page=100",
      );
      fail(rows.total_count <= 100, "Incomplete secret metadata");
      const updates = Object.fromEntries(
        keys.map((k) => [
          k,
          rows.secrets.find((x) => x.name === k)?.updated_at,
        ]),
      );
      fail(
        Object.values(updates).every(Boolean),
        "Incomplete secret publication acknowledgement",
      );
      const receipt = {
        approvalId: approval.approvalId,
        environmentId: (await request(GH, repo + "/environments/srm-staging"))
          .id,
        updates,
      };
      const existing = await request(
        GH,
        repo +
          "/environments/srm-staging/variables/SRM_RELEASE_BINDING_RECEIPT",
      );
      await request(
        GH,
        repo +
          "/environments/srm-staging/variables" +
          (existing ? "/SRM_RELEASE_BINDING_RECEIPT" : ""),
        existing ? "PATCH" : "POST",
        { name: "SRM_RELEASE_BINDING_RECEIPT", value: JSON.stringify(receipt) },
      );
      return { secretNames: keys, receipt };
    },
    async executorStopped(previous) {
      if (previous.startsWith("github-run:")) {
        const r = await request(
          GH,
          repo + "/actions/runs/" + previous.slice(11),
        );
        return r?.status === "completed";
      }
      if (previous.startsWith("codespace:")) {
        const cs = await request(GH, "/user/codespaces/" + previous.slice(10));
        return cs?.state === "Shutdown";
      }
      return false;
    },
    async githubEnvironment(s, a) {
      if (!s.githubEnvironment)
        await request(GH, repo + "/environments/srm-staging", "PUT", {
          wait_timer: 0,
          prevent_self_review: true,
          reviewers: a.githubReviewerIds.map((id) => ({ type: "User", id })),
          deployment_branch_policy: {
            protected_branches: false,
            custom_branch_policies: true,
          },
        });
      const existing = await request(
        GH,
        repo +
          "/environments/srm-staging/deployment-branch-policies?per_page=100",
      );
      if (existing?.total_count === 0)
        await request(
          GH,
          repo + "/environments/srm-staging/deployment-branch-policies",
          "POST",
          { name: "main", type: "branch" },
        );
      await assertProtection(
        await request(GH, repo + "/environments/srm-staging"),
      );
      return { protected: true };
    },
    pinSource: pin,
    async database(s) {
      fail(
        !s.databases.some((x) => x.name === "srm_app"),
        "Existing database is observed, never overwritten",
      );
      return request(
        N,
        "/projects/" +
          contract.neon.projectId +
          "/branches/" +
          contract.neon.branchId +
          "/databases",
        "POST",
        { database: { name: "srm_app", owner_name: "neondb_owner" } },
      );
    },
    async schema(mode) {
      assertMigrationDestination(env);
      if (mode === "rollback") {
        fail(
          digest(await ledger(true)) === digest(manifest.migrations),
          "Rollback schema incompatible",
        );
        return { compatible: true };
      }
      const c = new pg.Client({ connectionString: env.SRM_APP_DIRECT_URL });
      try {
        await c.connect();
        return await runMigrations(c, {
          initialize:
            approval.mode === "onboard" ? initializationConfig(env) : null,
        });
      } finally {
        await c.end();
      }
    },
    async service() {
      await verifyBindings(stageEnv());
      fail(
        await pinned(),
        "Frozen source must be protected before service creation",
      );
      return request(
        R,
        "/services",
        "POST",
        renderServicePayload(manifest, stageEnv(), approval.approvalId),
      );
    },
    async deploy(s, m) {
      const srv = s.services[0];
      verifyService(srv);
      const rows = await paged("/services/" + srv.id + "/deploys");
      const retry = deployRetryEvidence(
        rows,
        m,
        approval,
        (await store.read()).state.release.steps.deploy,
      );
      if (srv.branch !== "main")
        fail(
          rows.length > 0,
          "Initial provider deployment not observed; never trigger blindly",
        );
      let d = selectReusableDeploy(rows, m.sha);
      if (srv.branch !== "main")
        fail(
          (await pinned()) &&
            rows.every((x) => (x.deploy ?? x).commit?.id === m.sha),
          "Initial deployment source not pinned",
        );
      if (!d) {
        fail(retry.canCreate, "Authorized deployment attempt budget exhausted");
        d = await request(R, "/services/" + srv.id + "/deploys", "POST", {
          commitId: m.sha,
          clearCache: "do_not_clear",
        });
      }
      for (let i = 0; i < 240 && d.status !== "live"; i++) {
        fail(
          ![
            "build_failed",
            "update_failed",
            "canceled",
            "pre_deploy_failed",
            "deactivated",
          ].includes(d.status),
          "Deployment failed; preserve schema and evidence",
        );
        await new Promise((r) => setTimeout(r, 5000));
        d = await request(R, "/services/" + srv.id + "/deploys/" + d.id);
      }
      fail(
        d.status === "live" && d.commit?.id === m.sha,
        "Wrong or unverified deployed SHA",
      );
      return { deployId: d.id, sha: d.commit.id };
    },
    async rebind(s) {
      const srv = s.services[0];
      verifyService(srv);
      fail(
        s.liveDeploy?.status === "live" &&
          s.liveDeploy.commit.id === manifest.sha,
        "Initial source must be verified before rebind",
      );
      if (srv.branch !== "main")
        await request(R, "/services/" + srv.id, "PATCH", {
          branch: "main",
          autoDeployTrigger: "off",
        });
      return { branch: "main", autoDeploy: "off" };
    },
    async verify(s, m, writeProbe = false) {
      assertSnapshot(s, contract);
      const domainBindings = assertStagingDomainBinding(s, contract);
      const srv = s.services[0];
      assertRenderService(srv);
      await assertProtection(s.githubEnvironment);
      fail(await bindingsProof(), "GitHub protected bindings proof missing");
      const values = Object.fromEntries(
        (await paged("/services/" + srv.id + "/env-vars")).map((x) => [
          x.envVar.key,
          x.envVar.value,
        ]),
      );
      await verifyBindings(values);
      fail(
        digest(await ledger(true)) === digest(m.migrations),
        "Schema ledger drift",
      );
      const runtime = await verifyRuntimeDatabase(env);
      const u = srv.serviceDetails.url;
      assertApprovedRuntimeUrl(u);
      fail(
        new URL(u).protocol === "https:" &&
          new URL(u).hostname === srv.slug + ".onrender.com",
        "Provider runtime URL mismatch",
      );
      const h = await fetcher(u + "/api/health", {
        signal: AbortSignal.timeout(30000),
      });
      const v = await h.json();
      fail(
        h.status === 200 && v.service === "srm" && v.environment === "staging",
        "Health verification failed",
      );
      await verifyPasswordSmoke(u, env.SRM_DEMO_PASSWORD, fetcher);
      await persistenceProbe(env, approval.approvalId, writeProbe);
      return {
        source: "LIVE_RUNTIME_AND_SQL",
        sha: s.liveDeploy.commit.id,
        deployId: s.liveDeploy.id,
        serviceId: srv.id,
        branchId: contract.neon.branchId,
        databaseId: s.databases.find((x) => x.name === "srm_app").id,
        githubEnvironmentId: s.githubEnvironment.id,
        domainBindings,
        configuration: "PASS",
        githubProtection: "PASS",
        schema: "PASS",
        runtimeRole: runtime.role,
        tenantIsolation: runtime.tenant,
        health: "PASS",
        authentication: "PASS",
        persistence: "PASS",
        migrations: await ledger(),
      };
    },
    async observe(op, s, j, m, a) {
      const srv = s.services[0],
        db = s.databases.find((x) => x.name === "srm_app");
      if (srv) verifyService(srv);
      if (op === "github-bindings") {
        const receipt = await bindingsProof();
        return { complete: !!receipt, result: { receipt } };
      }
      if (op === "github-environment") {
        if (!s.githubEnvironment) return { complete: false };
        try {
          await assertProtection(s.githubEnvironment);
        } catch {
          const g = s.githubEnvironment;
          fail(
            g.protection_rules?.some((x) => x.type === "required_reviewers") &&
              g.deployment_branch_policy?.custom_branch_policies,
            "Unsafe partial GitHub environment",
          );
          return { complete: false };
        }
        return {
          complete: true,
          result: { id: s.githubEnvironment.id },
          resources: { githubEnvironmentId: s.githubEnvironment.id },
        };
      }
      if (op === "release-pointer")
        return {
          complete: await pinned(),
          result: { pointer: releasePointer(m.sha) },
        };
      if (op === "database")
        return {
          complete: !!db,
          result: db ? { id: db.id } : null,
          resources: db ? { databaseId: db.id } : {},
        };
      if (op === "schema") {
        if (!db) return { complete: false };
        const rows = await ledger();
        const complete = digest(rows) === digest(m.migrations);
        if (complete) await ledger(true);
        return { complete, result: { migrations: rows } };
      }
      if (op === "service") {
        if (!srv) return { complete: false };
        verifyService(srv);
        const vars = Object.fromEntries(
          (await paged("/services/" + srv.id + "/env-vars")).map((x) => [
            x.envVar.key,
            x.envVar.value,
          ]),
        );
        await verifyBindings(vars);
        if (
          !j.release.resources.serviceId &&
          (await store.read()).registry.environments.staging.status ===
            "RESERVED"
        )
          fail(
            vars.SRM_RELEASE_OPERATION_ID === a.approvalId &&
              srv.branch === releasePointer(m.sha) &&
              (await pinned()),
            "Unregistered service does not belong to this creation intent",
          );
        return {
          complete: true,
          result: { id: srv.id },
          resources: { serviceId: srv.id },
        };
      }
      if (op === "deploy") {
        const rows = srv ? await paged("/services/" + srv.id + "/deploys") : [];
        if (srv?.branch !== "main")
          fail(
            (await pinned()) &&
              rows.every((x) => (x.deploy ?? x).commit?.id === m.sha),
            "Initial deployment history or pointer drift",
          );
        const d = selectReusableDeploy(rows, m.sha);
        return {
          complete:
            s.liveDeploy?.status === "live" && s.liveDeploy.commit.id === m.sha,
          recoverable: deployRetryEvidence(rows, m, a, j.release.steps.deploy)
            .recoverable,
          result: { deployId: s.liveDeploy?.id, sha: s.liveDeploy?.commit.id },
        };
      }
      if (op === "source-rebind")
        return {
          complete: srv?.branch === "main" && srv.autoDeployTrigger === "off",
          result: { branch: "main" },
        };
      if (op === "verify") {
        if (!j.release.steps.verify) return { complete: false };
        try {
          return { complete: true, result: await provider.verify(s, m) };
        } catch (e) {
          if (
            j.release.steps.verify.status === "INTENT" &&
            e.message ===
              "Durable probe absent; write requires verified operation gate"
          )
            return { complete: false, recoverable: true };
          throw e;
        }
      }
      return { complete: false };
    },
  };
  return provider;
}
export async function assertSchemaCatalog(client) {
  const expected = [
    ...new Set(
      migrationManifest().flatMap((m) =>
        [
          ...m.sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? srm\.([a-z_]+)/g),
        ].map((x) => x[1]),
      ),
    ),
  ]
    .filter((x) => x !== "schema_migrations")
    .sort();
  const rows = (
    await client.query(
      "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind IN ('r','p') AND c.relname<>'schema_migrations' ORDER BY c.relname",
    )
  ).rows;
  fail(
    digest(rows.map((x) => x.relname)) === digest(expected) &&
      rows.every((x) => x.relrowsecurity && x.relforcerowsecurity),
    "Product catalog or FORCE RLS drift",
  );
  return true;
}
export async function runPersistenceProbe(
  c,
  organizationId,
  approvalId,
  writeProbe = false,
) {
  const id = createProbeId(approvalId);
  fail(
    ["srm_app", "srm_migration_test"].includes(
      (await c.query("SELECT current_database() AS name")).rows[0]?.name,
    ),
    "Probe product database identity mismatch",
  );
  try {
    await c.query(writeProbe ? "BEGIN" : "BEGIN READ ONLY");
    await c.query("SELECT set_config('srm.organization_id',$1,true)", [
      organizationId,
    ]);
    if (writeProbe)
      await c.query(
        "INSERT INTO srm.lookup_requests(id,organization_id,identifier_type,identifier) VALUES ($1,$2,'KRS','0000000000') ON CONFLICT (organization_id,id) DO NOTHING",
        [id, organizationId],
      );
    else
      fail(
        (await c.query("SELECT id FROM srm.lookup_requests WHERE id=$1", [id]))
          .rows.length === 1,
        "Durable probe absent; write requires verified operation gate",
      );
    await c.query(writeProbe ? "COMMIT" : "ROLLBACK");
    await c.query("BEGIN READ ONLY");
    await c.query("SELECT set_config('srm.organization_id',$1,true)", [
      organizationId,
    ]);
    fail(
      (await c.query("SELECT id FROM srm.lookup_requests WHERE id=$1", [id]))
        .rows.length === 1,
      "Durable runtime write proof missing",
    );
    await c.query("ROLLBACK");
    await c.query("BEGIN READ ONLY");
    fail(
      (await c.query("SELECT id FROM srm.lookup_requests WHERE id=$1", [id]))
        .rows.length === 0,
      "RLS without tenant context failed",
    );
    await c.query("ROLLBACK");
    await c.query("BEGIN READ ONLY");
    await c.query("SELECT set_config('srm.organization_id',$1,true)", [
      organizationId === "00000000-0000-4000-8000-000000000009"
        ? "00000000-0000-4000-8000-000000000008"
        : "00000000-0000-4000-8000-000000000009",
    ]);
    fail(
      (await c.query("SELECT id FROM srm.lookup_requests WHERE id=$1", [id]))
        .rows.length === 0,
      "Foreign tenant access failed",
    );
    await c.query("ROLLBACK");
    return { persisted: true, synthetic: true, recordId: id };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  }
}
export async function persistenceProbe(env, approvalId, writeProbe = false) {
  assertMigrationDestination(env);
  const u = new URL(
    "postgresql://srm_app_runtime@" +
      contract.neon.directHost +
      "/srm_app?sslmode=require",
  );
  u.password = env.SRM_APP_DATABASE_PASSWORD;
  const c = new pg.Client({ connectionString: u.toString() });
  try {
    await c.connect();
    return await runPersistenceProbe(
      c,
      env.SRM_STAGING_ORGANIZATION_ID,
      approvalId,
      writeProbe,
    );
  } finally {
    await c.end();
  }
}
const createProbeId = (x) => {
  const h = digest(x);
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-4" +
    h.slice(13, 16) +
    "-a" +
    h.slice(17, 20) +
    "-" +
    h.slice(20, 32)
  );
};
export async function lifecycleApply(authorization, env = process.env) {
  const source = authorization.manifest;
  assertLifecycleAuthorization(authorization, source, contract);
  promotionExecutorEnvironment(env);
  verifyLifecycleSource(source.sha);
  const owner =
    env.GITHUB_ACTIONS === "true"
      ? "github-run:" + env.GITHUB_RUN_ID
      : "codespace:" + env.CODESPACE_NAME;
  const p = createProvider(env, authorization, source, owner);
  const gh = env.SRM_RELEASE_GITHUB_TOKEN;
  fail(gh, "Scoped GitHub management credential required");
  const response = await fetch(
    GH + repo + "/commits/" + source.sha + "/check-runs?per_page=100",
    {
      headers: { Authorization: "Bearer " + gh },
      signal: AbortSignal.timeout(30000),
    },
  );
  fail(response.ok, "CI verification unavailable");
  const ci = await response.json(),
    check = ci.check_runs
      .filter((x) => x.name === "srm-build" && x.head_sha === source.sha)
      .sort((a, b) => b.id - a.id)[0];
  fail(
    ci.total_count <= 100 && check?.conclusion === "success",
    "Latest exact source CI required",
  );
  const previous = await p.store.read(),
    prior = previous.state.release;
  const devResponse = await fetch(
    R +
      "/services/" +
      contract.development.renderServiceId +
      "/deploys?limit=100",
    {
      headers: { Authorization: "Bearer " + env.RENDER_API_KEY },
      signal: AbortSignal.timeout(30000),
    },
  );
  fail(devResponse.ok, "Development provenance unavailable");
  const rows = (await devResponse.json()).map((x) => x.deploy ?? x);
  let development = rows.find(
    (x) => x.status === "live" && x.commit?.id === source.sha,
  );
  if (authorization.mode === "rollback") {
    fail(
      prior?.lastKnownGood?.sha === source.sha,
      "Rollback must target the recorded last known good Stage release",
    );
    development = rows.find(
      (x) =>
        ["live", "deactivated"].includes(x.status) &&
        x.commit?.id === source.sha,
    );
  }
  if (
    !development &&
    prior?.approvalId === authorization.approvalId &&
    prior.manifestDigest === digest(source) &&
    prior.sourceProof?.source === "LIVE_GITHUB_RENDER" &&
    prior.sourceProof.sha === source.sha
  ) {
    const historic = await fetch(
      R +
        "/services/" +
        contract.development.renderServiceId +
        "/deploys/" +
        prior.sourceProof.developmentDeployId,
      {
        headers: { Authorization: "Bearer " + env.RENDER_API_KEY },
        signal: AbortSignal.timeout(30000),
      },
    );
    fail(historic.ok, "Recorded Development release evidence unavailable");
    const d = await historic.json();
    if (
      ["live", "deactivated"].includes(d.status) &&
      d.commit?.id === source.sha
    )
      development = d;
  }
  fail(
    development?.id,
    "Accepted Development release provenance is unavailable",
  );
  p.sourceProof = {
    source: "LIVE_GITHUB_RENDER",
    sha: source.sha,
    ciCheckId: check.id,
    developmentDeployId: development.id,
    developmentServiceId: contract.development.renderServiceId,
    capturedAt: new Date().toISOString(),
  };
  return runLifecycle({ authorization, manifest: source, provider: p, owner });
}
export function renderServicePayload(manifest, values, approvalId) {
  fail(
    /^[a-f0-9]{40}$/.test(manifest.sha) && approvalId,
    "Exact first source and creation identity required",
  );
  const c = contract.render;
  return {
    type: "web_service",
    name: c.serviceName,
    ownerId: c.workspaceId,
    environmentId: c.environmentId,
    repo: "https://github.com/" + contract.repository,
    branch: releasePointer(manifest.sha),
    autoDeployTrigger: "off",
    rootDir: c.rootDir,
    envVars: Object.entries({
      ...values,
      SRM_RELEASE_OPERATION_ID: approvalId,
    }).map(([key, value]) => ({ key, value })),
    serviceDetails: {
      runtime: "node",
      region: c.region,
      plan: c.plan,
      numInstances: 1,
      healthCheckPath: c.healthCheckPath,
      previews: { generation: "off" },
      envSpecificDetails: {
        buildCommand: c.buildCommand,
        startCommand: c.startCommand,
      },
    },
  };
}

export function deployRetryEvidence(rows, manifest, approval, intent = null) {
  const list = rows.map((x) => x.deploy ?? x),
    inflight = [
      "created",
      "build_in_progress",
      "pre_deploy_in_progress",
      "update_in_progress",
    ];
  fail(
    !list.some(
      (x) => inflight.includes(x.status) && x.commit?.id !== manifest.sha,
    ),
    "Concurrent foreign deployment",
  );
  const relevant = list.filter(
    (x) =>
      x.commit?.id === manifest.sha &&
      (approval.mode === "onboard" ||
        !intent ||
        Date.parse(x.createdAt) >= Date.parse(intent.before?.capturedAt)),
  );
  const failed = relevant.filter((x) =>
    ["build_failed", "update_failed", "pre_deploy_failed", "canceled"].includes(
      x.status,
    ),
  );
  const limit = approval.budget.maxDeploymentAttempts;
  return {
    recoverable:
      !!selectReusableDeploy(rows, manifest.sha) ||
      (failed.length > 0 && relevant.length < limit),
    canCreate: relevant.length < limit,
    attempts: relevant.length,
  };
}

export function assertLifecycleService(s, m) {
  assertRenderService({
    ...s,
    branch: s?.branch === releasePointer(m.sha) ? "main" : s?.branch,
  });
  fail(
    s.name === contract.render.serviceName &&
      !s.serviceDetails.disk &&
      !s.serviceDetails.autoscaling?.enabled &&
      s.suspended === "not_suspended",
    "Unexpected service name, storage, scaling or suspended state",
  );
  return true;
}

export function assertDeploymentInventory(rows, sha) {
  fail(
    rows.filter((x) => x.status === "live").length <= 1,
    "Ambiguous live deployments",
  );
  fail(
    !rows.some(
      (x) =>
        [
          "created",
          "queued",
          "build_in_progress",
          "pre_deploy_in_progress",
          "update_in_progress",
        ].includes(x.status) && x.commit?.id !== sha,
    ),
    "Foreign deployment in progress",
  );
  return rows.find((x) => x.status === "live") ?? null;
}
