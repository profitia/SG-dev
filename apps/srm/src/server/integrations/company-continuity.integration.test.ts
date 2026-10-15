import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {COMPANY_GENERAL_ARCHIVE_SQL,readArchivedCompanyGeneral} from "../company-general-cache";

test("PostgreSQL: old identity archive resolves active successor without writes or provider calls; person data and other tenants stay excluded",{skip:!process.env.SRM_MIGRATION_TEST_URL},async()=>{
 const url=new URL(process.env.SRM_MIGRATION_TEST_URL!);assert.ok(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname==="/srm_migration_test");
 const c=new pg.Client({connectionString:url.toString()});await c.connect();
 const schema="continuity_fixture",role="continuity_fixture_runtime",a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",nip="5850205607";
 const old={id:"old",identifiers:{pl_nip:nip,pl_krs:"0000065856",pl_regon:"003005759",pl_pesel:"PRIVATE_ID"},content:{current_excerpt:null,full_excerpt:{naglowekP:{stanPozycji:2,wpis:[{numerWpisu:1,opis:"REJESTRACJA",dataWpisu:"03.12.2001"},{numerWpisu:2,opis:"WYKREŚLENIE Z KRAJOWEGO REJESTRU SĄDOWEGO",dataWpisu:"04.06.2024"}]},dane:{dzial1:{danePodmiotu:{nazwa:[{nazwa:"ROCKFIN dawny"}]}}}}}};
 const active={id:"active",identifiers:{pl_nip:nip,pl_krs:"0001233591",pl_regon:"003005759"},content:{current_excerpt:{naglowekA:{numerKRS:"0001233591",stanPozycji:1,dataRejestracjiWKRS:"01.04.2026"},dane:{dzial1:{danePodmiotu:{nazwa:"ROCKFIN aktualny"},sposobPowstaniaPodmiotu:{okolicznosciPowstania:"PRZEKSZTAŁCENIE",opisSposobuPowstaniaInformacjaOUchwale:"PRIVATE_PROSE",podmioty:[{krs:{krs:"0000065856"},private:"PRIVATE_PERSON"}]}},dzial2:{representatives:["PRIVATE_PERSON"]}}}}};
 const adapter={query:(sql:string,args?:unknown[])=>c.query(sql.replaceAll("srm.",schema+"."),args)} as Pick<pg.PoolClient,"query">;
 try{
  await c.query("BEGIN");await c.query(`CREATE SCHEMA ${schema}`);await c.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await c.query(`CREATE TABLE ${schema}.mgbi_source_archives(organization_id uuid,nip text,model text,record_count int,last_checked_at timestamptz,payload_json jsonb,payload_jsonb_sha256 text)`);
  const insert=`INSERT INTO ${schema}.mgbi_source_archives(organization_id,nip,model,record_count,last_checked_at,payload_json,payload_jsonb_sha256) VALUES($1,$2,'pl-krs-wp-record',2,'2026-10-15T10:00:00Z',$3::jsonb,encode(sha256(convert_to(($3::jsonb)::text,'UTF8')),'hex'))`;
  await c.query(insert,[a,nip,JSON.stringify({pages:[{results:[old,active]}]})]);
  await c.query(insert,[b,nip,JSON.stringify({pages:[{results:[old,{...active,id:"foreign"}]}]})]);
  await c.query(`ALTER TABLE ${schema}.mgbi_source_archives ENABLE ROW LEVEL SECURITY`);await c.query(`ALTER TABLE ${schema}.mgbi_source_archives FORCE ROW LEVEL SECURITY`);
  await c.query(`CREATE POLICY org ON ${schema}.mgbi_source_archives USING(organization_id=nullif(current_setting('${schema}.organization_id',true),'')::uuid)`);
  await c.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);await c.query(`GRANT SELECT ON ${schema}.mgbi_source_archives TO ${role}`);await c.query(`SET LOCAL ROLE ${role}`);
  await c.query("SELECT set_config($1,$2,true)",[schema+".organization_id",a]);
  const before=(await c.query(`SELECT payload_jsonb_sha256 FROM ${schema}.mgbi_source_archives`)).rows;
  const projected=(await adapter.query(COMPANY_GENERAL_ARCHIVE_SQL,[nip,a])).rows[0];
  assert.doesNotMatch(JSON.stringify(projected),/PRIVATE_ID|PRIVATE_PERSON|PRIVATE_PROSE/);
  const restored=await readArchivedCompanyGeneral(adapter,a,nip);assert.equal(restored?.section.data?.krs,"0001233591");assert.equal(restored?.section.data?.registrationStatus,"ACTIVE");assert.equal(restored?.section.data?.registryHistory?.members.length,2);
  assert.equal(await readArchivedCompanyGeneral(adapter,b,nip),null);
  assert.deepEqual((await c.query(`SELECT payload_jsonb_sha256 FROM ${schema}.mgbi_source_archives`)).rows,before);
  await c.query("SELECT set_config($1,$2,true)",[schema+".organization_id",""]);assert.equal(await readArchivedCompanyGeneral(adapter,a,nip),null);
 }finally{await c.query("ROLLBACK");await c.end();}
});
