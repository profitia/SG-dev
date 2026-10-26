# Benchmark Finder presentation source

Task: SG2-BENCHMARK-MAGICPATH-1TO1-20261025. Target: Development only.

## Pinned design authority

- Benchmark Finder project 463019127557226496, component 463019497943629824, revision 463982323726172160 (v18).
- SRM canon/library project 460628300646219776, component 460628347660177408, revision 464039002702499840 (v114), Charts tab 15.
- The Finder's explicit instance edits take precedence over the library defaults: compact 56px navigator, no duplicate range heading/date row, fixed 50% history/forecast join.
- Source code was inspected alongside the live clickable revision. It is versioned in these presentation components; subsequent MagicPath edits require review and a new release, not untrusted live code execution.

## Data and interaction boundary

The existing discovery requests, identity and tenant boundaries, oil restriction, Macrobond integration, forecast models, server range presets, preparation commands, eligibility and readiness remain owned by the existing application. The visual layer consumes TimeSeriesViewerPayload. Synthetic prices and example quality percentages from the prototype are not included.

Chart coordinates, bounded time-window resizing/panning, legend visibility, keyboard cursor, date focus, drawers, theme, search-result presentation sorting/filtering and help are local presentation state. One-month zoom is a local subset of already loaded history. Other presets keep their original server callbacks. Null gaps remain gaps; the existing END_OF_PERIOD delta geometry is reused. Interpolation describes drawn segments only and is never persisted as a market observation.

The theme message is separate from the authenticated read/command channel. It contains only light/dark. The child requires its established parent origin and parent Window; the host matches the mounted iframe Window and exact URL origin. No token or market data is carried by it.

## Verification

Geometry tests cover centre anchoring, bounded pan, missing observations, immutable payloads, real delta surfaces, month-end dates, single observations and reveal animation. Existing discovery, forecast and native embed tests remain in the test suites. Browser comparison covers the pinned source and the actual production presentation components using an explicitly labelled local contract fixture. Real Development validation and deployment evidence are recorded separately; this document is not proof of a release.

## Release boundary

No Staging release, migration, database backfill, provider query or forecast recalculation is part of this change. Before Development deployment, record and verify the retained artifact, commit, configuration fingerprint and migration state for both existing services and confirm rollback feasibility. Do not modify operation-integration receipts merely to satisfy visual tests.

## Canon polish — 2026-10-26

Task: SG2-BENCHMARK-CANON-POLISH-20261026. The pinned live Canon v114 and Finder v18 were rechecked and are unchanged.

- Import the complete, unchanged spacing contract and its component bindings in both presentation hosts. Scope its tokens to the respective Finder/chart root and bind primitive wrappers to canonical component identifiers.
- Remove legacy Tailwind sizing from tabs, search sections and card expansion controls. Restore canonical heading/paragraph spacing, action-button variants, search-to-results spacing and recent-search typography.
- Use the library field dimensions (42px) for the simple search input. The Finder prototype's missing descendant space in `.bf-search-panel:is(input,select)` leaves this particular field at 21px. The library C07 pattern, rather than that accidental selector behavior, is the authority for this correction.
- Reuse C07 dropdown rows, surface, scrollbar and entrance animation in the existing remote metadata selector. Remote filtering, selected values, pagination and request handling are unchanged.
- Restore the chart's 14px/1.5 base typography, single 16px control-panel padding, C92 row and metric proportions, help typography, and compact responsive layout. Remove obsolete dropdown rules from the previous presentation.
- Bind hover transitions to the actual descendant action controls and keep reduced-motion and keyboard-focus behavior. Retain canonical chart panel backgrounds and circular ribbons.

The change is presentation-only. Protected server, provider, API, forecast mathematics and operation-authorization source boundaries remain byte-identical to the accepted receipt. No new data, forecast calculation or entitlement is introduced. The compatibility receipt records reviewed visual source fingerprints without rewriting its original acceptance evidence.

Local verification: runtime selected behavior tests 21/21; dashboard suite 345/345; runtime typecheck and dashboard source-only typecheck pass. The standard dashboard typecheck encounters pre-existing generated `.next/types` route-export errors; clean CI is required before release. Live verification, retained-artifact rollback evidence and final CI are recorded in PMOS/PHR separately.
