# SG2 Environment Operations Runbook v1

Status: ACTIVE RUNBOOK

Owner: SG2 Platform

Authority: `Canon/v1.0-profitia-environment-and-release-promotion-canon.md`

Registry: `Canon/registries/sg2-environment-topology-v1.json`

## 1. Select the target

Every task declares one `TARGET_ENVIRONMENT`: `development`, `staging`, or `production`. Run governance preflight with `--target-environment <value>`. Resolve every provider resource from the registry; never route by a similar-looking name.

Only an `ACTIVE` environment may pass `TARGET_ENVIRONMENT_GATE`. A `RESERVED` Production identity is an inventory reservation, not deployment authority. SG2 PMOS registration and closeout apply only to Development; a Staging or Production task must not call `pmos:begin` or `pmos:save`.

Before Staging or Production work, capture a complete read-only Render service inventory for the target Render environment and a Neon branch inventory directly from their provider APIs. Supply the fresh JSON capture with `--provider-snapshot <file>` to governance preflight. The capture has `capturedAt` (UTC ISO time, at most 15 minutes old), `source: {"render":"render-api","neon":"neon-api"}`, `renderServices` entries with `id`, `environmentId`, `repo`, `autoDeploy` (boolean), `liveStatus`, `liveDeployId`, and `liveSha`, plus `neonBranches` entries with `id`, `projectId`, and `name`. Include all SG-dev services in the target Render environment, including services absent from the registry. A missing or drifted snapshot blocks preflight. A Development audit may provide the same capture to surface its drift. Do not convert a detected mismatch into a registry change without a release decision and provider verification.

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
3. Use only `.github/workflows/sg2-staging-release.yml` with `environment: sg2-staging` and an exact `main` SHA after the GitHub Environment reviewer and branch policy have passed. The workflow must check the registered five-service allowlist and must not use a repository-wide or Development deployment credential. If the Staging-scoped credential is absent, stop before any deploy.
4. Confirm the approved service list, exact SHA, provider deploy IDs and live revision for each targeted service. Verify both client domains, runtime logs, worker behavior, and persistence. A source SHA shared by independently built services is not proof of identical artifacts.
5. If validation fails, stop propagation and restore the recorded Last Known Good deploy through the same verified target IDs. Do not reset or overwrite the database as part of an application rollback.

Direct Render-console/API deployment is an operator break-glass route, not protected by the GitHub Environment. It requires an explicit recorded exception, the same exact-SHA and service-ID checks, and post-deploy reconciliation. The existence of this bypass is an access-control limitation, not evidence that the workflow protection is ineffective for normal releases. No Staging deploy is required merely to install the release gate.

The registered Render Staging environment has a historical provider label `Production`. This is an intentional recorded mismatch. Its immutable project and environment IDs, not the label, identify SG2 Staging.

The Staging registry records the exact expected live deploy for each service. Its `frozenBaseline` preserves the original environment-split snapshot for rollback evidence; it does not assert that later explicitly deployed services still share that SHA. A later runtime deploy must be reconciled from provider evidence without restarting or redeploying the client stack merely to make the registry uniform. The separately deployed `spendguru-stage` service is also in the registered Render Staging environment and remains the historical main SG Runtime and Blueprint environment-variable source; it is not an additional client-domain destination. Any future change to its role or deployment requires its own verified release decision.

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
- PMOS, MEMOROS, and PHR completion evidence for Development tasks only.
