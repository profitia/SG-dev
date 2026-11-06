# ECR / SourceHub — preimplementation reconciliation

Task `ARCHITECTURE-ECR-SOURCEHUB-BACKEND-20261106`, ARCHITECTURE / SG-dev Architecture / Development, executed locally. This evidence records a proposal and current prerequisites; it is not G1 or a LIVE ECR acceptance.

Authority `profitia/SG-dev`, remote `https://github.com/profitia/SG-dev.git`, refreshed main `1cc5282c718ab1ce85fa9da4831592739c0ff899`. New isolated branch `architecture/ecr-sourcehub-backend-20261106`; unrelated shared-worktree changes preserved. Manifest3.37.0 validates. Existing CORE/ARCH documents were reconciled against the previously loaded accepted baseline and changed/new documents read. Root AGENTS, current execution/routing/profile adapters and registry authority govern this task.

Full preflight passed for the three exact proposal/evidence paths before mutation. Canonical begin returned registration `cmw4m9yaz0000m46580ww4x5y`, conversation `pmos-task-v2:dacc61f3b26582b081a7eb1ba73c46f6c3654e907327333aba92b8d960e12cc2`, host `01a19bde-d925-7eb3-bb0d-718fe3bce137`. Repeated full preflight with `--require-begin` passed. PMOS uses registered `architecture_pmos`/`architecture_pmos_runtime`, not product storage; MEMOROS is disabled by profile. Lifecycle remains open until factual closeout.

## Observed source and live state

| Surface | Independently observed state |
|---|---|
| ECR original proposal | PR864 open, Draft, unmerged, head534288ee; frozen SHA256124a405567648a75c1f5a3722f03419cefa22c49a6df492fa0a3fa601848c947; not active in manifest |
| ECR source paths | Runtime, contracts and CI each resolve `NO_MATCH`; no ECR G1/onboarding present on current main |
| SourceHub source | Active Architecture Platform owner, accepted `economic-calendar` payload1.0.0; shared client package1.1.0 and universal first-party protocol present on main |
| SourceHub service | Existing `srv-dbllmk0n74is73c2eptg`, Development `evm-dbl079ou01pc73eg0fgg`, workspace `tea-d7lps8rbc2fs73cn80dg`; auto-deploy/previews off |
| Actual live release | Render `dep-dbme6ubncjis738nu1c0`, status `live`, source817c671e31606536a1536dd187165ac07145a0fc; no active queued release in the returned latest3 deploys |
| Hub database read | Exact project `delicate-queen-44677134`, Development branch `br-orange-salad-ba2llks7`, `neondb`, queried as ordinary `source_hub_development_runtime` |
| Universal installation | `to_regclass('source_hub.first_party_acquisitions')` returns null; source acceptance does not establish installed first-party readiness |
| TE Calendar licence metadata | ACTIVE, version2, expires2026-12-04T22:19:09.351Z, private consumer use true; consumers Newsfeed and Oil v0.4, retention0, redistribution PRIVATE_AUTHORISED_CONSUMER_ONLY; no consumer_access_mode column value |

The live licence row is not treated as a contractual contradiction to the owner's new business declaration. It requires proper configuration/contract alignment before durable ingestion. Existing identities are not impersonated to obtain a positive probe. No provider call, product SQL mutation, resource/configuration change, grant, deployment or ECR implementation was performed during this reconciliation.

## Deliverable and decision boundary

The linked [additive amendment](../proposals/v1.1-economic-calendar-runtime-source-hub-and-preferences-amendment.md) preserves the frozen business vision while specifying SourceHub-only acquisition, a shared durable event model, observed history, independent private favourites/filters and current E1 isolation. The [exact G1 candidate](../proposals/economic-calendar-runtime-source-hub-g1-v1.json) contains three proposed rows and activation steps; it does not change executable registries or activate an owner.

Only missing G1 blocks ECR source edits. Missing installed SourceHub universal support, genuine component/service identity and designated ECR storage/service additionally block a LIVE ECR proof. The current execution prompt explicitly reserves those formal and administrative boundaries. After the necessary approval, continue the same business objective rather than demanding a new business prompt. Validation and the eventual PR/PHR readback will record their real results separately.

## Validation performed before proposal publication

Existing SourceHub adapter/contracts/semantic diagnostics: 25 tests PASS, zero failed/skipped; existing SourceHub build/typecheck PASS. These use synthetic provider fixtures and are not TE Calendar LIVE evidence. Provider adapter and test source remain byte-identical to authority main. The [official TE field schema](https://docs.tradingeconomics.com/economic_calendar/schema/) and [snapshot documentation](https://docs.tradingeconomics.com/economic_calendar/snapshot/) confirm the distinction between the previous value after revision, its pre-revision value, consensus and vendor forecast, UTC event time and the separate reference period/update fields. No historical vintage is inferred from a snapshot.

Actual Development HTTP readback: `/health`200, `/ready`200 and `/v1/capabilities`200; unsigned `/v1/acquire`401 `PEER_AUTHENTICATION_REQUIRED`. This proves service readiness/catalogue visibility and an authentication boundary, not an upstream Calendar acquisition. No authenticated probe was fabricated under a different component's identity.

The manifest, proposal JSON, unique proposed row IDs, negative ECR routing and whitespace checks pass. Required existing governance suites are run separately from an optional broad test scan. The broad scan reports391/393 PASS: two unchanged `package-limits-routing.test.mjs` historical freeze assertions reject the already accepted Newsfeed/SourceHub additions on current main. Their test and compared active registry bytes are untouched by this three-document proposal. Record this pre-existing finding without weakening tests or expanding into an unrelated Limits repair; the actual required CI remains authoritative.
