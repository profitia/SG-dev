# Oil report E1 — closed CI and coordinated source proposal

Status: PROPOSED / OWNER_ACCEPTANCE_REQUIRED. Task:
ARCH-OIL-E1-REPORT-ADOPTION-20261109. This is a source proposal, not a new canon.

The current main controller rejects Architecture PR925 optional authority/lab/
matrix paths (ARCHITECTURE_PATH_REJECTED) and existing PR923's feat namespace.
Its local package catalog lacks four required packages. Ordinary partial PR
checks also cannot accept half the producer/consumer digest transition.

The proposal changes only these existing control surfaces:

- scripts/governance/controlled-package-ci.mjs
- scripts/governance/controlled-package-ci.test.mjs
- Canon/runbooks/shared-development-contract-integration-v1.md
- this evidence record

It binds the93-file composite identified in the runbook and OIL_REPORT_E1_REVIEW.
Source inputs retain their owners and exact commits: PR9254809359af22b854cf393aca22b8f731711297625;
PR923fdc4395b11e2d67be04609c6097f6ce8ab45d345;
PR9273167a7d26efbb39cf6a3f149ba841113453a52db.
Only the identical reviewed source versions can survive a main refresh.

Validation uses the existing controller tests plus negative cases for wrong PR,
branch, author, fork, SHA, file/blob/status/mode, renamed/duplicate/extra files,
unreviewed optional peers and self-declared local manifest authority. The exact
local composite passed package/manifest/source and regular-file checkout checks
under this proposed policy. This does not mean active main accepts it.

The complete old SDK/consumer history is verified before the predecessor view is
used. Local combined operation/peer tamper checks passed15/15; the targeted
Source Hub metadata checks passed9/9. Source SQL tests and the domain runner use
isolated PostgreSQL only. No provider credential, paid request, runtime grant,
Neon migration, Render change or deployment was performed for these validations.

Owner acceptance is still required for this CI-policy change and coordinated
publication procedure. Required exact-head controlled proof, all ordinary owner
CI and the subsequent exact SOURCE GO are retained. No source/runtime success
is inferred from this proposal or its preparation.


## Concurrent main refresh — SourceHub1.5 (2026-11-09)

The owner accepted the original packet5a5968eaf46e96c3343ed2b25a693d8beb7e6f57f8daea368713f14240ac27b8
and policy sourcedbca1516bf4a104c338e35b439e1af50c245dda6. That decision remains
recorded and is not represented as activation of a different source version.

While the decision was pending, accepted SourceHub PR929 advanced main to
f77cde55bab9adb130a79754929a5ee03b3d508b and its contract package to1.5.0.
A normal main merge preserves that work. The original current-source policy test
correctly rejected the new optional peer version; it was not skipped. The bounded
refresh recognizes only1.4.0 and1.5.0 with the same exact existing peer range;
1.6.0 and broader peer ranges remain rejected. No provider family, E1 grant,
credential scope or runtime is activated.

The refreshed local composite is63f464be456c54a382f99edd6808e333513236d0, tree
c4d61019f6b12d38d81e9f6611c895901d121f0a. Inputs: PR925 397ff306b7b32ed175da59e6b417a6c96ce84fc8; PR923 8643ff2d0a90d15b74320be79dc11cbb50dfea0c; PR927 6f7d5f8b6aedcd750d22cb0b6f86d43a2c5230d1.
All93 paths, statuses, modes and owners are identical to the original review;
only five reviewed blobs change: the two Insights/SG dependency locks, the two
SG2/SRM compatibility records and the shared historical-source test. The latter
preserves the full accepted PR929 schedule closure and the immutable old receipt.
The report still uses commodity protocol1.1.0; it does not opt into schedules1.2.0.

This refresh is a reviewable amendment, not an assertion that the original exact
packet approved new hashes. Required CI must pass before controlled source
adoption, and the final feature SOURCE GO remains separate.


## Lab history compatibility correction — proposed closed94-file review

The original93-file review remains historical. The updated exact review adds only
apps/architecture-lab/test/sdk-compatibility.test.mjs under Architecture Platform /
ARCH-BASE-002. It incorporates the separate SourceHub owner repair PR930 source
c3592a012c328216844cc9747f436a258ecdb53e and validates the five immutable,
explicitly reviewed Oil successor digests without rewriting SDK1.33/1.34 receipts.
The shared lab/foundation tests pass14/14, including negative cases for changed
metadata, source and predecessor records.

The new local-only composite is91dfa48a4b97c0476cb4fd39875347a6d970c0e4, tree
943c513b8d74393504353f0d48042ae663b1e288. PR925 source is
00ddd847b9e600514b45fabb02189cf4f6d9dbec; PR923/927 remain the SourceHub1.5
compatibility inputs above. All original93 path/status/mode/owner bindings remain;
this is one additional exact test path, not general lab-path admission.

Current main has the PR929 historical-test regression. The SG2 controlled component
for the previous policy revision passed1395 tests, typecheck and build in run
42687244892, but the whole run failed. It is not accepted as a valid canonical
proof. PR930 repair and the policy refresh remain unadopted; no failing-run proof,
owner decision, PMOS entry or component result replaces the required CI gates.
The final feature SOURCE GO and every installation/release/cost boundary remain.
