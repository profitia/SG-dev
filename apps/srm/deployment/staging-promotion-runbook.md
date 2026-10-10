# Current execution status — 2026-10-09

The original preparation-only instructions below are historical. Separately authorized first onboarding completed: Stage is ACTIVE/VERIFIED in canonical topology and journal generation21, baseline publication [PR180](https://github.com/profitia/SG-dev/pull/180). Live service srv-db496b3tqb8s73eh5sfg at https://srm-staging-runtime.onrender.com deployed accepted SHA886ce9d92bea5c0c2ae5dc8ae98cb2a44ee71fc1 as dep-db496brtqb8s73eh5up0. The final read-only live proof verified schema11/11, RLS, health, login and durable persistence. Development/Production were unchanged.

Main is protected by ruleset23304085; use the reviewed protected PR publisher, never direct writes or disabled protection. A Stage password repair is independently approved after the owner confirmed reuse of the Development demo password. The preparation below permits implementation; applying the new password still requires the separately fenced Stage-only repair and live verification.

# SRM — first and subsequent Staging promotion runbook

## Existing Staging owner-review corrective — prepared, live application separately authorized

For existing srm-staging ID 23853126630 in profitia/SG-dev only, Canon section 14 and github.soloOperatorApproval permit the same owner profitia ID 275643368 to dispatch and subsequently review a protected workflow. Keep profitia as the sole required reviewer and the sole main branch deployment policy. Existing prevent_self_review=true remains accepted until separate explicit owner consent to change it to false. This section supersedes any independent-review implication below for this exact existing environment; first creation still uses true.

Before changing the live rule, present the tested, reviewed corrective and ask the owner specifically to approve prevent_self_review true -> false for srm-staging. A prior SHA authorization does not suffice. Take a fresh complete GitHub Environment snapshot, branch-policy/ruleset proof and secret-metadata inventory. Run Stage preflight without PMOS, then update only the explicitly approved review setting, preserving reviewers, wait timer, branch policy and all other settings. Record consent and sanitized before/after evidence; verify other environments, main protection and secret metadata are unchanged. Never disable reviews or use administrative bypass. Normal lifecycle execution only observes and validates existing protection, and cannot apply this corrective implicitly.

After the policy operation, rebuild the canonical manifest for the frozen application SHA and revalidate its exact digest and owner authorization. A changed digest requires explicit manifest-bound acceptance; do not fabricate it from an old approval. Dispatch SRM CI at reviewed main with the exact accepted application SHA. Ask the owner to approve the waiting srm-staging job in GitHub. Do not approve it automatically on the owner's behalf: the owner performs the separate review. Verify the reviewed job, Render LIVE exact SHA, isolation and release evidence before accepting the promotion. Preparation tests do not establish successful owner review.

Task SRM-STAGING-ONBOARDING-READINESS-20261008. Preparation is authorized; executing this runbook against Staging is NOT authorized by the task. Stage remains RESERVED/NOT_ONBOARDED. Production and product Development are never write targets. This replaces PR #148's unresolved S0 procedure with the implemented lifecycle.

## Exact existing domain — read-only observation

Canon section 15 and staging-contract.json existingDomainBinding authorize observing only demo-srm-porr.spendguru.app, ID cdm-db4btcvlk1mc73fhn7sg, on existing Staging service srv-db496b3tqb8s73eh5sfg. The topology records that binding. Domain/DNS mutations remain outside the lifecycle; first onboarding and other services still require empty domain inventory. Obtain the full fresh provider inventory from the exact service. Reject missing or additional domains, changed IDs/names, unverified status, redirects and mismatched topology before any release ownership or provider write. Include observed binding in live verification and preserve it in final reconciliation.

This source corrective changes the full contract/manifest digest while keeping the frozen application SHA and legacy runtime contract unchanged. After reviewed merge, prepare the concrete new manifest and obtain explicit digest-bound owner acceptance, then dispatch current-main protected SRM workflow for the frozen application SHA only. Ask the owner to review the waiting GitHub deployment. Do not infer either acceptance from the authorization to fix the contract. No DNS, Render configuration, secrets, Neon migration or runtime deployment is part of source preparation.

## Prerequisites and accepted release

Use a clean reviewed authority main checkout in SG-dev Codespaces SRM (or the existing protected GitHub job after onboarding). Load root AGENTS, current manifest, shared Canon and SRM adapter. Refresh origin/main. The separate lifecycle preflight preserves independent normal gates; ordinary RESERVED tasks still fail. Future Staging has no PMOS/PHR lifecycle and receives no continuity credentials; MEMOROS stays disabled.

The business command must explicitly approve a concrete 40-hex SHA. It must be a main ancestor, pass the latest srm-build for that SHA, and be live on Development at initial authorization. DDL and runtime binding contract must match the executor. Concurrent main business changes are allowed; changes to governance/promotion mechanics require restart from reviewed main. Resume uses the same manifest and actual recorded historical Development deployment proof, even if Development later advances. No automatic newest-main selection.

Acquire least-scope management capabilities: GitHub metadata/checks read, environment management/secrets/variables, release-branch creation/protection and contents CAS write; Render read/create/update/deploy limited to the approved SRM workspace/environment; Neon metadata/database creation and direct migration owner access to the exact SRM Stage branch. The executor checks actual capabilities through acknowledged API operations; no secrets printed. Missing privileges fail closed. Current main is unprotected; if it becomes protected, the existing CAS adapter refuses execution BEFORE provisioning and requires a reviewed legal publication adapter. Never disable protection.

Secure operator variables: TARGET_ENVIRONMENT=staging, SRM_NEON_PROJECT_ID=snowy-breeze-40315151, SRM_NEON_BRANCH_ID=br-broad-butterfly-b11t4v01, SRM_APP_DIRECT_URL (neondb_owner, direct Stage host, /srm_app, TLS), unique SRM_STAGING_ORGANIZATION_ID, six required product secrets, VERCLY_API_BASE_URL and MGBI_AUTH_SCHEME, RENDER_API_KEY, NEON_API_KEY, SRM_RELEASE_GITHUB_TOKEN. Runtime password >=32, demo password >=16, session secret >=32. Database and session credentials must differ from Development. Supplier and demo-password reuse each require their own bounded canonical exception described below. Provider account access/quota for client acceptance must be approved, not guessed. No secret values in manifests/reports/repository or command-line arguments.

## Read-only preparation and explicit approval

Offline DDL plan and legacy promotion simulator:

~~~sh
npm --prefix apps/srm run migrate:staging:plan
npm --silent --prefix apps/srm run promote:staging -- --simulate
~~~

Full first/normal lifecycle simulation and local SQL are the automated staging-lifecycle tests. Fixtures are explicitly synthetic and do not establish live provider behavior. The existing --plan reports missing current resources as deployment-time prerequisites; the lifecycle implements creating them after approval.

Create a real release manifest using read-only provider access and the accepted SHA:

~~~sh
npm --silent --prefix apps/srm run promote:staging -- --manifest --sha "$APPROVED_SHA" > /secure/release-manifest.json
~~~

A schemaVersion 2.0 approval must include: projectKey SRM, targetEnvironment staging, mode onboard/promote/rollback, stagingDeploymentAuthorized=true, stagingMutationsAllowed=true, productionMutationsAllowed=false; manifest, releaseSha and digest(manifest); repository profitia/SG-dev and ID 1247665550; renderWorkspaceId tea-d7lps8rbc2fs73cn80dg, renderProjectId prj-dapbd3hsrm7s73es53fg, renderEnvironmentId evm-dapbdbbbc2fs73f4g7gg; neonProjectId snowy-breeze-40315151, neonBranchId br-broad-butterfly-b11t4v01, neonEndpointId ep-autumn-wildflower-b1mv0vda, databaseName srm_app; unique approvalId, actual approvedBy/costOwner, future expiry <=24h; operations exactly github-environment, github-bindings, release-pointer, database, schema, service, deploy, source-rebind, verify, reconcile.

Budget: renderPlan 0.5c-512mb, renderInstances 1, renderMonthlyComputeUsd 7 maximum, neonMaxCu <=8 matching existing endpoint, neonExistingEndpointOnly=true, providerEntitlementsAccepted=true, storageEgressBuildCostsAccepted=true, maxDeploymentAttempts integer 1–3. First mode additionally needs firstOnboardingAuthorized=true, exact unique positive githubReviewerIds (1–6), and costEvidence {source:PRIMARY_PROVIDER_QUOTE,url:https://render.com/pricing or https://dashboard.render.com/billing,verifiedAt:fresh <=24h,monthlyComputeUsd:actual quote <=approved maximum}. Refresh actual price before authorization; no price API is assumed. Approve these fields through the future business decision, not by copying a synthetic fixture. digest is the exported SHA256 JSON digest helper; changing manifest invalidates approval.

## One command: “Wypchnij na staging”

After the future explicit authorization, execute from the reviewed SRM operator context:

~~~sh
npm --silent --prefix apps/srm run promote:staging -- --apply --sha "$APPROVED_SHA" --authorization /secure/staging-lifecycle-approval-v2.json
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

## Explicit same-release GitHub resume

Do not use a standard new dispatch or rerun all jobs for an unfinished journal: those create a different approval identity. Use the reviewed workflow's `resume_approval_id` and `resume_manifest_digest` with the original `approved_sha`, approved actor and unchanged cost owner. It reads the canonical journal, verifies the previous run is completed via GitHub, and preserves the original approval, manifest, resource and operation scope. `initialize` must remain false. A completed release cannot enter resume.

An expired approval requires an explicit owner dispatch with `resume_authorization_renewal=YES`. This renews only expiry for one hour; it neither creates another approval nor changes any budget, resource, operation or accepted SHA. The exact existing Environment owner review is still required. The prepared journal generation/owner fence is checked again after review and inside the locked executor. Any intervening canonical update stops before lifecycle writes. A takeover is published through the existing PR journal adapter; the renewed expiry and previous expiry are retained in that same journal. Completed and INTENT steps are reconciled from provider evidence, never replayed blindly.

Before dispatch inspect every incomplete publication branch/PR. A parent-only branch has no journal effect and is retained as evidence; a commit or merged PR must be reconciled with canonical content before takeover. Do not delete or force-update it. Ambiguous publication requests fail closed and perform a read-only observation of the branch before reporting whether a matching commit is visible. Only a later explicitly authorized retry may reuse that commit/PR. Failed diagnostics are uploaded even when the job fails. Logs/artifacts contain only allowlisted stage, operation, HTTP status/request ID, safe error category, GraphQL type/path, branch/SHA, generation and approval identity; no provider body, headers or credentials.

Preparation of this mechanism is source work in Development with SRM PMOS/PHR. Dispatch, protected review and real Staging continuation are separate operations, never implied by source merge. Recheck source CI, provider bindings, domain, schema checksums, isolation and authorization immediately before execution.

Historical authorization digests use JSON property order. The journal omits the repeated manifest, so restore its published slot immediately before `manifestDigest`, then verify the unchanged recorded authorization digest. Do not normalize/sort or replace existing hashes. New journals retain the exact original key order as non-secret recovery metadata; scope drift or an unknown historical format rejects resume.

## Post-deployment acceptance and baseline

Automatic proof: exact successful Render SHA/deploy/service/env, main/off and config; protected GitHub environment/binding receipt; exact Neon project/branch/database/direct URL, complete checksum ledger and FORCE RLS catalog; nonprivileged runtime login and own organization; HTTPS health environment staging; wrong-password rejection, secure authenticated session/page; committed idempotent synthetic lookup probe through actual runtime SQL login plus wrong/no-tenant denial. Reconciliation publishes actual identities and proof, not hand-entered expected IDs. Only then ACTIVE/VERIFIED/ONBOARDED is legal; providers are reread after publication.

Deployment-time client acceptance: real isolated supplier account entitlement/quota and approved supplier integration sample; UI/assets/PDF/export smoke; logs/monitoring and agreed cost/availability. Do not call mocked/provider request-schema tests evidence of real first deployment. If a live required fact fails, stop activation and retain evidence/LKG.

## Controlled code rollback

Use a separately explicit mode=rollback approval, recorded LKG SHA, rollbackSchemaCompatible=true and the same bounded resource/operation contract:

~~~sh
npm --silent --prefix apps/srm run promote:staging -- --apply --rollback --sha "$LKG_SHA" --authorization /secure/rollback-lifecycle-approval-v2.json
~~~

Historical successful Development release and latest exact CI/main ancestry must be verified. Current complete ledger/DDL and runtime contract must be compatible; rollback SQL stays read-only. No schema down-migration, branch reset or data deletion is inferred. The same verification/reconciliation publishes actual new code baseline. If compatibility cannot be established, use a forward fix through Development or a separate owner data-safety decision.

## Blocker handling

Wrong immutable ID, Production/PMOS target, unapproved shared credential, unauthorized RESERVED, stale/ambiguous baseline, foreign inflight deploy, moved locked pointer, unverified SHA/CI/Development, drifted contract/schema, missing protection or unsupported publication capability all fail closed. Preserve the canonical journal and existing data; no fallback service/database or security override. Future provider changes must be handled in a new reviewed Development preparation change.

## SRM supplier credential approval recorded 2026-10-09

The user approved reuse of the exact Development MGBI_API_KEY, VERCLY_API_KEY and CEIDG_API_KEY for Stage and accepted Profit.ia as cost owner ($7/month compute plus other service usage). Canon section 11 and staging-contract.json vendorCredentialReuse record the narrow supplier exception until 2026-11-08T00:00:00Z. The same normative check is used by the actual executor and read-only provider plan; no environment switch can enable sharing. These three keys may be copied securely from the exact Development service. Do not copy OPENAI_API_KEY or unused historical keys. Database password, demo password and session secret must still differ; use a new Stage organization UUID and exact Stage host/branch.

At expiry, future shared-key promotions, retries and reconciliation fail closed. Replace only the Stage supplier keys with separately approved keys, or obtain a reviewed bounded policy renewal. Existing runtime is not stopped by this deadline. Check shared supplier quotas, usage/billing and 401/403/429 failures after each release. Vendor account ownership and entitlement must still be checked live; owner approval does not prove a successful external API response.

Neon management-key reuse was explicitly withdrawn. The supplied Stage database URL is for neondb on the Stage pooler host, not a Neon API key. Verify its endpoint identity before using the matching direct host. Use /srm_app only after the separately authorized API creation succeeds, retaining TLS and owner identity. Obtain a separate NEON_API_KEY in the secure operator execution plane; it never enters the application. No keys or database URLs belong in source, reports or command-line arguments. The controller rejects missing management access before it creates any resources.

## Protected main publication

Protected main uses short srm-publication-* PRs, exact candidate governance and any applicable SRM checks, a generation/nonce content fence and the normal merge API. Journal-only PRs do not trigger application CI; release source and reviewed controller CI are separate requirements. Source-only parallel changes remain possible. Conflicting canonical input, extra candidate paths, failed CI or additional required reviews stop further provider writes. Pending CI or lost acknowledgement resumes the same branch and PR. Protection is never disabled and no atomic transaction across providers or PR waiting is claimed.

Publication creation requires an HTTP 201 response with the exact branch ref and parent SHA, followed by an exact-identity GET. Only that acknowledged creation permits bounded observation recovery from transient 404, timeout, 5xx or rate limiting. Authentication/permission errors, wrong identity and malformed retry guidance stop. GitHub's `X-Poll-Interval` applies to the same endpoint and is a minimum delay; `Retry-After` and primary/secondary rate-limit guidance are also respected. See [GitHub REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

The acknowledgement budget defaults to 11 minutes and at most five reads, with injected clock/delay and explicit bounded options for deterministic tests (maximum 30 minutes/five reads). The effective deadline is capped by the existing release authorization expiry. A mandatory delay that cannot fit stops with `STOP_TIME_LIMIT` or `STOP_AUTHORIZATION_WINDOW`, retaining the branch and safe deadline/next-read evidence. It never shortens GitHub's delay, renews approval or repeats creation. Authorization is checked again before creating a branch, commit, PR or merging after CI. Lost commit/PR/merge responses remain observation-required; a later authorized executor reconciles canonical journal and exact existing candidate/PR before any write. Existing parent-only branches are retained; no deletion, reset or force push is allowed. A controller-only corrective does not substitute its SHA for the approved application SHA or change the manifest, migration source or cost scope.

Use an existing GitHub operator credential with actual Contents, Pull requests, check/Actions read, branch/environment administration and secret/variable rights. Codespaces integration credentials can lack administration. Credentials belong only in the protected operator/GitHub environment, never the Render runtime. Verify the exact approved https://srm-staging-runtime.onrender.com URL before runtime login tests.

## GitHub read resilience and ambiguous writes

The shared release GitHub adapter identifies the HTTP method and an allowlisted endpoint name for every response/error. Raw URLs, headers, payloads, variable values and credentials never enter diagnostics. Only recognized read-only REST GETs in the exact SRM authority repository (or executor Codespace status) may recover from HTTP 500/502/503/504, classified connection failures/timeouts and actual rate limits. Ordinary 401/403/404, unknown endpoints and serialization errors stop. The special validated HTTP 201 → 404 publication acknowledgement retains its separate five-read bound; the adapter delegates to that loop rather than multiplying attempts.

Default read recovery permits three attempts, an 11-minute read deadline and 20 additional attempts shared by the executor. Injected options have hard maxima of five attempts, 30 minutes per read and one hour of execution. Effective deadlines never exceed authorization expiry. Backoff grows exponentially with bounded jitter. Valid Retry-After, same-endpoint X-Poll-Interval and primary/secondary rate-limit delays take precedence; their cooldowns survive subsequent requests. A delay outside the remaining window stops with resumable diagnostics, without extending approval. Recovery events and terminal errors retain method, endpoint, request ID, actual decision, attempt/budget and provider-effect certainty; generic fallback is NOT_EVALUATED/UNKNOWN, never a claimed rejection or absence of side effects.

POST/PATCH/PUT/DELETE and GraphQL mutations are never automatically replayed after an ambiguous response. Preserve the exact branch/commit/PR and reconcile independent provider reads in a separately authorized same-release resume. Do not rerun a completed deployment or migration. A 502 alone cannot establish the original method or endpoint: run 38030271387 retained only github-rest and no method/path; the historical identity remains unresolved. The reviewed adapter makes subsequent failures identifiable. See [GitHub REST guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

## Owner-approved demo-password repair procedure

Canonical demoPasswordReuse is independent of vendorCredentialReuse, applies only to SRM_DEMO_PASSWORD on the exact existing Stage service and expires2026-11-08T00:00:00Z. Explicit owner confirmation was received after explaining that the supplied password equals Development. Missing/wrong/expired approval rejects sharing; separate database and session secrets remain mandatory.

Use a fresh exact-source maintenance approval and the real process lock. Snapshot and verify the current baseline before the repair; claim exclusive journal ownership. Publish INTENT/DONE evidence using the existing shared lifecycle functions and protected PR publisher. Update only protected GitHub SRM_DEMO_PASSWORD via official CLI encrypted stdin, then rebuild SRM_RELEASE_BINDING_RECEIPT from actual metadata while asserting all other secret metadata is unchanged. PUT /v1/services/srv-db496b3tqb8s73eh5sfg/env-vars/SRM_DEMO_PASSWORD with the approved value; assert every other binding is unchanged. This API update does not deploy. POST the same service deploy endpoint with commitId equal to the accepted immutable SHA, not latest main. Keep the acknowledged deploy ID in a protected local checkpoint; ambiguous POST outcome requires provider inspection rather than blind retry. Wait for the exact deploy live, verify new-password login/old-password rejection, ledger/RLS/health/persistence and reconcile actual proof. Retain original Stage credentials for bounded rollback; rollback does not reset schema/data. Signed sessions use their existing separate key and remain valid until expiry. Management credentials never enter the application.
