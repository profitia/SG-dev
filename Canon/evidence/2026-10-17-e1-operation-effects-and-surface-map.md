# E0/E1 — actual operation effects and integration surface map

Task `ARCHITECTURE-E1-EFFECTS-AND-SURFACE-MAP-20261017`, ARCHITECTURE / Development.
Source authority `profitia/SG-dev/main`, observed source
`cf2677e042d654dc223ef043401327fe064ab4fc`.
Status: **DATED_SOURCE_EFFECT_MAP_NOT_RUNTIME_ACCEPTANCE**.

## Scope and evidence

The [effect registry](../registries/e0-e1-operation-effects-v1.json) adds a complete
method/path census of the existing bounded App Router scope: 81 route files,
87 HTTP method entries and 12 additional surfaces. Sixteen effect families have
referenced source paths and SHA256 digests. This is a census and selected family
call-chain review, not an assertion that every line, dynamically configured
adapter or third-party endpoint was audited. Each association and its depth are
explicit. Mapping an operation grants no permission or provider budget.

The [original inventory](../registries/e0-e1-protected-surface-inventory-v1.json)
retains its historical rows, digests and source observations. Only an explicit
current-source observation is appended; old source and provider facts are not
silently updated. No live service, secret, database row, upstream API or paid
provider request was inspected by this unit. Its source facts do not change or
independently reverify an earlier cloud preparation or release.

## Effects which must survive integration

| Surface | Confirmed source behavior | Boundary for subsequent adoption |
| --- | --- | --- |
| Benchmark history/preview | Stored hit can return locally; miss/partial history can fetch Macrobond and upsert shared series, observations and hydration state | Preserve hit/miss results; a user read grant does not itself authorize global writes or unbounded vendor use |
| Discovery and AI search | External metadata/search; AI interpretation and optional reranking call OpenAI | Provider usage and intent/outcome are effects; private SQL rollback cannot undo a network request |
| Public forecast current/verification | Default public resolvers read prepared artifacts and emit diagnostics | Preserve separation of preparation and serving; fingerprint headers are selectors, never identity |
| Internal forecast, CLI and workers | Service bearer, preparation, queue/ledger and shared artifacts | Real service identity and current user delegation, revocation and idempotency are not proved by a bearer or queue key |
| Dashboard | Demo-dependent middleware, upstream bridge and optional caller organisation/pipeline filters on DR rows; process cache | A query filter is not membership. Organisation-bearing DR records require ownership/provenance review; they are not automatically universal market knowledge |
| Cognition categories/cost/aggregation | Singleton getter throws unless configured; no production setter callsite found in tracked application sources | Preserve the existing availability boundary. Do not fabricate an implemented feature or build an unrelated CIC runtime |
| Supplier lookup/search | Branches can call registry/X-Ray vendors, change shared catalogue or private selection/provenance | Search is not always a pure local read; preserve universal corporate fields separately from requester, private assignments and cost |
| Supplier report | Existing POST restores/project private documents and appends frames; named preference scope | Conditional source adoption is real, but it is not a pure read, full SRM adoption or live release |
| KYS and PESEL | Legacy shared KYS can contain PII; reveal token binds snapshot/list/index/expiry, with existing organisation checks | Token alone is not a current named-user capability. New private store intentionally closes unadopted KYS rows; no automatic OWNER wildcard or universal PII |
| XLSX/PDF/KRS/files | Existing saved-source branches, file preparation and possible upstream restoration | Review each branch; authorise source access and release under current scope, including retention and short-lived references |
| Supplier website | Cached, pending/lease and new external discovery branches with saved derived identity | Keep private subject/request scope and idempotency; only reviewed corporate projection can be shared |
| Supplier Intelligence UI/model | Scoped financial preferences; summary rules import runtime code from a client TSX module | A TypeScript filename does not prove a React-neutral core. Actual business reuse and separate React18/19 host compatibility remain required |

Two concrete alternate-entry findings affect the next receiver tasks:

- SG Runtime `/api/benchmark/analytics-series` has no route auth wrapper and its
  root middleware excludes API routes. Its service can perform read-through
  fetch/persistence. New selection protection does not protect this endpoint.
- Dashboard middleware does not inspect the new provider discriminator. SG Runtime
  adoption therefore does not make dashboard private data or its bridge safe.

These are source findings; this unit sent no live request to exploit them.
`organisationId`/`pipelineId` cache and query filters do not establish ownership.
No DR customer data was read and runtime availability was not asserted.

The external KYS service/repository has a separately recorded authority boundary.
Protection of the SRM proxy does not constitute acceptance of direct upstream
access. No mutation, profile borrowing or access expansion is authorised here.

## Prior receiver evidence referenced without copying histories

| Project / task | PR | Source SHA |
| --- | --- | --- |
| SG2 / SG2-E1-PRIVATE-SELECTION-ENTRY-20261017 | [423](https://github.com/profitia/SG-dev/pull/423) | e99b3b9d49ddeed4fb3474590300dc68fed24506 |
| SRM / SRM-E1-PRIVATE-REPORT-ENTRY-20261017 | [427](https://github.com/profitia/SG-dev/pull/427) | c626405c81821ba1e738f7a318d912132f4d43ea |
| SRM / SRM-E1-PRIVATE-BUSINESS-INITIALIZATION-20261017 | [426](https://github.com/profitia/SG-dev/pull/426) | bdea22e4b89cc4c6e3c34025605f507eab3aba51 |

The separately dated preparation records 43 controlled FORCE RLS tables and
both private applications disabled. That state was not read again here.
Common candidate 1.6.0 implements 14 operations; it does not implement current
service delegation, paid refresh or exports. No new grant is inferred from this
map. The existing backend trust boundary remains unchanged.

## Validation and acceptance boundary

Validation checks exact route/method census against tracked current sources,
unique entries, every referenced SHA256, valid family/data-class references,
current routing, unchanged historical inventory fields and required manifest.
No new implementation-mirroring test suite is needed for these documents.
Full own-profile preflight/begin and clean publication preflight apply; PMOS and
PHR closeout publish this dated baseline in ARCHITECTURE only, MEMOROS disabled.
Foreign task references contain project/task/repository/PR/source SHA, not foreign
relational identifiers or copied records.

E0/E1 remains **IN_PROGRESS**. Remaining accepted work includes receiver coverage
of these effects/entrances, current background delegation, cache/files, actual
named browser session, Supplier Intelligence reuse, meaningful regression and
controlled Development then Staging releases. Scope01–11 remains accepted;
Production and E2–E4 are not started by this baseline. There is no code, database,
role, provider configuration, secret, application activation or deployment change.
