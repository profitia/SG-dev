# Native sensitive Supplier provider regression pins — 2026-10-19

Status: source candidate, not released. Profile SRM; TARGET_ENVIRONMENT=development.
Task: SRM-E1-SENSITIVE-PROVIDER-REGRESSION-PINS-20261019.
Host conversation: 01a133c2-c245-77a0-bb6b-33165e2ad80c.
Authority before change: 8819da4f96c1c9e3d20a9ace10a41b44c405fe8d.

The owner-authorized E1 native sensitive composition shares the exact original provider-call exception guard between company and KYS/JDG orchestration. The full local native regression passed 255 of 256 tests; the only failure compared current provider-source-transport.ts to its historical MSR adoption fingerprint. Original provider and company behavior tests passed.

This companion changes only the existing receipt test and this evidence. Historical native-provider and MSR fingerprints, their assertions and release-boundary flags remain intact. The actual current source is compared against the distinct nativeSensitiveSupplierCompositionAdoption closure, with the historical hash retained for paths unchanged by that closure. The original network, provider, admission, persistence and denial assertions are preserved. No source fingerprint is overwritten to disguise a prior state.

The primary implementation is SRM-E1-NATIVE-SENSITIVE-SUPPLIER-20261019. Its evidence records the original engine/body equivalence and actual positive/negative PostgreSQL/HTTP tests. The tasks have separate immutable PMOS identities and will share one reviewed candidate and exact main acceptance. This document does not establish a cloud installation, user session, endpoint activation, deployment or business UAT. Final verification and acceptance are recorded in each canonical closeout.
