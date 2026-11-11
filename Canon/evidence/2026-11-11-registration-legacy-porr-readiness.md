# Stage I legacy organisation and database readiness — read-only baseline

Status: READ_ONLY_BASELINE_COMPLETE / CANONICAL_PORR_ID_UNRESOLVED.
Observation date:2026-11-11. No runtime activation or full Stage I acceptance.

## Governed scope

Task ARCH-REGISTRATION-LEGACY-PORR-READINESS-20261111, registration
cmwcft3590000p8pco7834y8l, conversation
pmos-task-v2:47f1d70dd9325af13a93c78dfff5507792202e9629e174d14e3a2fd9d9f9f169.
Six exact Architecture paths passed registered pre-execution gates.
Only this sanitized evidence file is changed.

The registration canon requires preserving an existing canonical PORR OrganisationID
and links before any new company is created. The current audit establishes a
minimal baseline without choosing an organisation by assumption or editing data.

## Exact observed resource

Canonical registry: platform-private-onboarding-v1 and initial-directory-v1.
Neon project spring-bread-28217539, Development branch br-sparkling-term-b99l107x,
database platform_private. Direct installation-row read independently returned
the same project, branch, database and environment=development.

This is the existing shared platform/product authority. Architecture technical
labs and PMOS were not queried as organisation data. No connection string,
credential, secret, proof key or user/session data was fetched or copied.

The connector observed administrative role neondb_owner with SELECT permission
and controlled-owner membership. These were administrative metadata reads.
Actual runtime isolation still requires the separately admitted ordinary-role
and live application acceptance.

## Observations

-3 visible platform organisations in profitia_access.organisations.
-1 visible SRM organisation in srm.organizations.
-0 platform display-name matches for PORR.
-0 SRM slug-prefix matches for porr.
-0 same-ID PORR bridges by those explicit name/slug criteria.
-No candidate organisation IDs or personal data were published.

Names/slugs are discovery hints. The canonical PORR ID remains unresolved:
unnamed/aliased records and actual runtime bindings still need reconciliation.
The audit does not authorize reusing or renaming another organisation, creating
a duplicate, moving memberships or assigning its package.

Actual table metadata:
-Platform organisations: UUID organisation_id, ACTIVE/SUSPENDED status, version
  and optional display_name. No NIP field exists in this base authority table.
-SRM organisations: UUID id, unique slug and created_at.
-Both organisation tables and platform memberships have ENABLE/FORCE RLS and
  controlled owner profitia_access_owner.
-Existing user_profiles, email_outbox, vocative_dictionary and Package/Limits
  identity-read installation are present. Reuse their admitted boundaries.
-None of the10 tables defined by candidate profile migrations007/008 is present
  in this database's current catalog. The tables are:
  organisation_onboarding_installation/policies/drafts,
  organisation_bootstrap_installation/policies,
  organisation_profiles, organisation_categories, user_procurement_categories,
  organisation_member_profiles and organisation_bootstrap_commands.
-The future country/NIP identity belongs to the008 organisation profile model;
  no separate invented tax-binding table is inferred from the current catalog.

The old source registries' dates/statuses are historical. Current table/installation
reads above are the evidence for this observation; catalog presence is not proof
of an active application or current product entitlement.

## Consequences for Stage I

1. Before bootstrap activation, inspect existing approved runtime/module/package
   organisation references and establish an explicit versioned legacy mapping.
   Preserve the canonical ID and current links. Name/brand alone cannot make that
   mapping. Resolve the real company/NIP through the admitted company source.
2. Install and verify the accepted profile schemas and exact per-role policies
   only through their governed migration/activation procedure after source
   acceptance. The new draft surface must stay disabled until readiness passes.
3. Keep organisation creation separate from the Package/Limits assignment and
   E1 projection. Obtain the owner's manual PORR package assignment only after
   a real canonical organisation is identified/prepared.
4. Continue native organisation/invitation/context-port/tenant handoff work and
   real Development end-to-end acceptance. This audit is a readiness baseline,
   not that product completion.

## Mutations and evidence

Product SQL/data/roles/policies/grants/packages: zero mutations.
Neon branches/projects/computes/extensions, credentials, provider calls, email,
DNS and deployment: unchanged by this audit.
No user email, personal name, raw organisation UUID, proof key or session token
was selected for publication. Queries used catalog/table metadata, installation
identity and aggregate counts, with minimal candidate metadata (the result empty).

Durable sanitized evidence: GitHub plus canonical ARCHITECTURE PMOS/PHR.
No laptop artifact was created. Parent Stage I, source65 and CI65 policy work
remain active independently.
