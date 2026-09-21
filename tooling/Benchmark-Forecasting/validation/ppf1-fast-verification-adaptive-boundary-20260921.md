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

To be completed after merge and deployment. The live acceptance is deliberately limited to one exact forecast identity. The full model × target-basis × horizon matrix remains a separate task, as requested.
