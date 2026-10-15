import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { FinancialDataMount, FinancialScannerMount, type FinancialPeriod } from "@profitia/srm-xray";
import { msrReportingState } from "../../node_modules/@profitia/srm-xray/src/msr-reporting-state";
import { statementRows } from "../../node_modules/@profitia/srm-xray/src/statement-model";
import { projectReportData, type ReportReadRow } from "./report-data";
import { FINANCIAL_MAPPING_VERSION } from "./shared-catalog";
import { executiveSummary } from "../../node_modules/@profitia/srm-xray/src/executive-summary-rules";
import { SupplierReportController } from "../modules/xray/report-controller";
import { SupplierReport } from "../modules/xray/supplier-report";
import { sampleCard } from "../demo/fixture";

const nip = "5272443955";
test("inactive company bypasses financial scanner, assistant and KYS composition and retains the removal date",()=>{
  const state={...new SupplierReportController().getSnapshot(),result:{entityType:"COMPANY" as const,card:{...sampleCard,
    general:{...sampleCard.general,data:{...sampleCard.general.data!,registrationStatus:"DEREGISTERED" as const,deregisteredAt:"2009-01-19"}}}}};
  const fail=()=>{throw Error("Inactive supplier must not execute analysis or KYS");};
  const html=renderToStaticMarkup(React.createElement(SupplierReport,{state,onFetchKys:fail,onReadMetadata:fail,onRevealPesel:fail,onDownloadExcel:fail,
    slots:{scanner:fail,summary:fail,kys:fail}}));
  assert.match(html,/19\.01\.2009/);
  assert.doesNotMatch(html,/Supplier Finance Scanner|Asystent SpendGuru|Raport KYS|financial-dashboard|<button/);
});
function fixture() {
  const periods: FinancialPeriod[] = [2025, 2024].map(year => ({
    from: `${year}-01-01`, to: `${year}-12-31`, scope: "consolidated", documentId: `private:${year}`,
    accountingStandard: "IAS_IFRS", facts: [
      { metricCode: "MSR_REVENUE", amount: year === 2025 ? "2146056000" : "1873436000", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_NPL", amount: year === 2025 ? "644199000" : "856856000", currency: "PLN", unit: "PLN" },
      { metricCode: "PALA_PLFOA", amount: "832379000", currency: "PLN", unit: "PLN" },
    ], msrRows: [{ key: "revenue", label: "Przychody", section: "RZiS", amount: "2146056000", currency: "PLN", unit: "PLN", validation: "VALID", dimensions: [] }],
  }));
  const section = { status: "PARTIAL" as const, data: { periods }, retrievedAt: "2026-10-15T07:19:52.391Z", effectiveAt: null,
    warnings: [], source: { provider: "MGBI" as const, model: "pl-krs-rdf-record", recordId: null }, catalogMappingVersion: FINANCIAL_MAPPING_VERSION };
  const row: ReportReadRow = { nip, financial_json: section, financial_sha256: "a".repeat(64), financial_checked_at: section.retrievedAt,
    kys: null, indicators: [], facts: periods.flatMap(p => p.facts.map(f => ({...f, periodStart:p.from,periodEnd:p.to,
      statementScope:"CONSOLIDATED" as const,currencyCode:f.currency,unitCode:f.unit,sourceAmount:f.amount,sourcePath:"PRIVATE_SOURCE_PATH",
      validationStatus:"VALID" as const,normalizationRule:"SOURCE_VALUE",sourceSnapshotId:"PRIVATE_SNAPSHOT"}))) };
  return { periods, section, row, report: projectReportData({nip,entityType:"COMPANY"},row,new Date("2026-10-15T12:00:00Z"),{}) };
}

test("MSR source values remain visible and verified without qualifying them for UoR radar scores", () => {
  const {report,periods} = fixture();
  assert.equal(report.financial.periods[0].accountingStandard,"IAS_IFRS");
  const state = msrReportingState(report.financial,"consolidated",periods[0]);
  assert.equal(state?.year,"2025");
  assert.deepEqual(state?.values.map(v=>v.amount),["2146056000","644199000"]);
  assert.match(state!.notice,/brak punktacji MSR\/MSSF nie oznacza braku danych/);
  assert.ok(report.financial.scanner!.periods.every(p=>p.axes.every(a=>a.normalizedScore===null)));
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_SOURCE_PATH|PRIVATE_SNAPSHOT|private:/);
});

test("executive summary names IFRS revenue explicitly and does not infer a UoR growth comparison", () => {
  const {report,periods} = fixture();
  const summary = executiveSummary({nip,entityType:"COMPANY",metadata:report,scope:"consolidated",selectedPeriod:periods[0],kysStatus:"NOT_REQUESTED",kysHasData:false});
  const revenue=summary.facts.find(f=>f.id==="revenue");
  assert.match(revenue!.text,/Przychody MSR\/MSSF/);
  assert.equal(revenue!.evidence?.kind,"source");
  assert.doesNotMatch(revenue!.text,/rok do roku/);
});

test("MSR standalone absence is explicit and does not substitute consolidated source values", () => {
  const {report} = fixture();
  const state = msrReportingState(report.financial,"standalone");
  assert.deepEqual(state?.values,[]);
  assert.equal(state?.year,null);
  assert.match(state!.notice,/wybierz Skonsolidowane/);
  const html = renderToStaticMarkup(React.createElement(FinancialScannerMount,{report}));
  assert.match(html,/Dostępne są dane skonsolidowane MSR\/MSSF/);
  assert.doesNotMatch(html,/Brak dostępnych danych finansowych dla tego zakresu/);
});

test("MSR overview preserves losses and zero; mismatched scope, unverified and duplicate facts never become source summary", () => {
  const {report,periods} = fixture();
  const p = report.financial.periods[0];
  const facts = p.facts.map(f=>({...f,amount:f.metricCode==="MSR_REVENUE" ? "0" : "-12.5"}));
  const financial = {...report.financial,periods:[{...p,facts}]};
  assert.deepEqual(msrReportingState(financial,"consolidated",periods[0])!.values.map(v=>v.amount),["0","-12.5"]);
  for (const patch of [{validation:"UNVERIFIED" as const},{scope:"standalone" as const},{currency:"EUR"},{documentRef:"other"}]) {
    const altered = {...financial,periods:[{...p,facts:facts.map(f=>({...f,...patch}))}]};
    assert.deepEqual(msrReportingState(altered,"consolidated",periods[0])!.values,[]);
  }
  assert.deepEqual(msrReportingState({...financial,periods:[{...p,facts:[...facts,...facts]}]},"consolidated",periods[0])!.values,[]);
});

test("MSR charts use IFRS revenue and available source facts; UoR placeholder costs are absent", () => {
  const {periods,section} = fixture();
  const rows = statementRows(periods);
  assert.equal(rows.find(r=>r.id==="MSR_REVENUE")?.name,"Przychody MSR/MSSF");
  assert.ok(!rows.some(r=>r.id==="PALA_NRFS" || r.id==="PALA_OAC"));
  const html = renderToStaticMarkup(React.createElement(FinancialDataMount,{section,selectedScope:"consolidated"}));
  const $ = load(html);
  assert.match($(".srm-statement-chart-grid").text(),/Przychody MSR\/MSSF/);
  assert.doesNotMatch($(".srm-statement-chart-grid").text(),/Koszty działalności operacyjnej/);
  assert.ok($("[data-financial-standard='IAS_IFRS'] table").length>0);
});

test("standard selection keeps MSR and UoR chart histories separate and leaves standard UoR defaults intact", () => {
  const {periods,section,report} = fixture();
  const uor:FinancialPeriod={...periods[1],from:"2023-01-01",to:"2023-12-31",documentId:"uor",accountingStandard:"POLISH_UOR",msrRows:undefined,
    facts:[{metricCode:"PALA_NRFS",amount:"1000000",currency:"PLN",unit:"PLN"}]};
  const combined={...section,data:{periods:[...periods,uor]}};
  const msr=load(renderToStaticMarkup(React.createElement(FinancialDataMount,{section:combined,selectedScope:"consolidated",selectedPeriod:periods[0]})));
  assert.doesNotMatch(msr(".srm-statement-chart-grid").text(),/2023/);
  const standard=load(renderToStaticMarkup(React.createElement(FinancialDataMount,{section:combined,selectedScope:"consolidated",selectedPeriod:uor})));
  assert.doesNotMatch(standard(".srm-statement-chart-grid").text(),/MSR\/MSSF|2025/);
  assert.equal(msrReportingState({...report.financial,periods:report.financial.periods.map(p=>({...p,accountingStandard:"POLISH_UOR"}))},"consolidated"),null);
});
