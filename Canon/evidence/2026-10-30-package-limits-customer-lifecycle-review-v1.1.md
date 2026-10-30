# Package & Limits v1.1 — Customer Lifecycle: review, contract comparison and evidence

Date: 2026-10-30. Task: `ARCHITECTURE-PACKAGE-LIMITS-CUSTOMER-LIFECYCLE-V1-1-20261030`.
Status: **PROPOSAL / OWNER_REVIEW_REQUIRED / GOVERNANCE_ONLY**. No owner GO for this text or implementation is asserted.
Repository: `profitia/SG-dev`; audited fresh main `6da89374fa9a6d3ba830868748fd3172deab891b`.
Logical owner: Architecture Platform. Canon documentation route: Governance Source Layer / ALIGNED.
Profile: ARCHITECTURE; target Development. Host: `01a18b57-efdf-79e3-a75a-9061dc5e57cb`.

## Authority, input and parallel work

Owner input: `Profitia_Package_Limits_v1_1_Customer_Lifecycle_Proposed_Amendment.md`, SHA-256 `5c579a147081ae237038a4d4d365cd3a03a84a42a4c8b7ce10781c35a46b15e6`. It is a proposed substantive draft, not an instruction to bypass repository governance or a claim independently proven by attachment. The attached SG2 wrapper selects SG2; the actual request selects ARCHITECTURE and its own PMOS, so the wrapper cannot switch this task to SG2 or authorize implementation.

Loaded current AGENTS, manifest CORE/ARCHITECTURE sequence, project registry, adapter, routing/baseline, topology, Identity, Operation Context/Access Matrix, SpendGuru/SRM, KRS and AppShell contracts. No nested AGENTS covers these Canon paths.

The active [base v1.0](../v1.0-profitia-package-and-limits-management-canon.md) was accepted in [PR #796](https://github.com/profitia/SG-dev/pull/796), approved candidate `90cfd846a55d4cb35928e0e8d5388fcdaacb0a5c`, merge `75ebabcc8ebb4c8c6529b730ba6a261678a22522`. Its historical PROPOSED_FREEZE header remains on this audited main. Separate [PR #802](https://github.com/profitia/SG-dev/pull/802), candidate `381b7ba0a9c8cfacd84086d7c93ee27ea9a89f25`, was OPEN/DRAFT/unmerged at inspection. It owns the header correction and `Canon/evidence/2026-10-30-package-limits-infrastructure-inventory.md`. Neither file is edited/copied by this PR; that inventory is not yet local authority. No infrastructure onboarding is inferred from it.

All 30 open PR file inventories were checked before edits: no overlap with these three target paths. During local validation, parallel PR #803 advanced main to `00452a23d42fc3f97e36dd3685913f99d9361222`; the two governance assertions correctly reported BLOCKED for the outdated branch. Its nine SRM-only paths were inspected, with zero changes to AGENTS/Canon/governance/PMOS or target paths; the task branch incorporated main by fast-forward without overwriting the three documentation edits. The same validations are rerun against that current base. No test or gate is weakened. Existing proposals touching Operation Context/Identity are separate and are not substituted for current main.

## Publication model

[Proposed v1.1 addendum](../v1.1-profitia-package-and-limits-customer-lifecycle-addendum.md) preserves CL-01–CL-09 and expands normative semantics rather than replacing the owner's draft with a roadmap.

An additive amendment is already a supported repo pattern (e.g. [ADP v1.1](../v1.1-srm-adp-presentation-mounting-amendment.md)). Proposed manifest entry `profitia-package-and-limits-customer-lifecycle`, version `1.1`, owner Architecture Platform, appliesTo SG2/SRM/ARCHITECTURE, loadOrder 410 follows base 400 and existing normative dependencies. ManifestVersion minor bump 3.31.0 → 3.32.0 follows the additive registration pattern of PR #796. Existing entries/IDs/statuses/dependencies are unchanged; base v1.0 stays ACTIVE.

This is one base plus a bounded dependent addendum, not two competing complete package models. Addendum precedence only specializes customer lifecycle and cannot override base/E1/Identity/KRS. ACTIVE in the candidate manifest is prospective on accepted main. Draft, CI, continuity and actual owner acceptance are separate facts; no new unsupported manifest status is invented.

## Three principal contract verifications

1. **Account / organisation / membership — VERIFIED_SOURCE, TARGET_NOT_IMPLEMENTED.** [Identity Canon §3](../v1.0-identity-runtime-architecture-and-ownership-canon.md), [registration runbook](../runbooks/registration-model-development-v1.md), `apps/identity-runtime/src/http-handler.ts`, `registration.ts`, `account-provisioning.ts`, and `packages/platform-contracts/src/identity-provisioning.mjs` keep account registration/completion separate from organisation onboarding. Current shared resolver `operation-context.mjs` exports bounded implemented operations without `organisation.create`, `invitation.accept`, `billing.manage` or `product.contract.apply`; target AM-03/04/09/30 does not imply adoption. Existing source DDL `packages/platform-contracts/migrations/access/001-internal-access.sql` separates accounts, organisations and composite membership (organisation_id,user_id), with no organisation column on accounts. `migrations/profile/005-registration.sql` derives Assigned/Unassigned from membership existence; that flag is not active access.
2. **Commercial vs technical product — VERIFIED_CONTRACT.** [Base §4–11](../v1.0-profitia-package-and-limits-management-canon.md), [target architecture](../v1.0-spendguru-srm-target-architecture-canon.md), [Operation Context](../v1.0-operation-context-and-access-contract.md) and current technical `product_grants` source distinguish two sold products (SG including entitled embedded SRM; SRM Standalone) from three launch profiles. Assignment remains Package & Limits-owned, membership Identity/Access-owned. Existing technical `SUPPLIER_INTELLIGENCE` is not proof of an SRM Standalone subscription. New assignment→E1 projection, dual-product metering and full lifecycle are TARGET; no installed pipeline/readiness is claimed.
3. **Physical placement vs source schema — VERIFIED_API / NOT_VERIFIED_SCHEMA.** Fresh Neon control-plane project/branch/database reads confirm private Development and separate Limits metadata below. API database inventory cannot prove current tables, schema emptiness, RLS, roles, ledger or runtime bindings. Candidate CL-07's “physically verified” table claims and “empty neondb” are not promoted into fresh verified facts. No SQL, connection string or data-plane/schema tool was used.

## Read-only Neon evidence and limits

Non-atomic metadata reads on 2026-10-30, approximately 11:59–12:01 UTC (12:59–13:01 CET). Methods: `describe_project`, `list_branches`, `list_postgres_databases` with explicit project/branch IDs. All calls succeeded. No provider writes, SQL/inspect/schema tools, DSN, secret retrieval, role grants or runtime activation.

| Classification | Object / observed metadata | Meaning / limit |
| --- | --- | --- |
| VERIFIED_API | `profitia-platform-private` / `spring-bread-28217539`, aws-eu-central-1, PostgreSQL16; Development `br-sparkling-term-b99l107x`, ready/default | This exact Development branch exists. Other recovery/rehearsal branches are not Staging/Production identity authority. |
| VERIFIED_API | Private Development DB `platform_private` ID43910 and `neondb` ID43720 | Database existence verified; roles/schemas/current data not read. |
| VERIFIED_API | `Package & Limits` / `lingering-thunder-05075810`, aws-eu-central-1, PostgreSQL18 | Provisioning metadata only, not G1 or app readiness. |
| VERIFIED_API | Limits Development `br-green-hall-b9s837k0`; only DB `neondb` ID173988 | `profitia_limits` absent from returned complete list; schema contents NOT_VERIFIED. |
| VERIFIED_API | Limits Staging `br-fragrant-voice-b9316y6k`; only `neondb` ID173995; expiry 2026-10-31T09:16:04Z | Metadata read does not onboard Staging. Expiry unchanged by this task. |
| VERIFIED_API | Limits Production `br-lingering-union-b9qcyz0a`, default; only `neondb` ID173916; protection false | Metadata read does not onboard/activate Production. |
| OWNER_DECLARED / VERIFIED_SOURCE_DESIGN | Private schemas `profitia_access`, `profitia_profile` and accounts/organisations/memberships/product_grants/user_profiles as stated in candidate and source | Source contains their contracts/DDL and historical installation evidence; current physical table/constraint/grant state NOT_VERIFIED here. |
| NOT_VERIFIED | Normalized tax-identity uniqueness, invite/claim implementation, commercial schema/assignment pipeline, physical Identity Stage/Prod, runtime readiness/current deployed Identity SHA | Not inferred from names, source or database existence. No new lookup/deployment performed. |

This table is only evidence for lifecycle ownership claims, not a second infrastructure registry. Full Render/GitHub/Neon environment inventory stays separately in PR #802. Its timestamps and IDs remain observations to revalidate before any dependent activation. No Stage/Prod identity database is invented. Registered ARCHITECTURE topology remains Development-only with separate PMOS/lab; Limits resources do not replace those bindings. G1 before Limits activation is a future prerequisite, not a blocker to recording these facts.

## Exact semantic changes from owner CL-01–CL-09

The source attachment is preserved unchanged. This list covers substantive edits/additions; title, relative links, hard-break formatting and prospective status are editorial.

| Input | Proposed clarification / normative addition | Reason / conflict resolution |
| --- | --- | --- |
| CL-01 | Names existing Identity/Access responsibility; account Assigned flag is existence projection, not entitlement; distinguishes customer tenant from supplier/KRS entity. | Prevents alternate owner and single-organisation account model; matches source. |
| CL-02 | Explicit AM-03/04 BOOTSTRAP_GRANT, creationIntentId, atomic first **owner**, invitation recipient/revocation/expiry/current inviter proof, one-time retry and last-owner protection. Existing accounts retain memberships. Claim is request without rights, owner/operator review required. | Draft said first “authorised membership”; target contract specifically requires first active owner. Account mode alone does not authorize bootstrap. |
| CL-02/03 | Replaces unconditional “Lookup MGBI” with explicitly admitted registry route including MGBI; adds platform budget and source-admission requirements, no automatic fallback or changed SRM provider. | Draft must not silently create a paid source or override existing KRS/MGBI General/Financial policy. No provider is selected/activated here. |
| CL-03 | Restricts NIP uniqueness to active verified customer-organisation tax binding in one environment/authority, not globally in company catalog. Ambiguous legal identity stays pending. Adds versioned logical source admission registry fields (owner, proof/currentness, coverage, licence/retention, budget, failure policy), without creating physical registry. | KRS Canon §4 expressly preserves distinct KRS incarnations and disallows global unique-NIP/heuristic merge. Bounded tenant deduplication is compatible; wider rule would conflict. |
| CL-04 | Deterministic product/scope/time assignment resolution; unresolved overlap DENY rather than arbitrary sum. Cross-DB proof and pending/ack/reconciliation, no distributed PostgreSQL transaction or copied organisation. | Turns deferred transport into explicit semantic requirements without prescribing SQL. |
| CL-05 | Separate order/payment/contract/assignment/E1 states and event table; manual terms can lawfully defer payment. PSP owns payment facts, Limits owns entitlement mapping. Authenticated webhook/replay/out-of-order reconciliation cannot reactivate revoked rights. AM-30 remains target, not installed. | Avoids conflating successful payment, active PSP subscription and ALLOW; enterprise remains independent of Stripe. |
| CL-05 dates | Half-open windows, separate contractual/billing/usage times, IANA/DST/version, optional nonapplicable billing dates, no infinite technical grants or implicit reset/proration/grace. | Supplies normative lifecycle rather than merely a roadmap; concrete commercial policies/currencies/prices remain deferred. |
| CL-06 | Projection envelope and ack/version/currentness requirements; preserve multiple valid contributions to a shared technical grant without cross-product budget fallback. DENY scopes new dependent paid actions, not unrelated valid ACCOUNT_SELF. | Revoking one assignment must neither prolong it through a stale grant nor revoke a different valid basis. Existing grants are not retroactively relabelled. |
| CL-07 | Replaces mutable physical ID table with logical responsibility table and links to dated evidence/independent inventory PR; downgrades unsupported current schema/empty DB claims. | Fresh API verifies metadata only; prevents second topology or fabricated Stage/Prod authority. |
| CL-08 | Adds concurrency, first-owner/invite, PSP order, temporal boundary/DST, cross-DB outage and projection-contribution negative acceptance matrix. | These are required future tests, not claimed executed live tests. Existing v1.0 OpenAI/metering invariants retained. |
| CL-09 | Formal dependent-addendum registration/precedence, owner acceptance gate and separate implementation prerequisites. Replaces attachment's “no repository mutation” wording with authorised controlled documentation PR only. | Attached procedural prose cannot negate the user's direct PR request or authorize implementation. v1.0 and PR #802 remain untouched. |

No business price, plan name/quantity, default trial/grace/proration rule, technical E1 grant or payment provider is introduced. All original base v1.0 decisions (including OpenAI and UNMETERED) remain unchanged.

## Potential conflicts, owners and narrow paths

The bounded proposal requires **no edits to another active canon**. Owner review must accept the interpretation explicitly; unresolved disagreement blocks merge.

| Alternative requiring separate decision | Authority / owner / exact paths | Narrowest compliant variant in this PR |
| --- | --- | --- |
| Make company onboarding mandatory inside minimal Identity registration | Architecture Platform: `Canon/v1.0-identity-runtime-architecture-and-ownership-canon.md` §3; runtime `apps/identity-runtime/**` is a later owner task, not changed here | Keep Etap I independent; Etap II later application workflow. |
| Impose unique NIP globally / merge KRS incarnations / change provider primary or paid fallback | Architecture Platform: `Canon/v1.0-krs-registry-architecture-and-ownership-canon.md` §2–4; SRM owner for consumer `apps/srm/**` | Limit uniqueness to customer tax binding; preserve KRS entity identity and approved source policy. |
| New BOOTSTRAP lookup permission, invite/claim entry, billing or projection operation / implementation | Architecture Platform: `Canon/v1.0-operation-context-and-access-contract.md`, `Canon/registries/operation-access-matrix-v1.json`, producer `packages/platform-contracts/**`; SG Runtime and SRM Runtime adopt only in separate own paths/tasks | Do not add operation IDs/grants here; treat current AM-03/04/09/30 as target, require separate exact contract/adoption before effects. |
| Move assignment ownership into Identity or alter commercial two-product model | Architecture Platform: `Canon/v1.0-profitia-package-and-limits-management-canon.md` §3–5/11, `Canon/v1.0-spendguru-srm-target-architecture-canon.md`; Governance Source Layer routing | Keep membership in Identity and assignment in Limits, cross-DB reference/projection only; no second purchase for embedded SRM. |
| Activate Limits service/DB/source or Stage/Prod based on inventory | Architecture Platform / Governance: `Canon/registries/current-architecture-baseline-v1.json`, `Canon/registries/architecture-onboarding-v1.json`, `Canon/registries/architecture-environment-topology-v1.json`; actual future source path requires G1, not invented | Inventory remains dated facts; no registry/resource/onboarding changes in this task. |

Before first Development implementation: approve representation/claim/source policies, package/runtime G1 and routing, temporal/transition commercial policies, cross-DB/E1 producer and consumer contracts, schema/role/security/recovery and exact environment binding. Before deployment require independently reviewed artifact/CI and explicit deployment GO. Concrete SQL/provider/pricing is deferred; absent policy means no corresponding effect. Stage/Prod and payment checkout are separately authorised.

## Execution evidence and review gate

Pre-edit manifest validation: PASS, 51 active documents. Full ARCHITECTURE preflight: PASS, clean isolated branch at audited main, real host identity, three exact routes. Canonical begin registration `cmvux735h00003is6n9iec2yx`; returned conversation `pmos-task-v2:ecd189c6465b1f36edba7464c0252de1049037f7a751ff4b28affda28cb21e9b`. Registered require-begin preflight PASS before edits/provider audit. An initial PMOS test launch also hit a local IPC permission restriction before tests ran; it was rerun unchanged with the required local process access. One initial local begin-input preparation used the wrong working-directory-relative path and failed ENOENT before a registration existed; corrected locally, canonical begin registered once. No gate bypass or product mutation followed that error.

Post-edit validation/CI/PMOS closeout/PHR acknowledgement are reported only after execution in the PR handoff and final task report; this immutable source proposal cannot predeclare its later successful publication. PMOS/PHR completion establishes continuity, not owner acceptance or lifecycle runtime acceptance.

**STOP: OWNER REVIEW.** Required OWNER GO is for the exact candidate text/SHA, explicit CL semantics above and controlled main acceptance after fresh governance/CI checks. This task never merges. No SQL, migrations, MGBI/OpenAI calls, billing checkout, Render deploy/configuration, Neon changes/new resources, G1 onboarding, Stage/Prod activation or application edits are authorised/performed. Only required ARCHITECTURE PMOS/PHR continuity uses its canonical persistence path.
