# ADP governance CI admission — pinned proposal, activation pending

Date: **2026-10-27**. Authority: **profitia/SG-dev/main**.
Profile/task: **SG2 / SG-dev / development**, `SG2-ADP-GOVERNANCE-CI-ADMISSION-PROPOSAL-20261027`.
Host conversation: `01a17d49-61a6-7821-ba8e-18b45d3c4048`.
Authority baseline: `acbc37b278a16a9e4c47f794e3eb7577d42f21d6`.

## Actual blocking evidence

The human owner approved the ADP architecture of PR #756, including the two SRM-only public surfaces, NATIVE VIEW, presentation contract v1.0.0, separate producer/consumer tasks and dashboard routes. That approval explicitly excludes skipped CI, automatic merge and product deployment. The approval was recorded in PR #756 source commit `202bcd0b4c7e00a03a2a7eee9aeb38338363f3d0`; its governance suite passed24/24 again. Full applicable ARCHITECTURE exact-path/runtime/require-begin gates passed on that clean source.

The requested trusted-main controlled workflow was actually dispatched for **candidate_pr756 / expected_sha202bcd0b4c7e00a03a2a7eee9aeb38338363f3d0**. [Run40576897515](https://github.com/profitia/SG-dev/actions/runs/40576897515), job122445634470, rejected it with **ARCHITECTURE_PATH_REJECTED** during immutable candidate admission. Candidate checkout/validation, token-bearing package installation, execution and proof publication were skipped. No controlled proof was produced. The runner's `headSha` denotes authority control `acbc37…`, not the candidate tested; these identities are not interchangeable.

Current trusted policy admits a bounded Platform Contracts producer or the closed KRS governance review. It does not admit the ADP governance amendment/baseline/manifest/test bundle. Repeatedly rerunning that same policy cannot create the missing proof. No skipped status, fabricated artifact, branch-family rename/transport of PR #756, required-check removal, secret read or policy bypass is proposed.

## Proposed narrow policy change

**APPROVAL_PENDING / NOT ACTIVE.** Architecture approval of PR #756 is not treated as approval to activate this separate CI-policy proposal. This proposal requires explicit owner acceptance and controlled main publication before the trusted workflow can use it. It does not itself merge PR #756 or authorize an ADP product release.

The distinct SG2 task modifies only:

1. `scripts/governance/controlled-package-ci.mjs`: one immutable review definition and matching branch/PR identity check.
2. `scripts/governance/controlled-package-ci.test.mjs`: positive, negative and race-fence coverage.
3. This evidence document.

The new definition binds **only PR756**, branch **architecture/srm-adp-ui-onboarding-20261027**, and all five Git blob identities from its owner-approved source:

| File | Fixed Git blob |
| --- | --- |
| `Canon/v1.1-srm-adp-presentation-mounting-amendment.md` | `947ee0f7737dfd062a17af340c5c8667c5d10cab` |
| `Canon/evidence/2026-10-27-srm-adp-ui-onboarding.md` | `4ba761883e0e94004a37ffd587099c7c0213c2c3` |
| `Canon/registries/current-architecture-baseline-v1.json` | `8513437b3e5477f9838ab85a80b3a032d26dc79e` |
| `Canon/registries/governance-manifest-v2.json` | `bf4b89d9b617180481cce4d75f77ea04b52c313a` |
| `scripts/governance/srm-adp-routing.test.mjs` | `6f662b75b6e6eced7f3a6a8d5640b786be2ae29d` |

Rebase onto a refreshed main is permitted only if these five file blobs remain unchanged. The caller must still provide the **actual new full head SHA**, and the current GitHub PR metadata, pagination race fence and Git tree/diff/blob checks must bind that SHA. The historical source SHA is provenance, never a substitute for the current candidate head. A changed/missing/extra/duplicate/removed/renamed file, changed blob, different PR or branch is rejected.

The low-level checkout checker revalidates the same fixed blobs after candidate resolution; it does not replace the earlier trusted PR identity gate. The existing trusted-state/run binding remains unchanged. No candidate-provided approval, path/hash manifest or executable hash computation is used.

## Protections preserved

The proposal changes no workflow file, project/profile/routing registry, environment protection, provider policy, credential scope or package allowlist. Trusted controller source remains authority main, exact repository/actor/workflow/branch checks remain mandatory, and current authority routing must still resolve every admitted path to ALIGNED Governance Source Layer with ARCHITECTURE rights.

There are no `apps/**`, `packages/**`, `.github/**`, secrets or installation policy paths in the admitted ADP bundle. Existing source/manifest/dependency verification precedes the unchanged package credential phase; lifecycle scripts remain disabled while the token exists. Candidate tests/typecheck/build and proof run only after credentials are removed. Exact-candidate artifact verification, policy fingerprint and all ordinary review/governance checks remain mandatory. Existing Platform Contracts/KRS admission is preserved.

This SG2 controller proposal is a separate real governed task, not a renamed Architecture candidate. PR #756 remains in its original Architecture family. It does not create or mutate the new SRM UI package, its workflow, SG2 product source, Identity, business data, grants, infrastructure or deployments.

## Validation and acceptance sequence

Initial and require-begin SG2 gates passed before edits. PMOS begin registration `cmvr4tzai0000q9rumu0fkog6`, derived conversation `pmos-task-v2:d431c5f2300780aed9e9c00209f8047bbcf9409a1ed08d885fdea899264916b7`. The profile retains required MEMOROS and PHR. Other task/workspace files are unchanged.

Local controller and path-coverage tests passed **85/85**, no skips. They exercise the exact PR/branch and five blobs; missing/extra/duplicate/renamed/deleted/altered entries; wrong SHA, owner, fork, branch, closed PR and authority routing drift; complete API lists and metadata races. Existing trusted Git checks, credential separation, source/dependency policy and proof checks also remain covered. These are local validation results, not a trusted-main proof or permission to publish this policy.

A separate local replay used the actual current GitHub REST PR/file metadata and the clean absolute-path Architecture checkout at `202bcd0b…`. The existing policy reproduced `ARCHITECTURE_PATH_REJECTED`; the proposed admission and unchanged real Git diff/blob/regular-file checker passed. An initial relative-path invocation was correctly rejected by the existing realpath fence; it was rerun with the canonical absolute checkout path, without changing that fence. No credential phase ran. This diagnostic is explicitly **LOCAL_PROPOSAL_REPLAY_NOT_TRUSTED_MAIN_PROOF**.

Required order after explicit approval:

1. Finish required CI and exact-source review for this separate policy proposal; manually publish only the accepted source to main under the ordinary gates. No auto-merge.
2. Refresh PR #756 against that authority while preserving the five approved blobs. Repeat its complete governance/test gates and dispatch the trusted-main controlled workflow for its **actual final head SHA**.
3. Independently verify the proof artifact's candidate SHA/control SHA, policy digest and successful tests/typecheck/build; rerun only the proof verifier if its earlier run predated that artifact. All required PR checks must pass before any main acceptance.
4. Accept PR #756 through its required owner/review process, verify remote source and main checks, then continue separate SRM Producer and SG2 Consumer tasks. This proposal activates no product or business service.

If the owner declines, leave authority unchanged and keep PR #756 blocked rather than weaken its gates. After activation, removing the narrow admission is a controlled source-policy change with fresh CI and preserved history. No resource deletion or product rollback is involved.
