# Newsfeed Canon v1.0 — documentation save and owner handoff

**Date:** 2026-11-03  
**Status:** `PROPOSAL_SAVED / OWNER_ACCEPTANCE_PENDING / GOVERNANCE_ONLY`  
**Task:** `ARCHITECTURE-NEWSFEED-CANON-SAVE-20261103`  
**Profile / workspace:** `ARCHITECTURE` / `SG-dev Architecture`  
**Target environment:** `development`  
**Execution location:** local macOS; isolated checkout and dedicated PHR clone under `profitia-development/newsfeed-canon-save-20261103`. This is an execution location, not repository authority.  
**Repository / authority:** `profitia/SG-dev` / refreshed `origin/main` at `b4023cb02e10fc7045f8b2bc173224ae3da3cb5a`.  
**Candidate branch:** `docs/newsfeed-canon-v1-20261103`.

## 1. Saved scope and provenance

The user explicitly selected “Wykonaj zapis kanonu zgodnie z governance” and requested continuation after a restart. The accepted save prompt limits this task to documentation; it does not authorize functional implementation or resource activation.

[Newsfeed — Business & Architecture Canon v1.0](../v1.0-newsfeed-business-and-architecture-canon.md) preserves the complete supplied Markdown byte for byte: 16,918 UTF-8 bytes, ten numbered top-level sections, SHA-256 `23241ca73554075de55fa6269f7eae2718ba7f5323793659248b30ec26a0f3d4`. The separately supplied `Newsfeed_Canon_v1.0.md` and the canon embedded in `Codex_Newsfeed_Canon_Save_Prompt.md` contain identical substantive text. No business decision was added or reinterpreted.

Exact repository targets are limited to:

- `Canon/v1.0-newsfeed-business-and-architecture-canon.md`;
- `Canon/evidence/2026-11-03-newsfeed-canon-save-handoff.md`.

## 2. Documentation routing and lifecycle

Both exact paths resolve through `SG2-BASE-019`, `Canon/**`, to **Governance Source Layer**, baseline **ALIGNED**, with no nested legacy override. The active registry permits SG2, SRM and ARCHITECTURE for this documentation surface. ARCHITECTURE is the selected authoring profile for this proposed shared platform capability, consistent with the Architecture adapter and the existing platform-canon authoring pattern; the first business consumer SG2 is not the proposed platform owner.

The proposed logical capability owner remains **Architecture Platform**, subject to formal owner acceptance. This document save does not register a runtime owner. Product source change classification is **NOT_APPLICABLE** because this delta contains only documentation; it does not assign a new lifecycle classification or modify the transitional epoch. No legacy write exception or ownership-registry change is involved.

The root `AGENTS.md`, manifest `3.35.0`, ordered active CORE/ARCHITECTURE documents, current routing and Architecture adapter were loaded; no nested `AGENTS.md` covers these Canon targets. Full preflight passed before registration and again with `--require-begin`, using the actual host conversation identity. No skip-runtime, CI-only or routing-bypass invocation substitutes for that execution gate.

The new canon deliberately retains **PROPOSED / FOR OWNER ACCEPTANCE**. It is not added to the active manifest: the current validator supports only `ACTIVE`, `ACTIVE_ADAPTER` and `SUPERSEDED`, and the existing BQL canon §14 explicitly allows a proposal under `Canon/**` outside the active list before acceptance. No unsupported manifest status, premature `ACTIVE` claim or validator change is introduced. Recording the proposal or passing CI is not owner approval, main acceptance or evidence of a working Newsfeed.

## 3. Current-governance dependencies for the next stage

| Verified current boundary | Dependency before a dependent implementation |
| --- | --- |
| `apps/newsfeed-runtime/README.md` and `packages/newsfeed-contracts/README.md` resolve to `NO_MATCH` in the current ownership resolver. | Formally accept the capability owner and onboard exact source/CI paths through the authorized governance procedure. These proposed surfaces remain uncreated. |
| SRM-CAP-012 in the active SRM business canon is `FROZEN_DIRECTION`; the SRM placement canon names `apps/srm/src/modules/intelligence/` for SRM news and alerts. | Reconcile the independent producer and SRM consumer responsibilities explicitly with the existing canons. This proposal does not supersede or transfer SRM-CAP-012, and creates no SRM implementation task. |
| The active ADP mounting amendment preserves `PRESENTATION_ONLY / LOCAL_STATE`; Newsfeed currently admits its unavailable/empty state rather than fictional publications. `packages/srm-adp-ui/**` remains owned by SRM Runtime. | Register a separate, authorized consumer integration with a versioned producer contract. Do not place provider calls, persistence or identity authority in the presentation package. |
| Operation Context, E1 and the active access matrix remain governing contracts. | Specify the verified internal User ID owner, actor/delegation, application and organisation context, operation permissions, revocation and cross-host rules. No new operation or access grant is created by this save. |
| Provider choice, Polish-source coverage, licensing, retention and costs remain open in the supplied canon. | Qualify sources and obtain the required cost/resource authorization before purchase or activation. No discovery-provider or OpenAI request was made for this task. |
| Sentry and PostHog configuration belongs to the admitted runtime/consumer. | Define approved telemetry boundaries when implementation is authorized; retain private-state minimization and correct project/environment ownership. No telemetry configuration or synthetic event was added. |

These are handoff dependencies, not business amendments or blockers to saving the proposal. Acceptance must distinguish the target architecture from implemented and deployed behavior.

## 4. Continuity and verification boundaries

Canonical `pmos:begin` registered this documentation task in the existing ARCHITECTURE PMOS database `architecture_pmos`, registered Neon project `billowing-credit-07394675`, through the registered endpoint and ordinary role `architecture_pmos_runtime`. The PMOS-returned task-scoped conversation identity is `pmos-task-v2:85d2e062a4ca722cd939bedac9370e8916fdd7c0882ca96ac1bad4afa9cd9751`; host conversation `01a19fe2-0dc1-7ca2-8acf-28504684e3c1` is unchanged. PMOS/PHR closeout must report factual final results through the canonical lifecycle. Memoros is **DISABLED_BY_PROJECT_PROFILE**, not delivered.

The local isolated checkout was recreated in a persistent workspace after temporary preparation was interrupted by disk exhaustion. Existing worktrees and other tasks were preserved. This is preparation history, not evidence of a product failure or permission to clean unrelated data.

Validation for this save comprises source-byte equality, document version/section/status checks, exact-path routing, manifest validation, full preflight with durable registration, a two-document-only diff, and remote candidate verification. CI and final continuity receipts are independently checked at closeout; this handoff does not predict their outcome. Product builds, live Newsfeed monitoring, user-isolation UAT and provider/Sentry/PostHog acceptance are outside this documentation task and are not claimed as passed.

**Observability:** `NOT_APPLICABLE` — documentation only. No application, Render service, product database, E1/Clerk configuration, API purchase, migration or deployment was changed. The required PMOS/PHR continuity records are governance evidence, separate from product persistence. Staging and Production are outside scope.

## 5. Next owner decision

Review the exact proposed canon and this handoff, accept or amend the proposed platform ownership and resolve the dependencies above. Any activation of the canon requires the proper controlled status/manifest update and owner-authorized main acceptance. Producer onboarding, implementation planning, resource authorization and SG2/SRM consumer work then use their own exact scopes, profiles, PMOS tasks and acceptance criteria. This save ends at a reviewable documentation proposal; it does not start those stages.
