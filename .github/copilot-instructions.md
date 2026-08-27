---
applyTo: "**"
---

# SG-dev — GitHub Copilot Agent Instructions

## Project Context

SpendGuru 2.0 (SG2) — AI-native B2B procurement platform.
PMOS (Project Memory Operating System) is the embedded runtime memory system.

- VECTOR app: `apps/vector/` — Next.js 15, Prisma 7, Tailwind v4, shadcn/ui
- PMOS app: `apps/pmos/` — Next.js 14, Prisma 5, project memory runtime
- PMOS DB: Neon PostgreSQL (separate from VECTOR DB)
- Runtime context: `apps/pmos/.context/runtime-context.md`
- PMOS conversations: `apps/pmos/.pmos/conversations/`

## SKILLS SOURCE OF TRUTH GUARDRAILS

Canonical baseline for Skills Governance:
- `apps/pmos/.pmos/governance/PMOS-SOURCE-OF-TRUTH-MODEL.md`

Hard rules for all future agent execution:
- `runtime-context.md` is DERIVED CONTEXT, not root source of truth.
- Rebuild `runtime-context.md` only through VECTOR canonical path: `cd apps/vector && npm run runtime:build-context`
- `pending-state.json` is not active planning authority.
- PMOS is continuity, execution memory, and black box recorder. PMOS is not roadmap authority.
- VECTOR is active planning, readiness, and execution-graph authority.
- Generic Skills MUST NOT mutate VECTOR automatically.
- Governance defines ownership law.
- Code verifies executable behavior.
- VECTOR verifies plan, roadmap state, and readiness.
- PMOS verifies lineage, continuity, and execution history.
- Conversation archive artifacts win over summaries when reconstructing facts.

## MANDATORY ARCHITECTURE DEVELOPMENT PREFLIGHT

For every task that will modify repository source, config, or runtime code, the following preflight is mandatory before the first source mutation:

1. Load `Canon/v1.0-current-architecture-development-canon.md`.
2. Declare `TARGET_PATHS` for every intended mutation path, including prospective new files.
3. Run `node scripts/architecture-classify.mjs --json <targetPath...>`.
4. Report `ARCHITECTURE_DEVELOPMENT_PREFLIGHT` from resolver output only.

Resolver authority for baseline classification is:

- registry: `Canon/registries/current-architecture-baseline-v1.json`
- resolver: `scripts/architecture-classify.mjs`

Hard rules:

- Agents MUST NOT assign, infer, reinterpret, promote, or demote architecture classification.
- `ALIGNED` and `LEGACY` both allow normal development unless a separate canon or task restriction blocks it.
- If any target path resolves to `NO_MATCH`, `CONFLICT`, `INVALID_INPUT_PATH`, or registry failure, source mutation is blocked for the unresolved target scope.
- Read `transitionalPolicyActive` from `Canon/registries/current-architecture-baseline-v1.json`.
- Read `transitionalEpochStartSha` from `Canon/registries/current-architecture-baseline-v1.json`.
- Record `DEVELOPMENT_TASK_START_HEAD = git rev-parse HEAD` before source mutation.
- When `transitionalPolicyActive = true`, verify `git merge-base --is-ancestor <transitionalEpochStartSha> <DEVELOPMENT_TASK_START_HEAD>` before source mutation.
- If the epoch ancestry check fails, source mutation is blocked.
- If the epoch ancestry check passes, actual changed source paths created by the task receive `CHANGE_CLASSIFICATION = TRANSITIONAL` by policy at closeout.
- If implementation discovers an additional mutation path, append it to `TARGET_PATHS`, rerun the resolver for that path, and only then edit it.
- At task closeout, compare declared `TARGET_PATHS` against actual changed source paths and report `UNDECLARED_CHANGED_SOURCE_PATHS`.
- Cleanup findings do not participate in ordinary development preflight.
- `TRANSITIONAL` is a policy-derived post-epoch development delta classification, not an agent judgment and not a development blocker.

## PMOS RECOVERY BASELINE

Canonical recovery baseline:
- `apps/pmos/.pmos/protocols/PMOS-RECOVERY-BASELINE.md`

Hard recovery rules:
- Task cannot be marked complete unless `closeoutState = CLOSEOUT_COMPLETE`.
- If closeout evidence shows `CLOSEOUT_PARTIAL`, `CLOSEOUT_FAILED`, `RECOVERY_REQUIRED`, `PMOS_SAVE_FAILED`, `PMOS_SAVE_PARTIAL`, `VECTOR_REBUILD_FAILED`, or `RUNTIME_CONTEXT_VERIFICATION_FAILED`, task state is `INCOMPLETE — RECOVERY REQUIRED`.
- `pmos:save` creates backup and recovery evidence under `apps/pmos/.pmos/recovery/`.
- Run `cd apps/pmos && npm run recovery:check-archive` when archive completeness is in doubt.
- Official checker disagreement for `runtime-context.md` must NOT be treated as success. Inconsistency means `RECOVERY_REQUIRED`.

## SKILLS KILL SWITCH BASELINE

Canonical design report:
- `apps/pmos/.pmos/governance/PMOS-KILL-SWITCH-DESIGN.md`

Human-readable protocol:
- `apps/pmos/.pmos/protocols/PMOS-KILL-SWITCH-BASELINE.md`

Machine-readable config:
- `apps/pmos/.pmos/governance/skills-kill-switch.json`

Static validation:
- `cd apps/pmos && npm run skills:check-kill-switch`

Hard rules for any future Skill runtime:
- If kill-switch config is missing, unreadable, invalid, or stale relative to manual governance action, Skills must fail closed.
- Skills MUST NOT store kill-switch authority in `runtime-context.md`.
- Skills MUST NOT store kill-switch authority in `pending-state.json`.
- Skills MUST NOT reactivate themselves.
- Skills MUST NOT override global disable, write blocks, prompt-injection block, auto-pass block, or manual recovery action.
- If `RECOVERY_REQUIRED = true`, partial closeout exists, or official runtime-context checkers disagree, Skills must stop and return advisory-only output.

## SKILLS DRY RUN BASELINE

Canonical design report:
- `apps/pmos/.pmos/governance/PMOS-DRY-RUN-MODE-DESIGN.md`

Human-readable protocol:
- `apps/pmos/.pmos/protocols/PMOS-DRY-RUN-BASELINE.md`

Machine-readable config:
- `apps/pmos/.pmos/governance/skills-dry-run-mode.json`

Sample output:
- `apps/pmos/.pmos/governance/skills-dry-run-output.sample.json`

Static validation:
- `cd apps/pmos && npm run skills:check-dry-run`

Hard rules for any future dry-run path:
- Dry-run is simulation only and must never be treated as real execution output.
- Dry-run must never create `pending-artifact.json`.
- Dry-run must never run `pmos:save`.
- Dry-run must never run `runtime:build-context`.
- Dry-run must never write PMOS, VECTOR, governance, roadmap, runtime-context, or business code.
- Dry-run must never bypass Kill Switch.
- If kill-switch config or dry-run config cannot be read, future dry-run must fail closed.
- If `closeoutState != CLOSEOUT_COMPLETE`, `archiveCompletenessStatus != PASS`, `recoveryRequired = true`, or checker disagreement exists, dry-run may only return diagnostic output.
- If `runtime-context.md` is stale or invalid, it may not be used as authority.
- `pending-state.json` must never be used as authority.

## PMOS FACT PRESERVATION BASELINE

Canonical protocol:
- `apps/pmos/.pmos/protocols/PMOS-FACT-PRESERVATION-BASELINE.md`

Execution trail storage:
- `apps/pmos/.pmos/conversations/logs/<base>.execution-trail.jsonl`
- `apps/pmos/.pmos/conversations/logs/<base>.execution-trail.md`

Static validation:
- `cd apps/pmos && npm run recovery:check-execution-trail -- --base <base>`

Hard rules:
- PMOS must preserve explicit project-visible execution evidence from this remediation forward.
- PMOS must not store private chain-of-thought.
- `pending-state.json` must not be created as a routine completion artifact.
- If execution trail is missing or partial, PMOS must not claim full Fact Preservation completeness.
- Future Skills must treat `factPreservationStatus` as a blocking signal for real execution readiness.

---

## CRITICAL PMOS EXECUTION RULE — AUTOMATED MEMORY ROUTINE

**PMOS persistence MUST be the LAST action before calling `task_complete`.**
**`task_complete` is BLOCKED until `npm run pmos:save` succeeds.**
This is not optional. Skipping PMOS is a hard failure. No exceptions.

### Step-by-step execution at task completion:

**1. Verify the authoritative `.pmos/pending-artifact.json`** before closeout:

- Governance artifacts are authoritative system artifacts, not assistant-authored notes.
- The assistant MUST NOT synthesize, recreate, repair, or overwrite `.pmos/pending-artifact.json` during routine execution.
- The assistant MUST NOT infer canonical metadata such as `taskId`, `etap`, `subetap`, pipeline identity, or governed status labels.
- If the artifact is missing, malformed, inconsistent with implementation or governance truth, or lacks canonical metadata, execution must fail closed before `pmos:save`.
- Exception: governance artifact repair is allowed only when the current task explicitly requests governance recovery.

The active closeout flow still requires this file to exist, but it must come from an authoritative governed path rather than assistant invention.

Authoritative artifact shape:

> ⚠️ **TIMESTAMP RULE — MANDATORY, NO EXCEPTIONS:**
> The `timestamp` field MUST be the **actual current system time** in ISO 8601 UTC format.
> Get it with: `TZ="Europe/Warsaw" date -u +"%Y-%m-%dT%H:%M:%S.000Z"` (or `new Date().toISOString()` in Node.js).
> **NEVER hardcode a date. NEVER use a date from example artifacts, comments, or task descriptions.**
> The `timestamp` drives the conversation filename (`YYYY-MM-DD-HH:MM_<slug>`) — a wrong timestamp creates a permanently misnamed file.
> PL timezone (CEST = UTC+2 in summer, CET = UTC+1 in winter) is display-only; the stored value is always UTC.

```json
{
  "conversationId": "<unique-id — use session UUID + task suffix, e.g. 34a8f357-mvp9>",
  "timestamp": "← MUST be actual current UTC time: new Date().toISOString()",
  "project": "spendguru-2",
  "taskId": "SG2-TASK-ID",
  "etap": "ETAP N — Name",
  "subetap": "NODE-ID",
  "domains": ["domain1", "domain2"],
  "conversationType": "architecture|implementation|debugging|governance|...",
  "importanceLevel": "foundational|high|medium|low",
  "userPrompt": "original task prompt",
  "llmResponse": "full execution summary",
  "summary": "concise one-paragraph summary",
  "tags": ["tag1", "tag2"],
  "changedFiles": ["path/to/file"],
  "architecturalDecisions": [{ "id": "ADR-001", "title": "...", "decision": "..." }],
  "blockers": ["blocker description"],
  "risks": ["risk description"],
  "nextActions": ["1. Next action"],
  "unlockedNodes": ["NODE-2", "NODE-3"],
  "chronologyOrder": 101
}
```

**2. Append execution trail baseline** under `apps/pmos/.pmos/conversations/logs/`.

Minimum baseline events:
- `TASK_RECEIVED`
- `PROMPT_CAPTURED`
- `PLAN_DECLARED`
- key file / command / patch / validation / decision events as applicable
- `PENDING_ARTIFACT_CREATED`
- `PMOS_SAVE_STARTED`
- `PMOS_SAVE_SUCCEEDED` or `PMOS_SAVE_FAILED`
- `VECTOR_REBUILD_STARTED`
- `VECTOR_REBUILD_SUCCEEDED` or `VECTOR_REBUILD_FAILED`
- `CLOSEOUT_COMPLETED` or `TASK_INCOMPLETE`

`pending-state.json` is not active planning authority and must not be created as a routine completion artifact.

**3. Run PMOS persistence:**
```bash
cd apps/pmos && npm run pmos:save
```

**4. Run runtime context rebuild through VECTOR:**
```bash
cd apps/vector && npm run runtime:build-context
```

### Completion checklist (REQUIRED — `task_complete` is BLOCKED until all pass):
- [ ] authoritative `pending-artifact.json` verified at `apps/pmos/.pmos/pending-artifact.json`
- [ ] execution trail baseline written under `apps/pmos/.pmos/conversations/logs/`
- [ ] `pmos:save` executed successfully (`npm run pmos:save` from `apps/pmos/`)
- [ ] ConversationArtifact inserted into PMOS DB
- [ ] `.md` and `.json` files created in `.pmos/conversations/` with format `YYYY-MM-DD-HH:MM_<taskId-slug>.md`
- [ ] `runtime-context.md` rebuilt via VECTOR canonical path (`cd apps/vector && npm run runtime:build-context`)
- [ ] `runtime-context.md` contains ONLY current operational state (no history)

### Filename format (automatic since pmos-save v2):
Files are named `YYYY-MM-DD-HH:MM_<taskId-slug>.md` — derived from `timestamp` + `taskId` in the artifact.
The `HH:MM` in the filename is the **Polish local time** (CEST/CET) converted from the UTC timestamp.
Example: artifact with `taskId: "MVP3-DISCOVERY-9"` and `timestamp: "2026-05-27T13:30:00.000Z"` (= 15:30 CEST) → `2026-05-27-15:30_mvp3-discovery-9.md`

> ❌ WRONG: copy-pasting a date from example data in the task (e.g. `"2026-06-01"` seen in runtime artifact examples)
> ✅ CORRECT: `new Date().toISOString()` evaluated at the moment of writing `pending-artifact.json`

### Failure handling:
- If `pending-artifact.json` is missing, malformed, occupied by another live task, or contains inferred/non-canonical governed metadata -> block closeout and report the governance failure. Do NOT create a replacement artifact during routine execution.
- If `pmos:save` fails → fix the error, retry. Do NOT call `task_complete`.
- If DB is unreachable → report blocker, do NOT call `task_complete`.
- If `pmos:save` is partial → inspect `apps/pmos/.pmos/recovery/closeouts/` and do NOT call `task_complete`.
- If VECTOR rebuild fails or runtime-context verification is inconsistent → task state is `INCOMPLETE — RECOVERY REQUIRED`.
- If execution trail is missing or partial → do NOT claim full Fact Preservation completeness.
- NEVER skip PMOS persistence to "save time".

---

## General Coding Rules

- TypeScript strict mode — no `any` unless unavoidable and commented
- Prisma: always include `orgId` in WHERE clauses on tenant models
- Server actions: never accept `orgId` from client input — source from session
- No hardcoded credentials — use env vars
- Prefer `cuid()` for all PKs
- Soft delete pattern: `deletedAt DateTime?` — never hard delete tenant data
