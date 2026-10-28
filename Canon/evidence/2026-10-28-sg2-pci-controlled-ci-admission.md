# SG2 PCI controlled-CI local package admission

Task: ARCHITECTURE-SG2-PCI-CONTROLLED-CI-ADMISSION-20261028.
Consumer: SG2-INTEGRATED-BENCHMARK-TO-PCI-DEVELOPMENT-20261028.

The native PCI consumer needs the already registered public package `@profitia/sg2-price-change-index-ui` at exactly `file:../../packages/sg2-price-change-index-ui`. The trusted-main controller previously rejected that declared dependency. This change adds that one closed name/path binding. It adds no credential, registry, workflow, candidate-path or deployment admission. All existing registry/SRI pins, manifest, local-source identity/version, symlink, lifecycle and negative tests remain in force and run for this fourth package.

PMOS begin and require-begin preflight passed in the dedicated ARCHITECTURE workspace with its registered ordinary continuity role. No product source, data/schema, Render setting or migration changed. No main merge or deployment performed.

The governance PR itself is reviewed with public checks; it must not be admitted through a privileged candidate execution of its own controller. After separate owner approval and protected merge, the existing trusted-main workflow can validate an exact SG2 consumer SHA. This admission alone is not consumer acceptance or release approval.

Validation: `node --test scripts/governance/controlled-package-ci.test.mjs` passed 86/86, including all existing negative tests, all four package-source/lifecycle cases and the unchanged private-install phase.
