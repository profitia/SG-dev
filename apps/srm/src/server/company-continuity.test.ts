import assert from "node:assert/strict";
import test from "node:test";
import {resolveCompanyRecords,financialRegistration} from "./company-continuity";
import {fetchMgbiGeneral} from "./mgbi-general";
import {mapMgbiFinancialRecords} from "./mgbi-financial";
import {projectFinancialDocuments} from "./financial-documents";
import {resolveDocumentFamily} from "./financial-revisions";

const nip="5850205607",krs=["0000065856","0001102066","0001233591"];
function registration(index:number, removed=true) {
 const previous=index?krs[index-1]:null,from=["03.12.2001","02.05.2024","01.04.2026"][index];
 const formation=previous?{okolicznosciPowstania:"PRZEKSZTAŁCENIE",podmioty:[{krs:{krs:previous}}]}:undefined;
 return {id:"wp-"+index,identifiers:{pl_nip:nip,pl_krs:krs[index],pl_regon:"003005759"},content:{
  current_excerpt:removed?null:{naglowekA:{numerKRS:krs[index],dataRejestracjiWKRS:from,stanPozycji:1},dane:{dzial1:{danePodmiotu:{nazwa:"ROCKFIN "+(index===1?"S.A.":"sp. z o.o."),formaPrawna:index===1?"SPÓŁKA AKCYJNA":"SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ"},sposobPowstaniaPodmiotu:formation}}},
  full_excerpt:{naglowekP:{numerKRS:krs[index],stanPozycji:removed?2:1,wpis:[{numerWpisu:1,opis:"REJESTRACJA",dataWpisu:from},...(removed?[{numerWpisu:2,opis:"WYKREŚLENIE Z KRAJOWEGO REJESTRU SĄDOWEGO",dataWpisu:index===0?"04.06.2024":"12.05.2026"}]:[])]},dane:{dzial1:{danePodmiotu:{nazwa:[{nazwa:"ROCKFIN "+(index===1?"S.A.":"sp. z o.o.")}]},sposobPowstaniaPodmiotu:formation}}}}};
}
const records=()=>[registration(0),registration(1),registration(2,false)];
test("two transformations resolve to the current KRS independently of all six provider orders",()=>{
 const rows=records();
 for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
  const r=resolveCompanyRecords(order.map(i=>rows[i]),{type:"NIP",value:nip});assert.equal(r.error,null);
  assert.equal((r.record as typeof rows[0]).identifiers.pl_krs,krs[2]);
  assert.deepEqual(r.history?.members.map(m=>m.krs),[...krs].reverse());assert.equal(r.history?.links.length,2);
  assert.equal(r.history?.members[0].status,"ACTIVE");assert.equal(r.history?.members[1].deregisteredAt,"2026-05-12");
 }
});
test("explicit historical KRS stays historical; all-removed history does not manufacture an active company",()=>{
 const r=resolveCompanyRecords(records(),{type:"KRS",value:krs[0]});assert.equal(r.history?.currentKrs,krs[0]);assert.equal(r.history?.members[0].status,"DEREGISTERED");
 const all=resolveCompanyRecords([registration(0),registration(1)],{type:"NIP",value:nip});assert.equal(all.history?.currentKrs,krs[1]);assert.equal(all.history?.members[0].status,"DEREGISTERED");
});
test("multiple active, contradictory headers, duplicate KRS and conflicting REGON fail closed",()=>{
 const duplicate=records();duplicate.push({...duplicate[0],id:"duplicate"});
 const mismatch=records();mismatch[2].content.current_excerpt!.naglowekA.numerKRS=krs[0];
 const regon=records();regon[1].identifiers.pl_regon="123456789";
 const unknown=records();unknown[0].content.full_excerpt.naglowekP.stanPozycji=1;
 for(const rows of [[registration(0,false),registration(2,false)],duplicate,mismatch,regon,unknown])
  assert.equal(resolveCompanyRecords(rows,{type:"NIP",value:nip}).error,"COMPANY_IDENTITY_AMBIGUOUS");
});
test("same NIP/name and merger relations cannot admit unrelated predecessor finances",()=>{
 const rows=records();rows[2].content.current_excerpt!.dane.dzial1.sposobPowstaniaPodmiotu!.okolicznosciPowstania="POŁĄCZENIE";
 rows[2].content.full_excerpt.dane.dzial1.sposobPowstaniaPodmiotu!.okolicznosciPowstania="POŁĄCZENIE";
 const r=resolveCompanyRecords(rows,{type:"NIP",value:nip});assert.equal(r.history?.members.length,1);assert.deepEqual(r.history?.unlinkedKrs,krs.slice(0,2));
 assert.equal(financialRegistration(krs[0],r.history!)?.relationship,"UNCONFIRMED");
});
test("provider adapter resolves complete inventory once and exposes no persons, raw records or provider ids in history",async()=>{
 const rows=records();Object.assign(rows[2].identifiers,{pl_pesel:"synthetic-person-secret"});Object.assign(rows[2].content.current_excerpt!.dane,{dzial2:{board:"private-person"}});
 let calls=0;const r=await fetchMgbiGeneral({type:"NIP",value:nip},{apiKey:"fixture-key",fetcher:async()=>{calls++;return Response.json({count:3,pages:1,results:rows});}});
 assert.equal(calls,1);assert.equal(r.section.data?.krs,krs[2]);assert.equal(r.section.data?.registrationStatus,"ACTIVE");
 assert.equal(r.rawResponse?.recordCount,3);assert.doesNotMatch(JSON.stringify(r.section.data),/synthetic-person-secret|private-person|wp-[012]|fixture-key/);
});
function financial(k:string,year:number,net="0") {return {id:`rdf-${k}-${year}`,identifiers:{pl_nip:nip,pl_krs:k},document:{type:"financial_statement",period_from_date:`${year}-01-01`,period_to_date:`${year}-12-31`,filing_date:`${year+1}-03-30`,is_correction:false,is_ias_compliant:false},content:{schema:{name:"JednostkaInnaWZlotych",version:"1-3"},extracted_fields:{"Bilans.Aktywa.KwotaA":"100","RZiS.RZiSPor.L.KwotaA":net},standardized_fields:{pala:{npl_cfy:net}}}};}
test("current identity keeps structured predecessor years and exact source KRS; unknown same-NIP issuer is excluded",()=>{
 const history=resolveCompanyRecords(records(),{type:"NIP",value:nip}).history!;
 const input=[financial(krs[1],2025,"-10"),financial(krs[1],2024,"0"),financial(krs[0],2023,"20"),financial("9999999999",2026,"999")];
 const r=mapMgbiFinancialRecords(input,{type:"NIP",value:nip},"2026-10-15",input.length,history);
 assert.equal(r.section.status,"SUCCESS");assert.equal(r.section.data?.periods.length,3);
 assert.deepEqual(r.section.data?.periods.map(p=>p.sourceRegistration?.relationship),["PREDECESSOR","PREDECESSOR","PREDECESSOR"]);
 assert.deepEqual(r.section.data?.periods.map(p=>p.sourceRegistration?.krs),[krs[1],krs[1],krs[0]]);
 assert.deepEqual(r.facts.filter(f=>f.metricCode==="PALA_NPL").map(f=>f.sourceAmount),["-10","0","20"]);
 assert.equal(r.section.data?.registryHistoryVersion,"KRS_CONTINUITY_V1");
});
test("an actual current-incarnation filing wins its whole period without mixing a predecessor's fields",()=>{
 const history=resolveCompanyRecords(records(),{type:"NIP",value:nip}).history!;
 const old=financial(krs[1],2025,"10"),current=financial(krs[2],2025,"20");
 Object.assign(old.content.standardized_fields.pala,{nrfs_cfy:"1000"});
 const r=mapMgbiFinancialRecords([old,current],{type:"NIP",value:nip},"2026-10-15",2,history);
 assert.equal(r.section.data?.periods[0].sourceRegistration?.relationship,"CURRENT");assert.equal(r.facts.find(f=>f.metricCode==="PALA_NPL")?.amount,"20");
 assert.ok(!r.facts.some(f=>f.metricCode==="PALA_NRFS"));
 assert.equal(resolveDocumentFamily(projectFinancialDocuments([old,{...old,id:"copy",identifiers:{...old.identifiers,pl_krs:krs[2]}}])).status,"UNRESOLVED");
});
