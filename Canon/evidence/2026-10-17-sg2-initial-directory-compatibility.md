# SG2 — initial directory schema compatibility, 2026-10-17

Task `SG2-E1-INITIAL-DIRECTORY-COMPATIBILITY-20261017`, profile SG2, Development. Producer: `ARCHITECTURE-E1-INITIAL-DIRECTORY-PREPARATION-20261017`, repository `profitia/SG-dev`, PR #416, source `521efc36f2861352b284835a4cc53fe92cd9e076`.

The optional SQL004 adds private names and a protected operator-bootstrap receipt. Existing operation/store/identity/host interfaces and fingerprints remain unchanged. SG2 product source, private dependency pins, runtime configuration and deployed databases are unchanged by this compatibility task. It neither applies SQL004 nor activates identity in the application.

Local validation: 38 existing real API/SQL/Prisma/configuration/React18 tests and typecheck PASS, zero test skips. The producer separately exercises 11 real directory PostgreSQL tests and the existing 276 producer/lab tests. A fresh exact-source, main-only controlled clean-registry SG2 test/typecheck/build is required before publication; previous source proofs cannot satisfy it.

The SG2 branch is the separately registered compatibility carrier for the accepted producer source and this evidence. Its PMOS/MEMOROS/PHR identity is independent. The controller must retain the three approved private package pins, ignore lifecycle scripts during credential use and remove credentials before candidate execution.

No remote grant, provider/secret change, account bootstrap, product deployment or Staging/Production action belongs to this SG2 task. Directory preparation, actual browser login, remaining protected entrances and complete E1/release acceptance remain distinct work.
