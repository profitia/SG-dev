# TASK02-R — controlled Supplier Locations release preparation

Status: **PARTIAL — owner-created recovery copy inspected; installation remains NO-GO**.
Initial checkpoint: 2026-10-22 04:14:59 UTC; subsequent read-only evidence below supersedes its time-sensitive observations.
Task: `SRM-SUPPLIER-LOCATIONS-TASK02-R-20261022`. Profile SRM; Development only.
This is a prepared installation and acceptance package, not installation, activation or release evidence.

The owner's subsequent direct response confirms the direction and provisionally
accepts write100/sync100 per organisation per24h and paid budget ZERO. It expressly
withholds approval for a service window, application disablement, SQL019/SQL013,
active binding changes and grant activation. The owner has now created the Task02-R recovery snapshot, isolated branch and compute.
The permitted read-only verification is recorded below. Any new user accounts remain
owner-created. No release GO or agent resource-creation authority is inferred.

## Authority and verified source

Repository [profitia/SG-dev](https://github.com/profitia/SG-dev), authority main
`fd6b630afa37fb6f055b3291332d380b0d19e005`.
TASK02 [PR597](https://github.com/profitia/SG-dev/pull/597) merged candidate
`3c6805cbb1aa135454b6f6e1aad9308951cfea85`.
Current required [main CI](https://github.com/profitia/SG-dev/actions/runs/39674364353),
[SRM CI](https://github.com/profitia/SG-dev/actions/runs/39674364559) and
[Maps CI](https://github.com/profitia/SG-dev/actions/runs/39674364509) passed.
The SRM Staging promotion jobs were skipped; no promotion was performed.

Root package 1.24.0 / candidate.16: all eight files reproduce
`9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728`.
All 33 current adoption file hashes match. The eighteen historical migrations,
initializer, manifest and original boundary are unchanged from the pre-TASK02 authority.
The five live shared function bodies that SQL019 replaces exactly match SQL017;
no B1 overwrite conflict was found at this observation point. Recheck on resume.

Fresh SRM preflights passed with require-begin, current origin/main, isolated
branch `srm/supplier-locations-release-task02-r-20261022`, local execution,
exact declared paths, ALIGNED code state and SRM/Maps/Governance routing.
Applicable Canon manifest 3.27.0: 41 loaded SRM/CORE documents.
No runtime source correction was required for this preparation phase.

## Current shared receiver

Neon project `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`,
database `platform_private`; ordinary role `srm_private_development_runtime`.
The current service configuration points to `ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech`.
The post-B1-I Stage2 ordinary-role readback is revision109 (the initial checkpoint was75); SQL017 receipt digest
`a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94`.
Existing private boundary
`19220c7bb31365ed058bc55a99bca2aa4a9f38b7f8ca2a2ddde52ec71ed16ed4`.
SQL019, SQL013 and the location tables are absent. Location grants, policies and
intents are zero. The controlled access owner remains NOLOGIN/NOINHERIT with no
elevated flags or memberships. Ordinary-role descriptors are readable.

ACTIVE applications: srm, srm-jobs, spendguru,
spendguru-benchmark-dispatch, spendguru-forecast-dispatch.
Identity-runtime-development remains DISABLED.
Seven access bindings include the two SpendGuru dashboard/runtime bindings and
the disabled identity binding; preserve each exact pre-window status.

The shared queue has **139 PENDING jobs**: 136 Macrobond benchmark requests and
3 SRM source requests; 11 CONFIRMED. No current job leases, non-accepted phase
effects or queries over five minutes were observed. This is a point-in-time
observation, not permission to execute, cancel or replay the queued work.
Source external-call ledger visibility is unavailable through the present
controlled access-owner connection. The authorised Source owner must establish
the actual external in-flight state before maintenance. Do not widen grants for this audit.

Existing affected Render Development services:

| Service | ID |
|---|---|
| SRM runtime / request-bound SRM jobs | srv-db1vu6gm7kps73d0e3r0 |
| SG2 dashboard | srv-dapa3ujm8hqs73a9t2og |
| SG2 runtime / dispatch paths | srv-dapa3tid0e5s73f8bc5g |
| SG2 forecast current worker | srv-dapa3vlg1s2s739vp7dg |
| SG2 forecast verification worker | srv-dapa40ad0e5s73f8bjm0 |

All remain running with auto-deploy off. Source/corporate adapters are existing
request-bound connections; do not provision another worker.
The unrelated contact-email cron is not a retention operator and is outside this release.

B1-I Stage2, task `ARCHITECTURE-IDENTITY-B1-I-STAGE2-20261022`, completed in its
own PMOS at 2026-10-22 04:30:11 UTC. Result SUCCESS; CLOSEOUT_COMPLETE; required
PMOS/context/archive/PHR gates passed. Independent PHR verification at commit
`0b9797f0ee20821bdb257ddd8cb0baa5ce1bd7e3` checked all five file hashes and bundle
hash `2065843d9e5d20711cb260c3aafcefdf3c3e1f98a99d75b873a847552498c7e7`.
Its actual ordinary-runtime tests used a controlled provider fixture, not real
Clerk/browser UAT. Its final cleanup left the identity app/binding DISABLED,
five synthetic accounts DISABLED, their identities REVOKED/expired, one test
organisation and two memberships SUSPENDED, no profiles/policies/test key and
no usable former credential. Current direct metadata agrees with that state.

No active Architecture PMOS execution remains. SG2 PMOS contains one historical
September live-verification registration with no shared-receiver target; this
does not establish an approved maintenance reservation. No cross-chat message,
inherited approval or reuse of B1 recovery resources occurred. Owner coordination
for the proposed shared SRM/SG2 interruption remains NOT_GRANTED.

## Recovery and LKG gate

The existing B1 resource `br-square-field-b9vzels8` was restored from
`snap-noisy-art-b9uwq5rf` (B1 preinstall snapshot, 2026-10-21 19:34:40 UTC).
It expires 2026-10-22 19:34:39 UTC (21:34:39 Europe/Warsaw).
It is not accepted as coverage for the current installed B1 state or this window.
At the initial checkpoint no TASK02-R restore rehearsal had run. The owner's
subsequent isolated restore and its current read-only verification are recorded below.

Historical owner console instructions — creation is now complete; retained for traceability:

1. Open [this exact Backup & Restore page](https://console.neon.tech/app/projects/spring-bread-28217539/branches/br-sparkling-term-b99l107x/restore).
   Confirm project **profitia-platform-private / spring-bread-28217539**, branch
   **development / br-sparkling-term-b99l107x**, region AWS Frankfurt. The relevant
   database is platform_private; snapshots cover the branch, not a PMOS database.
2. Keep Enhanced view ON. The upper Restore from history / Point in time section
   is not the snapshot creation flow. Do not press its Restore button.
3. After B1-I Stage2 is closed, use the separate **Create snapshot** section and
   its **Create** button. Capture the present state; do not select an older B1
   snapshot or an earlier historical timestamp. Only the owner performs creation.
4. On the new snapshot row, use the visible **Edit text** control to name it
   `srm-supplier-locations-task02-r-preinstall-<UTC timestamp>` if creation did not
   already permit naming. Record the actual creation/expiry shown by the console.
   Seven days is preferred if offered; coverage must be at least24h and extend
   beyond the eventual approved window and recovery period. The current UI does
   not expose expiration in the row's menu, so do not assume that a seven-day
   value was set. No backup schedule or project history-retention change is needed.
5. On **that newly created snapshot row**, expand **Restore** and select
   **Multi-step restore**. One-step restore explicitly changes the active branch
   and is excluded. The verified multi-step confirmation says the development
   branch remains unchanged and a new `branch_from_snapshot_...` branch is created.
6. Only after those two statements are visible, the owner presses the confirmation
   **Restore**. An automatic branch name is acceptable; an optional later name is
   `srm-supplier-locations-task02-r-restore-<UTC timestamp>`. Identity is its br-ID,
   source snapshot and actual provider mapping, not a display name.
7. Do not press **Migrate connections and settings**, **Finalize Restore**, change
   the default branch, or move the existing endpoint ep-late-heart-b9mxo8oi.
   If a separate rehearsal compute is required, the owner creates it on the new
   branch only: fixed0.25CU, autosuspend300s, no primary-endpoint transfer. The
   agent must first inventory computes and must not silently provision one.
8. Return the new snap-ID and br-ID, actual capture/expiry and, if created, the new
   compute ID. No connection string, password, API key or token is needed in chat.
9. The operator verifies project/snapshot lineage, unchanged primary/default and
   original endpoint mapping, isolated compute, exact schema/receipts/E1 bindings,
   B1 state and protected table/queue/audit checksums through authorised read-only
   roles. This is inspection of the already restored copy; no production finalize
   or primary restore is authorised. Ordinary-role tests may not alter that copy
   unless their exact scope receives separate approval.
10. A snapshot is not RPO0 while legitimate shared writes continue. Before the
    eventual window, compare capture/LSN, state drift and any new writes; refresh
    coverage through the owner if necessary. A stale/expired or mismatched copy
    cannot pass the recovery gate. Never reset or repurpose another task's branch.

The multi-step confirmation was opened read-only on an existing B1 snapshot to
verify its wording, then cancelled. No snapshot, branch, compute or restore was
created or executed by the agent. The owner subsequently performed the authorised
snapshot and Multi-step restore; no Finalize Restore or connection migration followed.

This follows the current [Neon backup/restore procedure](https://neon.com/docs/guides/backup-restore).
A new branch or snapshot must be created by the owner, not implicitly by the agent.

Current SRM LKG candidate:
deploy `dep-dbbnb22fngtc73bn0i90`, source
`260ade12608faaea27376c1c976db392f046f267`.
Read-only SSH remains unavailable, but the existing Render **Web Shell** works
without adding a key. It provided direct read-only measurement of the running
instance `srv-db1vu6gm7kps73d0e3r0-5ccd45459d-zxpgf`:

- Algorithm sha256-sorted-path-type-content-v1; roots .next, node_modules,
  public, package.json and package-lock.json; exclude .next/cache and nested
  .cache content; hash link targets without dereferencing.
- All23485 entries /636136486 bytes hash to
  `f4216032035055e8ab8ad3e387882cf2fb02a82d8daca6bc4a58e57e52f502cf`.
- BUILD_ID digest `c3155dc91d9a7eb8fea77def1cd4432e9d31a3d0d5b6d88db0623ff6504f78fc`.
- The exact full digest and build ID independently match existing completed job
  `job-dbbo4cc9v7es73fs7u80`, observed 2026-10-20 15:02:39 UTC, from the same exact
  current source. Fresh running-files measurement: 2026-10-22 04:48:40 UTC.
- The31 selected environment values read from actual server PID72 produce the
  same configuration fingerprint as the current Render service configuration.
  No credential value was printed, copied into evidence or changed.

This is real file/configuration evidence, not a SHA-only substitute. No new
one-off job, deployment, restart or access key was created. The older recorded digest
`d419e35a1131f637b6009ce9ae9b511f3c193f077b9ada9fe71e4548db19301e`
belongs to source `6eede5cd19fd3a4519d66298effe9ef94633757a` and a one-off build,
not this running artifact. It cannot satisfy this gate.
Current SRM environment fingerprint:
`d86ce81c0d4207d51c9200c86474e4acb30fdfa51b26a2205b74f385740069b5`.
It now also matches the running server's effective startup environment. Together
with exact build/start/health/plan/instance settings, this forms the frozen runtime
fallback inventory. No missing SRM shell/artifact search is delegated to the owner.

Render records this exact successful uploaded build as Live; existing prior
retained deploys expose Rollback, while requesting the current Live deploy's
rollback preview redirects to its details. The task did not execute a rollback
and does not claim a tested post-candidate rollback. Immediately before release,
recheck the retained build set and use the exact native deploy ID, never a rebuild.
The full combined LKG gate remains NO until current database recovery/restore
coverage and its binding/schema/configuration compatibility are accepted.
Render rollback reuses a retained artifact; rebuilding the old source is not
equivalent. Environment groups and mutable platform settings require drift review under
[Render rollback documentation](https://render.com/docs/rollbacks).

## Consolidated maintenance and installation proposal

Package version: `srm-locations-task02-r-owner-gate-v1`.
Owner selects **one exclusive 60-minute Development window after B1-I Stage2**,
with the SRM, SG2 and ARCHITECTURE owners covered. Sixty minutes is a proposed
maximum authorised disruption, not a prediction or approval.

Before the window, verify actual LKG, current-state restored backup, exact
candidate/CI, retention, lawful UAT identities, Source in-flight effects, and
an executable non-destructive fallback. Missing evidence means no shared disable.

During an approved window:

1. Refresh authority and repeat full registered governance preflight. Capture all
   application/binding/worker/configuration states and current queue IDs/counters.
2. Close new admission through the approved owners, quiesce dispatch consumers,
   wait for leased/in-flight work to settle, and hold pending work durably.
   Do not run pending jobs merely to empty the queue, trigger paid calls, cancel
   accepted requests, alter receipts or acknowledge unexecuted work.
3. Set all shared access applications and relevant bindings to the approved
   DISABLED state. Preserve already disabled identity state. Recheck that no
   concurrent owner is mutating the receiver and that installation guards pass.
4. In **one outer transaction**, use SET LOCAL ROLE profitia_access_owner;
   execute unchanged accepted SQL019 bytes; insert its exact immutable receipt;
   execute unchanged SRM SQL013 bytes; insert its receipt with schema version
   1.0.0, exact SHA256 and accepted source SHA. No source interpolation,
   relaxed guards, historical-migration adoption or table reset.
5. Grant only the exact HUMAN EXECUTE list in the JSON companion, retaining
   existing adopted E1 grants. No direct table DML, internal helper grants,
   owner memberships, SERVICE geocoding grants or paid allowance.
6. Apply separately owner-approved location read/write/sync permissions restricted
   to named current internal accounts and organisations. Proposed per-organisation
   request-count policies: write100 and sync100 within one24-hour window,
   paid allowance zero. Exact account/org IDs, policy IDs, source references,
   start/end and expiration must be reviewed and recorded before execution;
   unresolved parameters keep the gate closed. No wildcard grant.
7. Re-read receipts, hashes, ownership, FORCE RLS, PUBLIC revocations, signatures
   and effective ordinary-role grants. Any error rolls back the transaction.
   An uncertain COMMIT requires receipt inspection; never blindly replay.
8. Restore each authorised application/binding/consumer state in controlled order.
   Verify pending work was preserved, ordinary SRM/SG2 paths, both forecast workers,
   source admission and existing audit continuity. Keep identity DISABLED unless
   its own owner separately authorised activation.
9. Deploy only the accepted exact SRM source with locations initially disabled.
   Verify the real artifact, configuration, health and old paths. Maps deployment
   is not required for this zero-budget core release.
10. Enable location core/presentation only after all applicable gates pass, with
    PROFITIA_SUPPLIER_LOCATIONS_ENABLED=true and configuration version
    srm-supplier-locations-v1. Execute actual authenticated UAT and independently
    verify persisted results. No Google geocoding activation.
11. If verification or the authorised time limit fails, stop propagation and use
    the verified feature-off/runtime/configuration fallback. Restore shared
    service availability as safely authorised. Escalate any unresolved incident.

SQL019 digest:
`34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5`.
SQL013 digest:
`b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b`.
Accepted source for these bytes: main SHA above. Changed authority requires revalidation.

## Retention and UAT gates

No accepted existing scheduled KYS cleanup was found. PostgreSQL has only
plpgsql/pgcrypto; no pg_cron. The existing Render inventory has no SRM retention
cron. Read-time cleanup plus the controlled location_expire_controlled() port
does not establish background retention.

The completed investigation found no accepted periodic execution or named operator.
A concrete SRM/Architecture adoption decision is therefore still required.
Adoption must prove physical removal at retentionUntil, manual-row preservation,
source-right revocation, idempotency, bounded work, execution audit and missed-run
handling. Do not grant the owner-only port to HUMAN/SERVICE runtimes or create a
competing scheduler. KYS persistence/projection stays blocked until accepted.
The accepted host currently injects its protected KYS reader when the native
supplier runtime is available; enabling the overall flag is not a KYS-free rollout.
If HQ/manual are released independently, first establish an effective KYS input
and projection fence; do not falsely infer one from an empty group.

Google geocoding remains disabled, budget ZERO, with no provider/API/key changes
and zero Google requests from this execution. Future Google coordinate caching
requires a separate accepted at-most24-hour physical-cleanup execution for the
29-day cache. No such paid adoption is part of this task.

Only one current ACTIVE E1 account, one ACTIVE organisation and one ACTIVE
membership exist. B1-I Stage2 additionally left five DISABLED synthetic accounts,
five REVOKED/expired invalid-issuer identities, one SUSPENDED organisation and two
SUSPENDED memberships; they must not be reactivated or reused as browser users.
The existing Clerk Development instance, issuer
`https://unified-drum-7191.clerk.accounts.dev`, independently has one user and zero
users explicitly marked for this task's UAT. No customer or owner account is
silently reclassified as a test fixture.

Owner account-creation instructions:

1. Use the existing application in Clerk Dashboard, select Development, and match
   its Frontend API/issuer to unified-drum-7191.clerk.accounts.dev. Create no new
   Clerk application, instance, API key or authentication provider.
2. Use the existing application's Invitations flow for three owner-controlled
   test mailboxes, labelled UAT-A1, UAT-A2 and UAT-B1. The owner creates/accepts the
   invitations and completes the existing authentication method. Keep passwords,
   OTPs and sessions private. These are application users, not workspace team
   administrators. SRM's current SignIn has sign-up disabled.
3. Do not create Clerk Organizations as a substitute for E1 Organisation IDs.
   Canon assigns permanent User ID, Organisation ID, memberships and access to
   Profitia. Clerk roles/metadata/email are not that authority.
4. The current PORR_SUITE host is fixed to organisation
   225e465b-8b89-467d-92d1-7fef61b555fe. A1 and A2 can be HUMAN test members
   of that Development organisation only after the owner explicitly approves
   the test cohort and data scope. B1 belongs to a separate internal UAT
   organisation B. If a wholly new organisation A is required, host tenant/profile
   adoption must first be separately reviewed; a browser organisation selector
   cannot override the fixed host. This is not an authority change in Maps. Use generated internal UUIDs, never Clerk IDs as owners,
   and no memberships crossing A/B. Product SUPPLIER_INTELLIGENCE and feature
   supplier_report require explicit current grants. No owner/BYPASSRLS/CREATE,
   private-key, SERVICE or maintenance-port access is part of an end-user role.
5. Account/binding provisioning and the two organisation/membership/product
   assignments require the accepted E1 operator/admission process and explicit
   Architecture owner authority for these three named subjects. B1 source/SQL
   acceptance is not productive onboarding activation: its app/policy is disabled,
   no Identity Runtime application is on current main or deployed, and automatic
   organisation/product onboarding remains later work. Do not manufacture raw
   INSERT instructions or enable registration to bypass that missing admission.
6. The exact unresolved Architecture decision is a lawful controlled onboarding
   path for the three real Clerk subjects and their memberships, including the
   finite binding lifetime/renewal policy. B1 currently caps new bindings at300s
   and implements no renewal; expiry must not be evaded with far-future dates or
   reactivation. This decision is required before a reliable longer browser UAT.
7. After the owner's creation, verify actual SDK identity/session, distinct
   internal UUIDs, current bindings/memberships/product access and explicitly
   approved location/report/source rights. Users A1/A2 share their supplier;
   B1 must be refused access to A. No account or membership was created here.

See the current [Clerk invitation procedure](https://clerk.com/docs/guides/users/inviting)
and Canon/v1.0-identity-runtime-architecture-and-ownership-canon.md. Creating
Clerk users alone does not complete the E1 acceptance fixture.

The UAT checklist is: lawful MGBI report refresh/backfill, exact HQ address,
stable repeated refresh, manual create/edit/deactivate/reload, two-member sharing
and authorship, other-organisation denial, revocation, replay/CAS/audit rollback,
all three groups and paged KYS only after retention acceptance, and existing
SRM/SG2 regressions. Unconfirmed MGBI branches remain NOT_CONFIRMED.
Zero paid geocoding means address-only entries remain visibly unresolved until
lawful coordinates exist; do not invent markers or promise automatic coordinate resolution.
Real browser map loads must remain within existing approved Maps quotas.

## Verification completed and limits

Fresh local results: locations33/33 with the real SQL019/SQL013 fixture, Maps15/15,
contract/source acceptance3/3; no skips. Maps build passed, digest
`d036e19eb963f956d866add4296fcd0d318402be394547a62344cca017ef2bb1`.
The owned local PostgreSQL instance was stopped after testing.
The first restricted-sandbox HTTP test could not bind its local socket; the
proper permitted rerun passed. One wrong-directory test command was corrected;
neither incident changed source or cloud state.

Maps live deploy `dep-dbati9rrjlhs73akpsj0`, source
`db2df0a6cccb994ea4654ae0eb5b3af4b46867ff`, public build-manifest digest
`357464b3948e1141e73f8877f4bc42047d2fc7fcc1299e913d8ad98c6fabb984`.
All13 public files independently match their manifest and current-main build.
Health/configuration permit the SRM Development origin. Private runtime bytes and
secret-file contents were not attested. No SDK/tiles/geocoding request was run.
Public/static compatibility PASS is not authenticated SRM embed UAT.

There were no product database writes, cloud resource creation, deployments,
configuration changes, shared application interruptions, Google changes or
Staging/Production changes. No broad live regression or live acceptance is claimed.

## Continuation and business release decision

**NO-GO for live Supplier Locations activation at this checkpoint.**
Resume the same task after the consolidated owner actions; retain all completed
read-only/source/local verification and recheck only drift-sensitive evidence.

PMOS registration `cmvj0baur0000t43u7k05vcpm` is in srm_pmos.
The task remains running/resumable at this mandatory owner gate. Canonical local
execution trail and this checkpoint preserve findings without fabricating a final
closeout or completing the registration. PMOS closeout is PARTIAL and PHR is
PENDING until release acceptance or an explicitly final disposition. MEMOROS is
DISABLED_BY_PROFILE. TASK03/MagicPath remains CONDITIONAL.

The JSON companion contains the complete required verdict block and exact
reviewable permission proposal. The owner action gate is required by TASK02-R
sections4,6,7 and16: "Owner approval of the recovery point, coordinated maintenance
window and controlled installation procedure" and "This task request does not,
by itself, constitute approval to interrupt SG2/SRM traffic."



## Retention owner and exact remaining decisions

Cross-checking current GitHub source/PR549/555/597, SRM PMOS, reachable PHR,
Neon functions/extensions and the complete Render service inventory found no
accepted periodic KYS maintenance executor. The logical source owner is **SRM
Runtime**; the privileged E1/owner boundary belongs to **Architecture Platform**.
No named operational owner of a scheduled execution was established.

The existing protected native cleanup runs as current-organisation
SRM_SENSITIVE_EXPIRE work during a supplier request. Its cache helper nulls
expired KYS payloads in the organisation cache. Neither is periodic or cleans
supplier_locations. The SQL013 candidate owner port physically removes expired
SOURCE derivatives and clears expired coordinates, preserving manual rows, but
requires current_user=profitia_access_owner. A normal HUMAN/SERVICE call cannot
be substituted, and no broad owner grant is acceptable.

The concrete decision is adoption of a controlled periodic execution with
physical-expiry receipts, current-source withholding, manual preservation,
idempotency, bounds, audit and missed-run handling. SRM accepts the domain
retention requirement; Architecture reviews any privileged execution channel.
No scheduler/role/service was created. KYS remains BLOCKED. An independent
HQ/manual release needs an effective KYS input **and projection** fence first;
the existing overall feature flag alone does not provide one. This is an
identified corrective prerequisite, not an invented accepted partial rollout.

The no-wildcard grant review also found a concrete SQL019 semantic: exact
application/org/user/feature/operation are mandatory, but resource_id=NULL
matches every resource ID within that exact scope. It is not a per-supplier
selector and is **not preapproved** by the owner's response. SQL019 supports an
exact resource ID or NULL, not a typed supplier-prefix selector. The final matrix
must explicitly resolve dynamic manual CREATE scope before full browser CRUD
acceptance. No GRANT ON ALL FUNCTIONS/tables, null operation, null organisation,
null actor, cross-product grant, or unreviewed resource wildcard is proposed.

## Proposed window variants and abort conditions

B1-I Stage2 is closed; this is evidence of completed work, not a reservation or
maintenance approval. Conditional options in Europe/Warsaw are 22 October2026,
10:00-11:00 or14:00-15:00. Neither is booked or executable. Select a later window
if the owner actions and verified evidence are not ready before those times.
No automation or scheduled release has been created.

The impact is the five ACTIVE shared E1 applications and their seven access
bindings (including the already DISABLED identity binding), SRM request-bound
jobs/sources, SG2 dashboard/runtime/dispatch paths and two existing forecast
workers. Maps remains running and unchanged; Staging/Production are excluded.
Hold the139 pending requests without replay, charge, cancellation or loss.

Abort before disablement for recovery/LKG/Source visibility/UAT/retention/grant
or coordination failure. Abort the SQL transaction for any guard/hash/receipt,
owner/RLS/PUBLIC-ACL mismatch or uncertain commit; inspect receipts before retry.
Stop candidate propagation for health, audit, tenant isolation, queue preservation,
manual/source persistence or SG2 regression. Stop when the approved60-minute
limit cannot be respected. First restore approved feature-off runtime/config
and exact pre-window shared availability; preserve new data and forensic state.
Database restore requires a separate incident decision accounting for unrelated
newer writes. Never automatically reverse migrations or drop populated tables.

The owner response is preserved as conditional preparation authority. This
updated packet does not request an unconditional maintenance GO while recovery,
identity, retention and exact resource-scope decisions remain unresolved.

## Owner-created recovery verification — 2026-10-22T05:43:12Z

The owner supplied and authorised inspection of:

| Resource | Verified identity / state |
| --- | --- |
| Project / database | spring-bread-28217539 / platform_private |
| Snapshot | snap-bold-bird-b99s4c9q; manual; srm-supplier-locations-task02-r-preinstall-20261022 |
| Snapshot created | 2026-10-22 05:23:04 UTC |
| Restored data point | parent_timestamp 2026-10-22 05:22:36 UTC; parent_lsn 0/3B8E828 |
| Recovery branch | br-green-glitter-b9weet99; created05:25:09 UTC; ready; restore_status=restored |
| Recovery compute | ep-divine-mode-b9fekhdg; separate endpoint; fixed0.25CU; suspend300s |
| Original branch / compute | br-sparkling-term-b99l107x remains primary/default; ep-late-heart-b9mxo8oi remains attached |
| Expiration | snapshot console explicitly says **Expires on: never**; recovery branch says **Never** |
| Finalize / migration | neither executed; restored branch remains non-primary/non-default |

The snapshot API omits expires_at for this snapshot. The independently observed
console text resolves that ambiguity. Current [Neon snapshot retention documentation](https://neon.com/docs/guides/backup-restore#snapshot-retention)
also states that manual snapshots have no automatic expiry unless one is assigned.
The one-day PITR/history window is a separate setting and does not expire this
manual snapshot. No retention setting, backup schedule or resource was changed.
Resource availability/expiry and capture drift must still be checked before any
later approved window; this is not an RPO0 promise while legitimate writes continue.

Read-only verification used explicitly selected project, branch, compute and
database. Catalog/content transactions were REPEATABLE READ READ ONLY; controlled
content was read as SET LOCAL ROLE profitia_access_owner, never by disabling RLS
or granting a new role. An ordinary srm_private_development_runtime login also
read the existing supplier business descriptor successfully on both endpoints.

Verified comparisons:

- 105 ordinary tables in24 business schemas, including30 SRM tables. The catalog
 comparison's107 relation objects additionally include two sequences.
- 846 columns,730 constraints,172 indexes,454 RLS policies,208 public/business
 functions (including owner/ACL/body/search-path attributes),161 user triggers,
 schema owners/ACLs, default ACLs, sequence definitions, extensions and all23
 role memberships match between original and restored endpoints.
- The existing application roles have identical flags. The copy additionally has
 unreferenced NOLOGIN token_roles with zero memberships and zero pg_shdepend
 dependencies. Its creation provenance was not independently attributed. Therefore
 the full role catalogs are explicitly **not identical**; no application authority
 difference was found and no role was removed or altered.
- Counts and SHA256 fingerprints of authorised visible contents match for **79
 tables**. This includes all12 access-directory tables,2499 access audit events,
 exact product/permission grants, six application rows with five ACTIVE, seven
 bindings, access revision109, installation receipts,150 intents/dispatches,
 request policies and phase-effect state. The companion JSON preserves every
 compared table/count/hash plus exact query algorithms.
- SQL019/SQL013 remain absent. Queue remains139 PENDING /11 CONFIRMED, with zero
 unexpired leases and zero non-accepted phase effects at this observation.
- No query over five minutes was present on the recovery compute.
- The copied immutable descriptor intentionally retains the original branch ID.
 Physical copy lineage is separately proved by provider metadata. Rewriting that
 receipt or attaching an application to the copy is excluded.

Coverage limits are explicit. **Full physical-content parity is NOT VERIFIED**:

- 19 Source-owner tables require an accepted profitia_ingestion_owner inspection
 channel; the present session cannot assume that owner. This includes authoritative
 external-call/uncertain-effect state. No role membership was broadened.
- Seven further table measurements were refused by existing RLS/runtime admission:
 sg_runtime_benchmarks.BusinessBenchmark; srm.users; srm.user_supplier_interest;
 srm.organization_supplier_interest; srm.catalog_companies;
 srm.catalog_financial_facts; srm.catalog_financial_indicators.
- The initial broad aggregate read was rejected and its read-only transaction
 aborted. Bounded read-only subdivision established the79 successful results and
 exact seven refusals; no fence, function or data was changed to make a read pass.
- Visible-content equality is not evidence of unseen rows. No write test, SQL019/
 SQL013 installation, traffic cutover, second restore, Finalize Restore, connection
 migration or database rollback occurred. Restore/cutover RTO remains unmeasured.

**Recovery resource/lineage/expiry: PASS. Schema and application ACL parity: PASS.
Permitted isolated read validation: PASS with documented coverage.
Full recovery acceptance and combined LKG: PARTIAL / NOT YET ACCEPTED.**
Render independently still reports the same live SRM and Maps deployment IDs and
SHAs as the already measured artifacts above. No deploy or rollback was triggered.

## Current identity dependency and consolidated remaining decisions

A fresh GitHub/Architecture PMOS check found [Draft PR598](https://github.com/profitia/SG-dev/pull/598),
**feat(identity-runtime): B2 session compatibility and bounded navigation**,
head ed9e64cc19bb52a673160e92f981eb7767a454ac, open/unmerged.
Its task ARCHITECTURE-IDENTITY-B2-SESSION-COMPAT-20261022 is running; B1-I Stage2
remains completed. Its28 changed files are Identity Runtime/CI/evidence/runbook,
without overlap with this task's declared files or a product SQL migration.
This is scope evidence, not an exclusive shared-environment reservation.

The candidate session-boundary code and consumer adoption runbook were inspected
at that exact head. B2 resolves existing bindings per protected request and
explicitly excludes implicit renewal, automatic organisation/member/product
provisioning and live consumer adoption. It therefore does **not** close the UAT
admission gate. Main still has no Identity Runtime implementation. Current E1
still has one ACTIVE genuine account/membership and five DISABLED B1 fixtures;
no user, binding, organisation or membership was created here. The earlier Clerk
user-count observation is historical; this continuation rechecked E1, not Clerk.

The same owner-gate-v1 package is updated. It is **prepared but not ready for a
window approval request**. No additional resource creation is currently requested.
The remaining decisions are consolidated in the JSON and here:

| Gate / responsible owner | Exact unresolved acceptance |
| --- | --- |
| Recovery coverage / authorised Source + Architecture operator | Lawful readback of the26 excluded table contents and Source in-flight/uncertain effects; no audit privilege expansion |
| KYS / SRM Runtime + Architecture Platform | Named periodic controlled-retention execution with physical-expiry/audit/missed-run evidence, or reviewed implementation and verification of an independent HQ/manual KYS input and projection fence |
| UAT / E1 Architecture + SRM owner | Genuine A1/A2/B1 Clerk subjects through accepted E1 admission, approved fixed-org A data scope, separate B membership, exact product/report/source rights and finite binding/renewal policy |
| Dynamic CREATE / E1 producer + SRM receiver | A bounded no-wildcard authority design; current write resource is a server-derived location UUID from MANUAL plus the idempotency key, while SQL019 matches exact resource ID or NULL |
| Installation / SRM + SG2 + Architecture authorised owners | After previous gates and final LKG: one exact <=60-minute coordinated window, immutable SQL/receipts, exact grants/config/runtime and executable rollback; fresh B2/no-conflict check |

A blank resource_id would cover every resource inside the specific approved
org/user/operation; it is still outside the owner's no-wildcard approval. This
preparation neither adopts that blank grant nor invents a new selector. Exact
collection READ/SYNC grants alone cannot make arbitrary later manual CREATE
available. The current source/configuration-only release targets cannot silently
change the shared E1 authority contract.

KYS source cleanup remains request-bound; no accepted periodic operator was
found in current main or the refreshed related PR inventory. A signature or
installation approval cannot supply missing retention/onboarding implementation.
The earlier window variants remain conditional, unreserved and non-executable;
if prerequisites are late, withdraw them and propose a fresh window.

The user explicitly withholds application disablement, SQL019/SQL013 and deployment.
No new approval is requested before the preceding prerequisites close.
Same TASK02-R remains running; PMOS closeout PARTIAL, PHR PENDING, MEMOROS disabled.
