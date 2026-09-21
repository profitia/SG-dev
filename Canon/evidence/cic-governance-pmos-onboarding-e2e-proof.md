# CIC Governance and PMOS Onboarding — end-to-end proof

Status: `END-TO-END PROOF COMPLETE`

Date: `2026-09-21`

## Scope

This proof covers the onboarding of `profitia/conversational-intelligence-core` (CIC) into the shared Profitia governance and PMOS lifecycle. It does not modify PPF-1 product code, Forecasting queues, DNS, or CIC runtime behavior.

## Repository authority and isolation

- CIC repository authority: `profitia/conversational-intelligence-core`, branch `main`.
- CIC onboarding PR: `profitia/conversational-intelligence-core#16`.
- CIC merged revision: `c97dc38346430310586bdcb36cb0da10d879c5a3`.
- Shared platform onboarding PR: `profitia/SG-dev#48`.
- Shared platform merged revision: `5ab261600e64fe50afef0c097f00a955f5c208b5`.
- Canonical MEMOROS destination isolation PR: `profitia/SG-dev#49`.
- MEMOROS isolation merged revision: `3495375fb8a19d9095812c51c662bb2f4cd05be0`.
- The stale, dirty local CIC checkout was not modified. All repository changes were made in isolated worktrees created from fresh `origin/main`.

## CIC governance proof

CIC now owns its project-specific governance surfaces:

- root `AGENTS.md` as the stable agent loader;
- `.github/copilot-instructions.md` as a tool adapter to the same policy;
- `governance/cic-project-governance-v1.md` as the CIC project contract;
- `governance/registries/cic-architecture-baseline-v1.json` as the machine-readable routing and code-state registry;
- deterministic validation, regression tests, and GitHub CI.

All 551 tracked CIC paths resolved deterministically. Canonical versioned packages, the knowledge corpus, and governance paths are `ALIGNED`. Historical `.pmos/**` files and `examples/runtime-app/**` are explicitly classified as legacy/reference surfaces and cannot act as a second continuity or runtime authority.

## Cross-repository preflight proof

The shared governance preflight in SG-dev now separates:

- the governance implementation root, which supplies the canonical PMOS lifecycle; and
- the selected repository root, against which identity, branch, code state, target paths, routing ownership, and legacy policy are verified.

A bounded bootstrap path was used only while CIC had no routing registry. After the CIC registry merged, normal deterministic routing immediately became mandatory. The live post-registry CIC preflight passed.

## PMOS and Neon proof

- CIC Neon project: `profitia-CIC-pmos` (`jolly-heart-70236009`).
- Database: `neondb`.
- Production branch: `br-mute-mud-b1azw1lr`.
- PMOS task: `CIC-GOVERNANCE-PMOS-ONBOARDING-20260921`.
- Conversation: `CIC-GOVERNANCE-FULL-AUTOPILOT-20260921-CIC`.
- Pre-execution registration ID: `cmubaczip0000t2ypnfwwnnsk`.
- Persisted execution status: `completed`.
- Persisted conversation artifact result: `SUCCESS`.
- Two final artifacts were persisted: one generated and one delivered.
- Runtime verification after closeout: `PASS`.
- Runtime context: present and integrity verified.
- Final pending artifact slot: clear.
- Advisory lock: clear.

The CIC database is separate from the SG2 and SRM PMOS databases. No SG2 or SRM record was used to represent this CIC execution.

## MEMOROS proof

- Dedicated project: `Conversational Intelligence Core`.
- MEMOROS project ID: `cmubasxat03t71glbo4x0nhfn`.
- Imported thread ID: `cmubb74ph03t81glbnh50189z`.
- The project contains exactly one CIC PMOS thread for this proof and seven derived knowledge items at verification time.
- The imported thread preserves the CIC task ID, project identity, findings, decisions, recommendations, changed artifacts, and validations.

The MEMOROS destination is now bound to the canonical Profitia project profile. It is no longer selected by the global `MEMOROS_PROJECT_ID` environment value. SG2 and CIC have distinct canonical destination IDs; SRM remains explicitly disabled for MEMOROS.

## PHR proof

- Namespaced publication ID: `CIC:CIC-GOVERNANCE-PMOS-ONBOARDING-20260921`.
- PHR publication revision: `ccd25b8`.
- PHR repository was clean and synchronized with `origin/main` after publication.

The namespaced publication identity prevents task-name collision between CIC, SG2, SRM, and future registered projects.

## GitHub and CI proof

- CIC PR #16: governance and full repository verification checks passed before merge.
- SG-dev PR #48: governance check passed before merge.
- SG-dev PR #49: governance check passed before merge.
- Project-profile and PMOS-save regression tests for PR #49: 18/18 passed.
- PMOS lifecycle TypeScript check: passed.
- Diff integrity check: passed.

## Render proof

The merged SG-dev PMOS changes triggered the configured automatic deployment of `pmos-spendguru2-development`.

- Deployment: `dep-daojecijnfac739porj0`.
- Deployed revision: `3495375fb8a19d9095812c51c662bb2f4cd05be0`.
- Deployment status: `live`.
- Root HTTP smoke test: `200`.
- Memory after deployment stabilized near 219 MB against a 512 MB limit.
- No HTTP 5xx responses were recorded in the inspected deployment window.
- A short burst of closed PostgreSQL connections was recorded once after deployment; the service remained live, the subsequent error window was clear, and the root smoke test passed.

## Final verdict

CIC is fully onboarded to the shared Profitia governance lifecycle while retaining project-specific repository routing and code-state control. The real task executed through `pmos:begin`, repository mutation, tests, merge, PMOS closeout, MEMOROS, PHR, persisted readback, and pending-slot clearance. No local wrapper or parallel CIC PMOS runtime is required.
