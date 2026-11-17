# Assistant Quality Stage1 — exact G1 CI admission proposal

Status: PROPOSED_NOT_ACTIVE / OWNER_CI_POLICY_ACCEPTANCE_PENDING. Date: 2026-11-12, Europe/Warsaw. Profile: ARCHITECTURE / Development. Task: ARCH-CIC-QUALITY-STAGE1-CI-20261112.

## Problem and bounded change

The owner commissioned Stage1 of PDR revision8; Stage2 remains excluded. G1 candidate [PR1042](https://github.com/profitia/SG-dev/pull/1042), source `339b948c744d0b6785550c8d1da7100dc8090906`, base `df2214265e577ef653c35fa18a38c717ffe8905e`, is five governance/design files. Existing privileged CI accepts only previously reviewed source closures and cannot yet issue the required controlled proof for this new closure. The current policy is not bypassed.

This four-file proposal adds exactly one closed review to the trusted controller plus negative tests, this evidence and the existing integration runbook. No workflow, Environment, token scope, SDK/runtime/package source, historical receipt, database or provider configuration changes. The only proposed credentialed operation is the existing isolated SG2 tests/typecheck/build with fixed private package pins and credentials removed before candidate code executes.

## Exact reviewed G1 manifest

| File | Git blob SHA | Status | Mode |
| --- | --- | --- | --- |
| `Canon/evidence/2026-11-12-assistant-quality-stage1-g1-onboarding.md` | `88dd3b27b62db99d438a74a5d216fca2c198e346` | added | 100644 |
| `Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md` | `f0c81253cd20d4f2b75f8eabf2adb47d538c20fc` | added | 100644 |
| `Canon/registries/architecture-onboarding-v1.json` | `a7602a4e5d48f834f8ed2eeb0ace791bb896e825` | modified | 100644 |
| `Canon/registries/current-architecture-baseline-v1.json` | `fd2df1356f9a1260d72b3db81edac14128ba514c` | modified | 100644 |
| `scripts/governance/assistant-quality-routing.test.mjs` | `bb837bbb47ad3e573a2071db9d7e92734270b4ed` | added | 100644 |

All five paths resolve to their existing Governance Source Layer owner in ARCHITECTURE. This review does not admit the future QA package or executor workflow. PR/branch identity, uniqueness, statuses, regular file modes, no symlink/rename, actual checkout bytes, current main and exact expected HEAD remain required. Changed, omitted, duplicated or additional files fail closed. A main refresh cannot silently change any reviewed blob.

## Decision needed and continuation

The controller owner must explicitly accept this exact CI-policy proposal before activation or privileged bootstrap. It authorizes only validation of the five-file G1 candidate through the existing trusted-main CI path; it is not a new QA data/service grant or permission to create infrastructure.

After acceptance: validate this policy bootstrap through existing main, require public and controlled checks, accept policy on main, independently verify, run exact proof for PR1042, require its remaining checks, then accept G1 and continue the already commissioned Stage1 implementation. Stage1 is not complete at any of these source checkpoints. No Stage2 execution follows.
