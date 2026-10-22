# B2-E-CI-01 — closed Identity review admission proposal

22 October 2026. ARCHITECTURE / Development. Task `ARCHITECTURE-IDENTITY-B2-E-CI-01-20261022`, actual host `01a15aed-8d94-7fe0-9cff-c54f72b5f8a8`. Repository `profitia/SG-dev`, authority main `1922aab9788ccd191da8a2c517cae9f48ef78ed8`. This is a separate policy-source DRAFT proposal, not activation or source merge.

## Existing evidence and root cause

Read the full 78608-byte / 1381-line B2-E HANDOFF from [its immutable PHR publication](https://github.com/profitia/project-history-repository/commit/3d6a8e6bd03b05e45d1916752ff11be8f3ac2863), SHA256 `7a6d2cdc88a5fc012177afb665e499068747cda73ace5e7017b4b5738fd19c68`. Reused its findings and accepted tests without repeating the B2-E analysis or manually rerunning Identity/Access Store suites. Historical HANDOFF prepublication text is not a current publication/pending readback; B2-E's independent persisted receipt confirms its completed continuity. No historical artifact is edited.

[PR600](https://github.com/profitia/SG-dev/pull/600) is still OPEN/DRAFT/MERGEABLE at `70b4b05a870f93921529319f3a1693dd345ed0af`, exact five-file diff, with successful Identity134 / B1-Access Store1312 / governance and compatibility evidence. Platform CI's `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA` is a real missing controlled SG2 proof. Trusted-main Architecture admission also returns `ARCHITECTURE_PATH_REJECTED`: its producer-only paths exclude the application regression files/runbook and require a producer delta.

The issue is not an invalid provider proof or business identity policy. Do not make artificial package changes, use another SHA, suppress the check, change namespace of PR600, or extend secret/Environment access. Its existing source remains unchanged by this task.

## Minimal proposed change

Keep existing producer admission. Add exactly one alternative: the complete five-file B2-E documentation/test bundle listed in the [controlled CI runbook](../runbooks/controlled-package-ci-v1.md#zamknięta-klasa-przeglądu-identity-lifecycle--propozycja-b2-e-ci-01). All five must be present, added/modified only, no other path. Only that class omits the producer-change requirement. Ordinary producer/consumer paths and their previous semantics are preserved.

Every new-class path still resolves from trusted profile/routing with ALLOWED and ALIGNED. Application tests require Architecture Platform; Canon documents require Governance Source Layer. There is no general app/test extension allowance and no candidate-defined list. Test files can execute code; the unchanged credential separation remains essential.

Exact four changed paths, each Governance Source Layer / ALIGNED under ARCHITECTURE:

1. `scripts/governance/controlled-package-ci.mjs`
2. `scripts/governance/controlled-package-ci.test.mjs`
3. `Canon/runbooks/controlled-package-ci-v1.md`
4. `Canon/evidence/2026-10-22-identity-runtime-controlled-ci-corrective.md`

No workflow, active manifest/registry, consumer, dependency pin, Identity Runtime, Access Store, product database or provider configuration changes. The controller's existing fingerprint includes its changed bytes, so the policy digest changes automatically. Old-policy proof is not accepted as new-policy proof.

## Verified local security evidence

107 controller, coverage and governance/workspace tests PASS, zero failed/skipped; both changed MJS files pass syntax checks. New positive/negative cases cover:

- Complete exact bundle without a producer change, order independence, added/modified metadata, unchanged exact-source proof contract.
- Every missing path; added/replaced application source or arbitrary test, workflow/controller/registry/hidden npm/environment/traversal path, other document or producer mix.
- Removed/renamed/copied entries, duplicate/forged blob/count, stale SHA, foreign owner/repository/ref/event and untrusted controller.
- Trusted owner/profile/state drift for both application trees and Canon, complete actual GitHub metadata resolution and its head/base/count race fence, unavailable/truncated file API.
- Actual five-file Git diff/tree/blob checks, no import of executable candidate test code, replacement/forged blob, hidden runtime mutation and symlink despite an exact API blob.
- Existing main-only Environment, token metadata, dependency pins, credential-free lifecycle/proof, policy fingerprint and missing/foreign proof rejection regressions remain active.

Local replay against **actual** PR600 metadata and its real pinned checkout: old accepted controller rejects; proposed controller passes complete path/owner and Git diff/all-five-blob validation. This is a local source regression, **not** a real controlled SG2 proof or active-main acceptance.

18 critical control functions are byte-identical to current main, including trusted context/Environment, metadata fencing, checkout validation, credential/package/manifest/local-source policies, proof and verify. Nine protected workflow/topology/routing/dependency/config files are byte-identical. Existing npm canary tests prove lifecycle does not run with the synthetic credential, and does run only after it is absent. No real CI package credential is read and no privileged workflow is dispatched.

Public source CI for the new exact candidate is reported in the final PMOS/PHR handoff. The existing Platform workflow may report a missing controlled proof for this policy candidate too; it is preserved as an owner gate. It is never relabelled PASS. No required test is skipped to obtain readiness. Workflow-driven automatic regressions are retained; this task does not separately repeat B2-E's prior manual suites.

## Governance and owner gate

Own canonical Architecture BEGIN `cmvjf4gg60000z2n6ozcm8jay`, conversation `pmos-task-v2:28f74d3d22b07deaeac6cd99bfcdd1e11e63e3f41ea2705b69930b90cd7f7d58`. Full manifest and require-begin preflight PASS before edits; all33 active CORE/Architecture hashes unchanged. Explicit task ARCHITECTURE selects the correct adapter/PMOS over the generic wrapper's SG2 selector. No nested covering AGENTS. MEMOROS DISABLED_BY_PROFILE.

The isolated bootstrap branch uses `sg2/architecture-identity-ci-compat-20261022`, as prescribed by the existing controlled-CI policy-change runbook. Its execution/continuity profile is ARCHITECTURE; no SG2 source or PMOS changes. It does not activate the new Architecture class. The owner receives one separate DRAFT PR, exact source SHA and [the bounded GO sequence](../runbooks/controlled-package-ci-v1.md#owner-go-i-późniejsza-walidacja). Current authorization covers preparation only. Merge and privileged validation remain NOT_AUTHORIZED / OWNER_GO_PENDING.

After owner acceptance/merge: verify actual merge SHA and active policy digest, refresh/reconcile PR600 as a separately authorised unit, re-read its then-current exact HEAD, obtain a new trusted-main controlled proof and rerun the corresponding public check. PR600 remains DRAFT and unmerged until separate source acceptance. No Live Clerk stage starts.

Canonical Architecture closeout must preserve original requests/artifacts, independently read Flight Record/HANDOFF, verify integrity and PHR remote ancestry, clear pending/locks canonically and repeat full preflight. That continuity closure is distinct from operationally unblocking PR600, which cannot happen before the owner's next GO. No Render/Clerk/product Neon mutation, login activation, secrets/Environment modification or deployment is performed.
