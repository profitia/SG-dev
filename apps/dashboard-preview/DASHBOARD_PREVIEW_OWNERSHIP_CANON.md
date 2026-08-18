# SpendGuru Dashboard Preview — Ownership & Embedding Canon

Document status: CANONICAL
Module: SpendGuru Dashboard Preview
Purpose class: Architectural Ownership Boundary
Canonical application: `apps/dashboard-preview`
Audience: Developers, implementation agents, reviewers, maintainers
Last updated: 2026-08-18

---

## 1. Purpose

This document defines the canonical architectural ownership of the SpendGuru benchmark chart and its visualization capabilities.

Its purpose is to ensure that SpendGuru has:

* one implementation of the benchmark chart,
* one implementation surface for chart behavior,
* one reusable and embeddable visualization capability,
* no duplicated chart logic across product modules.

The canonical implementation location is:

```text
apps/dashboard-preview
```

This rule applies regardless of where the chart is displayed in the SpendGuru product.

---

## 2. Canonical Ownership Decision

The following rule is mandatory:

> `apps/dashboard-preview` is the single canonical implementation surface for all functionality belonging to the SpendGuru benchmark chart.

All functionality concerning:

* chart rendering,
* chart behavior,
* chart controls,
* analytical overlays,
* historical series visualization,
* forecast visualization,
* forecast verification visualization,
* chart interactions,
* chart-level analytical tools,

must be developed in:

```text
apps/dashboard-preview
```

No other SpendGuru application or module may create its own independent implementation of these capabilities.

---

## 3. Dashboard Preview Is an Embeddable Capability

Dashboard Preview must be treated as both:

1. a standalone application / development surface,
2. an embeddable SpendGuru visualization capability.

The canonical architectural pattern is:

```text
                    apps/dashboard-preview
                            │
                            │
                  canonical chart capability
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   Benchmark Finder   Category Builder   Future Modules
          │
          ▼
       embed
```

The host application determines **where and in what business context** the chart is displayed.

Dashboard Preview determines **how the chart itself behaves and is rendered**.

---

## 4. Single Source of Truth for Chart Functionality

If a capability affects the benchmark chart itself, its implementation belongs in:

```text
apps/dashboard-preview
```

Examples include:

* historical benchmark line,
* forecast line,
* historical forecast / backtest line,
* forecast-vs-actual delta visualization,
* model selection controls,
* time-range controls,
* chart legends,
* chart scaling,
* historical/future visual segmentation,
* tooltip behavior,
* crosshair behavior,
* zoom behavior,
* hover analytics,
* chart annotations,
* chart-specific loading states,
* chart-specific error states,
* future analytical overlays.

Even if a capability is initially needed only inside one host module, it must not be implemented as host-specific chart logic.

Instead:

```text
new chart requirement
        ↓
implement in apps/dashboard-preview
        ↓
expose through reusable chart configuration / contract
        ↓
consume from host application
```

---

## 5. Host Applications Do Not Own the Chart

Applications embedding Dashboard Preview may own:

* business workflow,
* surrounding page layout,
* benchmark discovery,
* benchmark selection,
* category context,
* navigation,
* host-level actions,
* user workflow outside the chart.

They do not own:

* chart rendering logic,
* forecast visualization logic,
* backtest visualization logic,
* chart-specific controls,
* chart-specific analytical interactions.

For example:

```text
Benchmark Finder
```

owns:

```text
search benchmark
        ↓
select benchmark
        ↓
expand benchmark card
        ↓
provide benchmark context
        ↓
embed Dashboard Preview
```

It does not implement the benchmark chart itself.

---

## 6. Canonical Benchmark Finder Pattern

The expected integration pattern is:

```text
Benchmark Finder
        │
        │ benchmark selected
        ▼
     ROP-E
        │
        │ expand
        ▼
Dashboard Preview Embed
        │
        ├── Historical
        ├── Forecast
        ├── Forecast Verification
        └── future chart analytics
```

Benchmark Finder should supply the context needed to identify the benchmark.

Dashboard Preview should own the visualization experience.

---

## 7. No Chart Forks

The following pattern is forbidden:

```text
apps/dashboard-preview
        │
        ├── chart implementation A
        │
Benchmark Finder
        │
        └── copied chart implementation B
```

Also forbidden:

```text
Dashboard Preview chart
        +
host-specific forecast chart
        +
host-specific category chart
        +
host-specific benchmark chart
```

The required pattern is:

```text
one Dashboard Preview chart
        ↓
multiple embed contexts
```

---

## 8. No Copy-and-Modify

Chart components must not be copied from Dashboard Preview into another application for modification.

If a host application needs different behavior:

```text
host requirement
        ↓
generalize capability where appropriate
inside apps/dashboard-preview
        ↓
expose configuration
        ↓
host consumes configuration
```

This preserves:

* visual consistency,
* analytical consistency,
* maintainability,
* testability,
* future evolution of the chart.

---

## 9. Forecasting Responsibility Boundary

Forecasting mathematics and chart visualization are separate responsibilities.

The canonical boundary is:

```text
Forecast Core
        │
        │ deterministic forecast data
        ▼
Forecast Integration Contract
        │
        ▼
Dashboard Preview
        │
        │ visualization
        ▼
User
```

### Forecast Core owns

Forecast Core is responsible for:

* statistical models,
* model fitting,
* current forecasts,
* historical backtest forecasts,
* backtest actual values,
* model metadata,
* forecast quality metrics,
* failure status,
* model availability,
* deterministic forecasting behavior.

Forecast Core does not own chart rendering.

### Dashboard Preview owns

Dashboard Preview is responsible for:

* displaying current forecasts,
* displaying historical forecasts,
* displaying actual history,
* displaying forecast-vs-actual delta,
* model-selection UX,
* chart state,
* chart controls,
* historical/future visual layout,
* chart interaction.

Dashboard Preview must not reimplement forecast mathematics.

---

## 10. Historical Data Responsibility

The chart may display historical benchmark observations originating from providers such as Macrobond.

The visualization layer must not assume that Forecast Core owns historical market-data acquisition.

The architectural contract remains conceptually:

```text
Historical Benchmark Data
        │
        ├────────────────────┐
        │                    │
        ▼                    ▼
Dashboard Preview       Forecast Core
        │                    │
        │                    │ forecast results
        └───────────┬────────┘
                    ▼
                  Chart
```

Provider-specific data acquisition and Forecast Core mathematics must remain separate from chart behavior.

---

## 11. Forecast UX v1 — Canonical Flow

The first forecast visualization flow uses the existing historical benchmark chart as its foundation.

### 11.1 Default state

The default state shows:

```text
Historical Actual
```

only.

Example controls:

```text
☐ Pokaż prognozę

☐ Pokaż sprawdzalność prognozy
```

`Pokaż sprawdzalność prognozy` should remain unavailable until a forecast model is active.

---

## 12. Show Forecast

When the user activates:

```text
☑ Pokaż prognozę
```

Dashboard Preview reveals the available forecast model choices.

Model selection is single-choice.

Therefore the preferred UI semantic is:

```text
Model prognozy:

( ) Model A
(●) Model B
( ) Model C
```

rather than multiple independent model checkboxes.

The exact user-facing model portfolio is defined outside this Ownership Canon.

Dashboard Preview consumes the allowed model portfolio from the Forecast Integration Contract.

---

## 13. One Active Forecast Model

Forecast UX v1 assumes:

```text
one active forecast model at a time
```

This protects chart readability and makes forecast verification unambiguous.

The selected model controls both:

```text
Current Forecast
```

and:

```text
Historical Forecast / Forecast Verification
```

If the user changes the selected model:

```text
Model A
    ↓
Model B
```

Dashboard Preview updates consistently:

```text
future forecast line
+
historical forecast line
+
forecast-vs-actual delta
+
model-related analytical evidence
```

---

## 14. Historical and Future Area

When:

```text
Pokaż prognozę = OFF
```

the historical series may use the full chart width.

When:

```text
Pokaż prognozę = ON
```

the chart should create clear visual space for the future forecast.

The intended UX is approximately:

```text
                    TODAY
                      │
 Historical           │          Forecast
                      │
       ~50%           │            ~50%
                      │
──────────────────────┼──────────────────────
```

The chart remains conceptually:

```text
one continuous time-series chart
```

not two independent charts.

Historical and future observations share:

* the same visualization,
* the same value axis,
* the same time semantics,
* the same interaction surface.

The exact chart geometry may be refined during implementation without breaking this principle.

---

## 15. Show Forecast Verification

When the user activates:

```text
☑ Pokaż sprawdzalność prognozy
```

Dashboard Preview displays, on the historical side of the chart:

```text
Historical Actual
+
Historical Forecast
+
Forecast Error / Delta Area
```

The Historical Forecast must correspond to:

```text
the currently selected forecast model
```

It must not use another model implicitly.

---

## 16. Forecast Verification Meaning

Forecast Verification answers the user question:

> Jak dobrze ten model prognozował wcześniej w porównaniu z tym, co faktycznie wydarzyło się później?

The visual relationship is:

```text
Actual Historical
        │
        │ difference
        ▼
Historical Forecast
```

The area between the two series represents:

```text
Forecast Error / Delta
```

This is an observed historical forecast error.

It must not be described as:

```text
confidence interval
```

or:

```text
prediction interval
```

These concepts are separate.

---

## 17. Delta Area

The forecast verification visualization should make the historical forecast error visible through an area between:

```text
Historical Forecast
```

and:

```text
Historical Actual
```

Conceptually:

```text
Actual
──────────╲
           ▓▓▓▓▓▓
           ▓DELTA▓
           ▓▓▓▓▓▓
- - - - - -╲
Historical Forecast
```

The purpose is not merely decorative.

It should allow a buyer to visually answer:

```text
Where did the forecast differ from the realized market value?
```

and:

```text
How large was that difference?
```

---

## 18. Canonical Forecast Chart States

The chart must support these conceptual states:

| State                      | Historical Actual | Current Forecast | Historical Forecast | Delta |
| -------------------------- | ----------------: | ---------------: | ------------------: | ----: |
| Default                    |               YES |               NO |                  NO |    NO |
| Show Forecast              |               YES |              YES |                  NO |    NO |
| Show Forecast Verification |               YES |              YES |                 YES |   YES |

Forecast Verification is dependent on an active forecast model.

A separate model selection for verification is not required in UX v1.

---

## 19. Future Analytical Features

Future features such as:

* advanced tooltips,
* point analytics,
* model metrics,
* error metrics,
* hover comparison,
* benchmark annotations,
* event overlays,
* confidence / prediction intervals,
* advanced zoom,
* analytical markers,

remain possible extensions.

If they are chart-level capabilities, they must also be developed inside:

```text
apps/dashboard-preview
```

Their future existence does not change the ownership boundary defined by this Canon.

---

## 20. Embedding Contract Principle

Host applications should not need knowledge of internal chart implementation.

Conceptually, an embedding host should provide only the context required to render the chart, such as:

```text
benchmark identity
locale
display context
allowed capabilities
optional configuration
```

Exact props, API contracts, URLs, component interfaces, or transport mechanisms are not defined by this Canon.

They must be defined separately in an implementation or integration contract.

---

## 21. Host-Specific Configuration Is Allowed

Reusable configuration is allowed.

For example, a host may be permitted to request:

```text
benchmark = ROP-E
forecast capability = enabled
forecast verification capability = enabled
locale = pl
```

This does not violate the ownership rule.

What is forbidden is implementing the underlying chart behavior in the host.

Canonical distinction:

```text
configuration
        = allowed

duplicated implementation
        = forbidden
```

---

## 22. Standalone Dashboard Preview Remains Important

Embedding does not eliminate the standalone Dashboard Preview application.

The standalone application remains the primary environment for:

* developing chart capabilities,
* testing chart behavior,
* validating new analytical overlays,
* visually reviewing chart functionality independently of host applications.

A feature should be capable of being validated in Dashboard Preview before being consumed by another module.

---

## 23. Forecast Core Must Remain Presentation-Agnostic

Forecast Core must not contain assumptions such as:

```text
line color
chart width
tooltip structure
checkbox state
component state
React component behavior
visual delta rendering
```

Forecast Core returns deterministic data.

Dashboard Preview decides how that data is visualized.

---

## 24. Dashboard Preview Must Remain Forecast-Math-Agnostic

Dashboard Preview must not contain:

* Damped Holt equations,
* ETS fitting logic,
* ARIMA fitting logic,
* AICc selection,
* rolling-origin model fitting,
* model parameter estimation,
* model training.

The Dashboard may display metadata and metrics produced by Forecast Core.

It must not independently recreate them.

---

## 25. Canonical Architecture

The intended architectural direction is:

```text
                       DATA SOURCES
                           │
                           ▼
                  Historical Benchmark Data
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
     Dashboard Preview              Forecast Core
             │                           │
             │                     Forecast Results
             │                           │
             └─────────────┬─────────────┘
                           ▼
                Canonical Benchmark Chart
                           │
                           ▼
                  Embeddable Capability
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
      Benchmark Finder  Categories   Future Modules
```

---

## 26. Architectural Anti-Patterns

The following are explicitly non-canonical:

### Anti-pattern A — chart duplicated in Benchmark Finder

```text
Benchmark Finder
    └── own forecast chart
```

### Anti-pattern B — chart duplicated by business module

```text
Category Builder
    └── own benchmark visualization
```

### Anti-pattern C — forecast mathematics in Dashboard Preview

```text
Dashboard Preview
    └── fit ETS / ARIMA / Holt
```

### Anti-pattern D — visualization logic in Forecast Core

```text
Forecast Core
    └── React / chart configuration
```

### Anti-pattern E — host-specific forks

```text
Dashboard Preview
Dashboard Preview for Finder
Dashboard Preview for Categories
Dashboard Preview for Negotiation
```

The canonical solution is one reusable Dashboard Preview capability.

---

## 27. Rule for Future Development

When a future requirement appears, ask first:

> Is this functionality part of the benchmark chart itself?

If:

```text
YES
```

the canonical implementation location is:

```text
apps/dashboard-preview
```

If:

```text
NO
```

it may belong to the embedding business module.

This ownership decision should be made before implementation starts.

---

## 28. Exceptions

Exceptions to this ownership rule require an explicit architectural decision.

An implementation agent must not independently decide to create another chart implementation because:

* embedding is inconvenient,
* host architecture differs,
* a deadline is short,
* only one host currently needs the feature.

Short-term duplication is not an accepted workaround.

---

## 29. Relationship to Forecasting Canon

This document defines:

```text
visualization ownership
embedding ownership
chart UX ownership
```

It does not replace:

```text
FORECASTING_CANON.md
FORECASTING_METHODS_SPEC.md
```

Forecasting documents remain authoritative for:

* model mathematics,
* backtesting,
* statistical methodology,
* model validity,
* Forecast Core.

This Canon remains authoritative for:

* benchmark chart ownership,
* visualization behavior,
* embed architecture.

---

## 30. Relationship to Future Dashboard Integration Contract

This Canon intentionally does not define:

* REST endpoints,
* server actions,
* component APIs,
* TypeScript interfaces,
* exact embed mechanism,
* forecast payload schemas,
* persistence,
* caching,
* scheduling,
* model portfolio selection.

Those decisions belong to the future:

```text
Forecast Portfolio v1 + Dashboard Integration Contract
```

That contract must comply with this Ownership Canon.

---

## 31. Canonical Summary

The architectural rule can be summarized as:

```text
Forecast Core
    owns forecast mathematics

Dashboard Preview
    owns benchmark chart functionality

Embedding modules
    own business context
```

And:

```text
one chart implementation
        ↓
apps/dashboard-preview
        ↓
embed everywhere
```

This is the canonical SpendGuru Dashboard Preview ownership model.
