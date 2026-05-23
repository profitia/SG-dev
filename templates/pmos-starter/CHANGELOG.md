# CHANGELOG
## PMOS — Project Memory Operating System

All notable changes to the PMOS Starter-Kit are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows the rules defined in [VERSIONING.md](./VERSIONING.md).

---

## [v0.1.0-release-candidate] — 2026-05-18

This is the first release candidate of the PMOS Starter-Kit. It establishes the complete foundation for an AI-native embedded project memory runtime.

---

### RC Hardening Pass — 2026-05-13

Applied before tagging v0.1.0. Focus: runtime robustness, operational hardening, release stabilization, maintainability.

**TypeScript typecheck — FAZA 1**
- Created `apps/pmos/src/generated/prisma/index.d.ts` — development-time Prisma type stub (all 13 enums, 23 models, 12 junction tables, `PrismaClient` with typed delegates). Resolves all pre-generation implicit `any` cascade errors.
- Created `apps/pmos/src/types/css.d.ts` — CSS module declarations. Resolves `import './globals.css'` TypeScript error without relying on `next-env.d.ts` (which is excluded from version control).
- Result: `npx tsc --noEmit` = **0 errors** (was 70+ errors before stub creation).
- `TYPECHECK-REMEDIATION.md` created documenting root cause, error categories, fix strategy.

**Prisma client robustness — FAZA 2**
- Fixed `scripts/validate-pmos-install.sh` Prisma client detection: was checking `node_modules/.prisma` (engine binaries), now correctly checks `src/generated/prisma/index.js` (custom output path). Prevents false-pass on Prisma check.
- Downgraded auto-generate failure in validator from `fail` to `warn` — generation failure before `.env.local` is configured is expected, not an error.

**Script hardening — FAZA 3**
- Fixed `scripts/install-pmos.sh` `cp -r` idempotency bug: `cp -r source dest` where `dest` already exists would create `dest/source_name/` (nested) instead of overwriting. Fixed with `cp -r source/. dest/` pattern plus `mkdir -p dest` pre-creation.
- Replaced fixed `/tmp/pmos-env-local-backup` and `/tmp/pmos-config-backup` paths with `mktemp` — eliminates collision risk when two installs run concurrently.
- Both scripts pass `bash -n` syntax check.

**Validator hardening — FAZA 6**
- Fixed `src/lib/actions/conversations.ts`: `project` field was hardcoded as `'project'` placeholder. Now reads `pmosConfig.projectName` from `pmos.config.ts`. Affects ConversationArtifact records created via CIC integration.

**Documentation added**
- `STATUS-MATRIX.md` — 119-capability status grid (14 categories)
- `INTERNAL-RELEASE-NOTES.md` — operational notes for future PMOS developers
- `ENGINEERING-READINESS-REPORT.md` — engineering release review with 5 domains and risk assessment
- `TYPECHECK-REMEDIATION.md` — TypeScript error remediation documentation

---

### Added

**Bootstrap System**
- `APPLICATION-BOOTSTRAP-PROMPT.md` — Canonical 9-phase bootstrap engine for all new project types. Supports Greenfield and Existing Project modes. Includes mode detection, CIC conditionality, contamination guards, and a binary validation matrix (11 checks).
- `VSC-BOOTSTRAP-PROMPT.md` — Reactive analysis prompt for existing projects. Reads codebase, generates project-specific PMOS data without manual input configuration.
- Dual bootstrap path documented in README.md and INSTALL.md — Application Bootstrap (recommended) and Reactive Analysis.

**Runtime Core**
- PMOS Next.js 14 App Router runtime (`apps/pmos/`)
- 11 REST API routes: `/api/context`, `/api/conversations`, `/api/decisions`, `/api/logs`, `/api/principles`, `/api/prompts`, `/api/roadmap`, `/api/search`, `/api/templates`, `/api/timeline`, `/api/warnings`
- Hierarchical roadmap with `RoadmapNode` (ETAPs + sub-nodes, parentId tree)
- Context API: `GET /api/context/active` — single endpoint returning full project state for AI injection
- Global full-text search across 8 entity types: `GET /api/search?q=`

**UI Layer**
- Runtime dashboard with ETAP tree view
- Principles browser
- Warnings register
- Decisions (ADR) browser with reasoning chain
- Execution Logs viewer with ChangedFile detail
- AI Prompt Execution history
- Conversation Memory browser with 6 cross-link junction table support
- Timeline view — unified chronological feed across all entity types
- Global keyboard search (Cmd+K)
- Dark / light theme with ThemeProvider + anti-flash inline script
- RuntimeFocusBar — active ETAP display in app header

**Data Model**
- `RoadmapNode` — hierarchical execution tree
- `CanonicalPrinciple` — architecture rules
- `ArchitectureWarning` — risk register
- `Decision` — ADR records with reasoning and impact
- `ExecutionLog` — implementation session records with ChangedFile links
- `PromptExecution` — AI session records with blocker/next-step tracking
- `ChangedFile` — file-level impact records linked to logs and prompts
- `ConversationArtifact` — persistent AI conversation memory with 6 cross-link junctions (roadmap nodes, principles, warnings, decisions, logs, prompts)
- Tag system — 15 starter tags for entity categorization

**Governance Infrastructure**
- `.pmos/` directory structure: `conversations/`, `governance/decisions/`, `governance/findings/`, `governance/principles/`, `governance/warnings/`
- `.context/runtime-context.md` — AI injection artifact (auto-generated, not manually edited)

**Context Lifecycle**
- `scripts/build-pmos-context.ts` — context builder that reads PMOS API and generates `runtime-context.md`
- Context refresh workflow documented: rebuild after each significant session
- GitHub Copilot: automatic injection via `.context/` directory
- Claude: manual attachment workflow documented

**Documentation**
- `README.md` — overview, quick start, stack table, bootstrap flow diagram
- `INSTALL.md` — 8-step complete install guide with troubleshooting
- `PMOS-ARCHITECTURE.md` — full architecture description, data model, API reference
- `PMOS-PHILOSOPHY.md` — conceptual foundation (added in this release)
- `RELEASE-AUDIT.md` — complete pre-release audit with 24 findings
- `RELEASE-CHECKLIST.md` — binary pass/fail release checklist
- `CHANGELOG.md` — this file
- `VERSIONING.md` — semantic versioning strategy
- `UPDATE-STRATEGY.md` — safe upgrade path documentation
- `KNOWN-LIMITATIONS.md` — honest limitation register

**Install Infrastructure**
- `scripts/install-pmos.sh` — 7-step install script (hardened in this release)
- `scripts/validate-pmos-install.sh` — post-install validator (added in this release)

**Schema & Seed**
- `prisma/schema.prisma` — complete 8-entity + tag schema with all junction tables
- `prisma/seed.ts` — generic starter seed: 15 tags, 5 principles, 5 ETAPs, 2 warnings, 1 execution log
- `apps/pmos/pmos.config.ts` — project configuration file with full JSDoc

---

### Changed

**Bootstrap Documentation**
- README.md "Bootstrap Your Project" section expanded from single-path (VSC-BOOTSTRAP-PROMPT only) to dual-path with Application Bootstrap Flow diagram
- INSTALL.md Step 8 replaced: from single VSC-BOOTSTRAP-PROMPT mention to full dual-path guide with option comparison, step-by-step instructions, and mode selection table
- Install script Step 6 summary updated to reference both bootstrap paths

**Layout**
- `apps/pmos/src/app/layout.tsx` rewritten: added ThemeProvider, RuntimeFocusBar, anti-flash `<script>`, `suppressHydrationWarning`, `export const dynamic = 'force-dynamic'`, Inter font with optical sizing

**Install Script**
- Added `APPLICATION-BOOTSTRAP-PROMPT.md` to copied docs (Step 3) — AUDIT-001 fix
- Added Node/npm pre-flight validation — AUDIT-002 fix
- Added trap-based error diagnostics — AUDIT-003 fix
- Added `.gitkeep` file creation in `.pmos/` subdirectories — AUDIT-004 fix
- Updated Step 7 summary to reference both bootstrap paths — AUDIT-011 fix
- Added port conflict detection warning — AUDIT-017 partial

**Environment**
- `.env.example` — removed Sentry/PostHog references (contamination from Leaxaro runtime)
- `.env.example` — added clear comments distinguishing `DATABASE_URL` (pooled) from `DIRECT_URL` (direct) for Neon

---

### Fixed

- **`.env.example` contamination**: Sentry and PostHog references from Leaxaro runtime were present in the template. Removed. Template is now clean.
- **`.DS_Store` in template**: macOS metadata file removed from `apps/pmos/` template directory.
- **layout.tsx `className="dark"` on `<html>`**: Replaced with `suppressHydrationWarning` and anti-flash inline script for proper theme initialization.
- **`tsconfig.json` missing**: Was absent from template, breaking `@/` path aliases in all imports. Copied from Leaxaro runtime.
- **`.gitignore` missing**: Standard Next.js .gitignore was absent from template. Added.

---

### Architecture

**Data Flow**:
```
Project codebase → [AI session] → PMOS REST API → PostgreSQL
PostgreSQL → PMOS Context API → build-pmos-context.ts → runtime-context.md
runtime-context.md → AI assistant (Copilot / Claude)
```

**Governance Flow**:
```
bootstrap prompt → Principles + Warnings + ADRs in PMOS
PMOS context → AI reads governance before any implementation
Implementation → ExecutionLog + ChangedFile records
Session end → context:build → runtime-context.md updated
```

---

### Bootstrap System

The bootstrap system now has two distinct components:

| Component | Purpose | Mode |
|---|---|---|
| `APPLICATION-BOOTSTRAP-PROMPT.md` | Design-first or analyze-first full project bootstrap | Greenfield + Existing |
| `VSC-BOOTSTRAP-PROMPT.md` | Reactive codebase analysis and PMOS population | Existing only |

Both are AI-executable — no custom tooling required beyond a running PMOS instance.

---

### Governance

- `.pmos/` directory structure established and version-controlled via `.gitkeep` files
- Governance lifecycle documented in VERSIONING.md and UPDATE-STRATEGY.md
- ADR lineage preservation rules defined in UPDATE-STRATEGY.md

---

### Runtime

- PMOS runs standalone as a Next.js app — no Turborepo required
- All pages use `export const dynamic = 'force-dynamic'` — no static generation
- ThemeProvider and RuntimeFocusBar are mandatory layout components
- Port default: 3200 (configurable via `package.json` dev script)

---

### Known Limitations (v0.1.0)

See [KNOWN-LIMITATIONS.md](./KNOWN-LIMITATIONS.md) for the complete list. Key items:

- No PMOS API authentication (AUDIT-008)
- Next.js 14.2.29 has 2 known CVEs (AUDIT-023) — upgrade to Next.js 15 planned for v0.2
- No automated schema migration path (AUDIT-021)
- `context:build` relative path assumption (AUDIT-005) — fix in v0.1.1
- No health check endpoint (AUDIT-007) — add in v0.1.1
- Generic seed data coexists with project data after bootstrap (AUDIT-006)

---

## [Unreleased — v0.1.1]

Planned fixes from AUDIT findings:

- [ ] Add `/api/health` route — AUDIT-007
- [ ] Fix `context:build` path fragility — AUDIT-005  
- [ ] Add `db:seed:fresh` script — AUDIT-006
- [ ] Add `pmos.config.ts` default name warning in context builder — AUDIT-009
- [ ] Add `/api/changed-files` route — AUDIT-015
- [ ] Document `/api/templates` route or remove — AUDIT-016
- [ ] Add port conflict detection — AUDIT-017
- [ ] CIC Phase graceful degradation — AUDIT-018

---

## [Unreleased — v0.2.0]

Planned for v0.2:

- [ ] Next.js 15 upgrade
- [ ] Optional `PMOS_API_TOKEN` authentication
- [ ] `next.config.ts` migration (from `.mjs`)
- [ ] Schema migration strategy implementation
- [ ] Multi-user conflict documentation and soft protections
