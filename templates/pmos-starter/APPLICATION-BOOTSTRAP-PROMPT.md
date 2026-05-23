# APPLICATION-BOOTSTRAP-PROMPT
## PMOS — Canonical Project Bootstrap Engine

> **Version**: 1.0  
> **Purpose**: Bootstrap a fully initialized PMOS runtime ecosystem for any new project.  
> **Compatible**: GitHub Copilot Agent mode, Claude Projects, any AI with file-system tool access.

---

## HOW TO USE

1. Install PMOS via `bash scripts/install-pmos.sh /path/to/project`
2. Start PMOS: `cd apps/pmos && npm run dev`
3. Open this file
4. **Edit ONLY the PROJECT INPUT BLOCK** (Section 2 below)
5. Copy the entire file contents starting from the `═══ BEGIN PROMPT ═══` separator
6. Paste into Claude or GitHub Copilot Agent mode
7. The AI will execute all 9 phases without further input

---

> The prompt below is self-contained. Do not send partial sections.  
> Do not inject additional context around it.  
> The AI will ask for clarification only if critical required inputs are missing.

---

═══════════════════════════════════════════════════════════════
═══ BEGIN PROMPT — COPY EVERYTHING BELOW THIS LINE ════════════
═══════════════════════════════════════════════════════════════

---

## SECTION 1 — SYSTEM IDENTITY

You are an expert software architect and PMOS runtime engineer. Your task is to execute a complete **project bootstrap sequence** using the PMOS runtime system.

**What PMOS is:**

PMOS (Project Memory Operating System) is an embedded, local-first development memory runtime. It is NOT a project management tool. It is the persistent memory layer between a project and its AI assistant. It stores:

- **RoadmapNode** — hierarchical execution tree (ETAPs and sub-tasks)
- **CanonicalPrinciple** — architecture rules the AI must know and respect
- **ArchitectureWarning** — active risks, drifts, violations
- **Decision** — architectural decisions with full reasoning (ADRs)
- **ExecutionLog** — structured record of what was built, why, what changed
- **PromptExecution** — log of AI-assisted sessions with blockers and next steps
- **ChangedFile** — per-file change records with impact levels
- **ConversationArtifact** — persistent AI conversation memory, cross-linked to all entities

PMOS exposes a REST API at `http://localhost:{pmosPort}` (default: 3200).  
All data is written via POST requests to this API.  
The context builder generates `apps/pmos/.context/runtime-context.md` from live PMOS data.  
This Markdown file is the AI injection artifact — it is read by GitHub Copilot and other AI tools automatically.

**Your task:**

Execute the 9-phase bootstrap sequence defined in Section 4, using the project parameters defined in Section 2. Follow the execution rules in Section 3 exactly. Generate all output artifacts defined in Section 7. Complete the validation checklist in Section 8 before declaring bootstrap complete.

---

## SECTION 2 — PROJECT INPUT BLOCK

> ═══════════════════════════════════════════════════════════
> USER: EDIT ONLY THIS SECTION. DO NOT MODIFY ANYTHING BELOW.
> ═══════════════════════════════════════════════════════════

```yaml
# ─── A. REQUIRED INPUTS ──────────────────────────────────────────────────────
# These fields are mandatory. Bootstrap cannot proceed without them.

projectName:         "SpendGuru 2.0 Development"
# The canonical display name. Used in all generated artifacts.
# Examples: "Profitia", "CIC", "SG2", "Lexaro", "ProcurementAI"

projectPurpose:      "Budowa aplikacji zakupowej w nowej wersji."
# Be precise. This drives principle generation, warning detection, and roadmap design.
# Examples:
#   "AI-native spend analytics platform for procurement teams — negotiation-first intelligence."
#   "Conversational intelligence core — runtime memory and session management for AI agents."
#   "B2B SaaS for supplier evaluation and contract negotiation automation."

projectType:         fullstack-web
# Options: fullstack-web | api | mobile | library | monorepo | cli

currentState:        greenfield
# Options:
#   greenfield    — no code exists yet. AI designs architecture, then populates PMOS.
#   early-dev     — skeleton exists. Some structure, no production-ready features.
#   active-dev    — substantial work done. Multiple ETAPs complete or in progress.
#   production    — live, serving real users. Minimal risk tolerance.
#   legacy        — existing system, possibly partially migrated.

primaryStack:
  - "Next.js 15"
  - "TypeScript"
  - "Prisma"
  - "PostgreSQL"
# List all major technologies. Include: framework, language, DB, runtime, key libraries.

primaryDomains:
  - auth
  - api
  - ui
  - database
# List all functional domains in this project.
# Examples: auth, api, ui, database, ai, payments, notifications, integrations,
#           events, queue, analytics, search, recommendations, memory

# ─── B. OPTIONAL INPUTS ──────────────────────────────────────────────────────
# Providing these significantly improves bootstrap quality.

architectureStyle:   layered
# Options: event-driven | layered | microservices | monolith | serverless | hybrid
# If unknown, omit and AI will infer from primaryStack + projectType.

runtimeStyle:        stateless
# Options: stateless | stateful | hybrid | event-loop | streaming

teamSize:            solo
# Options: solo | small-team (2-5) | large-team (6+)

existingWork:        ""
# Free text description of work already done. Use ONLY for currentState: early-dev, active-dev, production, legacy.
# Examples:
#   "Auth layer complete (NextAuth v5, JWT). Database schema defined (23 models). No frontend yet."
#   "Core API complete. Payment integration in progress. Dashboard not started."
# Leave empty for currentState: greenfield.

activeEtapDescription: ""
# What is currently being worked on? One sentence.
# Examples:
#   "ETAP 4 — Dashboard & Data Display. Building first user-facing views."
#   "ETAP 2 — API Layer. Implementing CRUD endpoints for core domain models."
# Leave empty for currentState: greenfield.

constraints:
  # Technical constraints that MUST be reflected in principles and warnings.
  # - "No raw SQL — Prisma only"
  # - "Server Components by default, use client only when necessary"
  # - "All AI calls isolated to server actions or API routes — never from components"
  # - "No shared secrets between microservices"
  # Remove the comment character (#) from lines you want to activate.

# ─── C. ADVANCED INPUTS ──────────────────────────────────────────────────────
# Pre-seed the AI with known architectural facts. Optional but powerful.

canonicalPrinciples:
  # Pre-define principles the AI must create exactly as specified.
  # Format: { title, description, priority }
  # Remove comment character to activate.
  # - title: "Negotiation-first"
  #   description: "Every feature must trace back to improving negotiation outcomes. Analytics are a means, not the end."
  #   priority: high

knownRisks:
  # Pre-seed the warning register with known risks.
  # Format: { title, description, severity, type }
  # Types: dashboard_gravity | runtime_boundary | business_logic_leak |
  #        orchestration_drift | overengineering | prompt_coupling | architecture_debt
  # - title: "Analytics creep"
  #   description: "Risk of building a reporting dashboard instead of a negotiation intelligence tool."
  #   severity: high
  #   type: architecture_debt

initialADRs:
  # Pre-seed architectural decisions already made.
  # Format: { title, decision, reason, impact }
  # - title: "JWT sessions over DB sessions"
  #   decision: "NextAuth JWT strategy — no session table in database."
  #   reason: "Reduces DB load, eliminates session invalidation complexity at this scale."
  #   impact: "Auth state is stateless. Logout must be handled client-side via cookie clearing."

boundaryRules:
  # Explicit layer/domain boundary definitions. Become principles and warnings.
  # - "AI calls only from server actions or API routes — never from UI components"
  # - "No business logic in pages — domain logic lives in lib/domain/"
  # - "External APIs only accessed via dedicated integration modules"

# ─── D. CIC INPUTS ───────────────────────────────────────────────────────────
# Only relevant if this project has a Conversational Intelligence layer.

hasCIC:              false
# Set to true ONLY if this project has an embedded conversational intelligence runtime.
# When true, Phase 6 (CIC Integration) activates.

cicDescription:      ""
# What the CIC does. How it works. Where it lives in the codebase.
# Example: "Conversational intelligence core in packages/ncic/. Handles memory sessions,
#           context windows, message routing, and runtime adaptation for AI agents."

cicPackagePath:      ""
# Relative path to the CIC package/module.
# Example: "packages/ncic" or "src/lib/ai/cic"

conversationTypes:
  # Types of conversations this project handles.
  # - "procurement-analysis"
  # - "negotiation-prep"
  # - "user-onboarding"

memoryStrategy:      ""
# How conversations are persisted and recalled.
# Examples:
#   "Session-scoped with cross-session summary"
#   "Full history with sliding context window"
#   "Event-driven with domain-scoped memory partitions"

# ─── E. INFRASTRUCTURE INPUTS ────────────────────────────────────────────────

pmosPort:            3200
# Port PMOS is running on. Default: 3200. Change if conflicting.

deploymentTargets:
  local:       "http://localhost:3100"
  # staging:   ""      # uncomment if staging environment exists
  # production: ""     # uncomment if production environment exists

cloudProvider:       ""
# Options: vercel | aws | gcp | azure | railway | fly | self-hosted
# Leave empty if not yet decided.

dbProvider:          neon
# Options: neon | planetscale | supabase | rds | self-hosted | turso

# ─── F. GOVERNANCE INPUTS ────────────────────────────────────────────────────

governanceModel:     standard
# Options:
#   lightweight — minimal governance, focus on speed
#   standard    — principles + warnings + ADRs (recommended)
#   strict      — full ADR chain, mandatory review gates

riskTolerance:       medium
# Options: low | medium | high
# Affects severity thresholds for generated warnings.

complianceRequirements:
  # - gdpr
  # - hipaa
  # - soc2
  # Uncomment relevant compliance requirements.
```

> ═══════════════════════════════════════════════════════════
> END OF EDITABLE SECTION. DO NOT EDIT BELOW THIS LINE.
> ═══════════════════════════════════════════════════════════

---

## SECTION 3 — EXECUTION RULES

Before beginning any phase, read and internalize these rules. Violation of any rule constitutes a bootstrap failure.

### 3.1 — Input Interpretation Rules

1. **The INPUT BLOCK is the only truth source.** Do not derive project facts from the workspace, from other open files, or from prior conversation context unless explicitly instructed by Phase 2 (Architecture Definition).
2. **`projectName` is sacred.** Every artifact, every API call, every principle title, every ETAP name must be consistent with `projectName`. Never use generic names like "My Project", "App", "Service".
3. **If a required input is empty or defaulted**, halt at Phase 1 and ask the user to fill it before proceeding.
4. **Optional inputs that are empty** are skipped, not guessed. Do not invent values for optional fields the user left blank.
5. **`constraints` activate immediately.** Each constraint in the `constraints` list MUST become a canonical principle in Phase 4.

### 3.2 — Determinism Rules

1. **Same inputs produce the same outputs.** If the prompt is run twice with identical inputs, the resulting PMOS state must be semantically identical.
2. **All generated names follow a naming convention.** ETAPs are named `ETAP N — [Descriptive Title]`. ADRs are named `ADR-[N] — [Title]`. Principles have short, memorable titles. Warnings have concise, actionable titles.
3. **Ordering is explicit.** Roadmap nodes have numeric `order` fields. ETAPs use multiples of 100 (100, 200, 300...). Sub-nodes use sequential integers within their parent.
4. **Status is honest.** For existing projects, status reflects actual state. `done` only for demonstrably complete work. `in_progress` for only ONE node at a time (the active ETAP or active sub-node). `backlog` for all future work.

### 3.3 — Idempotency Rules

1. **Before creating any entity, check for duplicates.** Use the PMOS search API (`GET /api/search?q=[title]`) to verify the entity does not already exist.
2. **If data already exists in PMOS**, do not overwrite it. Log a PHASE GATE REPORT note that existing data was found and preserved.
3. **The generic seed data** (5 placeholder ETAPs, 5 generic principles, 2 generic warnings) MUST be replaced, not augmented. If seed data is detected (titles match generic seed names: "ETAP 1 — Foundation", "Runtime-first", etc.), it is acceptable to work alongside it — but the project-specific data must be clearly distinct and more specific.
4. **Never create duplicate roadmap nodes.** If a node with the same title already exists under the same parent, skip creation and log the skip.

### 3.4 — Phase Gate Protocol

After completing each phase, output a **PHASE GATE REPORT** in this exact format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE [N] GATE — [PHASE NAME]
Status: PASS | FAIL
Artifacts created: [count and type]
Issues: [none | list issues]
Proceeding to: Phase [N+1] — [Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If Status is FAIL: stop, describe the failure, and ask the user for guidance. Do not proceed to Phase N+1 on a FAIL.

---

## SECTION 4 — MODE DETECTION

Before executing any phase, determine the operational mode from the `currentState` input:

```
currentState = greenfield
  → GREENFIELD MODE
  → AI designs architecture FIRST, then populates PMOS
  → Phase 2: AI proposes architecture → no codebase reads required
  → Phase 5: AI designs ETAPs from purpose + type + domains (future-looking)
  → Phases 1-9 are DESIGN-FIRST, then POPULATE

currentState = early-dev | active-dev | production | legacy
  → EXISTING PROJECT MODE
  → AI reads codebase FIRST, then reflects actual state into PMOS
  → Phase 2: AI reads workspace files before making any architectural claims
  → Phase 5: AI maps actual history (done ETAPs) + active + future
  → Phases 1-9 are ANALYZE-FIRST, then REFLECT
```

Announce the detected mode at the start of Phase 1:

```
MODE DETECTED: [GREENFIELD | EXISTING PROJECT]
Reason: currentState = [value]
Behavioral consequences: [one sentence per affected phase]
```

---

## SECTION 5 — PHASE ENGINE

Execute phases in order. Do not skip phases. Do not run phases in parallel. Output a PHASE GATE REPORT after each phase.

---

### PHASE 1 — Project Identity Validation

**A. GOAL**  
Confirm that PMOS is running, all required inputs are valid, and the bootstrap can proceed.

**B. SUBTASKS**

1. Verify PMOS is reachable: `GET http://localhost:{pmosPort}/api/context/active`
   - If response is not 200: halt and instruct the user to start PMOS (`cd apps/pmos && npm run dev`)
2. Read and confirm the PROJECT INPUT BLOCK values
3. Verify all required fields are non-empty and non-defaulted:
   - `projectName` ≠ "My Project"
   - `projectPurpose` ≠ "One sentence: what the project does and for whom."
   - `projectType` is a valid value
   - `currentState` is a valid value
   - `primaryStack` has at least 1 entry
   - `primaryDomains` has at least 1 entry
4. Announce detected mode (Greenfield or Existing Project)
5. Read `apps/pmos/pmos.config.ts` — note the current `projectName` and `port` values
6. Confirm `pmos.config.ts` `projectName` matches input block `projectName`. If not, note the discrepancy (do not auto-update `pmos.config.ts` — flag for user)

**C. EXPECTED OUTPUTS**
- PMOS connectivity confirmation (HTTP 200 from `/api/context/active`)
- Input validation summary (all required fields confirmed non-empty)
- Mode announcement
- `pmos.config.ts` discrepancy note (if any)

**D. VALIDATION RULE**  
PMOS must respond with HTTP 200. All required inputs must be non-empty and non-defaulted.

**E. FAIL CONDITIONS**
- PMOS not running (HTTP error or connection refused)
- Any required input is empty or still set to the template default
- `projectType` or `currentState` has an invalid value

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 2.

---

### PHASE 2 — Architecture Definition

**A. GOAL**  
Establish the authoritative architecture description for this project. Behavior differs by mode.

**B. SUBTASKS**

*GREENFIELD MODE:*
1. Based on `projectType`, `projectPurpose`, `primaryStack`, `primaryDomains`, `architectureStyle`, propose the following:
   - **Layer Map**: which architectural layers will exist (e.g. presentation, application, domain, infrastructure, AI)
   - **Domain Boundaries**: which domains are isolated, which interact, which share state
   - **Primary Patterns**: the key patterns to enforce (e.g. repository pattern, server-only AI calls, event-based cross-domain communication)
   - **Anti-Patterns to Avoid**: 3-5 specific patterns to guard against given this project type
2. If `boundaryRules` was provided, incorporate them into the Layer Map
3. Output the architecture description as a structured summary

*EXISTING PROJECT MODE:*
1. Read the following files (in order, stop when you have enough confidence):
   - `README.md` or `AGENTS.md` at project root
   - `package.json` at project root
   - `docs/architecture.md` if it exists
   - Source directory structure (list key directories, do not read all files)
   - 2-3 key source files that reveal architectural patterns
2. Identify:
   - Actual layer structure (where business logic lives, where data access lives)
   - Existing patterns (repository, server components, event-driven, etc.)
   - Anti-patterns already present (if any)
   - Constraints already enforced (from code structure, not from documentation)
3. Output the architecture description as a structured summary
4. Note any discrepancies between `INPUT BLOCK` values and actual codebase reality

**C. EXPECTED OUTPUTS**
- Architecture description: Layer Map, Domain Boundaries, Primary Patterns, Anti-Patterns to Avoid
- For existing projects: discrepancy notes between input block and codebase reality

**D. VALIDATION RULE**  
Architecture description must be project-specific. It must not be generic enough to apply to a different project. Every pattern mentioned must be traceable to either the input block or (existing mode) an actual file read.

**E. FAIL CONDITIONS**
- Architecture description contains generic statements not traceable to project inputs or codebase
- Existing mode: architectural claims made without having read at least 2 source files
- Greenfield mode: architecture not coherent with stated `projectType` and `primaryDomains`

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 3.

---

### PHASE 3 — Runtime Topology

**A. GOAL**  
Map all runtime environments, services, ports, and deployment targets for this project.

**B. SUBTASKS**

1. Build the **Runtime Topology Map** from `deploymentTargets`, `cloudProvider`, `dbProvider`, and the architecture description from Phase 2:

```
Runtime Topology — {projectName}
─────────────────────────────────────────────
Environment    URL                    Status
─────────────────────────────────────────────
local          {deploymentTargets.local}      active
[staging]      {deploymentTargets.staging}    [if provided]
[production]   {deploymentTargets.production} [if provided]
─────────────────────────────────────────────
PMOS           http://localhost:{pmosPort}    running
─────────────────────────────────────────────
Database       {dbProvider}                   required
Cloud          {cloudProvider}                [if provided]
─────────────────────────────────────────────
```

2. Identify **Environment Parity Risks** — things that differ between environments that could cause bugs:
   - Auth redirects
   - Email sending (must be suppressed in non-production)
   - Webhook signatures
   - Environment-gated features

3. For each parity risk identified, note it as a candidate for a warning (to be created in Phase 4)

4. If `complianceRequirements` is non-empty, note the compliance implications for the runtime topology (e.g. GDPR: data residency requirements for database provider)

**C. EXPECTED OUTPUTS**
- Runtime Topology Map (tabular)
- List of Environment Parity Risks (if any)
- Compliance topology notes (if `complianceRequirements` non-empty)

**D. VALIDATION RULE**  
All entries in `deploymentTargets` must appear in the topology map. If `cloudProvider` is specified, the deployment topology must reflect it.

**E. FAIL CONDITIONS**
- Topology map contains environment entries not in `deploymentTargets`
- Compliance requirements mentioned but no compliance notes generated

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 4.

---

### PHASE 4 — Governance Bootstrap

**A. GOAL**  
Initialize the PMOS governance layer: Canonical Principles, Architecture Warnings, and Decisions (ADRs).

**B. SUBTASKS**

**4.1 — Canonical Principles**

Generate principles from the following sources (in priority order):
1. Each entry in `canonicalPrinciples` (from INPUT BLOCK) → create exactly as specified
2. Each entry in `constraints` → convert to a principle
3. Each boundary rule in `boundaryRules` → convert to a principle
4. Principles derived from `architectureStyle` and `primaryDomains` (inferred from Phase 2 architecture description)

Minimum: 5 principles. Maximum: 10.  
Priority distribution: at least 3 `high`, remainder `medium`.  
A principle must state: WHAT the rule is AND WHAT PROBLEM it prevents.

API call format:
```
POST http://localhost:{pmosPort}/api/principles
Content-Type: application/json

{
  "title": "[Short memorable rule name]",
  "description": "[What the rule is and what it enforces. One to three sentences.]",
  "reason": "[The specific failure mode this principle prevents. Name the actual risk.]",
  "priority": "high"
}
```

**4.2 — Architecture Warnings**

Generate warnings from the following sources:
1. Each entry in `knownRisks` (from INPUT BLOCK) → create exactly as specified
2. Environment parity risks identified in Phase 3 → convert to warnings (severity matches risk level)
3. Anti-patterns identified in Phase 2 → if already present in codebase, create warnings
4. Compliance risks derived from `complianceRequirements`
5. CIC-specific risks if `hasCIC: true`

Minimum: 2 warnings. For existing projects with `riskTolerance: low`, minimum is 3.

```
POST http://localhost:{pmosPort}/api/warnings
Content-Type: application/json

{
  "title": "[Short actionable warning title]",
  "description": "[What the risk is, where it lives, what could go wrong if unaddressed.]",
  "severity": "high",
  "type": "runtime_boundary",
  "affectedArea": "[file path or module name, if known]"
}
```

Warning types: `dashboard_gravity` | `runtime_boundary` | `business_logic_leak` | `orchestration_drift` | `overengineering` | `prompt_coupling` | `architecture_debt`

**4.3 — Initial ADR Set**

Create decisions from:
1. Each entry in `initialADRs` (from INPUT BLOCK) → create exactly as specified
2. Technology selection decisions derivable from `primaryStack` (e.g. "Why Prisma over raw SQL")
3. Architecture style decision: why `architectureStyle` was chosen for this `projectType`

Minimum: 1 ADR (the architecture style decision). Maximum: 5 ADRs in bootstrap.

```
POST http://localhost:{pmosPort}/api/decisions
Content-Type: application/json

{
  "title": "[Decision name — concise]",
  "decision": "[What was decided. Present tense. Clear and unambiguous.]",
  "reason": "[Why this was the right choice given the constraints.]",
  "impact": "[What this decision affects. What it makes easier. What it makes harder.]",
  "affectedSystems": ["[domain or module name]"]
}
```

**C. EXPECTED OUTPUTS**
- ≥5 Canonical Principles created via API (confirmed with HTTP 201)
- ≥2 Architecture Warnings created via API (confirmed with HTTP 201)
- ≥1 ADR Decision created via API (confirmed with HTTP 201)
- All HTTP responses confirmed successful

**D. VALIDATION RULE**  
Every principle must be specific to this project — it must reference the actual `projectPurpose`, `primaryDomains`, or `architectureStyle`. Generic principles like "Write clean code" or "Test everything" are not acceptable. Every warning must describe a concrete risk, not a vague concern.

**E. FAIL CONDITIONS**
- Any principle title is a generic engineering platitude
- Any warning is non-specific (no affected area, no mechanism of harm)
- Any API call returns non-201 response
- Fewer than 5 principles or fewer than 2 warnings created

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 5.

---

### PHASE 5 — Roadmap Generation

**A. GOAL**  
Create a project-specific ETAP roadmap in PMOS. Behavior differs by mode.

**B. SUBTASKS**

*GREENFIELD MODE:*

1. Design a realistic ETAP tree based on: `projectPurpose`, `projectType`, `primaryDomains`, `primaryStack`
2. Structure: 5-8 root ETAPs representing major development phases
3. Under each ETAP: 2-4 sub-nodes representing specific deliverables
4. Status: ALL ETAPs are `backlog`. Mark the first ETAP as the natural starting point.
5. Priority: Foundation/infrastructure ETAPs → `high`. Feature ETAPs → `medium` or `high`. Enhancement ETAPs → `medium`.
6. ETAP names must be project-specific. Never use: "Setup", "MVP", "Phase 1" (alone), "Testing", "Launch" (as a standalone phase)

*EXISTING PROJECT MODE:*

1. Based on `existingWork`, `activeEtapDescription`, and the Phase 2 codebase analysis, reconstruct the actual ETAP history:
   - Work that is clearly complete → `done`
   - Current active work → `in_progress` (maximum ONE node)
   - Planned future work → `backlog`
2. Create sub-nodes for significant sub-tasks within done ETAPs (at least for the active ETAP)
3. Future ETAPs must be realistic given what exists — not wishful thinking

**Root node API call:**
```
POST http://localhost:{pmosPort}/api/roadmap
Content-Type: application/json

{
  "title": "ETAP 1 — [Descriptive Title Specific to This Project]",
  "description": "[What this phase delivers and why it matters for this project.]",
  "status": "backlog",
  "priority": "high",
  "order": 100,
  "sortKey": "001"
}
```

**Sub-node API call:**
```
POST http://localhost:{pmosPort}/api/roadmap
Content-Type: application/json

{
  "title": "1.1 — [Specific Deliverable]",
  "description": "[What this deliverable is and what it enables.]",
  "status": "backlog",
  "priority": "high",
  "parentId": "[id returned from parent ETAP creation]",
  "order": 1,
  "sortKey": "001.001"
}
```

**C. EXPECTED OUTPUTS**
- ≥5 root ETAP nodes created (confirmed with IDs returned from API)
- ≥2 sub-nodes per ETAP for the active or first ETAP
- All IDs captured (needed for CIC and context phases)
- Roadmap accurately reflects `currentState`:
  - Greenfield: all `backlog`
  - Existing: mix of `done`, `in_progress` (max 1), `backlog`

**D. VALIDATION RULE**  
No ETAP title may be generic. Each must contain language specific to `projectName` or `projectPurpose`. The active ETAP (if `currentState` ≠ greenfield) must match `activeEtapDescription` from the input block.

**E. FAIL CONDITIONS**
- Any ETAP title uses generic names: "Setup", "MVP", "Cleanup", "Miscellaneous"
- More than one node has `status: in_progress`
- Greenfield project has `done` nodes
- Existing project active ETAP doesn't match `activeEtapDescription`
- Fewer than 5 root ETAPs

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 6 (if `hasCIC: true`) or Phase 7 (if `hasCIC: false`).

---

### PHASE 6 — CIC Integration *(Conditional — skip if `hasCIC: false`)*

**A. GOAL**  
Bootstrap the Conversational Intelligence layer in PMOS: seed conversation types, memory semantics, and the CIC-PMOS bridge.

**B. SUBTASKS**

1. Verify `hasCIC: true` in input block. If false, skip this phase entirely and note "Phase 6 SKIPPED — hasCIC: false" in the gate report.

2. Validate CIC inputs are present:
   - `cicDescription` is non-empty
   - `cicPackagePath` is non-empty
   - `conversationTypes` has at least 1 entry
   - `memoryStrategy` is non-empty

3. Create a **CIC Architecture Warning** if `cicPackagePath` was provided but directory does not exist in workspace:
   ```
   POST http://localhost:{pmosPort}/api/warnings
   {
     "title": "CIC package path not found",
     "description": "cicPackagePath '{cicPackagePath}' was declared but not found in workspace. CIC integration is declared but not yet implemented.",
     "severity": "medium",
     "type": "orchestration_drift",
     "affectedArea": "{cicPackagePath}"
   }
   ```

4. Create a **CIC Conversation Artifact** as the first PMOS conversation entry:
   ```
   POST http://localhost:{pmosPort}/api/conversations
   Content-Type: application/json

   {
     "project": "{projectName}",
     "title": "PMOS Bootstrap — CIC Architecture Session",
     "type": "architecture",
     "summary": "Initial CIC architecture definition for {projectName}. Defined conversation types: {conversationTypes joined}. Memory strategy: {memoryStrategy}. CIC package: {cicPackagePath}.",
     "keyDecisions": [
       "CIC architecture declared as part of project bootstrap.",
       "Memory strategy: {memoryStrategy}",
       "Conversation types established: {conversationTypes}"
     ],
     "nextSteps": ["Implement CIC package at {cicPackagePath}", "Connect conversation routing to PMOS ConversationArtifact model"]
   }
   ```

5. Create a **CIC Principle** for each conversation type declared:
   ```
   POST http://localhost:{pmosPort}/api/principles
   {
     "title": "CIC — {conversationType} isolation",
     "description": "Conversations of type '{conversationType}' are processed by dedicated handlers. No cross-type contamination.",
     "reason": "Mixed conversation type handling leads to context bleed and degraded memory accuracy.",
     "priority": "high"
   }
   ```

6. Create a **CIC Memory Architecture ADR**:
   ```
   POST http://localhost:{pmosPort}/api/decisions
   {
     "title": "CIC Memory Strategy — {projectName}",
     "decision": "{memoryStrategy}",
     "reason": "Declared memory strategy based on conversation volume, session patterns, and domain requirements.",
     "impact": "Affects ConversationArtifact retention, context window sizing, and cross-session recall accuracy.",
     "affectedSystems": ["cic", "memory", "conversations"]
   }
   ```

**C. EXPECTED OUTPUTS**
- CIC Architecture Warning (if package path missing)
- 1 Bootstrap ConversationArtifact
- 1 CIC principle per conversation type (or 1 general CIC principle if types are generic)
- 1 CIC Memory Architecture ADR

**D. VALIDATION RULE**  
CIC artifacts must only be created when `hasCIC: true`. The ConversationArtifact `project` field must match `projectName` exactly. No CIC terminology (conversation types, memory strategy) must appear in non-CIC phases.

**E. FAIL CONDITIONS**
- `hasCIC: true` but `cicDescription` or `cicPackagePath` is empty (halt and request input)
- CIC artifacts created with `hasCIC: false`
- `project` field in ConversationArtifact does not match `projectName`

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 7.

---

### PHASE 7 — Bootstrap Session Documentation

**A. GOAL**  
Document the bootstrap session in PMOS: create an ExecutionLog and PromptExecution record, and specify the context injection strategy for this project's AI tooling.

**B. SUBTASKS**

1. Determine the **Context Injection Strategy** based on input:
   - GitHub Copilot: reads `.context/` directory automatically
   - Claude: file must be pasted or attached as project document
   - Both: hybrid mode — file exists in `.context/` AND user should attach to Claude project

2. Create an **Execution Log** documenting the bootstrap session:
   ```
   POST http://localhost:{pmosPort}/api/logs
   Content-Type: application/json

   {
     "title": "PMOS Bootstrap — {projectName} Initial Setup",
     "summary": "[Describe what was set up in this bootstrap session: how many ETAPs, principles, warnings, ADRs were created, what the project identity is, what mode was used.]",
     "architecturalImpact": "[Describe the architectural decisions made: chosen architecture style, key principles established, critical warnings raised, CIC integration status.]",
     "changedFiles": ["apps/pmos/pmos.config.ts", "apps/pmos/.context/runtime-context.md"],
     "nextSteps": "[What should happen after this bootstrap: first ETAP to work on, first feature to implement, first principle to validate against.]",
     "canonicalAlignment": "high"
   }
   ```

3. Create a **PromptExecution** record for this bootstrap:
   ```
   POST http://localhost:{pmosPort}/api/prompts
   Content-Type: application/json

   {
     "title": "APPLICATION-BOOTSTRAP-PROMPT — {projectName}",
     "etap": "bootstrap",
     "subetap": "0",
     "node": "Project Bootstrap",
     "domain": "architecture",
     "promptType": "bootstrap",
     "promptContent": "APPLICATION-BOOTSTRAP-PROMPT executed for {projectName}.",
     "executionSummary": "[One paragraph summary of the full bootstrap: what was created, what mode was used, what the project is.]",
     "status": "completed"
   }
   ```

4. Document the **Context Lifecycle** for this project:
   ```
   Context Lifecycle — {projectName}
   ─────────────────────────────────────────────────────────
   Generation:    npm run context:build (from apps/pmos/)
   Output:        apps/pmos/.context/runtime-context.md
   Frequency:     Rebuild after each ETAP completion or major session
   AI Injection:  [GitHub Copilot: automatic | Claude: manual attachment]
   Trigger:       PMOS must be running (localhost:{pmosPort})
   ─────────────────────────────────────────────────────────
   ```

**C. EXPECTED OUTPUTS**
- Context Injection Strategy documented
- Bootstrap ExecutionLog created (HTTP 201)
- PromptExecution record created (HTTP 201)
- Context Lifecycle documented

**D. VALIDATION RULE**  
The ExecutionLog summary must be specific to this project — it must name `projectName`, list the actual counts of artifacts created, and describe the actual architecture from Phase 2.

**E. FAIL CONDITIONS**
- ExecutionLog summary is generic (could apply to any project)
- Any API call returns non-201
- Context Injection Strategy not specified

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 8.

---

### PHASE 8 — Runtime Context Initialization

**A. GOAL**  
Build the first `runtime-context.md` from the populated PMOS data and verify it accurately describes the project.

**B. SUBTASKS**

1. Instruct the user to run the context builder:
   ```bash
   # From project root:
   npx tsx scripts/build-pmos-context.ts
   
   # Or from apps/pmos/:
   npm run context:build
   ```
   
   If the AI has terminal access, execute this directly.

2. Verify the output file exists at `apps/pmos/.context/runtime-context.md`

3. Read the generated `runtime-context.md` and verify it contains:
   - The correct `projectName` (not "My Project" or a template default)
   - At least one active ETAP reference
   - At least one canonical principle
   - At least one architecture warning (if any were created)
   - The correct `pmosPort` in any URL references

4. If the file still contains generic/template content, note the discrepancy and provide the corrective action (re-run context build, or verify PMOS data was successfully written in previous phases)

5. If PMOS was seeded with the generic seed data (ETAPs 1-5, generic principles), note that both seed data and project-specific data now coexist. Recommend running `db:seed --fresh` in the future when the project-specific roadmap is complete and the seed data is no longer needed.

**C. EXPECTED OUTPUTS**
- `apps/pmos/.context/runtime-context.md` exists
- File content is verified as project-specific (contains `projectName`, real ETAP, real principle)
- Any discrepancies documented

**D. VALIDATION RULE**  
The `runtime-context.md` must not contain the string "My Project" or "Generic" in any section that represents the active project state. It must reflect data created in Phases 4-7.

**E. FAIL CONDITIONS**
- File does not exist after context build attempt
- File contains generic template content without project-specific overrides
- `runtime-context.md` active ETAP does not match Phase 5 roadmap

**F. NEXT PHASE GATE**  
Output PHASE GATE REPORT. On PASS → proceed to Phase 9.

---

### PHASE 9 — Bootstrap Validation

**A. GOAL**  
Execute a comprehensive validation of all bootstrap outputs before declaring the bootstrap complete.

**B. SUBTASKS**

Run the following validation checks in sequence. Each check is binary: PASS or FAIL.

**Validation Matrix:**

| Check | Method | Pass Criteria |
|---|---|---|
| V1 | `GET /api/context/active` | HTTP 200, `activeEtap` is not null |
| V2 | `GET /api/roadmap` | Returns ≥5 nodes |
| V3 | `GET /api/principles` | Returns ≥5 principles |
| V4 | `GET /api/warnings` | Returns ≥2 warnings |
| V5 | `GET /api/decisions` | Returns ≥1 decision |
| V6 | `GET /api/logs` | Returns ≥1 log |
| V7 | `GET /api/prompts` | Returns ≥1 prompt execution |
| V8 | File check | `apps/pmos/.context/runtime-context.md` exists and is non-empty |
| V9 | Content check | `runtime-context.md` does not contain "My Project" |
| V10 | Content check | `runtime-context.md` contains `{projectName}` |
| V11 (cond.) | `GET /api/conversations` | Returns ≥1 (only if `hasCIC: true`) |

Output the validation matrix with PASS/FAIL for each check.

**C. EXPECTED OUTPUTS**
- Validation matrix with all checks executed
- Summary: total PASS / total FAIL
- For each FAIL: remediation instruction

**D. VALIDATION RULE**  
V1-V10 must all PASS. V11 must PASS if `hasCIC: true`. Any FAIL in V1-V10 is a bootstrap failure.

**E. FAIL CONDITIONS**
- Any of V1-V10 returns FAIL
- V11 returns FAIL when `hasCIC: true`

**F. BOOTSTRAP COMPLETION**

If all required validations pass, output the **BOOTSTRAP COMPLETION REPORT**:

```
╔══════════════════════════════════════════════════════════════╗
║  PMOS BOOTSTRAP COMPLETE                                     ║
╠══════════════════════════════════════════════════════════════╣
║  Project:        {projectName}                               ║
║  Mode:           [GREENFIELD | EXISTING PROJECT]             ║
║  ETAPs:          [count]                                     ║
║  Principles:     [count]                                     ║
║  Warnings:       [count]                                     ║
║  ADRs:           [count]                                     ║
║  Execution Logs: 1                                           ║
║  CIC:            [ACTIVE | NOT CONFIGURED]                   ║
║  Context:        apps/pmos/.context/runtime-context.md ✓    ║
╠══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                 ║
║  1. Review generated roadmap at http://localhost:{pmosPort}  ║
║  2. Verify principles match your architectural intent        ║
║  3. Review and acknowledge active warnings                   ║
║  4. Begin work on: [first backlog ETAP title]                ║
║  5. Rebuild context after first real session:                ║
║     npm run context:build                                    ║
╚══════════════════════════════════════════════════════════════╝
```

---

## SECTION 6 — CIC EXTENSION BLOCK

This section is the reference specification for CIC-PMOS integration semantics. It is activated only when `hasCIC: true`.

### 6.1 — Conversation Type Taxonomy

All conversation types declared in `conversationTypes` must be consistent with the PMOS `ConversationType` enum values:
`architecture | implementation | debugging | review | planning | retrospective | decision | discovery | optimization | other`

When mapping declared `conversationTypes` to PMOS enum values:
- If a declared type maps cleanly to a PMOS enum value → use it directly
- If it doesn't map → use `other` and document the custom type in the ConversationArtifact summary field

### 6.2 — Memory Strategy Semantics

| Strategy | PMOS Behavior |
|---|---|
| session-scoped | Each conversation is independent. ConversationArtifacts do not cross-reference each other. |
| cross-session summary | Each ConversationArtifact links to a summary artifact via `keyDecisions` field. |
| sliding-window | Most recent N conversations are pinned as context; older ones are archived. |
| full history | All ConversationArtifacts are retained indefinitely; search via `/api/conversations/search`. |
| domain-partitioned | ConversationArtifacts are tagged by domain; cross-domain refs are explicit decisions. |

### 6.3 — CIC-PMOS Bridge Rules

1. Every CIC session that produces an architectural decision MUST create a PMOS `Decision` record
2. Every CIC session that raises a risk MUST create a PMOS `ArchitectureWarning`
3. Every CIC session that changes a significant file MUST create a PMOS `ChangedFile` record
4. CIC conversation summaries belong in `ConversationArtifact` — not in `ExecutionLog`
5. `ExecutionLog` is for implementation sessions. `ConversationArtifact` is for AI conversation sessions.

---

## SECTION 7 — OUTPUT ARTIFACT SPECIFICATION

The following artifacts MUST exist after a successful bootstrap:

### 7.1 — PMOS Database Artifacts

| Artifact | Count | Source Phase | Minimum Quality Bar |
|---|---|---|---|
| RoadmapNode (root ETAPs) | ≥5 | Phase 5 | Project-specific titles, correct statuses |
| RoadmapNode (sub-nodes) | ≥2 per active ETAP | Phase 5 | Linked to parent via parentId |
| CanonicalPrinciple | 5-10 | Phase 4 | Non-generic, traceable to project |
| ArchitectureWarning | ≥2 | Phase 4 | Specific risk, affected area named |
| Decision | ≥1 | Phase 4 | Architecture style decision always present |
| ExecutionLog | 1 | Phase 7 | Project-specific summary |
| PromptExecution | 1 | Phase 7 | Status: completed |
| ConversationArtifact | ≥1 (if hasCIC) | Phase 6 | project field = projectName |

### 7.2 — File Artifacts

| File | Phase | Content |
|---|---|---|
| `apps/pmos/.context/runtime-context.md` | Phase 8 | Generated from live PMOS data |
| `apps/pmos/pmos.config.ts` | Phase 1 | Verified correct (user may need to update) |

### 7.3 — Governance File Artifacts (if `governanceModel: strict`)

When `governanceModel: strict`, also create the following file-form governance artifacts:

```
apps/pmos/.pmos/governance/decisions/ADR-001.md   ← first ADR in file form
apps/pmos/.pmos/governance/principles/             ← one .md per high-priority principle
apps/pmos/.pmos/governance/warnings/              ← one .md per critical warning
```

File format for ADR:
```markdown
# ADR-001 — [Title]
Date: [bootstrap date]
Status: accepted
Context: [Why this decision was needed]
Decision: [What was decided]
Reason: [Why this was the right choice]
Impact: [What this changes or constrains]
Affected Systems: [list]
```

---

## SECTION 8 — ANTI-PATTERNS AND CONTAMINATION GUARDS

### 8.1 — What the AI MUST NEVER Do

1. **Reuse template placeholder data as real project data.**  
   The generic seed (ETAPs 1-5, principles like "Runtime-first") are starter placeholders. Never present them as the project's actual roadmap or principles. Create project-specific data alongside or instead.

2. **Import facts from unrelated projects.**  
   If the workspace contains other projects (Lexaro, Profitia, another PMOS instance), those projects' architecture, principles, and data MUST NOT appear in the new project's bootstrap. The INPUT BLOCK is the only truth source.

3. **Hallucinate infrastructure.**  
   Never invent URLs, database credentials, cloud provider accounts, API keys, or deployment environments not declared in the input block. If `deploymentTargets.production` is empty, there is no production environment.

4. **Overwrite existing PMOS governance.**  
   If the PMOS instance already contains real project data (non-seed), halt and ask the user whether to append or replace. Do not silently overwrite.

5. **Duplicate roadmap nodes.**  
   Before creating any node, search for it. If a node with the same title already exists, do not create a duplicate.

6. **Mix CIC semantics into non-CIC projects.**  
   `ConversationArtifact` creation, conversation type taxonomies, and CIC principles must ONLY appear when `hasCIC: true`. If `hasCIC: false`, no CIC-related content is created anywhere.

7. **Use generic ETAP names.**  
   "Setup", "Phase 1", "MVP", "Testing", "Launch" are forbidden as standalone ETAP titles. Every ETAP must have a descriptive subtitle that is project-specific.

8. **Produce Jira-like management language.**  
   Avoid: sprints, stories, epics, acceptance criteria, velocity, burndown, story points, definition of done. PMOS uses: ETAPs, execution logs, principles, warnings, ADRs.

9. **Create fake runtime contexts.**  
   `runtime-context.md` must be generated from live PMOS API data via `context:build`. Never write this file manually or from memory.

10. **Skip validation gates.**  
    Every phase gate must be explicitly reported. Reporting a PASS without verifying the success criteria is a bootstrap failure.

### 8.2 — Contamination Guard Checklist

Before creating each artifact, verify:
- [ ] Title contains language traceable to `projectName` or `projectPurpose`
- [ ] No content from other projects appears in this artifact
- [ ] CIC content only present if `hasCIC: true`
- [ ] All URLs use `pmosPort` from input block (not hardcoded 3200 if it was changed)
- [ ] `projectName` not defaulted to "My Project" or any template value

---

## SECTION 9 — FINAL VALIDATION CHECKLIST

Before outputting the BOOTSTRAP COMPLETION REPORT, verify each item:

```
FINAL VALIDATION — {projectName}
══════════════════════════════════════════════════════════════

Runtime
  [ ] PMOS running at http://localhost:{pmosPort}
  [ ] GET /api/context/active returns HTTP 200
  [ ] activeEtap in context response is non-null

Artifacts — Governance
  [ ] ≥5 CanonicalPrinciples created, none are generic platitudes
  [ ] ≥2 ArchitectureWarnings created, each has a named affectedArea
  [ ] ≥1 Decision (ADR) created with full reason and impact
  [ ] All governance principles are traceable to INPUT BLOCK or Phase 2 analysis

Artifacts — Roadmap
  [ ] ≥5 root ETAP nodes exist
  [ ] All ETAP titles are project-specific (no generic names)
  [ ] Maximum 1 node has status: in_progress
  [ ] Greenfield mode: 0 nodes have status: done
  [ ] Existing mode: done/in_progress statuses match existingWork description

Artifacts — Execution
  [ ] 1 ExecutionLog created with project-specific summary
  [ ] 1 PromptExecution created with status: completed

Artifacts — CIC (only if hasCIC: true)
  [ ] ≥1 ConversationArtifact with project = {projectName}
  [ ] CIC ADR created for memory strategy
  [ ] CIC principles created for declared conversation types

Context File
  [ ] apps/pmos/.context/runtime-context.md exists
  [ ] File does not contain "My Project"
  [ ] File contains {projectName}
  [ ] Active ETAP in file matches Phase 5 roadmap

Contamination
  [ ] No content from other projects present
  [ ] No hallucinated infrastructure
  [ ] No generic ETAP names
  [ ] No Jira terminology

══════════════════════════════════════════════════════════════
RESULT: [ ] ALL PASS → output BOOTSTRAP COMPLETION REPORT
        [ ] ANY FAIL → list failures and remediation steps
══════════════════════════════════════════════════════════════
```

═══════════════════════════════════════════════════════════════
═══ END PROMPT ════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════
