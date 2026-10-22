# B2-E — lifecycle preparation and transactional authorization evidence

22 October 2026. ARCHITECTURE / Development. Task `ARCHITECTURE-IDENTITY-B2-E-LIFECYCLE-20261022`, actual host `01a15aed-8d94-7fe0-9cff-c54f72b5f8a8`. Source authority `profitia/SG-dev`, main. This is implementation preparation with controlled regression tests; no runtime policy is activated.

## Authority, routing and continuity

Initial fresh base `1cf170fa7180445877d980de4e6b8df37bbd7d49` contains accepted B2-D promotion `aa95c0a0a14fb2f2ba5af7338c8d83a6fb349269`. During first-candidate CI, parallel PR602 advanced main to `1922aab9788ccd191da8a2c517cae9f48ef78ed8`, changing only two unrelated SRM evidence documents. The current-main ancestry check correctly blocked the older candidate; that BLOCKED result is retained. Reconcile both histories, repeat the full preflight (PASS) and rerun exact-candidate CI. No bypass or governance logic change. B1/B2/B2-D acceptance is reused. All 33 active CORE/ARCHITECTURE document hashes are unchanged; manifest validates all 47 active documents. Root AGENTS, Architecture adapter and supplied wrapper apply with explicit ARCHITECTURE selection. Own clean isolated checkout, own PMOS environment/context and dedicated PHR clone; no SG2/SRM continuity.

Own registration `cmvjc49kl0000qcjg6ucg7bjh`, conversation `pmos-task-v2:a4712b781cdb993de59eb0691d48df29fa4e698689b38448e9ae513e3bd21969`, DB `architecture_pmos`, ordinary role `architecture_pmos_runtime`. Canonical BEGIN and full require-begin preflight PASS before edits. MEMOROS is DISABLED_BY_PROFILE.

Exact five target paths and routing:

| Path | Owner / code state |
| --- | --- |
| `Canon/evidence/2026-10-22-identity-runtime-porr-first-decision.md` | Governance Source Layer / ALIGNED |
| `Canon/runbooks/identity-runtime-lifecycle-and-persistent-login-v1.md` | Governance Source Layer / ALIGNED |
| `Canon/evidence/2026-10-22-identity-runtime-lifecycle-b2-e.md` | Governance Source Layer / ALIGNED |
| `apps/identity-runtime/test/lifecycle-resilience.test.mjs` | Architecture Platform / ALIGNED |
| `apps/architecture-lab/test/access-store-postgres.test.mjs` | Architecture Platform / ALIGNED |

Preserve original [PR600](https://github.com/profitia/SG-dev/pull/600) source `97d2839dde880bf9ab20c605ef5eb7b736f112a4` in ancestry and reconcile current main without force rewriting. Extend that one decision and keep it DRAFT. Accepted owner requirement is Event-Driven Administration + Transactional Authorization; canonical source merge remains unapproved. [The runbook](../runbooks/identity-runtime-lifecycle-and-persistent-login-v1.md) carries the exact renewal proposal, security matrix, browser design, resilience comparison and owner packet; it installs nothing.

## Local verified tests

| Validation | Result | Scope / limitation |
| --- | --- | --- |
| Identity lint, TypeScript, executable build | PASS | Accepted Node24.15 / pinned SDK3.25.0 and dependencies |
| Identity Runtime full regression | 134 PASS, 0 failed, 0 skipped | Includes official SDK against synthetic RSA/HTTP transport; no live Clerk users |
| Producer + Architecture lab full regression | 1312 PASS, 0 failed, 0 skipped | Actual disposable loopback PostgreSQL16, ordinary runtime roles; no Neon |
| Governance / workspace regression | 24 PASS, 0 failed, 0 skipped | Manifest/profile/routing/begin/no-bypass checks |
| SG2 adoption contract | 2 PASS | Unchanged consumer source |
| SRM adoption contract | 2 PASS | Unchanged consumer source |
| Governance manifest | PASS | No active manifest, routing registry or installed migration change |

Initial sandbox runs could not bind loopback/shared memory. The final complete runs used authorised local execution with the same test files and no product/provider credentials. No production code was changed to satisfy tests.

New identity tests launch two actual Node processes, lose navigation state, require a new nonce/fresh authentication and deny replay, substitution, wrong destinations, revoked/expired/incomplete/outage state. They confirm provider-revoked logout survives store replacement. They intentionally expose that **failed** provider revocation is not durable through process replacement; no successful logout is claimed. Fixed binding deadlines demonstrate near-expiry proof capping and denial after days even with a fresh synthetic provider proof; DB outage cannot reuse ALLOW. Existing B1/SDK suites cover issuer/subject, disabled/revoked accounts, audit/version rollback, parallel provisioning and no organisation auto-grants.

Five new actual PostgreSQL subtests exercise the existing private operation host: membership suspension, permission removal, product revocation, rollback plus permission addition, and actual overlapping business transaction/administration. All three revocations deny the next callback while the same permanent account/binding and another organisation remain valid. Concurrency waits are observed via `pg_blocking_pids`, not assumed from sleep timing; product effect and OUTCOME commit, waiting admin mutation commits, next admission denies. These are synthetic administrative fixture writes, not an implemented/admin-authorised product mutation endpoint. Existing tests preserve policy/version/RLS/deadline/audit enforcement and both consumers' compatibility.

Exact candidate Identity CI passed and published `b2-source-proof.json`, binding candidate SHA, validation base and all five changed paths to canonical governance; its producer job repeated the complete real PostgreSQL suite. Governance CI also passed. The separate Platform contract integration passed producer/lab, SG2 dashboard, both adoption checks and SRM operations, but **SG2 operation integration failed** with `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`. Overall source CI is FAIL, not PASS. Final PMOS/PHR HANDOFF supplies the final exact SHA/run IDs. Test results do not prove unimplemented renewal SQL or real browser persistence.

This has a distinct trust-boundary cause: trusted-main `scripts/governance/controlled-package-ci.mjs` deliberately admits Architecture producer changes only in its narrow package/evidence allowlist and requires a `packages/platform-contracts/**` delta. B2-E has two application regression files, a runbook and no producer change. The current selector therefore cannot admit it to the secret-bearing controlled SG2 proof phase. No privileged dispatch, policy extension, environment change, token access or substitute SHA/proof is used. Keep the missing exact-candidate proof visible. A separately reviewed Architecture CI compatibility task must explicitly classify this bounded Identity test/documentation candidate before any controlled execution, preserving main-only controller, full path/blob/routing validation, exact SHA and credential separation. This task does not broaden that policy or hide the check.

## Read-only provider facts and preserved boundaries

Authenticated Clerk Development Dashboard confirms maximum session7days, inactivityoff, multi-sessionoff, reverification10minutes, app `app_3KoJk9FmKeTC4hhlQwTgX6PMZmD` / instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`. No configuration, key, user or session mutation. Per-user Remember me support remains **PENDING**; omit a cosmetic checkbox. Live reload/new-tab/days-later/challenge/SSO acceptance remains PENDING.

Render readback confirms service `srv-dbcse6jrjlhs73eib3sg`, original Development environment, Free Frankfurt, auto-deploy off, unchanged update timestamp `2026-10-22T08:28:40.035222Z`. Accepted deploy remains `dep-dbcse73rjlhs73eib57g`, health-only/disabled. B2-E creates no new build or deployment, reads no secrets and changes no provider configuration. Accepted B1 installed digest and inactive policy are not modified. Continuity writes concern only Architecture PMOS/PHR, not the product database.

No live Neon schema/data, Clerk config, Render plan/service, real user/grant, SG2/SRM source/deployment/cutover, paid upgrade, event bus or active multi-replica feature. Original B2-D immutable input/Flight Record/publication receipts remain byte-identical.

## Preparation verdict and remaining owner actions

`PARTIAL`: the design/test preparation is ready for owner review, while overall source CI lacks its required controlled SG2 proof. Renewal design and Access Store reuse PASS only at their stated design/test layers. Existing behaviour is preserved. Expired ACTIVE recovery requires explicit policy approval and a separately reviewed additive implementation/migration; REVOKED or disabled identities must never revive. A recommends one fresh navigation retry within current single-process limits; shared atomic state is deferred, durable failed-logout handling and replica safety remain unaccepted.

Exact remaining owner actions are [the runbook's packet](../runbooks/identity-runtime-lifecycle-and-persistent-login-v1.md#exact-owner-decisions-and-controlled-activation-plan): PR600 source acceptance/merge after controlled CI compatibility; active renewal plus separately approved expired recovery/window and revocation SLA; Clerk duration/frontend SDK/domain/challenge acceptance; bounded restart/failure UX and topology choice; a separate time/cost/data/restore/cleanup-bounded Development activation GO. The accepted administration principle itself needs no repeated approval. Next recommended stage is **B2 Live Clerk & Browser Session Acceptance**, with the controlled CI blocker resolved first; neither task is started here.

Canonical PMOS save, full persisted Flight Record/HANDOFF readback, integrity/seal, PHR reachable commit, no-added-history-issues check, pending/locks CLEAR and final full preflight are required before reporting this unit closed. PR600 remains DRAFT and unmerged even after producer continuity completes.
