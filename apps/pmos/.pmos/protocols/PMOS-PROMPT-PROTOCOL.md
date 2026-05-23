# PMOS Prompt Protocol

> Version: 1.0
> Scope: PMOS Runtime Continuity Protocol
> Location: apps/pmos/.pmos/protocols/

---

## Purpose

Defines how prompts are structured, tracked, and persisted in PMOS-native projects.

Every major task executed via ChatGPT orchestration + VSC/Copilot execution MUST produce a traceable prompt lineage record.

---

## Prompt Lineage — What to Capture

For every major task, capture:

| Field | Description |
|---|---|
| `userIntent` | Raw user intent or request (verbatim or close paraphrase) |
| `generatedPrompt` | Full structured prompt sent to Copilot/LLM (if generated) |
| `taskId` | Unique task identifier (e.g. `PMOS-CONTINUITY-PROTOCOL-V1`) |
| `etap` | Active ETAP at time of execution (e.g. `PMOS-FOUNDATION`) |
| `subetap` | Active subetap if applicable |
| `node` | Active node if applicable |

---

## Prompt Lineage — When to Persist

Persist a prompt lineage record when:

- A new structured implementation task is started
- A governance decision is made
- An architectural direction changes
- An ETAP transition occurs
- A significant risk or blocker is identified

---

## Prompt Structure

Canonical PMOS prompt structure (see PMOS-TASK-TEMPLATE.md for full template):

```
[TASK NAME]
=== IMPLEMENTATION TASK ===
[PMOS]
TASK_ID: [TASK-ID]
PROJECT: [PROJECT NAME]
ENVIRONMENT: [development / preview / production]
RUNTIME: PMOS
EXECUTION_MODE: copilot-agent
ETAP: [ETAP]
SUBETAP: [SUBETAP]
NODE: [NODE NAME]
DOMAIN: [domains]
TYPE: [task type]
OBJECTIVE: [goal]
CURRENT VERIFIED STATE: [state]
SCOPE: [scope blocks]
BOUNDARY RULES: [constraints]
SUCCESS CRITERIA: [criteria]
OUTPUT EXPECTED: [output list]
=== EXECUTE ===
```

---

## Storage

Prompt lineage is persisted in two ways:

**1. Conversation log entry** (`.pmos/conversations/logs/<uuid>.json`):
```json
{
  "id": "...",
  "timestamp": "...",
  "type": "continuity",
  "title": "Task: [TASK_ID]",
  "summary": "...",
  "promptLineage": {
    "userIntent": "...",
    "generatedPrompt": "...",
    "taskId": "...",
    "etap": "...",
    "subetap": "...",
    "node": "..."
  }
}
```

**2. Task artifact** (`.pmos/conversations/YYYY-MM-DD-HH:MM_<topic>.md/.json`):
Full structured artifact including prompt, implementation, files changed, decisions.

---

## Implementation

Use `appendConversationEntry()` from `src/lib/pmos/conversation-persistence.ts`:

```typescript
import { appendConversationEntry } from '@/lib/pmos/conversation-persistence'

appendConversationEntry({
  type: 'continuity',
  title: 'Task: PMOS-CONTINUITY-PROTOCOL-V1',
  summary: 'Implemented PMOS Runtime Continuity Protocol.',
  tags: ['continuity', 'governance', 'pmos-foundation'],
  promptLineage: {
    userIntent: 'Implement canonical PMOS Runtime Continuity Workflow.',
    taskId: 'PMOS-CONTINUITY-PROTOCOL-V1',
    etap: 'PMOS-FOUNDATION',
    subetap: 'CONTINUITY-PROTOCOL',
    node: 'Runtime Continuity + Memory Persistence',
  },
  executionLineage: {
    changedFiles: ['src/lib/pmos/conversation-persistence.ts'],
    executionStatus: 'complete',
    nextSteps: ['Use saveTaskArtifact() after every major task'],
  },
})
```

---

## Rules

- NEVER skip prompt lineage for tasks that change architecture or runtime state
- ALWAYS capture `userIntent` — even if prompt was informal
- `generatedPrompt` is optional but strongly recommended for ChatGPT-orchestrated tasks
- Prompt lineage belongs in `.pmos/conversations/` — NOT in `runtime-context.md`
- `runtime-context.md` = active operational snapshot only

---

_Auto-generated: PMOS Runtime Continuity Protocol v1.0_
