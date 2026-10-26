# Price Change Index — isolated SG2 frontend demo onboarding

Date: 2026-10-26. Execution profile: **SG2 / SG-dev / development**.
Authority: **profitia/SG-dev**, branch **main**.
Baseline: `daf0ac13db8a8ebe3af7dff263b399da3638bfcc`.
Task: `SG2-PRICE-CHANGE-INDEX-ONBOARDING-20261026`.
Host conversation: `01a17820-5e4f-7dd0-95bd-35daea1d6da2`.

## Owner instruction and decision

The human owner requested a new reusable, independently hosted frontend for Price Change Index, all three designs in the identified MagicPath project, local synthetic data and complete local interactions. The request explicitly authorizes required governance onboarding, implementation, tests, PR/merge under policy and an isolated Development release; it excludes product integrations, databases, authentication and any Staging/Production operation.

The owner subsequently clarified: **do not create a Render project; create one Web Service named `Price Change Index`**. The existing registered SG2 project/environment are reused. The owner also explicitly approved the linked SRM UX/UI library as the shared visual canon for **Price Change Index / SG2**. This approval concerns UI source and provenance, not SRM product/runtime integration.

These bounded instructions authorize the new SG2 presentation capability and its necessary routing. No existing owner, frozen classification reference, transitional epoch or project key changes. New registrations describe approved canonical placement; they do not assert implemented code or a running service. They become authoritative for implementation only after this candidate is accepted on main.

## Exact namespace and ownership

Logical owner: **SG2 Price Change Index**. Writable profile: **SG2 only**.

| Proposed registration | Exact scope | Responsibility |
| --- | --- | --- |
| SG2-PCI-BASE-001 | `packages/sg2-price-change-index-ui/**` | Reusable React UI, scoped styles, typed input/event contract, source provenance; no fixtures, network transports or product identity. |
| SG2-PCI-BASE-002 | `apps/sg2-price-change-index-demo/**` | Thin demo host, local routes, synthetic fixtures/simulations, independent host verification and frontend asset serving. |
| SG2-PCI-BASE-003 | `.github/workflows/sg2-price-change-index-ci.yml` | Independent credential-free validation and build; no deployment. |

Baseline classification for these new canonical surfaces: ALIGNED. Product deltas retain the separate TRANSITIONAL classification under the active registry policy. Misspelled siblings and other profiles continue to fail closed. Existing SG Runtime, Dashboard Preview, Forecast, Benchmark Finder, Maps, Identity and SRM surfaces retain their exact ownership and release bindings.

This onboarding changes exactly this evidence document and `Canon/registries/current-architecture-baseline-v1.json`. It creates no product files. The implementation task must publish its complete file inventory and pass every exact path before edits. Its top-level planned files are `packages/sg2-price-change-index-ui/package.json`, `packages/sg2-price-change-index-ui/src/index.ts`, `packages/sg2-price-change-index-ui/README.md`, `apps/sg2-price-change-index-demo/package.json`, `apps/sg2-price-change-index-demo/package-lock.json`, `apps/sg2-price-change-index-demo/index.html`, `apps/sg2-price-change-index-demo/src/main.tsx`, `apps/sg2-price-change-index-demo/vite.config.ts`, `apps/sg2-price-change-index-demo/tsconfig.json`, `apps/sg2-price-change-index-demo/deployment/render.yaml`, and the exact CI filename above. Revision-specific source files, fixtures, assets, tests and matrix evidence are enumerated separately before implementation, not implicitly authorized as unknown write targets.

## Pinned design source

The user supplied project `463295321573851136`, whose current MagicPath display name is **CCI**. Its three components are Price Change Index designs. The following are the exact revisions displayed on the canvas when inspected; they are pinned for this delivery rather than resolved repeatedly to latest.

| Design | Component ID | Canvas revision ID | Generated name |
| --- | --- | --- | --- |
| Price Change Index, flow 1 | 463296435564220416 | 465437640712400896 | glad-breeze-9378 |
| Price Change Index, flow 2 | 463310747150213120 | 465437647490396160 | coolly-field-1347 |
| Price Change Index, version 3 / purchase context | 463321469305384960 | 465437653945430016 | serenely-garden-7351 |
| Approved shared UX/UI library, Biblioteka | 460628347660177408 | 464039002702499840 | clever-tide-1504 |

Library project: `460628300646219776`, **SRM · Biblioteka Elementów i Zachowań UX/UI**. Share tokens are intentionally excluded from all evidence. Complete editable source was accessible. A stored preview is source evidence only; it does not prove interaction, theme or responsive parity.

Source version 3 contains a hidden live MagicPath theme iframe/postMessage dependency and uses the SRM preference namespace. The delivery must use pinned local theme metadata and its own namespace, without a MagicPath runtime dependency or document-wide CSS/theme mutation. Source font URLs also require local licensed assets. These containment adaptations must preserve measured appearance and be tested; no current 1:1 claim is made.

## Render target and resource boundaries

Read-only provider discovery matched the current SG2 topology:

- Workspace: **PROFITIA WORKSPACE**, `tea-d7lps8rbc2fs73cn80dg`.
- Existing project: **SpendGuru 2.0 Actual**, `prj-dap98ddg1s2s739ssatg`.
- Existing environment: **Development**, `evm-dap98hm0tbcc738rro10`, network isolation enabled.
- Requested new Web Service display name: **Price Change Index**. No existing service of this name was returned in the initial inventory; collision must be rechecked immediately before creation.
- Compute budget: one instance, at most the owner-approved **$7/month** compute plan. Actual plan, usage charges and configuration must be verified before creation.
- Repository: `https://github.com/profitia/SG-dev`; deploy an approved immutable revision from main, manual release, previews off. No existing service is reused or redeployed.
- The web process serves built frontend assets only, on Render's provided port. It does not create a product API or business backend. No disk, database, queue, cron, worker, auth, LLM or external product connector.

The initial service/deploy IDs and URL remain **not created / not available**. Actual returned identifiers must be recorded additively in the SG2 topology through a separate controlled step, preserving the existing main Development identity. No placeholder resource IDs are written into active registries. Service creation starts the first build, so it is deferred until reviewed source, checks and containment/recovery instructions exist.

## Portability and acceptance

The module accepts typed host data/configuration and emits callbacks/events. It requires no existing application router, store, session, domain, database or service. The host owns synthetic fixtures, client branding and deterministic simulated results. Default state is in memory and resettable. A separate minimal test host must mount, unmount and reset the public export without importing existing apps. No real iframe/postMessage/microfrontend integration is included.

Before implementation, the completeness matrix must map each element and interaction to the pinned source, component/variant/behavior, parameters/states, exact implementation file, test and evidence. Required statuses are DO WDROŻENIA / WDROŻONE, NIEZWERYFIKOWANE / ZGODNE / ROZBIEŻNOŚĆ / BLOKADA. Both themes, source breakpoints and 390/768/1440/2560 plus intermediate widths require local and live verification. A passing build or LIVE deploy is not a parity claim. The canon inspector needs real local provenance and remains separate from actual reuse/synchronization.

The runtime network and built assets must contain no product requests, credentials, database configuration or existing SG2/SRM integration. The final report must retain unverified or conflicting rows and cannot claim 1:1 until all required rows are ZGODNE. Stage 2 data/host integration remains a future plan requiring a separate instruction.

## Governance chronology and parallel work

The task uses its own checkout/branch, own dependency install, PMOS configuration, runtime-context and PHR clone. Registered continuity remains existing SG2 PMOS (`lucky-dream-96138453/neondb`), with MEMOROS and PHR required. No new continuity database or implementation is created. PMOS secrets are confined to ignored tooling configuration.

Canonical begin returned registration `cmvp8c1920000numhpjx1s1kv`, conversation `pmos-task-v2:2429d7cf7e913355c19cbd6e5ca9fd9931913a9e74c1a7985e6a1a1716b8131b`. The initial fresh-checkout runtime gate failed because local context/integrity artifacts were absent; canonical `pmos:context` rebuilt them from existing SG2 authority and runtime verification then passed.

The first require-begin attempt correctly reported CODE_STATE_GATE BLOCKED because this task's local registration input was untracked. An early uncommitted three-entry registry edit was made before that result was inspected; it was preserved outside the checkout and completely reverted before proceeding. No push, merge or deploy occurred. The registration input was moved outside source, and the clean full require-begin preflight then returned PASS for all applicable gates. This later PASS does not rewrite the earlier blocked chronology.

Open PRs were inventoried. Existing PR154 proposes changes to the same baseline/topology files; its source is not adopted. This task's narrow onboarding is a serialized step based on fresh main, preserves all current entries and must be refreshed/rechecked immediately before merge. No shared lockfile, root manifest, root render.yaml, shared component or other profile's runtime is changed. Parallel SRM work retains separate namespace, files, task, build, service and URL.

## Current status and recovery

**ONBOARDING CANDIDATE — PR acceptance pending.** No frontend implementation, Render resource, product integration, migration or 1:1 acceptance is asserted by this document.

Before merge, recovery is to preserve or reject this candidate with main unchanged. After acceptance, a reviewed source revert may remove the three new routes only after checking dependent work; never rewrite task history. First deployment has no predecessor: preserve the absent-service baseline and document controlled suspension/recovery before creation. Do not delete a completed demo automatically. Canonical PMOS closeout, MEMOROS/PHR acknowledgement and remote evidence are separate factual outcomes recorded after they occur.
