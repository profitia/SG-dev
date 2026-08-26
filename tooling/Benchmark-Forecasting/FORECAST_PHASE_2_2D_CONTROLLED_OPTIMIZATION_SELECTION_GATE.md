# Forecast Phase 2.2D - Controlled Optimization Selection Gate

## 1. Executive Summary

C01 CACHE_MISS_COALESCING is selected for a separately authorized Phase 2.3 with STRONGLY_SUPPORTED_DIRECT confidence. It is the smallest intervention that removes duplicate same-key full-table read owners while preserving the existing query, 30-second result cache, business-safe filtering, and Forecast boundaries.

## 2. Objective

Select, defer, or reject the six frozen mechanisms without implementation, tuning, replay, or stress.

## 3. Accepted Phase State

B4R and 2.2C remain PASS; the 2.2B series is complete; Current and Verification structural effects are CONFIRMED; persistence idempotency is PRESERVED.

## 4. Phase 2.2C Diagnosis Authority

P09 is bound first by APPLICATION_DB_READ_FAN_OUT caused by CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS with STRONGLY_SUPPORTED confidence. The timeout is downstream. P10 is NOT_OBSERVED_THROUGH_10.

## 5. Scope Boundary

Decision artifacts and validation tooling only. Runtime behavior, query, cache behavior, pool, index, HTTP, timeout, Node, infrastructure, Forecast ownership, Verification ownership, and persistence are unchanged.

## 6. Decision Principles

Correctness safety, low infrastructure/compute/maintenance cost, and fast reproducible UX are applied equally.

## 7. Immutable Evidence Authority

Verified 22 BEFORE references, 3 original B4 hashes, 7 B4R/1R hashes, and 9 Phase 2.2C hashes.

## 8. Root Cause Restatement

1000 synchronized clients reached concurrent expired-cache component reads. With no miss owner, admitted requests independently executed the same full application-table read and mapping path.

## 9. Root Cause Components

CONCURRENCY_FAN_OUT and MISS_COALESCING are C01 targets; FULL_TABLE_READ and IN_MEMORY_FILTERING are C02 targets; POST_ABORT_SERVER_WORK is C03; the timeout is downstream.

## 10. Decision Method

Reject non-causal mechanisms, defer assumption-dependent mechanisms, compare direct mechanisms, select the smallest sufficient experiment, and keep complements conditional. No weighted numeric score is used.

## 11. Candidate Universe

C01 CACHE_MISS_COALESCING; C02 BOUNDED_QUERY_DB_SIDE_FILTERING; C03 CANCELLATION_PROPAGATION; C04 REQUEST_CONCURRENCY_CONTROL; C05 DEFERRED_DB_POOL_EVALUATION; C06 SCENARIO_ISOLATION.

## 12. Candidate Evidence Levels

C01=STRONGLY_SUPPORTED_DIRECT; C02=STRONGLY_SUPPORTED_DIRECT; C03=SUPPORTED; C04=SUPPORTED; C05=SPECULATIVE; C06=PROVEN_DIRECT.

## 13. Candidate Decision States

C01=SELECT_FOR_PHASE_2_3; C02=CONDITIONAL_SECONDARY; C03=CONDITIONAL_SECONDARY; C04=DEFER; C05=DEFER; C06=REJECT.

## 14. Evaluation Dimensions

Directness, expected effect, correctness/semantic risk, complexity, blast radius, infrastructure/runtime/maintenance cost, reversibility, observability, validation, cross-instance scope, UX, time, dependencies, and unknowns are recorded for every candidate.

## 15. C01 Cache-Miss Coalescing — Mechanism

The cache is one process-local 30-second result entry keyed by organizationId/pipelineId. A miss has no in-flight owner; C01 would share one promise only during an overlapping exact-key miss.

## 16. C01 Root-Cause Coverage

C01 directly removes duplicate same-key read count. The owner full-table read and per-waiter business filtering remain, cleanly separating read-count from read-cost effects.

## 17. C01 Correctness Risks

The exact key, org isolation, TTL, failed-owner cleanup, retry, result equivalence, and cancellation semantics must be preserved. In-flight ownership must not become longer-lived caching.

## 18. C01 Cost / Complexity / UX

One module plus focused tests, no infrastructure, low runtime/maintenance cost, source-only rollback, and expected lower burst sensitivity. Cross-instance coalescing is not provided.

## 19. C02 Bounded Query / DB-Side Filtering — Mechanism

C02 would push request filtering into dr_dashboard_index_records and reduce returned rows/columns. It is not implemented here.

## 20. C02 Root-Cause Coverage

C02 reduces cost per owner read and application mapping, but does not reduce the number of concurrent miss reads.

## 21. C02 Semantic Equivalence Risks

It must preserve business-safe fallback fields, description search from JSON carriers, case/null/locale behavior, tenant/deleted-row scope, ordering, grouping, identity, and response sets.

## 22. C02 Index / Cost / Complexity / UX

Existing indexes do not cover component name/code search; LIKELY_NEW_INDEX_REQUIRED. Benefit is plausible but cardinality and plans are unmeasured, while semantic and validation cost exceed C01.

## 23. C01 vs C02

C01 reduces NUMBER of reads; C02 reduces COST of each read. C01 more directly addresses uncoalesced concurrency, has the smaller semantic surface and rollback, and is selected first. C02 remains useful if one owner read is still costly.

## 24. C03 Cancellation Propagation — Mechanism

The stress client aborts at 120 seconds, but the Dashboard route does not propagate request.signal and Prisma/PostgreSQL cancellation is unproven.

## 25. C03 Root-Cause Coverage

C03 limits damage after abort and may improve recovery; it does not prevent the original synchronized read fan-out.

## 26. C03 Feasibility / Risk / Cost

Route, shared-owner, driver, and database cancellation boundaries require proof. Partial waiter abort must not cancel work needed by other waiters.

## 27. C04 Request Concurrency Control — Mechanism

A semaphore, admission control, per-key limit, or bounded expensive-read queue could cap simultaneous work but would retain redundant work.

## 28. C04 Root-Cause Coverage

C04 caps pressure rather than removing duplicate reads and therefore is not selected as the first cause-removal experiment.

## 29. C04 UX / Fairness / Cost

Queue latency, head-of-line blocking, starvation, rejection semantics, tail latency, and multi-tenant fairness are unspecified. No cap is invented.

## 30. C05 Deferred DB Pool Evaluation

Prisma acquisition count/wait remains NOT_OBSERVABLE. PostgreSQL wait_event is not a client pool queue, so pool tuning is deferred pending direct evidence after fan-out controls.

## 31. C06 Scenario Isolation

C06 is proven measurement hygiene and is retained for validation, but it has no production capacity effect and is rejected as the Phase 2.3 optimization.

## 32. Candidate Interaction Map

15/15 unordered candidate pairs are classified. C01/C02, C01/C03, and C01/C04 are complementary with explicit sequencing; C04/C05 remains UNKNOWN.

## 33. Correctness Safety Comparison

C01 preserves the query and filtering path. C02 has the largest semantic equivalence surface; C03/C04 require new cancellation/admission semantics; C05 changes an unproven bound; C06 is test-only.

## 34. Infrastructure Cost Comparison

C01/C03/C04 require no expected new infrastructure; C02 may require an index; C05 may increase database load/cost; C06 adds test time only.

## 35. Runtime Cost Comparison

C01 adds one small process-local promise map and removes duplicate owner work. C02 lowers read cost. C03 lowers post-abort work. C04 adds queueing. C05 is unknown. C06 is test-only.

## 36. Maintenance Cost Comparison

C01/C06 are LOW; C02/C04/C05 are MEDIUM; C03 is HIGH because cancellation crosses layers and shared ownership.

## 37. Implementation Complexity Comparison

C01 LOW; C02/C03 HIGH; C04 MEDIUM; C05 configuration is superficially LOW but evidence cost HIGH; C06 LOW and test-only.

## 38. Blast Radius Comparison

C01 is one application-read module. C02 spans query/filter/schema concerns. C03 spans HTTP through database. C04 affects admission for users/tenants. C05 affects all DB traffic. C06 affects harness execution only.

## 39. Reversibility Comparison

C01, C04, C05, and C06 are highly reversible; C02 is medium if an index/query migration is involved; C03 is medium because several layers may change.

## 40. UX Impact Comparison

C01 should reduce same-key burst latency variance. C02 may improve owner latency. C03 improves recovery only. C04 can worsen queues. C05 is unknown. C06 has no production UX effect.

## 41. Validation Complexity Comparison

C01 has the cleanest owner-count metric. C02 needs semantic and query-plan proofs. C03 needs abort-layer evidence. C04 needs fairness/load evidence. C05 needs acquisition telemetry. C06 is directly testable but non-production.

## 42. Cross-Instance Implications

C01 is explicitly process-local and does not provide cross-instance miss coalescing. Current and Verification cross-instance duplicate prevention also remain NOT_PROVEN.

## 43. Unknown Assumptions

C01: Accepted P09 exact route admission count is not observable; C01: Benefit across multiple service instances is not provided; C02: Expected result cardinality reduction is not measured; C02: JSON-carried description search cannot be represented by the current top-level predicate; C02: Query planner behavior is unmeasured; C03: Prisma query cancellation is not proven; C03: Exact layer retaining P09 work is not separately timed; C04: Safe cap is not measured; C04: Distinct-key capacity after duplicate removal is unknown; C05: Prisma acquisition count and wait are NOT_OBSERVABLE; C05: Pool parameters are implicit.

## 44. Candidate Decision Table

| ID | Directness | Evidence | Decision | Reason |
|---|---|---|---|---|
| C01 | DIRECT | STRONGLY_SUPPORTED_DIRECT | SELECT_FOR_PHASE_2_3 | Smallest independently testable intervention that directly removes the diagnosed duplicate read count without changing query or response semantics. |
| C02 | DIRECT | STRONGLY_SUPPORTED_DIRECT | CONDITIONAL_SECONDARY | Complementary read-cost reduction, but not the smallest first experiment and carries materially larger semantic and index uncertainty. |
| C03 | PARTIAL | SUPPORTED | CONDITIONAL_SECONDARY | Evidence supports damage limitation after timeout, not prevention of the established first cause. |
| C04 | PARTIAL | SUPPORTED | DEFER | A concurrency cap is not justified before redundant same-key reads are removed and the remaining distinct-key capacity is measured. |
| C05 | INDIRECT | SPECULATIVE | DEFER | Pool tuning depends on an explicitly unobservable boundary and cannot be promoted from PostgreSQL wait_event evidence. |
| C06 | INDIRECT | PROVEN_DIRECT | REJECT | Retained as mandatory validation hygiene, but rejected as the Phase 2.3 production optimization because it does not address the P09 cause. |

## 45. Rejected Candidates

C06 is rejected as the production optimization because scenario isolation cannot reduce P09 production reads; it remains validation hygiene.

## 46. Deferred Candidates

C04 waits for post-C01 distinct-key capacity evidence. C05 waits for direct Prisma acquisition evidence and post-fan-out database capacity evidence.

## 47. Conditional Secondary Candidates

C02: IF C01 proves one owner read per exact miss window but P09 remains capacity-bound or the single owner read remains materially costly, THEN evaluate C02 with semantic-equivalence and index-plan gates. C03: IF C01 is accepted yet timeout/abort cases still leave material server or DB work, THEN prove driver cancellation feasibility and evaluate C03 separately.

## 48. Primary Selection

SELECTED_PHASE_2_3_MECHANISM = C01 / CACHE_MISS_COALESCING.

## 49. Selection Confidence

SELECTION_CONFIDENCE = STRONGLY_SUPPORTED_DIRECT. Source structure proves duplicate miss ownership; accepted capacity evidence proves the material fan-out, while exact P09 admission timing remains unobservable.

## 50. Why the Primary Was Selected

C01 removes the diagnosed duplicate read count with the smallest source, semantic, operational, and rollback surface and an exact owner-count metric.

## 51. Why the Alternatives Were Not Selected

C02 is larger and complementary; C03 is post-abort damage limitation; C04 masks rather than removes duplicate work; C05 relies on unobserved pool evidence; C06 is measurement-only.

## 52. Selection Falsification Criteria

Falsify if P09 keys differ, per-request read results are semantically required, owner cleanup cannot preserve retries, duplicate reads remain, or controlled evidence shows no causal-pressure reduction.

## 53. Expected Causal Effect

For one exact process-local organization/pipeline miss window, expected application full-table read owners change from one per admitted miss to exactly one; no percentage latency claim is made.

## 54. Phase 2.3 Source Surface

apps/dashboard-preview/lib/raw-data/dashboard-record-query.ts; apps/dashboard-preview/tests/dashboard-record-query.test.ts; apps/dashboard-preview/lib/phase-2-2c/diagnostics.ts; tooling/Benchmark-Forecasting/performance/phase-2-3-*.

## 55. Phase 2.3 Correctness Invariants

12 exact invariants preserve keys, isolation, TTL/query/results, failures/retry, search semantics, P09/P10 controls, and Forecast ownership/persistence.

## 56. Phase 2.3 Implementation Boundary

One process-local exact-key in-flight registry around the unchanged application read. C02-C06, distributed ownership, and all Forecast mechanisms are non-goals.

## 57. Phase 2.3 Validation Strategy

A_UNIT_CORRECTNESS -> B_SEMANTIC_EQUIVALENCE -> C_FOCUSED_CONCURRENCY_STRUCTURAL_PROOF -> D_P09_LOWER_CONTROL -> E_P09_HIGH_CONCURRENCY_ONLY_IF_A_TO_D_PASS_AND_SAFETY_GATES_ALLOW -> F_P10_PREPARED_NON_REGRESSION -> G_FULL_NON_STRESS_REGRESSION. No Phase 2.3 validation is executed in Phase 2.2D.

## 58. Phase 2.3 Performance Evidence Plan

Measure exact owner/full-table read count first, then P09 lower control, and only then a safety-gated high-concurrency proof. Preserve isolated P10 and full regression controls.

## 59. Rollback Boundary

Remove the in-flight registry and owner/join branch from dashboard-record-query.ts plus its C01 tests/telemetry; no data, schema, index, configuration, or persistence rollback.

## 60. Observability Plan

Reuse default-off Phase 2.2C read spans only for Phase 2.3 evidence, add an exact owner/join/release metric if authorized, and remove or separately promote diagnostics after validation.

## 61. Functional Regression

13/13 applicable non-stress checks PASS; stress execution observed = false.

## 62. Methodology / Scope / Migration Guards

Migration readiness covers 14 task paths; runtime behavior source changes = 0; nested/external repositories = 0/0.

## 63. Phase 2.2D Final Gate and Recommended Next Decision

PHASE_2_2D_GATE = PASS; 92/92 PASS. Authorize Phase 2.3 separately only for C01.

## 64. STOP

STOP — PHASE 2.2D COMPLETE. PHASE 2.3 READY FOR SEPARATE AUTHORIZATION, NOT AUTHORIZED, AND NOT STARTED.
