# Self-service account MVP — Development source and operator gate

Owner: Architecture Platform. Task: ARCHITECTURE-IDENTITY-SELF-SERVICE-MVP-20261022.
Consumer: separate SG2-SELF-SERVICE-FIRST-USE-MVP-20261022 task/PR/PMOS.
Status: SOURCE PROPOSAL. No release, provider configuration or live acceptance.

## Account-only flow

The SG2 entry points use its existing official Clerk React SDK, PL/EN localization and native session persistence. The source opt-in uses client-only satellite initialization (no generic React Clerk SSR/hydration), exact server-selected primary URLs and official redirect helpers; the primary Runtime mounts the native SignUp/SignIn widgets. Sign-up, email verification, passwords, challenges and recovery stay entirely with Clerk. Both authentication modes continue to the configured central Runtime path `/account/sg2/account-pl/registration` (or account-en/login). Every segment resolves through the existing server-owned target/route registry. No request supplies an arbitrary return URL. Only bounded opaque SDK handshake query is permitted on the public primary GET page; it is not reflected, logged, passed to account APIs or interpreted as identity/authority. Protected transport query/Host/Origin rules remain unchanged.

The central page initializes the official Clerk browser SDK/UI at exact verified public versions6.40.0/1.41.1 and localization4.23.0, reestablishes its own native provider session, then POSTs an empty object to its own `/v1/account`. This deliberately does not pretend that a navigation or shared issuer transfers a browser session between domains. Required primary/satellite/domain configuration and real cross-domain browser acceptance remain a release gate. See [official Clerk JavaScript integration](https://clerk.com/docs/js-frontend/getting-started/quickstart).

`POST /v1/account` accepts only same-origin JSON with exactly `{}`. It uses the existing B1 createIdentityProvisioner, official current session/user checks, a currently verified primary email and a bounded real SQL transaction. Only after commit and another current binding/session read can it return `{authenticated:true,userId,expiresAt}`. No Organisation ID, roles, memberships, grants, profile PII, credentials or SDK proof are projected. B1 remains responsible for idempotency, unique issuer/subject binding, atomic account/profile creation and canonical audit.

`GET /v1/account` is read-only. It uses the already accepted bearer peer-GET mechanism at exactly this path, with source origins derived only from configured target origins. It does not accept browser CORS or peer POST, forward cookies, provision, renew, restore revoked bindings, or grant product access. The SG2 `/api/account` receiver uses this one fixed GET, its existing accepted public-ingress normalizer, bounded response and timeout. Product APIs retain all their independent current organisation/resource/E1 checks.

The account landing is neutral SpendGuru branding. It shows readiness only after backend confirmation, clears the previous principal on account change, invalidates its display once the authoritative expiry is reached, and uses native Clerk sign-out. It offers no organisation or product navigation. Existing PORR Demo remains selected by its existing mode; feature flags default off.

## Disabled-by-default configuration

This list describes source inputs only; none is installed by this task.

- Runtime: existing IDENTITY_RUNTIME_ENABLED remains false. A later release may explicitly opt into IDENTITY_SELF_SERVICE_ENABLED=true only with the existing runtime's exact Development configuration/issuer/binding and ordinary identity_b1_runtime role.
- B1 inputs: IDENTITY_PROFILE_SCHEMA_DIGEST must match the accepted unchanged001 migration/installation; IDENTITY_PROFILE_PROOF_KEY is an owner-provided separate32-byte attestation key through the approved secret store. No key is generated or configured here. Existing B1 app/binding, key and allow_registration policy must be independently approved and activated later.
- Runtime target sg2: exact receiver origin, application ID and route keys account-pl/account-en mapping to /pl/account and /en/account. Retain other approved targets; no wildcard. This is an operator-reviewed configuration change, not an automatic registry activation.
- SG2: PROFITIA_SELF_SERVICE_ENABLED=false by default. A later release requires explicit PROFITIA_SELF_SERVICE_SATELLITE_ENABLED=true, approved official primary/satellite configuration, Development-only enablement, exact PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN already in its accepted Clerk authorized parties and the operator-selected exact PROFITIA_IDENTITY_RUNTIME_ORIGIN. No private Neon credential is added to SG2 by this account read adapter.

## Binding lifecycle gate

PR600 is proposal input, not accepted policy. Current B1 SQL001 explicitly denies expired/revoked/disabled bindings and accounts and does not renew them. SQL001 and its digest remain unchanged. The Development live-delivery candidate adds a separate optional SQL002/API: ACTIVE renewal only within30s of expiry, and separately enabled recovery of expired ACTIVE mappings within an approved maximum7-day window. The lease stays within fresh provider proof and the existing maximum300s cap. Installation, API grants, runtime flag/digest and policy all require the consolidated owner GO. All defaults remain off. B1_RENEWAL=APPROVAL_PENDING until that decision; native Clerk persistence is not sufficient by itself.

Owner must approve the exact proposed ACTIVE-renewal and expired-nonrevoked recovery policy, its authority/limits/attestation/audit and controlled implementation/installation before that dependent capability can run. Explicit revocation and disabled accounts remain terminal denials. This task does not replace that decision with a longer TTL. Missing policy, schema digest, key or ordinary-role configuration fails closed.

## Single consolidated release gate

1. Review the two owner-specific draft source PRs and exact SHAs; require all appropriate public/source/controlled checks. PR605/600 stay subject to their own explicit decisions; no merge is automatic.
2. Supply the missing lifecycle decision and validate/install its reviewed implementation in a separately approved bounded operation. Resolve source dependencies before a live acceptance claim.
3. Approve one Development-only operational packet with verified current Runtime/SG2 service IDs, exact accepted source/artifacts/configuration, unchanged ordinary roles, Clerk Development issuer and primary/satellite/redirect/challenge settings, and synthetic test identities. No real PORR account or default organisation grant.
4. Before any write/deploy, independently establish retained LKG artifact IDs/digests/configuration, migration state, reversible backup and tested restoration. A SHA or a future rebuild is insufficient. Keep HEALTH_ONLY and disabled policies until these gates pass.
5. Run real browser registration, verify email, provision, sign out/in, reload/reopen, duplicate/concurrent requests, session revocation, account switching and product-access denials. Record actual provider/runtime/persistence evidence. Local SDK fakes/VM cases are synthetic tests, not browser SSO acceptance.
6. On failure stop propagation; disable only the newly approved flags/policies and restore retained compatible artifacts/configuration. Do not delete created user data/audit or automatically reverse irreversible migrations. No automatic retry build or wider infrastructure permission.

## Future Staging readiness

Require accepted source/CI and real Development browser evidence; approved lifecycle and retention; production-compatible Clerk keys/origins/domains/SDK integration; synthetic tests and no Development issuer leakage; independently tested E1/product denial; retained immutable promotion artifact and configuration; reversible data recovery; separate Staging owner GO and continuity per registered environment. No Staging configuration, database or deployment is touched here.

SDK reference for the source-only native session configuration: [Clerk satellite integration](https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains). Actual cross-domain browser acceptance remains PENDING.
