# PMOS Memory Routine

> Version: 1.0
> Scope: PMOS Runtime Continuity Protocol
> Location: apps/pmos/.pmos/protocols/

---

## Purpose

Defines the canonical memory routine for PMOS-native projects.

The memory routine MUST be executed after every major task to ensure:
- deterministic continuity between sessions
- reconstructable execution context
- prompt and execution lineage persistence
- runtime-context remains operational-only (never a documentation dump)

---

## When to Execute

Execute the memory routine after:

- Any implementation task that changes source files
- Any architectural decision
- Any governance state change
- Any ETAP transition
- Any significant risk or blocker identified
- Any runtime topology change

---

## What to Save

Required artifact content:

| Field | Required | Notes |
|---|---|---|
| `task` | YES | What was the task |
| `userPrompt` | YES | Original user intent |
| `generatedPrompt` | NO | Expanded prompt if used |
| `implementationSummary` | YES | What was done |
| `changedFiles` | YES | Relative paths of all changed files |
| `architecturalImpact` | NO | Impact on system architecture |
| `decisions` | NO | Key decisions made |
| `risks` | NO | New or active risks |
| `blockers` | NO | Active blockers |
| `nextSteps` | YES | What comes next |
| `status` | YES | `complete` / `partial` / `blocked` / `failed` |

---

## Where to Save

```
apps/pmos/.pmos/conversations/
```

**Artifact format:**
- `.md` — human-readable markdown artifact
- `.json` — machine-readable JSON artifact

**Filename format:**
```
YYYY-MM-DD-HH:MM_<topic>.md
YYYY-MM-DD-HH:MM_<topic>.json
```

**Example:**
```
2026-05-23-22:33_runtime-hardening.md
2026-05-23-22:33_runtime-hardening.json
```

---

## How to Execute

Use `saveTaskArtifact()` from `src/lib/pmos/conversation-persistence.ts`:

```typescript
import { saveTaskArtifact } from '@/lib/pmos/conversation-persistence'

const result = saveTaskArtifact({
  taskId: 'PMOS-CONTINUITY-PROTOCOL-V1',
  topic: 'continuity-protocol',
  task: 'Implement PMOS Runtime Continuity Protocol',
  userPrompt: 'Implement canonical PMOS Runtime Continuity Workflow...',
  generatedPrompt: '...',
  implementationSummary: 'Extended conversation-persistence.ts with...',
  changedFiles: [
    'apps/pmos/src/lib/pmos/conversation-persistence.ts',
    'apps/pmos/.pmos/protocols/PMOS-PROMPT-PROTOCOL.md',
    'apps/pmos/.pmos/protocols/PMOS-MEMORY-ROUTINE.md',
    'apps/pmos/.pmos/protocols/PMOS-TASK-TEMPLATE.md',
  ],
  architecturalImpact: 'PMOS now supports full execution lineage persistence.',
  decisions: [
    'saveTaskArtifact() uses filesystem only — no DB',
    'runtime-context.md is operational snapshot only',
  ],
  risks: [],
  blockers: [],
  nextSteps: [
    'Execute memory routine after every major task',
    'Rebuild runtime-context.md after ETAP transitions',
  ],
  status: 'complete',
})

console.log('Saved:', result.mdPath, result.jsonPath)
```

---

## Runtime-Context Rule

After the memory routine, rebuild `runtime-context.md`:

```typescript
import { rebuildRuntimeContext } from '@/lib/pmos/conversation-persistence'

rebuildRuntimeContext({
  projectName: 'SpendGuru 2.0',
  activeEtap: 'ETAP 3 — Integrations',
  activeNode: '3.2 — External API Integration',
  activeDomains: ['auth', 'api', 'ui', 'database'],
  activeRisks: ['Render deployment devDependencies issue'],
  activeBlockers: [],
  nextActions: [
    'Execute memory routine after every major task',
    'Rebuild runtime-context.md after ETAP transitions',
  ],
})
```

`runtime-context.md` MUST represent ONLY active operational state. Do NOT add historical narratives or accumulated findings.

---

## Governance Hardening Rule

All memory routines MUST be tolerant of missing governance artifacts.

- Missing `.pmos/governance/` directories: return empty state, do not throw
- Missing `.pmos/conversations/` directory: create it automatically
- Malformed JSON files: skip silently, do not throw

This is enforced by:
- `governance-reader.ts` — always returns typed empty state
- `conversation-persistence.ts` — `ensureDir()` creates directories on demand
- All functions: return `null` or empty arrays on failure, never throw

---

## Artifact Retention

- Conversation logs: `.pmos/conversations/logs/` — all kept (never deleted)
- Task artifacts: `.pmos/conversations/` — all kept (never deleted)
- Snapshots: `.pmos/conversations/snapshots/` — all kept

Historical continuity belongs exclusively in `.pmos/conversations/`.
`runtime-context.md` is always overwritten — never accumulates.

---

_Auto-generated: PMOS Runtime Continuity Protocol v1.0_
