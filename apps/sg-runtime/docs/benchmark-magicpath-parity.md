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
