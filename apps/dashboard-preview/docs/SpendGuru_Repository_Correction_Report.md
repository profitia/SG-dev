# SpendGuru Repository Correction Report

## 1. Executive Result

The previously published migration into `profitia/pmos-sg20-development` was
technically correct but directionally incorrect. The canonical product
repository is `profitia/spendguru`, renamed from
`profitia/sg2.0-dashboard-preview`.

## 2. Incorrect Target Repository

- Incorrect target: `profitia/pmos-sg20-development`
- Correct target: `profitia/spendguru`
- Previous correct repository name: `profitia/sg2.0-dashboard-preview`

## 3. Reason for Correction

The PMOS repository was incorrectly treated as the destination product
repository. The imported history and validation evidence remain valid for audit,
but no canonical-source switch to PMOS was approved.

## 4. Pull Request

- Repository: `profitia/pmos-sg20-development`
- Pull request: `#1`
- Title: `chore(spendguru): import Dashboard Preview into monorepo`
- Final state: `CLOSED WITHOUT MERGE`

## 5. Published Branches

- `chore/dashboard-preview-migration-governance` - removed from remote after
	evidence capture
- `chore/import-dashboard-preview-into-spendguru` - removed from remote after
	evidence capture

## 6. Preserved Commit SHAs

- Governance: `a15c36d214e358c212beb493bb8d388394d9c55a`
- Subtree import: `dd75a8c2630214ab7dfe603e537663518cf91408`
- Validation documentation: `148edbb9b2b34f769f103795a4da7bf2af7fd362`

## 7. Main Branch Verification

- Repository: `profitia/pmos-sg20-development`
- `main` changed: `NO`
- Expected `main` HEAD: `0ba26cf4fb0a3c1b6baa9d01307dcaa1a1926eb2`
- Verified `main` HEAD after cleanup: `0ba26cf4fb0a3c1b6baa9d01307dcaa1a1926eb2`

## 8. Deployment Verification

No deployment switch to PMOS was performed. The active Git history and Render
service lineage remain associated with the SpendGuru application repository.

- Provider: `Render`
- Service ID: `srv-d98a73btqb8s73fabp90`
- Visible service name: `sg2.0-charts-preview`
- Public probe: `https://sg2-0-charts-preview.onrender.com`
- Observed accessibility: `HTTP 307 -> /pl`
- Repository binding after rename: not directly queryable with available local
	tooling; old repository name resolves to the renamed GitHub repository and no
	outage was observed during the rename window
- Render role classification in this task: `ROLE_UNKNOWN`

## 9. Correct Canonical Repository

- Current repository: `profitia/spendguru`
- Previous repository name: `profitia/sg2.0-dashboard-preview`
- Baseline commit: `90d5eeb682ba0585e82dccb425314903c03cbfbc`

## 10. Cleanup Actions

- Close PMOS PR `#1` without merge
- Preserve the migration SHAs for audit
- Delete incorrect remote migration branches from PMOS after evidence capture
- Rename the canonical GitHub repository to `profitia/spendguru` - completed
- Update local `origin`
- Publish repository and environment governance docs in the canonical repo

## 11. Final Status

PMOS remains protected, unmerged, and non-canonical for the SpendGuru
application. Repository-direction correction completed, with Render role kept as
`ROLE_UNKNOWN` pending a dedicated environment task.