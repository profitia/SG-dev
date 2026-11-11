# Stage I SDK CI reconciliation proposal

Status: OWNER_APPROVED / REQUIRED_CI_PENDING. The original PR988 approval is preserved; this successor is owner-approved in PR990 but not yet activated before required tests.

Required CI found four verification gaps in the accepted candidate: trusted contract provenance still selected the old SDK digest; old M2 history readers did not unwrap the latest SDK frame; Newsfeed compared a current digest with its immutable earlier acceptance; SourceHub routed an unrelated new closed review through Oil.

The repair preserves all155 production SDK files,48 SDK fingerprints, optional package fingerprints, all old receipt values and preserved guards. The source scope is48 paths:28 Architecture,8 SG2,12 SRM.37 original entries remain byte-identical; four existing metadata/test entries change and seven test/CI paths are added. No business/UI/runtime source, permission, provider or deployment capability changes.

Initial admission: PR988 mergefa81114d35281693604833f1b7639b3c3b829ce6. Policy controlled42963775233 and independent public42945964993 passed. Resulting-main42964830693 passed all jobs. The41-file feature itself remains unmerged.

The local successor and exact inputs are below. It remains unpublished as an aggregate. Ordinary producer inputs stay in PR989 (Architecture), PR987 (SG2), PR986 (SRM); parent tasks and source-admission task remain active.

Source entry-map SHA256: `96694ec1cfd285d7972add61a706cade825fbb447e94f265fd3192b4e275790a`. SDK metadata fixture SHA256: `a0ebdd9af086aba27d025aa821b2c22d43551e997dfa0642c0c59aac11cc4ac5`.

The trusted provenance repair uses only reviewed JSON, physical regular-file hashes and immutable prior receipt bytes. It validates both owners and the entire155-file production graph before the existing read-only credential phase. The same framework, internal author/repository fences, main-only Environment, package pins, ignore-scripts installation and credential removal remain required.

Tests of this proposal and the actual working-tree provenance check are recorded in its PR after execution. Passing components never replace the required complete exact-source CI.

## Exact source manifest

```json
{
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "sourceSha": "84d1122f5f40294821ee40775e7774a967968f4f",
  "baseSha": "fa81114d35281693604833f1b7639b3c3b829ce6",
  "treeSha": "bde4dc12274077ad8e088cdefe715e728c914759",
  "inputs": [
    {
      "projectKey": "ARCHITECTURE",
      "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
      "prNumber": 989,
      "sourceSha": "9ae4a3e7d309a9eb55fa9ff237494ff2dc02506f"
    },
    {
      "projectKey": "SG2",
      "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
      "prNumber": 987,
      "sourceSha": "dfaa4bb2053ae9b4856edabb9c40478d0b5b66c9"
    },
    {
      "projectKey": "SRM",
      "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
      "prNumber": 986,
      "sourceSha": "c9b06b32dd64f5b75d67b81ea4a85a19d541c472"
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
    "apps/newsfeed-runtime/test/runtime.test.mjs": {
      "sha": "36209e9d8c055fbbf695ba546634a25b1e161259",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/scripts/ci-routing.mjs": {
      "sha": "54142248b9b8096ed3d3b22e582478d019c505a6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/ci-routing.test.mjs": {
      "sha": "f7b9d7bebae5d87c7aeb8e669077f6c7547d90f4",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "sha": "bd3b3d6169ef575c2a79ae9c80ee529014f41632",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m2-integrity.mjs": {
      "sha": "55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0",
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
      "sha": "0f951336afbdd7820344ef82325f81aa0ac0a9b2",
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
    "apps/srm/src/server/peer-read-boundary.test.ts": {
      "sha": "84a815444776c192eec80211190ff0dea189d26c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
      "sha": "d272026e1d3554700eeb87a3096343f0cc34dd23",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts": {
      "sha": "0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7",
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
      "sha": "5ac1ea073a88c4b734ae644fd4c61cb10d6e89dd",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "4b2487e09a4f2747613a30ae8d4fe2f2a97f67e0",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "5368aff3e2355bb509e2e99cc26e2601e735187b",
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

## Pinned SDK metadata test fixture

<!-- registration-sdk-fixture -->
```json
{
  "schemaVersion": "1.0",
  "acceptanceId": "organisation-bootstrap-v1",
  "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
  "targetEnvironment": "development",
  "scope": "OPTIONAL_ORGANISATION_SDK_SOURCE_ONLY",
  "platformVersion": "1.34.0",
  "previousSourceSha": "f8f6340ab1ac862a584352f86988dde199172b37",
  "producer": {
    "projectKey": "ARCHITECTURE",
    "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
    "pullRequest": 983,
    "sourceSha": "c373be45a5bf52c93034f5a1b6878e531c81b2ca"
  },
  "sourceDigests": {
    "packages/platform-contracts/README.md": "36e013b6f6692566004e152020d3d43b38a4567680b5dd0b53677edc519bc1e7",
    "packages/platform-contracts/current-e1-authority/first-party.d.mts": "7e5aa9c6c113387532bb78fac80d5aa42cf95e5599bda64197d2f71a28be31df",
    "packages/platform-contracts/current-e1-authority/first-party.mjs": "3bfe6952dff2d2c407489960d3cc2c9b6bf63d6eb02859462abf1eff86e02eae",
    "packages/platform-contracts/current-e1-authority/index.d.mts": "898029dff37224a2d220a3e65f8ade8e97a69afe67ddfb22be6f3f92cddfa7b5",
    "packages/platform-contracts/current-e1-authority/index.mjs": "783676fdd808d00a20a04c8c152216f2ed4d3d82122d94ec65158d611a086e68",
    "packages/platform-contracts/current-e1-authority/insights-service.mjs": "5f641f094211733ca18fe82af0a4700dc0b9acbb00a036067d00e4f6834d5da3",
    "packages/platform-contracts/current-e1-authority/migrations/001-authority.sql": "2346e2f1b099e40eb633651530c15bfb2ca109c20fbf6b5a9b98243447afc00d",
    "packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql": "28db9a012f7408e28b3a742abdc7870f80974aef977cf40615bd07216beafc10",
    "packages/platform-contracts/current-e1-authority/migrations/003-first-party-authority.sql": "646bdab4fb112c553bc376107872c1be2610068d80754809aca222513e20f82f",
    "packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql": "1cc8dff949bf632b7288a705cee13bbf65a8aa5e6eba5a3edfa3d7e694c40938",
    "packages/platform-contracts/current-e1-authority/migrations/005-calendar-authority.sql": "a6615f8cab67bbff19f490604ee02d67b44ed7143bdaa8b51409491ea026a010",
    "packages/platform-contracts/current-e1-authority/migrations/006-calendar-receiver.sql": "d96f386d5aa26d71cd358e9c56ad38fdc686036a6e278cfa53ba04b5b2057445",
    "packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql": "30d8534fc1b315bef1d7f8657f69a6476fb23bfe445c96d0684bc04d528380c3",
    "packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql": "e24bf4a2be8cdba0e27fc8d2a03d6c0194dafbfba32f605ea28ff6f30546c5c3",
    "packages/platform-contracts/current-e1-authority/migrations/009-insights-service.sql": "704b130e908078df70902e4fc3572b744d1646b938a1c1e8848b144adfd308c8",
    "packages/platform-contracts/current-e1-authority/package-lock.json": "7a7a7466ed307f527a6e792e5248062d2c3d7087265507ef3968be07a5059ef2",
    "packages/platform-contracts/current-e1-authority/package.json": "9cc631b44726369472250b812a968aa4d5c3dae69716e0266b078d2b95ae1d96",
    "packages/platform-contracts/current-fresh-report/package-lock.json": "a4aa3080a474d5c7190035e61cdfe0626ce90e9cc7d0a3a05db807b944e5e221",
    "packages/platform-contracts/current-fresh-report/package.json": "ad639b4293fd3298e5e6f36cb615497ba7d6c62e2267e91fd33ed4112790bc0b",
    "packages/platform-contracts/current-fresh-report/src/current-fresh-report.d.mts": "2da701f79cb5aaf4447239255a96169b5394f6ddd62713c19b213a240fe39a38",
    "packages/platform-contracts/current-fresh-report/src/current-fresh-report.mjs": "29c8a0fb5d048217afd25a3678c35ff03d0d5a663ba76b338a1e8117875176cb",
    "packages/platform-contracts/migrations/access/001-internal-access.sql": "356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2",
    "packages/platform-contracts/migrations/access/002-module-scope.sql": "c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed",
    "packages/platform-contracts/migrations/access/003-module-audit.sql": "af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac",
    "packages/platform-contracts/migrations/access/004-initial-directory.sql": "7004cc968183fdf1406b143066134138426eecfeaae823a3765321e72a9a4811",
    "packages/platform-contracts/migrations/access/005-service-read.sql": "f7757dc5805b3759959505fa852715e70d207e94bf5d85827db3d52b0a5d0d49",
    "packages/platform-contracts/migrations/access/006-request-reservation.sql": "0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127",
    "packages/platform-contracts/migrations/access/007-delegated-jobs.sql": "6a12132efab396e6e647e15d1a9711d0a1bacaaab4482639178acd0258d518cb",
    "packages/platform-contracts/migrations/access/008-platform-ingestion.sql": "14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b",
    "packages/platform-contracts/migrations/access/009-external-call-admission.sql": "69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206",
    "packages/platform-contracts/migrations/access/010-external-request-admission.sql": "8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79",
    "packages/platform-contracts/migrations/access/011-request-continuation.sql": "d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1",
    "packages/platform-contracts/migrations/access/012-native-external-transport.sql": "6faff5f258b71cf2525d705c8fcf38c8aef9331c4e8f0bdd6f1af74e6cf76bde",
    "packages/platform-contracts/migrations/access/013-supplier-delegation.sql": "cd12f9b88397da88241499548b8a5977d0aca830ad83c53a1bcf146265503555",
    "packages/platform-contracts/migrations/access/014-delegated-private-phases.sql": "13f4bb374cbfb31604823083261bbc8f5142e88be7443b704c792a232defb6e3",
    "packages/platform-contracts/migrations/access/015-delegated-private-inspection.sql": "00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d",
    "packages/platform-contracts/migrations/access/016-delegated-native-work.sql": "19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe",
    "packages/platform-contracts/migrations/access/017-additional-request-operations.sql": "a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94",
    "packages/platform-contracts/migrations/access/018-public-web-transport.sql": "f334e0efe99aac742ecad53e9cfa4d0199dbd2333a56792c58c387621b5b174d",
    "packages/platform-contracts/migrations/access/019-supplier-location-operations.sql": "34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5",
    "packages/platform-contracts/migrations/access/020-supplier-location-admission.sql": "90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc",
    "packages/platform-contracts/migrations/access/021-native-soap-transport.sql": "f80ae5a06cfc621e92847f0c197b5b8adfca1b261fbea168488742e85adc2bc2",
    "packages/platform-contracts/migrations/access/022-organisation-location-grants.sql": "88211a1c8e601fe81cb04ad73321f86135f4585e45d3f176f34507e136632e11",
    "packages/platform-contracts/migrations/access/023-current-work-audit-index.sql": "93cb4edee303c3c104eb3cf4fd1be598deebe26256f3a66acf6851b1bcc6561e",
    "packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql": "9fe56c54c22fe54aa4869966cf00e7347e8c0d040b1d3d8110fc7952a78d5e13",
    "packages/platform-contracts/migrations/access/025-form-report-admission.sql": "296ca7ea39f6baeaa9ea5de4846a946e5804a0bc5ff53d0ca52ccaa08eb9e98e",
    "packages/platform-contracts/migrations/access/026-role-source-quotas.sql": "b3e8ec02ccaff27b99d1bb961a7ae3d8df7663e5d6cd20da6bb09647c7dfa6c4",
    "packages/platform-contracts/migrations/access/027-unmetered-supplier-requests.sql": "88c5014db027c40568fcc737acbcf27766bb5db1c434c32ce6c236af859d90ef",
    "packages/platform-contracts/migrations/access/028-api-path-transport.sql": "bd35367f22eccb34dc6c8f62b3a82bfc8947471142fc5daab45a32d67c07707c",
    "packages/platform-contracts/migrations/access/029-market-symbol-transport.sql": "fee0f8738f7ccb8481ce2894b6e5a84792256d5230ef0ef1585fc34ac851d504",
    "packages/platform-contracts/migrations/access/030-assistant-operations.sql": "4cf61265cbff5244dd48484e321f969cb10440d097fcc72d735a34ea861f74b2",
    "packages/platform-contracts/migrations/access/030-model-execution.sql": "196a6e056141cdb1a65626afae8e6091c94d6427d54ff36363d19905c6d0b891",
    "packages/platform-contracts/migrations/access/031-model-execution-long-report.sql": "a034ad1eb21fd3b54061b2a50446c698954c6e82465d18b71b387ecb8587382f",
    "packages/platform-contracts/migrations/access/032-report-model-templates.sql": "c6f5dacb81ecff2b8d270a180efcb59c65e1fdf8cc510acf059544391aeb6dab",
    "packages/platform-contracts/migrations/denial-audit/expire.sql": "8855e8fabaa95758799a54f366654be1e475d9e1f9270b477bcebe33d5ebdd2b",
    "packages/platform-contracts/migrations/denial-audit/private.sql": "a964115f6bf51e4038ad7c63db7b1a741590e86672a66bdba2f9dfb7cc9ee3e1",
    "packages/platform-contracts/migrations/denial-audit/roles.sql": "09ace8f3621d31c4d411a375b1b31f2f6a48a9f53f86da3b5bb4e05b292f692b",
    "packages/platform-contracts/migrations/denial-audit/source.sql": "4712a2cd706219a23eccd3fbf5804f6f8bff9c3c9f1cd9588f1407cb6b2099c8",
    "packages/platform-contracts/migrations/profile/001-user-profile.sql": "a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3",
    "packages/platform-contracts/migrations/profile/002-binding-renewal.sql": "ea8a23a4d9db92587b1be1abde67bfa54cf061b79ce63eae09e96db3da20ee76",
    "packages/platform-contracts/migrations/profile/003-email-delivery.sql": "f8e8ca3ecebaa9bc73f87310e43a93765d516a454e05270606261ded78f95e45",
    "packages/platform-contracts/migrations/profile/004-communication-language.sql": "1fdff82e8d9638338662f898c06b41c54bed6a23fc2fd8dc710bf36687fecd2b",
    "packages/platform-contracts/migrations/profile/005-registration.sql": "78af6bfebf483db2d49df5a11caf7fecfc608ac5768725f20adacdc1079cedd1",
    "packages/platform-contracts/migrations/profile/006-vocative.sql": "6dd18a5b044bd1e7448f4ed298270fa2a37edad8f94374160d333718322f89ab",
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": "cec63fc31e2ed9caf6a7146bacc0954d7698e784c60284d1695f080c443e7b18",
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": "4da9e422e95e46c55d592040789b29202b54362dded8cddea356e3f036e1feec",
    "packages/platform-contracts/package-lock.json": "0b2244b9809e64df05fd46cadf9424ef25062c1161ec259b4f6ad6621365393e",
    "packages/platform-contracts/package.json": "e1a4113afabb1b4399e0a08d7f53b84b7e39d93c3544269e544db2ac6862557c",
    "packages/platform-contracts/payload-capture/package.json": "d297bb6371f8ca79655c65ac08297e6631983a6bf3393a96fbb28a6619ba2f7d",
    "packages/platform-contracts/payload-capture/src/payload-capture.d.mts": "ac8c8399b33ee143a4191530fd7a236f04b6055c437b6a38bf69a888f86d2634",
    "packages/platform-contracts/payload-capture/src/payload-capture.mjs": "7eabea213158e6193c481dcbe2721b98837cfd729ae1af3bac7d2396c950f08f",
    "packages/platform-contracts/readonly-miss-report/README.md": "1512a31ec3d2af928b1c77ea5a26e1b090f4175e614302eb94d59fb215c5ddbc",
    "packages/platform-contracts/readonly-miss-report/package-lock.json": "bcbdc1fbfabcf2094445afcf1e107ce8ebe11e39de1b01e0645b88a62310dc54",
    "packages/platform-contracts/readonly-miss-report/package.json": "ddcb783631293cdda336f4937435b5add280a3a7570af4d1ab4e1a3d2f70df07",
    "packages/platform-contracts/readonly-miss-report/src/readonly-miss-report.d.mts": "84939e1327f7260523f39a7f82385f6285013f8013c0fd8b33675ce676418493",
    "packages/platform-contracts/readonly-miss-report/src/readonly-miss-report.mjs": "ed0337acb60b334faef60273d9913cf9c71c731fbc7ea6b2bf75f85f2e0d9b3d",
    "packages/platform-contracts/root-atomic-claim/README.md": "e08d5c64e78c02d69e46e059fa0c2147e1998e53f05e9607b8cdf70ca6070224",
    "packages/platform-contracts/root-atomic-claim/migrations/001-root-atomic-claim.sql": "1c1784b3c92753ccc28f7c34af89e26f1784a632859d5dbe45a9f5f3d08f6c0d",
    "packages/platform-contracts/root-atomic-claim/package-lock.json": "e537fea8debcddf68b0b478aa3a2e9f248e4a6c08c7cf68d5a07b08df0624d78",
    "packages/platform-contracts/root-atomic-claim/package.json": "6197bf48d438e76c6a1b6863438855423673b2e3d320b620891411464297dfe4",
    "packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.d.mts": "955b2d6076a8e5a34ac6add66920fb6d4ec27dfccd1e5308932ae9bfef1c2d75",
    "packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.mjs": "fab1780877f66ba582be74bd3944649628624bfcc62754b0256275236d960398",
    "packages/platform-contracts/src/access-store.d.mts": "90cb7cfb0aa6413382a7936cd9001d533b44de70e622c7e50fbaabee3ea54cd1",
    "packages/platform-contracts/src/access-store.mjs": "f1e6c382e4d91d8ac7f366e755ad918857c710265b6ba3b22ddfd8779e5b0934",
    "packages/platform-contracts/src/assistant-operation-host.d.mts": "32b5e76f35024cacea5a2f3814b8c9d0107054f71399ed7b24204195373531fd",
    "packages/platform-contracts/src/assistant-operation-host.mjs": "776624aae620a5b655c1e8e628f39e488937227ad25bd863b7a87d54f16177bc",
    "packages/platform-contracts/src/assistant-usage.d.mts": "9aedd45fccca1aa51364ff34d147e4be4f4f7562945ce31787d19a13c0b6504e",
    "packages/platform-contracts/src/assistant-usage.mjs": "89aeb035a96f5e425c6914c1f174cd1662c9c94b2f161db29f60b093e1f2189b",
    "packages/platform-contracts/src/clerk-configuration.d.mts": "f81af5115df7054bb131ec95a63eb7cb6316744052fea8098492e762caa46f08",
    "packages/platform-contracts/src/clerk-configuration.mjs": "1c9b688960d6fa9a1875195cac6d2d9a9c07a03c41f37c56623a4179b35171e2",
    "packages/platform-contracts/src/current-human-read.d.mts": "0b3858e217511522ae8be2df5b8ff9f433ce360c435056ae4ef7055631f9f17d",
    "packages/platform-contracts/src/current-human-read.mjs": "81a8977e119d1c844812c6598ac79024530830e3eaed5e57cbfa2a45f4379325",
    "packages/platform-contracts/src/database-lease.mjs": "0d6d6366ea12b48d3f06cbaffb5f2ce6b3dacdb4617ab41e346ae28344774183",
    "packages/platform-contracts/src/delegated-job.d.mts": "ad19381623d2a8bd31baac9a2bfa667026e79bffd2ab3c6bf97b585389d012c2",
    "packages/platform-contracts/src/delegated-job.mjs": "c40206b03e24ee1d2b719fda4bd37f573f6e568dd51f97fb6c9b2a3cdbde5772",
    "packages/platform-contracts/src/development-context.d.mts": "5b9f8bde428fa8dd65b7cc515f2b2e0485d6aced4709f257e215ae724e9975a4",
    "packages/platform-contracts/src/development-context.mjs": "7b82e5d3fe3fc0e3826c6b165c9bcdd7b1ffd5505a1380e3dc6a86a5bc481013",
    "packages/platform-contracts/src/diagnostic-phase.d.mts": "51497cfa548f7a4876c4884b7b139e907ee4a8526ce37a400c9bff6d48376ea7",
    "packages/platform-contracts/src/diagnostic-phase.mjs": "0317fa7ef0d95c7574c1b0143094012f75876dee0b3fcd4602ee1a1a17f2bc07",
    "packages/platform-contracts/src/embedded-channel-core.mjs": "337530ea6df1387b9383065ac65b8f55f90afaa598f85ec9ad1628480335911a",
    "packages/platform-contracts/src/embedded-command-channel.d.mts": "d137964bc0ca86ab3908313b0837a5f3ec3b4d461a674e1029c37b040a733389",
    "packages/platform-contracts/src/embedded-command-channel.mjs": "ea67d7d0ed9bdcd5739e6d42493e0457688af2c9d87db153f6fefcbe5bb8dc78",
    "packages/platform-contracts/src/embedded-read-channel.d.mts": "79cd32e83cfa19e13fc3ebfd874cf0b45cde53213d4c5438c7a63cbb99a5ccaa",
    "packages/platform-contracts/src/embedded-read-channel.mjs": "d134041c197a7fb3c7653810c18b27c65e001733f156cd489ecc1ef7b2fd5a89",
    "packages/platform-contracts/src/external-call.d.mts": "043c43ce8027305e36a9b9684bb8b390ffceb813a08cf07b97614d2361545bbe",
    "packages/platform-contracts/src/external-call.mjs": "7681dc9521f93c8769a943f66b192550c60e46658903b44d97aca007645c43a8",
    "packages/platform-contracts/src/identity-profile-sql.mjs": "20b0d3ebeb2fbe3b37b5c2deab75e226d250275be1249de204058e8a7930d259",
    "packages/platform-contracts/src/identity-provider.d.mts": "1a91eccce21baa063cbb508f1df34d19287d49e05e3182cda0fb1f643ec15734",
    "packages/platform-contracts/src/identity-provider.mjs": "1fc428a14196509a6493d96404e5f4c3ff9fc0fdfdcecfebcf8f18394e6a68c3",
    "packages/platform-contracts/src/identity-provisioning.d.mts": "77ad3313ebb337a37e1ddb4af15ed6ecbad8fb198f5cbcbba57ba4fb26196289",
    "packages/platform-contracts/src/identity-provisioning.mjs": "e6082719dc27405100326cf285f1d216ba08e2e59ef80b8fe42eff5b95b7c45b",
    "packages/platform-contracts/src/identity-renewal.d.mts": "9d4fb57b174f64ee21fba13ff9e8f5a07f2a46d44725c0820eb56af6c144e4dd",
    "packages/platform-contracts/src/identity-renewal.mjs": "01e869250f5bab3c9b10fbc6f25aef3f7c06aa8e8572b3559a681739607318ca",
    "packages/platform-contracts/src/model-execution.d.mts": "347864802b2ae361ed50b08ea55cfb2ad2688a672eb0bc4fce29ad69a02614f1",
    "packages/platform-contracts/src/model-execution.mjs": "bab7297f4835a3c87d581d2b9c8f54cc15c3d9b5e629d0e43f7de3a97d1d84e0",
    "packages/platform-contracts/src/module-scope.d.mts": "123d4b08864acbb2dc2509f3fbad21fd50f1b5d0e42ca00f6f21b2275d280db6",
    "packages/platform-contracts/src/module-scope.mjs": "0dd5d00dc1571b3712fbe42d04fbada7a655bf29af2e89ff3812ff575ac3d629",
    "packages/platform-contracts/src/native-external-transport.d.mts": "165a7ea0703ec31b1af89ed8b980a215ddee2fb181dbbe1498a5bea77cbd44da",
    "packages/platform-contracts/src/native-external-transport.mjs": "09c6595500f5b10fbf16b57b460c2064fe573bf6f1e1b754b3b39a9e53e40c9b",
    "packages/platform-contracts/src/operation-context.d.mts": "ada0e9a29b08e8d5e008efbcf8a39157543aacfa7e1424543356ab7db720e5a2",
    "packages/platform-contracts/src/operation-context.mjs": "79622c8a0f6480071526083acc9b7a9bb2761fe0e947cb1cc31b2906c4931a7f",
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": "80a7ecc043ee71bf96c000167c32d67759ab878ed274c8ee41d56986f5c056a1",
    "packages/platform-contracts/src/organisation-bootstrap.mjs": "15b08b09019d9d34c89dd0df3966f3859d67823fe09f380722384ef64a151941",
    "packages/platform-contracts/src/organisation-invitations.d.mts": "e20325e5903b0a529604bb2e45a6f6caade74eec9288c6149031e546436e70b6",
    "packages/platform-contracts/src/organisation-invitations.mjs": "4ef4077e77b5c0870ebfb3cb316001d4c3c7eb67c6ecd93998453dcc174eda4f",
    "packages/platform-contracts/src/organisation-profile.d.mts": "f5e134b1c43b773d2a399ad0e5dce9cbff4e90ed1639eaeb64568a75d5b521f1",
    "packages/platform-contracts/src/organisation-profile.mjs": "da6b8101bcc23d6a7edebf2f3bd8d12985159d452657317f24c0d0d19ac2b582",
    "packages/platform-contracts/src/peer-operation.d.mts": "a3f6d6463bc508475674667f3abb5b136a1cb4d2b0bbafa1c4eb5974c935f6b5",
    "packages/platform-contracts/src/peer-operation.mjs": "316282f0b9b76c927427c62cdbd2dbda2c917457dfd91e280e652b89bde36a10",
    "packages/platform-contracts/src/platform-ingestion.d.mts": "4335070ca01216b5ce651264f72328b24483d66a850feffbf7dfe14f5b4161d0",
    "packages/platform-contracts/src/platform-ingestion.mjs": "4159bcd2bdc6de7e32e573461ac07d73572d0ab9c4d9bf6aafc1b3fe41036a1f",
    "packages/platform-contracts/src/private-operation-host.d.mts": "248a3b60f525afb102c7aaaf230c6d10fde6793dcbb71c94e1f9b9db9ee57897",
    "packages/platform-contracts/src/private-operation-host.mjs": "8de0db0d5cc2e0e5fd0fdaf0583c4bb1d89fbaeb3170be33aa732720591e2034",
    "packages/platform-contracts/src/public-request.d.mts": "c92a6faa2764eb7d40671971abc531cf72b92f1c12d74f30be3f4f54c632722b",
    "packages/platform-contracts/src/public-request.mjs": "7d23cbe9ee5742f9305ff4c97c76254ea1cba55dd64594864a5536b2bea1de6b",
    "packages/platform-contracts/src/public-web-transport.d.mts": "9d386895e800bf5fc42135d9e0dd152e5596c86938954e47c694509122ee8f35",
    "packages/platform-contracts/src/public-web-transport.mjs": "ba32dd4cc97b7e6de9290c1047242cf793484e03e5817b5b301759a55bf2e9c7",
    "packages/platform-contracts/src/report-admission.d.mts": "397f8c861e85215587c4bc88e696908ec0d4f50ca6917cd2e74f6df9163100c5",
    "packages/platform-contracts/src/report-admission.mjs": "60752635661a60fb1fc18f44656cff3a3052b6488d4ce9be94e277966e6d10a7",
    "packages/platform-contracts/src/request-continuation.d.mts": "a2d587a34766a3d3fd27838261ec9d0a258252fbd81e4c6d116bc4dbb2afa45f",
    "packages/platform-contracts/src/request-continuation.mjs": "a6ff274d4f780f961789be9bf4e87b07db0ee9335e0acff86bff13f0c15b4ed8",
    "packages/platform-contracts/src/request-inspection.d.mts": "dcf7335c34e9437fd63c492b0af0458bb346104d5af07f32421e8181b6ef90f9",
    "packages/platform-contracts/src/request-inspection.mjs": "8a3006c80be2ba8df0357592981ab6fd6a9172067ff3c16d300a0b76aafc8c59",
    "packages/platform-contracts/src/request-ledger.d.mts": "6bc6786ddee0e5b410959061a7bf4464f7a4eca5e8c887731693b39f15478697",
    "packages/platform-contracts/src/request-ledger.mjs": "07118e6e21ae7074c7f01aca800d56e9aa0464a51c7c7562d640cb16864c0f41",
    "packages/platform-contracts/src/request-operations.d.mts": "df96b4da0f7f92f6d2e6d710451325b21b6037ab701dfc9fa4e698f63559adbd",
    "packages/platform-contracts/src/request-operations.mjs": "5f157b92e630f1f0720e3c920dad55696368058fa1e4d6574178bcb927192c9f",
    "packages/platform-contracts/src/request-work.d.mts": "1413741b67e20e11ec8e26755e054857ab2d0efea92a9a65f839516acbf1a1b8",
    "packages/platform-contracts/src/request-work.mjs": "45e849b3bb4bd1c50cd0e1296588f2de6562c9ab0cbcd99f3ab989540f5fd73b",
    "packages/platform-contracts/src/sg2-denial-audit-reader.mjs": "92625af7db8ada25e8226f4f31db5845bca2a93151b0232325f76d68fae88170",
    "packages/platform-contracts/src/supplier-location.d.mts": "627a809c7ccb0104ca37cb6f93b959cb09a458ad29503f6518d5baf2998084b4",
    "packages/platform-contracts/src/supplier-location.mjs": "41fcd54d03bbf42e7d448f34ab63b6c054e02b18266be5d0c0e4cafc0711461b",
    "packages/platform-contracts/src/user-profile.d.mts": "ece7aaa04d9100fd4379038995454e3a2b46da9d21b7def98ac2bb5817b6b94a",
    "packages/platform-contracts/src/user-profile.mjs": "9933887cbfabaa5c709e00d013274eb0ad344e56192456d5e9c622c461202347",
    "packages/platform-contracts/src/vocative-dictionary.mjs": "e767aaaacb020b959bb16221c1c70e7e78bbb34c1ebf793e96a4b4cd1e01ad47"
  },
  "compatibilityTestSourceDigests": {
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": "6edca19fffa91824a415067cfb18725355dba9f84ba86da7a70fd96ae4f162f1",
    "apps/newsfeed-runtime/test/runtime.test.mjs": "bf7c20a33b349251a1e53f7b85c5d1c3fa5071713f330ac24b3f2a5b9f9f2dee",
    "apps/platform-source-hub/scripts/ci-routing.mjs": "d701dad6c5a449da4f5fe889a2e201251d6ece57343b86ae1cde7602c5df6620",
    "apps/platform-source-hub/test/ci-routing.test.mjs": "3b3462349b26e64d2c5c039921b98c3d461c2f0476222f3f9e22fad08612e276",
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": "e7e6ca84000cf68b4624ae3a8b5a33c992b9dd68cdc2163e7c19a66bcea42f5f",
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "6af51cd771fe192e9d99337ee0de4b0cf65366e9df79a23e6d4f311224d3d416",
    "packages/platform-contracts/test/private-operation-host.test.mjs": "95bb086241c1653f7205072762a67f1e4c6a99cf2b98d4e8afa6a4bf1c52c660"
  },
  "sdkDigests": {
    "accessSchemaDigest": "356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2",
    "accessStoreSourceDigest": "71e42f5e194f8b251c86a70c22bfbd7cb940cf66b8279159b08781f042ec9f47",
    "additionalRequestSchemaDigest": "a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94",
    "apiPathTransportSchemaDigest": "bd35367f22eccb34dc6c8f62b3a82bfc8947471142fc5daab45a32d67c07707c",
    "clerkConfigurationSourceDigest": "b3bdad865a16cbf677db1dd7450f594870abca30f8a252bd4d361d2387417246",
    "currentHumanReadSourceDigest": "caf2f5c31aa20d9e8f0434b6652e7b0b6084eeb21f9d7f24293c497e4bb92f59",
    "delegatedJobSchemaDigest": "6a12132efab396e6e647e15d1a9711d0a1bacaaab4482639178acd0258d518cb",
    "delegatedJobSourceDigest": "2a2bc66260bc33b1bcafe80c9a1e1f594c0206b9efe362082760b1f24d8e7f4a",
    "delegatedPrivatePhasesSchemaDigest": "13f4bb374cbfb31604823083261bbc8f5142e88be7443b704c792a232defb6e3",
    "diagnosticPhaseSourceDigest": "52816918087b9bd437c8c7619be643146f5af9527ea692263b4f2aa0471c7556",
    "externalCallSchemaDigest": "69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206",
    "externalCallSourceDigest": "8a6de7bf58170e97a01dc656f0ef822701a5ff4dae343bfa9e5d3e7a38e825a8",
    "externalRequestSchemaDigest": "8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79",
    "identitySourceDigest": "662f6c95138a0f8cd8f835c569084d669fbe85e34a762676584297ecd5f03606",
    "marketSymbolTransportSchemaDigest": "fee0f8738f7ccb8481ce2894b6e5a84792256d5230ef0ef1585fc34ac851d504",
    "modelExecutionSchemaDigest": "1d4b6af7900b44f3d6a311bdcef85280d1b5c968ca67128e0e641e9adb8d253c",
    "moduleAuditSchemaDigest": "af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac",
    "moduleSchemaDigest": "c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed",
    "moduleScopeSourceDigest": "1a37a9c5ccb19515baf343a122b3c9a9e246c18995b421854c4a0ef7b4211bf8",
    "nativeExternalTransportSchemaDigest": "6faff5f258b71cf2525d705c8fcf38c8aef9331c4e8f0bdd6f1af74e6cf76bde",
    "operationSourceDigest": "58a5d94ba89b8bcc781affa3a9964d5f1d9f3ee11a152cddc7bc9ac098de2acf",
    "organisationBootstrapSchemaDigest": "4da9e422e95e46c55d592040789b29202b54362dded8cddea356e3f036e1feec",
    "organisationOnboardingSchemaDigest": "cec63fc31e2ed9caf6a7146bacc0954d7698e784c60284d1695f080c443e7b18",
    "peerOperationSourceDigest": "adf348cf4424f36d0c2b96acca56a4087e2bb02a4107708788e559c1fcf5d6a7",
    "platformIngestionSchemaDigest": "14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b",
    "platformIngestionSourceDigest": "f2b3e272b00b7fe2dc51c345826855e2fd1426bc49a84ff11fd28317854dd9bc",
    "privateOperationHostSourceDigest": "63d2e2721f2a7bc2223e90f39192e4933f657a89f91be03c84db7db9958f7a08",
    "profileSchemaDigest": "a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3",
    "publicIdentityRequestSourceDigest": "a4f2c41df487704522e5ac2e73e80e66295713dd6a84bd4f984edd5c07cdd394",
    "publicWebTransportSchemaDigest": "f334e0efe99aac742ecad53e9cfa4d0199dbd2333a56792c58c387621b5b174d",
    "renewalSchemaDigest": "ea8a23a4d9db92587b1be1abde67bfa54cf061b79ce63eae09e96db3da20ee76",
    "reportAdmissionSchemaDigest": "296ca7ea39f6baeaa9ea5de4846a946e5804a0bc5ff53d0ca52ccaa08eb9e98e",
    "reportAdmissionSourceDigest": "f24e3f71ef76fdb1e8935d0ddc935ea96c146d93b7ecbc9d6a4a4e2d7879f794",
    "requestContinuationSchemaDigest": "d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1",
    "requestContinuationSourceDigest": "d49673ecec3a85dad478b4e8d3e38aa30241cf04b61b6a7dfbb99e7af33c3c53",
    "requestInspectionSchemaDigest": "00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d",
    "requestInspectionSourceDigest": "772f1f5a58e8e544d275c4b8bb0ab09774317a6673c1f6bd8563f96fc6a19811",
    "requestLedgerSourceDigest": "d24a1c98efe2f04a2d9cd6335f75bd6a37eda4bfe0eca0ebae712a638e9e43d5",
    "requestOperationsSourceDigest": "65e1d46269df57ccd7f3f1637e9ac6a73171ecbdad02b35677d23469d73e7237",
    "requestQuotaSchemaDigest": "88c5014db027c40568fcc737acbcf27766bb5db1c434c32ce6c236af859d90ef",
    "requestReservationSchemaDigest": "0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127",
    "requestWorkSchemaDigest": "19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe",
    "requestWorkSourceDigest": "1b9a56aa85548fa0025366bf725ccad5c4ef278f43753dee9714ea97197bee86",
    "serviceReadSchemaDigest": "f7757dc5805b3759959505fa852715e70d207e94bf5d85827db3d52b0a5d0d49",
    "supplierDelegationSchemaDigest": "cd12f9b88397da88241499548b8a5977d0aca830ad83c53a1bcf146265503555",
    "supplierLocationAdmissionSchemaDigest": "90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc",
    "supplierLocationSchemaDigest": "34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5",
    "unmeteredSourceSchemaDigest": "9fe56c54c22fe54aa4869966cf00e7347e8c0d040b1d3d8110fc7952a78d5e13"
  },
  "optionalPackageDigests": {
    "currentFreshReportSourceDigest": "a9611d181cc0c7cbfa03b9af5f59e2c11742f52796b5f530a83e391e38c2f37a",
    "readonlyMissReportSourceDigest": "bedf0493e6e4d0668b00d0490e31f477845868f7ddf8b3b319ff1b177c2c2916",
    "rootAtomicClaimSourceDigest": "1824cd4be724552320f23bcf326de5b95167741ad615df5958f7e326a744eb10"
  },
  "consumerSourceDigests": {
    "SG2": {
      "apps/sg-runtime/tests/assistant-m2-integrity.mjs": "a9a761bd0742406f8a36c0ce5f44045d2783bfe505284e34c58057f3f204220e",
      "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "78c8cf122122c08c34d94842e34f4bf1348d712f891432bd2e9cd5de1f5685ab",
      "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "b6a3e1775e8b0214ba247a8428f02d310bb5b4b0e48648a28076daffa1f4b85a",
      "apps/sg-runtime/tests/operation-context.test.mjs": "d7ffb69925877b677c795be31cbeeea66a9de94f91ecac83c56f37499e06d206",
      "apps/sg-runtime/tests/private-host.integration.test.mjs": "6cd462a93d075d9f86eb1af836e5144b65df1308a4d5ade79c85552607c3e2b1",
      "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "69f6d36384096c5ab93dc34751841ff16b44057cc13596ac8f29e0e17bb2c0f4",
      "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": "d9602b68580641c217673d27124321ee2590d6cf77ec6f13d215467284cf3c73"
    },
    "SRM": {
      "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": "c6aa655939cb3127e8c19b6cb6511f02e35e256378ff5aa010f5ebe4a7eb2b48",
      "apps/srm/scripts/native-execution-adoption.test.mjs": "cb95414023fc232f07e45caa6e47b5bccdea8eae103136ece339e115b75dddb3",
      "apps/srm/scripts/operation-context.test.mjs": "fa58ab16238b7581ae1ed8554b8a8445a6ede8feac80bd43822301701a4d0bf6",
      "apps/srm/scripts/private-host.integration.test.mjs": "bc00805189c2319691229276c6b626e63dce062ec610edab3d446c49264d06d3",
      "apps/srm/scripts/request-quota-adoption.test.mjs": "d32180adb6facdd8a76035ff043bff55b7a192d49b74a253e7b65aff0230a533",
      "apps/srm/scripts/source-hub-sdk-compatibility.mjs": "377842347c9a299095021937c1c2fcbae57de5d913fedd04e4f6c440201e1963",
      "apps/srm/scripts/supplier-location-admission.integration.test.mjs": "729351a9c3cabe3ea8f7bebd0093b307fc4cb30bb2bb9c98dfc6cb15c18f0c57",
      "apps/srm/scripts/xray-performance-adoption.test.mjs": "345abe0029ff18bed8f44d4dae03168c0a32e750a5c46f87976e66353d7eba42",
      "apps/srm/src/server/peer-read-boundary.test.ts": "fe1ccf72c24460b1e2edc26b44e307fa271de55c5a215b488c6b0592bc93fcd6",
      "apps/srm/src/server/root-atomic-claim-adoption.test.ts": "085794670b9762dab90d0d8baead744c70f59ba395c40baf217882fef5334a0b",
      "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts": "63ee7b29f2b8d6651be9423a2cbca17b1517a6e35c53b7c53a3b7334080c72c2"
    }
  },
  "preservedSourceDigests": {
    "apps/architecture-lab/sdk-1.33-compatibility.json": "3e3c8f43813d5c4888e206ac31433f60470eac4310abaa62bd32e1c901a0df3e",
    "apps/architecture-lab/sdk-1.34-compatibility.json": "458ddbf661ce1a5666260a072a03f24ac016346bdd9a9efef7f2a1d497eee403",
    "apps/architecture-lab/assistant-m1-sdk-compatibility.json": "f9bd750bd7c4af2b1123a41396cfeacac90bb1744f9abdd5331c76260872b70c",
    "apps/sg-runtime/assistant-context-integration.json": "d932f227977789643086b6a9eb179598a6f48071964b2d26ba82d25fceb7b2ec",
    "apps/sg-runtime/assistant-markdown-integration.json": "27ff06aff8bc44592f0073732748834b7759182fa4307d901c7d63304381a38b",
    "apps/sg-runtime/registration-stage-i-integration.json": "4a7a572e67e12ed73c523502cef4cb432009e735737df851419d80898653f414",
    "apps/sg-runtime/assistant-send-arrow-integration.json": "62c6af6817a022c31788d801cc0eac293a24b3f25d9e529d32b1bff4908fa230",
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs": "a6b5949df2f2717d2c8c6dd1680cb6c0fa659f7c78e6287a83a52076e7b4e7f9",
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs": "6f66bd2f00650e6320576c683bc9ec9bd946e0466bcaafb08bba83c97bb21437",
    "apps/sg-runtime/components/appshell/assistant-conversation-view.tsx": "a4cd2979aa331ec67709b113784043318627c91a29cdb3dcbc886928c8c2aacd",
    "apps/sg-runtime/package.json": "e57db5a6904a8381adf60fd1d5626e9b1f5df84168c3e9db8540c4466d127848",
    "apps/sg-runtime/package-lock.json": "4050798ef8ee3ee8ed78ad6332f80fa430bc2550a83896185aad9494851ab3bb",
    "packages/platform-contracts/test/operation-context.test.mjs": "f00169504167c1b208cd0b51f2f2d7927fcffed33a70480cd3980d21c44f3e80",
    "packages/platform-contracts/test/external-call.test.mjs": "3107f59bdf15198448894f0f20f4b86fdd534028b91d1ce94a23696b346654a1"
  },
  "defaultRootImplementation": "1.0.0-candidate.16",
  "optionalRootImplementation": "1.0.0-candidate.21",
  "optionalOperations": [
    "organisation.create"
  ],
  "runtimeOptedIn": false,
  "sqlInstalled": false,
  "permissionsChanged": false,
  "providerCallsPerformed": false,
  "deploymentPerformed": false
}
```


## Owner decision and executed validation

The owner explicitly answered “Zatwierdzam poprawkę z PR #990” to the exact documented48-file repair scope, decision head ca497603e534d5928801c2e26201f2eb2be6ae4f. That decision authorizes the described four-file trusted CI repair and conditional joint source acceptance after all required exact-source checks, with no runtime activation. The prior automatic rejection is resolved for this exact scope; the rejected command was not executed or bypassed.

Canonical task ARCH-REGISTRATION-SDK-CI-APPROVAL-20261111 is registered in ARCHITECTURE PMOS, conversation pmos-task-v2:1b369b81337a288b745726357f19df121c3de01d2d7aa159bb2d0d263b564567. Preflight passed for all four exact paths. The only pre-existing untracked entry is the previously used PMOS dependency symlink; no unrelated tracked work is present.

Local controller tests:191/191 passed. The trusted checker verified all48 actual composite path/blob/status/mode/owner entries, all155 physical production SDK sources and seven compatibility files, both immutable historical receipts and the independently calculated default Root16 provenance58a5d94ba89b8bcc781affa3a9964d5f1d9f3ee11a152cddc7bc9ac098de2acf. Governance manifest validation passed. Full exact-head controlled/public/resulting-main CI is still required before acceptance. Source and Stage I parent tasks remain active.
