import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialHealthArea, FinancialHistory, FinancialDataMount, healthGroups, indicatorContent, indicatorPresentation, historyPoints, historyPlot, financialValue, comparisonText,
  type FinancialHistoryPoint, type FinancialFactEvidence, type SupplierReportData } from "@profitia/srm-xray";
import { FinancialIndicatorMethodology } from "../../node_modules/@profitia/srm-xray/src/financial-indicator-dialog";
import { definitions, FINANCIAL_INDICATOR_CODES } from "./financial-indicators";

const evidence: FinancialFactEvidence = { ref: "opaque-public-fact", documentRef: "opaque-public-document", metricCode: "BS_A_CA", periodStart: "2025-01-01", periodEnd: "2025-12-31", scope: "standalone", amount: "123", sourceAmount: "-123", currency: "PLN", unit: "PLN", validation: "VERIFIED", normalization: "NORMALIZED_CONFIRMED", normalizationRule: "EXISTING_RULE", reasonCode: null };
function point(year: number, value: string | null = "1.5", overrides: Partial<FinancialHistoryPoint> = {}): FinancialHistoryPoint {
  return { code: "CURRENT_RATIO", periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, year: String(year), scope: "standalone", value,
    status: value === null ? "UNAVAILABLE" : "AVAILABLE", unit: "RATIO", importance: 3, reasonCode: value === null ? "MISSING_FIELD" : null, formulaVersion: "1.2", documentRef: "opaque-public-document", definitionRef: { code: "CURRENT_RATIO", formulaVersion: "1.2" }, evidence: [evidence], comparison: { status: "NOT_COMPARABLE", previousPeriod: null, delta: null, direction: "NO_COMPARISON", unit: "RATIO", reasonCode: "NO_PREVIOUS_PERIOD" }, ...overrides };
}
function comparable(year: number, value: string): FinancialHistoryPoint {
  return point(year, value, { comparison: { status: "COMPARABLE", previousPeriod: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }, delta: "0.5", direction: "UP", unit: "RATIO", reasonCode: null } });
}
function areaHtml(points: FinancialHistoryPoint[], selected = { from: "2025-01-01", to: "2025-12-31" }) {
  return renderToStaticMarkup(React.createElement(FinancialHealthArea, { area: "liquidity", financial: { status: "SUCCESS", source: "MGBI", freshness: { retrievedAt: null, checkedAt: null, cacheExpiresAt: null, retentionUntil: null, freshness: "UNKNOWN", readSource: "STORED", lastRetrievalMethod: "UNKNOWN" }, completeness: "UNKNOWN", limitations: [], mappingVersion: null, sourceVersion: null, representationVersion: null, periods: [], history: [{ code: "CURRENT_RATIO", points, reasonCode: null }] } satisfies SupplierReportData["financial"], scope: "standalone", selectedPeriod: selected }));
}
test("exactly 16 existing codes grouped 4/4/7/1; units and importance match backend definitions", () => {
  const codes = Object.values(healthGroups).flat();
  assert.equal(codes.length, 16); assert.equal(new Set(codes).size, 16);
  assert.deepEqual([...codes].sort(), [...FINANCIAL_INDICATOR_CODES].sort());
  assert.deepEqual(Object.values(healthGroups).map(group => group.length), [4, 4, 7, 1]);
  for (const definition of definitions) {
    assert.ok(indicatorContent[definition.code]?.formula); assert.ok(indicatorContent[definition.code]?.description);
    assert.deepEqual(indicatorPresentation[definition.code], { unit: definition.unit, importance: definition.importance });
  }
});
test("formatting preserves null, exact decimal zero, negative signs and large amounts without financial arithmetic", () => {
  assert.equal(financialValue(null, "PLN"), "Brak wartości");
  assert.equal(financialValue("0", "RATIO"), "0 ×");
  assert.equal(financialValue("-0.25", "PERCENT"), "−0,25 %");
  assert.equal(financialValue("-1234567.89", "PLN").replaceAll(/\s/g, ""), "-1234567,89PLN");
  assert.equal(financialValue("9007199254740993123.456789", "PLN").replaceAll(/\s/g, ""), "9007199254740993123,456789PLN");
  for (const [unit, label] of [["DAYS", "dni"], ["PERCENTAGE_POINTS", "p.p."], ["RATIO", "×"], ["PLN", "PLN"]] as const) assert.ok(financialValue("2.5", unit).endsWith(label));
});
test("cards retain unavailable definitions, reasons and importance; no fabricated zero, score or history placeholders", () => {
  const html = areaHtml([point(2025, null)]);
  assert.match(html, /Brak danych/); assert.match(html, /Kluczowy/); assert.equal(html.includes("brakuje potrzebnej pozycji"), false);
  assert.equal((html.match(/Zobacz historię/g) ?? []).length, 4); assert.match(html, /Jak to obliczamy/);
  assert.equal(html.includes('class="health-history"'), false); assert.equal(html.includes("0 ×"), false);
  assert.equal(html.includes("AI"), false); assert.equal(html.includes("Siła finansowa"), false);
});
test("selected values use full dates and exact scope; no fallback to latest or another statement basis", () => {
  const html = areaHtml([point(2024, "2"), point(2025, "0"), point(2025, "999", { scope: "consolidated" })]);
  assert.match(html, /health-card-value[^>]*>0,0</); assert.equal(html.includes("999"), false);
  const missing = areaHtml([point(2024, "2")]); assert.match(missing, /Brak danych/); assert.equal(missing.includes("2 ×"), false);
});
test("history preserves all periods in ascending order, scopes and unavailable gaps", () => {
  const points = historyPoints([point(2025, null), point(2023, "-2"), point(2024, "0"), point(2025, "999", { scope: "consolidated" })], "CURRENT_RATIO", "standalone");
  assert.deepEqual(points.map(p => p.year), ["2023", "2024", "2025"]); assert.equal(points[2].value, null);
  assert.equal(historyPlot(points).positioned[2].y, null);
  const years = Array.from({ length: 12 }, (_, i) => point(2014 + i)); assert.equal(historyPoints(years, "CURRENT_RATIO", "standalone").length, 12);
});
test("segments require backend COMPARABLE, exact previous period, same document/scope/unit/methodology and adjacent years", () => {
  const old = point(2024, "0"), current = comparable(2025, "-2");
  assert.equal(historyPlot([old, current]).segments.length, 1);
  for (const status of ["UNKNOWN", "NOT_COMPARABLE"] as const) assert.equal(historyPlot([old, { ...current, comparison: { ...current.comparison, status } }]).segments.length, 0);
  for (const changes of [{ documentRef: "other-document" }, { scope: "consolidated" as const }, { unit: "PLN" as const }, { formulaVersion: "1.1" }, { status: "UNAVAILABLE" as const }, { periodStart: "2025-02-01" }]) assert.equal(historyPlot([old, { ...current, ...changes }]).segments.length, 0);
  assert.equal(historyPlot([point(2023), current]).segments.length, 0);
  assert.equal(historyPlot([old, { ...current, comparison: { ...current.comparison, previousPeriod: { from: "2024-02-01", to: "2024-12-31" } } }]).segments.length, 0);
});
test("history is also a full-period table with zero/negative values and honest UNKNOWN explanation", () => {
  const points = [point(2024, "-2"), point(2025, "0", { comparison: { ...point(2025).comparison, status: "UNKNOWN", reasonCode: "DOCUMENT_COMPARABILITY_UNCONFIRMED" } })];
  const html = renderToStaticMarkup(React.createElement(FinancialHistory, { name: "Płynność", points, selectedPeriod: { from: "2025-01-01", to: "2025-12-31" } }));
  assert.match(html, /<table/); assert.match(html, /2024-01-01/); assert.match(html, /-2 ×/); assert.match(html, /0 ×/); assert.match(html, /Wybrany okres/);
  assert.match(html, /Porównywalność nieustalona/); assert.match(html, /korekt/); assert.equal(html.includes("data-comparable-segment"), false);
  assert.match(html, /tabindex="0"/); assert.match(html, /role="button"/);
});
test("one point has no artificial trend graph; no calculated points retains reasons and definitions", () => {
  for (const points of [[point(2025)], [point(2024, null), point(2025, null)], []]) {
    const html = renderToStaticMarkup(React.createElement(FinancialHistory, { name: "Test", points }));
    assert.equal(html.includes("<svg"), false); assert.match(html, /Brak wystarczających danych historycznych/);
  }
});
test("changes are backend deltas in pp, ratio, PLN and days with neutral directions", () => {
  for (const unit of ["PERCENTAGE_POINTS", "RATIO", "PLN", "DAYS"] as const) for (const direction of ["UP", "DOWN", "UNCHANGED"] as const) {
    const p = comparable(2025, "100"); p.comparison = { ...p.comparison, delta: "-0.75", unit, direction };
    assert.ok(comparisonText(p).includes(financialValue("-0.75", unit))); assert.equal(comparisonText(p).includes("korzyst"), false);
  }
  const p = comparable(2025, "100"); p.comparison.status = "UNKNOWN"; assert.equal(comparisonText(p).includes("0,5"), false);
});
test("details expose only safe fact projection with validation and unchanged source signs; opaque refs remain hidden", () => {
  const html = renderToStaticMarkup(React.createElement(FinancialIndicatorMethodology, { code: "CURRENT_RATIO", point: point(2025), selectedPeriod: { from: "2025-01-01", to: "2025-12-31" } }));
  for (const content of ["Aktywa obrotowe", "Normalizacja potwierdzona", "Zweryfikowana", "123 PLN", "-123 PLN", "1.2"]) assert.ok(html.includes(content), content);
  assert.equal(html.includes("opaque-public"), false); assert.equal(html.includes("EXISTING_RULE"), false);
});
test("legacy indicators honor host full-period selection and retain uncoded cash-flow definition/XLSX", () => {
  const periods = [2025, 2024].map(year => ({ from: `${year}-01-01`, to: `${year}-12-31`, scope: "standalone" as const, documentId: `PRIVATE_${year}`, facts: [{ metricCode: "BS_A_CA", amount: "1000", unit: "PLN", currency: "PLN" }, { metricCode: "PALA_NRFS", amount: "1000", unit: "PLN", currency: "PLN" }] }));
  const indicators = [point(2025, "999"), point(2024, "2")];
  const html = renderToStaticMarkup(React.createElement(FinancialDataMount, { section: { status: "SUCCESS", retrievedAt: null, effectiveAt: null, warnings: [], data: { periods, indicators } }, selectedPeriod: periods[1], selectedScope: "standalone", onDownloadExcel: async () => {} }));
  assert.match(html, /Pokrycie zobowiązań przepływami operacyjnymi/); assert.match(html, /Pobierz do Excela/);
  assert.ok(html.includes("2,00×")); assert.equal(html.includes("999,00×"), false); assert.match(html, /data-selected-period="true"/); assert.equal(html.includes("PRIVATE_"), false);
});
