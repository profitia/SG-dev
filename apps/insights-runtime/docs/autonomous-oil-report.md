# Autonomous Oil report — Development candidate

Owner: Insights Domain. Contract: `procurement-insights.report/1.0`. Canon v0.5 unchanged.

**IMPLEMENTATION PARTIAL / NOT DEPLOYED.** This change provides the domain runner,
Postgres jobs/archive, scheduler, Fetch API handler, Hub consumer, canonical read
ports, Source-backed Composer, pinned PDF renderer and offline acceptance tests.
The follow-up adds a concrete SG Runtime host and a separate Architecture E1
producer candidate. Neither source presence nor local tests constitute shared
admission, installation or LIVE proof. Permissive authority substitutes are forbidden.

## One execution path

API and scheduler both call `runner.start`. Business uniqueness is organisation +
definition + Tuesday–Monday period + explicit revision. Different request bytes,
asOf or trigger do not purchase another generation. Profile changes require an
explicit revision. Forced SQL RLS, composite tenant foreign key and fenced leases
protect jobs and artifacts. Every acquisition/count/generation is journalled before
I/O and settled before the next stage. Ambiguous cost remains reserved and stops
at RECONCILIATION_REQUIRED. There is no paid retry, fallback or automatic revision
increment. Rendering can resume from the stored original model output.

`sql/001-report-editions.sql` is an **unapplied** candidate for a private Insights
schema in the existing product database. No roles or permissions are created.
Installer must grant the separately admitted non-owner NOBYPASSRLS runtime role:
schema USAGE, jobs SELECT/INSERT/UPDATE, artifacts SELECT/INSERT. PDF, Markdown and
appendix bytes/hashes finalize atomically with the edition. Product storage does
not use PMOS/PHR/Newsfeed/Forecast tables. Backup and exact installer admission are
required before applying to Development; no cloud migration was performed here.

## Four API operations (mounted source candidate; not deployed)

| Method/path | Current proposed operation | Result |
|---|---|---|
| POST `/api/v1/insights/report-jobs` | `insights.report.start` | 202 and new/existing job, Location |
| GET `/api/v1/insights/report-jobs/{jobId}` | `insights.report.status` | stages, coverage, asOf, artifact state |
| GET `/api/v1/insights/report-editions` | `insights.report.list` | latest 50 internal editions |
| GET `/api/v1/insights/report-editions/{editionId}/pdf` | `insights.report.download` | private PDF, hash, Human Review status |

Start body contains definitionId, profileVersion, period {fromDate,throughDate},
revision, asOf and allowPartial. No caller organisation, user, price policy,
provider URL or credential is accepted. The host must invoke every callback with
current E1 server authority; downloads reauthorize. The separate Architecture candidate defines these four operations, their normative
matrix rows and opt-in authority/receiver/SERVICE modes. Required consumer adoption
and exact-SHA controlled CI still precede shared activation. A test authority is
not an adoption proof.

## Scheduler and hosting

Configuration is `config/development.example.json`, **inactive**, with no secrets.
weekday (0=Sunday), localTime, Europe/Warsaw and catchup are configurable. The
last completed Tuesday–Monday period is selected at the scheduled instant.
Spring gaps use the first valid minute, autumn overlaps use the first occurrence.
LATEST_ONLY catches up the newest missed slot; SKIP respects graceMinutes. The
controlled trigger and API use the same job key and runner. Disabling/re-enabling
does not erase history. Workers consume only currently delegated organisations.

`src/host.mjs` builds ordinary pools, current HUMAN/real SQL SERVICE boundaries,
Hub and native Source hosts. The SG route is
`apps/sg-runtime/app/api/v1/insights/[...report]/route.ts`; its host assembly is
`apps/sg-runtime/lib/insights/autonomous-runtime.ts`. It uses the already accepted
canonical SG read ports behind the existing SERVICE read host.
`apps/sg-runtime/scripts/start-with-insights.mjs` supervises Next and one worker,
with graceful shutdown and bounded restart backoff. The worker imports the same
SG host, without a configurable operator module, local experiment path or IPC.
No new Render service is used. Default `INSIGHTS_REPORTS_ENABLED` is off.

Configuration and five ordinary credential URLs are server-owned. Existing key
material remains in approved environment bindings, never in this document.
`INSIGHTS_OPENAI_API_KEY` is a separate binding of the approved existing key;
its fingerprint/project admission is verified without replacing global OPENAI_API_KEY
or OPENAI_MODEL. No key is created.
Private jobs/receiver use existing `platform_private` on the SG private E1 branch;
only Source Composer/counter use the existing Market Data/Source database.
`sql/002-runtime-binding.sql` additionally fences the actual login, organisation,
expiry/revocation and signed receiver scope; setting a tenant GUC alone grants nothing.
HUMAN start uses the very same SQL transaction as E1's final current observation.

For one admitted acceptance only, `INSIGHTS_CONTROLLED_SCHEDULE_ONCE=true` invokes
the scheduler with an owner-installed `definition.controlledEdition` (period,
revision, allowPartial). It uses actual asOf and the same edition key as API; restart
or a simultaneous API trigger cannot buy another generation. The ordinary recurring
schedule remains disabled. Remove the temporary trigger after acceptance.

The native installed Insights package retains its own module URLs/fonts. SG's build
bootstraps pinned renderer requirements into `.insights-python`; no operator Python
or private machine font is required. Sentry reuses the existing SG configuration in
both web and worker processes.

## Data, costs and rendering

Eleven period-derived queries reuse existing Hub contracts. TE Calendar and all
TE external forecasts are excluded. Six EIA selectors come from verified prior
metadata, not reused observations; returned dimensions/units/consecutive periods
are checked. Hub is the only provider transport. Licence projection decisions
are required before persisting facts/metadata; raw/native payloads and full
articles are discarded. Source costs remain UNKNOWN in provider telemetry;
zero OpenAI cost for retrieval is not a claim of zero provider cost.

Canonical Market Data/Forecast reads need current SERVICE authority. Missing or
historical D7 is not a current forecast. No fitting/ingestion/Forecast maths occurs.
Latest TE quotes are selected separately from retained history; a historical weekly
comparison is never relabelled as the change in a newer snapshot. The bounded
versioned Composer projection preserves exact selected facts and IDs while the
full licensed bundle/history remains in the private job and annex.
The report seals actual knowledge asOf after acquisition, preserving the original
trigger cutoff separately. Future observations/publications are excluded. Chinese
Bitumen is not a Polish purchase price; incomparable prices are not combined.

Composer uses admitted Source hosts, Responses strict structured JSON, store:false,
one exact counted body, current pricing expiry/source and conservative uncached
input/output ceilings. Reasoning is within output. Unknown counter billing retains
its reservation. The example 5 USD is a **candidate limit, not task authorization**.
The old pilot SERVICE/grants/budgets are not restored. No new paid calls occurred.

The original four-page ReportLab template and eight narrative sections are reused;
pilot-specific dates become source dates. Fonts, original licence and hashes are
vendored; Python dependencies are pinned. Rendering is bounded, temporary files
are removed and A4/page count/hash are checked. Quality Gate validates references,
lineage and numerical restrictions, then keeps AWAITING_REVIEW. No automatic client
publication or editorial model retry is added. Overflow fails rather than shrinking
text or silently spending on another draft.

Host Sentry callbacks receive only stage/job/technical metadata. Monitoring failures
never repeat or block a business effect. UTC and monotonic stage durations, request,
cache and record counts, receipts, model tokens/cost persist with the job. Sentry
LIVE delivery awaits actual host integration; this PR only tests the callback path.

## Validation and remaining boundary

Run `npm ci --install-links --ignore-scripts`, `npm test`, `npm run build`.
Postgres acceptance uses INSIGHTS_TEST_DATABASE_URL to an ordinary isolated role.
INSIGHTS_TEST_RENDER=true adds actual PDF and API download. Optional immutable
historical pilot replay is local-only; licensed frozen inputs are not committed.
CI uses an ephemeral test database, no provider/model credentials or deployment.

Remaining: Architecture/Identity and dependent-consumer adoption of the four report operations;
required controlled CI and full SG build; exact database/SERVICE/Source installation
and admitted pricing; controlled release and separately authorized LIVE budget/run.
The task mandate does not grant those permissions. Do not mark the full backend
IMPLEMENTATION_READY or LIVE_E2E_VERIFIED until these missing pieces are implemented,
admitted and independently verified. No Development resource was changed.
