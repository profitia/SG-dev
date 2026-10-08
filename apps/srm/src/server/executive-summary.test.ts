import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveSummary, executiveSummary, FinancialHealthArea, healthGroups, indicatorPresentation,
  type ExecutiveSummaryInput, type FinancialFactEvidence, type FinancialHistoryPoint } from "@profitia/srm-xray";

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
const financial = (input: ExecutiveSummaryInput) => input.metadata!.financial;
const growth = (input: ExecutiveSummaryInput) => financial(input).history.find(h => h.code === "REVENUE_YOY")!.points[0];
const working = (input: ExecutiveSummaryInput) => financial(input).history.find(h => h.code === "NET_WORKING_CAPITAL")!.points[0];

test("summary chooses three verified facts with exact context and no arithmetic; YoY value is not its delta", () => {
  const result = executiveSummary(fixture());
  assert.deepEqual(result.facts.map(item => item.id), ["revenue", "net", "working-capital"]);
  assert.match(result.facts[0].text, /20 %/); assert.doesNotMatch(result.facts[0].text, /7 %/);
  assert.match(result.facts[1].text, /-3\s?000 PLN/); assert.match(result.facts[2].text, /60\s000 PLN/);
  assert.match(result.period!, /2025-01-01.*2025-12-31.*Jednostkowe/);
  assert.deepEqual(result.facts[0].evidence, { kind: "indicator", code: "REVENUE_YOY", history: true });
  assert.equal(result.facts[1].evidence?.kind, "source"); assert.equal(result.limitations.length, 0);
});

test("zero and negative facts keep their signs; null never becomes zero", () => {
  const input = fixture(); financial(input).periods[0].facts[0].amount = "0";
  financial(input).periods[0].facts[1].amount = "-0.50"; working(input).value = "0";
  growth(input).status = "UNAVAILABLE"; growth(input).value = null;
  const result = executiveSummary(input); assert.match(result.facts[0].text, /0 PLN/); assert.match(result.facts[1].text, /[-−]0,50 PLN/); assert.match(result.facts[2].text, /0 PLN/);
  working(input).value = null; assert.equal(executiveSummary(input).facts.length, 2);
});

test("wrong supplier, loading, missing metadata, missing period and other scope fail closed", () => {
  for (const mutate of [(i: ExecutiveSummaryInput) => { i.nip = "5272443955"; }, (i: ExecutiveSummaryInput) => { i.metadata = null; },
    (i: ExecutiveSummaryInput) => { i.loading = true; }, (i: ExecutiveSummaryInput) => { i.scope = "consolidated"; },
    (i: ExecutiveSummaryInput) => { i.selectedPeriod = { from: "2024-01-01", to: "2024-12-31" }; },
    (i: ExecutiveSummaryInput) => { i.metadata!.entityType = "JDG"; }]) {
    const i = fixture(); mutate(i); assert.equal(executiveSummary(i).facts.length, 0);
  }
});

test("ambiguous canonical periods are never silently selected", () => {
  const i = fixture(); financial(i).periods = [...financial(i).periods, { ...financial(i).periods[0], documentRef: "OTHER" }];
  assert.equal(executiveSummary(i).facts.length, 0); assert.equal(executiveSummary(i).limitations[0].id, "period");
});

test("unverified, unconfirmed, unavailable, malformed, wrong units and mixed-document source facts are omitted", () => {
  const mutations: ((f: FinancialFactEvidence) => void)[] = [f => { f.validation = "UNVERIFIED"; }, f => { f.validation = "UNAVAILABLE"; },
    f => { f.normalization = "SOURCE_UNCONFIRMED"; }, f => { f.normalization = "UNKNOWN"; }, f => { f.amount = "NaN"; },
    f => { f.currency = "EUR"; }, f => { f.unit = "THOUSAND_PLN"; }, f => { f.documentRef = "OTHER"; },
    f => { f.periodEnd = "2024-12-31"; }, f => { f.scope = "consolidated"; }];
  for (const change of mutations) { const i = fixture(); change(financial(i).periods[0].facts[1]); assert(!executiveSummary(i).facts.some(f => f.id === "net")); }
});

test("duplicate facts, duplicate indicator results and unavailable methodology fail closed", () => {
  const i = fixture(); financial(i).periods[0].facts = [...financial(i).periods[0].facts, financial(i).periods[0].facts[1]];
  assert(!executiveSummary(i).facts.some(f => f.id === "net"));
  const j = fixture(); financial(j).history = [...financial(j).history, financial(j).history.find(h => h.code === "NET_WORKING_CAPITAL")!];
  assert(!executiveSummary(j).facts.some(f => f.id === "working-capital"));
  for (const mutate of [(p: FinancialHistoryPoint) => { p.definitionRef.formulaVersion = "different"; }, (p: FinancialHistoryPoint) => { p.code = "CURRENT_RATIO"; },
    (p: FinancialHistoryPoint) => { p.unit = "PERCENT"; }, (p: FinancialHistoryPoint) => { p.formulaVersion = ""; }, (p: FinancialHistoryPoint) => { p.evidence = []; }, (p: FinancialHistoryPoint) => { p.evidence = [{ ...p.evidence[0], amount: "999" }, ...p.evidence.slice(1)]; },
    (p: FinancialHistoryPoint) => { p.evidence = [{ ...p.evidence[0], validation: "UNVERIFIED" }, ...p.evidence.slice(1)]; }, (p: FinancialHistoryPoint) => { p.evidence = [{ ...p.evidence[0], periodStart: "2024-01-01" }, ...p.evidence.slice(1)]; }]) {
    const k = fixture(); mutate(working(k)); assert(!executiveSummary(k).facts.some(f => f.id === "working-capital"));
  }
});

test("UNKNOWN and NOT_COMPARABLE never generate historical numeric assertions", () => {
  for (const status of ["UNKNOWN", "NOT_COMPARABLE"] as const) {
    const i = fixture(); growth(i).comparison.status = status;
    const result = executiveSummary(i); assert.doesNotMatch(result.facts[0].text, /rok do roku/);
    assert.equal(result.facts[0].evidence?.kind, "source"); assert(result.limitations.some(l => l.id === "comparison"));
  }
});

test("no growth statement from unverified, absent or mismatched prior input", () => {
  for (const mutate of [(p: FinancialHistoryPoint) => { p.evidence = [p.evidence[0]]; }, (p: FinancialHistoryPoint) => { p.evidence = [p.evidence[0], { ...p.evidence[1], validation: "UNVERIFIED" }]; },
    (p: FinancialHistoryPoint) => { p.evidence = [p.evidence[0], { ...p.evidence[1], documentRef: "OTHER" }]; }, (p: FinancialHistoryPoint) => { p.comparison.previousPeriod = null; },
    (p: FinancialHistoryPoint) => { p.evidence = [p.evidence[0], { ...p.evidence[1], periodEnd: "2023-12-31" }]; }]) {
    const i = fixture(); mutate(growth(i)); assert.doesNotMatch(executiveSummary(i).facts[0].text, /rok do roku/);
  }
});

test("old or unidentified representation prevents numeric facts; partial and stale preserve verified historical values with limitations", () => {
  for (const change of [(i: ExecutiveSummaryInput) => { financial(i).mappingVersion = null; }, (i: ExecutiveSummaryInput) => { financial(i).representationVersion = null; },
    (i: ExecutiveSummaryInput) => { financial(i).limitations = ["MAPPING_VERSION_OUTDATED"]; }]) { const i = fixture(); change(i); assert.equal(executiveSummary(i).facts.length, 0); }
  const i = fixture(); financial(i).freshness.freshness = "EXPIRED"; financial(i).completeness = "PARTIAL"; financial(i).status = "PARTIAL";
  assert.equal(executiveSummary(i).facts.length, 3); assert.deepEqual(executiveSummary(i).limitations.map(l => l.id), ["freshness", "partial"]);
});

test("limitations have deterministic priority, unique categories and progressive disclosure", () => {
  const i = fixture(); financial(i).limitations = ["FINANCIAL_FACTS_UNVERIFIED"]; financial(i).freshness.freshness = "EXPIRED"; financial(i).completeness = "PARTIAL";
  growth(i).comparison.status = "UNKNOWN"; working(i).status = "UNAVAILABLE"; working(i).reasonCode = "MISSING_FIELD";
  i.kysStatus = "PARTIAL"; i.kysHasData = true; i.metadata!.kys.reportAvailable = true; i.metadata!.kys.freshness.freshness = "FRESH"; i.metadata!.kys.completeness = "PARTIAL";
  const result = executiveSummary(i); assert.deepEqual(result.limitations.map(l => l.id), ["quality", "freshness", "partial", "comparison", "missing-results", "kys-partial"]);
  assert.equal(new Set(result.limitations.map(l => l.id)).size, result.limitations.length);
  const html = render(i); assert.match(html, /Pozostałe ograniczenia \(3\)/); assert.equal((html.match(/class="summary-limitations"/g) ?? []).length, 1);
});

function render(input: ExecutiveSummaryInput) { return renderToStaticMarkup(React.createElement(ExecutiveSummary, { input, onSource: () => {}, onIndicator: () => {}, onDetails: () => {}, onFinance: () => {} })); }
test("public summary exposes no providers, raw refs, scoring, AI placeholder or KYS fetch CTA", () => {
  const html = render(fixture()); assert.doesNotMatch(html, /MGBI|Vercly|PRIVATE_|Financial Health Score|AI w przygotowaniu|Pobierz raport KYS/i);
  assert.match(html, /Najważniejsze fakty/); assert.match(html, /Wymaga sprawdzenia/); assert.match(html, /Dalsza analiza/);
  assert.equal((html.match(/data-summary-rule="(?:revenue|net|working-capital)"/g) ?? []).length, 3);
  assert.equal((html.match(/aria-label="Na czym to opieramy\?/g) ?? []).length, 3);
});

test("KYS is neutral before ordering and current only when actually mounted with fresh authorized metadata", () => {
  const i = fixture(); assert.match(executiveSummary(i).kys, /nie został jeszcze pobrany/); i.metadata!.kys.reportAvailable = true;
  assert.match(executiveSummary(i).kys, /nie został jeszcze pobrany/); i.kysStatus = "PENDING"; assert.match(executiveSummary(i).kys, /Trwa/);
  i.kysStatus = "SUCCESS"; i.kysHasData = true; assert.match(executiveSummary(i).kys, /Nie można potwierdzić/);
  i.metadata!.kys.freshness.freshness = "FRESH"; assert.match(executiveSummary(i).kys, /jest dostępny/);
  i.metadata!.kys.freshness.retentionUntil = "2020-01-01T00:00:00Z"; assert.match(executiveSummary(i).kys, /stracił ważność/);
  i.metadata!.kys.freshness.retentionUntil = null; i.metadata!.kys.freshness.freshness = "EXPIRED"; assert.match(executiveSummary(i).kys, /stracił ważność/);
});

test("JDG has an honest registry path without fabricated financial facts or finance actions", () => {
  const i = fixture(); i.entityType = "JDG"; i.metadata!.entityType = "JDG";
  assert.equal(executiveSummary(i).facts.length, 0); const html = render(i); assert.match(html, /Przejdź do danych rejestrowych/); assert.doesNotMatch(html, /Zobacz wskaźniki/);
});

test("period and scope changes never retain prior summary or silently fall back", () => {
  const i = fixture(); assert.equal(executiveSummary(i).facts.length, 3); i.selectedPeriod = { from: "2024-01-01", to: "2024-12-31" };
  assert.equal(executiveSummary(i).facts.length, 0); i.selectedPeriod = { from: "2025-01-01", to: "2025-12-31" }; i.scope = "consolidated";
  assert.equal(executiveSummary(i).facts.length, 0); i.scope = "standalone"; assert.equal(executiveSummary(i).facts.length, 3);
});


test("indicator evidence targets remain unique when reusable areas are mounted more than once", () => {
  const input = fixture();
  const props = { area: "liquidity" as const, financial: financial(input), scope: input.scope, selectedPeriod: input.selectedPeriod };
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(FinancialHealthArea, props), React.createElement(FinancialHealthArea, props)));
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length); assert.equal((html.match(/data-financial-indicator="NET_WORKING_CAPITAL"/g) ?? []).length, 2);
});
