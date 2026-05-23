# PMOS — Project Memory Operating System
## Embedded AI-Native Development Memory Runtime

PMOS is a **self-hosted, embedded AI-native project operating system** you run locally inside your project.

It is not a SaaS. It is not a shared dashboard. It is not a project management tool.

PMOS is a **development memory runtime** — a structured layer that keeps your AI assistant, your architecture, and your execution history in sync across sessions, collaborators, and time.

---

## What PMOS Is

```
Each project has its own PMOS.
Each PMOS has its own:
  - Roadmap (hierarchical execution nodes)
  - Principles (canonical architecture rules)
  - Execution Logs (what was built, why, how)
  - Warnings (architecture risks, drifts)
  - Decisions (why things are the way they are)
  - Prompts (AI execution history)
  - Runtime Context (auto-generated AI injection file)
```

PMOS runs as a Next.js app on a local or project-scoped Postgres database (Neon recommended).  
It exposes a runtime context API that can be consumed by GitHub Copilot, Claude, or any AI assistant.

---

## Quick Start

```bash
# 1. Install PMOS into your project (from pmos-starter directory)
bash scripts/install-pmos.sh /path/to/your/project

# 2. Configure environment
# Edit apps/pmos/.env.local with your Postgres credentials (Neon: https://neon.tech)

# 3. Initialize database
cd apps/pmos
npm run db:generate
npm run db:push
npm run db:seed

# 4. Run PMOS
npm run dev
# → http://localhost:3200

# 5. Bootstrap with AI — edit and paste APPLICATION-BOOTSTRAP-PROMPT.md
# (see Bootstrap section below)

# 6. Build runtime context for AI
npm run context:build
```

See [INSTALL.md](./INSTALL.md) for the complete step-by-step guide.

---

## What Gets Created

After seeding, you have a working PMOS with:

- **5 generic ETAPs** (Foundation → AI Layer) ready to customize
- **5 Canonical Principles** (Runtime-first, Event-driven, Conversation-first, Memory continuity, Deterministic-first)
- **2 Architecture Warnings** (example drift/overengineering signals)
- **1 Initial Execution Log**
- **Conversation Memory browser** — searchable, filterable history of AI sessions linked to roadmap/decisions/warnings
- **Timeline view** — unified chronological feed of all prompts, logs, decisions, warnings
- **Global search** (Cmd+K) — full-text across all 8 entity types
- **Changed Files tracker** — per-file impact levels linked to both logs and prompt executions
- **Governance layer** — ADR decisions cross-linked to principles and conversations
- **Runtime context** auto-generated at `apps/pmos/.context/runtime-context.md`

---

## Customization

After installing, configure PMOS for your project by editing `pmos.config.ts`:

```ts
export const pmosConfig = {
  projectName: 'My Project',
  projectType: 'fullstack-web',
  architectureStyle: 'event-driven',
  domains: ['auth', 'api', 'ui', 'database'],
  runtimeStyle: 'stateless',
  preferredStack: ['Next.js', 'Prisma', 'PostgreSQL'],
}
```

Then re-seed or edit the roadmap via the PMOS UI.

---

## Architecture

See [PMOS-ARCHITECTURE.md](./PMOS-ARCHITECTURE.md) for a full description of:
- What PMOS is and why it exists
- The runtime context model
- How execution logs form architectural memory
- How principles and warnings enforce continuity
- How the context builder feeds AI tools

---

## Bootstrap Your Project

After installation, there are two bootstrap paths depending on your project state:

### Path A — Application Bootstrap (recommended for all projects)

Use [APPLICATION-BOOTSTRAP-PROMPT.md](./APPLICATION-BOOTSTRAP-PROMPT.md) — the canonical PMOS Bootstrap Engine.

**Prerequisites**: PMOS must be installed and running at `http://localhost:3200` before pasting the prompt.

1. Edit **only the PROJECT INPUT BLOCK** at the top of the file (≈20 lines of YAML)
2. Copy the full file contents and paste into Claude or GitHub Copilot Agent mode
3. The AI executes 9 bootstrap phases autonomously:
   - Project Identity Validation
   - Architecture Definition (greenfield design or codebase analysis)
   - Runtime Topology mapping
   - Governance Bootstrap (principles, warnings, ADRs)
   - Roadmap Generation (project-specific ETAPs)
   - CIC Integration *(conditional — AI-native projects only)*
   - Bootstrap Session Documentation
   - Runtime Context Initialization
   - Bootstrap Validation

**Greenfield projects**: AI designs your architecture, then populates PMOS with the designed state.  
**Existing projects**: AI reads your codebase, then reflects the actual state into PMOS.

### Path B — VSC Bootstrap Prompt (reactive analysis, existing projects only)

Use [VSC-BOOTSTRAP-PROMPT.md](./VSC-BOOTSTRAP-PROMPT.md) — a lighter prompt that reads your existing codebase and populates PMOS based on what it finds. No input configuration required. Use when you want a quick bootstrap from codebase analysis rather than a structured input-driven setup.

---

## Application Bootstrap Flow

```
┌─────────────────────────────────────────────────────────┐
│  install-pmos.sh                                        │
│  → copies apps/pmos into your project                   │
│  → installs dependencies                                │
│  → creates .pmos/ + .context/ directories               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  npm run db:generate + db:push + db:seed                │
│  → creates schema in Postgres (Neon)                    │
│  → seeds generic starter data                           │
│  → PMOS ready at http://localhost:3200                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  APPLICATION-BOOTSTRAP-PROMPT.md                        │
│  → edit PROJECT INPUT BLOCK (20 lines)                  │
│  → paste into Claude / Copilot Agent                    │
│  → AI executes 9 phases autonomously                    │
│  → generates: roadmap, principles, warnings, ADRs,      │
│               execution log, runtime-context.md         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  apps/pmos/.context/runtime-context.md                  │
│  → auto-generated from live PMOS data                   │
│  → injected into GitHub Copilot automatically           │
│  → attached to Claude projects manually                 │
│  → rebuilds with: npm run context:build                 │
└─────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|---|---|
| Runtime | Next.js 14 (App Router) |
| Database | PostgreSQL (Neon recommended) |
| ORM | Prisma v5 |
| UI | Tailwind CSS v3 + dark/light theme |
| Runtime Context | `/api/context/active` (+ 11 runtime API routes) |
| Global Search | `/api/search` (Cmd+K, 8 entity types) |
| Timeline | `/api/timeline` (cross-entity chronological feed) |
| Conversation Memory | `ConversationArtifact` + 6 cross-link junction tables |
| Governance | ADR decisions, principles, warnings + `.pmos/` artifact store |
| Context Builder | `tsx scripts/build-pmos-context.ts` |

---

## Philosophy

> PMOS is not a ticket system. It is not a sprint planner.
> It is a **memory layer** — the persistent record of what your project is, why decisions were made, and what the AI should know before touching anything.

The runtime context file (`apps/pmos/.context/runtime-context.md`) is the output — a Markdown document injected into your AI assistant's context at the start of every session.
