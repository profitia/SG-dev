import assert from "node:assert/strict";
import test from "node:test";
import { resolveFinancialRevision, resolveDocumentFamily, financialContentHash, type Revision, type RevisionCell } from "./financial-revisions";
import { mapMgbiFinancialRecords } from "./mgbi-financial";
import { projectFinancialDocuments } from "./financial-documents";

const value=(v:string):RevisionCell=>({value:v,state:"VALUE",source:"source:field"});
const base:Revision={id:"V1",family:"supplier:2025:unit:UOR:PLN",filedAt:"2026-01-01",checksum:"a".repeat(64),kind:"ORIGINAL",cells:{revenue:value("100"),cost:value("80"),net:value("10")}};
const full:Revision={...base,id:"V2",filedAt:"2026-02-01",checksum:"b".repeat(64),kind:"FULL_REPLACEMENT",parent:"V1",evidence:"explicit replacement",cells:{revenue:value("120"),cost:value("90"),net:value("20")}};
const correction:Revision={...base,id:"K3",filedAt:"2026-03-01",checksum:"c".repeat(64),kind:"PARTIAL_AMENDMENT",parent:"V2",evidence:"explicit amendment scope",changedFields:["revenue","net"],cells:{revenue:{...value("130"),source:"K3:revenue"},net:{...value("30"),source:"K3:net"}}};
test('mixed financial paths retain the historical content hash independently of row order',()=>{
 const source={id:'sort-fixture',identifiers:{pl_nip:'1234563218'},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',filing_date:'2026-01-01',is_correction:false,is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych',version:'1-3'},extracted_fields:{'Bilans>Aktywa>A10>KwotaA':'10.00','Bilans.Aktywa.A2.KwotaA':'2.00','Bilans.Aktywa.A1.KwotaA':'1.00','RZiS.RZiSPor.A.KwotaA':'100.00'}}};
 const document=projectFinancialDocuments([source])[0],historical='ed7efa623e34aebf22f387f68fd633db429faff7aec7891d820aa0887d2b8a3e';
 assert.equal(financialContentHash(document),historical);
 assert.equal(financialContentHash({...document,rows:[...document.rows].reverse()}),historical);
 const changed=structuredClone(document);changed.rows[0].amounts.KwotaA='2.00';
 assert.notEqual(financialContentHash(changed),historical);
 assert.equal(financialContentHash({...document,rows:[...document.rows,document.rows[0]]}),null);
});
test("full V1 -> full V2 -> partial K3 -> partial K4 preserves exact lineage and untouched values",()=>{
  const k4={...correction,id:"K4",parent:"K3",filedAt:"2026-04-01",changedFields:["net"],cells:{net:{...value("0"),source:"K4:net"}}};
  const result=resolveFinancialRevision([k4,full,correction,base]);
  assert.equal(result.status,"RESOLVED");assert.deepEqual(result.lineage,["V1","V2","K3","K4"]);
  assert.deepEqual(Object.fromEntries(Object.entries(result.cells).map(([k,v])=>[k,v.value])),{revenue:"130",cost:"90",net:"0"});
  assert.equal(result.cells.net.source,"K4:net");assert.equal(result.cells.cost.source,full.cells.cost.source);
  assert.equal(resolveFinancialRevision([base,full,correction,k4]).id,result.id);
});
test("nil, withdrawn and invalid amendments do not resurrect an old amount; full replacements never fill gaps",()=>{
  for(const state of ["UNAVAILABLE","WITHDRAWN","INVALID"] as const){
    const r=resolveFinancialRevision([base,full,{...correction,changedFields:["net"],cells:{net:{value:null,state,source:"K3:net"}}}]);
    assert.equal(r.cells.net.value,null);assert.equal(r.cells.net.state,state);assert.equal(r.cells.cost.value,"90");
  }
  assert.deepEqual(Object.keys(resolveFinancialRevision([base,{...full,cells:{net:value("0")}}]).cells),["net"]);
});
test("unproven parent/scope, mixed families, ties, invalid metadata and cycles fail closed",()=>{
  for(const revisions of [[],[correction],[base,{...full,parent:"missing"}],[base,{...full,evidence:undefined}],
    [base,{...full,family:"group"}],[base,{...full,filedAt:base.filedAt}],[base,{...full,filedAt:"bad"}],
    [base,full,{...correction,changedFields:undefined}],[base,full,{...correction,changedFields:["net"]}],
    [base,{...full,kind:"UNRESOLVED" as const}],[{...base,parent:"V2"},full]]) {
    const r=resolveFinancialRevision(revisions);assert.equal(r.status,"UNRESOLVED");assert.deepEqual(r.cells,{});
  }
});

function record(id:string,date:string,net="10",cost:string|null="80") {return {id,identifiers:{pl_nip:"1111111111"},document:{type:"financial_statement",period_from_date:"2025-01-01",period_to_date:"2025-12-31",filing_date:date,is_correction:id!=="original",is_ias_compliant:false},content:{standardized_fields:{pala:{npl_cfy:net,nrfs_cfy:"100",...cost===null?{}:{oac_cfy:cost}}},schema:{name:"JednostkaInnaWZlotych",version:"1-0E"},extracted_fields:{"RZiS.RZiSPor.A.KwotaA":"100","RZiS.RZiSPor.L.KwotaA":net,...cost===null?{}:{"RZiS.RZiSPor.B.KwotaA":cost}}}};}
test("whole financially equivalent corrected documents resolve; missing or changed fields are never equivalent",()=>{
  const original=record("original","2026-01-01"), identical=record("copy","2026-02-01");
  assert.equal(resolveDocumentFamily(projectFinancialDocuments([original,identical])).status,"RESOLVED");
  for(const other of [record("partial","2026-02-01","10",null),record("changed","2026-02-01","11")])
    assert.equal(resolveDocumentFamily(projectFinancialDocuments([original,other])).status,"UNRESOLVED");
});
test("ingestion never combines missing costs in a newer filing with values from an older full document",()=>{
  const result=mapMgbiFinancialRecords([record("original","2026-01-01"),record("partial","2026-02-01","20",null)],{type:"NIP",value:"1111111111"},"2026-10-15");
  assert.equal(result.facts.find(f=>f.metricCode==="PALA_NPL")?.amount,"20");
  assert.ok(!result.facts.some(f=>f.metricCode==="PALA_OAC"));
  assert.equal(result.section.data?.periods[0].revisionStatus,"UNRESOLVED");
});
