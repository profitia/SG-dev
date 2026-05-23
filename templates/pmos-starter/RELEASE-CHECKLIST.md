# PMOS — Release Checklist
## v0.1.0 Release Candidate

Use this checklist before declaring a PMOS Starter-Kit version ready for release.  
Every item is binary. No item can be "mostly" or "probably" — it must be verified.

---

## PRE-RELEASE

- [ ] All items in RELEASE-AUDIT.md marked "Fix-Now" are resolved
- [ ] Version number updated in `apps/pmos/package.json`
- [ ] Version number matches CHANGELOG entry (most recent named version = package.json version)
- [ ] CHANGELOG has no items still in `[Unreleased]` that belong in this release
- [ ] VERSIONING.md reflects current version
- [ ] All documentation files updated for this version
- [ ] No open `TODO:` or `FIXME:` comments in source files
- [ ] All `.md` files in template root are internally consistent (no contradictory instructions)

---

## CONTAMINATION

- [ ] `grep -ri "leaxaro\|nutricoach" apps/pmos/src/` → 0 results
- [ ] `grep -ri "profitia\|spendguru" apps/pmos/src/` → 0 results
- [ ] `grep -ri "sentry" apps/pmos/src/ apps/pmos/.env.example` → 0 results
- [ ] `grep -ri "posthog" apps/pmos/src/ apps/pmos/.env.example` → 0 results
- [ ] `grep -ri "webd\.pl\|tomuscin" apps/pmos/src/` → 0 results
- [ ] `find apps/pmos -name ".DS_Store"` → 0 results
- [ ] `pmos.config.ts` `projectName` = `'My Project'` (the default — never a real project name in the template)
- [ ] `APPLICATION-BOOTSTRAP-PROMPT.md` `projectName` default = `"My Project"` (the template default)
- [ ] No hardcoded database credentials in any file
- [ ] No hardcoded project-specific URLs (e.g. real Neon endpoints) in any file

---

## BOOTSTRAP

- [ ] `APPLICATION-BOOTSTRAP-PROMPT.md` exists in Starter-Kit root
- [ ] `APPLICATION-BOOTSTRAP-PROMPT.md` is copied to `docs/` by `install-pmos.sh`
- [ ] `VSC-BOOTSTRAP-PROMPT.md` exists and is copied to `docs/` by install script
- [ ] PROJECT INPUT BLOCK in `APPLICATION-BOOTSTRAP-PROMPT.md` has all required fields with clear defaults
- [ ] All 9 phases in `APPLICATION-BOOTSTRAP-PROMPT.md` have: Goal, Subtasks, Expected Outputs, Validation Rule, Fail Conditions, Next Phase Gate
- [ ] Greenfield mode behavior is distinct from Existing Project mode (Phases 2 and 5)
- [ ] CIC Phase (Phase 6) correctly skips when `hasCIC: false`
- [ ] Bootstrap completion report format is valid and complete
- [ ] All API call formats in the prompt match actual PMOS API routes
- [ ] Phase gate protocol format is consistent across all 9 phases

---

## RUNTIME

- [ ] `npm run dev` starts PMOS on port 3200 without errors
- [ ] `GET http://localhost:3200/api/context/active` → 200 OK
- [ ] `GET http://localhost:3200/api/roadmap` → 200 OK with data
- [ ] `GET http://localhost:3200/api/principles` → 200 OK with data
- [ ] `GET http://localhost:3200/api/warnings` → 200 OK with data
- [ ] `GET http://localhost:3200/api/decisions` → 200 OK with data
- [ ] `GET http://localhost:3200/api/logs` → 200 OK with data
- [ ] `GET http://localhost:3200/api/timeline` → 200 OK
- [ ] `GET http://localhost:3200/api/search?q=test` → 200 OK
- [ ] `GET http://localhost:3200/api/conversations` → 200 OK
- [ ] Dark/light theme toggle works in UI
- [ ] RuntimeFocusBar shows active ETAP in header
- [ ] Global search (Cmd+K) opens and returns results

---

## DOCS

- [ ] `README.md` Quick Start section is accurate (all commands work)
- [ ] `INSTALL.md` all 8 steps are accurate and can be followed by a new user
- [ ] `PMOS-ARCHITECTURE.md` reflects current data model and API routes
- [ ] `PMOS-PHILOSOPHY.md` exists and is complete
- [ ] `CHANGELOG.md` exists and covers this release
- [ ] `VERSIONING.md` exists and is complete
- [ ] `UPDATE-STRATEGY.md` exists and covers all update scenarios
- [ ] `KNOWN-LIMITATIONS.md` exists and is honest
- [ ] `RELEASE-AUDIT.md` exists with all audit findings documented
- [ ] No documentation references non-existent files or routes
- [ ] No documentation uses marketing language in place of technical description
- [ ] `APPLICATION-BOOTSTRAP-PROMPT.md` HOW TO USE section is accurate

---

## BUILD

- [ ] `cd apps/pmos && npm run typecheck` → 0 errors
- [ ] `cd apps/pmos && npm run build` → 0 errors, 0 critical warnings
- [ ] All pages use `export const dynamic = 'force-dynamic'` (no static generation)
- [ ] `npm run build` output shows expected number of routes (≥10 app routes)
- [ ] No TypeScript `any` types introduced in this release
- [ ] No `console.log` statements in production code (only `console.error`/`console.warn`)

---

## VALIDATION

- [ ] `bash scripts/validate-pmos-install.sh [target]` → RESULT: PASS
- [ ] Validator `[FAIL]` count = 0
- [ ] Validator `[WARN]` count is documented and acceptable
- [ ] Smoke test in isolated environment passes (fresh directory, no prior state)
- [ ] `prisma db push` succeeds against a clean Neon database
- [ ] `npm run db:seed` succeeds and produces expected output (15 tags, 5 ETAPs, 5 principles, 2 warnings, 1 log)
- [ ] Context builder (`npm run context:build`) produces a non-empty `runtime-context.md`
- [ ] `runtime-context.md` does not contain "My Project" after pmos.config.ts is customized

---

## MIGRATION

- [ ] No breaking schema changes in this release (or migration guide is provided)
- [ ] If schema changed: migration SQL reviewed and tested
- [ ] If schema changed: `UPDATE-STRATEGY.md` schema migration section is accurate for this version
- [ ] `VERSIONING.md` compatibility table is updated to include this version
- [ ] Projects upgrading from v0.0.x can follow `UPDATE-STRATEGY.md` without data loss

---

## GOVERNANCE

- [ ] `.pmos/` directory structure is present in template
- [ ] All `.pmos/` subdirectories have `.gitkeep` files (so git tracks them)
- [ ] `.context/` directory has `.gitkeep`
- [ ] Install script creates all `.pmos/` + `.gitkeep` files correctly
- [ ] `RELEASE-AUDIT.md` "Fix-Now" action plan: all items resolved or explicitly deferred with justification

---

## CIC COMPATIBILITY

- [ ] `hasCIC: false` path: Phase 6 is completely skipped, no CIC-related data created
- [ ] `hasCIC: true` path: Phase 6 executes, ConversationArtifact is created with correct `project` field
- [ ] CIC conversation types map correctly to `ConversationType` enum values
- [ ] CIC memory strategy semantics in PMOS-PHILOSOPHY.md match APPLICATION-BOOTSTRAP-PROMPT.md Section 6
- [ ] No CIC terminology appears in non-CIC generated artifacts

---

## SIGN-OFF

Completed by: _______________  
Date: _______________  
Version: v0.1.0-release-candidate  

Overall result: [ ] PASS — ready for release  
               [ ] FAIL — items remain, document in RELEASE-AUDIT.md

Notes:

---
