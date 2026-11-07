# Oil & Asphalt Report Canon v0.5 — owner-approved canonical adoption

Status: ACCEPTED DECISION; effective ACTIVE authority is the correctly merged `profitia/SG-dev/main` manifest. Date:2026-11-06. Project/owner: ARCHITECTURE, Governance Source Layer; substantive acceptance: Product Owner.

## Owner decision and exact input

The owner explicitly issued **APPROVED FOR CANONICAL ADOPTION AND GITHUB PUBLICATION**, including canonical creation, ACTIVE status effective on main, scoped v0.4 supersession, manifest/references, evidence, commit/push/PR/merge, GitHub publication and required PMOS/PHR. No repeat substantive review or owner approval is required. Required repository/independent CI controls remain binding.

Source attachment: `Procurement_Oil_Insight_Report_Canon_v0.5_EDITORIAL_QUALITY_DRAFT.md`, 51362 UTF-8 bytes, SHA-256 `2bfb236530595a9fd407f5fd9b4b51aa9ca82944ee5feeaa1173e8a8744e7bd4`.

Accepted canonical [v0.5](../v0.5-procurement-oil-insight-report-canon.md): SHA-256 `5edb1848d3abd5b90ce7bcee2e894e764b354a6482665d8307e1f6d42a42ad41`. Input bytes are preserved locally and identified in the PMOS/PHR task record. Only status/decision/precedence language and historical-version labels are transformed; business sections1–9 and the normative examples in section13 (excluding the adoption footer) remain byte-identical. Section10 keeps its implementation guidance as a separate future task; its release prohibition is clarified to implementation merges so it does not contradict the explicit approval of this documentation merge. Section11 keeps every business comparison unchanged. No new substantive requirements are introduced.

## Effective scope and historical integrity

v0.5 replaces only the editorial/analytical Oil & Asphalt specialization: approximately8000–10000 characters, preferred3–4 readable A4 pages, causal explanation and context, natural Polish, numbered reader citations and temporal clarity. Eight visible blocks, nine logical elements, Tuesday–Monday windows, absolute asOf, Forecast/Market Data/Source Hub/E1 ownership, evidence, licences and safety remain preserved. Procurement Insights parent activation, runtime/Composer/renderer implementation and another report are outside this task.

Historical [v0.4](../v0.4-procurement-oil-insight-report-canon.md) remains byte-identical: SHA-256 `7ad7d1695e7fa608a38ae17b01b26cd9fd43e201e6b79d64a9a555d762399c4d`; [original adoption evidence](2026-11-05-oil-report-canon-v04-adoption.md) and prior PMOS/PHR records are untouched. Its historical ACTIVE wording is not rewritten: the current manifest is the authoritative active-version index. The stable ID `procurement-oil-insight-report-canon` now points to v0.5 at the same loadOrder480/dependencies/owner/appliesTo; a SUPERSEDED `procurement-oil-insight-report-canon-v0.4` history entry points to the stable active ID. All unrelated manifest entries are unchanged.

## Governed execution and boundaries

Fresh authority base: `e4adaddfedbd6e54fa83981560f84ffb867199b2`. Exactly three Canon paths resolve Governance Source Layer / ALIGNED; no legacy exception or new module. Initial and registered preflight PASS. PMOS registration: `cmw53siul00001403nzg015x2`; task `ARCH-OIL-CANON-V05-ADOPTION-20261106`; derived conversation `pmos-task-v2:5d1562875669541e9846e4bd57a85edc0aa899528bef102a8328cf71a117fcd0`; actual host `01a19692-9701-78a0-ba59-17da83872451`. ARCHITECTURE continuity uses its ordinary `architecture_pmos_runtime` role and dedicated local state/PHR clone. PMOS/PHR are required; MEMOROS disabled by the registered profile.

Validation covers manifest/dependencies, exact approved business-section parity, scoped supersession/history fingerprints, local references and the documentation-only diff, followed by required actual GitHub CI and real-main readback. Exact PR/CI/merge and independent final PMOS/PHR receipts are recorded in the final handoff rather than asserted before execution.

No Composer, Forecast, Source Hub or product-source change; no new provider/OpenAI calls; no Render/Neon product configuration, schema, E1 or permissions; no application deployment or customer report publication. Monitoring/Sentry: NOT_APPLICABLE, documentation only, no new runtime operation to instrument.

## Necessary governance test continuity

The existing ECR routing regression compared every prior manifest entry to a frozen pre-adoption snapshot, so the authorized Oil v0.5 update correctly exposed one stale global-version assumption. `scripts/governance/ecr-routing.test.mjs` now allows a later active version only with explicit SUPERSEDED history, unchanged historical bytes and unchanged owner, appliesTo, dependencies and loadOrder. Negative cases reject missing history, owner/dependency drift and modified historical bytes. All ECR-specific approval, routing and administrative-authority checks remain unchanged; no production validator or CI policy/workflow is modified.

This fourth path has its own required, non-duplicate PMOS registration: task `ARCH-OIL-CANON-V05-CI-CONTINUITY-20261106`, registration `cmw541mfd0000gskwj0p4d7e4`, conversation `pmos-task-v2:43dd8674389e5c05bdb1b977cd13376639d01955c9764d10ac6cf07d05d62a0c`. Owner authorization for necessary governance tests and PMOS/PHR is part of the same explicit v0.5 adoption request. It is not a new substantive acceptance gate. Both task records are closed through the existing canonical lifecycle.
