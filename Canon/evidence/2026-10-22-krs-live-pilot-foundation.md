# KRS live pilot: native minimum foundation

Task: ARCHITECTURE-KRS-LIVE-PILOT-FOUNDATION-20261022. Authority main
418a2ef0f30d840ce25ca645f5ef047e35d02192. Architecture owns only producer
paths. SRM consumer remains separately registered. No SDK1.26 or Maps change.

This candidate implements the bounded AM21 report projection and existing
native Source publication, with fixed resource IDs, catalog generation/current
snapshot fencing and real Root identity/access/module/audit. Publication accepts
only the process-owned attestation of the actual settled Source, checks bytes
and URL, re-normalizes those exact bytes and commits catalog writes with the
existing Source OUTCOME. A JSON receipt or offline test Source is not authority.

Actual official shape discovery for one known KRS0000028860 found ORLEN SPÓŁKA
AKCYJNA, NIP7740001454, observed REGON61018820100000. This was one credential-free
research GET, not runtime ingestion or authenticated pilot evidence. The invalid
padded REGON is preserved as an invalid observation and withheld from verified
optional identity, without truncation or checksum relaxation. DTO package1.0.1
accepts historical normalizer1.0.0 and current1.0.1; wire contract remains1.0.0.

Verification:65/65 offline/API tests,20/20 actual isolated PostgreSQL tests,
6/6 routing tests. PostgreSQL suite uses ordinary krs_human_test with actual
Root/Clerk adapter and stored E1 grants/module/audit; Clerk assertions and company
bytes are synthetic. Search/selection pass, anonymous/revoked session/current
membership and wrong evidence deny, OUTCOME outage releases no result.100k
synthetic search benchmark and rollback/reapply pass. This is not live login,
accepted Source installation or MGBI evidence.

The three KRS CI routing files reuse reviewed PR618 source2f8afef692f26e69fba91a028f1f84400badad7e.
They retain full owner partition, base ancestry/exact SHA and protected source
checks. The pending atomic-publication runbook proposal in that PR is not adopted.

Resource proposal: existing Architecture Development Neon compute
fancy-cell-49425728/br-divine-fog-baohc5ay, separate krs_registry_pilot database,
no PMOS/private supplier data, no additional compute, finite ORLEN-only seed,
no scheduled sync. New resource/technical binding approval is pending. No product
cloud schema, grants, deployments, new paid budget or user entitlement changed.
Native publication requires its exact ordinary-role installation; the proposal
file alone does not install or authorize it. SRM live and Financial tests pending.

## Approved isolated installation candidate

Producer PR620 is accepted on main2936119359f4614f7c864fa2456c4317a0ec065d.
The owner subsequently approved USER-20261022-KRS-ISOLATED-PILOT: exact Free
Render service and separate catalog DB on existing compute, limited technical
bindings, at most20 official ORLEN reads, existing Financial budget only.
The SRM service is registered in its canonical topology; the public catalog
is registered in the KRS-owned deployment target and this accepted KRS Canon. Render readback
confirms service srv-dbd5hlcipgvc73d98ukg, Free, auto-deploy off, environment
evm-dapbd70ae00c73cgrup0. Its bootstrap dep-dbd5hm4ipgvc73d98vdg serves only
health200 and unavailable503; no authenticated application is claimed live.
Neon readback confirms DB122089, owner krs_catalog_owner, ordinary reader/ingest
roles, and denied CONNECT to architecture_sg_lab and architecture_srm_lab.
The accidentally privileged unused krs_migrator role was deleted only after
the owner's explicit deletion approval; readback count0. No database/data deleted.

The installation candidate reuses immutable native Source SQL008/009/012 and
adds a domain write fence. Actual isolated PostgreSQL:24/24 PASS, including
atomic DDL rollback, ordinary direct-write denial, genuine Source reservation,
domain write and paired OUTCOME in one commit, process-owned receipt and
idempotent replay, plus Source audit-outage rollback. Data/identity assertions
are synthetic; no HTTP or paid provider call occurs in these tests. The new
cloud DB remains empty until the accepted exact installation is applied.
Existing SRM regression:634 PASS,7 optional SQL tests skipped,0 failures.
Credential transfer is separately awaiting explicit approval after automatic
approval review rejected exporting source-service secrets. No secret copied.

The Architecture topology remains the exact historical PMOS/two-LAB registry.
The new public application store is registered in KRS deployment/pilot-targets.json
and the KRS Canon, separately from those laboratory identities. Its exact
project/branch/database/ordinary-role binding is verified by the native Source
installation and consumer connection checks; no laboratory routing is replaced.
During publication, main advanced to a0a3b0626fac16e011b57d6284ce55abcfcd3ca3
(coordinated Supplier Locations release / SDK1.25.0). This installer branch
merges that accepted authority without changing its SDK or Maps sources.
