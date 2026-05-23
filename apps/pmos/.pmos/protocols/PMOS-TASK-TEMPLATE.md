# PMOS Task Template

> Version: 1.0
> Scope: PMOS Runtime Continuity Protocol
> Location: apps/pmos/.pmos/protocols/
> Usage: Copy this template for every new PMOS implementation task

---

## How to Use

1. Copy the template block below
2. Fill in all `[PLACEHOLDERS]`
3. Remove unused optional sections
4. Send to ChatGPT for orchestration OR paste directly into VSC Copilot

---

## Template

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

DOMAIN:

* [domain-1]
* [domain-2]
* [domain-3]

TYPE: feature / refactor / architecture / governance / infra / continuity

⸻

OBJECTIVE

[Business / functional / architectural goal]

Explain:

* what should be achieved,
* why this matters,
* expected runtime impact.

⸻

CURRENT VERIFIED STATE

Describe:

* current runtime state,
* known constraints,
* known risks,
* active blockers,
* current architecture assumptions.

⸻

SCOPE

1. [Scope block]
2. [Scope block]
3. [Scope block]

⸻

BOUNDARY RULES

DO NOT:

* rewrite unrelated systems
* introduce architecture drift
* overengineer
* create unnecessary abstractions
* introduce new frameworks without explicit decision

⸻

CRITICAL PMOS RULE — RUNTIME-CONTEXT

runtime-context.md MUST represent ONLY:

* active operational state,
* current ETAP,
* active runtime topology,
* active blockers,
* active risks,
* next operational actions.

DO NOT:

* append historical narratives,
* accumulate obsolete findings,
* create documentation dump.

runtime-context.md = active operational snapshot only.

⸻

CRITICAL PMOS RULE — MEMORY ROUTINE

MANDATORY after task completion:

Save COMPLETE execution continuity into:

apps/pmos/.pmos/conversations/

Required:

* original user intent
* generated prompt
* implementation summary
* changed files
* architectural impact
* runtime findings
* decisions
* risks
* blockers
* next steps
* execution status

Artifacts required:

* .md
* .json

The COMPLETE execution context must remain reconstructable.

⸻

SUCCESS CRITERIA

Task COMPLETE when:

* [criteria]
* [criteria]
* [criteria]

⸻

OUTPUT EXPECTED

1. Implementation summary
2. Changed files
3. Runtime impact
4. Risks
5. Next steps
6. Updated runtime-context.md
7. Saved PMOS artifacts

=== EXECUTE ===
```

---

## Field Reference

### TASK_ID
Unique identifier. Format: `[PROJECT]-[DOMAIN]-[DESCRIPTOR]-V[N]`
Examples: `PMOS-CONTINUITY-PROTOCOL-V1`, `SG-AUTH-LOGIN-V2`

### ENVIRONMENT
- `development` — local dev, feature work
- `preview` — staging, pre-release validation
- `production` — live system changes

### ETAP
Active roadmap ETAP. Must match current PMOS roadmap state.

### TYPE
| Type | When to use |
|---|---|
| `feature` | New user-facing functionality |
| `refactor` | Internal restructuring without behavior change |
| `architecture` | System design change with runtime impact |
| `governance` | Principle enforcement, risk resolution |
| `infra` | Build, deploy, CI/CD, environment changes |
| `continuity` | PMOS continuity workflow, memory routine |

### DOMAIN
Match domains defined in `pmos.config.ts` → `domains` array.
Common values: `auth`, `api`, `ui`, `database`, `continuity`, `governance`

---

## Continuity Checklist (post-task)

After every task executed with this template:

- [ ] `saveTaskArtifact()` called — `.md` + `.json` saved in `.pmos/conversations/`
- [ ] `appendConversationEntry()` called — lineage log entry created
- [ ] `rebuildRuntimeContext()` called — `runtime-context.md` updated (active state only)
- [ ] Changed files documented
- [ ] Next steps recorded
- [ ] Execution status set: `complete` / `partial` / `blocked` / `failed`

---

_Auto-generated: PMOS Runtime Continuity Protocol v1.0_
