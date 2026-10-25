import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import test from 'node:test'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPrivateOperationHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {OPERATION_CONTRACT,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {requestOperationPolicy} from '../../../packages/platform-contracts/src/request-operations.mjs'
const {Client}=createRequire(import.meta.url)('pg')
const source=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')
const files=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','005-service-read.sql','006-request-reservation.sql','007-delegated-jobs.sql','010-external-request-admission.sql','011-request-continuation.sql','013-supplier-delegation.sql','014-delegated-private-phases.sql','015-delegated-private-inspection.sql','016-delegated-native-work.sql','017-additional-request-operations.sql','019-supplier-location-operations.sql','020-supplier-location-admission.sql']
const tables=['profitia_access.installation','profitia_modules.installation','profitia_modules.audit_installation','profitia_services.installation','profitia_requests.installation','profitia_jobs.installation','profitia_requests.external_installation','profitia_request_phases.installation','profitia_supplier_jobs.installation','profitia_delegated_phases.installation','profitia_request_inspection.installation','profitia_request_work.installation','profitia_requests.operation_installation','profitia_requests.location_installation','profitia_requests.location_admission_installation']
const ROLE='request_quota_foreground_fixture',DB='request_quota_'+randomUUID().replaceAll('-',''),A=randomUUID(),B=randomUUID(),U=randomUUID(),ISSUER='https://identity.fixture.test'
const extension=source('027-unmetered-supplier-requests.sql'),Q=hash(extension),future=()=>new Date(Date.now()+3600000).toISOString()

test('SQL027 keeps actual request history and current E1 authority with explicit unmetered supplier requests',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner'),root=new Client({connectionString:rootUrl})
 await root.connect();let owner,audit
 const url=new URL(rootUrl);url.pathname='/'+DB
 try{
  await root.query(`CREATE DATABASE ${DB}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  try{for(const[name,login]of[['profitia_access_owner',false],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect();await owner.query(`CREATE EXTENSION pgcrypto;GRANT CREATE ON DATABASE ${DB} TO profitia_access_owner`)
  const controlled=async fn=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const r=await fn();await owner.query('COMMIT');return r}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{for(let i=0;i<files.length;i++){
   const sql=source(files[i]);await owner.query(sql)
   if(i===0)await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-quota-project','isolated-quota-branch',$2)",[hash(sql),DB])
   else if(i===1)await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql)])
   else await owner.query(`INSERT INTO ${tables[i]} VALUES(true,'1.0.0',$1,'SYNTHETIC_NOT_RELEASE')`,[hash(sql)])
  }})
  const install=async()=>{await owner.query("SELECT set_config('profitia.install.request_quota_digest',$1,true)",[Q]);await owner.query(extension)}
  await t.test('wrong installer and interrupted installation preserve the old schema',async()=>{
   await assert.rejects(owner.query(extension),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await install();throw Error('Interrupted installation')}))
   assert.equal((await owner.query("SELECT to_regclass('profitia_requests.quota_installation') v")).rows[0].v,null)
  })
  await controlled(install)
  await t.test('the installation seeds no user grants or policies and its records are forced-RLS immutable',async()=>{
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.permission_grants')).rows[0].n,0)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_requests.policies')).rows[0].n,0)
   assert.deepEqual((await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='profitia_requests.quota_installation'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true})
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_requests.quota_installation SET source_ref='forged'")),e=>e.code==='42501')
  })
  const policies={}
  await controlled(async()=>{
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('consumer','ACTIVE')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'consumer','ACTIVE')",[ROLE])
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[U])
   await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'fixture-user',$3,'ACTIVE','SYNTHETIC',$4)",[randomUUID(),ISSUER,U,future()])
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
    await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC',$3)",[org,U,future()])
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('consumer',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC',$2)",[org,future()])
    for(const operation of['supplier.report.refresh','supplier.private.refresh']){
     await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),org,U,operation])
     const id=randomUUID();policies[org+operation]=id
     await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'consumer',$2,$3,'ACTIVE','METERED_FIXTURE',now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour',1)",[id,org,operation])
    }
   }
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('consumer','supplier_report',$1,'ACTIVE','SYNTHETIC',$2)",[randomUUID(),future()])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests TO ${ROLE};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${ROLE}`)
  })
  const connect=async()=>{const u=new URL(url);u.username=ROLE;u.password='isolated_ci_only';const c=new Client({connectionString:u.toString()});await c.connect();return c}
  audit=await connect()
  const count=async id=>(await owner.query('SELECT accepted_count::text n,quota_mode,version::text version FROM profitia_requests.policies WHERE policy_id=$1',[id])).rows[0]
  const fixture=(operation,opts={})=>{
   let actions=0
   const target=requestOperationPolicy(operation),application={appId:'consumer',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',deploymentId:'isolated-quota',configurationVersion:'1',environment:'development',identityIssuer:ISSUER,organisationId:null,operations:[operation],features:['supplier_report']}
   const host=createPrivateOperationHost({application,binding:{applicationId:'consumer',environment:'development',projectId:'isolated-quota-project',branchId:'isolated-quota-branch',databaseName:DB,role:ROLE,schemaDigest:hash(source(files[0]))},module:{id:'supplier_report',schemaDigest:hash(source(files[1])),auditSchemaDigest:hash(source(files[2]))},requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql')),...(target.additional?{operationSchemaDigest:hash(source('017-additional-request-operations.sql'))}:{}),...(opts.legacy?{}:{quotaSchemaDigest:opts.digest??Q})},independentQuery:audit.query.bind(audit),transact:async fn=>{const c=await connect();try{await c.query('BEGIN');const r=await fn({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{await c.end()}},
    createAuthenticator:({resolveBinding})=>async()=>{const b=await resolveBinding({environment:'development',issuer:ISSUER,subject:'fixture-user'});return b?{kind:'HUMAN',actorId:b.userId,userId:b.userId,proofRef:'VERIFIED_SYNTHETIC',issuer:ISSUER,audience:'consumer',environment:'development',expiresAt:b.expiresAt}:null},readResources:async({actor,request})=>({resource:{id:request.resourceId,type:target.resourceType,dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:request.organisationId,ownerUserId:actor.userId,version:'creation-intent-1',projectionVersion:'request-accepted-v1'}}),projectOutput:v=>v})
   const execute=(key='quota_request_'+randomUUID(),org=A,payload={mode:'fixture'})=>host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:org,resourceId:'quota-fixture-request',idempotencyKey:key,payload,request:{}},async context=>{actions++;if(opts.fail)throw Error('Interrupted business action');return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}})
   return{execute,get actions(){return actions}}
  }
  const denied=code=>e=>isOperationDenied(e)&&e.reasonCode===code
  for(const operation of['supplier.report.refresh','supplier.private.refresh'])await t.test(operation,async st=>{
   const id=policies[A+operation],f=fixture(operation)
   await st.test('fixed package policy still enforces its finite capacity',async()=>{await f.execute();await assert.rejects(f.execute(),denied('LIMIT_EXCEEDED'));assert.equal((await count(id)).n,'1')})
   const before=(await owner.query('SELECT to_jsonb(p) p FROM profitia_requests.policies p WHERE policy_id=$1',[id])).rows[0].p
   await controlled(()=>owner.query("UPDATE profitia_requests.policies SET quota_mode='UNMETERED',version=version+1,source_ref='OWNER_UNMETERED_FIXTURE' WHERE policy_id=$1",[id]))
   await st.test('mode transition preserves all accounting/history and records its revision',async()=>{
    const after=(await owner.query('SELECT to_jsonb(p) p FROM profitia_requests.policies p WHERE policy_id=$1',[id])).rows[0].p
    for(const k of Object.keys(before))if(!['quota_mode','version','source_ref'].includes(k))assert.deepEqual(after[k],before[k],k)
    assert.equal((await owner.query('SELECT accepted_count::text n FROM profitia_requests.quota_mode_events WHERE policy_id=$1',[id])).rows[0].n,'1')
   })
   await st.test('new requests exceed the old cap while same-key concurrency accounts exactly once',async()=>{
    await f.execute();const key='same_key_'+randomUUID();const[a,b]=await Promise.all([f.execute(key),f.execute(key)]);assert.equal(a.value.requestId,b.value.requestId);assert.equal((await count(id)).n,'3')
    await assert.rejects(f.execute(key,A,{different:'payload'}),denied('IDEMPOTENCY_CONFLICT'));assert.equal((await count(id)).n,'3')
   })
   await st.test('failed business action rolls back its intent and count',async()=>{const f2=fixture(operation,{fail:true});await assert.rejects(f2.execute());assert.equal((await count(id)).n,'3')})
   await st.test('old SDK and wrong accepted schema fail closed',async()=>{await assert.rejects(fixture(operation,{legacy:true}).execute(),denied('LIMIT_POLICY_UNAVAILABLE'));await assert.rejects(fixture(operation,{digest:'f'.repeat(64)}).execute());assert.equal((await count(id)).n,'3')})
   await st.test('an authorised second organisation has its own metered quota and cannot borrow unlimited',async()=>{await f.execute(undefined,B);await assert.rejects(f.execute(undefined,B),denied('LIMIT_EXCEEDED'));assert.equal((await count(id)).n,'3')})
   await st.test('revoked membership still prevents a request',async()=>{
    await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
    await assert.rejects(f.execute(),isOperationDenied);assert.equal((await count(id)).n,'3')
    await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
   })
  })
  await t.test('quota mode cannot be applied to forecast; ordinary SQL cannot change modes or remove history',async()=>{
   await assert.rejects(controlled(()=>owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity,quota_mode) VALUES($1,'consumer',$2,'forecast.request','ACTIVE','FORGED',now(),now()+interval '1 hour',now()+interval '1 hour',1,'UNMETERED')",[randomUUID(),A])),e=>e.code==='23514')
   await assert.rejects(audit.query("UPDATE profitia_requests.policies SET quota_mode='FIXED'"),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query('DELETE FROM profitia_requests.quota_mode_events')),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query('UPDATE profitia_requests.policies SET accepted_count=0')),e=>e.code==='42501')
  })
  await t.test('UNMETERED ignores an expired historical quota window, not current user/module/product expiry',async()=>{
   const id=randomUUID();await controlled(async()=>{
    await owner.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE policy_id=$1",[policies[A+'supplier.report.refresh']])
    await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity,quota_mode) VALUES($1,'consumer',$2,'supplier.report.refresh','ACTIVE','PERMANENT_OWNER_POLICY',now()-interval '2 hours',now()-interval '1 hour',now()-interval '1 hour',1,'UNMETERED')",[id,A])
   });await fixture('supplier.report.refresh').execute();assert.equal((await count(id)).n,'1')
   await controlled(()=>owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[A]))
   await assert.rejects(fixture('supplier.report.refresh').execute(),isOperationDenied)
  })
 }finally{
  if(audit)await audit.end();if(owner)await owner.end();await root.query(`DROP DATABASE IF EXISTS ${DB} WITH(FORCE)`);await root.end()
 }
})
