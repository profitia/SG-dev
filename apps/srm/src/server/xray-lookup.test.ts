import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialDataMount, latestAvailableFinancialYear, VerclyKysMount, type FinancialData, type SectionEnvelope, type VerclyKysData } from "@profitia/srm-xray";
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

test("financial mount groups readable rows, converts PLN to thousands and keeps KYS independent", () => {
  const section: SectionEnvelope<FinancialData> = {
    status: "SUCCESS", source: { provider: "MGBI", model: "KRS-RDF", recordId: "record" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: "2025-12-31", warnings: [],
    data: { periods: [
      { from: "2024-01-01", to: "2024-12-31", scope: "standalone", documentId: "old:cfy", facts: [
        { metricCode: "BS_A_TA", amount: "2", currency: "PLN", unit: "THOUSAND_PLN" },
        { metricCode: "PALA_NPL", amount: "100", currency: "PLN", unit: "PLN" },
      ] },
      { from: "2025-01-01", to: "2025-12-31", scope: "standalone", documentId: "new:cfy", facts: [
        { metricCode: "BS_A_TA", amount: "3000", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_NPL", amount: "150", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_OAC_MAEC", amount: "222", currency: "PLN", unit: "PLN" },
        { metricCode: "PALA_UNKNOWN", amount: "1", currency: "PLN", unit: "PLN" },
      ] },
    ] },
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.equal(latestAvailableFinancialYear(section.data), "2025");
  assert.match(html, /Rachunek zysków i strat/);
  assert.match(html, /Aktywa/);
  assert.match(html, /Pasywa/);
  assert.match(html, /Zużycie materiałów i energii/);
  assert.match(html, /Aktywa razem/);
  assert.match(html, /3,00/);
  assert.match(html, /2,00/);
  assert.match(html, /tysiącach złotych/);
  assert.match(html, /Analiza wskaźnikowa/);
  assert.ok(!html.includes("PALA_UNKNOWN"));
});

test("financial mount starts with eight newest years and offers older columns", () => {
  const periods = Array.from({ length: 10 }, (_, index) => {
    const year = 2016 + index;
    return { from: `${year}-01-01`, to: `${year}-12-31`, scope: "standalone" as const, documentId: `doc-${year}`, facts: [
      { metricCode: "PALA_NRFS", amount: "1000000", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_OAC", amount: "500000", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_NPL", amount: "200000", currency: "PLN", unit: "PLN" },
      { metricCode: "BS_A_TA", amount: "3000000", currency: "PLN", unit: "PLN" },
    ] };
  });
  const section: SectionEnvelope<FinancialData> = {
    status: "SUCCESS", source: { provider: "MGBI", model: "KRS-RDF", recordId: "record" },
    retrievedAt: "2026-10-06T00:00:00Z", effectiveAt: "2025-12-31", warnings: [], data: { periods },
  };
  const html = renderToStaticMarkup(createElement(FinancialDataMount, { section }));
  assert.match(html, /Więcej lat \(2\)/);
  assert.match(html, /Przesuń tabelę w lewo/);
  assert.match(html, /Pokaż wykres: Zysk lub strata netto/);
  assert.match(html, />2018<\/th>/);
  assert.ok(!html.includes(">2016</th>"));
  assert.equal(latestAvailableFinancialYear(section.data), "2025");
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
