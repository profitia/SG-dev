import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { claimMsrSource } from "../msr-repository";
import type { MsrCandidate } from "../msr-financial";

test("isolated PostgreSQL MSR migration: RLS, immutable sources, no duplicate paid claim and no runtime DELETE",{skip:!process.env.SRM_MIGRATION_TEST_URL},async()=>{
  const url=new URL(process.env.SRM_MIGRATION_TEST_URL!);assert.ok(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname==="/srm_migration_test");
  const client=new pg.Client({connectionString:url.toString()});await client.connect();
  const schema="srm_msr_fixture",role="srm_msr_fixture_runtime",a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
  const candidate:MsrCandidate={recordId:"a".repeat(24),nip:"5272443955",from:"2024-01-01",to:"2024-12-31",scope:"standalone",filingDate:null,correction:false,documentId:null};
  const adapted={query:(sql:string,args?:unknown[])=>client.query(sql.replaceAll("srm.",schema+"."),args)} as Pick<pg.PoolClient,"query">;
  try{
    await client.query("BEGIN");await client.query(`CREATE SCHEMA ${schema}`);await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await client.query(`CREATE TABLE ${schema}.organizations(id uuid PRIMARY KEY)`);await client.query(`INSERT INTO ${schema}.organizations VALUES($1),($2)`,[a,b]);
    await client.query(`CREATE TABLE ${schema}.lookup_requests(organization_id uuid,id uuid,PRIMARY KEY(organization_id,id))`);
    await client.query(`INSERT INTO ${schema}.lookup_requests VALUES($1,'33333333-3333-4333-8333-333333333333')`,[a]);
    await client.query(readFileSync(new URL("../../../db/migrations/0017_msr_ixbrl_sources.sql",import.meta.url),"utf8").replaceAll("srm.",schema+".").replaceAll("srm_app_runtime",role));
    await client.query(readFileSync(new URL("../../../db/migrations/0018_msr_versioned_projections.sql",import.meta.url),"utf8").replaceAll("srm.",schema+".").replaceAll("srm_app_runtime",role));
    await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);await client.query(`SET LOCAL ROLE ${role}`);
    await client.query("SELECT set_config($1,$2,true)",[schema+".organization_id",a]);
    const nonce="33333333-3333-4333-8333-333333333333";
    assert.equal(await claimMsrSource(adapted,a,candidate,nonce,nonce),true);assert.equal(await claimMsrSource(adapted,a,candidate,nonce,nonce),false);
    await client.query(`UPDATE ${schema}.msr_sources SET state='DEFERRED',error_code='MSR_FILE_BUDGET_EXHAUSTED'`);
    assert.equal(await claimMsrSource(adapted,a,candidate,nonce,nonce),true);
    await client.query(`UPDATE ${schema}.msr_sources SET state='RECEIVED',original_bytes=decode('616263','hex'),original_sha256=encode(sha256(decode('616263','hex')),'hex'),original_format='XHTML',original_container='DOCUMENT',retrieved_at=now()`);
    const rejected=async(sql:string,code:string)=>{await client.query("SAVEPOINT bad");await assert.rejects(client.query(sql),(e:unknown)=>(e as {code:string}).code===code);await client.query("ROLLBACK TO SAVEPOINT bad");};
    await rejected(`UPDATE ${schema}.msr_sources SET original_bytes=decode('646566','hex')`,"23514");
    await rejected(`UPDATE ${schema}.msr_sources SET state='REQUESTED'`,"23514");
    await rejected(`UPDATE ${schema}.msr_sources SET parsed_json='{}',parsed_sha256='wrong'`,"23514");
    await rejected(`DELETE FROM ${schema}.msr_sources`,"42501");
    const document={checksum:"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",mappingVersion:"test-v2"};
    const insert=`INSERT INTO ${schema}.msr_projections(organization_id,nip,record_id,projection_version,original_sha256,projection_json,projection_sha256)
      VALUES($1,$2,$3,'test-v2',$4,$5::jsonb,encode(sha256(convert_to(($5::jsonb)::text,'UTF8')),'hex'))`;
    await client.query(insert,[a,candidate.nip,candidate.recordId,document.checksum,JSON.stringify({document})]);
    await rejected(`UPDATE ${schema}.msr_projections SET projection_version='bad'`,"42501");
    await rejected(`DELETE FROM ${schema}.msr_projections`,"42501");
    // The old source receipt remains readable after the additive migration.
    assert.equal((await client.query(`SELECT state FROM ${schema}.msr_sources`)).rows[0].state,"RECEIVED");

    await client.query("SELECT set_config($1,$2,true)",[schema+".organization_id",b]);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${schema}.msr_sources`)).rows[0].n,0);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${schema}.msr_projections`)).rows[0].n,0);
    assert.equal((await client.query(`UPDATE ${schema}.msr_sources SET error_code='MSR_FOREIGN'`)).rowCount,0);
    await client.query("SAVEPOINT foreign_write");await assert.rejects(claimMsrSource(adapted,a,{...candidate,recordId:"b".repeat(24)},nonce,nonce),(e:unknown)=>(e as {code:string}).code==="42501");await client.query("ROLLBACK TO SAVEPOINT foreign_write");
    const flags=(await client.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='${schema}.msr_sources'::regclass`)).rows[0];assert.deepEqual(flags,{relrowsecurity:true,relforcerowsecurity:true});
  }finally{await client.query("ROLLBACK");await client.end();}
});
