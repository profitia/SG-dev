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


## Canonical UI increment — 2026-10-13

Pinned design authority: library project `460628300646219776`, component
`460628347660177408`, revision `460743895437963264`. Dashboard component
`460342287638077440` revision `460737554073919488` consumes that library in MagicPath.
The runtime uses its own reviewed, deployed source; it never embeds the MagicPath
share URL and does not import demonstration financial data.

One-way runtime contract: `ui-canon.tsx` definitions and `ui-canon.css` tokens ->
shared SRM X-Ray primitives/compositions -> application slots. Definitions retain
the stable SRM-C IDs and associated behavior/font/number IDs from the library.
`data-library-component` and `data-canon-usage` identify actual runtime usages.
The TypeScript AST guard in `ui-canon.test.ts` rejects unmapped native controls,
unknown IDs and duplicate source usage sites on the migrated design surfaces.
When adding a component: first register its named design/behavior in MagicPath,
then its shared implementation, and finally use that definition in the application.
Library source changes affect all runtime usages after the standard build/deploy.
An edit made only in external MagicPath is not a production-code deployment.

`SRM-C51` is the in-page overview chart: 300 px card, no selected-year headline,
24 px controls, 12 px icons, 0.75 px border. Touch controls use 32 px. Expanded
histories share `FinancialHistoryDialog` and `FinancialHistoryView` with the radar
and indicator histories. Years increase left-to-right; one hue gains saturation
with recency. Zero and missing values have tracks only, negative values extend
below zero. Statement values remain in thousands of PLN, including clipboard
exports with decimal precision preserved before formatting.

Indicators move into a separate initially collapsed panel under Detailed Data.
A host-provided DOM slot keeps the explorer under its original scanner state
owner, so category years, custom choices and detached assistant context survive
collapse/expansion. The independently mounted scanner still renders indicators
inline when no slot is supplied. Statement scope/period selection, Excel export,
source navigation, KYS/KRS downloads and company web identity remain operational.

Statement charts start with revenue, operating costs and net result. The plus tile
adds a selected available source metric (including balance metrics); selection is
view-local and resets with the reporting basis or a new report. Unknown source
codes remain codes; no accounting labels or unsupported currencies are invented.
The supplemental cash-flow definition box is removed from this view.

Coverage boundary: this increment migrates the approved MagicPath dashboard,
financial explorer, statement workspace, histories, assistant and host controls.
Existing KYS report internals, registry fields and authentication screens have no
new MagicPath canon in this task; they remain separate modules, not falsely marked
as fully migrated. Designer Ctrl-click navigation and the library editing/audit
console stay in MagicPath, outside the buyer workflow.
