# Stage I organisation / recurring source reconciliation — work in progress

Status: IN_PROGRESS / NOT_ADMITTED / NO_RUNTIME_ACTIVATION.

The owner approved exact PR1012. Its four-file policy was implemented in PR1013,
final head49967f0194f2fd969fd1f72e3b8ad3ec6de575a7 and accepted main
0775f8a18d2fbeca462bb0a9d654914b15c53dad. Protected43049290721 passed1501/1501,
typecheck and build; public43049208585 attempt2 and governance43049208961 passed.
Canonical resulting-main43051917732 is still running. The bounded policy task
cannot be called fully closed until that check and PMOS/PHR readback succeed.

During the previous final checks, accepted PR995/mainf78f5867 introduced the
independent recurring source. It overlaps27 of the original59 registration
paths and creates26 real conflicts. Preserve that accepted source. Neither
1012 nor an old green check permits rolling it back or replacing the exact59
map with arbitrary new versions.

## Architecture checkpoint

Own task: ARCH-REGISTRATION-RECURRING-RECONCILIATION-20261111.
PMOS: pmos-task-v2:f041d6d2758c84c60c51bf7b67da8a813dea8c127ddcd7b0306ea00fa3c9ffba.
Registration: cmwcaaa61000013xx2lmwsgqu.
33 exact Architecture targets, registered pre-execution gates PASS.
A new isolated remote worktree was built from accepted main; PMOS-owned context
was rebuilt with the canonical pmos:context command before registration.

Immutable inputs: Architecture c1eec8aaeb7dc9959888bd3d14c3f9c110fb9d65,
SG2 9df41b364fabe880043ffe83fb3247bb9cb8a62e and SRM fcb0 (the exact original
SRM SHA must be read back before its continuation). The original source PR983
remains unmerged at71c8aeea0971ec137bcb88b9c46a73867f250687.

Architecture source checkpoint:
5a963f313317d57e1946e1d7aabd28192db9c7bd, including original producer merge700d95be
and accepted policy0775f8a1. Only28 Architecture source paths changed against
that accepted main. This document is an additional evidence path.

Both optional Root families are present: organisation21 and recurring22.
Default Root16 remains the default. Each family requires its own explicit
schema and closed operation set; supplying both optional schemas is rejected.
The accepted1.36 package metadata and recurring exports are preserved, while
the original organisation exports/build checks are added.

Actual validations on this checkpoint:
- 99/99 core tests, fail0, skipped0: organisation bootstrap/profile/proofs and
  the complete recurring-job unit suite. Includes explicit rejection of mixed
  optional schema adoption from either host.
- 16/16 real PostgreSQL16 organisation tests, fail0, skipped0. Actual ordinary
  runtime role, atomic company/category/membership persistence, uniqueness,
  replay, self scope, version conflicts, revocation and audit rollback.
- Parsed all10 reconciled Architecture conflict files. No conflict markers.
- Fresh registered require-begin preflight PASS after the policy main refresh.
  One transient Neon connection failure was observed and the identical bounded
  read-only verification passed on the next attempt.
- Public pg/libphonenumber test dependencies were installed from existing
  accepted lockfile versions/integrities with scripts disabled. PostgreSQL16
  was an unprivileged isolated local fixture, never a product database.

## Strict source boundary and remaining work

The approved helper is still EXACT f309cb4ba8e6db083c84efc40bd2f3e5c0b3a9c5.
It retains020 and only the approved25fea successor. No new record was admitted
and no altered verifier was evaluated. The old25fea record is not represented
as authentication of this new composed source.

Architecture test callers now place the future organisation predecessor before
the existing recurring predecessor. This is work in progress: the current
record still describes the prior producer and is deliberately not called a
complete final proof. Both current physical graphs must authenticate before
exposing their immutable history. The accepted recurring record75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619
and its original verifier/adoptions are retained; a new organisation record
and exact admission proposal must be prepared if required by the final graph.

Remaining: finish SG2/SRM owner-scoped reconciliation, retain every previous
receipt, freeze the exact final source/record/helper proposal, obtain any
required separate source-boundary decision, run full exact-source CI and
resulting-main checks, then complete the native Stage I API/UI/invitation,
lookup, Package/E1 and tenant/session release and real acceptance.

No product SQL installation, organisation/package grant, real invitation,
provider/model call or application deployment occurred. Full Stage I and all
source/receiver parent tasks remain active. This checkpoint is not a SOURCE GO
or a request for approval of unspecified source.

