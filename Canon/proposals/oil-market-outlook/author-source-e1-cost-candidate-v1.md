# Oil Market Outlook — Author/Composer contract candidate v1

Status: **D3 SOURCE PREPARATION ONLY / NOT ACTIVE / NOT RELEASE READY**.
Producer: ARCHITECTURE, task `ARCH-OIL-COMPOSER-CONTRACT-PREP-20261102`.
Consumer task: `SG2-OIL-COMPOSER-CONSUMER-PREP-20261102`.
Authority base: `profitia/SG-dev/main`, `6fdc75192275e296a443db2f1c1d8b4a659b084c`.

The owner accepted D1–D5 with BC1–BC6 and EP1–EP6. These source candidates do not activate the parent Insights canon, PR847/848, a new domain runtime, grants, installation, paid calls or a release. Historical I1–I4/G1 acceptance is retained. Canon attachments alongside this document preserve the exact accepted bytes. No active governance registry or access-matrix rule is changed here.

## Proposed boundary and ownership

The SG2 change is an adapter and deterministic preparation in the existing SG Runtime, not a replacement Insights backend. The domain paths proposed by PR848 are not routed on current main. Shared policy/protocol code stays in `packages/platform-contracts`; SG2 does not take ownership of those files. SRM source and receipts are not modified by either candidate.

Proposed E1 rule, **not a grant and not an active matrix entry**:

```json
{
  "id": "OIL-COMPOSER-CANDIDATE-01",
  "operation": "insight.report.compose",
  "feature": "insights",
  "requiredProduct": "SPENDGURU",
  "contextMode": "ORGANISATION",
  "actorKinds": ["HUMAN"],
  "requiredPermission": "insight.report.compose",
  "resourceType": "insight_report_intent",
  "dataClasses": ["USER_IN_ORGANISATION_PRIVATE", "OPERATION_AUDIT"],
  "effect": "REQUEST_COMPUTE",
  "usagePolicy": "EXACT_ONE_ATTEMPT_USD_HOLD",
  "audit": "SECURITY_REQUIRED",
  "runtimeAdoption": "NOT_ADOPTED"
}
```

All applicable G01–G14 remain mandatory and DENY wins. The actual actor, internal User ID, Organisation ID, current membership/product/permission/resource owner and revocation must come from the existing server-side E1 authority. Client IDs, projectKey/taskId, a boolean GO and a Source service identity do not establish human authorization. A current private-operation admission is required before Source cost and again before exposing protected results. This candidate has no live human admission route; the SG2 live entry refuses execution.

Forecast observations/points remain SHARED_KNOWLEDGE under their existing product boundary. A private intent, category selection, report and audit require explicit user/organisation ownership. For this first scope the category is the owner's fixed proposed asphalt category, region/exposure UNSPECIFIED, user URLs empty; no private category or preference read is added. Future user URL monitoring requires its own personal-read/delegation/retention contract. The shared Source service is never permission to read a person's URL history or category. No retrieval, website scraping, hosted Web Search or user-source monitoring executor is included.

## Closed execution profile

Proposed Source ID `sg2.oil-report.openai`, resource `sg2-oil-report:compose`; these names do not exist as active grants. Only `POST https://api.openai.com/v1/responses`, no query, redirect, alternate origin or raw HTTP entry. `gpt-6.1-sol` is scoped to this operation. Global `OPENAI_MODEL` and the existing Finder transport are untouched.

The wire body contains exactly model, store=false, reasoning.effort=medium, service_tier=default, max_output_tokens=8000, developer/user input and strict text.format=json_schema. No tools, background, streaming, fallback, retry, previous_response_id, priority, Fast or alternate model. Full serialized UTF-8 body is limited to 65536 bytes; output budget includes reasoning. The local server-owned input-token counter must measure the exact body using an accepted model-compatible tokenizer before PLAN; unknown, noninteger or >15000 counts deny. Selecting and validating that tokenizer is still a release blocker; the test counter is explicitly synthetic, not production proof.

The proposed Source deadline is 120000 ms; outer operation deadline is 150000 ms, subject to measuring admission and settlement. This is not an SLA. A timeout never means not billed or safe to repeat. No HTTP GET/status/cancel/model-list capability is silently added.

OpenAI's public [Sol documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol) confirms Responses and Structured Outputs, medium reasoning and Standard prices of $2/M input, $0.10/M cached input, $2.50/M cache writes and $10/M output as checked 2026-11-02. It does not prove access for SG2's active key/project. [Request-ID documentation](https://developers.openai.com/api/reference/overview) distinguishes client and provider request IDs; neither is an exactly-once/idempotency guarantee.

## Optional shared transport

Package candidate: `1.33.0-candidate.1`, optional `model-execution` subpath. Existing callers omit `modelExecution` and retain their old descriptor/control path and response-header projection. Opt-in callers must provide the bounded policy and a server-owned local token counter; the host verifies the current SQL028 descriptor and complete request before reserving an attempt.

Only an admitted model path preserves bounded ASCII `x-request-id` (512 bytes). The dedicated SG2 command policy proposes only authorization, accept, content-type and X-Client-Request-Id; no arbitrary client-supplied header map. The shared native decoder still drops cookies, organization headers and other provider metadata. API credentials are supplied only by the existing server secret binding after admission; none is created, copied into a source artifact or logged. Explicit OpenAI project/organization header overrides are excluded until their exact binding is verified and accepted.

## SQL028 candidate and cost lifecycle

`migrations/access/028-model-execution.sql` is **unapplied**. It requires the existing restricted NOLOGIN Source owner and accepted native Source functions. It creates no roles, grants, policies, installation record or activation. Installation must be a reviewed transactional, exact-digest operation against the approved Source endpoint/branch/database, under the existing backup/recovery/release procedure. No PMOS connection may be used to install product/Source schema.

The optional schema has installation, policies and holds with forced RLS, no PUBLIC access, and narrow SECURITY DEFINER functions with fixed search_path. A future controlled policy must bind the exact existing Source policy, project-key proof, prior-liability reconciliation, candidate acceptance, controlled release and **final explicit owner GO**; this source PR supplies none of those live records.

`apply_control` reuses actual Source check_control/effect/decision/digest/scope and base apply_control. PLAN and its USD hold commit atomically. One policy permits one immutable intention, including concurrent callers. ATTEMPT requires its current hold. SETTLE records RESPONSE_USAGE_PENDING, UNVERIFIED or NOT_SENT without freeing the hold or permitting a retry. Existing Source quota units are independent of USD and are not reinterpreted as billing.

A deferred database constraint on Source calls prevents legacy base-control PLAN/ATTEMPT/SETTLE from committing without the matching model hold. This is enforced before the sole Source HTTP send, including a synthetic test with an extra base EXECUTE grant. A missing/disabled trigger denies the modern descriptor. A future dedicated ordinary role (proposed `sg2_oil_composer_development_source_runtime`) receives only current Source control/audit/read-status and narrow model functions; it must not receive direct base-control EXECUTE or table writes. The existing Finder role is not repurposed. No such role, credential or grant is created here. Non-model policies preserve their original behavior.

The business hold is 150000 micro-USD ($0.15), not the whole $5 envelope. Conservative full input at cache-write price plus 8000 output tokens is 117500 micro-USD. `record_usage` accepts bounded integer input/output/cached counts only after an actual settled response under current Source authority; a differing repeat is rejected. It records a conservative tariff estimate and request/response IDs; actual provider invoice cost remains UNKNOWN. Neither a successful usage record nor missing usage automatically releases the hold. User/customer fees are not computed. Prior experiment `UNVERIFIED` must be reconciled separately; it is never rewritten as zero or retried by this candidate.

Human E1 adoption, a durable protected report/audit output boundary, the model-compatible tokenizer, active-key project proof and billing reconciliation are still required before a live route can be accepted. There is deliberately no administrative installer or executable live command in these candidates.

## Evidence, rendering and privacy

The consumer verifies the frozen D0 byte SHA, retains its separate content fingerprint and projects eight existing forecasts and 320 matured records without fitting any model. It independently checks sMAPE and directional accuracy against records; the inverse-error percentage is clamp(100−mean(sMAPE),0,100), never a probability. No accepted intervals exist. Latest-vintage, rollover and exchange-calendar gaps remain visible.

The proposed narrative schema has four sections and sentence evidenceRefs. The model cannot create table numbers. The plain-text renderer inserts prices, point deltas, history metrics, last matured comparisons and warnings deterministically. NFC Unicode code points, including headings/tables/labels and LF, must total <=4000. Rejection preserves raw output; no silent trimming or manual polishing. Structured text/reference validation does not prove the economic meaning of a claim. Independent editorial/procurement and exact-version human review remain mandatory.

This slice emits deterministic table data and current/target endpoints, not invented intermediate forecast paths or a chart UI. Chart rendering and any separately versioned nine-element presentation remain pending adoption. A missing market-source/calendar bundle is marked missing and cannot be presented as no market events. Only publications available by exact asOf and separately verified completed/scheduled/revised/cancelled events may be admitted. No market research was fabricated during code preparation.

Sentry is reused only in the existing host; static run/source/author/validation/review ops and status survive its current sanitizer. It receives no prompt/output/private URL/identity/secret or arbitrary payload. Token/cost/lineage details belong to the protected local experiment audit, not a relaxed Sentry allowlist. Controlled telemetry tests send only to an in-memory transport; the first real trace is a future authorized Development acceptance check.

## Required adoption and release evidence

Keep separate producer/SG2 PRs and receipts. The current shared-contract CI also requires real SRM adoption; passing a local composite or a consumer on old main is not proof of that adoption. No SRM receipt or ownership is forged here. A coordinated exact candidate and owner tasks are needed before a shared-package release can be green and accepted.

Observed SDK-version dependencies also include Maps, Identity, dashboard and the existing optional FRESH/payload packages. Their exact current peer pins are not widened by this proposal. The SG2 preparation retains global package/lock/integration manifests byte-for-byte; new tests have a separately evidenced standalone command. Integrating the new suite into canonical CI with a proper receipt continuation remains mandatory before live admission.

Before any environment change: exact diffs/SHAs/digests, trusted exact-head CI, positive/negative E1/Source/cost tests, Finder regressions, independent consumer receipts, current endpoint/role/policy/key-project evidence, prior UNVERIFIED reconciliation, retained LKG artifact/config/schema compatibility and executable rollback. No LKG is fabricated from source SHA alone. No merge, installation, grant, configuration or deployment is authorized by this PR. After a separately accepted/released candidate, present one exact evidence bundle/body/token/cost scope for the owner's final GO; do not execute it automatically.
