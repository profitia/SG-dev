# Forecast Phase 2.2B-0 Single-Flight Experiment Design Freeze

## 1. Executive Summary

Phase 2.2B-0 freezes a controlled BEFORE-versus-AFTER design for duplicate-work prevention. It binds accepted P03, P04, P05, P08, and P11 evidence to exact sources; defines strict Current, Verification, provider-history, and persistence identities; and freezes owner, waiter, failure, telemetry, metrics, safety, and phased execution semantics. No implementation or load occurred.

## 2. Objective

The future experiment asks whether exact-key ownership reduces duplicate compute, writes, CPU, DB pressure, provider amplification, and user wait time without changing Forecast or Verification correctness. It must support an exact, reproducible BEFORE-versus-AFTER comparison.

## 3. Accepted Phase State

`FORECAST_PHASE_2_1_GATE = PASS`, `PHASE_2_1_BASELINE_COMPLETE = YES`, `PHASE_2_2A_GATE = PASS`, and `PHASE_2_2A_CORRECTNESS_REPAIR_COMPLETE = YES`. Phase 2.2A is the accepted correctness baseline. Phase 2.2B-1 was not authorized or started.

## 4. Scope Boundary

Authorized work was evidence inspection, experiment design, exact-key and ownership semantics, failure/cancellation/timeout design, BEFORE bindings, measurement and safety schemas, deterministic validation, and documentation. Runtime source, single-flight, promise sharing, dedupe, locks, queues, workers, cache/warm-up redesign, tuning, model math, semantics, deployment, and stress load were excluded.

## 5. Why Single-Flight Is Being Tested

Phase 2.1 proved concurrent exact-key misses repeat expensive work. Phase 2.2A proved affected paths can be correct while duplicate work remains. The next question is whether one owner plus waiters is structurally correct, materially useful, and operationally safe.

## 6. Three Evaluation Axes

Future results are evaluated independently on user experience, resource/cost, and methodological correctness. The gates are `CORRECTNESS_GATE`, `STRUCTURAL_OWNERSHIP_GATE`, and `PERFORMANCE_EVIDENCE_GATE`. Mixed performance with correct ownership is reportable; correctness failure is always fatal.

## 7. Frozen Forecast Invariants

Series, model, target basis/semantic, method/version, source/target cadence, input source, history fingerprint, forecast origin, horizon/target set, Forecast values, Verification output, prepared serving, and Search compute-free behavior remain unchanged. Existing lawful numeric tolerance alone may remain.

## 8. Phase 2.1 BEFORE Evidence

P03 has 10 computes and 9 duplicates for one key per model. P04 has 10/7 and 100/97 compute/duplicate counts for three keys per model. P05 ETS has 10 computes, 9 duplicates, and 9 duplicate artifact writes. P08 two-user probes have 2 full Verification computes and 1 duplicate per model. Exact paths and hashes are in `performance/phase-2-2b-before-evidence.json`.

## 9. Phase 2.2A Correctness Carry-Forward

P11's accepted two-user proof returned two canonical responses from two computes and deliberately retained duplicate work. Its timing remains `NOT_MEASURED` as performance evidence. The proof and Phase 2.2A gate are SHA-256 bound in the BEFORE manifest.

## 10. Experiment Contract Version

`SINGLE_FLIGHT_EXPERIMENT_CONTRACT_VERSION = 1`, `STRESS_TEST_CONTRACT_VERSION = 1`, `MEASUREMENT_CONTROL_REVISION = 2`, and `CONTRACT_DRIFT = NO`. The new contract does not replace Stress Test Contract v1.

## 11. Logical Artifact Identity Principle

Ownership may be shared only when every canonical key field is exactly equal. Keys use deterministic length-prefixed UTF-8 field-name/value serialization with explicit nulls. Missing identity fields fail closed rather than weakening the key.

## 12. Current Logical Artifact Key

`CURRENT_LOGICAL_ARTIFACT_KEY_V1` is `CURRENT + seriesId + targetBasis + targetSemantics + methodId + methodVersion + modelId + inputSource + historyFingerprint + sourceFrequency + targetCadence + frequencyIdentity + forecastOrigin + horizonConfigurationId`. Origin and the exact target set must be resolved before ownership acquisition.

## 13. Verification Logical Artifact Key

`VERIFICATION_LOGICAL_ARTIFACT_KEY_V1` is `VERIFICATION + seriesId + targetBasis + targetSemantics + methodId + methodVersion + modelId + inputSource + historyFingerprint + sourceFrequency + targetCadence + frequencyIdentity + verificationHorizonSetId + verificationConfigurationId + originPolicyId`. It is independent of Current.

## 14. Provider-History Key

`PROVIDER_HISTORY_REQUEST_KEY_V1` is bounded as `PROVIDER_HISTORY + providerCode + providerSeriesId + requestedRange + coverageState + freshnessReference + freshnessPolicyId`. It reflects the current `resolveHistoricalSeries` cache decision. Current ownership does not imply provider-history ownership.

## 15. Persistence Ownership Key

`PERSISTENCE_OWNERSHIP_KEY_V1` is `PERSISTENCE + artifactFamily + complete artifactLogicalKey + persistenceOperation + persistenceSchemaVersion`. Series-only and series-plus-model keys are prohibited. Phase 2.2B-3 first observes whether a single compute owner already yields one write-set.

## 16. Owner Role

`OWNER` is the sole execution lawfully performing missing-artifact work for one exact key during its in-flight interval. Owner identity is correlated to every waiter and lifecycle event.

## 17. Waiter Role

`WAITER` is a concurrent requester for the exact in-flight key. It awaits the owner result and does not start Forecast or Verification compute. Waiter count is based on observed overlap, not submitted requests.

## 18. Prepared Reader Role

`PREPARED_READER` arrives after an exact canonical artifact is READY and passes normal identity/freshness checks. It remains compute-free and does not join a historical completed-entry cache.

## 19. SAME_KEY Structural Invariant

For one exact overlapping miss key: logical artifacts = 1, compute owners = 1, duplicate computes = 0, canonical artifacts = 1, and expected waiters = `max(0, observedOverlappingRequests - 1)`.

## 20. SMALL_POOL Structural Invariant

Expected owners equal the exact distinct missing logical keys observed concurrently. P04's expected owner count is three only when the request manifest resolves to exactly three keys. Duplicate compute target is zero.

## 21. Current Ownership Scope

Phase 2.2B-1 covers Current Forecast miss ownership only. It does not prove Verification, provider, all persistence, cross-process, or cross-instance coordination.

## 22. Verification Ownership Scope

Phase 2.2B-2 independently covers one exact Verification artifact to one full-backtest owner. Its first lawful live proof is capped at two concurrent callers and requires one owner, one waiter, and one backtest.

## 23. Persistence Ownership Scope

Phase 2.2B-3 measures success, waiter reuse, owner/persistence error, retry, late arrival, and release races. It establishes whether existing idempotency is sufficient before selecting any additional mechanism.

## 24. Initial Low-Cost Hypothesis

`EXPERIMENT_HYPOTHESIS_A = IN_PROCESS_EXACT_KEY_SINGLE_FLIGHT`. It is the lowest-cost candidate for Phase 2.2B-1, not a selected production architecture. Redis, distributed locks, queues, and coordination services are not initial hypotheses.

## 25. Single-Process Boundary

The initial hypothesis coordinates only work visible to one runtime process. Its registry may contain only currently in-flight entries and must release completed and failed keys.

## 26. Multi-Instance Limitation

`CROSS_INSTANCE_DUPLICATE_PREVENTION = NOT_PROVEN`. An in-process success cannot be reported as production-wide exact-once compute. A later evidence gate may assess cross-instance coordination.

## 27. Owner Success Semantics

The owner computes the lawful artifact and executes existing persistence behavior. Waiters receive semantically identical identity and values. Release follows settlement of the owner result and required persistence attempt.

## 28. Owner Failure Semantics

Attached waiters observe the same owner failure classification. The entry is removed in a finally-equivalent path, failed keys cannot remain poisoned, and a later request may retry. Partial persistence is reusable only after the normal exact prepared read proves completeness.

## 29. Waiter Cancellation Semantics

Waiter cancellation is local and does not automatically cancel the owner while another consumer or required persistence completion remains. Existing runtime waiter-cancellation policy is `NOT_DEFINED`; deterministic tests must prove locality before load.

## 30. Owner Disconnect Semantics

The inspected Dashboard HTTP abort is not propagated as a Forecast compute cancellation signal. The experiment requires disconnect not to cancel shared compute by itself and observes remaining waiter and owner outcomes. No background job is introduced.

## 31. Timeout Semantics

`OWNER_COMPUTE_TIMEOUT = NOT_DEFINED` and `WAITER_WAIT_TIMEOUT = NOT_DEFINED`. The existing Dashboard internal production Forecast fetch has `HTTP_REQUEST_TIMEOUT = 20000 ms`. Phase 2.2B-1 observes the risk before proposing policy or values.

## 32. Late Arrival Semantics

During compute or pre-release persistence, an exact-key late request joins a valid IN_FLIGHT owner. After READY it is a prepared reader. After release without READY it is a MISS and may acquire a new owner.

## 33. Owner Release Race

Telemetry orders compute end, persistence end, entry release, prepared availability, and later owner acquisition. A second owner while a valid exact key remains IN_FLIGHT fails ownership. The release-to-READY interval is measured, not hidden.

## 34. Fingerprint Change Isolation

`FINGERPRINT_A != FINGERPRINT_B` or a different lawful origin means different logical keys and prohibits sharing. A post-change request cannot wait on the stale input's owner.

## 35. Model Isolation

Naive, Damped Holt, ETS, and ARIMA are distinct keys and owners. One compute for multiple models is unauthorized. Deterministic tests prove model-key differentiation.

## 36. Semantic Isolation

`MONTHLY_AVERAGE`, `END_OF_PERIOD`, and `ROLLING_DAILY_POINT_IN_TIME` remain distinct. Target basis, target semantic, and method identity participate in the key.

## 37. Cadence Isolation

Source frequency, target cadence, and canonical frequency identity participate in the key. Monthly and Quarterly work cannot share ownership. Legacy identity remains explicit, never silently normalized into another cadence.

## 38. Current-vs-Verification Isolation

The `CURRENT` and `VERIFICATION` namespaces differ and their field sets differ. Deterministic validation proves they cannot collide, even for the same series/model/history.

## 39. Telemetry Contract

Events are lookup, owner acquired, waiter joined, owner completed/failed, waiter completed/failed, and entry released. Correlation includes run/scenario/request/user IDs, exact logical key, operation family, owner request, role, model, series, semantic, cadence, and timing. Sensitive connection data is forbidden.

## 40. Ownership Metrics

Metrics are logical artifacts, expected/actual owners, actual computes, waiters, prepared readers, duplicate computes, and duplicate ratio. `DUPLICATE_COMPUTE_COUNT = max(0, ACTUAL_COMPUTE_COUNT - LOGICAL_ARTIFACT_COUNT)` where one lawful compute per exact key is established.

## 41. Persistence Metrics

Metrics are canonical artifact writes, point writes, duplicate artifact writes, persistence owner count, and persistence errors. General DB writes remain separate from duplicate canonical artifact writes.

## 42. Waiter UX Metrics

Owner, waiter, and prepared-reader latency are separate. Waiters record time to join, wait duration, and total user-visible latency. Fairness records starvation, maximum waiters, tail amplification, and post-settlement entry count.

## 43. Correctness Equivalence

AFTER must match accepted canonical series, model, semantic, cadence, method version, origin, fingerprint, target dates, Forecast values, and Verification output. Exact deterministic equality/checksum is preferred. Performance can never compensate for a mismatch or contamination.

## 44. Prepared-Serving Regression Contract

P01, P02, P06, P07, and P10 READY paths remain compute-free and are not rerouted through miss ownership. P09 remains `FORECAST_COMPUTE_DURING_SEARCH = 0`. Prepared Show Forecast must remain compute-free after the canonical artifact is READY.

## 45. P03 Experiment Design

BEFORE per model is 10 requests, one key, 10 computes, and 9 duplicates. After deterministic Phase 2.2B-1 proofs, the first controlled comparison targets 10 canonical responses, one owner, zero duplicates, and observed waiters. Larger levels require separate safety passage.

## 46. P04 Experiment Design

BEFORE at 10/100 is 10/100 computes for three keys with 7/97 duplicates. AFTER owner count derives from exact distinct request keys, not a hardcoded three. Compare latency, CPU, DB writes, owners, waiters, and correctness.

## 47. P05 Experiment Design

P05 separately measures provider/history acquisition and Current compute. BEFORE ETS @10 has 10 computes, 9 duplicates, and 9 duplicate artifact writes. Provider execution remains allow-listed and safety-gated; no Current result may be used to claim provider amplification is solved.

## 48. P08 Experiment Design

BEFORE per-model two-user probes have two full Verification computes and one duplicate. The first AFTER proof remains two users and requires one Verification owner, one observed waiter, one full backtest, exact equivalent responses, and released entries before any larger authorization.

## 49. P11 Experiment Design

Phase 2.2A BEFORE is two canonical responses and two computes. The first AFTER target is two canonical responses, one Current owner, one observed waiter, and a subsequent compute-free prepared read. Ten/100/1000 are deferred until Current correctness and ownership pass.

## 50. Phase 2.2B-1 Design

Implement the smallest Current hypothesis only. Prove success, isolation, owner failure, waiter cancellation, disconnect observation, late arrival, retry, release, and no retained entries with deterministic tests, then a two-user proof and controlled P03/P11. Full matrix execution is excluded.

## 51. Phase 2.2B-2 Design

Implement and test Verification ownership independently. Start with two callers. Required proof is one owner, one waiter, one backtest, correctness PASS, no partial READY artifact, and entry count returning to zero.

## 52. Phase 2.2B-3 Design

Observe one-owner persistence writes and test safe failure/retry/release races. Select additional idempotency protection only if evidence shows it is needed. No persistence mechanism is selected by this freeze.

## 53. Phase 2.2B-4 Design

Run formal BEFORE-versus-AFTER P03/P04/P05/P08/P11 comparisons under equal scenario semantics, plus P01/P02/P06/P07/P09/P10 regressions. Escalate sequentially through 10/100/1000 only where lower evidence and scenario-specific safety gates pass.

## 54. Safety and Acceptance Model

The safety matrix preserves Phase 2.1 stops for precondition/correctness failure, duplicate provider/backtest escalation, RSS above 85% or memory pressure, failure rate above 10% after ten completions, three consecutive connection failures/503s, and DB pool exhaustion/100% saturation for ten seconds. Three independent acceptance gates permit honest mixed performance classification. This freeze requires 64/64 design conditions PASS.

## 55. Recommended Next Decision

With the design gate passing, recommend `AUTHORIZE PHASE 2.2B-1 - CURRENT FORECAST SINGLE-FLIGHT EXPERIMENT` as a separate task. It should test only the lowest-cost lawful Current ownership hypothesis against this frozen contract.

## 56. STOP

STOP — PHASE 2.2B-0 SINGLE-FLIGHT EXPERIMENT DESIGN FROZEN. PHASE 2.2B-1 NOT AUTHORIZED.