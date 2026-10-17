# SG2 — alternate analytics entry and protected response boundary

Task `SG2-E1-ALTERNATE-ANALYTICS-BOUNDARY-20261017`, SG2 / Development.
Authority at start `dff615b6444fbd5870e6ec890caed3a534d35b82`.
Status: **source increment; no deployment or private-mode activation**.

## Result

The existing GET `/api/benchmark/analytics-series` now passes through the existing
`withCognitionAuth` before validation or the unchanged market-series resolver.
Previously the route had no auth helper and root middleware excludes API paths;
a direct caller could reach a read-through path that may fetch and hydrate
shared data. This change removes that alternate source entry.

The retained resolver accepts the configured signed demo/deployment profile and
its already explicit temporary component profile. It does not trust caller
Clerk headers. Explicit Clerk, unknown or empty provider values cannot use demo
or development fallback; they remain closed until their own accepted common
operation-host integration. The patch does not turn demo into a named user,
grant global writes, authorise paid calls or claim complete market adoption.

All responses from this existing helper, including validation failures, access
refusals and unexpected exceptions, now use `Cache-Control: private, no-store`.
They vary on Cookie and Authorization while preserving other Vary selectors and
wildcard semantics. Existing bodies/statuses remain unchanged on successful
handler return. Unexpected raw provider/SQL exceptions are replaced by a neutral
public error and a fixed diagnostic message; their messages/payloads are not
printed by the helper. Analytics' own catch also returns its fixed public error.
This is no substitute for the accepted durable access audit in the private host.

## Validation

- Full own-profile begin/require-begin and exact five-path governance PASS.
- 11 new tests exercise the actual alternate route and retained helper: absent,
  forged, malformed and cross-environment sessions; explicit Clerk/unknown/empty
  provider with a valid demo cookie; a valid signed session reaching existing
  validation; preserved body/status/Vary; wildcard and private exception handling.
- Provider fetch is trapped and remains unused in all negative entry cases.
  The authenticated route test reaches validation, not a paid vendor call; it
  does not assert a live provider response or a named identity session.
- All 87 operation/configuration/ordinary-role API/SQL tests PASS, zero skipped.
  Existing 12 market-data service tests PASS, including hit/miss hydration and
  idempotency through controlled repository/provider adapters. Typecheck PASS.
- Full Next14/React18 build PASS. Only verified generated build deltas were
  restored. Exact-source controlled/public CI is required before merge; final
  SHA/run outcomes are recorded in the canonical closeout.

No schema, data, role, grant, secret, service/flag, provider configuration, domain
or deployment changed. The independently dated effect inventory stays historical
and this task does not rewrite it. Dashboard, remaining named market/forecast
adoptions, provider/service delegation, files, reuse and controlled releases are
still accepted E1 work. E0/E1 remains IN_PROGRESS. Own SG2 PMOS/MEMOROS/PHR closure
is distinct from ARCHITECTURE or SRM history and from Staging release evidence.
