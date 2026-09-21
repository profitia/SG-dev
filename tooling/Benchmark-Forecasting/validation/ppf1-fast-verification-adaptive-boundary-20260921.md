# PPF-1 Adaptive Fast Verification Boundary

Task: `PPF1-FAST-VERIFICATION-ADAPTIVE-BOUNDARY-20260921`

## Decision

`FAST_VERIFICATION_BOUNDARY = ACCEPTED`

Fast Historical Verification becomes client-readable only when every canonical horizon (`1M`, `3M`, `6M`, `12M`) contains at least 24 successful lawful comparisons and finite sMAPE and directional-accuracy metrics. This is a presentation boundary, not a terminal queue state: durable preparation continues until the existing full-history contract reaches `FULL_READY`.

## Architectural invariants

- Current Forecast preparation and its first-result path are unchanged.
- `FAST_READY` and `FULL_READY` are separate states.
- The durable job remains queued or running after `FAST_READY`; closing the browser does not cancel it.
- `FULL` prepared reads remain fail-closed for partial artifacts.
- The fast policy version is included in verification job identity so the new policy rotates verification work without invalidating Current Forecast jobs.
- No benchmark-specific forecast logic, second compute engine, manual forecast-artifact SQL, schema migration, or new runtime was introduced.

## Local verification

- SG Runtime targeted regression suite: `133/133 PASS`.
- SG Runtime non-database suite: `468 PASS`, `0 FAIL`, `1 SKIP`.
- Dashboard full suite: `282/282 PASS`.
- SG Runtime typecheck: `PASS`.
- Dashboard typecheck: `PASS`.
- SG Runtime production build: `PASS`.
- Dashboard production build: `PASS`.
- `git diff --check`: `PASS` after removing build-generated files from the source surface.

The durable status endpoint treats both `FAST_READY` and `READY` as a first Dashboard-ready observation. This preserves the existing correlation timeline at the new adaptive presentation boundary; a focused route regression test proves the mapping.

The excluded SG Runtime cross-instance test requires a local PostgreSQL endpoint at `127.0.0.1:55421`, which was unavailable in the isolated worktree. This is an environment constraint, not a source-test failure; deployed persistence is verified in the live canary.

## Publication and live proof

Source publication is complete:

- implementation commit: `c92e20ae805448dcdede2d9a28eed8fb088be184`;
- telemetry corrective commit: `7dcc61873727b2ac1075a8c916196c394f2d0098`;
- source merge commits: `d70f6e0abab8a9b36fd23a9f30097b0b4c765bae` and `b7ae5a69f789146bdf209b078bf224e0778c44bb`;
- PRs: `#35` and `#36`.

All four canonical runtime services are live on source SHA `b7ae5a69f789146bdf209b078bf224e0778c44bb`:

| Service | Render service | Deploy | Result |
| --- | --- | --- | --- |
| `spendguru-stage` | `srv-d98a73btqb8s73fabp90` | `dep-daochr3tqb8s73eq42s0` | `live` |
| `BENCHMARK-FINDER-CATEGORY-BUILDER` | `srv-d9tmgddbedkc739jr24g` | `dep-daochph42hec739ams2g` | `live` |
| `spendguru-forecast-preparation-worker` | `srv-dansibrtqb8s73d0nn3g` | `dep-daochtbtqb8s73eq4ac0` | `live` |
| `dashboards-library` | `srv-da2i7j9t0dsc73ag7qv0` | `dep-daoe0o0ae00c73c58070` | `live` |

The exact live canary was `sgx_acf2027f_cl` / `naive` / `MONTHLY_AVERAGE`, correlation `ppf1-fast-canary-verification-20260921`, job key `a88f79905cf642808686acced6c6049887c0818e18dcf48486a2b7ef2b007aef`.

- action requested: `2026-09-21T06:07:39.882Z`;
- queue accepted: `2026-09-21T06:07:43.273Z`;
- Fast artifact ready: `2026-09-21T06:09:04.791Z`;
- terminal completion: `2026-09-21T06:09:04.896Z`;
- adaptive slices: `1 → 2 → 4 → 8 → 16`, six slices, zero failed slices;
- successful comparisons: `1M=35`, `3M=33`, `6M=30`, `12M=24`;
- prepared verification read: `AVAILABLE`, `FULL_READY`, zero pending and zero failures.

Because this benchmark has a short lawful history, its Fast boundary and Full boundary were reached in the same terminal slice. This live proof establishes the 24-comparison threshold exactly at `12M`; focused regression tests independently prove that a longer job remains active after `FAST_READY` and continues to `FULL_READY`.

After the Dashboard deployment, the public page returned HTTP `200`, the progressive snapshot returned HTTP `200` with Current and Verification `READY`, and the real Forecast Portfolio UI rendered Current Forecast, Historical Verification and the quality panel for the exact canary identity. Render request logs recorded successful Current, Verification and UI telemetry requests. Neon was used read-only to confirm the persisted canary trace and readiness timestamps. No manual forecast-artifact write was performed.

The live acceptance is deliberately limited to one exact forecast identity. The full model × target-basis × horizon matrix remains a separate task, as requested.

## Final decision

`ADAPTIVE_FAST_VERIFICATION = LIVE_PROVEN`

The client receives the first lawful Historical Verification result at the adaptive minimum boundary while the durable queue remains responsible for full-history completion. The fast Current Forecast path has not been regressed.
