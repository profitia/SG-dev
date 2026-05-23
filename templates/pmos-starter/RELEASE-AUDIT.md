# PMOS Starter-Kit — Release Audit
## Version: v0.1.0-release-candidate
## Date: 2026-05-18
## Auditor: Release Preparation Pass

---

## Audit Scope

| Lifecycle | Audited |
|---|---|
| Template completeness | ✅ |
| Bootstrap lifecycle | ✅ |
| Install lifecycle | ✅ |
| Runtime lifecycle | ✅ |
| PMOS continuity lifecycle | ✅ |
| CIC conditionality | ✅ |
| DB lifecycle | ✅ |
| Governance lifecycle | ✅ |
| Context lifecycle | ✅ |

---

## CRITICAL Issues (must fix before release)

---

### AUDIT-001 — APPLICATION-BOOTSTRAP-PROMPT.md Not Copied by Install Script

**Severity**: CRITICAL  
**Impact**: The primary bootstrap engine is unreachable after install. Users are pointed to `docs/VSC-BOOTSTRAP-PROMPT.md` only. `APPLICATION-BOOTSTRAP-PROMPT.md` exists in the Starter-Kit root but is never copied to the target project.  
**Lifecycle**: Install lifecycle / Bootstrap lifecycle  
**Location**: `scripts/install-pmos.sh` Step 3  
**Fix-now**: YES

**Recommendation**: Add copy of `APPLICATION-BOOTSTRAP-PROMPT.md` to Step 3. Copy to `docs/APPLICATION-BOOTSTRAP-PROMPT.md` in target project. Also update Step 7 summary to mention it.

---

### AUDIT-002 — Install Script: No Node/npm Version Validation

**Severity**: CRITICAL  
**Impact**: Install proceeds silently on Node 16, 18, or npm < 8. PMOS requires Node 20+ and npm 10+. Failure surfaces later (during `npm install` or `npm run build`) with cryptic errors rather than a clear prerequisite message.  
**Lifecycle**: Install lifecycle  
**Location**: `scripts/install-pmos.sh` (missing pre-flight)  
**Fix-now**: YES

**Recommendation**: Add pre-flight check block at the top of the install script that verifies Node ≥20 and npm ≥10 and exits with a clear message if not met.

---

### AUDIT-003 — Install Script: No Rollback on Failure

**Severity**: CRITICAL  
**Impact**: `set -e` halts the script on any error, but leaves the target directory in a partial state (e.g., `apps/pmos/` partially copied, `npm install` incomplete, `.pmos/` directories half-created). Re-running the script may fail because files already exist.  
**Lifecycle**: Install lifecycle  
**Location**: `scripts/install-pmos.sh`  
**Fix-now**: YES

**Recommendation**: Add a `trap` handler that logs the partial state and advises the user how to clean up before re-running. Do not auto-delete target files (destructive) — just emit a clear diagnostic message.

---

### AUDIT-004 — `.pmos/` Directory `.gitkeep` Files Missing

**Severity**: CRITICAL  
**Impact**: `.pmos/` sub-directories (`conversations/`, `governance/decisions/`, etc.) are created by the install script but contain no `.gitkeep` files. Git does not track empty directories. After `git add .`, the governance directory structure is lost. Projects that commit after install will lose the `.pmos/` skeleton.  
**Lifecycle**: Install lifecycle / Governance lifecycle  
**Location**: `scripts/install-pmos.sh` Step 6; `templates/pmos-starter/apps/pmos/.pmos/`  
**Fix-now**: YES

**Recommendation**: The `.pmos/` directories in the template already have `.gitkeep` files. The install script must explicitly copy or create `.gitkeep` files in each subdirectory when bootstrapping from scratch (not using `cp -r`). Alternatively, `cp -r $STARTER_DIR/apps/pmos/.pmos "$TARGET_DIR/apps/pmos/.pmos"` instead of `mkdir -p`.

---

### AUDIT-005 — `context:build` Script Path Is Fragile

**Severity**: CRITICAL  
**Impact**: `"context:build": "tsx ../../scripts/build-pmos-context.ts"` in `apps/pmos/package.json` uses a relative path that assumes `apps/pmos` is exactly two levels below the project root. This breaks if PMOS is installed at a different depth or if `scripts/` is not at project root.  
**Lifecycle**: Context lifecycle / Runtime lifecycle  
**Location**: `apps/pmos/package.json` `scripts.context:build`  
**Fix-now**: YES

**Recommendation**: Use `$npm_config_local_prefix` or an absolute path derived from `__dirname` inside the script. Alternatively, document the assumption explicitly and validate it during install. Short term: add a `--check-path` step to the install script that verifies the relative path resolves correctly.

---

## HIGH Issues (should fix before release)

---

### AUDIT-006 — Generic Seed Data Has No Clear Replacement Path

**Severity**: HIGH  
**Impact**: After `db:seed`, PMOS contains 5 generic ETAPs (titled "ETAP 1 — Foundation" etc.), 5 generic principles ("Runtime-first", "Event-driven", etc.), and 2 generic warnings. After `APPLICATION-BOOTSTRAP-PROMPT.md` runs, project-specific data is added alongside the generic data. The PMOS UI shows both. There is no documented, safe way to purge the generic seed after bootstrap.  
**Lifecycle**: DB lifecycle / Bootstrap lifecycle  
**Location**: `prisma/seed.ts`, install docs  
**Fix-now**: Recommended

**Recommendation**: Add a `db:seed:fresh` script that resets seed data (only seed-origin records, identifiable by a flag/tag). Document in INSTALL.md that seed data is starter scaffolding, not production data — and how to remove it once project-specific data is in place.

---

### AUDIT-007 — No Health Check API Route

**Severity**: HIGH  
**Impact**: No `/api/health` endpoint exists. The `APPLICATION-BOOTSTRAP-PROMPT.md` Phase 1 instructs the AI to call `GET /api/context/active` to verify PMOS is running — but this endpoint requires DB access and may return a 500 if the DB is not yet configured. There is no lightweight liveness check that the install validator or AI can use.  
**Lifecycle**: Runtime lifecycle / Bootstrap lifecycle  
**Location**: `apps/pmos/src/app/api/`  
**Fix-now**: Recommended

**Recommendation**: Add `GET /api/health` → returns `{ status: 'ok', version: '0.1.0', timestamp: ... }` without DB dependency. Use this in the install validator and bootstrap prompt.

---

### AUDIT-008 — No PMOS Authentication / Authorization

**Severity**: HIGH  
**Impact**: The PMOS API has no authentication. Any process with network access to `localhost:{pmosPort}` can read or write all data including principles, warnings, roadmap, ADRs. On a team machine or CI environment, this is an uncontrolled attack surface.  
**Lifecycle**: Runtime lifecycle  
**Location**: `apps/pmos/src/app/api/`  
**Fix-now**: Fix-later (v0.2)

**Recommendation**: Document this limitation explicitly in `KNOWN-LIMITATIONS.md`. For v0.2: add optional `PMOS_API_TOKEN` environment variable — all write operations require it. Reads remain open (AI tools need read access without auth headers in most setups).

---

### AUDIT-009 — `pmos.config.ts` Defaults Not Validated at Runtime

**Severity**: HIGH  
**Impact**: `pmos.config.ts` ships with `projectName: 'My Project'`. If the user forgets to edit it, the runtime context file (`runtime-context.md`) contains "My Project" as the project name. The AI will use this name, causing confusion. Nothing validates or warns about the default value.  
**Lifecycle**: Runtime lifecycle / Context lifecycle  
**Location**: `apps/pmos/pmos.config.ts`, `scripts/build-pmos-context.ts`  
**Fix-now**: Recommended

**Recommendation**: In `build-pmos-context.ts`, add a startup check: if `pmosConfig.projectName === 'My Project'`, emit a warning to stderr: `[PMOS WARN] projectName is still set to default 'My Project'. Edit pmos.config.ts before using this context file.` Do not block — just warn.

---

### AUDIT-010 — `.DS_Store` in Template Directory

**Severity**: HIGH  
**Impact**: `/templates/pmos-starter/apps/pmos/.DS_Store` will be copied into every target project via `cp -r`. macOS metadata file. Harmless but polluting — will appear in git status of target projects.  
**Lifecycle**: Template completeness  
**Location**: `templates/pmos-starter/apps/pmos/.DS_Store`  
**Fix-now**: YES

**Recommendation**: Delete the file. Add `**/.DS_Store` to `templates/pmos-starter/apps/pmos/.gitignore` (it's likely already there — verify).

---

### AUDIT-011 — Install Step 7 Summary References Only VSC-BOOTSTRAP-PROMPT

**Severity**: HIGH  
**Impact**: The post-install summary (Step 7, the "Next steps" printout) says "Use VSC-BOOTSTRAP-PROMPT to customize for your project." It does not mention `APPLICATION-BOOTSTRAP-PROMPT.md`. A user who follows only the terminal output will miss the primary bootstrap engine.  
**Lifecycle**: Install lifecycle / Bootstrap lifecycle  
**Location**: `scripts/install-pmos.sh` Step 7  
**Fix-now**: YES (coupled with AUDIT-001)

**Recommendation**: Update Step 7 summary to list both bootstrap paths: `APPLICATION-BOOTSTRAP-PROMPT.md` (recommended, full bootstrap) and `VSC-BOOTSTRAP-PROMPT.md` (reactive analysis for existing projects).

---

### AUDIT-012 — `DIRECT_URL` Semantics Underdocumented

**Severity**: HIGH  
**Impact**: `.env.example` shows `DATABASE_URL` and `DIRECT_URL` as identical values. For Neon, `DATABASE_URL` should use the pooled connection string and `DIRECT_URL` the non-pooled (direct) string. Using identical values causes Prisma Migrate operations to use the pooler — which can fail on DDL statements that require a direct connection.  
**Lifecycle**: DB lifecycle  
**Location**: `apps/pmos/.env.example`, INSTALL.md  
**Fix-now**: Recommended

**Recommendation**: Update `.env.example` comments to explain the difference. Add a note in INSTALL.md Step 4 explaining that for Neon: `DATABASE_URL` = pooled connection (connection pooler endpoint), `DIRECT_URL` = direct connection (serverless endpoint). Both are available on the Neon dashboard.

---

## MEDIUM Issues (fix in v0.1.1 or document)

---

### AUDIT-013 — No Prisma Validation in Install Script

**Severity**: MEDIUM  
**Impact**: If `prisma` CLI is not available globally and `npm install` fails silently, subsequent `db:push` and `db:seed` calls fail without clear diagnostics.  
**Lifecycle**: Install lifecycle / DB lifecycle  
**Fix-now**: Fix-later

**Recommendation**: After `npm install`, add: `(cd "$TARGET_DIR/apps/pmos" && npx prisma --version)` and emit success/fail message.

---

### AUDIT-014 — `next.config.mjs` vs TypeScript Inconsistency

**Severity**: MEDIUM  
**Impact**: The rest of the codebase uses `.ts` files. `next.config.mjs` is a JavaScript ES module. This is minor but can cause confusion when users try to add TypeScript configuration and cannot use `import type` from Next.js types.  
**Lifecycle**: Runtime lifecycle  
**Fix-now**: Fix-later

**Recommendation**: Convert to `next.config.ts` in v0.2 when upgrading to Next.js 15.

---

### AUDIT-015 — `changed-files` API Route Missing

**Severity**: MEDIUM  
**Impact**: INSTALL.md and README.md mention a "Changed Files tracker" as a feature. There is no `/api/changed-files` route in `apps/pmos/src/app/api/`. The UI page may exist but lacks a dedicated REST route, making it inaccessible via the bootstrap prompt's API calls.  
**Lifecycle**: Runtime lifecycle  
**Location**: `apps/pmos/src/app/api/`  
**Fix-now**: Fix-later (v0.1.1)

**Recommendation**: Verify whether `ChangedFile` data is served via `/api/logs` (as nested data) or requires its own route. If own route is needed, add it. If served via logs, update documentation.

---

### AUDIT-016 — `templates/` API Route Undocumented

**Severity**: MEDIUM  
**Impact**: A `/api/templates` route exists but is not mentioned in PMOS-ARCHITECTURE.md, README.md, INSTALL.md, or the APPLICATION-BOOTSTRAP-PROMPT. Its purpose, schema, and lifecycle are unknown to users.  
**Lifecycle**: Runtime lifecycle  
**Fix-now**: Fix-later

**Recommendation**: Document the route in PMOS-ARCHITECTURE.md. If it is vestigial, remove it.

---

### AUDIT-017 — No Port Conflict Detection in Install Script

**Severity**: MEDIUM  
**Impact**: If port 3200 is already in use, `npm run dev` fails silently with a port-in-use error. The install script does not detect this condition and does not inform the user.  
**Lifecycle**: Install lifecycle / Runtime lifecycle  
**Fix-now**: Fix-later

**Recommendation**: Add a soft check at the end of install: `lsof -ti:3200 && echo "[WARN] Port 3200 appears to be in use. Edit package.json dev script and NEXT_PUBLIC_APP_URL if needed."` Non-blocking.

---

### AUDIT-018 — CIC Phase Has No Graceful Degradation

**Severity**: MEDIUM  
**Impact**: If `hasCIC: true` but CIC data is incomplete (e.g. `cicPackagePath` provided but missing, `memoryStrategy` empty), Phase 6 of `APPLICATION-BOOTSTRAP-PROMPT.md` halts and asks for guidance. There is no graceful degradation path — the AI cannot proceed to Phase 7 until CIC data is corrected. This creates a bootstrap deadlock for users who partially filled CIC inputs.  
**Lifecycle**: Bootstrap lifecycle / CIC conditionality  
**Fix-now**: Fix-later

**Recommendation**: Add a fallback rule in Phase 6: if `cicPackagePath` is missing but `hasCIC: true`, create only the ConversationArtifact and Memory ADR (skip path-dependent checks). Flag remaining CIC gaps as warnings instead of halting.

---

### AUDIT-019 — Context Builder Not Part of Install Script

**Severity**: MEDIUM  
**Impact**: The install script ends at Step 7 (summary). It does not offer to run `npm run context:build` even as an optional step. The first context file is only generated when the user manually runs it — potentially hours or days after install.  
**Lifecycle**: Context lifecycle / Install lifecycle  
**Fix-now**: Fix-later

**Recommendation**: Add Step 7 optional prompt: "Run context build now? (requires PMOS to be running)". Or add a note in the summary: "After starting PMOS and running the bootstrap prompt, run: npm run context:build".

---

### AUDIT-020 — No `api/tags` Route Exposed

**Severity**: MEDIUM  
**Impact**: Seed creates 15 tags. Tags are referenced in the data model and seed, but there is no `/api/tags` route to read or manage tags via the bootstrap prompt or external tools. Tag data is silently present but not accessible.  
**Lifecycle**: Runtime lifecycle  
**Fix-now**: Fix-later

**Recommendation**: Add `/api/tags` GET route or document that tags are internal only and not accessible via the REST API.

---

## LOW Issues (informational / v0.3+)

---

### AUDIT-021 — No Schema Migration Strategy

**Severity**: LOW  
**Impact**: When PMOS Starter-Kit is updated and the schema changes, existing projects using PMOS have no documented path for upgrading. `prisma db push` is destructive without backups. No migration history is maintained.  
**Lifecycle**: DB lifecycle  
**Fix-now**: Fix-later (VERSIONING.md + UPDATE-STRATEGY.md)

---

### AUDIT-022 — No Multi-User Support Documentation

**Severity**: LOW  
**Impact**: PMOS is designed for solo or small-team use. In multi-user environments, concurrent writes to the same PMOS instance from multiple AI sessions can produce conflicting data. This is not documented.  
**Lifecycle**: Runtime lifecycle  
**Fix-now**: Fix-later (KNOWN-LIMITATIONS.md)

---

### AUDIT-023 — Next.js 14.2.29 Known CVE

**Severity**: LOW (documented from smoke test)  
**Impact**: `npm audit` reports 1 moderate + 1 high severity finding in Next.js 14.2.29. Fixing requires upgrading to Next.js 15.  
**Lifecycle**: Runtime lifecycle  
**Fix-now**: Fix-later (v0.2 upgrade)

---

### AUDIT-024 — No Rollback for Bootstrap Prompt

**Severity**: LOW  
**Impact**: If the `APPLICATION-BOOTSTRAP-PROMPT.md` bootstrap fails mid-run (Phase 5 DB write fails), there is no mechanism to roll back partially created PMOS data. Re-running the prompt creates duplicates (mitigated by idempotency rules) but leaves orphan data.  
**Lifecycle**: Bootstrap lifecycle  
**Fix-now**: Fix-later

---

## Summary

| Severity | Count | Fix-Now | Fix-Later |
|---|---|---|---|
| CRITICAL | 5 | 5 | 0 |
| HIGH | 7 | 4 | 3 |
| MEDIUM | 8 | 0 | 8 |
| LOW | 4 | 0 | 4 |
| **Total** | **24** | **9** | **15** |

---

## Fix-Now Action Plan

| ID | Issue | Action |
|---|---|---|
| AUDIT-001 | APPLICATION-BOOTSTRAP-PROMPT.md not copied | Add to install script Step 3 |
| AUDIT-002 | No Node/npm validation | Add pre-flight block to install script |
| AUDIT-003 | No rollback on install failure | Add trap handler |
| AUDIT-004 | .pmos/ .gitkeep files missing | Add to install script Step 6 |
| AUDIT-005 | context:build path fragile | Add path validation note + install-time check |
| AUDIT-010 | .DS_Store in template | Delete + add to .gitignore |
| AUDIT-011 | Step 7 summary missing APPLICATION-BOOTSTRAP-PROMPT | Update install script summary |
| AUDIT-012 | DIRECT_URL underdocumented | Update .env.example comments |
| AUDIT-009 | Default pmos.config.ts not warned | Document in install + validator |
