# PMOS — Update Strategy
## How to update PMOS Starter-Kit without breaking your project

---

## Guiding Principle

PMOS contains your project's memory. Updating PMOS must never destroy:

- **Roadmap** (the ETAP structure is your project history)
- **Governance** (principles and warnings reflect decisions made with intent)
- **Conversations** (the AI session record cannot be reconstructed)
- **Decisions / ADRs** (the reasoning chain is irreplaceable)
- **Warnings** (active risks that are not resolved)
- **Runtime context** (the generated AI injection file)
- **ADR lineage** (decisions that reference other decisions)
- **Custom project logic** (any code added to PMOS beyond the starter template)

An update that silently destroys any of the above is not an update — it is data loss.

---

## Safe Update Principles

**PRINCIPLE 1 — Back up before anything.**  
Before any update: export the current database state. `pg_dump` or Neon database branching. No exceptions.

**PRINCIPLE 2 — Schema changes are one-way.**  
Never apply a schema migration without reading the migration SQL first. Never apply in production without testing in staging first.

**PRINCIPLE 3 — PMOS data takes precedence over template data.**  
When updating PMOS files, project-specific data in the database is more important than any template file. Template updates are additive — they do not replace data.

**PRINCIPLE 4 — Update incrementally.**  
Do not jump from v0.1.0 to v1.0.0 directly. Apply intermediate versions in sequence. Each version's changelog describes the delta.

**PRINCIPLE 5 — Validate after every update.**  
Run `validate-pmos-install.sh` after every update. Do not accept "should be fine" — verify.

**PRINCIPLE 6 — The runtime context is ephemeral.**  
`runtime-context.md` is generated from live PMOS data. It is never the source of truth. Never back it up as if it were — back up the database instead.

**PRINCIPLE 7 — ADR lineage is permanent.**  
Never delete a `Decision` record. Mark it as `superseded` with a reference to the new decision. The chain of reasoning must remain readable.

**PRINCIPLE 8 — Custom code is yours.**  
Any code added to `apps/pmos/src/` beyond the starter template is project-specific. Template updates will not touch it. You are responsible for merging updates into custom code.

---

## Update Procedure by Change Type

---

### A. Schema Migrations

**When**: A MINOR or MAJOR version updates the database schema.

**Indicators**: CHANGELOG contains entries under "Database / Schema".

> **Note on migration tooling**: PMOS uses `prisma db push` for schema management (not `prisma migrate dev`). This is because `migrate dev` requires a shadow database, which is not available on the Neon free tier. The `db push` approach is used for both initial setup and schema updates. See KNOWN-LIMITATIONS.md §3 and §12.

**Procedure**:

```bash
# 1. Back up current database
#    Neon: create a branch in the Neon dashboard (instant, zero-downtime)
#    Self-hosted: pg_dump "$DATABASE_URL" > pmos-backup-$(date +%Y%m%d).sql

# 2. Pull updated schema.prisma from updated Starter-Kit
# (copy carefully — do NOT overwrite any custom model additions)

# 3. Review the diff before applying
diff apps/pmos/prisma/schema.prisma /path/to/updated-starter/apps/pmos/prisma/schema.prisma
# Verify: no model removed, no required field removed, only additive changes

# 4. Apply schema (db push — works on all providers including Neon free tier)
cd apps/pmos
npx prisma db push

# 5. Regenerate Prisma client
npx prisma generate

# 6. Verify
npx prisma studio   # visual check: confirm tables and data intact
curl http://localhost:3200/api/context/active | head -c 200
```

**If using a provider that supports shadow databases** (self-hosted Postgres, Supabase, Neon paid tier):
```bash
# Alternative: generate a proper migration file for audit trail
npx prisma migrate dev --name "v0.2-schema-update"
# Review migration.sql before applying
npx prisma migrate deploy
```

**If migration fails**: restore from backup. Do not attempt to force-push a broken schema.

**What NOT to do**:
- Do not run `prisma migrate reset` — this drops all data
- Do not run `prisma db push --force-reset` — this drops all data
- Do not add new `NOT NULL` columns without a default value or data migration

---

### B. UI Upgrades

**When**: PMOS UI components, pages, or layouts are updated in a new version.

**Indicators**: CHANGELOG entries in "UI" section. New pages, changed component interfaces.

**Procedure**:

```bash
# 1. Identify which files changed (read the CHANGELOG carefully)

# 2. For changed system files (layout.tsx, ThemeProvider, RuntimeFocusBar):
#    Copy from updated Starter-Kit, overwrite your copy
cp path/to/updated-starter/apps/pmos/src/app/layout.tsx apps/pmos/src/app/layout.tsx

# 3. For new pages:
#    Copy the new page directory from updated Starter-Kit
cp -r path/to/updated-starter/apps/pmos/src/app/new-page apps/pmos/src/app/new-page

# 4. For modified pages that you have NOT customized:
#    Safe to overwrite

# 5. For modified pages that you HAVE customized:
#    Manual merge required — diff the files and apply changes by hand

# 6. Typecheck
npm run typecheck

# 7. Build
npm run build
```

**Key files that are safe to always overwrite** (no project-specific content):
- `src/app/layout.tsx`
- `src/components/theme-provider.tsx`
- `src/components/runtime-focus-bar.tsx`
- `src/app/api/**` (all API routes — unless you added custom endpoints)
- `tailwind.config.ts`
- `next.config.mjs`

**Key files that may contain project-specific content** (review before overwriting):
- `pmos.config.ts` (your project settings — never overwrite blindly)
- `prisma/seed.ts` (may contain project-specific seed)
- Any files in `src/` that you added beyond the starter template

---

### C. Bootstrap Prompt Upgrades

**When**: `APPLICATION-BOOTSTRAP-PROMPT.md` is updated in a new Starter-Kit version.

**What changes in the prompt**:
- Phase engine logic improvements
- New validation rules
- New contamination guards
- Updated API call formats
- New optional INPUT BLOCK fields

**Procedure**:

```bash
# 1. Copy the new prompt file to your project
cp path/to/updated-starter/APPLICATION-BOOTSTRAP-PROMPT.md docs/APPLICATION-BOOTSTRAP-PROMPT.md

# 2. Migrate your filled PROJECT INPUT BLOCK to the new format
#    (if the INPUT BLOCK format changed — check CHANGELOG "Bootstrap System" section)
#    Open the old prompt, copy your filled values
#    Open the new prompt, fill in the corresponding new fields

# 3. You do NOT need to re-run the bootstrap prompt unless you want to refresh your PMOS data
#    The prompt upgrade is for future bootstrap runs, not retroactive
```

**Backward compatibility rule**: If the prompt version changes from `Version: 1.0` to `Version: 2.0`, the INPUT BLOCK format may have changed. Your existing filled prompt (if saved) must be migrated to the new format before reuse.

**What does NOT require a re-run**:
- Prompt phase logic improvements (your data is already in PMOS)
- New contamination guards (retroactively irrelevant)
- New output artifact types (will be added on next run)

**What DOES require a re-run** (optional, not mandatory):
- New INPUT BLOCK fields that you want to use (e.g. CIC inputs added in a new version)
- New governance artifacts that require fresh generation
- Major architecture changes to your project that obsolete the current PMOS state

---

### D. API Evolution

**When**: REST API routes are added, changed, or deprecated.

**Guarantee**: MINOR version updates will NEVER remove existing routes. Routes may be added. Response shapes may have new optional fields (old clients ignore them).

**MAJOR version updates** may deprecate routes. A deprecation notice will appear in the CHANGELOG under "Deprecated". The route remains functional for one MAJOR version after deprecation notice, then is removed.

**Procedure for API updates**:
```bash
# 1. Read the CHANGELOG "Changed" section for API entries
# 2. If new optional fields were added to responses: no action needed
# 3. If new routes were added: no action needed (they're additive)
# 4. If a route was deprecated: update any AI prompts or scripts that use it
#    before the next MAJOR version removes it
```

**Custom API routes**: If you added routes to `apps/pmos/src/app/api/`, they will never be touched by template updates. You are responsible for maintaining them if they depend on data models that change.

---

### E. Runtime Context Evolution

**When**: The format of `runtime-context.md` changes.

**What changes between versions**:
- New sections added (MINOR — AI tools ignore unknown sections)
- Existing section content format changed (PATCH — same sections, different data)
- Sections renamed or removed (MAJOR — requires AI prompt updates)

**Procedure**:
```bash
# After any PMOS update: rebuild the context
npm run context:build

# The new context format is applied immediately
# GitHub Copilot picks it up automatically
# Claude: re-attach the updated file to your project
```

**Custom context consumers**: If you have scripts or AI prompts that parse `runtime-context.md` by section name, verify they still work after a MINOR update that adds sections.

---

## Roadmap Data Preservation

Your roadmap (ETAPs + sub-nodes) is the historical record of your project. During any update:

**Never run**:
- `prisma migrate reset` (drops all data including your roadmap)
- `prisma db push --force-reset` (same)
- Custom DELETE statements against the `RoadmapNode` table

**Safe operations**:
- Adding new ETAP nodes (always additive)
- Changing status of existing nodes (normal workflow)
- Adding sub-nodes to existing ETAPs
- Updating descriptions

**If you need to clean seed data**: Use the PMOS UI to delete individual seed nodes, or run a targeted script that deletes only records created by the seed (identifiable by seed-specific titles like "ETAP 1 — Foundation").

---

## Governance Preservation

**Principles**: Never delete. Mark as `deprecated: true` if no longer applicable.  
**Warnings**: Resolve via the UI when addressed. The record persists as resolved.  
**Decisions (ADRs)**: Never delete. Link superseding decisions via the `impact` field.

If a principle conflicts with a new approach: create a new principle and reference the old one. The lineage is part of the governance record.

---

## Conversation Memory Preservation

`ConversationArtifact` records are the most irreplaceable PMOS data. They cannot be reconstructed from any other source.

**Before any major schema migration**: verify that `ConversationArtifact` table and all 6 junction tables are not affected.

**Junction tables** (must survive all MINOR updates):
- `ConversationArtifactOnRoadmapNode`
- `ConversationArtifactOnPrinciple`
- `ConversationArtifactOnWarning`
- `ConversationArtifactOnDecision`
- `ConversationArtifactOnLog`
- `ConversationArtifactOnPrompt`

---

## Emergency Rollback

If an update breaks PMOS:

```bash
# 1. Stop PMOS
# (kill the dev process or stop the deployment)

# 2. Restore database from backup
psql "$DATABASE_URL" < pmos-backup-YYYYMMDD.sql

# 3. Restore the previous app/pmos/ files from git
git checkout HEAD~1 -- apps/pmos/

# 4. Reinstall dependencies
cd apps/pmos && npm install

# 5. Restart
npm run dev

# 6. Verify
curl http://localhost:3200/api/context/active
```

If no git history is available, restore from the previous Starter-Kit version and re-apply your custom code changes manually.

---

## Update Schedule Recommendation

| Frequency | Action |
|---|---|
| Every PATCH | Apply within 1 week of release (low risk, fixes bugs) |
| Every MINOR | Apply within 1 sprint of release (read changelog, test in dev first) |
| Every MAJOR | Plan a dedicated migration session (back up, test, validate fully) |
| Never | Apply an untested update to a PMOS with production project data |
