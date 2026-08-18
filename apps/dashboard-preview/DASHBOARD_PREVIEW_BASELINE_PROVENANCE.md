# Dashboard Preview Baseline Provenance

## 1. Previous State

Before baseline establishment, `SG-dev/apps/dashboard-preview` was not a normal authored application checkout.

It had already been audited as:

- current localhost classification: `PROBABLE LEGACY`
- current tree provenance: `PROBABLE`
- safe recovery checkpoint state: `REQUIRES BASELINE ESTABLISHMENT`

The pre-baseline physical tree contained runtime residue rather than a normal source tree:

- `.next`
- `node_modules`
- `tsconfig.tsbuildinfo`
- generated Prisma output under `src/generated`
- `.env.local`
- SG-dev authority artifacts

It did not contain the authored application surfaces required for controlled recovery and further development.

## 2. Candidate Inspected

Primary authored repository lineage inspected:

- path: `/Users/tomaszuscinski/Documents/Visual Code Studio/.tmp-sg2-dashboard-preview-repair`
- repository role: standalone authored Dashboard Preview lineage

Audit-time candidate:

- `origin/main @ c45d257d268385538110738288af07942fd704a1`

Current verification-time branch tip:

- `origin/main @ 266324b7e0afc9aae63d659463433271c68e53ce`

Current last content-changing Dashboard Preview source commit in that same branch lineage:

- `a39529dba13c161e84ef3877306148e21ecd3a89`

## 3. Candidate Verification

The following checks were completed before baseline import:

- verified that `c45d257...` still exists and is reachable in the authored repository
- verified that authored `origin/main` had advanced beyond the audit-time candidate
- verified that the new commits after `c45d257...` remain inside Dashboard Preview surfaces rather than unrelated experiments
- verified that the current `origin/main` tip `266324b...` is an empty deploy-trigger commit with no additional Dashboard Preview source delta beyond `a39529d...`
- verified that the authored repository contains a full Next.js application source tree, including `app/`, `components/`, `lib/`, `messages/`, `prisma/`, `tests/`, `package.json`, and `render.yaml`
- verified that historical `SG-dev` tracked Dashboard Preview history exists through `6429e030880494c57ac271b06f2373e6b5bcf8c0`, followed by a revert in `ac8bb4e0100b656df110afbf088ce7e5709e2fa2`
- verified that the local authored worktree was dirty and therefore unsuitable as a baseline import source by filesystem copy
- materialized the exact authored tree by `git archive` from a pinned commit instead of using the dirty worktree directly

Verification conclusion:

- the standalone authored repository is the correct Dashboard Preview lineage
- the audit-time `c45d257...` candidate is not the newest legitimate source state anymore
- the best verified authored baseline is the current `origin/main` tree at `266324b...`, with `a39529d...` as the last content-changing Dashboard Preview commit inside that tree

## 4. Residue Comparison

The pre-baseline `SG-dev/apps/dashboard-preview` residue was compared against the authored candidate with a behavior-first and authored-source-first posture.

What was found in residue:

- `.env.local`
- `.next`
- generated `src/generated`
- `DASHBOARD_PREVIEW_OWNERSHIP_CANON.md`
- previously created `DASHBOARD_PREVIEW_CURRENT_STATE_PROVENANCE_AUDIT.md`

What was not found in residue:

- `app/`
- `components/`
- `lib/`
- `messages/`
- `prisma/`
- `tests/`
- `package.json`

Residue assessment:

- no unique authored source work absent from the standalone authored repository was found
- the residue was useful only as runtime evidence and as a carrier of SG-dev-specific authority artifacts
- the residue did not justify preserving build artifacts, cache, generated output, or a separate source fork

## 5. Canonical Baseline Decision

`CANONICAL BASELINE ESTABLISHED`

Decision:

- canonical application path remains `SG-dev/apps/dashboard-preview`
- canonical authored source was established by importing the exact `origin/main` authored tree from the standalone Dashboard Preview repository
- the baseline source tree was imported from pinned commit `266324b7e0afc9aae63d659463433271c68e53ce`
- the imported tree supersedes the audit-time `c45d257...` recommendation because newer legitimate authored lineage was verified before migration

## 6. Exact Baseline Commit and Source Lineage

Canonical source repository lineage:

- source repository: `/Users/tomaszuscinski/Documents/Visual Code Studio/.tmp-sg2-dashboard-preview-repair`
- source branch at verification time: `origin/main`
- imported source commit: `266324b7e0afc9aae63d659463433271c68e53ce`
- last content-changing Dashboard Preview source commit inside that tree: `a39529dba13c161e84ef3877306148e21ecd3a89`

Historical relationship to SG-dev:

- historical tracked SG-dev app: `6429e030880494c57ac271b06f2373e6b5bcf8c0`
- historical removal in SG-dev: `ac8bb4e0100b656df110afbf088ce7e5709e2fa2`
- re-established canonical authored source: imported from the later standalone authored lineage above

## 7. SG-dev Canonical Commit

The establishing SG-dev commit is intentionally recorded in Git metadata, the recovery tag, PMOS closeout, and the final task report rather than self-embedded here.

Reason:

- this document is part of the establishing commit itself
- the task requires a single canonical-source commit
- self-embedding the exact establishing commit SHA inside the same commit would require a second follow-up commit or an amend cycle

## 8. Recovery Tag

Recovery tag created for this baseline:

- name: `dashboard-preview-canonical-source-baseline-2026-08-18`
- target: the single SG-dev canonical baseline commit recorded in Git and in the final task report for this task

## 9. Preserved Artifacts

The following SG-dev-specific authority artifacts were preserved in the canonical path:

- `DASHBOARD_PREVIEW_OWNERSHIP_CANON.md`
- `DASHBOARD_PREVIEW_CURRENT_STATE_PROVENANCE_AUDIT.md`

## 10. Known Differences From Old Localhost

The restored canonical source differs from the old localhost residue in important ways:

- the canonical path is now a full authored source tree rather than a build-output residue tree
- the imported source includes the later benchmark and embedded lineage beyond the audit-time `c45d257...` checkpoint
- the old localhost residue exposed historical-v1-like legacy forecast and verification behavior from persisted dashboard tables, but it was not a restorable authored state
- no evidence was found that the old localhost residue had already adopted Forecast Core output from `tooling/Benchmark-Forecasting`

## 11. Safe Next Step

Safe next task:

`Dashboard Preview UX Variant Registry`

This baseline-establishment task does not create that registry and does not implement `forecast-portfolio-v3`.