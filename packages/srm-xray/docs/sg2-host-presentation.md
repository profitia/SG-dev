# Optional SG2 host presentation

`FullXRayWorkflow` defaults to the unchanged standalone layout and search capabilities. Only `presentation="sg2"` suppresses the internal SRM-C52 header and renders its existing actions in module navigation. The AppShell supplies the parent header, palette and current theme.

The SG2 variant selects `SupplierSearch searchMode="nip-only"`. The standalone default remains `nip-and-name`. NIP-only neither probes name-catalog availability nor starts name searches/verification; it retains NIP validation, submission and any existing host admission requirement.

`sg2-host-theme.css` is the source of scoped host token inheritance and semantic surfaces, text, borders, SVG labels and dialog styling. It is included by `report-layout.css` and the existing full-report generator. No default standalone palette, layout, business operation, transport, permission or financial methodology is changed.

Canonical references: SRM-C52/HDR-01 (host-owned header variant), SRM-C96/ACT-09 (NIP-only host variant), SRM-C95/FND-05 (shared light/dark roles). Product UI and real behaviors use existing contracts; synthetic test fixtures remain simulation. This package change authorizes no SRM deployment.
