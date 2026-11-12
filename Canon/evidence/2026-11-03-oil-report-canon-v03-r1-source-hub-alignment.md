# Oil Report Canon v0.3 R1 — Source Hub alignment evidence

Status: DRAFT / OWNER_REVIEW_REQUIRED / DOCUMENTATION_ONLY / NOT_ACTIVE.
Task: ARCH-OIL-CANON-V03-R1-SOURCE-HUB-DOCS-20261103; profile ARCHITECTURE; workspace SG-dev Architecture; execution local; target development.

## Exact versions and lineage

- Historical v0.2 remains unchanged in [PR #868](https://github.com/profitia/SG-dev/pull/868), commit `d330e876ec4dbe5c744e7e34d52509f872f706d4`, SHA-256 `031f9d88f4da52fdaea64f173b9ca5acd258973670f648bf0d3fd38239f23222`.
- Original v0.3 TE remains unchanged in [PR #877](https://github.com/profitia/SG-dev/pull/877), first commit `6d3d054eb0ac279df2a4784bdb67100be224ad22`, SHA-256 `d4c36ba7b78cab4454bcaded10aeb8158f9eb5666eb84ea863090923fce78be3`. Its dated evidence is preserved as historical review, without rewriting its findings.
- New consolidated R1 is [the separate adjacent proposal](../proposals/oil-market-outlook/Procurement_Oil_Insight_Report_Canon_v0.3_SOURCE_HUB_ALIGNMENT_DRAFT.md), 51,936 bytes, SHA-256 `7812df26d010fc076ee0c0ccd54dd8a2e2f1a9e27869fd199c1a561b16314def`. Exact supplied bytes are copied without normalization. This is a complete standalone revision, not an appended TE canon.
- D1 applies to its exact v0.2. The owner has authorized saving R1 and accepted the Hub direction; neither is formal adoption of all exact R1 bytes or activation of a runtime.

## Changelog from original v0.3

1. Adds §0: Platform Source Hub belongs prospectively to Architecture Platform. Provider connectors, authentication, API retrieval, lossless normalization, provenance, provider limits/errors and delivery contracts belong there.
2. Procurement Insights consumes records, chooses relevant information, checks facts/asOf, creates ReportEvidenceBundle, composes and reviews the report. It creates no TE/NewsAPI/GDELT client, direct fetch, key vault, proxy or scheduler.
3. Newsfeed remains an independent consumer with its own business selection. Existing E1/Source/Root admission and effect controls remain mandatory; the Hub is not an OpenAI execution alternative.
4. All TE families remain: Calendar, News, Markets including bitumen, Indicators, Forecasts and optional Financials. The declared full API/redistribution licence is accepted as business input; contractual reference, attribution and retention are future implementation requirements.
5. Hub sourceRecordRef identifies delivered source data; Insights evidenceRef records evaluated report evidence. NORMALIZED does not mean FACT_VERIFIED, admitted, canonical or approved for publication.
6. Strengthens future/not-adopted status and B1 independence; corrects the earlier wording suggesting B1 was released. Adds R1 changelog §14.

## Comparison and conformance

All original numbered sections are retained once, with no duplicated substantial paragraphs. Sections 1, 2, 5 and 5.1–5.9, 6 and 9 have identical text to original v0.3. Forecast mathematics §6 is identical across v0.2, original v0.3 and R1. The nine report elements remain mapped into four parent sections under BC1/BC4; BC2 still caps all visible headings, tables and chart labels at 4000 characters. No new nine-section schema or renderer is accepted by this documentation.

WTI and Brent remain distinct canonical futures. TE forecasts are external context, not a fifth SG2 D7 model. All underlying/CFD/OTC, regional bitumen, calendar revision, provenance and asOf rules remain. No TE data replaces Macrobond observations automatically. Market Data/Benchmark Domain retains instrument and price authority; Forecast owns forecast/verification mathematics. Read §3.6's price wording consistently with explicit §§0 and 10; it does not reassign ownership.

D1–D5, BC1–BC6 and EP1–EP6 remain governing. D7 remains EXPERIMENTAL_7D / PARTIAL_READY with no certified intervals, rollover or historical-vintage validation. PARTIAL_READY is not a literal in the attachment; the unchanged frozen D0/D5 status remains binding and is recorded explicitly here. The inherited §9/§12 volume question is a possible future proposal and does not reopen BC2. Later A/B experiments in §11 are prospective and authorize no additional paid attempts.

The active [Newsfeed canon](../v1.0-newsfeed-business-and-architecture-canon.md) keeps its accepted platform capability, user-owned subscriptions and monitoring contracts. Future Hub delivery and producer–consumer responsibilities require separate admitted contracts and, where needed, an explicit governance alignment. R1 changes no active Newsfeed code owner, path, registry or policy. Private user URL preferences do not become shared public records or access for another consumer.

## Frozen B1 boundary

B1 remains [Draft PR #867](https://github.com/profitia/SG-dev/pull/867), commit `d4ae569101c2d038b490e4def442fc564a078608`. All 18 immutable handoff file hashes were verified unchanged. Frozen D0 SHA-256: `ec11c696cdd4e9577c462fdadf45953aba57bb76d7281bf034363513dbde006b`; exact prepared request SHA-256: `c61df3c984351c1ff3edd1ab43a5de451d36be7814d9fce6e5e5295b1abb2695`.

No D0, evidence, asOf, request, operation, code, model attempt or USD0.15 reservation changes. B1 without TE need not wait for Hub; its existing release and final GO gates still apply. Adding TE would need a new admitted source path, frozen bundle/asOf/hash and separate exact approval. No such work is started.

## Governance and authorized registration

Authority main: `1d245820f93337a35049b416cb375c1ab5a60183`; manifest 3.36.0. The 42 previously loaded CORE/ARCHITECTURE document hashes are unchanged. No nested AGENTS applies to these two new paths. Manifest validation and pre-write preflight passed; both paths resolve Governance Source Layer / ALIGNED under ARCHITECTURE. The proposal is outside the ACTIVE manifest.

The owner separately approved only one new PMOS begin under packet SHA-256 `c841b2dd454987f55cd6ebb4d0a418d4b3fe74e13ce2bf6b15ee440bee90cd7e`. Canonical registration created `cmw0lrdxc000060qkw7xcaj1z` at `2026-11-03T11:26:34.556Z` in `billowing-credit-07394675/architecture_pmos/public.prompt_executions`, role `architecture_pmos_runtime`. Readback matched exact prompt, paths, host and running status; require-begin passed before source edits. No previous registration is expanded.

No PMOS closeout, PHR/MEMOROS write, formal adoption, ACTIVE registration, Hub/TE implementation, grant, Source/E1/configuration change, Forecast change, merge, deployment, paid/provider call or report publication is included. The original Markdown hard line breaks are retained to preserve its SHA. Application tests/build and live Sentry events are not applicable to these documentation files. Monitoring: NOT_APPLICABLE.

Remaining decisions: formal adoption of exact R1 with the interpretations above, then separately authorized Hub producer–consumer/provider contracts, admission, instrument mapping and any runtime release. Those future decisions do not block saving this Draft or alter unchanged B1.
