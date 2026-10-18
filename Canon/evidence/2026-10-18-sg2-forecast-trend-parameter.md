# SG2 E1 — shared forecast parameter compatibility

Date: 2026-10-18. Task: `SG2-E1-FORECAST-TREND-PARAMETER-20261018`. Profile SG2, TARGET_ENVIRONMENT=development, isolated local execution. Authority `profitia/SG-dev/main`.

## Confirmed cause and change

Read-only aggregate observation of the market Development source found 38,789 generic Verification records, 39,508 Rolling Verification records and 411 Current points containing numeric parameter `x1`. All observed Verification occurrences had numeric values and `trend=t`; removing only that key made every one of the 396,705 existing Verification parameter objects satisfy the previous reviewed parameter predicate. No source rows or parameter values were exported in this audit.

The original univariate ARIMA producer in `tooling/Benchmark-Forecasting/forecasting/models/arima.py` publishes its fitted named numeric parameters through `extract_named_parameter_map`. Its trend candidates include `t`. The publication boundary omitted the stored named trend coefficient `x1`, despite already supporting other finite coefficients. This could withhold legitimate stored forecasts in native mode. This is a source-candidate compatibility defect, not evidence of a regression in the unchanged deployed legacy applications.

The existing shared TypeScript validator and the corresponding SQL predicate now admit the exact literal key `x1` only as a finite numeric parameter, under their existing bounds. No arbitrary key family, string parameter or private identifier is admitted. No parameters are stripped, renamed or synthesized. The same shared rule serves Current and the upcoming Verification source; no second parameter validator or estimator is introduced. Fitting, forecast values, fingerprints, cadence, band identity, scientific policy and statistical arithmetic remain unchanged.

The still-uninstalled forecast candidate digest is updated consistently in its server descriptor. Installed market source 001, cloud schemas, roles, credentials, flags and deployed applications remain unchanged.

## Verification and acceptance boundary

Typed parameter tests and actual restricted generated-ORM Current tests were extended with numeric `x1`. Before the fix, they refused this scientific parameter and withheld otherwise lawful Rolling/period ARIMA results. The disposable fixture was guarded by exact loopback host, database and owner identity; older schema tests first required removal of extra synthetic tables left by the newer candidate rehearsal. That local fixture reset is not a cloud data operation.

Regression tests retain refusal for non-finite or string `x1`, unknown `x2`, private fields, unknown policies, malformed orders, prototype keys and oversized parameter sets. Actual four-model Current tests verify the retained parameter value and original exact scientific/band identity through the approved source view. Full local regression passed: 423 operation tests, 61 original forecast/snapshot tests, zero skipped, and strict TypeScript validation. Exact controlled candidate/main proofs and normal PR merge are required separately; this document does not pre-claim them.

This prerequisite does not accept PR #465 or complete its independent Verification task. That task must rebase on the corrected authority, revalidate the revised source digest and scientific metadata, and obtain fresh proof for its new exact SHA. No product deployment or complete E1 acceptance is implied.
