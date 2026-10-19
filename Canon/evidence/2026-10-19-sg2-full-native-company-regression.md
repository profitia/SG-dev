# Independent SG2 receiving regression for the full SRM company composition

Date: 2026-10-19. Project: SG2. TARGET_ENVIRONMENT=development; execution: isolated receiving source/CI. Task: `SG2-E1-FULL-NATIVE-COMPANY-REGRESSION-20261019`.

Authority base: `profitia/SG-dev/main` at `4c5e8286036307ed15a1ccedd49d1d5b2b582949`. Registered SRM producer dependency `ca17a2a8ad6bd4d1872bef52c772bbe5b720b48f` contains the full original sixteen-port company composition and separately owned original-MSR provenance correction. Producer task references are `SRM-E1-FULL-NATIVE-COMPANY-20261019` and `SRM-E1-MSR-CORPORATE-PROVENANCE-20261019`; their PMOS history is not copied into SG2.

## Receiving boundary

Actual dependency comparison confirms unchanged SG2 Runtime and Dashboard code, packages/locks, common SDK and governance/CI controllers relative to the authority base. This task changes only its own SG2 receipt and evidence. It does not adopt the SRM provider-acquisition engine in SG2 or activate a new endpoint. Common contracts remain framework-independent; the existing Runtime/Dashboard React compatibility and shared Supplier-summary tests remain required.

The producer's actual isolated tests cover cold/warm original reports, organisation/request-owned private history, current identity refusals, original MSR READY parsing/checksum, interrupted acquisition blocking without another purchase and private replay without duplicated history. They are producer evidence, not proof that SG2 has integrated the SRM acquisition flow or that either application has been deployed.

## Acceptance criteria and evidence status

The combined candidate must pass the existing exact-candidate trusted-main controlled CI policy, required public checks and independent exact-main Runtime/Dashboard/SRM source-proof verification. Actual tests, typechecks and builds must complete; a queued run, matching SHA, package version or producer's green tests do not establish receiving acceptance. Final run/artifact references and canonical closeout are recorded only after independent verification. This document is a source candidate and makes no claim that those pending checks have already passed.

No registry credential is read/copied locally, no trusted-branch prefix or package-controller rule is changed, and no existing application code is altered to manufacture a proof. Existing historical receipts retain their values. No SQL/role/grant/cloud configuration/data/resource change, Maps mutation, provider purchase, product deployment, live account acceptance or business UAT occurs in this receiving task. Development release and full E1 remain in progress; Staging/Production are not deployed.

Own SG2 Development PMOS, required MEMOROS and PHR apply. Canonical completion requires independent readback of this task's own database identity, archive/integrity, lifecycle, delivery, remote PHR authority and cleared pending slot/locks. SRM's disabled MEMOROS is not reported as delivered.

## Follow-up MSR replay receiving scope

The first exact source acceptance was main `505a23800fbd8a74f40a5a1e1947f3b2a62093bc` through PR544/545, with verified controlled and main Runtime/Dashboard/SRM artifacts. The same still-open receiving task now additionally references replay correction 1e71fe15c5b6290a2e7fc3ebfcf83345aed385d1 from the same SRM producer task. Initial source references and historical fingerprints are preserved.

The producer's completed-MSR replay now compares original financial facts as typed durable values, accepting identical provenance and refusing changed/unknown/duplicated facts. Actual follow-up local validation passes65 focused,225 native,553 product and311 promotion tests, zero skips, plus types and build. The original financial-only Source projection is distinguished from a new provider purchase or customer quota charge; repeated exact cache publication is idempotent. No SG2 application, common package, UI, SQL or CI policy is changed by this follow-up. Updated exact-candidate and accepted-main receiving proof and canonical continuity remain required; earlier source artifacts are not reused as proof of the new commit. Full E1 and Development release remain in progress.
