# Forecast Phase 2.0 Stress-Test Contract Freeze

Document status: FROZEN

Contract: `STRESS_TEST_CONTRACT_VERSION = 1`

Gate: `FORECAST_PHASE_2_0_GATE = PASS`

Execution boundary: Phase 2.1 is ready for authorization but is not authorized or started by this document.

## 1. Executive Summary

Phase 2.0 freezes a fair, reproducible baseline experiment for Forecast serving, compute, provider, database, concurrency, UX, and resource cost. It does not claim that the current architecture is fast. No mandatory 10/100/1000 workload was executed, no optimization was implemented, and accepted Forecast behavior remains unchanged.

## 2. Phase 2.0 Objective

The experiment must distinguish serving cost, Forecast compute cost, provider cost, database cost, and concurrency-coordination cost. It measures user-perceived speed, backend latency, reliability, resource use, prepared reuse, duplicate work, and normalized cost per interaction.

## 3. Accepted Functional Preconditions

Stage B is complete, Stage C Quarterly is PASS, Stage D is PASS, and full native-frequency functional acceptance is PASS. B1 cadence, B2 orchestration, B3 identity/prepared reads, B4 capability, real Quarterly execution, and Stage D native-frequency acceptance remain authoritative.

## 4. Scope Boundary

Phase 2.0 permits inspection, contract definition, machine manifests, a minimal harness skeleton, and no-network dry-run validation. It prohibits load execution at 10/100/1000, model or semantic changes, cache or warm-up redesign, dedupe, locks, queues, workers, indexes, resource resizing, migration, deployment, and Phase 2.1 execution.

## 5. Three Equal Product Principles

User experience/speed, low infrastructure and compute cost, and methodological correctness have equal product status. Correctness is also a hard gate: no performance result may alter model mathematics, target semantics, origins, lawful history, identity, verification, bands, eligibility, or provenance.

## 6. Current User Flow

Search returns candidates without Forecast compute. Expand loads the Historical Chart, the first meaningful user-intent signal. Existing warm-up may occur only under the accepted production contract. Show Forecast remains the strong compute signal: exact READY artifacts are served; misses use the existing production operation.

## 7. Performance State Taxonomy

The six exact machine labels are `HOT_READY`, `WARM_INPUT_READY_ARTIFACT_MISS`, `COLD_INPUT_AND_ARTIFACT_MISS`, `VERIFICATION_READY`, `VERIFICATION_MISS`, and `UX_SEARCH_EXPAND_HISTORICAL`. The word warm is not used without the full state label.

## 8. HOT_READY Definition

The exact Current artifact exists and is READY for series, semantics, model, cadence, method version, and history fingerprint. The request is a prepared read only. Provider history calls, Forecast compute, model fits, and writes must all equal zero.

## 9. WARM_INPUT_READY_ARTIFACT_MISS Definition

Complete lawful current history exists locally, but the exact Current artifact is absent. Provider hydration is forbidden. The existing production operation performs real Forecast compute and persistence, isolating model, write, and concurrent-compute cost.

## 10. COLD_INPUT_AND_ARTIFACT_MISS Definition

Required local history is absent or incomplete and the exact Current artifact is absent. The controlled path may perform allow-listed provider hydration, Forecast compute, persistence, and response. Provider safety gates every escalation.

## 11. VERIFICATION_READY Definition

The exact Historical Verification artifact exists and is READY. The request is a prepared Verification read. Provider calls, backtests, model fits, and writes must equal zero.

## 12. VERIFICATION_MISS Definition

Complete lawful local history exists and the exact Verification artifact is absent. The existing canonical rolling-origin process executes. Its compute and persistence are measured separately from Current Forecast.

## 13. UX Flow Definition

`UX_SEARCH_EXPAND_HISTORICAL` measures Search, candidate expansion, Historical Chart, capability resolution, and any already-present warm-up behavior without Show Forecast. `FORECAST_COMPUTE_DURING_SEARCH` must equal zero. Show Forecast TTV is measured separately for HOT, WARM miss, and COLD.

## 14. Concurrency Levels

The mandatory levels are exactly 10, 100, and 1000 concurrent virtual users. Escalation is sequential: harness smoke, 10, 100, then 1000. A safety result at a lower level may block escalation and becomes baseline evidence.

## 15. Load Shapes

Primary load is `SYNCHRONIZED_BURST` behind a common start barrier with maximum release spread 250 ms and no silent ramp-up. Secondary load is `CONTROLLED_STEADY_FLOW` at five arrivals per second for 300 seconds, labeled as a controlled assumption rather than factual production traffic.

## 16. Key Distributions

`SAME_KEY` sends one exact logical artifact identity to every user. `SMALL_POOL` assigns users round-robin across the three primary benchmarks. `DISTRIBUTED_KEYS` assigns distinct prevalidated identities with provider access disabled unless a separate safe contract permits it.

## 17. Same-Key Herd Contract

For one exact logical key, expected logical compute count is 1. `DUPLICATE_COMPUTE_COUNT = max(ACTUAL_COMPUTE_COUNT - 1, 0)` and the ratio divides that value by `max(EXPECTED_LOGICAL_COMPUTE_COUNT, 1)`. Equivalent artifact writes after the first successful write are duplicate artifact writes.

## 18. Provider-Safety Contract

COLD uses an exact series allow-list and a minimal precheck before normal escalation. If one logical key creates duplicate hydrations, set `COLD_PROVIDER_ESCALATION_BLOCKED_BY_DUPLICATION = YES` and stop larger provider waves. HOT, WARM miss, and Verification scenarios keep provider hydration disabled.

## 19. Verification-Safety Contract

Verification MISS uses a minimal precheck before 10/100/1000 escalation. Duplicate full backtests for one key block larger waves. The finding is retained as structural baseline evidence; Phase 2.1 may not repair it before baseline.

## 20. Primary Stress Cohort

The immutable primary cohort is Daily `wocaes0074` with Rolling Daily Point-in-Time, native Monthly `wocaes0280` with the accepted Monthly Average baseline, and real Quarterly `usnaac0169` with End-of-Period. All four models are represented where eligible: Naive, Damped Holt, ETS, and ARIMA.

## 21. Compatibility Cohort

The compatibility cohort is Quarterly `usnaac0169`, Bimonthly `istrad0862`, Semiannual `chpric0077`, Annual `cndemo0001`, and Quadmonthly `trsurv1145`. Quadmonthly must reproduce the accepted fail-closed history-gap result without compute. This cohort validates behavior and harness correctness, not maximum load.

## 22. Deterministic State Setup

All mutable setup occurs in a dedicated Phase 2.1 database clone restored from immutable versioned scenario snapshots. HOT and Verification READY restore exact artifacts and verify fingerprints. WARM and Verification MISS remove only full-canonical-identity rows and dependents inside the clone. COLD restores a dedicated snapshot with controlled absent history. Every run restores its snapshot; global delete, truncate, cache wipe, and accepted Stage C/D evidence mutation are forbidden.

## 23. Measurement Layers

L1 measures component/runtime preparation, model, verification, persistence, and prepared-read durations. L2 measures real HTTP/network/server behavior. L3 measures visible user flows. A duration may not be relabeled across layers.

## 24. UX Metrics

Required UX metrics are `SEARCH_TTV`, `HISTORICAL_CHART_TTV`, `SHOW_FORECAST_TO_VISIBLE`, and `SHOW_VERIFICATION_TO_VISIBLE`. Browser marks are preferred; a proxy must be named explicitly and may not be presented as direct TTV.

## 25. Service Metrics

Record request duration, TTFB where observable, serialization duration, HTTP status, payload bytes, queue/wait duration where observable, active concurrency, timeout status, requests started/completed, requests per second, successful requests per second, and wall-clock completion time.

## 26. Compute Metrics

Record Forecast Core invocations, Current computes, Verification computes, model fits and fit durations per model, origins, successful origins, generated path points, and compute owners. Current and Verification counters remain separate.

## 27. Database Metrics

Record query count and duration, p50/p95 query duration, connections, pool saturation and wait, rows read/written, transaction failures, lock waits, and DB errors where available. Prepared-read and compute-plus-write workloads are reported separately.

## 28. Provider Metrics

Record metadata, history, and hydration calls, latency, and failures by scenario and logical artifact key. HOT, WARM miss, and Verification READY/MISS require zero history hydration. Only controlled COLD may permit it.

## 29. Memory Metrics

Record RSS, heap used/total, external memory, peak memory, pre-wave memory, post-wave memory, and post-cooldown memory. Derive `MEMORY_DELTA_AFTER_COOLDOWN`. Where available, include event-loop lag, utilization, and active runtime pressure.

## 30. CPU Metrics

Record process CPU, container CPU where observable, total CPU seconds, CPU seconds per completed request, and CPU seconds per Forecast compute. Latency alone is not a resource-cost proxy.

## 31. Reliability Metrics

Record success/failure, 4xx, 5xx, timeouts, connection failures, application exceptions, provider errors, resource errors, Forecast unavailable responses, and error rate. Lawful `NOT_AVAILABLE` is classified separately from infrastructure failure.

## 32. Duplicate Compute Metrics

Record compute owner count, actual compute count, expected logical compute count, duplicate count, and duplicate ratio per exact key. Counts come from correlated compute-start events, not request counts or latency inference.

## 33. Persistence Metrics

Record artifact, point, and verification-record writes, write duration, failures, and duplicate equivalent writes. Stress load must not corrupt or cross-match canonical persistence identities.

## 34. Cost Proxy Metrics

Required normalized proxies are CPU seconds per request, CPU seconds per successful Forecast, peak memory MB, approximate GB-seconds where meaningful, DB queries per request, DB writes per Forecast, provider calls per Forecast, and compute executions per logical artifact.

## 35. Financial Cost Model

Future outputs are cost per 1,000 HOT reads, WARM requests, COLD requests, and Verification reads, plus cost per new Current and new Verification compute. No cloud price is invented. Until reliable configured pricing exists, `FINANCIAL_COST = NOT_CALCULATED` and normalized resource units are reported.

## 36. Trace / Correlation Contract

Every request carries `stressRunId`, `scenarioId`, `virtualUserId`, and `requestId`, plus `forecastIdentity` and `logicalArtifactKey` where possible. The logical key derives from canonical series, semantics, source frequency, target cadence, model, method version, and forecast origin or history fingerprint. No performance-only identity system is introduced.

## 37. Timing Contract

Durations use monotonic clocks where available; UTC wall-clock timestamps are for correlation only. Every unit is explicit. Each immutable stress run records contract version, source revision, scenario, concurrency, distribution, cohort, environment, start/end, and status.

## 38. Scenario Matrix

The mandatory matrix is complete:

| ID | State / flow | Distribution | Levels |
| --- | --- | --- | --- |
| P01 | HOT_READY Current | SAME_KEY | 10/100/1000 |
| P02 | HOT_READY Current | SMALL_POOL | 10/100/1000 |
| P03 | WARM Current miss | SAME_KEY | 10/100/1000, safety gated |
| P04 | WARM Current miss | SMALL_POOL | 10/100/1000, budget gated |
| P05 | COLD Current | SAME_KEY | 10/100/1000, provider gated |
| P06 | Verification READY | SAME_KEY | 10/100/1000 |
| P07 | Verification READY | SMALL_POOL | 10/100/1000 |
| P08 | Verification MISS | SAME_KEY | 10/100/1000, backtest gated |
| P09 | Search/Expand/Historical UX | SMALL_POOL | 10/100/1000 |
| P10 | Show Forecast HOT UX | SMALL_POOL | 10/100/1000 |
| P11 | Show Forecast WARM miss UX | SAME_KEY | 10/100/1000, safety gated |

K3 HOT and WARM are explicit secondary workloads. The controlled user mix is 70% Search/Historical/prepared reads, 20% new Current compute, and 10% Verification read/preparation; these percentages are test assumptions, not production facts.

## 39. Repetition Policy

HOT and prepared scenarios require at least three valid repetitions. Expensive COLD and Verification MISS scenarios require at least one explicitly labeled valid repetition per applicable benchmark/model, with the exact count recorded. Single-run and three-run statistics may not be compared without labeling.

## 40. Cooldown Policy

The next wave starts only after active requests are zero, in-flight compute is zero, CPU has remained settled for 30 seconds, and post-cooldown memory is recorded. The condition is observable and not implemented as an arbitrary long sleep.

## 41. Outlier / Exclusion Policy

Permitted exclusions are harness failure, environment outage, provider outage, or invalid state setup. Every exclusion records `EXCLUDED_RUN` and a reason. High latency is never an exclusion reason.

## 42. State Validation Rules

HOT verifies exact READY artifact, matching fingerprint/version, and no provider need. WARM verifies complete local history, no provider need, and exact artifact absence. COLD verifies controlled missing history and artifact. Verification states verify the exact run presence or absence independently. Failed preconditions invalidate and stop the scenario.

## 43. Safety Abort Rules

Abort on duplicate provider/backtest escalation, RSS above 85% of the environment limit or platform memory pressure, more than 10% failures after ten completions excluding lawful unavailability, three consecutive connection failures/503 responses, or DB pool exhaustion/sustained 100% saturation for ten seconds. The harness must stop cleanly.

## 44. Performance Result Schema

The frozen JSON Schema records contract/run/environment identity, scenario, concurrency, distribution, benchmark and dataset fingerprint, model, request/reliability counts, min/p50/p90/p95/p99/max/mean latency, throughput, CPU, memory, DB/provider/compute/write counters, duplicate work, prepared hits/misses, wall time, classification, attribution, setup/cache label, repetition, exclusion, correctness, and notes. Unavailable metrics are explicit `null`, never silently omitted.

## 45. Observability Inventory

Available now: harness HTTP timing/status/payload, barrier spread, Forecast service `totalMs`, cache status, market-data DB/provider timing, and existing Dashboard historical timing. The machine matrix records source, current availability, collection method, and whether a production-code instrumentation hook is required for every metric.

## 46. Instrumentation Gap Analysis

Missing correlated data includes browser Forecast TTV, CPU/memory/event-loop samples, DB query/write counts, provider counts, Forecast Core/model fit/backtest counts, compute ownership, duplicate work, and correctness checksums. Phase 2.1 needs minimal stress-flagged structured events and out-of-request process/platform sampling. The flag defaults false; instrumentation must be low-overhead, behavior-neutral, and must not reorder execution.

## 47. Execution Environment Contract

L1 uses `LOCAL_COMPONENT_ISOLATED` with no external provider. L2/L3 use a non-production SG Runtime/Dashboard test deployment backed by a dedicated database clone. Provider access is deny-by-default with an exact COLD allow-list. Writes are limited to controlled identities. Every run records environment ID, service configuration, CPU/RAM allocation, runtime version, database alias, and flags. Credentials are never evidence.

## 48. Dataset / Fingerprint Contract

Before each run record series ID, native frequency, lawful observation count, history start/end, canonical history fingerprint, target semantics, model, and horizon. Cohort and data identity are immutable during baseline; technical unavailability requires an explicit exception rather than silent replacement.

## 49. Functional Correctness Checks

Every successful response must match exact canonical identity and a stable pre-run response checksum/value assertion. Cross-semantic, cross-model, cross-cadence, and cross-version matches fail the run. The check is lightweight per response; heavy statistical verification is not repeated for each virtual user.

## 50. Baseline Classification Framework

`HEALTHY` requires valid state/correctness with no abort and no dominant saturation evidence. `DEGRADED` records material latency/throughput deterioration without exhaustion. `SATURATED` requires concurrency-resource saturation evidence. `STRUCTURAL_DUPLICATION` requires duplicate compute/write evidence for one logical key. `RESOURCE_EXHAUSTED`, `PROVIDER_BOUND`, `DATABASE_BOUND`, and `COMPUTE_BOUND` require corresponding correlated resource evidence. Otherwise classify `UNKNOWN_BOUND`. No classification is assigned in Phase 2.0.

## 51. Bottleneck Attribution Framework

Attribution options are model compute, DB read, DB write, serialization, Node runtime, Python runtime, memory, provider, concurrency coordination, and duplicate compute. Each requires correlated duration/counter/resource evidence. End-to-end latency alone cannot establish a bottleneck.

## 52. Future Optimization Comparison Framework

Methodological correctness is a hard pass/fail gate. Surviving Phase 2.2 variants are compared on user speed, resource cost, and implementation/maintenance complexity. Deferred hypotheses include prepared reuse, background warm-up, compute dedupe, promise or DB coordination, selective precompute, workers, resource sizing, and query/index tuning. None is implemented or ranked here.

## 53. Phase 2 Workflow

The frozen sequence is Phase 2.0 contract freeze, Phase 2.1 as-is baseline, Phase 2.2 controlled optimization experiments, Phase 2.3 selected mechanism integration/regression, Phase 2.4 production architecture freeze, and Phase 2.5 migration readiness closeout. Phase 2.1 cannot be skipped.

## 54. Migration Readiness Delta

The machine delta records 12 task-attributed paths: six canonical-source paths, one test, and five evidence paths including the PMOS bootstrap. New nested Git repositories and external source repositories are both zero. Transient stress results are explicitly non-canonical.

## 55. Phase 2.0 Acceptance Gate

All exactly 70 acceptance conditions pass. The six states, three levels, three distributions, P01-P11, state isolation, metrics, safety, result schema, observability gaps, environment, migration delta, and no-load boundary are frozen. `FORECAST_PHASE_2_0_GATE = PASS`, `STRESS_TEST_CONTRACT_VERSION = 1`, and `PHASE_2_1_READY_FOR_AUTHORIZATION = YES`. Phase 2.1 remains unauthorized.

## 56. STOP

STOP — PHASE 2.0 STRESS-TEST CONTRACT FROZEN. PHASE 2.1 NOT AUTHORIZED.