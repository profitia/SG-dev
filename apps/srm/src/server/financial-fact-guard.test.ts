import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

const connection=process.env.SRM_OPERATION_TEST_OWNER_URL??process.env.SRM_MIGRATION_TEST_URL;
const own=(name:string)=>readFileSync(new URL('../../db/private-store/'+name,import.meta.url),'utf8');
const original=own('010-supplier-sensitive-work.sql').match(/CREATE OR REPLACE FUNCTION srm\.guard_supplier_business_write\(\)[\s\S]*?END \$fn\$;/)?.[0];
const patch=own('015-financial-fact-guard.sql');

// The real SQL trigger is tested with a simulated current-work authority. Full
// E1, revocation and RLS remain covered by the existing isolated integration suite.
test('financial guard preserves provenance refusals, other sensitive dispatch and guarded rollback',{skip:!connection},async t=>{
 assert(original);
 const url=new URL(connection!);
 assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
 assert(['srm_app','srm_migration_test'].includes(url.pathname.slice(1)));
 assert(['architecture_test_owner','srm_test_owner'].includes(url.username));
 const root=new pg.Client({connectionString:url.href});await root.connect();
 const suffix=randomUUID().replaceAll('-',''),database='srm_guard_'+suffix,writerRole='srm_guard_writer_'+suffix;
 const A=randomUUID(),B=randomUUID(),S=randomUUID(),foreignSupplier=randomUUID(),R=randomUUID(),foreignRequest=randomUUID();
 const attempt=randomUUID(),foreignAttempt=randomUUID(),snapshot=randomUUID(),foreignSnapshot=randomUUID(),generalSnapshot=randomUUID();
 const nip='8650004194';let owner:pg.Client|undefined,writer:pg.Client|undefined;
 try{
  await root.query(`CREATE DATABASE ${database}`);
  if(!(await root.query("SELECT 1 FROM pg_roles WHERE rolname='profitia_access_owner'")).rowCount)
   await root.query('CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  await root.query(`CREATE ROLE ${writerRole} LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
  url.pathname='/'+database;owner=new pg.Client({connectionString:url.href});await owner.connect();
  await owner.query(`CREATE SCHEMA srm AUTHORIZATION profitia_access_owner;SET ROLE profitia_access_owner;
   CREATE TABLE srm.suppliers(id uuid,organization_id uuid,nip text);
   CREATE TABLE srm.lookup_requests(id uuid,organization_id uuid,supplier_id uuid,identifier text,entity_type text);
   CREATE TABLE srm.provider_attempts(id uuid,organization_id uuid,request_id uuid,section text);
   CREATE TABLE srm.source_snapshots(id uuid DEFAULT gen_random_uuid(),organization_id uuid,supplier_id uuid,attempt_id uuid,section text,data_class text);
   CREATE TABLE srm.financial_facts(id uuid DEFAULT gen_random_uuid(),organization_id uuid,supplier_id uuid,snapshot_id uuid);
   CREATE FUNCTION srm.current_supplier_work(uuid DEFAULT NULL,uuid DEFAULT NULL,text DEFAULT NULL) RETURNS jsonb
    LANGUAGE sql AS $$SELECT nullif(current_setting('fixture.work',true),'')::jsonb$$;
   CREATE FUNCTION srm.guard_sensitive_supplier_write(text,text,jsonb,jsonb) RETURNS boolean
    LANGUAGE sql AS $$SELECT $1='source_snapshots' AND $2='INSERT' AND srm.current_supplier_work()->>'unitId'='SRM_KYS_STORE'$$;
   CREATE FUNCTION srm.supplier_business_phase(p_org uuid,p_nip text,p_request uuid,p_phases text[]) RETURNS boolean
    LANGUAGE sql AS $$SELECT coalesce(srm.current_supplier_work()->>'organisationId'=p_org::text
     AND srm.current_supplier_work()->>'requestId'=p_request::text AND srm.current_supplier_work()->>'nip'=p_nip
     AND srm.current_supplier_work()->>'accessMode'='WRITE'
     AND srm.current_supplier_work()->>'unitId'=ANY(SELECT 'SRM_'||v FROM unnest(p_phases)v),false)$$;
   ${original}
   REVOKE ALL ON FUNCTION srm.guard_supplier_business_write() FROM PUBLIC;
   RESET ROLE;`);
  await owner.query('INSERT INTO srm.lookup_requests VALUES($1,$2,$3,$4,\'COMPANY\'),($5,$6,$7,$4,\'COMPANY\')',[R,A,S,nip,foreignRequest,B,foreignSupplier]);
  await owner.query("INSERT INTO srm.provider_attempts VALUES($1,$2,$3,'financial'),($4,$5,$6,'financial')",[attempt,A,R,foreignAttempt,B,foreignRequest]);
  await owner.query("INSERT INTO srm.source_snapshots VALUES($1,$2,$3,$4,'financial','FINANCIAL'),($5,$6,$7,$8,'financial','FINANCIAL'),($9,$2,$3,$4,'general','COMPANY')",[snapshot,A,S,attempt,foreignSnapshot,B,foreignSupplier,foreignAttempt,generalSnapshot]);
  await owner.query(`SET ROLE profitia_access_owner;
   CREATE TRIGGER business_guard BEFORE INSERT OR UPDATE OR DELETE ON srm.financial_facts FOR EACH ROW EXECUTE FUNCTION srm.guard_supplier_business_write();
   CREATE TRIGGER business_guard BEFORE INSERT OR UPDATE OR DELETE ON srm.source_snapshots FOR EACH ROW EXECUTE FUNCTION srm.guard_supplier_business_write();
   GRANT USAGE ON SCHEMA srm TO ${writerRole};GRANT SELECT,INSERT,UPDATE,DELETE ON srm.financial_facts,srm.source_snapshots TO ${writerRole};RESET ROLE`);
  url.username=writerRole;url.password='isolated_ci_only';writer=new pg.Client({connectionString:url.href});await writer.connect();
  const control=async(action:()=>Promise<unknown>)=>{await owner!.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{await action();await owner!.query('COMMIT')}catch(e){await owner!.query('ROLLBACK');throw e}};
  const identity=async()=>(await owner!.query("SELECT pg_get_functiondef(oid) definition,md5(pg_get_functiondef(oid)) digest,proowner,proacl::text acl,prosecdef,proconfig FROM pg_proc WHERE oid='srm.guard_supplier_business_write()'::regprocedure")).rows[0];
  const before=await identity();
  await t.test('operator refusal, exact identity, idempotence, rollback and source drift',async()=>{
   await assert.rejects(owner!.query(patch),(e:{code:string})=>e.code==='42501');
   await owner!.query('BEGIN;SET LOCAL ROLE profitia_access_owner');
   try{
    await owner!.query('SAVEPOINT candidate');await owner!.query(patch);const after=await identity();
    assert.equal(after.digest,'1528f903448f0dac2c0e99565f141157');
    for(const k of['proowner','acl','prosecdef','proconfig'])assert.deepEqual(after[k],before[k]);
    await owner!.query(patch);assert.deepEqual(await identity(),after);
    await owner!.query('ROLLBACK TO SAVEPOINT candidate');assert.deepEqual(await identity(),before);
    await owner!.query(before.definition.replace('BEGIN\n','BEGIN\n-- isolated drift\n'));
    await assert.rejects(owner!.query(patch),/source drift/);
   }finally{await owner!.query('ROLLBACK')}
   assert.deepEqual(await identity(),before);
  });
  const context={organisationId:A,requestId:R,nip,accessMode:'WRITE',unitId:'SRM_STORE_FINANCIAL'};
  const cases=[
   {name:'current financial provenance',context,args:[A,S,snapshot],allowed:true},
   {name:'another organization',context,args:[B,foreignSupplier,foreignSnapshot],allowed:false},
   {name:'another supplier',context,args:[A,foreignSupplier,snapshot],allowed:false},
   {name:'non-financial snapshot',context,args:[A,S,generalSnapshot],allowed:false},
   {name:'no current work',context:null,args:[A,S,snapshot],allowed:false},
   {name:'READ purpose',context:{...context,accessMode:'READ'},args:[A,S,snapshot],allowed:false},
   {name:'another request',context:{...context,requestId:foreignRequest},args:[A,S,snapshot],allowed:false},
   {name:'KYS purpose cannot write financial facts',context:{...context,unitId:'SRM_KYS_STORE',sensitiveWork:true},args:[A,S,snapshot],allowed:false},
  ];
  for(const version of['original','optimized']){
   if(version==='optimized')await control(()=>owner!.query(patch));
   for(const c of cases)await t.test(version+': '+c.name,async()=>{
    await writer!.query('BEGIN');try{
     await writer!.query("SELECT set_config('fixture.work',$1,true)",[c.context?JSON.stringify(c.context):'']);
     const insert=()=>writer!.query('INSERT INTO srm.financial_facts(organization_id,supplier_id,snapshot_id) VALUES($1,$2,$3)',c.args);
     if(c.allowed)assert.equal((await insert()).rowCount,1);else await assert.rejects(insert(),(e:{code:string})=>e.code==='42501');
    }finally{await writer!.query('ROLLBACK')}
   });
   await t.test(version+': sensitive dispatch for other tables is retained',async()=>{
    await writer!.query('BEGIN');try{
     await writer!.query("SELECT set_config('fixture.work',$1,true)",[JSON.stringify({...context,unitId:'SRM_KYS_STORE',sensitiveWork:true})]);
     assert.equal((await writer!.query("INSERT INTO srm.source_snapshots(organization_id,supplier_id,attempt_id,section,data_class) VALUES($1,$2,$3,'kys','KYS_PERSONAL')",[A,S,attempt])).rowCount,1);
    }finally{await writer!.query('ROLLBACK')}
   });
  }
 }finally{
  await writer?.end();await owner?.end();
  await root.query(`DROP DATABASE IF EXISTS ${database} WITH(FORCE)`);
  await root.query(`DROP ROLE IF EXISTS ${writerRole}`);await root.end();
 }
});
