# New-device notification — prepared source, not activated

Task: `ARCHITECTURE-NEW-DEVICE-EMAIL-20261025`.
Actual host conversation: `01a15aed-8d94-7fe0-9cff-c54f72b5f8a8`.
PMOS registration: `cmvo6qknw0000q572vfck2609`, database `architecture_pmos`.
Derived conversation: `pmos-task-v2:36c4d7572d47488683be0156d97863bdf301eb463898e9c5439f365142fe066e`.
Profile ARCHITECTURE; MEMOROS disabled; PHR required at canonical closeout.

## Verified observations

- Current authenticated Clerk Development instance has **Sign in from new device**
  enabled and native **Delivered by Clerk** ON. Its default English body contains
  sign-in method, device, location, IP, time and conditional provider session revoke.
  The original editor source was preserved locally. No Clerk setting was changed.
- Existing MagicPath email designs were read at exact reference revisions. Added
  PL `465176061597077504` / `465182867748720640` and EN
  `465176072246398976` / `465182875512377344`; both builds completed and both
  native previews were visually inspected. Browser preview confirmed female
  preference switch and a clearly labeled non-operational CTA preview with Escape.
- The initial isolated checkout was based on accepted main `a6fe5e3d0d22368415cde164e7146366b18dc4a4`.
  Full standard governance preflight and canonical PMOS begin passed before source
  edits. All declared targets resolved to Architecture Platform or its allowed
  Governance Source Layer, ALIGNED. A fresh checkout's missing derivative PMOS
  context was rebuilt by canonical `pmos:context`, without editing history.
- A helper preflight containing an `allowDirty` option was rejected by automatic
  approval review. It was not used. Standard preflight on a clean checkout passed;
  no offline/skip-runtime/dirty bypass was used to report live governance PASS.
- Independent Render readback: current live runtime deployment
  `dep-dbehbncs728c73c86kc0`, source `503782cc812b08a60d3ed75c1d0cd67a0f74de6a`,
  existing Frankfurt service `srv-dbcse6jrjlhs73eib3sg`, existing `0.5c-512mb` plan,
  auto-deploy OFF. This is provider metadata, not a newly measured rollback digest
  or acceptance of the new email. No deployment was triggered.

## Prepared implementation

New notification uses the existing signed webhook, recipient verifier, encrypted
outbox, current persisted PL/EN/avatar preference and Mailgun CID transport.
Default opt-in is OFF and native Clerk delivery remains ON. Original subject and
opaque revoke URL are retained; no new authority, credential, endpoint, database
schema, profile write or product grant was introduced. Unexpected or unsupported
provider data fails closed. Existing OTP/invitation behavior is unchanged.

Regression coverage includes six language/avatar variants, exact action retention,
missing action, plain text/CID, HTML/template/header injection, foreign/insecure/
credentialed/ambiguous URL denial, signature/instance/subject/address rejection,
stale-event rejection, native-delivery ownership, persisted preference, encrypted
ordinary-role SQL queue, deduplication, restart and sensitive-payload clearance.
Exact local and CI results are attached to the source PR and execution evidence;
fixtures are synthetic and never presented as live Clerk or inbox acceptance.

## Not performed

No merge, provider template publication, Clerk cutover, Render deployment,
live email, session revocation, Neon migration/data change or Staging/Production
change. Actual signed-event payload compatibility and inbox/session-action E2E
remain mandatory before activation. See
`Canon/runbooks/new-device-email-development-v1.md` for the bounded owner action,
safe cutover order and rollback. Task continuity remains open until the authorized
operational scope and canonical closeout are genuinely complete.
