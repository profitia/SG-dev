import test from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import { enrichCompanyPkd, COMPANY_PKD_SQL } from "./company-pkd";
import { mapMgbiGeneralRecord, mapPrimaryPkd } from "./mgbi-general";

const org = "00000000-0000-4000-8000-000000000001", nip = "5213390341";
const activity = [{ kodDzial: "46", kodKlasa: "38", kodPodklasa: "Z", opis: "Sprzedaż hurtowa pozostałej żywności" }];
const section = () => mapMgbiGeneralRecord({ id:"wp-current", identifiers:{pl_nip:nip}, content:{current_excerpt:{dane:{dzial3:{przedmiotDzialalnosci:{przedmiotPrzewazajacejDzialalnosci:activity}}}}} }, "2026-10-08T12:00:00Z").section;
function database(value: unknown) {
  let reads = 0;
  const client = { release() {}, async query(sql:string,params?:unknown[]) {
    if (sql.includes("current_database")) return {rows:[{database_name:"srm_app",bypass_rls:false,superuser:false,neon_superuser_member:false}]};
    if (sql.includes("FROM srm.organizations")) return {rows:[{id:org}]};
    if (sql === COMPANY_PKD_SQL) { reads++; assert.deepEqual(params,[nip,org,"wp-current"]); return {rows:[{activity:value}]}; }
    return {rows:[]};
  }};
  return { count:()=>reads, pool:{connect:async()=>client as unknown as pg.PoolClient} };
}
test("MGBI primary code and description come from the same current activity, never a secondary entry", () => {
  assert.deepEqual(mapPrimaryPkd(activity),{code:"46.38.Z",description:activity[0].opis});
  assert.equal(section().data?.mainPkdDescription,activity[0].opis);
  assert.deepEqual(mapPrimaryPkd([{kod:"46.38.Z"},{kod:"62.01.Z",opis:"Inna działalność"}]),{code:"46.38.Z",description:null});
  assert.deepEqual(mapPrimaryPkd([{opis:"Opis bez kodu"}]),{code:null,description:null});
});
test("legacy cached description is enriched from tenant and exact source record without writes", async () => {
  const old=section(); delete old.data!.mainPkdDescription;
  const before=JSON.stringify(old), db=database(activity);
  const result=await enrichCompanyPkd(org,nip,old,db.pool);
  assert.equal(result?.mainPkdDescription,activity[0].opis); assert.equal(db.count(),1);
  assert.equal(JSON.stringify(old),before);
  assert.match(COMPANY_PKD_SQL,/a\.organization_id=\$2::uuid/);
  assert.match(COMPANY_PKD_SQL,/identifiers,pl_nip.*=\$1/);
  assert.match(COMPANY_PKD_SQL,/r\.record->>'id'=\$3/);
  assert.doesNotMatch(COMPANY_PKD_SQL,/full_excerpt|pesel|INSERT|UPDATE|DELETE|SELECT \*/i);
});
test("absent/foreign or mismatched archive cannot invent a description; current values need no archive", async () => {
  for(const value of [null,[],[{kod:"62.01.Z",opis:"Other"}], [{kod:"46.38.Z"}]]) {
    const old=section(); delete old.data!.mainPkdDescription;
    assert.equal((await enrichCompanyPkd(org,nip,old,database(value).pool))?.mainPkdDescription,undefined);
  }
  const db=database(activity), current=section();
  assert.equal(await enrichCompanyPkd(org,nip,current,db.pool),current.data);
  delete current.data!.mainPkdDescription;
  current.source.recordId=null;
  await enrichCompanyPkd(org,nip,current,db.pool);
  current.source.recordId="wp-current";current.data!.nip="0000000000";
  await enrichCompanyPkd(org,nip,current,db.pool);
  assert.equal(db.count(),0);
});
