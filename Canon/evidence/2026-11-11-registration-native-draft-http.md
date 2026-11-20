# Stage I native Identity organisation draft — source checkpoint

Status: SOURCE_IMPLEMENTED / LOCAL_VALIDATION_PASS / JOINT_ADMISSION_PENDING.
No runtime activation or full Stage I completion is claimed.

## Scope and ownership

ARCHITECTURE task ARCH-REGISTRATION-NATIVE-DRAFT-HTTP-20261111.
PMOS registration cmwcdiqty000038t5nwrnyk9t, conversation
pmos-task-v2:91a649aeb050727b5982f88e96e9106ae4f201f51336cc8e7e8615fa50c581c6.
All six exact targets passed registered pre-execution governance.
The isolated remote source starts at Architecture checkpoint bb76e872c4d1f767b35d0f7d58da8bf3708ee0b1
and accepted authority main0775f8a18d2fbeca462bb0a9d654914b15c53dad.

The exact PR1012 policy was completed through PR1013, including resulting-main
checks and independently verified PMOS/PHR:
https://github.com/profitia/project-history-repository/blob/594fabdb901c9c91e9b3982693c990d4c51746a3/history/2026/11/11/2026-11-11-16-13-06Z__architecture-arch-registration-sdk-test-source-approval-20261111/closeout-evidence.json
That bounded completion is separate from this new source and the parent Stage I.

## Implemented behavior

The production HTTP handler and startup now support an explicitly enabled,
Development-only GET/POST /v1/account/organisation-onboarding surface.
It calls the real shared draft backend, existing verified-primary-email Clerk
adapter and production pg transaction adapter. Root16, ordinary-role SQL
attestation, access leases, audit transaction and optimistic versioning remain
authoritative. There is no second storage or access engine.

The opt-in requires exact profile007 schema bytes and the existing runtime and
self-service prerequisites. Startup checks the actual installed policy; readiness
also checks it. No flag installs SQL or grants. The default runtime remains off
for this new surface.

GET resumes the current account's draft. POST accepts exactly expectedVersion
and patch; forbidden user/organisation IDs, registry company data, roles and
product grants cannot enter that contract. Stale writes return409. Two simultaneous
writes from the same version result in one success and one conflict.
The current common4096-byte HTTP limit is retained.

The surface is same-receiver only: exact configured origin, CSRF/content type,
official current identity, verified email and no browser CORS. Revoked/unverified
identity and disabled SQL policy fail closed. Client-side avatar/tenant hints
never establish authority.

## Actual validation

On PostgreSQL16 using an ordinary identity_b1_runtime role and synthetic,
isolated local fixture only:

- 118/118 selected Identity regression tests passed, fail0, skipped0.
- Includes10 new opt-in/native draft tests and real native Node HTTP receiver.
- Real persisted save and adapter restart/resume; optimistic concurrency.
- Own-account separation, ordinary-SQL bypass rejection, revoked/unverified
  identity, foreign receiver, CSRF, method/query/body limits.
- Existing account provisioning/transaction deadlines, avatar/salutation,
  registration/session security, conversational onboarding and invitation mail
  renderer regressions.
- Full Identity TypeScript no-emit check and build passed; lint/source guard passed.
- git diff --check passed.

The nine selected files were organisation-draft, assistant-avatar,
account-salutation, account-provisioning, http-security, session-security,
organisation-onboarding, organisation-invitation-email and registration.
This is not a claim that the whole monorepo or strict new source compatibility
has passed.

A first assertion expected403 for a wrong content type; the existing canonical
HTTP contract returns400. The test was corrected to that actual contract.
The wider startup test initially lacked its local platform-contracts dependency
link; corrected only the task-owned ignored test setup. No access rule/test was
disabled and no production dependency pin changed.

SHA256:
- src/organisation-draft.ts bba7165ae3bbd799778312722725e888b7a33347918f393618c67ca4026b3a4f
- src/http-handler.ts 362687ff03605bc908443992844f887aba69d7e263383f2f38893bbb2fca3ca0
- src/main.ts 5396d018303d3356c73523ee4edfc06ab8725d29c42125c7c8e60087e4345fd4
- test/organisation-draft.test.mjs 128683cefed1ba9ee0dadf271a66320678a2d5babbb4f69c794e8b643a1c0328

## Remaining work and limits

This branch retains the unadmitted Architecture/recurring source checkpoint.
The exact approved strict source helper remains f309cb4; no unknown record or
altered validator was evaluated. Current joint source still needs a concrete
successor review, required decision, controlled/public exact-head tests and
resulting-main verification. This checkpoint is not SOURCE GO.

Still required for full Stage I: full native organisation lookup/create/snapshot,
personal categories and membership routing, transactional invitations/acceptance/
outbox using the existing renderer/transport, canonical PORR reconciliation,
Package/Limits to E1 projection, admitted UI/embedded receiver, Development
tenant/session routing, release and real end-to-end acceptance.

No product SQL, new real organisation/membership, grants/package assignment,
real invitation delivery, paid source/model call, DNS or deployment was performed.
Parent Stage I, source and receiver work remains active. Durable artifacts are
published to GitHub and canonical PMOS/PHR; no laptop artifact was created.
