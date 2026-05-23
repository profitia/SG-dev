# MAINTAINABILITY-RISKS.md

## PMOS Starter Kit — Maintainability Risk Register

**Version:** v0.1.0-release-candidate  
**Purpose:** Honest catalog of maintenance risks, technical debt, and operational hazards for future PMOS developers and contributors.

This is not a bug list. These are known trade-offs, future maintenance triggers, and areas requiring discipline to keep stable.

---

## RISK-001 — Prisma Type Stub is Schema-Coupled

**Severity:** Medium  
**Area:** `src/generated/prisma/index.d.ts`

**Description:**  
The Prisma type stub is a manually maintained approximation of the generated Prisma client types. It was created to allow `tsc --noEmit` to pass in the source template before `prisma generate` is run.

**Risk:** Every schema change (new model, new field, new enum value) must be reflected in the stub OR the stub may produce false TypeScript confidence. If a field is added to the schema but not the stub, TypeScript will not catch accesses to that field.

**Trigger:** Any `prisma/schema.prisma` change.

**Mitigation:**
1. The stub is overwritten by `prisma generate` after install — so post-install, this risk disappears.
2. In CI: `npm run build` runs `prisma generate && next build`, overwriting the stub.
3. For template source maintenance: update the stub whenever schema.prisma changes.

**Risk horizon:** Until the template switches to a pre-built binary client in the distribution bundle.

---

## RISK-002 — Install Script Overwrites All App Source Files

**Severity:** Medium  
**Area:** `scripts/install-pmos.sh`

**Description:**  
The install script (`cp -r apps/pmos/. target/apps/pmos/`) copies all template files into the target project, overwriting anything that exists. Only `.env.local` and `pmos.config.ts` are explicitly preserved.

**Risk:** Any other customized file in `apps/pmos/` (e.g., custom page components, modified API routes, custom seed data) is silently overwritten on re-install.

**Trigger:** Running `install-pmos.sh` on a project where PMOS is already installed and customized.

**Mitigation:**
1. Document this clearly in `UPDATE-STRATEGY.md` — already done.
2. The warning printed during install ("Other files will be overwritten") is visible to the user.
3. For future versions: consider a `--update-only-scripts` flag that skips app/ and only updates scripts + docs.

---

## RISK-003 — Enum Values Not Validated in Server Actions

**Severity:** Low (internal tool only)  
**Area:** `src/lib/actions/*.ts`

**Description:**  
Server actions that accept enum fields (`severity`, `type`, `conversationType`, etc.) use `as never` or `as any` type casts instead of runtime enum validation. Any string value that passes HTML form validation is accepted and written to the database.

**Example:**  
```typescript
severity: severity as never  // accepts 'extreme', 'ultra', anything
```

**Risk:** If malformed data enters the database (e.g., `severity: 'unknown'`), Prisma queries that filter on that field may return unexpected results. PostgreSQL enum columns would reject invalid values at the DB level, but PostgreSQL enum support via Prisma may silently stringify.

**Trigger:** Any form submission with non-standard enum values. Low risk since PMOS is used by developers who control the forms.

**Mitigation:** For v0.2.0, add Zod validation in server actions. Current mitigation: HTML `<select>` elements with hardcoded valid options prevent casual invalid submissions.

---

## RISK-004 — `project` Field Resolved at Import Time

**Severity:** Low  
**Area:** `src/lib/actions/conversations.ts`

**Description:**  
`pmosConfig.projectName` is imported at module load time. If `pmos.config.ts` is changed during a running dev server, the old project name remains in memory until the server restarts.

**Risk:** During initial setup, if a user runs the dev server before editing `pmos.config.ts`, conversation artifacts are created with `projectName: 'My Project'` and cannot be retroactively updated.

**Trigger:** Creating ConversationArtifacts before customizing `pmos.config.ts`.

**Mitigation:** Documented in `KNOWN-LIMITATIONS.md` (planned). Low real-world impact since the bootstrap prompt is always run after config customization.

---

## RISK-005 — `build-pmos-context.ts` Hardcodes Localhost Port

**Severity:** Low  
**Area:** `scripts/build-pmos-context.ts`

**Description:**  
The context builder script calls `http://localhost:3200` (hardcoded). If the PMOS port is changed in `pmos.config.ts`, the context builder will fail to connect.

**Trigger:** Changing `port: 3200` in `pmos.config.ts` without also updating the context builder script.

**Mitigation:** Use `pmos.config.ts` port value in the context builder. Deferred to v0.1.1.

---

## RISK-006 — JetBrains Mono Not Loaded in Layout

**Severity:** Cosmetic  
**Area:** `tailwind.config.ts`, `src/app/layout.tsx`

**Description:**  
`tailwind.config.ts` defines `mono: ['JetBrains Mono', 'Fira Code', 'monospace']`. Only Inter is loaded in `layout.tsx` via Google Fonts. Code elements that use `font-mono` class will fall back to Fira Code (if installed locally) or system monospace.

**Risk:** Inconsistent monospace rendering across user machines.

**Trigger:** No trigger — cosmetic only.

**Mitigation:** For v0.1.1, add JetBrains Mono to the Google Fonts link in layout.tsx.

---

## RISK-007 — Validator Checks `node_modules` Existence Not Content

**Severity:** Low  
**Area:** `scripts/validate-pmos-install.sh`

**Description:**  
`check_dir "$PMOS_DIR/node_modules"` only checks that the directory exists, not that dependencies were properly installed. A partially failed `npm install` may leave `node_modules/` in place.

**Trigger:** Failed npm install that left `node_modules/` directory behind.

**Mitigation:** For v0.1.1, check for a specific sentinel file like `node_modules/.package-lock.json` or verify Prisma CLI availability (already done as a separate check).

---

## RISK-008 — `next-env.d.ts` Not in Version Control

**Severity:** Low  
**Area:** `apps/pmos/.gitignore`, `apps/pmos/tsconfig.json`

**Description:**  
`next-env.d.ts` is in `.gitignore` (correct per Next.js convention) but `tsconfig.json` includes it in the `include` array. The missing file causes a TypeScript warning on fresh installs before `next dev` is run.

The `src/types/css.d.ts` file was added in the RC hardening pass to provide the essential CSS module declarations that `next-env.d.ts` would otherwise provide.

**Risk:** If `next-env.d.ts` contains additional type declarations (e.g., for future Next.js features), `src/types/css.d.ts` may become out of date.

**Trigger:** Next.js major version upgrade.

**Mitigation:** After any Next.js major version upgrade, review `next-env.d.ts` generated content and update `src/types/css.d.ts` if needed.

---

## RISK-009 — Context Builder Requires Running PMOS Server

**Severity:** Operational  
**Area:** `scripts/build-pmos-context.ts`, `npm run context:build`

**Description:**  
The context builder fetches data from `http://localhost:3200/api/*`. This means PMOS must be running for the context build to succeed. If a developer runs `npm run context:build` without first starting the dev server, it silently fails or produces an empty file.

**Risk:** Empty or stale `runtime-context.md` → AI assistant has no PMOS context → poor code generation quality.

**Trigger:** Running context:build without active dev server.

**Mitigation:** Document in `INSTALL.md` and bootstrap prompt. The validator script warns if PMOS is not running.

---

## RISK-010 — Single Executable Architecture (No Queue, No Workers)

**Severity:** Architectural (by design)  
**Area:** Entire runtime

**Description:**  
PMOS runs as a single Next.js process with direct database calls. There is no queue, no worker process, no background job system. All operations are synchronous within request/response cycles.

**Risk:** If the Neon database becomes slow or unavailable, the PMOS UI becomes unresponsive. No retry, no circuit breaker, no graceful degradation.

**Trigger:** Database latency spike or Neon cold start.

**Mitigation:** Acceptable for v0.1.0 — PMOS is a developer tool used infrequently. For v0.2.0, consider adding a `?timeout=5000` abort signal to all database queries.

---

## Summary Table

| Risk | Area | Severity | Trigger | Status |
|---|---|---|---|---|
| RISK-001 | Prisma stub schema coupling | Medium | schema.prisma changes | Accepted for v0.1.0 |
| RISK-002 | Install overwrites customized files | Medium | Re-install | Documented |
| RISK-003 | No enum validation in actions | Low | Malformed form data | Accepted for v0.1.0 |
| RISK-004 | project field resolved at import | Low | Early conversation creation | Accepted |
| RISK-005 | Context builder hardcodes port | Low | Port change | Deferred v0.1.1 |
| RISK-006 | JetBrains Mono not loaded | Cosmetic | Always | Deferred v0.1.1 |
| RISK-007 | Validator checks dir not content | Low | Failed npm install | Deferred v0.1.1 |
| RISK-008 | next-env.d.ts not in VCS | Low | Next.js major upgrade | Accepted |
| RISK-009 | Context builder needs live server | Operational | No dev server running | Documented |
| RISK-010 | Single-process, no queue | Architectural | DB latency | By design, accepted |
