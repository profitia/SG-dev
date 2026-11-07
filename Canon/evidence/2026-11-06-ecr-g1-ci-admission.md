# ECR G1 — exact CI admission proposal

**Status: PROPOSED / CI_POLICY_APPROVAL_PENDING.** Task `ARCHITECTURE-ECR-G1-CI-ADMISSION-20261106`, ARCHITECTURE / Development; host01a19bde-d925-7eb3-bb0d-718fe3bce137. The existing ECR G1 owner approval remains valid; this is a distinct trusted-CI decision, not another G1 request.

## Actual blocker and bounded correction

PR906 G1 candidate `253bdbd0f445914e2f964d42cd2206de093cb460` passes its governance CI, including all five ECR routing/content regressions. The required SG2 integration job reports `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`: https://github.com/profitia/SG-dev/actions/runs/42179439848/job/127765382255 . Independent execution of the current main controller against its actual complete file list returns `ARCHITECTURE_PATH_REJECTED`. A successful private-package build from a different SHA cannot be reused as proof.

Exactly four proposed files: controller, its existing positive/negative tests, existing controlled-CI runbook and this evidence. No main/feature/environment is changed by preparing this proposal. The frozen review below is trusted-controller data only after explicit approval and governed main adoption; a candidate cannot supply an allowlist.

| PR906 file | Status | Mode | Reviewed Git blob |
|---|---|---|---|
| .github/workflows/governance-preflight.yml | modified | 100644 | 8c268570c40d515fac63905542a5c5997e71034f |
| Canon/evidence/2026-11-06-ecr-g1-governance-activation.md | added | 100644 | 116e038301c335c7392f8e6fd49db791f009d7d3 |
| Canon/evidence/2026-11-06-ecr-sourcehub-preimplementation-reconciliation.md | added | 100644 | 1f402303038194cb6dcc7bc5c11fe3b80a64522e |
| Canon/proposals/economic-calendar-runtime-source-hub-g1-v1.json | added | 100644 | e0b23cd708d1caad3101d31503e6bfa7107aa290 |
| Canon/proposals/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md | added | 100644 | 88169bd1a8edae5a2e6fa7ebb83a8d3f89932c41 |
| Canon/registries/architecture-onboarding-v1.json | modified | 100644 | 6070fb51ab0dadb15ada4be789fdce15152e3f54 |
| Canon/registries/current-architecture-baseline-v1.json | modified | 100644 | b24b5f1f9586d6947d192138a0d76b65815405ce |
| Canon/registries/governance-manifest-v2.json | modified | 100644 | 42a0d520016786131efcddfb5d34f84bc44c43ec |
| Canon/v1.0-economic-calendar-runtime-business-and-architecture-canon.md | added | 100644 | 66166b72b0cfb16937203cd74b7a7c00f67e840d |
| Canon/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md | added | 100644 | 73a181d9178dc0863d42376071b42e0c7be879c1 |
| Canon/v1.1-repository-routing-and-module-ownership-canon.md | modified | 100644 | ef22e9e324cb309ca689aa742685ceb2563a8242 |
| scripts/governance/ecr-routing.test.mjs | added | 100644 | 0b0753392f309c5e5b0c071e35784b38a7204d4c |

All12 paths resolve to Governance Source Layer/ALIGNED/ARCHITECTURE on current main. They are governance/documents/tests only, including the one existing unprivileged governance-workflow test addition. No ECR runtime/package implementation or deployment workflow is admitted. The frozen original ECR canon and owner-approved proposal bytes are preserved in this candidate. The earlier G1 decision separately authorizes continuing Development implementation after effective main onboarding, not creation of infrastructure or administrative grants.

## Required verification and acceptance

Tests must reject changed/missing/extra/duplicate/renamed/copied/deleted file entries, changed statuses, executable/symlink modes, another PR/branch, fork/repository/author and stale expected HEAD; retain existing route and trusted-main fences. A current-main refresh may preserve exactly12 identical reviewed blobs, with a new real expected head and proof. This scoped proposal does not weaken credential, dependency, proof, Environment or execution rules.

After separate explicit CI-policy approval: validate the four-file bootstrap using the existing trusted-main workflow and exact source; accept it on main only after all checks. Then run new controlled PR906 validation under the accepted controller, independently verify proof and all remaining public/main gates, and continue G1 source activation. Do not merge PR906 while required CI is red. No new private package, owner credential, token scope, secret placement, provider access, live database/grant or service operation is introduced.

Rollback is a normal reviewed revert of this closed admission; it does not touch product data or broaden another review. Actual tests, commit/PR and PMOS/PHR results are recorded after execution without claiming future acceptance here. Monitoring: NOT_APPLICABLE to this source-only policy proposal.

## Prepared proposal verification

Existing controller/path-coverage suites plus five new review regressions: **151/151 PASS**, zero failed/skipped. Real candidate checkout verification confirms all12 path/blob/status/mode entries and its complete Git diff at253bdbd0f445914e2f964d42cd2206de093cb460. Controller syntax and whitespace checks pass. Manifest/profile/routing/live PMOS preflight, actual separate pmos:begin and require-begin pass for these four exact policy-proposal paths. The candidate's historical G1 approval is preserved and is not rewritten as approval of this separate CI policy.
