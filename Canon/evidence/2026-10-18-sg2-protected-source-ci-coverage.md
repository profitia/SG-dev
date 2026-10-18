# SG2 E1 — protected source CI trigger coverage

Status: SOURCE_CANDIDATE_NOT_DEPLOYED. Date: 2026-10-18 Europe/Warsaw. Task `SG2-E1-PROTECTED-SOURCE-CI-COVERAGE-20261018`, SG2 / SG-dev / local / TARGET_ENVIRONMENT=development, authority `profitia/SG-dev/main`; base `ff70cc3d21acba3f0a3eb901ead278c0df81e9c4` after PR #459. Three exact targets passed before/begin/require-begin routing, provider and governance checks. The shared CI/governance surfaces explicitly allow SG2; the profile is chosen for protected-consumer validation rather than inferred from a directory name.

## Confirmed gap and change

PR #459 required explicit workflow dispatches because changes to its stored-market reader and integration test did not match the existing automatic platform CI path filters. A new guard evaluated the actual trigger lists against **928 tracked files in six current consumer/shared-module trees** and found **598 omissions** in each event. These are missing path matches, not 598 unprotected product functions or failed business tests.

Both pull_request and main-push filters now cover the whole existing SG Runtime and SRM trees, plus the reused `packages/srm-xray` module. Existing platform-contracts, laboratory, dashboard, registry, workflow and controller triggers are retained. The architecture environment topology is also explicitly included because it is a direct control-policy digest input; its omission was independently reproduced before adding that match.

The new dependency-free node:test guard reads the workflow's constrained quoted path-list syntax and actual git-tracked files. It verifies both event lists, control/self inputs and main-only push scope, and refuses an expansion into unrelated PMOS/PCOS/Vector/evidence or similarly named application roots. It runs in the existing public producer governance-test step. It is a test helper for the existing exact/subtree/basename-prefix forms, not an additional runtime policy engine or general YAML loader.

The existing privileged validation phase, owner/internal-candidate rules, main-only Environment admission, token scope, fixed package pins, action pins, checkout behavior, credential removal, controller implementation and deployment behavior are unchanged. The controlled-sg2 block and main-only policy probe remain byte-identical. Public PR validation gains path coverage; package-credential validation still requires the existing trusted main mechanism. No credential is made available to a PR by these filters.

## Validation and policy provenance

- The first real coverage run failed for both events on the omitted tracked sources. After filter correction all four coverage tests passed. Adding the missing direct policy-registry input reproduced one further failure, then passed after its explicit filter was added.
- The final combined governance, workspace, controlled-CI and coverage suite passed **41 tests**, with no failures, cancellations or skips. It includes the four new coverage tests and existing negative cases for profiles, environments, provider drift, package policy, trusted branches and proof provenance.
- No application code, dependency, lock file, database role/grant, data, configuration or feature flag changed. Full exact-source controlled/public/dashboard/application builds and merged-main acceptance remain publication requirements and are recorded in the canonical closeout.

The existing proof policy hashes the workflow as well as its controller and architecture topology. Therefore this workflow change legitimately changes its digest:

| Authority | Digest |
| --- | --- |
| Pre-merge authority | `c08bc30b90ad0e289bff6c9306920fc258a01bcd2e8625a309116884548987b7` |
| Candidate workflow policy | `f3b015a4d10117f0a8ebfee475dc4a17b6207f29b313feee16b631e5411b840c` |

An actual previously accepted sanitized proof from run 39080655663 was checked against its actual limited GitHub run metadata: it remains valid under its historical authority and is rejected by the new policy with CONTROL_POLICY_PROVENANCE_MISMATCH. This is a pure validator test, not a current-release approval. Pre-merge candidate proof must bind the actual trusted authority that executed it; merged-main proof must bind the actual new main policy. Historical records are preserved.

## Boundaries

The guard establishes declared filter coverage in these six source trees and control inputs. Actual GitHub run status and exact-source proofs still require verification; a matching path is not evidence of a completed workflow. Existing product auto-deploy settings and Staging owner-review rules remain unchanged. No project, service, token, access policy, product deployment, Staging or Production resource was created or changed.

Whole E1 remains in progress. Forecast source initialization, remaining entrances/effects/jobs/cache/files, live login/application transport, recovery and controlled Development then Staging releases require their own evidence. E2–E4 remain outside this task.
