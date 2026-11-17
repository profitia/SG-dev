# Procurement Insights editorial integration

The [approved Narrative & Editorial Canon v1.0](../../../Canon/v1.0-procurement-insights-narrative-and-editorial-canon.md) governs narrative quality across categories. Its §6.5 instruction is embedded verbatim in `src/editorial.mjs`; the packaged runtime never needs GitHub access. The full ED-01–ED-12 checklist runs as an internal self-check in the same existing generation. No second model, paid reviewer or rewrite request is added.

`createComposer.prepare` combines that universal instruction with the existing Oil & Asphalt adapter and existing strict eight-section response schema. Eight sections and numerical prose restrictions remain properties of that report contract. The universal instruction/rubric imposes no page, character or section count. Source projection, forecast mathematics, reference IDs, input/output schema, exact counter binding, ceilings, settlement and retry policy are unchanged. The longer body still fails closed at the admitted body/token/budget limits. A versioned editorial profile and canon digest are attached to internal preparation/generation metadata. Future preparations use the new instruction; stored outputs and immutable historical artifacts are not rewritten.

New editorial rules take precedence for style, repetition, prominence of limitations and buyer usefulness. Existing market specializations, source/evidence/permission contracts and publication responsibilities retain their authority. No historical canon is rewritten or superseded globally.

## Quality Gate

The existing HARD checks still reject bad lineage, malformed/missing sections, numbers/internal numerical claims and invalid refs. Valid refs alone do not prove a statement true: causal accuracy, chronology, headline depth and factual meaning remain subject to the existing human review with the supplied evidence.

The additive `editorial` assessment records every ED criterion and its review question. Concrete diagnostic narration, internal IDs in prose, the specified empty defensive openings and duplicated substantive sentences across sections produce located `NEEDS_REVISION` findings. These are deterministic findings, not a word-frequency score. Brief summaries and repeated citations alone are not penalized.

No factual inputs produce `INSUFFICIENT_MATERIAL`; nonempty but potentially inadequate evidence remains `HUMAN_ASSESSMENT_REQUIRED`. Missing forecast/comparison data does not automatically invalidate otherwise useful analysis. Remaining language, mechanism, context, action/rationale/risk/reassessment and semantic checks stay `HUMAN_REQUIRED`. No automated result claims `AKCEPTOWALNY REDAKCYJNIE`.

For compatibility the top-level `PASS_WITH_HUMAN_REVIEW` still means structural validation permits an internal draft. It does not override `editorial.status` or permit publication. `semanticReview: HUMAN_REQUIRED`, `automaticPublication: false` and the existing independent review/publication path remain in force. The Quality Gate neither rewrites prose nor initiates another provider call.

## Offline acceptance

`tests/editorial.test.mjs` verifies actual prepared API/counter bytes, exact §6.5 and ED-question parity, approved substantive-section digest, unchanged facts/schema/reference contracts, hard failures and ED/AC regression cases. All AC-01–AC-12 have controlled examples. Oil fixtures cover conflicting supply/stocks, headline depth, missing forecast/comparison, diagnostic narration and syndication; copper/wheat examples exercise the same universal quality layer with different category mechanisms. They do not add unsupported report definitions to the public Oil API.

`tests/fixtures/editorial.json` contains authored illustrative before/after drafts on identical controlled facts, explicitly marked as neither model output nor market data. The retained legacy instruction is compared with the new request on identical evidence. These tests establish technical integration and deterministic findings. They do not measure old-versus-new model behavior, semantic truth detection or LIVE quality improvement. Existing evidence/regression tests continue to check temporal and numerical integrity. No historical report job is accessed or changed by these tests.

Run the existing Insights CI workflow for the isolated PostgreSQL, API, renderer and full regression checks. A new LIVE generation requires its own current admitted budget/Source authorization; this task does not renew historical limits.
