# Existing Maps service topology reconciliation — 2026-10-19

Task: ARCHITECTURE-E1-MAPS-TOPOLOGY-RECONCILIATION-20261019. Profile ARCHITECTURE, TARGET_ENVIRONMENT=development, local isolated workspace. This is source registry reconciliation, not a deployment or acceptance of customer location functionality.

## Observed mismatch

At authority db2df0a6cccb994ea4654ae0eb5b3af4b46867ff the separately accepted Maps connector has its own `maps-environment-topology-v1.json`, but the primary SRM environment topology does not enumerate that existing service. Fresh read-only Render/Neon API observations at 2026-10-19 08:50:48 UTC identified Maps service srv-dbat5ulg1s2s73defcp0 in SRM Development environment evm-dapbd70ae00c73cgrup0, existing project prj-dapbd3hsrm7s73es53fg/workspace tea-d7lps8rbc2fs73cn80dg, repository profitia/SG-dev, autoDeploy=false. A separate readback confirmed LIVE deploy dep-dbati9rrjlhs73akpsj0 from db2df0a6cccb994ea4654ae0eb5b3af4b46867ff. Service creation, Google configuration, deployment and earlier acceptance belong to the separate Maps task; this task does not repeat or claim them.

The full SRM E1 gates correctly refused `Unregistered SRM Render service in development`. They also refused a stale/dirty E1 checkout. No E1 source mutation was performed under these refused gates. Own uncommitted E1 work remains preserved; refresh and clean full SRM gates are required before its continuation. This correction uses independently passing ARCHITECTURE gates and permitted Governance Source Layer routing, without an SRM-profile waiver or alternate PMOS writer.

## Exact correction and boundaries

Add one `mapsRuntime` role with the observed immutable service ID, manual deployment policy and reference to the existing Maps topology. Preserve existing SRM runtime, all Staging/Production identities, release rules and database configuration. Keep Maps private operations NOT_ADOPTED and SRM feature mounting false. No executable gate modification, account/access/secret/configuration change, new resource, product/Maps code, migration, customer data or deployment is included.

## Verification

Run the existing governance tests and manifest validation. Evaluate the actual fresh provider snapshot against the corrected primary SRM topology; verify refusal for missing Maps, automatic deployment drift and another unregistered service. Independently review the two-file diff, exact-head CI and main publication before the SRM E1 gates may resume. Source tests do not establish real customer login, private RLS, geocoding entitlement, Maps UAT or completion of E1. Canonical ARCHITECTURE PMOS/PHR closeout records actual publication evidence separately.
