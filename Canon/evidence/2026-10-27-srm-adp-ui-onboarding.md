# SRM ADP presentation UI — proposed ownership and routing

Date: **2026-10-27**. Profile: **ARCHITECTURE / SG-dev Architecture / development**.
Authority: `profitia/SG-dev/main`; inspected source `acbc37b278a16a9e4c47f794e3eb7577d42f21d6`.
Task: `ARCHITECTURE-SRM-ADP-UI-MOUNT-ONBOARDING-20261027`.
Host conversation: `01a17d49-61a6-7821-ba8e-18b45d3c4048`.

## Owner request and proposed resolution

The user requested the complete clickable ADP mockup inside the existing SG2 Platform AppShell, with product-only transfer, local state/synthetic data, no business services or persistence, and the necessary lawful SRM producer/SG2 consumer steps. The same instruction explicitly changes the canonical desktop URL to `/pl/dashboard` and `/en/dashboard`, preserving `/[locale]/account` as an account/completion callback and backward-compatible entry. That direct instruction supersedes the attached wrapper's older `/pl/account` destination; it does not authorize changing identity rules.

The accepted AppShell canon PR748 leaves the physical ADP public contract open. Current routing has `apps/srm/**` and `packages/srm-xray/**`, but no public ADP UI surface. The supplier/ADP workspace belongs to SRM; placing its implementation under SG2 or the X-Ray-only package would misstate ownership. Cross-app private imports and a MagicPath iframe are forbidden. A single new public UI boundary is therefore the minimal proposal; no new app/runtime/service is proposed.

**Decision requested:** accept [Presentation Mounting Amendment v1.1](../v1.1-srm-adp-presentation-mounting-amendment.md), the public SRM-owned namespace `packages/srm-adp-ui/**` and its exact offline CI path. Existing SRM Runtime remains owner. SG2 consumes the versioned NATIVE VIEW under its existing paths; Architecture maintains common rules only. No owner or existing code is transferred.

This is **APPROVAL_PENDING** until explicit owner approval and controlled main acceptance. This evidence does not itself assert G1 approval, implementation, activation, a working module or 1:1 parity.

## Exact onboarding candidate

| New route | Scope | Allowed profile / owner |
| --- | --- | --- |
| SRM-ADP-BASE-001 | `packages/srm-adp-ui/**` | SRM only / existing SRM Runtime |
| SRM-ADP-BASE-002 | `.github/workflows/srm-adp-ui-ci.yml` | SRM only / existing SRM Runtime |

Both entries are ALIGNED at the actual pre-onboarding main. Existing routing entries, global classification reference, transitional epoch, project/database/environment registry and service identities remain byte-for-byte semantically unchanged. Product deltas retain their independent current classification. Siblings, private-app imports and writes from SG2/ARCHITECTURE remain denied by resolver tests.

Five governance files comprise this proposal: amendment, this evidence, baseline registry, active manifest registration and `scripts/governance/srm-adp-routing.test.mjs`. The manifest's planned ACTIVE entry takes effect only with approval and main acceptance. There are no product, workflow, lockfile, service, database, permission or Identity changes here.

## Current design evidence and qualification boundary

Read live through the production MagicPath connector, without modification:

| Source | Project | Component | Selected revision |
| --- | --- | --- | --- |
| ADP — Arkusz Danych Podstawowych | 465405993031966720 | 465415479037693952 | **465859267208024064** (38 revisions) |
| Shared UX/UI library | 460628300646219776 | 460628347660177408 | **465827262730764288** |
| AppShell reference | 465533749308841984 | 465804082116980736 | 465855381789360128, revalidated component revision count/timestamps |

Complete current editable ADP source contains 55 files. The current three-axis registry contains 1,472 entries: UI 1,305 product / 154 design / 13 simulation; data 1,018 product / 454 simulation; behavior 1,305 product / 167 simulation. These counts describe labels, not a transfer approval or completeness acceptance. Parent/child boundaries, dynamic data and handlers must be qualified individually before producer code.

The source registry identifies a historical classification revision `465575254601928704`; its stored file hashes do not match the fully instrumented current files. That historical revision was separately retrieved for reconciliation, rather than claimed current. The transfer matrix must use the actual current source digests and stable element references, record changed or unknown units, and stop any unresolved qualification. Merely displaying the source's product-mode preview is insufficient: its helper tools and simulation handlers still exist in that source graph.

The source includes an additional assistant, source/proposal dialogs, test scenarios, X-Ray iframe and generated publication/analysis fixtures. None is automatically admitted. Product-field structure remains separate from source fixture data. The public package must not import delivery/inspector metadata, simulation code or private services; synthetic values and permitted local reactions belong to the consumer's separate adapter.

## Governance and parallel work

Root AGENTS and unchanged active governance were revalidated against fresh main, manifest3.29.0/49 documents before mutation. The own Architecture checkout was clean, on its isolated task branch; other worktrees were not changed. Full initial and require-begin preflights passed. PMOS begin: `cmvr3muc40000clbiu4j1qxji`; derived conversation `pmos-task-v2:4d45ebbb688dd2b0ec15691fd0ce34e83365b4360f0826b3b4729e4efeab4066`. Architecture MEMOROS remains disabled; PMOS/PHR are required.

Open PRs were inventoried. PR755 is separate SRM Maps work, PR707 separate SG2 Benchmark presentation, PR154 an older shared-governance proposal; none is adopted or modified. No messaging, source changes, package installation or release for those tasks is performed. Refresh main and repeat manifest/routing/tests before any merge; do not overwrite concurrent registry additions.

## Gates after approval

1. Accept this narrowly scoped governance proposal on main through the normal required review/checks.
2. Register a separate SRM producer task and exact package/CI paths; load all SRM-active documents and complete preflight/begin/require-begin. Publish the public contract and source/exclusion matrix with offline/browser evidence in an owner PR.
3. Register a separate SG2 consumer task, adopt a fixed version/digest and mount through the existing authenticated host; implement the specifically requested dashboard migration with backward-compatible account handling. Preserve the assistant and other inactive cards.
4. Release only the accepted exact SG2 main SHA to the existing Development service and verify all admitted ADP areas, local state, session/routing, both themes/widths and network exclusions live. New or changed product services, data, permissions, infrastructure, Staging and Production remain outside scope.

Before main acceptance, recovery is to reject/preserve this proposal with authority unchanged. After acceptance, a reviewed additive correction or source revert must first check dependent work; no task history or unrelated route is removed. Actual source acceptance, producer/consumer evidence, release and PMOS/PHR closeout remain separate facts.

## Local proposal validation

The initial manifest check caught a duplicated load-order number; the new amendment now loads at the unused order390 after AppShell. Final manifest validation and the governance/ADP resolver suite passed **24/24** tests with no skips. Exact-boundary checks cover SRM-only writes, host separation, unchanged prior entries/epochs and unknown sibling paths. These are governance checks, not product/runtime acceptance. Remote required checks and explicit owner acceptance remain pending.
