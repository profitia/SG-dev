# SG2 E1 — neutral prepared-state data port

Date: 2026-10-18. Task: `SG2-E1-PREPARED-STATE-DATA-PORT-20261018`. Profile SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, isolated local execution. Authority `profitia/SG-dev/main`, starting at independently accepted Verification merge `75ca03c759fa0a53623ef38eaf64ae1d6dd4188c`.

## Result

The existing preparedness calculation now consumes an explicit read-only `ForecastPreparedStateDataPort`. Its five methods return only the current/historical run, Rolling snapshot, maintenance and verification-count facts required by that calculation. Query keys carry scientific series/model/method/cadence/policy identity; they are not generated ORM delegates and do not carry user, organisation or application authority.

`readForecastPreparedVariants` remains the legacy public wrapper. It preserves its original omitted and now-only dependency behavior, explicit invalid-client refusal and real generated Prisma query/fallback behavior through `createLegacyPrismaPreparedStatePort`. The new `readForecastPreparedVariantsFromPort` requires a complete explicit port and never obtains the global client. The legacy adapter remains explicitly named: it must not be used as a pretend ORM over different native state views.

The one calculation retains original frequencies, model/semantic identity, concurrent-read bound, Current minimal training suffix, full Historical history, canonical fingerprints, statistical policies, Rolling snapshot/maintenance/count logic and READY/STALE/NOT_PREPARED decisions. Original missing-column compatibility remains on the supplied generated client. There is no new fitting, readiness policy, authority/result cache, provider call, write port or runtime.

## Validation

- 448 operation-context tests and 61 original forecast/snapshot tests passed, zero skipped.
- Strict source/host/runtime validation, including the new typed port tests, passed.
- All original prepared-state and missing-policy-column tests remain unchanged and passed. Fourteen existing policy/query-compatibility helper bodies are byte-identical to the pre-refactor source.
- Four typed neutral-data tests cover complete query identity, missing/invalid ports, direct source error propagation, zero/null/latest failed-attempt distinctions, absence of cached successes and unsupported frequency behavior. A throwing global-client getter and forbidden fetch prove that these port calls do not resolve the global ORM or a provider.
- The existing disposable PostgreSQL fixture uses its real generated Prisma schema and an ordinary restricted login. Inside a read-only Repeatable Read transaction, the new port produces exactly the same period and Rolling variants as the legacy wrapper. The latest failed period attempt remains STALE and the exact completed Rolling maintenance remains READY according to the original rules. The adapter is frozen and no fake ORM was used.
- Existing Current, Verification, private authority, source ACL/refusal, audit failure and fresh-import regressions passed.

Exact candidate/main CI, independent source proofs, PR/merge and canonical PMOS/MEMOROS/PHR closeout are recorded by this task lifecycle after publication; this document does not pre-claim them.

## Boundary and remaining adoption

This is the data-port prerequisite, not native capability/readiness API adoption. The parity fixture exercises the real legacy generated models in a guarded synthetic database; it is not evidence of an installed live forecast reader or of a native adapter querying the separate latest-attempt state projections.

The next native adapter must query the approved preparation-state projections using the genuine source transaction. A reusable AVAILABLE artifact alone is insufficient proof of the latest preparation attempt. Native host/API projection, private per-operation authority, actual source installation/configuration, dashboard/service/job adoption, live login/Prisma TLS and controlled Development/Staging releases remain separate work. No product schema, data, role, credentials, flags, service configuration or deployment was changed. SG2 continuity uses its canonical Development PMOS/MEMOROS/PHR lifecycle; no other profile history is borrowed.
