# CIC Stage 1 — bounded engineering-source CI proposal

Status: **PROPOSED_ONLY / OWNER_CI_POLICY_ACCEPTANCE_PENDING**.

Project: ARCHITECTURE. Task: `ARCH-CIC-QUALITY-STAGE1-SOURCE-CI-CLASS-20261113`.
PMOS registration: `cmwek57jp0000105jc7ydkck5`.
Execution mandate: Stage 1 only, accepted PDR revision 8. Stage 2 is not commissioned.

## Actual boundary

Source PR #1071 was accepted at `a398fc2c`; source/main QA, ACG, Limits and
governance checks passed. The keyless Linux qualification failed before agent
execution. PR #1073 at `597bf128` added bounded setup diagnostics; the next
qualification exposed `groupdel` exit 8 masking an earlier setup failure.

PR #1074, observed source `e0a5beed804cd5cfad874e44380f3f6a37c1ac93`, contains
two AQC source files and the same project card. Its QA source and governance
checks passed, but automatic approval review rejected its merge because complete
mandatory CI was not evidenced. The merge did not happen. The unchanged trusted
main controller independently rejects its actual three-file list with
`ARCHITECTURE_PATH_REJECTED`. No alternate merge or policy bypass was used.

The owner's #1061 decision remains exact five-file G1 admission. It does not
admit the controller implementation, a new CIC dependency pin or an application
repair. This proposal therefore requires its own explicit owner CI decision.

Parallel accepted main `08792452867f486580874857b3a5aaae10de9170` is preserved in full, including the separate PI source policy and tests. This proposal does not edit its accepted review entries.

## Proposed decision

Add `AQC-STAGE1-SOURCE-CI-20261113`, a finite engineering-source class:

- Only internal, open owner-authored PRs from
  `architecture/cic-quality-stage1-control-20261112` to this repository's `main`.
- Only the 27 paths below; at least one AQC source/test file must change.
  Added/modified regular `100644` files only. No deletion, rename, link,
  executable mode, duplicate path or additional file.
- Existing actual-owner/ALIGNED routing, complete live PR file pagination,
  repeated head/base checks, exact expected SHA, physical Git bytes and all
  original proof/credential/environment checks remain mandatory.
- The actual committed and physical project card must retain owner-accepted
  §§4–5, SHA-256
  `ee6b3f36dd63ca3c3343de8b38fee431de49f67b895b17434b39ce332539b881`,
  and the header must continue to state Stage 2 is not commissioned.
- New admissions expire at **2026-11-27T23:59:59.000Z**, with no renewal.
  This is a CI admission deadline, independent of the unstarted model pilot's
  one 14-day/$50 clock.

The finite paths are:

| Directory | Exact files |
| --- | --- |
| `packages/assistant-quality-control/src/` | `controller.mjs`, `store.mjs`, `budget.mjs`, `manifest.mjs`, `source-policy.mjs`, `provenance.mjs`, `executor.mjs`, `verify.mjs`, `openai-broker.mjs`, `worker.mjs`, `github.mjs`, `release.mjs`, `cli.mjs`, `acceptance.mjs` |
| `packages/assistant-quality-control/test/` | `controller.test.mjs`, `budget.test.mjs`, `manifest.test.mjs`, `source-policy.test.mjs`, `provenance.test.mjs`, `executor.test.mjs`, `verify.test.mjs`, `openai-broker.test.mjs`, `worker.test.mjs`, `provider-adapters.test.mjs`, `release.test.mjs`, `acceptance.test.mjs` |
| Project record | `Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md` |

This lets the already commissioned Stage 1 engineering work receive full
validation without a new per-commit path proposal for these source files.
It does **not** merge a candidate or waive a failing check.

## Excluded authority

No workflow change, package manifest/lock, dependency, SQL/migration, app source,
shared QA contract, Canon/registry, security policy or file outside that list is
admitted. In particular CIC 1.8.0 host adoption is not admitted by this proposal;
the accepted private package names/pins and credential scope are unchanged.

No model call, transcript access, QA purpose/SERVICE grant, cloud resource,
database installation, secret creation/copy, repair-agent execution,
autonomous application merge, deployment, Production, Staging or Stage 2 is
authorised. The repair agent still has its separate two-file manifest; this
engineering CI class cannot be supplied through that manifest.

## Validation and activation

Local targeted checks cover the original exact G1, all finite paths and excluded
surfaces, wrong branch/actor/repository/head, expiry, frozen specification,
executable/link modes, and actual Git/worktree substitution. Full bootstrap CI
and the existing trusted-main proof remain required before activation.

Prepare and publish only this four-file policy/test/runbook/evidence proposal.
Obtain the owner's explicit decision for its exact PR/version. Use the existing
trusted-main bootstrap mechanism, independently verify its exact-source proof,
and require all ordinary public checks before policy merge. The proposal must
never admit itself using its own new rule. Verify resulting-main checks too.

Then resume #1074 at its actual current head: obtain the protected exact-source
proof, run the full public integration checks for that same head, merge only
after all required checks pass, and verify the resulting main. AQC source paths
do not automatically trigger the full integration workflow, so dispatch the
unchanged trusted workflows explicitly; path filtering is no test waiver.

Rollback removes only this new class through an ordinary tested corrective
commit, preserving all original reviews and concurrent work. Expiry also denies
new admissions. Neither action reverts application data or another deployment.

No owner acceptance, policy activation, exact-source protected proof for #1074,
or successful Linux qualification is claimed in this proposal.
