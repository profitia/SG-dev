# PMOS Philosophy
## Project Memory Operating System — Conceptual Foundation

> For the structural and technical architecture, see [PMOS-ARCHITECTURE.md](./PMOS-ARCHITECTURE.md).

---

## What This Document Is

This document explains the conceptual foundation of PMOS — why it exists, what it is designed to do, and what it is explicitly not.

It is written for developers who want to understand PMOS before using it, and for AI assistants who consume the runtime context PMOS produces.

It is not a tutorial. It is not marketing. It is the canonical statement of PMOS intent.

---

## The Problem That PMOS Addresses

Modern software development increasingly involves AI assistants. These tools — GitHub Copilot, Claude, ChatGPT, and others — can generate code, analyze architecture, explain tradeoffs, and execute multi-step changes across a codebase.

They have one structural problem: **no persistent memory**.

Every session starts from zero. The AI does not know:
- What decisions were made and why
- What was built last week and what it replaced
- What architectural rules must not be violated
- What risks are currently active and unresolved
- What the next logical unit of work is

The developer compensates by re-explaining context. Over and over. In every new session.  
The AI compensates by making plausible guesses based on code structure and conversation history.

Neither is reliable. Both degrade with project age. The older the project, the more context is lost.

PMOS is the answer to this problem.

---

## What PMOS Is

PMOS is a **runtime memory system** embedded inside a project.

It is a structured, queryable store of facts about a project:
- What is being built (roadmap)
- Why decisions were made (decisions / ADRs)
- What rules the codebase must follow (canonical principles)
- What risks are currently active (architecture warnings)
- What was built in past sessions (execution logs)
- What conversations with AI have produced (conversation artifacts)

It runs as a local application — a Next.js server — that exposes a REST API. This API is consumed by:
- A **context builder** (a script that generates a Markdown document from live data)
- The **AI assistant** (which reads the context document before starting any work)
- The **developer** (who reads and updates the memory via the PMOS UI)

The output — `runtime-context.md` — is the artifact that flows into the AI context. It is generated automatically. It is not written by hand. It is not a documentation file. It is a machine-readable, AI-consumable snapshot of project memory at a point in time.

---

## What PMOS Is Not

**PMOS is not Jira.**  
There are no sprints. No stories. No epics. No velocity. No burndown. No acceptance criteria. No definition of done. These concepts are designed for teams managing work assignments across people and time. PMOS is designed for a developer and their AI assistant managing architectural continuity across sessions.

**PMOS is not a documentation system.**  
Documentation explains. PMOS remembers. The distinction matters: documentation is read by humans who need to understand. PMOS data is consumed by AI tools that need to act. A documentation system is written once and maintained reluctantly. PMOS is written continuously as a byproduct of development work.

**PMOS is not a SaaS product.**  
It does not live in the cloud. It does not have a central database. It does not have accounts, subscriptions, or sharing. Each project has its own PMOS. Each PMOS has its own database. There is no concept of a PMOS organization or workspace. PMOS is intentionally per-project — because memory that is shared across projects is not project memory, it is organizational knowledge management. That is a different problem.

**PMOS is not a CI/CD tool.**  
It does not trigger deployments. It does not manage pipelines. It does not enforce code review processes. It is not wired to git hooks. PMOS captures the history of what was built and why — it does not control the mechanics of how code moves from local to production.

**PMOS is not a ticket system.**  
Roadmap nodes (ETAPs) are not tickets. They do not have assignees, due dates, priority scores, or status workflows defined by business rules. An ETAP has four states: `backlog`, `in_progress`, `done`, `blocked`. The state is determined by the developer's current focus, not by an external workflow engine.

**PMOS is not a test framework.**  
It does not run tests. It does not track test coverage. It does not gate deployment on green tests. These capabilities belong in CI pipelines. PMOS captures that tests were implemented as part of a session — but does not replace the tools that run them.

---

## Why Continuity Matters

Software projects have a continuity problem that is poorly addressed by existing tools.

Code reviews capture what changed and whether it's correct. Pull request descriptions capture intent — but incompletely and inconsistently. Commit messages capture the what — rarely the why. Architecture decision records (ADRs) capture important decisions — but are typically written after the fact, when the reasoning is already partially forgotten.

The result: projects accumulate decisions that no one can explain, patterns that no one can justify, and constraints that no one knows exist. New developers (or AI assistants) encounter this system and have no way to distinguish "this is how it is by design" from "this is an accident of history".

PMOS addresses this by creating a **continuous record** — not a snapshot document, but a living store that is updated as decisions are made, sessions are completed, and risks are identified.

Every time an AI session produces a decision, that decision is recorded. Every time a session builds something, an execution log captures what was built, what changed, and what the next step is. Every time a risk is identified, a warning is created and remains visible until it is explicitly resolved.

The record is not perfect. It is not complete. But it is **persistent** — and persistence is the property that matters.

---

## AI-Native Development

The phrase "AI-native" means something specific in PMOS: the system is designed from the ground up assuming that an AI assistant is the primary consumer of its output.

This has specific design consequences:

**The context file is a first-class output.** `runtime-context.md` is not a log or a report. It is the primary product of the PMOS runtime — the document that flows into every AI session as the first thing the assistant reads. It is designed for AI consumption: structured, dense, actionable.

**Data is expressed in AI-friendly terms.** Principles are stated as rules, not narratives. Warnings are stated as specific risks with named affected areas, not vague concerns. Decisions are stated with explicit reasoning chains — because an AI that knows why a decision was made can reason about it correctly in new situations.

**The bootstrap system is AI-executable.** `APPLICATION-BOOTSTRAP-PROMPT.md` is designed to be executed by an AI assistant without human intervention at each step. The human configures intent (the PROJECT INPUT BLOCK); the AI executes the initialization. The output is a fully structured project memory, not a half-filled template.

**Memory is designed for injection.** The context file is not 10,000 words of narrative — it is a structured, scannable document with clear section headers, lists, and status indicators. AI tools can parse it quickly, extract the relevant sections, and apply them as constraints on their next action.

---

## Runtime Cognition

A key concept in PMOS is **runtime cognition** — the idea that the AI assistant should have access to the relevant facts about the project state at the time it is acting.

This is different from historical knowledge (what the codebase contains) and from specification (what the project is supposed to do). Runtime cognition is the set of active constraints:

- What ETAP is in progress right now?
- What principles must not be violated?
- What warnings are currently active?
- What did the last session build, and what did it leave incomplete?
- What are the next steps?

Without runtime cognition, the AI must infer these from code structure — which is slow, inaccurate, and does not capture reasoning or intent. With runtime cognition, the AI starts each session knowing what matters now, not just what the code says.

PMOS provides runtime cognition through the context file. The context file is rebuilt regularly (after each significant session) to reflect the current state. It is not a historical document — it is a snapshot of what is true right now.

---

## Governance Lineage

Governance lineage is the principle that decisions must be traceable — not just recorded, but connected.

A decision made in session 3 that is superseded by a decision in session 7 is not simply replaced. The connection between them is explicit: the new decision references the old decision, explains what changed and why, and declares what the old decision was right about (if anything).

This matters because architecture evolves. What was right at the beginning of a project may be wrong at the middle and irrelevant at the end. Without lineage, the evolution is invisible — the codebase shows only the current state, not the path that led to it. With lineage, the entire reasoning chain is recoverable.

PMOS preserves governance lineage by:
- Never deleting Decision records (only marking them superseded)
- Linking new decisions to the decisions they supersede
- Linking decisions to the principles they enforce or conflict with
- Linking conversation artifacts to the decisions they produced

The `.pmos/governance/` directory stores the lineage in file form — one ADR per file, one principle per file. These files are intended to be version-controlled alongside the codebase. They are the human-readable record of governance; the database is the machine-readable store.

---

## Memory Semantics

PMOS distinguishes between three types of memory:

**Architectural memory**: decisions, principles, warnings. These are durable — they change slowly and only with explicit intent. An architectural decision is not reversed lightly. A principle is not removed because it is inconvenient. A warning is not dismissed without a documented reason.

**Execution memory**: execution logs, changed files, prompt executions. These are historical — they accumulate over time and form a record of what was built. They are not edited or deleted. They are appended.

**Conversational memory**: conversation artifacts. These capture what happened in an AI session — what was discussed, what was decided, what was built, what was deferred. They are the most volatile form of memory — they are generated in every session — but also the most specific. A conversation artifact for a debugging session is different from one for an architecture review, which is different from one for feature implementation.

The distinction matters for query and injection purposes. When building the runtime context for an AI session, the context builder selects from all three memory types — but it weights them differently. Active warnings and current principles are always included. Execution logs are summarized (most recent N). Conversation artifacts are referenced by type and recency.

---

## Orchestration Semantics

PMOS does not orchestrate AI. It does not invoke AI tools, send prompts, or manage AI sessions.

PMOS is the **substrate** on which AI orchestration operates. It provides the shared state that multiple AI tools (or multiple sessions of the same tool) can read and write against.

A developer who uses Copilot for implementation and Claude for architecture review benefits from PMOS only if both tools consume the same runtime context. This is the intended usage model: one PMOS instance per project, consumed by multiple AI tools, each contributing to the memory store after their sessions.

Orchestration in this model is the developer — not an automated system. The developer decides which tool to use for which task, ensures the context is current before each session, and updates the PMOS record after each session.

This is intentional. Automated AI orchestration is a hard problem with many failure modes. PMOS does not attempt to solve it. It provides the memory infrastructure for a human-in-the-loop orchestration model.

---

## Why PMOS Lives Inside Projects

PMOS is not a separate tool installed globally. It is not a browser extension. It is not a plugin. It is not a cloud service.

PMOS lives inside the project directory — specifically at `apps/pmos/`. This is a deliberate design choice.

**Memory is local to the project it describes.** The ETAP history of Project A is irrelevant to Project B. The principles of a procurement tool do not transfer to a health app. The warnings in a microservices architecture do not apply to a monolith. Global memory stores that aggregate across projects are organizational knowledge management tools, not development memory tools. PMOS is the latter.

**The codebase and its memory should be in the same repository.** Governance decisions, principles, and warnings should travel with the codebase when the repository is cloned, forked, or transferred. If PMOS were external, a new developer would have access to the code but not the memory. The `apps/pmos/` placement ensures memory is co-located with what it describes.

**Self-hosted means no dependency on external availability.** A cloud-hosted memory service goes down. Account credentials expire. Pricing changes. None of this affects a PMOS instance running on localhost. The developer's project memory is not contingent on a third party's infrastructure.

**The runtime context path is well-defined.** GitHub Copilot reads `.context/` relative to the workspace. By placing PMOS in `apps/pmos/`, the context file at `apps/pmos/.context/runtime-context.md` is discoverable. A globally installed PMOS would have no stable, predictable location for this file.

---

## Why PMOS Is Not SaaS-First

The SaaS model for developer tools typically involves:
- Centralized data storage
- Multi-user access control
- Subscription billing
- API rate limiting
- Uptime commitments

PMOS is designed for none of these.

The reason is not technical limitation — it is a deliberate philosophical choice. Developer tools that are SaaS-first optimize for the vendor's ability to retain users and grow revenue. The user's needs — privacy, ownership, offline access, zero ongoing cost — are secondary.

PMOS optimizes for the user's needs:

**Ownership**: Your project memory is in your database, on your infrastructure. It belongs to you, not to a vendor.

**Privacy**: Architecture decisions, design reasoning, and project history are sensitive. A SaaS PMOS would have access to all of it. A local PMOS does not leave your machine.

**Cost**: `npm install` is free. Running a Next.js app on localhost costs nothing. Neon's free tier is free. PMOS has no subscription, no seat pricing, no feature gating.

**Longevity**: A SaaS product can be acquired, shut down, or pivoted. A local file and a Postgres database will continue to work regardless of what happens to the company that created PMOS.

This philosophy constrains what PMOS can be. It cannot have real-time collaborative editing. It cannot have global search across all your projects simultaneously. It cannot push notifications. These are acceptable constraints given the design priorities.

---

## The Relationship Between Memory and Quality

The underlying hypothesis of PMOS is: **projects with structured memory produce better outcomes than projects without it**.

Better outcomes means:
- Fewer re-explained architectural decisions
- Fewer violations of principles that the AI didn't know about
- Fewer sessions wasted on re-discovering context
- Faster onboarding (for humans and AI alike) to a project's current state
- More consistent implementation of architectural intent across sessions

This hypothesis is not proven in the academic sense. It is a design principle, not a measured result.

What can be said: the cost of maintaining PMOS (rebuilding context after sessions, recording decisions when made) is low. The cost of not maintaining it (re-explaining context every session, discovering inconsistencies, reverting AI changes that violated unrecorded principles) accumulates over time.

PMOS is a bet that the maintenance cost is less than the accumulation cost. For solo developers on complex projects, for teams using AI assistants extensively, and for long-lived projects where history matters — this bet is likely correct.

---

## Design Principles of PMOS Itself

These principles govern how PMOS is built — not the projects it serves.

**Additive, not destructive.** PMOS never deletes records. It only adds. Memory is not erased — it is superseded, resolved, archived.

**Explicit over implicit.** A warning that is addressed must be explicitly marked as resolved, with a note. A decision that is superseded must explicitly reference its replacement. Nothing changes silently.

**Local first.** Data lives on localhost. Network dependencies are minimized. PMOS functions without internet access (assuming the database is accessible — which for localhost Postgres, it always is).

**The context file is ephemeral, the database is durable.** Never treat `runtime-context.md` as the source of truth. If it is lost, rebuild it. The database is where the truth lives.

**Config is code.** `pmos.config.ts` is version-controlled. It is not a UI-configured preference. The project's PMOS configuration is part of the project's codebase.

**Lightweight by default.** PMOS does not require Docker, Kubernetes, Redis, or any infrastructure beyond Node.js and Postgres. A developer should be able to run it on a laptop in under 10 minutes.
