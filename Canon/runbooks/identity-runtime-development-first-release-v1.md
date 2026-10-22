# Identity Runtime — controlled Development first release

Status: preparation for owner review; **no creation or first-deploy approval**. Owner Architecture Platform / ARCHITECTURE. Task `ARCHITECTURE-IDENTITY-B2-DEV-PREP-20261022`. This runbook authorizes no operation by itself.

## Verified source and prerequisite corrective

B2 PR598 merged as `4115d539501bfd73c4467129caacbadd6c94b8a4`, candidate `ed9e64cc19bb52a673160e92f981eb7767a454ac`. B1 remains INSTALLED_ACCEPTED; migration SHA256 `a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3`. M1 remains NOT_APPLICABLE. No prior history is reopened.

On accepted main, an actual local process bound to0.0.0.0 answers200 only for the internal loopback Host; the public Render/custom Host receives400. [Render HTTP checks](https://render.com/docs/health-checks) use a service/custom-domain Host. Therefore **accepted main is NO-GO for State A HTTP health**. The narrow corrective supplies `IDENTITY_RUNTIME_PUBLIC_ORIGIN` from reviewed deployment configuration, validates it with existing exact-origin rules and preserves strict Host rejection. Forwarded headers cannot select authority. An enabled runtime must agree with that origin. Local default and accepted session/authentication contracts remain intact.

Before any first deployment, owner must accept the corrective source and it must be reachable from current main, with exact-source CI PASS. The final execution handoff supplies its PR/SHA. Do not deploy an unreviewed patch or infer acceptance from the earlier B2 merge. If main changes, recheck relevant source/tree/configuration and CI; do not deploy a moving branch head silently.

## Exact proposed State A service

| Setting | Proposed value / gate |
| --- | --- |
| Workspace | PROFITIA WORKSPACE / `tea-d7lps8rbc2fs73cn80dg` |
| Project / environment | ARCHITECTURE `prj-db717krrjlhs739jgo0g` / development `evm-db717krrjlhs739jgo1g` |
| Name / type | `identity-runtime-development`, exactly one independent native Node Web Service |
| Region | `frankfurt`; current Architecture PMOS and private Neon `aws-eu-central-1` independently verified |
| Compute | `free`,0.1CPU/512MB,$0/month compute; no paid compute upgrade |
| Source | connected `https://github.com/profitia/SG-dev`, branch main, exact owner-accepted corrective SHA/first-release receipt required |
| Root directory | empty / repository root, to retain both app and file-linked platform contracts |
| Build | `npm --prefix apps/identity-runtime ci --ignore-scripts --include=dev --no-audit --no-fund && npm --prefix apps/identity-runtime run build` |
| Start | `node apps/identity-runtime/dist/src/main.js` |
| Pre-deploy | absent; no migration/initialization/seed |
| Auto-deploy / previews | off / off, including unrelated commits; no deploy hook creation |
| Processes / scaling | one direct Node process, one steady-state instance, no cluster/PM2/workers/autoscaling/disk |
| Health check | `/healthz`200; `/readyz` and protected APIs503; health does not attest authentication |
| Initial origin | proposed `https://identity-runtime-development.onrender.com`; actual provider-issued URL must match or STOP/review before use |

The [current Node setting](https://render.com/docs/node-version) supports a service-scoped exact `NODE_VERSION`; pin24.15.0, which was exercised locally, within the accepted >=24.15.0<25 range. Do not inherit the root monorepo's unrelated engine/default or silently upgrade SDK/frameworks. [Monorepo root](https://render.com/docs/monorepo-support) must expose the shared file dependency; root app-only is invalid. Public lockfile installation needs no NPM/PMOS/product secret. Preserve approved dependency versions and lockfiles.

Current MCP creation cannot set project/environment/healthCheckPath. Do not create in a default environment then repair placement. After explicit GO use the verified Dashboard creation route `https://dashboard.render.com/project/prj-db717krrjlhs739jgo0g/environment/evm-db717krrjlhs739jgo1g/web/new` or an independently verified complete API payload. The existing `architecture-development-pmos` service must never be edited/reused.

## Typed configuration and secret boundary

| Input | State A | Validation / future State B |
| --- | --- | --- |
| `NODE_VERSION` | `24.15.0` | exact reviewed runtime |
| `HOST` / `PORT` | `0.0.0.0` / Render `PORT`10000 | actual bound port; numeric1–65535, no reserved port |
| `TARGET_ENVIRONMENT` | `development` | deployment label; enabled authority comes from validated runtime/binding, never arbitrary headers |
| `IDENTITY_RUNTIME_ENABLED` | literal `false` | real identity activation needs separate explicit owner approval |
| `IDENTITY_RUNTIME_PUBLIC_ORIGIN` | exact approved public origin | `readDeploymentOrigin` rejects wildcard, nonorigin URL, credentials, encoding and nonlocal HTTP; must equal enabled configuration origin |
| `IDENTITY_RUNTIME_CONFIGURATION` | absent | closed typed Development appId, issuer/public-key host, exact own origin and closed target application/origin/static route-key registry; no caller URL override |
| `CLERK_SECRET_KEY` | absent | only separately authorized service-scoped Development key, owner-controlled delivery; never another product/PMOS credential |
| `IDENTITY_DATABASE_URL` | absent | dedicated ordinary `identity_b1_runtime`, exact private DB/role, validated TLS; no Stage2 revoked password |
| `IDENTITY_ACCESS_BINDING` | absent | current existing project/branch/database/role/app/environment/schema receipt, verified by accepted Access Store |
| Attestation / profile policy | absent | no such new runtime input is consumed by B2 main; only later accepted B1 profile/provisioning operations may require separately approved material/policy |

State A never initializes the SDK or DB pool. Health-only child-process tests block outbound fetch/socket connects and detect any attempted egress. Public health is minimal; protected endpoints never expose keys, sessions, actor details or DB metadata. Generic startup errors omit malformed private input. SDK telemetry is disabled by the accepted initializer; do not add request-body, password, OTP, cookie or authorization logging. No login/registration/recovery UI, LLM dependency, productive onboarding or account writes exist in this release.

For eventual secrets prefer owner-entered masked service-only environment values or a private service Secret File through a verified private path; no shared environment group with PMOS/SG2/SRM, no public CI, no command/PR/chat/PMOS/PHR values. Existing Clerk keys cannot be recovered from the full-value-hidden Dashboard; a future dedicated key creation/delivery requires separate approval. Never inspect another service's secrets to fill a gap.

## Provider baseline and origin choice

Live read-only checks on22October verified41 Render services, only Architecture PMOS in this environment, no Identity Runtime. Isolation is enabled. Existing GitHub `architecture-development` id24168168252 has custom branch policy main only; do not create another Environment or change protections. The new source CI is public/synthetic and receives no protected secret. Native Git-backed Render creation uses existing repo authorization; GitHub Environment main-only rules alone do not gate a manual Dashboard deployment, so retain explicit operator approval and exact-SHA checks.

Clerk remains Development app `app_3KoJk9FmKeTC4hhlQwTgX6PMZmD`, instance `ins_3KoJk8us60Ywqei67JBwUx6R5pi`, issuer `https://unified-drum-7191.clerk.accounts.dev`, matching Development public-key host. Email signup/verification/codes and password enabled; password minimum15, compromised rejection, Device Trust. Session max7days, inactivity off, multi-session off, reverification10minutes. Zero satellites; fallback development host blank, Account Portal selected for sign-in/signup/signout. This establishes configuration, not live session or receiver acceptance. No provider change is required for State A.

| Origin option | Evaluation |
| --- | --- |
| Provider-issued onrender.com | Recommend for initial health-only proof: managed public TLS, no DNS/custom-domain change, exact server Host, no cookies/session transport required. Actual hostname still awaits creation. Future Clerk browser/receiver adoption remains separately verified. |
| `auth-dev.spendguru.app` | Proposed only: owner DNS authority, service binding/TLS and exact Clerk primary/satellite/receiver configuration must be reviewed. Adding a verified custom domain can alter health-check Host selection; do not accept default/custom aliases indiscriminately or relax Host. |

Neither option automatically synchronizes sessions with SG2 `https://dev-sg2.spendguru.app` or its underlying Render host, nor SRM `https://srm-development-runtime.onrender.com`. Later consumer owners choose and prove one exact browser origin/receiver and closed return routes per product. Changing runtime origin invalidates pending navigation; requires reviewed config/SDK redirects/cookies/CSP, not a redirect alias. State A sets no auth cookie and serves no page/scripts, so it supplies no browser SSO/CSP proof. Development receipts cannot be promoted to Staging/Production.

## Cost and single-process limits

Current UI offers Free0.1CPU/512MB for$0/month and0.5c-512mb for$7/month. Pro workspace currently selects **Performance pipeline,$25/1000minutes**, with an existing workspace$500 monthly pipeline limit. Starter included minutes do not offset Performance. Do not change that global setting. Propose one initial build, max20minutes, with at most one additional$25 pipeline pack; abort on budget/plan mismatch, do not buy another pack or upgrade resources. This is a conservative approval ceiling, not a claim that build cost is zero or the full pack will necessarily be purchased.

At inspection, shared Free hours used499.45/750 and included bandwidth16.32/25GB. Recheck before execution. Limit acceptance responses to1MiB, no keepalive/monitoring job, no repeated failed builds. [Free service limits](https://render.com/docs/free) include idle spin-down, arbitrary restart and one instance; shared quotas can suspend services. They are acceptable only for this disabled foundation, not live identity reliability. Compute stays$0; existing workspace subscription and unrelated services are not modified.

One Node process and one steady-state instance do not prove one process throughout redeploy. [Render rollout/restart](https://render.com/docs/deploys) can overlap old/new instances. State A has no flow/session state, so overlap grants no identity authority. State B remains NO-GO until actual lifecycle is accepted or a separately reviewed drain/stop-to-start/shared atomic-store design resolves that constraint. Do not add a disk merely to influence deployment behavior.

Restart/crash loses pending navigation and local deny memory; unknown state denies, not replays or grants. Confirmed Clerk revocation remains authoritative on fresh receiver checks. A failed provider revocation returns503; its local denial is not durable across restart. Do not represent that failure as successful global logout. Bounded in-memory state is not multi-instance SSO.

## First-release recovery and actual acceptance after GO

There is **NO_PRIOR_IDENTITY_RUNTIME / NO_LKG_ARTIFACT**. Current service/deploy/build IDs and deployed digest are NOT_CREATED. Local compiled/source hashes are not a retained Render artifact. Product migrations are unchanged and no data writes are planned; a new backup/Neon branch is neither necessary for State A nor authorized. Preserve current B1 receipts/disabled state and existing service inventory.

Before creation, verify source approval/ancestry/exact SHA, complete service settings and budget, ordinary owner ability to cancel/suspend, and unoccupied name/placement. The current [creation flow](https://render.com/docs/web-services) **starts its first build/deploy**: creation-only permission is insufficient. Reject an unexpected branch head, hostname, plan, missing setting or drift before clicking Deploy web service. Do not use subset MCP creation that cannot establish the placement at creation time.

After explicit GO, capture new service/deploy/build identifiers, actual source, Node/build output and nonsecret configuration receipt. Capture provider-retained artifact information and actual compiled build fingerprint distinctly; Git-backed API does not expose an image digest like image-backed deployments. Do not invent an OCI digest or treat a source SHA as artifact identity. Any later redeploy requires a retained, verified artifact/configuration receipt and executable rollback, or a renewed first-release stop-only boundary.

Stop sequence for the **new service only**: cancel its in-progress/queued deploy, keep auto-deploy off, suspend the service, verify provider suspended state plus public unavailability, and independently confirm B1/Clerk/products unchanged. [Cancel deploy](https://api-docs.render.com/reference/cancel-deploy) and [suspend service](https://api-docs.render.com/reference/suspend-service-1) are supported operations; current MCP lacks them, so Dashboard/verified API capability must be present before GO execution. No delete/recreate loop, data down-migration or shutdown of PMOS/SG2/SRM. If the source/configuration or recovery check fails, preserve evidence and stop; no automatic recovery attempt with broader rights.

Actual State A acceptance: right project/environment/name/source; reproducible build and exact Node; one direct process/steady-state instance; TLS/Host; health200, ready/session503 and mutation paths unavailable; no registration/login/credential/log leak/provider/DB call; no extra scaling, data or existing-service change. Test one controlled restart and the stop procedure within the approved budget. Final running-state acceptance and any resume must remain within explicit GO. Mark actual Render ingress/stop/restart as PENDING until executed. [Rollback](https://render.com/docs/rollbacks) requires a retained prior artifact and compatible configuration; the first release has none.

## Consolidated owner decision and future State B

The approval packet must name exact corrective PR/source SHA, first-release source binding and the17 task§10 items above. **Current GO recommendation: NO-GO until source acceptance and explicit creation+first-deploy approval.** One approval may explicitly cover accepting/merging that exact corrective, then one Free service/first build and the bounded State A checks/stop procedure with the pipeline ceiling. It grants no secret/domain/Clerk/Neon/product activation. Recheck current main and all gates after the decision; if source or scope differs, STOP/review.

State B is a separate, executable acceptance task: owner-approved origin/domain/provider SDK setup and private secret delivery; fresh verified recovery before any Neon write; current B1 digest/ordinary credential and approved app/binding activation; attestation/profile policy only for explicitly accepted operations. Use a real synthetic Clerk test account, email/device challenges, active/revoked/switched sessions and current internal binding; bound test duration/cleanup, re-disable according to owner-approved final state. Test exact SG2/SRM receiver verification, navigation restart, logout and provider revocation independently. No real onboarding or grant creation is implied.

Preserve pending decisions: binding renewal strategy (valid Clerk cannot revive expired/revoked Profitia authority), productive PII retention/export/deletion, permanent credential operations, exact domains, rollout/multi-instance state, consumer adoption and product cutover. Future conversational C/D follows MagicPath reference only in its own task; no arbitrary OTP acceptance or password/OTP history. Next stage after source/creation approval and safe State A: **B2 Development Live Clerk & Browser Session Acceptance**.
