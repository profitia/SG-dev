# SG2 E1 — explicit Current forecast read dependency

Status: SOURCE_CANDIDATE_NOT_DEPLOYED. Date: 2026-10-18. Task `SG2-E1-EXPLICIT-CURRENT-FORECAST-READ-20261018`, SG2 / SG-dev / local / TARGET_ENVIRONMENT=development. Authority `profitia/SG-dev/main`, base `1cb3433b1a7be6696bdd85cba8543ccca899cc40` after PR #460. Three exact paths passed before/begin/require-begin governance, current routing and provider checks. Own PMOS registration `cmvd35a2v000011t78rsrqyrh`; registration alone is not closeout.

## Result and compatibility

The existing generic Current forecast DAO previously always resolved the global market-data client. Its latest-result lookup called the exact-result DAO, which independently resolved that global client again. This prevented a caller from keeping both reads on an explicitly supplied restricted connection or transaction. This is a source adoption limitation, not evidence of a live cross-organisation data leak.

Both existing read functions now accept an optional dependency containing a genuine generated Prisma read client. The public type exposes only `forecastCurrentRun.findFirst`. The latest lookup forwards the same dependency to the existing exact lookup and mapper. It accepts a generated client or its actual transaction client without inventing an ORM interface or changing the generated schema.

Omitting the dependency retains the existing global-client behavior. Explicit `null` or an object without its required client fails with the existing datastore-unavailable error. SQL permission failures propagate; they do not trigger a global-client fallback. Existing queries, sort order, missing-policy-column fallback, statistical compatibility, cadence, forecast values and DTO mapping remain unchanged. Computation, writes, verification DAO and default repository wiring are unchanged.

This internal DAO is **not** an authorization boundary or a sanitized public projection. Its existing technical provenance/metadata fields retain their meaning. Protected generic forecast adoption still requires approved source views, ownership/privilege/receipt validation, current identity and access decisions, closed public DTOs and API tests. A TypeScript read interface does not itself grant or restrict database privileges.

## Verification

- **365 SG2 operation tests pass, zero failures/cancellations/skips.** The existing stored-source integration file now also exercises the genuine generated Current ORM against a guarded local PostgreSQL database and a separate ordinary login with SELECT on only two synthetic tables.
- The exact read preserves nested point order, zero versus null, runtime zero, model, history fingerprint, target basis, cadence and statistical identity. All persisted lookup dimensions reject mismatches without provider calls or refitting.
- The latest read ignores a newer FAILED row and reads the AVAILABLE artifact through the same actual read-only, repeatable-read Prisma transaction. A deliberately poisonous global client proves neither stage resolves the global fallback.
- Malformed explicit dependencies, direct private-table access, source writes/schema creation and a revoked nested-points SELECT are refused. Restoring the fixture grant restores reading. The missing-policy-column fallback also stays on the supplied client and retains its original **legacy** statistical identity; the test does not promote that identity to current compatibility.
- Omitting the dependency produces the same exact/latest results through the actual global client. All global/env/fetch changes and temporary dependency links are restored in `finally`.
- The **61 original forecast-library and Rolling Daily snapshot tests** pass independently. Strict changed-source checking passes; a separate compile probe accepts genuine generated client/transaction dependencies and rejects a write operation and a dependency without a client.
- Exact candidate and merged-main controlled/public/dashboard/build proofs are required for publication and are referenced by the canonical closeout. The active trusted-main CI policy is `f3b015a4d10117f0a8ebfee475dc4a17b6207f29b313feee16b631e5411b840c`; historical proofs under the earlier policy are not substituted.

The source-only paths are covered by PR #460's automatic CI filters; this increment does not depend on a manifest edit to trigger validation. No cloud DDL, role, grant, credentials, configuration, activation or product deployment changes. Existing Development and Staging deployments remain in place. Live Prisma/TLS, Clerk browser login, business UAT, retained-artifact rollback and full E1 releases are not established by these tests. Generic forecast source/adoption, remaining entrances and delegated effects, and controlled Development then Staging releases remain accepted E1 work; Production and E2–E4 remain outside this task.
