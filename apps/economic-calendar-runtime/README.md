# Economic Calendar Runtime 1.1.0 — Development backend

Source candidate for the accepted ECR vision and SourceHub/preference amendment.
G1 was explicitly granted and accepted in PR906, authority main
`b837f93b47d15cd812242a2ab0df6e69c35b3656`; its bounded CI policy was accepted in
PR907. This implementation is not a LIVE acceptance or infrastructure grant.
The original v1.0 canon bytes and existing owners remain unchanged.

## Data and authorization

Only the existing SourceHub first-party client acquires Trading Economics data.
The web runtime has no TE credential, Source signing key or ingestion DB login.
It reads the durable ECR model. A separate explicit `sync` command has its own
enrolled component key, current real SERVICE context and ordinary ingestion
login. There is no sync HTTP backdoor, timer, worker service or automatic task.

An immutable release ID is derived from the provider and its actual CalendarId.
Content/schedule changes preserve it. Different source IDs produce different
releases, never reattach favourites, and absent results never imply deletion.
Repeated identical snapshots record a refresh and receipt without a new change
version. A changed result, previous revision, forecast, schedule or metadata is
an observed change; an older provider-update snapshot is retained explicitly as
stale and cannot replace newer current facts. Overlapping acquisitions serialize
by intent/receipt/event; failed SQL rolls back the entire acquisition.

`previousAfterRevision` retains TE Previous; `previousBeforeRevision` retains TE
Revised. Actual, consensus and vendor forecasts preserve original number/string/
null values and units. Event time, estimated-time DateSpan, reference label/date,
provider update, ECR observation and unknown publication time remain distinct.
The store contains observations actually retained by ECR, not an invented vintage
archive. `asKnownAt` never supplies a version preceding its first ECR observation.
Provider coverage remains UNKNOWN/INCOMPLETE where SourceHub cannot establish
completeness. Empty local results do not prove complete provider coverage.

Calendar facts use the accepted SHARED_KNOWLEDGE projection and current
`knowledge.read` / `market` permission. Private settings use the accepted
`personal.list.read` / `personal.list.write` operations. Both reuse current E1's
transaction-bound admission and outcome checks. Every HTTP operation has two
current authority observations, independent of the number of events returned;
there is no ALLOW cache or per-event authentication loop. ECR makes no direct
Clerk calls. Genuine call counts and latency must still be measured LIVE.

Canonical internal userId comes exclusively from verified E1. One private row
per canonical user survives sessions/devices and active organisation switches.
Every request separately checks current organisation membership, product and
permissions. Runtime SQL RLS verifies the receiver proof; caller IDs or GUCs
cannot substitute for it. The ingestion role cannot read private preferences.
No accounts, external identities, memberships or product offers are copied into
the receiver database. Its existing E1 descriptor/audit support is not a second
identity authority.

Personal favourite references confer no entitlement to event content. Their API
returns IDs and `REQUIRES_CURRENT_EVENT_READ`; event details require a separate
current shared-read permission. Unresolved IDs remain explicit references and
never silently bind to another release. There is no existence oracle in the
private write. Favourite references and reusable filter criteria are different
resources. Topics are explicit `LOCAL_EVENT_TEXT_CONTAINS`, not invented native
Trading Economics oil categories.

## API

All business routes are under `/v1/organisations/{currentOrgId}/calendar` and
require a genuine current Clerk bearer session through central Identity/E1.
The organisation in the path is a selector checked by authority, never a grant.
Cookies, claimed user-ID headers and identity fields in private bodies are refused.

| Method/path | Behavior |
| --- | --- |
| `GET /events` | Retained events; repeated `country`, `indicator`, `importance`, `eventId`; UTC `from`, `to`, `asKnownAt`; literal `eventText`. |
| `GET /events/{eventId}` | Authorized current or retained `asKnownAt` detail and receipt provenance. |
| `GET /events/{eventId}/revisions` | Observed changes, source receipt/time and explicit `adoptedAsCurrent`; no fabricated vintages. |
| `GET /preferences` | Restore private watched selections, local topics, saved filters and display settings; absent row returns version0 without a write. |
| `PUT /preferences` | Replace only those settings with `{expectedVersion,preferences}`; conflict409 preserves newer data. Favourites are preserved. |
| `GET /favourites` | Own private references, without protected event content. |
| `POST /favourites/{eventId}` | Idempotently add own reference. |
| `DELETE /favourites/{eventId}` | Idempotently remove own reference. |

Event/favourite pages use stable canonical-ID order, `limit`1–500 and explicit
`nextAfter`; there is no hidden date/history cutoff. History uses a sequence
cursor. Favourite mutations optionally accept strong `If-Match: "version"`
against the user's private-state revision; this supports safe concurrent cleanup.
Preference writes require expectedVersion. Ordinary reads acquire no source data.

`GET /health` reports the executable source SHA; `GET /ready` checks bound product
storage and current authority. They are technical health, not business acceptance.
An inactive or mismatched store refuses business operations. There is no fallback
fixture, in-memory persistence, identity mirror or direct provider adapter.

## Owner-provided prerequisites — no automatic provisioning

The logical application ID is `profitia-economic-calendar-runtime-development`.
It is a source identifier; this repository does not claim it has been enrolled
in a LIVE control plane. The owner must designate/provision the actual resources
through the existing approved process and record their immutable identities:

1. A Development ECR service and independent ECR product database within an
   owner-approved project/branch. Reusing an existing project is possible; do not
   place ECR tables in PMOS, Identity, Newsfeed or SourceHub product storage.
2. Existing provisioned roles `economic_calendar_development_owner` (NOLOGIN),
   `economic_calendar_development_runtime`, `economic_calendar_development_ingest`
   and `economic_calendar_development_migrator`. Ordinary logins have NOINHERIT,
   NOBYPASSRLS, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION; runtime and
   ingestion are not members of owner roles. Only the explicitly approved
   migrator has the necessary SET ROLE memberships to its ECR/access owners.
   The owner separately provisions public pgcrypto and schema-create rights.
3. The existing central Identity owner installs the additive current-E1
   `005-calendar-authority.sql` under its controlled procedure. Existing
   SourceHub/Newsfeed profiles retain their behavior. The existing receiver
   mechanism enrolls the actual ECR database/application/key; no runtime proof
   key is placed in ECR environment variables. Product/membership/permission
   grants use real canonical users/organisations, `market` for events and
   `personal_workspace` for private operations; canonical parent entitlements
   remain current dependencies. These are owner actions, not implied by G1.
4. Existing SourceHub/Identity universal first-party installation and compatible
   release must be LIVE. ECR gets its own enrolled Ed25519 component and genuine
   ECR service binding/grant for `knowledge.read` / `market` /
   `api.trading-economics.economic-calendar` in the actual organisation. Do not
   borrow Newsfeed's component, service or a human session.
5. The source owner explicitly installs SourceHub migration005 using the existing
   migrator's opt-in `SOURCE_HUB_INSTALL_FIRST_PARTY=true` and
   `SOURCE_HUB_INSTALL_CALENDAR_STORAGE=true`. Installation defaults every licence
   to TRANSIENT_ONLY. The accepted owner licence declaration already covers
   durable retention/processing/authorized redistribution; no new business
   declaration is requested. Its operational projection is then set by the
   existing licence owner via
   `source_hub.set_calendar_storage_rights(actualExpectedVersion,
   'DURABLE_OWNER_ENTITLEMENT',actualOwnerApprovalReference)` on the active
   universal calendar row. Read actual version first; stale versions fail closed.
   This changes neither the Hub cache TTL nor six UNMETERED policies or Markets
   OFF. A zero TTL never becomes a durable grant. ECR imposes no arbitrary
   retention period on the licensed durable store.

The prepared `db:migrate` installs/verifies only the accepted receiver support
and ECR schema under the bound pre-existing migrator; it grants the necessary
technical SQL interfaces as that explicitly authorized owner operation. It
creates no roles, databases, user identities, product grants, component keys,
Source grants, provider accounts or licences. It refuses foreign product/control
schemas, a populated local identity directory and mismatched existing digests.
An already installed schema is verified, not silently overwritten. Enrollment
remains a separately reported owner action.

## Build, configuration and first release

Use the full monorepo at the exact normally accepted commit and Node24:

```sh
npm --prefix apps/economic-calendar-runtime ci --install-links --ignore-scripts --no-audit --no-fund
npm --prefix apps/economic-calendar-runtime run build
node apps/economic-calendar-runtime/src/main.mjs
```

The owner supplies private values through the approved secret/configuration
mechanism; none belongs in Git, logs, API responses or PHR. Runtime requires:

| Variable | Actual owner-provided binding |
| --- | --- |
| `ECR_ENVIRONMENT` | `development` only. |
| `ECR_DATABASE_URL` | TLS ordinary runtime URL, exact runtime role and designated database. |
| `ECR_DATABASE_HOST`, `ECR_DATABASE_NAME` | Actual Neon host/name, matched exactly. |
| `ECR_NEON_PROJECT_ID`, `ECR_NEON_BRANCH_ID` | Actual product-store identities. |
| `ECR_PUBLIC_ORIGIN` | Actual HTTPS service origin. |
| `ECR_IDENTITY_ISSUER` | Existing canonical Clerk issuer. |
| `ECR_CONFIGURATION_VERSION` | Owner's explicit installed configuration reference. |
| `RENDER_GIT_COMMIT` | Native actual40-character deployed SHA, never a fabricated value. |
| `ECR_ALLOWED_ORIGINS` | Optional exact HTTPS origins; no wildcard/cookie authority. |
| `PORT` | Runtime listen port; default3214. |

Migration uses the separate `ECR_MIGRATOR_DATABASE_URL`; ingestion uses
`ECR_INGEST_DATABASE_URL`. These operator processes supply `ECR_EXECUTION_SHA`
from the actual accepted checkout. This is execution provenance, not a claimed
prior deployment/LKG; the ordinary web runtime requires native `RENDER_GIT_COMMIT`. Neither credential is available to the ordinary web
runtime. The sync operator additionally supplies its own component ID/origin/key
ID/private signing key, real organisation ID, real service grant ID and explicit
idempotency key in `ECR_SOURCE_COMPONENT_ID`, `ECR_SOURCE_COMPONENT_ORIGIN`,
`ECR_SOURCE_KEY_ID`, `ECR_SOURCE_SIGNING_PRIVATE_KEY`, `ECR_SYNC_ORGANISATION_ID`,
`ECR_SYNC_SERVICE_GRANT_ID`, `ECR_SYNC_IDEMPOTENCY_KEY`. Provider keys stay in Hub.
`ECR_SYNC_CRITERIA_FILE` is a bounded JSON SourceHub Calendar criteria object.
An explicit `npm run sync` acquires once; successful same-scope intent replay
returns existing ECR evidence without another Hub/provider request. New
acquisitions always use current SourceHub/E1 admission; no ALLOW is cached.

### Reusable ECR SERVICE acquisition — no internal request package

Both `sync` and `source:acquire` use `src/source-service.mjs` and the existing
first-party SourceHub client. There is no ECR invocation counter or numeric
request allowance. The six existing Hub policies remain UNMETERED; provider
limits, current E1/service grants, source admission and audit remain authoritative.
The Oil report's temporary `maximumHubRequests=12` executor is unrelated and
must never be imported, renewed, reset or impersonated to execute ECR requests.

`npm run source:acquire` performs one explicit Calendar acquisition with the same
`ECR_SOURCE_*` and `ECR_SYNC_*` inputs as sync, plus `ECR_ENVIRONMENT=development`
and actual accepted `ECR_EXECUTION_SHA`. It requires no product database and
does not persist/export provider items. Output contains only counts, coverage
and the actual SourceHub receipt. It has no automatic retry or loop. This permits
authorized source verification independently of the later product-store rollout.
It does not turn transient permission into durable-storage rights. Reuse the
same idempotency key only for the same logical acquisition; a new key does not
renew authority. E1 verifies the actual enrolled component, role, organisation
and exact Calendar resource on every new acquisition.

`operations/source-service-profile.json` and `operations/enroll-source-service.sql`
are the exact **PROPOSED_NOT_GRANTED**, single-organisation, Calendar-only owner
operation. They create no request quota or Source policy. The finite access
expiry matches the existing receiver and licensed period (2026-12-04), rather
than a package of calls. Identity owner approval is required before application,
ordinary passwordless ECR role, component key, SERVICE binding and one read grant
are created. Generate the component's own Ed25519 key only after that GO; keep
its private half in an owner-approved secret store, never in Git/PHR. The existing
maintainer must verify the physical endpoint, use a locked owner transaction,
bind the final accepted checkout SHA and owner-decision digest, validate the key,
run the exact SQL, read back all bindings, then restore original memberships.
Existing records cause reconciliation, never an overwrite. Revoke only this new
component/grant for rollback, preserving history and all other consumers.

Before first migration/release, independently reconcile resource identities,
ordinary/migrator privileges, actual accepted main and in-progress work. Preserve
an owner-controlled database backup/snapshot. There is no fabricated first-release
LKG. Review empty-install rollback and additive-schema compatibility first; a
failed first release stays unaccepted, with preserved data/evidence. Deployment
is manual exact-SHA after required source CI and explicit infrastructure/admin
authority. No auto-deploy, preview service or resource creation is defined here.

The runtime emits only operation/status/duration, and sync emits counts/receipt
provenance. It does not log private criteria, tokens, provider payloads, user IDs
or organisation IDs. Verify actual runtime monitoring ownership and safe logs
for the designated service before LIVE acceptance; no Sentry/PostHog project is
created or implicitly activated by this source change.

## Verification and acceptance

The CI workflow uses only public/local pinned dependencies and an isolated
loopback PostgreSQL16 service. No Render/Neon/Clerk/provider credentials are
available. Its actual HTTP, SQL RLS, current-E1, source-admission and rollback
tests use explicitly labelled synthetic data. For local integrated tests, supply
`SOURCE_HUB_TEST_ADMIN_URL` and `OPERATION_FIXTURE_OWNER_URL` for the same dedicated
`postgresql://testOperator@127.0.0.1:port/postgres` fixture. These guards reject
external database hosts. They are never runtime configuration or LIVE evidence.

After real authorized sync and exact-SHA deployment, `npm run probe:live` requires
`ECR_PROBE_ORIGIN`, real `ECR_PROBE_ORGANISATION_ID`, `ECR_PROBE_EXPECTED_SHA`, two
distinct genuine current sessions of one canonical user in `ECR_PROBE_TOKEN_A`
and `ECR_PROBE_TOKEN_A_NEW_SESSION`, and a different entitled real user in
`ECR_PROBE_TOKEN_B`. `ECR_PROBE_ALLOW_USER_WRITES=true` selects the explicitly
designated Development test users. The smoke adds a named private saved filter
and an actual retained event favourite, restores through the new session,
checks the other user's unchanged private state, then removes/restores its own
changes with CAS. Concurrent edits cause a conflict and owner review, never an
overwrite. Tokens and private contents are never printed. No fictitious user,
organisation, source entitlement or session is manufactured.

That smoke alone does not establish all business acceptance. Independently
verify actual TE historical/current/future coverage/fields, SourceHub receipts
and upstream counters, durable data after restart, ordinary reads during provider
failure, real current-access/session revocation, unavailable-authority refusal,
cross-organisation isolation, real latency/call counts and safe telemetry. Record
actual Render/Neon/Identity identities and deployed SHA. Missing prerequisites
remain BLOCKED/PARTIAL; neither tests, health200, G1, PR nor PMOS is LIVE approval.

AppShell UI, Finder overlay, reports, CIC/SRM adoption, notifications, Staging and
Production remain outside this backend implementation.

## Stage03 — multi-source licensed store (source, activation separate)

The owner-approved v1.2 canon is implemented by reusing this product store,
not by a second calendar database. `operations/stage03-owner-plan.json` is the
exact proposed administrative packet; its presence is not activation evidence.
Its own ECR SERVICE retains its key and TE grant; two additional finite source
grants authorize EIA and commodities.sh publication schedules only.

Opt-in SourceHub schedule protocol1.3.0 supplies recipient-bound durable rights.
SourceHub migration008 and the ECR-only owner CAS do not change any provider
licence, another consumer, transient TTL0 or Source policy. ECR migration002
adds its own versioned storage policies and append-only observed publication
history. An unchanged refresh cannot invent a revision or move the source-time
fence backwards. SQL failures roll back the whole acquisition. There is no
fixed commercial history expiry; acquisition expiry and the right to retain
already acquired facts are separate. Revoked local storage rights hide retained
source data and refuse new ingestion; they do not silently delete history.

`GET /publications`, `/publications/{id}` and `/publications/{id}/revisions` use
the existing shared `knowledge.read / market / economic-calendar-events`
boundary. Stable ID pagination1–500 is a technical response bound, not a stored
event or usage quota. Current E1 is observed at admission and outcome; the SQL
proof is checked once per query, with no per-record Clerk or full E1 loop.

A definition is provider-local. EIA reference periods, when actually supplied,
identify concrete releases independently of changed scheduled times. An
aggregator next date without a release key is retained as
`unresolvedNextSchedule`, not a fabricated immutable release. Date-only, rule
derived, exception and official schedule evidence retain their precision and
limitations. Schedules have null results and publication times; numerical
readings and revisions are not inferred. No cross-source correlation is added.

For schedules, supply exactly one bounded `ECR_SYNC_COMMAND_FILE` using
`contractVersion:1.3.0`, `family:publication-calendar`, `operation:calendar` and
provider `eia` or `commodities-sh`; legacy `ECR_SYNC_CRITERIA_FILE` remains for
TE. Run explicit `sync` with the provider-specific own SERVICE grant.
`npm run storage:verify` then uses a genuine existing Clerk session supplied
privately as `ECR_PROBE_TOKEN`, checks the exact deployed SHA, reads all local
publication pages through E1, and independently closes/reopens two ordinary
SQL connections. It emits only counts, fingerprints and receipt references.
It makes no provider request and writes no user preferences. Synthetic tests
are not a substitute for that real Development acceptance.

## Stage04–05 — global semantics and continuous operation

Source proposal; activation requires the exact `operations/stage04-05-owner-plan.json` owner decision, normal CI and actual Development readback. Existing Stage03 records and private preferences remain separate. No new user identity or business quota is introduced.

The same E1 `economic-calendar-events` read operation protects `GET /v1/organisations/:org/calendar/timeline`, `/context`, `/knowledge`, `/knowledge/:semanticId/revisions`, `/freshness`, `/evidence/:eventId` and `/evidence/:eventId/revisions`. Timeline/context accept `targetType`, `targetId`, `from`, `to`, `asKnownAt`, `after` and `limit`. Responses distinguish confirmed source definitions from unresolved aggregator editions; consumer rendering and assistant interpretation remain outside ECR. `MACROBOND:b_c1_cl` references the existing Development market catalogue; ECR stores relationships, not a benchmark catalogue or price series.

`migrations/003-semantic-continuous.sql` adds global, append-only semantic revisions, exact licensed result observations and durable work state. Controlled curation uses `scripts/curate.mjs` with the ordinary migrator and `ECR_CURATION_FILE`; expected versions, evidence, curator reference and database record time are mandatory. The ingestion login cannot curate. Read-time semantic history never predates its database record time, even when a rule has an earlier effective date.

SourceHub protocol1.4 is an opt-in ECR-only durable projection of two explicitly accepted weekly EIA stock series. No forecast, previous value, publication timestamp or prior vintage is invented. Source API snapshots link to a retained WPSR edition only on an exact unique reference-period match; unresolved observations retain that status. SourceHub cache retention stays0. Local and SourceHub recipient policies are separately revocable and versioned.

A separate bounded cron command `scripts/continuous.mjs` reads due jobs, claims a180-second fenced lease and keeps each intent and its command across restarts. At most one claim per job occurs in a tick. Successful replay checks ECR before acquisition. A definitive lost/non-retained response can create an auditable new observation intent; uncertain delivery pauses. Transient retries are capped at3 and no commercial usage counter exists. The cron checks due times every15minutes; provider refresh cadence differs: WPSR/calendar daily, STEO weekly, numerical results after the next WPSR schedule plus30minutes, or daily when lagging. It never runs in the web process.

The proposed Identity continuity migration010 adds only an owner-revocable ECR renewal policy and finite30-day SERVICE leases. Expired or revoked entitlements cannot renew. The shared receiver rows are untouched: only the exact ECR SERVICE receives its admitted technical receiver lease; other consumers and HUMAN source operations retain existing expiry. Current provider licences, Source Admission and the parent product are independent gates and are not renewed.

The proposed cron owns only ECR ingest credentials, its existing signing key and an ordinary central ECR login restricted to the renewal function. It has no provider keys, migration/admin credentials or human session. The web service receives none of those credentials. Exact deployed source must match the execution pin. Rollback pauses the cron, revokes only new rights, restores captured ECR/SourceHub Last Known Good releases and preserves all retained data and history. No automatic destructive downgrade exists.

## Source access continuity and expiry monitoring

Activation is separately gated by `operations/source-access-continuity-owner-plan.json`. The December4 date is an internal Development admission deadline, not evidence of a provider subscription end. The proposed bounded SourceHub functions renew only the three existing ECR source admissions and their shared technical binding/receiver, under an explicit, revocable owner basis. Leases remain finite30days and never exceed a recorded finite provider right. Missing, revoked, expired, denied or structurally changed rows are not restored; active native calls defer renewal. Other source families, E1 consumer grants, paths, budgets/counters, credentials and retention remain unchanged.

No web service or ECR schema changes are required. The existing cron opts in with `ECR_ACCESS_MONITOR_ENABLED=true` and a protected `ECR_SOURCE_MONITOR_DATABASE_URL` for `economic_calendar_development_source_monitor` in the existing Hub database. This ordinary login can execute only the two bounded metadata/maintenance functions; it cannot read provider data, submit external calls, change policy, or assume an owner. The existing central ECR login gains only the read-only expiry projection011. Provider keys remain exclusively in SourceHub.

Every tick checks SourceHub/Source admission, the own SERVICE and the parent product without Clerk or provider requests. Warning bands are14/7/3/1days; loss, renewal failure and technical unavailability are distinct. Deduplication metadata is stored under the reserved `accessMonitoring` key of the existing numerical sync job, preserved when its result changes. Successful renewal clears old incidents. Persistent failures receive a daily reminder.

The existing Render operational email channel signals a new notice through a nonzero cron exit and links to its private run log. The `ecr_access_expiry_alert` entry contains the source, permission layer, actual UTC expiry, remaining time and operator action; normal data synchronization is completed first. A paused/failed source job is also monitored. Do not treat stdout alone, provider acceptance or a mail configuration flag as delivered evidence: activation acceptance must verify a matching notification in the operator mailbox. The optional `ECR_ACCESS_MONITOR_TEST_REQUEST_ID` plus `ECR_ACCESS_MONITOR_TEST_UNTIL` allows one clearly labelled, deduplicated delivery rehearsal for at most one hour, without expiring a real right or making a provider request.

Rollback restores the retained cron artifact and disables the opt-in monitor. Revoking the owner continuity policy stops future renewals; revoking an actual source/licence/grant still denies access through the existing controls. Preserve audit and data; do not reset counters, silently replace grants, or restore the shared database.
