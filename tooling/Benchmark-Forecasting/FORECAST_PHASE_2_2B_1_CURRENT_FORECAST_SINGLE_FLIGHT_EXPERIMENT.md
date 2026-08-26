# Forecast Phase 2.2B-1 Current Forecast Single-Flight Experiment

## 1. Executive Summary

Phase 2.2B-1 passes. Exact-key in-process ownership reduced every authorized overlapping Current row to one owner and one compute, with canonical responses and zero retained entries.

## 2. Objective

Test only the lowest-cost Current ownership hypothesis against frozen correctness, structural ownership, and preliminary resource/UX gates.

## 3. Accepted Phase State

Phase 2.1, Phase 2.2A, and Phase 2.2B-0 remain PASS. Their accepted evidence was read, not regenerated or modified.

## 4. Frozen Experiment Contract

Single-Flight Experiment Contract version 1, Stress Test Contract version 1, and Measurement Control revision 2 remain authoritative with zero contract drift.

## 5. Scope Boundary

Implemented Current Forecast ownership only. Verification, provider, persistence redesign, distributed coordination, and formal comparative stress remain out of scope.

## 6. Experiment Hypothesis

`IN_PROCESS_EXACT_KEY_SINGLE_FLIGHT`: overlapping requests for one exact Current identity share one active promise inside one SG Runtime process.

## 7. Three Evaluation Gates

Correctness PASS, structural ownership PASS, and preliminary UX/resource observation NOT_COMPARABLE without an arbitrary improvement threshold.

## 8. Immutable BEFORE Evidence

Frozen hashes pass. P03 BEFORE is 10 computes and 9 duplicates per model; P11 BEFORE is 2 computes and 1 duplicate.

## 9. Current Logical Artifact Key

Uses `CURRENT_LOGICAL_ARTIFACT_KEY_V1` with all 14 frozen identity fields and the `CURRENT` namespace.

## 10. Key Serialization

Length-prefixed UTF-8 field-name/value pairs are serialized in frozen order with explicit `<NULL>` representation.

## 11. Key Resolution Boundary

Full identity, including lawful horizon configuration, resolves after persisted miss and before ownership acquisition. Missing required identity fails closed.

## 12. Current-vs-Verification Isolation

Current and Verification namespaces cannot collide; Verification does not use the new registry.

## 13. Runtime Ownership Location

The registry lives in SG Runtime beside the Generic Period Current compute owner, not in Dashboard.

## 14. Registry Architecture

A module-level map stores active exact-key promises only. Unrelated keys acquire independent owners and may compute concurrently.

## 15. Registry Is Not a Cache

Successful and failed entries release in `finally`; no completed result or failed promise is retained for reuse.

## 16. Owner Role

The first exact-key miss registers the owner promise and executes the existing compute, mapping, and persistence attempt.

## 17. Waiter Role

A concurrent exact-key caller joins the active promise and does not invoke Current compute.

## 18. Prepared Reader Role

Prepared hits return before registry lookup and remain compute-free.

## 19. Daily Ownership Preservation

Rolling Daily methodology and snapshot ownership are unchanged. The shared primitive does not merge Daily and Period methodology owners.

## 20. Period Ownership Preservation

Generic Period remains the Current compute and persistence owner; only overlapping exact-key execution is coordinated.

## 21. Prepared-First Flow

Every request performs the existing persisted Current read first. Single-flight is considered only after an exact miss or stale result.

## 22. MISS-to-Ownership Flow

Persisted miss -> resolve exact identity -> lookup active key -> become OWNER or join as WAITER -> settle -> release.

## 23. Owner Success Semantics

The existing Current result and persistence attempt settle before waiters receive the canonical owner result and the entry releases.

## 24. Owner Failure Semantics

The owner error is shared lawfully with attached waiters; the entry releases on the same `finally` path.

## 25. Failure Retry Semantics

A failed key is not poisoned. A later exact-key request may acquire a new owner.

## 26. Waiter Cancellation Semantics

Local waiter cancellation does not cancel shared owner work or alter other waiter results.

## 27. Owner Disconnect Semantics

No new HTTP-disconnect cancellation architecture was introduced; shared work follows existing runtime behavior.

## 28. Timeout Carry-Forward

No owner or waiter timeout was added. The existing Dashboard HTTP timeout remains 20,000 ms and was not tuned.

## 29. Late Arrival Semantics

A caller before owner settlement joins; a caller after release follows normal prepared-read or new-owner behavior.

## 30. Release Race

Release is observable through `single_flight_entry_released` and active count; deterministic late-arrival tests pass.

## 31. Fingerprint Isolation

A changed history fingerprint produces a distinct exact key.

## 32. Origin Isolation

A changed forecast origin produces a distinct exact key.

## 33. Horizon Isolation

A changed exact horizon configuration produces a distinct exact key.

## 34. Model Isolation

Naive, Damped Holt, ETS, and ARIMA each use separate exact keys and independently pass P03.

## 35. Semantic Isolation

Target basis and target semantics participate in the key; semantic variants cannot share work.

## 36. Cadence Isolation

Source frequency, target cadence, and frequency identity participate in the key.

## 37. Telemetry Implementation

All frozen `single_flight_*` events, request correlation, owner request ID, role, identity, durations, and active entry counts are emitted without behavior changes.

## 38. Registry Cleanup Proof

Active entries equal zero after success, failure, retry, ten-waiter deterministic proof, two-user live proof, P11, and every P03 model row.

## 39. Deterministic Ownership Tests

Ten same-key callers produce 1 owner, 9 waiters, 1 callback, 10 equivalent results, and 0 duplicates; different keys run independently.

## 40. Deterministic Failure Tests

Owner failure, waiter failure propagation, cleanup, retry, late arrival, and cancellation-locality tests pass.

## 41. Two-User Current Ownership Proof

2 requests -> 1 key -> 1 owner -> 1 waiter -> 1 compute -> 0 duplicates -> 2 canonical responses -> active 0.

## 42. P11 BEFORE

Accepted Phase 2.2A carry-forward: 2 concurrent WARM Show Forecast callers returned canonical responses and executed 2 Current computes.

## 43. P11 AFTER

2 callers produced 1 owner, 1 waiter, 1 Current compute, 1 canonical write-set, 0 duplicates, and active count 0.

## 44. P11 Correctness Equivalence

Both callers share one canonical checksum across series, model, semantics, cadence, method version, fingerprint, origin, dates, and values.

## 45. P03 BEFORE

Immutable Phase 2.1 evidence records 10 Current computes and 9 duplicate computes for each exact-key model row.

## 46. P03 AFTER

| Scenario | Model/Semantic | BEFORE computes | AFTER computes | Logical keys | Owners | Waiters | AFTER duplicates | Correctness |
|---|---|---:|---:|---:|---:|---:|---:|---|
| P11@2 | naive / Monthly Average | 2 | 1 | 1 | 1 | 1 | 0 | PASS |
| P03@10 | naive / Monthly Average | 10 | 1 | 1 | 1 | 9 | 0 | PASS |
| P03@10 | damped_holt / Monthly Average | 10 | 1 | 1 | 1 | 9 | 0 | PASS |
| P03@10 | ets / Monthly Average | 10 | 1 | 1 | 1 | 9 | 0 | PASS |
| P03@10 | arima / Monthly Average | 10 | 1 | 1 | 1 | 9 | 0 | PASS |

## 47. P03 Model Coverage

Naive, Damped Holt, ETS, and ARIMA were executed independently at the only authorized P03 concurrency, 10.

## 48. Structural Ownership Result

Every live exact-key row has exactly one owner; observed waiters are 1 at concurrency 2 and 9 at concurrency 10.

## 49. Duplicate Compute Result

Duplicate Current compute count is zero in the two-user proof, P11, and every P03 model row.

## 50. Preliminary UX Evidence

Owner and waiter latency were observed per row. Results are preliminary experiment evidence and are not promoted to a baseline.

## 51. Preliminary Resource Evidence

CPU and peak memory were observed with no safety stop. Comparison is `NOT_COMPARABLE` because Phase 2.2A timing is not performance evidence.

## 52. Prepared-Serving Regression

P01, P02, P06, P07, and P10 return canonical prepared responses with zero Current/Verification compute, fits, provider calls, writes, or owners.

## 53. Search Compute-Free Regression

P09 remains canonical and `FORECAST_COMPUTE_DURING_SEARCH = 0`.

## 54. Phase 2.2A Correctness Regression

P01, P06, P07, and P11 correctness remain PASS; accepted Phase 2.2A evidence files were not overwritten.

## 55. Forecast Functional Regression

Forecast Core 218/218, SG Runtime 153/153, Dashboard 100/100, and contract tooling 31/31 pass; both typechecks, diagnostics, and diff check pass.

## 56. Methodology and Scope Guards

No model math, target semantics, cadence, origin, Verification policy, or model selection changed. No Redis, queue, worker, database, service, scheduler, or distributed lock was added.

## 57. Cross-Instance Limitation

This proof is process-local. Cross-instance duplicate prevention remains `NOT_PROVEN`; no production-wide exactly-once claim is made.

## 58. Migration Readiness

The migration delta records 32 task-attributed paths, their logical change, untracked Git status, classification, and future SG-dev inclusion decision.

## 59. Recommended Next Decision

Phase 2.2B-2 is ready for separate authorization to test Verification ownership. It is not authorized and has not started.

## 60. STOP

STOP - PHASE 2.2B-1 CURRENT FORECAST SINGLE-FLIGHT EXPERIMENT COMPLETE. PHASE 2.2B-2 NOT AUTHORIZED.
