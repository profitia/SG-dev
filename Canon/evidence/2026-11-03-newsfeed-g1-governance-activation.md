# Newsfeed v1.0 — owner acceptance, G1 onboarding and governance activation

**Decision:** `ARCH-NEWSFEED-G1-ACTIVATION-20261103`  
**Date:** 2026-11-03  
**Approval:** `OWNER APPROVED / G1 GRANTED`  
**Scope:** `GOVERNANCE ACTIVATION ONLY`  
**Authority effect:** the ACTIVE canon, manifest entry and owner routing take effect through controlled acceptance of PR [#871](https://github.com/profitia/SG-dev/pull/871) into `profitia/SG-dev/main`. Candidate status alone is not activation proof.  
**Execution:** task `ARCHITECTURE-NEWSFEED-G1-ACTIVATION-20261103`, profile `ARCHITECTURE`, workspace `SG-dev Architecture`, TARGET_ENVIRONMENT `development`; local macOS, isolated checkout/context/dependencies/PHR clone.  
**Host conversation:** `01a19fe2-0dc1-7ca2-8acf-28504684e3c1`.  
**Pre-onboarding authority:** `b4023cb02e10fc7045f8b2bc173224ae3da3cb5a`.  
**Owner-approved substantive source:** PR #871, SHA `5f2377b07ba6449062f6b5bb1b350fc0bad66664`, canon SHA-256 `23241ca73554075de55fa6269f7eae2718ba7f5323793659248b30ec26a0f3d4`.  
**Owner instruction provenance:** user-provided “NEWSFEED v1.0 — OWNER APPROVAL & GOVERNANCE ACTIVATION”; SHA-256 `fa8a0964c33ca72c8b13ebe6f88c3e42532ab8209b8e24562bc02de7bfbf4807`. The complete actual request is retained with canonical PMOS registration, not reconstructed from this summary.

## 1. Explicit owner authority

The owner expressly states:

> NEWSFEED CANON v1.0 — OWNER APPROVED / G1 GRANTED.

> Niniejsza decyzja stanowi akceptację właścicielską dla governance onboardingu tych powierzchni w profilu ARCHITECTURE.

> Upoważniam do kontrolowanego merge do `main` zmian governance objętych tym zadaniem

The last quotation is the owner's merge authorization, subject to all applicable gates and successful required CI in the full instruction. This receipt neither invents a GitHub approval nor substitutes for a required independent reviewer. Current main rules require a PR, forbid deletion/non-fast-forward and provide no bypass actors; their required approving-review count is zero. Rules and actual CI are reread before merge. The owner grants governance acceptance and merge, not runtime implementation, paid resources or functional release.

## 2. Accepted canon and exact registered surfaces

[Newsfeed Canon v1.0](../v1.0-newsfeed-business-and-architecture-canon.md) retains the complete accepted business/functionality, user-data ownership, assistant, observability and v1 boundaries. Changes are limited to status, acceptance provenance, approved routing and minimal cross-canon governance reconciliation. The earlier [save handoff](2026-11-03-newsfeed-canon-save-handoff.md) remains an unchanged historical proposal receipt; this explicit later decision resolves its owner/source-onboarding dependencies.

The manifest advances from `3.35.0` to `3.36.0`, adding one ACTIVE Newsfeed v1.0 document owned by Architecture Platform, applying to SG2/SRM/ARCHITECTURE, loadOrder `450`, after its declared active dependencies. It does not register a new project profile, PMOS or product environment.

| Surface | Exact pattern | Logical owner | Allowed profile | State |
| --- | --- | --- | --- | --- |
| NEWSFEED-BASE-001 | `apps/newsfeed-runtime/**` | Architecture Platform | ARCHITECTURE | ALIGNED |
| NEWSFEED-BASE-002 | `packages/newsfeed-contracts/**` | Architecture Platform | ARCHITECTURE | ALIGNED |
| NEWSFEED-BASE-003 | `.github/workflows/newsfeed-ci.yml` | Architecture Platform | ARCHITECTURE | ALIGNED; reservation only |

The exact CI reservation follows existing Identity/KRS/Limits source-onboarding practice. It does not create a workflow or deployment pipeline. No optional `packages/newsfeed-ui/**`, helper package, sibling application or wildcard workflow is admitted. New rows use the actual pre-onboarding authority SHA above; old routing rows, global reference, epoch, lifecycle policy and physical onboarding resources remain unchanged. The Architecture onboarding registry appends one governance-only Newsfeed planned module with the actual G1 provenance and explicit non-authority for implementation/resources/deployment/data grants.

## 3. Existing owner and security boundaries

- SpendGuru is the first consumer. SG Runtime retains its AppShell, navigation, assistant widget and host identity context; consuming Newsfeed does not transfer these responsibilities.
- SRM-CAP-012 retains its business scope and SRM intelligence placement. Its minimal dated clarification distinguishes the reusable Newsfeed producer from SRM curation/context/presentation and the separately admitted consumer adapter; other SRM intelligence workflows are not moved.
- `packages/srm-adp-ui/**` retains SRM Runtime ownership and `PRESENTATION_ONLY / LOCAL_STATE`. This governance acceptance provides no real-data/provider integration and creates no second assistant.
- Operation Context, E1, access matrix, verified User ID/application/organisation boundaries and revocation controls remain unchanged. No new user operation, grant, role or private-data access is introduced.
- SG2, SRM and external application integrations require their own authorized tasks and explicit versioned contracts. A consumer does not acquire write authority over the producer source by using it.

The [routing canon](../v1.1-repository-routing-and-module-ownership-canon.md), [SRM business canon](../v1.0-srm-business-capability-canon.md) and [SRM placement canon](../v1.0-srm-architecture-and-component-placement-canon.md) contain the corresponding bounded clarification. No runtime is relocated or rebuilt.

## 4. Validation, continuity and final acceptance evidence

Pre-execution registration and full preflight use the nine exact governance targets and the actual host identity. The task-scoped PMOS conversation returned by canonical begin is `pmos-task-v2:8d7efc0fc755dab66e126926d1412f967bd00ecb642b904981aa625bc9e7e8aa`. Continuity belongs only to the existing ARCHITECTURE PMOS (`billowing-credit-07394675`, `architecture_pmos`, registered endpoint, ordinary `architecture_pmos_runtime`) and a dedicated clone of `profitia/project-history-repository`. Memoros is disabled by the registered profile.

Validation includes the manifest and registry validators, positive/negative routing, sibling/traversal/conflict denial, retained consumer owners, old-registry/physical-resource preservation, approved substantive-content comparison, minimal diff review and existing governance/PMOS CI. New focused regression coverage runs through the existing governance workflow; no new pipeline is introduced. Exact candidate, CI, merge SHA, resulting-main verification and canonical PMOS/PHR closeout are recorded as factual final receipts. This pre-merge receipt does not predict their results or claim activation while the change remains a candidate.

The prior save task `ARCHITECTURE-NEWSFEED-CANON-SAVE-20261103` and its PHR publication remain intact. This activation is a new task in the same chat, with its own registration and closeout, not a reopened completed record.

## 5. Remaining implementation dependencies

Governance acceptance settles the v1.0 business direction and basic platform ownership. Before functional development, authorize the implementation scope and producer/consumer tasks; specify versioned contracts and admission of actual operations, background delegation and private-state isolation; qualify Polish-source coverage, licensing, retention and costs; obtain separate authority for any resources/provider activation; and define recovery, telemetry, consumer acceptance and exact environment bindings. These are delivery dependencies, not a request to reopen the approved goals or ownership.

No runtime, endpoint, scheduler, worker, integration, product schema/data, Neon project/database, Render service/configuration, Clerk/E1 permission, ADP/assistant integration, Sentry/PostHog configuration or Development/Staging/Production deployment is created by this task. **Observability:** `NOT_APPLICABLE` — governance only. Canon activation and product activation are distinct states.
