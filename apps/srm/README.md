# SRM Development runtime

KYS reports use a classified, shared cache in `srm_app`. A complete normalized report is reused for the same NIP and entity type across organizations until its retrieval time plus the configured TTL. Each request still writes an organization-scoped lookup, attempt (`PROVIDER` or `CACHE`) and snapshot; the browser receives masked PESEL values through the existing reveal flow.

`SRM_KYS_CACHE_TTL_HOURS` defaults to `168` (seven days). Set a whole number from `1` to `168` in the SRM Development Render runtime environment to shorten the period without a code release. Invalid values fail closed. A lower value immediately makes older entries ineligible. Expired entries are removed on subsequent KYS requests. This variable is not a browser secret.

Migration `0010_kys_shared_cache.sql` creates the shared table and retrieval-method audit column. Run the Development migration only against the registered SRM Neon project and `srm_app` database. Staging and Production remain outside this release.
# Metadata-only coverage audit (Development, test tooling)

This optional CLI never participates in SRM lookup, company search, the product database or its existing MGBI integration. BZP supplies **test seeds only**: contractor name, checksum-valid Polish NIP, city, publication time and notice ID. Its population includes JDG and only contractors appearing in the selected result notices; it is not an exhaustive or representative registry of Polish companies. Names do not prove legal form.

From `apps/srm`, using the existing dependencies:

```sh
export TARGET_ENVIRONMENT=development
npm run coverage:audit -- seed --from 2026-10-01 --to 2026-10-08 --max-pages 20
npm run coverage:audit -- sample --size 100 --seed pilot-20261016
# Set MGBI_API_KEY securely in the process environment; never put it in a command or data file.
npm run coverage:audit -- fetch --size 100 --seed pilot-20261016 --max-calls 300 --reserve 50
npm run coverage:audit -- fetch --size 250 --seed pilot-20261016 --max-calls 600 --reserve 50
npm run coverage:audit -- replay --size 250 --seed pilot-20261016
npm run test:coverage
```

All outputs default to the ignored `.coverage/` directory (`--dir` overrides it). This local test cache is separate from all SRM and PMOS databases. Data files and CSVs must not be committed or published. The seed command spaces BZP requests at least 2.2 seconds apart, stores only contractor metadata and atomically commits each batch with its next-page cursor. Repeat the same window to resume. New windows can extend the cache; completed windows are not refreshed automatically. See the [official BZP integration and rate-limit guidance](https://ezamowienia.gov.pl/pl/integracja/).

The first sample freezes a deterministic ordering and directory digest. With the same seed, 100 is a prefix of 250 and subsequently 10,000; existing completed NIPs are not requested again. Build a sufficiently large seed pool **before** freezing it. Use a new seed when starting a different cohort. An insufficient pool is an error; the CLI never invents NIPs. `--max-calls` is the cumulative RDF request ceiling for the entire data directory, including retries and pagination, not a reset per invocation. Raising it must fit the fresh provider quota minus `--reserve`. A 10,000-NIP cohort can be prepared and replayed offline, but live execution is not possible on a quota below its required requests. Quota/403/429 failures stop the run. Transient 502/503/504 responses have one budgeted retry; other failures preserve completed receipts and page checkpoints.

Only MGBI RDF `/records` and `/limits` are allowed. Redirects, file endpoints and external hosts are blocked. Every record request has a fixed positive projection: NIP/KRS, document type/period/correction/accounting flag, XML schema, standardized numeric fields and original **MIME metadata**. No file URL is followed, no original is downloaded, and no full XML dictionary, personal registry fields or free text is requested. Selected response fields are sanitized again before persistence. The provider's file counter is checked before and after each fetch run; a change requires investigating concurrent activity. A directory lock prevents overlapping local runs. After a killed process, verify that its PID is no longer running before removing a stale `operation.lock`; never remove a live lock.

JSON and CSV reports separate provider/response errors, no RDF financial statements, missing standardized numbers, candidates with structured numbers, and reports requiring originals. Flags identify corrections, unit variants, unknown formats, missing schemas and periods. Saved minimal receipts can be replayed without any provider credential, using the **existing** SRM financial mapper and indicator calculator. Their limited projection omits full XML rows and originals, so partial/empty replay is not proof of a parser bug. Mapper warnings from the limited projection are kept separately in `projectionReplayWarnings`, not counted as confirmed runtime defects. Original-download readiness also remains `NOT_VERIFIED`; MIME metadata is not a successful file retrieval. Multiple KRS registrations, repeated filings and noncalendar periods are review cases, not automatic errors. Full report readiness always remains `NOT_VERIFIED` until reproduced with sufficient already-held source evidence and the actual UI; this tool does not claim end-to-end report validation. No absence is silently converted into zero, no JDG status is inferred from an empty RDF response, and no runtime adapter is rebuilt for the audit. Capture a reproducible finding before changing product code.
