import test from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import { companyRegistration, companyRegistrationStatus, readCompanyRegistration, COMPANY_ACTIVITY_SQL, JDG_ACTIVITY_SQL, readSupplierRegistrationStatus } from "./company-activity";
import { mapMgbiGeneralRecord } from "./mgbi-general";
import { INACTIVE_COMPANY_MESSAGE, inactiveCompanyMessage, jdgDeregistration, inactiveJdgMessage } from "@profitia/srm-xray";
import { fetchCompanyFinancial } from "./xray-lookup";
import { readReportData, REPORT_DATA_SQL } from "./report-data";
import { readStoredKysPdf, KYS_PDF_SQL } from "./kys-pdf-access";
const org="00000000-0000-4000-8000-000000000001", nip="6272384986";
const removed=()=>({id:"wp-company",identifiers:{pl_nip:nip,pl_krs:"0000009418"},content:{current_excerpt:null,full_excerpt:{naglowekP:{stanPozycji:2,wpis:[{numerWpisu:1,opis:"REJESTRACJA",dataWpisu:"13.06.2001"},{numerWpisu:20,opis:"WYKREŚLENIE Z KRAJOWEGO REJESTRU SĄDOWEGO",dataWpisu:"19.01.2009"}]}}}});
function pool(row: unknown) {
 const calls:string[]=[];
 const client={release(){},async query(sql:string,params?:unknown[]){calls.push(sql);
 if(sql.includes("current_database"))return{rows:[{database_name:"srm_app",bypass_rls:false,superuser:false,neon_superuser_member:false}]};
 if(sql.includes("FROM srm.organizations"))return{rows:[{id:org}]};
 if(sql===COMPANY_ACTIVITY_SQL || sql===JDG_ACTIVITY_SQL){assert.deepEqual(params,[nip,org]);return{rows:[row]};}return{rows:[]};}};
 return{calls,pool:{connect:async()=>client as unknown as pg.PoolClient}};
}
test("exact historical removal produces status and source date with numeric/string register entries",()=>{
 for(const string of [false,true]){const r=removed();if(string)r.content.full_excerpt.naglowekP.wpis.forEach(x=>{(x as unknown as {numerWpisu:string}).numerWpisu=String(x.numerWpisu)});
 assert.deepEqual(companyRegistration(r),{status:"DEREGISTERED",deregisteredAt:"2009-01-19"});
 const mapped=mapMgbiGeneralRecord(r,"2026-10-12T16:06:34Z");assert.equal(mapped.section.data?.registrationStatus,"DEREGISTERED");assert.equal(mapped.section.data?.deregisteredAt,"2009-01-19");assert.equal(mapped.section.data?.krs,"0000009418");}
});
test("date is optional; invalid/missing dates do not fabricate a display value",()=>{
 for(const date of ["","31.02.2009","unavailable"]){const r=removed();r.content.full_excerpt.naglowekP.wpis[1].dataWpisu=date;
 assert.deepEqual(companyRegistration(r),{status:"DEREGISTERED",deregisteredAt:null});}
 const data=mapMgbiGeneralRecord(removed(),"2026-10-12").section.data!;
 assert.match(inactiveCompanyMessage(data),/19\.01\.2009 r\./);assert.equal(inactiveCompanyMessage({...data,deregisteredAt:null}),INACTIVE_COMPANY_MESSAGE);
 assert.equal(inactiveCompanyMessage({...data,deregisteredAt:"2009-02-31"}),INACTIVE_COMPANY_MESSAGE);
});
for(const [name,mutate] of [
 ["current excerpt conflicts",(r:ReturnType<typeof removed>)=>{(r.content as unknown as {current_excerpt:object}).current_excerpt={};}],
 ["register state conflicts",(r:ReturnType<typeof removed>)=>{r.content.full_excerpt.naglowekP.stanPozycji=1;}],
 ["future removal date",(r:ReturnType<typeof removed>)=>{r.content.full_excerpt.naglowekP.wpis[1].dataWpisu="19.01.2999";}],
 ["duplicate generation",(r:ReturnType<typeof removed>)=>{r.content.full_excerpt.naglowekP.wpis[1].numerWpisu=1;}],
 ["older removal is not latest",(r:ReturnType<typeof removed>)=>{r.content.full_excerpt.naglowekP.wpis.push({numerWpisu:21,opis:"PRZYWRÓCENIE",dataWpisu:"20.01.2009"});}],
 ["substring does not prove removal",(r:ReturnType<typeof removed>)=>{r.content.full_excerpt.naglowekP.wpis[1].opis="BRAK WYKREŚLENIE Z KRAJOWEGO REJESTRU SĄDOWEGO";}],
] as const)test("inactivity proof rejects "+name,()=>{const r=removed();mutate(r);assert.equal(companyRegistrationStatus(r),"UNKNOWN");});
test("missing name/financial fields and MSR/PDF metadata never prove inactivity",()=>{
 for(const r of [{},{content:{current_excerpt:null}},{document:{is_ias_compliant:true},files:{main_document:{original:{content_type:"application/pdf"}}}}])assert.equal(companyRegistrationStatus(r),"UNKNOWN");
 assert.equal(companyRegistrationStatus({content:{current_excerpt:{dane:{}}}}),"ACTIVE");
});
test("legacy cached company is resolved from own allowlisted archive without provider or writes",async()=>{
 const f=pool({status:null,record:removed()});assert.deepEqual(await readCompanyRegistration(org,nip,f.pool),{status:"DEREGISTERED",deregisteredAt:"2009-01-19"});
 assert.match(COMPANY_ACTIVITY_SQL,/a\.organization_id=\$2::uuid/);assert.match(COMPANY_ACTIVITY_SQL,/identifiers,pl_nip/);assert.match(COMPANY_ACTIVITY_SQL,/source,recordId/);
 assert.doesNotMatch(COMPANY_ACTIVITY_SQL,/pl_pesel|danePodmiotu|representation|INSERT|UPDATE|DELETE/);
 const foreign=pool({status:null,record:null});assert.equal((await readCompanyRegistration(org,nip,foreign.pool)).status,"UNKNOWN");
});
test("removed company skips financial retrieval while active and unknown retain provider behavior",async()=>{
 const base=mapMgbiGeneralRecord(removed(),"2026-10-12").section.data!;let calls=0;
 const provider=async()=>{calls++;return{section:{status:"EMPTY" as const,source:{provider:"MGBI" as const,model:"pl-krs-rdf-record",recordId:null},retrievedAt:null,effectiveAt:null,data:null,warnings:[]},facts:[],errorCode:null}};
 const skipped=await fetchCompanyFinancial(base,{type:"NIP",value:nip},provider);assert.equal(skipped.section.status,"NOT_REQUESTED");assert.equal(calls,0);
 for(const registrationStatus of ["ACTIVE","UNKNOWN"] as const)await fetchCompanyFinancial({...base,registrationStatus},{type:"NIP",value:nip},provider);
 assert.equal(calls,2);
});
test("stored financial/KYS reports are withheld for removed company before reading analytical/person projections",async()=>{
 const f=pool({status:"DEREGISTERED",deregisteredAt:"2009-01-19"});const report=await readReportData(org,{nip,entityType:"COMPANY"},new Date(),f.pool);
 assert.equal(report.financial.periods.length,0);assert.equal(report.kys.reportAvailable,false);assert(!f.calls.includes(REPORT_DATA_SQL));
 assert.equal(await readStoredKysPdf(org,{nip,entityType:"COMPANY"},f.pool),null);assert(!f.calls.includes(KYS_PDF_SQL));
});

const removedJdg=()=>({entries:[{recordId:"TEST-JDG",name:"Test JDG",nip,regon:null,status:"Wykreślony",fields:[{key:"dataWykreslenia",label:"Data wykreślenia",value:"2018-08-18",children:[]},{key:"dataZakonczenia",label:"Data zakończenia",value:"2018-08-17",children:[]}]}]});
test("JDG uses exact removed status and deregistration date, never cessation/suspension",()=>{
 const data=removedJdg();assert.deepEqual(jdgDeregistration(data),{deregistered:true,deregisteredAt:"2018-08-18"});
 assert.match(inactiveJdgMessage(data),/18\.08\.2018/);assert.doesNotMatch(inactiveJdgMessage(data),/17\.08/);
 for(const status of ["Aktywny","Zawieszony","UNKNOWN",null])assert.equal(jdgDeregistration({entries:[{...data.entries[0],status}]}).deregistered,false);
 assert.equal(jdgDeregistration({entries:[...data.entries,{...data.entries[0],status:"Aktywny"}]}).deregistered,false);
 assert.equal(jdgDeregistration({entries:[]}).deregistered,false);
 const missing={entries:[{...data.entries[0],fields:[]}]};assert.deepEqual(jdgDeregistration(missing),{deregistered:true,deregisteredAt:null});assert.doesNotMatch(inactiveJdgMessage(missing),/2018/);
});
test("removed JDG suppresses saved KYS/report access using tenant-scoped date/status projection only",async()=>{
 const f=pool({data:removedJdg()});assert.equal(await readSupplierRegistrationStatus(org,nip,"JDG",f.pool),"DEREGISTERED");
 const report=await readReportData(org,{nip,entityType:"JDG"},new Date(),f.pool);assert.equal(report.kys.reportAvailable,false);
 assert.equal(await readStoredKysPdf(org,{nip,entityType:"JDG"},f.pool),null);assert(!f.calls.includes(KYS_PDF_SQL));assert(!f.calls.includes(REPORT_DATA_SQL));
 assert.match(JDG_ACTIVITY_SQL,/s\.organization_id=\$2::uuid/);assert.match(JDG_ACTIVITY_SQL,/retention_until>now/);assert.doesNotMatch(JDG_ACTIVITY_SQL,/wlasciciel|pesel|name|payload_json/);
});
