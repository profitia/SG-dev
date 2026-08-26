# Forecast Phase 2.2C - HTTP Capacity Diagnosis

## 1. Executive Summary

Phase 2.2C diagnoses P09 as an application DB read-fan-out bound with the client timeout downstream. The accepted P10 settlement anomaly is measurement contamination from P09; clean P10 has no application-DB activity and settles fully.

## 2. Objective

Find the first material queue/capacity boundary without tuning, changing Forecast behavior, or selecting an optimization.

## 3. Accepted Phase State

B4R remains PASS, the 2.2B series is complete, Current and Verification structural effects remain CONFIRMED, and persistence idempotency remains PRESERVED.

## 4. B4R Capacity Handoff

P09@1000: 234 successes, 766 timeouts, application settlement 17 active/17 waiting. Accepted P10@10: 10/10 correct but 15 active/14 waiting in the shared process.

## 5. Scope Boundary

Diagnosis and default-off observability only. No pool, query, index, timeout, HTTP, Node, infrastructure, Forecast method, single-flight, persistence, or provider behavior changed.

## 6. Diagnostic Principles

Artifact first; distinguish root cause, secondary pressure, and downstream timeout; mark absent evidence NOT_OBSERVABLE.

## 7. Immutable Evidence Authority

Twenty-two BEFORE references, original B4 hashes, accepted 1R, accepted B4R, and exact P09/P10 raw wrappers were hash-verified.

## 8. Diagnostic Stages

C0 artifact diagnosis -> C1 static mapping -> C2 default-off observability -> C3 one P10 replay -> C4 causal classification -> C5 handoff.

## 9. Artifact-Only Diagnosis

C0 established the symptoms and static routes but lacked route/query timestamps and could not separate P10-owned activity from P09 residue.

## 10. Replay Decision

DIAGNOSTIC_REPLAY_REQUIRED = YES. Exactly one P10@10 replay was needed to disprove or confirm cross-scenario contamination.

## 11. P09 Accepted Evidence

Wave 2026-08-25T13:48:21.098Z to 2026-08-25T13:50:41.535Z; 1000 attempts; 234 success; 766 client timeouts; p50 120080.508 ms; cooldown 30076 ms; post-cooldown RSS 1461.234375 MB.

## 12. P10 Accepted Evidence

Accepted shared-process P10 completed 10/10 in p50 38092.262 ms with zero compute/owners/provider calls, but inherited application DB activity after P09.

## 13. P09 Request Lifecycle

CLIENT_REQUEST_CREATED/SENT and REQUEST_SETTLED are aggregate-observable. HTTP_ACCEPTED through RESPONSE_COMPLETED are NOT_OBSERVABLE in accepted P09. Each admitted request statically enters components, application read, in-memory mapping, then analytics series.

## 14. P10 Request Lifecycle

All 10 clean requests were HTTP_ACCEPTED and route-observed. Prepared resolution p50 139.762 ms; market DB operation p50 132.735 ms; serialization p50 0.155 ms; client settlement p50 657.975 ms.

## 15. Timeout Authority Map

The only timeout observed firing is the 120000 ms stress-client AbortSignal. The 20000 ms Dashboard production fallback timeout is not on either prepared P10 or P09 search path. DB and inbound server timeouts are not explicitly configured.

## 16. P09 Timeout Classification

P09_TIMEOUT_IS = DOWNSTREAM_SYMPTOM. The client timeout stops waiting but does not cancel route/Prisma work, evidenced by 17 active waiting PostgreSQL backends after a further 30-second cooldown.

## 17. Database Connection Architecture

Four singleton Prisma creation sites exist across the two services: Dashboard application and market-data Prisma 7 adapter clients; SG Runtime application and market-data Prisma 5 clients. P09 uses Dashboard application plus SG Runtime market data; P10 uses Dashboard market data.

## 18. Prisma Client Lifecycle

Clients are service/global singletons, not per-request. Connection limit, pool timeout, and application_name are IMPLICIT / NOT_EXPLICITLY_CONFIGURED.

## 19. DB Pool Waiter Definition

B4R waitingRequests counts non-idle pg_stat_activity backends whose wait_event is non-null. It is not a measurement of Prisma client-side acquisition queue depth.

## 20. P09 Database Activity

The component route performs a full ordered application-table read before in-memory filtering. Concurrent expired-cache misses are not coalesced. Historical lookup then performs one SG Runtime market-data repository call for requests that advance.

## 21. P10 Database Activity

Clean replay market data: 14 logical ORM query operations, zero writes, 14 transaction commits. Application DB had zero sessions before and after; its four counter commits came from the harness observation commands, not P10.

## 22. P09 Query Inventory

Per admitted request: one Dashboard application findMany for all matching records; after component success, one SG Runtime marketSeries findUnique including hydration and observations. Forecast compute is absent.

## 23. P10 Query Inventory

POINT_IN_TIME uses two sequential prepared reads; generic-period hits use one. Distribution 4 point-in-time and 6 generic requests produced 14 operations.

## 24. DB Acquisition Amplification

Exact physical acquisitions are NOT_OBSERVABLE. Logical P09 ORM calls are up to 2 per completed logical request; P10 is 2 for point-in-time and 1 for generic, mean 1.4.

## 25. DB Query Amplification

P09 TTL cache misses can fan one synchronized wave into one full application read per admitted component request. P10 query amplification is exactly 14 logical operations for 10 requests in the replay.

## 26. Connection Acquisition Latency

P09 Prisma acquisition wait is NOT_OBSERVABLE and must not be inferred from PostgreSQL wait_event. P10 spans combine acquisition and execution; separate acquisition latency remains NOT_OBSERVABLE.

## 27. Query Execution Latency

P10 combined DB operation timing: p50 132.735, p95 142.832, p99 143.57, max 143.755 ms. Accepted P09 per-query execution timing is NOT_OBSERVABLE.

## 28. Pool Wait vs Query Wait

P09 proves PostgreSQL-side waiting/active work after client settlement, not a Prisma pool queue. The first material bound is application DB read fan-out; acquisition-vs-server execution split remains an explicit unknown.

## 29. Event Loop Evidence

Clean P10 event-loop delay mean/max were approximately 28.172/28.180 ms. Accepted P09 has no event-loop sample, so EVENT_LOOP_BOUND is not promoted.

## 30. CPU Evidence

Accepted P09 dashboard process CPU advanced about 35 seconds during cooldown, supporting continued work but not proving saturation. Clean P10 cooldown added about 1.28 process CPU seconds and settled.

## 31. Memory Evidence

P09 post-cooldown RSS was 1461.234375 MB without a baseline/peak. Clean P10 process-tree RSS fell from 861.859375 to 606.125 MB; MEMORY_BOUND is not established.

## 32. HTTP Connection Evidence

Socket and keep-alive counts are NOT_OBSERVABLE. No connection reset/error was recorded in clean P10.

## 33. HTTP Admission Evidence

Accepted P09 route admission count is NOT_OBSERVABLE. Clean P10 admitted all 10, reached peak activeRequests=10, and drained to zero.

## 34. Serialization Evidence

Clean P10 response serialization p50 0.155 ms and max 1.301 ms; not material. Accepted P09 serialization timing is NOT_OBSERVABLE.

## 35. Response Drain Evidence

Clean P10 route completion preceded aggregate client settlement by at most tens of milliseconds after compilation. Per-request socket drain is NOT_OBSERVABLE; no evidence supports a drain bound.

## 36. Diagnostic Instrumentation

FORECAST_PHASE_2_2C_DIAGNOSTICS=1 gates route, span, resource, and read-only pg_stat_activity evidence. Default production behavior is unchanged.

## 37. Instrumentation Overhead

Structured sampled timestamps/counters only; 10 P10 requests were fully sampled. No SQL text, payload bodies, high-frequency polling, or behavior-changing hook was added.

## 38. P10 Diagnostic Replay

EXECUTED_ONCE. 10/10 success, p50 657.975 ms, zero compute/owners/writes/provider calls, and both DB authorities settled 0 active/0 waiting.

## 39. P09 Control Replay

NOT_REQUIRED. Existing exact frozen P09@100 controls were sufficient: r1: 24825.468 ms p50, 100/100 success; r2: 25089.62 ms p50, 100/100 success; r3: 24057.456 ms p50, 100/100 success.

## 40. P09@1000 Diagnostic Replay

NOT_REQUIRED. The clean P10 separation plus accepted P09 evidence and static route fan-out establish the material diagnosis without another high-risk 1000-user wave.

## 41. Safety and Settlement

The diagnostic replay used the isolated clone, exact state restoration, 30-second cooldown, zero registries/computes, and clean process startup. Settlement = PASS.

## 42. P09 First Capacity Boundary

P09_FIRST_CAPACITY_BOUND = APPLICATION_DB_READ_FAN_OUT. This is earlier than mapping, response, and the 120-second client timeout.

## 43. P10 First Capacity Boundary

P10_FIRST_CAPACITY_BOUND = NOT_OBSERVED_THROUGH_10. The accepted settlement anomaly was not P10-owned.

## 44. P09 Primary and Secondary Causes

PRIMARY = CONCURRENT_UNCOALESCED_FULL_TABLE_APPLICATION_READS. SECONDARY = continued server work after client cancellation, CPU/mapping pressure, and the 120-second client timeout.

## 45. P10 Primary and Secondary Causes

PRIMARY (accepted anomaly) = MEASUREMENT_CONTAMINATION_FROM_PRECEDING_P09. SECONDARY = dev cold-route compilation in clean replay; no material capacity bound through 10.

## 46. P09 Causal Chain

1000 synchronized clients -> concurrent expired-cache component reads -> application DB/read-and-mapping fan-out -> client waits reach 120 seconds -> 766 client aborts -> server work lacks propagated cancellation -> 17 application backends remain active/waiting after cooldown.

## 47. P10 Causal Chain

Unsettled P09 work in shared dashboard process -> P10 performs only market-data prepared reads -> 10 correct responses -> settlement samples application DB residue -> P10 incorrectly appears application-DB-bound. Clean process removes residue and settles.

## 48. Capacity Envelope

P09 PROVEN_THROUGH=100 and BLOCKED_AT=1000. P10 correct and fully settled through 10 in a clean process; no higher concurrency was measured.

## 49. Root-Cause Candidate Matrix

Sixteen required candidates are evaluated. Material results: P09 DB_QUERY_LATENCY_BOUND=STRONGLY_SUPPORTED; P10 contamination=PROVEN_FOR_ACCEPTED_P10_SETTLEMENT.

## 50. Root-Cause Confidence

P09 = STRONGLY_SUPPORTED because the fan-out is statically exact and temporally consistent, while acquisition-vs-execution timing is absent. P10 contamination = PROVEN by route authority and clean-process replay.

## 51. Remaining Unknowns

P09 exact route admission count, physical acquisition count/wait, server-side query duration, socket inventory, event-loop distribution, serialization, and response drain at 1000 remain NOT_OBSERVABLE.

## 52. Candidate Optimization Levers

6 evidence-backed candidates are recorded without selection: cache-miss coalescing, bounded query/filtering, cancellation propagation, concurrency control, deferred pool evaluation, and scenario isolation.

## 53. Correctness / Cost / UX Evaluation

Every lever includes correctness risk, runtime/infrastructure/maintenance cost, and reproducibility/UX impact. No single dimension dominates and no Champion is selected.

## 54. Phase 2.2D Handoff

READY_FOR_AUTHORIZATION because at least one material cause is PROVEN/STRONGLY_SUPPORTED and candidate mechanisms can be compared. Phase 2.2D remains unauthorized and unstarted.

## 55. Cross-Instance Boundary

CROSS_INSTANCE_CURRENT_DUPLICATE_PREVENTION = NOT_PROVEN. CROSS_INSTANCE_VERIFICATION_DUPLICATE_PREVENTION = NOT_PROVEN.

## 56. Provider Boundary

Provider calls remained zero. PROVIDER_SAVINGS = NOT_MEASURED.

## 57. Functional Regression

12/12 applicable non-stress checks PASS; stress execution observed = false.

## 58. Methodology / Scope / Migration Guards

No Forecast math, serving, single-flight, persistence, DB/HTTP/Node/timeout/infrastructure configuration changed. Migration readiness PASS across 31 paths; new nested Git/external repositories = 0/0.

## 59. Phase 2.2C Final Gate

PHASE_2_2C_GATE = PASS; 84/84 PASS, 0 BLOCKED, 0 FAIL. Diagnosis complete; Phase 2.2D ready for a separate authorization decision only.

## 60. STOP

STOP — PHASE 2.2C HTTP CAPACITY DIAGNOSIS COMPLETE. PHASE 2.2D NOT AUTHORIZED.
