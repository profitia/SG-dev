# Source Hub / Newsfeed — current central E1, Development

Owner: Architecture Platform / Identity E1. Contract: `profitia.current-e1-authority 1.0.0`, optional package `@profitia/platform-current-e1-authority 1.0.0`. The canonical SDK remains **1.33.0 with unchanged accepted bytes**. No SG2/SRM implementation, entitlement or receipt changes are required. This extends the existing authoritative SQL001 and operation/audit contracts; it does not introduce a directory or permission engine.

## Authority and revocation

The existing Identity service (`srv-dbcse6jrjlhs73eib3sg`, `https://identity-runtime-development.onrender.com`) authenticates the original bearer with the official Clerk SDK, reads current session and account status and resolves the canonical internal user UUID. The receiving backend never supplies an actor, membership, grant or ALLOW.

For every private SQL unit, the receiver creates a random challenge containing its full physical SQL001 binding, transaction ID, organisation selector, operation, actual resource ID and request digest. Identity reads current central account, external binding, organisation, membership, explicit per-app permission and product rows under the existing authority fence. Both the app-specific `SPENDGURU / personal_workspace` offer and the canonical `spendguru / SPENDGURU` entitlement must be current. No user directory is copied to either consumer database.

The producer signs a maximum 15-second proof using a separate per-receiver key, available only to the controlled NOLOGIN SQL owner. The ordinary runtime cannot read keys or sign arbitrary claims. SQL verifies the exact database, branch, role, app, transaction, nonce, request and expiry before exposing actor/state to the unchanged operation policy engine. A proof for `personal.list.read` cannot write private rows. Manually setting scope variables cannot bypass the restrictive product RLS policies.

Immediately before committing/output, the host asks Identity again. This performs new session/account reads and a new authoritative SQL observation; changed or revoked authority rejects the result and rolls back local effects. The second proof cannot extend the original expiry, change its request or survive an authority version change. There is no cross-request positive cache or outage fallback. The final current observation is the operation's authorization linearization point; concurrent changes after that point apply to subsequent operations. This contract does not claim a distributed transaction across databases. No provider request runs inside this private unit: existing Source acquisition, transport and uncertain-attempt accounting remain separate.

The existing SQL001 audit receives the durable INTENT and transactionally protected OUTCOME. Revocation before final authorization causes local rollback and a correlated independent FAILURE. Enrollment, keys and explicit grants are durable SQL state; process restart never restores an old ALLOW. There is no scheduler, replicated ACL snapshot or token-only revocation policy.

## Exact existing Development targets

| Capability | Project / branch | Database / ordinary runtime |
|---|---|---|
| Central E1 | `spring-bread-28217539` / `br-sparkling-term-b99l107x` | `platform_private` / `identity_b1_runtime` |
| Source Hub | `delicate-queen-44677134` / `br-orange-salad-ba2llks7` | `neondb` / `source_hub_development_runtime` |
| Newsfeed | `shiny-bonus-85532609` / `br-wispy-bonus-b9ohunab` | `neondb` / `newsfeed_development_runtime` |

Central enrollment creates only the two exact application records and their explicit permissions/product offers for existing, current test memberships. It never modifies `spendguru`, `srm` or their grants. The canonical SPENDGURU entitlement is read, not changed. Grant lifetime must not exceed the current identity, membership, product or Development admission review horizon. New accounts require proper central E1 admission; they are not automatically granted access.

## Additive E1 installation and recovery

Only accepted code and exact migration digests may be used. Required sequence:

1. Recheck main, concurrent work, physical bindings, ordinary roles, current private data counts and the six existing UNMETERED policy identities/versions. Capture the current LSN/time and verified PITR retention before each mutation. Do not use an old global restore as routine rollback on the shared central database.
2. Install approved `pgcrypto` in `public` on the two receiver databases if absent. Central already has it. This creates no project, branch, database or role.
3. As the existing `profitia_access_owner`, install `packages/platform-contracts/current-e1-authority/migrations/001-authority.sql` only in central E1 and `002-receiver.sql` only in each consumer. Keep SQL001 and product foundation migrations unchanged. Explicit runtime function ACLs are required; PUBLIC gets none.
4. Bind each receiver's existing ordinary role, full SQL001 descriptor and dedicated signing key to its exact application. Authority origin is the existing HTTPS Identity origin. Keys are stored in native macOS Keychain and protected SQL tables, never Render variables or handoff text.
5. Create only the accepted central app-specific offers and `personal.list.read/write / personal_workspace` grants for verified existing members. Source Hub's resource is `source-hub-private`; Newsfeed's private observation namespace includes the collection and owned observation UUIDs. This does not confer access to another user's rows.
6. As the existing product schema owners, apply only `apps/platform-source-hub/migrations/003-current-e1-authority.sql` and `apps/newsfeed-runtime/migrations/002-current-e1-authority.sql`, replacing the existing runtime-role token with the exact registered role. These add restrictive SELECT/INSERT/UPDATE/DELETE policies; no private rows or provider policies are rewritten.
7. Verify enrollment/digests/function ACLs/FORCE RLS through fresh ordinary-role sessions; verify directory rows remain absent in receivers. Prove raw scope spoofing and key reads are denied. Compare the six Source policies to the baseline. Do not invoke paid providers.

The task-local, hash-recorded activation script consumes existing admin/migrator references and Keychain signing keys through bound SQL parameters. It pins all three physical targets, locks the owned migration namespace, refuses schema drift and restores any temporarily required existing admin SET membership before commit. A partial installation remains unavailable until all required enrollments are active. It does not rerun Source Hub/Newsfeed foundation migrations or Source Admission.

Rollback: stop the new receivers from serving private operations, revoke only the two new current-E1 enrollments/app offers, and retain the restrictive row policies. Preserve audit and existing data. Restore an earlier accepted executable release only under the separately authorized activation procedure; no E1 fallback to local empty/stale directories. A central global restore requires owner coordination because it would affect parallel applications.

## Fourteen Render variable names

These are planned configuration values, not proof of a deployment. The accepted deployment/configuration identifiers below are retained from PHR and the existing Source binding. Actual running Git SHA must be reported separately.

| Name | Service | Value / secure source | Secret |
|---|---|---|---|
| `SOURCE_HUB_DEPLOYMENT_ID` | Hub | `profitia-source-hub-development-b4b6eda9dbfb` | No |
| `SOURCE_HUB_CONFIGURATION_VERSION` | Hub | `source-hub-development-unmetered-20261104-v1` | No |
| `NEWSFEED_DEPLOYMENT_ID` | Newsfeed | `profitia-newsfeed-api-development-b4b6eda9dbfb` | No |
| `NEWSFEED_CONFIGURATION_VERSION` | Newsfeed | `newsfeed-development-20261104-v1` | No |
| `SOURCE_HUB_PEER_KEY_ID` | Both | `source-hub-newsfeed-development-v1` | No |
| `SOURCE_HUB_PEER_KEY_B64` | Both | One identical Keychain-backed random 32-byte secret | Yes |
| `CLERK_SECRET_KEY` | Both | Approved central Identity Development instance, `sk_test_`; Keychain owner utility | Yes |
| `CLERK_PUBLISHABLE_KEY` | Both | Same approved Development instance, `pk_test_`; Keychain owner utility | Configuration credential |
| `PROFITIA_IDENTITY_ISSUER` | Both | `https://unified-drum-7191.clerk.accounts.dev` | No |
| `PROFITIA_AUTHORIZED_PARTIES` | Both | `https://newsfeed-api-development.onrender.com,https://dev-sg2.spendguru.app` | No |
| `PROFITIA_REQUIRED_PRODUCT` | Both | `SPENDGURU` | No |
| `SOURCE_HUB_DATABASE_URL` | Hub | Keychain: exact pooled `source_hub_development_runtime` URL | Yes |
| `SOURCE_HUB_SOURCE_DATABASE_URL` | Hub | Keychain: exact pooled `source_hub_development_source_runtime` URL | Yes |
| `NEWSFEED_DATABASE_URL` | Newsfeed | Keychain: exact pooled `newsfeed_development_runtime` URL | Yes |

The new authorized-party set explicitly admits the existing SpendGuru Development frontend as the source of an SDK-verified session at the approved bearer receiver. It never transfers the SG2 application's product/permission ALLOW to the two new apps. Separate current central app grants are still mandatory. The original PHR called the single Newsfeed origin provisional pending Identity adoption; this contract completes that receiving-flow binding.

The backend configuration retains its accepted Development Clerk-instance validation fields. Authoritative external session/account observations happen centrally; the receivers do not independently resolve or mirror Clerk accounts.

Runtime hosts (pooled, TLS and `channel_binding=require`):

- Hub: `ep-noisy-darkness-barhqoqw-pooler.c-8.eu-central-1.aws.neon.tech`.
- Newsfeed: `ep-mute-night-b9o332my-pooler.c-7.eu-central-1.aws.neon.tech`.

Never import the local administrative env file into Render. Never paste owner/migrator URLs. Provider secrets remain only on Hub. The shared M2M key is unrelated to the two protected E1 SQL signing keys.

## Owner-only Render actions for the later authorized activation

Existing services: Hub `srv-dbllmk0n74is73c2eptg`, Newsfeed `srv-dbllnv8m7kps73btro5g`; Source HUB project `prj-dbl079ou01pc73eg0ffg`, Development `evm-dbl079ou01pc73eg0fgg`, Frankfurt. Do not recreate services. Keep Node `24.15.0`, repository root build context, main branch, Auto-Deploy/PR previews Off and `/ready`.

Set the fourteen names above on their specified services. For secrets, use the task-local `owner-render-secrets.py --copy <EXACT_NAME>` utility. It reads Keychain in memory, copies only the selected value to the local clipboard and clears it after 45 seconds. It never prints a secret or updates Render. Use `--verify` to check availability without revealing values. The same M2M value must be pasted into both services.

The existing Identity service also needs the accepted new executable version and `IDENTITY_CURRENT_E1_ENABLED=true` in the **separately authorized activation**. Keep its existing database role, Clerk configuration, origins, SG2/SRM targets, email and account settings. This task does not deploy or configure that service. An old Identity release returns 404/503 for the new authority surface, and both new backends must remain not-ready in that state. This is an explicit release dependency, not permission to bypass E1.

Build/start commands remain:

```sh
npm --prefix apps/platform-source-hub ci --include=dev --install-links --ignore-scripts --no-audit --no-fund && npm --prefix apps/platform-source-hub run build
npm --prefix apps/platform-source-hub start
npm --prefix apps/newsfeed-runtime ci --include=dev --install-links --ignore-scripts --no-audit --no-fund && npm --prefix apps/newsfeed-runtime run build
npm --prefix apps/newsfeed-runtime start
```

After separate activation authorization: verify the exact accepted SHA and existing deploy queues; release Identity current-E1 first, verify `/v1/e1/ready`, then the two backends. Verify `/ready`, a real authorized private observation flow, another user's denial and central revocation before any provider tests. No staging/production or market-forecast activation is implied. Six existing UNMETERED Source policies, zero provider-content retention and external provider terms remain unchanged.
