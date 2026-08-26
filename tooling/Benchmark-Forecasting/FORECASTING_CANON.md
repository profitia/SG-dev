# SpendGuru 2.0 — Benchmark Forecasting Canon

**Document status:** CANONICAL  
**Module:** SpendGuru Benchmark Forecasting  
**Target directory:** `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/tooling/Benchmark-Forecasting`  
**Purpose:** Architectural and implementation canon for the first SpendGuru Forecasting MVP  
**Audience:** Developers, VS Code / GitHub Copilot agents, architects, maintainers  
**Last updated:** 2026-08-18

---

# 1. Purpose

This document defines the canonical architectural principles, scope, constraints and implementation rules for the first version of the SpendGuru Benchmark Forecasting module.

The module is an internal deterministic forecasting runtime used to:

- build statistical forecasting models,
- backtest them on historical benchmark data,
- compare model quality,
- generate forecasts for selected benchmarks,
- expose forecast results to the existing SpendGuru Dashboard Preview,
- validate which model classes are suitable for future production use in SpendGuru 2.0.

This document is intentionally pragmatic.

The current goal is **not** to build the complete production Forecast Engine for PCOS.

The current goal is to deliver a small, working Forecasting MVP quickly, prove forecasting value on real historical data, and create a clean foundation that can later be industrialized.

Mathematical and statistical methodology is defined in:

`FORECASTING_METHODS_SPEC.md`

Forecast target semantics are defined in:

`FORECAST_TARGET_BASIS_CANON.md`

---

# 2. Strategic Context

Forecast Engine is a future deterministic engine within the SpendGuru 2.0 Procurement Cognition Operating System (PCOS).

It will ultimately provide forecasts to capabilities such as:

- Category Intelligence,
- Opportunity Engine,
- Risk Engine,
- Recommendation Engine,
- Decision Runtime,
- Procurement Decision Intelligence.

Forecast Engine itself does **not** make procurement decisions.

It only produces deterministic, auditable and explainable forecasts.

LLM models may later explain forecasts, but LLMs must never generate forecast values.

---

# 3. Current MVP Definition

The current module is called:

> **SpendGuru Benchmark Forecasting MVP**

It is implemented as an internal tooling application in:

```text
/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/tooling/Benchmark-Forecasting
```

The module must remain isolated from the main SG-Dev monorepo runtime at this stage.

It is a Forecasting Lab / deterministic forecasting runtime, not yet a production PCOS service.

The MVP must support:

1. loading selected historical benchmark series from a PostgreSQL runtime snapshot containing benchmark data originating from Snowflake,
2. preparing a canonical time-series representation,
3. running a small portfolio of statistical models,
4. generating forecasts,
5. backtesting models against historical actual values,
6. calculating comparable quality metrics,
7. exposing model results through a simple API or internal contract,
8. rendering forecast data in the **existing Dashboard Preview chart**,
9. allowing the user to select which forecast model is displayed,
10. allowing the user to display historical forecast-vs-actual agreement.

---

# 4. Primary Product Principle

The first priority is:

> **Fast delivery of a working, testable forecasting MVP.**

The project must optimize for:

- simplicity,
- speed of implementation,
- reproducibility,
- explainability,
- deterministic behavior,
- low operational complexity,
- ease of model comparison,
- ease of replacement or extension later.

Do not optimize the MVP for theoretical completeness or large-scale production readiness.

---

# 5. Mandatory Architectural Principles

## 5.1 Deterministic forecasting only

Forecast values must be generated exclusively by deterministic statistical models.

LLMs must never be used to calculate:

- forecast values,
- prediction intervals,
- model parameters,
- model selection scores.

AI may later be used only for natural-language explanation.

---

## 5.2 Data-source agnostic Forecast Core

The Forecast Core must not depend on Snowflake, Macrobond, Bloomberg, Expana or any other provider.

All providers are external data adapters.

The canonical architecture is:

```text
Snowflake Adapter ───┐
                     │
Macrobond Adapter ───┼──> Canonical Time Series ──> Forecast Core
                     │
Bloomberg Adapter ───┘
```

For the current MVP laboratory flow the first implemented adapter may be a PostgreSQL Snapshot Adapter reading historical benchmark data originating from Snowflake.

Future provider adapters must be replaceable without changing:

- forecasting models,
- backtesting,
- metrics,
- model comparison logic,
- forecast output contracts.

---

## 5.3 PostgreSQL runtime snapshot is Forecast Laboratory data source

PostgreSQL runtime snapshot containing historical benchmark data originating from Snowflake is the Forecast Laboratory Data Source for the current MVP.

Direct Snowflake access is not required for Forecasting MVP dataset discovery or model development.

During MVP development the PostgreSQL runtime snapshot is used as the controlled historical dataset for:

- model development,
- backtesting,
- model validation,
- implementation testing.

The MVP should primarily use **Historical** values.

Existing source-derived fields such as:

- Forecast,
- LCI,
- UCI,
- %Diff

must not be used as training ground truth for new models.

They may later be used as an external comparison baseline.

The ground truth for model evaluation is always the historical value that actually occurred after the forecast origin.

---

## 5.4 Macrobond integration is outside MVP scope

Do not build production Macrobond ingestion during this phase.

The module must be architecturally ready for a future `MacrobondDataSource`, but no Macrobond hydration framework is required now.

The same applies to Bloomberg and other future providers.

---

# 6. Explicit Non-Goals

The following are **OUT OF SCOPE** for the current MVP.

DO NOT build:

- advanced hydration,
- large cache infrastructure,
- generalized provider registry,
- production Macrobond synchronization,
- Bloomberg integration,
- background schedulers,
- event-driven pipelines,
- data lake architecture,
- complex ETL orchestration,
- automatic production model switching,
- advanced Champion/Challenger orchestration,
- ML forecasting,
- neural-network forecasting,
- Prophet unless explicitly approved later,
- LLM forecasting,
- PCOS integration,
- Decision Runtime integration,
- AppShell integration beyond the existing Dashboard Preview use case,
- tenant-scale production infrastructure,
- large observability platform,
- advanced model governance,
- feature store,
- complex Forecast Repository,
- unnecessary microservices.

Do not refactor unrelated SG-Dev code.

Do not build future architecture speculatively.

---

# 7. UI Canon

## 7.1 No separate forecasting UI

Do **not** build Streamlit or a second forecasting dashboard.

Forecast results must be displayed in the existing SpendGuru **Dashboard Preview** chart.

The existing benchmark selection and historical chart remain the primary UI.

Forecasting adds additional controls and chart layers.

---

## 7.2 Required user flow

Current flow:

```text
Select benchmark
    ↓
Historical benchmark chart
```

Extended MVP flow:

```text
Select benchmark
    ↓
Historical benchmark chart
    ↓
[ ] Show forecast
        ↓
    Select model
        ↓
    Select horizon
        ↓
Forecast displayed on existing chart

Optional:
[ ] Show historical forecast accuracy
        ↓
Forecast vs Actual displayed for backtest period
```

---

## 7.3 Required controls

At minimum:

```text
Forecast

[ ] Show forecast

Model
[ Damped Holt ▼ ]

Horizon
[1M] [3M] [6M] [12M]

[ ] Show historical forecast accuracy
```

A simple "Compare models" action may also be added.

---

## 7.4 Chart behavior

The existing historical series remains unchanged.

Forecast is added as another chart series.

Historical validation may display:

- actual observations,
- historical forecast values,
- delta between forecast and actual.

Do not render a permanent label on every point for dense daily data.

Use chart tooltip/hover for:

```text
Date
Actual
Forecast
Delta
Delta %
```

---

# 8. Canonical Time-Series Contract

Forecast Target Basis defines what lawful target value a canonical Forecast series represents.

Target Basis semantics are governed by:

`FORECAST_TARGET_BASIS_CANON.md`

Forecast Core must consume provider-neutral data.

Conceptual contract:

```python
TimeSeries:
    series_id: str
    benchmark_name: str
    frequency: str
    observations:
        - date
        - value
    metadata:
        unit
        currency
        region
        provider
        provider_series_id
```

Only fields required by the model should be mandatory.

Provider-specific structures must never leak into model implementations.

---

# 9. Frequency Canon

Observation frequency is the first major segmentation dimension.

Supported conceptual classes:

```text
DAILY
WEEKLY
MONTHLY
QUARTERLY
SEMIANNUAL
```

Current implemented MVP scope:

```text
MONTHLY
```

The current accepted methodology and Phase 1 implementation are canonical for regular MONTHLY series.

In the current PostgreSQL laboratory snapshot:

```text
MONTHLY = available
WEEKLY  = available
DAILY   = no lawful shortlist
```

WEEKLY, DAILY and other frequency implementations remain future extensions and require explicit methodology and horizon-semantics extensions before implementation.

Quarterly and semiannual series may be added later.

Frequency does **not** automatically determine one model.

The intended hierarchy is:

```text
Frequency
    ↓
Series characteristics
    ↓
Eligible candidate models
```

Not:

```text
Frequency
    ↓
One fixed model
```

---

# 10. Data Density and Series Profiling

A declared frequency is not enough to assess forecastability.

For each series the module should calculate a small profiling set when practical:

```text
observation_count
history_start
history_end
history_span
declared_frequency
actual_observation_density
missing_values
coverage_ratio
max_gap
median_gap
```

Optional later diagnostics:

```text
volatility
trend strength
seasonality strength
autocorrelation
stationarity
structural breaks
```

Do not block MVP delivery on advanced diagnostics.

---

# 11. Data Quality Rules

Forecasting must validate the input before model fitting.

Minimum checks:

- date column exists,
- value column exists,
- dates are parseable,
- values are numeric,
- observations are sorted,
- duplicate dates are detected,
- missing values are reported,
- obviously stale series are reported,
- history length is sufficient for the requested model,
- invalid or impossible model configurations are rejected.

---

# 12. Preprocessing Canon

Preprocessing must remain conservative and auditable.

## MUST NOT

Do not automatically:

- convert every series to monthly frequency,
- delete recent valid observations,
- duplicate the last value and pretend it is an observed record,
- create artificial seasonality,
- silently interpolate large gaps,
- silently change source frequency.

## Interpolation

Interpolation may be used only when:

- the gap is small,
- the rule is explicit,
- the fact that interpolation occurred can be identified,
- the operation is appropriate for the series frequency.

The first MVP may use minimal preprocessing if the selected canonical benchmark series are sufficiently clean.

---

# 13. Legacy Spend Guru ML — Lessons

The legacy Spend Guru ML implementation provides useful reference but is **not** the architecture to copy.

Useful legacy elements:

- Python,
- pandas,
- numpy,
- statsmodels,
- exponential smoothing models,
- ARIMA/SARIMA,
- confidence intervals,
- forecast history,
- configuration history,
- Snowflake connectivity,
- basic input validation.

Legacy behaviors that must **not** become canonical:

- tight coupling between Forecaster and Snowflake,
- global `date_trunc('month')` aggregation,
- averaging all higher-frequency values into monthly observations by default,
- trimming valid recent observations only to enforce a fixed T-2 month state,
- duplicating a previous value as if it were a real observation,
- unrestricted interpolation,
- setting seasonality to `2` as a generic fallback,
- generating forecasts without an explicit Naive baseline,
- relying on model configuration without formal rolling backtesting.

---

# 14. MVP Model Portfolio

Keep the initial portfolio deliberately small.

## Mandatory baseline

### Naive / Last Value

Conceptually:

```text
Forecast(t+h) = last observed value
```

Naive is mandatory even if it is not the primary user-facing model.

It is the minimum benchmark that statistical models must be compared against.

---

## Model 1 — Damped Holt

Purpose:

- trend-aware,
- explainable,
- conservative long-horizon behavior,
- suitable candidate for many benchmark series.

---

## Model 2 — ETS

Purpose:

- exponential smoothing family,
- level/trend/seasonality where eligible,
- interpretable,
- strong classical forecasting baseline.

---

## Model 3 — ARIMA

Purpose:

- autoregressive statistical alternative,
- different model family from exponential smoothing,
- useful comparison candidate.

---

## Future challenger — SARIMA

SARIMA should be easy to add for monthly or clearly seasonal series.

Do not enable SARIMA blindly for every benchmark.

Seasonal models require sufficient history.

If history is insufficient:

```text
seasonal model = not eligible
```

Do not replace true seasonality with arbitrary `seasonality = 2`.

---

# 15. Model Eligibility

Models should fail safely.

Example eligibility logic:

```text
Insufficient history
    ↓
Do not run complex model
    ↓
Use simpler eligible candidates
```

The engine must prefer a simpler valid model over a complex invalid model.

Model eligibility rules must be explicit and deterministic.

---

# 16. Forecast Horizons

The business horizons are:

```text
1M
3M
6M
12M
```

These represent business-time horizons.

The operative semantics for the current MVP are defined in:

`FORECASTING_METHODS_SPEC.md`

For regular MONTHLY series:

```text
1M  = T + 1 monthly observation
3M  = T + 3 monthly observations
6M  = T + 6 monthly observations
12M = T + 12 monthly observations
```

Generalized calendar translation for WEEKLY, DAILY, or other frequencies remains a future extension and must be defined explicitly before implementation.

---

# 17. Backtesting Canon

Backtesting is a first-class capability of the MVP.

A model is not considered valuable only because it can produce a forecast.

It must be evaluated against historical actual observations.

## Required methodology

Use **rolling-origin / walk-forward backtesting** for model evaluation.

Conceptually:

```text
Train until T1
Forecast horizon
Compare with actual

Train until T2
Forecast horizon
Compare with actual

Train until T3
Forecast horizon
Compare with actual
...
```

Do not use random train/test splits for time series.

---

# 18. Backtesting vs Visualization

Two concepts must remain separate.

## Model evaluation

Use rolling-origin backtesting to calculate objective model quality.

## User visualization

The chart may show a simpler representative historical validation window:

```text
Historical training period
        ↓
Historical forecast
        ↓
Actual observations
        ↓
Delta
```

Do not overload the chart with all rolling-origin forecast paths.

---

# 19. Forecast Quality Metrics

The MVP should support at least:

```text
MAE
RMSE
MASE
sMAPE
Directional Accuracy
Forecast Bias
```

Not every metric must be visible in the first UI.

## Important interpretation

### MASE

MASE is strategically important because it allows comparison against Naive.

Conceptually:

```text
MASE < 1
```

means the model is better than the chosen naive baseline.

### Directional Accuracy

Important for procurement because correct direction may be more valuable than small point accuracy differences.

Example:

Forecasting `+6%` instead of actual `+8%` may be acceptable.

Forecasting `-4%` when actual is `+8%` is materially worse for procurement decisions.

---

# 20. Model Comparison

The MVP must allow comparison of candidate models.

Minimum comparison table:

```text
Model
MAE
RMSE
MASE
sMAPE
Directional Accuracy
Bias
```

Metrics may also be broken down by horizon:

```text
Model | 1M | 3M | 6M | 12M
```

Do not assume one model must be best at every horizon.

The backtests may reveal:

```text
best model for 1M != best model for 12M
```

Do not build automated per-horizon champion switching yet.

Collect evidence first.

---

# 21. User Model Selection

The MVP must distinguish:

```text
Best backtest result
```

from:

```text
Model selected by user for presentation
```

The system may recommend or visually identify the best-performing model.

The user must still be able to select a different model for chart presentation.

Do not implement automatic production model switching in this phase.

---

# 22. Forecast Output Contract

Forecast runtime should expose a provider-neutral result.

Conceptual response:

```json
{
  "benchmarkId": "ROPE",
  "model": "damped_holt",
  "horizon": "6M",
    "forecast": [
        {
            "date": "2026-09-01",
            "value": 1240
        }
    ],
  "backtest": [
    {
      "date": "2025-01-01",
      "forecast": 1176,
      "actual": 1201,
      "delta": -25,
      "deltaPct": -2.08
    }
  ],
  "metrics": {
    "mae": 32.4,
    "rmse": 41.8,
    "mase": 0.84,
    "smape": 4.2,
    "directionalAccuracy": 0.71,
    "bias": -0.018
  }
}
```

Exact transport format may change.

The semantic contract must remain stable.

For the current MVP, the canonical output contract is point-forecast only.

---

# 23. Confidence Intervals

Prediction intervals are not part of the current Forecasting MVP output contract.

They remain a future extension and require a separate approved design.

The current MVP therefore remains:

```text
forecast_value
```

Do not build the full future SpendGuru Confidence Engine yet.

Model-native interval surfaces may be evaluated later, but they are not part of the current accepted contract.

Future PCOS Forecast Engine may separately calculate:

- statistical prediction interval,
- model confidence,
- data confidence,
- forecast reliability.

---

# 24. Minimal Persistence

Avoid a large Forecast Repository in MVP.

However, the design should make it possible to preserve important run results.

Recommended minimal logical record:

```text
benchmark_id
model
model_parameters
training_from
training_to
forecast_origin
forecast_horizon
forecast_date
predicted_value
actual_value
delta
delta_pct
metrics
run_timestamp
```

Persistence may initially be lightweight.

Do not build a large persistence subsystem before it is needed.

---

# 25. Suggested Runtime Architecture

Canonical MVP architecture:

```text
        POSTGRESQL RUNTIME SNAPSHOT
              │
              ▼
          Postgres Adapter
              │
              ▼
        Canonical Time Series
              │
              ▼
        Data Quality / Profile
              │
              ▼
          Forecast Core
        /        |        \
    Naive   Damped Holt   ETS / ARIMA
        \        |        /
              ▼
          Backtesting
              │
              ▼
          Model Metrics
              │
              ▼
      future API / Dashboard integration
```

Provider-neutral future extension path:

```text
PostgreSQL Snapshot Adapter ─┐
Macrobond Adapter [future] ──┼──> Canonical Time Series
Bloomberg Adapter [future] ──┘
```

---

# 26. Runtime Technology Direction

## Forecast Core

Preferred:

```text
Python
pandas
numpy
statsmodels
```

Additional libraries may be added only when required.

Avoid unnecessary ML frameworks.

## API

A small Python API such as FastAPI is acceptable if needed for integration with Dashboard Preview.

Do not create unnecessary service infrastructure around it.

## Dashboard Preview

Keep existing:

```text
Next.js / TypeScript
existing charting library
existing benchmark selection
existing historical chart
```

Forecasting must extend the current chart rather than replace it.

---

# 27. Suggested MVP Repository Structure

Keep the structure small.

Current module structure:

```text
Benchmark-Forecasting/
│
├── FORECASTING_CANON.md
├── FORECASTING_METHODS_SPEC.md
├── POSTGRES_FORECAST_DATA_DISCOVERY.md
├── PHASE1_MATHEMATICAL_REVIEW.md
├── README.md
├── requirements.txt
├── .env
│
├── forecasting/
│   ├── __init__.py
│   ├── backtest.py
│   ├── contracts.py
│   ├── metrics.py
│   ├── service.py
│   └── models/
│       ├── __init__.py
│       ├── base.py
│       ├── naive.py
│
├── data_sources/
│   ├── __init__.py
│   ├── base.py
│   └── postgres.py
│
├── scripts/
│   └── run_phase1.py
│
└── tests/
    └── test_phase1.py
```

Do not create directories for capabilities that do not exist yet.

---

# 28. Initial Benchmark Selection

Do not test against the whole PostgreSQL historical snapshot or full SG2 dataset estate.

Start with a small representative benchmark set.

Current accepted laboratory scope:

```text
3 MONTHLY benchmarks

FRACHT_DRY   (series_id: wocaes0280)
PET_RESIN    (series_id: PET_RESIN)
CEM_I_PORR   (component: CEM_I)
```

Accepted Phase 1 history for each benchmark:

```text
64 MONTHLY Historical observations
2021-01-01 -> 2026-04-01
```

Future validation may add other frequency classes, but DAILY is not a current MVP completion requirement.

Do not add quarterly and semiannual series until the basic pipeline works.

---

# 29. First Experimental Sequence

Current sequence:

## Phase 1 — COMPLETE

1. Connect read-only to the PostgreSQL runtime snapshot.
2. Load the accepted benchmark set.
3. Filter to Historical-only rows.
4. Normalize into Canonical Time Series.
5. Run Naive.
6. Run rolling backtests.
7. Calculate metrics.

## Statistical Method Specification — COMPLETE

8. Define the canonical methodology in `FORECASTING_METHODS_SPEC.md`.

## Next Phase 2 — Statistical challengers

9. Implement Damped Holt.
10. Implement ETS.
11. Implement ARIMA.
12. Compare all models against the locked Naive baseline across `1M`, `3M`, `6M`, and `12M`.

## Later phase — Dashboard integration

13. Expose forecast result contract.
14. Add `Show forecast` to Dashboard Preview.
15. Add model selector.
16. Add horizon selector.
17. Add `Show historical forecast accuracy`.
18. Display Actual vs Forecast and Delta.

---

# 30. MVP Success Criteria

The current Forecasting MVP laboratory slice is successful when:

1. the accepted 3 monthly historical benchmarks can be loaded from the PostgreSQL runtime snapshot,
2. PostgreSQL Historical-only rows are normalized into canonical time series,
3. the locked Phase 1 baseline works end-to-end,
4. the portfolio target remains Naive + Damped Holt + ETS + ARIMA,
5. rolling-origin backtests can be run,
6. model metrics are available,
7. models can be compared on the accepted monthly laboratory scope,
8. the Forecast Core has no hard dependency on PostgreSQL-, Snowflake-, or provider-specific structures,
9. no advanced hydration or provider framework has been introduced.

Dashboard Preview integration, user model selection, and future forecast overlays remain later MVP phases rather than current completion gates.

---

# 31. Architecture Decision: Prove Forecasting Value Before Data Industrialization

This is a core program decision.

The order of work is:

```text
1. Prove forecasting value
2. Validate models through backtesting
3. Decide model portfolio
4. Stabilize Forecast Core
5. Only then industrialize data delivery
6. Add Macrobond / Bloomberg adapters later
```

Do not invert this sequence.

Do not spend the first phase building sophisticated provider infrastructure before model value is proven.

---

# 32. Future Migration to Production

If Forecasting MVP succeeds, future work may include:

```text
Macrobond Adapter
Bloomberg Adapter
automatic historical hydration
cache
forecast repository
scheduled recomputation
model eligibility rules
automatic champion selection
confidence engine
monitoring
PCOS integration
Decision Runtime integration
production deployment
```

These items are intentionally excluded from the MVP.

---

# 33. Provider Neutrality Rule

The following statement is canonical:

> Forecast Core must behave identically regardless of whether historical data comes from Snowflake, Macrobond, Bloomberg or another provider, provided that the adapter supplies the same canonical time-series contract.

The same rule applies to Target Basis handling: provider adapters may supply different lawful canonical target series, but Forecast Core must consume them as deterministic canonical series rather than provider-specific special cases.

Provider integration concerns must remain outside the forecasting algorithms.

---

# 34. Explainability Rule

Every model used in MVP must be explainable.

For each forecast it should be possible to answer:

```text
Which model was used?
What history was used?
What horizon was requested?
What parameters were used?
What backtest quality did the model achieve?
How did forecast compare with actual?
How did it compare with Naive?
```

If these questions cannot be answered, the model is not suitable for the canonical MVP.

---

# 35. Implementation Rules for VS Code / Copilot

When implementing this module:

1. Read this file first.
2. Treat this file as the authoritative scope boundary.
3. Prefer the smallest working implementation.
4. Do not expand scope without explicit instruction.
5. Reuse existing Dashboard Preview charting code.
6. Do not create a second frontend.
7. Do not implement Macrobond now.
8. Do not implement hydration now.
9. Do not introduce ML or LLM forecasting.
10. Keep Forecast Core provider-neutral.
11. Use PostgreSQL runtime snapshot as the current laboratory data source.
12. Always include Naive in backtests.
13. Build backtesting before optimizing forecast presentation.
14. Keep model code independent from UI code.
15. Keep provider code independent from model code.
16. Do not refactor unrelated SG-Dev areas.
17. Avoid speculative abstractions.
18. Prefer explicit code over unnecessary frameworks.
19. Preserve deterministic behavior.
20. Preserve reproducibility of backtest results.

---

# 36. Canonical Summary

The first SpendGuru Benchmark Forecasting implementation is a **small deterministic forecasting laboratory**, not a full production forecasting platform.

It must:

```text
Use PostgreSQL runtime snapshot containing Snowflake-origin benchmark data
    ↓
Historical-only extraction
        ↓
Normalize provider data
        ↓
Run Naive + small statistical model portfolio
        ↓
Backtest
        ↓
Compare
        ↓
Generate forecast
        ↓
Expose result
        ↓
Render in existing Dashboard Preview chart
```

The project succeeds when it provides evidence that SpendGuru can generate useful, explainable forecasts and identifies which statistical models are worth carrying into the production Forecast Engine.

Everything else is secondary until that evidence exists.
