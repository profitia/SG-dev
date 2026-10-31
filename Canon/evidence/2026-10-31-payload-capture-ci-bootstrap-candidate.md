# Payload capture: exact CI admission candidate

Task: ARCHITECTURE-PAYLOAD-CAPTURE-CI-BOOTSTRAP-CANDIDATE-20261031.
Profile: ARCHITECTURE; target Development; execution local.
Status: DRAFT_ONLY / OWNER_DECISION_PENDING / SOURCE_GO_NOT_GRANTED.
Prepared against a921dfc23d1e72ea10750993515fb6c41f0bd90b; before publication,
refreshed authority9c568135948f9057c3ebbcab5da633cceafdec02 includes parallel
SRM PR826. Only SRM paths changed upstream; controller, routing and SDK remain
identical. The isolated draft preserves that work and changes only its own four
paths. The exact producer HEAD and ten pins remain unchanged.

## Concrete blocker and requested review

The separately registered producer publication PR827 has exact HEAD
9d44684b968ca3a067d414f7c450b6016ecc8d19 and ten added files. Its public
Architecture job124370001338 passed1676 contract/lab tests and123 governance
tests; SRM operation integration also passed. Trusted-main run41145703530,
job124370183550, rejected admission with ARCHITECTURE_PATH_REJECTED before
candidate installation. Public SG2 exact-proof verification consequently failed.
This is an actual admission refusal, not a failed package test or missing new
credential. The PR remains unmerged and has no SOURCE_GO.

The delegated scope permits only preparation of this minimal candidate using
the existing PR817/818 bootstrap pattern: positive/negative tests and a normal
draft PR for one owner review. It explicitly excludes merge, changing active
main controller/policy, new access and deployment before the owner decision.
This task does not reopen or broaden that authority.

## Proposed exact closure

PAYLOAD_CAPTURE_PRODUCER_REVIEW pins PR827, branch
architecture/payload-capture-source-publication-20261031, the exact HEAD above
and the ten added blobs below. Unlike older classes, even a technical rebase
with the same blobs requires a new review because this closure pins the HEAD.

| Exact source path | Git blob SHA |
| --- | --- |
| `Canon/evidence/2026-10-31-payload-capture-candidate.md` | `0287f2d237c64d6b1ec76d27e6e02c51105e905d` |
| `Canon/evidence/2026-10-31-payload-capture-source-publication.md` | `f7ad9ae50fa0221d8f3c153f4c3ebe125538d6e1` |
| `apps/architecture-lab/payload-capture-candidate.json` | `4e04c1305a43fff5e9e2d1e8bb14eebc0da92a3a` |
| `apps/architecture-lab/test/payload-capture-publication.test.mjs` | `a7422730f1119d340ea03e47a36334a969855c5b` |
| `packages/platform-contracts/payload-capture/package.json` | `1824149cfba8909aa20a94656188a9ed3cff862f` |
| `packages/platform-contracts/payload-capture/src/payload-capture.d.mts` | `34c108584d6981e2d848320a20869f7510b6e1ad` |
| `packages/platform-contracts/payload-capture/src/payload-capture.mjs` | `d657a5660b6e0989121321d443d16f4b9b04d797` |
| `packages/platform-contracts/payload-capture/test/benchmark.mjs` | `529282e609ad6c6446c44f5c6029570550a03b1b` |
| `packages/platform-contracts/payload-capture/test/payload-capture.test.mjs` | `190044c554605316bf8d66d997df17b2fbca0d92` |
| `packages/platform-contracts/payload-capture/test/public-package.test.mjs` | `9d7ba3a4f6d7f5e2a44323b3e83627e9e5f3d0cf` |

Only that complete set receives the closed review; all other optional package,
lab, workflow and application paths retain existing rules. Both lab files still
resolve to Architecture Platform, while evidence resolves to Governance Source
Layer; routing must remain ARCHITECTURE/ALIGNED. No new generic path pattern,
project identity, resource, private package source or product receipt is added.

The candidate changes exactly four Governance Source Layer paths: the existing
controller and its tests, the existing controlled-package runbook, and this dated
receipt. It contains no producer package, SDK1.33 candidate, application, workflow,
registry, SQL, role, secret or environment changes. The documented sg2/ bootstrap
namespace is transport only; the owner profile and PMOS remain ARCHITECTURE.

## Verification performed

- Focused controller/path coverage:103/103 PASS, zero skips.
- All governance tests:330/330 PASS, zero skips.
- Actual PR827 metadata and all ten blob hashes independently match the local
  immutable Git objects. The proposed selector accepts only the pinned identity.
- A disposable local Git checkout of only those ten actual files passes the
  existing complete diff/tree/blob/regular-file checks. Altered content and a
  symlink are refused, with the checkout then removed.
- Negative tests cover each changed/missing/duplicate/modified/removed/renamed/
  copied file, every extra or substituted path, changed HEAD/PR/branch, owner,
  repository, main/actor/workflow, routing/ALIGNED, missing API and metadata races.
- Existing old-class, private-package, credential separation, proof-digest and
  checkout security tests remain green. No remote provider or database input is
  used by these tests. No protected CI dispatch is represented as completed.

Public draft CI results and the exact draft SHA are recorded in canonical
PMOS/PHR after publication. Local tests are not a trusted-main controlled proof,
activation, producer SOURCE_GO, SRM adoption, deployment or live performance test.

## Conditional sequence after owner decision

No next step is automatically authorised by this draft. If the owner separately
accepts the exact scope, the existing process can validate the exact bootstrap
with the old trusted main, verify all required checks, merge only that policy
candidate and re-read main. The changed policy digest requires fresh controlled
CI/proof for the unchanged exact PR827, followed by its public verifier and
formal producer SOURCE_GO. A changed producer HEAD invalidates this candidate.
No reuse of PR817 proof or change of the producer branch namespace is allowed.

SRM adoption/full mapped Financial replay remains a separate receiver task.
Existing SDK1.32.3 and all running environments remain unchanged. No FRESH≤6s
or READY result is claimed. Before activation the draft can simply be closed;
a separately approved activation can later be reversed through a reviewed
revert of only this class, without data, secret or infrastructure changes.
