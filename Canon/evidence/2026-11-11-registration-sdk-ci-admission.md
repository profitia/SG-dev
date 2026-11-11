# Stage I organisation SDK: closed CI and coordinated source proposal

Status: PROPOSED / OWNER_CI_AND_COORDINATION_APPROVAL_PENDING. This document is a reviewable proposal, not a CI proof or deployment.

## Functional source being reviewed

Optional Root21 and the Identity adapter create one canonical organisation and its first owner atomically from the own-account draft and an already governed, version-confirmed company record. NIP and slug collisions create no duplicate organisation or automatic membership. Procurement answers are persisted with the organisation and user; package activation remains PENDING_PACKAGE. The default Root contract is unchanged.

The source also contains a presentation controller for the accepted conversation and a separate invitation-proof primitive. HTTP/UI wiring, native invitation persistence/outbox, real company lookup binding, package projection and Development release remain unfinished Stage I work. This source milestone does not complete Stage I.

## Exact owner inputs

| Owner | Task | PR | Published input SHA |
| --- | --- | --- | --- |
| ARCHITECTURE | ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110 | [#983](https://github.com/profitia/SG-dev/pull/983) | `4e67c9234a88f82479d669598fb730d6ad8fbc53` |
| SG2 | SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110 | [#987](https://github.com/profitia/SG-dev/pull/987) | `67c758774a58b09b2df31942ba6e6ce79f3141ac` |
| SRM | SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111 | [#986](https://github.com/profitia/SG-dev/pull/986) | `99dca957c47d4f755e49b731e79db0e8dbd56c9d` |

The proper Architecture, SG2 and SRM PMOS registrations are active. This bounded proposal has its own Architecture task ARCH-REGISTRATION-SDK-SOURCE-REVIEW-20261111; parent implementation tasks remain active.

## Local composition and exact scope

- Base main: `f8f6340ab1ac862a584352f86988dde199172b37`.
- Unpublished local composite: `57f175c61ecc205a57a18401bace8037dffd4ff7`.
- Tree: `392ade60a03e3874a69d974bd4ae1f72d6cf6c65`.
- Source entries SHA256: `128d0fee007e9fd22050d9c0d192077ae387146bd7b421b5adff3e2ab62e77e6`.
- Exactly 41 paths: 25 Architecture, 7 SG2, 9 SRM; all regular 100644 files.

The composite was assembled locally from the three exact owner commits and has not been pushed as an aggregate. The ordinary published owner PRs remain reviewable separately. No owner path was manually overwritten during composition.

## Validation actually performed

- 175 pure model/default-Root/invitation tests passed;8 conversation tests passed; Identity typecheck passed.
- 140 tests passed on the exact local composite:7 SDK/lab tests,35 private host tests,84 optional package tests and14 SourceHub foundation tests.
- GitHub [Identity source run42944866204](https://github.com/profitia/SG-dev/actions/runs/42944866204), exact producer4e67c923: real isolated PostgreSQL passed all7 creation and all7 durable-draft subcases, including changed-company reset, same-NIP preservation and mismatched schema refusal. Session/navigation test/type/build and preservation of both existing consumer contracts also passed.
- That whole owner run FAILED: the uncombined producer intentionally lacks both new receiver frames and nine SDK/history compatibility assertions reject it; governance does not admit this combined candidate yet. Its1933 passing tests out of1942 are component evidence, never a successful whole-run proof.

No local partial result replaces exact-candidate public and controlled CI. The four-file policy proposal passed all 188 controller tests, including unchanged historical reviews and rejection of altered source, status, mode, owner/PR identity, forks and unreviewed paths. The checkout verifier also passed against the actual local composite Git tree and every one of its 41 regular-file entries. These checks do not activate policy; public/trusted-main results are recorded in the proposal PR.

## Proposed sequence requiring owner acceptance

1. Accept this concrete four-file CI proposal and the coordinated source publication procedure. The policy contains only this closed41-file map; existing private package pins, read-only credential phase, ignore-scripts installation, main-only execution and token-removal fences stay unchanged.
2. Run the existing trusted-main controlled checks on the exact policy PR, then admit that policy only with all mandatory checks.
3. Refresh the local source composite to resulting main, accepting only identical reviewed source entries. A missing, extra, renamed, mode-changed or changed blob invalidates the review.
4. Fast-forward existing producer PR983 as the coordinated transport, preserving the original SG2/SRM PRs and PMOS tasks. Publishing that aggregate is gated by step1; no producer-first merge is permitted.
5. Run ordinary owner tests, actual PostgreSQL, both consumer checks and the exact controlled SG2 tests/typecheck/build. Independently read back the proof, obtain required exact SOURCE GO, then promote atomically and verify resulting-main CI.

The proposal authorizes no SQL installation, role/permission change, runtime configuration, provider request, email, package entitlement or deployment. Those retain their required installation/recovery/release gates.

## Complete source manifest

```json
{
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "sourceSha": "57f175c61ecc205a57a18401bace8037dffd4ff7",
  "baseSha": "f8f6340ab1ac862a584352f86988dde199172b37",
  "treeSha": "392ade60a03e3874a69d974bd4ae1f72d6cf6c65",
  "inputs": [
    {
      "projectKey": "ARCHITECTURE",
      "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
      "prNumber": 983,
      "sourceSha": "4e67c9234a88f82479d669598fb730d6ad8fbc53"
    },
    {
      "projectKey": "SG2",
      "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
      "prNumber": 987,
      "sourceSha": "67c758774a58b09b2df31942ba6e6ce79f3141ac"
    },
    {
      "projectKey": "SRM",
      "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
      "prNumber": 986,
      "sourceSha": "99dca957c47d4f755e49b731e79db0e8dbd56c9d"
    }
  ],
  "entries": {
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "sha": "184536c22980b5c40df41ce65362caa4130de63c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/identity-runtime/src/organisation-onboarding.ts": {
      "sha": "98169978b157e0676f513f1b7ce11bac5c0a84d3",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
      "sha": "f04a4b27f7b39d7031839afb877fe6f5e836ff83",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "sha": "bd3b3d6169ef575c2a79ae9c80ee529014f41632",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "5f2c3194cadc617806f2a097e75cbdaebdef21a5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "sha": "6836893a46e189aade7a422b4eca912dc9cbc9b1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "sha": "f77c83fa347330a710d53079fe8f3f12a0ba8d6c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "sha": "e2c3e0ae81a713425b104139f036783e81f5aa1e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "sha": "6e53641ad436dbd95568a49c26f7176616c8c686",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": {
      "sha": "e2a7d72bc910352bab449ff4cf2e651e015af96b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/operation-integration.json": {
      "sha": "7d399125fbb50f8b4f0b00db2662c05b1096995f",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "ce2340a7ab9c700795715281aa9ee922d8daedfa",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "sha": "2f79f558f44efa3b94cbbec919bc774044b8a73b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "sha": "b152578e6931f9fa1582b0ced87d93606143130b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "sha": "a9544af37bb7b32b5a36105d40beb4769f1da489",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "sha": "da960d8679088a1a108f23f445a997bc5b5ea788",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "sha": "f08c6b08e09258ebddd4f8891cbf268cfcc623a2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "sha": "731a3a0d130ea41c3af85509130a0df9911c0df2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "sha": "071102735bd9d3322c5d096c05d1513c3772e5d6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "sha": "f412f1607a4fca31cb1bbb583d45e7dc0828854c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": {
      "sha": "a0239d930b8da5333e5589a1734bacb54d67191c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": {
      "sha": "5571f58c2ee30e3a0f1a33204ba8af4c53c29660",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "sha": "c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "sha": "cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.d.mts": {
      "sha": "b00220f767db22897bb3ec65233bb39fba715e4e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.mjs": {
      "sha": "d018c17a251abbf698c87a29aded91f93a4e493c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": {
      "sha": "ffcacec4080ca608ab00e3aff0b7371f23f08a55",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.mjs": {
      "sha": "008ef066c74bd72a2a546f15f4cc1694db9ef297",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.d.mts": {
      "sha": "674a1e3d7841bad6194a176ecccd70622bae012b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.mjs": {
      "sha": "280935c68a5d1c8194669f8894b87324c2ed6843",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.d.mts": {
      "sha": "a8e933f8f4946ad9459baab93110976be88e97ef",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.mjs": {
      "sha": "be2730964c8af8b32f8c8f2baf45aa26fe807949",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
      "sha": "28e82cc2af6d32f6a7e396c48ad081323680b140",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
      "sha": "ea30c87f19cfb0bc064cd922c23a0b0dde354c99",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-invitations.test.mjs": {
      "sha": "64fcb4270f376573c132040eb8fd66642240ecdc",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
      "sha": "203ee38cf32c28327eecd1093100bef54db3a84d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-profile.test.mjs": {
      "sha": "a6ed612325ad049dded4a4fbfdc00b254bc147e1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.json": {
      "sha": "53f6aedd40627606841dac0ae5c6cd639751a793",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "7f86765be878281f1c721ecfd669bb628b5e1781",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "aa8cdb529f429628561fc2fcb89c2624dd782f26",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/private-operation-host.test.mjs": {
      "sha": "b96001f516411487bf6e1ca07aa21cb0a007cc5d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  }
}
```
