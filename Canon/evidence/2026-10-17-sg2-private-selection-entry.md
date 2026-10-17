# SG2 — existing selection entry adopts the private host under explicit configuration

Task `SG2-E1-PRIVATE-SELECTION-ENTRY-20261017`, SG2 / Development; authority at start `6620389e6fa543f214d170e132d5f9d849de7178`. Status: source integration candidate, **not activated or deployed**.

## Result

The existing GET/POST `/api/benchmark/selection` entry now uses one lazy deployment-owned dispatcher. Default or exact `legacy_demo` calls the retained existing signed-demo handler and needs no private database configuration. Explicit Clerk requires a complete, consistent server configuration; unknown, empty or incomplete configuration returns a generic non-cacheable error and never retries through demo.

The private receiver targets pin the verified Development service, Neon project/branch/hosts/database, ordinary runtime role and accepted access/module/audit digests. The dedicated profile's organisation comes from a validated server configuration value, never from caller headers or body. An explicit query selection remains subject to current membership and the common application's fixed-organisation ceiling; duplicate or empty context is rejected. No private ID or credential is baked into component source or this evidence.

The adapter constructs the existing official Clerk client and accepted common private host with native Prisma. It does not add a token verifier, permission engine, account store or network runtime. The physical access descriptor, identity binding, current membership/product/permission, transaction-local module scope, private business effect and durable audit remain in the previously accepted mechanism.

Server resources are cached only under the same complete configuration fingerprint; a different configuration requires restart rather than reuse of an old host. Actors, sessions, memberships and request scopes are not cached. Three business connections plus one reserved independent audit connection fit the role's four-connection budget. Private success and denial responses use `private, no-store` and vary on Cookie/Authorization. Existing model, URL and business response contracts stay intact.

Connection URLs require the approved Neon destination and TLS, reject owner/foreign roles, sockets, alternate databases and arbitrary query options, and add native Prisma `sslaccept=strict` with bounded pool/connect timeouts. The option is documented in [Prisma's PostgreSQL connector reference](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql). Configuration intent is not proof of a live TLS handshake or provider login; those remain release checks.

## Verification before publication

- Full fail-closed source preflight, own begin and require-begin PASS.
- 76 operation/configuration/actual API/ordinary-role SQL tests PASS, zero skipped. Receiver targets are independently compared with recorded preparation, the SG2 topology and actual accepted schema bytes. The private SQL suite now drives the same dispatcher used by the deployed entry, uses the exact accepted DDL and the production three-plus-one pool split, and verifies six overlapping requests within the four-connection role budget.
- Server default, foreign dedicated-profile choice, forged headers/body, duplicate/empty context, current permission/product and SDK revocation, output cache boundaries and no fallback are exercised. Existing transaction timeout, restrictive RLS/module, composite-FK and durable audit failure tests still pass.
- The actual entry refuses incomplete Clerk configuration without invoking private or demo business effects. Negative URI tests supply genuinely changed hostile strings; WHATWG URL's ignored cross-protocol setter is not used as a false negative fixture.
- Typecheck, full Next14/React18 production build and 11 existing PORR session/middleware/Polish UI regressions PASS. Private package pins and shared producer fingerprints are unchanged. Only this build's known generated Prisma output was restored/removed.
- Exact-source controlled registry install and all required remote checks must pass before merge; final source/run references are in this task's canonical PMOS/MEMOROS/PHR closeout.

## Activation and remaining boundaries

No database, role, secret, flag, Render/GitHub setting, connection, domain or live deployment changed in this source unit. Both new-store application bindings remain disabled according to the separate initialization evidence. The target file's observation is dated; it is not activation authority. Staging's existing business environment is active, but the new private binding is not prepared; the reader cannot borrow Development for Staging or Production.

A controlled future release must supply the exact approved service/source/configuration identity, proper Clerk configuration, private database secret and internal fixed organisation, verify the actual schema receipt/roles, and explicitly authorize application activation. This entry alone does not authorize that release or claim adoption by the other market/category/forecast/dashboard/SRM entrances. Real browser OTP/session, all-entry protection, actual business-module reuse and controlled Development/Staging acceptance remain required by the full E1 programme.
