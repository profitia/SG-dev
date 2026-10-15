# SRM — MSR radar and financial revisions, Development

Task: SRM-MSR-RADAR-REVISIONS-20261015. Profile SRM; host conversation 01a12f0a-6fbf-7100-b03c-baf351570e70. PMOS only srm_pmos. MEMOROS disabled. No Staging/Production action.

## Implementation and known limits

Methodology 4.0.0, FINANCIAL_SOURCE_BASIS_V3, formulas 1.3, FINANCIAL_REVISIONS_V1. Independent MSR semantic qualification per axis; shared standalone/consolidated selection; strict XHTML primary-table adapter; immutable licensed originals and append-only versioned projections. Equivalent corrected filings resolved using full financial content. Full replacements do not inherit missing fields.

Explicit partial-amendment chain engine is tested with V1 → V2 → K3 → K4, per-field source and nil/zero/withdrawal semantics. Provider G0 remains a documented limitation: MGBI correction flag does not provide parent, replacement kind or changed-field scope. Unknown chains remain blocked; no automatic inferred merging or claim that all issuer corrections are supported.

Real stored-source offline pipeline: XTB 5272443955 consolidated 2025/2024 qualifies net result, revenue, operating margin, operating costs/revenue, liabilities/assets. CurrentAssets/CurrentLiabilities absent: liquidity remains unavailable. Standalone qualifies four axes; conflicting 2025 net values 638894000/639894000 are excluded; no current balance split. Source paid receipts are preserved; no extra download required.

## Last Known Good prepared before deployment

- Repo profitia/SG-dev, base/main 8e7c7257f74dcba5a638a928933428cccc740425.
- SRM Development Render service srv-db1vu6gm7kps73d0e3r0; workspace tea-d7lps8rbc2fs73cn80dg; environment evm-dapbd70ae00c73cgrup0.
- Live deploy dep-db8b8au89jmc73cthvjg; SHA 8e7c7257f74dcba5a638a928933428cccc740425.
- Read-only one-off job job-db8cgnij9qps73cerf70 launched the retained deployed artifact. Actual artifact digest 9ff7a18355a0690110e54b7d2bff4634886524602ecd3f6fd00d661609e21ed7, algorithm sha256-sorted-path-type-content-v1; 1660 files; build oViNo3rb79UXEYK84Q0tL. Log 2026-10-15T12:35:14.144247994Z.
- Config identity 7ac4867104ea8509c849fc4bd9adaace7a2edf575f8f4504e74cea222ff5c0fb (service config and sorted environment key/value pairs, no secrets persisted). Auto-deploy disabled.
- Neon project snowy-breeze-40315151, Development br-dark-surf-b1vrhda9, srm_app. Ledger 0001–0017 verified before additive 0018.
- Retained no-compute LKG branch br-winter-paper-b1szi7xo, srm-dev-lkg-msr-20261015; parent LSN 0/7405D40, parent time 2026-10-15T12:34:04Z.
- Restore rehearsal: child br-solitary-math-b1br05dh created from LKG. Confirmed 5/5 original checksums and old catalogue (33 rows). Applied 0018 on this child; forced RLS, runtime SELECT/INSERT permitted and UPDATE/DELETE denied, foreign organization sees zero originals. LKG branch itself remains untouched.

## Rollback procedure

Stop propagation; keep auto-deploy off. Roll back only srv-db1vu6gm7kps73d0e3r0 to retained deploy dep-db8b8au89jmc73cthvjg using Render rollback; verify old SHA, health and business lookup. Artifact retention/executability was proven by the one-off job. The additive projection table is ignored by old code; do not drop it or overwrite original receipts. If product data restoration is necessary, create a writable restoration branch from untouched br-winter-paper-b1szi7xo (rehearsed above), verify hashes/ledger, preserve post-snapshot writes for reconciliation, then route Development using governed config change. Never restore staging or PMOS and never auto-reverse an irreversible data migration.

## Validation status

Local PostgreSQL full suite: 406/406 passed, zero skips, including final context-conflict and cache-reprojection regressions. Typecheck and production build passed. Retained artifact job succeeded at 2026-10-15T12:35:17Z; Development health HTTP200 and unchanged config hash verified. Final CI, deployed SHA and business E2E pending publication; this file is not a release-GO claim.
