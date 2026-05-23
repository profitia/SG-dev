# PMOS — Known Limitations
## Version: v0.1.0

This document describes the real limitations of the PMOS Starter-Kit.  
It is not a marketing document. It is not an apology. It is an honest engineering inventory.

If a limitation affects your use case, plan around it or wait for the version that addresses it.

---

## 1. No API Authentication

**What it is**: The PMOS REST API has no authentication layer. Any process that can reach `http://localhost:{pmosPort}` can read and write all PMOS data — roadmap, principles, warnings, decisions, conversations, everything.

**Impact**:
- On a shared machine or CI/CD environment: unintended writes from other processes are possible
- In a team setting where multiple developers share a PMOS instance: any team member (or any tool running on their machine) can overwrite data
- In a cloud deployment (if PMOS is exposed beyond localhost): all data is publicly readable and writable

**Current state**: By design for v0.1.0 — PMOS is intended for local, single-user use. Authentication adds complexity that conflicts with frictionless AI tool integration (most AI assistants cannot pass auth tokens without additional configuration).

**Target fix**: v0.2.0 — optional `PMOS_API_TOKEN` environment variable for write operations. Reads remain open.

---

## 2. No Rollback for Bootstrap Operations

**What it is**: When `APPLICATION-BOOTSTRAP-PROMPT.md` runs and creates data in PMOS (roadmap nodes, principles, warnings, ADRs), there is no undo. If the bootstrap creates incorrect data (wrong ETAP titles, wrong architecture, wrong principles), the only recovery is manual deletion via the UI or database.

**Impact**:
- If a user makes errors in the PROJECT INPUT BLOCK and notices mid-bootstrap, cleanup is manual
- If the AI executes bootstrap incorrectly (e.g. wrong mode detection), partial data remains
- Idempotency rules prevent most duplicates on re-run, but orphaned data from failed runs accumulates

**Current state**: Accepted for v0.1.0. The bootstrap prompt's idempotency rules mitigate the duplicate creation risk, but not the cleanup burden.

**Target fix**: v0.2.0 — Bootstrap creates records with a `bootstrapRunId` tag. A single DELETE query can remove all records from a specific run.

---

## 3. No Automated Schema Migrations

**What it is**: PMOS uses `prisma db push` to apply schema changes. This approach does not maintain a migration history and can be destructive if not used carefully.

**Impact**:
- Upgrading PMOS to a new version with schema changes requires manual steps (see UPDATE-STRATEGY.md)
- If a schema push fails partway through, the database may be in an inconsistent state
- No migration history means there is no record of when schema changes were applied
- `prisma migrate reset` — which some developers run when they get confused — drops all data

**Current state**: Chosen for v0.1.0 because PMOS targets Neon PostgreSQL, which has a free tier that does not support shadow databases (required by `prisma migrate dev`). `db push` is simpler and works on all providers.

**Target fix**: v0.2.0 — Generate proper migration files for all schema changes. Document provider-specific migration procedures.

---

## 4. `context:build` Relative Path Assumption

**What it is**: The `context:build` script in `apps/pmos/package.json` uses a relative path: `tsx ../../scripts/build-pmos-context.ts`. This assumes PMOS is installed exactly two directory levels below the project root (i.e., `project-root/apps/pmos`).

**Impact**:
- If PMOS is installed at a different depth (e.g., `project-root/pmos`), the script fails with "file not found"
- If `scripts/` is not at project root, the script fails
- CI/CD environments that run the script from a different working directory will fail

**Current state**: AUDIT-005. Documented but not fixed in v0.1.0.

**Workaround**: Set `"context:build"` in package.json to use an absolute path or `$npm_config_local_prefix`.

**Target fix**: v0.1.1 — Use `__dirname`-based resolution in the context builder script.

---

## 5. No Health Check Endpoint

**What it is**: There is no `/api/health` endpoint. The only way to verify PMOS is running is to call `/api/context/active`, which requires a working database connection. If the database is misconfigured, both endpoints fail — making it impossible to distinguish "PMOS is not running" from "PMOS is running but database is broken".

**Impact**:
- The install validator cannot liveness-check PMOS independently of the database
- `APPLICATION-BOOTSTRAP-PROMPT.md` Phase 1 uses `/api/context/active` as a health proxy — if the DB is down, the bootstrap cannot even start
- Debugging startup failures is harder without a lightweight endpoint

**Target fix**: v0.1.1 — Add `GET /api/health` returning `{ status: 'ok', version: '...', timestamp: ... }` without DB dependency.

---

## 6. Generic Seed Data Coexists with Project Data

**What it is**: After `npm run db:seed`, PMOS contains 5 generic ETAPs ("ETAP 1 — Foundation" etc.), 5 generic principles ("Runtime-first", "Event-driven" etc.), and 2 generic warnings. After the bootstrap prompt runs, project-specific data is added. Both coexist in the PMOS UI.

**Impact**:
- Dashboard is cluttered with both generic starter data and real project data
- AI bootstrap output may reference generic seed nodes
- There is no documented, automated way to remove only the seed data (without risking removal of real data)

**Current state**: AUDIT-006. The seed data is intended as scaffolding — not real project content. But the lack of a clear removal path is a gap.

**Workaround**: Use the PMOS UI to manually delete generic seed nodes, or identify them by their specific titles and delete via Prisma Studio.

**Target fix**: v0.1.1 — Add `npm run db:seed:fresh` script. **This script does not currently exist.** Until v0.1.1, the manual workaround above is the only option.

---

## 7. Single-User Only

**What it is**: PMOS is designed for a single developer or a single AI session at a time. There is no concurrency control, optimistic locking, or conflict resolution.

**Impact**:
- If two AI sessions write to PMOS simultaneously, writes can overwrite each other
- If two developers share one PMOS instance, roadmap edits from one may conflict with the other's session
- No event sourcing or CRDT — last write wins

**Current state**: By design for v0.1.0. PMOS is a personal development memory tool, not a collaborative platform.

**Target fix**: Multi-user support is not planned for v0.2.0. Document clearly that PMOS is per-developer-per-project. If team use is required, each developer should run their own PMOS instance against a separate database.

---

## 8. Next.js 14 Known CVEs

**What it is**: PMOS uses Next.js 14.2.29. As of v0.1.0, this version has 2 known security findings (`npm audit`: 1 moderate, 1 high). These are in the Next.js server runtime.

**Impact**:
- CVEs apply to public-facing deployments of Next.js. Since PMOS is intended for localhost-only use, the direct exploit surface is minimal.
- If PMOS is exposed publicly (e.g., on a VPS), the CVEs become relevant.

**Current state**: Not fixed in v0.1.0. Upgrade to Next.js 15 is required to resolve.

**Target fix**: v0.2.0 — Upgrade to Next.js 15. This is a MINOR version bump for PMOS (Next.js 15 is additive for App Router).

---

## 9. Runtime Context Assumes Specific Directory Layout

**What it is**: GitHub Copilot reads `.context/` relative to the workspace root. PMOS generates the context file at `apps/pmos/.context/runtime-context.md`. This is two levels below the workspace root — not at the root level.

**Impact**:
- GitHub Copilot may not automatically pick up the context file depending on how the workspace is configured
- Claude requires manual attachment — automatic injection does not happen
- If the project has a monorepo with a non-standard workspace structure, Copilot's `.context/` resolution may not find the file

**Current state**: Documented but not resolved. Users must configure their Copilot workspace to include the `.context/` directory.

**Workaround**: Add a symbolic link from `./context/` (project root) to `apps/pmos/.context/`. Or copy the generated file to `./context/runtime-context.md` in a post-build step.

---

## 10. CIC Integration Requires Manual Package Presence

**What it is**: When `hasCIC: true` is set in the bootstrap prompt, Phase 6 attempts to reference `cicPackagePath`. If this path does not exist in the workspace, the phase creates a warning but cannot validate or integrate with the actual CIC package.

**Impact**:
- CIC-related principles and ADRs are created based on user-declared values only — no actual CIC code is read
- If `cicPackagePath` is wrong or missing, the warning is created but the CIC integration is only cosmetic
- There is no validation that the declared `conversationTypes` actually exist in the CIC package

**Current state**: Acceptable for v0.1.0. CIC integration via the bootstrap prompt is declarative — it documents intent, not implementation.

---

## 11. Roadmap Status Has No Enforcement

**What it is**: Roadmap nodes have a `status` field (`backlog`, `in_progress`, `done`). Nothing prevents multiple nodes from having `status: in_progress` simultaneously. The bootstrap prompt rules against this, but the API itself does not enforce it.

**Impact**:
- The runtime context may show multiple active ETAPs, confusing the AI
- The `RuntimeFocusBar` picks the first `in_progress` node — if multiple exist, the displayed node is non-deterministic

**Target fix**: v0.2.0 — Add a database constraint or API-level validation that enforces at most 1 `in_progress` node per tree level.

---

## 12. No Prisma Migration History

**What it is**: PMOS uses `prisma db push` instead of `prisma migrate dev`. This means no SQL migration files are generated and stored. The only record of schema evolution is CHANGELOG.md and VERSIONING.md.

**Impact**:
- Cannot audit when schema changes were applied
- Cannot safely rollback a schema change without a full database restore
- Cannot replay migrations in a fresh environment without re-running `db push` against the current schema

**Current state**: Accepted for v0.1.0 (Neon free tier does not support shadow databases). See VERSIONING.md §5 for migration philosophy.

---

## 13. Seed Data Is Not Tagged as Seed

**What it is**: Records created by `prisma/seed.ts` are not marked as seed data in the database. They look identical to real project data. You cannot distinguish "ETAPs created by seed" from "ETAPs created by the bootstrap prompt" without checking the content of the title.

**Impact**:
- Automated cleanup is not possible without pattern-matching on titles (fragile)
- Reporting on "how many ETAPs did this project generate?" will include seed ETAPs

**Target fix**: v0.1.1 — Add a `source` or `isSeed` flag to records created by seed.ts.

---

## 14. No Automated Update Mechanism

**What it is**: There is no `pmos update` command or script. Updating PMOS requires manual file replacement following the procedures in UPDATE-STRATEGY.md. There is no mechanism to detect that a newer version of the Starter-Kit is available.

**Impact**:
- Projects using PMOS will stay on the installed version until the developer manually checks for updates
- Security patches (e.g., Next.js CVE fixes) will not propagate automatically

**Current state**: By design for v0.1.0. PMOS is a local file-system runtime, not a package dependency. Auto-update of a running system's source files is out of scope for this version.

**Target fix**: v0.3.0 — Consider an `npm update @pmos/app` package-based distribution model.

---

## Summary Table

| # | Limitation | Severity | Target Fix |
|---|---|---|---|
| 1 | No API authentication | HIGH | v0.2.0 |
| 2 | No rollback for bootstrap | MEDIUM | v0.2.0 |
| 3 | No automated schema migrations | MEDIUM | v0.2.0 |
| 4 | `context:build` path assumption | MEDIUM | v0.1.1 |
| 5 | No health check endpoint | MEDIUM | v0.1.1 |
| 6 | Generic seed coexists with project data | MEDIUM | v0.1.1 |
| 7 | Single-user only | LOW (by design) | Not planned |
| 8 | Next.js 14 CVEs | LOW (localhost) | v0.2.0 |
| 9 | Context file directory assumption | LOW | v0.2.0 |
| 10 | CIC integration is declarative only | LOW (by design) | v0.3.0 |
| 11 | No `in_progress` uniqueness enforcement | LOW | v0.2.0 |
| 12 | No Prisma migration history | LOW (by design) | v0.2.0 |
| 13 | Seed data not tagged | LOW | v0.1.1 |
| 14 | No automated update mechanism | LOW (by design) | v0.3.0 |
