# PCI live acceptance stabilization — 2026-10-30

Task: `SG2-PCI-LIVE-ACCEPTANCE-STABILIZATION-20261030`; SG2 / SG-dev / Development.
Authority baseline: `cb8ad767a5b0cfa0e44f92b66fd5d5f41f3fbad7`.
Observed live: `b44e33aee5a1a2ada9cf6ab5d7965b17506e37dc`, Render `dep-dbhttgou01pc73adoip0`.
This candidate is not a deployment. Preserve the newer SRM/AppShell/X-Ray work on main.

## Confirmed reset mechanisms and limits of attribution

`AccountLanding` previously replaced a ready same-scope account state with `failed` on **every** token/peer error. That removed `AppShellDashboard`, Finder and its PCI subtree. A later successful account read mounted empty instances. Controlled tests against the unchanged authority source reproduce this for a null SDK token, a thrown network error and HTTP503: all three preservation assertions fail. The same nine tests pass on the candidate, including authoritative401/403 and scope-change cases.

The PCI layer separately treated local `SESSION_UNAVAILABLE` as authoritative access loss, called the Finder's invalidation callback and closed the layer. A temporarily missing token is not a server denial. The candidate now keeps fields and offers a Polish retry message; it still closes on an actual API401/403. Request cancellation and generation checks remain in place.

The historical single reset observed on live has no correlated lifecycle trace. Its exact triggering request is **not proven**. These are reproducible code defects capable of causing the reported loss, not a claim that Clerk itself caused the original event. No token, private draft or global diagnostic logging was added.

The account refresh now starts before the old five-second window (halfway through short proofs, up to30seconds early) and retries transient failures after1second. Existing proof expiry is not extended. A still-valid same-scope proof retains the mounted workspace; an expired proof, explicit denial, sign-out, changed SDK user/session/organisation or changed backend account identity removes the old context. There is no persistent/global draft cache. APIs continue acquiring credentials and enforcing E1 per operation.

## WTI — actual stored-data diagnosis

Read-only inspection through existing `sg2_market_read_development_runtime` and its approved shared-market views identified:

- Provider series `uscaes0301`: United States, Crude Oil, Cushing OK WTI Spot Price FOB, USD.
- Daily, USD/Barrel;21,179 stored observations.
- Stored interval `1986-01-01T23:00:00Z` to `2026-09-17T00:00:00Z`.
- First collision of two observations in a UTC native daily period: `1986-01-02T00:00:00Z` and `1986-01-02T23:00:00Z`.
- The actual existing adapter rejects this as **`DUPLICATE_NATIVE_PERIOD`**, associated with the WTI component. This is before the later nonpositive values are reached. It is not a `NO_COMPARABLE_CADENCE` refusal.
- Two later nonpositive observations also exist (minimum−36.98); they were not substituted, deleted or used to justify a successful result. They are a separate constraint of the unchanged positive-relative-level model.
- Prior user-test settings were purchase/reference16.09.2026 (also tested21.09.2026), POINT_IN_TIME, NATIVE_ONLY, PRICE_LEVEL. A later reference cannot remove an earlier full-history validation conflict;21.09 also lies beyond WTI's stored endpoint.

Preparation and analysis now preserve the exact Core code/component and add a Polish explanation naming the component, source series and verified conflicting period. It explains that the model does not select/average duplicate observations automatically, suggests another suitable benchmark or source-data review, and does not suggest changing the true purchase date. Per-component history limits remain visible; the cadence label now says it has not been established, rather than falsely identifying every refusal as a method mismatch.

Distinct duplicate-timestamp and invalid-level errors also retain their codes and concrete messages. No alignment, CCI, Indexed Price, source history, qualification rule or authority contract was changed.

## Validation and evidence boundaries

- Nine new lifecycle tests exercise the actual AccountLanding/AppShell/Finder composition with a synthetic SDK/account peer. The identical baseline run fails the three transient-preservation cases; six denial/scope/rerender controls pass. Candidate:9/9.
- Targeted preparation/request suite:15/15, including unchanged purchase mapping, closed/open periods, missing observations, exact tenant/revocation fences, period collisions and credential retry.
- Local browser acceptance uses `tests/pci-live-acceptance-preview.mjs`/`.tsx`, actual application UI/BFF/CCI/Indexed Price and explicit synthetic external identity/provider/persistence. The visible fixture controls are test-only and excluded from product entry points.
- Browser verified retained category/name/weights/price/dates, peer503, missing operation token, host rerender, theme, Picker cancellation/reopen, WTI-shaped refusal, correction to valid data, calculations for2and5components, Done→Finder query/expanded-card preservation, and purge on changed organisation/403/logout. These are **not** a new live Clerk/Macrobond acceptance.
- No new paid Macrobond calls, hydration, quota renewal, grants, migrations, merge or deployment. Token admission counter read at task start:12/100; compare final evidence separately.
- Full regression, exact-source CI, typecheck/build and publication status are recorded in the final PR/handoff after completion; a partial or pending check must not be represented as PASS.

Run lifecycle tests with `node --import tsx --test tests/account-landing-lifecycle.test.tsx`; run the normal `npm run test:operation-context` for the full registered regression, then `npm run typecheck` and `npm run build`. Fixture example: `JOURNEY_PREVIEW_OUTPUT=/absolute/own/output JOURNEY_PREVIEW_PORT=33579 node --import tsx tests/pci-live-acceptance-preview.mjs`. The loopback-only fixture never imports live credentials.

## Narrow post-release acceptance

After separately approved exact-SHA Development release:

1. Open Finder from Dashboard in an authorised Clerk session; start a category and enter two or five components plus purchase fields. Let a normal session refresh occur; verify values, theme and Picker cancellation remain intact.
2. In WTI `uscaes0301`, check actual stored availability and confirm the precise refusal with preserved purchase/date, rather than a guessed cadence explanation. No history download is required for that read.
3. Choose an actually suitable stored source with a complete common period and run the existing calculation; Done must preserve Finder context.
4. Verify real denial/sign-out/organisation change isolates the old draft. Do not change live grants to manufacture this test.

A long outage past the accepted proof's expiry still fails closed; this patch does not turn an old client proof into continuing authorisation. The original isolated live reset needs correlation if it recurs after release. No Benchmark Qualification Layer, new infrastructure, X-Ray/Maps/ADP feature, or alternate category model is part of this change.
