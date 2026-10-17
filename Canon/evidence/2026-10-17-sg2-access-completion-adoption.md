# SG2 — explicit access candidate adoption, 2026-10-17

Status: LOCAL_VALIDATION_PASS; coordinated publication and deployment are separate gates.

Task: `SG2-E1-ACCESS-COMPLETION-ADOPTION-20261017`, profile SG2, target Development. Producer: ARCHITECTURE task `ARCHITECTURE-E1-ACCESS-COMPLETION-20261017`, repository `profitia/SG-dev`, PR #413, source `3cf75e99389fc7b888e85dce8bf28f8c85723314`. This record accepts the exact fingerprints in `apps/sg-runtime/operation-integration.json`; it does not claim that live routes use the new host.

## Accepted implementation

The existing ordinary Prisma adapter now requires the benchmark module binding and the accepted SQL002/SQL003 digests. The candidate data policies use the common module scope instead of a hardcoded application identifier. A restrictive fence remains effective even when an older permissive policy admits a row. The controlled NOLOGIN schema owner is distinct from ordinary application logins. Existing composite foreign keys and organisation ownership are retained.

The same common audit writer records matching module evidence in INTENT and transactional OUTCOME. Missing membership is an access denial (403); infrastructure/configuration failure remains unavailable (503). Expiry after a write rolls back the business transaction and records the correlated FAILURE independently. Prisma's actual P2010 transport preserves SQL003's dedicated PT403 expiry state; the producer tests its translation to an access denial.

Official Clerk backend 3.25.0, React 6.17.8 and localizations 4.23.0 are installed without changing Next 14.2.29, React 18 or the three private package pins and integrity records. Deployment configuration delegates to the shared Clerk parser. Only public configuration reaches the existing PORR login layout; the home page reads it at runtime. Default legacy behaviour remains in effect until a separate, complete guarded activation. Explicit invalid Clerk configuration has no demo fallback. This increment does not alter middleware or activate API authentication.

## Local evidence

- 38 operation, API, SQL, identity configuration and React18 SSR tests: PASS, zero skips.
- Actual guarded loopback PostgreSQL, ordinary Prisma login, four-connection total role budget, two organisations and distinct read/write users.
- Negative cases include forged identity headers, wrong issuer/branch, revoked session/product/module, missing membership, foreign references, cross-organisation writes, direct authority/audit access, missing audit capacity, module expiry and rollback.
- A valid base lease without a module remains unable to read or update rows even after adding a synthetic permissive legacy policy.
- Typecheck and complete Next build: PASS. Only this build's known generated Prisma outputs were restored; no product source was discarded.
- Existing private package versions and lock integrity entries are byte-identical to the starting source. Controlled credential-free candidate CI and exact coordinated publication are still required.

## Limits and remaining acceptance

The fixture uses synthetic responses at the official Clerk SDK interface. It is not proof of a real Clerk session, a live account binding, onboarding, UI navigation, cross-host SSO, deployed private schemas or customer-data migration. No remote SQL, credential change, infrastructure change, account bootstrap or deployment occurred in this task. Existing Development and Staging deployments remain unchanged. The other protected entrances, Supplier Intelligence business reuse, complete E0/E1 and controlled releases remain IN_PROGRESS.
