# Platform Source Hub / Newsfeed — final Stage 1B owner approval, G1 and infrastructure baseline

**Decision: OWNER APPROVED / G1 GRANTED — GOVERNANCE AND DOCUMENTATION ONLY.**
Date: 2026-11-03. Decision ID: `ARCH-SOURCE-HUB-G1-FINAL-ACTIVATION-20261103`.
Task: `ARCHITECTURE-SOURCE-HUB-STAGE1B-FINAL-ACTIVATION-20261103`.
Host: `01a19fe2-0dc1-7ca2-8acf-28504684e3c1`. Repository: `profitia/SG-dev`. Producer: Architecture Platform / ARCHITECTURE / Development.

## Owner instruction and exact accepted source

The owner supplied **PLATFORM SOURCE HUB / NEWSFEED — STAGE 1B FINAL ACTIVATION & INFRASTRUCTURE BASELINE UPDATE** as the request itself in this chat, explicitly accepting the three proposals at PR #878 candidate **b40564130fe7b6ced4d7df233dd6749653846114**, granting the three exact G1 surfaces, authorizing infrastructure-document updates and controlled main acceptance, and prohibiting all Neon/Render mutation and backend implementation.

Owner-request SHA256: **376a283842d9935b3565c9211d1eaab0876b0662a42e7d6b3ef21d202f6fa9d2**. It is an actual human instruction, not inferred approval from CI, PMOS, a proposal or a wrapper. The generic SG2 wrapper selects no ownership contrary to this task's explicit ARCHITECTURE producer identity.

Before mutation, current PR HEAD matched that candidate and all four proposal/G1 source files matched its exact blobs and SHA256:

| Approved source at b4056413 | Git blob | SHA256 |
| --- | --- | --- |
| Hub v1.0 canon | 6272deae05525a61794a40e91ef1b0b7d21a406e | 535631d21b85b57c7b017cae4a56e78eb4eb100cda7972d3d89de48d647b51b4 |
| Newsfeed v1.1 amendment | 13d698a13cc52018498b90a98a5af0467f2fbcd0 | 63a61ba89b0ee500d44930f31e0a24a64ae531ff848fc8c1f0f957947ae3693f |
| Five-family catalogue | b47ad1ddb8debd03c9ffd80d0c9c8d67d24354e4 | b9cc3ca170f898c4afd4356e4d3ff7686759ce55f5b32fcaf822fdea4e76d36b |
| Exact G1 proposal | 4adbef7da667f0f07a5872e2e12038a11fdf2548 | 33f8605fbebdc24efc60faf70cd260420653cf2e0967555ac1c03856f43d0daf |

Business boundaries and contract-family payloads are preserved. Changes to the accepted canon/amendment are activation metadata, canonical relative links, approved governance status and the explicitly requested current infrastructure reference. No substantive provider, product, E1, Forecast, licence or consumer authority expansion. Tests compare the approved business sections and catalogue payloads against that immutable source.

## Canonical adoption

- [Platform Source Hub Canon v1.0](../v1.0-platform-source-hub-business-and-architecture-canon.md).
- [Newsfeed responsibility amendment v1.1](../v1.1-newsfeed-source-hub-responsibility-amendment.md), following and preserving the exact active Newsfeed v1.0 base.
- [Contract-family design catalogue](../registries/platform-source-hub-contract-families-v1.json): catalogue active; future family runtime versions remain proposed/unimplemented.
- [Observed infrastructure baseline](../registries/newsfeed-source-hub-environment-baseline-v1.json): metadata authority only, not execution-topology or runtime admission.
- [Manual infrastructure guide](../runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md), updated in place; no duplicate-project instructions.

Manifest records add only the four documents above, dependency order452/454/460/470. Existing active entries/dependencies remain unchanged. Central onboarding adds one Platform Source Hub record. The historical G1 proposal points to current authority rather than acting as a competing registry.

| G1 surface | Exact pattern | Owner / permitted producer |
| --- | --- | --- |
| SOURCE-HUB-BASE-001 | apps/platform-source-hub/** | Architecture Platform / ARCHITECTURE |
| SOURCE-HUB-BASE-002 | packages/platform-source-hub-contracts/** | Architecture Platform / ARCHITECTURE |
| SOURCE-HUB-BASE-003 | .github/workflows/platform-source-hub-ci.yml | Architecture Platform / ARCHITECTURE |

Rows are ALIGNED. Classification reference is actual pre-onboarding main **785c9b5175e65840b4c5a9efb983e0db0972d3e1**. Existing rows, epoch and global metadata are preserved. No runtime/package/workflow is created. SG2/SRM consumer writes remain denied.

**Authority condition:** ACTIVE becomes effective through controlled authority-main acceptance and independent actual-main readback. A local file/branch status, earlier green CI or PMOS does not satisfy it. Final PR SHA, required CI, freshness/preflight, merge and actual-main evidence are recorded in the task handoff/PR after execution; no future SHA is invented in this source document. A BLOCKED final gate prevents merge.

## Verified infrastructure and remaining owner work

The preceding read-only provisioning-verification task completed a safe metadata snapshot. All four owner-created Neon projects exist, AWS Frankfurt / PG18; all six branches expose neondb through metadata:

| Capability / environment | Project ID | Branch ID | Endpoint ID |
| --- | --- | --- | --- |
| Newsfeed Development | shiny-bonus-85532609 | br-wispy-bonus-b9ohunab | ep-mute-night-b9o332my |
| Newsfeed Staging | shiny-bonus-85532609 | br-frosty-cell-b9hzdh6e | ep-wandering-term-b9v57pi9 |
| Newsfeed Production | twilight-wind-91374750 | br-noisy-pine-b9i0865t | ep-aged-sun-b9ooczkd |
| Source Hub Development | delicate-queen-44677134 | br-orange-salad-ba2llks7 | ep-noisy-darkness-barhqoqw |
| Source Hub Staging | delicate-queen-44677134 | br-snowy-breeze-bahrkgrr | ep-noisy-grass-baszxszx |
| Source Hub Production | crimson-band-46697896 | br-flat-resonance-b9dh28bf | ep-empty-water-b9yjwui8 |

Do not use the previous Newsfeed Development br-solitary-star-b9i144lk / ep-restless-sea-b9ducsrh binding. Current metadata, not historical labels, controls the documentation. No assertion of data transfer/deletion or empty schema is made.

Neon: all endpoints idle,0.25–8CU, timeout0 (global default300s). All projects history1day, no branch protection, IP list empty/public connections not blocked. Protection and proposed7day Production history, budget caps, actual app/migrator roles, network/access policy, secrets, backup/RPO/RTO and tested recovery remain **manual owner work**. No data, role privileges or SQL were inspected; a catalogue owner name is not a runtime-role acceptance.

Render owner-confirmed workspace PROFITIA WORKSPACE / tea-d7lps8rbc2fs73cn80dg; exact project **Source Hub / prj-dbl079ou01pc73eg0ffg**. Separate visible UI readback:
- Development: evm-dbl079ou01pc73eg0fgg.
- Staging: evm-dbl07c0u01pc73eg0kh0.
- Production: evm-dbl07lvf3r2c7383en80.

Each has0services/0environment groups. Environment settings show Default permissions and Allowed cross-environment traffic in all three, including Production. Owner must configure isolation and Production Protected before runtime. Connector project/environment metadata is unavailable: **OWNER_CONFIRMATION_REQUIRED** for that API channel; visible UI readback is separately **UI_VERIFIED_READ_ONLY**, not an API claim. No connector service is bound to these environment IDs. Plan, future service regions and actual runtime configuration are not verified.

Architecture PMOS remains the registered separate continuity database; product projects cannot replace it. Staging/Production product execution profiles and services are not activated by this metadata baseline.

## Preservation, validation and stage boundary

All23 accepted NewsAPI file blobs remain unchanged against candidate1a87951fbe5a513f15adce02fb169adf3bf70050 / accepted main ef5d12e458309fcd4d6dddf76be95c03cfca7678. NewsDiscovery0.1.0 remains the implemented contract. No copy, move, provider call or key read. Existing Insights/Oil draft PRs and their independent owner conditions remain untouched. Forecast Core, Benchmark/Macrobond, SG Runtime/SRM, CIC, E1/Source and Package & Limits authority are preserved.

Validation covers actual/simulated routing and negative boundaries, exact approved business content/catalogue payloads, all23 NewsAPI blobs, append-only governance records, dependency order, real resource bindings and guide links. Appropriate offline connector/governance/CI checks and independent PMOS/PHR closeout are required before claiming completion.

All Neon/Render creation/configuration is **HUMAN_OWNER_ONLY**. No provider resource/secret/SQL/schema/role/grant/deploy/restart/reset/delete operation is authorized or performed. Observability: **NOT_APPLICABLE** to governance/documentation; runtime instrumentation and business acceptance remain future gates.

Source Hub Runtime and Newsfeed Backend implementation may start only in a separate Stage2 task after its own exact contracts, E1/admission, licence/cost, role/isolation/recovery and executable backend gates. Stage2 is not started here.
