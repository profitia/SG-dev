# SG2 environment reconciliation — 2026-10-25

Task: `SG2-ENV-RECONCILIATION-20261025`
Profile: SG2; workspace SG-dev; execution local. Canonical authority: profitia/SG-dev main.
Development governance/PMOS only; live Staging changes require their own target preflight and do not create Staging PMOS records.

## Approved scope and boundaries

The user authorized real production market data for all environments, simple reversible private-network isolation, and reconciliation of names and infrastructure registry, in Full Autopilot. No forecast mathematics, Macrobond API routes, queries, credentials or behavior may be changed. No visual rollout or application promotion belongs to this task. Later: MagicPath on Development, functional/forecast validation, then an explicit Staging release.

## Provider observations before changes

Render API inventory and deploy records were read at 2026-10-25T18:40:17.753Z. All nine SG2 services are live, main-bound and auto-deploy off. These observations are not proof that every user flow is healthy.

| Environment / role | Previous deploy | Observed live deploy | Observed SHA | Trigger |
|---|---|---|---|---|
| development / dashboard | dep-daqbksk9v7es73cjdtmg | dep-dbbr34rncjis738t5phg | 873d4655bed828b401f3b480b08cc40d46c6c8ff | rollback |
| development / runtime | dep-daqbu6e7bikc73fvge2g | dep-dbds2ajncjis73daf1k0 | a6ffcefb96d1b4182764343b349dcb092d0f891b | api |
| development / currentWorker | dep-dapu7es9v7es739uoql0 | dep-dbblross728c738srl0g | 05a7d705e1aeeae04465e59b371ea0cd5a0d4c06 | api |
| development / verificationWorker | dep-dapu7g1srm7s73as83bg | dep-dbbkc261egvs738asnc0 | 05a7d705e1aeeae04465e59b371ea0cd5a0d4c06 | api |
| staging / dashboard | dep-dapam17f3r2c73c11th0 | dep-dapam17f3r2c73c11th0 | 518f1ad9d6143748d9d5f42a084cae6135b66799 | api |
| staging / runtime | dep-dapctolbedkc738dv8vg | dep-db0dhbm1egvs73f70kr0 | 48dfcd8af93fa9f5e9708653a868b89c138b6b91 | deployed_by_render |
| staging / mainRuntime | dep-dap3876gekts73fkkaug | dep-daumen97lnhs73em7a10 | bd4139e727fd3f3b237cfa89afa60b7af6bec86c | deployed_by_render |
| staging / currentWorker | dep-dapam0sja7ms73akipp0 | dep-dbaqk9p42hec73cbo3og | 518f1ad9d6143748d9d5f42a084cae6135b66799 | deployed_by_render |
| staging / verificationWorker | dep-dapam0hsrm7s73ep2v50 | dep-dbdq25u8bjmc73d3rotg | 518f1ad9d6143748d9d5f42a084cae6135b66799 | deployed_by_render |

All four differing Staging deploy IDs retain their registered SHA and were triggered by `deployed_by_render`. No new Staging source revision is accepted by this reconciliation. The original frozen split baseline remains preserved. Development has advanced independently and its observed revisions are recorded without claiming parity.

## Market data and persistence

Both deployed runtime revisions resolve Macrobond to `https://api.macrobondfinancial.com` and its production OAuth endpoint. Both runtime configurations contain Macrobond credentials and no URL overrides. Credential values were neither published nor changed. The permitted common source is real provider data, not a shared writable database.

Neon API confirms project `autumn-waterfall-65938876`, database `neondb`:
- Development: `br-dry-hall-b294222f`, endpoint `ep-muddy-pine-b22pdyqd`.
- Staging: `br-wandering-dew-b2izo8fg`, endpoint `ep-cool-lab-b2wm8biu`.
- Named production source branch: `br-purple-shape-b2az1npx`, endpoint `ep-cool-paper-b22wpbd9`.
- Development private store: project `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`, database `platform_private`, endpoint `ep-late-heart-b9mxo8oi`.

The historical service `spendguru-stage` already references the production-named market branch and a different historical runtime database. It is retained and is not silently treated as the core Finder. Core Development and Staging continue to use their separate local stores. A live shared Neon branch with isolated writers is not claimed or implemented.

Source inspection confirms that market persistence also holds forecast queues, execution ledgers and output artifacts. Development native bindings validate exact hosts/roles/branch identities. Replacing whole connection URLs would break these boundaries or mix writable workloads. This task preserves those bindings and the existing provider ingestion path.

## Network change intent and rollback

Observed: private cross-environment blocking is OFF in both live SG2 environments; no shared environment groups. Required peer routes in the audited configuration use public HTTPS. Neon hosts are external TLS endpoints. No configured dependency requires Render private traffic across either boundary.

Exact changes planned:
- Enable Block cross-environment connections for `evm-dap98hm0tbcc738rro10`.
- Enable the same for `evm-d98a52eq1p3s73835qi0`.
- Rename `srv-daclno3m8hqs73bb7rrg` to `sg2-staging-runtime`.
- Rename `srv-dacln50jo6nc738lbag0` to `sg2-staging-dashboard`.

Keep immutable service/environment IDs, domains, default URL slugs, deployment IDs, SHAs, credentials, database schemas and data. Restore previous false toggle values or previous service display names to undo the specific configuration change. No migration, service restart, new resource or application deploy is planned, so no rebuilt artifact is substituted for the retained current deployment. Before each live change recheck target gates and the provider state.

Render documents that the toggle does not deploy or interrupt services and does not terminate already active connections. It affects new private connections across the boundary, not public endpoints or in-environment connections: https://render.com/docs/projects#blocking-cross-environment-traffic . A saved toggle alone is not a tested denial of every possible public or private route.

## Pre-change availability

Verified HTTPS with system-trust curl: both runtime health endpoints 200; Development Finder 200; unauthenticated Staging Finder redirects to its login and returns 200; Staging dashboard redirects to login and returns 200. Development dashboard root returns 503 before any mutation. Preserve this as an existing limitation; do not report it as a regression caused by this task or claim full forecast acceptance.

## Execution status

Baseline reconciliation was merged through PR #713, commit `a6fe5e3d0d22368415cde164e7146366b18dc4a4`, after both CI checks passed. Full preflight passed before the Development action, each Staging action and the final source update. PMOS registration remains the original SG2 Development governance task; no Staging registration was made.

Applied and independently verified:
- Development private cross-environment blocking: OFF → ON.
- Staging private cross-environment blocking: OFF → ON.
- `spendguru-porr-demo` → `sg2-staging-runtime`, immutable ID `srv-daclno3m8hqs73bb7rrg`.
- `spendguru-porr-dashboard` → `sg2-staging-dashboard`, immutable ID `srv-dacln50jo6nc738lbag0`.

At 2026-10-25T18:51:53.012Z both switches remained ON after reloading their project pages. A separate Render API inventory/deploy read at 18:50:50.320Z confirmed that, across all nine services, the only changed fields in the captured service/deploy identity set were the two intended names. All nine live deploy IDs, SHAs, environment IDs and auto-deploy settings remained unchanged. Default URLs retained their existing slugs. The private-network switch is verified through the Render UI; it is not a field returned by that service inventory API.

The provider's historical project label `sg2.0-dashboard-preview` and environment label `Production` are retained and explicitly mapped to logical Staging by immutable IDs. Empty Staging/Production shells in the Development project and forecast-worker names were not renamed or repurposed.

Post-change HTTPS checks at 18:51:29Z, with certificate validation enabled:

| Check | Before | After |
|---|---|---|
| Development runtime health | 200 | 200 |
| Staging runtime health | 200 | 200 |
| Development Finder | 200 | 200 |
| Staging Finder, unauthenticated | login redirect → 200 | login redirect → 200 |
| Staging dashboard, unauthenticated | login redirect → 200 | login redirect → 200 |
| Development dashboard root | 503 | 503 |

The Development 503 (`Dashboard access is not configured.`) predates this task. It remains a separately scoped issue before full visual/forecast acceptance. No application code, forecast equations, provider API queries/routes, secrets, database bindings, schemas, data or oil-search restrictions changed. There was no application deployment, service restart, new infrastructure charge or Staging promotion. A deployment-artifact/digest measurement or database snapshot was therefore not a prerequisite for these configuration-only operations; the exact retained deployments and reversible setting values are documented above.

Validation limits: availability checks and persisted isolation settings passed; no active cross-boundary socket canary, authenticated forecast calculation or new Macrobond request was executed. Existing connections are not forcibly terminated by the Render switch. Real production Macrobond source policy is recorded and its existing endpoint configuration preserved; a shared live Neon market branch is neither configured nor claimed. Future Production is policy-covered but remains reserved, without an application runtime.

Local proof screenshots: `development-isolation.png` and `staging-isolation-and-names.png` in `/tmp/sg2-environment-reconciliation-20261025/`. The registry and this text are durable evidence; the local images are supplementary session artifacts.
