# SRM Supplier Locations — TASK02 implementation and release boundary

Task: `SRM-SUPPLIER-LOCATIONS-FULLSTACK-TASK02-20261021`; SRM profile;
`TARGET_ENVIRONMENT=development`; actual execution local; isolated branch
`srm/supplier-locations-fullstack-task02-20261021`; host conversation
`01a133ad-8739-7a21-ac6e-36f0a9bf8ed5`.

## Outcome and authority

The source implements persistent organisation-owned supplier locations, accepted
report synchronisation, manual CRUD, three SRM groups and the existing embedded
Maps boundary. Live Development installation and activation remain gated. This
document distinguishes isolated implementation acceptance from product release.
No Staging/Production change, new cloud resource or billable provider call was
performed. Live Google coordinate acquisition remains WAITING_OWNER, budget ZERO.

Root AGENTS, active manifest, shared Profitia governance and SRM adapter were
loaded in order. All changes use the SRM routing profile, exact declared paths,
fail-closed preflight and the task's own begin in **srm_pmos**. MEMOROS remains
DISABLED_BY_PROFILE. Registration: `cmvifokg70000q3ndp933r9rl`; PMOS derived ID:
`pmos-task-v2:1883370c8b3c0db9560b0dcbbe07b63ec8bf219d6773b4e76a652b3e18ab768a`.

The accepted producer is immutable source
`88c3337d943fa3893f2f357bb11b78c565e50047`, package **1.24.0**, Root
**1.0.0-candidate.16**, eight-file digest
`9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728`.
SQL019 digest is
`34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5`.
PRs [594](https://github.com/profitia/SG-dev/pull/594),
[595](https://github.com/profitia/SG-dev/pull/595),
[596](https://github.com/profitia/SG-dev/pull/596) are prior completed adoption,
not TASK02 installation evidence. Historical receipts remain byte-for-byte
unchanged; the current implementation has a separate source-digest closure.

Source base was refreshed to `1d0f4f1ae257610547b872f92e76d594bd7a0941` after B1
PR591. B1 adds optional exports; the eight accepted Root files are unchanged.
One asynchronous preflight returned main drift after a source batch had started.
The error was disclosed, further edits paused, all work checkpointed, stashed,
rebased onto fresh main and fully revalidated before continuing. The checkpoint
and original stash were retained. This was a corrected gate-ordering incident,
not a waiver of a failed preflight.

Draft [PR590](https://github.com/profitia/SG-dev/pull/590), exact HEAD
`69fabecafce9712e7cbe6f41bc363885d897f6f0`, remains DESIGN_NOT_ADOPTED. This
implementation supplies the actual reviewable contract and supersedes the stale
design proposal for TASK02; it does not silently adopt/merge PR590.

## Implemented boundaries

* `packages/srm-xray/src/supplier-locations.ts`: portable closed location/manual
  types, validation, current-coordinate checks and renderer allowlist. It embeds
  no customer, organisation, actor, provider credential or installation identity.
* SRM SQL013: three owner-controlled FORCE-RLS tables, immutable installation
  receipt, composite organisation/supplier ownership, E1 account authors,
  actual Root intent references, protected domain functions and CAS. Existing
  eighteen baseline migrations/manifest remain unchanged.
* SRM server: current E1 HUMAN read/write/sync, current server-bound organisation
  and actor, accepted source/version checks even on Root replay, same-transaction
  persistence and protected OUTCOME. No alternate auth, tenant resolver, queue,
  permission/quota engine or idempotency ledger is introduced.
* `POST /api/supplier-locations`: closed same-origin JSON; READ/SYNC and manual
  CREATE/UPDATE/DEACTIVATE; opaque SRM supplier UUID, client idempotency key and
  expected version. Caller organisation/user/source metadata is not trusted.
* Report integration automatically reconciles on accepted report refresh while
  the protected report is mounted. Sync reads only accepted stored reports and
  existing lawful MGBI catalog records. It never acquires a provider report on map
  open. Stable server IDs and Root keys prevent duplicate source records. Manual
  rows and their authors survive source refreshes.
* The existing Maps Runtime stays independently reusable; SRM owns its business
  persistence. The renderer receives only current page IDs, labels, optional
  postal addresses, kinds and lawful coordinates. No raw MGBI/KYS, actors, notes,
  permission claims, tokens or private storage identifiers enter its contract.
  Maps loads only after the explicit Google Maps action. Fresh protected reads
  serve the E1 embedded channel. Scope changes, hidden page, close, logout and
  revocation clear the iframe/state; there is no browser persistence.
* Three groups: **Siedziba i oddziały / Podmioty powiązane / Własne lokalizacje**.
  Manual form supports postal data and optional complete coordinate pairs.
  Paging preserves unlocated entities and does not truncate 501+ related rows.
  Related companies are never presented as supplier branches.

The feature defaults disabled, rejects a mismatching physical target/configuration
version and has no legacy fallback. Existing report/JDG/deregistered behaviours
remain separately guarded.

## Provider coverage and retention

MGBI headquarters use the accepted catalog identity/hash and matching bounded
KRS archive for structured postal parts. Display-only or incomplete addresses
remain unlocated; no postal parsing guesses or fabricated coordinates are used.
**MGBI_BRANCHES=NOT_CONFIRMED**: provider branch fields were not independently
verified, so branch population is disabled and coverage is explicit in the UI.
Primary provider reference: [MGBI records](https://mgbi-api.apidog.io/get-records-9055163e0).

KYS enrichment accepts the existing protected private report DTO and only legal
companies with verified identifiers. Persons, sole traders, name-only guesses,
arbitrary personal lists and ambiguous identity matches are excluded. Related
companies without an authorised existing MGBI address remain visible unlocated
while lawful KYS access exists. Independent source-right loss masks enrichment;
KYS revocation withholds the private-derived row immediately. Expiry physically
removes private-derived rows while preserving unrelated manual/postal data.

The conditional server geocoder uses the already adopted E1 request/job,
delegated SERVICE work, platform ingestion and Source external-call host. It
accepts server-selected current location/address versions, checks the initiating
human and current source before READ and SAVE, and preserves the actual human
author. Different source/address versions or revoked rights prevent SAVE.
Ambiguous/non-precise/partial Google results never become exact markers. Source
attempt coalescence is durable and organisation/location/version based, with
no automatic retry after an uncertain paid response.

Default adoption is absent, so provider attempts and paid budget are **zero**.
There is no public geocoding route or live executor/key/budget adoption. The
server command and domain ports are source/fixture tested; this is not Google
UAT. Enabling paid geocoding additionally requires an approved existing physical
expiry job at most 24h apart. Google coordinates use 29 days or shorter private
retention; formatted Google address responses are not retained. See
[EEA service-specific terms §6.2](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms)
and [Geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies).

## Current cloud state (read-only verification)

Neon: project `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`,
database `platform_private`, ordinary role `srm_private_development_runtime`.
Exact SQL017 is installed. **SQL019 and srm.supplier_locations are absent.**
Current descriptor revision was 75. SRM, SRM jobs, SpendGuru and both SpendGuru
dispatch bindings were ACTIVE; identity-runtime-development was DISABLED.
The task did not change these states or execute live SQL migrations/grants.

A concurrent B1 recovery/rehearsal resource exists:
`br-square-field-b9vzels8`, restored from `snap-noisy-art-b9uwq5rf` with reported
parent timestamp `2026-10-21T19:34:30Z`. Existence is verified; suitability,
current-state coverage and operational authorisation for this task are not.
Do not claim that no recovery resource exists or automatically reuse its proof.

Render workspace `tea-d7lps8rbc2fs73cn80dg`, existing Development environment:

| Service | Current live deployment | Current live SHA |
|---|---|---|
| SRM `srv-db1vu6gm7kps73d0e3r0` | `dep-dbbnb22fngtc73bn0i90` | `260ade12608faaea27376c1c976db392f046f267` |
| Maps `srv-dbat5ulg1s2s73defcp0` | `dep-dbati9rrjlhs73akpsj0` | `db2df0a6cccb994ea4654ae0eb5b3af4b46867ff` |

Both have automatic deployment off. Maps public configuration is configured and
allows the actual SRM origin; no API key value was printed. Entry points:
https://srm-development-runtime.onrender.com and
https://profitia-maps-development-runtime.onrender.com. **The new supplier
location feature is not present at those live entry points.** No task deployment
or live authenticated/UAT claim is made. Artifact digest/config/schema rollback
proof for this task is not yet available; deployment must not begin without it.

## Validation and reproducibility

Actual PostgreSQL16 clusters are local synthetic fixtures, separate from Neon.
The fixture administrator seeds historical accepted data only during setup,
restores all triggers before runtime assertions and does not perform the
accepted product writes. Ordinary non-owner runtime roles execute those writes
through actual E1 hosts. Clerk is mocked at its official verification port;
this does not prove live Clerk/session readiness.

Coverage includes root admission/no-policy denial, current actor/grants,
organisation sharing, cross-org denial, forged GUC/direct-DML denial, CREATE
replay, same key/different payload conflict, CAS races, accepted MGBI source
refresh, 501 related rows/paging, lawful KYS reads, independent rights loss,
retention, physical expiry, protected OUTCOME rollback, real SERVICE geocode
READ/SAVE, missing technical policy, wrong executor, actor/source revocation,
changed source between READ/SAVE and current cache reuse without provider cost.

Browser proof runs the actual SRM component and built Maps iframe/embedded E1
channel in a fresh Chrome profile, with synthetic local HTTP data and no Google
network. It verifies lazy map load, three groups, manual form/coordinate pair,
create/edit, fresh projection, supplier/organisation reset and revocation. This
is component/browser evidence, **not** a live SRM/Google end-to-end PASS.

Final counts, exact-source PR/CI, artifact identities and continuity readbacks
are recorded in the final PMOS/PHR receipt after their actual execution.

Local SRM regression: **610/610**, zero failures/skips, including the seven
optional migration/financial PostgreSQL tests (their loopback database was
explicitly configured). Targeted locations: **31/31**, zero failures/skips.
Maps regression: **15/15**, zero failures/skips. SRM TypeScript and production
build and Maps production build passed. Browser checks above passed and their
unthemed synthetic form/list screenshot was visually inspected.

The full E1 regression was rerun on a clean local fixture after a previous
reusable test database retained `profitia_ingestion`; that old fixture initially
failed reinitialisation with SQLSTATE42P06. A separate clean diagnostic passed
100/100 without source/test weakening. The original failure log is retained.
Final full E1 regression: **329/329**, zero failures/skips. Cloud CI and exact
publication identities are recorded separately in the final PMOS/PHR receipt.
The current Maps build at the uncommitted source base is local validation only;
its source label is not a deployed/accepted artifact identity.

Repository evidence intentionally precedes publication: it does not assert a
future merge, CI result or continuity closeout. The final task receipt records
the exact PR/head/merge SHA, CI runs, complete verdict fields and independent
PMOS/remote PHR readbacks after those operations occur.

## Smallest lawful live continuation

Owner: approve a current recoverable receiver state and its verified restore,
plus a coordinated SRM/SG2 Development maintenance window and controlled-owner
installation authority. The SQL019/SQL013 guards require disabled bindings;
Task02 §4.2 explicitly forbids interrupting shared traffic merely to pass them.
Operator: follow `apps/srm/db/private-store/README.md` optional TASK02 procedure,
read back exact receipts and ordinary-role grants, prove LKG rollback, deploy
accepted source, then validate authenticated two-user/two-org behaviour.

Paid Google activation remains a separate owner decision: reviewed service and
Source bindings, key restrictions, positive budget and existing physical expiry
execution. Core persistence/presentation may be released at budget zero with
unlocated address states. Persisting KYS derivatives additionally requires the
approved existing private-source retention cleanup to be adopted and verified;
the implemented operator port and read-time purge are not a scheduled live job.
No prerequisite is silently waived by that separation.

TASK03 may refine the implemented UI against local fixtures now; live product
acceptance and the actual working Development entry point remain conditional on
the above release. See the adjacent machine-readable UX handoff.
