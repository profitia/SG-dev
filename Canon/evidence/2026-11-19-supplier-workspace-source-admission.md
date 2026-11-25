# Supplier workspace Source qualification — 2026-11-19

Task: ARCH-BSDC-SCP-E1-ADMISSION-20261119 / cmwnp8agn0000hqe2wocr9yv6. Source authority inspected: `872da0abfea3ae15344f75a5ffa68eafcaee2a06`. This is a technical checkpoint, not Source admission, installation, a new business design or release GO.

## Owner decision and unchanged inputs

DEC-25 is recorded in [the same PDR, revision237a8b79](https://github.com/profitia/SG-dev/blob/237a8b794f051beb1afc94b14b7bcb1617a0df0f/Canon/proposals/bsdc/SRM/supplier-category-pipelines.md#67-dec-25--zgoda-na-dokładny-pakiet-source-i-warunkową-instalację-2026-11-19). The owner answered **Tak — zatwierdzam pakiet §7.5**, bound to PDRbf069096 and49 postimages SHA256 `0e8052dfe4dc72f568ac54f842dc213174f20ae585a46c27e11380ff0c88f740`. Do not request that same approval again.

The19 ARCHITECTURE postimages from `d4f889d7a51aacc5e4ffa520451bc6b3d1d800bd` were read from actual Git objects and checked against their approved blobs/SHA256 and current owner routing. No postimage or old receipt was changed. Source input3 from old repair#1256 must not overwrite the independently accepted, newer ACG continuity repair#1255 on authority main.

## Actual qualification and preserved denials

- Fresh manifest/preflight/PMOS begin/require-begin passed before draft work. The actual chat ID was available for this new task; old unavailable/null task registrations remain unchanged.
- The matrix postimage is exactly `583d5928e587e392daaac940f27e33463eb0f80e`, SHA256 `1b1a9641f1e77ed44ca10781f4e4e99c2a6c7dd5f0d038299cc5f6a90985cb7b`.
- An isolated matrix-only draft passed207/208 existing module/context/host checks; one normative row-count check correctly failed (54 actual versus47 expected by the current SDK test). Zero skips. **Do not publish that matrix separately.** The approved updated test and the producer's runtime sources must remain one proper owner-qualified SDK change.
- The existing adopted recurring provenance and package policy passed before/after the matrix draft. The actual current SG2 receipt does **not** declare sdkSourceContinuations; the canonical controller calls assertRegistrationSdkProvenance only when that adoption field is present. Neither the function nor its actual call condition was changed.
- An initial extra, unconditional diagnostic call attempted an unadopted organisation-SDK path and failed on the absent receipt. Automatic approval review rejected a subsequent active-record write. No active Source record was written. The safe qualification retained the exact canonical adoption condition, kept the Source registry unchanged, and verified that a PROPOSED record cannot activate.
- The matrix-only draft was restored to exact current authority after the failed atomicity test. This PR adds **only this evidence**, with no matrix, registry, controller, SDK metadata or runtime change.

## Shared SDK dependency and next operation

Current main still has SDK1.37.0. Its separately prepared SDK1.38 descriptor is PRIVATE_PROTOTYPE_NOT_ADMITTED, with the registration v3 Source record pointing to `ff340be159f717c2be097e4c8e9bd3befa80e256` (267 files). That published1.38 package exposes supplier-location, **not** supplier-workspace. Do not infer that this dependency provides E1 or adopt its prototype as authority.

Preserve the accepted ACG main repair and the ongoing registration owner's Source/SDK work. Prepare compatibility from immutable owner inputs, then qualify the producer atomically with its correct SDK source metadata and consumers. If compatibility changes any DEC-25 postimage/SQL digest/binding/grant, the changed bytes are outside that frozen approval and require their own concrete review before activation. No old fingerprint, package pin, receipt or Source guard may be rewritten to hide the difference.

The next executable Source step is proper closed admission of the **complete19-file producer**, followed by ordinary consumer admission and full exact-source/main proofs. The18-code-only ordinary proposal is not a shortcut: the required matrix is protected and must be admitted together with the correct producer. Publication follows the released/assigned main window; no competing merge was performed.

## Inactive, non-authoritative complete producer review data

The following data lists real approved producer bytes and actual owner routes. It has no actor, approvalRef or validity interval and is not inserted into the active Source registry. Ordinary admission must reject it. DEC-25 is the external owner decision; this block is not a generated grant.

```json
{
  "schemaVersion": "1.0",
  "scope": "PROPOSED_EXACT_PROTECTED_SOURCE_REVIEW_NOT_AUTHORITY",
  "status": "PROPOSED",
  "repository": "profitia/SG-dev",
  "actor": null,
  "approvalRef": null,
  "validFrom": null,
  "validUntil": null,
  "sourceSha": "d4f889d7a51aacc5e4ffa520451bc6b3d1d800bd",
  "baseSha": "cdc2db38841e3dedafb67fc4313c3b3299f2932b",
  "files": [
    {
      "path": "Canon/registries/operation-access-matrix-v1.json",
      "mode": "100644",
      "blob": "583d5928e587e392daaac940f27e33463eb0f80e",
      "sha256": "1b1a9641f1e77ed44ca10781f4e4e99c2a6c7dd5f0d038299cc5f6a90985cb7b",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Governance Source Layer",
      "surfaceId": "SG2-BASE-019"
    },
    {
      "path": "packages/platform-contracts/migrations/access/supplier-workspace-v1.sql",
      "mode": "100644",
      "blob": "af369f26453304b5248c9962a9f4a76fc742342d",
      "sha256": "647e47125b84e4eb026b5a1aec783b0b147315817cbd6246081fc40c92bd6023",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/package.json",
      "mode": "100644",
      "blob": "655fc041d4f5da0b8ec1d6c7c8ca156ae8bbc826",
      "sha256": "c22b13c173cd94560973fc5facaeb00ae30666216098b7de96bf7a00ca0c9bc1",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/module-scope.d.mts",
      "mode": "100644",
      "blob": "b7a0c6c98462b3ad9b89262e17bd57df578a8b97",
      "sha256": "314b492dc73f983e5c8ad616ce721e9218591ee2b455fd7c5174c46c003dbb8c",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/module-scope.mjs",
      "mode": "100644",
      "blob": "a966900e9dcf913b15125a928546529c880dbc7f",
      "sha256": "8eb216850e290a69dd33f1c350c034ca4238ae4223865c3a4c8772e8e54c6aa2",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/operation-context.d.mts",
      "mode": "100644",
      "blob": "340315ef3018453aa50181f23b48d9b768e03ffe",
      "sha256": "49f17ee6c192e19bb1bc954268193dfc070d1ec3f13275bf8d6e45f46acc8080",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/operation-context.mjs",
      "mode": "100644",
      "blob": "d01a044187c2d847b8409787ac302d5dcfb143e8",
      "sha256": "5eb24d0129adb21fae7c494045afab37c552aeebcb801ea63c8303700a9dda7f",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/private-operation-host.d.mts",
      "mode": "100644",
      "blob": "48c7b801b0fcba325a92859e2cd7b475b9926916",
      "sha256": "97da537f4071555a9f38b41e045e2d435ddfc7c6092e4af55eb1d41a8213400f",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/private-operation-host.mjs",
      "mode": "100644",
      "blob": "098a2a45ad09bfc641109e54eec933ae215910ad",
      "sha256": "e2c42f1f5992f2b94fe11ae203a2540683482c4613e35c5295cb5d3f45121135",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/supplier-workspace-access.d.mts",
      "mode": "100644",
      "blob": "0a17f3537f6e30c0d1dba1120f4c54b463083e1c",
      "sha256": "6833d8266e9c1d48af7a57b41ab74b641d7c89eaa30931869b08559f25446d8d",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/supplier-workspace-access.mjs",
      "mode": "100644",
      "blob": "e305f24de00de8e1fb2ec99462b049f63cadf890",
      "sha256": "469cd163a31c3aad76413f47e54949693e75db37ceb5960ed5bebb5a7c73bf7d",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/supplier-workspace-host.d.mts",
      "mode": "100644",
      "blob": "cd38da902e21980ace0bc2ff2b317d9fbd47025e",
      "sha256": "778878044aa0caf8b5f596ab09919bcbcf98959dd9974c1803cbf8dc89ed686b",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/src/supplier-workspace-host.mjs",
      "mode": "100644",
      "blob": "a95e881dd2d61e449ff6dc37e70f499e0b36f1d6",
      "sha256": "69b75c36d61ebc474b4533ea744da8a994e3ff60782d0aa6c3f931864ff4b40e",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/fixtures/supplier-workspace-postgres.mjs",
      "mode": "100644",
      "blob": "b8b7536a6609ea11b5c27741d31ce447e8aaa49c",
      "sha256": "88f04f37f4d91feb2d9b318b17d1f3a50a521e104aa98157e90d9d54fad7f5d6",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/operation-context.test.mjs",
      "mode": "100644",
      "blob": "8c5392e8fed8057da355cac8c4642ec93fb5401c",
      "sha256": "79dc25da3a471bae202dbd00cd8e153b749f3d45700f059241ee4f77386d32e0",
      "status": "modified",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/supplier-workspace-access.test.mjs",
      "mode": "100644",
      "blob": "cb7febeaac78231f4f8368f475455206f1a06789",
      "sha256": "999dded53a8517c1394641f4cad682313906f7132e2efa6a77d6fb01e2b9a945",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/supplier-workspace-postgres.test.mjs",
      "mode": "100644",
      "blob": "39bf738e22e9674ab2ca3c58f247c35b74d0a57b",
      "sha256": "1af7e789a2907c3b9ff518e3b41591a90a86b5d4c8e9d6ee5ad1197d134aa848",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/supplier-workspace-types.test.mjs",
      "mode": "100644",
      "blob": "0a791b0189146d82167e7a58f3fb995e4091e2fb",
      "sha256": "d7e77cef1992a70bfd7447136663d3e0d969b359e42988fb901962b495a8e77e",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    {
      "path": "packages/platform-contracts/test/types/supplier-workspace.mts",
      "mode": "100644",
      "blob": "c6b00206569e3aca26a7812a1118be511feed41a",
      "sha256": "4f54d4e8a6cbb3dd85a298e4d90b08956b72e38303fa8bfa9bf3945eb1ad4a66",
      "status": "added",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  ]
}
```

Cloud worktree, exact inputs, failed/successful qualification logs and canonical archives are RETAINED for recovery. No Mac documentation/evidence file was created. E1 remains partial; E2 NOT_STARTED. No SQL, runtime rights/enrollment, provider data, deployment or new resources were changed.
