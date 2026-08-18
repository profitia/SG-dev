# SpendGuru Environment Foundation Status

## Completed

- Staging Render service formally designated and renamed to `spendguru-stage`.
- Staging remains bound to `profitia/spendguru` on branch `main`.
- Staging health validated through HTTP, API, UI, locale, theme, and responsive smoke checks.
- Development database isolation created in Neon as child branch `development` under project `sg2-data-runtime-staging`.
- Repository validation workflow added at `.github/workflows/validate.yml`.
- Local validation passed with `npm test`, `npm run typecheck`, and `npm run build`.

## Verified Runtime Mapping

- Staging Render service ID: `srv-d98a73btqb8s73fabp90`
- Staging public URL: `https://sg2-0-charts-preview.onrender.com`
- Staging Neon project: `sg2-data-runtime-staging`
- Staging Neon branch: `production`
- Development Neon branch: `development`
- Development Neon branch ID: `br-old-wildflower-asw0m0uy`

## Remaining Gates

- Commit and open PR for the environment foundation changes.
- Merge to `main` and re-validate staging on the merged commit.
- Create remote `production` branch from the exact validated staging commit.
- Configure branch protection and required validation checks for `production`.
- Approve and create the separate Render production service before first production deploy.