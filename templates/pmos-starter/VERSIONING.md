# PMOS — Versioning Strategy
## Version: applies from v0.1.0

---

## 1. Semantic Versioning

PMOS Starter-Kit uses semantic versioning: `MAJOR.MINOR.PATCH[-pre-release]`

```
v0.1.0-release-candidate   ← current
v0.1.0                     ← first stable release
v0.1.1                     ← patch (bugfixes, AUDIT fixes)
v0.2.0                     ← minor (new capabilities, safe additions)
v1.0.0                     ← major (breaking changes, schema redesign)
```

---

## 2. What Each Level Means for PMOS

### MAJOR version (e.g. v1.0.0)

A MAJOR increment means **backward-incompatible changes** to one or more of:

- **Database schema**: tables removed, columns renamed, relationships restructured (requires migration)
- **REST API**: routes removed, response shapes changed incompatibly, HTTP methods changed
- **Bootstrap prompt**: the `PROJECT INPUT BLOCK` format changed in a way that breaks existing filled prompts
- **Context file format**: `runtime-context.md` structure changed in a way that breaks AI tool consumption
- **Runtime behavior**: PMOS fundamentally changes what it does (e.g. multi-tenant mode, auth required by default)

**MAJOR signals**: "You must do migration work before upgrade. Your existing PMOS data may need transformation."

Before a MAJOR release, a migration guide will be published in `docs/migration/`. No MAJOR release will be made without a tested, scripted migration path.

---

### MINOR version (e.g. v0.2.0)

A MINOR increment means **backward-compatible additions**:

- New API routes added
- New optional fields in existing endpoints (old clients see them as unknown, not errors)
- New UI pages or components
- New bootstrap prompt sections (as optional blocks, not breaking existing filled prompts)
- New schema models (new tables, no changes to existing tables)
- New optional `pmos.config.ts` fields
- Performance improvements that don't change behavior
- Next.js or Prisma version upgrades that don't change public API

**MINOR signals**: "You can upgrade safely. Existing data is preserved. Existing workflows continue to work."

---

### PATCH version (e.g. v0.1.1)

A PATCH increment means **bug fixes and small corrections**:

- Bug fixes in existing API routes
- Typo corrections in documentation or generated files
- Install script corrections
- Validator improvements
- New documentation that describes existing behavior
- `.gitignore` or environment config corrections
- Audit findings addressed that don't change public API

**PATCH signals**: "Low risk upgrade. No data changes required. No workflow changes."

---

## 3. Pre-Release Labels

| Label | Meaning |
|---|---|
| `-alpha.N` | Unstable. API may change. Not for production use. |
| `-beta.N` | Feature-complete but untested in real projects. May have known issues. |
| `-release-candidate` | Feature-frozen. Final validation in progress. No new features. |
| (no label) | Stable release. Validated, documented, safe for use. |

---

## 4. Compatibility Rules

### Schema Compatibility

| PMOS version | Schema | Compatible with |
|---|---|---|
| v0.1.x | schema-v0.1 | v0.1.0, v0.1.1, v0.1.2... |
| v0.2.x | schema-v0.2 | v0.2.0+ (migration from v0.1 required) |
| v1.0.x | schema-v1.0 | v1.0.0+ (migration from v0.x required) |

**Rule**: MINOR versions within the same MAJOR must be schema-compatible (additive only). PATCH versions must be schema-identical.

### Bootstrap Prompt Compatibility

`APPLICATION-BOOTSTRAP-PROMPT.md` is versioned independently within PMOS versioning:

| Bootstrap prompt version | Compatible PMOS API version |
|---|---|
| v1.0 (current) | v0.1.x, v0.2.x |
| v2.0 (future) | v0.2.x+ (if breaking INPUT BLOCK format changes) |

**Rule**: The prompt is compatible across MINOR versions as long as the API routes it calls remain present. MAJOR API changes that remove routes used by the prompt constitute a MAJOR prompt version bump.

The current prompt version is embedded in `APPLICATION-BOOTSTRAP-PROMPT.md` header: `Version: 1.0`.

### CIC Compatibility

PMOS-CIC bridge semantics (`ConversationArtifact`, conversation type taxonomy, memory strategy mapping) follow these rules:

- CIC-related schema fields are considered **stable** from v0.1.0
- New CIC conversation types can be added in MINOR releases (additive)
- Removing or renaming CIC enum values is a MAJOR change
- CIC memory strategy semantics documented in PMOS-PHILOSOPHY.md must remain valid across MINOR releases

### Runtime Context Compatibility

`runtime-context.md` generated format:

- **Section additions** are MINOR (new AI tools can consume them; old tools ignore unknown sections)
- **Section removals or renames** are MAJOR (breaks AI tool prompts that reference sections by name)
- **Within-section content changes** are PATCH (same structure, different data)

The context builder (`build-pmos-context.ts`) version is embedded in generated file headers. AI tools that consume the context should be resilient to section additions.

### Governance Compatibility

`.pmos/` file format (ADR files, principle files, warning files):

- File format follows Markdown with YAML-like header conventions
- Changes to required header fields are MAJOR
- Optional header field additions are MINOR
- Content formatting changes are PATCH

---

## 5. Schema Migration Philosophy

PMOS uses Prisma. Migrations follow these principles:

**Always-safe migrations** (can apply without downtime):
- Adding nullable columns with defaults
- Adding new tables
- Adding new junction tables
- Adding indexes

**Requires care** (must be run with PMOS offline):
- Adding NOT NULL columns without defaults (requires data backfill)
- Renaming columns (requires aliasing or migration script)
- Changing column types

**Never do automatically**:
- Dropping columns (data loss)
- Dropping tables (data loss)
- Renaming tables (breaks all existing queries)

**Migration tooling**: Use `prisma migrate dev` for development. For hosted projects (Neon), use `prisma db push` with a prior backup. See [UPDATE-STRATEGY.md](./UPDATE-STRATEGY.md) for the full migration procedure.

Each migration SQL must be inspected before applying to a production PMOS instance. Never run `prisma migrate dev` against a production database.

---

## 6. Upgrade Policy

### For PATCH releases (v0.1.0 → v0.1.1):
1. Pull the updated Starter-Kit files
2. Replace only the files listed in the CHANGELOG "Changed" section
3. No DB migration required
4. No bootstrap prompt re-run required
5. Rebuild context after upgrade: `npm run context:build`

### For MINOR releases (v0.1.x → v0.2.0):
1. Read the CHANGELOG "Added" and "Changed" sections
2. Apply schema changes via `prisma migrate dev` (migration file will be provided)
3. Update `apps/pmos/` files as listed in CHANGELOG
4. Update `scripts/build-pmos-context.ts` if context format changed
5. Rebuild context: `npm run context:build`
6. Verify PMOS is running: `GET /api/health`
7. Re-run validator: `bash scripts/validate-pmos-install.sh`

### For MAJOR releases (v0.x → v1.0.0):
1. Read the migration guide in `docs/migration/vX-to-vY.md`
2. Back up your PostgreSQL database before migrating
3. Run the provided migration script
4. Update all affected files
5. Re-validate and rebuild context
6. Re-run the bootstrap prompt if the API has changed significantly
7. Review all existing principles, warnings, and ADRs for compatibility

---

## 7. Version Identification

The current version of a PMOS instance is identified by:

1. `apps/pmos/package.json` → `"version"` field
2. `runtime-context.md` header → `PMOS version: X.Y.Z`
3. `CHANGELOG.md` → most recent released version entry

When reporting issues or requesting support, always include the version from `package.json`.

---

## 8. Changelog Maintenance Rules

- Every release must have a CHANGELOG entry before publishing
- CHANGELOG entries must be factual — no marketing language
- "Added" = net-new capabilities
- "Changed" = behavior or interface changes to existing features
- "Fixed" = bug corrections
- "Removed" = capabilities deleted
- "Security" = vulnerability fixes (include CVE if public)
- "Known Limitations" = honest statement of what doesn't work yet

Unreleased changes live in the `[Unreleased — vX.Y.Z]` section and are promoted to a named release at publish time.
