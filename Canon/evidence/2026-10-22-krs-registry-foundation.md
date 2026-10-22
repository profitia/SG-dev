# TASK 01 — KRS foundation: verified state and outstanding acceptance

Date: 2026-10-22. Task `ARCHITECTURE-KRS-REGISTRY-FOUNDATION-20261022`.
Status: **PARTIAL — formal first-class approval / authoritative routing acceptance outstanding**.
Producer profile ARCHITECTURE; execution local; target Development. No Stage02 application implementation or Stage03 activation.

Read together: [decision candidate](../v1.0-krs-registry-architecture-and-ownership-canon.md), [sanitized evidence](2026-10-22-krs-registry-foundation.json), [Stage02 handoff](../runbooks/krs-registry-task02-execution-handoff-v1.md).

## Authority, authorization and governance

GitHub connector and refreshed git origin/main independently resolved `1922aab9788ccd191da8a2c517cae9f48ef78ed8`, merge PR602. The previous bridge SHA was revalidated, not blindly trusted. Root AGENTS, manifest3.27.0, CORE/ARCHITECTURE documents, current adapter, topology and project/routing registries were loaded. No nested AGENTS covered the changed Canon/governance paths.

The supplied SRM wrapper is a profile selector for SRM. TASK01 explicitly requires ARCHITECTURE and forbids using SRM continuity. Its scope takes precedence over that selector and over generic Full Autopilot transition/deployment language. TASK02 does not start automatically. The approval to execute foundation work does not supply a separate first-class route acceptance record.

Isolated source checkout: `profitia-development/krs-foundation-20261022/architecture`, branch `architecture/krs-registry-foundation-20261022`, dedicated sibling `architecture-phr` clone. The dirty historical SG-dev-main and other owner checkouts were preserved. Workspaces are execution isolation, not customer identity.

Source mutation targets are the decision, this report, its JSON, Stage02 handoff and `scripts/governance/krs-registry-routing.test.mjs`. They resolve to Governance Source Layer / ALIGNED with ARCHITECTURE allowed; post-epoch deltas are separately TRANSITIONAL under policy. The initially declared registration/manifest paths were reserved as possible governance targets but are deliberately unchanged because formal capability acceptance is unresolved.

Manifest, profile, repository, code-state, task-input, routing, PMOS-runtime and require-begin gates passed before source edits. A fresh checkout initially lacked local PMOS context/integrity; canonical `pmos:context` rebuilt those from its own authority and the real gate then passed. No gate was skipped. Host conversation ID was not exposed as trusted host metadata: preflight used `--host-conversation-unavailable`, input used explicit null and PMOS derived the task identity.

PMOS registration: `cmvjdogu90000i4v0jvqvr5l3`; conversation `pmos-task-v2:560fd7d80d3d80d9cbf8474dec241b7bd8524fe37e4020afadcf639f0eb58c36`. Identity: Neon `billowing-credit-07394675`, registered solitary-unit endpoint, database `architecture_pmos`, ordinary `architecture_pmos_runtime`. PMOS and PHR are required; Memoros is disabled by this profile. This source snapshot does not fabricate the later closeout/PHR receipt; final persisted execution evidence records it separately.

## Current architecture and ownership matrix

All links below refer to the audited exact source. Source presence is distinct from deployed operation.

| Surface | Verified behavior / collision | Future owner/action |
| --- | --- | --- |
| [mgbi-general.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/mgbi-general.ts) | MGBI pl-krs-wp-record, NIP/KRS record mapping, current/full history and website/PKD projection | SRM; preserve adapter, add independent KRS port later |
| [xray-lookup.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/xray-lookup.ts) | General fetch followed by Financial; cached archives, continuity, MSR enrichment, facts and source snapshots | SRM; isolate General routing without damaging Financial/cache paths |
| [supplier-native-company.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/supplier-native-company.ts) | Closed native Request/Work/Source composition explicitly calls both MGBI adapters; persistSection requires MGBI | SRM; separate consumer adoption; not a ready KRS switch |
| [registry-search.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/registry-search.ts) | Accepted catalog short path, then CEIDG and company lookup for NIP | SRM; keep COMPANY/JDG distinction and coverage-gap behavior |
| [company-continuity.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/company-continuity.ts) | KRS_CONTINUITY_V1, bounded candidates, explicit transformation, same NIP/compatible REGON/date checks, predecessor record required | SRM; KRS evidence cannot weaken Financial eligibility |
| [shared-catalog.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/shared-catalog.ts) | NIP-oriented shared catalog with one active General JSON/hash and MGBI TTL/projections | SRM; provider snapshots/pointer design and independent General freshness later |
| [provider-source-transport.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/provider-source-transport.ts) | Explicit provider enum, origins/paths, native admission and no raw-fetch fallback; no KRS provider | SRM source composition preserved; KRS producer uses shared Source public contracts |
| [corporate-source-store.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/corporate-source-store.ts) | Existing classified corporate publication, exact source/shape and shared writer | SRM; add an accepted KRS projection later; never relabel KRS |
| [supplier-location-source.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/supplier-location-source.ts) | Reads general_json/general_sha256; constructs MGBI report identity; structured address only from matching accepted archive | SRM; lawful KRS snapshot read and source check required |
| [supplier-location-sync.ts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/src/server/supplier-location-sync.ts) | source.kind MGBI, section.provider MGBI/model pl-krs-wp-record; stable HQ key; sourceIsNewer rejects cross-family overwrite | SRM; provider-neutral source projection/version ordering and stable HQ behavior |
| [SQL013](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/apps/srm/db/private-store/013-supplier-locations.sql) | MGBI branch validates general hash/current source grant; KYS validates private metadata/retention; all other kinds denied | SRM; additive later receipt/migration; SQL013 unchanged |
| [srm-xray contracts](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/packages/srm-xray/src/contracts.ts) | SourceProvenance lacks KRS; public location types also need explicit source adoption | SRM-owned package, not Architecture write scope |
| [platform supplier-location](https://github.com/profitia/SG-dev/blob/1922aab9788ccd191da8a2c517cae9f48ef78ed8/packages/platform-contracts/src/supplier-location.mjs) / Root | Candidate16 accepts only MGBI/KYS; current knowledge.read is market/SPENDGURU | Separate ARCHITECTURE producer extension and distinct consumer acceptance |
| Maps runtime/contracts/embed | Independent map rendering/host contract; no company identity authority | Preserve current sources and deployment; no refactor for KRS |

Financial chain includes `mgbi-financial.ts`, `financial-documents.ts`, `msr-source.ts`, `msr-repository.ts`, XML/XHTML/iXBRL parsers and quality/revision/indicator rules. These are protected existing SRM surfaces. No paid probe, original financial download, schema/data mutation or claim of live full Financial regression is made by this documentation task. Their exact source tree is preserved; actual mixed-provider regression is mandatory Stage03 work.

Open PR discovery returned 12 open PRs, recorded in JSON. Most directly relevant: [PR600](https://github.com/profitia/SG-dev/pull/600), Identity lifecycle/transactional authorization, Draft at `70b4b05a870f93921529319f3a1693dd345ed0af`; [PR590](https://github.com/profitia/SG-dev/pull/590), historical Supplier Locations design, Draft; [PR588](https://github.com/profitia/SG-dev/pull/588), historical Identity proposal. They are not main/live acceptance. Main PR602 provides owner-execution packages for P1/I1/R2/K1/U1, with still-pending producer/operator decisions and no live location installation. The KRS task does not message another chat or treat those packages as authority to execute their instructions.

## Official API capability verdicts

| Capability | Verdict | Evidence / limit |
| --- | --- | --- |
| Current extract by KRS | VERIFIED | Official service, HTTP200 for P and S samples |
| Full historical extract | VERIFIED | HTTP200, versioned arrays and entry metadata; not identical to current field shape |
| Registers P/S | VERIFIED | Official page + positive samples |
| NIP/REGON fields | VERIFIED OPTIONAL | NIP present in both samples; REGON absent in S sample, KRS14 and MF9 variants observed |
| Historical identifiers/names | VERIFIED SHAPE | Full P extract has introduction/deletion entry references; universal form/transition semantics not proven |
| Status/dissolution | PARTIAL / NOT CONFIRMED UNIVERSALLY | Raw status and section6 evidence available; no deregistered sample, code dictionary not established |
| Daily/hourly change lists | VERIFIED | Arrays; duplicate and unpadded KRS strings; date >2021-12-08 per page |
| No credentials for reviewed services | VERIFIED | Official PRS labels no login, real uncredentialed calls |
| Name/NIP/REGON search in documented Open API | VERIFIED UNSUPPORTED IN DOCUMENTED SURFACE | Four published operations provide no such query; does not assert no internal Ministry endpoint exists |
| Supported external integration for interactive search | NOT CONFIRMED | Official UI availability does not authorize its undocumented backend |
| Complete free national catalog/bulk export | NOT CONFIRMED | No supported baseline established; bulletin is a delta list |
| Numeric rate limits, SLA, finality/retention window | NOT CONFIRMED | Not specified in reviewed page; no load test attempted |
| General caching/reuse and redistribution policy at intended scale | REQUIRES PROVIDER OR LEGAL CONFIRMATION | Official public API and cited laws verified, unrestricted retention/personal republication not inferred |
| Financial documents/normalized Financial replacement | OUT OF SCOPE / NOT ESTABLISHED | Open extracts do not replace the accepted MGBI Financial chain |

Primary sources: [Open API services](https://prs.ms.gov.pl/krs/openApi), [PRS overview and anonymization](https://prs.ms.gov.pl/krs), [official extract meanings](https://www.gov.pl/web/sprawiedliwosc/uzyskiwanie-informacji-z-krs). No third-party endpoint example is treated as support evidence.

Reproducible probes use ordinary TLS-verified GET, no credentials, redirects disabled by curl default, 20s timeout and 4MiB bound. JSON contains URLs, timestamps, response sizes/digests and allowlisted corporate projections; raw personal/financial payloads are not committed. Initial Python TLS trust-store errors were resolved using the system trust store, without disabling certificate checks. Six recorded requests plus one successful diagnostic current extract produced six HTTP200 and one HTTP400; no retries on provider cost or mass enumeration.

| Recorded probe | Result |
| --- | --- |
| current P, public ORLEN KRS0000028860 | 200, 63,344 bytes, last official entry222 |
| full P, same KRS | 200, 435,387 bytes; history arrays with entry validity |
| current S, public WOŚP KRS0000030897 | 200, 18,082 bytes; raw stanPozycji3 and no REGON in identifier object |
| all-zero invalid KRS | 400,163 bytes; not proof of a valid absent company |
| daily2026-10-21 | 200,4,668 values /2,962 unique, observed length4–7 digits |
| hourly2026-10-21,10→11 | 200,466 values /324 unique, observed length4–7 digits |

The runtime must validate/pad and deduplicate bulletin identifiers. Extract-generated timestamps change raw hashes without a business-data change, so rawDigest and content/source/address versions are separate. Do not infer instantaneous freshness from a retrieval timestamp.

## Identifier and catalog feasibility

[MF's official API](https://wl-api.mf.gov.pl/) documents NIP lookup and an optional KRS field. One uncredentialed GET for the public ORLEN NIP7740001454 returned KRS0000028860 and REGON610188201, verified against KRS. This proves a possible mapper for that record, not universal coverage. [Official MF limits](https://www.podatki.gov.pl/vat/bezpieczna-transakcja/wykaz-podatnikow-vat/q-a-wykaz-podatnikow-vat/?altTemplate=ArticlePdf&download=True) describe100 search requests/day for up to30 subjects per call and shared-IP blocking implications; final runtime policy must revalidate current limits and reserve finite budget. This task used one lookup and made no VAT/business decision.

[GUS BIR1](https://api.stat.gov.pl/Home/RegonApi?lang=pl) documents free identifier search with required production registration/key. No credential was sought and no authenticated GUS probe occurred. Report field-to-KRS coverage and terms remain a dependency. Neither MF nor GUS is an assumed complete bulk name index.

The accepted design candidate therefore uses known approved public KRS records plus lawful bounded deltas, explicit PROGRESSIVE coverage and a deterministic missing/ambiguous identifier result. It cannot promise immediate national autocomplete coverage. The ADR specifies schema, indexing, normalization, transactional pointers, checkpoint/backlog/late-correction recovery and disabled-by-default synchronization. Any complete-catalog claim needs a separately verified dataset baseline and lawful import approval.

## Infrastructure readback and no-activation boundary

The only accessible Render workspace matched the registered Profitia workspace `tea-d7lps8rbc2fs73cn80dg`. Service inventory had no KRS service. Read-only deployment observations:

| Service | Latest observed LIVE deployment / source | Auto-deploy |
| --- | --- | --- |
| SRM Development srv-db1vu6gm7kps73d0e3r0 | dep-dbbnb22fngtc73bn0i90 /260ade12608faaea27376c1c976db392f046f267 | off |
| Maps srv-dbat5ulg1s2s73defcp0 | dep-dbati9rrjlhs73akpsj0 /db2df0a6cccb994ea4654ae0eb5b3af4b46867ff | off |
| Identity Development srv-dbcse6jrjlhs73eib3sg | dep-dbcse73rjlhs73eib57g /aa95c0a0a14fb2f2ba5af7338c8d83a6fb349269 | off |
| Architecture PMOS srv-db78d82j9qps73bej0c0 | dep-db79knaj9qps73bjddeg /e03454fdf484c51a251bf3c736d82769821af117 | off |

Identity's live health-only release predates this task; PR600 source is not that release. No restart, deploy, configuration update, one-off provider job, credential read or cloud provisioning occurred here. Live mode/grant/private data rows were not queried, so do not present a universal independent proof of all live E1 configuration.

Neon describe-project verified Architecture PMOS PostgreSQL17 and platform-private PostgreSQL16, both Frankfurt. Table-name metadata for `spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private` listed105 tables, no KRS catalog and no SRM location tables. Presence/absence of names is not installation-receipt or privilege proof. Private rows, grants, policies, SQL019 receipt and migration ledger contents were deliberately not read with an administrative connector. No product SQL was written. Only canonical ARCHITECTURE PMOS registration/closeout may write its separate continuity DB.

Workflow inspection: these Canon/governance-test changes trigger Governance CI (validation, PMOS types/lifecycle tests and static gates), with no deploy. Active routing-registry changes would additionally trigger Platform integration and its controlled SG2 validation policy, which is a known concern in concurrent PR600; no policy bypass is authorized. This candidate leaves that registry unchanged. Render SG2 PMOS autodeploy matches apps/pmos, project registry or render.yaml, none changed; Vector and PCOS automatic services have unrelated root/filter paths. Existing product runtimes remain manual. Recheck all filters and workflow_run/dispatch dependencies before any future merge.

## Acceptance and continuation

Formal owner acceptance and main routing remain outstanding. Candidate routing tests exercise a disposable proposed registry, including negative owner boundaries and sibling/traversal rejection; they do not activate those routes. Existing governance/manifest/workspace tests and appropriate PMOS validation run separately. Exact test totals, source commit, PR, remote file parity, final provider metadata comparison and canonical continuity receipts are stored in final execution evidence after they actually occur.

No new KRS runtime, application source, cloud schema/role, synchronization, MGBI request or provider switch was created. Stage01 does not establish actual mixed-provider behavior or savings. The implementation-ready handoff is conditional on formal onboarding and the exact E1 producer acceptance specified in the ADR. A passing document/test/PHR bundle cannot close those gates.

## Local verification completed before publication

Governance/workspace/bridge and eight proposed-routing tests:34/34 PASS,0failed/skipped. Existing focused PMOS registration/profile/PHR suites:32/32 PASS,0failed/skipped; both PMOS typechecks PASS; manifest PASS. The first tsx CLI launch hit sandbox IPC EPERM before tests; the same unmodified suites passed using Node with the tsx import loader. No gate or assertion was weakened.

Disposable PostgreSQL16.14 held100,003 synthetic name rows, Unix socket only,0cloud connections. The planner used names_prefix for prefix lookup and names_fragment GIN for fragment lookup without forced index settings. Measured EXPLAIN execution0.078ms/0.074ms;20warm samples including separate psql startup had p9511.816ms/11.379ms. Aliases deduplicated to the expected KRS set. The ordinary read role could SELECT but INSERT and schema DDL were denied. Cluster was stopped and its own disposable directory removed. This proves the small search-index approach on this machine, not full E1/schema/runtime acceptance, application normalization or national-dataset performance.
