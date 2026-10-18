# SRM — optional private request source compatibility

Date2026-10-18. Task SRM-E1-EXTERNAL-REQUEST-SOURCE-COMPATIBILITY-20261018. TARGET_ENVIRONMENT=development.
Status: SOURCE CANDIDATE / LOCAL NATIVE/TYPES/BUILD PASS; FINAL CI PENDING. Whole E1 remains IN_PROGRESS.

Explicitly accept platform1.14 root candidate8, host1.6 and the existing request
ledger with optional bounded HUMAN AM23. Producer ARCHITECTURE task
ARCHITECTURE-E1-EXTERNAL-REQUEST-ADMISSION-20261018, PR488, source 70e6ebbd1bb931911fd3e3801f04e03d2d45b5df.
Separate source version-test task PR489/d97a8ba retains SERVICE read denials.

Current root producer/digest, native host digest and17reviewed source file hashes
are explicit. The former platform1.13 external-call record is historical; its
module/SQL009 bytes and helper digest are unchanged, while current root and host
transitive sources are accepted under this1.14 record. No old SHA/digest is
misrepresented as the current source. Base SQL006/access/identity/module sources
remain unchanged. Existing application operations and business code are unchanged.

This is compatibility only. It does not adopt supplier refresh, install SQL010,
change a role/grant/identity/flag, call a provider, enable KYS/person data or
billing, or deploy a product. An ACCEPTED private intent is not remote delivery.
Native/product regressions, strict types/build and actual exact combined
candidate/main CI must pass before own closeout; source acceptance is not whole
E1 completion. Owner has re-authorized Development release after the full E1
implementation, tests and release criteria; this finite task does not release.

Own SRM Development PMOS/PHR; MEMOROS disabled by current profile. Separate producer/receiver
references do not copy foreign PMOS row relations. No new resource/cost,
Production/E2-E4 or cross-authority exception.

Current installed platform1.14:71native tests passed, zero skipped; whole strict
TypeScript and Next16/React19 build passed. The generated root-params import
was preserved outside the source tree and only that exact own addition restored.
No business source or deployment configuration was changed.

Original SRM business regressions:490 passed; release/promotion guards:311 passed.
Both actual suites completed with zero failures and zero skipped tests.
