# Existing Maps consumer — platform1.19 compatibility, 2026-10-19

Logical owner: Maps Capability; execution profile SRM, Development.
Task: `SRM-E1-MAPS-PLATFORM-119-COMPATIBILITY-20261019`.
Producer: ARCHITECTURE PR528, task
`ARCHITECTURE-E1-DELEGATED-PRIVATE-INSPECTION-20261019`,
source `6260afa8771fbb427bd0b8e359557ab8f70dd9b5`.

The existing standalone Maps embed consumes the framework-neutral public read
channel. Its exact platform1.18 peer pin is now the closed pair
`1.18.0 || 1.19.0`; no untested future version range is admitted. The Maps lock
accepts actual platform1.19 and the receiving record pins the three unchanged
channel source/declaration files, producer identity and existing wire contract.
The installed actual package and peer metadata are verified by a new source test.

Observed isolated validation:

- Original Maps/platform1.18 source from main baseline
  `2f5d968c24f3e5db4905ee63c061ed646b7d2a5f`: clean local public install and
  11 functional tests PASS, 0 FAIL, 0 skipped.
- Current platform1.19: clean local public install, working-source build and
  12 tests PASS, 0 FAIL, 0 skipped. The extra test verifies exact source acceptance;
  the original host/channel/provider/HTTP boundary tests are preserved.

The archived baseline fixture had no Git metadata, so its build stopped at
`git rev-parse HEAD`; no baseline build/artifact provenance is claimed. Actual
baseline functional tests passed. The current build runs in the real checkout;
its precommit output is test evidence, not a clean committed release artifact
or Last Known Good. Actual combined-candidate/main CI remains required.

No map rendering, host callback, public contract, provider adapter, SDK behavior,
configuration, credential, Google quota, private database or deployment changed.
Tests use synthetic provider responses and local HTTP; they do not call Google.
The service remains independently owned and no Maps UI is mounted in SRM.
Organization-owned location persistence, private operations and Supplier
inspection are explicitly NOT_ADOPTED. They require their own authorized product
task, current E1 authority and acceptance. Google project identity never becomes
an organization identity.

This receiving task resolves a package compatibility dependency of E1; it does
not expand the separately authorized Maps feature scope, authorize a rollout or
claim E1 completion. PMOS/PHR and actual remote source/CI acceptance require
independent closeout verification. Existing environments and old demo ownership
are preserved.
