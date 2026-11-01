# SG2 Sentry Staging release — 2026-11-01

The owner explicitly authorized the narrow topology reconciliation and protected Staging activation of the existing Sentry implementation from PR #850. Development source is `88c9e0a2074bfafd1199a9caeb50497412a200bd`; its real diagnostic event and sampled trace were independently verified. Production is excluded.

## Provider replacement reconciliation

Read-only Render API confirms `srv-daclno3m8hqs73bb7rrg` (`sg2-staging-runtime`), environment `evm-d98a52eq1p3s73835qi0`, repository `profitia/SG-dev`, main, auto-deploy off. Its current LIVE deployment is `dep-dbi4fv7lot8c73auj9og`, triggered by `deployed_by_render`, finished 2026-10-30T07:33:28.71065Z. Its source remains `48dfcd8af93fa9f5e9708653a868b89c138b6b91`.

Replace only the current runtime baseline deploy ID `dep-db0dhbm1egvs73f70kr0` with that observed identifier. Preserve the previous ID and unchanged SHA in the appended deployment history. Preserve the original frozen split baseline, October reconciliation, service IDs, all other service baselines, Neon branches/databases, domains, environment protection and release workflow. This reconciliation does not deploy an application or accept a different source revision.

This source update is registered SG2 Development governance work under `SG2-SENTRY-STAGING-REGISTRY-20261101`. Staging execution uses its own target preflight and creates no PMOS/PHR continuity records. The source registration does not replace deployment approval.

## Protected application promotion

The initial registry reconciliation was accepted in PR #856, merge `bdc21b618e896575ec9ba6ea2fe0282bce9aa211`. All PR checks and resulting-main governance/frontend checks passed. The protected workflow [41349554926](https://github.com/profitia/SG-dev/actions/runs/41349554926) ran on that controller SHA for the exact Development-verified application source `88c9e0a2074bfafd1199a9caeb50497412a200bd`, role `runtime`. The required `sg2-staging` environment reviewer `profitia` approved the deployment under the owner's explicit Full Autopilot release instruction. Environment protection, main-only policy and auto-deploy-off were preserved.

Render deployment `dep-dbjqi2e7bikc73898lg0`, trigger `deploy_hook`, finished LIVE at 2026-11-01T21:06:38.162709Z on that exact application source. `GET /api/health` returned 200, `status=ok`, `environment=staging`; the browser login page rendered as `STAGE SpendGuru2.0`. This is application availability proof, not Sentry acceptance. Advance only the runtime baseline to this authorized observed deployment and preserve the prior baseline in history.

Nine Sentry/build environment keys were saved with **Save only** before the protected promotion, preserving all existing keys. They scope telemetry to `profitia/sg-porr`, project `4512356940120144`, `APP_ENV=staging`, technical data only, trace sampling 0.1, and one non-production diagnostic UUID. No secret values are recorded here. `NPM_CONFIG_INSTALL_LINKS=true` matches the existing Development build behavior for local file dependencies. No management token or production approval was added.

## Verified telemetry configuration blocker and bounded continuation

Sentry acceptance is **NOT VERIFIED**. Read-only inspection in the actual LIVE instance confirmed correct service ID, source SHA, APP_ENV, project, DSN project match and activation settings. However, Render still injects historical `RENDER_SERVICE_NAME=spendguru-porr-demo`; the browser build also contains that historical value. PR #850 deliberately accepts only `sg2-${environment}-runtime`, so the SDK remains disabled. A bounded sampled health request and diagnostic query returned no matching Staging event/trace. No private business payload was sent.

The Dashboard form accepts the documented `RENDER_SERVICE_NAME` key with the already registered canonical value `sg2-staging-runtime`. Its effective precedence is not assumed. After this source record is accepted, require a fresh complete Staging preflight, save only this one per-service configuration binding, and use the same protected exact-SHA workflow. Verify both actual runtime and compiled browser values before claiming enablement. Preserve the immutable service ID, source code, all existing SDK guards, app commands and all unrelated configuration. If the provider does not apply the explicit value, report that concrete blocker without weakening the SDK guard or changing resource identities.

## Recovery and boundaries

Before the first promotion, retained deployment `dep-dbi4fv7lot8c73auj9og` at source `48dfcd8af93fa9f5e9708653a868b89c138b6b91` was measured in its live shell. Sorted `.next` file/content SHA256 excluding cache (`sha256-next-files-without-cache-v1`) was `51c7ff0c31f45d47b0d7da54bb4774f1815dc0bfdaa3b6c53d2a858e89fa01bc`, 279 files, build ID `yHgzo-aUJXPa2ySAXsQKy`. The selected application-environment-prefix configuration fingerprint was `c31d929bc32916c81002978281d22b9090fd04eaa21fda65d691f02b7bd0d143` (20 keys; not a claim of a full environment digest). Native Render retained-artifact rollback restores the original built artifact and deployment environment without a rebuild or database reset, subject to provider retention.

The Staging migration ledger contains 20 completed, non-rolled-back migrations, digest `7ef9287a5389796a1194aa9e1bc665bf843829a69128b199f1dd4da5a9f4b72b`. No migration or reset was performed. All other Staging service deployment IDs/SHAs, all service IDs, database/Neon bindings, domains, private network settings, Development and Production remain unchanged. Parallel BQL, SRM and Packages & Limits Management work is preserved; no changes from a moving main are deployed to the application. The application source and governance-controller source are recorded separately.

No other service rollout, schema migration, identity/grant change, new project/resource, extra forecast computation or paid provider acquisition belongs to this release.
