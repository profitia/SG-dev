# SG2 E1 — native capability and preparedness reads

Date: 2026-10-18. Task: `SG2-E1-NATIVE-FORECAST-READINESS-20261018`. Profile SG2, workspace SG-dev, TARGET_ENVIRONMENT=development; isolated local execution. Authority `profitia/SG-dev/main`, baseline `7c9ac9e43555d706c56ebf2500f7cc6c4feb58e1`.

## Result and authority

The three existing GET routes `/api/internal/forecast/capability`, `/capabilities` and `/readiness` now have an explicit native operation path. It requires the current verified account, session, organisation membership, SPENDGURU product/forecast feature, benchmark module and `forecast.read` permission. Each representation and exact series/model/semantic selection has its own server-derived resource identity and closed output projection. Organisation selection is validated independently; selection grants do not imply forecast permission.

The explicit legacy mode retains the original internal handler factories, parsing, calculation and technical authentication. In native mode an opaque technical credential remains refused before runtime composition, without reading or comparing the configured legacy credential. A JWT-shaped string grants nothing: the actual private host still performs current backend authentication and all authority checks. No error invokes a legacy handler as a fallback. Unknown or duplicate query keys, caller identities and prepared-authority headers are refused. Every response is private and not cached.

## One existing policy and genuine source adapter

`createStoredForecastReadinessReader` composes the existing capability resolver and interactive preparedness service, rather than creating another forecast or readiness algorithm. All read dependencies use the same existing verified ordinary-login, receipt, role/ACL, bounded read-only Repeatable Read source transaction. The execution methods and execution lease are explicitly unavailable; the composed preparation surface is not exposed. No nested transaction, provider, hydration, refit, job, persistence or global-client fallback is introduced.

The neutral data port from PR467 is implemented with actual SQL against the dedicated Current/Historical preparation-state views and actual generated Rolling snapshot/maintenance/count queries. It does not pretend those projections are legacy generated models. A newer failed preparation attempt remains STALE even when an older AVAILABLE artifact is still reusable. Current uses its original minimal training suffix; Verification derives its original full canonical history independently. Current authority is never substituted for a Verification fingerprint. The source-side Verification helper is the same validated read used by its standalone endpoint, without starting another transaction.

Single capability and capabilities inspect the original Current/RECENT/FAST/FULL artifacts and band policy. The readiness snapshot preserves the original lighter, state-only behavior; it is not a claim that every reusable artifact was inspected. Non-daily provider provenance remains absent until genuine evidence exists, so the resolver retains PROVENANCE_REQUIRED. Missing stored history is an honest refusal, not synthetic source metadata.

The closed shared result preserves statuses, zero/null, scientific identity, readiness booleans and blockers. It excludes detailed traces, raw errors, private source initiators and arbitrary extra fields. Explanatory failure text uses a fixed public message. Publication is bounded to 64 KiB; a series snapshot contains exactly the twelve unique model/semantic identities. A source failure is withheld and audited as FAILURE, rather than reported as a successful empty result.

## Validation

- 470 operation-context tests and 61 original forecast/snapshot regressions passed, zero skipped. Strict types cover the new adapters, handlers, runtime and typed tests.
- Genuine generated Prisma schema, ordinary restricted source login and actual approved SQL projections in a guarded disposable PostgreSQL database exercise both period meanings, all four models, Rolling state, minimal Current versus full Verification fingerprints, zero-valued bands and the latest failed Current/Historical attempt.
- Native-period provenance is not manufactured. Bad source receipts, malformed preparedness facts, missing history and forbidden global/provider dependencies are checked. Four fresh child-process imports of the new source adapter and actual routes resolve neither the global datastore nor a provider.
- The actual private host/API fixture checks all three representations for independently authorised organisations A/B, current session/account/membership/product/module/permission revocation, dedicated-organisation restriction and refusal to borrow Current resource authority. Projection taint and source failures are withheld. OUTCOME audit failure independently retains correlated INTENT/FAILURE without returning protected data.
- Original internal-route refusal tests remain unchanged and pass, including refusal of the old technical token outside explicit legacy mode. The existing preparedness and forecast policy implementations are unchanged.

Exact candidate/main CI, independent source proofs, PR/merge and the canonical SG2 PMOS/MEMOROS/PHR closeout are recorded in the task lifecycle after publication; this document does not pre-claim them.

## Deployment boundary and remaining E1

This is source/API candidate integration, not a live product release or completion of E1. The existing V3 forecast SQL candidate is unchanged (`470fab978fb6cccd1950a104749591b39fa272a63eb2b8a8605dd8b57c5a5069`); this task does not install it or alter provider data, schema, roles, grants, secrets, flags or configuration. The four SG2 Development deployments were checked against the baseline and remain unchanged. No Staging or Production mutation occurs.

Dashboard adoption, delegated preparation/jobs/cache/files, actual source installation and credential/configuration binding, live Prisma TLS and Clerk/browser verification, executable recovery and controlled Development then Staging releases remain separate accepted E1 work. Tests of synthetic authority/source fixtures do not establish real login, live data isolation, business UAT or recovery readiness. SG2 records its own Development PMOS/MEMOROS/PHR lifecycle; no other profile history is borrowed.
