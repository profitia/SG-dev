# Insights G1 — bounded trusted CI admission

Status: OWNER_EXECUTION_AUTHORIZED / CONTROLLED_MAIN_ACCEPTANCE_REQUIRED.
Task `ARCH-INSIGHTS-G1-CI-ADMISSION-20261107`; host `01a19fe2-0dc1-7ca2-8acf-28504684e3c1`.

Human owner request2026-11-07 explicitly names PR848 and its two failures and directs a minimal properly owned correction through trusted governance, preserving all security. It also explicitly permits necessary minimal governance code/configuration and controlled merge. This is the authority for this exact narrow correction, not the old G1 grant or another task's CI approval. No new product concept or generic path permission is introduced.

## Actual cause and fix

The trusted producer classifier allowed registered package-producer paths and named historical review bundles. The four-file new-capability routing delta was not one of them (`ARCHITECTURE_PATH_REJECTED`); its original governance/ branch also lies outside the three generic candidate namespaces. Neither source ownership nor product approval automatically extends a secret-bearing CI admission.

The fix binds that one existing PR/branch to Architecture, then requires the complete exact four-file closure below. All existing checks remain; no fictitious producer file, policy-probe result, stale proof or validation skip substitutes for execution. The updated source preserves all current main entries/tests and appends the original approved G1 rows/test semantics.

## Frozen candidate

```json
{
  "prNumber": 848,
  "branch": "governance/procurement-insights-g1-20261101",
  "reviewedCandidateSha": "f24d1c017bd6766bf3b2d382ef12c0040bc5311c",
  "reviewedBaseSha": "734ccc742be1e5183a2d45436a575fd52f185361",
  "blobs": {
    "Canon/registries/current-architecture-baseline-v1.json": "d1dff639dee376331f6aea34e89ea5fe5294c1dd",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "05996c7c2b3dfd66df61b6a9a14c9a771be9c6d5",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md": "f9c8e4f2a4ea8b2defdbb7bd15efb24bfde345f7",
    "scripts/governance/governance.test.mjs": "07c21dee8234fd52b960181c84eb3d7987f731c0"
  },
  "statuses": {
    "Canon/registries/current-architecture-baseline-v1.json": "modified",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "modified",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md": "added",
    "scripts/governance/governance.test.mjs": "modified"
  },
  "modes": {
    "Canon/registries/current-architecture-baseline-v1.json": "100644",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md": "100644",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md": "100644",
    "scripts/governance/governance.test.mjs": "100644"
  }
}
```

## Required verification and limits

Unit tests include positive real closure, missing/extra/changed/duplicate/rename/status cases, wrong PR/branch/prefix, actor/fork/ref/SHA and100755/120000 rejection. The real candidate API and Git tree/modes/routing are independently checked. Old controller tests and historical constants remain unchanged.

A separate bootstrap policy PR is necessary under the active runbook. It receives old-main exact-SHA controlled proof and all applicable checks before merge. The new policy digest requires a new exact-candidate848 proof and resulting-main verification. This document never asserts a future CI PASS or merge before it occurs.

No workflow, Environment, secret, private package pin, Source/E1 grant, resource, schema, runtime, API call or deployment changes. The three future Insights product surfaces remain SG2-only; Architecture gains no product-write scope.
