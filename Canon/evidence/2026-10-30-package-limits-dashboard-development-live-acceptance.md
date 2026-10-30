# Package & Limits Dashboard — Development live acceptance

Status: **VERIFIED_DEVELOPMENT_LIVE** for the bounded first release below. Observation date: 2026-10-30 UTC. Logical owner: Architecture Platform. This is an execution receipt, not a business-canon amendment, Stage/Production onboarding, payment confirmation or E1 activation.

## Authority, scope and continuity

The owner's explicit Full Development Implementation & First Live Deployment instruction authorises the continuous Development plan, G1, application implementation, restricted Development SQL/roles, existing-service configuration, exact-SHA manual deployment and controlled PR acceptance after gates. Actual host: `01a18b57-efdf-79e3-a75a-9061dc5e57cb`.

Authority remains [base v1.0](../v1.0-profitia-package-and-limits-management-canon.md), [Customer Lifecycle v1.1](../v1.1-profitia-package-and-limits-customer-lifecycle-addendum.md) and the [Development execution contract](../runbooks/package-limits-development-v1.md). Their business decisions are unchanged. The [historical infrastructure inventory](2026-10-30-package-limits-infrastructure-inventory.md), [G1 receipt](2026-10-30-package-limits-dashboard-g1-onboarding.md) and [source proposal](2026-10-30-package-limits-dashboard-development-release.md) retain their original observation/proposal states. This receipt supplies the subsequent live observation.

ARCHITECTURE / Development; own PMOS `billowing-credit-07394675 / architecture_pmos`, runtime `architecture_pmos_runtime`; Memoros disabled; own PHR clone. Implementation task: `ARCHITECTURE-PACKAGE-LIMITS-DASHBOARD-DEVELOPMENT-20261030`, registration `cmvvfhz0c0000j7x35l39do2w`, conversation `pmos-task-v2:835f4e26c86adcc9fafcf8db1106ba5be5d67d1b77028fbce874d296b94efae4`.

Current-main governance was loaded in manifest order; exact routing, isolated clean branch, manifest validation and full preflight/begin/require-begin passed before the applicable changes. The final receipt has exactly two target files: this evidence and the Limits row in `Canon/registries/architecture-onboarding-v1.json`. The expanded full execution scope contains 31 exact registered paths. Unrelated accepted SRM changes on main are preserved; they were neither authored nor deployed by this task.

## Accepted source and exact runtime

| Phase | PR | Accepted candidate | Resulting main |
| --- | --- | --- | --- |
| CI prerequisite | [#815](https://github.com/profitia/SG-dev/pull/815) | `c74be2b18cbbf678da89812b1492d236bc13e880` | `b964823b7e369aa70c52ffb7b268a6493157092a` |
| G1 / routing | [#814](https://github.com/profitia/SG-dev/pull/814) | `b14e8e70c02428a7a750690f143024dc92afd162` | `f74669342904d03beaf9577618c634f98b442849` |
| Application | [#820](https://github.com/profitia/SG-dev/pull/820) | `160ad2bc9efa011a26d057cc1d61c1e5f8d17afb` | `8b0d52c34303bf4f93b0f4de6d7f649ab7b0caed` |
| Ordinary-role installer correction | [#821](https://github.com/profitia/SG-dev/pull/821) | `4c5681511cc4a8d69182024e71f94564e20ac4e2` | `21c53fb49aadb4663b4015a719059e337edf6821` |
| Complete dashboard counts / additive read | [#823](https://github.com/profitia/SG-dev/pull/823) | `a68acfd3e7391b8913e71e48b75c36970394c76f` | `727a3c788720c436790b17eed58dcf0fd8660444` |

| Runtime surface | VERIFIED value |
| --- | --- |
| Public URL | <https://limits-development.onrender.com> |
| Render workspace / project | `tea-d7lps8rbc2fs73cn80dg / prj-dbi556u1egvs73euin20` |
| Render environment / service | `evm-dbi5932jnfac73cs1nhg / srv-dbi5at9srm7s73da7ol0` |
| Current deployment | `dep-dbih61mk1f9s73d6h56g`, provider status `live`, finished `2026-10-30T21:59:21.108571Z` |
| Deployed source | `727a3c788720c436790b17eed58dcf0fd8660444` |
| Independent health | `/healthz` HTTP 200; `environment=development`, exact deployed `sourceSha` above |
| Runtime / size | Node 24.15.0; one existing Frankfurt service instance, 0.5 CPU / 512 MB |
| Deploy policy | Auto-Deploy OFF; previews OFF; manual accepted exact SHA; no other-service deploy |
| Build | `npm --prefix apps/package-limits ci --include=dev --ignore-scripts --install-links --no-audit --no-fund && npm --prefix apps/package-limits run build` |
| Start / health | `node apps/package-limits/dist/server.js` / `/healthz` |

Later documentation-only main commits do not change the pinned deployed application. This receipt does not equate a later repository HEAD with a new deployment.

## Physical persistence and security

Limits store is **`lingering-thunder-05075810 / br-green-hall-b9s837k0 / neondb / profitia_limits`**, PostgreSQL 18.6, endpoint host `ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech`. No new cloud project, service or database was created.

| Installation | VERIFIED immutable digest |
| --- | --- |
| Base schema, installed `2026-10-30T21:41:36.696858Z` | `424204bec9d76fe6ed01b5946684f2255c6994e16aebc6146177a68a6988cf1d` |
| Additive dashboard read 003, installed `2026-10-30T21:58:11.647962Z` | `3c14df61d90bd46c30a3062d8fc7290a6a88a42b791b3f7b288ad08e16747c0b` |
| Minimal Identity read adapter | `b4b1fe4fb9e9b4265dd836256954e42f70343df87d6b4892f5750fa151f8830c` |

Fresh complete installation verification returned `ALREADY_INSTALLED_VERIFIED_SKIP`: exact physical binding, receipts, function source, owner/ACL/RLS/role state checked; no blind migration replay. Migration 003 adds the bounded dashboard aggregate independently of list pagination, without rewriting base 001/002, earlier receipts or history. Base function and metadata snapshots before 003 were unchanged.

`profitia_limits_owner` is NOLOGIN. `profitia_limits_migrator` is separate and controlled. `profitia_limits_runtime` is ordinary NOINHERIT/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE, has zero role memberships and owns no schema/table. Runtime has no direct business-table privileges; FORCE RLS and guarded functions enforce parameterised signed commands, current operator checks, bounded actor proof, atomic audit/idempotency, optimistic versions and serialised assignment-overlap checks. Secrets are protected local/Render values and are absent from source, evidence and PHR.

Identity authority remains **`spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private`**. The only installed addition is `profitia_limits_identity_read`, owned by existing `profitia_access_owner`, and ordinary `profitia_limits_identity_reader` with narrow CONNECT/USAGE/EXECUTE privileges. No accessible canonical business tables, no copied Identity store, no ownership/BYPASS/role memberships. The adapter validates canonical user binding and organisation state; a canonical read lock protects the relevant cross-database write boundary. One official Clerk/account/session observation per request becomes an immutable bounded verified actor; helpers do not repeatedly call Clerk.

Identity before/after observations: accounts 16, organisations 2, memberships 3; canonical function fingerprint `6de8209b5fafc6ae7c412bc3231e11a2`, table ownership/ACL/RLS fingerprint `d4cf19b2ff90f24a5a3bdf9509c97765`, unchanged. Original `neondb_owner` membership configuration was restored exactly. No accounts, memberships, product grants, Identity application source or deployment were changed.

## Actual browser and persistence acceptance

The owner designated `tomasz@profitia.pl`, canonical User ID `092c2d9f-a84b-4c18-b3d6-e172a61399b8`. Canonical active binding and owner membership were verified read-only. A separate, Limits-only operator grant was recorded with owner/task provenance; customer membership does not confer this role. The owner logged in through the normal browser form. No session impersonation, cookie/token transfer or credential disclosure was used.

The following operations were performed through the live UI and reread after reload and independently in Neon:

1. Created **SpendGuru Full**, package `367f3ff1-34b4-4421-ad92-fa54e07b7835`; published v1 `8d1141bf-0667-40b3-af57-0f7c69fc1b69`. Monthly calendar limits in Europe/Warsaw: MGBI 100, Macrobond 200, OpenAI total tokens 100000, warning 80%; configurable capabilities; no invented price.
2. Created **SRM Standalone Basic**, package `2c0b9465-16ab-4042-98bf-98f480703d7a`; published v1 `b86b5b1d-e7f3-4e7c-a5e6-7bb9278da98e`, MGBI 50 monthly, its own capabilities and limit policy.
3. Assigned both independently to canonical Profitia organisation **`225e465b-8b89-467d-92d1-7fef61b555fe`**. SG assignment `a5fca91e-da47-4397-b11c-cba94a88a9b7`, SRM assignment `d6b9b578-6a10-416b-8518-297b5e68c208`. Both use explicit **DEVELOPMENT_TEST**, not a paid contract or PSP confirmation; references `DEV-ACCEPTANCE-20261030-SG` and `DEV-ACCEPTANCE-20261030-SRM`.
4. Contract/assignment intervals are `[2026-10-30, 2027-10-30)`; usage starts October 30, monthly/calendar; billing period `[2026-10-30, 2026-11-30)`. SG invoice date October 30 and due date November 13 are independently stored. SRM invoice/due are unset. These are test records, not invoices, payment requests or automated renewal.
5. Reload retained both assignments and limits. Created/published SG v2 `405ad7de-4928-4a00-a49f-cef365850e35` with MGBI 150. Published v1 still has 100.
6. Changed SG assignment by immutable **revision 2**, effective `2026-10-30T22:04:35.596459Z`, to v2, with explicit organisation override OpenAI total tokens 120000/month and test reason. Revision 1 remains, effective `2026-10-30T22:01:08.711357Z`. SRM remains independent revision 1, effective `2026-10-30T22:01:39.705175Z`, without transfer/fallback/override.
7. Read history, catalogue, dashboard and utilisation views. Fresh independent counts: **2 packages, 3 published versions, 2 assignments, 3 assignment revisions, 12 durable audit events**. Dashboard shows 2 products, 1 organisation, 2 active and 0 planned assignments at observation time; nearest ends are backend data.
8. Utilisation truthfully shows **NOT_CONNECTED**, not zero. Technical E1 projection is **PENDING_NOT_CONNECTED**. No Source/provider call, paid MGBI/OpenAI/Macrobond request, PSP operation or E1 product-grant mutation occurred.

## Validation and limits of the claim

| Check | Result / precise boundary |
| --- | --- |
| Manifest / routing / workspaces | PASS; manifest 3.34.0, 54 active documents; 29 relevant governance/workspace/routing tests |
| Exact full execution preflight | PASS with actual host, ARCHITECTURE/development, PMOS begin and require-begin; 31 exact paths before receipt edits |
| Local domain / HTTP / Clerk boundary | PASS, 12 tests |
| Real disposable PostgreSQL security / concurrency / installer / dashboard | PASS, 17 tests; ordinary account denial and grant revocation included; synthetic isolated loopback fixture only |
| Typecheck / build | PASS for application; governance/PMOS checks passed in the prerequisite phases |
| Exact source and resulting main CI | PASS for application PRs and their merges; links below |
| Live anonymous direct API with forged operator/user headers | HTTP 401 `SIGN_IN_REQUIRED`; no authentication/role trust from headers |
| Real authenticated operator browser workflow | PASS as detailed above; reload plus independent DB readback |
| Live authenticated ordinary-account / operator-grant revocation | **NOT_EXECUTED**. No separate ordinary test login was supplied. Automatic approval review rejected temporarily disabling the owner's Limits-only grant because that exact revocation was not considered authorised. A specific approval question was presented; no permission was changed or workaround attempted. Current grant independently remains enabled, version 1. Local real-PG/API denial and revocation tests passed; they are not represented as a live-browser revocation test. |
| Mobile visual verification | **NOT_VERIFIED**: requested browser viewport resize did not change the observed desktop viewport. Responsive CSS exists; desktop screenshot/flow was inspected. No fabricated mobile acceptance. |
| Usage / provider-cost / E1 / billing integrations | Deliberately **NOT_CONNECTED**, outside the accepted first-release integration scope |

CI receipts: application [source 41131473228](https://github.com/profitia/SG-dev/actions/runs/41131473228), [main 41131748965](https://github.com/profitia/SG-dev/actions/runs/41131748965); ordinary-role correction [source 41132496053](https://github.com/profitia/SG-dev/actions/runs/41132496053), [main 41132641564](https://github.com/profitia/SG-dev/actions/runs/41132641564); deployed completion [source 41134443359](https://github.com/profitia/SG-dev/actions/runs/41134443359), [main 41134663571](https://github.com/profitia/SG-dev/actions/runs/41134663571). The final receipt's own exact-head/main governance CI and final PMOS/PHR readback are reported in the execution handoff after acceptance; this pre-closeout source artifact does not self-certify future closeout.

## Installation corrections, recovery and exclusions

There was no previous installed Limits schema/application LKG: the verified baseline was an empty first installation and reserved blocking Render commands. Baselines/configuration and protected recovery data were captured. Local disposable-fixture transactional rollback/replay/tamper and restoration checks passed. Recovery is to stop intake and restore the saved reserved service configuration or a subsequently verified retained LKG while preserving all schema, receipts and history; **never** auto-drop/reset the cloud schema, roles or branch.

The first provider API-created role unexpectedly inherited Neon administrative privileges. It was unused, had no owned objects or sessions, was removed, and was replaced through the accepted ordinary-role SQL installer. No existing role was removed. Initial multi-statement/role-grant installation attempts failed and rolled back; successful transactions applied only the reviewed exact statements, then restored temporary administrative SET privileges. The private Identity database required an explicit CONNECT grant to the new reader; no PUBLIC or broader grant was added.

Deployment attempts are not hidden: `dep-dbigutqjnfac73ccqhlg` was unexpectedly triggered by the Render connector's environment update and failed on the reserved blocking build; `dep-dbigv8vb9u1s73c4ccag` exposed omitted build-time dev dependencies; `dep-dbigvi7f3r2c73bbv4ag` exposed missing private-DB CONNECT. Corrected exact source/config/least privilege produced live `dep-dbih0s2jnfac73cd02g0` at `21c53fb49aadb4663b4015a719059e337edf6821`, followed by the current verified live deployment above. Subsequent environment saves used the official save-only API and explicit pinned deployment, avoiding duplicate connector-triggered deployments. Auto-Deploy and previews remain OFF.

No SG2/SRM/BQL/Identity application code or deployments, other-service configuration, Stage/Production resource, TTL, topology, PSP or paid upstream operation was changed by this task. No new GitHub environment, Render service/project, Neon project/branch/database, cache or queue was created. The historical infrastructure observations and frozen business canons remain unchanged.

The delivered first-user Polish Word manual has 14 visually checked pages, all eight modules, fields/commands, status/date semantics, the real first-release integration boundary and a complete two-product exercise. Final manual SHA-256: `5894f5be34bb19993a6389fc688b88b4878b970ab90b42bf8798d36edd240359`. It is a user deliverable, not an additional normative business model.

G1 and CI prerequisite tasks are independently PMOS/PHR-complete. This implementation's canonical save, current runtime/archive parity and PHR publication are verified after the final documentation acceptance; the final handoff is the receipt for that lifecycle step. No owner decision, CI result or closeout is inferred from a draft status or HTTP health alone.
