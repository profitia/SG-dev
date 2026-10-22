# SRM TASK02-R — approved additive parent boundary and P1 receiver

Development SOURCE ONLY. No merge, live SQL, grant/key/binding, provider switch or deployment authority.

Direct human approval on2026-10-22 accepts Decision B of `P1B-remaining-source-v1` in PR609 at876e7e558466ad19c76446d5874286da8f429eac. New bounded SRM implementation registration: `SRM-SUPPLIER-LOCATIONS-P1B-RECEIVER-20261022`, `cmvjkf21a0000iwfiyjzjr4py`, conversation `pmos-task-v2:61dfafdd3da9f122dbe16d20419f31bb1acdec4ada356beb75da59fae67aa0ec`; actual host01a133ad-8739-7a21-ac6e-36f0a9bf8ed5. Profile SRM, workspace SG-dev Codespaces SRM, actual execution local, own srm_pmos. Parent TASK02-R remains open. Closed P1/P1-B/Maps/SG2 registrations are preserved.

Authority main418a2ef0f30d840ce25ca645f5ef047e35d02192; manifest3.28.0. This source inherits immutable P1 f35c82b6d9d39720c04b4df2c6f0042f5379982a and Maps owner e1901a4e0bcafe9392b9336c8cc140456ed4cede. Parallel accepted main updates c140/418a were integrated only after securing own changes; full clean and restored-source preflights PASS. No KRS source or provider selection is changed here.

Exact routed targets are the new SQL014, new supplier-location-admission adapter/test, existing SRM private host/location runtime/configuration, current operation receipt and local package lock, the operation/private-host/location tests, one peer-read fingerprint test and this evidence. SRM Runtime/ALIGNED; evidence Governance Source Layer with allowed SRM route. The extra peer-read test was routed and recorded before editing; the original begin input remains immutable. No new source under platform-contracts, Maps or SG2 is edited.

## Existing mechanism, real receiver

The SRM wrapper now forwards the accepted producer locationAdmission option. The existing host, E1 identity/access/module/product checks, signed admission and single intent/quota ledger are reused. Defaults without the optional port remain Root candidate16/host1.11. Explicit P1 uses candidate17/host1.12 and package1.25.0; producer bytes are unchanged.

Manual CREATE obtains its UUID from the producer port using the official authenticator, authoritative internal binding and current validated organisation scope. The writer then authenticates and locks again, and P1 recomputes/binds the ID under that transaction. This extra identity preparation grants no business permission. It avoids a fabricated HUMAN or mutation of a frozen request; actor/binding changes between phases fail closed.

The server-only adapter binds exact SQL020 plus the new receiver digest. It requires an explicit version and separate canonical32byte server key when real locations are enabled. The key is neither supplied by HTTP nor provisioned here. Missing/mismatched configuration or descriptors deny P1 writes. No alternative permission engine, local limiter or second business host is introduced.

## SQL014 and the actual parent lock

`apps/srm/db/private-store/014-supplier-location-admission-parent.sql` SHA256 **2a22a1962ab5f9a9cd8249c5816ac71b7916338d5c4ff6cb1f6a30d038381ef8**. Its explicit install chain is SQL019 → SQL020 + SRM013 → SRM014, controlled NOLOGIN owner, all applications disabled, exact prior digests. Installation metadata is immutable with FORCE RLS and PUBLIC revoked; the migration seeds no runtime ACL, grant, key, role or active binding.

The narrow parent reader checks the existing current E1 scope and action-specific authority, locks the actual org-scoped srm.suppliers row before collection/child reads, rechecks ownership/authority and returns exactly supplierId/organisationId/collectionId/version. A separate bounded metadata helper exposes only existence/origin/versions for readResources before a CREATE proof. No address/body or arbitrary SELECT/DML is returned. First CREATE works when the collection row does not yet exist.

Actual PostgreSQL testing exposed an additional receiver detail: SELECT FOR UPDATE applies UPDATE visibility, and the existing inspected_update_fence deliberately denied the controlled definer. SQL014 therefore adds an owner-only, current E1 scope lock policy and appends only its visibility to that fence. **Both original restrictive WITH CHECK expressions remain byte-identical**, verified by actual pg_policies readback. Ordinary-role predicates and existing INSERT/DELETE behavior are unchanged; no owner business write is enabled by this lock bridge. Existing SQL001–013 and producer SQL001–019 remain byte-identical.

## Permissions, identity and retained source behavior

Parent WRITE authorises CREATE only. Collection READ remains separate; UPDATE/DEACTIVATE need an explicit exact-child WRITE grant and CAS. Creation does not grant edit access. Test fixtures use a controlled operator for explicit child grants, including the later geocoding test point. Organisation owns manual points, with actual creator/editor attribution; other admitted members see the same records. Current/revoked identity, membership, module, product and grant checks remain E1-owned.

The single SQL020 ledger supplies100 WRITE and100 SYNC per organisation in rolling24h, shared across users/allowed executors. Accepted replay costs0; new accepted source version costs1; rollback costs0. Policies cannot reset the window by rotation. Source sync uses already accepted MGBI/KYS evidence, preserves manual points, source identity, current KYS rights/retention and coordinate lifetime. No KRS evidence is relabelled as MGBI. Paid geocoding remains ZERO and deferred.

## Validation evidence and repeatability

Actual native PostgreSQL16 ordinary-role tests exercise both legacy and P1 paths, first/later real supplier row locks via competing NOWAIT, controlled/interrupted installation, immutable metadata, preserved DML checks, parent-only versus child edit authority, CAS/concurrency/replay, shared creator/editor attribution, foreign org/session/revocation, MGBI/KYS/retention and source preservation, output-audit rollback,100/101 WRITE and SYNC, policy rotation, exact24h boundary and aging. Frozen producer34/34PASS0skip independently covers signed proof, expiry/role/transaction/environment replay, forged facts/GUCs and shared executor quota.

Full server regression603PASS,0fail,7 explicitly environment-gated optional SQL tests skipped. Typecheck and source build PASS; governance/workspace/current KRS routing39/39PASS0skip. A final clean-fixture operation suite and committed-source checks are run after recording this checkpoint; their actual counts, source SHA and remote CI contexts are retained in the canonical owner closeout, without attributing another branch's green job to this candidate.

Two old fixture repeatability issues were identified without changing production constraints: private-host tests retained a disposable ingestion schema between runs (repeat in a fresh named local database), and two separate clock reads could exceed the30day coordinate constraint by1ms (one captured fixture clock). New source-version quota tests use newer snapshots rather than backdating past the accepted projection, and preserve PostgreSQL microseconds at the exact24h boundary. None of these changes weakens freshness, CAS, quota or lifetime rules.

Build-generated next-env import changes were preserved as a diagnostic patch and restored to exact accepted bytes; completed build cache was removed to conserve the user's disk. One cleanup shell continued after its generated-file assertion/preflight failed; only completed cache and the disposable local fixture's WAL configuration changed. No source/provider change followed that failure. The generated file was then restored and full preflight passed before further source edits. Main-advance preflight failures also stopped edits until secured main refresh completed. Recovery logs/stashes remain preserved.

## Live-state readback and remaining gates

Independent ordinary-role read of Development platform_private: SQL019/020 and SRM013/014 installation relations all absent. Latest live deploys remain SRM dep-dbbnb22fngtc73bn0i90 at260ade12608faaea27376c1c976db392f046f267, Maps dep-dbati9rrjlhs73akpsj0 atdb2df0a6cccb994ea4654ae0eb5b3af4b46867ff and Identity dep-dbcse73rjlhs73eib57g ataa95c0a0a14fb2f2ba5af7338c8d83a6fb349269. No restore/recovery branch, Finalize Restore, Staging or Production action was performed.

Identity corrective PR611 remains independently validated at30c07f0684d5a5dce707e8dcb38b8ba63d6db03b; own PHR1e1db198dd3e55831a120e635f7015aa880ace49. This SRM candidate does not silently fold that independent owner change or SG2 PR607 into its source. Global exact-head acceptance of frozen PR604 and a safe main publication sequence remain **NOT VERIFIED / NOT APPROVED**. A standard PR merge-check tree is reported separately from an exact candidate HEAD. No controlled CI admission class, credential boundary or policy was changed to manufacture a global PASS.

After independent source reviews, obtain the previously described bounded publication plan with exact owner SHAs and complete trusted-controller proof. Live installation, functions/grants/key/policy setup, UAT accounts, retention coordination, recovery/LKG, maintenance window and deployment remain under the separate TASK02-R owner gate. Source implementation/testing does not activate Supplier Locations for SRM users.
