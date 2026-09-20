# PPF-1 Stage 12 Exact Capability Batch Deploy And Cohort Recertification

TASK_ID = ppf-1-stage-12-capability-batch-live-deploy-and-cohort-recertification-20260913
GENERATED_AT = 2026-09-13T17:46:49.000Z
VALIDATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
VALIDATED_SOURCE_SHA = f7761cc3ee56dd474667b89132747910d67c2517
PRODUCT_SOURCE_MUTATION = NO
SG_RUNTIME_EXACT_DEPLOY_GATE = PASS
DASHBOARD_EXACT_DEPLOY_GATE = PASS
BRENT_PRECOMPUTE_BATCH_PROOF_GATE = PASS
BRENT_EXACT_DIRECT_READ_GATE = PASS
BRENT_WARM_RECERTIFICATION_GATE = PASS
PRIMARY_COHORT_RECERTIFICATION_GATE = FAIL
COPPER_EXACT_READINESS_GATE = FAIL
USER_FACING_SMOKE_GATE = PASS
STAGE12_LIVE_RECERTIFICATION_DECISION = FAIL_CLOSED
READY_FOR_LEGACY_DEPRECATION = NO

## Scope

- This artifact covers deployment validation only for the already-published Stage 12 corrective.
- No product source files were modified during this validation pass.
- The target release under validation is exact commit `f7761cc3ee56dd474667b89132747910d67c2517`.

## Exact Deploy Truth

- SG Runtime service `spendguru-stage` was manually deployed on Render from exact source `f7761cc3ee56dd474667b89132747910d67c2517`.
- Provider truth for SG Runtime: deploy id `dep-dajdghp5efls738gsc8g`, status `Deploy succeeded`, source `f7761cc`.
- Dashboard service `dashboards-library` was manually deployed on Render from exact source `f7761cc3ee56dd474667b89132747910d67c2517`.
- Provider truth for dashboard: deploy id `dep-dajdlqh5efls738hf1u0`, status `Deploy succeeded`, source `f7761cc`, service live.

## Brent-Focused Live Proof

- Brent cold `CERTIFY` was executed through the deployed public route `/api/benchmark-forecast/demo-certification`.
- Release snapshot inside certification diagnostics matched the exact deployed release:
  `sourceRevision = f7761cc3ee56dd474667b89132747910d67c2517`
  `deployedRevision = f7761cc3ee56dd474667b89132747910d67c2517`
  `environment = render`
  `environmentUrl = https://dashboards-library.onrender.com`
- Brent cold `CERTIFY` did not finish within the benchmark timeout and returned `demoSafe = NO` with `reason = ENVIRONMENT_NOT_READY`.
- Despite that timeout, the run proved the Stage 12 PRECOMPUTE corrective is live:
  `READ_CAPABILITY` events during `PRECOMPUTE = 12`
  remote series snapshot misses = `1`
  cache reuses / hits = `11`
- Brent exact direct-read capability sweep across all 12 model and target-basis combinations returned fully green:
  `HTTP 200`, `status = AVAILABLE`, `currentReadiness = READY`, `verificationReadiness = READY`, `fullVerificationReadiness = READY`.
- Brent warm `REVALIDATE` passed fully with `demoSafe = YES` and all certification phases `PASS`.

## Primary Cohort Result

- Full primary cohort `REVALIDATE` for Brent, Copper, and Aluminium did not recertify.
- All three benchmarks failed in `PRECOMPUTE` with the same live reason: `SG Runtime interactive forecast request timed out.`
- Direct exact capability reads separated the benchmark health:
  Brent: fully green on all 12 variants.
  Aluminium: fully green on all 12 variants.
  Copper: not fully green.
- Copper exact readiness remained stale on four variants:
  `naive` + `MONTHLY_AVERAGE`
  `naive` + `END_OF_PERIOD`
  `damped_holt` + `MONTHLY_AVERAGE`
  `damped_holt` + `END_OF_PERIOD`
- For each stale Copper variant the public capability route returned:
  `status = STALE`
  `currentReadiness = READY`
  `verificationReadiness = STALE`
  `fullVerificationReadiness = NOT_PREPARED`
  `reason = null`

## User-Facing Smoke

- Public page smoke passed on `https://dashboards-library.onrender.com/pl?variantId=forecast-portfolio-v3&seriesId=wocaes0074&displayName=Brent`.
- The page resolved to `Forecast Portfolio v3` for Brent and rendered out of the loading state.
- The page showed model selectors and target-basis controls as ready, including `Naive`, `Damped Holt`, `ETS`, `ARIMA`, `Srednia miesieczna`, `Dzienna`, and `Koniec okresu`.

## Final Decision

- Exact deploy verification: PASS.
- Brent-only live batch corrective proof: PASS.
- Brent warm recertification: PASS.
- Full primary cohort recertification: FAIL.
- Copper exact readiness parity: FAIL.
- Stage 12 deployment validation therefore fails closed for full live recertification on release `f7761cc3ee56dd474667b89132747910d67c2517`.
- Legacy deprecation remains blocked.
- Any next step should diagnose the live primary cohort PRECOMPUTE timeout behavior and Copper stale verification readiness before another recertification attempt.