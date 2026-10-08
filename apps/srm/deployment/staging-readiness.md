# SRM Staging Readiness — first onboarding and release lifecycle

Task: SRM-STAGING-ONBOARDING-READINESS-20261008. Project SRM; preparation TARGET_ENVIRONMENT=development; release target staging. This report supersedes the three unresolved implementation blockers recorded by PR #148 and its Development PHR. It grants no deployment authorization.

## Executive Result

STAGING_READY_TO_DEPLOY=YES for the current verified provider and repository contract, after the accompanying validation and CI gates pass. The first-onboarding executor, exact first-source strategy and canonical reconciliation are implemented. Real provider first deployment remains NOT_EXECUTED. Staging remains RESERVED/NOT_ONBOARDED. No Staging/Production writes, product Development migrations or Development runtime deployment are part of this task.

## Verified Baseline

Repository profitia/SG-dev, ID 1247665550, authority main. Prior readiness merge 0ba0ce5258735764ee19519115540fee168da55c; integration baseline 18ee002b4b542c07b1a5ceebc4280d46d8d6a7c2 includes parallel PRs #149–151. Source authored only in SRM Codespace srm-pmos-activation-jjxx6vpp9v4x2q9vr, isolated own branches/worktrees, final preparation worktree /tmp/srm-staging-onboarding-readiness-20261008-v3. Existing checkouts and unrelated work preserved. The parallel task was stopped by the user after its last merge; its prior runtime deployment is not attributed to this task.

Root AGENTS.md, active manifest, shared execution/release Canon and SRM adapter loaded. Development full preflight with task-scoped SRM pmos:begin passes. Routing: apps/srm/** and exact srm-ci.yml = SRM Runtime / ALIGNED; Canon/** and scripts/governance/** = Governance Source Layer / ALIGNED, normative owner Profitia Governance. Manifest adds the durable release-state registry, proposed 3.7.0. Standard RESERVED rejection remains intact. MEMOROS remains canonically disabled.

## Resolved Blockers and Architecture Decisions

S0_LEGAL_FIRST_ONBOARDING: a separate explicitly authorized SRM/Staging lifecycle retains independent normal preflight gates and replaces only target-existence/previous-provider-baseline gates with exact operation authorization, current resource snapshots and fenced journal ownership. Execution phases ONBOARDING_AUTHORIZED → PROVISIONING → VERIFYING → VERIFIED belong to the journal, not new environment statuses. The topology stays RESERVED/NOT_ONBOARDED until final actual proof.

FIRST_RENDER_DEPLOYMENT_SOURCE_NOT_PINNED: native provider-managed Render creation uses srm-release-<approved40hexSHA>, created at the approved main-ancestor SHA and locked with administrator enforcement, force-push/deletion denied. Actual ref/protection are verified before service creation and initial deployment. Every initial deploy must match SHA. After exact live proof, service PATCH moves its source to main with autoDeploy off; Render documents PATCH does not deploy. The locked pointer remains evidence, never a development branch. No image, new runtime, Blueprint or permanent staging development line is introduced. The guarantee is exact source; bit-identical immutable artifact remains PLANNED_HARDENING.

CANONICAL_PROVIDER_BASELINE_RECONCILIATION: actual provider IDs, live deploy ID/SHA/state, configuration, protected GitHub bindings, full schema ledger/catalog, runtime role, tenant isolation, health/password and committed synthetic persistence proof are reconciled with the approved manifest. GitHub createCommitOnBranch expectedHeadOid publishes topology plus verified journal in one GitHub commit. Provider operations are separate transactions; there is no cross-provider ACID claim. Concurrent/stale writes fail closed.

## First-Onboarding Lifecycle and Retry

One executor handles onboard/promote/compatible code rollback. Order: independent authorization/source/CI/Development/cost/binding preflight; durable ownership claim; protected GitHub environment; encrypted environment-scoped secrets/configuration receipt; frozen pointer; missing Neon product database; transactional schema/runtime/blank-organization initialization; pinned Render service creation (automatic first deploy); exact live-source verification; source rebind; runtime verification; baseline reconciliation; final reread and verification.

Before each operation: fresh authority and provider snapshot, legal exact target, fenced INTENT. After: observe actual effects and store DONE with before/after evidence. Accepted response lost: recover from provider facts; ambiguous absence: stop instead of blind creation retry. Schema failure rolls back its transaction; code deployment failure preserves committed schema/data. Known terminal failures permit only the approved bounded number of attempts. Foreign inflight or ambiguous live deployments block before schema writes. Completed release after lost acknowledgement is verified read-only.

A local process lock plus durable executor owner serializes writes. No lease expires into automatic takeover. Another executor can resume the same manifest/authorization only after API proof that the prior GitHub run completed or Codespace shut down. Authorization renewal may extend expiry and refresh the same price evidence; changes to resource/cost/operation scope cannot silently resume. New releases store the previous verified baseline as Last Known Good.

## Database and Render Evidence

Fresh read-only product Development inspection: snowy-breeze-40315151 / br-dark-surf-b1vrhda9 / srm_app; 11/11 source SHA256 checksums match; 15/15 product tables FORCE RLS; plpgsql; srm_app_runtime LOGIN without superuser, BYPASSRLS, create DB/role or replication. No product SQL writes performed. Staging br-broad-butterfly-b11t4v01 still has only neondb ID 308649; no srm_app. Production br-nameless-bar-b1wlhjhx remains protected; metadata read only.

Render workspace tea-d7lps8rbc2fs73cn80dg, project prj-dapbd3hsrm7s73es53fg. Development srv-db1vu6gm7kps73d0e3r0: main, native Node, Frankfurt, 0.5c-512mb, one instance, autoDeploy off, health /api/health. Fresh live read: dep-db3v60ks728c73fc2ghg, SHA 18ee002b4b542c07b1a5ceebc4280d46d8d6a7c2, completed 2026-10-08T19:47:27Z by the parallel task. This is evidence, not a fixed future release target. Staging Render environment evm-dapbdbbbc2fs73f4g7gg has zero services. GitHub srm-staging GET returns 404. None were created by this preparation.

## Implementation and API Evidence

Executable orchestration: apps/srm/scripts/staging-lifecycle.mjs; normative gate/journal/reconciliation: scripts/governance/srm-release-lifecycle.mjs; existing promote-staging.mjs delegates apply to that executor. Existing Development migrator remains unchanged. CI push/PR only tests/builds; guarded manual normal promotion rejects RESERVED before entering a protected environment job. First onboarding runs from an explicitly approved SRM operator context, then subsequent protected manual jobs use the same executor.

Official Render OpenAPI SHA256 36f783c66b60e71df8b5f105f347821e75d531cea21058ab76e5f2d19b6e459a was checked against the actual generated native create-service payload. PASS means request-schema compatibility, not observed first deployment. Primary contracts: [Render create](https://api-docs.render.com/reference/create-service), [configuration PATCH](https://api-docs.render.com/reference/update-service), [explicit commit deploy](https://api-docs.render.com/reference/create-deploy), [GitHub branch protection](https://docs.github.com/en/rest/branches/branch-protection), [GraphQL expected-head commit](https://docs.github.com/en/enterprise-cloud%40latest/graphql/reference/commits), [encrypted secret CLI](https://cli.github.com/manual/gh_secret_set). Provider lock capability/protection, actual first source and no-deploy rebind are reverified live and fail closed if inconsistent.

## Validation and Non-Regression

Current main integration: typecheck PASS; 197/197 application tests PASS; full build PASS; local real PostgreSQL 16 promotion/migration/persistence suite PASS (zero skip); governance manifest/routing and full governance tests PASS. Detailed final counts/run references are in validation-evidence.json and final Development PHR. Synthetic lifecycle tests exercise every interruption/retry step, normal promotion/rollback, partial provision, incorrect IDs/SHA/schema, moving main, ambiguous responses, concurrent ownership, baseline conflicts/staleness and post-publication drift. Tests explicitly distinguish synthetic provider fixtures from primary live reads and actual local SQL.

No business application source changed. Parallel cockpit/UX/PDF changes remain included. Development runtime autoDeploy is off; merging preparation does not deploy it. A fresh Development deployment is deliberately not executed and is not reported as verification of this task's runtime.

## Release Mechanism

Future business command “Wypchnij na staging” resolves to the single executor command in staging-promotion-runbook.md, after explicit SHA/resource/cost authorization and secure bindings. The runtime accepts a concrete manifest, never arbitrary new main. First onboarding and later promotion differ only by initial canonical state and mode. A future policy change protecting main blocks before provisioning until a reviewed CAS publication adapter is provided; this task does not disable security.

## Governance / PMOS / PHR and Git Evidence

All preparation continuity uses the NEW task's Development-only registration in Neon bold-breeze-68888550 / srm_pmos. No SG2/CIC or product database receives history. Canonical final save, CLOSEOUT_COMPLETE and acknowledged PHR publication, PR/merge SHA and clean final authority are reported in the final task handoff after they actually succeed. Prior PR #148 PHR remains independent historical PARTIAL_SUCCESS. MEMOROS disabled; no Staging PMOS/PHR.

Own checkpoints include 6ad6cd6, 9db3765 and f81511e; final publication uses chore/srm-staging-onboarding-readiness-20261008-v3. This document avoids a self-referential future merge SHA. Final PR/CI/merge evidence belongs to the canonical Development closeout.

## Rollback / Known Risks / Deployment-Time Pending

Rollback selects the recorded LKG SHA, rechecks historical successful Development release and current successful exact CI/main ancestry, and requires identical compatible DDL/runtime contract. SQL remains read-only for rollback; no down-migration/reset. Unknown schema compatibility requires forward fix or a separate owner decision. Tests verify schema transaction recovery and compatible code rollback; real Staging rollback remains live pending.

Pending activation checks: explicit release and first-onboarding approval; fresh account price/entitlement acceptance and isolated supplier credentials; GitHub lock/reviewer/encryption actual acknowledgements; actual product DB/runtime/schema initialization; exact first live deploy and no-deploy source rebind; real health/TLS/password/committed runtime SQL persistence; supplier API entitlement/acceptance and client UI/assets/export smoke; real rollback and final baseline proof. These are future authorized execution/verification, not missing controller implementation. No provider first deployment PASS is inferred from mocks.

Known risks: existing Neon Stage endpoint has max 8 CU and suspend=-1 (unchanged); usage/egress/provider licensing costs need explicit owner acceptance. API/permissions/price drift fail closed. GitHub CAS commits and provider mutations are not a shared transaction; partially successful provisioning must retain its journal. Required GitHub reviewers still apply to ordinary protected jobs. First operator onboarding uses documented explicit privileged execution, never implicit approval.

## Final Decision

STAGING_READY_TO_DEPLOY=YES
LEGAL_FIRST_ONBOARDING=PASS
FIRST_DEPLOYMENT_SOURCE_PINNING=PASS (implementation + primary API contracts; real first deploy NOT_EXECUTED)
PROVIDER_BASELINE_RECONCILIATION=PASS
FIRST_PROMOTION_WORKFLOW=PASS
RETRY_IDEMPOTENCY=PASS
CONCURRENCY_PROTECTION=PASS
GOVERNANCE=PASS
SRM_CI=PASS ([primary CI run](https://github.com/profitia/SG-dev/actions/runs/37841311277); final publication gates are rechecked before merge)
PROMOTION_DRY_RUN=PASS (synthetic full lifecycle + actual isolated SQL)
REAL_PROVIDER_FIRST_DEPLOY=NOT_EXECUTED
STAGING_DEPLOYMENT_AUTHORIZED=NO
STAGING_DEPLOYED=NO
STAGING_DATABASE_MUTATED=NO
PRODUCTION_MUTATED=NO
DEVELOPMENT_RUNTIME_DEPLOYED_BY_THIS_TASK=NO
BLOCKERS=[]

Published review: [PR #152](https://github.com/profitia/SG-dev/pull/152). Hosted CI independently executed 197 application and 98 promotion/PostgreSQL tests with zero skip, plus 28 shared lifecycle governance tests. Its Staging jobs were skipped for the PR event. Final merge and acknowledged continuity evidence are recorded in the canonical Development handoff.
