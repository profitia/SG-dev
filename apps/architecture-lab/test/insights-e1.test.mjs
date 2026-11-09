import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs';
import {createOperationExecutor,OPERATION_CONTRACT} from '../../../packages/platform-contracts/src/operation-context.mjs';
import {createCurrentE1ReportServiceHost} from '../../../packages/platform-contracts/current-e1-authority/insights-service.mjs';
import {verifyInstallPacket} from '../scripts/install-insights-report.mjs';
import {fileURLToPath} from 'node:url';
const hash=x=>createHash('sha256').update(x).digest('hex');
const sql=name=>readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+name,import.meta.url),'utf8');
const e1sql=name=>readFileSync(new URL('../../../packages/platform-contracts/current-e1-authority/migrations/'+name,import.meta.url),'utf8');
const org='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const app='insights-test',role='insights_e1_test_runtime';
const ownerUrl=process.env.INSIGHTS_E1_TEST_OWNER_URL??process.env.OPERATION_FIXTURE_OWNER_URL;
const enabled=!!ownerUrl;
test('maintenance verifier pins the approved packet, actual Development branch and each schema before any connection',async()=>{
 const path='packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql';
 const packet={contract:'profitia.insights-development-install/1.0',environment:'development',
  ownerDecisionRef:'CONTROLLED_TEST_NOT_AUTHORITY',sourceSha:'1'.repeat(40),
  databases:[{id:'E1',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',backupRef:'CONTROLLED_TEST',recoveryVerified:true}],
  steps:[{database:'E1',owner:'profitia_access_owner',kind:'SCHEMA',path,sha256:hash(e1sql('007-insights-authority.sql'))}]};
 const root=fileURLToPath(new URL('../../../',import.meta.url)),bytes=JSON.stringify(packet);
 assert.equal((await verifyInstallPacket(bytes,hash(bytes),root)).steps.length,1);
 await assert.rejects(verifyInstallPacket(bytes,'0'.repeat(64),root),{code:'EXACT_APPROVED_PACKET_REQUIRED'});
 const wrongBranch=JSON.stringify({...packet,databases:[{...packet.databases[0],branchId:'another-branch'}]});
 await assert.rejects(verifyInstallPacket(wrongBranch,hash(wrongBranch),root),{code:'EXACT_RECOVERABLE_DEVELOPMENT_REQUIRED'});
 const wrongSchema=JSON.stringify({...packet,steps:[{...packet.steps[0],sha256:'0'.repeat(64)}]});
 await assert.rejects(verifyInstallPacket(wrongSchema,hash(wrongSchema),root),{code:'SCHEMA_SHA_MISMATCH'});
});
async function database(name,ownerRole,run){
 const url=new URL(ownerUrl);
 if(url.searchParams.has('host')){assert.equal(url.hostname,'localhost');assert.equal(url.searchParams.get('host'),'/private/tmp/sg2-oil-runner-pg-20261109');assert.equal(url.port,'55982');assert.equal(url.username,'architecture_test_owner');}
 else assertIsolatedTestConnection(ownerUrl,'sg2_operation_test','architecture_test_owner');
 const root=new pg.Client({connectionString:url.toString()});await root.connect();let db;
 try{
  await root.query('CREATE DATABASE '+name);
  for(const [r,login] of [[ownerRole,false],[role,true],['identity_b1_runtime',true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[r])).rowCount)
    await root.query(`CREATE ROLE ${r} ${login?'LOGIN':'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  }
  url.pathname='/'+name;db=new pg.Client({connectionString:url.toString()});await db.connect();
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await db.query('GRANT CREATE ON DATABASE '+name+' TO '+ownerRole);
  const controlled=async fn=>{await db.query('BEGIN;SET LOCAL ROLE '+ownerRole);try{const v=await fn(db);await db.query('COMMIT');return v}catch(e){await db.query('ROLLBACK');throw e}};
  const make=()=>{const u=new URL(url);u.username=role;u.password='';return new pg.Pool({connectionString:u.toString(),max:4})};
  await run({db,controlled,make,name});
 }finally{await db?.end();await root.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await root.end()}
}
test('current native report SERVICE uses the shared engine, own organisation and revocable bounded budget', {skip:!enabled},async()=>{
 await database('insights_e1_'+randomUUID().replaceAll('-',''),'profitia_access_owner',async({db,controlled,make,name})=>{
  const files=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','004-initial-directory.sql','005-service-read.sql'];
  const binding={applicationId:app,environment:'development',projectId:'isolated-e1-project',branchId:'isolated-e1-branch',databaseName:name,role,schemaDigest:hash(sql(files[0])),
   service:{schemaDigest:hash(sql(files[4])),profileId:'SPENDGURU_SAAS',deploymentId:'test-release',configurationVersion:'test-v1'}};
  await controlled(async d=>{
   await d.query(sql(files[0]));
   await d.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,$4)",[binding.schemaDigest,binding.projectId,binding.branchId,name]);
   await d.query(sql(files[1]));await d.query("INSERT INTO profitia_modules.installation VALUES(true,'1.0.0',$1)",[hash(sql(files[1]))]);
   await d.query(sql(files[2]));await d.query("INSERT INTO profitia_modules.audit_installation VALUES(true,'1.0.0',$1,'TEST_ONLY')",[hash(sql(files[2]))]);
   await d.query(sql(files[3]));await d.query("INSERT INTO profitia_access.directory_installation VALUES(true,'1.0.0',$1)",[hash(sql(files[3]))]);
   await d.query(sql(files[4]));
   await d.query("INSERT INTO profitia_services.installation VALUES(true,'1.0.0',$1,'TEST_ONLY')",[binding.service.schemaDigest]);
   await d.query(e1sql('009-insights-service.sql'));
   await d.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[org,other]);
   await d.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE'),('spendguru','ACTIVE')",[app]);
   await d.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[role,app]);
   await d.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','test-release','test-v1','ACTIVE','TEST_ONLY',now()+interval '1 hour')",[role,randomUUID(),randomUUID()]);
   for(const application of [app,'spendguru'])await d.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SPENDGURU',ARRAY['market'],'ACTIVE','EXPLICIT_OFFER','TEST_ONLY',now()+interval '1 hour')",[application,org]);
   for(const operation of ['start','status','list','download'])await d.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'market','ALLOW','ACTIVE','TEST_ONLY',now()+interval '1 hour')",[randomUUID(),role,org,'insights.report.'+operation]);
   await d.query("INSERT INTO profitia_services.report_profiles VALUES($1,$2,'test-profile',500000,500000,1,'ACTIVE','TEST_ONLY',now()+interval '1 hour')",[role,org]);
   await d.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_services TO ${role};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_services.append_audit(jsonb),profitia_services.report_append_audit(jsonb),profitia_services.report_state(uuid,text,text),profitia_services.claim_report_profile(uuid,text,text),profitia_services.report_organisations() TO ${role}`);
  });
  const pool=make();try{
   const application={appId:app,profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'test-release',configurationVersion:'test-v1',organisationId:null,identityIssuer:'urn:profitia:database-service-runtime:v1',features:['market'],operations:['insights.report.start','insights.report.status','insights.report.list','insights.report.download']};
   const host=createCurrentE1ReportServiceHost({application,binding,query:pool.query.bind(pool),recordAudit:async(event,q=pool.query.bind(pool))=>q('SELECT profitia_services.append_audit($1::jsonb)',[JSON.stringify(event)]),
    transact:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const v=await fn({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return v}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}});
   for(const op of application.operations){const id=['insights.report.start','insights.report.list'].includes(op)?'oil-asphalt':randomUUID();
    assert.equal(await host.execute({operation:op,organisationId:org,resourceId:id,payload:null},ctx=>{assert.equal(ctx.actorKind,'SERVICE');assert.equal(ctx.subjectUserId,null);return 'OK'}),'OK');}
   await assert.rejects(host.execute({operation:'insights.report.start',organisationId:other,resourceId:'oil-asphalt',payload:null},()=>assert.fail('cross tenant callback')));
   await assert.rejects(host.execute({operation:'insights.report.status',organisationId:org,resourceId:'oil-asphalt',payload:null},()=>assert.fail('wrong resource callback')));
   const job={organisationId:org,profile:{id:'test-profile'},businessKey:'a'.repeat(64)};
   assert.equal((await host.claimProfile(job)).budgetMicroUsd,500000);
   assert.equal((await host.claimProfile(job)).budgetMicroUsd,500000);
   assert.equal(await host.claimProfile({...job,businessKey:'b'.repeat(64)}),null);
   await assert.rejects(pool.query('SELECT * FROM profitia_services.report_profiles'),{code:'42501'});
   await controlled(d=>d.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE operation='insights.report.start'"));
   await assert.rejects(host.execute({operation:'insights.report.start',organisationId:org,resourceId:'oil-asphalt',payload:null},()=>assert.fail('revoked callback')));
  }finally{await pool.end()}
 });
});
test('Source report templates create one policy per business edition and preserve unknown-cost holds on revocation',{skip:!enabled},async()=>{
 await database('insights_source_'+randomUUID().replaceAll('-',''),'profitia_ingestion_owner',async({db,controlled,make,name})=>{
  const source='insights.test.openai';
  await controlled(async d=>{
   await d.query(sql('008-platform-ingestion.sql'));
   await d.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-source-project','isolated-source-branch',$2)",[hash(sql('008-platform-ingestion.sql')),name]);
   await d.query(sql('009-external-call-admission.sql'));
   await d.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','isolated-source-project','isolated-source-branch',$3)",[hash(sql('009-external-call-admission.sql')),hash(sql('008-platform-ingestion.sql')),name]);
   await d.query(sql('012-native-external-transport.sql'));
   await d.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'TEST_ONLY')",[hash(sql('012-native-external-transport.sql'))]);
   await d.query(sql('030-model-execution.sql'));
   await d.query("INSERT INTO profitia_model_execution.installation VALUES(true,'1.0.0',$1,'TEST_ONLY')",[hash(sql('030-model-execution.sql')+sql('031-model-execution-long-report.sql'))]);
   await d.query(sql('031-model-execution-long-report.sql'));await d.query(sql('032-report-model-templates.sql'));
   await d.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'source-test','PLATFORM_INTERNAL','test-release','root-v1','ACTIVE','TEST_ONLY',now()+interval '1 hour')",[role,randomUUID(),randomUUID()]);
   await d.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','quality-v1','control-v1','source-receipt-v1','ACTIVE','TEST_ONLY',now()+interval '1 hour')",[source]);
   await d.query("INSERT INTO profitia_report_model.templates VALUES($1,$2,'COMPOSER','test-profile',400000,400000,1,15000,16000,'root-v1','TEST_ONLY','TEST_PROJECT','TEST_UNKNOWN_LIABILITY','TEST_CANDIDATE','TEST_RELEASE',now()+interval '1 hour','ACTIVE')",[role,source]);
   await d.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_report_model TO ${role};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_report_model.prepare_attempt(text,text) TO ${role}`);
  });
  const pool=make();try{
   const prepare=async(k,h)=>(await pool.query('SELECT profitia_report_model.prepare_attempt($1,$2) AS attempt',[k,h])).rows[0].attempt;
   const first=await prepare('a'.repeat(64),'b'.repeat(64));assert(first);assert.equal(first.reservationMicroUsd,400000);
   assert.deepEqual(await prepare('a'.repeat(64),'b'.repeat(64)),first);
   assert.equal(await prepare('a'.repeat(64),'c'.repeat(64)),null);
   assert.equal(await prepare('d'.repeat(64),'b'.repeat(64)),null);
   await assert.rejects(pool.query('SELECT * FROM profitia_report_model.templates'),{code:'42501'});
   await controlled(async d=>{assert.equal((await d.query('SELECT capacity,timeout_ms FROM profitia_external_call.policies')).rows[0].capacity,1);await d.query("UPDATE profitia_report_model.templates SET status='REVOKED'");});
   assert.equal(await prepare('a'.repeat(64),'b'.repeat(64)),null);
   await controlled(async d=>{assert.equal((await d.query('SELECT status FROM profitia_external_call.policies')).rows[0].status,'REVOKED');assert.equal((await d.query('SELECT count(*)::int AS n FROM profitia_report_model.reservations')).rows[0].n,1);});
  }finally{await pool.end()}
 });
});

test('report authority and receiver migrations install over their accepted predecessors without calendar activation',{skip:!enabled},async()=>{
 await database('insights_receiver_'+randomUUID().replaceAll('-',''),'profitia_access_owner',async({controlled,make,name})=>{
  const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',identity=randomUUID(),issuer='https://test.clerk.accounts.dev';
  const binding={applicationId:app,environment:'development',projectId:'isolated-project',branchId:'isolated-branch',databaseName:name,role,schemaDigest:hash(sql('001-internal-access.sql'))};
  const key=Buffer.alloc(32,7);
  await controlled(async d=>{
   await d.query(sql('001-internal-access.sql'));
   // No product/person/permission is created: this validates additive DDL and
   // closed operation/resource parsing only, not a fabricated live admission.
   await d.query(e1sql('001-authority.sql'));
   await d.query(e1sql('007-insights-authority.sql'));
   await d.query(e1sql('002-receiver.sql'));
   await d.query(e1sql('008-insights-receiver.sql'));
   for(const side of ['profitia_e1_authority','profitia_e1_receiver']){
    for(const op of ['start','status','list','download']){
     const resource=['start','list'].includes(op)?'oil-asphalt':randomUUID();
     assert.equal((await d.query(`SELECT ${side}.resource_allows($1,$2,$3) AS allowed`,['insights-reports','insights.report.'+op,resource])).rows[0].allowed,true);
    }
    assert.equal((await d.query(`SELECT ${side}.resource_allows('insights-reports','knowledge.read','economic-calendar-events') AS allowed`)).rows[0].allowed,false);
   }
   assert.equal((await d.query('SELECT profitia_e1_receiver.report_scope($1::uuid,$2::uuid,false) AS allowed',[org,randomUUID()])).rows[0].allowed,false);
   await d.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-project','isolated-branch',$2)",[binding.schemaDigest,name]);
   for(const application of [app,'spendguru','identity-runtime-development'])await d.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[application]);
   await d.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE'),('identity_b1_runtime','identity-runtime-development','ACTIVE')",[role,app]);
   await d.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user]);
   await d.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'test-human',$3,'ACTIVE','TEST_ONLY',now()+interval '1 hour')",[identity,issuer,user]);
   await d.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[org,other]);
   await d.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','TEST_ONLY',now()+interval '1 hour')",[org,user]);
   for(const application of [app,'spendguru'])await d.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SPENDGURU',ARRAY['market'],'ACTIVE','EXPLICIT_OFFER','TEST_ONLY',now()+interval '1 hour')",[application,org]);
   for(const op of ['start','status','list','download'])await d.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW',$5,'market')",[randomUUID(),app,org,user,'insights.report.'+op]);
   await d.query("INSERT INTO profitia_e1_authority.receivers VALUES($1,$2,$3,ARRAY['https://test.app'],'insights-reports','test-key',$4,'ACTIVE','TEST_ONLY',now()+interval '1 hour')",[app,binding,issuer,key]);
   await d.query("INSERT INTO profitia_e1_receiver.installation VALUES(true,$1,$2,'https://identity.test','insights-reports','test-key',$3,'ACTIVE','TEST_ONLY',now()+interval '1 hour')",[role,binding,key]);
   await d.query(`GRANT USAGE ON SCHEMA profitia_e1_receiver TO ${role};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO ${role}`);

  });
  const pool=make(),u=new URL(ownerUrl);u.pathname='/'+name;u.username='identity_b1_runtime';u.password='';
  const authority=new pg.Pool({connectionString:u.toString(),max:1});
  const actor={kind:'HUMAN',actorId:user,userId:user,audience:app,environment:'development',issuer,
   proofRef:'clerk-session:synthetic:binding:'+identity+':1:1',expiresAt:new Date(Date.now()+3600000).toISOString()};
  const issue=async(request,previous=null)=>(await authority.query('SELECT profitia_e1_authority.issue($1,$2,$3,$4,$5) AS proof',[app,{issuer,subject:'test-human'},actor,request,previous])).rows[0].proof;
  try{
   for(const op of ['start','status','list','download']){
    const client=await pool.connect();try{
     await client.query('BEGIN');const id=randomUUID(),resource=['start','list'].includes(op)?'oil-asphalt':id;
     const challenge=(await client.query('SELECT profitia_e1_receiver.challenge($1,$2,$3,$4,$5) AS challenge',['a'.repeat(64),org,'insights.report.'+op,resource,'b'.repeat(64)])).rows[0].challenge;
     const proof=await issue(challenge);assert(proof,'current HUMAN central proof '+op);
     await client.query('SELECT profitia_e1_receiver.accept($1)',[proof]);
     assert.equal((await client.query('SELECT profitia_e1_receiver.report_scope($1,$2,false) AS allowed',[org,id])).rows[0].allowed,true);
     assert.equal((await client.query('SELECT profitia_e1_receiver.report_scope($1,$2,false) AS allowed',[other,id])).rows[0].allowed,false);
     assert.equal((await client.query('SELECT profitia_e1_receiver.report_scope($1,$2,true) AS allowed',[org,id])).rows[0].allowed,op==='start');
     assert(await issue(challenge,proof));
     if(op==='start'){
      await controlled(d=>d.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1",[user]));
      assert.equal(await issue(challenge,proof),null,'revocation before outcome');
      await controlled(d=>d.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE user_id=$1",[user]));
     }
     await client.query('ROLLBACK');
    }finally{client.release()}
   }
   await assert.rejects(pool.query('SELECT proof_key FROM profitia_e1_receiver.installation'),{code:'42501'});
  }finally{await pool.end();await authority.end()}
 });
});
