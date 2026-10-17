# SG2 — compatibility with the protected shared financial port

Task `SG2-E1-SHARED-FINANCIAL-PORT-COMPATIBILITY-20261017`, SG2 / Development.
Authority at start `c330f526add59872152363c3cd24b914b71bf0ff`.
Producer SRM task `SRM-E1-SHARED-FINANCIAL-READ-PORT-20261017`,
[PR441](https://github.com/profitia/SG-dev/pull/441), source
`ef394c4fa0f12519f5dd3fc39547665abaec3e83`.

The producer adds an AM21 bearer-only shared corporate-financial read, using its
existing common operation host, ordinary role and financial projector. It reads
three shared tables and excludes private archives/documents, KYS, scanner,
preferences and exports. The previous report-data path remains its separate
AM22 private projection; previous SQL bytes and business behavior are preserved.
This creates a concrete data port for the prepared public summary module.

This SG2 task accepts compatibility of the unchanged existing SpendGuru runtime
and dashboard at the exact combined source. It does not add a supplier gateway,
dependency, module binding, permission, receipt change, token forwarding or UI.
No business reuse is claimed from these compatibility tests. SG2's dependency
versions, React18, Next14.2.35, benchmark operations and common fingerprints are
unchanged. Its local runtime dependencies remain empty, with no local full
runtime tests/build claimed and no token or vendor package copied.

Required before merge: approved main-only controlled exact-source109 SG2
API/PrismaSQL/configuration/UI/cache regressions, typecheck and build; independent
public dashboard tests/typecheck/build/HTTP-refusal proof; shared lab and SRM
operation/API/SQL acceptance; full SRM regression/build and public React18 module
probe. This document is not itself a completed CI run. Own canonical closeout
records actual source, runs, merge, PMOS/MEMOROS and remote PHR after gates pass.

Actual SG2 integration must independently prove its current application/product
and module access, bounded transport to the verified upstream, accepted DTO and
business UI, with separate build evidence. No cross-host identity policy,
infrastructure access, grant, resource, data, flag, secret, controlled-CI policy,
Development/Staging deployment or domain changes here. The accepted E1 program
continues; this unit does not claim full architecture or release acceptance.
