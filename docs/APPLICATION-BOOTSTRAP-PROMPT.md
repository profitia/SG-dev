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

projectName:         "SpendGuru 2.0"

projectPurpose:      >
  AI-native Procurement Operating System for enterprise procurement teams.
  SpendGuru 2.0 is not an analytics dashboard — it is a recommendation-first
  intelligence runtime that transforms procurement from passive data analysis
  to active contextual decision support. The system makes procurement professionals
  faster, smarter, and more effective in negotiation, sourcing, and supplier management.
  It builds organizational procurement memory that compounds with every interaction.

projectType:         fullstack-web

currentState:        greenfield
# No application code exists. Architecture must be designed from intent and constitution.

primaryStack:
  - "Next.js 15"
  - "React"
  - "TypeScript"
  - "Tailwind CSS"
  - "shadcn/ui"
  - "FastAPI"
  - "LangGraph"
  - "OpenAI GPT-4.1"
  - "Trigger.dev"
  - "PostgreSQL"
  - "pgvector"
  - "Snowflake"
  - "Prisma"
  - "Vercel"
  - "Render"

primaryDomains:
  - procurement
  - ai-orchestration
  - supplier-intelligence
  - negotiation-intelligence
  - recommendation-engine
  - contextual-memory
  - multi-tenant
  - spend-analytics
  - sourcing
  - contracts

# ─── B. OPTIONAL INPUTS ──────────────────────────────────────────────────────

architectureStyle:   event-driven
# Procurement workflows are inherently async — negotiation cycles, supplier responses,
# market data updates, contract analysis. Request-response architecture is insufficient.
# Primary pattern: event-driven with hybrid layered domain structure.

runtimeStyle:        hybrid
# Stateless for UI and request/response API layer.
# Stateful for AI orchestration sessions (LangGraph) and procurement memory accumulation.

teamSize:            solo

existingWork:        ""
# Greenfield — no implementation exists. Design from constitution.

activeEtapDescription: ""
# Greenfield — no active ETAP. First ETAP will be designed during bootstrap.

constraints:
  - "AI calls only from server actions or API routes — never from UI components"
  - "No business logic in Next.js app/ layer — domain logic in server/domain/ only"
  - "Every feature must trace to a procurement outcome — no feature for feature's sake"
  - "Recommendation-first — every user view must present AI interpretation, not raw data"
  - "Tenant isolation enforced at data access layer — never at application or service layer"
  - "PMOS continuity — all architectural decisions logged, no silent changes"
  - "No direct DB queries from AI agents — supplier data via dedicated integration modules"
  - "pgvector for semantic procurement intelligence search — no keyword-only search"

# ─── C. ADVANCED INPUTS ──────────────────────────────────────────────────────

canonicalPrinciples:
  - title: "Negotiation-first"
    description: >
      Every feature in SpendGuru 2.0 must trace back to improving negotiation outcomes.
      Analytics, dashboards, and data views are means — not ends. If a feature does not
      help a procurement professional prepare for, execute, or improve a negotiation,
      it must not be built. The negotiation is the moment of value creation in procurement.
    priority: high

  - title: "Recommendation-first UI"
    description: >
      Every user-facing view must present AI-generated recommendations or interpretations,
      not raw data. Raw data is an implementation detail visible only in drill-down contexts.
      Procurement professionals see recommendations, insights, and suggested actions — not
      tables and charts. The UI is a recommendation surface, not a reporting dashboard.
    priority: high

  - title: "Procurement context persistence"
    description: >
      Every interaction must build organizational procurement memory. Supplier relationships,
      negotiation outcomes, category intelligence, and user decisions persist across sessions.
      There are no stateless procurement workflows in SG2. Every conversation, every decision,
      every supplier interaction leaves a structured trace in the knowledge graph.
    priority: high

  - title: "AI server-side isolation"
    description: >
      All AI and LLM calls originate exclusively from server actions or API routes.
      No AI calls from React components or client-side code. This enforces security,
      cost control, auditability, and consistent AI governance across all tenant boundaries.
    priority: high

  - title: "Tenant-native isolation"
    description: >
      SpendGuru 2.0 is a multi-tenant system. Every data access, AI prompt, memory artifact,
      supplier record, and recommendation must be strictly scoped to the tenant.
      Tenant isolation is a first-class architectural constraint, not a feature or an afterthought.
      Cross-tenant data leakage is a critical architectural failure at any layer.
    priority: high

  - title: "Event-driven procurement orchestration"
    description: >
      Procurement workflows are domain events, not CRUD operations. Supplier responses,
      contract milestones, price alerts, and negotiation rounds are events that trigger
      AI-driven analysis and generate structured recommendations. The system reacts to
      procurement reality — it does not wait for user button clicks to reason.
    priority: high

knownRisks:
  - title: "Dashboard gravity"
    description: >
      Risk of defaulting to table/chart-based UX because it is faster to build than
      recommendation-first UX. SpendGuru 2.0 is not a reporting tool. If the primary
      user experience becomes 'view data in tables', the product has failed its mission.
      Every sprint review must ask: does this look like a dashboard or an operating system?
    severity: high
    type: dashboard_gravity

  - title: "Stateless AI integration"
    description: >
      Risk of implementing AI as a stateless feature — one-shot prompts per API request —
      rather than as a persistent intelligence layer. This prevents the system from building
      organizational procurement memory and reduces AI from a cognitive partner to an
      autocomplete function. LangGraph sessions must persist state across reasoning turns.
    severity: high
    type: orchestration_drift

  - title: "CIC decoupling drift"
    description: >
      CIC (Conversational Intelligence Core) is the planned intelligence orchestration runtime
      for SpendGuru 2.0 but is not yet technically integrated. Risk of building SG2 AI features
      in isolation from CIC's reasoning model, creating architectural incompatibility when CIC
      integration is attempted. All AI orchestration patterns must be CIC-compatible from day one.
    severity: medium
    type: orchestration_drift

  - title: "ERP complexity creep"
    description: >
      Risk of inheriting enterprise procurement UX patterns — approval chains, form-heavy workflows,
      permission matrices, hierarchical navigation — from traditional ERP and e-procurement systems.
      SpendGuru must be radically simpler than ERP. If a feature requires more than 2 clicks to
      access, its UX design must be questioned before implementation.
    severity: medium
    type: overengineering

initialADRs:
  - title: "Event-driven orchestration as primary architecture"
    decision: >
      SpendGuru 2.0 uses event-driven orchestration as its primary architectural pattern.
      LangGraph manages AI workflow state and multi-step procurement reasoning.
      Trigger.dev manages background job orchestration, scheduled analyses, and
      async procurement event processing across the platform.
    reason: >
      Procurement workflows are inherently asynchronous. Supplier responses arrive on supplier
      timelines. Contract analysis requires multi-step reasoning that cannot complete in a single
      request cycle. Market data updates continuously. Negotiation cycles span days or weeks.
      A synchronous request-response architecture creates blocking UX and limits AI reasoning
      depth to what can be completed in a single LLM call. Event-driven architecture aligns
      with procurement operational reality.
    impact: >
      All major procurement actions are domain events, not CRUD operations. UI is reactive and
      recommendation-driven. Backend is orchestration-first. Simple inline CRUD-style implementation
      is insufficient for core procurement intelligence. Requires LangGraph for stateful AI sessions
      and Trigger.dev for async background orchestration and scheduled intelligence refresh.

  - title: "pgvector for procurement intelligence semantic search"
    decision: >
      Semantic search and similarity matching for procurement intelligence uses pgvector
      on PostgreSQL. All supplier data, contract text, price history references, and
      negotiation records are vector-embedded and available for semantic retrieval.
    reason: >
      Procurement intelligence requires semantic understanding, not keyword matching.
      Questions like 'Which suppliers are similar to Supplier X in terms of delivery reliability?'
      or 'What contracts have conditions similar to this clause?' cannot be answered by
      traditional full-text search. Vector similarity is the foundational mechanism for
      building organizational procurement intelligence that compounds over time.
    impact: >
      PostgreSQL must have pgvector extension enabled from initial schema design.
      All domain entities requiring intelligence search must have vector embedding fields.
      Embedding generation is an async background process — not a blocking write operation.
      This constrains data model design and requires embedding pipeline infrastructure.

boundaryRules:
  - "AI and LLM calls only from server actions or API routes — never from React components"
  - "No business logic in Next.js app/ layer — all domain logic in server/domain/"
  - "Supplier data only accessible via server/integrations/ modules — no direct DB queries from AI"
  - "Tenant scoping enforced at repository/data-access layer — not at service or API layer"
  - "Procurement recommendations generated server-side only — never streamed raw from LLM to client"
  - "PMOS governance updated after every architectural decision — no silent changes"
  - "Vector operations (pgvector) only in dedicated intelligence/search service modules"
  - "Background async operations only via Trigger.dev — no inline long-running server processes"

# ─── D. CIC INPUTS ───────────────────────────────────────────────────────────

hasCIC:              true

cicDescription:      >
  Conversational Intelligence Core (CIC) is an independent runtime intelligence system
  maintained separately from SpendGuru 2.0. CIC serves as the canonical intelligence benchmark
  and future procurement cognition orchestration layer for SG2. CIC is NOT yet technically
  connected to SG2 — integration is architectural intent, not implemented reality.

  CIC's role in the SG2 ecosystem:
  - Procurement cognition runtime (multi-step reasoning, contextual intelligence)
  - Recommendation orchestration (AI-driven procurement reasoning workflows)
  - Conversational procurement runtime (dialogue-based procurement assistance)
  - Negotiation intelligence synthesis (preparation, strategy, outcome analysis)
  - Supplier intelligence aggregation (relationship memory, market intelligence)

  Integration model: SG2 will communicate with CIC via a typed cic-bridge/ module
  that translates SG2 procurement events into CIC reasoning requests and maps CIC
  intelligence outputs back to SG2 recommendation schemas.

  Until integration, all SG2 AI features must be CIC-compatible by design:
  structured outputs, typed schemas for all AI I/O, and reasoning patterns that
  CIC can eventually absorb or replace without architectural rework.

cicPackagePath:      "cic-bridge/"
# Will contain the SG2-CIC integration bridge. Does not yet exist — creates a warning.

conversationTypes:
  - "procurement-analysis"
  - "negotiation-prep"
  - "supplier-evaluation"
  - "category-intelligence"
  - "spend-analysis"
  - "contract-review"
  - "sourcing-discovery"

memoryStrategy:      >
  Tenant-partitioned with cross-session procurement context accumulation.
  Each tenant has an isolated memory partition with full data sovereignty.
  Within a tenant, procurement memory persists indefinitely across sessions:
  supplier relationships, negotiation history, category learnings, price intelligence,
  and user decision patterns accumulate over time and inform future recommendations.
  Memory is retrieved by semantic relevance via pgvector — not by recency alone.
  Long-term supplier and category memory is compressed into structured knowledge artifacts
  (supplier profiles, category intelligence summaries) during scheduled consolidation jobs.

# ─── E. INFRASTRUCTURE INPUTS ────────────────────────────────────────────────

pmosPort:            3200

deploymentTargets:
  local:       "http://localhost:3100"
  # staging:   ""
  # production: ""
# Frontend: Vercel. FastAPI backend services: Render. PMOS: local dev only.

cloudProvider:       "vercel"

dbProvider:          neon
# Neon PostgreSQL with pgvector extension for procurement intelligence.
# Snowflake for analytical/historical spend data.

# ─── F. GOVERNANCE INPUTS ────────────────────────────────────────────────────

governanceModel:     standard

riskTolerance:       medium

complianceRequirements:
  - gdpr
  # GDPR applies — supplier PII, contract data, user behavioral data, tenant data sovereignty.
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

---

## SECTION 10 — PROJECT CONSTITUTION: SPENDGURU 2.0

> This section defines the operating model, philosophy, and architectural expectations for SpendGuru 2.0.
> It is not a README. It is a runtime constitution — a binding set of beliefs about what this system is,
> what it must do, and what it must never become.
>
> The AI executing this bootstrap must internalize this constitution before generating any PMOS artifact.
> All ETAPs, principles, warnings, and ADRs created in Phases 4–5 must be coherent with this constitution.
> Any artifact that contradicts this constitution represents a bootstrap failure.

---

### 10.1 — PROJECT IDENTITY

SpendGuru 2.0 (SG2) is an AI-native Procurement Operating System for enterprise and mid-market
procurement teams. It is not a feature update to a prior product — it is a ground-up rearchitecture
grounded in the conviction that AI fundamentally changes what a procurement tool can and must be.

SG2 exists in the Profitia / SpendGuru product ecosystem. It inherits the commercial context of the
SpendGuru brand — negotiation-first positioning, procurement intelligence focus — but rebuilds on
AI-native architectural foundations with no legacy constraints.

The project began from a single premise: procurement professionals don't need more data. They need
a system that thinks alongside them — that understands their organizational context, builds procurement
memory, and makes recommendations that help them act faster and more confidently.

SG2 is a greenfield project. Production repositories exist on GitHub. A sister intelligence runtime
(Conversational Intelligence Core — CIC) is in separate development and represents the future
orchestration intelligence layer. PMOS serves as the development continuity and governance memory runtime.

---

### 10.2 — PROJECT PURPOSE

SpendGuru 2.0's purpose is to transform procurement from a data-heavy, passive reporting function
into a recommendation-driven, AI-assisted operating capability for procurement teams.

The procurement professional — whether a category manager, lead buyer, CPO, or procurement analyst —
currently spends too much time gathering and formatting data, and too little time acting on intelligence.
Existing tools give them charts. SG2 gives them recommendations. Existing tools store their history.
SG2 remembers it and uses it to improve every subsequent decision.

SG2's purpose is operational utility for practitioners in the moments that matter:

- **Before a negotiation**: prepare with AI-synthesized supplier intelligence, historical negotiation
  patterns, price benchmarks, and a recommended negotiation strategy.
- **During a sourcing event**: receive ranked supplier recommendations, risk-adjusted scoring, and
  category market context grounded in organizational history.
- **After a decision**: automatically capture the rationale, update organizational memory, and close
  the knowledge loop with the supplier intelligence graph.
- **At any moment**: understand the state of procurement operations through an AI-native interface,
  not a dashboard that requires interpretation.

The purpose is not to automate procurement decisions. The purpose is to make procurement professionals
dramatically better at their jobs by giving them a system that remembers, reasons, and recommends.

---

### 10.3 — STRATEGIC THESIS

SpendGuru 2.0 is built on three structural strategic theses:

**Thesis 1: The recommendation gap.**
Enterprise procurement teams are drowning in data and starving for decisions. The market is saturated
with analytics platforms, spend dashboards, and reporting tools. There are no procurement operating
systems that prioritize recommendation over reporting as the primary output. SG2 fills this gap
by treating AI-generated recommendations as the system's core output — not a secondary feature layer.

**Thesis 2: Organizational procurement memory as a compounding moat.**
Procurement intelligence accumulates over years: supplier relationships, negotiation history, market
cycles, category learning, pricing patterns, risk events. Every existing procurement system discards
this memory at the end of each session or stores it in unstructured formats that cannot be used by AI.
SG2 captures it, structures it into a knowledge graph, and makes it semantically accessible to the AI
layer. This organizational memory becomes a compounding advantage the longer the system is used.
It is the structural moat that makes SG2 more valuable with every procurement interaction.

**Thesis 3: The AI-native procurement professional.**
Procurement professionals who use AI-native tools will operate at 2–3x the effectiveness of those
who rely on traditional dashboards and manual research. SG2 is built for this transition moment —
when procurement teams adopt AI as a cognitive partner embedded in their operating system, not as
a reporting widget or a standalone chatbot. SG2's conversational, recommendation-first interface
is designed for AI-native procurement workflows.

---

### 10.4 — CORE PHILOSOPHY

**Procurement is a cognitive profession, not a data entry function.**
SG2 must honor this. Every interface decision, every feature, every AI interaction must respect
the intelligence and expertise of the procurement professional — while actively augmenting it.

**Recommendations over dashboards.**
A dashboard answers "what happened?" A recommendation answers "what should I do?"
SG2's output is always an action, a recommendation, or an interpretation — never a chart in isolation.
If a view contains only data without interpretation or recommended action, it is a design failure.

**Memory over statelessness.**
Every interaction in SG2 adds to the organizational procurement memory. The system remembers.
It builds. It compounds. A stateless session is an architectural regression, not a pragmatic shortcut.

**Simplicity over completeness.**
SG2 does not attempt to replace ERP or cover every procurement edge case. It does one thing better
than any other tool: it helps procurement professionals make better decisions faster, in the moments
that matter most. Scope control is a core architectural value, not a delivery constraint.

**Continuity over novelty.**
Every feature that touches AI must fit the continuity model. The AI must know the history.
The AI must build on prior context. Novelty features that reset state or discard memory are
architectural failures regardless of their surface-level utility.

---

### 10.5 — AI-NATIVE PRINCIPLES

AI is not a feature in SpendGuru 2.0. AI is the operational runtime of the system.

**1. AI at the center, UI at the edge.**
The AI orchestration layer is the cognitive core of SG2. The UI is the interface to that core —
it presents AI outputs, collects user context, and triggers AI workflows. UI components have no
intelligence of their own. Intelligence lives in the orchestration layer.

**2. Stateful AI sessions.**
LangGraph manages procurement reasoning sessions as stateful workflows. Each procurement question
or task begins a reasoning session that maintains context, can backtrack, and produces structured
outputs rather than free-form text responses. Stateless one-shot prompts are insufficient for
procurement reasoning of any meaningful depth.

**3. Prompt engineering as architecture.**
The prompts used in SG2 are architectural artifacts, not implementation details. They define how
the system reasons about procurement problems. They are versioned, tested, and governed like code.
Prompt drift is an architectural risk equivalent to schema drift — it must be tracked in PMOS.

**4. AI-generated outputs are structured, not conversational.**
SG2 AI outputs are structured — recommendations with rationale, supplier scores with explanation,
negotiation strategies with supporting data, risk assessments with named sources. Free-form AI
prose returned directly to the UI is a design failure. Every AI output has a typed schema.

**5. AI reasoning is auditable.**
Every AI recommendation in SG2 can be traced: which organizational data it used, which reasoning
steps it applied, which memory fragments it retrieved. AI reasoning is not a black box. Auditability
is an enterprise requirement and a competitive differentiator in procurement software.

**6. AI errors are handled gracefully.**
The system degrades gracefully when AI is unavailable or produces low-confidence outputs.
Users can always access available data with explicit notice that AI interpretation is temporarily
unavailable. No user workflow is blocked by AI service failure.

---

### 10.6 — PROCUREMENT OPERATING MODEL

SpendGuru 2.0 models procurement as an operating system, not as a transaction system.

**The four procurement moments SG2 supports:**

1. **Preparation** — Before a negotiation, sourcing event, or supplier conversation.
   SG2 provides: supplier intelligence synthesis, historical pattern analysis, price benchmarks,
   recommended negotiation strategy, risk assessment, leverage analysis.

2. **Execution** — During an active sourcing or negotiation process.
   SG2 provides: real-time context surfacing, similar-case retrieval, competitor intelligence,
   clause analysis, live recommendation updates as new information arrives.

3. **Decision capture** — After a decision is made.
   SG2 provides: automatic rationale capture, outcome logging, organizational memory update,
   supplier relationship graph update, pattern signal extraction for future recommendations.

4. **Continuous monitoring** — Ongoing procurement health and intelligence.
   SG2 provides: contract milestone alerts, market price movement signals, supplier risk events,
   category opportunity identification, portfolio-level procurement intelligence.

**The procurement professional's workflow in SG2:**
- They arrive with a procurement problem, task, or question
- SG2 surfaces relevant context from organizational memory — without being asked
- SG2 recommends an approach with explicit reasoning and data provenance
- The professional refines, challenges, or accepts the recommendation
- SG2 captures the outcome and updates organizational memory
- The cycle repeats — accumulating organizational procurement intelligence with each iteration

This is not a workflow template or a form to fill in. It is a cognitive augmentation loop that
improves with every procurement interaction the team conducts through the system.

---

### 10.7 — CIC RELATIONSHIP

The Conversational Intelligence Core (CIC) is an independent runtime intelligence system maintained
separately from SpendGuru 2.0. The architectural relationship between SG2 and CIC is:

**CIC is the intelligence runtime. SG2 is the procurement operating system.**

CIC provides: procurement cognition, multi-step reasoning capability, contextual intelligence,
recommendation orchestration, and conversational procurement runtime at the reasoning level.

SG2 consumes CIC intelligence as a service — procurement problems are sent to CIC, which reasons
with full organizational context and returns structured recommendations that SG2 presents to users
through the recommendation surface.

**Current integration state:** CIC and SG2 are technically separate. No bridge exists yet.
Integration is architectural intent, not implemented reality. The cic-bridge/ module is planned.

**Integration model (planned):**
SG2 will communicate with CIC via the cic-bridge/ module — a typed API client that translates SG2
procurement events into CIC reasoning requests and maps CIC intelligence outputs back to SG2
recommendation schemas. The bridge enforces type safety and tenant isolation at the integration layer.

**CIC compatibility constraint:** All AI features built in SG2 before CIC integration must be
CIC-compatible by design. This means: structured outputs (not free-form LLM text), typed schemas
for all AI requests and responses, and reasoning patterns that CIC can eventually absorb or replace
without requiring SG2 architectural rework.

**CIC is the canonical reasoning benchmark.** If SG2 builds procurement reasoning independently,
that reasoning must produce outputs compatible with CIC's recommendation schema — not an alternative
model that will require translation or replacement when CIC integration is implemented.

---

### 10.8 — PMOS RELATIONSHIP

PMOS (Project Memory Operating System) is the embedded development continuity runtime for SG2.
PMOS is not a project management tool. It is not a dashboard. It is the persistent memory layer
between the SG2 development process and the AI assistant — ensuring that architectural decisions,
execution history, principles, warnings, and roadmap state persist across every development session.

**PMOS's role in SG2 development:**

- **Continuity**: Every significant development session is logged. The AI assistant reads
  `runtime-context.md` at the start of each session and has full project context from the first
  message — no re-explanation required.
- **Governance**: Architectural decisions are recorded as ADRs. Canonical principles are enforced.
  Architecture warnings are tracked. Nothing architecturally important happens without a record.
- **Lineage**: The execution log tracks what was built, why, and what changed. Post-ETAP lineage
  reviews prevent architectural drift from compounding silently across sessions.
- **Roadmap**: The ETAP roadmap in PMOS is the single source of truth for what is being built,
  what is complete, and what comes next. No side-channel roadmap documents.

**The PMOS contract with SG2 development:**
- Every ETAP completion → ExecutionLog created, context rebuilt via `npm run context:build`
- Every architectural decision → ADR created in PMOS before implementation begins
- Every discovered risk → Architecture Warning created with named affected area
- Every principle violation → Warning escalated with specific code location
- Every significant AI session → ConversationArtifact created

PMOS LLM memory is NOT the source of truth. PMOS runtime artifacts are the source of truth.

---

### 10.9 — RUNTIME CONTINUITY MODEL

SpendGuru 2.0's continuity model operates at two distinct but interdependent levels:

**Level 1: Development continuity (PMOS)**
The development of SG2 maintains persistent memory across every session. The AI assistant working
on SG2 always begins from a runtime context that accurately reflects actual project state — not from
a blank slate where the same architectural context must be re-established each time.
Development continuity is maintained through: `runtime-context.md` (generated from live PMOS data),
`.pmos/` governance artifacts, execution logs, ETAP roadmap state, and ConversationArtifacts.

**Level 2: Product continuity (Procurement Memory)**
The procurement intelligence that SG2 builds for each tenant is persistent and cumulative across
all procurement interactions. Users never start from zero. The system remembers:
- Supplier relationships, performance patterns, and negotiation history
- Category intelligence, market patterns, and price volatility signals
- User preferences, decision patterns, and role-specific information needs
- Organizational procurement norms, approved supplier lists, and budget structures
- Prior AI recommendations, outcomes, and the delta between predicted and actual results

Product continuity is what transforms SG2 from a tool into an operating system.
A tool is used and forgotten. An operating system remembers, learns, and improves.

**Continuity rules:**
1. No procurement data that matters is discarded at session end — by design
2. AI context is always loaded from persistent organizational memory, never rebuilt from scratch
3. Organizational memory compounds — every interaction improves future recommendation quality
4. PMOS development memory compounds — every development session builds on all prior sessions

---

### 10.10 — ORCHESTRATION EXPECTATIONS

SpendGuru 2.0 is an orchestration-first system. Orchestration is not a backend implementation
detail — it is the primary runtime model that governs how the system thinks and acts.

**What orchestration means in SG2:**
- Procurement events trigger AI workflows — not inline LLM calls from API handlers
- AI workflows are multi-step, stateful reasoning processes managed by LangGraph state graphs
- Background jobs (supplier data ingestion, analysis refresh, market monitoring, embedding updates)
  are managed by Trigger.dev — not by cron jobs or in-process scheduled functions
- The application layer orchestrates AI capabilities — it does not implement reasoning inline

**Orchestration layers:**
1. **Event ingestion**: Procurement events arrive via API, webhook, or scheduled trigger
2. **Event routing**: Events are classified by type and routed to appropriate AI workflows
3. **AI reasoning**: LangGraph executes multi-step procurement reasoning with full tenant context
4. **Memory update**: Reasoning outcomes update the tenant procurement memory graph
5. **Recommendation generation**: Structured, typed recommendations are generated and persisted
6. **UI delivery**: Recommendations surface in the contextually appropriate user workspace

**Orchestration anti-patterns:**
- Inline LLM calls from Next.js API route handlers (use LangGraph workflow instead)
- Synchronous AI reasoning for complex multi-step procurement questions (use Trigger.dev)
- Recommendation generation without first loading tenant organizational memory
- Procurement events processed without being logged to the execution lineage
- AI workflow state stored in application memory rather than in LangGraph state

---

### 10.11 — SYSTEM INTELLIGENCE EXPECTATIONS

SpendGuru 2.0 must demonstrate concrete intelligence across four procurement intelligence dimensions:

**1. Supplier intelligence**
The system knows suppliers — their performance history, pricing behavior, contract terms, negotiation
styles, delivery reliability patterns, and relationship trajectory. Intelligence accumulates across
all interactions with each supplier within a tenant. Supplier intelligence is queryable with natural
language: "Which of our suppliers has the highest delivery reliability for category X in Q3?"

**2. Category intelligence**
The system understands procurement categories — market dynamics, seasonal pricing patterns, price
volatility indices, substitution opportunities, supplier concentration risk, and regulatory changes
affecting the category. Category intelligence is sourced from tenant organizational history and
market data signals, synthesized into actionable category intelligence profiles.

**3. Negotiation intelligence**
The system learns from every negotiation — which strategies produced the best outcomes, which
concessions were made and at what cost, which triggers led to supplier concessions, and what
minimum acceptable terms proved realistic vs. aspirational. This intelligence feeds preparation
for future negotiations with the same or similar suppliers and informs benchmark development.

**4. Recommendation intelligence**
The system generates recommendations that are specific, actionable, and traceable — not generic.
Not: "Consider reviewing your supplier contracts." But: "Supplier Acme Corp has delivered 3
consecutive late shipments exceeding 5-day SLA threshold. Category benchmark shows 2 alternative
suppliers with comparable capacity and better delivery track records. Recommend initiating a
competitive RFQ before contract auto-renewal in 60 days."

Intelligence is not a feature — it is the system's primary output and core value proposition.

---

### 10.12 — CONTEXTUAL MEMORY EXPECTATIONS

Contextual memory is the architectural mechanism that makes SG2 intelligent over time.

**Memory architecture:**
SG2 maintains a procurement knowledge graph per tenant, structured as a multi-entity graph:

- **Supplier memory**: Relationship timeline, negotiation outcomes, delivery performance history,
  pricing history, contract terms, risk events, market position, contact relationship map
- **Category memory**: Price benchmarks over time, supplier pool changes and entry/exits, demand
  patterns, regulatory changes, market events, spend concentration metrics
- **Organizational memory**: Procurement norms, approval patterns, budget cycles, preferred supplier
  policies by category, historical RFQ structures and outcomes, internal escalation patterns
- **User memory**: Decision patterns by role, preferred information density, frequent query types,
  category expertise, decision history and success rate

**Memory retrieval:**
Memory is not retrieved by keyword search. It is retrieved by semantic similarity using pgvector
embeddings. The AI receives contextually relevant memory fragments ranked by relevance to the current
procurement task — not raw data dumps requiring additional AI processing to interpret.
Memory retrieval is always strictly scoped to the tenant.

**Memory lifecycle:**
- Every procurement interaction creates memory artifacts (events, outcomes, signals)
- Memory importance is scored by frequency and organizational impact — reinforced over time
- Long-term memory is compressed into structured knowledge artifacts during background consolidation
- Memory is never deleted — it is archived and weighted by recency combined with importance score
- Memory consolidation jobs (Trigger.dev) run as background processes on defined schedules

---

### 10.13 — MULTI-TENANT AI CONTEXT MODEL

SpendGuru 2.0 is a multi-tenant platform. Multi-tenancy extends through every layer including AI.

**Tenant isolation in AI context:**
Every AI reasoning session in SG2 is strictly tenant-scoped:
- Only the requesting tenant's procurement memory is loaded into AI context
- Only tenant-specific supplier data is available to reasoning workflows
- Cross-tenant context contamination is architecturally impossible at every layer
- Tenant ID is injected at the orchestration layer, before any LLM call or memory retrieval

**Tenant-specific AI calibration:**
Different tenants have different procurement realities — different categories, different supplier
bases, different organizational norms, different risk tolerances. The AI adapts to each tenant's
context through its memory layer. A chemicals manufacturer's category intelligence produces different
recommendations than a tech company's IT procurement — even for structurally similar situations.

**Tenant AI governance:**
- All AI outputs are logged and attributable per tenant
- Recommendation quality metrics are tracked per tenant separately
- Tenant administrators can review AI reasoning trails for their organization
- AI hallucination risk is mitigated by grounding all responses in tenant-specific data —
  the AI cannot produce procurement intelligence that isn't grounded in tenant knowledge

**Implementation constraint:**
Tenant ID must be present in every AI workflow invocation, every memory read, every supplier
data query, and every recommendation generation call. There is no "global" AI context in SG2.
Global, cross-tenant AI context does not exist and must not be architecturally possible.

---

### 10.14 — ENTERPRISE PROCUREMENT UX PRINCIPLES

SpendGuru 2.0's UX must be enterprise-strength without being enterprise-complex.

**Principle 1: Conversation-first.**
The primary interaction mode is conversational AI, not form-based workflows. The procurement
professional asks questions, states problems, or describes contexts in natural language.
SG2 responds with structured recommendations and follows up with clarifications.
Forms exist only for structured data capture — not as the primary procurement interaction mode.

**Principle 2: Proactive, not reactive.**
SG2 surfaces relevant intelligence before the user asks for it. Opening a supplier view surfaces:
relevant alerts, upcoming contract events, recent performance changes, active risk signals, and
a recommended action — without a single navigation click from the user.

**Principle 3: Low-friction access.**
Core procurement intelligence is accessible in 1–2 interactions. No deep menu trees.
No multi-step navigation sequences to find a supplier's negotiation history.
Semantic search, natural language queries, and AI-driven routing eliminate navigation friction.

**Principle 4: Enterprise-simple, not enterprise-complex.**
Enterprise tools earn their complexity through the scale of what they manage. SG2 earns its trust
through simplicity and operational usefulness. Features that require training are design failures.
Every interaction must be self-explanatory to a new procurement professional on their first day.

**Principle 5: Context-persistent UI.**
The UI reflects organizational memory. Opening any procurement entity (supplier, category, contract)
surfaces the full relationship history, active intelligence, and recommended actions — not just the
structured data record. The UI is a window into the knowledge graph.

**Anti-patterns categorically prohibited:**
- Deep hierarchical navigation trees (ERP-style menu systems)
- Multi-step approval workflows as primary UI interactions
- Data tables as the dominant view type for procurement entities
- Charts and graphs presented without AI interpretation or recommended action
- Feature-dense toolbars requiring expertise to navigate
- Modal dialogs for complex, multi-field procurement operations

---

### 10.15 — AI GOVERNANCE EXPECTATIONS

SpendGuru 2.0 governs its AI capabilities with the following non-negotiable expectations:

**1. Prompt versioning.**
All prompts used in procurement AI reasoning are versioned artifacts managed outside application
code. Changes to prompts are treated as architectural changes — they require logging in PMOS as
ADRs, testing against representative procurement scenarios, and deliberate rollout. Prompt drift
is tracked as a first-class architectural risk category in the warning register.

**2. Recommendation auditability.**
Every recommendation generated by SG2 includes full provenance: which organizational data was
used, which reasoning steps were applied, which memory fragments were retrieved, and what the
confidence assessment is. Procurement teams can inspect AI reasoning for any recommendation.
Opaque AI recommendations are not acceptable in enterprise procurement contexts.

**3. Confidence scoring.**
AI recommendations include explicit confidence signals based on data quality and coverage.
Low-confidence recommendations are clearly labeled. The system does not present uncertain
analytical outputs as confirmed organizational intelligence.

**4. Graceful degradation.**
When AI confidence is below acceptable threshold, or when AI services are temporarily unavailable,
SG2 degrades gracefully: available data is shown with explicit notice that AI interpretation is
currently unavailable. No user workflow is blocked by AI service failure.

**5. Human decision authority.**
AI is permitted to recommend — never to act unilaterally. Supplier contract generation, RFQ
submission, supplier status changes, and spending approvals all require explicit human confirmation.
AI proposes. Procurement professionals decide. This boundary is architecturally enforced.

**6. Data grounding mandatory.**
AI responses are grounded in organizational data. Where external market data is used, its source
is explicitly named. Where AI responses would require fabricating supplier data, price benchmarks,
or market conditions not present in the tenant knowledge base, the response is clearly marked as
an estimate or external benchmark — not as organizational intelligence.

---

### 10.16 — EXECUTION LINEAGE EXPECTATIONS

SpendGuru 2.0 development maintains a complete execution lineage through PMOS. Lineage is not
optional — it is the mechanism that ensures future development sessions begin with full context.

**Lineage requirements for development sessions:**
- Every significant development session creates an ExecutionLog in PMOS before the session ends
- Every architectural decision creates an ADR in PMOS before implementation begins
- Every discovered structural risk creates a Warning in PMOS with the affected area named
- Every principle violation is escalated to a Warning with the specific code location identified
- Context is rebuilt via `npm run context:build` after every ETAP completion, not just at milestones

**Lineage requirements for AI sessions:**
- Every significant AI-assisted development session creates a ConversationArtifact in PMOS
- ConversationArtifacts capture: key decisions made, blockers encountered, next steps committed
- AI session artifacts are linked to the relevant ETAP and sub-node they belong to

**Lineage anti-patterns that constitute governance failures:**
- Making an architectural decision without logging an ADR in PMOS
- Completing an ETAP without creating an ExecutionLog
- Changing the interpretation of a canonical principle without updating the principle record
- Discovering a structural risk without creating a Warning
- Completing a significant AI-assisted session without a ConversationArtifact
- Allowing the Warning register to accumulate without review between ETAPs

The execution lineage is the intellectual audit trail of the project. It ensures that any AI
assistant — in any future session — can begin with complete and accurate project context.

---

### 10.17 — ANTI-PATTERNS

The following anti-patterns are categorically incompatible with SpendGuru 2.0's mission and
architecture. The bootstrap must generate Architecture Warnings for any that appear in the project.

**Product anti-patterns:**
- **Dashboard gravity**: Building tables and charts as primary views instead of recommendations
- **ERP complexity**: Importing enterprise process complexity into the UX design without necessity
- **Feature overload**: Building features not directly traceable to a named procurement outcome
- **Stateless intelligence**: AI that forgets organizational context between sessions
- **Passive reporting**: Showing data without interpretation, context, or recommended action
- **Demo-driven development**: Building features optimized for demonstrations rather than daily use

**Architecture anti-patterns:**
- **Business logic in UI**: Procurement rules or decisions in React components
- **AI in components**: LLM calls initiated from client-side React code
- **Inline reasoning**: Complex AI procurement reasoning implemented in API route handlers
- **Prompt coupling**: LLM prompts embedded in application code rather than managed as versioned artifacts
- **Cross-tenant contamination**: AI context not strictly scoped to the requesting tenant
- **Memory leakage**: Procurement interaction outcomes not persisted to the knowledge graph

**Development anti-patterns:**
- **Silent decisions**: Architectural choices made without creating an ADR in PMOS
- **Greenfield amnesia**: Starting a development session without reading `runtime-context.md`
- **Principle drift**: Ignoring canonical principles under delivery timeline pressure
- **Warning accumulation**: Allowing the Warning register to grow without resolution reviews
- **CIC incompatibility**: Building AI reasoning patterns that are structurally incompatible
  with CIC's recommendation schema and integration model

---

### 10.18 — TECHNICAL RUNTIME CONTEXT

SpendGuru 2.0's technical runtime is designed for an AI-native, orchestration-first procurement system.

**Frontend runtime (Next.js 15 / React / TypeScript / Tailwind / shadcn/ui):**
Next.js serves as the application shell and recommendation presentation runtime. React Server
Components handle data fetching and AI output rendering at the server layer. Client Components
handle interactive elements and real-time recommendation updates. The frontend is a recommendation
surface — it contains no business logic, no AI capability, and no procurement reasoning.

**AI orchestration runtime (LangGraph / OpenAI GPT-4.1):**
LangGraph manages stateful AI reasoning workflows for all procurement intelligence operations.
Procurement reasoning sessions are defined as typed LangGraph state graphs with explicit state
transitions, branching logic for uncertainty, and structured output schemas. OpenAI GPT-4.1 is the
primary reasoning engine. Prompts are managed as versioned artifacts in the governance layer.

**Background orchestration (Trigger.dev):**
Trigger.dev manages all asynchronous procurement operations: supplier data ingestion, intelligence
refresh cycles, contract monitoring, price alert generation, embedding update pipelines, and
scheduled organizational memory consolidation. Background jobs are event-triggered and idempotent.

**Data layer (PostgreSQL / pgvector / Prisma / Neon / Snowflake):**
Primary operational data in Neon PostgreSQL. Vector embeddings for semantic procurement intelligence
in pgvector (same PostgreSQL instance). All data access via Prisma ORM — no raw SQL in application
code. Historical spend data and analytical workloads in Snowflake. Schema migrations are tracked and
version-controlled as part of the project execution lineage.

**Backend services (FastAPI / Python):**
FastAPI handles procurement data APIs, AI service orchestration endpoints, and integration adapters
for external data sources. Python services manage embedding generation pipelines, Snowflake
connectivity, and ML pipeline operations that are not suitable for the TypeScript runtime.

**Runtime philosophy:**
Each layer has exactly one primary responsibility. The frontend renders and collects context.
The orchestration layer reasons and generates recommendations. The data layer persists and enables
semantic retrieval. The background layer processes events and refreshes intelligence.
Responsibility leaking between layers is a structural defect that compounds over time.

---

### 10.19 — FUTURE ARCHITECTURE DIRECTION

SpendGuru 2.0 is designed to evolve toward a multi-agent procurement intelligence platform.
Every architectural decision made during initial development must be compatible with this trajectory.

**Near-term evolution (ETAPs 1–4):**
- Core procurement intelligence operational for single tenant
- AI recommendations demonstrably superior to manual research
- CIC bridge architecture designed, partially implemented
- Basic supplier intelligence accumulating in knowledge graph

**Mid-term evolution (ETAPs 5–8):**
- Full multi-tenant operation with complete tenant isolation
- CIC integration bridge active and routing procurement reasoning through CIC
- Procurement memory graph operational with semantic retrieval at scale
- Recommendation engine producing consistently structured, auditable outputs
- Background intelligence refresh pipelines fully operational via Trigger.dev

**Long-term evolution (beyond current roadmap):**

1. **Multi-agent procurement runtime**: Multiple specialized AI agents — a supplier intelligence
   agent, a negotiation preparation agent, a contract analysis agent, a market monitoring agent —
   orchestrated by LangGraph into a unified procurement intelligence network where agents
   collaborate with tenant memory as shared ground truth.

2. **AI orchestration platform**: SG2 evolves into the procurement-specific AI orchestration
   layer that enterprise teams extend — custom category intelligence models, custom recommendation
   logic, custom supplier evaluation frameworks, all built on the SG2 orchestration infrastructure.

3. **Contextual procurement operating system**: The full organizational procurement memory becomes
   a searchable, navigable intelligence graph — not a database of records but a living organizational
   knowledge system that AI agents work from as their primary source of procurement truth.

**Architecture constraint from evolution trajectory:**
Technical decisions made during greenfield development must support Phase 4 multi-agent evolution.
Shortcuts that create incompatibility with future multi-agent architecture are unacceptable, even
under greenfield speed pressure. The architecture must be right for where the system is going.

---

### 10.20 — ORGANIZATIONAL MEMORY MODEL

SpendGuru 2.0's organizational memory is not a relational database — it is a procurement knowledge
graph where entities, relationships, and intelligence signals are first-class objects.

**Knowledge graph nodes:**
- Supplier entities (with accumulated relationship intelligence and performance history)
- Category entities (with market intelligence and organizational spend behavior)
- Contract entities (with clause intelligence, obligation tracking, and milestone history)
- User entities (with decision patterns, role context, and expertise signals)
- Procurement event entities (negotiations, RFQs, audits, price reviews, supplier escalations)

**Knowledge graph edges:**
- Supplier ↔ Category (which suppliers serve which categories, at what performance level)
- Supplier ↔ Contract (historical and active contracts with key terms)
- Supplier ↔ Procurement event (full participation history in organizational procurement events)
- Category ↔ Market intelligence (price trends, volatility signals, competitor benchmarks)
- User ↔ Decision (decision history, pattern signals, outcome tracking)
- Event ↔ Outcome (negotiation results, savings achieved, risks realized or avoided)

**Memory accumulation mechanism:**
Every procurement interaction is a domain event. Events are processed by Trigger.dev background
jobs that: update relevant knowledge graph nodes and edges, generate updated vector embeddings for
semantic retrieval, extract pattern signals (supplier reliability trends, price movement patterns,
decision outcome correlations), and update the AI context that will be loaded for the next relevant
procurement interaction with the same or related entities.

**Memory retrieval mechanism:**
When a procurement professional begins a task, the system:
1. Identifies the relevant procurement context (supplier, category, event type, user role)
2. Retrieves semantically relevant memory fragments via pgvector similarity search
3. Assembles a tenant-scoped, task-relevant context window for the AI reasoning workflow
4. The AI reasons with organizational memory as the ground truth — not as supplementary context

---

### 10.21 — EVENT-DRIVEN ORCHESTRATION PRINCIPLES

SpendGuru 2.0 treats procurement reality as a domain of events — not transactions or CRUD operations.

**Core procurement event taxonomy:**
- `supplier.response.received` — Supplier responds to RFQ, inquiry, or proposal
- `contract.milestone.reached` — Contract date, renewal window, or obligation event
- `price.signal.detected` — Market price movement detected for a tracked category
- `negotiation.session.started` — Procurement professional initiates negotiation preparation
- `recommendation.generated` — AI orchestration layer produces a procurement recommendation
- `decision.captured` — User confirms, rejects, or modifies a recommended procurement action
- `supplier.risk.signal` — Risk event detected for a tracked supplier (delivery failure, news signal)
- `intelligence.refresh.requested` — Category or supplier intelligence update triggered by scheduler

**Event handling principles:**
1. Events are the authoritative source of procurement state changes — not direct database mutations
2. Every significant procurement state change is a logged domain event — observable and replayable
3. Events trigger AI workflows — never ad-hoc inline LLM calls from application code
4. Events are idempotent — processing the same event twice produces the same outcome
5. Events are auditable — they appear in the execution lineage and are attributable to their source

**Orchestration topology:**
Events flow through a defined pipeline:
`event bus → event classifier → workflow router → LangGraph workflow → memory update → recommendation generation → UI delivery`

No event is lost. No procurement event is processed synchronously if it requires multi-step reasoning.
No recommendation is generated without first loading the relevant tenant organizational memory.

---

### 10.22 — PROCUREMENT COGNITION PRINCIPLES

Procurement cognition is the set of structured reasoning capabilities SG2 must provide through its
AI layer. These capabilities define what "intelligence" means in the context of procurement operations.

**1. Supplier reasoning:**
Given a supplier and a procurement task, the system reasons about: historical behavior patterns and
trajectory, risk factors and evidence-based mitigation strategies, negotiation leverage points and
their current strength, alternative supplier options with structured comparison, and recommended
approach calibrated to the current organizational context and relationship stage.

**2. Category reasoning:**
Given a procurement category, the system reasons about: current market conditions and price dynamics,
supplier concentration risk and competitive landscape, seasonal and cyclical procurement patterns,
category-specific regulatory or compliance factors, and strategic sourcing opportunities available
given current market conditions and organizational spend exposure.

**3. Negotiation reasoning:**
Given an upcoming negotiation, the system reasons about: historical negotiation outcomes with this
supplier and comparable suppliers, price benchmark positioning and market leverage, balance-of-power
assessment, recommended negotiation strategy with explicit rationale, and concession scenario modeling
with minimum acceptable outcome thresholds.

**4. Spend reasoning:**
Given organizational spend data, the system reasons about: category spend concentration and
diversification risk, maverick spend patterns and their cost impact, savings opportunity identification
with prioritized action list, preferred supplier utilization rate vs. contract commitments, and
budget exposure across active procurement commitments.

**Cognition quality standard:**
All procurement cognition outputs must be: specific (named suppliers, categories, amounts, timeframes),
actionable (recommended actions — not observations or data summaries), traceable (data sources and
reasoning steps named explicitly), and confidence-calibrated (uncertainty acknowledged with evidence).

---

### 10.23 — NEGOTIATION INTELLIGENCE PRINCIPLES

Negotiation intelligence is SpendGuru 2.0's highest-value capability and most critical proof point.
If SG2 cannot demonstrably improve negotiation preparation and outcomes, the product has not fulfilled
its core mission regardless of how many other features it contains.

**What negotiation intelligence provides:**

**Pre-negotiation synthesis:**
Before a negotiation session, the system produces a structured negotiation brief containing:
- Supplier historical pricing behavior and concession pattern analysis
- Market benchmark data for the relevant category and product/service scope
- Internal spend exposure, dependency level, and switching cost assessment
- Previous negotiation outcomes with this supplier and what worked
- Recommended opening position, target outcome, and walk-away threshold
- Risk scenarios and contingency strategies for common negotiation breakdowns

**Leverage analysis:**
The system identifies and quantifies negotiation leverage for both parties:
- Buyer leverage: spend volume, alternative supplier options, market conditions, timing
- Supplier leverage: sole-source dependency, capacity constraints, switching costs, relationships
- Balance of power assessment and its strategic implications for negotiation approach
- Leverage trajectory — is buyer or supplier leverage strengthening or weakening?

**Scenario planning:**
For each significant negotiation, the system models structured outcome scenarios:
- Best-case outcome (full concession scenario with probability estimate)
- Target outcome (realistic best outcome given current leverage balance)
- Walk-away scenario (minimum acceptable terms — explicitly defined before negotiation begins)
- Concession logic (what to offer, in what sequence, to maximize the probability of target outcome)

**Post-negotiation learning:**
After every negotiation, the system captures structured intelligence:
- Actual outcome versus pre-negotiation predicted outcome and the variance explanation
- Which strategies were effective — and the conditions under which they worked
- New intelligence about supplier behavior, flexibility limits, and decision patterns
- Updated supplier negotiation profile in the organizational knowledge graph

---

### 10.24 — RECOMMENDATION ENGINE PHILOSOPHY

SpendGuru 2.0's recommendation engine is the primary interface between organizational intelligence
and procurement professionals. It is the system's most visible capability and its core value delivery.

**Recommendation design principles:**

**1. Specific over general.**
"Renegotiate logistics contract with Acme Corp — price is 14% above current market benchmark for
equivalent SLA terms" is a recommendation. "Review your supplier contracts" is not a recommendation.
Specificity is non-negotiable. Generic recommendations are indistinguishable from generic software.

**2. Actionable over informational.**
Every recommendation ends in a proposed action — not an observation that requires the user to
determine what to do. "Supplier reliability has declined" is an observation. "Initiate a performance
review meeting with Supplier X within 2 weeks and activate the backup supplier contingency for
Category Y pending outcome" is a recommendation. The action must be explicit and completable.

**3. Traceable over opaque.**
Every recommendation displays its reasoning in accessible language: which data it used, what
comparison it made, what threshold triggered the recommendation. "Based on 36 months of delivery
data across your 4 distribution facilities, this supplier's on-time delivery has declined from
94% to 81% in Q3-Q4 — historically your highest-volume season" is traceable. "Based on data" is not.

**4. Ranked over equal.**
When multiple procurement recommendations exist simultaneously, they are ranked by expected impact,
urgency, and confidence. The highest-priority recommendation is always the primary UI element.
The user's attention is directed — not distributed across undifferentiated recommendation lists.

**5. Contextual over generic.**
Recommendations are calibrated to the specific tenant, category, supplier, user role, and current
organizational context. The same market signal produces different recommendations for a chemicals
manufacturer's direct materials procurement and a tech company's indirect IT procurement.

**Recommendation type taxonomy:**
- **Immediate action** (high urgency, high confidence): Act now — clear reason, specific action, named deadline
- **Opportunity** (medium urgency, high confidence): Favorable conditions for a procurement action — time-bounded
- **Risk alert** (variable urgency, specific risk): Named risk, named entity, evidence-based recommended mitigation
- **Intelligence update** (low urgency, informational): New organizational intelligence with no immediate required action

---

### 10.25 — SYSTEM EVOLUTION EXPECTATIONS

SpendGuru 2.0 is designed to evolve. The following evolution expectations must inform every
architectural decision made during initial greenfield development — including decisions that appear
to be purely about the immediate implementation scope.

**Phase 1: From greenfield to operational intelligence (current scope)**
- Core procurement intelligence functional for single tenant deployment
- AI recommendations demonstrably better than manual research for key procurement tasks
- Organizational memory accumulating with each procurement interaction
- PMOS development continuity established and maintained throughout all development sessions

**Phase 2: Multi-tenant production readiness**
- Full tenant isolation with independently scoped memory partitions
- Tenant onboarding workflow and data initialization pipeline
- Per-tenant AI calibration through memory depth and organizational profile
- Production monitoring, AI quality metrics, and recommendation performance tracking

**Phase 3: CIC integration**
- CIC bridge fully operational — SG2 procurement reasoning routed through CIC
- CIC-produced recommendations consumed by SG2 recommendation surface and presentation layer
- Unified organizational memory accessible to both SG2 domain layer and CIC intelligence layer
- Negotiation intelligence powered by CIC's full multi-step reasoning capability

**Phase 4: Multi-agent procurement runtime**
- Multiple specialized procurement AI agents (supplier, category, negotiation, contract, spend)
- LangGraph multi-agent orchestration managing cross-agent collaboration within tenant boundary
- Recommendation synthesis from multiple specialized agent perspectives
- Agent-to-agent knowledge sharing with tenant isolation maintained at all levels

**Phase 5: Procurement AI platform**
- SG2 becomes an extensible procurement AI infrastructure layer
- Custom intelligence modules for specific procurement verticals and categories
- API access enabling integration with external procurement tools and ERP systems
- Enterprise white-label and multi-instance capabilities

**Architecture constraint from evolution expectations:**
Every technical decision made in Phase 1 must be demonstrably compatible with Phase 4 multi-agent
architecture. Architectural shortcuts that create incompatibility with Phases 3–4 are not acceptable,
even under greenfield development speed pressure. The architecture must be designed for where the
system is going — not only for where it is today.

---

═══════════════════════════════════════════════════════════════
═══ END PROMPT ════════════════════════════════════════════════
═══════════════════════════════════════════════════════════════
