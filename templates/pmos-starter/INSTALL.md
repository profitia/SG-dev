# PMOS Install Guide

Step-by-step instructions for embedding PMOS into a new project.

---

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database (Neon free tier recommended: https://neon.tech)

---

## STEP 1 — Install PMOS into your project

The recommended path uses the install script, which handles all file copying, dependency installation, and directory structure creation:

```bash
# From the pmos-starter directory:
bash scripts/install-pmos.sh /path/to/your/project
```

This copies `apps/pmos`, `scripts/`, and PMOS docs into your project, installs npm dependencies, and creates the `.pmos/` governance directory structure.

**Manual alternative** (if the script is unavailable):

```bash
# Copy only the app (you must also copy scripts/ and docs/ manually)
cp -r /path/to/pmos-starter/apps/pmos apps/pmos
```

If using the manual path, also copy:
```bash
cp /path/to/pmos-starter/scripts/build-pmos-context.ts scripts/
cp /path/to/pmos-starter/APPLICATION-BOOTSTRAP-PROMPT.md docs/
cp /path/to/pmos-starter/VSC-BOOTSTRAP-PROMPT.md docs/
cp /path/to/pmos-starter/PMOS-ARCHITECTURE.md docs/
cp /path/to/pmos-starter/PMOS-PHILOSOPHY.md docs/
```

Your project structure should now contain:

```
your-project/
  apps/
    pmos/
      package.json
      pmos.config.ts
      prisma/
        schema.prisma
        seed.ts
      src/
        app/
          api/           ← 12 runtime API routes (context, roadmap, timeline, search, conversations, ...)
          conversations/ ← conversation memory browser
          decisions/     ← ADR management
          logs/          ← execution logs
          principles/    ← canonical principles
          prompts/       ← AI prompt execution history
          roadmap/       ← ETAP roadmap tree
          timeline/      ← cross-entity chronological feed
          warnings/      ← architecture warnings
          changed-files/ ← file-level change tracking
        components/
        lib/
      .pmos/             ← governance artifacts (decisions, principles, warnings)
      .context/          ← runtime-context.md (AI injection)
  scripts/
    build-pmos-context.ts
```

---

## STEP 2 — Configure the project

Edit `apps/pmos/pmos.config.ts`:

```ts
export const pmosConfig = {
  projectName: 'Your Project Name',
  projectType: 'fullstack-web',          // fullstack-web | api | mobile | library | monorepo
  architectureStyle: 'event-driven',     // event-driven | layered | microservices | monolith
  domains: ['auth', 'api', 'ui'],        // your actual domains
  runtimeStyle: 'stateless',            // stateless | stateful | hybrid
  preferredStack: ['Next.js', 'Prisma'], // your stack
}
```

---

## STEP 3 — Install dependencies

```bash
cd apps/pmos
npm install
```

---

## STEP 4 — Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required — get from Neon dashboard (https://neon.tech)
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/pmos?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/pmos?sslmode=require"

# App URL (keep default for local dev)
NEXT_PUBLIC_APP_URL="http://localhost:3200"
```

### Getting Neon credentials

1. Create account at https://neon.tech
2. Create project → copy `DATABASE_URL` and `DIRECT_URL` from the dashboard
3. Paste both into `.env.local`

---

## STEP 5 — Initialize the database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# Seed with generic starter data
npm run db:seed
```

Expected output from seed:
```
Seeding PMOS...
Tags created: 15
Principles created: 5
ETAPs created: 5
Warnings created: 2
Execution log created: 1
PMOS seed complete.
```

---

## STEP 6 — Run PMOS

```bash
npm run dev
```

PMOS is available at: http://localhost:3200

You should see:
- Dashboard with 5 ETAPs
- 5 Canonical Principles
- 2 Architecture Warnings
- 1 Execution Log

---

## STEP 7 — Build runtime context

The runtime context is an auto-generated Markdown file that injects PMOS state into your AI assistant.

```bash
# From apps/pmos/ directory:
npm run context:build

# Or directly from project root (requires monorepo setup — see Turbo section below):
npx tsx scripts/build-pmos-context.ts
```

Output: `apps/pmos/.context/runtime-context.md`

This file is read by GitHub Copilot when the `.context/` directory is configured in your workspace. For Claude, attach the file manually to your project.

---

## STEP 8 — Bootstrap with AI

There are two bootstrap paths. Choose based on your project state.

### Option A — Application Bootstrap (recommended)

Use `APPLICATION-BOOTSTRAP-PROMPT.md` — the canonical PMOS bootstrap engine for all project types.

**When to use:**
- Starting a new project (greenfield)
- Starting PMOS on an existing project where you want structured governance from day one
- When you want AI to design or document your architecture as part of bootstrap

**How to use:**

1. Open `APPLICATION-BOOTSTRAP-PROMPT.md` (in the Starter-Kit root or copied to `docs/`)
2. Edit **only the PROJECT INPUT BLOCK** — the section clearly marked at the top (≈20 lines of YAML)
3. Fill in:
   - `projectName` — your project's canonical name
   - `projectPurpose` — one sentence describing what the project does and for whom
   - `projectType` — fullstack-web | api | mobile | library | monorepo | cli
   - `currentState` — greenfield | early-dev | active-dev | production | legacy
   - `primaryStack` — your technology stack
   - `primaryDomains` — functional areas (auth, api, ui, database, ai, etc.)
4. Optionally fill in: `architectureStyle`, `constraints`, `hasCIC`, deployment targets, governance model
5. Copy the full file contents (from `═══ BEGIN PROMPT ═══`) and paste into Claude or Copilot Agent mode
6. The AI executes all 9 bootstrap phases autonomously

**What it generates:**
- Project-specific ETAP roadmap (≥5 phases)
- Canonical Principles (5-10, derived from your stack and architecture)
- Architecture Warnings (≥2, from known risks and pattern analysis)
- Architectural Decisions / ADRs (≥1)
- Bootstrap Execution Log
- `apps/pmos/.context/runtime-context.md` (built from live PMOS data)

**Greenfield mode** (`currentState: greenfield`): AI designs your architecture first, then populates PMOS with the designed state. ETAPs are future-looking.

**Existing project mode** (`currentState: active-dev` etc.): AI reads your codebase first, then reflects the actual state into PMOS. Done ETAPs are marked done. Active work is marked in-progress.

---

### Option B — VSC Bootstrap Prompt (reactive analysis, existing projects only)

Use `VSC-BOOTSTRAP-PROMPT.md` — a lighter prompt that reads your codebase and populates PMOS based on what it finds. No input configuration required. Use when you want a quick reactive bootstrap from codebase analysis rather than a structured input-driven setup.

Copy the contents and paste into GitHub Copilot Chat (Agent mode). The AI will analyze your project and populate PMOS automatically.

---

## Application Bootstrap Flow (complete lifecycle)

```
1. bash scripts/install-pmos.sh /path/to/project
   → Copies apps/pmos, scripts, docs, creates .pmos/ structure

2. Edit apps/pmos/.env.local with Postgres credentials (Neon)

3. cd apps/pmos && npm run db:generate && npm run db:push && npm run db:seed
   → Creates schema, seeds generic starter data
   → PMOS available at http://localhost:3200

4. Edit PROJECT INPUT BLOCK in APPLICATION-BOOTSTRAP-PROMPT.md
   → Fill in projectName, projectPurpose, projectType, currentState, stack, domains

5. Paste prompt into Claude or Copilot Agent
   → AI executes 9 bootstrap phases
   → Generates: roadmap, principles, warnings, ADRs, execution log, runtime-context.md

6. Review generated content at http://localhost:3200
   → Adjust any roadmap nodes or principles that don't match your intent

7. Start working on ETAP 1 (or the active ETAP for existing projects)
   → After each significant session: npm run context:build
   → Context file updates automatically → AI has current state next session
```


---

## Turbo / Monorepo Setup

If your project uses Turborepo, add to `turbo.json`:

```json
{
  "tasks": {
    "context:build": {
      "dependsOn": [],
      "outputs": ["apps/pmos/.context/**"]
    }
  }
}
```

And to root `package.json`:

```json
{
  "scripts": {
    "context:build": "cd apps/pmos && tsx ../../scripts/build-pmos-context.ts"
  }
}
```

---

## Troubleshooting

**`db:push` fails — SSL error**
```env
# Try adding to DATABASE_URL:
?sslmode=require&ssl=true
```

**`db:seed` fails — Prisma client not found**
```bash
npm run db:generate   # regenerate Prisma client first
```

**Context build fails — PMOS not running**
```bash
# PMOS must be running before context:build
npm run dev &
sleep 3
npm run context:build
```

**Port 3200 in use**
Edit `package.json`:
```json
"dev": "next dev --port 3201"
```
And update `NEXT_PUBLIC_APP_URL` in `.env.local`.
