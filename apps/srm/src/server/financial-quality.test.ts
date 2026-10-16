import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import net from "node:net";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import { FinancialDataMount, financialQualityIssues, financialQualityReason, FINANCIAL_QUALITY_RULE, type FinancialPeriod } from "@profitia/srm-xray";
import { statementPoints } from "../../node_modules/@profitia/srm-xray/src/statement-model";
import { mapMgbiFinancialRecords } from "./mgbi-financial";
import { projectFinancialDocuments } from "./financial-documents";
import { calculateFinancialIndicators } from "./financial-indicators";
import { projectReportData, type ReportReadRow } from "./report-data";
import { FINANCIAL_MAPPING_VERSION } from "./shared-catalog";
import { qualifyScannerSources } from "./financial-scanner-source";
import { buildFinancialExcel } from "./financial-excel";
import { financialRowPresentation } from "./financial-schema-labels";
import { multiplySourceAmount } from "./financial-unit";

// Offline controls only: no recovered original XML or deployed-report claim.
// Values explicitly identified below come from the saved 250-NIP diagnostic.
const nip="1111111111", at="2026-10-16T10:00:00Z";
const actualFetch=globalThis.fetch, actualConnect=net.Socket.prototype.connect;
let networkAttempts=0;
before(()=>{
  globalThis.fetch=(async()=>{networkAttempts++;throw Error("OFFLINE_NETWORK_FORBIDDEN");}) as typeof fetch;
  net.Socket.prototype.connect=function(){networkAttempts++;throw Error("OFFLINE_NETWORK_FORBIDDEN");} as typeof actualConnect;
});
after(()=>{globalThis.fetch=actualFetch;net.Socket.prototype.connect=actualConnect;assert.equal(networkAttempts,0);});

function record(schema="JednostkaInnaWZlotych") {
  return {id:"offline-control", identifiers:{pl_nip:nip}, document:{type:"financial_statement",period_from_date:"2025-01-01",period_to_date:"2025-12-31",filing_date:"2026-06-01",is_ias_compliant:false,is_correction:false},
    meta:{is_extracted_fields_multiplier_validated:false,extracted_fields_multiplier:1000},
    content:{schema:{name:schema,version:"1-0E"},standardized_fields:{bs:{a_ta_cfy:"100",lae_e_cfy:"40",lae_lapfl_cfy:"60",a_ca_cfy:"20",lae_lapfl_stl_cfy:"10"} as Record<string,string>,pala:{nrfs_cfy:"100",oac_cfy:"80",plfs_cfy:"20",plfoa_cfy:"15",npl_cfy:"10"} as Record<string,string>},
    extracted_fields:{"Bilans.Aktywa.KwotaA":"100","Bilans.Pasywa.Pasywa_A.KwotaA":"40","Bilans.Pasywa.Pasywa_B.KwotaA":"60","Bilans.Aktywa.Aktywa_B.KwotaA":"20","Bilans.Pasywa.Pasywa_B.Pasywa_B_III.KwotaA":"10","RZiS.RZiSPor.A.KwotaA":"100","RZiS.RZiSPor.B.KwotaA":"80","RZiS.RZiSPor.C.KwotaA":"20","RZiS.RZiSPor.F.KwotaA":"15","RZiS.RZiSPor.L.KwotaA":"10"} as Record<string,string>}};
}
function pipeline(r=record()) {
  const mapped=mapMgbiFinancialRecords([r],{type:"NIP",value:nip},at);
  assert.ok(mapped.section.data);
  const facts=mapped.facts.map(f=>({...f,sourceSnapshotId:"00000000-0000-4000-8000-000000000001"}));
  const row:ReportReadRow={nip,financial_json:{...mapped.section,catalogMappingVersion:FINANCIAL_MAPPING_VERSION},facts,
    indicators:calculateFinancialIndicators(nip,mapped.section.data,facts),scanner_documents:projectFinancialDocuments([r]),financial_sha256:"a".repeat(64),financial_checked_at:at,kys:null};
  return {mapped,row,report:()=>projectReportData({nip,entityType:"COMPANY"},row,new Date(at),{})};
}
function period(values:Record<string,string>):FinancialPeriod {
  return {from:"2025-01-01",to:"2025-12-31",scope:"standalone",documentId:"offline:cfy",facts:Object.entries(values).map(([metricCode,amount])=>({metricCode,amount,currency:"PLN",unit:"PLN"}))};
}

test("balance uses exact decimals, one-grosz tolerance, real zero and no missing-as-zero inference",()=>{
  for(const [totals,issues] of [
    [{BS_A_TA:"100.01",BS_LAE_E:"40",BS_LAE_LAPFL:"60"},[]],
    [{BS_A_TA:"100.0101",BS_LAE_E:"40",BS_LAE_LAPFL:"60"},["BALANCE_INCONSISTENT"]],
    [{BS_A_TA:"0",BS_LAE_E:"0",BS_LAE_LAPFL:"0"},[]],
    [{BS_A_TA:"100",BS_LAE_LAPFL:"60"},[]],
    // MEDIKOL 6722079818: saved values, not fabricated balancing corrections.
    [{BS_A_TA:"5903816.67",BS_LAE_E:"1871431.16",BS_LAE_LAPFL:"4489591.4"},["BALANCE_INCONSISTENT"]],
    // Jawit 6840006798: saved annual totals, difference 9,100,813.35 PLN.
    [{BS_A_TA:"9832120.62",BS_LAE_E:"215963.45",BS_LAE_LAPFL:"515343.82"},["BALANCE_INCONSISTENT"]],
  ] as [Record<string,string>,string[]][]) assert.deepEqual(financialQualityIssues(period(totals)),issues);
});

test("inconsistent annual balance blocks calculations, stale AVAILABLE history and radar; independent P&L remains usable",()=>{
  const p=pipeline();
  for(const f of p.mapped.section.data!.periods[0].facts) if(f.metricCode==="BS_A_TA") f.amount="150";
  p.row.facts.find(f=>f.metricCode==="BS_A_TA")!.amount="150";
  // CURRENT_RATIO was calculated before the mismatch; its own inputs remain unchanged.
  assert.equal(p.row.indicators.find(i=>i.code==="CURRENT_RATIO")!.status,"AVAILABLE");
  const calculated=calculateFinancialIndicators(nip,p.mapped.section.data!,p.row.facts);
  assert.equal(calculated.find(i=>i.code==="CURRENT_RATIO")!.reasonCode,"BALANCE_INCONSISTENT");
  assert.equal(calculated.find(i=>i.code==="NET_MARGIN")!.status,"AVAILABLE");
  const report=p.report().financial;
  assert.equal(report.history.find(h=>h.code==="CURRENT_RATIO")!.points[0].reasonCode,"BALANCE_INCONSISTENT");
  assert.equal(report.history.find(h=>h.code==="CURRENT_RATIO")!.points[0].value,null);
  assert.equal(report.scanner!.periods[0].axes.find(a=>a.code==="CURRENT_RATIO")!.rawValue,null);
  const basis=qualifyScannerSources(report,p.mapped.section.data!.periods,p.row.scanner_documents!,at);
  assert.ok(Object.values(basis)[0].basis.REVENUE);
  assert.equal(Object.values(basis)[0].basis.CURRENT_RATIO,undefined);
});

test("ordinary and restated comparative values remain separate, including zero and partial restatements",()=>{
  for(const restated of ["34416395.46","0"]) {
    const r=record();
    // Polonia Tatry 5252191410: ordinary 25,201,695.46 vs restated 34,416,395.46.
    r.content.standardized_fields.bs.lae_e_pfy="25201695.46";
    r.content.standardized_fields.bs.lae_e_cpfy=restated;
    r.content.standardized_fields.pala.nrfs_pfy="90";
    const p=pipeline(r),prior=p.mapped.section.data!.periods.find(p=>p.documentId.endsWith(":pfy"))!;
    assert.equal(prior.facts.find(f=>f.metricCode==="BS_LAE_E")!.amount,"25201695.46");
    assert.equal(prior.comparativeData!.restated[0].amount,restated);
    assert.equal(prior.comparativeData!.selected,"UNRESOLVED");
    assert.equal(p.row.indicators.find(i=>i.code==="REVENUE_YOY" && i.periodEnd==="2025-12-31")!.reasonCode,"RESTATEMENT_UNRESOLVED");
    assert.equal(p.row.indicators.find(i=>i.code==="NET_MARGIN" && i.periodEnd==="2025-12-31")!.status,"AVAILABLE");
    assert.equal(financialQualityReason(prior,["BS_LAE_E"]),"RESTATEMENT_UNRESOLVED");
    assert.ok(!prior.comparativeData!.restated.some(f=>f.metricCode==="BS_A_TA"));
    assert.equal(p.report().financial.periods.find(p=>p.year==="2024")!.comparativeData!.restated[0].amount,restated);
  }
});

test("identical comparative values retain ordinary selection; restated-only column never backfills from older filing",()=>{
  const r=record();r.content.standardized_fields.bs.lae_e_pfy="40";r.content.standardized_fields.bs.lae_e_cpfy="40.00";
  assert.equal(pipeline(r).mapped.section.data!.periods.find(p=>p.documentId.endsWith(":pfy"))!.comparativeData!.selected,"ORIGINAL");
  delete r.content.standardized_fields.bs.lae_e_pfy;
  const older=record();older.id="older";older.document.period_from_date="2024-01-01";older.document.period_to_date="2024-12-31";older.document.filing_date="2025-06-01";
  const result=mapMgbiFinancialRecords([older,r],{type:"NIP",value:nip},at);
  const prior=result.section.data!.periods.find(p=>p.to==="2024-12-31")!;
  assert.equal(prior.documentId,"offline-control:pfy");assert.equal(prior.facts.length,0);assert.equal(prior.comparativeData!.selected,"UNRESOLVED");
});

test("noncalendar restated dates and XML B1 role are not inferred from a numeric coincidence",()=>{
  const r=record();r.document.period_from_date="2024-04-01";r.document.period_to_date="2025-03-31";
  r.content.standardized_fields.bs.lae_e_cpfy="40";r.content.extracted_fields["Bilans.Pasywa.Pasywa_A.KwotaB1"]="40";
  const p=pipeline(r),prior=p.mapped.section.data!.periods.find(p=>p.comparativeData)!;
  assert.equal(prior.comparativeData!.dateBasis,"UNCONFIRMED");
  const b1=p.row.scanner_documents![0].columns.find(c=>c.sourceColumn==="KwotaB1")!;
  assert.equal(b1.role,"UNKNOWN");assert.equal(b1.from,null);assert.equal(b1.to,null);
});

test("real thousand-schema spellings are recognized but do not imply normalized amount units",()=>{
  for(const schema of ["JednostkaInnaWTysiacach","SkonsolidowanaJednostkaInnaWTysiacach","JednostkaMikroWTysiacach","JednostkaInnaWTysiacachZlotych"]) {
    const r=record(schema),p=pipeline(r),doc=p.row.scanner_documents![0];
    assert.equal(doc.availability,"XML_SUPPORTED");assert.equal(doc.scale,null);assert.equal(doc.unitBasis,"UNCONFIRMED");
    const assets=doc.rows.find(r=>r.sourcePath==="Bilans.Aktywa")!;
    assert.match(financialRowPresentation(doc,assets).basis,/^MF_XSD:/);
    assert.equal(p.mapped.facts.find(f=>f.metricCode==="BS_A_TA")!.unitCode,"UNKNOWN");
    assert.equal(p.row.indicators.find(i=>i.code==="CURRENT_RATIO")!.reasonCode,"UNIT_UNCONFIRMED");
  }
});

test("validated XML multiplier corroborates already-normalized PLN without multiplying twice; radar agrees",()=>{
  const r=record("JednostkaInnaWTysiacach");r.meta.is_extracted_fields_multiplier_validated=true;
  for(const group of Object.values(r.content.standardized_fields)) for(const key of Object.keys(group)) group[key]=multiplySourceAmount(group[key],1000)!;
  const p=pipeline(r),fact=p.mapped.facts.find(f=>f.metricCode==="BS_A_TA")!;
  assert.equal(fact.amount,"100000");assert.equal(fact.sourceAmount,"100000");assert.equal(fact.unitCode,"PLN");
  assert.equal(p.row.scanner_documents![0].scale,"1000");
  assert.equal(p.row.indicators.find(i=>i.code==="CURRENT_RATIO")!.value,"2.000000");
  assert.equal(p.report().financial.scanner!.periods[0].axes.find(a=>a.code==="CURRENT_RATIO")!.rawValue,"2.000000");
  r.content.standardized_fields.bs.a_ta_cfy="100";
  assert.equal(pipeline(r).mapped.facts.find(f=>f.metricCode==="BS_A_TA")!.unitCode,"UNKNOWN");
});

test("extract-only thousands and unvalidated multipliers are never silently promoted to PLN",()=>{
  const r=record("JednostkaInnaWTysiacach");r.meta.is_extracted_fields_multiplier_validated=true;
  r.content.extracted_fields["Bilans.Aktywa.Aktywa_B.Aktywa_B_I.KwotaA"]="5";
  assert.equal(pipeline(r).mapped.facts.find(f=>f.metricCode==="BS_A_CA_INV")!.unitCode,"UNKNOWN");
  r.meta.extracted_fields_multiplier=1;
  assert.equal(pipeline(r).mapped.facts.find(f=>f.metricCode==="BS_A_CA_INV")!.unitCode,"PLN");
  assert.equal(multiplySourceAmount("-123.4567",1000),"-123456.7");
  assert.equal(multiplySourceAmount("99999999999999999999",1000),null);
});

test("historical representations without quality-rule evidence cannot reuse AVAILABLE indicators",()=>{
  const p=pipeline();delete p.row.financial_json!.data!.qualityRule;
  assert.equal(p.report().financial.history.find(h=>h.code==="CURRENT_RATIO")!.points[0].reasonCode,"MAPPING_VERSION_OUTDATED");
  assert.equal(p.mapped.section.data!.qualityRule,undefined);
});

test("source amounts and quality explanation survive table history, UI rendering and Excel round-trip",async()=>{
  const r=record();r.content.standardized_fields.bs.a_ta_cfy="150";
  r.content.extracted_fields["Bilans.Aktywa.KwotaA"]="150";
  r.content.standardized_fields.bs.lae_e_pfy="25201695.46";r.content.standardized_fields.bs.lae_e_cpfy="34416395.46";
  r.content.standardized_fields.pala.nrfs_pfy="1";
  const p=pipeline(),clean=await buildFinancialExcel(p.mapped.section.data!,{nip,scope:"standalone",years:["2025"]},new Date(at),p.row.scanner_documents);
  const cleanBook=new ExcelJS.Workbook();await cleanBook.xlsx.load(clean.bytes as never);assert.equal(cleanBook.worksheets.length,2);
  const q=pipeline(r),data=q.mapped.section.data!;
  assert.equal(data.qualityRule,FINANCIAL_QUALITY_RULE);
  const points=statementPoints(data.periods.filter(p=>p.to==="2025-12-31"),"BS_A_TA");
  assert.equal(points[0].rawValue,"0.15");assert.match(points[0].information!,/Sumy bilansu są niespójne/);
  const html=renderToStaticMarkup(React.createElement(FinancialDataMount,{section:q.mapped.section}));
  assert.match(html,/Sumy bilansu są niespójne/);assert.match(html,/Dane przekształcone/);
  assert.match(html,/25201695.46/);assert.match(html,/34416395.46/);
  const exported=await buildFinancialExcel(data,{nip,scope:"standalone",years:["2025","2024"]},new Date(at),q.row.scanner_documents);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(exported.bytes as never);
  const quality=workbook.getWorksheet("Jakość danych")!;assert.ok(quality);
  assert.match(JSON.stringify(quality.getSheetValues()),/34416395.46/);
  assert.match(JSON.stringify(quality.getSheetValues()),/Sumy bilansu są niespójne/);
  assert.ok(workbook.worksheets[1].getSheetValues().some(row=>JSON.stringify(row).includes("150")));
});
