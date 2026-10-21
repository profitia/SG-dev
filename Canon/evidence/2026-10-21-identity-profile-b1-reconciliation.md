# B1-R — Identity Profile reconciliation with accepted candidate.16

Date: 2026-10-21. Profile **ARCHITECTURE**, workspace **SG-dev Architecture**, target **development**, local execution and controlled GitHub Actions validation. Task **ARCHITECTURE-IDENTITY-B1-R-20261021**. Source authority **profitia/SG-dev / origin/main**. Existing [draft PR #591](https://github.com/profitia/SG-dev/pull/591) is updated, never replaced or merged by this task.

## Authority and authorization

The owner supplied the explicit B1-R task with FULL AUTOPILOT for bounded reconciliation, compatibility corrections, standard/controlled CI and own Architecture closeout. Its explicit ARCHITECTURE selection takes precedence over the generic SG2 selector in the accompanying wrapper; the common safeguards remain in force. No SG2/SRM continuity or source-write authority is acquired. G1, routing and User Profile v1 do not require approval again.

Accepted main: **3be3c0fd7dd15dc375373f818ccfa9c6b96b72e5**. Original B1: **c92490fc6f91b66b8722a57928966afb2bf8c390**, original base **39d0aadfafa621c214a69ac1b7f666a8220a51b1**. Accepted controller merge **0db84538d5a9f6e193d299c30a5660530eede523** remains an ancestor of main. The current eight-input policy digest is **0d8adb2810caa8baa724d2b71a68501b9912d14868b86e0ed3d7212cc680f7ba**.

Own begin: **cmvifzhf000009obh7sg1z786**. Derived conversation **pmos-task-v2:cff896c817e0d9d35f5d251df98e8368e1f4000f4a041587f4677ef3998f7109**, actual host **01a15aed-8d94-7fe0-9cff-c54f72b5f8a8**. Own registered **architecture_pmos / architecture_pmos_runtime** and endpoint in **billowing-credit-07394675**, own checkout/context/artifacts/PHR clone. MEMOROS **DISABLED_BY_PROFILE**. Full registered preflight passed before source reconciliation, without bypass options. All 17 declared targets resolve ALIGNED: package targets to Architecture Platform; evidence to Governance Source Layer with ARCHITECTURE permitted. No legacy write or routing change.

## Reconciliation decision

The original worktree, commits and immutable continuity remain intact. A clean integration worktree starts at accepted main so the mandatory ancestry gate passes before mutation. A controlled merge of the original B1 history retains both parents, accepted main first and original B1 second. The existing B1 branch can then advance by fast-forward without force push or rewriting either history. This local integration merge is not a GitHub merge of PR #591.

Git reported a content conflict only in **packages/platform-contracts/package.json**, in the exports and build fragments. The lockfile merged concurrently. No whole-file ours/theirs selection is used:

- Keep accepted aggregate version **1.24.0**.
- Preserve every accepted export, including **./supplier-location**, and add B1 **./identity-provisioning** and **./user-profile**.
- Preserve every accepted build check; add checks for identity-provisioning, user-profile and identity-profile-sql.
- Keep existing ipaddr.js resolution/integrity and the original B1 pinned devDependency **libphonenumber-js@1.13.15**. Generate the lock with ordinary npm package-lock-only, without lifecycle scripts; npm ci succeeds. No unrelated dependency upgrade or manual integrity change.

The resulting source adds no candidate.17 and does not downgrade Root to candidate.15. Current Root remains **profitia.operation-context / 1.0.0 / 1.0.0-candidate.16**, exact source provenance **9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728**. The actual eight-file source digest and SG2/SRM acceptance receipts agree.

## Preservation and source review

| Surface | Preserved boundary |
| --- | --- |
| Accepted candidate.16 | operation-context, request-operations, supplier-location, private-operation-host, request-ledger, request-work, declarations and all accepted SQL remain byte-identical to main |
| Existing consumers | SG2 Runtime/Dashboard, SRM and Maps source, lockfiles and integration receipts remain byte-identical to main |
| Identity Provisioning | Original B1 code/types/tests retained; existing official-SDK verifier, live session/user checks, exact issuer/subject binding, atomic single internal UUID, retry/concurrency, no email linking or automatic grants |
| User Profile | Original B1 code/types/tests retained; ACCOUNT_SELF, closed patch, avatar preference, optional unverified E.164, expectedVersion, same-organisation privacy, ordinary-role RLS and required audit |
| Security | Unbound/expired/revoked/disabled states deny; same-receiver mutation/Origin rules retained; no user-selected owner, policy/key read, role escalation or source credentials in proof execution |
| SQL | Profile migration is byte-identical to original B1; accepted access installation and every existing migration remain unchanged |
| CI/governance | Workflow/controller, policies, routing/manifest and profile identities remain unchanged |

The review follows actual B1 entrypoints through the existing authenticator, Access Store, private host, SQL attestation and transactional output/audit. No replacement IdP/authorization engine is introduced. The SQL scope seal is a short-lived backend transaction attestation, never a browser credential; no production PII or key is included in evidence. No B1 implementation change was needed after reconciliation. Historical B1 installation/admission/renewal/retention limits remain explicit.

## Local validation

- Original B1 suite: **39/39 PASS**, including real disposable PostgreSQL 16 ordinary-role RLS, concurrency/idempotency, forged-scope and cross-user denial, immutable/server fields, expiry/revocation, audit rollback and pool reuse.
- Full current platform-contracts plus architecture-lab: **1307 PASS, 0 FAIL, 0 SKIP**, using a separate disposable PostgreSQL 16 fixture restricted to loopback. No product connection. Both temporary clusters are stopped/removed.
- Governance/classifier/controlled-policy/path coverage: **302 PASS, 0 FAIL, 0 SKIP**. The two formerly failing development/Architecture preflight cases now pass against actual accepted-main ancestry.
- Package build, positive/negative B1 TypeScript declarations and Supplier Locations types: PASS. Self-package imports of the eight relevant old/new entrypoints: PASS.
- npm ci: PASS. Accepted export/build and resolution/integrity preservation checks: PASS. Original B1 implementation/tests/SQL preservation: PASS.
- PHR scanner: **21/21 PASS**. Historical archive retains six known duplicate-publication issues; no repair or global archive PASS is claimed.

The first full lab invocation lacked the mandatory local operation fixture: 973 PASS, 14 FAIL, 3 SKIP. Its log is retained; the failures were Invalid URL from absent fixture configuration. Supplying the existing required disposable local fixture, without changing tests or source, produces the complete 1307/1307 result above. No failed gate is relabeled PASS.

## Exact changed scope

Relative to accepted main, this PR contains the original 16 B1 files and this new evidence file. The original B1 handoff receives an explicit reconciliation note; its original historical installation policy is preserved. The only implementation-integration changes from original B1 are package.json and package-lock.json. No consumer or accepted shared-contract source is changed.

1. Canon/evidence/2026-10-21-identity-profile-b1-handoff.md
2. Canon/evidence/2026-10-21-identity-profile-b1-reconciliation.md
3. packages/platform-contracts/README.md
4. packages/platform-contracts/migrations/profile/001-user-profile.sql
5. packages/platform-contracts/package-lock.json
6. packages/platform-contracts/package.json
7. packages/platform-contracts/src/identity-profile-sql.mjs
8. packages/platform-contracts/src/identity-provisioning.d.mts
9. packages/platform-contracts/src/identity-provisioning.mjs
10. packages/platform-contracts/src/user-profile.d.mts
11. packages/platform-contracts/src/user-profile.mjs
12. packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs
13. packages/platform-contracts/test/identity-profile.integration.test.mjs
14. packages/platform-contracts/test/identity-provisioning.test.mjs
15. packages/platform-contracts/test/types/identity-profile.mts
16. packages/platform-contracts/test/types/tsconfig.json
17. packages/platform-contracts/test/user-profile.test.mjs

## Migration and remaining installation decisions

Migration **packages/platform-contracts/migrations/profile/001-user-profile.sql**, unchanged SHA256 **a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3**. Its separate profile schema reuses the unchanged accepted access installation/owner/APIs and has no Supplier Locations name/operation collision. Real synthetic profile tests and the full current access/Supplier Locations SQL suite pass. This is source compatibility evidence, not a live target installation.

Target remains **spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private / profitia_profile**. Follow the original B1 handoff's detailed minimal-grant/install/rollback checklist in a separately authorized task. Remaining owner actions are source approval/merge, separate installation authorization, verified pgcrypto function/ACL, controlled migrator and ordinary limited runtime roles, secure separate attestation key delivery, exact disabled-by-default registration policy and finite binding horizon, an explicit renewal decision, retention/deletion/export policy, reversible backup with restore rehearsal and rollback/reconciliation, and ordinary-role acceptance on the actual target before activation. No new approval of G1/routing/profile fields is requested. Live catalog state was not re-queried here, and historical absence is not asserted as a new observation.

## CI and continuity acceptance after this commit

The final exact source SHA, new trusted-main dispatch/run ID, original proof artifact and independent verification, full current-base public checks, mergeability and canonical closeout must be read from the final B1-R execution receipt. This source document cannot attest to its own later CI/publication. The old proof artifact12365743196 and historical merge snapshot9fceb9d4c4286ba3a33dcc90f64e4b95f9811bcb are never reused for acceptance of the new HEAD.

B1 source publication **f2b1ada9afd31ce038dcce819353a26771fb1936** and B1-V **f293a102870daf5b710e982df3ede46c9e334a45** remain immutable historical evidence. Own B1-R PMOS/PHR closeout must independently verify persisted Flight Record/HANDOFF/seals, publication ancestry, pending/file/advisory lock clearance and final full preflight. No live Neon write, resource/credential creation, Clerk change, deployment, PR merge or B2/C/D/E is authorized or performed. Stop after final handoff.
