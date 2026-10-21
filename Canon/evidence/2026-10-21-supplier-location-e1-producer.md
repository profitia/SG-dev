# Supplier Location E1 producer and controlled CI — 2026-10-21

Task `ARCHITECTURE-SUPPLIER-LOCATIONS-E1-CI-20261021`; ARCHITECTURE / Development, local isolated workspace, PMOS `architecture_pmos` in `billowing-credit-07394675`, ordinary continuity role `architecture_pmos_runtime`. MEMOROS is disabled by profile.

## Result and publication boundary

The trusted CI correction is merged in [PR592](https://github.com/profitia/SG-dev/pull/592), main `77f68f8e90e28551d03b9b4a11b75dc71b8c3ed8`. The unchanged SRM design [PR590](https://github.com/profitia/SG-dev/pull/590), exact HEAD `69fabecafce9712e7cbe6f41bc363885d897f6f0`, now has a genuine controlled SG2 proof from trusted main. It is still Draft, not merged or adopted.

The E1 producer is [Draft PR594](https://github.com/profitia/SG-dev/pull/594), implementation source `88c3337d943fa3893f2f357bb11b78c565e50047`. Package `1.24.0`, contract `profitia.operation-context/1.0.0`, implementation `1.0.0-candidate.16`, catalogue1.3.0. Exact static eight-file source digest: `9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728`. SQL019 digest: `34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5`. The checked-in dependency JSON identifies immutable implementation bytes; later evidence-only commits do not change those digests.

**TASK_STATUS=PARTIAL; E1_PRODUCER_SOURCE=CANDIDATE_ONLY; INSTALLATION=SOURCE_ONLY.** Existing consumer receipts pin candidate15; existing SG2 lock pins the prior local package. The unchanged CI correctly rejects this candidate until separate SG2/SRM adoption. Canon/runbooks/shared-development-contract-integration-v1.md requires matching accepted digests for publication. No product-owned source or receipt was modified, no failing check was skipped and this producer must not merge yet. TASK02 dependency is CONDITIONAL.

## Implemented operation contract

| Operation | Effect/resource | Enforcement |
|---|---|---|
| supplier.location.read | READ / organisation-private collection | Verified current HUMAN, exact organisation/supplier metadata, explicit permission/product/module, current MGBI/KYS source reads, COMPANY/private retention, protected audit; no creator-only filter |
| supplier.location.write | WRITE / manual organisation-private location | CREATE/UPDATE/DEACTIVATE, server-assigned create ID, source-origin exclusion, exact existing version, same finite local-command request ledger, payload-conflict/idempotent replay, atomic audit; no geocoding |
| supplier.location.sync | REQUEST_COMPUTE / audited request | Exact accepted source IDs/versions, current source rights, no report purchase, same durable request/delegation/native-work primitives; SERVICE actor retains initiating HUMAN |
| supplier.location.geocode | REQUEST_EXTERNAL / audited request | Exact location/address version, approved executor, explicit rights and finite Root policy; Source/provider budget remains independent, default zero, existing PLAN/ATTEMPT/SETTLE and uncertain delivery prevent blind paid retry |

The new supplier-location module validates closed technical evidence inside the existing executor; it is not an identity system, authorizer, private gateway or parallel queue. User IDs are creator/editor audit attributes; organisation owns locations. No default grant, role elevation, source permission, automatic paid policy, product location table or new service is created. Historical migrations001–018 and their receipts are unchanged.

The receiving domain must still resolve actual accepted source records and composite organisation/supplier/location association, enforce current origin and version in its transactional writer, persist creator/last-editor separately, and recheck domain/source/address versions before transmission and accepting results. Technical descriptors cannot prove existence in an unimplemented product schema. Google transport itself was not executed or configured here.

## Verification

- Full actual producer/laboratory suite: **1268 pass / 0 fail / 0 skip**, including real ordinary-role PostgreSQL, previous operation compatibility, real local synthetic Source HTTP/native uncertainty and audit rollback tests. Synthetic data only; no external provider or product DB.
- Focused location unit/SQL/types suite: **97 pass / 0 fail / 0 skip** (subset). Covers organisation sharing, second organisation with same supplier, revoked membership, explicit rights, manual source exclusion, absent records, stale versions, changed idempotency payload, exact source versions, KYS COMPANY/retention/grant revocation, wrong executor, actual SERVICE/human separation and SQL019 rollback/immutable FORCE RLS.
- Package build and producer type fixtures: PASS. Canon manifest and full execution preflight: PASS.
- Controlled policy at its exact precursor: **44 pass / 0 fail / 0 skip**. Governance core/workspace tests: 24 pass / 0 fail / 0 skip. On the producer candidate, unchanged combined governance/provenance tests: **66 pass / 2 fail / 0 skip**, intentionally blocking local package version and candidate15 receipt drift. This is not green consumer acceptance.
- Existing E0 adoption tests: SRM2/2 and SG2 2/2 PASS; E0 does not establish E1 adoption. Existing candidate15 SG2 real API/ordinary SQL/tests/types/build passed remotely in the exact PR590 proof. SRM candidate15 API/ordinary SQL/types/build passed in its PR workflow. New candidate16 acceptance remains pending, so both new consumer compatibility verdicts are PARTIAL. Maps connector CI run39612866867 also correctly refuses the package1.24.0 candidate against its existing1.23.0 acceptance (11 pass / 1 fail / 0 skip); its existing dependency/lock and acceptance require a separate SRM-owned task. No Maps tests or receipts were changed.
- Earlier local runs exposed outdated test-only version/digest pins and an invalid membership fixture status; corrected within producer/laboratory tests. Restricted sandbox loopback failures were rerun on the same isolated test cluster with permitted loopback access. No security assertion was weakened.

## Controlled CI security and exact proof

The merged policy admits only nonempty `sg2/`, `srm/`, `architecture/` internal owner PRs to main. Owner, internal repo, exact SHA, trusted main controller, approved package names/pins/manifests/locks, main-only Environment and credential scope/expiry remain enforced. No privileged candidate code runs while registry credentials exist. Static provenance layouts preserve candidates1–14 (two files),15 (five files) and add16 (eight fixed files), reject17+, missing/substituted/symlink/oversized files and candidate-selected hashing rules.

[Actual PR590 controlled run](https://github.com/profitia/SG-dev/actions/runs/39611811505), [job119262328417](https://github.com/profitia/SG-dev/actions/runs/39611811505/job/119262328417): SUCCESS. Candidate `69fabecafce9712e7cbe6f41bc363885d897f6f0`, control `77f68f8e90e28551d03b9b4a11b75dc71b8c3ed8`, policy digest `bc8ddaa1af9db57e27425c1c48b831e8df14c4e43ec34786f64cba6ab59f49df`; candidate15 source digest `6f202f931faa0df8ac07d5134a26d63cd6b6e35f0f1e2fb50870122060863900`. Artifact downloaded and independently checked against provider run/jobs and pinned Git source. Clean install ignores lifecycle scripts; credential removed before candidate tests, private package artifacts not published, no deployment.

[PR590 public verification attempt2](https://github.com/profitia/SG-dev/actions/runs/39600569409) verifies that proof without private package access. [Original policy precursor proof](https://github.com/profitia/SG-dev/actions/runs/39607596740) and [new-main integration](https://github.com/profitia/SG-dev/actions/runs/39611617661) are separate identities; no proof reuse across candidate SHAs or policy digests. One initial precursor dispatch used a mistyped SHA and was rejected; its corrected run is recorded, not relabelled as a planned negative test.

PR590 merge recommendation: **CONDITIONAL**. Its design and old producer remain unchanged and the CI admission blocker is resolved. It must continue declaring DESIGN_NOT_ADOPTED; TASK02 must explicitly consume the final accepted candidate16 producer and its exact current digests. The design's SQL019 filename is no longer a hypothetical reservation; this producer now supplies that optional source.

## Controlled installation and consumer handoff

1. Separate SG2 and SRM owner tasks accept implementation SHA/version/digests, update current installation/host/request/job/work references and local package locks, preserve immutable historical receipts, run full consumer suites/types/build and exact-SHA controlled CI. The existing Maps Runtime local dependency/lock and explicit package acceptance also require a separate SRM-owned update. No product source change is authorised through this Architecture task.
2. Before any real SQL019 installation, record verified LKG commit, artifact ID/digest, config version, migration state, reversible DB backup/snapshot/branch and executable rollback under separate explicit installation authority. Guard requires exact SQL017 and disabled application bindings, controlled NOLOGIN owner; use the existing transactional installation/receipt mechanism. Explicit minimal function grants and finite local policies only, then ordinary-role/revocation/audit readback before activation. No runtime auto-migration or broad table ACLs.
3. TASK02 implements org/supplier/location composite FKs and current row/source resolution, domain writer (version-qualified SQL, creator/editor fields, source/manual separation), deterministic accepted-source reconciliation/upserts and manual preservation. Report acceptance schedules bounded SYNC; re-display reads saved locations. Only admitted current source rows may be projected.
4. Separately adopt existing Maps executor and Source host. Exact approved executor/Source bindings, finite organisation/provider budgets, before-send and result-acceptance rechecks and uncertain-delivery fence are mandatory. Root admission or a map view never implicitly buys reports or geocodes.
5. No Google setting change is necessary for this source task. A future authorised executor must verify existing environment-specific Maps JavaScript keys/referrers and separate server geocoding credential/restrictions, owner-approved finite paid budget and applicable EEA retention/sharing. No reserved infrastructure action was performed.

No SRM/Maps consumer adoption, live SQL installation, product deployment, Staging/Production change or new infrastructure occurred. Architecture PMOS/PHR closeout is a separate canonical runtime receipt, with exact final evidence-only source HEAD and CI readback recorded at closeout; it is not fabricated in this source report.

## Exact changed paths

CI policy PR592:

- `.github/workflows/platform-contracts-ci.yml`
- `Canon/runbooks/controlled-package-ci-v1.md`
- `scripts/governance/controlled-package-ci.mjs`
- `scripts/governance/controlled-package-ci.test.mjs`

Producer implementation PR594:

- `Canon/registries/operation-access-matrix-v1.json`
- `Canon/v1.0-operation-context-and-access-contract.md`
- `apps/architecture-lab/test/request-continuation-postgres.test.mjs`
- `apps/architecture-lab/test/supplier-location-postgres.test.mjs`
- `packages/platform-contracts/migrations/access/019-supplier-location-operations.sql`
- `packages/platform-contracts/package-lock.json`
- `packages/platform-contracts/package.json`
- `packages/platform-contracts/src/delegated-job.d.mts`
- `packages/platform-contracts/src/delegated-job.mjs`
- `packages/platform-contracts/src/operation-context.d.mts`
- `packages/platform-contracts/src/operation-context.mjs`
- `packages/platform-contracts/src/private-operation-host.d.mts`
- `packages/platform-contracts/src/private-operation-host.mjs`
- `packages/platform-contracts/src/request-ledger.d.mts`
- `packages/platform-contracts/src/request-ledger.mjs`
- `packages/platform-contracts/src/request-operations.d.mts`
- `packages/platform-contracts/src/request-operations.mjs`
- `packages/platform-contracts/src/request-work.d.mts`
- `packages/platform-contracts/src/request-work.mjs`
- `packages/platform-contracts/src/supplier-location.d.mts`
- `packages/platform-contracts/src/supplier-location.mjs`
- `packages/platform-contracts/test/operation-context.test.mjs`
- `packages/platform-contracts/test/private-operation-host.test.mjs`
- `packages/platform-contracts/test/request-operations.test.mjs`
- `packages/platform-contracts/test/service-read.test.mjs`
- `packages/platform-contracts/test/supplier-location.test.mjs`
- `packages/platform-contracts/test/types/supplier-location.mts`

Evidence-only additions:

- `Canon/evidence/2026-10-21-supplier-location-e1-producer.md`
- `Canon/evidence/2026-10-21-supplier-location-e1-dependency.json`
