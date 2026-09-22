# SG2 Environment Operations Runbook v1

Status: ACTIVE RUNBOOK

Owner: SG2 Platform

Authority: `Canon/v1.0-profitia-environment-and-release-promotion-canon.md`

Registry: `Canon/registries/sg2-environment-topology-v1.json`

## 1. Select the target

Every task declares one `TARGET_ENVIRONMENT`: `development`, `staging`, or `production`. Run governance preflight with `--target-environment <value>`. Resolve every provider resource from the registry; never route by a similar-looking name.

The GitHub deployment environments are namespaced: `sg2-development`, `sg2-staging`, and `sg2-production`. The older generic `Development`, `Staging`, and `Production` entries are legacy and must not be selected by SG2 workflows.

## 2. Development

1. Work on a short task branch from current `origin/main`.
2. Deploy only to the registered Development services.
3. Confirm the runtime, dashboard, current worker, and verification worker use the Development Neon branch.
4. Confirm service-to-service credentials are Development-only.
5. Run a canary job and prove its correlation/job identity exists in Development and not Staging.
6. For browser-ready embedded analytics, bind the runtime and Dashboard to approved `*.spendguru.app` Development domains so the authenticated session remains available to both surfaces. Do not disable authentication to compensate for host-only cookies on unrelated `onrender.com` hosts.

Development custom domains registered in Render:

- `dev-sg2.spendguru.app` — CNAME host `dev-sg2` to `sg2-development-runtime.onrender.com`;
- `analytics-dev-sg2.spendguru.app` — CNAME host `analytics-dev-sg2` to `sg2-development-dashboard.onrender.com`.

Until both DNS records are published, verified, and covered by Render TLS, backend and queue isolation are operational but the authenticated embedded Dashboard flow is not browser-ready on the Development custom domain.

## 3. Staging

1. Record the current Last Known Good SHA, deploy IDs, Neon branch, domains, and smoke-test result.
2. Keep auto-deploy disabled.
3. Deploy an explicit SHA already verified in Development.
4. Verify both client domains, runtime logs, worker behavior, and persistence.
5. If validation fails, restore the recorded Last Known Good deploy. Do not reset or overwrite the database as part of an application rollback.

The registered Render Staging environment has a historical provider label `Production`. This is an intentional recorded mismatch. Its immutable project and environment IDs, not the label, identify SG2 Staging.

## 4. Production

1. Promote exactly the artifact digest accepted in Staging when digest promotion is available; until then, promote no less than the exact accepted source SHA and record that independent rebuild parity remains a known limitation.
2. Do not rebuild from a moving branch.
3. Apply compatible migrations through their separately approved migration plan.
4. Verify production domains and the real user flow.
5. Record the released SHA and rollback point.

## 5. Database branches

- Development: `br-dry-hall-b294222f`
- Staging: `br-wandering-dew-b2izo8fg`
- Production: `br-purple-shape-b2az1npx`

Connection strings remain secrets and must not be committed. Long-lived environment branches must not have an expiry. A branch clone preserves a point-in-time starting dataset; subsequent writes remain isolated.

## 6. Queue and worker isolation

PPF-1 queues are database-backed. Runtime and both workers in one environment must use the same registered environment database branch. No worker may use a queue database belonging to another environment. A Development-to-Staging isolation test is mandatory after provisioning or connection changes.

## 7. Required closeout evidence

- GitHub source SHA, PR, merge, and environment identity;
- Render service IDs, deploy IDs, expected domain bindings, and health;
- Neon project and branch IDs plus non-secret schema/data checks;
- cross-environment canary proof;
- client-demo smoke test for Staging;
- PMOS, MEMOROS, and PHR completion evidence.
