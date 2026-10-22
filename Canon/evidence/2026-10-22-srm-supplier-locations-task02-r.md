# TASK02-R — controlled Supplier Locations release preparation

Status: **PARTIAL — mandatory consolidated owner gate**. Observed 2026-10-22 04:14:59 UTC.
Task: `SRM-SUPPLIER-LOCATIONS-TASK02-R-20261022`. Profile SRM; Development only.
This is a prepared installation and acceptance package, not installation, activation or release evidence.

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
Descriptor revision75; SQL017 receipt digest
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

The active chat **Flow, rejestracja i logowanie czatem**
(`01a15aed-8d94-7fe0-9cff-c54f72b5f8a8`) is preparing B1-I Stage2 against the
same receiver. Owner serialisation is required. No message was sent to that chat,
and none of its approvals or recovery resources were inherited.

## Recovery and LKG gate

The existing B1 resource `br-square-field-b9vzels8` was restored from
`snap-noisy-art-b9uwq5rf` (B1 preinstall snapshot, 2026-10-21 19:34:40 UTC).
It expires 2026-10-22 19:34:39 UTC (21:34:39 Europe/Warsaw).
It is not accepted as coverage for the current installed B1 state or this window.
No current TASK02-R restore rehearsal has run.

Owner console action, after serialising B1-I:

1. In the Neon project above, select the current primary Development branch,
   then **Backup & restore** (Enhanced view if required).
2. Create a fresh manual snapshot named
   `srm-supplier-locations-task02-r-preinstall-<UTC timestamp>`.
   Proposed retention: seven days; the owner controls creation, retention and any cost.
   Return its ID, capture timestamp, expiration and branch/LSN evidence.
3. Select **Restore → Multi-step restore** into a dedicated branch named
   `srm-supplier-locations-task02-r-restore-<UTC timestamp>`.
   Return the restored branch ID. Do not choose one-step restore, migrate primary
   connections/settings, or finalize the restore.
4. The release operator will inspect the isolated restored schema, immutable
   receipts, B1 state, grants, protected row counts and queue/audit continuity.
   No external consumer may attach to the rehearsal branch.
5. If shared writes occur after the accepted capture or B1 changes the receiver,
   reconcile snapshot coverage and data-loss exposure before any maintenance.
   Do not replay an earlier approval against changed state.

This follows the current [Neon backup/restore procedure](https://neon.com/docs/guides/backup-restore).
A new branch or snapshot must be created by the owner, not implicitly by the agent.

Current SRM LKG candidate:
deploy `dep-dbbnb22fngtc73bn0i90`, source
`260ade12608faaea27376c1c976db392f046f267`.
The service is healthy, but the running artifact digest, retained-artifact
availability and historical configuration have not been independently verified.
Read-only SSH returns publickey denial. The older recorded digest
`d419e35a1131f637b6009ce9ae9b511f3c193f077b9ada9fe71e4548db19301e`
belongs to source `6eede5cd19fd3a4519d66298effe9ef94633757a` and a one-off build,
not this running artifact. It cannot satisfy this gate.
Current SRM environment fingerprint:
`d86ce81c0d4207d51c9200c86474e4acb30fdfa51b26a2205b74f385740069b5`.
This fingerprints current service values, not historical deployed configuration.

Owner action: enable existing read-only running-shell access or supply
independently verifiable current artifact/configuration measurements and retained
rollback eligibility. Do not send credentials in chat. The operator must verify
the evidence before deployment. Render rollback reuses a retained artifact;
rebuilding the old source is not equivalent. Environment groups and mutable
platform settings require separate drift review under
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

The owner must identify an approved existing execution and responsible operator.
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

Only one E1 account, one organisation and one active membership currently exist.
A live two-member/two-organisation acceptance fixture is unavailable.
Owner provides lawful authenticated sessions through the existing identity
process, including the separate-organisation case; no impersonation, credential
sharing, cloud test-identity seeding or reassignment of customer history.

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

