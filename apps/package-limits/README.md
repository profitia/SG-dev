# Profitia Package & Limits — Development operator dashboard

Architecture Platform owns this app and its narrow Identity read adapter. Authority: active Package & Limits v1.0, Customer Lifecycle v1.1 and [the Development runbook](../../Canon/runbooks/package-limits-development-v1.md). Consumer usage and E1 projection remain NOT_CONNECTED / PENDING_NOT_CONNECTED.

## Trust and persistence

Node24, TypeScript, pg, existing official Clerk SDK and the Profitia identity authenticator. Each request verifies official session/account and canonical User ID once; the verified actor flows through a bounded operation. Email, frontend roles and headers confer no permission. The current explicit operator grant is independent of membership, package assignment and technical product_grants.

Identity adapter reads only current binding and canonical organisation UUID/status/version/name. It creates or renews no account, organisation, membership or product right. Relevant canonical row locks fence revocation/status changes through the Limits transaction. Missing, expired or revoked binding and unavailable authority deny. Organisation names are resolved from Identity and never copied into Limits.

Ordinary runtime has no table privileges, ownership, owner membership, BYPASSRLS or database/role creation. Server-only short HMAC binds actor, login, transaction, deadline, operation and payload. SQL checks the current explicit operator grant. Raw SQL/GUCs and direct API cannot forge authority. Domain writes, audit and idempotent receipt commit atomically. Reused request ID with different content conflicts; a revoked operator cannot replay an old success.

## Commercial semantics

SpendGuru and SRM Standalone have independent assignments and usage contexts. SpendGuru can include embedded SRM without buying SRM separately. No fallback or unit transfer. Products, technical capabilities, packages, published versions, assignments, usage metrics and E1 budgets remain separate concepts.

Drafts are editable. Publication freezes capability/metric metadata, units and limits. A new draft/version never changes previous publication or an existing contract. Archive/restore controls future offer availability while retaining history. Custom capability/metric definitions use stable IDs; changed semantics require a new definition. Overrides belong to immutable assignment revisions and never edit a package.

Manual basis records its reference, source, operator action and reason. DEVELOPMENT_TEST marks synthetic acceptance data without real billing or production rights. A manual subscription has no automatic renewal. No PSP-paid assertion, invoice issuance, tax service, trial/grace/proration or carry-over is introduced.

Contract, assignment, usage, billing, invoice and due dates are distinct, with explicit IANA zone and half-open bounds. A change chosen for today starts at its actual recorded instant; a future day starts at local midnight. Effective revision timestamps preserve earlier snapshots. Assignment overlap is serialized by organisation/product. Calendar/activation cycles preserve original month/year anchors and DST. Missing metric policy never implies UNMETERED. Future metering must explicitly adopt policy and version receipts.

OpenAI input/output/cached/reasoning/total and Profitia API cost are separate observations. Do not add cached/reasoning twice to total. Model-specific pricing, reservation, settlement and reconciliation need later adapters. A cache hit is no new paid upstream call. UNMETERED exempts no E1/security/provider quota/retention/authorization control.

## Build and tests

Node >=24.15 <25. Run npm ci --ignore-scripts --install-links, npm run typecheck, npm run build, npm test. Database tests require LIMITS_TEST_ISOLATED=1 and LIMITS_TEST_OWNER_URL for a disposable loopback PostgreSQL18, user limits_fixture_owner, database neondb. They recreate only that local synthetic fixture; cloud URLs and business roles are rejected. Tests exercise real ordinary roles/RLS, migration transactions, immutable versions/history, overlap/concurrency, revocation, HMAC, dates and recovery. Mocked official SDK verification is source evidence, never a live user claim. CI deploys nothing and uses no cloud/provider credential.

## Controlled first installation

Exact existing targets are in deployment/development-v1.json. Runtime accepts Development only, exact service/host/database/ordinary role, strict TLS and a clean accepted source SHA. .env.example contains names without values. Never supply owner/migrator credentials to the service.

npm run install:plan emits reviewed source SQL/checksums without connecting. Create the new ordinary login roles with the emitted SQL, then assign strong generated passwords through a private controlled connection. Neon Console/API role creation grants administrative rights and must not be used for runtime logins. The installer rejects privileged roles or inherited memberships. Use a NOLOGIN owner and a distinct controlled migrator. Apply checksummed source transactionally. The Identity adapter adds only its namespace, limited role and read functions; canonical tables/policies/data remain unchanged. If the controlled administrator has ADMIN but no SET on the existing Identity owner, a transaction-local temporary SET membership may be granted and revoked by that same grantor before commit, preserving the original provider grant unchanged. An installed namespace requires exact receipt/function/owner/RLS/ACL/role verification. Exact replay is skipped; mismatch stops. Initialization never rotates a key or overwrites history.

Capture fresh empty-namespace/schema/role and reserved-service configuration first. There is no previous app LKG on first install. Recovery stops intake/restores blocking commands and retains diagnostics/data; it does not drop data/schema or reset a branch. Test rollback locally. Preserve the exact accepted artifact/config/schema compatibility for subsequent releases. Migration 003 adds a signed, current-operator read for global dashboard totals and nearest expiries; its separate immutable receipt leaves base migrations/checksums and commercial history intact. Apply only dashboardMigrationSql to a verified base installation, never replay the base initializer. Compare base functions and existing row counts before/after; exact full installation replay remains a verified skip.

Keep Auto-Deploy/previews OFF. Existing limits-development uses repository-root build context. Build: npm --prefix apps/package-limits ci --include=dev --ignore-scripts --install-links --no-audit --no-fund && npm --prefix apps/package-limits run build. Include the compiler during this build even with NODE_ENV=production. Start: node apps/package-limits/dist/server.js. Health: /healthz. Set LIMITS_EXPECTED_SOURCE_SHA and manually deploy that exact accepted SHA. Build performs no migration or provider/database call. The private Identity database denies PUBLIC CONNECT: grant CONNECT only to the new adapter reader, in addition to its namespace/function rights. Current Render MCP environment updates also initiate an API deploy despite Auto-Deploy OFF; use the official save-only API for subsequent environment changes, then an explicit commitId deploy after configuration is complete.

LIVE requires independent Render SHA/status/health/logs, actual Neon role/schema/receipt and real owner login; create/publish SG and SRM packages, assign both to a canonical authorised organisation, reload persisted data, change through versions/history and verify denials and honest integration states. Green source CI, deploy or health alone is insufficient. Required main CI and canonical PMOS/PHR closeout remain mandatory.
