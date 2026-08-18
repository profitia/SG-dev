# SpendGuru Staging Pre-Designation Baseline

## Service Identity

- Render Service ID: `srv-d98a73btqb8s73fabp90`
- Current service name: `sg2.0-charts-preview`
- Service type: `Web Service`
- Runtime: `Node`
- Plan: `Starter`
- Repository: `profitia/spendguru`
- Branch: `main`
- Root directory: repository root / empty
- Region: `Frankfurt (EU Central)`
- Current public URL: `https://sg2-0-charts-preview.onrender.com`

## Current Deployment State

- Current deployed commit: `7edd3b0fe342be8cf8f5f24f5ec92f5752a3726a`
- Latest visible successful deploy: `7edd3b0` on `2026-07-21 09:49` local Render UI time
- Latest visible deploy start: `7edd3b0` on `2026-07-21 09:47` local Render UI time via `Auto-Deploy`
- Previous visible successful deploy: `90d5eeb` on `2026-07-21 08:23` local Render UI time
- Deploy ID: not surfaced in the accessible Render UI views used during this baseline capture
- Last successful deploy ID: not surfaced in the accessible Render UI views used during this baseline capture

## Build and Runtime Settings

- Build source repository URL: `https://github.com/profitia/spendguru`
- Build command: `npm ci && npm run build`
- Pre-deploy command: none configured
- Start command: `npx next start --hostname 0.0.0.0 --port $PORT`
- Auto-deploy: `On Commit`
- PR previews: `Off`
- Render subdomain: enabled
- Custom domains: none configured
- Health check path: none configured

## Environment Variables

- `DATABASE_URL`
- `NODE_ENV`
- `NODE_VERSION`

## Database Mapping

- Neon project: `sg2-data-runtime-staging`
- Neon project ID: `old-smoke-90429853`
- Neon branch: `production`
- Neon branch ID: `br-empty-bird-asg7u58f`
- Database: `neondb`
- Environment role: `STAGING_DATABASE`

## Rollback Procedure

1. If the Render service rename causes an unexpected routing or config issue, revert only the service name to `sg2.0-charts-preview`.
2. If a later configuration change introduces a bad deploy, use the latest confirmed successful deploy (`7edd3b0`, fallback `90d5eeb`) from the Render event history for rollback.
3. Do not change repository binding, branch, root directory, build command, start command, or `DATABASE_URL` during rollback unless a separate verified incident requires it.
4. Do not mutate the staging Neon project during service-name rollback.