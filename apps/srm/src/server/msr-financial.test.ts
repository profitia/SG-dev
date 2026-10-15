import assert from "node:assert/strict";
import test from "node:test";
import { projectMsrFinancial,selectMsrCandidates,mergeMsrFinancial,type MsrCandidate } from "./msr-financial";
import { MSR_MAPPING_VERSION,type MsrParsed,type MsrFact } from "./msr-parser";
import type { MsrOriginal } from "./msr-source";
import { buildFinancialExcel } from "./financial-excel";
import ExcelJS from "exceljs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MsrFinancialTables,formatMsrAmount } from "../../node_modules/@profitia/srm-xray/src/msr-financial-tables";

export const candidate:MsrCandidate={recordId:"68373e33935a5dc0776e1c56",nip:"5272443955",from:"2024-01-01",to:"2024-12-31",scope:"consolidated",filingDate:"2025-05-27",correction:false,documentId:"9559394"};
test("verified KRS allowlist filters MSR before latest-filing selection without changing receipt identity",()=>{
  const record=(id:string,krs:string,year:number)=>({id,identifiers:{pl_nip:candidate.nip,pl_krs:krs},document:{type:"financial_statement",is_ias_compliant:true,period_from_date:`${year}-01-01`,period_to_date:`${year}-12-31`}});
  const accepted=record("a".repeat(24),"0000000001",2024),foreign=record("b".repeat(24),"0000000002",2025);
  const selected=selectMsrCandidates([accepted,foreign],candidate.nip,["0000000001"]);
  assert.deepEqual(selected,selectMsrCandidates([accepted],candidate.nip));assert.equal(selected[0].recordId,accepted.id);
  assert.deepEqual(selectMsrCandidates([accepted],candidate.nip,[]),[]);
});
export const original:MsrOriginal={recordId:candidate.recordId,format:"XHTML",container:"DOCUMENT",checksum:"a".repeat(64),bytes:Buffer.from("source"),files:[],retrievedAt:"2026-10-15T00:00:00Z"};
const ns="https://xbrl.ifrs.org/taxonomy/2022-03-24/ifrs-full";
test("MSR selects the latest filing before its standard: newer UoR, unknown or PDF never falls back to paid historical IAS",()=>{
  const record=(id:string,year:number,ias:unknown,scope="financial_statement",pdf=false)=>({id,identifiers:{pl_nip:candidate.nip},
    document:{type:scope,is_ias_compliant:ias,period_from_date:`${year}-01-01`,period_to_date:`${year}-12-31`},
    files:{main_document:{original:{content_type:pdf ? "application/pdf" : "application/xhtml+xml"}}}});
  const old=record("a".repeat(24),2024,true);
  for (const latest of [record("b".repeat(24),2025,false),record("b".repeat(24),2025,null),record("b".repeat(24),2025,true,"financial_statement",true)])
    assert.deepEqual(selectMsrCandidates([old,latest],candidate.nip),[]);
  const group=record("c".repeat(24),2025,true,"consolidated_financial_statement");
  const selected=selectMsrCandidates([old,record("b".repeat(24),2025,false),group],candidate.nip);
  assert.equal(selected.length,1);assert.equal(selected[0].scope,"consolidated");assert.equal(selected[0].recordId,group.id);
});
function fact(name:string,amount:string,contextRef="duration",extra:Partial<MsrFact>={}):MsrFact{return {id:name+contextRef,concept:"{"+ns+"}"+name,namespace:ns,localName:name,contextRef,unitRef:"PLN",numeric:true,rawText:amount,sourceAmount:amount,amount,scale:0,sign:null,decimals:"0",format:null,label:name,statements:[contextRef==="instant" ? "Bilans" : "RZiS"],order:0,validation:"VALID",reason:null,...extra};}
function parsed():MsrParsed{return {mappingVersion:MSR_MAPPING_VERSION,sourceChecksum:original.checksum,standard:"IAS_IFRS",warnings:[],relationships:[],
  contexts:[{id:"duration",entity:"ISSUER",scheme:"lei",from:candidate.from,to:candidate.to,instant:false,dimensions:{}},{id:"instant",entity:"ISSUER",scheme:"lei",from:null,to:candidate.to,instant:true,dimensions:{}},
    {id:"segment",entity:"ISSUER",scheme:"lei",from:candidate.from,to:candidate.to,instant:false,dimensions:{axis:"member"}}],
  units:[{id:"PLN",currency:"PLN",measure:"PLN",denominator:null}],facts:[fact("Revenue","1873436000"),fact("ProfitLoss","856856000"),fact("Assets","6645632000","instant"),fact("FinanceCosts","-22882000"),fact("Revenue","123","segment")]};}
test("MSR selects latest independent scopes, excludes mismatched NIP, PDF and non-statements",()=>{
  const record=(id:string,type:string,to="2024-12-31")=>({id,identifiers:{pl_nip:candidate.nip},document:{type,is_ias_compliant:true,period_from_date:"2024-01-01",period_to_date:to}});
  const rows=[record(candidate.recordId,"consolidated_financial_statement"),record("b".repeat(24),"financial_statement"),record("c".repeat(24),"financial_statement","2025-12-31"),{...record("d".repeat(24),"financial_statement"),files:{main_document:{original:{content_type:"application/pdf"}}}},record("e".repeat(24),"audit_report")];
  assert.deepEqual(selectMsrCandidates(rows,candidate.nip).map(c=>c.recordId),["c".repeat(24),candidate.recordId]);assert.deepEqual(selectMsrCandidates(rows,"5252674798"),[]);
});
test("MSR mapping preserves expense signs, extensions and private dimensions without claiming UoR equivalence",()=>{
  const p=parsed();p.facts.push(fact("Revenue","999","duration",{namespace:"urn:issuer",concept:"{urn:issuer}Revenue",id:"extension"}));
  const result=projectMsrFinancial(candidate,original,p);
  assert.equal(result.data.periods.length,1);assert.equal(result.document.standard,"IAS_IFRS");assert.equal(result.document.availability,"IXBRL_SUPPORTED");
  assert.equal(result.facts.find(f=>f.metricCode==="MSR_REVENUE")?.amount,"1873436000");assert.ok(!result.facts.some(f=>["PALA_NRFS","PALA_COGS"].includes(f.metricCode)));
  assert.equal(result.data.periods[0].msrRows?.find(r=>r.label==="FinanceCosts")?.amount,"-22882000");
  assert.ok(result.data.periods[0].msrRows?.every(r=>r.dimensions.length===0));assert.equal(p.facts.find(f=>f.contextRef==="segment")?.amount,"123");
  assert.ok(result.data.periods[0].msrRows?.some(r=>r.amount==="999"));assert.ok(result.facts.every(f=>f.normalizationRule==="SOURCE_VALUE"));
});
test("MSR refuses record, issuer and period mismatch; comparative instants do not create annual periods",()=>{
  assert.throws(()=>projectMsrFinancial({...candidate,recordId:"b".repeat(24)},original,parsed()),/IDENTITY/);
  assert.throws(()=>projectMsrFinancial({...candidate,from:"2023-01-01"},original,parsed()),/PERIOD/);
  const p=parsed();p.contexts.push({...p.contexts[1],id:"opening",to:"2022-12-31"});p.facts.push(fact("Assets","1","opening"));
  assert.equal(projectMsrFinancial(candidate,original,p).data.periods.length,1);
  p.contexts[2].entity="ANOTHER";assert.throws(()=>projectMsrFinancial(candidate,original,p),/IDENTITY/);
});
test("MSR unsupported source values remain REVIEW, and currency-per-share is not presented as currency",()=>{
  const p=parsed();p.units.push({id:"EPS",currency:"PLN",measure:"PLN",denominator:"shares"});
  p.facts.push(fact("BasicEarningsLossPerShare","7.29","duration",{unitRef:"EPS"}),fact("Tax","0","duration",{amount:null,validation:"REVIEW",reason:"NIL_VALUE"}));
  const projection=projectMsrFinancial(candidate,original,p);const period=projection.data.periods[0];
  assert.equal(period.msrRows?.find(r=>r.label==="BasicEarningsLossPerShare")?.currency,null);assert.equal(period.msrRows?.find(r=>r.label==="Tax")?.amount,null);
  const merged=mergeMsrFinancial({section:{status:"EMPTY",data:null,source:{provider:"MGBI",model:"rdf",recordId:null},retrievedAt:original.retrievedAt,effectiveAt:null,warnings:["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"]},facts:[],errorCode:null},[projection],[]);
  assert.equal(merged.section.status,"PARTIAL");assert.ok(merged.section.warnings.includes("MSR_UNVERIFIED_SOURCE_VALUES"));
});
test("MSR renders a financial-module variant without markup execution, unit/sign loss or floating-point rounding",()=>{
  const p=parsed();p.facts[0].label="<script>bad()</script>";
  const html=renderToStaticMarkup(React.createElement(MsrFinancialTables,{periods:projectMsrFinancial(candidate,original,p).data.periods}));
  assert.match(html,/data-financial-standard="IAS_IFRS"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/-22 882 000/);
  assert.equal(formatMsrAmount("9007199254740993.1234"),"9 007 199 254 740 993,1234");assert.equal(formatMsrAmount(null),"brak danych");
});
test("MSR Excel reuses stored sources and preserves all public statement rows, exact values and provenance",async()=>{
  const p=parsed();p.facts[0].label="=SUM(1,2)";const projection=projectMsrFinancial(candidate,original,p);
  const exported=await buildFinancialExcel(projection.data,{nip:candidate.nip,scope:candidate.scope,years:["2024"]},new Date(original.retrievedAt),[projection.document]);
  const book=new ExcelJS.Workbook();await book.xlsx.load(exported.bytes as never);
  assert.equal(book.worksheets[0].getCell("B2").value,"=SUM(1,2)");assert.equal(book.worksheets[0].getCell("D2").value,1873436000);
  assert.equal(book.worksheets[0].getCell("D5").value,-22882000);assert.equal(book.worksheets[1].getCell("B1").value,"MSR/MSSF · XHTML/iXBRL");
  await assert.rejects(buildFinancialExcel(projection.data,{nip:candidate.nip,scope:candidate.scope,years:["2024"]}),/tej organizacji/);
});

test("equivalent contexts with conflicting values never select the first fact",()=>{
  const p=parsed();p.contexts.push({...p.contexts[0],id:"same-duration"});
  p.facts.push(fact("Revenue","1","same-duration"));
  const r=projectMsrFinancial(candidate,original,p);
  assert.ok(!r.facts.some(f=>f.metricCode==="MSR_REVENUE"));
  assert.equal(r.data.periods[0].msrRows?.find(r=>r.label==="Revenue")?.validation,"REVIEW");
  assert.equal(r.facts.find(f=>f.metricCode==="PALA_NPL")?.amount,"856856000");
});
test("a newly projected filing replaces the whole period instead of keeping an older more complete version",()=>{
  const current=projectMsrFinancial(candidate,original,parsed());
  const older={...current.data.periods[0],documentId:"old:cfy",facts:[{metricCode:"OLD_ONLY",amount:"99",currency:"PLN",unit:"PLN"}]};
  const merged=mergeMsrFinancial({section:{status:"SUCCESS",data:{periods:[older]},source:{provider:"MGBI",model:"rdf",recordId:"old"},retrievedAt:original.retrievedAt,effectiveAt:null,warnings:[]},facts:[],errorCode:null},[current],[]);
  assert.equal(merged.section.data?.periods.length,1);assert.equal(merged.section.data?.periods[0].documentId,current.data.periods[0].documentId);
  assert.ok(!merged.section.data?.periods[0].facts.some(f=>f.metricCode==="OLD_ONLY"));
});
