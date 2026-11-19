# BSDC manifest ancestor compatibility — source checkpoint 2026-11-19

- Project/owner: ARCHITECTURE, necessary shared-governance repair for the authorized SRM ADP E1.
- Task: ARCH-BSDC-MANIFEST-ANCESTRY-20261119; registration cmwnjhz8g0000kvh4ued151d8.
- Branch base: `f044ed2fbda18e78bed2ddf9889a20e5206ac744`.
- Related PDR checkpoint: [PR #1254](https://github.com/profitia/SG-dev/pull/1254), source `fc95d47de97873090cf8b2f0e2c1c526c171b66a).
- Publication coordination: ACG retains priority on main. This source checkpoint does not authorize or perform a competing merge.

## Observed failure

Governance runs 44523117886 and 44524048304 fail the existing physical BSDC/Calendar continuity regression with `MANIFEST_SUCCESSOR_AUTHORITY_BASE_REJECTED` (84 PASS / 1 FAIL). The current trusted authority has the accepted ACG/CIC 3.53 manifest, while the older authenticated caller traverses the accepted Editorial 3.52 view. The direct-predecessor-only check rejects that real historical view. The PDR bytes do not cause this failure.

## Bounded repair

When the old direct authority check fails, authenticate the current main manifest and ACG document with the **existing exact owner-approved 3.53 projector**. Continue only if that projector returns the exact manifest hash being validated. Its existing exact grant digest, trusted-main ledger, immutable before/after Git objects, document digests and original BSDC source checks remain in force. The outer 3.52 grant still receives every original check.

This adds no general ancestry traversal, successor allowlist, future-version admission, caller ledger authority, receipt rewrite or runtime right. Unknown future main authority remains rejected. Missing either trusted grant, identical-tree SHA rebinding, substituted authority/document bytes and changed original source/receipt/helper/test remain rejected.

The frozen `platform-source-hub-foundation.test.mjs`, all old acceptance records and the manifest/ledger are unchanged. Six focused regressions are added to the already-selected ACG compatibility test; the eight existing tests remain intact. No workflow or historical fingerprint is changed.

## Verification

- Targeted compatibility: **14 PASS, 0 FAIL, 0 SKIP**, using actual approved Git objects and the actual trusted-main ledger. Corrupt readers are negative cases only.
- Exact governance-validator command from the current workflow: **91 PASS, 0 FAIL, 0 SKIP**, including the previously failing physical BSDC/Calendar continuity regression.
- Broader controlled-publication regression and hosted exact-SHA CI: see the PR and canonical PMOS/PHR closeout for the completed run IDs/results. This note does not claim a result before those runs finish.
- Governance manifest/preflight/PMOS begin/require-begin: PASS before mutation; 82 active documents, all declared paths resolve to ARCHITECTURE.

## Boundary and resumption

Source preparation is separate from publication, live installation and business acceptance. No SQL, role/grant, module/organization enrollment, secret, deployment, Source policy or product activation was performed by this repair. E1 remains partial and E2 remains NOT_STARTED. The frozen DEC-21 baseline and DEC-24 scope are preserved.

After the ACG main window is released and required exact-head checks pass, admit this narrow repair through the normal manual publication path, then validate the PDR against the resulting authority. Source admission/conditional installation remains the separate bounded proposal in the same PDR §7.5; final exact-SHA Development release GO remains separate.

Cloud worktree and task logs are RETAINED for CI/publication/recovery. No local Mac documentation or evidence files were created. Monitoring: NOT_APPLICABLE to this offline validator repair; no external provider or customer-data request was introduced.
