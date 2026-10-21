# Task B0 — Identity Runtime Architecture Approval & Routing Onboarding

Date: 2026-10-21. Profile **ARCHITECTURE**, workspace **SG-dev Architecture**, target **development**, execution **local**.
Task **ARCHITECTURE-IDENTITY-RUNTIME-B0-20261021**. Authority **profitia/SG-dev / main**.
Base source **faa97ee433a9f60de28b417b4ee323759c7c9ffb**. Isolated branch **architecture/identity-runtime-b0-20261021**.

## Approval and bounded result

**ARCHITECTURE_OWNER_APPROVED = YES; G1_OWNER_APPROVAL = GRANTED.** The direct owner message in host `01a15aed-8d94-7fe0-9cff-c54f72b5f8a8` explicitly authorizes the capability, path and Architecture Platform owner, plus governance onboarding. It does not authorize merge, implementation or infrastructure. The SG2 attachment is not the execution selector for this separate task: the current explicit instruction selects the registered ARCHITECTURE adapter and its PMOS/PHR. No SG2/SRM continuity writer is used.

[ADR / approval provenance / routing matrix / profile design / CI and owner checklist](../v1.0-identity-runtime-architecture-and-ownership-canon.md) is the complete proposed architecture record. G1 approves ownership; final acceptance of the remaining technical/profile design is still presented in the controlled PR. Canonical main activation requires its reviewed merge. Do not interpret this branch or completed PMOS continuity as B0 PASS.

Input: draft [SG2 PR #588](https://github.com/profitia/SG-dev/pull/588), source `3f22388ca82bac3ee72b81c27d33c3da95b91a7d`, Task A PHR commit `ea86ede63c65fb484adf5752915156631b0564be`. Its base equals current main, so no new A–I architecture audit was performed. PR #588 and its historical artifacts remain unchanged.

## Exact source target paths

All nine paths resolved before mutation to **Governance Source Layer / ALIGNED / ARCHITECTURE ALLOWED**. No legacy override or exception is involved. Change classification is NOT_APPLICABLE for this governance-only delivery. Future product deltas remain governed by the existing epoch.

1. `Canon/registries/current-architecture-baseline-v1.json` — add only IDENTITY-BASE-001 and 002; existing entries/metadata unchanged.
2. `Canon/v1.1-repository-routing-and-module-ownership-canon.md` — bounded G1 and owner/profile rules.
3. `Canon/v1.0-spendguru-srm-target-architecture-canon.md` — reference the independent runtime and ownership decision.
4. `Canon/v1.0-spendguru-srm-architecture-delivery-roadmap.md` — separate B0–E sequence and stop before B1.
5. `Canon/registries/architecture-onboarding-v1.json` — planned module section; existing physical resources unchanged.
6. `Canon/registries/governance-manifest-v2.json` — version3.27.0; one active target canon at loadOrder365 with ordered dependencies.
7. `Canon/v1.0-identity-runtime-architecture-and-ownership-canon.md` — new ADR, technical/profile design, CI and owner instructions.
8. `Canon/evidence/2026-10-21-identity-runtime-b0-onboarding.md` — this bounded source handoff.
9. `scripts/governance/identity-runtime-onboarding.test.mjs` — dedicated positive/negative routing and consistency regression.

Neither `apps/identity-runtime/**` nor its future CI file is physically created. Their new routes resolve uniquely to Architecture Platform and only ARCHITECTURE. Existing SG2/SRM/Maps/shared-contract rules and project/topology identities are preserved. No product files, SQL, dependencies or provider configuration change.

## Pre-execution and continuity registration

Root AGENTS, manifest and 32 active CORE/ARCHITECTURE documents were loaded in manifest order. No nested AGENTS covers these targets. Fresh main, clean isolated source, proper endpoint/database/runtime role and dedicated PHR clone were checked. Local PMOS dependencies were installed from their existing lockfile and its Prisma client generated without a database migration. Initial runtime preflight correctly blocked on missing local context; canonical context generation resolved it. Full Development preflight then passed, canonical begin registered, and repeated full `--require-begin` preflight passed. No bypass flags were used.

PMOS registration **cmvi1hfsj000013mczfy3e6bx**. Conversation **pmos-task-v2:181a48a5dff3c44c9699a00bc4c6d731f7d68777c48886af3e508acb9a23fbbd**. Host **01a15aed-8d94-7fe0-9cff-c54f72b5f8a8**. Continuity uses **billowing-credit-07394675 / architecture_pmos**, registered `ep-solitary-unit-b9b3imd3` endpoint and **architecture_pmos_runtime**. MEMOROS is **DISABLED_BY_PROFILE**.

LIVE_PROVIDER_DRIFT_GATE and PMOS_ESTATE_GATE were canonically NOT_APPLICABLE for source scope; they are not portrayed as live runtime tests. Separate provider readbacks confirmed the exact Render project/environment and private Neon database named in the ADR, existing PMOS live SHA, existing GitHub Environment and absence of an Identity Runtime service/profile schema. No new resource was created or adopted. ENABLE/FORCE RLS metadata is not runtime proof.

## Validation and final evidence contract

The dedicated regression checks Architecture-only runtime/CI, denial for SG2/SRM, denial for Architecture writes into product apps, narrow matching, preservation of every existing registry entry and epoch, coherent manifest/onboarding and unchanged physical topology/project identities. It also asserts absence of app/workflow creation. Run together with existing governance, bridge/workspace and architecture-classifier tests. Current Governance CI validates manifest/registry, existing boundaries and PMOS compatibility. The dedicated new test is explicitly run locally; it is not falsely presented as already wired into future runtime CI.

Actual test counts, exact final source SHA, new draft PR URL/checks and required publication receipts are recorded after this source commit in the canonical ARCHITECTURE execution handoff. Do not edit this document merely to insert its own commit hash or later publication commit. No runtime build/UAT of the nonexistent application, product database migration or release is claimed.

Canonical closeout must independently verify completed registration, CLOSEOUT_COMPLETE, save/context/HANDOFF success, archive/trail evidence, PHR publication and remote-main ancestry, persisted Flight Record/HANDOFF, pending CLEAR and advisory locks CLEAR. MEMOROS disabled is not an ACK. Any publication/integrity failure leaves continuity incomplete and preserves recovery evidence.

## Remaining owner actions and B1 dependencies

- Review/accept the ADR/profile/CI design and controlled B0 PR; separately authorize its merge. G1 is already granted. Do not merge Task A PR #588 automatically.
- After canonical B0 acceptance, authorize a distinct B1 task with provisioning admission/expiry/conflict policy, profile validation/retention and account-self security acceptance. No B1 execution occurs here.
- Resource/deployment actions are later and separately authorized. The ADR provides exact existing resource IDs and an operator checklist for a new Render service, private Neon role/migrator, Clerk and domain. Render creation starts a first deployment; do not click creation under B0 consent. No new GitHub Environment is presently required.
- Before installation/release, provide reviewed source/build commands, allowed origins and secure secret references, actual resource receipts, rollback and data recovery proof. Infrastructure absent today is not repaired with placeholders or lab databases.

```text
TASK_B0_VERDICT = PARTIAL (PR acceptance/merge and dependent decisions remain)
ARCHITECTURE_OWNER_APPROVED = YES
G1_OWNER_APPROVAL = GRANTED
IDENTITY_RUNTIME_OWNER = Architecture Platform
IDENTITY_RUNTIME_ROUTING = PROPOSED (G1 approved; candidate registry only until accepted on main)
SHARED_CONTRACTS_REUSED = YES (architectural requirement; existing code unchanged)
PROFILE_MODEL_APPROVED = NO (design submitted for PR acceptance)
NEW_RUNTIME_CREATED = NO
NEW_INFRASTRUCTURE_CREATED = NO
DATABASE_SCHEMA_MUTATED = NO
DEPLOYMENT_PERFORMED = NO
OWNER_ACTION_REQUIRED = YES
NEXT_RECOMMENDED_TASK = B1 Identity & Profile Backend (only after B0 closure and its dependencies)
```
