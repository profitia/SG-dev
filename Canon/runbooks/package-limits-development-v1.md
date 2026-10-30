# Package & Limits Dashboard — Development execution contract v1.0

Status: ACTIVE_RUNBOOK on controlled main acceptance. Owner: Architecture Platform.
Scope: the explicit owner Full Development Implementation & First Live Deployment plan of 2026-10-30 in host `01a18b57-efdf-79e3-a75a-9061dc5e57cb`.
This runbook implements the already accepted [base v1.0](../v1.0-profitia-package-and-limits-management-canon.md) and [Customer Lifecycle v1.1](../v1.1-profitia-package-and-limits-customer-lifecycle-addendum.md); it changes no business principle.

## Authority and routing

The owner explicitly grants G1 and the continuous Development plan, including code, CI, controlled PR/merge, restricted Development schema/roles, configuration of the existing service and its first deployment. No further stage approval is inferred from CI: operational authority comes from that actual instruction and remains bounded by all current gates. Individual PMOS phases required by governance remain parts of the same plan, not a reason to stop after onboarding.

Only ARCHITECTURE writes `apps/package-limits/**` and `.github/workflows/package-limits-ci.yml` (LIMITS-BASE-001/002). Read-only inspection may consult existing Identity/Access. Shared producer changes require independently declared exact paths and compatibility checks. No application-private import from SG2/SRM/Identity. BQL/PCI/Finder/Shared Picker, SRM providers/X-Ray/FRESH/KRS and other deployments are excluded.

## Development module binding

| Surface | Exact authorised target |
| --- | --- |
| Source | profitia/SG-dev/main, apps/package-limits; repository-root build context |
| GitHub environment | profitia-limits-development / 25772685296 |
| Render | tea-d7lps8rbc2fs73cn80dg / prj-dbi556u1egvs73euin20 / evm-dbi5932jnfac73cs1nhg / srv-dbi5at9srm7s73da7ol0 |
| Public entry | https://limits-development.onrender.com |
| Limits store | lingering-thunder-05075810 / br-green-hall-b9s837k0 / neondb / proposed schema profitia_limits |
| Identity authority | spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private, existing accounts/organisations/memberships |
| Continuity | existing ARCHITECTURE PMOS billowing-credit-07394675/architecture_pmos; Memoros disabled; own PHR clone |

These module-specific product bindings supplement the existing source onboarding registry. They do not replace the Architecture PMOS/lab profile bindings or activate any Stage/Production environment. Runtime/install validators must reject another environment, endpoint/branch/database/role/service. Existing Staging expiry and provider security/cost limitations stay dated observations in [the inventory](../evidence/2026-10-30-package-limits-infrastructure-inventory.md), not instructions to repair those resources.

Use the existing neondb unless fresh inspection establishes a real conflict. Do not create another project/service/database. Use a NOLOGIN owner, distinct controlled migrator and an ordinary least-privilege runtime role without ownership, superuser, BYPASSRLS, CREATEDB or CREATEROLE. Secrets remain in protected ignored local configuration and Render's secret mechanism, never Canon/PR/PHR.

## Minimal application and security boundary

The first release provides real server-backed products/capabilities/metrics, packages and immutable published versions, limits/period policies, assignments to canonical Organisation IDs, versioned changes/statuses/overrides and durable operator audit. Names and limits are configurable; two commercial products remain independent. Invoice/due/contract/assignment/usage-cycle dates remain distinct and intervals half-open. No implicit trial/grace/proration/carry-over or provider call.

Reuse the existing official identity SDK and framework-neutral Profitia identity/access contract. Verify the external session and permanent internal User ID once per request boundary; pass a bounded immutable verified actor to internal helpers. Current account/session and operator revocation must be enforced. Do not cache stale ALLOW or repeatedly call Clerk from SQL/helper layers.

An explicit Profitia platform-operator grant is separate from customer membership and commercial assignment, as required by base §10. The narrowly scoped administrative backend must authenticate and check that grant on every operation; direct API and ordinary users deny. The first operator is the account designated by the owner in this chat, after canonical identity verification; never infer operator rights from an email/domain/client field. No new identity provider or customer-wide privilege is introduced.

Organisation lookup uses the existing canonical authority through an existing accepted read or a minimal separately permissioned read adapter under Architecture Platform ownership. Return only necessary ID/status/version/display data; do not copy accounts/organisations/memberships into Limits. A write must validate the referenced organisation and protect against stale/unavailable authority. No NIP lookup, organisation registration, invitation/claim or automatic membership is implemented. Any Development fixture must be explicitly synthetic and authorised, with no customer/E1 product grants.

SQL effects require current verified operator authority, parameterised input, optimistic version checks, atomicity, bounded idempotency and audit. Published versions and historical events cannot be rewritten by ordinary runtime. Assignment overlap for product/scope/period is serialised and rejected unless an explicit versioned change resolves it. Database constraints/RLS and restricted command entry points must enforce the boundary, including raw-runtime forgery/privilege tests.

Package definitions/assignments are the authoritative commercial record. Existing product_grants remain technical rights; do not update them from this release. Display technical activation as pending/NOT_CONNECTED, and usage as NOT_CONNECTED rather than zero while SG2/SRM metering is absent. Stable versioned references/receipts permit later integration without moving ownership or creating a second E1 engine.

## Gates, installation and first release

1. Accept this G1 source registration on main after full preflight, PMOS begin/require-begin, routing regression, existing governance/PMOS tests and exact-head CI. Current explicit plan authorises this merge; G1 is not a live declaration.
2. Begin the implementation phase in the same plan with exact source paths, current main and unchanged profile/continuity. Install only the new app's dependencies; do not expose private registry credentials or rebuild unrelated products.
3. Test schema and ordinary-role security on an isolated local PostgreSQL fixture. Migrations are versioned, checksummed, transactional, guarded by exact physical binding and safe on replay; different existing receipts/conflicting schema stop.
4. Before live data/configuration writes independently capture current Development DB/schema/roles, installation/configuration and existing service state. Preserve a recoverable dump/snapshot and test its restoration where data exists. For the empty first install explicitly record no previous application/schema LKG and the verified containment/recovery procedure; never fabricate a prior live build.
5. Controlled installation creates only required schema/roles and the minimal approved Identity read binding. Preserve all unrelated schemas, applications, accounts, memberships, grants and policies. No SQL/global role changes on Stage/Production. Review migration output and independently reread constraints, grants and persisted receipts.
6. CI uses no live credentials: routing, static/type/build, unit/domain/idempotency/period/history/operator tests and disposable PostgreSQL security/concurrency tests. Exact candidate and resulting main CI must pass, with current source and checksums.
7. Keep Auto-Deploy OFF and previews OFF. Save service config without initiating another deployment; set reviewed build/start/health and secure bindings for this existing service only. Pin the accepted full source SHA for a manual deploy. Do not alter other service auto-deploy settings or use a moving latest.
8. First-release recovery: preserve reserved blocking commands and old config; on failure stop intake, retain diagnostics and data, restore the reserved service configuration or a subsequently verified retained LKG. Do not drop schema/roles/data or reset a Neon branch automatically. Subsequent releases require measured LKG artifact/config/schema compatibility.
9. Independently verify exact Render deploy/commit, health/logs, actual Neon branch/database/role/schema and persistence. Exercise real operator login, package creation/publication, SG+SRM assignments to an authorised organisation, reload, versioned change/history, unauthorised API denial and truthful pending E1/usage. No paid upstream calls.
10. Complete own canonical PMOS/PHR and verify persisted records, runtime/archive integrity, publication ancestry and clear pending/locks. Report LIVE only after end-to-end acceptance; do not end after source onboarding, PR or a green deployment alone.

Existing Identity, SG2, SRM, BQL, CIC and all Stage/Production services stay outside deployment scope. New material unplanned risk triggers the actual Full Autopilot STOP condition; routine in-scope corrections and fresh main/CI reconciliation do not require another approval.
