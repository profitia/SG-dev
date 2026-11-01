# SG2 Sentry Staging release — 2026-11-01

The owner explicitly authorized the narrow topology reconciliation and protected Staging activation of the existing Sentry implementation from PR #850. Development source is `88c9e0a2074bfafd1199a9caeb50497412a200bd`; its real diagnostic event and sampled trace were independently verified. Production is excluded.

## Provider replacement reconciliation

Read-only Render API confirms `srv-daclno3m8hqs73bb7rrg` (`sg2-staging-runtime`), environment `evm-d98a52eq1p3s73835qi0`, repository `profitia/SG-dev`, main, auto-deploy off. Its current LIVE deployment is `dep-dbi4fv7lot8c73auj9og`, triggered by `deployed_by_render`, finished 2026-10-30T07:33:28.71065Z. Its source remains `48dfcd8af93fa9f5e9708653a868b89c138b6b91`.

Replace only the current runtime baseline deploy ID `dep-db0dhbm1egvs73f70kr0` with that observed identifier. Preserve the previous ID and unchanged SHA in the appended deployment history. Preserve the original frozen split baseline, October reconciliation, service IDs, all other service baselines, Neon branches/databases, domains, environment protection and release workflow. This reconciliation does not deploy an application or accept a different source revision.

This source update is registered SG2 Development governance work under `SG2-SENTRY-STAGING-REGISTRY-20261101`. Staging execution uses its own target preflight and creates no PMOS/PHR continuity records. The source registration does not replace deployment approval.

## Protected application promotion

Status: **NOT_EXECUTED** at preparation. After this source change is accepted, refresh the complete read-only Render/Neon snapshot, require Staging preflight PASS and a measured retained-artifact Last Known Good, save environment-specific Sentry configuration without triggering an unprotected deploy, then dispatch `.github/workflows/sg2-staging-release.yml` on main for role `runtime` and the exact Development-verified source SHA. Preserve its `sg2-staging` environment approval. Verify actual Render LIVE deployment, telemetry environment/release/service, trace and application smoke before recording success.

No other service rollout, schema migration, identity/grant change, new project/resource, extra forecast computation or paid provider acquisition belongs to this release.
