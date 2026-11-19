# ACG/CIC trusted-history bootstrap B1 — owner decision

Task: `ARCH-ACG-CIC-CANON-ACCEPTANCE-20261119`
Repository: `profitia/SG-dev`
Profile / owner: `ARCHITECTURE / Governance Source Layer`
Environment: `development`
Scope: `GOVERNANCE_ONLY`

## Actual decision and effectiveness

The project owner explicitly answered **“Zatwierdzam jednorazowy B1”** in the originating task, after receiving the complete immutable [B1 review package](https://github.com/profitia/project-history-repository/blob/1658df4387e5ababe919dafe95fd61d7300cad05/reports/2026/11/19/ARCHITECTURE/ARCH-ACG-CIC-CANON-ACCEPTANCE-20261119/BOOTSTRAP-B1-REVIEW.md). The decision was recorded on 2026-11-19.

This records a **new, explicit, single-use trust decision under Canon v3.0 §10.1**, not an inference from Full Autopilot or the earlier G1 approval. The review package's frozen correction, evidence limits, seven closed conditions, exclusions and stop condition are incorporated by that exact immutable reference.

This receipt becomes authority only after its separate ordinary Governance PR is accepted on actual `main` and the applicable source and resulting-main Governance CI pass. A candidate-local copy, draft PR or proposed report cannot activate it.

## Exact permitted operation

Only PR [#1207](https://github.com/profitia/SG-dev/pull/1207), for one successful normal integration, valid until **2026-11-20T06:30:00Z**:

- Add exactly `fetch-depth: 0` to the existing trusted `control` checkout in `.github/workflows/platform-contracts-ci.yml`.
- Preserve action pin `actions/checkout@11d5960a326750d5838078e36cf38b85af677262`, `ref: ${{ github.sha }}`, `path: control`, `persist-credentials: false`, all existing permissions, trusted main identity checks and the separate candidate checkout.
- Frozen postimage Git blob: `f1f178a7bfddcaf8a54d938013f20257ef18b13e`.
- Frozen postimage SHA-256: `047e23e663c40978d197f134fbd548d0aef0a76f35303ebd846071890760eed5`.
- The reviewed source was `2b9f5cd2fa13d19ed0e354e5f821cfffb36323d5` on accepted `fdb1209e3a3f561bb5d34c2b9724263684fa1c27`. Its ordinary refresh `8b3ba2a42cbf1b7d53d635348b28e307db9c34db` incorporates accepted `1af31b58dd1fa75d247676876fe6d508b40b0d71` and retains the identical one-line effect.
- Further mechanical refreshes may only incorporate accepted main, preserve original source ancestry and all accepted concurrent work, and retain the exact postimage and sole one-line effective diff. Independently record/recheck the actual final head and authority before mutation. Any other source change falls outside B1.

## The one replaced premerge requirement

For this operation only, the unavailable **premerge exact-candidate native SG2 proof** may be replaced by the combination of:

1. The genuine successful accepted-main native baseline [44465389936 / 135361833789](https://github.com/profitia/SG-dev/actions/runs/44465389936/job/135361833789), exact `fdb1209e3a3f561bb5d34c2b9724263684fa1c27`; original artifact `14502234957`, SHA-256 `af6b7647b824be3c7b35d1706d86956b195a38d16c547704def14c79fde28e43`, independently verified by accepted-main `assertProof`.
2. Independent byte, identity, policy/runtime-equivalence, effective merge-diff and real historical Git integrity/negative verification, from accepted authority and original Git objects.
3. Complete passing existing Governance/protected-controller source regressions and every other applicable owner/source check.

The baseline remains **AUTHORITY_MAIN_VALIDATION for its own SHA**. It is never relabelled as PR proof. The original [native fail-closed attempt](https://github.com/profitia/SG-dev/actions/runs/44466749403/job/135366276280) and [public proof refusal](https://github.com/profitia/SG-dev/actions/runs/44466384100/job/135365063186) remain failed. No synthetic success, altered historical result, cancelled required check, test skip or candidate self-approval is authorized.

A different failure, changed tested input without fresh matching independent evidence, changed controller/trust input, broadened diff, missing original artifact, failed receipt CI or expired decision stops admission. No branch protection, permission, credential or history change is authorized. Use an ordinary attributed expected-head merge, never admin bypass or force.

## Dependent gates remain mandatory

After PR1207 is accepted, independently verify the actual resulting main, frozen workflow bytes, pinned trusted source, actual full-history control checkout and authentic historical reads. **Full resulting-main native CI must succeed and its original proof must be independently verified before PR1199 proceeds.** Failure blocks both dependent PRs.

PR [#1199](https://github.com/profitia/SG-dev/pull/1199) and PR [#1195](https://github.com/profitia/SG-dev/pull/1195) retain their normal complete required source, admission and resulting-main CI. B1 does not replace their proofs or authorize their acceptance with red CI. Preserve authentic predecessor projection, all eight security regressions, trusted PR1196 admission and all16 business decisions.

Frozen publication:

- `DOCUMENT_SHA256 = 2423fcffa7b438224028acf201196b7448eefc6803b26cda375e16c9594deb21`
- `MANIFEST_SHA256 = a9c3746dcad97acca504354c3a0a10d02409be65f28f435cb034d1ca5b8fd96d`

The receipt is the only additional SG-dev document in B1; the frozen target manifest is not changed to register it. The operation is consumed by its one successful PR1207 integration or expires at the stated deadline. Actual consumption and CI evidence belong in the existing task's PMOS/PHR trail, without rewriting this decision or earlier PARTIAL_SUCCESS records.

## Scope boundary

`IMPLEMENTATION_OR_DEPLOYMENT = NOT_STARTED`

No application implementation/deployment, SQL006, database/provider/environment configuration, access/E1/Limits/KYS/retention/licensing, secrets, budget/pilot, GateA/B, Forecast/ECR or PlatformKnowledge work. No borrowed peer approval or general protected-policy delegation. The mandate ends after actual frozen Canon publication and verified PMOS/PHR closeout.
