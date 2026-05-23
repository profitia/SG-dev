# PMOS VSC Bootstrap Prompt

> **How to use this file:**
> 1. Open GitHub Copilot Chat in VS Code (Agent mode)
> 2. Copy the prompt below (starting from the `---` separator)
> 3. Paste it into the chat
> 4. Copilot will analyze your project and populate PMOS with project-specific data

> **Prerequisites:**
> - PMOS is installed and running at http://localhost:3200
> - Database is seeded (generic seed is in place)
> - `pmos.config.ts` has been edited with your project name and domains

---

## THE PROMPT

---

You are an expert software architect and development system analyst. Your task is to bootstrap PMOS — the embedded AI-native development memory runtime — for this project.

PMOS is running locally at http://localhost:3200. It is a Next.js app backed by PostgreSQL (via Prisma). It contains the following data model:

- **RoadmapNode** — hierarchical execution nodes (ETAPs and sub-tasks)
- **ExecutionLog** — structured records of what was built, why, and what changed architecturally
- **CanonicalPrinciple** — architecture rules the AI must know and respect
- **ArchitectureWarning** — active risks, drifts, and violations
- **Decision** — architectural decisions with reasoning (ADRs)
- **PromptExecution** — history of AI-assisted execution sessions with blockers + next steps
- **ChangedFile** — per-file change records with impact levels, linked to both logs and prompt executions
- **ConversationArtifact** — persistent memory of AI conversations, searchable and cross-linked to all entity types
- **Timeline** — unified chronological view across all entity types
- **Governance layer** — `.pmos/` directory stores decision records, principles, findings, and warnings as files

Your job is to perform the following bootstrap sequence for THIS project:

---

### PHASE 1: Project Analysis

Analyze the workspace thoroughly:

1. Read the root `package.json`, `README.md`, and any `AGENTS.md` or `ARCHITECTURE.md` files
2. Examine the top-level directory structure
3. Identify the stack (framework, database, language, runtime)
4. Identify the main domains (auth, api, ui, database, integrations, etc.)
5. Read `apps/pmos/pmos.config.ts` for declared project metadata
6. Identify any existing architectural patterns (event-driven, layered, microservices, etc.)
7. Read key source files to understand how the project is structured

Report your findings as:
- **Project Type**: (fullstack-web / api / mobile / library / monorepo)
- **Stack**: (technologies identified)
- **Domains**: (list of functional domains)
- **Architecture Style**: (the dominant pattern)
- **Current State**: (what exists, what's missing, what's in progress)

---

### PHASE 2: Roadmap Generation

Based on the project analysis, create a realistic ETAP roadmap in PMOS.

Rules:
- Root nodes are ETAPs (phases of development)
- Child nodes are specific deliverables within that ETAP
- Do NOT create generic phases like "Setup", "Testing" — make them specific to this project
- Status should reflect actual current state:
  - ETAPs that are clearly complete → `done`
  - The ETAP currently being worked on → `in_progress`
  - Future ETAPs → `backlog`
- Priority should be honest:
  - Foundation/infra ETAPs → `high`
  - Feature ETAPs → `medium` or `high` based on criticality
  - Enhancement ETAPs → `medium`

Use the PMOS API to create nodes:

```
POST http://localhost:3200/api/roadmap
Content-Type: application/json

{
  "title": "ETAP 1 — [descriptive name]",
  "description": "[what this phase delivers]",
  "status": "done",
  "priority": "high",
  "order": 100,
  "sortKey": "001"
}
```

Create at minimum 5 ETAPs. If the project already has significant work done, create sub-nodes for completed work.

---

### PHASE 3: Principles Extraction

Identify and create **canonical principles** from the codebase.

Look for:
- Patterns repeated across multiple files (e.g., "all data access goes through repositories")
- Explicit rules in docs or comments (e.g., "no raw SQL", "server components by default")
- Stack-specific constraints (e.g., "Zod for all external input validation")
- Architectural decisions that must be preserved
- Anti-patterns that have been consciously avoided

Create 5–10 principles. Format:

```
POST http://localhost:3200/api/principles
Content-Type: application/json

{
  "title": "[short rule name]",
  "description": "[what the rule is and what it prevents]",
  "reason": "[why this exists — the specific problem it avoids]",
  "priority": "high"
}
```

High priority principles should be things that, if violated, would cause significant architectural damage.

---

### PHASE 4: Warning Detection

Analyze the codebase for active architecture risks.

Look for:
- Components that do too many things (god objects, fat pages)
- Business logic in the wrong layer (UI → DB direct, controllers with business rules)
- Missing abstractions (repeated code with no shared implementation)
- Over-engineered solutions (premature abstraction, unnecessary complexity)
- Missing error handling at system boundaries
- Security risks (unvalidated inputs, missing auth checks, exposed secrets)
- Performance risks (N+1 queries, unindexed fields on large tables)
- AI coupling (prompts hardcoded in business logic, no abstraction layer)

Create warnings for genuine risks. Do not create warnings for minor style issues.

```
POST http://localhost:3200/api/warnings
Content-Type: application/json

{
  "title": "[short warning name]",
  "description": "[what the risk is, where it is, what could go wrong]",
  "severity": "high",
  "type": "runtime_boundary",
  "affectedArea": "[file or module path]"
}
```

Warning types:
- `dashboard_gravity` — UI components pulling in too much business logic
- `runtime_boundary` — crossing runtime/process boundaries incorrectly
- `business_logic_leak` — business rules in the wrong layer
- `orchestration_drift` — coordination logic scattered across modules
- `overengineering` — unnecessary abstraction or complexity
- `prompt_coupling` — AI prompts tightly coupled to non-AI code
- `architecture_debt` — accumulated technical decisions that need revisiting

---

### PHASE 5: Initial Execution Log

Create a bootstrap execution log documenting this analysis:

```
POST http://localhost:3200/api/logs
Content-Type: application/json

{
  "title": "PMOS Bootstrap — Initial Project Analysis",
  "summary": "[what you found — the project state, what exists, what's in progress]",
  "architecturalImpact": "[key architectural observations — patterns, constraints, risks]",
  "changedFiles": [],
  "nextSteps": "[what the AI recommends as the immediate next work item]",
  "canonicalAlignment": "high"
}
```

---

### PHASE 6: Context Build

After populating PMOS, run the context builder:

```bash
npx tsx scripts/build-pmos-context.ts
```

This generates `apps/pmos/.context/runtime-context.md` — the AI context injection file that will be read automatically by GitHub Copilot in future sessions.

---

### COMPLETION CHECKLIST

Confirm when complete:
- [ ] Project analyzed and findings reported
- [ ] Roadmap created with project-specific ETAPs (minimum 5)
- [ ] Principles created from codebase patterns (minimum 5)
- [ ] Warnings created for genuine risks (minimum 2)
- [ ] Bootstrap execution log created
- [ ] Context build run successfully
- [ ] `apps/pmos/.context/runtime-context.md` exists and is accurate

---

### IMPORTANT RULES

- Do NOT create generic content that could apply to any project
- Do NOT use Jira/agile terminology (sprints, stories, epics, acceptance criteria, velocity)
- Do NOT create warnings for style issues or minor code quality items
- Do NOT hallucinate file paths — only reference files you have actually read
- DO be specific: name actual files, actual modules, actual patterns found
- DO prioritize ruthlessly: only high-priority principles and genuine risks
- The goal is a PMOS that accurately reflects THIS project's current reality

---

Begin with Phase 1. Report your project analysis findings before proceeding to Phase 2.
