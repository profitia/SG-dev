# PMOS Starter-Kit — Capability Status Matrix
## Version: v0.1.0-rc

---

> **Legend**
> 
> **Status**: `implemented` | `partial` | `planned` | `conceptual`  
> **Stability**: `stable` | `experimental` | `fragile` | `unknown`  
> 
> `implemented` = exists and functions as described  
> `partial` = exists but with known gaps or edge case failures  
> `planned` = not yet implemented, scheduled for a specific version  
> `conceptual` = defined philosophically but has no current implementation
>
> `stable` = can be depended on without unexpected behavior  
> `experimental` = works but API or behavior may change  
> `fragile` = works under normal conditions but fails under edge cases  
> `unknown` = not fully validated; behavior under edge cases not characterized

---

## 1. Bootstrap System

| Capability | Status | Stability | Notes |
|---|---|---|---|
| APPLICATION-BOOTSTRAP-PROMPT.md — 9-phase engine | implemented | stable | 1113 lines; full greenfield + existing project modes |
| Greenfield mode (design-first) | implemented | stable | Phase 2 designs architecture; Phase 5 creates all `backlog` ETAPs |
| Existing project mode (analyze-first) | implemented | experimental | Depends on AI correctly reading codebase; quality varies by project size |
| Idempotency rules (duplicate prevention) | implemented | experimental | Search-before-create pattern; depends on AI executing the search step |
| Phase Gate Reports | implemented | stable | Standardized format; AI may vary output style |
| Bootstrap Validation Matrix (Phase 9) | implemented | stable | 11 checks; binary PASS/FAIL |
| VSC Bootstrap Prompt (reactive analysis) | implemented | stable | Lighter path; lower governance fidelity |
| Greenfield → PMOS population | implemented | experimental | Architecture is AI-designed; quality depends on prompt quality |
| Existing project → PMOS reflection | implemented | experimental | Requires AI to read and correctly interpret codebase |
| Bootstrap rollback | planned | — | v0.2.0; no undo for bootstrap writes |
| Bootstrap run tagging | planned | — | v0.2.0; records not marked with runId |
| CIC integration (Phase 6) | implemented | experimental | Conditional; only active when `hasCIC: true`; declarative only |

---

## 2. PMOS Runtime

| Capability | Status | Stability | Notes |
|---|---|---|---|
| Next.js 14 App Router runtime | implemented | stable | v14.2.29; 2 known CVEs (low impact on localhost) |
| Port 3200 (default) | implemented | stable | Configurable via `package.json` `dev` script |
| `/api/context/active` | implemented | stable | Returns active ETAP + principles + warnings + recent logs |
| `/api/roadmap` | implemented | stable | GET + POST; hierarchical tree support |
| `/api/principles` | implemented | stable | GET + POST; priority levels |
| `/api/warnings` | implemented | stable | GET + POST; severity + type classification |
| `/api/decisions` | implemented | stable | GET + POST; ADR format with reason + impact |
| `/api/logs` | implemented | stable | GET + POST; execution log with changedFiles + nextSteps |
| `/api/prompts` | implemented | stable | GET + POST; PromptExecution records |
| `/api/conversations` | implemented | stable | GET + POST; ConversationArtifact records |
| `/api/conversations/search` | implemented | stable | Full-text search on conversation artifacts |
| `/api/search` | implemented | stable | Cross-entity full-text search; 8 entity types |
| `/api/timeline` | implemented | stable | Unified chronological feed across all entity types |
| `/api/templates` | implemented | stable | PromptTemplate management |
| `/api/health` | planned | — | v0.1.1; currently `/api/context/active` is used as proxy |
| API authentication | planned | — | v0.2.0; all routes currently open on localhost |
| Port conflict detection | partial | fragile | Soft `lsof` check in install script; not enforced at runtime |

---

## 3. Governance Layer

| Capability | Status | Stability | Notes |
|---|---|---|---|
| CanonicalPrinciple CRUD | implemented | stable | API + UI; priority levels (low/medium/high) |
| ArchitectureWarning CRUD | implemented | stable | API + UI; severity + type + affectedArea |
| Decision (ADR) CRUD | implemented | stable | API + UI; reason + impact + affectedSystems |
| ADR cross-links to principles | implemented | stable | DecisionPrinciple junction model |
| ADR cross-links to conversations | implemented | stable | ConversationDecision junction model |
| `.pmos/` governance file artifacts | partial | fragile | Directory structure created; file generation only in `governanceModel: strict` mode via bootstrap |
| ADR lineage (supersedes chain) | partial | fragile | `supersededBy` field exists on Decision; no UI enforcement; no API validation |
| Warning resolution workflow | partial | fragile | `status` field exists; no resolution date or resolver tracking |
| Governance Bootstrap (Phase 4) | implemented | stable | Principles + warnings + ADRs created via API calls |

---

## 4. Continuity Layer (Runtime Context)

| Capability | Status | Stability | Notes |
|---|---|---|---|
| Context builder script (`build-pmos-context.ts`) | implemented | fragile | Relative path `../../scripts/` assumes specific directory depth |
| `runtime-context.md` generation | implemented | stable | Output at `apps/pmos/.context/runtime-context.md` |
| Context injection (GitHub Copilot) | partial | fragile | Copilot reads `.context/` relative to workspace; path may not resolve depending on workspace config |
| Context injection (Claude) | partial | stable | Manual attachment required; reliable when done |
| Context rebuild frequency | implemented | stable | `npm run context:build` on demand; no auto-trigger |
| Context as ephemeral artifact | implemented | stable | Database is the source of truth; context file is derived |
| Real-time context sync | conceptual | — | No live sync; rebuild is always manual |
| Offline context build | planned | — | PMOS must be running for context:build; no offline mode |

---

## 5. CIC Bridge

| Capability | Status | Stability | Notes |
|---|---|---|---|
| CIC Phase in bootstrap (Phase 6) | implemented | experimental | Conditional; declarative only |
| ConversationArtifact model | implemented | stable | 6 junction tables; full cross-linking |
| ConversationArtifact API (`/api/conversations`) | implemented | stable | GET + POST + search |
| CIC package path validation | partial | fragile | Checked in bootstrap but only if directory exists; no code analysis |
| Conversation type taxonomy | implemented | experimental | Maps to PMOS ConversationType enum; custom types use `other` |
| Memory strategy semantics | implemented | experimental | Documented in Section 6 of APPLICATION-BOOTSTRAP-PROMPT.md; no runtime enforcement |
| CIC-PMOS bridge rules | implemented | experimental | Documented in Section 6.3; no automated enforcement |
| CIC principles per conversation type | implemented | experimental | Created via bootstrap Phase 6; quality depends on AI execution |

---

## 6. Install Flow

| Capability | Status | Stability | Notes |
|---|---|---|---|
| `install-pmos.sh` script | implemented | stable | `set -euo pipefail`; pre-flight checks; trap handler |
| Node ≥20 validation | implemented | stable | Halts with clear message if not met |
| npm ≥10 validation | implemented | stable | Halts with clear message if not met |
| `.env.local` preservation on re-install | implemented | stable | Backed up to `/tmp/`, restored after copy |
| `pmos.config.ts` preservation (customized) | implemented | stable | Preserved if `projectName` ≠ `'My Project'` |
| Docs copy (APPLICATION-BOOTSTRAP-PROMPT.md, etc.) | implemented | stable | All 4 docs copied to `docs/` in target |
| `.pmos/` directory structure creation | implemented | stable | All subdirs + `.gitkeep` files |
| Prisma CLI validation post-install | implemented | stable | Warns if Prisma CLI not responsive |
| Port conflict detection (soft) | partial | fragile | `lsof` check; not all systems have `lsof`; does not block install |
| Rollback on failure | partial | fragile | Trap handler gives diagnostic instructions; does not auto-restore |
| Automated update (`pmos update`) | planned | — | v0.3.0 |

---

## 7. Update Flow

| Capability | Status | Stability | Notes |
|---|---|---|---|
| PATCH update procedure | implemented | stable | Documented in UPDATE-STRATEGY.md; safe file replacement |
| MINOR update procedure | implemented | stable | Documented; schema-additive only |
| MAJOR update procedure | implemented | experimental | Documented; requires schema migration |
| Schema update via `prisma db push` | implemented | stable | Primary path; no shadow database required |
| Schema update via `prisma migrate dev` | partial | fragile | Alternative for providers with shadow DB support; not tested on Neon free tier |
| Data backup procedure | implemented | stable | `pg_dump` + Neon branch strategy documented |
| Post-update validation | implemented | stable | `validate-pmos-install.sh` intended for post-update use |
| Automated update detection | planned | — | v0.3.0 |

---

## 8. Roadmap System

| Capability | Status | Stability | Notes |
|---|---|---|---|
| RoadmapNode CRUD | implemented | stable | API + UI |
| Hierarchical tree (parent/child) | implemented | stable | `parentId` field; unlimited depth |
| ETAP status tracking | implemented | stable | backlog / in_progress / blocked / done / archived |
| Status uniqueness enforcement (max 1 in_progress) | partial | fragile | Bootstrap prompt enforces via rule; API does not enforce; UI does not enforce |
| Roadmap view (UI) | implemented | stable | Tree navigation; status indicators |
| ETAP activation (mark in_progress) | implemented | stable | Via UI or API POST |
| ETAP ordering (`sortKey`, `order`) | implemented | stable | Lexicographic `sortKey` + numeric `order` |

---

## 9. Conversation Memory

| Capability | Status | Stability | Notes |
|---|---|---|---|
| ConversationArtifact creation | implemented | stable | API + UI |
| Conversation search | implemented | stable | `/api/conversations/search` full-text |
| Cross-link to RoadmapNode | implemented | stable | ConversationRoadmapNode junction |
| Cross-link to Decision | implemented | stable | ConversationDecision junction |
| Cross-link to ArchitectureWarning | implemented | stable | ConversationWarning junction |
| Cross-link to ExecutionLog | implemented | stable | ConversationLog junction |
| Cross-link to CanonicalPrinciple | implemented | stable | ConversationPrinciple junction |
| Cross-link to PromptExecution | implemented | stable | ConversationPrompt junction |
| Conversation memory browser (UI) | implemented | stable | Filterable, searchable, cross-links visible |
| Conversation reconstruction | conceptual | — | No mechanism to reconstruct deleted conversations |

---

## 10. Warnings and ADRs

| Capability | Status | Stability | Notes |
|---|---|---|---|
| Architecture warnings list (UI) | implemented | stable | Filterable by severity and type |
| Warning severity levels | implemented | stable | low / medium / high / critical |
| Warning types | implemented | stable | 7 types: dashboard_gravity, runtime_boundary, etc. |
| Warning resolution | partial | fragile | Status field only; no resolution date/reason enforcement |
| ADR management (UI) | implemented | stable | Full CRUD; linked to principles and conversations |
| ADR supersession chain | partial | fragile | `supersededBy` field present; no UI display or API enforcement |

---

## 11. Global Search and Timeline

| Capability | Status | Stability | Notes |
|---|---|---|---|
| Global search (`/api/search`) | implemented | stable | 8 entity types; full-text |
| Cmd+K search overlay (UI) | implemented | stable | Cross-entity, instant |
| Timeline view (`/api/timeline`) | implemented | stable | Unified chronological feed |
| Timeline filtering | partial | experimental | Basic filtering; advanced filtering not implemented |

---

## 12. Changed Files Tracker

| Capability | Status | Stability | Notes |
|---|---|---|---|
| ChangedFile model | implemented | stable | Path, impact level, linked to log/prompt |
| Changed files view (UI) | implemented | stable | Per-file impact levels |
| Changed files API | implemented | stable | GET + POST via `/api/logs` linked records |
| Automatic file change detection | conceptual | — | No git hooks or file watcher; manual entry only |

---

## 13. Theme System

| Capability | Status | Stability | Notes |
|---|---|---|---|
| Dark/light theme | implemented | stable | ThemeProvider in layout.tsx; CSS variables |
| Theme persistence | implemented | stable | Via `next-themes` localStorage |
| RuntimeFocusBar | implemented | stable | Active ETAP display in header |
| Tailwind v3 | implemented | stable | CSS utility classes |

---

## 14. Validator (`validate-pmos-install.sh`)

| Capability | Status | Stability | Notes |
|---|---|---|---|
| Required files check | implemented | stable | 15 file checks |
| Required directories check | implemented | stable | 9 directory checks |
| `.env.local` validation | implemented | stable | Presence check; DATABASE_URL presence |
| `pmos.config.ts` default detection | implemented | stable | Warns if `projectName: 'My Project'` |
| Contamination scan | implemented | stable | Leaxaro, Profitia, Sentry, PostHog, WEBD.pl |
| Layout integration check | implemented | stable | ThemeProvider, RuntimeFocusBar, force-dynamic |
| Prisma client check | implemented | stable | Generated client presence |
| Typecheck (`tsc --noEmit`) | implemented | stable | Captures type errors |
| Build (`next build`) | implemented | stable | Full production build check |
| API routes check (live) | partial | fragile | Only works if PMOS is running at 3200 |
| Context file check | implemented | stable | Existence check only; content not validated |

---

## Capability Summary

| Category | Implemented | Partial | Planned | Conceptual |
|---|---|---|---|---|
| Bootstrap System | 9 | 1 | 2 | 0 |
| PMOS Runtime | 14 | 1 | 2 | 0 |
| Governance Layer | 5 | 4 | 0 | 0 |
| Continuity Layer | 5 | 2 | 1 | 1 |
| CIC Bridge | 4 | 2 | 0 | 2 |
| Install Flow | 8 | 2 | 1 | 0 |
| Update Flow | 5 | 1 | 2 | 0 |
| Roadmap System | 6 | 1 | 0 | 0 |
| Conversation Memory | 9 | 0 | 0 | 1 |
| Warnings and ADRs | 4 | 2 | 0 | 0 |
| Search and Timeline | 2 | 1 | 0 | 0 |
| Changed Files | 3 | 0 | 0 | 1 |
| Theme System | 4 | 0 | 0 | 0 |
| Validator | 9 | 2 | 0 | 0 |
| **Total** | **87** | **19** | **8** | **5** |

---

*Matrix generated: 2026-05-18. Next review: v0.1.1 release.*
