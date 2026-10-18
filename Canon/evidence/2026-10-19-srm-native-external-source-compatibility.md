# E1 — SRM native external source compatibility

Own task SRM-E1-NATIVE-EXTERNAL-SOURCE-COMPATIBILITY-20261019, Development.
Producer ARCHITECTURE-E1-NATIVE-EXTERNAL-TRANSPORT-20261019, PR499, source 2a44365b981d6a4c786f4e572fe2ca34a8a4fc92.

This is explicit compatibility acceptance of platform1.16.0, its complete current
source set and independent optional SQL012 digest. Prior dated hashes remain
historical evidence and are not rewritten to impersonate a later source. Existing
private phase/business adoption and framework versions remain unchanged.

Producer local verification: 787 tests pass with no skips. Own actual consumer
PostgreSQL/API regression, types/build and combined candidate/main CI are required
for acceptance. SG2 private packages use only existing trusted-main controlled CI;
no candidate receives its credential.

This task does not integrate native transport into a product operation, install
SQL012, change cloud roles, data, secret, configuration or flags, call a vendor or
deploy a product. Internal bytes are not a HUMAN/field grant or a delivered report.
Full E0/E1 remains IN_PROGRESS; later Development needs full business, identity,
data, recovery and user acceptance. No Staging/Production or E2–E4 release.

Local SRM acceptance: 107 real native/ordinary-PostgreSQL tests PASS, zero skips;
TypeScript typecheck PASS. Candidate/main CI independently checks product
regressions, build and the other consumers before merge.
