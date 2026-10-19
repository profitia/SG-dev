// Creates a fresh uniquely named database; never adopts/resets the root database.
// Local execution uses a new disposable PostgreSQL cluster, not shared fixtures.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import pg from 'pg'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPrivateOperationHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {OPERATION_CONTRACT,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {createAccessStore} from '../../../packages/platform-contracts/src/access-store.mjs'
const DATABASE='private_phase_'+randomUUID().replaceAll('-',''),ROLE='platform_private_phase_runtime',APP='private-phase-fixture'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER='https://identity.fixture.test',hash=v=>createHash('sha256').update(v).digest('hex')
const sources=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','006-request-reservation.sql','010-external-request-admission.sql'].map(name=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+name,import.meta.url),'utf8'))
const phaseSql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/011-request-continuation.sql',import.meta.url),'utf8'),phaseDigest=hash(phaseSql)
const digests=sources.map(hash),expires=()=>new Date(Date.now()+3600000).toISOString()

test('private SQL phases continue accepted AM23 with current authority and same-transaction audit',async t=>{
 const url=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new pg.Client({connectionString:url});await root.connect()
 let owner,pool,auditPool,otherPool;const previousFetch=globalThis.fetch
 globalThis.fetch=async()=>{throw Error('No external work is permitted by request acceptance')}
 try{
  assert.match(DATABASE,/^private_phase_[a-f0-9]{32}$/)
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0,'Never adopt an existing database')
  await root.query(`CREATE DATABASE ${DATABASE}`)
  // Use the existing shared fixture role-bootstrap lock; test files run concurrently.
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  for(const[role,login]of[['profitia_access_owner',false],[ROLE,true],[ROLE+'_other',true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
   const row=(await root.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[role])).rows[0]
   assert.deepEqual(row,{rolcanlogin:login,rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false})
  }
  await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
  await root.query('COMMIT')
  const db=new URL(url);db.pathname='/'+DATABASE;assert.notEqual(db.pathname,new URL(url).pathname)
  owner=new pg.Client({connectionString:db.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner;REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC;GRANT CONNECT ON DATABASE ${DATABASE} TO ${ROLE},${ROLE}_other;REVOKE CREATE ON SCHEMA public FROM PUBLIC`)
  const runtime=new URL(db);runtime.username=ROLE;runtime.password='isolated_ci_only'
  pool=new pg.Pool({connectionString:runtime.toString(),max:2});auditPool=new pg.Pool({connectionString:runtime.toString(),max:1})
  assert.deepEqual((await pool.query('SELECT current_user::text AS role,session_user::text AS login')).rows[0],{role:ROLE,login:ROLE})
  assert.deepEqual((await pool.query("SELECT has_database_privilege(current_user,current_database(),'CREATE') AS create_allowed,has_database_privilege(current_user,current_database(),'TEMP') AS temp_allowed")).rows[0],{create_allowed:false,temp_allowed:false})
  const otherUrl=new URL(runtime);otherUrl.username=ROLE+'_other';otherPool=new pg.Pool({connectionString:otherUrl.toString(),max:1})
  const queryFor=c=>async(sql,values=[])=>{const r=await c.query(sql,values);return{rows:r.rows}}
  const reset=async({capacity=2,expired=false}={})=>{
   assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE,'Reset only this run\'s new database')
   await owner.query('DROP SCHEMA IF EXISTS profitia_delegated_phases CASCADE;DROP SCHEMA IF EXISTS profitia_supplier_jobs CASCADE;DROP SCHEMA IF EXISTS profitia_jobs CASCADE;DROP SCHEMA IF EXISTS profitia_services CASCADE;DROP SCHEMA IF EXISTS profitia_request_phases CASCADE;DROP SCHEMA IF EXISTS request_fixture CASCADE;DROP SCHEMA IF EXISTS profitia_requests CASCADE;DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE')
   await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
   try{
    await owner.query(sources[0]);await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-request-project','isolated-request-branch',$2)",[digests[0],DATABASE])
    await owner.query(sources[1]);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[digests[1]])
    await owner.query(sources[2]);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[digests[2]])
    await owner.query(sources[3]);await owner.query("INSERT INTO profitia_requests.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_RELEASE')",[digests[3]])
    await owner.query(sources[4]);await owner.query("INSERT INTO profitia_requests.external_installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_EXTENSION_NOT_RELEASE')",[digests[4]])
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[APP]);await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[ROLE,APP])
    for(const user of[U,V]){
     await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
     await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,expires()])
    }
    for(const org of[A,B]){
     await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
     await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$3)",[APP,org,expires()])
     for(const user of org===A?[U,V]:[U]){
      await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,expires()])
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW','supplier.report.refresh','supplier_report')",[randomUUID(),APP,org,user])
     }
     await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,$2,$3,'supplier.report.refresh','ACTIVE','EXPLICIT_SYNTHETIC_REQUEST_COUNT_NOT_BILLING',now()-interval '1 hour',now()+interval '2 hours',$4,$5)",[randomUUID(),APP,org,expired?new Date(Date.now()-1000).toISOString():expires(),capacity])
    }
    await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES($1,'supplier_report',$2,'ACTIVE','SYNTHETIC_MODULE',$3)",[APP,randomUUID(),expires()])
    await owner.query(`CREATE SCHEMA request_fixture;CREATE TABLE request_fixture.commands(request_id uuid PRIMARY KEY REFERENCES profitia_requests.intents(request_id),organisation_id uuid NOT NULL,user_id uuid NOT NULL,payload_digest text NOT NULL);ALTER TABLE request_fixture.commands ENABLE ROW LEVEL SECURITY;ALTER TABLE request_fixture.commands FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON request_fixture.commands TO profitia_access_owner USING(true) WITH CHECK(true)`)
    const fence=`profitia_access.scope_allows('${APP}',organisation_id,user_id) AND profitia_modules.scope_allows('supplier_report',organisation_id,user_id)`
    await owner.query(`CREATE POLICY runtime_scope ON request_fixture.commands TO ${ROLE} USING(${fence}) WITH CHECK(${fence});CREATE POLICY runtime_fence ON request_fixture.commands AS RESTRICTIVE TO ${ROLE} USING(${fence}) WITH CHECK(${fence})`)
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('other-phase-fixture','ACTIVE');")
    await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'other-phase-fixture','ACTIVE')",[ROLE+'_other'])
    await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('other-phase-fixture','supplier_report',$1,'ACTIVE','SYNTHETIC_OTHER_APP',$2)",[randomUUID(),expires()])
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('other-phase-fixture',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[A,expires()])
    await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'other-phase-fixture',$2,$3,'ALLOW','supplier.report.refresh','supplier_report')",[randomUUID(),A,U])
    await owner.query(phaseSql)
    await owner.query("INSERT INTO profitia_request_phases.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[phaseDigest])
    // The complete existing HUMAN regression suite runs after optional SQL014.
    for(const[file,table]of[['005-service-read.sql','profitia_services.installation'],['007-delegated-jobs.sql','profitia_jobs.installation'],['013-supplier-delegation.sql','profitia_supplier_jobs.installation'],['014-delegated-private-phases.sql','profitia_delegated_phases.installation']]){
     const sql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+file,import.meta.url),'utf8')
     await owner.query(sql);await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(sql)])
    }
    for(const [index,phaseId] of ['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'].entries()){
     const previous=['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL'][index-1]??null
     await owner.query("INSERT INTO profitia_request_phases.policies(application_id,phase_id,sequence,predecessor,operation,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'supplier.report.refresh','PRIVATE_SQL_PHASE','ACTIVE','SYNTHETIC_ONLY',$5)",[APP,phaseId,index+1,previous,expires()])
    }
    await owner.query(`CREATE TABLE request_fixture.phase_business(request_id uuid,phase_id text,input_digest text,organisation_id uuid,user_id uuid,PRIMARY KEY(request_id,phase_id));ALTER TABLE request_fixture.phase_business ENABLE ROW LEVEL SECURITY;ALTER TABLE request_fixture.phase_business FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON request_fixture.phase_business TO profitia_access_owner USING(true) WITH CHECK(true);CREATE POLICY runtime_scope ON request_fixture.phase_business TO ${ROLE} USING(${fence}) WITH CHECK(${fence});CREATE POLICY runtime_fence ON request_fixture.phase_business AS RESTRICTIVE TO ${ROLE} USING(${fence}) WITH CHECK(${fence});GRANT SELECT,INSERT ON request_fixture.phase_business TO ${ROLE}`)
    await owner.query(`GRANT USAGE ON SCHEMA profitia_request_phases TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_request_phases.descriptor(text),profitia_request_phases.parent_available(uuid,uuid,uuid,text,text),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${ROLE}`)
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,request_fixture TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.scope_allows(uuid,uuid,text),profitia_requests.policy(uuid,uuid,text),profitia_requests.reserve(uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(uuid,uuid),profitia_requests.external_runtime_descriptor(),profitia_requests.scope_allows(text,uuid,uuid,text),profitia_requests.policy(text,uuid,uuid,text),profitia_requests.reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(text,uuid,uuid) TO ${ROLE};GRANT SELECT,INSERT ON request_fixture.commands TO ${ROLE}`)
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_request_phases TO ${ROLE}_other;GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_requests.runtime_descriptor(),profitia_requests.external_runtime_descriptor(),profitia_requests.scope_allows(text,uuid,uuid,text),profitia_request_phases.parent_available(uuid,uuid,uuid,text,text) TO ${ROLE}_other`)
    await owner.query('COMMIT')
   }catch(e){await owner.query('ROLLBACK');throw e}
  }
  function fixture({schemaDigest=digests[3],externalSchemaDigest=digests[4],operation='supplier.report.refresh',continuation,observeScopedSql}={}){
   let actions=0
   const external=operation==='supplier.report.refresh',moduleId=external?'supplier_report':'benchmark'
   const application={appId:APP,profileId:external?'SUPPLIER_INTELLIGENCE_STANDALONE':'SPENDGURU_SAAS',deploymentId:'isolated-request',configurationVersion:'1',environment:'development',identityIssuer:ISSUER,organisationId:null,operations:[operation],features:external?['supplier_report']:['benchmark','forecast']}
   const transact=async(work,limits)=>{
    const c=await pool.connect();let timedOut=false
    const timer=setTimeout(()=>{timedOut=true;void c.end().catch(()=>{})},limits.timeoutMs)
    try{await c.query('BEGIN');const value=await work({query:queryFor(c),transaction:c});await c.query('COMMIT');return value}
    catch(e){try{await c.query('ROLLBACK')}catch{}throw e}
    finally{clearTimeout(timer);c.release(timedOut)}
   }
   const host=createPrivateOperationHost({application,binding:{applicationId:APP,environment:'development',projectId:'isolated-request-project',branchId:'isolated-request-branch',databaseName:DATABASE,role:ROLE,schemaDigest:digests[0]},module:{id:moduleId,schemaDigest:digests[1],auditSchemaDigest:digests[2]},requestLedger:{schemaDigest,...(external?{externalSchemaDigest}:{})},...(continuation?{requestContinuation:continuation}:{}),independentQuery:queryFor(auditPool),transact,
    createAuthenticator:({resolveBinding})=>async request=>{const binding=await resolveBinding({environment:'development',issuer:ISSUER,subject:'external-'+request.user});return binding?{kind:'HUMAN',actorId:binding.userId,userId:binding.userId,proofRef:'SYNTHETIC_VERIFIED_INTERFACE',issuer:ISSUER,audience:APP,environment:'development',expiresAt:binding.expiresAt}:null},
    readResources:async({actor,request})=>({resource:{id:request.resourceId,type:external?'supplier_report_request':'forecast_request',dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:request.organisationId,ownerUserId:actor.userId,version:'creation-intent-v1',projectionVersion:'request-accepted-v1'}}),projectOutput:value=>value})
   const input=({org=A,user=U,key='request_key_'+randomUUID(),payload={series:'shared_series',model:'naive'},resource='supplier-report-request:creation-fixture'}={})=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:org,resourceId:resource,idempotencyKey:key,payload,request:{user}})
   const execute=values=>host.execute(input(values),async(context,c)=>{actions++;if(context.requestContinuation)await c.query('INSERT INTO request_fixture.phase_business VALUES($1,$2,$3,$4,$5)',[context.requestReservation.requestId,context.requestContinuation.phaseId,context.requestContinuation.inputDigest,context.organisationId,context.actorId]);else await c.query('INSERT INTO request_fixture.commands VALUES($1,$2,$3,$4)',[context.requestReservation.requestId,context.organisationId,context.actorId,context.payloadDigest]);if(observeScopedSql)await observeScopedSql(c,context);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}})
   return{host,input,execute,get actions(){return actions}}
  }
  const count=async()=>({parents:Number((await owner.query('SELECT count(*) FROM profitia_requests.intents')).rows[0].count),commands:Number((await owner.query('SELECT count(*) FROM request_fixture.commands')).rows[0].count),used:Number((await owner.query('SELECT coalesce(sum(accepted_count),0) AS n FROM profitia_requests.policies')).rows[0].n),phases:Number((await owner.query('SELECT count(*) FROM profitia_request_phases.effects')).rows[0].count),business:Number((await owner.query('SELECT count(*) FROM request_fixture.phase_business')).rows[0].count)})
  const scenario=async(name,work)=>t.test(name,async()=>{await reset({capacity:1});await work()})
  const key='explicit_private_phase_parent_key_0001',inputDigest=hash('SYNTHETIC_PRIVATE_PHASE_CONTENT')
  const parent=async()=>{const f=fixture();const v=await f.execute({key});return v.value.requestId}
  const phaseFixture=(requestId,patch={},extra={})=>fixture({continuation:{requestId,phaseId:'REGISTER_LOOKUP',inputDigest,schemaDigest:phaseDigest,...patch},...extra})
  const noExtra={parents:1,commands:1,used:1,phases:0,business:0}
  await scenario('accepted parent continues one private SQL phase with current evidence and correlated canonical OUTCOME',async()=>{
   const requestId=await parent();let evidence
   const f=phaseFixture(requestId,{}, {observeScopedSql:async(c,context)=>{
    evidence=context.requestContinuation
    assert.equal(context.requestReservation.requestId,requestId);assert.equal(context.requestReservation.replay,false)
    assert.equal(evidence.requestId,requestId);assert.equal(evidence.phaseId,'REGISTER_LOOKUP');assert.equal(evidence.inputDigest,inputDigest)
    assert.equal(evidence.transactionId,context.moduleEvidence.transactionId)
    const row=(await c.query('SELECT profitia_request_phases.parent_available($1,$2,$3,$4,$5) AS allowed',[requestId,context.organisationId,context.actorId,context.resourceId,context.payloadDigest])).rows[0];assert.equal(row.allowed,true)
   }})
   assert.deepEqual((await f.execute({key})).value,{requestId,status:'ACCEPTED'})
   assert.equal(f.actions,1);assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
   const row=(await owner.query('SELECT * FROM profitia_request_phases.effects')).rows[0]
   assert.equal(row.status,'ACCEPTED');assert.equal(row.user_id,U);assert.equal(row.organisation_id,A);assert.equal(row.input_digest,inputDigest)
   const events=(await owner.query('SELECT event FROM profitia_access.security_events WHERE decision_id=$1 ORDER BY event_id',[row.decision_id])).rows.map(r=>r.event)
   assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert.equal(events[1].moduleEvidence.transactionId,evidence.transactionId)
   assert.equal(events[0].correlationId,events[1].correlationId);assert(events.every(e=>e.implementationVersion==='1.0.0-candidate.14'))
  })
  await scenario('concurrent phase replay executes one private action and does not charge another parent',async()=>{
   const requestId=await parent(),f=phaseFixture(requestId)
   const values=await Promise.all([f.execute({key}),f.execute({key})]);assert.deepEqual(values[0].value,values[1].value)
   assert.equal(f.actions,1);assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
  })
  await scenario('same phase with altered content conflicts rather than silently accepting a new result',async()=>{
   const requestId=await parent();await phaseFixture(requestId).execute({key})
   const foreign=phaseFixture(requestId,{inputDigest:hash('DIFFERENT_SYNTHETIC_CONTENT')})
   await assert.rejects(foreign.execute({key}),e=>isOperationDenied(e)&&e.reasonCode==='IDEMPOTENCY_CONFLICT')
   assert.equal(foreign.actions,0);assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
  })
  await scenario('installed order is enforced and all four private phases reuse exactly one quota unit',async()=>{
   const requestId=await parent(),late=phaseFixture(requestId,{phaseId:'STORE_FINANCIAL'})
   await assert.rejects(late.execute({key}),e=>isOperationDenied(e)&&e.reasonCode==='RESOURCE_SCOPE_MISMATCH');assert.equal(late.actions,0)
   for(const phaseId of ['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'])await phaseFixture(requestId,{phaseId}).execute({key})
   assert.deepEqual(await count(),{...noExtra,phases:4,business:4})
  })
  await scenario('unaccepted or random parent cannot bootstrap its own command, phase or quota',async()=>{
   const f=phaseFixture(randomUUID());await assert.rejects(f.execute({key}),e=>isOperationDenied(e)&&e.reasonCode==='RESOURCE_SCOPE_MISMATCH')
   assert.equal(f.actions,0);assert.deepEqual(await count(),{parents:0,commands:0,used:0,phases:0,business:0})
  })
  await scenario('a foreign actor, organisation, command or key cannot reuse an accepted parent',async()=>{
   const requestId=await parent(),f=phaseFixture(requestId)
   for(const patch of [{user:V},{org:B},{payload:{series:'foreign'}},{resource:'foreign-resource'},{key:key+'-foreign'}])await assert.rejects(f.execute({key,...patch}),isOperationDenied)
   assert.equal(f.actions,0);assert.deepEqual(await count(),noExtra)
  })
  await scenario('wrong source digest, missing install and uninstalled phase refuse before the domain action',async()=>{
   const requestId=await parent()
   for(const patch of [{schemaDigest:'0'.repeat(64)},{phaseId:'UNINSTALLED_PHASE'}]){const f=phaseFixture(requestId,patch);await assert.rejects(f.execute({key}),isOperationDenied);assert.equal(f.actions,0)}
   await owner.query('DELETE FROM profitia_request_phases.installation')
   await assert.rejects(phaseFixture(requestId).execute({key}),isOperationDenied);assert.deepEqual(await count(),noExtra)
  })
  await scenario('account, membership, permission, product and module revocation refuse fresh and replayed phases',async()=>{
   const requestId=await parent();await phaseFixture(requestId).execute({key})
   for(const [sql,restore,args]of[
    ["UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1","UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1",[U]],
    ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]],
    ["UPDATE profitia_access.permission_grants SET effect='DENY' WHERE user_id=$1","UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE user_id=$1",[U]],
    ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[A]],
    ["UPDATE profitia_modules.application_bindings SET status='REVOKED'","UPDATE profitia_modules.application_bindings SET status='ACTIVE'",[]]]){
    await owner.query(sql,args)
    try{for(const phaseId of ['REGISTER_LOOKUP','STORE_GENERAL'])await assert.rejects(phaseFixture(requestId,{phaseId}).execute({key}),isOperationDenied)}finally{await owner.query(restore,args)}
   }
   assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
  })
  await scenario('revoked or expired phase policy and parent request policy never become unmetered permission',async()=>{
   const requestId=await parent()
   await owner.query("UPDATE profitia_request_phases.policies SET status='REVOKED' WHERE phase_id='REGISTER_LOOKUP'")
   await assert.rejects(phaseFixture(requestId).execute({key}),isOperationDenied)
   await owner.query("UPDATE profitia_request_phases.policies SET status='ACTIVE',expires_at=now()-interval '1 second' WHERE phase_id='REGISTER_LOOKUP'")
   await assert.rejects(phaseFixture(requestId).execute({key}),isOperationDenied)
   await owner.query("UPDATE profitia_request_phases.policies SET expires_at=now()+interval '1 hour'")
   await owner.query("UPDATE profitia_requests.policies SET status='REVOKED'")
   await assert.rejects(phaseFixture(requestId).execute({key}),isOperationDenied);assert.deepEqual(await count(),noExtra)
  })
  await scenario('domain failure rolls back its business effect and phase receipt, preserving the accepted parent',async()=>{
   const requestId=await parent(),f=phaseFixture(requestId,{}, {observeScopedSql:async()=>{throw Error('SYNTHETIC_PHASE_FAILURE')}})
   await assert.rejects(f.execute({key}),isOperationDenied);assert.deepEqual(await count(),noExtra)
   assert.deepEqual((await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows.map(r=>r.phase),['FAILURE','INTENT'])
  })
  await scenario('canonical OUTCOME outage rolls back both private phase and business rows without a second charge',async()=>{
   const requestId=await parent()
   await owner.query("CREATE FUNCTION request_fixture.reject_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic phase audit outage';END IF;RETURN NEW;END $$;CREATE TRIGGER reject_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION request_fixture.reject_outcome()")
   await assert.rejects(phaseFixture(requestId).execute({key}),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE')
   assert.deepEqual(await count(),noExtra)
  })
  await scenario('a RESERVED phase cannot be committed before its own completion and canonical audit',async()=>{
   const requestId=await parent(),f=phaseFixture(requestId);let code
   await assert.rejects(f.host.execute(f.input({key}),async(_context,c)=>{try{await c.query('COMMIT')}catch(e){code=e.code;throw e}throw Error('Premature phase commit')}),isOperationDenied)
   assert.equal(code,'23514');assert.deepEqual(await count(),noExtra)
  })
  await scenario('even an accepted phase cannot commit without the same-transaction canonical OUTCOME',async()=>{
   const requestId=await parent(),f=phaseFixture(requestId);let code
   await assert.rejects(f.host.execute(f.input({key}),async(context,c)=>{
    assert.equal((await c.query('SELECT profitia_request_phases.accept($1,$2,$3,$4,$5) AS accepted',[requestId,'REGISTER_LOOKUP',inputDigest,context.decisionId,context.requestContinuation.policyVersion])).rows[0].accepted,true)
    try{await c.query('COMMIT')}catch(e){code=e.code;throw e}throw Error('Unjournaled phase commit')
   }),isOperationDenied)
   assert.equal(code,'23514');assert.deepEqual(await count(),noExtra)
  })
  await scenario('accepted phase content and identity are immutable, including a privileged accidental maintenance update',async()=>{
   const requestId=await parent();await phaseFixture(requestId).execute({key})
   await assert.rejects(owner.query("UPDATE profitia_request_phases.effects SET input_digest=$1",['0'.repeat(64)]),e=>e.code==='23514')
   await assert.rejects(owner.query('DELETE FROM profitia_request_phases.effects'),e=>e.code==='23514')
   assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
  })
  await scenario('broad accidental table ACL cannot grant direct authority or expose phase records',async()=>{
   const requestId=await parent();await phaseFixture(requestId).execute({key})
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_request_phases TO ${ROLE}`)
   assert.equal((await pool.query('SELECT * FROM profitia_request_phases.effects')).rowCount,0)
   assert.equal((await pool.query("UPDATE profitia_request_phases.policies SET status='ACTIVE'")).rowCount,0)
   assert.equal((await pool.query('DELETE FROM profitia_request_phases.effects')).rowCount,0)
   await assert.rejects(pool.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
   await assert.rejects(phaseFixture(requestId).execute({key}),isOperationDenied)
   assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
  })
  await scenario('missing current scope, altered parent and foreign decision cannot manufacture completion',async()=>{
   const requestId=await parent()
   assert.equal((await pool.query('SELECT profitia_request_phases.parent_available($1,$2,$3,$4,$5) AS available',[requestId,A,U,'foreign','0'.repeat(64)])).rows[0].available,false)
   const f=phaseFixture(requestId,{}, {observeScopedSql:async(c,context)=>{
    assert.equal((await c.query('SELECT profitia_request_phases.accept($1,$2,$3,$4,$5) AS accepted',[requestId,'REGISTER_LOOKUP',inputDigest,randomUUID(),context.requestContinuation.policyVersion])).rows[0].accepted,false)
    for(const [org,user]of [[B,U],[A,V]])assert.equal((await c.query('SELECT profitia_request_phases.parent_available($1,$2,$3,$4,$5) AS available',[requestId,org,user,context.resourceId,context.payloadDigest])).rows[0].available,false)
   }})
   await f.execute({key});assert.deepEqual(await count(),{...noExtra,phases:1,business:1})
  })
  await scenario('another physically bound and permitted application cannot reuse the same actor organisation and request',async()=>{
   const requestId=await parent(),c=await otherPool.connect(),q=queryFor(c)
   try{
    await c.query('BEGIN')
    const store=createAccessStore({binding:{applicationId:'other-phase-fixture',environment:'development',projectId:'isolated-request-project',branchId:'isolated-request-branch',databaseName:DATABASE,role:ROLE+'_other',schemaDigest:digests[0]}})
    const identityBinding=await store.resolveBinding(q,{environment:'development',issuer:ISSUER,subject:'external-'+U})
    await store.lockAccess(q,{actor:{kind:'HUMAN',actorId:U,userId:U,proofRef:'SYNTHETIC_ONLY',issuer:ISSUER,audience:'other-phase-fixture',environment:'development',expiresAt:expires()},identityBinding,organisationId:A})
    await c.query("SELECT profitia_modules.bind_scope('supplier_report')")
    const row=(await owner.query('SELECT resource_id,payload_digest FROM profitia_requests.intents WHERE request_id=$1',[requestId])).rows[0]
    assert.equal((await c.query("SELECT profitia_requests.scope_allows('supplier.report.refresh',$1,$2,$3) allowed",[A,U,row.resource_id])).rows[0].allowed,true)
    assert.equal((await c.query('SELECT profitia_request_phases.parent_available($1,$2,$3,$4,$5) available',[requestId,A,U,row.resource_id,row.payload_digest])).rows[0].available,false)
   }finally{await c.query('ROLLBACK');c.release()}
   assert.deepEqual(await count(),noExtra)
  })
  await scenario('installed phase definitions cannot be rewritten and revocation advances their version',async()=>{
   await assert.rejects(owner.query("UPDATE profitia_request_phases.policies SET sequence=10 WHERE phase_id='REGISTER_LOOKUP'"),e=>e.code==='23514')
   await assert.rejects(owner.query("UPDATE profitia_request_phases.policies SET predecessor='STORE_FINANCIAL' WHERE phase_id='STORE_GENERAL'"),e=>e.code==='23514')
   await owner.query("UPDATE profitia_request_phases.policies SET status='REVOKED' WHERE phase_id='REGISTER_LOOKUP'")
   assert.equal((await owner.query("SELECT version FROM profitia_request_phases.policies WHERE phase_id='REGISTER_LOOKUP'")).rows[0].version,'2')
  })
  await scenario('server construction captures phase binding immutably before later caller object mutation',async()=>{
   const requestId=await parent(),continuation={requestId,phaseId:'REGISTER_LOOKUP',inputDigest,schemaDigest:phaseDigest},f=fixture({continuation})
   continuation.phaseId='STORE_FINANCIAL';continuation.requestId=randomUUID();continuation.inputDigest='0'.repeat(64)
   await f.execute({key});assert.equal(f.actions,1)
   assert.equal((await owner.query('SELECT phase_id FROM profitia_request_phases.effects')).rows[0].phase_id,'REGISTER_LOOKUP')
  })
  await scenario('expiry during the private action refuses completion and rolls back phase/business output',async()=>{
   const requestId=await parent()
   await owner.query("UPDATE profitia_request_phases.policies SET expires_at=clock_timestamp()+interval '300 milliseconds' WHERE phase_id='REGISTER_LOOKUP'")
   const f=phaseFixture(requestId,{}, {observeScopedSql:async()=>{await new Promise(r=>setTimeout(r,400))}})
   await assert.rejects(f.execute({key}),isOperationDenied);assert.deepEqual(await count(),noExtra)
  })
 }finally{
  globalThis.fetch=previousFetch
  await pool?.end();await auditPool?.end();await otherPool?.end();await owner?.end();await root.end()
 }
})
