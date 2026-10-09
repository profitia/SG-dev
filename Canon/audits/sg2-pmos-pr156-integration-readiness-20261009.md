# SG2 PMOS PR #156 — controlled integration and deployment readiness

Task: `SG2-PMOS-PR156-INTEGRATION-READINESS-20261009`. Profile SG2; target Development. Authority `profitia/SG-dev / origin/main`. This is preparation, not merge or deployment authorization.

## 1. Executive decision

**NO_GO for merge/activation.** The integrated PMOS implementation passes its 102 tests, typechecks and production build. The broader shared/SRM suite fails 27 of 185 cases on both this candidate and exact unmodified current main. These failures, a confirmed downstream MEMOROS status contract gap and incomplete live binding/rollback proof prevent release acceptance. PR #156 remains open/draft. No PMOS deployment, Render configuration change, product SQL write or historical republication was performed.

The existing immutable boundary, C1 persisted identity and C2 read model were preserved without additional functional changes. The only new authored source file in this task is this report/runbook. Stages 1 and 2–5 are not unlocked by source tests or technical continuity completion.

## 2. Source authority and integration

Initial PR HEAD `7238607e579d9edd38327c30e309686c73c88fd2`; original immutable commit `1c25975b5d05d7fe5064e4d2ca995bd26a040127`. Fresh main advanced through `486aac2`, `50cac33`, `42c3b03`, `d398fb4`, `ffb9a78` and finally **`f3bff5071575b58256ff0bd1366587685e66e9b9`** during concurrent SRM publication. The 15a83ec advance merges PR #178 and changes only `scripts/governance/governance.test.mjs`: synthetic RESERVED/ACTIVE fixtures preserve negative fail-closed checks independently of lawful live Staging onboarding. No production resolver or SG2/SRM PMOS behavior changes in that delta. The subsequent 4ddbb58/f3bff50 main commits update the SRM release journal and publish verified SRM Staging topology through a separate owner-controlled task. That current-main activation is preserved, not performed or altered by this SG2 task; SRM PMOS remains Development-only.

Main changes since `87cae84114fed80f8595dded0f43d45c10d8f42c` include protected SRM release publication (PR #157), SRM staging controller/tests/contracts/evidence and shared Environment & Release Canon section 12. Subsequent journal-only commits update `Canon/registries/srm-staging-release-state-v1.json`.

Preflight rejects a candidate behind fresh main. No ancestry check was disabled: the published integration history uses pristine isolated current-main worktrees that passed full preflight before merging existing PR commits. Integration commits `6787965331defe06d72d4fd89e319daae5a0f84f`, `ef16028f48fdfc734bfb31bcd0c9dc6e35ab9b1e` , `d7bc01636a8c34eb9f3e8d05bcac601158e71940` and **`d50f0949d7b68ccdb041705ae3fc84b4e2dce984`** preserve both PR commits and all main history. No conflicts, rebase or force-push occurred. The eventual PR head includes this evidence-only report; its exact SHA and CI run are recorded in the PR and external final evidence.

Local orchestration deviation: a separate isolated merge `ab81c442ace0a141977d3cad94ef9f104cea659d` ran after a dependency-related BLOCKED preflight because the shell sequence lacked fail-fast handling. It is retained only as diagnostic evidence and is excluded from the published candidate/history. This was a procedural failure, not retroactively accepted. No provider/database or remote source mutation resulted. The corrected pristine worktree explicitly stops on any failed gate; its registered full preflight passed before `d7bc016`. Evidence: `local-orchestration-deviation.json` and blocked/passing preflight files. Dependency-directory setup also produced a later BLOCKED dirty-state preflight; fail-fast prevented its merge.

PR #154 remains separate: head `2a24efa878cb074c2567a20facc600d1775b4509`, open/draft. Local Stage 1 recovery commit `d730a8f` was not imported wholesale. Unrelated original working trees were not reset, cleaned or modified.

## 3. Governance and ownership

Root AGENTS, manifest 3.7.0, ordered CORE/SG2 documents, current registries, SG2 adapter, Developer Lifecycle, PMOS schema/persistence/trail and MEMOROS/PHR contracts were loaded. SRM adapter v2 was consulted for non-regression only. SG2 PMOS remains `lucky-dream-96138453 / neondb`; SRM retains its separately registered `srm_pmos` and MEMOROS-disabled/mandatory-PHR policy. No SRM or CIC profile/workspace/database was selected for this task.

Nineteen declared paths passed routing: `apps/pmos/**` targets resolve to PMOS / ALIGNED; the six existing PR Canon targets, governance workflow and this new audit resolve to Governance Source Layer / ALIGNED. Change classification TRANSITIONAL; no nested legacy write or new owner. Exact paths are preserved in the registration and `targets.json` evidence.

New-task registration: `cmv0mk3ki000024j2s6xad12o`; conversation `pmos-task-v2:bb4783819c2f2f508b594dbd986c0e02346d7d08c73c6f2674cd785846622f4b`; host `01a11d5a-e82e-76d2-bc86-ef6408455ca4`. Full registered preflight passed at both integration boundaries and before this document. Moving-main failures were retained as diagnostics, not bypassed.

GitHub ruleset `23304085` is active on the default branch: PR required, deletion/non-fast-forward forbidden, no bypass actors. It declares zero required approvals and no required-status-check rule. The legacy branch-protection endpoint returns 404; that does not mean the ruleset is absent. Exact-head successful CI and explicit owner acceptance remain task requirements; no protection configuration was changed.

## 4. SG2 immutable lifecycle and C1/C2

`Canon/v3.0-profitia-agent-execution-canon.md` section 10 freezes the complete FlightRecord JSON and original JSON/integrity/lock bytes at first successful canonical persistence/readback. `apps/pmos/src/lib/pmos/sg2-immutable-lifecycle.ts` seals the source, verifies exact preservation, locks the parent row transactionally and appends deterministic, sequential, hash-linked `EXECUTION_TRAIL / DERIVED / sg2-immutable-lifecycle-v1` rows. No new table or migration is introduced.

The seven required steps are PMOS_SAVE, RUNTIME_VERIFIED, MEMOROS_INTENT, MEMOROS_ACK, PHR_INTENT, PHR_ACK, CLOSEOUT_COMPLETE. An intent without a verified ACK blocks automatic republication. Database row locking protects cooperating new writers across processes; it does not make old code or administrative SQL conform to the new protocol.

C1 `readCompletedHandoffRefreshSource` first reads persisted ConversationArtifact and completed registration, resolves canonical identity using the existing resolver, verifies task/conversation/project binding and blocks SG2 before writes, regardless of process project variable. Lawful SRM refresh retains its existing body and database/policy guards.

C2 `validatePersistedLifecycle` and `buildSg2LifecycleReadModel` verify source fingerprint, identity, sequence, previousHash, hashes, prerequisites and envelopes. UI separates snapshot state from current lifecycle. Valid completion requires a full verified chain; incomplete/recovery/invalid/historical evidence never becomes false success. MEMOROS delivery is separate from consumer readiness. PostgreSQL-only verification does not claim local sidecar integrity PASS.

## 5. SRM, CIC and shared compatibility

`srm-cic-source-compatibility.json` independently compares the integrated candidate to exact current main. Nineteen source-preservation checks pass, including complete apps/srm, packages/srm-xray, scripts/governance, SRM/CIC adapters, project/database registry, SRM topology/release state, shared release Canon, PMOS Prisma schema, dependencies, execution registration, project resolver, PHR implementation and render.yaml. SRM-specific publication outcome and candidate functions are byte-identical.

SG2 profile branching preserves SRM's final persistence object and legacy canonical read semantics. Unit tests cover SRM completed/historical records, legal refresh, registration identities, mandatory PHR and disabled MEMOROS. No SG2 event obligation was added to SRM or CIC. Tests used local fixtures only; no live SRM database or environment was accessed. Shared source and deployment rules from current main are preserved.

## 6. Consumer compatibility matrix

| Consumer | Finding / evidence | Classification |
| --- | --- | --- |
| PMOS conversation detail UI | `src/app/conversations/[id]/page.tsx:64`; verified event chain drives separate current lifecycle | COMPATIBLE |
| Canonical FlightRecord reader | `flight-record-read.ts:97`; deliberately remains snapshot provenance; SG2 current reader is separate | COMPATIBLE |
| Event ledger/export | `EventLedgerTable.tsx:211`; SG2 point-in-time label, SRM export unchanged | COMPATIBLE |
| Conversation list, timeline, warnings, decisions | Read metadata/analysis and related records, not a final closeout gate | COMPATIBLE |
| GET conversations/search APIs | Return source/archive records; frozen JSON is not a current-status endpoint. Consumers must not infer current state from it | COMPATIBLE as source API; unknown external consumers NOT_VERIFIED |
| Derived HANDOFF / scalar summaries | `pmos-save.ts:1718,1815`; generated from separate CloseoutEvidence and publication context | COMPATIBLE |
| PMOS runtime context | `runtime-authority.ts:31`; reads task IDs, summaries, logs/principles/warnings, not snapshot completion | COMPATIBLE |
| Archive/estate checks | Verify original JSON/hash/lock and separate closeout sidecar; archive CLI prints snapshot closeoutState | COMPATIBLE as provenance; CLI output is not current lifecycle proof |
| Canonical PHR publisher | `phr-publication.ts:263`; gates on matching separate closeout and finalized HANDOFF, publishes frozen artifact | COMPATIBLE |
| Standalone PHR/recovery tools | Retain historical operator paths; standalone publisher does not route through SG2 publishOnce | NOT_VERIFIED for ambiguous SG2 recovery; exclude from activation/automatic retries pending owner-reviewed recovery contract |
| MEMOROS acknowledgement callback | Changes separate publication consumer-readiness projection, not immutable FlightRecord/event ACK | COMPATIBLE with delivery/readiness separation; not a chain-integrity attestation |
| **MEMOROS live importer** | **`profitia/MEMOS_Profitia`, live SHA `c75daa8efb62135bfd31e8616740fb2467aaacad`, adapter lines 44–47 maps frozen closeoutState to `pmosCanon.readiness`** | **REQUIRES_CORRECTIVE** |

MEMOROS API service `srv-d8dlo999rddc73a289s0`, LIVE `dep-d91oe1jrjlhs73fve0k0` matches that source SHA. Its mapper transports only the frozen FlightRecord; no separate lifecycle evidence is included. The adapter stores this mapped readiness in thread/source metadata and renders Completion Evidence without the new SG2 boundary semantics. A pure fixture reproduction yields `PMOS_SAVE_SUCCEEDED` even when a corresponding SG2 lifecycle is complete. This is a confirmed contract mismatch, not a reported downstream operational incident or proof of consumer failure.

Smallest correction requires the MEMOROS owner: preserve original FlightRecord provenance, label snapshot readiness and consume a separately bound/validated lifecycle projection or explicit current-status reference for SG2. Do not change frozen completionEvidence, fake final status before ACK, re-import old tasks or change SRM semantics. Exact external targets: `apps/api/src/integrations/pmos/pmos-artifact-adapter.ts`, `pmos-artifact-adapter.types.ts`, `pmos-conversation-artifact-mapper.ts`, associated view/processing consumers and tests. A reviewed source/transport contract and final-event convergence mechanism are needed; this repository/task cannot silently authorize that cross-repository change.

## 7. Render provider baseline and operational effect

| Property | DIRECTLY_VERIFIED provider state |
| --- | --- |
| Workspace | `tea-d7lps8rbc2fs73cn80dg` |
| Service | `srv-d88utm77f7vs73blrj1g`, pmos-spendguru2-development |
| Environment | `evm-d88urem7r5hc73csgga0`; project `prj-d88urem7r5hc73csgg90` is Canon/previous evidence, not returned by current service API |
| Source | https://github.com/profitia/SG-dev, main, root apps/pmos |
| LIVE | `dep-dapnv7gjo6nc73cskt1g`, SHA `1abae93c972290ae8af5e2689320551824055ea7` |
| Deployment state | LIVE, not suspended, maintenance off; one instance |
| Auto-deploy | yes / commit; does not wait for CI |
| Build filter | apps/pmos/**, Canon/registries/profitia-projects-v1.json, render.yaml; ignored paths empty |
| PR previews | generation off / pullRequestPreviewsEnabled no |
| Build / start | npm install --include=dev && npx prisma generate && npx next build / npm run start |
| Runtime / region / plan | Node / Frankfurt / starter; build plan performance |
| Health gate | healthCheckPath empty; provider port readiness is not semantic/database readiness |

A push to the PR branch does not match the service branch, and previews are off. PR workflows contain tests/validation; SG2 and SRM deployment jobs require explicit workflow_dispatch. No PR-side PMOS deployment was found. Other observed SG-dev services also follow main with previews off; no branch-push deployment source matches this PR.

**A merge changes apps/pmos and matches the active build filter. On-commit auto-deploy may start immediately.** It builds the merged main revision, not necessarily the reviewed PR head, and concurrent matching main updates can enqueue another deployment. Current main includes additional SRM/governance source; candidate ancestry/diff proofs preserve it, but release source must be fenced again at publication.

The source application is shared; the discovered Render PMOS web service is one SG2 logical Development instance. No second SRM PMOS service in the workspace inventory was established. SRM tooling consumes the same source with its distinct profile/database. Failure of this web instance is not proven to stop all SRM tooling, but shared-source activation and future operator scripts require SRM regression checks. No live credential values were requested or displayed.

## 8. Neon/schema and live identity limits

DIRECTLY_VERIFIED SG2 continuity: `lucky-dream-96138453`, `br-frosty-lab-als8xfyh`, endpoint `ep-plain-king-al45f92h`, database neondb; read-only SQL role neondb_owner. The snapshot column and seven required lifecycle columns exist. New registration persists. Existing independently sealed records remain readable with valid event chains. Product databases were never used by tests or mutated.

No migration difference exists between current main/PR or LIVE schema source/PR for this implementation. The known missing `prompt_executions.roadmap_node_id` remains separate historical debt; explicit lifecycle selects avoid it. This task did not repair schema or migration ledgers.

Runtime root and bounded GET conversations return HTTP 200 and the existing SG2 artifact IDs. This verifies readable SG2 data, not physical endpoint or role. **Physical Render process → Neon endpoint/branch/role binding remains NOT_VERIFIED.** The provider service API has no safe binding metadata, and a successful local credential/schema read cannot prove the Render process uses those credentials. A bounded runtime identity probe must compare parsed endpoint identity, current_database/current_user and canonical profile without exposing connection strings. Mere registry declaration, service name or matching historical rows is insufficient.

## 9. Last Known Good and coexistence

Provider LIVE deployment and exact source `1abae93...` are verified as the existing LKG identity. Build-artifact retention and a successful rollback exercise are NOT_VERIFIED; listing an old deploy does not prove its artifact remains retained. Source inspection of that exact revision confirms snapshot-based completion display and the legacy finalizer's completionEvidence synchronization/rewrite behavior. It lacks the new SG2 chain protocol.

Render web deployments normally overlap old/new instances during cutover. Current start command starts Next, not a forecast/PMOS finalizer; no startup migration is configured. Existing callback writes a separate publication projection, not canonical FlightRecord JSON. Overlap of web readers does not itself replace snapshots, but legacy readers can show stale status and old distributed CLI finalizers do not share the new protocol. Before activation, freeze SG2 finalization/recovery/publication operations across all worktrees/operators until candidate validation completes. Do not assert that a single service instance count or its local file lock supplies a global writer fence.

After new evidence has been written, old code cannot be treated as a fully compatible operational rollback. It can be considered only a quiesced legacy read/callback service after separate owner approval, with SG2 closeout scripts disabled operationally. The preferred recovery is a reviewed forward correction or a known revision retaining the SG2 immutable reader/writer contract. Never remove events or rewrite JSON/hash/locks to suit old code.

## 10. Exact-source future publication runbook — presently blocked

### Before merge

1. Close the consumer and identity blockers below. Obtain separate Governance/PMOS owner authorization specifying merge method, exact PR head, fresh main, candidate tree, service/workspace ID, downtime/write-freeze window, auto-deploy control and rollback alternative. Approval of this preparation is not approval of those operations.
2. Refresh main/PR, preserve parallel work, verify draft/source, complete preflight and legal new-task registration. Reconcile moving main without force-push. All exact-head mandatory jobs must pass; inspect the actual merge tree. Required owner approval is external to the current zero-approval ruleset.
3. Capture LIVE deploy/SHA, health, schema/role/profile identity, pending/locks and active tasks; read independently sealed SG2 fixtures and historical exception. Verify retained LKG build availability without triggering rollback. No real MEMOROS/PHR call or SQL write is required for a readiness probe.
4. Owner/operator establishes a bounded source publication window and SG2 writer quiescence. Obtain explicit authorization to set auto-deploy off for only `srv-d88utm77f7vs73blrj1g`; read back provider state before merge. Do not modify product services, SRM environments or credentials. This configuration action was not performed or authorized here. If auto-deploy cannot be controlled, keep NO_GO.

### Merge and controlled activation

5. Merge through the protected normal PR route only after separate approval. Record the actual resulting full merge SHA `M`; `M` cannot be invented in advance or assumed equal to the PR head. Confirm M tree equals the reviewed candidate plus accepted fresh base, and run/check exact-M CI. A matching main update or changed tree invalidates approval until reconciled.
6. Verify auto-deploy remains off and no deployment is queued/in progress. Deploy **M explicitly** to the existing PMOS service using the separately authorized provider operation; never “deploy latest”. Record response/deploy ID before monitoring. Unknown response: list existing deployments by M and reconcile read-only before any retry.
7. Monitor provider build/start/cutover; verify LIVE deploy ID and full commit SHA M. Require semantic GET/read tests, not only port/LIVE status: bounded identity, SG2 detail with separate snapshot/current chain, completed/partial/recovery/historical reads, event export and relevant APIs. Confirm no migration/configuration/credential change. Verify SRM source/profile policies and fixture/operational read behavior without accessing product environments.
8. Re-read original JSON/hash/lock seals and linked event chain. New live write smoke tests, if desired, require an explicitly approved new isolated task; do not replay any historical closeout or real publications as a test. Release the SG2 writer freeze only after owner acceptance. Preserve deployment/journal/health evidence and lawful new-task continuity. Auto-deploy reactivation is a separate approved policy decision.

### Rollback and interrupted publication

9. Stop acceptance on wrong SHA/binding, startup failure, invalid chain, snapshot-byte change, SRM regression, false completion/readiness or unexpected publication. Keep source/deploy and writer fences; pause further operations, preserve all evidence. Do not clear unknown intents/pending/locks.
10. Before any new SG2 write, an exact retained LKG runtime rollback may restore the old read surface only under owner approval and verified compatible schema/bindings. Dashboard rollback disables auto-deploy; API rollback does not. Either is a configuration/deployment mutation requiring authorization.
11. After new protocol records exist, **do not resume SG2 finalization with the old source**. Use a separately reviewed forward-fix or compatible rollback revision retaining immutable/chain semantics. Preserve immutable files and append-only rows. Old-reader service restoration is containment, not full lifecycle recovery. No compatible rollback revision or artifact was activated/tested here, so rollback readiness is PARTIAL.
12. For MEMOROS/PHR timeout/lost response, inspect the bound source, intent, existing ACK/provider record/PHR commit ancestry read-only. Reuse existing verified ACK; unresolved outcome remains RECOVERY_REQUIRED. No blind re-publication, standalone PHR shortcut, synthetic event or history repair. Any append-only recovery acknowledgement needs separately authorized canonical recovery.

Provider operational references: [Render deploys](https://render.com/docs/deploys), [rollbacks](https://render.com/docs/rollbacks), [health checks](https://render.com/docs/health-checks), [exact-commit API](https://api-docs.render.com/reference/create-deploy). Exact API deployment does not disable auto-deploy automatically. Retention and environment-group behavior must be verified at execution time.

## 11. Validation and evidence

| Gate | Result |
| --- | --- |
| Full integrated PMOS / immutable / C1/C2 / SRM legacy suites | 102/102 PASS; zero skipped |
| Shared governance, environment and SRM suites | Final current-main integration: 158/185 PASS, 27 FAIL, zero skipped. Exact unmodified f3bff50 reproduces the identical 27 failed tests. Earlier 15a83ec integration: 185/185 PASS; earlier subset: 116/116 PASS. Final broader gate is FAIL, not waived |
| App and lifecycle TypeScript | PASS |
| Production build / enum purity / PMOS authority | PASS |
| Local production SG2/SRM UI and GET conversations | HTTP 200; correct snapshot/current separation and preserved SRM legacy section |
| Independent sealed parent fixture | Full fingerprint and all three original byte hashes preserved |
| Historical Stage 1 exception | Byte-preserved SHA256 4794c0580599f950b5e6bbf7f51ab444c78d52606385ed486acb465d164c5fe6; integrity/authorization remain FAIL |
| MEMOROS live adapter compatibility reproduction | Confirmed REQUIRES_CORRECTIVE; pure fixture, no provider call |
| Remote exact-candidate CI | Verified after branch publication; actual run/SHA is attached in PR/external evidence, not inferred from these local results |

Test SQL writes were confined to disposable PostgreSQL16 on `127.0.0.1:55481`, databases sg2_immutable_test and srm_migration_test. Production Neon is PostgreSQL17; the local/CI16 tests do not claim a separate PG17 deployment rehearsal. No live test writes or actual publication provider calls occurred. Initial local dependency/shared-memory setup failures and a moving-authority governance failure were resolved and tests rerun; no assertion was removed or weakened.

The latest failures are in `apps/srm/scripts/promotion.test.mjs`, `apps/srm/scripts/staging-lifecycle.test.mjs` and `scripts/governance/srm-release-lifecycle.test.mjs`. Tests load current real topology/journal but assume RESERVED/first onboarding; current main now registers ACTIVE Staging. Most errors follow that mode mismatch. The local migration checksum test also reports a missing expected rejection and requires separate owner investigation; it is not dismissed as harmless. `authority-main-test-failure-comparison.json` proves identical failed case names on main and candidate. No failing test or SRM production behavior was modified. Shared/SRM owners must provide isolated lifecycle fixtures and investigate the checksum case before full validation can pass. Successful configured GitHub CI does not override this broader gate.

External evidence root: `pr156-integration-readiness-20261009` under the task's readable outputs. Key files: targets/begin/preflight JSON, tests-full.log, governance-and-srm-release-tests.log, typecheck/build logs, srm-cic-source-compatibility.json, local-ui-verification.json, render-service/deploys/inventory.json, memoros-consumer-proof.json and captured exact-live adapter source, pmos-live-read-probes.json, historical readback, final remote CI/PR data and new-task closeout/readback. The final output index contains hashes and current publication IDs.

## 12. Remaining blockers, owners and formal status

| Blocker | Owner | Minimum lawful next action |
| --- | --- | --- |
| MEMOROS readiness is derived from frozen snapshot | MEMOROS + SG2 PMOS contract owners | Separately scoped cross-repository lifecycle/provenance contract corrective and consumer tests; no historical republishing |
| Render physical database/profile/role binding unavailable in safe metadata | PMOS Platform | Bounded read-only runtime identity probe with exact canonical comparison |
| Automatic deployment is active on main and shared-writer cutover is not fenced | Governance + PMOS operator | Separately authorize bounded auto-deploy control and writer/source publication window; verify before merge |
| LKG retention/compatible operational rollback not proven | PMOS release owner | Verify retained artifact and approve containment/forward-fix plan retaining SG2 contract |
| Legacy standalone SG2 recovery/publication paths are not chain-aware | PMOS Governance | Review narrowly scoped recovery entrypoints; exclude from automatic retry/activation operation until verified |
| 27 broader SRM/shared test failures also present on current main | SRM release + shared governance owners | Isolate RESERVED/first-onboarding fixtures from live ACTIVE registry; investigate checksum rejection failure; require complete suite PASS without suppression |

`PR156_INTEGRATION=PARTIAL` because full broader validation remains failed (the local procedural deviation above is an additional separate audit finding); `CURRENT_MAIN_RECONCILED=YES` at f3bff50; `SG2_IMMUTABLE_NON_REGRESSION=PASS`; `C1_C2_NON_REGRESSION=PASS`; `SRM_PMOS_NON_REGRESSION=PASS`; `CIC_GOVERNANCE_NON_REGRESSION=PASS` for verified unchanged source/profile controls. `FULL_VALIDATION=FAIL`: PMOS tests pass but the broader suite fails. End-to-end `SOURCE_COMPATIBILITY=PARTIAL`, `CONSUMER_COMPATIBILITY=PARTIAL`, `PMOS_RENDER_BASELINE=PARTIAL`, `AUTODEPLOY_RISK=BLOCKED`, `LAST_KNOWN_GOOD=VERIFIED` for provider identity only, `ROLLBACK_READINESS=PARTIAL`, `DEPLOYMENT_RUNBOOK=PARTIAL`, **`PR156_MERGE_READINESS=NO_GO`**.

Ordinary PMOS/MEMOROS/PHR closeout belongs only to this new task. Its receipt/readback is recorded after source/CI verification; technical closeout cannot convert these deployment blockers to PASS. No earlier task is replayed. Stage 1 remains PARTIAL; Stages 2–5 remain NOT READY. Next action: owner review and authorization of the bounded consumer/binding/recovery corrective, followed by a fresh readiness decision. Merge and deployment require a separate explicit decision.
