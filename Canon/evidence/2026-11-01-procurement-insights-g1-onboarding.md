# Procurement Insights — G1 ownership and routing onboarding

Status: **OWNER G1 GRANTED / GOVERNANCE SOURCE PREPARED / MAIN ACCEPTANCE PENDING**.

Task `ARCHITECTURE-INSIGHTS-G1-REQUEST-20261101`; profile **ARCHITECTURE**, workspace **SG-dev Architecture**, environment **development**, execution **local**. Authority repository `profitia/SG-dev`, pre-onboarding main `b965924a63fafb1a24b84ceb389dfd5e78648f57`. Future product execution uses the existing **SG2** profile; logical ownership is **Insights Domain**. No profile is created.

## Actual owner decision and approved scope

On 2026-11-01 the owner answered the explicit G1 question in this chat:

> G1 — GRANTED w opisanym zakresie governance

The question identified the formal ten-part request and the exact proposal SHA-256 `3d366128ba11874539fff7dd6a647c3c17ec7a31384b9687b7c8a40dc524f459`, all three routes, owner, repository, SG2 and ALIGNED classification. This is actual owner chat approval, not a GitHub review, inferred approval or merge permission. The host exposes no conversation identifier; it is explicitly null. The question item is recorded only as provenance, not as a substitute host ID.

Faithful question text projection (the two local file links are rendered as their labels):

Czy udzielasz **G1 — GRANTED** zgodnie z formalnym wnioskiem i dokładną propozycją wpisów — SHA-256 `3d366128ba11874539fff7dd6a647c3c17ec7a31384b9687b7c8a40dc524f459` — dla Procurement Insights, owner `Insights Domain`, repo `profitia/SG-dev`, przyszły profil `SG2`, klasyfikacja `ALIGNED`, ścieżki `apps/insights-runtime/**`, `packages/insights-contracts/**` i `.github/workflows/insights-ci.yml`? Zgoda obejmie wyłącznie cztery pliki onboardingu governance wskazane we wniosku oraz osobny Draft PR. Nie obejmuje tworzenia aplikacji ani pliku workflow, baz, zasobów, merge lub deploymentu.

Machine-readable decision receipt:

```json
{
  "date": "2026-11-01",
  "timezone": "Europe/Warsaw",
  "decision": "G1 — GRANTED",
  "sourceType": "EXPLICIT_OWNER_CHAT_REPLY",
  "questionItemId": "[\"request_user_input_async\",\"call_3a065401900440a49aacef04a6fe09e0\",0]",
  "hostConversationId": null,
  "answer": "G1 — GRANTED w opisanym zakresie governance",
  "approvedProposalSha256": "3d366128ba11874539fff7dd6a647c3c17ec7a31384b9687b7c8a40dc524f459",
  "referenceMainSha": "b965924a63fafb1a24b84ceb389dfd5e78648f57",
  "capability": "Procurement Insights",
  "logicalOwner": "Insights Domain",
  "onboardingProfile": "ARCHITECTURE",
  "futureCodeAllowedProjectKeys": [
    "SG2"
  ],
  "classification": "ALIGNED",
  "declaredTargetPaths": [
    "Canon/registries/current-architecture-baseline-v1.json",
    "Canon/v1.1-repository-routing-and-module-ownership-canon.md",
    "Canon/evidence/2026-11-01-procurement-insights-g1-onboarding.md",
    "scripts/governance/governance.test.mjs"
  ],
  "mainAcceptance": "PENDING",
  "mergeAuthorized": false,
  "runtimeAuthorized": false
}
```

## Exact approved registry entries

The three entries below are copied exactly from the approved JSON proposal, without broadening patterns, owners, profiles or responsibilities. The original proposal remains frozen with its pre-decision `PROPOSED_G1_NOT_GRANTED` status; this receipt records the subsequent real decision.

```json
[
  {
    "id": "INSIGHTS-BASE-001",
    "capability": "Procurement Insights",
    "name": "Procurement Insights Runtime",
    "pathPatterns": [
      "apps/insights-runtime/**"
    ],
    "currentOwner": "Insights Domain",
    "currentResponsibility": "Definitions, schedules, durable production orchestration, evidence, independent review, immutable publication and report history; consumes approved owner contracts without taking Forecast mathematics, host UI or CIC conversation ownership.",
    "baselineClassification": "ALIGNED",
    "parentSurfaceId": null,
    "cleanupReason": null,
    "classificationReferenceSha": "b965924a63fafb1a24b84ceb389dfd5e78648f57",
    "allowedProjectKeys": [
      "SG2"
    ]
  },
  {
    "id": "INSIGHTS-BASE-002",
    "capability": "Procurement Insights",
    "name": "Procurement Insights Contracts",
    "pathPatterns": [
      "packages/insights-contracts/**"
    ],
    "currentOwner": "Insights Domain",
    "currentResponsibility": "Versioned Insights API/DTO/schema contracts for explicit producer and consumer acceptance; no provider transport, platform authorization implementation or cross-owner private imports.",
    "baselineClassification": "ALIGNED",
    "parentSurfaceId": null,
    "cleanupReason": null,
    "classificationReferenceSha": "b965924a63fafb1a24b84ceb389dfd5e78648f57",
    "allowedProjectKeys": [
      "SG2"
    ]
  },
  {
    "id": "INSIGHTS-BASE-003",
    "capability": "Procurement Insights",
    "name": "Procurement Insights CI",
    "pathPatterns": [
      ".github/workflows/insights-ci.yml"
    ],
    "currentOwner": "Insights Domain",
    "currentResponsibility": "Future independent Insights verification workflow source; registration only, no workflow file or deployment pipeline created by governance onboarding.",
    "baselineClassification": "ALIGNED",
    "parentSurfaceId": null,
    "cleanupReason": null,
    "classificationReferenceSha": "b965924a63fafb1a24b84ceb389dfd5e78648f57",
    "allowedProjectKeys": [
      "SG2"
    ]
  }
]
```

Every existing surface, registry root field, frozen reference and transitional epoch remains unchanged. The new entries use the exact approved pre-onboarding main as classification reference. ALIGNED is explicitly owner-approved registration of planned source boundaries; it is not proof of implemented code. The existing post-epoch TRANSITIONAL policy for future deltas remains in force.

## Owner boundaries and producer/consumer acceptance

Insights Domain owns definitions, schedules, production orchestration, evidence, independent review, immutable publication, distribution and report history. Forecast Core/Library retains methods, results, calibration/verification and shared forecast cache; separate acceptance of 7D mathematics is required. SG Runtime/AppShell owns host presentation, navigation, session and consumer adapters. SRM retains supplier data and private organisation relationships, including X-Ray/ADP projections. No private cross-owner table access is adopted.

CIC owns conversation and context policy and consumes only entitled published report context; it does not produce, review or distribute reports. Provider execution remains within the separately accepted consumer/adapter boundary. Identity, E1 and Package & Limits retain admission, revocation, rights and metering. G1 adopts no new operation, grant, connector or entitlement. Producer and consumer contracts still require their owners' explicit versioned acceptance before integration.

## Canon decisions and authority

CIC PR [#18](https://github.com/profitia/conversational-intelligence-core/pull/18): owner approved candidate `ac731ffe0dad4874d0df212534b43f1eb0f1419c` with C1–C3; documentary acceptance source `6195f5aac547121ba816956b559a9e4dfe70b09c`. Insights PR [#847](https://github.com/profitia/SG-dev/pull/847): owner approved candidate `2d3b043c9fdfedf84d8ab5ecbbbdc311083b00ec` with I1–I4; documentary source `d143ca28c583c7f65e93e7fb4a2936f079d0cc33`. Both remain Draft and unmerged at this checkpoint. Owner acceptance is distinct from authority-main acceptance, accepted integration contracts and runtime implementation. C1–C3 and I1–I4 remain binding future gates.

## Bounded source change and verification

Only the four declared files in the decision receipt change. No ACTIVE manifest entry is added; the existing manifest already loads the routing canon and baseline. No application, package or workflow file is created. No Forecast mathematics, CIC runtime, product database/schema/role/grant, Render/Neon resource, paid model call, deployment or merge is authorized or performed.

The pre-mutation canonical bridge and require-begin passed with the registered task. The approved in-memory proposal passed registry and project-boundary schema validation and left the routing of all **3652** tracked pre-onboarding source paths identical. Committed regression tests verify actual SG2 resolution, ARCHITECTURE/SRM denial, sibling/traversal/conflict rejection and preservation of the original registry and routing. Local and remote final results are recorded in the separate PMOS/PHR closeout and Draft PR; this source checkpoint does not pre-claim CI success or main acceptance.

## Continuity and next gate

Canonical begin registration `cmvxsiu200000gz27pwyujq9x`; task-scoped conversation `pmos-task-v2:b5b629b5613d3e49bb1fd4592f57de4100e026147fce129d1be61a17106dccf1`. ARCHITECTURE continuity uses its existing PMOS with ordinary runtime role and its dedicated PHR clone. MEMOROS is disabled by the registered profile. The approved continuation stays within this task's original four exact governance targets.

A separate Draft PR carries this onboarding. Routing becomes available to other tasks only after separately authorized controlled main acceptance. G1 does not grant merge. Future Insights implementation, 7D acceptance, contract adoption, quality/pilot verification and any infrastructure work require separate instructions and their own lifecycle gates. Stop after governance delivery.
