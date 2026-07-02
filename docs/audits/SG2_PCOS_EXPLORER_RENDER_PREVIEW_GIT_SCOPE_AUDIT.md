# SG2 PCOS Explorer Render Preview Git Scope Audit

## 1. Executive summary

Yes - a clean, selective commit can be prepared, but only if the scope is kept intentionally narrow.

The safest recommendation is:

- include the coherent `apps/pcos-explorer` source/config/docs tree
- include only the `pcos-explorer` reports that document dataset work, UI stabilization, Render readiness and Render deployment prep
- exclude all local build output, dependency installs, env-local files, PMOS runtime artifacts and unrelated audits

Because the repo worktree is still very dirty, the push strategy should use a dedicated branch, not direct work on `main`.

## 2. Current git state

- Branch: `main`
- Remote: `origin = https://github.com/profitia/pmos-sg20-development.git`
- Total changes from `git status --short`: `1551`
- Dominant change groups from the current worktree:
  - `apps/pmos/.pmos` - `1205` entries
  - `templates/pmos-starter/apps` - `78` entries
  - `apps/pmos/src` - `72` entries
  - `apps/pmos/scripts` - `41` entries
  - `apps/pmos/.context` - `14` entries
- Scoped status for this stream is still broad at directory level:
  - `apps/pcos-explorer/`
  - `docs/audits/`
  - `docs/implementation/`

Interpretation:

- the repository is globally too dirty for a blind `git add .`
- the `pcos-explorer` app itself is still effectively an untracked tree from Git's perspective
- the safe path is a selective add of only the preview-related app files and the related reports

## 3. Recommended commit set

### Commit-set rule

Because `apps/pcos-explorer` is currently an untracked app tree, the narrowest **coherent** commit is:

- all authored source/config/docs files under `apps/pcos-explorer`
- excluding local artifacts and generated/local-only output
- plus the specific `pcos-explorer` reports listed below

### Commit-set groups

| File | Category | Why included | Safe to commit? |
| --- | --- | --- | --- |
| `apps/pcos-explorer/.env.example` | config | Documents the app env contract including preview mode | Yes |
| `apps/pcos-explorer/README.md` | docs | App-specific Render preview operator guide | Yes |
| `apps/pcos-explorer/next-env.d.ts` | config | Standard Next.js app typing scaffold | Yes |
| `apps/pcos-explorer/next.config.ts` | config | App runtime/build configuration | Yes |
| `apps/pcos-explorer/package-lock.json` | config | Required for deterministic `npm ci` preview builds | Yes |
| `apps/pcos-explorer/package.json` | config | Defines Render-safe start surface and build scripts | Yes |
| `apps/pcos-explorer/postcss.config.mjs` | config | Required Tailwind/PostCSS pipeline fix | Yes |
| `apps/pcos-explorer/prisma.config.ts` | config | Prisma generation/runtime config for the app | Yes |
| `apps/pcos-explorer/prisma/schema.prisma` | source schema | Required for Prisma generate in preview build flow | Yes |
| `apps/pcos-explorer/render.preview.yaml` | config | App-local preview blueprint for manual Render setup | Yes |
| `apps/pcos-explorer/scripts/sync-registry.mjs` | tooling | Part of app-local maintenance/tooling surface | Yes |
| `apps/pcos-explorer/scripts/sync-schema.mjs` | tooling | Referenced by package scripts and schema sync flow | Yes |
| `apps/pcos-explorer/src/**` listed below | source code | Contains dataset/dashboard work, UI stabilization and preview prep | Yes |
| `apps/pcos-explorer/tsconfig.json` | config | TypeScript config for the app | Yes |
| `docs/audits/SG2_PCOS_EXPLORER_RENDER_DEPLOYMENT_READINESS_AUDIT.md` | report | Records deployment-readiness findings that led to preview prep | Yes |
| `docs/audits/SG2_PCOS_EXPLORER_RENDER_PREVIEW_GIT_SCOPE_AUDIT.md` | report | Records the selective commit-scope decision for this stream | Yes |
| `docs/implementation/SG2_COGNITION_EXPLORER_DATASOURCE_ABSTRACTION_IMPLEMENTATION.md` | report | Documents the dataset abstraction layer now used by preview routes | Yes |
| `docs/implementation/SG2_COGNITION_EXPLORER_DATASET_SELECTOR_AND_VIEW_CONFIG_IMPLEMENTATION.md` | report | Documents dataset selector and multi-dataset view config work | Yes |
| `docs/implementation/SG2_PCOS_EXPLORER_UI_STABILIZATION_IMPLEMENTATION.md` | report | Documents shell/UI stabilization now visible in preview | Yes |
| `docs/implementation/SG2_PCOS_EXPLORER_RENDER_DEPLOYMENT_PREP_IMPLEMENTATION.md` | report | Documents Render preview preparation changes | Yes |

### Exact included files

The following exact files are the recommended selective add set.

| File | Category | Why included | Safe to commit? |
| --- | --- | --- | --- |
| `apps/pcos-explorer/.env.example` | config | Env contract | Yes |
| `apps/pcos-explorer/README.md` | docs | Preview operator guide | Yes |
| `apps/pcos-explorer/next-env.d.ts` | config | Next scaffold | Yes |
| `apps/pcos-explorer/next.config.ts` | config | Next runtime config | Yes |
| `apps/pcos-explorer/package-lock.json` | config | Deterministic install lockfile | Yes |
| `apps/pcos-explorer/package.json` | config | Scripts and dependencies | Yes |
| `apps/pcos-explorer/postcss.config.mjs` | config | Tailwind/PostCSS config | Yes |
| `apps/pcos-explorer/prisma.config.ts` | config | Prisma config | Yes |
| `apps/pcos-explorer/prisma/schema.prisma` | schema | Required for Prisma client generation | Yes |
| `apps/pcos-explorer/render.preview.yaml` | config | Render preview blueprint | Yes |
| `apps/pcos-explorer/scripts/sync-registry.mjs` | tooling | App support script | Yes |
| `apps/pcos-explorer/scripts/sync-schema.mjs` | tooling | App support script | Yes |
| `apps/pcos-explorer/src/app/benchmark/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/datasets/[datasetId]/page.tsx` | source | Dataset preview detail route | Yes |
| `apps/pcos-explorer/src/app/datasets/page.tsx` | source | Dataset preview listing route | Yes |
| `apps/pcos-explorer/src/app/embeddings/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/globals.css` | source | UI stabilization shell styles | Yes |
| `apps/pcos-explorer/src/app/hydration/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/intelligence/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/layout.tsx` | source | App shell/layout | Yes |
| `apps/pcos-explorer/src/app/memory/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/ontology/[id]/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/ontology/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/page.tsx` | source | Root preview contract and fallback behavior | Yes |
| `apps/pcos-explorer/src/app/promotion/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/retrieval/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/supplier/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/app/validation/page.tsx` | source | Existing app route surface | Yes |
| `apps/pcos-explorer/src/components/datasets/dataset-card.tsx` | source | Dataset UX work | Yes |
| `apps/pcos-explorer/src/components/datasets/dataset-summary-cards.tsx` | source | Dataset metrics UI | Yes |
| `apps/pcos-explorer/src/components/datasets/dataset-table.tsx` | source | Dataset table UI | Yes |
| `apps/pcos-explorer/src/components/nav/sidebar.tsx` | source | Sidebar stabilization and preview-safe nav shell | Yes |
| `apps/pcos-explorer/src/components/ui/badge.tsx` | source | Shared UI primitive | Yes |
| `apps/pcos-explorer/src/components/ui/card.tsx` | source | Shared UI primitive | Yes |
| `apps/pcos-explorer/src/components/ui/confidence-bar.tsx` | source | Shared UI primitive | Yes |
| `apps/pcos-explorer/src/components/ui/misc.tsx` | source | Shared UI primitive | Yes |
| `apps/pcos-explorer/src/components/ui/page-header.tsx` | source | Shared UI primitive | Yes |
| `apps/pcos-explorer/src/datasets/adapters/mock-datasource-adapter.ts` | source | Mock dataset adapter | Yes |
| `apps/pcos-explorer/src/datasets/dataset-contract.ts` | source | Dataset view contract | Yes |
| `apps/pcos-explorer/src/datasets/dataset-list-page.tsx` | source | Dataset listing renderer | Yes |
| `apps/pcos-explorer/src/datasets/dataset-page.tsx` | source | Dataset detail renderer | Yes |
| `apps/pcos-explorer/src/datasets/dataset-registry.ts` | source | Dataset registry | Yes |
| `apps/pcos-explorer/src/datasets/index.ts` | source | Dataset bootstrap | Yes |
| `apps/pcos-explorer/src/datasets/normalized-cost-components.mock.ts` | source | Mock preview dataset | Yes |
| `apps/pcos-explorer/src/datasets/sync-metadata.mock.ts` | source | Mock preview dataset | Yes |
| `apps/pcos-explorer/src/domains/benchmark/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/benchmark/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/embeddings/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/embeddings/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/hydration/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/hydration/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/intelligence/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/intelligence/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/memory/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/memory/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/ontology/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/ontology/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/promotion/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/promotion/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/retrieval/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/retrieval/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/supplier/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/supplier/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/domains/validation/definition.ts` | source | Existing app domain registry surface | Yes |
| `apps/pcos-explorer/src/domains/validation/query.ts` | source | Existing app domain query surface | Yes |
| `apps/pcos-explorer/src/explorer/domain-engine.ts` | source | Explorer runtime core | Yes |
| `apps/pcos-explorer/src/explorer/domain-page.tsx` | source | Explorer runtime core | Yes |
| `apps/pcos-explorer/src/explorer/renderer-engine.ts` | source | Explorer runtime core | Yes |
| `apps/pcos-explorer/src/lib/org.ts` | source | Preview mode and org/env flags | Yes |
| `apps/pcos-explorer/src/lib/prisma.ts` | source | Prisma runtime client | Yes |
| `apps/pcos-explorer/src/registry/artifact-registry.ts` | source | Registry layer | Yes |
| `apps/pcos-explorer/src/registry/domain-registry.ts` | source | Registry layer | Yes |
| `apps/pcos-explorer/src/registry/health-registry.ts` | source | Registry layer | Yes |
| `apps/pcos-explorer/src/registry/index.ts` | source | Registry bootstrap | Yes |
| `apps/pcos-explorer/src/registry/navigation-registry.ts` | source | Preview-safe navigation behavior | Yes |
| `apps/pcos-explorer/src/registry/renderer-registry.ts` | source | Registry layer | Yes |
| `apps/pcos-explorer/src/renderers/benchmark-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/embeddings-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/hydration-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/intelligence-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/memory-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/ontology-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/promotion-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/retrieval-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/supplier-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/renderers/validation-renderer.tsx` | source | Existing explorer renderer surface | Yes |
| `apps/pcos-explorer/src/services/cic-readiness.ts` | source | Existing app service surface | Yes |
| `apps/pcos-explorer/src/services/health-service.ts` | source | Existing app service surface | Yes |
| `apps/pcos-explorer/src/services/lineage-service.ts` | source | Existing app service surface | Yes |
| `apps/pcos-explorer/src/services/observability.ts` | source | Existing app service surface | Yes |
| `apps/pcos-explorer/tsconfig.json` | config | TypeScript config | Yes |
| `docs/audits/SG2_PCOS_EXPLORER_RENDER_DEPLOYMENT_READINESS_AUDIT.md` | report | Render readiness audit | Yes |
| `docs/audits/SG2_PCOS_EXPLORER_RENDER_PREVIEW_GIT_SCOPE_AUDIT.md` | report | This commit-scope audit | Yes |
| `docs/implementation/SG2_COGNITION_EXPLORER_DATASOURCE_ABSTRACTION_IMPLEMENTATION.md` | report | Dataset abstraction implementation record | Yes |
| `docs/implementation/SG2_COGNITION_EXPLORER_DATASET_SELECTOR_AND_VIEW_CONFIG_IMPLEMENTATION.md` | report | Dataset selector implementation record | Yes |
| `docs/implementation/SG2_PCOS_EXPLORER_UI_STABILIZATION_IMPLEMENTATION.md` | report | UI stabilization record | Yes |
| `docs/implementation/SG2_PCOS_EXPLORER_RENDER_DEPLOYMENT_PREP_IMPLEMENTATION.md` | report | Render preview prep record | Yes |

## 4. Excluded files / do not commit

| File / pattern | Reason |
| --- | --- |
| `apps/pcos-explorer/.next/**` | Local build output and dev cache; not source of truth |
| `apps/pcos-explorer/node_modules/**` | Installed dependencies; reproducible via `npm ci` |
| `apps/pcos-explorer/.DS_Store` | macOS local artifact |
| `apps/pcos-explorer/tsconfig.tsbuildinfo` | Local TypeScript cache; covered by `*.tsbuildinfo` ignore rule |
| `apps/pcos-explorer/src/generated/prisma/**` | Generated Prisma client output; narrower preview commit should rely on `npx prisma generate` during build instead of versioning generated artifacts in this commit |
| `**/.env.local` | Local secrets and machine-specific runtime config |
| `**/.env` containing real values | Secret-bearing runtime config |
| `apps/pmos/.pmos/**` | PMOS runtime artifacts, recovery state, conversation artifacts and closeout evidence are outside this preview commit scope |
| `apps/pmos/.context/**` | PMOS runtime projections, not app preview code |
| `MEMOROS/**` runtime-local artifacts if surfaced elsewhere | Outside app preview scope |
| `docs/audits/SG2_PMOS_PREFLIGHT_AND_HANDOFF_RECOVERY_BOOTSTRAP_AUDIT.md` | PMOS governance audit, not part of the Render preview commit minimum |
| `docs/audits/SG2_SNOWFLAKE_POSTGRES_COST_COMPONENTS_AUDIT.md` | Upstream datasource audit, not needed for preview commit |
| `docs/audits/SG2_COGNITION_EXPLORER_UNIVERSAL_DASHBOARD_AUDIT.md` | Broader explorer audit; useful context, but not required for the preview commit minimum |
| `root render.yaml` | Defines PMOS dev-time service; changing or recommitting it is unnecessary and risky for this preview scope |
| Unrelated changes in `apps/pmos/**`, `packages/governance/**`, `templates/pmos-starter/**` | Not part of `pcos-explorer` preview stream |

## 5. Sensitive file check

The recommended commit set was checked against obvious risk surfaces.

Confirmed excluded from the recommended set:

- `.env.local`
- `node_modules`
- `.next`
- `*.tsbuildinfo`
- PMOS runtime pending/recovery artifacts
- local system files like `.DS_Store`

Additional observations:

- `apps/pcos-explorer/.env.example` contains placeholders only, not live credentials
- `apps/pcos-explorer/render.preview.yaml` contains only env var names and non-secret defaults
- the implementation and audit reports do not expose credential values
- one audit report mentions `.env.local` as a concept, but that is documentation text, not a secret leak

## 6. Suggested commit message

```text
feat(pcos-explorer): prepare mock dataset preview for Render
```

Alternative if you want a broader wording that covers the earlier app work too:

```text
feat(pcos-explorer): add explorer shell, mock datasets, and Render preview prep
```

## 7. Suggested push strategy

Recommended strategy:

- do **not** push directly to `main`
- create a dedicated branch first

Suggested branch name:

```text
feature/pcos-explorer-render-preview
```

Why:

- the repo still has `1551` changes in the overall worktree
- a feature branch makes selective staging and review much safer
- if anything accidental enters staging, it is easier to inspect before merging

## 8. Next prompt

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

Prepare the selective Git commit for the pcos-explorer Render preview scope.

Rules:
- do not deploy
- do not create a Render service
- do not touch secrets
- do not add .env.local
- do not stage apps/pmos runtime artifacts
- do not stage .next, node_modules or tsbuildinfo

Execution:
- create and switch to branch feature/pcos-explorer-render-preview
- selectively git add only the files recommended in docs/audits/SG2_PCOS_EXPLORER_RENDER_PREVIEW_GIT_SCOPE_AUDIT.md
- show the final staged file list
- create a commit using:
  feat(pcos-explorer): prepare mock dataset preview for Render
- push the branch to origin
- do not open a PR

Validation:
- show git status --short before and after staging
- show git diff --cached --name-only before commit
- confirm no secrets or local artifacts are staged
- finish with full PMOS lifecycle closeout
```
