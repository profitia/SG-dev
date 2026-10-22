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
