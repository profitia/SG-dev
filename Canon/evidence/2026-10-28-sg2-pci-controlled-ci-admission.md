# SG2 PCI controlled-CI local package admission

Task: ARCHITECTURE-SG2-PCI-CONTROLLED-CI-ADMISSION-20261028.
Consumer: SG2-INTEGRATED-BENCHMARK-TO-PCI-DEVELOPMENT-20261028.

The native PCI consumer needs the already registered public package `@profitia/sg2-price-change-index-ui` at exactly `file:../../packages/sg2-price-change-index-ui`. The trusted-main controller previously rejected that declared dependency. This change adds that one closed name/path binding. It adds no credential, registry, workflow, candidate-path or deployment admission. All existing registry/SRI pins, manifest, local-source identity/version, symlink, lifecycle and negative tests remain in force and run for this fourth package.

PMOS begin and require-begin preflight passed in the dedicated ARCHITECTURE workspace with its registered ordinary continuity role. No product source, data/schema, Render setting or migration changed. No main merge or deployment performed.

The governance PR itself is reviewed with public checks; it must not be admitted through a privileged candidate execution of its own controller. After separate owner approval and protected merge, the existing trusted-main workflow can validate an exact SG2 consumer SHA. This admission alone is not consumer acceptance or release approval.

Validation: `node --test scripts/governance/controlled-package-ci.test.mjs` passed 86/86, including all existing negative tests, all four package-source/lifecycle cases and the unchanged private-install phase.

## Controlled source acceptance

The human owner approved only PR764 main admission, subject to all governance and protected-merge gates; PR765 merge/deployment and database migrations remain unapproved. Acceptance task: ARCHITECTURE-SG2-PCI-GOVERNANCE-ACCEPTANCE-20261028, with fresh PMOS begin and require-begin on current authority. Accepted AppShell/ADP/SRM source is preserved.

The existing runbook `Canon/runbooks/controlled-package-ci-v1.md` explicitly defines the `sg2/` bootstrap namespace for policy changes while profile, exact targets and continuity remain ARCHITECTURE. A validation-only transport PR carries exactly the SAME COMMIT as PR764. Its unchanged SG2 dependencies are tested by the OLD trusted-main controller; candidate controller code is never used in the credential phase. The proof binds the actual immutable candidate SHA and policy digest. Public PR764 verifies that exact proof. Only PR764 may be merged; the transport PR is closed unmerged. No candidate-path/credential/proof/environment guard is expanded.

The three-file scope remains the exact package-name/path map, controller tests and this evidence. Required public/controlled run IDs, source/merge identities and independent continuity readback are recorded in the final canonical handoff after actual completion; this document predicts no CI or merge success.
