# PMOS Starter-Kit — Internal Release Notes
## Version: v0.1.0-rc
## Audience: Future PMOS developers and maintainers

---

> This document is not a changelog. It is not user-facing documentation.
> It is operational notes for the next person working on PMOS internals.
> Read this before making any structural changes.

---

## 1. Current Architecture Maturity

PMOS v0.1.0-rc is a **functional prototype with stable core mechanics and fragile peripheral systems**. The core data model, API surface, and bootstrap engine are stable. The peripheral systems — governance file artifacts, context injection, update tooling — are working but not robustly validated.

The most reliable parts of the system (in descending order):
1. The database schema and Prisma models
2. The REST API routes (`/api/roadmap`, `/api/principles`, `/api/warnings`, `/api/decisions`, `/api/logs`, `/api/prompts`, `/api/conversations`)
3. The bootstrap engine (`APPLICATION-BOOTSTRAP-PROMPT.md`) — its rules are well-specified
4. The install script (`install-pmos.sh`)
5. The UI (basic but working)
6. The context builder script
7. The validator (`validate-pmos-install.sh`) — works but live API checks require PMOS to be running

The least reliable parts:
1. CIC integration — declarative only, no code validation
2. ADR supersession chain — no UI or API enforcement
3. Warning resolution workflow — status field exists, no audit trail
4. `context:build` path resolution — fragile relative path assumption

---

## 2. What Is Stable and Should Not Be Casually Refactored

### Database Schema (`prisma/schema.prisma`)

The schema is the source of truth for all PMOS data. It has 23 models and is well-structured.

**Do not**:
- Remove or rename any model without a migration strategy and changelog entry
- Change the `status` enum values on `RoadmapNode` without updating every place that references them (API, UI, bootstrap prompt)
- Add `NOT NULL` columns without defaults — this breaks `db push` on existing databases
- Change the `ConversationArtifact` junction table structure — it's used by the bootstrap engine's CIC phase and by the conversation memory browser

**Safe to change**:
- Add new optional fields (nullable or with defaults)
- Add new models entirely
- Add new junction tables

### REST API Routes

The API routes are consumed by the bootstrap engine. The bootstrap engine's HTTP calls are hardcoded in its prompt. If you change API response shapes, the bootstrap engine will produce incorrect or failing calls.

**Do not**:
- Change the URL structure of existing routes (e.g., `/api/roadmap` → `/api/etaps`)
- Remove fields from response objects that the bootstrap prompt depends on
- Change HTTP status codes for success responses (201 for creates, 200 for reads)
- Add required request body fields to existing POST endpoints

**Safe to change**:
- Add new optional response fields
- Add new routes
- Add query parameter filters to existing GET routes

### APPLICATION-BOOTSTRAP-PROMPT.md

The bootstrap prompt is a production artifact, not just documentation. It is executed by AI assistants. Its rules, validation checks, and API call formats are behavioral specifications.

**Do not**:
- Remove phases (breaks the phase gate sequence)
- Change the `PROJECT INPUT BLOCK` YAML field names (existing filled prompts break)
- Change the Phase Gate Report format without updating all references to it
- Remove the anti-pattern rules in Section 8 (they prevent real failure modes)
- Remove the contamination guards

**Safe to change**:
- Add optional fields to the `PROJECT INPUT BLOCK`
- Add sub-tasks within a phase
- Add new phases (numbered after Phase 9, or as named sub-phases)
- Improve phrasing without changing semantics
- Add examples to existing instructions

---

## 3. What Is Fragile and Requires Care

### `context:build` script path resolution

The context builder is invoked as `tsx ../../scripts/build-pmos-context.ts` from `apps/pmos/`. This assumes the script is exactly two directories above `apps/pmos/`. If PMOS is ever installed at a different depth, this breaks silently (file not found error).

**When to fix**: Before any public release. This is AUDIT-005, deferred to v0.1.1.

**How to fix**: Replace the relative path with `__dirname`-based resolution in the npm script, or use `$npm_config_local_prefix` to find the project root.

### ADR Supersession Chain

The `Decision` model has a `supersededBy` field (foreign key to another Decision). The intent is governance lineage: when a decision is replaced, the old decision points to the new one.

**Current state**: The field exists in the schema. It is not displayed in the UI. The API does not validate that supersededBy references a real Decision ID. There is no UI workflow for marking a decision as superseded.

**Risk**: Users can accidentally delete decisions they intended to mark as superseded. The governance lineage principle ("never delete decisions") is documented but not enforced.

**When to fix**: v0.2.0. Requires UI changes (supersession workflow) and API validation.

### Warning Resolution Workflow

`ArchitectureWarning` has a `status` field but no `resolvedAt`, `resolvedBy`, or `resolutionNote` fields. This means:
- You cannot audit when a warning was resolved
- You cannot record why it was resolved
- The resolved state looks identical to the unresolved state in terms of data richness

**Risk**: Resolved warnings provide no governance evidence. The warning being resolved is as weak as the warning being deleted.

### Idempotency in the Bootstrap Engine

The bootstrap engine checks for duplicates via `GET /api/search?q=[title]`. This is a text search, not an exact match. If a search returns partial matches (e.g., searching for "Auth" returns "Auth Layer" and "Auth Domain" and "Auth Middleware"), the bootstrap engine may incorrectly conclude the entity exists and skip creation.

**Risk**: On re-run, the engine may not detect actual duplicates (prefix mismatch) or may detect false duplicates (substring match). This is an inherent limitation of the text search approach.

**Mitigation**: The PMOS `/api/search` endpoint should ideally support `exact=true` mode for bootstrap idempotency checks. This is unimplemented.

### `.pmos/` Governance File Artifacts

The `install-pmos.sh` script creates the `.pmos/` directory structure with `.gitkeep` files. The bootstrap engine's `governanceModel: strict` mode generates ADR files in `.pmos/governance/decisions/`. However:
- This only happens in `strict` mode (most users use `standard`)
- The file format in the bootstrap prompt is a template; actual file creation depends on AI execution
- No validation that files are actually created in strict mode

**Risk**: Users in `strict` mode may think governance files are created, but if the AI skips the file creation step, no error is raised.

---

## 4. What Should NOT Be Refactored Casually

### The UI Component Structure

The PMOS UI is functional but not architecturally elegant. It uses Server Components for most pages, with minimal client components. The ThemeProvider and RuntimeFocusBar are in `layout.tsx` and affect every page.

**Do not refactor** unless:
- You've verified the build passes after changes
- You've confirmed that `force-dynamic` is on all pages that use auth-sensitive or request-scoped data
- You understand that the `RuntimeFocusBar` fetches from `/api/context/active` on every page load — changing that route affects the entire UI

### The Seed Data (`prisma/seed.ts`)

The seed creates data with specific titles ("ETAP 1 — Foundation", "Runtime-first", etc.). The bootstrap engine's idempotency checks look for these exact titles to detect pre-existing seed data.

**Do not change seed titles** without updating the bootstrap engine's Section 3.3 idempotency rules. If the seed titles change, the bootstrap engine will not recognize them as seed data and may create duplicates alongside them.

### The `pmos.config.ts` Default Value `'My Project'`

The install script uses `grep -q "projectName: 'My Project'"` to detect an uncustomized `pmos.config.ts`. The Phase 1 bootstrap validation checks for `projectName ≠ "My Project"`. The validator warns if it detects the default.

**Do not change the default string** in `pmos.config.ts` without updating all three references.

---

## 5. Biggest Architectural Risks

**Risk 1 — No API authentication**  
Severity: HIGH (for non-localhost deployments)  
Any process that reaches port 3200 can read and write all PMOS data. If PMOS is ever exposed beyond localhost (Docker with port mapping, ngrok tunnel, cloud deploy), all data is publicly accessible.  
Target: v0.2.0 — optional `PMOS_API_TOKEN`.

**Risk 2 — Bootstrap engine idempotency via text search**  
Severity: MEDIUM  
The idempotency model is "search before create." If the search misses an existing entity (different wording, different prefix), duplicate data is created. If the search over-matches, real data creation is skipped.  
Target: v0.2.0 — add exact-match search parameter to `/api/search`.

**Risk 3 — `context:build` path fragility**  
Severity: MEDIUM  
The relative path assumption in the context builder breaks if PMOS is not installed at exactly `apps/pmos/`. This is a silent failure for developers who install PMOS at a custom path.  
Target: v0.1.1.

**Risk 4 — Generic seed data coexists with project data permanently**  
Severity: LOW-MEDIUM  
The 5 generic seed ETAPs and 5 generic principles stay in the database after bootstrap unless manually deleted. There is no automated cleanup. The bootstrap engine creates project-specific data alongside the seed data.  
Target: v0.1.1 — `db:seed:fresh` script.

**Risk 5 — Next.js 14 CVEs**  
Severity: LOW (localhost), MEDIUM (cloud)  
Two known CVEs in the Next.js version used. Mitigated by localhost-only intended deployment. Unmitigated for any cloud exposure.  
Target: v0.2.0 — upgrade to Next.js 15.

---

## 6. Bootstrap Assumptions

The bootstrap engine assumes:

1. **PMOS is running before the prompt is pasted.** Phase 1 health-checks via HTTP. If PMOS is not running, Phase 1 fails with a clear halt message. This is correct behavior, but users who paste the prompt without starting PMOS first will hit this immediately.

2. **The AI assistant has filesystem access.** `EXISTING PROJECT MODE` requires reading workspace files. Without filesystem access (e.g., in a basic chat interface), the AI cannot perform Phase 2 codebase analysis. The prompt does not degrade gracefully — it will proceed with assumptions if it cannot read files.

3. **The AI will execute all API calls as specified.** The bootstrap engine's API call templates use `{variable}` substitution. The AI is expected to substitute actual values before calling. Some AI models may be less reliable at this than others. Claude (Sonnet, Opus) and Copilot Agent mode have been tested. Other models are untested.

4. **The `PROJECT INPUT BLOCK` values are honest.** If `currentState: greenfield` is set but the project has substantial existing code, Phase 2 will design architecture without reading the codebase. The result is a PMOS bootstrap that doesn't reflect reality.

5. **Idempotency check responses are correctly interpreted.** If `/api/search` returns a 200 with an empty array, the entity doesn't exist. If it returns a 200 with results, the entity may already exist. The AI must correctly distinguish empty vs. non-empty arrays.

---

## 7. Governance Assumptions

The governance system assumes:

1. **Decisions are never deleted.** The `PRINCIPLE 7` in UPDATE-STRATEGY.md and the "Additive, not destructive" principle in PMOS-PHILOSOPHY.md both state this. The database does not enforce it. An admin with database access can DELETE a Decision record. The system has no tombstoning or soft-delete mechanism.

2. **Principle priority reflects real architectural weight.** Principles are tagged `high`, `medium`, `low`. There is no enforcement mechanism — the AI is expected to respect high-priority principles, but PMOS has no way to verify this.

3. **Governance lineage is maintained manually.** When a decision is superseded, the user is expected to manually mark the old decision's `supersededBy` field. There is no automated lineage tracking. If users don't do this, the lineage chain breaks.

4. **Warnings remain visible until explicitly resolved.** Active warnings show up in the `/api/context/active` response and in the context file. If a warning is resolved without updating its status, it continues to appear as active to the AI.

---

## 8. Runtime Context Assumptions

The context builder assumes:

1. **PMOS is running at `localhost:{pmosPort}` when context:build executes.** The script fetches live data from the API. If PMOS is not running, the build fails or produces an empty/stale context.

2. **The context file is ephemeral.** `runtime-context.md` should never be the source of truth. If it is edited manually, those edits will be overwritten on the next context:build. This is by design.

3. **GitHub Copilot reads `.context/` relative to the workspace root.** If the workspace root is the project root (not `apps/pmos/`), Copilot may not automatically find the file at `apps/pmos/.context/runtime-context.md`. Workspace configuration may need adjustment.

4. **The context file is rebuilt after significant sessions.** This is not automated. If developers forget to rebuild, the AI will operate with stale context. Stale context is better than no context — but it degrades over time.

---

## 9. Expected Next Refactors (Priority Order)

The following refactors are expected and safe to do. They are listed in priority order.

### v0.1.1 (patch)

1. **Fix `context:build` path** — switch from relative path to `__dirname`-based or `$npm_config_local_prefix`-based resolution. Low risk, high impact for non-standard installs.

2. **Add `/api/health`** — a simple endpoint that returns `{status:'ok', version:'...', ts:'...'}` without DB dependency. Used by the validator and the bootstrap engine as a cleaner liveness check.

3. **Add `db:seed:fresh` npm script** — delete records where title matches known seed patterns, then re-seed. Allows clean re-bootstrapping after testing.

4. **Add `isSeed` field to RoadmapNode, CanonicalPrinciple, ArchitectureWarning** — enables programmatic distinction between seed data and project data.

### v0.2.0 (minor)

5. **Upgrade to Next.js 15** — resolve CVEs, adopt streaming support if useful for PMOS use cases. Should be backward-compatible for App Router.

6. **Add `PMOS_API_TOKEN` to write routes** — optional environment variable; when set, POST/PUT/DELETE routes require `Authorization: Bearer` header. Read routes remain open.

7. **Add `resolvedAt` and `resolutionNote` to ArchitectureWarning** — enable proper warning resolution audit trail.

8. **Add supersession UI to Decision management** — workflow for marking a decision as superseded with a reference to the replacement decision.

9. **Add exact-match search to `/api/search`** — `?exact=true` parameter for bootstrap idempotency checks.

10. **Resolve TypeScript `implicit any` in route handlers** — add explicit return types to all `.map()`, `.filter()`, `.reduce()` callbacks in API routes and pages.

### v0.3.0 (distribution prep)

11. **npm package distribution** — evaluate `@pmos/app` npm package model vs. Starter-Kit model. Starter-Kit model is simpler for v0.x; npm package makes updates easier for v1.x.

12. **Automated context rebuild trigger** — post-git-commit hook that runs `context:build` if PMOS is running. Reduces the manual rebuild burden.

---

## 10. Safe Zone: What You Can Change Without Breaking Things

- Any documentation file (README.md, INSTALL.md, PMOS-ARCHITECTURE.md, PMOS-PHILOSOPHY.md, KNOWN-LIMITATIONS.md, VERSIONING.md, UPDATE-STRATEGY.md)
- The `.pmos/` directory contents (these are project-specific governance files)
- The `pmos.config.ts` defaults (but update the install script and validator if you change the default `projectName` string)
- The UI layout and styling (Tailwind classes, color scheme, page structure) — as long as you keep `force-dynamic`, ThemeProvider, and RuntimeFocusBar in layout.tsx
- The seed data content — but update bootstrap engine idempotency rules if you change seed titles
- The validator script — it's additive and doesn't affect production behavior
- Any new API routes — adding new routes is safe

---

*These notes reflect the state of PMOS v0.1.0-rc as of 2026-05-18. Update this document when the architectural assumptions or risks change.*
