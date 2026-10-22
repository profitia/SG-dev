# Maps P1-B — exact platform1.25 source compatibility candidate

Date: 2026-10-22. Logical owner Maps Capability; accepted execution profile SRM / SG-dev Codespaces SRM / development; actual execution local. Task `SRM-E1-P1B-MAPS-PLATFORM125-ADOPTION-20261022`, canonical registration `cmvjh00kz0000zlh5pddw46rz` in srm_pmos. Coordinator is Architecture P1-B; existing SRM TASK02-R remains open and its final PHR is not published here.

This branch inherits unchanged P1 producer `f35c82b6d9d39720c04b4df2c6f0042f5379982a` (PR604) and accepted main `0ad9525f1397d41b965787fb487492a713ba0e54`. It is a dependent source candidate, not an independent safe-main promotion. Do not merge while its producer dependency is unpublished; do not merge PR604 or deploy under this task.

## Verified compatibility

Compared every actual embedded-read and channel-core byte with the earlier1.24 acceptance before extending the peer set to include exactly1.25. Existing read wire remains profitia.embedded-read@1.0.0. No transport, provider, permission, command, persistence or public route code changes. Maps has no opt-in CREATE admission dependency. All old acceptance objects are preserved, including the complete1.24 receipt under previousAcceptance. Current producer SHA and Root fingerprint reference actual P1; historical values are checked separately by regression tests.

Own targets: apps/maps-runtime/platform-integration.json; apps/maps-runtime/package-lock.json; apps/maps-runtime/test/embed.test.mjs; packages/maps-embed/package.json; this evidence. Full owner routing/ALIGNED and fail-closed preflight passed before the final edits. No wildcard version, skipped fingerprint or unsupported peer is introduced.

## Validation

Complete Maps connector/runtime tests:15/15 PASS,0skipped. Covers independent host startup/channel, wrong origin/window/version, denied host projection, marker/source/provider boundaries, malformed requests and bounded HTTP surface. Build PASS:19 output files; precommit diagnostic artifact digest cf079aad0e9d78b4f5e9746b837f522255db4f77de2a12e06907ed9c3ba99d20. This digest identifies a local source-only build, not a deployed or retained live artifact; final exact-head build/CI results belong to the immutable handoff after commit.

No key or provider configuration changed. No paid call or live geocoding, SQL019/020/013 installation, E1 policy/grant/binding change, supplier persistence, SRM mounting or deployment was performed. Identity HEALTH_ONLY and SG2 runtime are unaffected. The accepted peer extension does not imply acceptance of P1 business semantics in SRM.

## Gate incident and recovery

A parallel main update blocked the initial CODE_STATE_GATE. The shell erroneously continued into own local edits; they were immediately quarantined by exact patch/hash and restored. After fresh main, new active KRS Canon and full PASS, the identical patch was reapplied under a fail-fast wrapper and all15 tests plus build rerun. No external application state changed; the initial diagnostic result is not final accepted evidence.

Exact owner PR/SHA/CI and canonical PMOS/PHR are reported after they exist. Global producer CI still depends on SRM and SG2 adoption; passing this Maps candidate must not be attributed to unchanged PR604. Before source promotion coordinate owner receipts and an explicitly accepted safe sequence. Runtime rollout and live signing-key/configuration remain separately authorised W1 work.
