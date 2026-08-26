# Forecast Phase 2.2B-3 Persistence Ownership / Idempotency Experiment

## 1. Executive Summary

H0 passes. Existing single compute ownership plus transactional parent upsert and complete child replacement provides effective canonical idempotency for the tested Current and Verification identities. No additional persistence mechanism is required.

## 2. Objective

Determine whether existing persistence is sufficient before authorizing any new idempotency mechanism.

## 3. Accepted Phase State

Phase 2.1, Phase 2.2A, Phase 2.2B-0, Phase 2.2B-1, and Phase 2.2B-2 remain PASS. Contract versions remain 1/2/1 with no drift.

## 4. Frozen Experiment Contract

The frozen Phase 2.2B single-flight experiment contract and two B3 matrix rows control this experiment.

## 5. Scope Boundary

Bounded task-owned rows on the isolated local clone only. No provider, model load, schema, tuning, infrastructure, or Phase 2.2B-4 work occurred.

## 6. Primary Persistence Hypothesis

`H0 = SINGLE_OWNER_EXISTING_PERSISTENCE_IS_SUFFICIENT`.

## 7. H0 Decision Principle

H0 passes only when normal, duplicate, concurrent, rollback, retry, lost-ack replay, race, isolation, and prepared-read evidence all converge to a lawful canonical state.

## 8. H1 Authorization Boundary

H1 was eligible only after an evidenced H0 failure and only inside the existing architecture. H0 passed, so H1 was not authorized.

## 9. Persistence Ownership Key

`PERSISTENCE_OWNERSHIP_KEY_V1 = PERSISTENCE + artifactFamily + complete artifactLogicalKey + persistenceOperation + persistenceSchemaVersion`.

## 10. Persistence Key Semantics

The experiment-only contract test uses length-prefixed UTF-8 field-name/value pairs in frozen order and fails closed on missing fields.

## 11. Current Persistence Architecture

Current persistence is owned by the Current single-flight owner and uses one Prisma interactive transaction: parent upsert, point deleteMany, point createMany.

## 12. Verification Persistence Architecture

Verification persistence is owned by the Verification single-flight owner and uses one Prisma interactive transaction: parent upsert, metric/point deleteMany, metric/point createMany.

## 13. Database Constraint Inspection

Parent and child compound unique constraints were inspected and unchanged. They prevent duplicate canonical parents and duplicate child identities.

## 14. Current Canonical Persistence Identity

Current parent identity is seriesId, inputSource, historyFingerprint, targetBasis, methodId, modelId, and methodVersion; exact reads also require frequencyIdentity.

## 15. Verification Canonical Persistence Identity

Verification parent identity uses the same compound fields; exact reads also require frequencyIdentity and Verification logical identity embeds horizon/configuration/origin policy.

## 16. Canonical Write-Set Definition

One canonical write-set is one complete transaction covering one parent and its deterministic replacement children.

## 17. Duplicate Write-Set Definition

A duplicate write-set is another persistence attempt for the same exact identity. It is distinct from duplicate canonical rows.

## 18. Effective Idempotency Definition

Effective idempotency means retries or concurrent attempts converge to one complete canonical parent and one lawful child set.

## 19. Exactly-Once Claim Boundary

Exactly-once SQL execution is not claimed. Sequential and concurrent tests intentionally execute more than one transaction attempt.

## 20. Phase 2.2B-1 Current Carry-Forward

Accepted B1 evidence remains unchanged: exact-key Current misses have one compute owner, waiter reuse, one write-set, and cleanup.

## 21. Phase 2.2B-2 Verification Carry-Forward

Accepted B2 evidence remains unchanged: exact-key Verification misses have one backtest owner, waiter reuse, one write-set, and cleanup.

## 22. Current Normal Success Proof

PASS: 1 attempt produced 1 parent and 2 exact point rows; prepared checksum 2dd666bfcbe104327b8f25ecf09b4d6ac3c3f9d965c42ddc40688ecf72f26bb7.

## 23. Verification Normal Success Proof

PASS: 1 attempt produced 1 parent, 2 metrics, and 3 records; prepared checksum 67279ba4be306116e56d0bfa42fbe851ceda47c21f1b2090788cd01a2769e2ff.

## 24. Current Sequential Duplicate Write Proof

PASS: 2 identical attempts converged to one parent and 2 point rows with zero duplicates.

## 25. Verification Sequential Duplicate Write Proof

PASS: 2 identical attempts converged to one parent and 5 total metric/record rows with zero duplicates.

## 26. Current Concurrent Persistence Proof

PASS: two controlled transactions completed. Final checksum matched one whole accepted payload and retained 2 points; no mixed set existed.

## 27. Verification Concurrent Persistence Proof

PASS: two controlled transactions completed. Final checksum matched one whole accepted payload and retained 5 metric/record rows; no mixed set existed.

## 28. Failure Before Persistence

PASS: controlled failures before repository invocation attempted zero write-sets and left zero rows.

## 29. Failure During Persistence

PASS: failure injected after the complete production transaction callback forced rollback; parent and all children remained zero.

## 30. Partial-State Safety

No partial state was prepared-readable after rollback, and task-owned cleanup ended with zero parents and children.

## 31. Retry After Failure

PASS: both failed identities accepted a later successful retry and converged to one lawful artifact.

## 32. Retry After Uncertain Commit

PASS: after a simulated lost acknowledgement following commit, prepared read succeeded and replay converged to one artifact with exact child cardinality.

## 33. Owner Lifetime and Persistence Settlement

Current and Verification service tests prove the single-flight entry remains active until persistence settles.

## 34. Late Arrival During Persistence

A late exact-key request during blocked persistence joined the existing owner and did not invoke a second write.

## 35. Release Race

Release was absent while persistence was blocked; after settlement the entry released, and a post-release request lawfully acquired a new owner.

## 36. Prepared After Persistence

Exact production repository reads returned the complete Current and Verification artifacts after successful persistence.

## 37. Prepared After Duplicate Persistence

Prepared reads remained exact after sequential duplicate writes and after uncertain-commit replay.

## 38. Current Artifact Cardinality

Current normal, duplicate, concurrent, retry, and replay scenarios each ended with one canonical parent.

## 39. Verification Artifact Cardinality

Verification normal, duplicate, concurrent, retry, and replay scenarios each ended with one canonical parent.

## 40. Current Child-Row Cardinality

Current retained exactly two horizon point rows; no duplicate horizon survived.

## 41. Verification Record Cardinality

Verification retained exactly two metric rows and three origin records; no duplicate metric or origin survived.

## 42. Cross-Identity Isolation

Four distinct history-fingerprint identities persisted independently and all four were exactly readable.

## 43. Current-vs-Verification Persistence Isolation

Current and Verification use separate tables, artifact families, logical-key namespaces, and prepared-read functions; collision count is zero.

## 44. Persistence Operation Isolation

The frozen key test proves persistenceOperation changes produce different ownership keys.

## 45. Persistence Schema Version

`persistenceSchemaVersion = forecast-library-prisma-v1`; changing it produces a different ownership key.

## 46. Persistence Telemetry

Stage A records every attempt, success/failure classification, parent count, child count, expected cardinality, checksum set, and cleanup state.

## 47. Persistence Metrics

Normal attempts were 1 per family; sequential, concurrent, retry, and uncertain-commit scenarios were 2 each per family. Canonical parent count remained 1 and duplicate child count 0.

## 48. H0 Final Result

`H0 RESULT = PASS`.

## 49. H0 Failure Classification

`H0 FAILURE = NONE`.

## 50. H1 Eligibility Decision

`H1 ELIGIBLE = NO / NOT_REQUIRED`.

## 51. H1 Implementation

`H1 IMPLEMENTATION = NONE`.

## 52. H1 Validation

`H1 VALIDATION = NOT_APPLICABLE`.

## 53. Additional Persistence Mechanism Decision

`ADDITIONAL_PERSISTENCE_MECHANISM_REQUIRED = NO`; `PERSISTENCE_IDEMPOTENCY_IMPLEMENTATION = NONE`; `PERSISTENCE_SOURCE_BEHAVIOR_CHANGED = NO`.

## 54. Current Single-Flight Regression

PASS: Current primitive and service ownership tests are included in SG Runtime 169/169; active entries return to zero.

## 55. Verification Single-Flight Regression

PASS: Verification primitive and service ownership tests are included in SG Runtime 169/169; active entries return to zero.

## 56. Prepared Verification Regression

PASS: P06 and P07 returned canonical prepared Verification responses with zero compute or writes.

## 57. Search and Prepared Current Regression

PASS: P01, P02, P09, and P10 returned canonical responses with zero compute, provider calls, writes, or owners.

## 58. Functional Regression

Forecast Core 218/218, SG Runtime 169/169, Dashboard 100/100, and Phase tooling 31/31 pass. SG Runtime, Dashboard, and Data Runtime typechecks pass.

## 59. Methodology and Scope Guards

No model math, forecast semantics, cadence, origin policy, Verification metrics, prediction bands, selection, schema, locks, services, provider access, capacity tuning, or load waves changed.

## 60. Cross-Instance Limitation

Cross-instance compute prevention remains NOT_PROVEN. A narrow database invariant is proven: concurrent same-identity transactions converge to one complete canonical parent/child state on PostgreSQL.

## 61. Migration Readiness

PASS: 31 task-attributed paths are classified; new nested Git repositories and external source repositories equal zero.

## 62. Phase 2.2B-3 Final Gate

`PHASE_2_2B_3_GATE = PASS`; `PERSISTENCE_OWNERSHIP_STRUCTURAL_RESULT = PASS`; 84/84 conditions PASS; Phase 2.2B-4 is not started.

## 63. Recommended Next Decision

Recommend authorizing Phase 2.2B-4 - BEFORE vs AFTER Comparative Stress Test. Do not begin it in this phase.

## 64. STOP

STOP — PHASE 2.2B-3 PERSISTENCE OWNERSHIP / IDEMPOTENCY EXPERIMENT COMPLETE. PHASE 2.2B-4 NOT AUTHORIZED.
