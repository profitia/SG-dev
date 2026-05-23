# PMOS Architecture
## Embedded AI-Native Development Memory Runtime

> For the conceptual philosophy behind PMOS design decisions, see [PMOS-PHILOSOPHY.md](./PMOS-PHILOSOPHY.md).

---

## 1. What PMOS Is

PMOS — Project Memory Operating System — is an **embedded, local-first development memory runtime**.

It is not a project management tool.  
It is not a SaaS dashboard.  
It is not a ticket system.  
It is not a sprint planner.

PMOS is the **persistent memory layer** between your project and your AI assistant.

Its core function: give your AI tools (GitHub Copilot, Claude, ChatGPT) a **structured, up-to-date, project-specific context** at the start of every session — without manual copy-paste, without stale documents, without context loss.

---

## 2. The Core Problem PMOS Solves

AI assistants have no persistent memory across sessions.  
Every new chat starts blank.  
Every agent run starts from scratch.

Without PMOS, developers must:
- Manually remind the AI of architecture decisions
- Re-explain why things are built a certain way
- Repeat context about active work
- Hope the AI doesn't violate principles it doesn't know about

PMOS solves this by maintaining a **runtime context document** — a structured Markdown file auto-generated from the project's live state — that is injected into the AI context before any work begins.

---

## 3. Architecture Model

```
┌─────────────────────────────────────────────────────────────┐
│                        PMOS Runtime                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  Roadmap     │  │  Principles  │  │  Execution Logs   │ │
│  │  (ETAPs +    │  │  (canonical  │  │  (what was built, │ │
│  │   nodes)     │  │   rules)     │  │   why, impact)    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘ │
│         │                  │                    │           │
│         └──────────────────┴────────────────────┘           │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  Context API    │  /api/context/active  │
│                   └────────┬────────┘                       │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │ Context Builder │  scripts/build-pmos   │
│                   └────────┬────────┘                       │
│                            │                                │
│              apps/pmos/.context/runtime-context.md          │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  AI Assistant   │  Copilot / Claude     │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Core Data Model

### RoadmapNode

The fundamental unit of PMOS. Represents a unit of work — an ETAP (phase), a feature, a milestone, or a sub-task.

```
RoadmapNode {
  id:          cuid
  parentId:    RoadmapNode? (hierarchical tree)
  title:       string
  description: text
  status:      backlog | in_progress | blocked | done | archived
  priority:    low | medium | high
  scope:       active | strategic_backlog
  sortKey:     string (lexicographic ordering)
  order:       int
}
```

Nodes form a **tree** — ETAPs are root nodes, sub-tasks are children.  
The active ETAP is the root node with `status = in_progress`.

### ExecutionLog

A structured record of what was built in a session.

```
ExecutionLog {
  id:                  cuid
  title:               string
  summary:             text (what happened)
  architecturalImpact: text (what changed architecturally)
  changedFiles:        string[] (file paths)
  blockers:            text? (what was blocked)
  nextSteps:           text? (what comes next)
  canonicalAlignment:  high | medium | low
}
```

Execution logs are the **project's memory** — the record of why decisions were made and what was learned.

### CanonicalPrinciple

Architecture rules that must not be violated. The AI must know them.

```
CanonicalPrinciple {
  id:          cuid
  title:       string
  description: text (what the rule is)
  reason:      text? (why this rule exists)
  priority:    low | medium | high
}
```

High-priority principles are always injected into the runtime context.

### ArchitectureWarning

Active risks, drifts, and violations that need attention.

```
ArchitectureWarning {
  id:          cuid
  title:       string
  description: text
  severity:    low | medium | high | critical
  type:        dashboard_gravity | runtime_boundary | business_logic_leak |
               orchestration_drift | overengineering | prompt_coupling | architecture_debt
  resolved:    boolean
}
```

Active (unresolved) warnings are always surfaced in the runtime context.

### Decision

Architectural decisions with reasoning — the "why" behind structural choices.

```
Decision {
  id:              cuid
  number:          int (auto-increment, referenced as ADR-N)
  title:           string
  decision:        text (what was decided)
  reason:          text? (why)
  impact:          text? (what it affects)
  affectedSystems: string[]
}
```

### PromptExecution

A structured log of AI prompt runs — what prompt was used, what ETAP it was for, what changed.

```
PromptExecution {
  id:               cuid
  title:            string
  etap:             string? (e.g. "6")
  subetap:          string? (e.g. "6.7")
  node:             string? (e.g. "PMOS Starter Kit")
  domain:           string?
  promptType:       string?
  promptContent:    text
  executionSummary: text?
  status:           queued | running | completed | failed | archived
}
```

---

## 5. Runtime Context

The runtime context is a **Markdown file** generated by the context builder from the live PMOS API.

Location: `apps/pmos/.context/runtime-context.md`

Contents:
- **Active ETAP**: current phase being worked on
- **Current Focus**: the specific node in progress
- **Active Domains**: tags on the active work
- **Canonical Principles**: high-priority architecture rules
- **Recent Executions**: last 3 execution log summaries
- **Active Warnings**: unresolved architecture risks
- **Suggested Next Step**: next backlog node

GitHub Copilot automatically reads files in `.context/` as workspace context.  
Claude and other tools can consume the file manually.

---

## 6. Context API

PMOS exposes a JSON API consumed by the context builder:

```
GET /api/context/active
```

Returns:
```json
{
  "generatedAt": "2026-05-14T...",
  "activeEtap": "ETAP 6 — AI Layer",
  "activeNode": "6.7 — PMOS Starter Kit",
  "activeDomains": ["ai", "architecture"],
  "relatedPrinciples": ["Runtime-first", "Deterministic-first"],
  "recentExecutions": [{ "title": "...", "summary": "..." }],
  "activeWarnings": [{ "title": "...", "severity": "high", "type": "..." }],
  "nextSuggestedStep": "6.8 — ..."
}
```

---

## 7. Context Builder

The context builder is a TypeScript script that:

1. Fetches `/api/context/active` from running PMOS
2. Transforms the JSON into structured Markdown
3. Writes to `apps/pmos/.context/runtime-context.md`

```bash
npx tsx scripts/build-pmos-context.ts
npx tsx scripts/build-pmos-context.ts --url http://localhost:3200
npx tsx scripts/build-pmos-context.ts --out .context/my-context.md
```

---

## 8. Architectural Continuity

PMOS enforces **architectural continuity** through the principle → warning → execution log pipeline:

```
Principle established
  → Warning fired (violation or drift detected)
    → Execution log written (resolution or workaround)
      → Context updated (AI knows what happened)
        → Next session starts with full context
```

This prevents the most common AI-assisted development failure mode:
> "The AI fixed X but violated principle Y, and nobody noticed until it caused problem Z."

---

## 9. What PMOS Is Not

| Pattern | Why PMOS Avoids It |
|---|---|
| Sprint tickets | PMOS tracks memory, not velocity |
| Story points | No estimation — execution logs capture actual complexity |
| Burndown charts | Not a project management layer |
| Acceptance criteria | PMOS tracks what was built, not what was promised |
| Kanban boards | Roadmap is a memory tree, not a workflow board |
| Shared multi-project dashboard | Each project has its own embedded PMOS |

---

## 10. Embedding PMOS

PMOS is designed to be **embedded**, not centralized:

```
project-a/
  apps/pmos/    ← PMOS instance for project-a
  src/

project-b/
  apps/pmos/    ← Separate PMOS instance for project-b
  src/
```

Each instance has its own database, its own roadmap, its own principles.  
There is no cross-project sharing.

This is intentional: **project memory is project-specific**. A principle that matters for project-a may be irrelevant for project-b. An architecture warning in project-a is noise in project-b.
