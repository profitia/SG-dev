# B1 — Identity & User Profile Backend v1

Date: 2026-10-21. **ARCHITECTURE / SG-dev Architecture / development / local**.
Task: **ARCHITECTURE-IDENTITY-PROFILE-B1-20261021**. Repository authority: **profitia/SG-dev / main**.
Base and accepted B0 merge: **39d0aadfafa621c214a69ac1b7f666a8220a51b1**, PR #589.
Branch: **architecture/identity-profile-b1-20261021**. Scope: source, migration candidate and synthetic tests only.

## 1. Authorization and governance

The actual owner-supplied B1 task explicitly selects ARCHITECTURE, authorizes backend implementation, candidate SQL, synthetic local PostgreSQL validation and a controlled PR. The accompanying SG2 wrapper supplies common safeguards; it does not redirect this shared producer's continuity into SG2. No profile is switched implicitly. The active Architecture adapter, CORE/ARCHITECTURE manifest documents, exact routing and full preflight govern execution. Task A/B0 audits were not repeated; the accepted B0 merge and current routes were verified.

Canonical begin: **cmvi2u6qq0000pqfl4mzztbik**. Conversation: **pmos-task-v2:abd498b0a4f48745da4e5f5122956d56669f1498ae5472bd62a2d431142d0448**. Actual host: **01a15aed-8d94-7fe0-9cff-c54f72b5f8a8**. Own PMOS: **billowing-credit-07394675 / architecture_pmos**, registered endpoint and ordinary **architecture_pmos_runtime** role; own context/artifacts/PHR clone. MEMOROS is **DISABLED_BY_PROFILE**. Full Development preflight passed before begin, and full `--require-begin` passed before source edits, without bypass flags.

Every package path resolves to Architecture Platform / ARCHITECTURE / ALIGNED. The evidence path resolves to Governance Source Layer / ALIGNED / ARCHITECTURE allowed. Existing global epoch/classification is unchanged; the new product delta is separately TRANSITIONAL. No legacy path/write exception is involved.

## 2. Implemented contracts and reuse

- **Identity Provisioning v1**: same-receiver POST → existing official-SDK authenticator → policy-gated atomic account/binding/profile creation → final original authenticator checks → commit. User ID is a generated UUID, distinct from Clerk subject. Repeated and concurrent calls yield the same account. Database failure rolls back all new rows. Email, browser IDs, webhook assertions and provider role metadata do not create authority.
- **User Profile v1**: current-account read, idempotent initial profile and closed patch of `avatar_sex`, `job`, `phone`. Existing `createPrivateOperationHost`, Access Store, ACCOUNT_SELF and `account.settings.read/write` provide authentication, access, canonical audit and transactional output checks. No alternative Access Store, authenticator or policy engine is introduced.
- Existing Identity Provider, Clerk Configuration, Access Store, Operation Context, private host, all previous migrations and SG2/SRM source remain byte-identical. The original independent contract fingerprints therefore remain unchanged. New entrypoints and candidate migration require explicit future consumer adoption.
- Package stays at the currently accepted **1.23.0** aggregate; the two new contracts are independently versioned **1.0.0**. Exports/types/build checks are additive. `libphonenumber-js@1.13.15` is a pinned producer devDependency, injected as the trusted server-owned phoneParser adapter. A new consumer installs/injects that parser explicitly; old entrypoints/consumer locks and their strict dependency guard remain unchanged. Aggregate promotion is deferred to explicit consumer acceptance.

The provider/session is mocked in server adapter tests; this is not Clerk dashboard verification, live browser auth or B2 acceptance. Actual database tests use real PostgreSQL and ordinary roles, not mocked RLS.

## 3. Explicit admission and renewal policy

The optional SQL runtime-policy row is owner-managed and disabled by default. Missing policy, wrong issuer/environment/binding/digest/role, missing current SDK-authenticated session or missing backend attestation produces DENY. Registration requires the separate explicit `allow_registration=true`; no installer activates it automatically.

New binding lifetime is `min(verified token expiry, current provider session expiry, abandon deadline, operator-selected max lifetime)`. The permitted operator ceiling is finite, 1–300 seconds. No artificial far-future date is used. Existing ACTIVE/unexpired binding is reused without extending its lifetime or overwriting the profile. Existing DISABLED accounts and REVOKED or expired bindings are denied without repair. The existing `(issuer,subject)` uniqueness and access authority fence serialize competing admissions and revocation.

**OWNER ACTION REQUIRED — narrow renewal decision before productive activation:** decide whether a later, separately reviewed renewal operation may renew an expired ACTIVE binding after fresh verified authentication, with exact finite horizon, conflict/revocation checks and audit. B1 implements no renewal. An otherwise valid long-lived browser session will not revive an expired binding; this deliberate limitation must remain visible in UAT. No decision about the accepted architecture or the three profile fields is requested again.

## 4. Profile and data policy

Preferred live target remains **spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private**, schema **profitia_profile**, table **user_profiles**. No live schema was installed.

| Field | Implemented boundary |
| --- | --- |
| user_id | UUID PK/FK to existing profitia_access.accounts.user_id; one profile per account, no organisation key |
| avatar_sex | male/female/null; assistant avatar preference, never the user's sex |
| job | Optional NFC/trimmed text, at most160 Unicode code points; control/format characters refused; empty clears to null |
| phone | Optional strict international E.164, full library validation without default country; extensions rejected; unverified contact only |
| version | Positive monotonic bigint, encoded as decimal text; expectedVersion required; stale writes conflict |
| created_at / updated_at | Server-controlled; creation immutable; update/version advance only on successful writes |

Profile is **ACCOUNT_PRIVATE**, owned by the verified internal user. Membership in the same organisation and an organisation-admin label confer no profile access. Author/editor metadata is separate from ownership. The current-user API does not accept an owner selector and refuses system fields/accessors/symbols/inherited patch properties before authority work. Concurrent caller mutation cannot change the captured patch.

**Update/export/removal policy:** the authenticated user can clear optional values immediately to NULL. The current-user read is the minimal profile export/projection, with no broader account/security data. B1 has no account deletion or cross-user export API. Account closure, legal hold, backup expiry, deletion/pseudonymization and numeric retention periods require the owner's separately authorized retention plan before productive installation; no existing account is deleted or reassigned. The FK deliberately has no destructive cascade.

Canonical audit contains the internal account ID, operation/result and metadata, never raw profile values, telephone, session credentials or an unsalted digest of a telephone. Update input uses an opaque random change reference plus field names/expected version. The existing canonical INTENT remains independently durable; profile mutation and required OUTCOME share the real transaction. Failed OUTCOME rolls the profile write back. Historical security audit is preserved when optional fields are cleared.

## 5. Candidate SQL and additional SQL scope seal

Exact migration: **packages/platform-contracts/migrations/profile/001-user-profile.sql**.
SHA256: **a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3**.

It requires accepted access SQL001/schema1.0.0 and digest **356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2**, current database identity, existing controlled `profitia_access_owner` (NOLOGIN, NOINHERIT, no admin flags), and preinstalled pgcrypto `public.hmac(bytea,bytea,text)`. It creates a separate profile schema, immutable installation receipt, protected runtime policy, profile PK/FK, server-field trigger, ENABLE/FORCE RLS and narrowly guarded functions. PUBLIC receives no schema/table/function rights. It creates no roles, extensions, bindings or activation rows. A duplicate migration fails closed rather than silently adopting unknown objects.

The existing Access Store explicitly trusts backend-owned transaction settings; an ordinary SQL credential alone is not a human identity. New profile RLS additionally requires a five-second HMAC seal binding exact role, app, environment, user, operation, transaction ID and deadline. Provisioning seals the existing verifier's subject/issuer and provider horizon instead. It is a database scope attestation, not a new user session/token/IdP. It grants nothing independently of the existing store and current policy.

A separately generated32-byte secret is held by the trusted backend and the protected operator-only policy. Ordinary runtime cannot read/sign with the DB copy, assume the owner, write the policy or forge a profile scope by setting GUCs. Wrong key, changed user/environment/role, new transaction or elapsed deadline invalidates the seal. Shared backend compromise remains outside the protection of a scope seal; never place the key in a browser, log, source or chat. [PostgreSQL pgcrypto HMAC](https://www.postgresql.org/docs/16/pgcrypto.html#PGCRYPTO-HASHING-FUNCS).

## 6. Installation plan — OWNER ACTION REQUIRED, not executed

1. Review/accept the source PR, policy choices and schema digest. A separate task authorizes installation. Confirm exact private Neon project/branch/database and current access installation/receipt; preserve all existing access SQL and directory metadata. Do not use Architecture laboratory or continuity databases.
2. Read-only live metadata on21.10 confirmed accounts and the exact access digest, **no profile schema and no public pgcrypto HMAC function**. The owner must separately authorize/install pgcrypto in the intended schema and verify its function identity/ACL. B1 did not install it. No new Neon project/database/branch/endpoint is needed for this candidate.
3. Owner provisions an ordinary dedicated runtime LOGIN with NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE; no ownership, membership in the owner role or `neon_superuser`. Provision a controlled migrator/operator that may SET ROLE to existing `profitia_access_owner`; keep that authority out of runtime. No role is created by the migration or this task.
4. Before DDL, obtain an owner-authorized reversible backup/recovery copy and verify a restore rehearsal and existing account/access compatibility. Do not create a backup branch under B1 permission. Record source/artifact/configuration/migration receipts for any later application release; B1 performs no release.
5. In one operator transaction under the controlled owner, execute the exact candidate SQL and insert its version/digest in `profitia_profile.installation`. A failed transaction rolls back completely. Do not edit or reinstall SQL001 or overwrite existing account/organisation tables. Verify resulting functions, owners, constraints, ENABLE/FORCE RLS and source/installation digests independently.
6. After separately approving its exact identity, configure the new application/runtime in existing access tables with **no** organisation, membership or product grants. Add its exact issuer, finite max-binding lifetime and freshly generated separate attestation key to `runtime_policies`, initially disabled and registration denied. Safely deliver the matching key and limited connection to the backend through the approved secret mechanism. Do not pass keys/DSNs in conversation or copy Clerk/PMOS/lab keys.
7. Grant runtime only USAGE of `profitia_access`/`profitia_profile`; existing access APIs `runtime_descriptor`, `identity_binding`, `lock_access`, `scope_allows`, `append_audit`; profile APIs `runtime_descriptor`, `provision_account`, `read_current`, `ensure_current`, `update_current`, `scope_allows`; SELECT on `user_profiles` behind RLS. Function signatures are exact in the candidate and executable synthetic fixture. Grant no access to installation/policy tables, no direct INSERT/UPDATE/DELETE/TRUNCATE and no unguarded helper/signing function. No `GRANT EXECUTE ON ALL FUNCTIONS`.
8. Record nonsensitive role names/resource IDs/issuer/digests and secret references. Verify descriptor against project/branch/database/application/role/environment and the candidate migration. Install `libphonenumber-js@1.13.15` explicitly in a future consumer and inject its full-metadata parser as the server-owned phoneParser adapter. Its package lock, contract adoption, CSRF/browser routes and deployment are separate work.
9. Before enabling, repeat the synthetic matrix against the separately approved target using the actual ordinary role, a bounded test-only cohort and no real PII in evidence: registration policy, account-self RLS, forged-GUC denial, cross-user/environment, key/transaction replay, conflicts, expiry/revocation, audit rollback and pool reuse. Only then perform explicitly approved activation. Source test PASS does not authorize this step.

No new Render/GitHub/Clerk resource is required for source acceptance. Existing Architecture PMOS service remained manual-deploy and unchanged. Backend installation does not authorize a Render service, Clerk change, domain, deployment, B2 or consumer integration.

## 7. Rollback and partial failure

- Before COMMIT, failed DDL/receipt/configuration work rolls back its operator transaction. Before activation, remain disabled; do not create fake success receipts or expose an incomplete installation.
- To withdraw application exposure, disable the new policy/binding through an approved operator action and return the caller to its previous accepted code/configuration. Existing SG2/SRM adapters and their independent fingerprints are unchanged; no consumer adoption is claimed.
- Preserve accounts/bindings/profiles already created by an accepted later version and their security events. Do not automatically DROP SCHEMA or remove identities when rolling back application code. Maintain compatible readers or disable the new entrypoint.
- Data restore is a separate owner-reviewed recovery from verified backup with reconciliation of identities, references, grants and security evidence; stop writes before restore and do not overwrite intervening valid data blindly. The source migration does not implement a destructive down migration.
- Rotate the attestation key only through controlled policy/secret changes with disabled exposure and fresh verification. Existing access authority fencing invalidates old transaction scope when policy changes; no runtime administrative override is available.

## 8. Source scope and tests

Exact changed targets (all previously declared and routed):

1. packages/platform-contracts/src/identity-provisioning.mjs
2. packages/platform-contracts/src/identity-provisioning.d.mts
3. packages/platform-contracts/src/user-profile.mjs
4. packages/platform-contracts/src/user-profile.d.mts
5. packages/platform-contracts/src/identity-profile-sql.mjs
6. packages/platform-contracts/migrations/profile/001-user-profile.sql
7. packages/platform-contracts/test/identity-provisioning.test.mjs
8. packages/platform-contracts/test/user-profile.test.mjs
9. packages/platform-contracts/test/identity-profile.integration.test.mjs
10. packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs
11. packages/platform-contracts/test/types/identity-profile.mts
12. packages/platform-contracts/test/types/tsconfig.json
13. packages/platform-contracts/package.json
14. packages/platform-contracts/package-lock.json
15. packages/platform-contracts/README.md
16. Canon/evidence/2026-10-21-identity-profile-b1-handoff.md

The future identity CI filename was also declared/resolved but is not created: the existing platform-contracts workflow already runs package test glob, which includes the new source and real local PostgreSQL acceptance. No empty application or UI/backend HTTP endpoint is needed for this producer contract. No consumer, old migration, old contract source, routing/manifest or physical topology is changed.

New B1 suite: **39/39 PASS**, including actual PostgreSQL16 ordinary-role acceptance. Existing/new governance/classifier/workspace/bridge/B0 regression: **56/56 PASS**. Package syntax build and positive/negative public TypeScript contracts PASS. Full package regression and GitHub CI results, exact source SHA/PR and later continuity receipts are recorded in the final canonical execution handoff after this source commit. One existing optional external/web database fixture is not misrepresented as executed when its independent environment is absent. No mocked provider test is called live Clerk verification.

The PostgreSQL fixture is an isolated local cluster/database with synthetic accounts, membership and contact values only. It is stopped/removed after testing. It verifies actual role flags, RLS/FORCE RLS, forbidden direct DML/admin/policy reads, exact migration/descriptor digest, idempotency/concurrency, same-email separation, account-self access, same-organisation privacy, caller owner spoofing, stale versions, cleared values, forged GUCs, transaction replay, failed audit rollback and missing/expired/revoked/disabled policy/identities. No live Neon writes occur.

## 9. Closeout and status boundary

After source validation/PR, canonical ARCHITECTURE PMOS/PHR closeout must independently read persisted Flight Record and HANDOFF, completed registration, successful save/context/HANDOFF, archive/trail, publication commit reachable from PHR origin/main and clear pending/advisory locks. MEMOROS disabled is not a delivered ACK. This source file does not assert success of its own later publication; final persisted execution receipt supplies those facts and any failure/recovery evidence.

```text
TASK_B1_VERDICT = SOURCE_READY (conditional on final source/CI/continuity verification)
EXECUTION_PROFILE = ARCHITECTURE
IDENTITY_PROVISIONING_IMPLEMENTED = YES
USER_PROFILE_IMPLEMENTED = YES
PROFILE_FIELDS = avatar_sex, job, phone
INTERNAL_USER_ID = UUID
EXTERNAL_IDENTITY_BINDING = EXTENDED (existing tables and semantics reused)
SQL_MIGRATION_PREPARED = YES
DATABASE_ACCEPTANCE = PASS (isolated synthetic PostgreSQL only; Neon installation pending)
RLS_ACCEPTANCE = PASS (isolated synthetic PostgreSQL only)
EXISTING_CONTRACT_REGRESSION = PASS (final counts in execution receipt)
SOURCE_MERGED = NO
NEW_INFRASTRUCTURE_CREATED = NO
LIVE_DATABASE_MUTATED = NO
DEPLOYMENT_PERFORMED = NO
OWNER_ACTION_REQUIRED = YES
NEXT_RECOMMENDED_TASK = B1 Installation & Acceptance, then B2 Session Compatibility
```

Remain at SOURCE_READY / INSTALLATION_PENDING, never ACCEPTED/deployed. The next task is not started. Owner actions are limited to review/merge, renewal/admission/retention decisions, pgcrypto prerequisite, limited runtime/migrator, secure scope key and separately approved installation/recovery/acceptance. Architecture, routing and the three profile fields are already accepted.
