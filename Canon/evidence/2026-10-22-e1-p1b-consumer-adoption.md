# P1-B — coordinated source adoption and remaining owner gates

Date:2026-10-22. **SOURCE ONLY. NO INSTALLATION OR DEPLOYMENT.**
Task: `ARCHITECTURE-E1-SUPPLIER-LOCATION-P1B-ADOPTION-20261022`. Profile ARCHITECTURE, SG-dev Architecture, actual execution local, target development. Canonical begin `cmvjgdxhg0000jakmdtf016bx`; conversation `pmos-task-v2:2e5575a2231fb2a36729e33fbc039ff0d674231efdd412d46f6f23e730bd9dc5`; actual host `01a133ad-8739-7a21-ac6e-36f0a9bf8ed5`.

## Immutable producer and current authority

Producer PR604 remains Draft and unmerged at `f35c82b6d9d39720c04b4df2c6f0042f5379982a`. Closed producer PHR `becfa25ea51dbd5aab0745c319b6c3e156be68a4` remains preserved. Its PMOS lifecycle is not reopened. Initial main1922 advanced through KRS CI PR606 to0b825, then KRS onboarding PR603 to **0ad9525f1397d41b965787fb487492a713ba0e54**. These are independently observed parallel changes, not P1-B source promotions. Manifest3.28.0 and the new active KRS Canon were loaded. KRS governance acceptance does not switch SRM providers or authorize KRS implementation here.

Verified P1 package1.25.0 / admission1.0.0. Defaults remain Root candidate16 / host1.11; optional admission selects candidate17 / host1.12.

- Root:567f8f29e1812ca8ab3c104a72dc17a76e59b54e0e6021678c640d0bdc198cfb.
- Private host:7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351.
- Ledger:5ba7ab739fae5057e6439088978b5ed83064316267667c96fac3108ef280c414.
- SQL020:90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc.
- SQL019 immutable:34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5.
- SRM SQL013 immutable:b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b.

These were recalculated from the exact producer source, not copied as acceptance. New local P1 PostgreSQL16 run:34/34PASS,0skip, using ordinary roles and disposable local database; fixture stopped and removed. Original exact producer/lab CI1342/1342 remains https://github.com/profitia/SG-dev/actions/runs/39764867588 and is attributed only to f35c82, not a later consumer/composite.

## Original exact-log failure matrix

The JSON below records every12 SRM failure, both controlled-source tests, Maps version failure, dashboard refusal, missing SG2 proof and protected candidate-version mismatch. Expected/actual values are literal diagnostic values; a test's expected operand is not automatically the new source authority. No failure was assumed to be only a stale hash before its log and source were read.

Baseline runs: platform39764867294, Maps39764867332, trusted dispatch39765322753. The dispatch workflow/control SHA is1922aab9788ccd191da8a2c517cae9f48ef78ed8; its examined candidate is f35c82. Successful main producer jobs in that dispatch are not candidate results.

```json
[
  {
    "owner": "SRM",
    "test": "✖ explicit consumer binds exact implemented contract and installed/source digest without enabling live deployment",
    "source": "apps/srm/scripts/operation-context.test.mjs:15:10",
    "expected": "expected: '567f8f29e1812ca8ab3c104a72dc17a76e59b54e0e6021678c640d0bdc198cfb',",
    "actual": "actual: '9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ candidate16 acceptance preserves the exact previous receipts and has no runtime grants or paid effect",
    "source": "apps/srm/scripts/operation-context.test.mjs:42:12",
    "expected": "expected: '6e9afac49f77199b1b888769c8f4409324364a03e1f06942dc513947bde73be8',",
    "actual": "actual: 'aab818e73ef60cd05a946e0ca3f3b141ea50c401d7fd83942869671ff249188d',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ TASK02 has a separate current source receipt and keeps live activation closed",
    "source": "apps/srm/scripts/operation-context.test.mjs:54:9",
    "expected": "expected: '567f8f29e1812ca8ab3c104a72dc17a76e59b54e0e6021678c640d0bdc198cfb',",
    "actual": "actual: '9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ SRM imports the exact optional external control source without adopting a product operation",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:83:111",
    "expected": "expected: '6e9afac49f77199b1b888769c8f4409324364a03e1f06942dc513947bde73be8',",
    "actual": "actual: 'aab818e73ef60cd05a946e0ca3f3b141ea50c401d7fd83942869671ff249188d',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ SRM accepts the published optional producer fingerprints",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:199:10",
    "expected": "expected: 'b68371ba74fa4eac0a89d66e8677cb58bb2f7419dcba1b00b4789c035f256244',",
    "actual": "actual: '7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ SRM preserves historical AM23 source acceptance separately from current private intent adoption",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:805:9",
    "expected": "expected: '28a7db93b16c8593baa09bb30412f783d9f49d1ce41f124daecd88f1287ce525',",
    "actual": "actual: '5ba7ab739fae5057e6439088978b5ed83064316267667c96fac3108ef280c414',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ historical Supplier delegation acceptance retains its values while current source remains exact",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:1349:9",
    "expected": "expected: 'b68371ba74fa4eac0a89d66e8677cb58bb2f7419dcba1b00b4789c035f256244',",
    "actual": "actual: '7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ current optional delegated private phase source is exact and does not activate a Supplier business workflow",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:1372:9",
    "expected": "expected: 'b68371ba74fa4eac0a89d66e8677cb58bb2f7419dcba1b00b4789c035f256244',",
    "actual": "actual: '7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ optional committed phase inspection is accepted as exact source without adopting a product read",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:1399:9",
    "expected": "expected: 'b68371ba74fa4eac0a89d66e8677cb58bb2f7419dcba1b00b4789c035f256244',",
    "actual": "actual: '7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ optional native SQL work accepts exact source without claiming native business adoption",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:1419:9",
    "expected": "expected: 'b68371ba74fa4eac0a89d66e8677cb58bb2f7419dcba1b00b4789c035f256244',",
    "actual": "actual: '7994d078e24182d024be9150a6e8fac5f80be63de125c73a78f4e13c0ca71351',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ SRM explicitly receives platform1.21 without implicitly adopting sensitive HTTP paths or grants",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:1435:9",
    "expected": "expected: '9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728',",
    "actual": "actual: '567f8f29e1812ca8ab3c104a72dc17a76e59b54e0e6021678c640d0bdc198cfb',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "SRM",
    "test": "✖ public web source receipt preserves historical records and verifies every current SDK file without activation",
    "source": "apps/srm/scripts/private-host.integration.test.mjs:1502:9",
    "expected": "expected: '1.24.0',",
    "actual": "actual: '1.25.0',",
    "log": "/private/tmp/p1-srm-ci-failed.log",
    "class": "VERSION_RECEIPT",
    "workflow": "Platform contract integration",
    "job": "SRM operation integration",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "GOVERNANCE",
    "test": "✖ actual current SG2 dependency policy remains valid and admits only the reviewed local module addition",
    "source": "scripts/governance/controlled-package-ci.test.mjs:155",
    "expected": "lock version equals local package manifest version",
    "actual": "lock1.24.0; manifest1.25.0; LOCAL_PACKAGE_VERSION_MISMATCH",
    "log": "/private/tmp/p1-producer-remote.log",
    "class": "CONSUMER_LOCK",
    "workflow": "Platform contract integration",
    "job": "Architecture contract and lab",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "GOVERNANCE",
    "test": "✖ actual current source provenance is the exact accepted SDK digest with all old trust rules intact",
    "source": "scripts/governance/controlled-package-ci.test.mjs:247:9",
    "expected": "expected: '9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728',",
    "actual": "actual: '567f8f29e1812ca8ab3c104a72dc17a76e59b54e0e6021678c640d0bdc198cfb',",
    "log": "/private/tmp/p1-producer-remote.log",
    "class": "SOURCE_FINGERPRINT",
    "workflow": "Platform contract integration",
    "job": "Architecture contract and lab",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "owner": "MAPS",
    "test": "not ok 6 - explicit platform1.24 receipt accepts only tested peers and the unchanged current public channel",
    "source": "apps/maps-runtime/test/embed.test.mjs:58:1",
    "expected": "expected: '1.24.0'",
    "actual": "actual: '1.25.0'",
    "log": "/private/tmp/p1-maps-ci-failed.log",
    "class": "VERSION_RECEIPT",
    "workflow": "Maps connector",
    "job": "maps",
    "candidateSha": "f35c82b6d9d39720c04b4df2c6f0042f5379982a",
    "resolution": "Owner current-source receipt plus preservation/validation of the historical receipt; never skip or accept arbitrary bytes."
  },
  {
    "workflow": "Platform contract integration",
    "job": "SG2 dashboard source regression",
    "owner": "SG2",
    "source": "apps/sg-runtime/scripts/with-cross-host-local-packages.mjs:74",
    "expected": "Both host locks match actual platform package1.25.0 and reviewed source bytes",
    "actual": "Unaccepted local SDK binding: sg-runtime (lock1.24.0)",
    "class": "CONSUMER_LOCK",
    "resolution": "Both SG2/dashboard locks updated by owner PR607; exact first owner head dashboard job PASS."
  },
  {
    "workflow": "Platform contract integration",
    "job": "SG2 operation integration",
    "owner": "Architecture Platform / SG2",
    "source": "scripts/governance/controlled-package-ci.mjs",
    "expected": "Successful trusted-main proof for exact candidate SHA with current control digest",
    "actual": "CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA",
    "class": "CONTROLLED_CI_PROVENANCE",
    "resolution": "Use existing main validate-sg2 against actual owner PR/head. No fake/skip proof."
  },
  {
    "workflow": "Platform contract integration dispatch39765322753",
    "job": "SG2 controlled operation integration",
    "owner": "SG2",
    "source": "scripts/governance/controlled-package-ci.mjs:205",
    "expected": "Local manifest version equals owner lock version",
    "actual": "manifest1.25.0; lock1.24.0; LOCAL_PACKAGE_VERSION_MISMATCH before credential installation",
    "class": "CONSUMER_LOCK",
    "resolution": "PR607 actual owner receipt/locks; new controller run must bind new exact owner head."
  }
]
```

## Skipped work in the original baseline

- SG2 dashboard: protected-route HTTP refusal, proof and artifact steps skipped after SDK refusal.
- SG2 operation integration: controlled proof failed; actual API/ordinary-role persistence, typecheck/build and proof/upload did not run. Public installation skip is the designed no-private-credential branch, not a runtime PASS.
- SRM operation integration:331tests executed,319PASS/12FAIL; typecheck/build, proof and upload skipped. SG2-only proof steps are intentionally not applicable to the SRM matrix entry.
- Maps:15tests,14PASS/1FAIL; source routing and artifact upload skipped after failure.
- Architecture job:1342producer/lab tests passed, later controlled/routing tests98/100 failed; post-setup step skipped after that failure.
- Main-only policy probe and credential job on ordinary PR are deliberately skipped by event/ref conditions. In trusted dispatch, candidate check failed before credential installation, lifecycle/tests/build/proof. Unrelated jobs selected by dispatch mode were skipped; no acceptance is derived from them.

## Actual owner source work and SHA attribution

### SG2

Task `SG2-E1-P1B-PLATFORM125-SOURCE-ADOPTION-20261022`, own SG2 workspace/PMOS, registration `cmvjh003b0000tkdw8s96w29w`. Draft PR **607** https://github.com/profitia/SG-dev/pull/607 . Initial source c380f5c717a43714d5cf44fc0527acbc51b7a8d6; follow-up **8c5d07c85eb2ae8a9041dff56d2ffcd0505f0d48**.

A separate current platform125SourceCompatibility receipt preserves all1.24/history objects; top-level producer references exact frozen P1. Both apps/sg-runtime and apps/dashboard-preview locks accept1.25. Current SDK/source/application closures are verified independently from historical Git bytes. No SG2 supplier-location workflow, Root17 opt-in or SQL020 activation. Public source tests3/3PASS; first exact owner dashboard and Architecture/lab jobs PASS.

Trusted run39773947218 examined c380f5, with controller0ad9525. Source/provenance, credential metadata, clean lifecycle-disabled installation and credential removal all passed. It then actually ran718tests:716PASS/2FAIL, two old receiver-closure hash selectors. Existing tests in apps/sg-runtime/tests/identity-runtime.test.ts and porr-demo-middleware.test.ts now select the new exact current closure, retaining every prior acceptance field. Dispatch **39775101682** was correctly rejected at immutable-candidate verification: the PR API still returned expected c380f5 after the push while the real head was8c5d07 (CANDIDATE_SHA_MISMATCH). No candidate tests or credential phase ran in that attempt. A new dispatch is made only after local Git, PR metadata and ls-remote all agree on8c5d07; its actual result must be read separately. Do not attribute the716/718 diagnostic result to8c5d07 or claim typecheck/build if the test stage failed.

SG2 owner evidence: Canon/evidence/2026-10-22-sg2-p1b-platform125-adoption.md on its candidate. Final controlled counts/PHR will be appended only after acknowledgement.

### Maps

Task `SRM-E1-P1B-MAPS-PLATFORM125-ADOPTION-20261022`, logical Maps Capability, accepted SRM profile with its own srm_pmos; registration `cmvjh00kz0000zlh5pddw46rz`. Draft PR **608** https://github.com/profitia/SG-dev/pull/608 ; exact **e1901a4e0bcafe9392b9336c8cc140456ed4cede**.

Unchanged embedded-read/channel bytes were compared to1.24 before adding exactly1.25 to peer range. Old1.24 receipt and complete earlier history retained. No new Maps permission/provider operation or admission opt-in. Full regression15/15PASS and postcommit build19files PASS; local artifact digest cf079aad0e9d78b4f5e9746b837f522255db4f77de2a12e06907ed9c3ba99d20, source e1901a4e.

Exact-head Maps CI https://github.com/profitia/SG-dev/actions/runs/39773779613 and Governance39773779683 **SUCCESS**. Global inherited checks remain separate.

Own PMOS completed PARTIAL_SUCCESS/CLOSEOUT_COMPLETE with pending/lock clear; SRM task02-R remains running `cmvj0baur0000t43u7k05vcpm`, completedAt null. Immutable PHR **65998bbd5749a450c84102e2a4b3a84da8a87d84**, history/2026/10/22/2026-10-22-12-02-54Z__srm-srm-e1-p1b-maps-platform125-adoption-20261022. Remote-main ancestry, all5file hashes and final publication/archive states independently verified. This is the Maps owner handoff, not TASK02-R final PHR.

### SRM receiver

**NOT IMPLEMENTED / source migration approval required.** This is a real receiver gap, not just a receipt version.

Current createSupplierLocationHost omits the optional admission port; the wrapper does not forward locationAdmission. It uses legacy assignedLocationId before authenticated actor resolution. SQL013 location_metadata calls location_authority for WRITE on the future child before proof; with only a parent grant CREATE cannot bootstrap. Using its READ mode still locks only an existing collection row; the first supplier location has no collection row, and the actual supplier row is not locked. The required trusted current-parent lock therefore cannot be claimed.

P1-B section5.1 explicitly requires: “If new SRM SQL is genuinely necessary, use a separately approved additive migration under SRM ownership. Do not rewrite SQL013.” No independent approval for that new migration has been recorded. No file014, replacement SQL013, runtime grant or workaround was created.

### Newly observed Identity CI routing defect

Both dependent owner PRs also expose a separate CI defect: apps/identity-runtime/scripts/ci-proof.mjs sends **every changed path** to preflight project ARCHITECTURE. The mixed candidate includes actual SG2/SRM/Maps paths, so ROUTING_GATE correctly refuses. Session tests/lint/build preceding that step are not the failure. This is an exact candidate governance-profile defect, not a P1 SQL or Maps regression.

Candidate Maps run39773779614/job119807519532 and SG2 run39773772066 demonstrate it. Dashboard on Maps remains blocked by its unadopted SG2 lock, while dashboard on the actual SG2 owner head passed. These contexts must not be conflated.

Automatic approval review **rejected** expanding P1-B into Identity CI files as outside the authorised consumer-adoption scope and requiring separate owner routing/approval. The attempted command did not execute. Identity files and the coordinator target list remain unchanged. Current registry resolves Identity Runtime to Architecture Platform/ARCHITECTURE, but that fact is not used to override the scope rejection. The proposed bounded corrective below is documentation only.

## Reviewable source-only owner gate: P1B-remaining-source-v1

This gate requests ONLY the two explicit source scopes below. It grants no merge, deployment, install, signing key, live access or new resource. Full owner preflight and ordinary local/CI acceptance remain mandatory after approval.

### Decision A — bounded Identity proof correction

Owner Architecture Platform / ARCHITECTURE, separate scoped corrective linked to P1-B and current Identity task. Proposed exact source targets:

1. apps/identity-runtime/scripts/ci-proof.mjs
2. apps/identity-runtime/scripts/ci-routing.mjs (new)
3. apps/identity-runtime/test/ci-routing.test.mjs (new)
4. Its own Canon evidence receipt, routed before creation.

Preserve exact candidate/base SHA assertions and **all changed paths**. Resolve each target through canonical routing; group into its actual registered owner profile and run the complete canonical CI preflight for every group. Do not filter/ignore foreign paths, force Architecture over them, choose a profile merely to gain access, or fabricate an aggregate PASS. Maps uses its accepted SRM route. Unknown/conflicting/legacy/ambiguous owner paths fail closed. The final proof reports exact SHA, complete changedPaths, complete owner/project partition and each actual gate result.

Tests: Architecture-only candidate; real mixed Architecture/SG2/SRM/Maps candidate; lossless one-to-one path coverage; no foreign path assigned to Architecture; unknown/conflicting owner, traversal, legacy, duplicate targets and any failed subgroup denied; changed candidate SHA/base denied. Preserve current no-deploy/no-live-provider claims. No change to controlled-package-ci.mjs, privileged workflow, token/proof verification, main-only environment or package pins.

Approval of this bounded scope is required after the automatic review rejection; no indirect execution is performed.

### Decision B — additive SRM parent boundary and P1 receiver

Owner SRM Runtime / SRM profile. Continue SRM TASK02-R as coordination parent; begin a linked bounded implementation registration if existing begin identity/paths cannot be lawfully extended. No TASK03 or duplicate initiative.

Proposed additive source: **apps/srm/db/private-store/014-supplier-location-admission-parent.sql**, subject to fresh-main numbering check. SQL013 remains byte-identical. The new migration adds only a narrow SECURITY DEFINER parent reader plus immutable, owner-controlled version/digest installation metadata. It uses the existing controlled NOLOGIN owner, disabled-app installation guard, fixed safe search_path, FORCE RLS/owner fences, REVOKE PUBLIC and no seeded runtime grants.

The reader accepts typed org/supplier identifiers only in the current E1 runtime scope. It reuses the existing bounded E1 access/module/product checks, verifies current org-supplier relationship, locks the actual srm.suppliers row **before** collection metadata (including first CREATE), rechecks ownership, and returns only closed supplierId/organisationId/collectionId/version. No addresses, arbitrary SELECT/DML, permission engine, extra quota store or signer secret in SQL output. A descriptor binds the exact additive receiver schema/digest; missing/wrong descriptors fail closed.

Candidate receiver targets, each rerouted before edit: apps/srm/src/server/private-operation-host.ts; supplier-locations.ts; supplier-location-store.ts; supplier-location-sync.ts only if needed; private-runtime.ts; operation-integration.json; package-lock.json; db/private-store/014-supplier-location-admission-parent.sql and its manifest/initializer only if required; existing supplier-locations.integration.test.mjs, operation-context.test.mjs and private-host.integration.test.mjs; focused parent/admission tests; own Canon evidence. No current SQL001-013 edit, packages/platform-contracts edit, source-provider switch or duplicate host.

Forward the accepted producer locationAdmission option through the existing host. Generate the UUID with the producer port using authenticated internal actor/org and trusted idempotency key, never the browser or legacy local formula. Bind current parent/child versions, command digest, physical receiver/transaction and5s expiry. If the current host API lacks the needed lawful actor-before-ID composition, prove that bounded producer dependency and route it; do not fake a HUMAN or mutate a frozen request.

Opt in only with exact SQL020 + new receiver descriptors and server-only attestation configuration; missing configuration denies P1 writes. No Development signing key is provisioned here. Retain exact-child UPDATE/DEACTIVATE/CAS and existing source-version replay. Select E1 ROLLING_24H policies in synthetic tests:100WRITE and100SYNC per organisation; never a SRM-local limiter. Keep MGBI/KYS provenance, retention and manual organisation ownership; do not activate KRS.

Required ordinary PostgreSQL16 end-to-end tests: first/next parent lock, foreign org/supplier/child, forged parent/ID/GUC/proof, current/revoked membership/product/module/grants,5s expiry and cross-role/transaction/environment replay, audit/output/business rollback, same-key concurrency,100/101 WRITE andSYNC shared across actors/allowed executors, policy rotation, exact24h boundary, stable/new source version, creator/editor attribution and unchanged legacy/default behavior. No test against Neon or TASK02-R recovery branch.

## Exact-child permission lifecycle

Parent WRITE authorises only CREATE. Collection READ is separately controlled. UPDATE/DEACTIVATE require the existing exact-child WRITE action/CAS. The creator receives no automatic edit grant solely by creation. A controlled E1 operator may issue an explicit child grant to currently authorised organisation editors according to an accepted organisation-role policy; no wildcard and no application SQL ACL expansion. New-member/revoked-member handling follows current membership plus explicit controlled grant lifecycle, with immediate current-state checks. This formal source proposal does not verify/activate live grants: **PENDING** owner adoption/approval.

## Executable continuation prompts

**Architecture CI owner:** After explicit DecisionA approval, load fresh authority/CORE/ARCHITECTURE/Identity contracts; inspect active Identity PR605/600 and preserve their work. Register a separate CI proof corrective in architecture_pmos with the real host identity. Route exactly the four proposed paths. Implement lossless per-owner canonical preflight, retain exact SHA and all negative gates, test actual mixed owner paths, run Identity/security/regression CI, return Draft PR/exactSHA/PMOS/PHR. Do not merge, change protected controller/credentials or deploy.

**SRM receiver owner:** After explicit DecisionB additive-migration approval, load fresh authority and full SRM/E1 governance. Read immutable P1 PHR and exact source f35c82, SG2 PR607 and Maps PR608 owner receipts. Verify current TASK02-R and begin only the lawful linked implementation scope. Implement the minimal parent boundary and real existing-host P1 composition described above, preserve SQL013/019, all previous acceptance records and normal flows. Run actual ordinary-role PG16 and source/audit/identity/organisation/MGBI/KYS regressions plus typecheck/build. Return exact source PR/head, SQL014 and source digests, actual counts and SRM PMOS/PHR. Do not activate or provision users, policies, keys, providers or deployments. TASK02-R remains open.

**SG2 owner:** Continue PR607/current lawful registration; use actual current SHA, complete source closure and existing trusted main validate-sg2. Read all failed job logs, correct only proven own-source/test issues, reroute new paths, retain history and rerun after every head change. Require real tests/typecheck/build and immutable proof, then independently verify artifact/run/control provenance. A failing/incomplete run is not PASS. MEMOROS/PHR policy is required for SG2. Do not merge this dependent candidate independently.

**Maps owner:** Own source adoption is verified and separately closed as partial dependency result; PR608 remains Draft with exact e1901a4e. Reuse its immutable owner receipt rather than reopening its completed PMOS registration. Any later reconciliation needs a lawful new bounded task, exact accepted main and new tests/head mapping. No provider/permission/runtime changes or deploy.

## Publication-order dependency and remaining promotion decision

Existing trusted-main validate-sg2 can validate an ordinary internal SG2/SRM candidate against its exact Git SHA, and now passes P1 source/installation checks on PR607. It has **no accepted multi-PR overlay/release-train proof format**. Architecture producer admission is bounded to producer/evidence (plus its separately accepted closed KRS review bundle), so silently attaching consumer files to PR604 or treating another branch's green jobs as604 green is not authorised.

Current dependency graph: frozen604/f35 → SG2 owner607 and Maps owner608; frozen604 + approved additive parent boundary → SRM receiver; all owner receipts + corrected Identity proof + an explicitly accepted publication plan → final reviewed integration candidate → full exact-SHA CI → separate owner source acceptance. Owner source candidates can be prepared/tested independently. **No current safe main merge sequence is declared.** Do not merge consumers with1.25 locks while main producer is1.24; do not merge604 while consumer compatibility is unaccepted.

After actual SRM source/receipts exist, Governance must approve a bounded integration/promotion plan with exact immutable owner SHAs, complete path set, unchanged producer bytes, current trusted-controller digest, private credential boundaries and no unsafe intermediate main. If a new admission class is necessary, propose the smallest closed review bundle and retain negative complete-diff/blob/role/namespace/owner/SHA controls; independently validate its own source and obtain acceptance before using it. No arbitrary versions, untrusted workflow or fake composite PASS.

PR604 readiness remains **NO** until these dependencies genuinely close. Neither607 nor608 is a claim that unchanged604 passed its global exact-head checks. No source merge is authorised by this package.

## Active Development no-change readback and local cleanup

Neon metadata-only transaction, project spring-bread-28217539 / branch br-sparkling-term-b99l107x / compute ep-late-heart-b9mxo8oi / platform_private / ordinary srm_private_development_runtime: SQL019/020/013 installation relations all NULL. No snapshot/recovery branch or Finalize Restore operation.

Read-only Render workspace tea-d7lps8rbc2fs73cn80dg, actual latest LIVE IDs/source:

- SRM dep-dbbnb22fngtc73bn0i90 /260ade12608faaea27376c1c976db392f046f267.
- Maps dep-dbati9rrjlhs73akpsj0 /db2df0a6cccb994ea4654ae0eb5b3af4b46867ff.
- Identity dep-dbcse73rjlhs73eib57g /aa95c0a0a14fb2f2ba5af7338c8d83a6fb349269 (existing HEALTH_ONLY baseline, no configuration mutation).
- SG2 runtime dep-dbbpblom7kps73dj51mg /f03968d474a937cfe5badcc192e1bc81781bcb91.
- SG2 dashboard dep-dbbr34rncjis738t5phg /873d4655bed828b401f3b480b08cc40d46c6c8ff.

No source-only task here changed a deployment, live E1 policy/grant, key, provider, Staging or Production. Paid geocoding budgetZERO. Five active services remain separate from source/CI evidence.

At the user's explicit cleanup request, removed19verified inactive dependency/build directories from closed Maps/E1 tasks, measured3.25GiB. Every source working tree was clean, closeout complete, and no matching process active; no source, branch, .env, PMOS/.context or PHR archive removed. The failed newly-created unused SG2 checkout was also safely removed before reuse of existing owner workspaces. No b1pg temporary PostgreSQL cluster remains. Only active owner/coordination dependencies needed for this task were reinstalled. The measured deleted size is not a claim about unrelated disk activity.

## Gate incident record

An initial shell wrapper continued after CODE_STATE_GATE BLOCKED during an unrelated main advance. Own SG2/Maps diffs were quarantined, restored completely, current main/Canon reloaded, full gates passed, and identical patches reapplied with fail-fast execution before final tests/commits. No protected control or live state changed. Patch hashes and failed/successful preflight receipts remain in ignored task recovery. This incident is not hidden by the subsequent PASS.

## Final coordination status

At this source checkpoint: Maps owner adoption PASS, SG2 real controlled acceptance still requires final successful run, SRM receiver source BLOCKED on separately approved additive boundary, Identity proof corrective BLOCKED on explicit owner scope approval, trusted publication plan not accepted. Coordinator status **PARTIAL**, never source-ready/live-ready. Final actual CI, independent owner closeouts and Architecture PMOS/PHR acknowledgement are reported in the execution handoff after they exist. SRM TASK02-R remains OPEN for R2/I1/K1/U1/W1 and its final PHR is NOT PUBLISHED here.
