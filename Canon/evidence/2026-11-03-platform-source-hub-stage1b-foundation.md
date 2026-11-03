# Platform Source Hub — Stage 1B foundation evidence

Historical proposal snapshot. Superseded for current authority by [final owner approval and activation](2026-11-03-platform-source-hub-final-activation.md). The proposal-stage statuses below describe that earlier snapshot.

Date: 2026-11-03. Task: `ARCHITECTURE-NEWSFEED-SOURCE-HUB-FOUNDATION-20261103`. Profile: ARCHITECTURE / Development / governance. Host: `01a19fe2-0dc1-7ca2-8acf-28504684e3c1`.

## Authority and result boundary

**Architectural direction: OWNER_APPROVED. Exact Source Hub G1: PENDING. Exact Hub canon and Newsfeed amendment: PROPOSED_NOT_ACTIVE.** No active manifest, routing, onboarding or existing canon was changed. A successful proposal task/CI/PMOS result cannot declare missing G1 or runtime acceptance. The owner explicitly permits a complete proposal when formal gates are missing.

[Exact G1 package and activation procedure](../proposals/platform-source-hub-g1-onboarding-v1.json), [Hub canon v1.0](../v1.0-platform-source-hub-business-and-architecture-canon.md), [Newsfeed amendment v1.1](../v1.1-newsfeed-source-hub-responsibility-amendment.md), [contract families](../registries/platform-source-hub-contract-families-v1.json), [environment plan](../registries/newsfeed-source-hub-environment-baseline-v1.json), [manual infrastructure guide](../runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md).

The active [routing canon](../v1.1-repository-routing-and-module-ownership-canon.md) requires explicit architecture approval and registry update for a new first-class module. Future routes proposed here are Architecture Platform / ARCHITECTURE only; routing tests exercise a temporary fixture, not active ownership. Future activation must refresh actual remote main and reviewed proposal bytes, preserve existing rows/epoch, then bind real acceptance provenance and classification reference.

## Accepted NewsAPI baseline preserved

Fresh source baseline: main `ef5d12e458309fcd4d6dddf76be95c03cfca7678` (PR #876). Accepted candidate `1a87951fbe5a513f15adce02fb169adf3bf70050`, accepted tree `f88c04653e0e2ae37b9efff3677237994f4e5dbd`. Existing main acceptance task reported actual-main run `41635358715`; that is prior evidence, not this proposal's CI.

All **23** accepted NewsAPI/NewsDiscovery files, including its workflow, catalogue and live evidence, are frozen in this change. The new test checks every working-file Git blob and the current tracked tree against the accepted candidate, not merely a directory name. No migration/copy/new provider/paid call or secret read took place. Existing NewsDiscovery **0.1.0** stays the implemented contract; five Hub families are proposed interfaces only.

Existing NewsAPI evidence (24 calls) remains linked from its unchanged catalogue. Unsupported/unproven filtering is not upgraded by Hub design. Preservation of source and offline validation are not a newly deployed backend or fresh live provider test.

## Read-only parallel references

| Reference | Exact head/file snapshot read | Status at inspection |
| --- | --- | --- |
| [Insights #847](https://github.com/profitia/SG-dev/pull/847) | head d143ca28c583c7f65e93e7fb4a2936f079d0cc33; canon blob 56d9449f41c3334a0fc49921181aa6107c123e44 | owner-approved with I1–I4, MAIN_ACCEPTANCE_PENDING / GOVERNANCE_ONLY |
| [Insights G1 #848](https://github.com/profitia/SG-dev/pull/848) | head 998862fb3e3249e056fc1159bc4a0fcab2e76dc0 | G1 granted in separate proposal; main acceptance pending; not this task's authority |
| [Oil #877](https://github.com/profitia/SG-dev/pull/877) | head 567dbdf123190dbb9dd67c8524e31bc2af89f3ff; Source Hub R1 canon blob 3167f39f5e7c98a1c0e85c936772da7833319935 | PROPOSED_FOR_OWNER_REVIEW / NOT_ACTIVE |

Insights Domain, Forecast Core and Benchmark Domain keep independent ownership. I1–I4 preserve separately accepted 7D mathematics, admission/E1/cost, CIC outside report production/review/delivery, and independent human pilot review with measured quality/economy. Oil v0.3 R1 retains its v0.2 conditional lineage, D1–D5 / BC1–BC6 / EP1–EP6, EXPERIMENTAL_7D/PARTIAL_READY limitations and frozen B1 evidence. None is modified, approved, merged or reopened by this task. TE is not a substitute for Macrobond, Forecast Core math or verification.

## Infrastructure findings and recommendation

Owner-supplied Development hostname was verified using Neon **read-only** project/branch/endpoint metadata:
- Newsfeed project `shiny-bonus-85532609`, PG18, AWS Frankfurt `aws-eu-central-1`, organization plan Scale.
- Dev `br-solitary-star-b9i144lk / ep-restless-sea-b9ducsrh`; Staging `br-frosty-cell-b9hzdh6e / ep-wandering-term-b9v57pi9`; root named production `br-wispy-bonus-b9ohunab / ep-mute-night-b9o332my`.
- Three endpoints idle, range 0.25–8 CU; timeout0 means global default300s, not always-on. Branch protection false; project history1day. No SQL, roles, data or effective access inspected.
- Existing Newsfeed Dev/Staging are reused; proposed separate Newsfeed/Hub Production projects and Hub nonproduction project. Current root named production is left unchanged and is not accepted Production runtime.
- PMOS remains the separate Architecture continuity database; product endpoint cannot replace it.

Public vendor documents and current pricing were read on 2026-11-03. Neon pricing document updated2026-10-31; Render pricing was also read from the actual public page because the text-only view omitted compute prices. Rates, formulas, official links and limits are in the guide. No resource creation, update, endpoint start, SQL, provider call, schema, service, cron, worker or deploy occurred. No actual secret was retrieved or written. Staging/Production are planning only; no execution-profile activation.

## Verification and continuity

The Stage 1B test module is imported by the existing governance suite so the unchanged Governance preflight workflow runs it on this PR. It checks proposal non-activation, simulated positive/negative routing and collisions, all23 NewsAPI blobs, independent families, environment/PMOS separation, exact guide resources/roles and relative links, plus existing SG2/SRM denial boundaries.

Local validation completed: **51/51 governance tests** (44 existing + 7 Stage 1B), **31/31 offline NewsAPI tests**, NewsAPI typecheck/build and governance manifest validation PASS. A first restricted-network attempt could not fetch historical Git objects; after the read-only fetch, the full suite passed without changing existing tests. Final exact PR SHA, CI runs and results, and PMOS/PHR readbacks are reported in the PR and task handoff after actual execution. They are not invented here before completion. Runtime/business acceptance, Sentry/PostHog instrumentation and recovery drill are **NOT_VERIFIED**; no UI/runtime changed.
