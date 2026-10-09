# PR #156 — SG2 project identity and lifecycle read corrective

Task: SG2-PMOS-IMMUTABLE-BOUNDARY-PR156-CORRECTIVE-20261009. Parent: SG2-PMOS-IMMUTABLE-BOUNDARY-CORRECTIVE-20261009. Profile SG2; target Development. Authority profitia/SG-dev / main. Current verified main: 87cae84114fed80f8595dded0f43d45c10d8f42c. Starting draft PR head: 1c25975b5d05d7fe5064e4d2ca995bd26a040127. Existing isolated branch: codex/sg2-pmos-immutable-boundary-20261009. PR #154 is separate and untouched.

## Governance and scope

Root AGENTS, active manifest 3.7.0, CORE/SG2 Canon, SG2 adapter, project/topology/routing registries and Developer Lifecycle were loaded. The owner-approved SG2 immutable boundary in v3 section 10 remains unchanged. Full preflight passed before source changes, including persisted new-task registration cmv0klbx70000ts92wf9scr8d. Derived conversation: pmos-task-v2:a828528911dec232b495bea2e4b797dbad1aee3c4f68ed19b9b4b7d33d2ed50a. Host: 01a11d5a-e82e-76d2-bc86-ef6408455ca4.

All exact targets resolve to PMOS / ALIGNED (apps/pmos) or Governance Source Layer / ALIGNED (this audit and the governance workflow). Change classification is TRANSITIONAL under the registry policy. No legacy write, new owner, schema migration, release-hardening implementation, merge or deployment is included. Original/parallel work and previous continuity artifacts were preserved.

## C1 — persisted project identity

The old CLI branch classified a historical refresh using PMOS_PROJECT_NAME before looking up the artifact. A process configured as SRM could therefore enter the SG2 refresh path.

apps/pmos/scripts/pmos-save.ts now calls readCompletedHandoffRefreshSource from the actual refresh entrypoint. It first reads the requested ConversationArtifact and validates its persisted FlightRecord, then reads the matching completed PromptExecution. The existing historical project resolver must resolve all three identities to the same registered project; task, conversation and host binding must agree. Existing closeout/environment identity guards apply. Missing, unknown or conflicting identity fails before any persistence or archive write.

Persisted SG2 always rejects refresh, regardless of PMOS_PROJECT_NAME being SG2, SRM, absent, malformed or an alias. For lawful SRM refresh, the verified source is returned unchanged; canonical process policy and actual database-name/registered-endpoint checks constrain access. The existing handoff, completed-closeout and PHR gates, publication policy and archive refresh body remain intact. No SRM finalizer, registration or publication contract is changed.

## C2 — SG2 current lifecycle read contract

The old conversation UI presented frozen completionEvidence as current status. buildCanonicalConversationReadModel remains the same snapshot projection for every project. The new SG2-only buildSg2LifecycleReadModel adds a separate current view.

validatePersistedLifecycle in the existing sg2-immutable-lifecycle module reuses validateLifecycle for sequence, previousHash, event hashes, prerequisites and receipt identity. It also verifies the persisted project/task/conversation, full JSON fingerprint, PMOS base-row receipt, exact deterministic IDs, sourceRefs and artifact envelopes. The page queries candidates by lifecycle namespace OR version, so a wrong artifact nature or malformed ID is verified and rejected rather than hidden by its normal DERIVED filter. No writer, table, resolver or control plane is duplicated.

| Evidence | Current read behavior |
| --- | --- |
| Verified seven-event chain | CLOSEOUT_COMPLETE; database chain/source binding PASS |
| Valid incomplete prefix | PARTIAL |
| Valid unresolved RECOVERY_REQUIRED event | RECOVERY_REQUIRED |
| Invalid chain, fingerprint, receipt, identity or envelope | NOT_VERIFIED; evidence FAIL; no publication proof |
| No lifecycle events | Explicit HISTORICAL_SNAPSHOT_ONLY; recorded snapshot status shown separately; new-contract completion NOT_VERIFIED |
| MEMOROS ACK | DELIVERED; current downstream consumer readiness remains NOT_VERIFIED |
| PHR ACK | PUBLISHED or IDEMPOTENT according to its verified receipt |

The runtime view is explicitly POSTGRESQL_EVIDENCE_ONLY. Stored byte fingerprints are linkage evidence, not a fresh inspection of local JSON/integrity/lock files. Immutable boundary integrity therefore stays NOT_VERIFIED unless an independent historical governance exception establishes FAIL. The view never labels local file integrity PASS from PostgreSQL alone.

apps/pmos/src/app/conversations/[id]/page.tsx renders the new SG2 component with immutable snapshot and current lifecycle in separate sections. SRM keeps its original completion section. EventLedgerTable exports snapshot provenance: SG2 gets an explicit point-in-time label and no inferred current status; SRM's exported Markdown is byte-identical to its legacy expected output. Other canonical-helper consumers use metadata/analysis provenance and require no status change.

## Historical compatibility and independent evidence

No historical events are fabricated, no data migration is performed, and absence alone does not classify old conversations as corrupt. The Stage 1 exception is surfaced as immutable integrity FAIL and previous authorization FAIL; its recorded CLOSEOUT_COMPLETE is a historical snapshot claim, not verified completion under the new event contract.

Read-only actual SG2 PMOS evidence: lucky-dream-96138453 / br-frosty-lab-als8xfyh / neondb. Independent parent fixture ConversationArtifact cmv0john20000g58ejig9agsk remains fingerprint e02a7d10d98fa0ff4ddcf207bca0ef98edfd5e6a3f60fe43cd2ba482736ee9f3. Its seven existing events yield CLOSEOUT_COMPLETE; its snapshot still shows PMOS_SAVE_SUCCEEDED and runtime NOT_STARTED. All original JSON/integrity/lock byte hashes matched the independently recorded values. Actual persisted refresh was rejected for SG2, SRM, absent and malformed process identities without invoking a publication or archive rewrite.

Historical Stage 1 ConversationArtifact cmv04sjxq0000dg8egv2290kn remains fingerprint d0aaaf3be15403491b0df76954170f46660c83fc0b510d934b8a3c99dabdafdb. Canon/audits/sg2-stage1-pmos-integrity-exception-20261009.md is byte-preserved (SHA256 4794c0580599f950b5e6bbf7f51ab444c78d52606385ed486acb465d164c5fe6). The previous integrity and authorization verdicts remain FAIL. No earlier closeout or MEMOROS/PHR publication was repeated.

## Validation

| Test/gate | Result |
| --- | --- |
| Full existing PR #156 suites plus C1/C2 | 102/102 PASS; zero skipped |
| C1 process-context bypass / missing and conflicting persisted identity | PASS; zero persistence writes and archive rewrites on rejected refresh |
| Actual disposable PostgreSQL persisted refresh / lifecycle read | PASS |
| Completed, partial, recovery, missing/order/identity/hash/previousHash/fingerprint/duplicate/envelope negative reads | PASS |
| Historical SG2 and Stage 1 exception | PASS; no synthesized events or integrity promotion |
| SG2 rendered UI and SRM legacy export | PASS |
| Actual local production server SG2/SRM conversation pages | HTTP 200; SG2 separate snapshot/current states; SRM legacy section unchanged |
| Governance validators | 12/12 PASS |
| PMOS app and lifecycle typecheck | PASS |
| PMOS production build, enum purity and authority enforcement | PASS |
| SRM finalizer/scalar algorithms and legacy canonical read projection | Exact source preserved versus starting PR head |
| SRM/CIC adapters, project/database identity, PHR policy, schema and Render configuration | Exact source preserved |

All SQL test writes were confined to newly initialized disposable local PostgreSQL: sg2_immutable_test / sg2_test / 127.0.0.1:55480. Fixture provider receipts are mocks. The local UI server was bound to 127.0.0.1:32156 and used that database. No actual SRM database, product database, live compute or publication provider was used by tests.

Evidence outside the authority repository: pr156-c1-c2-corrective-20261009/preflight-before-begin.json, preflight-registered.json, preflight-finalization.json, tests-full.log, governance-tests.log, typecheck.log, typecheck-lifecycle.log, build.log, local-ui-verification.json, existing-artifacts-readback.json and srm-non-regression-source-proof.json. Remote CI and new-task-only continuity receipts are verified after source publication and linked in the PR/final handoff; they are not asserted from a local test log.

## Publication and activation prerequisites

PR #156 must remain OPEN/DRAFT on its existing branch; no merge is authorized. All 15 observed SG-dev Render services use main with previews off. PMOS srv-d88utm77f7vs73blrj1g follows main with auto-deploy enabled and PR previews off. Its current live deploy is dep-dapnv7gjo6nc73cskt1g at 1abae93c972290ae8af5e2689320551824055ea7. Publishing the isolated PR branch does not match that deployment source. The governance PR workflow only validates/tests; the SG2 Staging deployment job requires workflow_dispatch on main; the SRM deployment jobs require separately authorized workflow_dispatch. No provider configuration changes are made.

No database migration is required. Future merge/deployment requires separate authorization, fresh shared PMOS provider routing and regression verification. Runtime file-sidecar verification remains a separate authority from this PostgreSQL UI read. Unknown provider outcomes continue to require read-only reconciliation and separately authorized recovery; the persistence writer and publication intent/ACK rules are unchanged.

Stage 1 remains PARTIAL. Stages 2–5 remain NOT READY. The next permitted action after this corrective's source/CI/continuity verification is owner review of draft PR #156. Neither Stage 1 PR #154 nor further release stages are activated by this task.
