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
