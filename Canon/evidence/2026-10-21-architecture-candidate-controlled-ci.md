# B1-CI — bounded Architecture producer admission

Date: 2026-10-21. Profile **ARCHITECTURE**, workspace **SG-dev Architecture**, target **development**, execution **local**. Repository authority **profitia/SG-dev / main**, base **39d0aadfafa621c214a69ac1b7f666a8220a51b1**. Task **ARCHITECTURE-IDENTITY-B1-CI-20261021**. Branch **architecture/identity-b1-ci-20261021**.

## Authority and scope

The owner-supplied B1-CI task authorizes a bounded CI corrective and a separate draft PR, with no automatic merge. Its explicit ARCHITECTURE profile selects the existing Architecture adapter/PMOS/PHR; the supplied SG2 wrapper contributes common safeguards, not SG2 continuity. Root AGENTS, the active manifest and 33 ordered CORE/ARCHITECTURE documents were loaded/checked; all five declared targets route to Governance Source Layer, ALIGNED, ARCHITECTURE allowed. Full preflight passed before registration and again with require-begin before edits; no bypass flags.

Canonical begin registration **cmvi5g2dm0000ab3puu5j9b42**, conversation **pmos-task-v2:2d7e5645bc38111e8fa99e074d46449a399eca34bbbaa954f52dfc35478b0ece**, actual host **01a15aed-8d94-7fe0-9cff-c54f72b5f8a8**. Own Architecture PMOS uses **billowing-credit-07394675 / architecture_pmos / architecture_pmos_runtime**, registered endpoint, dedicated checkout/artifacts/context and PHR clone. MEMOROS is DISABLED_BY_PROFILE.

This changes governance admission, not product identity/data authorization. The data are public repository paths, owner/profile metadata and sanitized isolated CI proof. Architecture Platform controls producer source; SG2/SRM retain consumer ownership. No user ID, organisation, membership, PII, product grant, session or application database changes. Actual task/conversation identities are continuity keys, never product identities.

Exact changed paths:

1. scripts/governance/controlled-package-ci.mjs
2. scripts/governance/controlled-package-ci.test.mjs
3. scripts/governance/controlled-package-ci-path-coverage.test.mjs
4. .github/workflows/platform-contracts-ci.yml
5. Canon/evidence/2026-10-21-architecture-candidate-controlled-ci.md

No B1 implementation, consumer, registry, secret or provider configuration is changed. PR591 remains untouched at **c92490fc6f91b66b8722a57928966afb2bf8c390**.

## Root cause and choice

Trusted-main run [39602983787](https://github.com/profitia/SG-dev/actions/runs/39602983787) rejected the B1 Architecture branch as UNTRUSTED_CANDIDATE before candidate execution. The original selectCandidate only admitted internal sg2/ branches. PR integration [39602432551](https://github.com/profitia/SG-dev/actions/runs/39602432551) consequently lacked an exact-candidate proof. B1 continuity publication **f2b1ada9afd31ce038dcce819353a26771fb1936** remains unchanged.

| Variant | Assessment |
| --- | --- |
| Accept every architecture/ branch | Rejected: prefix gives no evidence of actual ownership/scope and could expose consumers or the control plane. |
| Separate privileged workflow | Rejected for this bounded change: duplicates credential/environment/proof control and adds another maintenance boundary. |
| Existing controller plus bounded producer admission | Selected: reuse trusted-main execution and existing proof, add authoritative complete file ownership checks and exact checkout binding. |

## Admission and end-to-end chain

1. **selectCandidate:** exact original main-only context, repository profitia/SG-dev, owner actor/triggering actor, open owner-authored internal PR to main and exact 40-character head SHA. Original sg2/ admission remains a separate branch with unchanged conditions. architecture/ additionally requires complete trusted files and routing; prefix alone fails.
2. **resolve:** controller calls GitHub PR and paginated files APIs itself. At most300 files, pages100 each, with an extra page to detect overflow. Missing API, short/inconsistent count, duplicate filenames, malformed SHA/status and renamed/copied entries fail closed. Metadata is read again to reject head, base, family or count drift during pagination. Candidate declarations do not supply the allowlist or ownership.
3. **Scope:** only packages/platform-contracts source MJS/declarations, SQL migration candidates, MJS/MTS/JSON test fixtures, package.json/package-lock.json/README.md and dated Markdown in Canon/evidence. At least one producer file required. Hidden files, dot/traversal/ambiguous paths and all apps, other packages, scripts, workflows, registries and protected configuration are refused. Renames are deliberately unsupported; no previous_filename exception.
4. **Ownership:** the trusted-main project profile and canonical resolveProjectRouting resolve every allowed exact path. ARCHITECTURE must be ALLOWED, state ALIGNED, owner Architecture Platform for package source or Governance Source Layer for evidence. NO_MATCH, conflict, owner/profile/state drift or a substituted routing registry denies admission. No routing right is granted to a consumer.
5. **check-candidate:** compare complete GitHub file list against the actual triple-dot Git diff from the captured base to pinned head. Verify each present changed blob SHA, file mode, actual contents, real path and bounded regular-file size. Reject an omitted consumer mutation, symlink/submodule, source replacement or missing/deleted-file mismatch. This repeats before installation and proof. Only trusted control code and data readers execute before credentials; no candidate JavaScript is imported for admission.
6. **Credential phase:** existing environment identity/main-only policy, exact package names/private pins/integrity, local manifests, npm configuration, token owner/read-only scope/finite expiry and clean install with lifecycle disabled remain unchanged. No new credential or environment is created.
7. **Execution:** unchanged workflow ends the credential-bearing step before lifecycle/tests/typecheck/build. All four credential variables remain empty. Tests use the existing isolated synthetic PostgreSQL fixture; no deployment or product DB connection.
8. **proof / verify:** existing sanitized exact-head proof format, complete-run requirement, current environment verification, source receipt and policy provenance are unchanged. Producer admission is not an SG2 adoption claim. Trusted profile/routing readers and their actual registries join the controlPolicyDigest, alongside original workflow/controller/topology. The verifier fetches those exact files at the run control SHA and compares with current authority. An old-policy proof is invalidated; no old-digest exception.

The workflow change is limited to path filters for these new trusted inputs and its candidate input description. The privileged job, credential/environment settings, token step, execution and proof steps are byte-identical to authority main. Eight fingerprint inputs are covered by both pull_request and push filters; push stays main-only. No continue-on-error, fabricated proof, generic prefix waiver or bypass is added.

The original internal-owner trust model remains: this does not claim isolation from a malicious administrator/knowingly approved internal candidate. It does prevent the newly admitted Architecture path from editing consumers/control policy, and preserves removal of credentials before candidate execution.

## Regression and bounded B1 check

- Controller and workflow coverage: **70/70 PASS**, no skipped tests.
- Entire governance/classifier test set: **296/296 PASS**, no skipped tests. This includes the controller tests; counts are not additive.
- Syntax and manifest validation PASS. Existing credential/package/proof guard block, installation/proof/verification implementation and privileged workflow job were compared byte-for-byte against origin/main and remain identical; hashes are in the execution evidence.
- Positive: exact internal Architecture producer source/ownership; unchanged SG2 and main; complete107-file pagination; real pinned Git checkout/blob; proof bound to the selected exact SHA.
- Negative: fork/author/base/head/workflow/actor, missing/duplicate/truncated/oversized API listing, metadata race, owner/project/state drift, SG2/SRM/app/control/workflow/registry/configuration changes, rename/traversal, hidden Git diff, changed working file and symbolic link.
- Existing actual synthetic npm lifecycle tests still prove no lifecycle executes with a credential present. Broader/expired credential, altered package pins/aliases, wrong/missing/stale/incomplete proof and proof generation with a credential are rejected.
- Read-only evaluation of GitHub's actual16-file B1 list and the existing pinned B1 checkout passes new selection and Git/blob checks. **This is local static admission testing, not a trusted-main B1 CI run, not candidate execution and not a new SG2 proof.**

The corrective itself changes control-plane files, so it intentionally cannot enter the bounded Architecture producer credential path. A public PR check seeking an exact controlled proof can remain blocked until this policy is separately accepted on main. Never broaden the producer scope to make its own controller PR pass and never present local tests as that proof.

## Owner action and controlled resumption

1. Owner reviews this separate draft PR and exact source SHA/test evidence. No merge is performed by this task. No secret rotation/resource creation is requested.
2. After explicit separate acceptance and merge, refresh authority and verify accepted controller ancestry/digest. Do not assume merge SHA equals source SHA. The new fingerprint requires fresh proofs; do not reuse older successful runs.
3. Independently re-read PR591, require internal repository/main and the owner's still-intended exact head. Current expected B1 source is c92490fc6f91b66b8722a57928966afb2bf8c390. If it changes, stop and identify/review the new source; do not silently validate stale or unreviewed code.
4. Dispatch the existing platform-contracts-ci.yml from main, mode validate-sg2, candidate_pr591, expected_sha matching that exact approved source. Wait for actual producer and controlled SG2 success. Read the sanitized sg2-controlled-operation-proof and verify candidate/control/run IDs, new policy digest, tests/typecheck/build and credential-removal/no-deployment flags.
5. Only after the exact proof exists, rerun the failed public B1 verifier and independently confirm complete B1 PR CI, producer validation, SG2/SRM compatibility. A missing/failed job is not PASS. B1 itself remains draft/unmerged unless the owner separately authorizes its review/merge.

No main dispatch against the new policy is performed before merge. No B1 PR edit, rerun, source update or continuity rewrite. No installation, B2, new GitHub/Neon/Render/Clerk resource, product DB write or deployment.

## Rollback and continuity boundary

The owner can withdraw an accepted CI change through a normal reviewed revert; no product/data rollback is needed. Historical proof/PMOS/PHR records remain preserved. A changed policy fingerprint still requires fresh validation, never retroactive artifact edits. No secret is removed or rotated as part of source rollback.

Canonical ARCHITECTURE closeout is performed after factual source/PR validation; its final receipt must independently confirm persisted Flight Record/HANDOFF, PHR publication reachable from remote main, bundle integrity, pending CLEAR, file/advisory locks CLEAR and full final preflight. This source document does not assert success of its own future publication.

```text
TASK_B1_CI_VERDICT = PARTIAL (source prepared; acceptance/main activation and B1 revalidation pending)
ARCHITECTURE_CANDIDATE_ADMISSION = PREPARED
SG2_EXISTING_POLICY_PRESERVED = YES
SECRET_BOUNDARIES_PRESERVED = YES
CONTROLLER_REGRESSION = PASS
CI_CORRECTIVE_MERGED = NO
B1_PR_591_MUTATED = NO
B1_CANDIDATE_REVALIDATED = NO
DATABASE_MUTATED = NO (product databases; own PMOS continuity is required)
DEPLOYMENT_PERFORMED = NO
NEXT_RECOMMENDED_TASK = B1 Source Review & Installation Readiness
```
