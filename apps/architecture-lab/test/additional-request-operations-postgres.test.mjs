import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import test from 'node:test'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPrivateOperationHost,createDelegatedNativeWorkHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {createDelegatedJobStore} from '../../../packages/platform-contracts/src/delegated-job.mjs'
import {OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {requestOperationPolicy} from '../../../packages/platform-contracts/src/request-operations.mjs'
import {createClerkAccountStatusReader} from '../../../packages/platform-contracts/src/identity-provider.mjs'
const {Client}=createRequire(import.meta.url)('pg')
const hash=v=>createHash('sha256').update(v).digest('hex'),source=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8')
const F='additional_request_foreground_fixture',W='additional_request_work_fixture',A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),serviceId=randomUUID()
const DATABASE='additional_requests_'+randomUUID().replaceAll('-',''),future=()=>new Date(Date.now()+3600000).toISOString(),ISSUER='https://identity.fixture.test'
const files=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','005-service-read.sql','006-request-reservation.sql','007-delegated-jobs.sql','010-external-request-admission.sql','011-request-continuation.sql','013-supplier-delegation.sql','014-delegated-private-phases.sql','015-delegated-private-inspection.sql','016-delegated-native-work.sql']
const tables=['profitia_access.installation','profitia_modules.installation','profitia_modules.audit_installation','profitia_services.installation','profitia_requests.installation','profitia_jobs.installation','profitia_requests.external_installation','profitia_request_phases.installation','profitia_supplier_jobs.installation','profitia_delegated_phases.installation','profitia_request_inspection.installation','profitia_request_work.installation']
const extension=source('017-additional-request-operations.sql'),extensionHash=hash(extension),baseHash=hash(source(files[0]))

test('additional requests use actual ordinary admission, current delegation and native-work SQL without changing old installations',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 let owner,audit,workerAudit
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0)
  await root.query(`CREATE DATABASE ${DATABASE}`)
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const[role,login]of[['profitia_access_owner',false],[F,true],[W,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect();await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const r=await action();await owner.query('COMMIT');return r}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   for(let i=0;i<files.length;i++){
    const sql=source(files[i]);await owner.query(sql)
    if(i===0)await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-additional-project','isolated-additional-branch',$2)",[hash(sql),DATABASE])
    else if(i===1)await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql)])
    else await owner.query(`INSERT INTO ${tables[i]} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY_NOT_RELEASE')`,[hash(sql)])
   }
  })
  const oldReceipts=await owner.query('SELECT schema_digest FROM profitia_requests.external_installation UNION ALL SELECT schema_digest FROM profitia_supplier_jobs.installation UNION ALL SELECT schema_digest FROM profitia_request_work.installation')
  await t.test('wrong installer and interrupted migration preserve old constraints and receipts',async()=>{
   await assert.rejects(owner.query(extension),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(extension);throw Error('Synthetic installation interruption')}))
   assert.equal((await owner.query("SELECT to_regclass('profitia_requests.operation_installation') AS value")).rows[0].value,null)
   assert.deepEqual((await owner.query('SELECT schema_digest FROM profitia_requests.external_installation UNION ALL SELECT schema_digest FROM profitia_supplier_jobs.installation UNION ALL SELECT schema_digest FROM profitia_request_work.installation')).rows,oldReceipts.rows)
  })
  await controlled(async()=>{await owner.query(extension);await owner.query("INSERT INTO profitia_requests.operation_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_EXTENSION_NOT_RELEASE')",[extensionHash])})
  await t.test('installation is immutable, forced RLS and introduces no business grant or activation',async()=>{
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.applications')).rows[0].n,0)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.permission_grants')).rows[0].n,0)
   assert.deepEqual((await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='profitia_requests.operation_installation'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true})
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_requests.operation_installation SET source_ref='forged'")),e=>e.code==='42501')
  })
  await controlled(async()=>{
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('consumer','ACTIVE'),('worker','ACTIVE')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'consumer','ACTIVE'),($2,'worker','ACTIVE')",[F,W])
   for(const user of[U,V]){
    await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
    await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,future()])
   }
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
    for(const user of[U,V])await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,future()])
    for(const product of['SPENDGURU','SUPPLIER_INTELLIGENCE'])await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('consumer',$1,$2,ARRAY['benchmark','supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$3)",[org,product,future()])
   }
   for(const module of['benchmark','supplier_report'])await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('consumer',$1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[module,randomUUID(),future()])
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-worker','worker-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[W,randomUUID(),serviceId,future()])
   await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('consumer','SAVE_RESULT','WRITE','ACTIVE','SYNTHETIC_ONLY',$1)",[future()])
   await owner.query(`CREATE SCHEMA acquisition_fixture;CREATE TABLE acquisition_fixture.results(request_id uuid PRIMARY KEY REFERENCES profitia_requests.intents(request_id),organisation_id uuid NOT NULL,user_id uuid NOT NULL,body text NOT NULL);ALTER TABLE acquisition_fixture.results ENABLE ROW LEVEL SECURITY;ALTER TABLE acquisition_fixture.results FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON acquisition_fixture.results TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY runtime_write ON acquisition_fixture.results TO ${W} WITH CHECK(profitia_request_work.scope_allows(request_id,'SAVE_RESULT',organisation_id,user_id,'WRITE'));
    CREATE POLICY runtime_read ON acquisition_fixture.results TO ${F} USING(profitia_access.scope_allows('consumer',organisation_id,user_id) AND profitia_modules.scope_allows('benchmark',organisation_id,user_id));
    GRANT USAGE ON SCHEMA acquisition_fixture TO ${F},${W};GRANT INSERT ON acquisition_fixture.results TO ${W};GRANT SELECT ON acquisition_fixture.results TO ${F};
    GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_jobs TO ${F};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${F};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text) TO ${F};
    GRANT USAGE ON SCHEMA profitia_access,profitia_services,profitia_requests,profitia_jobs,profitia_request_work TO ${W};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_requests.operation_runtime_descriptor(),profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.append_audit(jsonb),profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text) TO ${W}`)
  })
  const ordinaryUrl=role=>{const u=new URL(url);u.username=role;u.password='isolated_ci_only';return u.toString()}
  const connect=async role=>{const c=new Client({connectionString:ordinaryUrl(role)});await c.connect();return c}
  audit=await connect(F);workerAudit=await connect(W)
  const transact=role=>async(work,limits)=>{const c=await connect(role);const timer=setTimeout(()=>{void c.end().catch(()=>{})},limits.timeoutMs);try{await c.query('BEGIN');const r=await work({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return r}catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{clearTimeout(timer);await c.end()}}
  const binding=role=>({applicationId:role===F?'consumer':'worker',environment:'development',projectId:'isolated-additional-project',branchId:'isolated-additional-branch',databaseName:DATABASE,role,schemaDigest:baseHash})
  let providerActive=true
  const readExternalAccount=createClerkAccountStatusReader({environment:'development',issuer:ISSUER,client:{users:{getUser:async subject=>({id:subject,banned:!providerActive,locked:false,deprovisioned:false})}}})
  for(const operation of['supplier.private.refresh','benchmark.discovery.request'])await t.test(operation,async st=>{
   const target=requestOperationPolicy(operation),policyId=randomUUID(),bindingId=randomUUID(),permissionId=randomUUID()
   await controlled(async()=>{
    await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'consumer',$2,$3,'ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$4,10)",[policyId,A,operation,future()])
    await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'consumer',$2,$3,'SPENDGURU_SAAS','request-v1','worker','stored.technical-command','isolated-source-project','isolated-source-branch','isolated_source','source-app',$4,'technical-command-v1','quality-v1','technical-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$5)",[bindingId,operation,F,'a'.repeat(64),future()])
    await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),W,bindingId,A,future()])
   })
   const job={schemaDigest:hash(source('007-delegated-jobs.sql')),targetOperation:operation,supplierSchemaDigest:hash(source('013-supplier-delegation.sql')),operationSchemaDigest:extensionHash}
   const store=createDelegatedJobStore({binding:binding(F),...job})
   const host=createPrivateOperationHost({application:{appId:'consumer',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'synthetic-foreground',configurationVersion:'request-v1',identityIssuer:ISSUER,organisationId:null,operations:[operation],features:[target.feature]},binding:binding(F),module:{id:target.module,schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))},requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql')),operationSchemaDigest:extensionHash},independentQuery:audit.query.bind(audit),transact:transact(F),
    createAuthenticator:({resolveBinding})=>async request=>{const b=await resolveBinding({environment:'development',issuer:ISSUER,subject:'external-'+request.user});return b?{kind:'HUMAN',actorId:b.userId,userId:b.userId,proofRef:'SYNTHETIC_VERIFIED_BOUNDARY',issuer:ISSUER,audience:'consumer',environment:'development',expiresAt:b.expiresAt}:null},
    readResources:async({actor,request})=>({resource:{id:request.resourceId,type:target.resourceType,dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:request.organisationId,ownerUserId:actor.actorId,version:'1',projectionVersion:target.projectionVersion}}),projectOutput:value=>value})
   const payload={kind:'TECHNICAL_COMMAND',commandDigest:'f'.repeat(64)},input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:A,resourceId:'request:'+operation,idempotencyKey:'fixture_request_'+randomUUID(),payload,request:{user:U}}
   let actions=0
   const admit=(patch={})=>host.execute({...input,...patch},async(context,c)=>{actions++;await store.createDispatch(c.query.bind(c),context);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}})
   await st.test('ordinary SQL denies absent explicit permission before creating any request',async()=>{await assert.rejects(admit(),isOperationDenied);assert.equal(actions,0);assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_requests.intents WHERE operation=$1',[operation])).rows[0].n,0)})
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW',$4,$5)",[permissionId,A,U,operation,target.feature]))
   const result=await admit(),requestId=result.value.requestId
   await st.test('request and one current delegation commit atomically; replay adds neither',async()=>{
    assert.equal(actions,1);assert.equal((await admit()).value.requestId,requestId);assert.equal(actions,1)
    assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_jobs.delegations WHERE request_id=$1',[requestId])).rows[0].n,1)
    assert.equal((await owner.query('SELECT accepted_count FROM profitia_requests.policies WHERE policy_id=$1',[policyId])).rows[0].accepted_count,1)
    await assert.rejects(admit({payload:{kind:'TECHNICAL_COMMAND',commandDigest:'e'.repeat(64)}}),isOperationDenied)
   })
   const workBinding={...binding(W),service:{schemaDigest:hash(source('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-v1'}}
   const worker=createDelegatedNativeWorkHost({application:{appId:'worker',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'synthetic-worker',configurationVersion:'worker-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding:workBinding,job,privateWork:{schemaDigest:hash(source('016-delegated-native-work.sql'))},independentQuery:workerAudit.query.bind(workerAudit),transact:transact(W),readExternalAccount})
   const workInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,resourceId:requestId,payload,request:null},unit={unitId:'SAVE_RESULT',accessMode:'WRITE',inputDigest:operationPayloadDigest({requestId})}
   let workCalls=0
   const work=(patch={})=>worker.runSqlWork({...workInput,...patch},unit,async(context,c)=>{workCalls++;assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,U);assert.equal(context.delegation.target.operation,operation);await c.query('INSERT INTO acquisition_fixture.results VALUES($1,$2,$3,$4)',[requestId,context.organisationId,context.subjectUserId,'PRIVATE_INTENT_RESULT_'+operation])})
   await st.test('actual service writes through scoped native unit, records canonical outcome and releases no private body',async()=>{
    const r=await work();assert.deepEqual(r.value,{requestId,status:'ACCEPTED'});assert.equal(workCalls,1)
    assert.equal((await owner.query('SELECT count(*)::int n FROM acquisition_fixture.results WHERE request_id=$1',[requestId])).rows[0].n,1)
    assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->'requestWork'->>'requestId'=$1",[requestId])).rows[0].n,1)
    assert(!(await owner.query("SELECT event::text FROM profitia_access.security_events")).rows.some(r=>r.event.includes('PRIVATE_INTENT_RESULT')))
   })
   if(operation==='benchmark.discovery.request')await st.test('personal Finder result is visible only through current own user and organization read',async()=>{
    const readPermission=randomUUID()
    await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW','benchmark.discovery.read','benchmark')",[readPermission,A,U]))
    const readHost=createPrivateOperationHost({application:{appId:'consumer',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'synthetic-foreground',configurationVersion:'read-v1',identityIssuer:ISSUER,organisationId:null,operations:['benchmark.discovery.read'],features:['benchmark']},binding:binding(F),module:{id:'benchmark',schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))},independentQuery:audit.query.bind(audit),transact:transact(F),
     createAuthenticator:({resolveBinding})=>async request=>{const b=await resolveBinding({environment:'development',issuer:ISSUER,subject:'external-'+request.user});return b?{kind:'HUMAN',actorId:b.userId,userId:b.userId,proofRef:'SYNTHETIC_VERIFIED_BOUNDARY',issuer:ISSUER,audience:'consumer',environment:'development',expiresAt:b.expiresAt}:null},
     readResources:async()=>({resource:{id:requestId,type:'benchmark_discovery_result',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:A,ownerUserId:U,version:'1',projectionVersion:'private-discovery-v1',contentRequirements:[{product:'SPENDGURU',feature:'benchmark'}]}}),projectOutput:value=>value})
    let reads=0
    const read=(patch={})=>readHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.discovery.read',organisationId:A,resourceId:requestId,payload:{requestId},request:{user:U},...patch},async(_context,c)=>{reads++;return(await c.query('SELECT body FROM acquisition_fixture.results WHERE request_id=$1',[requestId])).rows[0]?.body})
    assert.equal((await read()).value,'PRIVATE_INTENT_RESULT_'+operation)
    await assert.rejects(read({request:{user:V}}),isOperationDenied);await assert.rejects(read({organisationId:B}),isOperationDenied);assert.equal(reads,1)
    assert.equal((await audit.query('SELECT body FROM acquisition_fixture.results')).rowCount,0,'An unbound ordinary login sees no private result')
    await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[readPermission]))
    await assert.rejects(read(),isOperationDenied);assert.equal(reads,1)
   })
   await st.test('other organisation, revoked operation and deactivated external account refuse before callback',async()=>{
    await assert.rejects(work({organisationId:B}),isOperationDenied);assert.equal(workCalls,1)
    await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[permissionId]))
    await assert.rejects(work(),isOperationDenied);await assert.rejects(admit(),isOperationDenied);assert.equal(workCalls,1)
    await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW',$4,$5)",[permissionId,A,U,operation,target.feature]))
    providerActive=false;try{await assert.rejects(work(),isOperationDenied)}finally{providerActive=true}assert.equal(workCalls,1)
   })
   await st.test('ordinary login cannot bypass unit scope or edit installation',async()=>{
    const c=await connect(W);try{await assert.rejects(c.query('INSERT INTO acquisition_fixture.results VALUES($1,$2,$3,$4)',[randomUUID(),A,U,'forged']),e=>['42501','23503'].includes(e.code));await assert.rejects(c.query('SELECT * FROM profitia_requests.operation_installation'),e=>e.code==='42501')}finally{await c.end()}
   })
  })
 }finally{
  for(const c of[audit,workerAudit,owner])if(c)await c.end()
  await root.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[DATABASE])
  await root.query(`DROP DATABASE IF EXISTS ${DATABASE}`);await root.end()
 }
})
