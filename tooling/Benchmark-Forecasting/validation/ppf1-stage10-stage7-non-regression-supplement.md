# PPF-1 Stage 10 Stage 7 Non-Regression Supplement

GENERATED_AT = 2026-09-11T05:27:47.000Z
STAGE10_SOURCE_SHA = 043505e0bdfa548cfaff64746750091c099c65ba
PREVIOUS_STAGE10_EVIDENCE_SHA = 15d467da16f6da121c9e7d88574ad5ea3f1cbeb9
STAGE9_CORRECTIVE_EVIDENCE_HEAD = 86371da5cfda326da5fc6f12336237f622cbabae
DETACHED_SOURCE_SHA = 043505e0bdfa548cfaff64746750091c099c65ba
REMOTE_STAGE10_SOURCE_MATCH = PASS
WORKTREE_CLEAN = YES
BRANCH_ATTACHED = NO
STAGE7_PROFILER_COMMAND = npm run forecast:profile:stage7-evidence
PROFILE_COUNT = 32
STAGE7_FINAL_EVIDENCE_GATE = PASS
STAGE7_NON_REGRESSION_GATE = PASS
SOURCE_MUTATION = NO
STAGE10_SOURCE_CHANGED = NO
STAGE11_TOUCHED = NO
STAGE10_SOURCE_UNCHANGED = YES
STAGE10_COMPLETION = PASS
READY_FOR_STAGE11 = YES

## Scope

- This supplement is evidence-only.
- The source under test is fixed at `043505e0bdfa548cfaff64746750091c099c65ba`.
- No Stage 10 source files were modified.
- No Stage 11 work was started.
- The existing Stage 10 evidence files remain unchanged.

## Remote Authority

- `origin/ppf1/stage10-calibration-band-eligibility-20260911` resolves exactly to `043505e0bdfa548cfaff64746750091c099c65ba`.
- `origin/ppf1/stage10-calibration-band-eligibility-evidence-20260911` was verified to contain the previous evidence head `15d467da16f6da121c9e7d88574ad5ea3f1cbeb9` before this supplement.

## Detached Profiler Execution

- The profiler ran from a fresh clean detached worktree at `/private/tmp/.tmp-ppf1-stage10-stage7-profiler-20260911`.
- `DETACHED_HEAD = 043505e0bdfa548cfaff64746750091c099c65ba`
- `WORKTREE_CLEAN = YES`
- `BRANCH_ATTACHED = NO`
- Canonical command from source: `npm run forecast:profile:stage7-evidence`
- Executed with temporary output overrides:
  `STAGE7_RESULT_JSON_PATH=/tmp/ppf1-stage10-stage7-profiler.json`
  `STAGE7_RESULT_MD_PATH=/tmp/ppf1-stage10-stage7-profiler.md`

## Dependency Provenance

- Trusted `tsx`: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev-main/.tmp-sg-runtime-point-in-time-stale-20260905/apps/sg-runtime/node_modules/.bin/tsx`
- Trusted `NODE_PATH`: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev-main/.tmp-sg-runtime-point-in-time-stale-20260905/apps/sg-runtime/node_modules`
- Trusted Prisma query engine: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev-main/apps/sg-runtime/generated/market-data-client/libquery_engine-darwin-arm64.dylib.node`
- Trusted forecasting Python: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev-main/.tmp-sg-runtime-point-in-time-stale-20260905/tooling/Benchmark-Forecasting/.venv/bin/python`

## Result

- The standalone Stage 7 profiler produced `32` profiles.
- `STAGE7_FINAL_EVIDENCE_GATE = PASS`
- `STAGE7_NON_REGRESSION_GATE = PASS`
- `RECENT_CONCURRENCY_SINGLE_OWNER_GATE = PASS`
- The profiler conclusions confirm:
  `FAST_READY_EXACT_CURRENT_AND_REQUIRED_EXACT_RECENT_RENDERABLE = YES`
  `GLOBAL_N_FAST_EQUALS_1 = YES`
  `REAL_PROGRESSIVE_ORCHESTRATION_PATH_EXERCISED = YES`
  `FULL_VERIFICATION_EXCLUDED_FROM_FAST_READY = YES`
  `WARM_REUSE_PRESERVED = YES`
  `CROSS_CONTEXT_REUSE_PRESERVED = YES`

## Representative Proof

- Concurrency proof profile: `ppf1-stage6-daily-profile-v1|END_OF_PERIOD|arima`
- Concurrency requests: `5`
- `currentComputeCount = 1`
- `recentVerificationComputeCount = 1`
- `nonRecentVerificationComputeCount = 0`
- Watchlist profiles all remained `PASS`, including daily `ets`, daily `arima`, and quarterly `arima`.

## Final Decision

- This supplement closes the previously declared Stage 10 evidence gap `stage7PerformanceEvidenceRerun = NOT_RUN`.
- Stage 10 source remains unchanged at `043505e0bdfa548cfaff64746750091c099c65ba`.
- `STAGE10_COMPLETION = PASS`
- `READY_FOR_STAGE11 = YES`