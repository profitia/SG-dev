# SRM — first and subsequent Staging promotion runbook

Task SRM-STAGING-ONBOARDING-READINESS-20261008. Preparation is authorized; executing this runbook against Staging is NOT authorized by the task. Stage remains RESERVED/NOT_ONBOARDED. Production and product Development are never write targets. This replaces PR #148's unresolved S0 procedure with the implemented lifecycle.

## Prerequisites and accepted release

Use a clean reviewed authority main checkout in SG-dev Codespaces SRM (or the existing protected GitHub job after onboarding). Load root AGENTS, current manifest, shared Canon and SRM adapter. Refresh origin/main. The separate lifecycle preflight preserves independent normal gates; ordinary RESERVED tasks still fail. Future Staging has no PMOS/PHR lifecycle and receives no continuity credentials; MEMOROS stays disabled.

The business command must explicitly approve a concrete 40-hex SHA. It must be a main ancestor, pass the latest srm-build for that SHA, and be live on Development at initial authorization. DDL and runtime binding contract must match the executor. Concurrent main business changes are allowed; changes to governance/promotion mechanics require restart from reviewed main. Resume uses the same manifest and actual recorded historical Development deployment proof, even if Development later advances. No automatic newest-main selection.

Acquire least-scope management capabilities: GitHub metadata/checks read, environment management/secrets/variables, release-branch creation/protection and contents CAS write; Render read/create/update/deploy limited to the approved SRM workspace/environment; Neon metadata/database creation and direct migration owner access to the exact SRM Stage branch. The executor checks actual capabilities through acknowledged API operations; no secrets printed. Missing privileges fail closed. Current main is unprotected; if it becomes protected, the existing CAS adapter refuses execution BEFORE provisioning and requires a reviewed legal publication adapter. Never disable protection.

Secure operator variables: TARGET_ENVIRONMENT=staging, SRM_NEON_PROJECT_ID=snowy-breeze-40315151, SRM_NEON_BRANCH_ID=br-broad-butterfly-b11t4v01, SRM_APP_DIRECT_URL (neondb_owner, direct Stage host, /srm_app, TLS), unique SRM_STAGING_ORGANIZATION_ID, six required product secrets, VERCLY_API_BASE_URL and MGBI_AUTH_SCHEME, RENDER_API_KEY, NEON_API_KEY, SRM_RELEASE_GITHUB_TOKEN. Runtime password >=32, demo password >=16, session secret >=32; product keys/session/password must differ from Development. Provider account access/quota for client acceptance must be approved, not guessed. No secret values in manifests/reports/repository or command-line arguments.

## Read-only preparation and explicit approval

Offline DDL plan and legacy promotion simulator:

~~~sh
npm --prefix apps/srm run migrate:staging:plan
npm --prefix apps/srm run promote:staging -- --simulate
~~~

Full first/normal lifecycle simulation and local SQL are the automated staging-lifecycle tests. Fixtures are explicitly synthetic and do not establish live provider behavior. The existing --plan reports missing current resources as deployment-time prerequisites; the lifecycle implements creating them after approval.

Create a real release manifest using read-only provider access and the accepted SHA:

~~~sh
npm --prefix apps/srm run promote:staging -- --manifest --sha "$APPROVED_SHA" > /secure/release-manifest.json
~~~

A schemaVersion 2.0 approval must include: projectKey SRM, targetEnvironment staging, mode onboard/promote/rollback, stagingDeploymentAuthorized=true, stagingMutationsAllowed=true, productionMutationsAllowed=false; manifest, releaseSha and digest(manifest); repository profitia/SG-dev and ID 1247665550; renderWorkspaceId tea-d7lps8rbc2fs73cn80dg, renderProjectId prj-dapbd3hsrm7s73es53fg, renderEnvironmentId evm-dapbdbbbc2fs73f4g7gg; neonProjectId snowy-breeze-40315151, neonBranchId br-broad-butterfly-b11t4v01, neonEndpointId ep-autumn-wildflower-b1mv0vda, databaseName srm_app; unique approvalId, actual approvedBy/costOwner, future expiry <=24h; operations exactly github-environment, github-bindings, release-pointer, database, schema, service, deploy, source-rebind, verify, reconcile.

Budget: renderPlan 0.5c-512mb, renderInstances 1, renderMonthlyComputeUsd 7 maximum, neonMaxCu <=8 matching existing endpoint, neonExistingEndpointOnly=true, providerEntitlementsAccepted=true, storageEgressBuildCostsAccepted=true, maxDeploymentAttempts integer 1–3. First mode additionally needs firstOnboardingAuthorized=true, exact unique positive githubReviewerIds (1–6), and costEvidence {source:PRIMARY_PROVIDER_QUOTE,url:https://render.com/pricing or https://dashboard.render.com/billing,verifiedAt:fresh <=24h,monthlyComputeUsd:actual quote <=approved maximum}. Refresh actual price before authorization; no price API is assumed. Approve these fields through the future business decision, not by copying a synthetic fixture. digest is the exported SHA256 JSON digest helper; changing manifest invalidates approval.

## One command: “Wypchnij na staging”

After the future explicit authorization, execute from the reviewed SRM operator context:

~~~sh
npm --prefix apps/srm run promote:staging -- --apply --sha "$APPROVED_SHA" --authorization /secure/staging-lifecycle-approval-v2.json
~~~

No infrastructure design is required at execution. The executor validates IDs/cost/isolated credentials before claiming the journal, creates only approved missing resources, initializes blank schema before creating the runtime, and records every effect. Never run this command during the preparation task.

First onboarding: GitHub environment with exact required reviewers, prevent self-review and only main deployment policy; encrypted environment-scoped product and management secrets/config variables plus metadata receipt; locked srm-release-SHA pointer; missing srm_app; atomic role/schema/blank organization; native Render service on that pointer with autoDeploy/previews off; actual initial live SHA; service PATCH to main/off; health/auth/persistence; evidence-based topology/journal reconciliation. No domains or DNS. Do not manually mark ACTIVE.

Subsequent normal promotion can use the same operator command with mode=promote, or the guarded protected job:

~~~sh
gh workflow run srm-ci.yml --repo profitia/SG-dev --ref main -f approved_sha="$APPROVED_SHA" -f staging_deployment_authorized=YES -f cost_owner="$COST_OWNER" -f initialize=false
~~~

The dispatch guard rejects RESERVED before an environment job can implicitly create srm-staging. Required reviewer approval remains in force. The job invokes the same lifecycle, uses only protected Stage-scoped credentials, and never creates a separate development branch. Push main and PR events cannot enter deployment jobs.

## Interruption, partial provisioning and recovery

Keep Canon/registries/srm-staging-release-state-v1.json, approval/manifest and sanitized stdout evidence. Every step has fenced INTENT and observed DONE, with before/after snapshots. Rerun the same command/approval; completed steps are verified and skipped. A known accepted service/database/deployment recovered from provider IDs/correlation markers is reused. Ambiguous response with no observable accepted resource stops; investigate actual provider state/read-only logs before retry, never blind create. Known terminal deployment failure can retry only inside the accepted attempt budget. Missing schema transaction COMMIT leaves no partial schema/role; successful COMMIT is preserved across runtime failure.

No timeout lease stealing: another executor needs API proof that the previous run completed or Codespace is shut down, with the same approval/manifest. Expiry renewal cannot alter cost/resources/operation scope. A CAS conflict or newer baseline requires reread and revalidation; no force overwrite. If deployment succeeds but publication fails, resume reconciliation from actual proof. If final acknowledgement is lost, the next run verifies completed release read-only. Provider and GitHub state are not ACID together.

## Post-deployment acceptance and baseline

Automatic proof: exact successful Render SHA/deploy/service/env, main/off and config; protected GitHub environment/binding receipt; exact Neon project/branch/database/direct URL, complete checksum ledger and FORCE RLS catalog; nonprivileged runtime login and own organization; HTTPS health environment staging; wrong-password rejection, secure authenticated session/page; committed idempotent synthetic lookup probe through actual runtime SQL login plus wrong/no-tenant denial. Reconciliation publishes actual identities and proof, not hand-entered expected IDs. Only then ACTIVE/VERIFIED/ONBOARDED is legal; providers are reread after publication.

Deployment-time client acceptance: real isolated supplier account entitlement/quota and approved supplier integration sample; UI/assets/PDF/export smoke; logs/monitoring and agreed cost/availability. Do not call mocked/provider request-schema tests evidence of real first deployment. If a live required fact fails, stop activation and retain evidence/LKG.

## Controlled code rollback

Use a separately explicit mode=rollback approval, recorded LKG SHA, rollbackSchemaCompatible=true and the same bounded resource/operation contract:

~~~sh
npm --prefix apps/srm run promote:staging -- --apply --rollback --sha "$LKG_SHA" --authorization /secure/rollback-lifecycle-approval-v2.json
~~~

Historical successful Development release and latest exact CI/main ancestry must be verified. Current complete ledger/DDL and runtime contract must be compatible; rollback SQL stays read-only. No schema down-migration, branch reset or data deletion is inferred. The same verification/reconciliation publishes actual new code baseline. If compatibility cannot be established, use a forward fix through Development or a separate owner data-safety decision.

## Blocker handling

Wrong immutable ID, Production/PMOS target, shared credential, unauthorized RESERVED, stale/ambiguous baseline, foreign inflight deploy, moved locked pointer, unverified SHA/CI/Development, drifted contract/schema, missing protection or unsupported publication capability all fail closed. Preserve the canonical journal and existing data; no fallback service/database or security override. Future provider changes must be handled in a new reviewed Development preparation change.
