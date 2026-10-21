# B1-CI-R — PR593 reconciliation with accepted main

Date: 2026-10-21. **ARCHITECTURE / SG-dev Architecture / development / local**. Task **ARCHITECTURE-IDENTITY-B1-CI-R-20261021**. Repository authority **profitia/SG-dev / origin/main**.

## Inputs and registration

- Accepted PR592 merge: **77f68f8e90e28551d03b9b4a11b75dc71b8c3ed8**. Both introduced commits verified: **8af53bca5476b0968f42131974ae5bf10ed94667** (three namespaces and runbook/workflow compatibility) and **d358490f7402ad6edb99d5d2d782480aa6c1e0a4** (fixed candidate16 provenance and tests).
- Existing draft PR593: original **69504e1de80ca12a41a9cfaa8fee0d48b114977d**, branch **architecture/identity-b1-ci-20261021**. No new PR is created; history is retained.
- B1 PR591 expected source **c92490fc6f91b66b8722a57928966afb2bf8c390**; remains untouched. Previous B1-CI PHR **ea48bed811136d7537a380a958cfb2e3703850f5** is historical and not rewritten.
- Own canonical begin **cmvibspri0000es46je7le252**, conversation **pmos-task-v2:25fc5018ffaa83df12f636dfa8429768fdffaece3cb7f213380b9102f29a39c1**, actual host **01a15aed-8d94-7fe0-9cff-c54f72b5f8a8**.

The explicit task selects ARCHITECTURE; the attached SG2 wrapper supplies common safeguards without switching continuity. Root AGENTS, active manifest, 33 ordered CORE/ARCHITECTURE documents and adapter were checked. All six declared paths resolve to Governance Source Layer, ALIGNED, ARCHITECTURE allowed. Own PMOS uses registered **billowing-credit-07394675 / architecture_pmos / architecture_pmos_runtime** and dedicated new checkout/artifacts/context/PHR clone. MEMOROS disabled. No product identity, organisation, data ownership/access or PII is changed; this is control-plane source reconciliation.

Full fail-closed preflight passed on clean accepted main, followed by own canonical begin and a full require-begin preflight. A separate worktree based on accepted main prepares the merge; source writes therefore use the current baseline. The merge retains accepted main and original PR593 as parents, then advances the existing corrective branch without rewriting its history. The previous worktree remains at its original source snapshot; its six continuity files are hash-checked before and after. No dirty/offline/skip-runtime bypass or whole-file ours/theirs selection is used.

## Exact target scope and conflicts

1. scripts/governance/controlled-package-ci.mjs
2. scripts/governance/controlled-package-ci.test.mjs
3. scripts/governance/controlled-package-ci-path-coverage.test.mjs
4. .github/workflows/platform-contracts-ci.yml
5. Canon/evidence/2026-10-21-architecture-candidate-controlled-ci.md — inherited unchanged historical source evidence.
6. Canon/evidence/2026-10-21-architecture-candidate-controlled-ci-reconciliation.md — this new evidence.

Conflicts occurred in three files: the controller's candidate identity selection, test imports/appended tests, and workflow candidate description. Each conflicting fragment was reconciled explicitly. The accepted runbook and original evidence are byte-identical to their respective source commits. No consumer, package implementation, receipt, registry, protected configuration or previous PMOS/PHR artifact changes.

## Combined behavior

- Preserve the accepted frozen namespace list `sg2/`, `srm/`, `architecture/`, nonempty suffix and all common owner/open internal PR/main/exact-SHA/trusted-workflow checks.
- SG2 and SRM retain their accepted no-producer-file-list selection and resolution behavior. Architecture adds the existing PR593 requirement for an actual complete GitHub file list, second metadata read, narrow platform-contracts/evidence scope and canonical trusted-main routing/owner/code state.
- Retain PR593's pinned Git diff/blob/content/regular-file checks, forbidden app/workflow/controller/registry/configuration changes, symlink/traversal/rename rejection and complete-list limits. Architecture's extra scope checks do not apply to SG2 or SRM.
- Preserve accepted historical provenance: candidates1–14 use two exact files; candidate15 uses five; candidate16 uses those five plus **src/supplier-location.mjs**, **src/supplier-location.d.mts**, **migrations/access/019-supplier-location-operations.sql**. The entire provenance function is byte-identical to accepted main. Unknown candidate17, downgrade, missing files, changed source identity and candidate-selected file layouts remain rejected.
- Retain the original environment, token scope/owner/finite lifetime, package pins/integrity, manifest/npm configuration, lifecycle-disabled credential install and credential-free execution/proof. Installation/proof/verification code and the privileged workflow job remain byte-identical to accepted main.
- Preserve PR593's eight trusted fingerprint inputs and matching workflow path coverage. The combined controller bytes produce a new policy digest; historical proof is not automatically accepted. Workflow description names SG2/SRM and bounded Architecture; mode validate-sg2 still means the consumer tested, not the candidate's governance profile.

The accepted common-prefix regression now supplies the required trusted file fixture for Architecture while retaining each original negative identity/trust case. Former Architecture tests that treated SRM as unsupported now use a genuinely unsupported feature prefix. SG2/SRM resolution tests explicitly confirm no producer-list request. Accepted candidate16 and all previous test cases are retained.

## Validation

- Controller plus workflow coverage **76/76 PASS**, no skipped tests.
- Complete governance/classifier suite **302/302 PASS**, no skipped tests; includes the controller suite, counts are not additive.
- Candidate15 and candidate16 exact layouts, modified/missing dependencies, downgrade/unknown layout and nonexecution of candidate source are exercised. Existing exact SHA/fork/main/environment/package/proof/credential tests and real synthetic npm lifecycle checks pass.
- Bounded Architecture actual-file ownership, metadata-race, Git diff/blob, hidden consumer change and symlink rejection pass; SG2/SRM continue to pass their accepted paths.
- Namespace definition, complete provenance function, credential/package/proof guard block, install/proof/verify implementation and privileged workflow block compare byte-for-byte with accepted main. Accepted runbook and original PR593 evidence preserved.
- Syntax, manifest and diff checks pass. Final exact source SHA, GitHub mergeability, complete public CI observations and canonical closeout receipts are recorded after the merge commit; this document does not predict their success.

Local tests are not a replacement for required CI. The corrective's own control-plane changes are deliberately outside bounded Architecture producer admission. No privileged workflow is dispatched against the unaccepted combined controller. A missing exact proof remains a real failed/unexecuted gate, never PASS.

## Owner review and later B1 validation

Owner reviews the updated existing draft PR593, its new exact SHA, diff against accepted main, no-conflict result and test/CI evidence. This task does not merge it. No B1 installation, B2, product migration or deployment follows automatically.

Only after separate acceptance and merge of PR593:

1. Refresh authority and verify the accepted source's ancestry, actual merge SHA and new control-policy digest. Do not assume source SHA equals merge SHA.
2. Independently read PR591 metadata. Require internal repository, open PR to main and the still-intended exact head. Current expected head is **c92490fc6f91b66b8722a57928966afb2bf8c390**. If it differs, stop for review rather than using a stale SHA.
3. Run the existing trusted-main workflow, only after those preconditions:

```sh
gh workflow run platform-contracts-ci.yml --repo profitia/SG-dev --ref main \
  -f mode=validate-sg2 -f candidate_pr=591 \
  -f expected_sha=c92490fc6f91b66b8722a57928966afb2bf8c390
```

4. Require actual complete successful producer and controlled SG2 execution. Read sg2-controlled-operation-proof: exact candidate, control source, run, contract and current digest; successful tests/typecheck/build, removed credential and no deployment/private-package artifacts. Reject a stale-policy proof.
5. Rerun the appropriate public PR591 checks only after the exact proof exists; confirm complete SG2/SRM compatibility and full CI. B1 review/merge/installation still require their separate authorization. No PR591 edit, source change or rerun occurs in this reconciliation task.

## Continuity and rollback

Canonical ARCHITECTURE closeout records the factual reconciliation outcome in a new task and reads persisted Flight Record/HANDOFF, immutable seals and PHR bundle/remote-main ancestry independently. Pending/file/advisory locks must be clear, followed by full final preflight. Previous B1-CI registration/snapshot/publication is preserved; no manual cleanup or replacement artifact.

Until owner merge, rollback means retaining the previous draft source commit, which remains in history. After a later accepted merge, any withdrawal is a separately reviewed normal source revert; preserve proof and continuity history. There is no data migration or product deployment to roll back here.
