# SG2 Stage 1 historical PMOS integrity exception

Record: SG2-HISTORICAL-INTEGRITY-EXCEPTION-20261009. Owner: Profitia Governance Source Layer.
Recorded by SG2-PMOS-IMMUTABLE-BOUNDARY-CORRECTIVE-20261009 under the owner decision of 2026-10-09. Scope: exactly one historical event, documentation only.
Source authority: profitia/SG-dev / main. Historical baseline 886ce9d92bea5c0c2ae5dc8ae98cb2a44ee71fc1.

## Identities and proofs

Task SG2-RELEASE-HARDENING-STAGE1-20261008; conversation pmos-task-v2:5febac94e5a5cefff1eb1e8ab38c6a282e074a9ab10e93ff9a2f42fc311cbec7; registration cmv0318lr0000muhmmirune1g; ConversationArtifact cmv04sjxq0000dg8egv2290kn. SG2 PMOS lucky-dream-96138453 / br-frosty-lab-als8xfyh / neondb.
Stage 1 draft PR https://github.com/profitia/SG-dev/pull/154, head 2a24efa878cb074c2567a20facc600d1775b4509. Local timestamp corrective d730a8f0fd9447a423e792a232a1ba75475cdd7e is not incorporated wholesale into this corrective.

Original JSON fingerprint cc358e6da901c0c35fb7a0a9f88ae2c4297c9f3f2ad6e1241e442be99142c0ab; original lock immutableSince 2026-10-08T22:51:53.124Z.
Final fingerprint d0aaaf3be15403491b0df76954170f46660c83fc0b510d934b8a3c99dabdafdb; renewed lock immutableSince 2026-10-09T04:31:54.755Z.
Original complete JSON provenance was verified using the preserved backup and prior database evidence. Original sidecar bytes are not fully available. Final JSON/hash/lock are internally consistent; this is not preservation of the original immutable snapshot.

| Changed completionEvidence field | Before | After |
| --- | --- | --- |
| closeoutState | PMOS_SAVE_SUCCEEDED | CLOSEOUT_COMPLETE |
| runtimeContextRefreshStatus | NOT_STARTED | SUCCEEDED |
| handoffPublicationStatus | NOT_STARTED | SUCCEEDED |
| executionTrailStatus | PARTIAL | PRESENT |

The previously persisted complete JSON/hash/lock was replaced. Task, analysis, findings, decisions and actions were unchanged. The narrow recovery authorization allowed scalar DateTime parity normalization only and prohibited these changes.

MEMOROS: one delivered publication, SG2 project cmptxz92m000023gjw2r3gbf5, thread cmv0gxowm00001glbdiwxsyyq, sourceRecord 14a3c8bf-44d7-4bd2-9472-70085bf08467, external source conversation_artifacts:cmv04sjxq0000dg8egv2290kn. Delivery verified; consumer readiness is separate.
PHR: profitia/project-history-repository, commit f9e0e8df981d7c01c754c25588f9a85feb7d0b50; bundle history/2026/10/09/2026-10-09-04-31-48Z__sg2-sg2-release-hardening-stage1-20261008; bundle fingerprint 142037afe6f3f4ef9cc80b318e5d02949abbfd8eb2a3dd4f1e1dab01943743d7. One publication verified.

Independent diagnostic SG2-STAGE1-PMOS-RECOVERY-INTEGRITY-20261009: SG2-PMOS-Recovery-Integrity-Audit.md, structural-comparison.json, pure-integrity-verification.json, provider-readback-corrected.json, mirror-reconciliation.json and phr-bundle-verification.json, preserved external diagnostic outputs. Earlier reports: stage1/PMOS-Recovery-Verdict.md and stage1/SG2-Stage1-Report.md. These references identify existing evidence; this record creates no replacement sidecars or historical publication.

## Preserved verdict

PMOS_TECHNICAL_CLOSEOUT = PASS
MEMOROS_PUBLICATION = VERIFIED
PHR_PUBLICATION = VERIFIED
ORIGINAL_SNAPSHOT_PROVENANCE = VERIFIED
PREVIOUS_STAGE1_IMMUTABLE_INTEGRITY = FAIL
PREVIOUS_RECOVERY_AUTHORIZATION_COMPLIANCE = FAIL
STAGE1_READINESS = PARTIAL
STAGES_2_TO_5_READY = NO

This additive exception neither retroactively authorizes the transition nor permits a future exception, replay or repair. Historical FlightRecords, hashes, locks, records, publications and commits remain untouched. Corrections to this account require a new linked additive record, not replacement of its historical finding.
