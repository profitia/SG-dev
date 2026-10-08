import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveSummary, executiveSummary, FinancialHealthArea, healthGroups, indicatorPresentation, VerclyKysMount,
  type ExecutiveSummaryInput, type FinancialFactEvidence, type FinancialHistoryPoint, type FinancialData, type VerclyKysData } from "@profitia/srm-xray";
import { FinancialDashboard } from "../../node_modules/@profitia/srm-xray/src/financial-dashboard";
import { snapshotFact } from "../../node_modules/@profitia/srm-xray/src/supplier-snapshot";
import { kysStateDate } from "../../node_modules/@profitia/srm-xray/src/mounts";
import { indicatorGroups } from "../../node_modules/@profitia/srm-xray/src/financial-indicator-content";

function fixture(): ExecutiveSummaryInput {
  const from = "2025-01-01", to = "2025-12-31", documentRef = "PRIVATE_DOCUMENT";
  const fact = (metricCode: string, amount = "100000"): FinancialFactEvidence => ({ ref: `PRIVATE_${metricCode}`, documentRef,
    metricCode, periodStart: from, periodEnd: to, scope: "standalone", amount, sourceAmount: amount,
    currency: "PLN", unit: "PLN", validation: "VERIFIED", normalization: "SOURCE_VALUE", normalizationRule: null, reasonCode: null });
  const facts = [fact("PALA_NRFS"), fact("PALA_NPL", "-3000"), fact("BS_A_CA"), fact("BS_LAE_LAPFL_STL", "40000")];
  const freshness = { retrievedAt: "2026-10-07T12:00:00Z", checkedAt: "2026-10-07T12:00:00Z", cacheExpiresAt: "2026-10-14T12:00:00Z", retentionUntil: null,
    freshness: "FRESH" as const, readSource: "STORED" as const, lastRetrievalMethod: "CACHE" as const };
  const history = Object.values(healthGroups).flat().map(code => {
    const presentation = indicatorPresentation[code];
    const point: FinancialHistoryPoint = { code, periodStart: from, periodEnd: to, year: "2025", scope: "standalone", documentRef,
      ...presentation, status: "AVAILABLE", value: code === "NET_WORKING_CAPITAL" ? "60000" : "20", reasonCode: null,
      formulaVersion: "existing-formula", definitionRef: { code, formulaVersion: "existing-formula" },
      evidence: code === "NET_WORKING_CAPITAL" ? facts.slice(2) : [facts[0]],
      comparison: { status: "COMPARABLE", reasonCode: null, previousPeriod: { from: "2024-01-01", to: "2024-12-31" }, delta: "7", unit: "PERCENTAGE_POINTS", direction: "UP" } };
    if (code === "REVENUE_YOY") point.evidence = [facts[0], { ...facts[0], ref: "PRIVATE_PRIOR", periodStart: "2024-01-01", periodEnd: "2024-12-31", amount: "80000" }];
    return { code, reasonCode: null, points: [point] };
  });
  return { nip: "8650004194", entityType: "COMPANY", scope: "standalone", selectedPeriod: { from, to }, kysStatus: "NOT_REQUESTED", kysHasData: false,
    metadata: { schemaVersion: "1.0", nip: "8650004194", entityType: "COMPANY", financial: { status: "SUCCESS", source: "MGBI", freshness,
      completeness: "COMPLETE", limitations: [], mappingVersion: "existing-mapping", representationVersion: "PRIVATE_VERSION", sourceVersion: "PRIVATE_SOURCE",
      periods: [{ from, to, year: "2025", scope: "standalone", documentRef, facts }], history },
      kys: { status: "NOT_REQUESTED", source: "VERCLY", freshness: { ...freshness, freshness: "ABSENT" }, completeness: "UNKNOWN", lastAttemptStatus: null, lastAttemptAt: null, limitations: [], reportAvailable: false } } };
}

const render = (input: ExecutiveSummaryInput) => renderToStaticMarkup(React.createElement(ExecutiveSummary, { input, onSource: () => {}, onIndicator: () => {}, onDetails: () => {}, onFinance: () => {} }));
test("Snapshot formats only the unchanged selected facts, preserving exact values, growth and evidence", () => {
  const input = fixture(), before = JSON.stringify(input), model = executiveSummary(input);
  assert.deepEqual(model.facts.map(f => f.id), ["revenue", "net", "working-capital"]);
  assert.deepEqual(model.facts.map(f => snapshotFact(f, input)?.value), ["100 tys. zł", "−3 tys. zł", "60 tys. zł"]);
  assert.equal(snapshotFact(model.facts[0], input)?.change, "Zmiana rok do roku: 20,0%");
  const html = render(input);
  assert.equal((html.match(/class="snapshot-value"/g) ?? []).length, 3);
  assert.match(html, /Dokładne dane/); assert.match(html, /Sprawdź źródło/);
  assert.match(html, /100\s000 PLN/); assert.match(html, /[-−]3\s?000 PLN/);
  assert.doesNotMatch(html, /PRIVATE_|MGBI|Vercly|Pobierz raport KYS|Risk Score|AI w przygotowaniu/i);
  assert.equal(JSON.stringify(input), before);
});
test("Snapshot preserves zero, negative and tiny nonzero values with full exact detail", () => {
  for (const [amount, expected] of [["0", "0 zł"], ["-0.5", "−0,5 zł"], ["0.000001", "<0,01 zł"], ["4000021693.68", "4 mld zł"]]) {
    const input = fixture(); input.metadata!.financial.periods[0].facts[1].amount = amount;
    const net = executiveSummary(input).facts.find(f => f.id === "net")!;
    assert.equal(snapshotFact(net, input)?.value, expected); assert.match(render(input), /Dokładne dane/);
  }
});
test("unverified/null/wrong context never produce a new numerical assertion; comparison states remain canonical", () => {
  for (const status of ["UNKNOWN", "NOT_COMPARABLE"] as const) {
    const input = fixture(); input.metadata!.financial.history.find(h => h.code === "REVENUE_YOY")!.points[0].comparison.status = status;
    const model = executiveSummary(input); assert.equal(snapshotFact(model.facts[0], input)?.change, null);
    assert(model.limitations.some(l => l.id === "comparison"));
  }
  for (const change of [(i: ExecutiveSummaryInput) => { i.nip = "5272443955"; }, (i: ExecutiveSummaryInput) => { i.scope = "consolidated"; },
    (i: ExecutiveSummaryInput) => { i.selectedPeriod = { from: "2025-07-01", to: "2025-12-31" }; },
    (i: ExecutiveSummaryInput) => { i.metadata!.financial.periods[0].facts.forEach(f => f.validation = "UNVERIFIED"); i.metadata!.financial.history.forEach(h => h.points.forEach(p => p.value = null)); }]) {
    const input = fixture(); change(input); assert.equal((render(input).match(/class="snapshot-value"/g) ?? []).length, 0);
  }
});
test("existing limitation priority and three-item disclosure survive Snapshot presentation", () => {
  const input = fixture(), financial = input.metadata!.financial;
  financial.limitations = ["FINANCIAL_FACTS_UNVERIFIED"]; financial.freshness.freshness = "EXPIRED"; financial.status = "PARTIAL";
  financial.history.forEach(h => { h.points[0].comparison.status = "UNKNOWN"; });
  financial.history[0].points[0].status = "UNAVAILABLE";
  const model = executiveSummary(input), html = render(input);
  assert.deepEqual(model.limitations.slice(0, 3).map(l => l.id), ["quality", "freshness", "partial"]);
  const primary = html.split('class="summary-limitations"')[1].split('</ul>')[0];
  assert.equal((primary.match(/data-summary-rule=/g) ?? []).length, 3); assert.match(html, /Pozostałe ograniczenia/);
});
function statements(): FinancialData {
  return { periods: ["standalone", "consolidated"].flatMap((scope, basis) => [2024, 2025].map(year => ({
    documentId: `${scope}-${year}`, from: `${year}-07-01`, to: `${year}-12-31`, scope,
    facts: ["PALA_NRFS", "PALA_NPL", "PALA_OAC", "BS_A_CA", "BS_A_TA", "BS_LAE_E", "BS_LAE_LAPFL"].map(metricCode => ({ metricCode, amount: String(100000 + basis * 100000), currency: "PLN", unit: "PLN" })),
  }))) } as FinancialData;
}
function statementHtml(scope: "standalone" | "consolidated", from = "2025-07-01") {
  return renderToStaticMarkup(React.createElement(FinancialDashboard, { data: statements(), selectedScope: scope, selectedPeriod: { from, to: "2025-12-31" } }));
}
test("RZiS and balance highlight every header/group/ordinary/subtotal/empty row for the full selected period", () => {
  for (const scope of ["standalone", "consolidated"] as const) {
    const html = statementHtml(scope), tables = [...html.matchAll(/<table class="financial-table">([\s\S]*?)<\/table>/g)];
    assert.equal(tables.length, 2);
    for (const table of tables) {
      const rows = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
      for (const row of rows) assert.equal((row[1].match(/data-selected-period="true"/g) ?? []).length, 1);
      assert.match(table[1], /financial-table-total/); assert.match(table[1], /financial-table-group/);
    }
    assert.match(html, scope === "standalone" ? /dane jednostkowe/ : /dane skonsolidowane/);
  }
  // Same year, different full period must not select a column.
  assert.doesNotMatch(statementHtml("standalone", "2025-01-01"), /data-selected-period="true"/);
});
test("duplicate analysis is absent from render, all 16 definitions stay in Cockpit and the unique noncalculated definition remains", () => {
  const html = statementHtml("standalone"); assert.doesNotMatch(html, /Analiza wskaźnikowa|financial-indicators-preview/);
  const groups = Object.values(healthGroups).flat(); assert.equal(groups.length, 16);
  for (const definition of indicatorGroups.flatMap(g => g.indicators)) {
    if (definition.code) assert(groups.includes(definition.code as typeof groups[number]));
    else { assert(html.includes(definition.name)); assert(html.includes(definition.formula)); assert(html.includes(definition.description)); }
  }
  for (const group of indicatorGroups) assert(html.includes(group.description));
  assert.match(html, /Brak zatwierdzonej kalkulacji/);
  const input = fixture(); const cards = Object.keys(healthGroups).map(area => renderToStaticMarkup(React.createElement(FinancialHealthArea, {
    area: area as keyof typeof healthGroups, financial: input.metadata!.financial, scope: input.scope, selectedPeriod: input.selectedPeriod,
  }))).join("");
  assert.equal((cards.match(/data-financial-indicator=/g) ?? []).length, 16);
});
test("KYS footer uses the actual source calendar date, never retrieval/render date", () => {
  for (const date of ["2026-10-07", "2026-10-07T23:30:00-02:00", "2026-10-07T00:00:00Z"]) assert.equal(kysStateDate(date), "Stan na dzień 07.10.2026");
  assert.equal(kysStateDate("2024-02-29"), "Stan na dzień 29.02.2024");
  for (const date of [null, undefined, "", "invalid", "2025-02-29", "2026-13-01", "2026-10-00", "2026-10-07T99:99:99Z", "2026-10-07T24:00:00Z"]) assert.equal(kysStateDate(date), "Stan danych: nie ustalono");
});
test("KYS retains all approved records, masking, data groups and contextual limitations without technical IDs", () => {
  const people = Array.from({ length: 31 }, (_, i) => ({ fullName: `Osoba syntetyczna ${i}`, positions: ["Zarząd"], citizenship: ["PL"], foundIn: ["CRBR"], pesel: "12345678901", peselRevealToken: `PRIVATE_TOKEN_${i}`, birthDate: null, sanctionsMatch: false, pepMatch: false }));
  const data: VerclyKysData = { correlationId: "PRIVATE_QUERY", reportId: "PRIVATE_REPORT", isComplete: false, queriedRegisters: [], stateAsOf: "2026-10-07", relatedPersons: people, beneficialOwners: people, pepMatches: [], screenedLists: [], relatedEntities: [] };
  const before = JSON.stringify(data);
  for (const entityType of ["COMPANY", "JDG"] as const) {
    const html = renderToStaticMarkup(React.createElement(VerclyKysMount, { entityType, section: { status: "PARTIAL", retrievedAt: "2026-10-08T11:00:00Z", effectiveAt: null, warnings: [], data } }));
    assert.equal((html.match(/class="kys-person-entry"/g) ?? []).length, 62);
    assert.doesNotMatch(html, /PRIVATE_|12345678901|MGBI|Vercly|Identyfikator raportu|Identyfikator zapytania/i);
    assert.match(html, /Stan na dzień 07.10.2026/); assert.match(html, /Dopasowania wymagają weryfikacji/);
    assert.match(html, /sprawdzenia tożsamości/); assert.match(html, /Dane częściowe/);
    assert.equal(html.includes('data-kys-detail="relations"'), entityType === "COMPANY");
  }
  assert.equal(JSON.stringify(data), before);
});
