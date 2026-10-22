# TASK 02 — KRS Registry Runtime & Local Catalog

Status: **G1_GRANTED / MAIN_ROUTING_ACCEPTANCE_REQUIRED / DO NOT START AUTOMATICALLY**.
Target: **BUILD COMPLETE / ACTIVATION DEFERRED**.
Producer profile: ARCHITECTURE, approved owner Architecture Platform, Development.
Prepared by TASK01 `ARCHITECTURE-KRS-REGISTRY-FOUNDATION-20261022`,2026-10-22.

This is a future execution specification, not a new task authorization. Read [the G1 decision](../v1.0-krs-registry-architecture-and-ownership-canon.md), [onboarding evidence](../evidence/2026-10-22-krs-registry-g1-onboarding.md) and [historical foundation evidence](../evidence/2026-10-22-krs-registry-foundation.md), then revalidate current main, contracts, provider state and concurrent P1/I1/Maps work. Do not copy a historical baseline or narrated approval into authority.

## Entry gates

1. G1 owner approval is granted. Verify that its reviewed routing/onboarding/manifest and passing required CI are accepted on authoritative main: KRS Registry, Architecture Platform, ARCHITECTURE, ALIGNED and the exact three runtime/package/CI routes. A branch registration or PR alone does not satisfy this gate. Preserve the actual G1 provenance; do not request the same owner decision again or invent a host conversation ID.
2. Receive a separate human TASK02 instruction. Stage01 Full Autopilot does not grant it.
3. Load root/nested AGENTS, current manifest ordered CORE/ARCHITECTURE/adapter and exact routing. Use isolated source/dependencies/context/PHR and fresh main. Full preflight→own canonical PMOS begin→require-begin; target Development and record the actual executor/host identity or explicit unavailable state.
4. Resolve E1 protected registry-read/search, publication/admission and KRS-backed location producer dependency. Stage02 may complete offline buildable adapters with injected accepted contracts and fail-closed unconfigured real binding, but must label that limitation and cannot claim live E1 readiness. If acceptance requires working end-to-end real E1 integration, close the separate producer dependency first. Do not modify platform-contracts under a KRS-only app task.

## Exact intended implementation boundary

Only after authoritative main registration and a separate TASK02 instruction:

- `apps/krs-registry-runtime/**`: Node package/lockfile, API entry point, canonical client, identity/normalization/catalog/search/sync modules, migrations as source, fixture tests and release documentation.
- `packages/krs-registry-contracts/**`: minimal validated versioned registry snapshot, candidate, identity and port contracts; no networking/identity policy.
- `.github/workflows/krs-registry-ci.yml`: independent offline source validation, local PostgreSQL and artifact proof; no cloud side effects.
- Any additional Canon or shared producer path requires its own exact routing/preflight declaration and authorized owner scope. Do not add root workspaces/dependencies or render.yaml by convenience.

Contracts remain independent of React/Next. No app-private imports from SRM, Maps or Identity, and no relocation/copy of MGBI. In particular do not edit SRM's `supplier-location-source.ts`, `supplier-location-sync.ts`, SQL013, `shared-catalog.ts`, `company-continuity.ts`, native lookup, financial adapters or srm-xray under this producer task. Consumer adoption remains Stage03.

## Implementation scope and acceptance

| Area | Required implementation and verification |
| --- | --- |
| Official client | Four documented GET operations, closed canonical KRS/register/day/hour parser, fixed official origin, JSON/size/time bounds, actual Source transport port, no redirects/alternate origin/credentials from input |
| Transport | Reuse platform Source/external-call/native HTTPS credentialMode NONE and existing admission/settlement; unknown or absent binding DENY; fixture loopback isolated from cloud configuration |
| Normalization | Separate current/full schemas; scalar/object/array legal-form variants; entry validity; optional NIP/REGON; explicit redaction/partial/status UNKNOWN; invalid date/identifier rejection |
| Provenance | Separate rawDigest/contentDigest/sourceVersion/addressVersion; stable facts despite changing extract-generation/retrieval clocks; immutable provider identity; no MGBI relabeling |
| Identity | Explicit KRS first, accepted exact mapping, optional separately admitted MF mapper; unknown/ambiguous/conflicting NIP; no name-based merge; P/S identity agreement; historical incarnations and continuity evidence. Before any MGBI Financial acceptance require verified KRS/NIP reconciliation against company/document identity; unresolved evidence or mismatch denies new attribution |
| Catalog | ADR's companies/snapshots/identifiers/names/checkpoints/items; local migrations with exact source digests, restrictive roles, transactional pointer+aliases, bounded JSON, nonunique NIP history |
| Name search | Polish Ł/diacritic/Unicode normalization, legal-form alternative tokens, prefix>=1/fragment>=3 policy, escaped parameterized patterns, stable dedup/rank/KRS ties, bounded results/cursor and explicit coverage/freshness |
| Synchronization | Explicit CLI runner and disabled startup/schedule; bulletin padding/dedup; P/S resolution; durable finite queue/checkpoint/lease/CAS; crash/replay/late correction/missed day/uncertain outcome recovery; no range enumeration |
| API | Versioned protected reads/search/resolve with actual E1 resource policies when accepted; no anonymous catalog exposure, no caller-supplied org/user authority; only minimal health is anonymous |
| Diagnostics | Nonsecret source latency/errors/uncertainty/budget, coverage/lag/checkpoints/content/address changes; no personal representation, query/requester or private interest payload in shared output |
| Build/release | Clean lockfile build, deployment commands derived from actual source, reproducible source/artifact/config/SQL digests; no deployment or database/cloud installation |

The MF mapping example only proves that one NIP resolved. Its production integration/limits/access policy must be accepted separately; GUS requires registration/key and report-field validation and is not a mandatory dependency for a progressive source-only runtime. No credential request, provider contact or legal agreement acceptance is authorized by this handoff.

Catalog starts PROGRESSIVE. Bootstrap import is disabled and accepts only a separately approved public KRS seed manifest or approved bulletin windows. Do not automatically export customer suppliers, SRM raw MGBI archives or organisational interest lists. A zero match is NOT_IN_CATALOG, not proof of nonexistent company. A complete catalog is a separate accepted data-source/coverage project if later required.

## Required test matrix

Use synthetic fixtures and disposable local/CI PostgreSQL, ordinary roles and explicit loopback origins. No live provider calls in normal CI.

1. Contract/type/runtime validation; unknown authority fields, illegal size/date/KRS/NIP/REGON, scalar vs full-array structures, all documented legal-form fixture families plus unknown form partial behavior.
2. Current/full identity conflict, optional/redacted fields, status3 UNKNOWN policy, liquidation/removal evidence, malformed/empty404/unavailable429/5xx/invalidJSON/timeouts/oversize. Never fabricate missing financial values or classify missing data as deregistration.
3. Volatile retrieval/generation clocks leave content/source/address versions stable; correction under same entry changes content/source but retains prior evidence; same business address under another provider preserves addressVersion.
4. MF optional KRS/coverage gap, no configured mapper, multiple/historical candidate mappings, successor/predecessor missing record, mismatched REGON9/14, exact matching and refusal to coalesce by name or select first result.
5. Prefix and fragment explain plans on >=100k synthetic names, common-prefix/alias dedup, Łódź/Lodz, Unicode/quotes/SQL metacharacters, wildcard literals, deterministic pagination, inactive/historical matches, no external network per keystroke. Measure target p95 with hardware/concurrency, not blanket national-scale claims.
6. Same bulletin duplicate/unpadded IDs; unsupported or ambiguous P/S; day cutoff in Europe/Warsaw/DST; hourly inclusivity remains explicit; empty vs404; out-of-order/late/corrected bulletin; finite budget/backlog and durable failed items.
7. Crash before/after catalog commit and before checkpoint, lease expiry/two runners, same intent changed payload, uncertain Source result with no raw retry, failed audit rollback; replay resolves to existing E1 receipt and one snapshot.
8. Ordinary read/ingest/migrator separation, no runtime DDL/BYPASSRLS/owner connection, cross-environment refusal, authenticated orgA/orgB reads for shared company plus private-query isolation, revoked identity/membership/product/operation/service-source grant denies, audit failure denies, pool context isolation.
9. Existing SG2/SRM acceptance fixtures remain unchanged. If a separate shared producer changes, require its full exact-source compatibility and local PostgreSQL/security suites plus distinct consumer receipts. KRS-only fixtures are not proof of SRM adoption.
10. Disabled flags deny external calls/sync/consumer effects; API startup schedules nothing. Network spies demonstrate zero MGBI, Google and cloud database calls. CI workflow has no deployment/migration/secret-bearing job.

## Infrastructure and deferred activation

Prepare source-level resource specifications only. Proposed one API service plus a bounded CLI invocation, no active cron/worker. Root build context must include the application, KRS contracts and approved platform contracts. No Render service creation, deployment, restart, env/domain/secret changes or cost commitment. No Neon project/branch/database/schema/role/extension or shared product migration. No installation of E1 operations/grants/provider binding. No SRM/MGBI switch and no changes to Maps, Financial, Staging or Production.

Runtime config defaults: external calls OFF, sync OFF, consumer integration OFF. Do not use a disabled app flag as substitute for missing E1 admission; both gates apply. Proposed physical public-catalog storage is undecided and requires owner approval after source/build and controlled storage/receipt topology review. PMOS is never catalog storage; Architecture labs remain synthetic.

Stage02 source acceptance requires reviewed exact routes, source contracts/build/tests, role/SQL local evidence, provenance/identity fixtures, disabled behavior, remote source/CI and canonical own PMOS/PHR readback. Report independently: source complete, deployable, E1 producer readiness, consumer adoption, legal/source coverage and operational activation. A fully working mock adapter does not establish real E1 or provider deployment.

## Stage03 handoff and activation blockers

Keep **KRS BUILD COMPLETE — ACTIVATION DEFERRED** until Maps/Supplier Locations relevant contracts are accepted and actual Development source projection/persistence verified. Source-only merge does not satisfy this.

Stage03 needs a separate SRM task to adopt provider types/port, split General from Financial, introduce name UX and identifier verification, extend admitted corporate/source projections, implement additive source-version persistence/SQL and preserve HQ/manual/KYS identity. A separate ARCHITECTURE producer supplies any registry resource and KRS location-source extension; SRM cannot fake it locally. Current SQL013 and candidate16 are not KRS-compatible.

Require the ADR's ten Maps scenarios, current ordinary-role E1 acceptance, no hidden paid fallback, unchanged Financial XML/XHTML/iXBRL/period/history/scanner outputs, actual MGBI→KRS→MGBI persistence test, and LKG/backup/recovery with retained artifact and compatible schema/config. Operator installation/grants/service creation and deployment have their own explicit approval window. Production remains excluded.

## Final return from TASK02

Return source/branch/PR/exact SHA/digests and actual CI, local PostgreSQL/security/performance results, E1 dependency/adoption receipts or precise unresolved gate, catalog coverage and mapper limitations, no-activation evidence and own canonical PMOS/PHR receipt. Explicitly assert only what was checked:

```text
SOURCE_COMPLETE = YES/NO
BUILD_TESTED = YES/NO
DEPLOYABLE = YES/CONDITIONAL/NO
KRS_DEPLOYMENT = NOT_STARTED
KRS_ACTIVATION = DISABLED
SYNCHRONIZATION = DISABLED
SRM_PROVIDER_SWITCH = NOT_PERFORMED
PRODUCT_DATABASE_MUTATION_BY_TASK = NO
MGBI_FINANCIAL_SOURCE_CHANGED = NO
MAPS_SOURCE_OR_RUNTIME_CHANGED_BY_TASK = NO
E1_PRODUCER_ACCEPTANCE = actual receipt or unresolved
STAGE03_ACTIVATION_READY = NO until its independent gates close
```

Stop after the Stage02 source handoff. Do not execute Stage03, provision or activate from this document.
