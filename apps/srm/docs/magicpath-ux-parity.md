# SRM Development — MagicPath UX parity

Source design: SRM Karta dostawcy (`460298797105438720`), dashboard
`460342287638077440`, displayed revision `460669159668338688`, read 2026-10-13.
Library: `460628300646219776`, component `clever-tide-1504`.

## Ownership and integration

Financial scanner, indicator explorer, history chart/table and SpendGuru presentation
remain in `packages/srm-xray/src`. The host passes authenticated report projections,
supplier identity and artwork URLs. The host owns search, logout, brand metadata and
served assets. No provider, scoring, tenancy, cache, export or KYS behavior is replaced.
New website/logo discovery remains mounted above the scanner.

Prototype-only fixture selectors, library inspectors and Ctrl-click design navigation
are not product controls. No fixture supplier or synthetic financial values enter the
runtime. Benchmark qualification remains governed by Financial Data; visual parity
does not enable unsupported historical/peer scoring.

## Named behavior

- Radar sweep: six sequential 20% sector and label expansions on first visible load;
  pointer/keyboard interaction takes over. Motion uses 200ms easing and 480ms spacing.
- Hover: buttons 3%, tabs/text 2.5%, year capsules 6%, icons 7%, fields 1.5%; wide
  disclosures 0.8%. History bars 4.5%. Reduced-motion disables transforms/transitions.
- History dialog: native modal, viewport centered, fixed available height. Header
  contains chart/table switch, copy and Close. Chart adapts vertically; narrow screens
  retain horizontal navigation. Long tables scroll only their data region.
- History: one zero-based signed scale, oldest lightest to newest Deep Ocean. Zero
  and missing values have no filled bar. Missing is distinct from numeric zero.
- Excel copy: TSV, years A, values B, units C, information D; all periods; comma
  decimals, original decimal strings, empty missing numeric cells and formula-safe text.
- Assistant: deterministic current supplier/period financial summary, male/Anna,
  slide to right ribbon, two arrival pulses of 9.1%, draft input, native separate window.
  No model calls and no simulated replies; Send remains disabled with an explanation.

## Context and lifecycle

The financial mount owns `AssistantApplicationContext` v1: supplier identity, financial
source version, statement scope, selected radar/comparison, actual indicator selection
and each selected year, open history and raw summary values. It is a UI context, never
authorization. A future server adapter must reauthorize and reread source facts.
`createConversationRequest` snapshots and freezes context only on future submission.

Detached chat uses a same-origin presentation window and React portal, sharing one
state owner. Context, avatar and draft remain live. Native close reattaches; parent
navigation/unmount closes the child. Blocked popups keep the widget inline with an
explanation. No financial values or credentials are placed in window URLs or browser
message buses. Supplier reset unmounts the widget and clears its draft/child.

Category/custom preferences keep the existing opaque organization/session scope and
sessionStorage behavior. The work does not introduce a saved server-side personal view.

## Release boundary

SRM Development only; no schema migration or infrastructure reconfiguration. Source
authority: profitia/SG-dev/main, isolated task branch. Owners: SRM Runtime and SRM
X-Ray Module, ALIGNED baseline / TRANSITIONAL delta. PMOS: srm_pmos; PHR required;
MEMOROS canonically disabled. Tests and runtime verification are recorded in closeout.
