# STABILITY-GUIDE.md

## PMOS Starter Kit — Operational Stability Guide

**Version:** v0.1.0-release-candidate  
**Audience:** Developers embedding PMOS into a project and maintaining it long-term.

This guide covers what to watch, what breaks, how to recover, and how to keep PMOS stable across project lifecycle events.

---

## 1. Bootstrap Stability

### First Run
The most fragile point in PMOS's lifecycle is the initial bootstrap. Follow the order strictly:

```
1. Configure .env.local     → DATABASE_URL + DIRECT_URL from Neon
2. npm run db:generate      → generate Prisma client (creates src/generated/prisma/)
3. npm run db:push          → push schema to database
4. npm run db:seed          → seed starter data
5. npm run dev              → start PMOS on :3200
6. Run bootstrap prompt     → populate roadmap, principles, warnings
```

**Do not skip step 2.** Without `db:generate`, the runtime crashes immediately — the JavaScript client does not exist (only the TypeScript type stub is present in the template source).

**Do not run step 5 before step 3.** The database must have the schema before seeding.

---

## 2. After Schema Changes

If `prisma/schema.prisma` is modified:

```bash
cd apps/pmos

# 1. Regenerate client (required after any schema change)
npm run db:generate

# 2. Push schema to database (no shadow DB required — no migrate dev)
npm run db:push

# 3. Update the Prisma stub if working on the source template
# apps/pmos/src/generated/prisma/index.d.ts — add any new models/fields/enums

# 4. Verify typecheck still passes
npm run typecheck
```

**Why `db:push` not `db:migrate`?**  
Neon free tier does not provide a shadow database, which is required for `prisma migrate dev`. Use `db:push` for schema iteration. Use `prisma migrate dev` only if you have a paid Neon account with shadow database access.

---

## 3. Dependency Stability

PMOS pins its core dependencies loosely (`^5.22.0` for Prisma, `14.2.29` for Next.js). The most stability-sensitive dependency is Prisma.

### Prisma version pinning
The generated Prisma client is version-coupled to the `prisma` and `@prisma/client` devDependency. These must stay in sync:
- `prisma` (devDependency) — CLI used for `generate`, `push`, `migrate`
- `@prisma/client` (dependency) — runtime client imported in `db.ts`

**If one is upgraded without the other, the runtime will fail at startup.**

Safe upgrade procedure:
```bash
npm install prisma@X.Y.Z @prisma/client@X.Y.Z --save-exact
npm run db:generate
npm run typecheck
npm run build
```

---

## 4. Database Stability (Neon)

### Neon cold starts
Neon free-tier databases go to sleep after inactivity. The first request after a cold start may take 5-15 seconds. PMOS does not currently retry on timeout.

**Symptom:** First page load after inactivity is slow or returns a 500 error.  
**Resolution:** Reload the page. The database will be awake on subsequent requests.

### Connection pooling
`DATABASE_URL` must use Neon's pooled connection string (with `-pooler` in the hostname). The `DIRECT_URL` uses the non-pooled connection string.

If both point to the same URL (pooled), `prisma db push` and `prisma migrate` may fail with "cannot create shadow database" or "prepared statement already exists" errors.

### Rotated credentials
If Neon credentials are rotated:
1. Update `DATABASE_URL` and `DIRECT_URL` in `apps/pmos/.env.local`
2. Restart the dev server
3. Run `npm run db:push` to verify connectivity

---

## 5. Context Builder Stability

`npm run context:build` fetches from `http://localhost:3200/api/*` and writes `apps/pmos/.context/runtime-context.md`.

**Prerequisites:**
- PMOS dev server must be running on port 3200
- Database must be seeded/populated (empty database produces minimal context)

**Failure modes:**
- Dev server not running → fetch fails → empty context file or stale file preserved
- Database empty → context file generated but contains no meaningful data

**When to rebuild context:**
- After each significant work session (new ETAPs, decisions, warnings added)
- After running the Application Bootstrap Prompt (populates all entities)
- After schema changes and re-seeding

---

## 6. Theme System Stability

The dark/light theme is managed by `ThemeProvider` and an anti-flash inline script in `layout.tsx`.

**If the theme flickers on load:**  
The `localStorage.getItem('pmos-theme')` call in the inline `<script>` runs before React hydration. If the key doesn't exist, it defaults to `'dark'`. If `ThemeProvider`'s `useEffect` disagrees, a flash can occur.

**Resolution:** Clear `localStorage.getItem('pmos-theme')` in the browser console and reload. The default ('dark') will be applied cleanly.

**If CSS variables are missing:**  
All colors use CSS custom properties (`var(--bg-base)`, etc.). If `globals.css` doesn't load, the entire UI renders without color (transparent/white).

**Resolution:** Verify `globals.css` is imported in `layout.tsx` (first import, before any component imports).

---

## 7. TypeScript Stability

**The type stub at `src/generated/prisma/index.d.ts` is overwritten by `prisma generate`.** After running `db:generate`, the stub is replaced by the real generated client.

If `npm run typecheck` suddenly produces new errors after a `prisma generate`:
1. The real generated client has stricter types than the stub
2. Check what changed: new required fields, renamed types, changed enum values
3. Fix any call sites that assumed stub-level types

**TypeScript baseline:** `npm run typecheck` must always return 0 errors before committing changes.

---

## 8. Install Script Stability

### Idempotency
`install-pmos.sh` is designed to be run multiple times (update installs). On re-run:
- `.env.local` is preserved
- `pmos.config.ts` is preserved (if customized)
- All other source files are overwritten

**Do not assume custom files in `apps/pmos/` survive an update install.** Only `.env.local` and `pmos.config.ts` are explicitly protected.

### Port conflict
If port 3200 is in use, change in two places:
1. `pmos.config.ts` → `port: XXXX` (used by context builder)
2. `apps/pmos/package.json` → `"dev": "next dev --port XXXX"` and `"start": "next start --port XXXX"`

The install script will warn if port 3200 is in use at install time.

---

## 9. Validator Usage

Run the post-install validator to confirm system state:

```bash
bash scripts/validate-pmos-install.sh [target-project-root]
```

**Expected output on a clean install (before database setup):**
- REQUIRED FILES: all PASS
- REQUIRED DIRECTORIES: all PASS
- ENVIRONMENT: `.env.local` exists PASS, DATABASE_URL set PASS
- PMOS CONFIG: projectName is default WARN (expected — not yet customized)
- PRISMA: may be WARN if `prisma generate` not yet run
- TYPECHECK: PASS (should always pass with stub in place)
- BUILD: PASS (if `prisma generate` has been run)
- API ROUTES: WARN (PMOS not running) — expected pre-launch

**Any `[FAIL]` in REQUIRED FILES or REQUIRED DIRECTORIES indicates a broken install.** Re-run `install-pmos.sh`.

---

## 10. Long-Term Maintenance Events

| Event | Required Action |
|---|---|
| Next.js major version upgrade | Review `next-env.d.ts` output, update `src/types/css.d.ts`; check `dynamic` export API |
| Prisma major version upgrade | Sync `prisma` + `@prisma/client` versions; regenerate stub; retest typecheck |
| Neon credential rotation | Update `.env.local`; verify `db:push` connects |
| Schema model addition | Update `prisma/schema.prisma` → `db:push` → `db:generate`; update stub if maintaining template |
| New page added to PMOS | Add `export const dynamic = 'force-dynamic'` (no exceptions) |
| New server action added | Use `'use server'` directive; validate required fields; no `as never` casts for enums |
| Port change | Update both `pmos.config.ts` and `package.json` scripts |
| Domain list change | Update `pmos.config.ts` → restart dev server → rebuild context |
