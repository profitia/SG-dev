# Existing Maps package admission in controlled CI

Task: `SG2-MAPS-CI-ADMISSION-B-20261031`, SG2 / Development.

The owner explicitly approved this bounded policy change in chat `01a191a0-2d7a-7471-ba66-44821503a9b5` on 2026-10-31, after Codex A handed off the cache/backend work at `82e73ccd47870e5ed4f7e47210e5056c301078ef`. The approval covers controlled validation of PR #834; it grants no deployment permission.

PR #834 adopts existing `@profitia/maps-embed` 0.1.2 and `@profitia/maps-contracts` 0.1.0 through exact local file dependencies. The trusted controller previously rejected their names. MapsEmbed also declares MapsContracts and Platform Contracts as peers using its existing exact specifications. Adding package names alone does not admit those peer declarations.

The policy admits the two exact local paths and a peer exception limited to MapsEmbed 0.1.2, its top-level installed lock entry, the `peerDependencies` section, and the two current literal peer values. Source manifests additionally require matching trusted package name, version and peer value. App dependencies remain exact file paths. Other packages, versions, sections, wildcard peers, aliases, nested installs and substituted paths are rejected.

Private package pins, registry configuration, credential removal, lifecycle separation, trusted main/environment identity, frozen producer admissions, actual source checks and exact candidate-SHA proof remain required. This change does not modify MapsRuntime, Google configuration, E1, Clerk, RLS, databases or product code.

The original 16-case proposal dry run passed before approval. The local implementation passed all 110 controller tests, all 19 governance tests, and the 16 checks against the actual frozen PR #834 manifest, lock and isolated package sources. The controller suite includes negative policy cases, real local lifecycle fixtures, credential fences and exact-SHA proof checks. No test was skipped. The first governance run exposed a missing read-only PCOS subtree in the sparse checkout; restoring that source subtree made the unchanged test pass. Remote CI and exact final candidate proof remain required. Results and immutable source references are recorded in the task closeout and PR.

Publication must preserve the concurrent ARCH PR #831 repin. Main is held until that owner publishes; this proposal must then integrate the resulting main and repeat its checks before coordinated merge. A changed controller digest invalidates older controlled proofs. PR #832/#834 remain separate product candidates; neither is deployed by this CI change.

Local integration includes main `b04d5276e7d7d2bdeeebf5ed09c650ba61d6e44a` / PR #838. Its approved PR #831 source `b2b52c6a61ab3c3882f60ab5033670046715a5bc` and nine-blob admission remain unchanged. The integrated candidate passed the complete combined controller/governance run: 129 tests, zero failures or skips. Its publication to the shared controller remains held until ARCH completes the exact-source proof under the current main digest and Codex A confirms the CI window.
