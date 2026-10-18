# Dashboard native Market Analytics adoption — 18 October 2026

Status: locally verified source candidate; source/main CI and canonical closeout remain separate acceptance evidence. No product deployment or native flag activation.

Task `SG2-E1-DASHBOARD-NATIVE-MARKET-ANALYTICS-20261018`; SG2; workspace SG-dev; target Development; execution local. Exactly eleven aligned paths, full before/begin/require-begin preflight, all32 previously loaded canonical document/adapter hashes unchanged. Own registration `cmvdevve00000hofkzcqtdboz` uses the SG2 PMOS database; no other profile history is written.

## Scope and business behavior

The existing Dashboard GET `/api/series` dispatches benchmark-series requests to the existing protected SG Runtime Market Analytics API when the explicitly configured native profile is selected. Legacy handlers retain their existing route and behavior. Requests without a benchmark identity do not gain native middleware access. Pages, writes, private record/component APIs and other unadopted surfaces remain closed in native mode.

The original history-to-chart function and types moved to a pure module. The complete original mapping function matches exactly after removing only its exported declaration. Zero/null, unsupported units, currency, latest-value fallback, last-point anchor, locale and display-name behavior are preserved. No owner database, source service, provider or framework dependency is introduced into that mapper.

One shared bounded Web-API transport now serves the four Forecast relays and this historical input. The same already explicit Development host binding is reused; it is a deployment binding, not a grant to knowledge.read. The backend independently checks the current account/session, organisation membership, product/market feature, module and knowledge.read permission before the ordinary stored source. Only incoming Authorization and a closed series/range/optional organisation selection are forwarded. Cookies, forged identity, private-record filters and arbitrary destinations do not become authority.

The existing admitted-context publication wrapper now sets feature-specific market projection/resource metadata after the original closed projection, retaining the three shared contract/application/environment fields. Forecast headers remain compatible. These nonsecret fields contain no organisation/user IDs and are not an independent signature. A verified native backend publication must precede consumer configuration during a later controlled release.

## Verified local evidence

Dashboard:319 tests, whole-app strict typecheck, isolated full build, all PASS with zero skipped. Four fresh imports including the actual series dispatcher create no owner client or provider call. The real production build was started only on an ephemeral loopback port: absent configuration refuses503; explicit native configuration refuses opaque/unverified identity401 for all five accepted read routes; pages, writes and unadopted APIs refuse503. No valid session was sent to a live backend.

SG Runtime:481 operation/actual SQL/API tests plus61 original forecast/snapshot tests and strict types, all PASS with zero skipped. The actual cross-app HTTP test uses the existing runtime dispatcher, current private host and actual ordinary-role Market source. Independently authorised A/B organisations receive identical shared facts with separately scoped audits. Values10/0/null, null currency and unsupported original unit survive the unchanged chart mapping. Session/membership/permission revocation refuses before source; wrong source receipt, durable OUTCOME outage and missing native publication metadata each withhold the chart. Actual audit failure preserves correlated INTENT/FAILURE. The SDK identity fixture is synthetic and is not real Clerk or signature verification.

Existing four Forecast relay tests and real HTTP integration still pass after transport extraction. Negative cases cover target environment, selection/series/range, duplicate or private filters, configuration, response scope, redirect, MIME/JSON, byte limits, cancellation and diagnostic redaction. Malformed MIME and refused metadata release response bodies.

## Remaining boundaries

No cloud schema, data, role, grant, secret, configuration, source flag or deployment changed. No package publication, dependency update, new runtime or profile/authority exception was introduced. Product auto-deploy stays disabled; the remaining three automatic services have roots/build filters excluding these eleven paths.

This is API/source adoption, not real Clerk/browser login, complete native Dashboard UI, live source initialization, load acceptance, executable rollback or Development/Staging release. The existing apps keep running under their current profiles. Full E1 remains in progress, including session/UI adoption, remaining APIs, delegated jobs/cache/files and controlled releases with their own evidence.
