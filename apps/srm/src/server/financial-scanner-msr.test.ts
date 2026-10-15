import assert from "node:assert/strict";
import test from "node:test";
import { projectMsrFinancial,mergeMsrFinancial,type MsrCandidate,type MsrProjection } from "./msr-financial";
import { MSR_MAPPING_VERSION,type MsrParsed } from "./msr-parser";
import { calculateFinancialIndicators } from "./financial-indicators";
import { projectReportData,type ReportReadRow } from "./report-data";
import { FINANCIAL_MAPPING_VERSION } from "./shared-catalog";
import { FinancialScannerMount,previousAnnualPeriod } from "@profitia/srm-xray";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const nip="5272443955",at="2026-10-15T12:00:00Z",ns="https://xbrl.ifrs.org/taxonomy/2024-03-27/ifrs-full";
function projection(scope:"standalone"|"consolidated",factor=1):MsrProjection {
  const candidate:MsrCandidate={recordId:(scope==="standalone"?"a":"b").repeat(24),nip,from:"2025-01-01",to:"2025-12-31",scope,filingDate:"2026-06-01",correction:false,documentId:scope};
  const parsed:MsrParsed={mappingVersion:MSR_MAPPING_VERSION,sourceChecksum:"a".repeat(64),standard:"IAS_IFRS",warnings:[],relationships:[],units:[{id:"PLN",currency:"PLN",measure:"PLN",denominator:null}],contexts:[],facts:[]};
  for(const [year,multiplier] of [[2025,2],[2024,1]]) {
    for(const instant of [true,false]) parsed.contexts.push({id:`${year}:${instant}`,entity:"issuer",scheme:"LEI",from:instant?null:`${year}-01-01`,to:`${year}-12-31`,instant,dimensions:{}});
    const values={Revenue:100*multiplier*factor,ProfitLoss:10*multiplier*factor,ProfitLossFromOperatingActivities:(year===2025?60:20)*factor,ExpenseByNature:(year===2025?140:80)*factor,Assets:200*multiplier*factor,Liabilities:(year===2025?80:60)*factor};
    for(const [localName,amount] of Object.entries(values)) {
      const instant=["Assets","Liabilities"].includes(localName);
      parsed.facts.push({id:`${year}:${localName}`,concept:`{${ns}}${localName}`,namespace:ns,localName,contextRef:`${year}:${instant}`,unitRef:"PLN",numeric:true,rawText:String(amount),sourceAmount:String(amount),amount:String(amount),scale:0,sign:null,decimals:"0",format:null,label:localName,statements:[instant?"Bilans":"RZiS"],order:parsed.facts.length,validation:"VALID",reason:null});
    }
  }
  return projectMsrFinancial(candidate,{recordId:candidate.recordId,checksum:parsed.sourceChecksum,format:"XHTML",container:"DOCUMENT",bytes:Buffer.from("source"),files:[],retrievedAt:at},parsed);
}
function report(projections:MsrProjection[]) {
  const merged=mergeMsrFinancial({section:{status:"EMPTY",data:null,source:{provider:"MGBI",model:"rdf",recordId:null},retrievedAt:at,effectiveAt:null,warnings:[]},facts:[],errorCode:null},projections,[]);
  const facts=merged.facts.map(f=>({...f,sourceSnapshotId:"private-snapshot"}));
  const row:ReportReadRow={nip,scannerTenantScope:"tenant",scanner_documents:projections.map(p=>p.document),financial_json:{...merged.section,catalogMappingVersion:FINANCIAL_MAPPING_VERSION},financial_sha256:"a".repeat(64),financial_checked_at:at,facts,indicators:calculateFinancialIndicators(nip,merged.section.data!,facts),kys:null};
  return projectReportData({nip,entityType:"COMPANY"},row,new Date(at),{});
}
test("MSR two-year pipeline qualifies five axes independently in both scopes and never substitutes missing liquidity",()=>{
  const r=report([projection("standalone"),projection("consolidated",10)]),scanner=r.financial.scanner!;
  for(const scope of ["standalone","consolidated"]){
    const current=scanner.periods.find(p=>p.scope===scope&&p.to.startsWith("2025"))!;
    const prior=previousAnnualPeriod(scanner.periods.filter(p=>p.scope===scope),current)!;
    assert.equal(prior.to,"2024-12-31");
    for(const axis of current.axes){
      if(axis.code==="CURRENT_RATIO"){assert.equal(axis.normalizedScore,null);continue;}
      assert.notEqual(axis.normalizedScore,null,scope+axis.code);
      assert.ok(axis.comparisons?.some(c=>c.periodId===prior.id),axis.code);
    }
    assert.equal(current.axes.find(a=>a.code==="OPERATING_COST_RATIO")!.rawValue,"70.000000");
    assert.equal(current.axes.find(a=>a.code==="REVENUE")!.rawValue,scope==="standalone"?"200":"2000");
  }
  assert.doesNotMatch(JSON.stringify(r),/private-snapshot|contextRef|metricEvidence/);
  const html=renderToStaticMarkup(React.createElement(FinancialScannerMount,{report:r,selectedScope:"consolidated"}));
  assert.match(html,/Skonsolidowane/);assert.match(html,/2[\s ]?000/);
});
test("conflicting, foreign-currency, invalid-concept or unproven correction evidence excludes affected axes",()=>{
  for(const mutate of [
    (p:MsrProjection)=>{p.document.metricEvidence=p.document.metricEvidence!.filter(e=>e.code!=="PALA_NPL");},
    (p:MsrProjection)=>{p.document.metricEvidence!.filter(e=>e.code==="PALA_NPL").forEach(e=>e.currency="EUR");},
    (p:MsrProjection)=>{p.document.metricEvidence!.filter(e=>e.code==="PALA_NPL").forEach(e=>e.concept="{urn:issuer}ProfitLoss");},
  ]){const p=projection("standalone");mutate(p);const axes=report([p]).financial.scanner!.periods[0].axes;assert.equal(axes[0].normalizedScore,null);assert.notEqual(axes[1].normalizedScore,null);}
  const p=projection("standalone");p.document.correction=true;
  assert.ok(report([p]).financial.scanner!.periods.every(p=>p.axes.every(a=>a.normalizedScore===null)));
});
test("a scope without two observations cannot borrow the other scope to build history",()=>{
  const single=projection("standalone");single.data.periods=single.data.periods.slice(0,1);single.facts=single.facts.filter(f=>f.periodEnd==="2025-12-31");
  const scanner=report([single,projection("consolidated")]).financial.scanner!;
  assert.ok(scanner.periods.find(p=>p.scope==="standalone")!.axes.every(a=>a.normalizedScore===null));
  assert.notEqual(scanner.periods.find(p=>p.scope==="consolidated")!.axes[0].normalizedScore,null);
});
