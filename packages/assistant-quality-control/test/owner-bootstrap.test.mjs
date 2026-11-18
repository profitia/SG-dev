import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {spawnSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import pg from 'pg'
import {prepareQualityHostBindingTransaction,prepareQualityHostBindingRecoveryTransaction,prepareQualityControlledQaTransaction} from '../src/owner-bootstrap.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex')
const check=(command,args)=>{
 const r=spawnSync(command,args,{encoding:'utf8',timeout:60000})
 if(r.error||r.status!==0)throw Error('Isolated PostgreSQL fixture command failed: '+command+' '+(r.error?.code??r.stderr?.slice(-1000)))
 return r.stdout.trim()
}
async function isolatedPostgres(databaseName='neondb'){
 assert(['neondb','platform_private'].includes(databaseName))
 // A new, task-owned cluster only. No URL, secret or existing cloud database
 // is accepted by this fixture. PostgreSQL binaries must already be installed.
 const bin=process.env.AQC_TEST_POSTGRES_BIN??check('pg_config',['--bindir']);assert(path.isAbsolute(bin)&&path.resolve(bin)===bin)
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-pg-fixture-'))
 const data=path.join(root,'data'),sock=path.join(root,'socket');fs.mkdirSync(sock)
 const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve))
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 let started=false
 try{
  check(path.join(bin,'initdb'),['-D',data,'-U','aqc_fixture_owner','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--no-locale'])
  check(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${sock}`,'-w','start']);started=true
  const url=new URL(`postgresql://aqc_fixture_owner@127.0.0.1:${port}/postgres`)
  const admin=new pg.Pool({connectionString:url.toString()});await admin.query('CREATE DATABASE '+databaseName);await admin.end();url.pathname='/'+databaseName
  const pools=[],connections=new Set()
  const pool=role=>{const u=new URL(url);u.username=role;const p=new pg.Pool({connectionString:u.toString(),max:role==='aqc_fixture_owner'?1:8})
   p.on('connect',client=>{const stream=client.connection.stream;connections.add(stream);stream.once('close',()=>connections.delete(stream))})
   pools.push(p);return p}
  return {pool,async close(){
   await Promise.all(pools.map(p=>p.end()))
   // Pool.end schedules idle Client.end calls. Wait for actual socket closure
   // before stopping the owned server; otherwise shutdown can emit a late 57P01.
   await Promise.all([...connections].map(stream=>stream.closed?undefined:new Promise(resolve=>stream.once('close',resolve))))
   check(path.join(bin,'pg_ctl'),['-D',data,'-w','stop','-m','fast']);started=false;fs.rmSync(root,{recursive:true,force:true})
  }}
 }catch(error){if(started)check(path.join(bin,'pg_ctl'),['-D',data,'-w','stop','-m','fast']);fs.rmSync(root,{recursive:true,force:true});throw error}
}


const snapshotQuery=role=>"SELECT jsonb_agg(jsonb_build_object('oid',m.oid::bigint,'grantor',g.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.oid) AS snapshot FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor WHERE r.rolname='"+role+"' AND u.rolname='neondb_owner'"
const clock=Date.parse('2026-11-18T08:00:00.000Z')
const baseline=[{oid:10,grantor:'cloud_admin',admin:true,inherit:false,set:false},{oid:20,grantor:'neondb_owner',admin:false,inherit:false,set:false}]
const input=()=>({profile:'canonical',expectedMembership:baseline.map(x=>({...x})),decisionSha:'a'.repeat(40),
 expiresAt:new Date(clock+10*60000).toISOString(),fromSourceSha:'b'.repeat(40),toSourceSha:'c'.repeat(40)})
test('owner preparation is private, finite, and cannot execute a grant or accept an SQL callback',()=>{
 const plan=prepareQualityHostBindingTransaction(input(),clock)
 assert.equal(plan.requiresSeparateOwnerAuthorization,true);assert.equal(plan.requiresOneAtomicTransaction,true)
 assert.equal(plan.restoresExactMembershipBeforeCommit,true);assert.equal(plan.paidRepairsEnabled,false);assert.equal(plan.promotionEnabled,false)
 assert(Object.isFrozen(plan));assert(Object.isFrozen(plan.statements))
 assert(!JSON.stringify(plan).includes('GRANT'));assert(!JSON.stringify(plan).includes('fromSourceSha'))
 assert.equal(plan.statementsSha256,hash(JSON.stringify(plan.statements)))
 assert(plan.statements[4].startsWith('SET LOCAL aqc.owner_tx_nonce='))
 assert.equal(plan.statements.filter(s=>s.startsWith('SET LOCAL ROLE ')).length,2)
 assert.equal(plan.statements.filter(s=>s.startsWith('GRANT ')||s.startsWith('REVOKE ')).length,2)
 assert(plan.statements.at(-1).includes('OWNER_MEMBERSHIP_BASELINE_CHANGED'))
 assert.throws(()=>prepareQualityHostBindingTransaction({...input(),sql:'SELECT 1'},clock))
 assert.throws(()=>prepareQualityHostBindingTransaction({...input(),body:()=>{}},clock))
})
test('owner preparation rejects another database/profile, bad versions, expired plans and a weakened membership baseline',()=>{
 for(const change of [{profile:'production'},{profile:'evidence'},{fromSourceSha:'x'},{toSourceSha:input().fromSourceSha},
  {expiresAt:new Date(clock).toISOString()},{expiresAt:new Date(clock+15*60000+1).toISOString()},
  {expectedMembership:[{...baseline[0],set:true}]},{expectedMembership:[{...baseline[0],inherit:true}]},
  {expectedMembership:[{...baseline[0],admin:false}]},{expectedMembership:[{...baseline[0],grantor:'other'}]},
  {expectedMembership:[baseline[0],baseline[0]]},{decisionSha:'UNVERIFIED'}]){
  assert.throws(()=>prepareQualityHostBindingTransaction({...input(),...change},clock),{code:'OWNER_BOOTSTRAP_PREPARATION_INVALID'})
 }
 assert.throws(()=>prepareQualityHostBindingTransaction(input(),NaN),{code:'OWNER_BOOTSTRAP_PREPARATION_INVALID'})
 let read=0;const hostile={...input()};Object.defineProperty(hostile,'profile',{get(){read++;return 'canonical'},enumerable:true})
 assert.throws(()=>prepareQualityHostBindingTransaction(hostile,clock));assert.equal(read,0)
 const hostileArray=[];Object.defineProperty(hostileArray,'0',{get(){read++;return baseline[0]},enumerable:true});hostileArray.length=1
 assert.throws(()=>prepareQualityHostBindingTransaction({...input(),expectedMembership:hostileArray},clock));assert.equal(read,0)
 assert.throws(()=>prepareQualityHostBindingTransaction({...input(),expectedMembership:Array(1)},clock))
})

async function bindingFixture(profile,selfEdge){
 const f=await isolatedPostgres(profile==='canonical'?'platform_private':'neondb')
 const admin=f.pool('aqc_fixture_owner'),actor=f.pool('neondb_owner')
 const owner=profile==='canonical'?'profitia_access_owner':'profitia_ingestion_owner',schema=profile==='canonical'?'profitia_access':'profitia_ingestion'
 await admin.query('CREATE ROLE cloud_admin NOLOGIN NOINHERIT; CREATE ROLE neondb_owner LOGIN NOINHERIT NOCREATEROLE NOSUPERUSER NOBYPASSRLS;CREATE ROLE '+owner+' NOLOGIN NOINHERIT')
 await admin.query('GRANT '+owner+' TO cloud_admin WITH ADMIN TRUE,INHERIT FALSE,SET TRUE')
 await admin.query('SET ROLE cloud_admin')
 await admin.query('GRANT '+owner+' TO neondb_owner WITH ADMIN TRUE,INHERIT FALSE,SET FALSE GRANTED BY cloud_admin')
 await admin.query('RESET ROLE')
 if(selfEdge)await actor.query('GRANT '+owner+' TO neondb_owner WITH ADMIN FALSE,INHERIT FALSE,SET FALSE GRANTED BY neondb_owner')
 await admin.query('CREATE SCHEMA '+schema+' AUTHORIZATION '+owner)
 if(profile==='canonical')await admin.query('CREATE SCHEMA profitia_services AUTHORIZATION '+owner+';CREATE SCHEMA profitia_e1_authority AUTHORIZATION '+owner)
 await admin.query('SET ROLE '+owner)
 await admin.query('CREATE TABLE '+schema+'.installation(singleton boolean,environment text,project_id text,branch_id text)')
 await admin.query('INSERT INTO '+schema+".installation VALUES(true,'development',$1,$2)",profile==='canonical'?['spring-bread-28217539','br-sparkling-term-b99l107x']:['autumn-waterfall-65938876','br-dry-hall-b294222f'])
 const from='b'.repeat(40),service='srv-dapa3tid0e5s73f8bc5g'
 const columns="login_role name PRIMARY KEY,deployment_id text,status text,expires_at timestamptz,version bigint DEFAULT 5,source_ref text DEFAULT 'SYNTHETIC_OWNER_PROOF',other_metadata text DEFAULT 'UNCHANGED'"
 const table=profile==='canonical'?'profitia_services.runtime_bindings':'profitia_ingestion.runtime_bindings'
 await admin.query('CREATE TABLE '+table+'('+columns+')')
 const roles=profile==='canonical'?['sg2_benchmark_dispatch_development_runtime','sg2_insights_report_development_e1']:['sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter']
 for(let i=0;i<roles.length;i++)await admin.query('INSERT INTO '+table+"(login_role,deployment_id,status,expires_at)VALUES($1,$2,'ACTIVE',clock_timestamp()+interval '1 day')",[roles[i],i===0?service+':'+from:from])
 await admin.query('INSERT INTO '+table+"(login_role,deployment_id,status,expires_at)VALUES('foreign_binding','UNRELATED','REVOKED',clock_timestamp()-interval '1 day')")
 if(profile==='canonical'){
  await admin.query('CREATE TABLE profitia_e1_authority.source_components(component_id text PRIMARY KEY,deployment_id text,status text,expires_at timestamptz,version bigint DEFAULT 4,source_ref text DEFAULT \'SYNTHETIC_OWNER_PROOF\',public_key text DEFAULT \'UNCHANGED_PUBLIC_KEY\')')
  await admin.query("INSERT INTO profitia_e1_authority.source_components(component_id,deployment_id,status,expires_at)VALUES('sg2-insights-report-development',$1,'ACTIVE',clock_timestamp()+interval '1 day')",[from])
 }
 await admin.query('RESET ROLE')
 const expectedMembership=(await actor.query(snapshotQuery(owner))).rows[0].snapshot
 const config=()=>({profile,expectedMembership,decisionSha:'a'.repeat(40),expiresAt:new Date(Date.now()+10*60000).toISOString(),fromSourceSha:from,toSourceSha:'c'.repeat(40)})
 const state=async()=>({rows:(await admin.query('SELECT * FROM '+table+' ORDER BY login_role')).rows,
  source:profile==='canonical'?(await admin.query('SELECT * FROM profitia_e1_authority.source_components ORDER BY component_id')).rows:[],
  membership:(await actor.query(snapshotQuery(owner))).rows[0].snapshot})
 return {f,admin,actor,owner,table,roles,config,state}
}
async function execute(actor,plan,{transaction=true,failAfterBody=false}={}){
 const c=await actor.connect()
 try{
  if(transaction)await c.query('BEGIN')
  for(const statement of plan.statements){
   await c.query(statement)
   if(failAfterBody&&statement.startsWith('DO $aqc_bindings$'))await c.query('SELECT 1/0')
  }
  if(transaction)await c.query('COMMIT')
 }catch(e){if(transaction)await c.query('ROLLBACK');throw e}finally{c.release()}
}
for(const profile of ['canonical','product'])for(const selfEdge of [false,true]){
 test('native '+profile+' owner envelope restores '+(selfEdge?'the exact existing shadow edge':'the absent shadow edge')+' after commit, error and stale CAS',async()=>{
  const x=await bindingFixture(profile,selfEdge)
  try{
   const before=await x.state(),plan=prepareQualityHostBindingTransaction(x.config())
   await assert.rejects(execute(x.actor,plan,{failAfterBody:true}),e=>e.code==='22012')
   assert.deepEqual(await x.state(),before,'a failure rolls back data and every temporary membership option')
   await assert.rejects(execute(x.actor,prepareQualityHostBindingTransaction({...x.config(),fromSourceSha:'d'.repeat(40)})),e=>e.message==='HOST_BINDING_BASE_CHANGED')
   assert.deepEqual(await x.state(),before,'a stale deployment cannot change metadata or owner access')
   await assert.rejects(execute(x.actor,prepareQualityHostBindingTransaction(x.config()),{transaction:false}),e=>e.message==='OWNER_BOOTSTRAP_BINDING_REJECTED')
   assert.deepEqual(await x.state(),before,'autocommit stops before any GRANT')
   await execute(x.actor,plan)
   const after=await x.state()
   assert.deepEqual(after.membership,before.membership,'all grantor/OID/options are identical')
   assert.equal((await x.actor.query("SELECT pg_has_role(current_user,$1,'SET') AS allowed",[x.owner])).rows[0].allowed,false)
   assert.deepEqual(after.rows.find(r=>r.login_role==='foreign_binding'),before.rows.find(r=>r.login_role==='foreign_binding'))
   for(const r of after.rows.filter(r=>x.roles.includes(r.login_role))){
    const old=before.rows.find(o=>o.login_role===r.login_role)
    assert.deepEqual({...r,deployment_id:old.deployment_id},old)
    assert.equal(r.deployment_id,old.deployment_id.replaceAll('b'.repeat(40),'c'.repeat(40)))
   }
   if(profile==='canonical')assert.deepEqual(after.source.map(r=>({...r,deployment_id:before.source[0].deployment_id})),before.source)
   // LKG recovery cannot silently renew expired/revoked access.
   await x.admin.query("UPDATE "+x.table+" SET status='REVOKED',expires_at=clock_timestamp()-interval '1 hour' WHERE login_role=ANY($1::name[])",[x.roles])
   if(profile==='canonical')await x.admin.query("UPDATE profitia_e1_authority.source_components SET status='REVOKED',expires_at=clock_timestamp()-interval '1 hour'")
   const blocked=await x.state(),back={...x.config(),fromSourceSha:'c'.repeat(40),toSourceSha:'b'.repeat(40)}
   await assert.rejects(execute(x.actor,prepareQualityHostBindingTransaction(back)),e=>e.message==='HOST_BINDING_BASE_CHANGED')
   assert.deepEqual(await x.state(),blocked)
   const recovery=prepareQualityHostBindingRecoveryTransaction(back);assert.equal(recovery.operation,'RESTORE_HOST_BINDINGS')
   await assert.rejects(execute(x.actor,recovery,{failAfterBody:true}),e=>e.code==='22012')
   assert.deepEqual(await x.state(),blocked)
   await execute(x.actor,recovery)
   const restored=await x.state()
   assert.deepEqual(restored.membership,before.membership)
   for(const row of restored.rows){
    const current=blocked.rows.find(r=>r.login_role===row.login_role)
    assert.deepEqual({...row,deployment_id:current.deployment_id},current,'recovery preserves expired/revoked rights and every other field')
    assert.equal(row.deployment_id,before.rows.find(r=>r.login_role===row.login_role).deployment_id)
   }
   for(const row of restored.source){
    assert.deepEqual({...row,deployment_id:blocked.source[0].deployment_id},blocked.source[0])
    assert.equal(row.deployment_id,before.source[0].deployment_id)
   }
  }finally{await x.f.close()}
 })
}

const qaInput=(profile='canonical',now=Date.now())=>({profile,action:'ACTIVATE',expectedMembership:baseline.map(x=>({...x})),
 decisionSha:'a'.repeat(40),expiresAt:new Date(now+10*60000).toISOString(),schemaDigest:'d'.repeat(64),
 storageGeneration:'00000000-0000-4000-8000-000000000001',serviceId:'00000000-0000-4000-8000-000000000002',
 accountId:'00000000-0000-4000-8000-000000000003',organisationId:'00000000-0000-4000-8000-000000000004',
 grantId:'00000000-0000-4000-8000-000000000005',inputSha256:['e'.repeat(64),'f'.repeat(64)],
 validUntil:new Date(now+60*60000).toISOString(),authorisedUntil:new Date(now+2*60*60000).toISOString()})
test('controlled QA preparation accepts only two distinct hashes and a finite authorised window; revocation remains available after expiry',()=>{
 const p=prepareQualityControlledQaTransaction(qaInput('canonical',clock),clock)
 assert.equal(p.operation,'ACTIVATE_TWO_CONTROLLED_INPUTS')
 assert(!JSON.stringify(p).includes('accountId'));assert(!JSON.stringify(p).includes('GRANT'))
 for(const change of [{profile:'product'},{action:'ENABLE_PILOT'},{inputSha256:['e'.repeat(64)]},{inputSha256:['e'.repeat(64),'e'.repeat(64)]},
  {validUntil:new Date(clock).toISOString()},{validUntil:new Date(clock+169*3600000).toISOString(),authorisedUntil:new Date(clock+170*3600000).toISOString()},
  {validUntil:new Date(clock+3*3600000).toISOString()},{accountId:'ANOTHER_ACCOUNT'},{schemaDigest:'UNKNOWN'},
  {sql:'SELECT 1'},{modelKey:'NO_KEY_ALLOWED'}]){
  assert.throws(()=>prepareQualityControlledQaTransaction({...qaInput('canonical',clock),...change},clock))
 }
 const expired={...qaInput('canonical',clock),action:'REVOKE',validUntil:new Date(clock-1000).toISOString()}
 assert.equal(prepareQualityControlledQaTransaction(expired,clock).operation,'REVOKE_TWO_CONTROLLED_INPUTS')
 let read=0;const hostile=[];Object.defineProperty(hostile,'0',{get(){read++;return 'e'.repeat(64)},enumerable:true});hostile[1]='f'.repeat(64)
 assert.throws(()=>prepareQualityControlledQaTransaction({...qaInput('canonical',clock),inputSha256:hostile},clock));assert.equal(read,0)
})
async function controlledFixture(profile){
 const canonical=profile==='canonical',f=await isolatedPostgres(canonical?'platform_private':'neondb')
 const owner=canonical?'profitia_access_owner':'sg2_assistant_history_owner',schema=canonical?'profitia_assistant_quality_access':'sg2_assistant_quality_evidence'
 const admin=f.pool('aqc_fixture_owner'),actor=f.pool('neondb_owner'),config=qaInput(profile)
 await admin.query('CREATE ROLE cloud_admin NOLOGIN NOINHERIT;CREATE ROLE neondb_owner LOGIN NOINHERIT NOCREATEROLE NOSUPERUSER NOBYPASSRLS;CREATE ROLE '+owner+' NOLOGIN NOINHERIT')
 await admin.query('GRANT '+owner+' TO cloud_admin WITH ADMIN TRUE,INHERIT FALSE,SET TRUE;SET ROLE cloud_admin')
 await admin.query('GRANT '+owner+' TO neondb_owner WITH ADMIN TRUE,INHERIT FALSE,SET FALSE GRANTED BY cloud_admin')
 await admin.query('RESET ROLE;CREATE SCHEMA '+schema+' AUTHORIZATION '+owner)
 const witness=canonical?'profitia_access':'sg2_assistant_history'
 await admin.query('CREATE SCHEMA '+witness+' AUTHORIZATION '+owner+';SET ROLE '+owner)
 await admin.query('CREATE TABLE '+witness+'.installation(singleton boolean,environment text,project_id text,branch_id text)')
 await admin.query('INSERT INTO '+witness+".installation VALUES(true,'development',$1,$2)",canonical?['spring-bread-28217539','br-sparkling-term-b99l107x']:['autumn-waterfall-65938876','br-dry-hall-b294222f'])
 await admin.query('CREATE TABLE '+schema+'.installation(singleton boolean PRIMARY KEY,schema_digest text,storage_generation uuid,test_account_id uuid,enabled boolean,source_ref text)')
 await admin.query('INSERT INTO '+schema+".installation VALUES(true,$1,$2,$3,false,'SYNTHETIC_INSTALLATION_UNCHANGED')",[config.schemaDigest,config.storageGeneration,config.accountId])
 await admin.query('CREATE TABLE '+schema+'.credentials('+(canonical?'login_role':'role_name')+' name PRIMARY KEY,service_id uuid,command_key bytea)')
 for(const role of canonical?['sg2_private_development_runtime','sg2_assistant_quality_authority']:['sg2_assistant_quality_capture','sg2_assistant_quality_reader']){
  await admin.query('INSERT INTO '+schema+'.credentials VALUES($1,$2,decode(repeat(\'00\',32),\'hex\'))',[role,config.serviceId])
 }
 if(canonical){
  await admin.query('CREATE TABLE profitia_access.accounts(user_id uuid PRIMARY KEY,status text);CREATE TABLE profitia_access.organisations(organisation_id uuid PRIMARY KEY,status text);CREATE TABLE profitia_access.memberships(user_id uuid,organisation_id uuid,status text,expires_at timestamptz);CREATE TABLE profitia_access.product_grants(application_id text,organisation_id uuid,product text,status text,expires_at timestamptz,features text[])')
  await admin.query("INSERT INTO profitia_access.accounts VALUES($1,'ACTIVE');",[config.accountId])
  await admin.query("INSERT INTO profitia_access.organisations VALUES($1,'ACTIVE')",[config.organisationId])
  await admin.query("INSERT INTO profitia_access.memberships VALUES($1,$2,'ACTIVE',clock_timestamp()+interval '1 day')",[config.accountId,config.organisationId])
  await admin.query("INSERT INTO profitia_access.product_grants VALUES('spendguru',$1,'SPENDGURU','ACTIVE',clock_timestamp()+interval '1 day',ARRAY['assistant'])",[config.organisationId])
  await admin.query('CREATE TABLE '+schema+'.purpose_grants(grant_id uuid PRIMARY KEY,service_id uuid,account_id uuid,organisation_id uuid,enabled boolean,version bigint DEFAULT 1,created_at timestamptz DEFAULT clock_timestamp(),expires_at timestamptz,data_mode text,source_ref text,UNIQUE(service_id,account_id));CREATE TABLE '+schema+'.accepted_inputs(grant_id uuid REFERENCES '+schema+'.purpose_grants,input_sha256 text,enabled boolean,source_scopes jsonb,source_ref text,PRIMARY KEY(grant_id,input_sha256))')
 }else await admin.query('CREATE TABLE '+schema+'.evidence(evidence_id uuid PRIMARY KEY)')
 await admin.query('RESET ROLE')
 config.expectedMembership=(await actor.query(snapshotQuery(owner))).rows[0].snapshot
 const state=async()=>({installation:(await admin.query('SELECT * FROM '+schema+'.installation')).rows,
  grants:canonical?(await admin.query('SELECT * FROM '+schema+'.purpose_grants ORDER BY grant_id')).rows:[],
  inputs:canonical?(await admin.query('SELECT * FROM '+schema+'.accepted_inputs ORDER BY input_sha256')).rows:[],
  membership:(await actor.query(snapshotQuery(owner))).rows[0].snapshot})
 return{f,admin,actor,config,state,schema,canonical}
}
for(const profile of ['canonical','evidence']){
 test('native '+profile+' controlled activation and revocation restore owner access, reject stale bindings, and preserve installation metadata',async()=>{
  const x=await controlledFixture(profile)
  try{
   const before=await x.state(),plan=prepareQualityControlledQaTransaction(x.config)
   const failure={...x.config,storageGeneration:randomUUID()}
   await assert.rejects(execute(x.actor,prepareQualityControlledQaTransaction(failure)),e=>e.message==='QA_INSTALLATION_BASE_CHANGED')
   assert.deepEqual(await x.state(),before)
   await assert.rejects(execute(x.actor,plan,{transaction:false}),e=>e.message==='OWNER_BOOTSTRAP_BINDING_REJECTED')
   assert.deepEqual(await x.state(),before)
   // A failure after the data write must roll back the grant, both inputs and
   // the enabling bit together with temporary owner membership.
   const client=await x.actor.connect()
   try{await client.query('BEGIN');for(const statement of plan.statements){await client.query(statement);if(statement.startsWith('DO $aqc_controlled$'))await client.query('SELECT 1/0')}}
   catch(e){assert.equal(e.code,'22012');await client.query('ROLLBACK')}finally{client.release()}
   assert.deepEqual(await x.state(),before)
   await execute(x.actor,plan)
   const active=await x.state()
   assert.deepEqual(active.membership,before.membership)
   assert.deepEqual({...active.installation[0],enabled:false},before.installation[0])
   assert.equal(active.installation[0].enabled,true)
   if(x.canonical){
    assert.equal(active.grants.length,1);assert.equal(active.grants[0].account_id,x.config.accountId)
    assert.equal(active.grants[0].expires_at.toISOString(),x.config.validUntil);assert.equal(active.grants[0].enabled,true)
    assert.deepEqual(active.inputs.map(r=>r.input_sha256),[...x.config.inputSha256].sort())
    assert(active.inputs.every(r=>r.enabled&&r.source_scopes.length===0))
   }
   await assert.rejects(execute(x.actor,prepareQualityControlledQaTransaction(x.config)),e=>e.message==='QA_CONTROLLED_BASE_CHANGED')
   assert.deepEqual(await x.state(),active,'a replay never extends a window or creates another grant')
   await execute(x.actor,prepareQualityControlledQaTransaction({...x.config,action:'REVOKE'}))
   const revoked=await x.state()
   assert.deepEqual(revoked.membership,before.membership);assert.deepEqual(revoked.installation,before.installation)
   assert(revoked.grants.every(r=>!r.enabled));assert(revoked.inputs.every(r=>!r.enabled))
   if(x.canonical)assert.equal(revoked.grants[0].expires_at.toISOString(),x.config.validUntil)
   await execute(x.actor,prepareQualityControlledQaTransaction({...x.config,action:'REVOKE'}))
   assert.deepEqual(await x.state(),revoked,'repeated revocation is idempotent and cannot renew access')
  }finally{await x.f.close()}
 })
}

const publisherInput=(profile='canonical',now=clock)=>({profile,expectedMembership:baseline.map(x=>({...x})),
 decisionSha:'a'.repeat(40),expiresAt:new Date(now+10*60000).toISOString()})
test('publisher installation prepares only two fixed disabled profiles and keeps all DDL outside serialised metadata',async()=>{
 const {prepareQualityPublisherCasInstallation:prepare}=await import('../src/owner-bootstrap.mjs')
 for(const profile of ['canonical','product']){
  const plan=prepare(publisherInput(profile),clock)
  assert.equal(plan.operation,'INSTALL_DISABLED_PUBLISHER_CAS');assert.equal(plan.requiresSeparateOwnerAuthorization,true)
  assert.equal(plan.restoresExactMembershipBeforeCommit,true);assert.equal(plan.paidRepairsEnabled,false);assert.equal(plan.promotionEnabled,false)
  assert.equal(plan.statementsSha256,hash(JSON.stringify(plan.statements)))
  assert(plan.statements.some(s=>s.startsWith('CREATE ROLE aqc_development_')&&s.includes('NOLOGIN NOINHERIT')&&s.includes('CONNECTION LIMIT 2')))
  assert(plan.statements.some(s=>s.startsWith('CREATE SCHEMA profitia_quality_release AUTHORIZATION ')))
  const ddl=plan.statements.find(s=>s.includes('CREATE FUNCTION profitia_quality_release.quality_deployment_cas'))
  assert(ddl.includes("VALUES(true,false,true,'2026-11-27T23:59:59Z')"));assert(ddl.includes('SECURITY DEFINER SET search_path=pg_catalog'))
  assert(!JSON.stringify(plan).includes('CREATE'));assert(!JSON.stringify(plan).includes('GRANT'))
  assert(!ddl.includes('GRANT SELECT'));assert(!ddl.includes('GRANT USAGE ON SCHEMA profitia_access'))
  assert(!ddl.includes('GRANT USAGE ON SCHEMA profitia_ingestion'))
 }
})
test('publisher installation refuses foreign profiles arbitrary DDL or changed migration bytes',async()=>{
 const {prepareQualityPublisherCasInstallation:prepare}=await import('../src/owner-bootstrap.mjs')
 for(const change of [{profile:'evidence'},{profile:'production'},{sql:'SELECT 1'},{publisherRole:'foreign'},
  {expiresAt:new Date(clock+16*60000).toISOString()},{expectedMembership:[{...baseline[0],set:true}]}])
  assert.throws(()=>prepare({...publisherInput(),...change},clock),{code:'OWNER_BOOTSTRAP_PREPARATION_INVALID'})
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-publisher-source-'))
 try{
  fs.mkdirSync(path.join(temporary,'src'));fs.mkdirSync(path.join(temporary,'migrations'))
  fs.copyFileSync(new URL('../src/owner-bootstrap.mjs',import.meta.url),path.join(temporary,'src/owner-bootstrap.mjs'))
  for(const name of ['004-publisher-canonical.sql','005-publisher-product.sql']){
   const bytes=fs.readFileSync(new URL('../migrations/'+name,import.meta.url))
   fs.writeFileSync(path.join(temporary,'migrations',name),Buffer.concat([bytes,Buffer.from('UNREVIEWED')]))
  }
  const {pathToFileURL}=await import('node:url'),foreign=await import(pathToFileURL(path.join(temporary,'src/owner-bootstrap.mjs')).href)
  assert.throws(()=>foreign.prepareQualityPublisherCasInstallation(publisherInput(),clock),{code:'OWNER_BOOTSTRAP_PREPARATION_INVALID'})
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
for(const profile of ['canonical','product']){
 test('native bounded publisher '+profile+' has no private reads or owner membership and restores only its own CAS without renewing rights',async()=>{
  const {prepareQualityPublisherCasInstallation:prepare}=await import('../src/owner-bootstrap.mjs')
  const x=await bindingFixture(profile,false),schema='profitia_quality_release'
  const role=profile==='canonical'?'aqc_development_canonical_publisher':'aqc_development_product_publisher'
  const config={profile,expectedMembership:x.config().expectedMembership,decisionSha:'a'.repeat(40),expiresAt:new Date(Date.now()+10*60000).toISOString()}
  try{
   await x.admin.query('ALTER ROLE neondb_owner CREATEROLE')
   await x.admin.query('GRANT CREATE ON DATABASE '+(profile==='canonical'?'platform_private':'neondb')+' TO neondb_owner')
   const before=await x.state(),plan=prepare(config)
   await assert.rejects(execute(x.actor,plan,{transaction:false}),e=>e.message==='OWNER_BOOTSTRAP_BINDING_REJECTED')
   assert.equal((await x.admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0)
   // Failure after the complete DDL rolls back the new role, schema and every membership edge.
   const client=await x.actor.connect()
   try{
    await client.query('BEGIN')
    for(const statement of plan.statements){await client.query(statement);if(statement.includes('CREATE FUNCTION profitia_quality_release.quality_deployment_cas'))await client.query('SELECT 1/0')}
    assert.fail('expected synthetic transaction failure')
   }catch(e){assert.equal(e.code,'22012',e.message);await client.query('ROLLBACK')}finally{client.release()}
   assert.equal((await x.admin.query('SELECT to_regnamespace($1) AS name',[schema])).rows[0].name,null)
   assert.equal((await x.admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0)
   assert.deepEqual(await x.state(),before)
   await execute(x.actor,plan)
   const installed=(await x.admin.query('SELECT rolcanlogin,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication,rolconnlimit FROM pg_roles WHERE rolname=$1',[role])).rows[0]
   assert.deepEqual(installed,{rolcanlogin:false,rolsuper:false,rolinherit:false,rolcreaterole:false,rolcreatedb:false,rolbypassrls:false,rolreplication:false,rolconnlimit:2})
   assert.deepEqual(await x.state(),before)
   assert.equal((await x.admin.query('SELECT count(*)::integer AS n FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1',[role])).rows[0].n,0)
   assert.equal((await x.admin.query('SELECT enabled FROM '+schema+'.quality_deployment_cas_policy')).rows[0].enabled,false)
   // Fixture-only activation. The cloud role and policy are never touched by this test.
   await x.admin.query('ALTER ROLE '+role+' LOGIN')
   const publisher=x.f.pool(role)
   const call=(operation,from,to,restore=null,until=new Date(Date.now()+5*60000).toISOString())=>
    publisher.query('SELECT '+schema+'.quality_deployment_cas($1::uuid,$2::text,$3::text,$4::uuid,$5::timestamptz) AS result',[operation,from,to,restore,until])
   const from='b'.repeat(40),to='c'.repeat(40),operation=randomUUID()
   await assert.rejects(publisher.query('SELECT * FROM '+x.table),e=>e.code==='42501')
   await assert.rejects(publisher.query('SELECT * FROM '+schema+'.quality_deployment_cas_policy'),e=>e.code==='42501')
   await assert.rejects(publisher.query('SET ROLE '+x.owner),e=>e.code==='42501')
   await assert.rejects(call(operation,from,to),e=>e.message==='AQC_CAS_DISABLED')
   await x.admin.query('UPDATE '+schema+'.quality_deployment_cas_policy SET enabled=true')
   for(const args of [[randomUUID(),'x',to],[randomUUID(),from,from],[randomUUID(),from,to,null,new Date(Date.now()+16*60000).toISOString()]]){
    await assert.rejects(call(...args),e=>e.message==='AQC_CAS_REQUEST_REJECTED')
   }
   await assert.rejects(call(randomUUID(),'d'.repeat(40),to),e=>e.message==='AQC_CAS_BASE_CHANGED')
   const applied=(await call(operation,from,to)).rows[0].result
   assert.equal(applied.status,'APPLIED');assert.equal(applied.updatedBindings,3);assert.equal(applied.rawQaReadPerformed,false)
   const advanced=await x.state()
   assert.deepEqual(advanced.membership,before.membership)
   for(const row of advanced.rows){
    const previous=before.rows.find(r=>r.login_role===row.login_role)
    assert.deepEqual({...row,deployment_id:previous.deployment_id},previous)
    assert.equal(row.deployment_id,x.roles.includes(row.login_role)?previous.deployment_id.replaceAll(from,to):previous.deployment_id)
   }
   if(profile==='canonical')assert.deepEqual(advanced.source.map(r=>({...r,deployment_id:before.source[0].deployment_id})),before.source)
   assert.equal((await call(operation,from,to)).rows[0].result.status,'REPLAY')
   await assert.rejects(call(operation,from,'d'.repeat(40)),e=>e.message==='AQC_CAS_IDEMPOTENCY_CONFLICT')
   await assert.rejects(call(randomUUID(),to,from,randomUUID()),e=>e.message==='AQC_CAS_RECOVERY_REJECTED')
   // A concurrent foreign version is preserved, even for a real previous operation.
   await x.admin.query('UPDATE '+x.table+' SET deployment_id=$1 WHERE login_role=$2',['FOREIGN_VERSION',x.roles[0]])
   const foreign=await x.state()
   await assert.rejects(call(randomUUID(),to,from,operation),e=>e.message==='AQC_CAS_RECOVERY_REJECTED')
   assert.deepEqual(await x.state(),foreign)
   await x.admin.query('UPDATE '+x.table+' SET deployment_id=$1 WHERE login_role=$2',['srv-dapa3tid0e5s73f8bc5g:'+to,x.roles[0]])
   await x.admin.query("UPDATE "+x.table+" SET status='REVOKED',expires_at=clock_timestamp()-interval '1 hour' WHERE login_role=ANY($1::name[])",[x.roles])
   if(profile==='canonical')await x.admin.query("UPDATE profitia_e1_authority.source_components SET status='REVOKED',expires_at=clock_timestamp()-interval '1 hour'")
   await x.admin.query('UPDATE '+schema+'.quality_deployment_cas_policy SET enabled=false')
   const revoked=await x.state(),recovery=randomUUID()
   const restored=(await call(recovery,to,from,operation)).rows[0].result;assert.equal(restored.status,'RESTORED')
   const after=await x.state()
   assert.deepEqual(after.membership,before.membership)
   for(const row of after.rows){
    const previous=revoked.rows.find(r=>r.login_role===row.login_role)
    assert.deepEqual({...row,deployment_id:previous.deployment_id},previous)
    assert.equal(row.deployment_id,before.rows.find(r=>r.login_role===row.login_role).deployment_id)
   }
   for(const row of after.source){assert.deepEqual({...row,deployment_id:revoked.source[0].deployment_id},revoked.source[0]);assert.equal(row.deployment_id,from)}
   assert.equal((await call(recovery,to,from,operation)).rows[0].result.status,'REPLAY')
   await x.admin.query("UPDATE "+schema+".quality_deployment_cas_policy SET authorised_until=clock_timestamp()-interval '1 minute'")
   await assert.rejects(call(randomUUID(),from,to),e=>e.message==='AQC_CAS_DISABLED')
   assert.deepEqual(await x.state(),after)
  }finally{await x.f.close()}
 })
}
