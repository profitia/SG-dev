import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialDataMount, VerclyKysMount, type FinancialData, type SectionEnvelope, type VerclyKysData } from "@profitia/srm-xray";
import { validateXrayRequest } from "./xray-lookup";

test("accepts a checksum-valid NIP as the only search value", () => {
  assert.deepEqual(validateXrayRequest({ identifier: "527-244-39-55" }), {
    identifier: { type: "NIP", value: "5272443955" },
  });
});

test("rejects invalid NIP without requiring company name or phone", () => {
  assert.throws(() => validateXrayRequest({ identifier: "5272443956" }), /kontrolna/);
  assert.throws(() => validateXrayRequest({ identifier: "0000217580" }), /kontrolna/);
  assert.throws(() => validateXrayRequest({ identifier: "123" }), /10 cyfr/);
});

test("financial mount shows the latest complete period with Polish labels and folds history", () => {
  const section: SectionEnvelope<FinancialData> = {
    status: "SUCCESS", source: { provider: "MGBI", model: "KRS-RDF", recordId: "record" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: "2025-12-31", warnings: [],
    data: { periods: [
      { from: "2024-01-01", to: "2024-12-31", scope: "standalone", documentId: "old:cfy", facts: [
        { metricCode: "BS_A_TA", amount: "2000", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_NPL", amount: "100", currency: "PLN", unit: "PLN" },
      ] },
      { from: "2025-01-01", to: "2025-12-31", scope: "standalone", documentId: "new:cfy", facts: [
        { metricCode: "BS_A_TA", amount: "3000", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_NPL", amount: "150", currency: "PLN", unit: "PLN" },
      ] },
    ] },
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.ok(html.indexOf("2025-01-01") < html.indexOf("2024-01-01"));
  assert.match(html, /Aktywa razem/);
  assert.match(html, /3(?:\u00a0|&nbsp;)000,00 zł/);
  assert.match(html, /<details/);
  assert.ok(!html.includes("<dt>BS_A_TA</dt>"));
});

test("KYS mount expands provider sanctions codes to list names", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "SUCCESS", source: { provider: "VERCLY", model: "KYS_NIP", recordId: "report" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: null, warnings: [],
    data: { correlationId: "request", reportId: "report", isComplete: true, queriedRegisters: [], stateAsOf: null,
      screenedLists: [{ name: "uk_ofsi_sanctions", type: "SANCTIONS", matched: false }] },
  };
  const html = renderToStaticMarkup(createElement(VerclyKysMount, { section }));
  assert.match(html, /UK Office of Financial Sanctions Implementation \(OFSI\)/);
  assert.ok(!html.includes("uk_ofsi_sanctions"));
});
