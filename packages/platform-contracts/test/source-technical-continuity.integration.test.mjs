import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg')
const source=n=>fs.readFileSync(new URL('../migrations/access/'+n,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')
const ROLE='source_continuity_fixture',DB='source_continuity_'+randomUUID().replaceAll('-',''),sources=['fixture.token','fixture.api']
test('SQL035 renews only current revocable technical authority and preserves unmetered accounting',{skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner'),root=new Client({connectionString:rootUrl});await root.connect();let owner,runtime
 const url=new URL(rootUrl);url.pathname='/'+DB
 try{
  await root.query(`CREATE DATABASE ${DB}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  try{for(const [name,login]of[['profitia_ingestion_owner',false],[ROLE,true]])if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect();await owner.query(`CREATE EXTENSION pgcrypto;GRANT CREATE ON DATABASE ${DB} TO profitia_ingestion_owner`)
  const controlled=async fn=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner');try{const v=await fn();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  const Q=hash(source('035-source-technical-continuity.sql'))
  await controlled(async()=>{
   await owner.query(source('008-platform-ingestion.sql'));await owner.query("INSERT INTO profitia_ingestion.installation VALUES(true,'1.0.0',$1,'development','continuity-fixture','continuity-branch',$2,1)",[hash(source('008-platform-ingestion.sql')),DB])
   await owner.query(source('009-external-call-admission.sql'));await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','continuity-fixture','continuity-branch',$3)",[hash(source('009-external-call-admission.sql')),hash(source('008-platform-ingestion.sql')),DB])
   await owner.query(source('012-native-external-transport.sql'));await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(source('012-native-external-transport.sql'))])
   await owner.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(source('024-unmetered-public-sources.sql'))]);await owner.query(source('024-unmetered-public-sources.sql'))
   await owner.query("SELECT set_config('profitia.install.source_continuity_digest',$1,true)",[Q]);await owner.query(source('035-source-technical-continuity.sql'))
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings VALUES($1,$2,$3,'fixture-source','PLATFORM_INTERNAL','fixture-deploy','fixture-config','ACTIVE',1,'SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   for(const sid of sources){
    await owner.query("INSERT INTO profitia_ingestion.sources VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','fixture','fixture','source-receipt-v1','ACTIVE',1,'SYNTHETIC_ONLY',now()+interval '1 hour')",[sid])
    await owner.query("INSERT INTO profitia_ingestion.grants VALUES($1,$2,$3,'resource:'||$3,'ALLOW','ACTIVE',1,'SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,sid])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref,quota_mode,consumed_count) VALUES($1,'fixture-source',$2,'SOURCE_TRANSACTION',2000,now(),now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY','METERED',1501)",[randomUUID(),sid])
    const id=randomUUID();await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'resource:'||$3,'fixture-http','https://provider.fixture.test','HTTPS','[{\"method\":\"GET\",\"path\":\"/data\"}]',1024,4096,1000,'UPSTREAM_ATTEMPT_ADMISSION',50,now(),now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[id,ROLE,sid])
    await owner.query("INSERT INTO profitia_external_native.policies VALUES($1,1,'[{\"method\":\"GET\",\"path\":\"/data\",\"requestFormat\":\"NONE\"}]','[]',4096,'NONE','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',1,now()+interval '1 hour','SYNTHETIC_ONLY')",[id])
   }
   const controls=(await owner.query('SELECT profitia_ingestion.continuity_controls($1,$2,$3) value',[ROLE,'fixture-source',sources])).rows[0].value
   const versions=Object.fromEntries(controls.map(c=>[c.id,String(c.definition.version)]));
   const activated=(await owner.query('SELECT profitia_ingestion.activate_unmetered_sources($1,$2,$3,$4,$5,$6) value',[ROLE,'fixture-source',sources,'owner-decision:sha256:'+'a'.repeat(64),versions,1])).rows[0].value;assert.equal(activated.status,'ACTIVATED');
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.maintain_source_technical_access(text) TO ${ROLE}`)
  })
  const runtimeUrl=new URL(url);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only';runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
  const maintain=async digest=>(await runtime.query('SELECT profitia_ingestion.maintain_source_technical_access($1) value',[digest??Q])).rows[0].value
  assert.ok((await runtime.query('SELECT profitia_ingestion.runtime_descriptor() value')).rows[0].value)
  await t.test('wrong digest and ordinary policy DML are refused',async()=>{await assert.rejects(maintain('f'.repeat(64)),e=>e.code==='42501');await assert.rejects(runtime.query("UPDATE profitia_source_continuity.policies SET status='ACTIVE'"),e=>e.code==='42501')})
  await t.test('finite leases renew without resetting or recreating quantitative policies',async()=>{
   const before=(await owner.query('SELECT policy_id,consumed_count,version FROM profitia_ingestion.budgets ORDER BY policy_id')).rows
   const r=await maintain();assert.equal(r.status,'RENEWED');assert.ok(Date.parse(r.leaseUntil)>Date.now()+29*86400000)
   assert.deepEqual((await owner.query('SELECT policy_id,consumed_count,version FROM profitia_ingestion.budgets ORDER BY policy_id')).rows,before)
   assert.equal((await maintain()).status,'CURRENT');assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_source_continuity.events')).rows[0].n,2)
   assert.equal((await owner.query('SELECT bool_and(n.base_policy_version=e.version) ok FROM profitia_external_call.policies e JOIN profitia_external_native.policies n USING(policy_id)')).rows[0].ok,true)
  })
  await t.test('renewal cannot revive a revoked source, grant or owner basis',async()=>{
   for(const table of ['sources','grants']){await controlled(()=>owner.query(`UPDATE profitia_ingestion.${table} SET status='REVOKED' WHERE source_id=$1`,[sources[0]]));await assert.rejects(maintain(),e=>e.code==='42501');await controlled(()=>owner.query(`UPDATE profitia_ingestion.${table} SET status='ACTIVE' WHERE source_id=$1`,[sources[0]]))}
   await controlled(()=>owner.query("UPDATE profitia_source_continuity.policies SET status='REVOKED' WHERE login_role=$1",[ROLE]));await assert.rejects(maintain(),e=>e.code==='42501')
  })
 }finally{if(runtime)await runtime.end();if(owner)await owner.end();await root.query(`DROP DATABASE IF EXISTS ${DB} WITH(FORCE)`);await root.end()}
})
