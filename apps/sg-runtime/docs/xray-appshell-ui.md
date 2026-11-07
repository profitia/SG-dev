# X-Ray presentation in SpendGuru AppShell

SG2 opts into `FullXRayWorkflow presentation="sg2"`; the shared default remains standalone SRM.

- SRM-C52/HDR-01: the AppShell is the single application header. Existing return and new-report actions are rendered as module navigation, using the unchanged host callbacks and report controller.
- SRM-C96/ACT-09: SG2 selects the canonical NIP form variant. There is one NIP field and the introduction reads “Wpisz numer NIP.” The name mode and catalog availability/search/verification operations are absent in this variant. Standalone retains both modes. Existing NIP admission, validation and search contracts remain authoritative.
- SRM-C95/FND-05: SG2 inherits the actual AppShell palette through CSS custom properties. The variant consumes semantic roles in cards, tables, SVG labels, chart controls and dialogs, including the native top layer. Theme changes update attributes/tokens and do not remount the workflow or refetch a report.

The package stylesheet is generated from source by `npm run build:presentation-css`; do not edit `full-report.css` directly. The new source sheet is gated by `data-presentation="sg2"` and preserves standalone isolation defaults. Brand assets retain their original colors on their deliberate light stage.

UI: product. NIP search, report operations and navigation behavior: product through existing contracts. Automated fixtures: simulation, restricted to tests. No fixture data or simulated API enters the application.

For this authorized task only, the verified Development implementation is the one-way reference for MagicPath project `468088248183431168`, component “A - X-Ray widok w SpendGuru”. Canonical project: `460628300646219776`. A matching screenshot or canonical ID alone is not live binding; the MagicPath handoff must distinguish shared definitions, synchronized tokens, inspector provenance and any controlled-update limitations.
