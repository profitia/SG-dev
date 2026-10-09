# SG2 PMOS immutable boundary corrective — source handoff

Task SG2-PMOS-IMMUTABLE-BOUNDARY-CORRECTIVE-20261009; profile SG2; target Development.
Authority profitia/SG-dev / main. Verified current baseline 87cae84114fed80f8595dded0f43d45c10d8f42c (updated from 886ce9d92bea5c0c2ae5dc8ae98cb2a44ee71fc1 while preparing this task). Separate branch codex/sg2-pmos-immutable-boundary-20261009. Stage 1 PR #154 and local d730a8f are preserved separately.
Classification TRANSITIONAL under the current architecture policy; owner PMOS for apps/pmos, Governance Source Layer for Canon and governance-preflight workflow. Full SG2 preflight, including persisted pmos:begin cmv0isldq000010qwv1ixrbh6, passed before implementation.

## Root cause and normative decision

The prior finalizer synchronized later completionEvidence into the in-memory FlightRecord, rebuilt its canonical payload, spread a complete persistence projection into the final database update, and regenerated JSON/integrity/lock when derived Markdown changed. Scalar DateTime normalization did not cause this finalization behavior. The owner decision prospectively freezes the complete SG2 FlightRecord at initial canonical persistence/readback; v3 execution Canon section 10 and the SG2 adapter now state that contract. No SRM or CIC contract changes.

## Exact source changes

- apps/pmos/scripts/pmos-save.ts: activate a persisted SG2 seal on initial save/readback or verified retry; no subsequent completion mutation; derived Markdown-only updates; omit flightRecordJson from the final SG2 update; reject SG2 completed snapshot refresh; record linked lifecycle events and use publication intents/ACKs. Scalar DateTime comparison normalizes only SG2, without modifying its stored timestamp. SRM scalar comparison stays unchanged. Initial create is exposed through the same canonical writer for isolated integration fixtures.
- apps/pmos/src/lib/pmos/sg2-immutable-lifecycle.ts: exact full snapshot/sidecar preservation, source identity, create-only transactional evidence, sequence/hash chain, receipt validation, per-conversation row locking, deterministic event IDs, duplicate prevention and ambiguous-publication blocking.
- apps/pmos/scripts/pmos-save.test.ts, sg2-immutable-lifecycle.test.ts and sg2-immutable-lifecycle.integration.test.ts: paired SG2/SRM regression, actual archive writer preservation, independent pre-finalization fingerprint, real isolated PostgreSQL tests, concurrency/crash/retry and negative integrity/identity tests.
- .github/workflows/governance-preflight.yml: isolated PostgreSQL test service and SG2 lifecycle tests; existing SRM gates retained. No deployment step, secrets, required-status-check or protection changes.
- Canon/v3.0-profitia-agent-execution-canon.md, Canon/adapters/sg2-project-adapter-v1.md: explicit SG2-only normative boundary.
- Canon/audits/sg2-stage1-pmos-integrity-exception-20261009.md: new additive historical exception. Historical integrity and authorization remain FAIL.

## Lifecycle persistence contract

Existing SG2 Development PMOS only: lucky-dream-96138453 / br-frosty-lab-als8xfyh / ep-plain-king-al45f92h / neondb. Existing artifacts table, EXECUTION_TRAIL / DERIVED, sg2-immutable-lifecycle-v1. Namespace <conversationId>:SG2_LIFECYCLE:v1:<step>. The sourceRefs bind SG2 task/conversation, canonical snapshot hash and exact JSON/integrity/lock byte hashes. The parent database row is locked in each append transaction and its identity/full JSON verified. Evidence uses create only; same-step identical replay returns the original row; any changed receipt, foreign source, missing prerequisite or broken chain fails closed.

Order: PMOS_SAVE → RUNTIME_VERIFIED → MEMOROS_INTENT → MEMOROS_ACK → PHR_INTENT → PHR_ACK → CLOSEOUT_COMPLETE. RECOVERY_REQUIRED is append-only evidence of an incomplete run. Intent is persisted before an external call. ACK replays never call a provider; lost/ambiguous responses require read-only reconciliation and separately authorized evidence recovery. Delivery does not claim downstream knowledge readiness.

The frozen completionEvidence is a point-in-time snapshot. Read it together with linked lifecycle events and derived closeout/handoff projections; do not interpret its NOT_STARTED fields as the latest lifecycle state. No new database/control plane or schema migration is introduced. This is application-enforced append-only persistence with hash verification, not a database-administrator WORM guarantee. Missing original mirror/sidecar bytes block recovery; the finalizer never fabricates replacements.

## Validation evidence

| Gate | Result and evidence |
| --- | --- |
| Baseline PMOS/profile/registration/PHR regression | 40/40, independently executed from 87cae841 source archive |
| Final PMOS + SG2/SRM + PostgreSQL integration suite | 61/61, zero failures, zero skipped |
| Governance validators | 12/12, manifest valid |
| PMOS app/lifecycle TypeScript | PASS |
| PMOS production build | PASS with explicitly isolated local PostgreSQL bindings |
| Authority enforcement / enum purity | PASS; no gate or allowlist weakened |
| Initial canonical persistence / crash after persistence | PASS, real local PostgreSQL via canonical PMOS writer |
| Final archive JSON/hash/lock preservation | PASS, byte comparison to independent baseline before finalization, not regenerated hashes |
| PMOS → MEMOROS → PHR / idempotency | PASS with deterministic mocked provider receipts and real local persistence |
| Concurrent publication ownership | PASS; two callers issue exactly one provider call |
| Lost response / duplicate prevention | PASS; existing intent blocks automatic replay |
| Wrong task/project/snapshot, corrupt/missing sidecars, foreign/false ACK, ordering | PASS negative tests |
| SRM source/profile/schema/DB identity/policies/routing/deployment config | unchanged versus fresh main; paired existing-finalizer behavior and 40 baseline tests PASS |

All SQL test writes used disposable local sg2_immutable_test on 127.0.0.1:55479. No product or SRM database was used. Provider/schema investigation was read-only. Actual SG2 PMOS artifacts schema was read back and supports the existing fields/enums; no migration is required. The old Stage 1 database fingerprint remains 355953821cf28d979cc38f94ce8fab38.

External evidence directory immutable-boundary-corrective-20261009 contains preflight-before-begin.json, preflight-registered.json, baseline-tests.log, tests-full.log, governance-tests.log, typecheck-final.log, build.log, historical-readback-before.json, artifact-schema-readback.json and render-publication-safety.json. New-task-only source publication and continuity receipts are collected separately after these source tests; no old publication is repeated.

## Publication and activation boundary

Render SG2 PMOS srv-d88utm77f7vs73blrj1g / evm-d88urem7r5hc73csgga0 / prj-d88urem7r5hc73csgg90 follows main with auto-deploy enabled; PR previews are off. All observed SG-dev Render services use main and have previews off. An isolated branch/draft PR is safe to publish; merge is explicitly forbidden and may trigger PMOS deployment. The staging deploy workflow is manual/main-only. This task changes neither provider configuration nor live application deployment.

No PMOS migration prerequisite. Before future activation, separately authorize merge/deployment, inspect all consumers of frozen completionEvidence, preserve access to linked lifecycle events, and reverify shared PMOS deployment boundaries plus SG2/SRM regression. Ambiguous historical publication recovery and restoration of missing original sidecars require a separately authorized, evidence-bound procedure; no automatic republication is provided.

STAGE1_READINESS = PARTIAL. STAGES_2_TO_5_READY = NO. This corrective does not resolve independent Stage 1 environment-binding, product CI or configuration blockers, mark PR #154 ready, or authorize further release stages.

Next permitted action: review this separate draft source PR and its CI/evidence. Merge, PMOS deployment and subsequent Stage 1 work require their own authorization; no such action is performed here.
