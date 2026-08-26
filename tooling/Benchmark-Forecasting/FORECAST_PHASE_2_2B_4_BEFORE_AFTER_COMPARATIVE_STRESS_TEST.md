# Forecast Phase 2.2B-4 Before vs After Comparative Stress Test

Generated: 2026-08-25T09:41:58.741Z

## 1. Executive Summary
Phase 2.2B-4 executed the frozen matrix and found a hard structural failure in P04. The gate is `FAIL`; Phase 2.2C remains unauthorized and not ready for authorization.

## 2. Objective
Quantify the accepted B1-B3 AFTER state against immutable BEFORE evidence without changing runtime behavior.

## 3. Accepted Phase State
Phase 2.1, 2.2A, 2.2B-0, 2.2B-1, 2.2B-2, and 2.2B-3 remain accepted.

## 4. Frozen Contracts
Stress Test Contract v1, Measurement Control revision 2, and Single-Flight Experiment Contract v1 remain unchanged.

## 5. Scope Boundary
No BEFORE rerun, optimization, tuning, methodology change, production DB mutation, or Phase 2.2C execution occurred.

## 6. Meaning of the B4 Gate
The B4 gate evaluates lawful experiment execution. Structural duplicate work is an exact hard gate; performance cannot compensate.

## 7. BEFORE Evidence Authority
All 22 immutable references passed SHA-256 verification. Authority: `tooling/Benchmark-Forecasting/performance/phase-2-2b-before-evidence.json`.

## 8. BEFORE Evidence Classes
P03/P04/P05 support lawful numeric cells where structural gates pass. P08 and P11 are structural authorities; unsupported ratios remain `NOT_COMPARABLE`.

## 9. AFTER Architecture
Current and Verification use accepted in-process exact-key single-flight. Persistence remains existing transactional replacement/upsert with no additional mechanism.

## 10. Environment Snapshot
AFTER used `phase-2-1-local-isolated-v1` on the isolated loopback clone `phase-2-1-local-clone-v1`.

## 11. Environment Comparability
Environment control is sufficient for lawful cells; evidence-class and structural failures still prohibit unsupported numeric comparisons.

## 12. Execution Matrix
Exactly 6 frozen B4 rows were accounted. Original execution: `2026-08-25T073804-869Z-47dca741-ffcc-4a8a-a359-18467b69254d`; controlled P06/P07 state correction: `2026-08-25T092417-585Z-458c07e4-ba8f-4e82-a25e-361bf6284926`.

## 13. Execution Accounting
Rows: 0 VALID_COMPLETED, 6 SAFETY_BLOCKED, 0 INVALID_STATE, 0 CONTRACT_ABORTED.

## 14. State Reproduction
Snapshots were restored and validators were fail-closed before each wave. The accepted Phase 2.2A Verification READY preparation was added for the controlled P06/P07 correction.

## 15. Safety and Escalation
Sequential levels were used, but P04 escalation incorrectly continued after its @10 ownership failure. This is an experiment-control failure.

## 16. Measurement Contract
Only `VALID_COMPLETED` cells enter numeric aggregates. Blocked, invalid, prohibited, and structurally failed cells remain separately visible.

## 17. Correctness Gate
Canonical valid responses remain correct. Capacity and transient service failures stopped affected paths; the deterministic prepared regression passed.

## 18. Structural Ownership Gate
P03/P05/P08/P11 pass ownership at reached lawful levels. P04 fails: three exact keys produced six computes and three duplicates at 10 users.

## 19. Performance Evidence Gate
Absolute metrics are retained. Ratios are emitted only for mathematically and structurally lawful BEFORE/AFTER pairs.

## 20. Current Ownership Metrics
Current owner, waiter, compute, prepared-reader, duplicate, and settlement telemetry is retained per raw observation.

## 21. Verification Ownership Metrics
Verification owner, waiter, full-backtest, origin/fit, and settlement evidence is retained; P08 remains structurally comparable only.

## 22. Persistence Metrics
P03 and P05 duplicate writes fell to zero. P04 retained three duplicate write attempts at 10; final canonical idempotency remained preserved.

## 23. UX Metrics
p50/p95/p99, throughput, and user-visible P11 latency are reported as absolute values where valid.

## 24. Resource Metrics
CPU and peak RSS are recorded. Post-cooldown RSS and DB-pool settlement were not recorded, which fails the measurement gate.

## 25. Error Metrics
Successes, application/HTTP failures, error rate, provider calls, and functional outcomes are preserved in raw evidence.

## 26. P03 BEFORE
BEFORE: 10 computes, 9 duplicates, and 9 duplicate writes per model at 10 users.

## 27. P03 AFTER
AFTER: one owner/compute, zero duplicates, and ten canonical responses per model at 10 users. 100 users hit a no-compute service stop.

## 28. P03 Comparative Result
Structural effect is confirmed at 10. UX improves for Naive, ETS, and ARIMA and regresses for Damped Holt; resource effect is mixed.

## 29. P04 BEFORE
BEFORE: 10 computes/7 duplicates at 10 and 100 computes/97 duplicates at 100 for three exact keys.

## 30. P04 AFTER
Observed AFTER @10 produced three owners, six computes, three duplicate computes, and three duplicate writes for every model.

## 31. P04 Comparative Result
P04 is `OWNERSHIP_FAIL`. @100/@1000 observations followed a prohibited escalation and are excluded from numeric comparison.

## 32. P05 BEFORE
BEFORE ETS @10: 10 computes, 9 duplicates, 9 duplicate writes, provider calls zero.

## 33. P05 AFTER
AFTER ETS @10: one compute, zero duplicates, zero duplicate writes, canonical responses; 100 users safety-stopped without compute.

## 34. P05 Comparative Result
Current duplication improved at 10. Provider cost remains `NOT_COMPARABLE` because both accepted sides report zero provider calls.

## 35. P08 BEFORE
BEFORE is two-caller safety evidence: two full Verification executions and one duplicate.

## 36. P08 AFTER
Exact B2 two-caller AFTER evidence has one owner/backtest and zero duplicates. B4 @10 preserves one backtest per model before a 100-user stop.

## 37. P08 Comparative Result
Verification structural effect is `CONFIRMED`; numeric BEFORE performance ratios remain `NOT_COMPARABLE`.

## 38. P11 BEFORE
BEFORE two callers produced two Current computes; Phase 2.2A timing is not performance evidence.

## 39. P11 AFTER
Exact B1 two-caller AFTER evidence has one owner/compute. B4 @10 remains canonical with zero duplicate Current compute.

## 40. P11 Comparative Result
P11 structural effect is confirmed; user-visible performance is `NOT_COMPARABLE`; 100-user HTTP capacity limits remain.

## 41. P01 Prepared Regression
PASS: deterministic HOT SAME_KEY prepared regression is canonical and compute-free.

## 42. P02 Prepared Regression
PASS through 100; 1000 is lawfully safety-classified. Deterministic prepared regression passes.

## 43. P06 Prepared Verification Regression
PASS: deterministic Verification READY regression returned 2/2 canonical responses with zero compute, owners, providers, or writes. The stress wave retained one transient application-error stop.

## 44. P07 Prepared Verification Regression
PASS through 100 with exact READY preparation; 1000 is safety-blocked.

## 45. P09 Search Regression
PASS and Forecast-compute-free through 100; 1000 is safety-blocked.

## 46. P10 HOT Show Forecast Regression
PASS through 1000 with prepared, compute-free, owner-free responses.

## 47. Compute Reduction
P03/P05/P08/P11 confirm exact-key reduction. P04 disproves complete Current duplicate elimination under SMALL_POOL overlap.

## 48. Duplicate Persistence Reduction
P03/P05 eliminate duplicate write attempts; P04 does not. Effective final-state idempotency remains preserved, but write-set elimination is incomplete.

## 49. CPU Comparison
CPU is mixed by model and scenario; no threshold-based claim is made.

## 50. Memory Comparison
Peak RSS often increased. Post-cooldown RSS is missing, so the resource conclusion is `MIXED` and the measurement condition fails.

## 51. Database Activity Comparison
DB row activity is retained where available. Query count and DB-pool settlement were unavailable; no DB tuning occurred.

## 52. Throughput Comparison
Throughput improves for several P03/P04 cells and regresses for others. Structurally failed P04 cells are not promoted.

## 53. p50 Comparison
p50 is model-specific and mixed; absolute values are retained in the comparison artifact.

## 54. p95 Comparison
p95 is model-specific and mixed; no aggregate headline hides differences.

## 55. p99 Comparison
p99 is model-specific and mixed; unsupported rows remain `NOT_COMPARABLE`.

## 56. Capability Recovery
No new maximum concurrency capability is formally proven. Multiple 100/1000-user limits remain.

## 57. Model-Specific Findings
Naive, Damped Holt, ETS, and ARIMA results remain separate. No champion or model-selection decision is made.

## 58. Remaining Bottlenecks
Remaining bounds: P04 duplicate work, HTTP capacity, intrinsic Verification backtest cost, and one transient prepared-service failure.

## 59. High-Concurrency HTTP Findings
P03/P05/P08/P11 stop at 100; P02/P07/P09 stop at 1000. P04 higher observations are inadmissible because @10 required a stop.

## 60. Cross-Instance Limitation
Cross-instance compute prevention remains `NOT_PROVEN`; in-process evidence is not promoted to a distributed claim.

## 61. Provider Boundary
Provider amplification is not proven solved. Provider performance is `NOT_MEASURED`.

## 62. Phase 2.2C Handoff
Capacity evidence is recorded, but Phase 2.2C is not ready until P04 ownership and B4 measurement-control gaps are resolved.

## 63. Functional Regression
Applicable Forecast Core, SG Runtime, Dashboard, tooling, and typecheck results are recorded in the B4 regression artifact.

## 64. Methodology and Scope Guards
No model math, semantics, cadence, origin, bands, selection, infrastructure, lock, queue, tuning, or runtime behavior change occurred.

## 65. Migration Readiness
12 task-owned paths are classified; nested and external repositories remain zero.

## 66. Phase 2.2B-4 Final Gate
`PHASE_2_2B_4_GATE = FAIL`: 92 PASS, 0 BLOCKED, 4 FAIL. Comparative execution is terminal; the B series is not complete.

## 67. Recommended Next Decision
Do not authorize Phase 2.2C. First resolve P04 exact-key duplicate compute and rerun B4 with complete cooldown/RSS/DB-pool evidence under separate authorization.

## 68. STOP
STOP — PHASE 2.2B-4 BEFORE vs AFTER COMPARATIVE STRESS TEST COMPLETE. PHASE 2.2C NOT AUTHORIZED.
