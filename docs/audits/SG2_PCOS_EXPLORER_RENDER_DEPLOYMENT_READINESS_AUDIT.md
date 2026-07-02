# SG2 PCOS Explorer Render Deployment Readiness Audit

## 1. Executive summary

`apps/pcos-explorer` is technically close to being deployable as a standalone Next.js web app, but it is **not deployment-ready as-is** for a clean Render rollout.

What is already true:

- the app has its own `package.json`, `package-lock.json`, `.env.example`, `build` script and `start` script
- `npm run build` currently passes from `apps/pcos-explorer`
- `/datasets`, `/datasets/normalized_cost_components_mock` and `/datasets/sync_metadata_mock` are mock-backed and do not require live PostgreSQL cognition data

What is missing or risky:

- repo-side Render config exists only for PMOS, not for `pcos-explorer`
- current `start` script is hardcoded to port `3100`, which is not Render-safe
- Git remote exists, but the repo worktree is heavily dirty, so current local state is not a safe push/deploy candidate
- root `/` has a fallback only for a specific DB failure mode (`ECONNREFUSED`), so full DB-free hosting is only partially safe

Short answer:

- can it be deployed manually to Render after setup: **yes, with caveats**
- is repo-side Render config for `pcos-explorer` already present: **no**
- is GitHub connectivity present: **yes, but readiness is partial**
- is mock-only online preview possible: **partial, not fully robust**

## 2. Repository deployment inventory

| Element | Status | File / source | Notes |
| --- | --- | --- | --- |
| Root `render.yaml` | Present | `render.yaml` | Defines PMOS only, not `pcos-explorer` |
| `pcos-explorer` Render service definition | Missing | repo scan | No Render blueprint entry for `apps/pcos-explorer` |
| Dockerfile | Missing | repo scan | No Docker deployment surface found for `pcos-explorer` or root |
| GitHub Actions deployment workflow | Missing for app deploy | `.github/workflows/pmos-authority-enforcement.yml` | Workflow is PMOS governance only, not deployment |
| Root deployment docs | Present | `docs/deployment/*` | Docs are mainly for `apps/sg-runtime`, PMOS separation and Render governance |
| Root `.env.example` | Present | `.env.example` | SG2 runtime-focused, not `pcos-explorer`-specific |
| App `.env.example` | Present | `apps/pcos-explorer/.env.example` | Good local/env reference for this app |
| App local PostCSS config | Present | `apps/pcos-explorer/postcss.config.mjs` | Required for Tailwind v4 processing |
| App package lock | Present | `apps/pcos-explorer/package-lock.json` | Supports app-local `npm ci` install |
| GitHub remote | Present | `git remote -v` | `origin = https://github.com/profitia/pmos-sg20-development.git` |
| Current branch | Present | `git branch --show-current` | `main` |
| Worktree cleanliness | Not clean | `git status --short` | `1539` changed/untracked entries |

## 3. PCOS Explorer deployment assessment

### Package scripts

`apps/pcos-explorer/package.json` currently provides:

- `dev`: `next dev --turbopack --port 3100`
- `build`: `next build`
- `start`: `next start --port 3100`
- `typecheck`: `tsc --noEmit`

Assessment:

- `build` is valid and currently works
- `start` exists, but it is **not suitable as-is for Render**, because Render expects the app to bind to the platform-provided `PORT`
- for Render, the safe start command should be set manually in the Render UI as `npx next start --port $PORT` unless the app script is changed in a future task

### Build status

Validated in this audit:

- `cd apps/pcos-explorer && npm run build` → PASS

Observed warning during build:

- Next.js warns about inferred workspace root and multiple lockfiles
- this is a deployment risk signal worth noting, although the build itself succeeds

### Next.js config

`apps/pcos-explorer/next.config.ts` contains:

- `serverExternalPackages: ["pg"]`
- `transpilePackages: ["@sg/pcos-contracts"]`

Assessment:

- this supports standalone deployment as a Node-based Next.js service
- the app still depends on repo checkout containing `packages/pcos-contracts`, so deployment should clone the full SG-dev repo, not only an exported app subfolder

### CSS / PostCSS readiness

Confirmed:

- `apps/pcos-explorer/postcss.config.mjs` exists
- the Tailwind v4 processing fix is present
- current build compiles successfully after the UI stabilization work

### Runtime dependencies

The app has two runtime modes in practice:

1. mock dataset routes
2. DB-backed cognition routes

Mock dataset routes:

- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

These are backed by the registry + mock dataset modules, not by Prisma queries.

DB-backed routes:

- `/`
- cognition domain routes such as `/ontology`, `/memory`, `/intelligence`, `/retrieval`, `/hydration`, `/promotion`, `/validation`, `/supplier`, `/benchmark`, `/embeddings`

These import `@/lib/prisma` directly or indirectly and therefore depend on a meaningful `DATABASE_URL` runtime contract.

## 4. Render readiness

`RENDER_CONFIG_FOUND: PARTIAL`

Reason:

- repo contains `render.yaml`
- but that file defines only `pmos-spendguru2-development`
- repo deployment docs and Render governance are written for `apps/sg-runtime`, not `apps/pcos-explorer`
- no `pcos-explorer` service is declared in `render.yaml`

`RENDER_SERVICE_TYPE: Web Service`

Reason:

- this is a Next.js server-rendered app
- it is not a static export
- no Dockerfile exists, so Docker is unnecessary for the first deployment path

Suggested configuration for a manual Render setup:

```text
ROOT_DIRECTORY: apps/pcos-explorer
BUILD_COMMAND: npm ci && npm run build
START_COMMAND: npx next start --port $PORT
NODE_VERSION: 20
ENVIRONMENT: production
```

Notes:

- do not use `npm run start` unchanged on Render because it hardcodes port `3100`
- `npm ci` is preferred over `npm install` because the app has its own `package-lock.json`
- Node 20 is the safe recommendation based on current repo conventions and modern Next.js runtime expectations

## 5. GitHub readiness

`GITHUB_READY: PARTIAL`

```text
CURRENT_BRANCH: main
REMOTE: origin = https://github.com/profitia/pmos-sg20-development.git
UNCOMMITTED_CHANGES: YES
FILES_TO_COMMIT: at minimum the current apps/pcos-explorer changes, the deployment audit report, and any future deployment config files; current status shows apps/pcos-explorer/, docs/audits/, and docs/implementation/ as uncommitted/untracked surfaces
```

Assessment:

- the repo is connected to GitHub
- the active branch is `main`
- but the worktree is not deployment-clean
- `git status --short | wc -l` returned `1539`
- because of that, current local state is not safe for blind commit/push or for treating remote GitHub as already matching local preview state

Secret safety check:

- `.gitignore` already excludes `.env`, `.env.local` and `*.local` variants
- `.env.example` files are intentionally committable
- I did not find evidence that `.env.local` must be committed for deployment

## 6. Environment variables

| Variable | Required? | Needed for | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required for DB-backed routes | Prisma read access for root and cognition pages | Required by `src/lib/prisma.ts`; mock dataset routes do not use it directly |
| `DIRECT_URL` | Not required for runtime boot | Prisma tooling / schema workflows | Present in app `.env.example`, but not used by app runtime code |
| `PCOS_EXPLORER_ORG_ID` | Optional for boot | Org scoping in explorer queries | Defaults to `pcos-default` if unset |
| `PCOS_EXPLORER_ENV` | Optional for boot | Header/environment label | Defaults to `LAB` if unset |
| `NODE_ENV` | Expected in production | Next.js production runtime | Standard platform/runtime variable |
| `PORT` | Required by Render platform | Network binding | Current app script ignores it, so Render start command must handle it explicitly |

Interpretation by scenario:

- required for app boot on Render: `PORT`, `NODE_ENV`
- required for live PostgreSQL-backed cognition data: `DATABASE_URL`
- optional for mock dataset routes: `PCOS_EXPLORER_ORG_ID`, `PCOS_EXPLORER_ENV`
- not needed for mock dataset routes themselves: `DIRECT_URL`

## 7. Mock-only online preview feasibility

`MOCK_ONLY_ONLINE_PREVIEW_POSSIBLE: PARTIAL`

What works without live cognition data:

- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

Why this is only partial:

- `/` imports Prisma and only falls back when the failure matches `ECONNREFUSED`
- this is not the same as a formally supported DB-free deployment mode
- if `DATABASE_URL` is missing, malformed, or fails in a different way, the root route may still fail
- DB-backed cognition routes remain live in the app and may error without a real datasource

Practical conclusion:

- a public preview focused on mock dataset pages is feasible
- a truly DB-free, robust online deployment contract is **not yet explicit** in the app

## 8. Manual Render setup instructions

This section assumes you want a **temporary public preview** of `pcos-explorer`, not a production SG2 runtime deployment.

### Step-by-step

1. On GitHub, make sure the exact `pcos-explorer` version you want to publish is committed.
2. Do not push the whole current local mess blindly. First isolate the files that actually belong to the preview.
3. Push the chosen commit to a branch you want Render to watch.
4. In Render, click **New** → **Web Service**.
5. Connect the GitHub repo `profitia/pmos-sg20-development` if it is not already connected.
6. Choose the branch that contains the committed `pcos-explorer` preview state.
7. Set **Root Directory** to `apps/pcos-explorer`.
8. Set **Build Command** to `npm ci && npm run build`.
9. Set **Start Command** to `npx next start --port $PORT`.
10. Choose **Node** runtime and use Node `20`.
11. Set environment variables:
12. Add `NODE_ENV=production`.
13. Add `PCOS_EXPLORER_ENV=LAB` unless you want a different header label.
14. Add `PCOS_EXPLORER_ORG_ID=pcos-default` unless you want a different org scope.
15. If you want live cognition pages, add a valid `DATABASE_URL`.
16. If you want only a preview of mock dataset pages, do not assume the whole app is DB-free. Test carefully after deploy.
17. Trigger the first deploy.
18. After deploy, open the service URL and check these pages first:
19. `/datasets`
20. `/datasets/normalized_cost_components_mock`
21. `/datasets/sync_metadata_mock`
22. Then check `/` separately, because it is the risky route when DB is unavailable.

### Important practical warning

If your goal is a clean public preview, the current app would benefit from one more small deployment-focused task before release:

- either a Render-safe start script
- or a committed `render.yaml` entry
- or an explicit mock-preview mode / safer root fallback

## 9. Risks

- no auth layer is described for a public preview, so the service would be publicly accessible
- mock data would be visible publicly, even if it is synthetic
- root `/` is only partially protected against DB absence
- cognition routes outside `/datasets` remain DB-backed and may fail publicly
- `start` script is hardcoded to `3100`, so default app start is not PaaS-safe
- repo worktree is heavily dirty, increasing push/deploy risk
- no app-specific Render config exists in the repo
- no app-specific deployment workflow exists in GitHub Actions
- no explicit `src/app/api/health/route.ts` exists even though internal docs mention it as a missing surface
- Next.js build emitted a workspace-root inference warning because of multiple lockfiles
- deployment still depends on full repo checkout because of `@sg/pcos-contracts` usage from sibling package source

## 10. Recommendation

`DO_NOT_DEPLOY_YET`

Reason:

- the app is close, but not yet cleanly deployment-ready
- current local state is not safely publishable because the repo is too dirty
- `pcos-explorer` has no repo-side Render service definition
- the current `start` script is not compatible with Render without manual override
- mock-only hosting is possible only partially, not as a formally safe DB-free mode

If the goal is a temporary preview, the best next move is a short follow-up task that prepares deployment surfaces without changing product scope.

## 11. Suggested next prompt

Suggested next prompt:

```text
PRE-EXECUTION (MANDATORY BOOTSTRAP)

Before performing any analysis, planning or implementation you MUST complete the mandatory bootstrap.

1. Load the canonical Prompt Contract:
- Canon/v1.0-canonical-prompt-contract.md

2. Load the Mandatory Execution Canon:
- Canon/v1.0-vsc-mandatory-execution-canon.md

3. Load the Developer Lifecycle Specification:
- Canon/v1.0-developer-lifecycle-specification.md

4. Verify explicitly:
✓ Prompt Contract loaded
✓ Execution Canon loaded
✓ Developer Lifecycle loaded

TASK

SG2.0 - IMPLEMENTACJA: Minimalny deployment prep dla apps/pcos-explorer pod Render preview.

Zakres:
- nie wdrażaj jeszcze na Render
- nie commituj i nie pushuj
- dodaj minimalny repo-side deployment prep dla pcos-explorer
- przygotuj tylko to, co potrzebne do bezpiecznego preview mock dataset routes

Wykonaj:
- dodaj app-specific deployment README dla apps/pcos-explorer
- zaproponuj lub dodaj render-safe start surface
- dodaj minimalny render.yaml entry albo osobny blueprint tylko dla pcos-explorer preview, jeśli to najbezpieczniejsze
- dodaj jasną listę env vars
- oceń, czy trzeba dodać explicit mock-preview mode albo bezpieczniejszy fallback dla /

Nie dodawaj:
- auth
- PostgreSQL endpointów
- migracji
- Snowflake
- PMOS/MEMOROS deploymentu

Na końcu:
- uruchom wymagane walidacje
- zapisz raport implementacyjny
- domknij task pełnym PMOS lifecycle
```
