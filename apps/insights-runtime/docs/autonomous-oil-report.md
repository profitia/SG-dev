# Autonomous Oil report — Development candidate

Owner: Insights Domain. Contract: `procurement-insights.report/1.0`. Canon v0.5 unchanged.

**IMPLEMENTATION PARTIAL / NOT DEPLOYED.** This change provides the domain runner,
Postgres jobs/archive, scheduler, Fetch API handler, Hub consumer, canonical read
ports, Source-backed Composer, pinned PDF renderer and offline acceptance tests.
It does not provide an admitted E1 report-operation producer/receiver or a concrete
SG Runtime host assembly. These must not be replaced with a permissive test adapter.

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

## Four API operations (handler contract, not yet mounted in SG Runtime)

| Method/path | Current proposed operation | Result |
|---|---|---|
| POST `/api/v1/insights/report-jobs` | `insights.report.start` | 202 and new/existing job, Location |
| GET `/api/v1/insights/report-jobs/{jobId}` | `insights.report.status` | stages, coverage, asOf, artifact state |
| GET `/api/v1/insights/report-editions` | `insights.report.list` | latest 50 internal editions |
| GET `/api/v1/insights/report-editions/{editionId}/pdf` | `insights.report.download` | private PDF, hash, Human Review status |

Start body contains definitionId, profileVersion, period {fromDate,throughDate},
revision, asOf and allowPartial. No caller organisation, user, price policy,
provider URL or credential is accepted. The host must invoke every callback with
current E1 server authority; downloads reauthorize. The accepted shared SDK has
**none of these four operations**, and its current E1 host supports personal and
calendar modes only. A test-injected authority is not an adoption proof.

## Scheduler and hosting

Configuration is `config/development.example.json`, **inactive**, with no secrets.
weekday (0=Sunday), localTime, Europe/Warsaw and catchup are configurable. The
last completed Tuesday–Monday period is selected at the scheduled instant.
Spring gaps use the first valid minute, autumn overlaps use the first occurrence.
LATEST_ONLY catches up the newest missed slot; SKIP respects graceMinutes. The
controlled trigger and API use the same job key and runner. Disabling/re-enabling
does not erase history. Workers consume only currently delegated organisations.

`createInsightsRuntime` assembles admitted host adapters; its `api` is mountable
by the existing SG Runtime and `serveWorker` needs a supervised host process.
`worker.mjs` loads server-owned deployed code, not an experiment directory or IPC.
**The concrete host module, SG route mounting and startup integration remain
unimplemented pending E1 producer adoption.** No new Render service is assumed.

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

Remaining: Architecture/Identity owner's adoption of four report operations;
concrete SG Runtime assembly/mount/startup; exact database/SERVICE/Source installation
and admitted pricing; controlled release and separately authorized LIVE budget/run.
The task mandate does not grant those permissions. Do not mark the full backend
IMPLEMENTATION_READY or LIVE_E2E_VERIFIED until these missing pieces are implemented,
admitted and independently verified. No Development resource was changed.
