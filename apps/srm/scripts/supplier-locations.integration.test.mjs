import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {privateBusinessPlan} from '../db/private-store/initialize.mjs'
import {createSupplierLocationRuntime,createSupplierLocationHandler} from '../src/server/supplier-locations.ts'
import {createSrmSensitiveOperationHost,readPrivateSupplier,privateSupplierReportId} from '../src/server/supplier-sensitive-operation.ts'
import {createSrmLocationGeocodingDomain,createSrmLocationGeocodingRequest,createSrmTransientGeocodingDomain} from '../src/server/supplier-location-geocoding.ts'
import {createSrmNativePgDriver} from '../src/server/native-pg-driver.ts'
import {createDelegatedNativeWorkHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {mapMgbiGeneralRecord} from '../src/server/mgbi-general.ts'
import {createSrmLocationAdmission} from '../src/server/supplier-location-admission.ts'
import './supplier-location-admission.integration.test.mjs'
const hash=v=>createHash('sha256').update(v).digest('hex'),future=()=>new Date(Date.now()+3600000).toISOString()
const core=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8')
const own=n=>fs.readFileSync(new URL('../db/private-store/'+n,import.meta.url),'utf8')
const WORKER='srm_locations_geo_worker',WORKER_APP='srm-maps-geocoding-worker',SERVICE=randomUUID()
const ROLE='srm_locations_human',DATABASE='srm_locations_'+randomUUID().replaceAll('-',''),A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),S=randomUUID(),SB=randomUUID()
const NIP='8650004194',ISSUER='https://identity.fixture.test',ORIGIN='https://srm.fixture.test'
const pairs=[['001-internal-access.sql','profitia_access.installation'],['002-module-scope.sql','profitia_modules.installation'],['003-module-audit.sql','profitia_modules.audit_installation'],['005-service-read.sql','profitia_services.installation'],['006-request-reservation.sql','profitia_requests.installation'],['007-delegated-jobs.sql','profitia_jobs.installation'],['010-external-request-admission.sql','profitia_requests.external_installation'],['011-request-continuation.sql','profitia_request_phases.installation'],['013-supplier-delegation.sql','profitia_supplier_jobs.installation'],['014-delegated-private-phases.sql','profitia_delegated_phases.installation'],['015-delegated-private-inspection.sql','profitia_request_inspection.installation'],['016-delegated-native-work.sql','profitia_request_work.installation'],['017-additional-request-operations.sql','profitia_requests.operation_installation'],['019-supplier-location-operations.sql','profitia_requests.location_installation']]
const manual={label:'Budowa',description:'Shared with organisation',address:{line1:'Prosta 1',postalCode:'00-001',locality:'Warszawa',country:'Polska'},position:{lat:52,lng:21}}

for(const p1 of[false,true])test((p1?'P1 SQL020/014':'TASK02 SQL019')+' actual SRM persistence through native E1, ordinary role and HTTP',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const root=new pg.Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 let owner,pool,auditPool,workPool,workAudit
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0);await root.query(`CREATE DATABASE ${DATABASE}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  for(const[role,login]of[['profitia_access_owner',false],['srm_app_runtime',true],['neon_superuser',false],[ROLE,true],[WORKER,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   const r=(await root.query('SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];assert.deepEqual(r,{rolcanlogin:login,rolsuper:false,rolbypassrls:false})
  }
  await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4;ALTER ROLE ${WORKER} CONNECTION LIMIT 4;COMMIT`)
  owner=new pg.Client({connectionString:url.toString()});await owner.connect()
  if(p1)await owner.query('CREATE EXTENSION pgcrypto')
  await owner.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC;GRANT CONNECT ON DATABASE ${DATABASE} TO ${ROLE},${WORKER};GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const result=await action();await owner.query('COMMIT');return result}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   for(const[file,table]of pairs){await owner.query(core(file));if(file.startsWith('001'))await owner.query(`INSERT INTO ${table}(schema_version,schema_digest,environment,project_id,branch_id,database_name)VALUES('1.0.0',$1,'development','locations-project','locations-branch',$2)`,[hash(core(file)),DATABASE]);else if(file.startsWith('002'))await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1)`,[hash(core(file))]);else await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_LOCAL_NOT_RELEASE')`,[hash(core(file))])}
   await owner.query(own('001-supplier-requests.sql'));await owner.query("INSERT INTO profitia_supplier_requests.installation VALUES(true,'1.0.0',$1,$2)",[hash(own('001-supplier-requests.sql')),'c'.repeat(40)])
   await owner.query("INSERT INTO profitia_access.applications(application_id,status)VALUES('srm','DISABLED'),('srm-maps-geocoding-worker','DISABLED')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status)VALUES($1,'srm','ACTIVE')",[ROLE])
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status)VALUES($1,$2,'ACTIVE')",[WORKER,WORKER_APP])
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)VALUES($1,$2,$3,'PLATFORM_INTERNAL','geo-fixture','geo-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[WORKER,randomUUID(),SERVICE,future()])
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at)VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
   for(const user of[U,V]){
    await owner.query("INSERT INTO profitia_access.accounts(user_id,status)VALUES($1,'ACTIVE')",[user])
    await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at)VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,future()])
   }
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status)VALUES($1,'ACTIVE')",[org])
    for(const user of[U,V])await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at)VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,future()])
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at)VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[org,future()])
   }
  })
  await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_access_owner`)
  await owner.query('BEGIN');try{for(const sql of privateBusinessPlan({binding:{environment:'development',projectId:'locations-project',branchId:'locations-branch',databaseName:DATABASE,role:ROLE},sourceSha:'a'.repeat(40)}).sql)await owner.query(sql);await owner.query('COMMIT')}catch(e){await owner.query('ROLLBACK');throw e}
  await controlled(async()=>{
   for(const[file,table]of[['002-supplier-business-phases.sql','srm.supplier_business_installation'],['003-named-supplier-interest.sql','srm.named_interest_installation'],['006-delegated-supplier-business.sql','srm.delegated_supplier_installation'],['007-supplier-private-inspection.sql','srm.supplier_inspection_installation'],['008-supplier-native-work.sql','srm.supplier_work_installation'],['010-supplier-sensitive-work.sql','srm.supplier_sensitive_installation']]){
    await owner.query(own(file));await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,$2)`,[hash(own(file)),'c'.repeat(40)])
   }
  })
  const extension=own('013-supplier-locations.sql')
  const parentExtension=own('014-supplier-location-admission-parent.sql'),proofKey=Buffer.alloc(32,37)
  await t.test('installer must be controlled, exact and disabled; interrupted SQL leaves no receipt',async()=>{
   await assert.rejects(owner.query(extension),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(extension);throw Error('synthetic interruption')}))
   assert.equal((await owner.query("SELECT to_regclass('srm.supplier_locations') AS value")).rows[0].value,null)
   await controlled(()=>owner.query("UPDATE profitia_access.applications SET status='ACTIVE'"))
   await assert.rejects(controlled(()=>owner.query(extension)),e=>e.code==='42501')
   await controlled(()=>owner.query("UPDATE profitia_access.applications SET status='DISABLED'"))
   await controlled(async()=>{await owner.query(extension);await owner.query("INSERT INTO srm.supplier_location_installation VALUES(true,'1.0.0',$1,$2)",[hash(extension),'b'.repeat(40)])})
  })
  if(p1)await t.test('SQL020/014 controlled installation is additive, transactional and requires disabled apps',async()=>{
   const fences=(await owner.query("SELECT policyname,with_check FROM pg_policies WHERE schemaname='srm' AND tablename='suppliers' AND policyname IN('private_operation_fence','inspected_update_fence') ORDER BY policyname")).rows
   await assert.rejects(owner.query(parentExtension),e=>e.code==='42501')
   await controlled(async()=>{
    await owner.query(core('020-supplier-location-admission.sql'))
    await owner.query("INSERT INTO profitia_requests.location_admission_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(core('020-supplier-location-admission.sql'))])
   })
   await assert.rejects(controlled(async()=>{await owner.query(parentExtension);throw Error('interrupted014')}))
   assert.equal((await owner.query("SELECT to_regclass('srm.supplier_location_admission_installation') AS value")).rows[0].value,null)
   await controlled(async()=>{
    await owner.query(parentExtension)
    await owner.query("INSERT INTO srm.supplier_location_admission_installation(singleton,schema_version,schema_digest,source_ref)VALUES(true,'1.0.0',$1,$2)",[hash(parentExtension),'e'.repeat(40)])
    await owner.query('INSERT INTO profitia_requests.location_admission_receivers VALUES($1,true,$2)',[ROLE,proofKey])
   })
   assert.deepEqual((await owner.query("SELECT policyname,with_check FROM pg_policies WHERE schemaname='srm' AND tablename='suppliers' AND policyname IN('private_operation_fence','inspected_update_fence') ORDER BY policyname")).rows,fences,'both original restrictive DML checks remain byte-identical')
   await assert.rejects(controlled(()=>owner.query("UPDATE srm.supplier_location_admission_installation SET source_ref=$1",['f'.repeat(40)])),e=>e.code==='42501')
  })
  await controlled(async()=>{
   // Function ACLs only: no direct read/write ACL for a business location table.
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,srm TO ${ROLE};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${ROLE}`)
   await owner.query(`GRANT EXECUTE ON FUNCTION srm.delegated_supplier_row(text,uuid,uuid,uuid,uuid,text,text),srm.inspected_supplier_row(text,uuid,uuid,uuid,uuid,text,text),srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text),srm.current_supplier_work(uuid,uuid,text),srm.current_supplier_inspection(uuid,uuid,text) TO ${ROLE}`)
   await owner.query(`GRANT EXECUTE ON FUNCTION srm.sensitive_installation_descriptor(),srm.private_supplier_metadata(uuid,text,text,text,uuid),srm.sensitive_human_snapshot(uuid,uuid),srm.sensitive_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text),srm.sensitive_cache_scope(uuid,text,text,timestamptz,timestamptz,text) TO ${ROLE}`)
   await owner.query(`GRANT EXECUTE ON FUNCTION srm.location_geocode_metadata(uuid,uuid,uuid,text),srm.location_work_catalog_row(text,text),srm.location_sources_admitted(uuid,uuid,jsonb),srm.location_installation_descriptor(),srm.location_metadata(uuid,uuid,text,uuid),srm.location_page(uuid,uuid,text,integer,integer),srm.location_manual_write(uuid,uuid,uuid,text,bigint,uuid,text,text,text),srm.location_sync_target(uuid,uuid,text),srm.location_sync_write(uuid,uuid,bigint,uuid,text,text,jsonb),srm.location_expire(uuid,uuid) TO ${ROLE}`)
   if(p1)await owner.query(`GRANT EXECUTE ON FUNCTION srm.location_admission_installation_descriptor(),srm.location_admission_parent(uuid,uuid,text,text,uuid),srm.location_admission_metadata(uuid,uuid,text,text,uuid) TO ${ROLE}`)
   for(const user of[U,V])for(const operation of['supplier.location.read','supplier.location.write','supplier.location.sync','supplier.report.read','supplier.private.read'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report',$5)",[randomUUID(),A,user,operation,p1&&operation.startsWith('supplier.location.')?'supplier-locations:'+S:null])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_jobs TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text) TO ${ROLE}`)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_services,profitia_requests,profitia_jobs,profitia_request_work,srm TO ${WORKER};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_requests.operation_runtime_descriptor(),profitia_requests.location_runtime_descriptor(),profitia_requests.location_evidence_current(jsonb,text,uuid,uuid),profitia_requests.location_permission(text,uuid,uuid,text,text),profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.append_audit(jsonb),profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text),srm.location_geocode_target(uuid),srm.location_geocode_store(uuid,uuid,text,bigint,jsonb) TO ${WORKER}`)
   await owner.query("UPDATE profitia_access.applications SET status='ACTIVE'")
  })
  await owner.query('BEGIN;SET LOCAL session_replication_role=replica')
  for(const[org,id,slug]of[[A,S,'alpha'],[B,SB,'beta']]){await owner.query('INSERT INTO srm.organizations(id,slug)VALUES($1,$2)',[org,slug]);await owner.query('INSERT INTO srm.suppliers(organization_id,id,nip,krs)VALUES($1,$2,$3,$4)',[org,id,NIP,'0000123456'])}
  await owner.query('COMMIT')
  assert.equal((await owner.query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'O'")).rows[0].n,0)
  const ordinary=new URL(url);ordinary.username=ROLE;ordinary.password='isolated_ci_only';pool=new pg.Pool({connectionString:ordinary.toString(),max:3});auditPool=new pg.Pool({connectionString:ordinary.toString(),max:1})


  const clerk={async authenticateRequest(request){const user=request.headers.get('authorization')?.replace(/^Bearer external-/,'');const auth={isAuthenticated:true,tokenType:'session_token',userId:'external-'+user,sessionId:'session-'+user,actor:null,sessionClaims:{iss:ISSUER,sub:'external-'+user,sid:'session-'+user,azp:ORIGIN,exp:Math.floor(Date.now()/1000)+3600}};return{status:[U,V].includes(user)?'signed-in':'signed-out',isAuthenticated:[U,V].includes(user),toAuth:()=>auth}},sessions:{async getSession(id){return{id,userId:id.replace('session-','external-'),status:'active',expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000,actor:null}}},users:{async getUser(id){return{id,banned:false,locked:false,deprovisioned:false}}}}
  const options={pool,auditPool,clerk,application:{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'isolated-locations',configurationVersion:'locations-test-v1',identityIssuer:ISSUER,organisationId:null,features:['supplier_report'],operations:['supplier.location.read']},identity:{appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},binding:{applicationId:'srm',environment:'development',projectId:'locations-project',branchId:'locations-branch',databaseName:DATABASE,role:ROLE,schemaDigest:hash(core('001-internal-access.sql'))},module:{id:'supplier_report',schemaDigest:hash(core('002-module-scope.sql')),auditSchemaDigest:hash(core('003-module-audit.sql'))},businessDigest:hash(extension),secret:'synthetic-local-secret-'.repeat(3),ledger:{schemaDigest:hash(core('006-request-reservation.sql')),externalSchemaDigest:hash(core('010-external-request-admission.sql')),operationSchemaDigest:hash(core('017-additional-request-operations.sql')),locationSchemaDigest:hash(core('019-supplier-location-operations.sql'))}}
  let parentLockProbed=false,laterParentLockProbed=false
  if(p1){
   options.parentSchemaDigest=hash(parentExtension)
   const port=createSrmLocationAdmission({schemaDigest:hash(core('020-supplier-location-admission.sql')),parentSchemaDigest:hash(parentExtension),proofKey})
   options.locationAdmission={...port,async readParent(input){
    const parent=await port.readParent(input)
    if(!parentLockProbed||parent.version!=='0'&&!laterParentLockProbed){
     const probe=new pg.Client({connectionString:url.toString()});await probe.connect()
     try{await probe.query('BEGIN');await assert.rejects(probe.query('SELECT 1 FROM srm.suppliers WHERE organization_id=$1 AND id=$2 FOR UPDATE NOWAIT',[A,S]),e=>e.code==='55P03');await probe.query('ROLLBACK');parentLockProbed=true;if(parent.version!=='0')laterParentLockProbed=true}finally{await probe.end()}
    }
    return parent
   }}
  }
  const {locationAdmission:_,parentSchemaDigest:__,...sensitiveOptions}=options
  const privateHost=createSrmSensitiveOperationHost({...sensitiveOptions,application:{...options.application,operations:['supplier.private.read','supplier.private.reveal','supplier.private.export']},sensitiveBoundaryDigest:hash(own('010-supplier-sensitive-work.sql'))})
  options.readAcceptedKys=async(request,organisationId,nip)=>{
   const selection={nip,entityType:'COMPANY',section:'kys'}
   return (await privateHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.private.read',organisationId,resourceId:privateSupplierReportId(selection),payload:selection,request},(context,client)=>readPrivateSupplier(context,client,options.secret))).value
  }
  const runtime=createSupplierLocationRuntime(options),handler=createSupplierLocationHandler(runtime,A)
  const call=(body,user=U,key,org=A)=>handler(new Request(ORIGIN+'/api/supplier-locations?organisationId='+org,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Authorization:'Bearer external-'+user,...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)}))
  const page=(user=U,supplierId=S,org=A)=>call({action:'READ',supplierId,group:'ALL',offset:0,limit:100},user,undefined,org)
  const command={action:'CREATE',supplierId:S,locationId:null,expectedVersion:null,command:manual},key='manual_create_'+randomUUID()
  await t.test('ordinary login is non-owner/no-bypass; missing count policy prevents all business effects',async()=>{
   assert.deepEqual((await pool.query('SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:false,rolcanlogin:true})
   if(p1)await assert.rejects(runtime.write({request:new Request(ORIGIN+'/api/supplier-locations',{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer external-'+U}}),organisationId:A,supplierId:S},'CREATE',null,null,manual,key),error=>{
    assert.equal(error.reasonCode,'LIMIT_POLICY_UNAVAILABLE',error.stack);return true
   })
   assert.equal((await call(command,U,key)).status,503);assert.equal((await owner.query('SELECT count(*)::int n FROM srm.supplier_locations')).rows[0].n,0)
   for(const operation of['supplier.location.write','supplier.location.sync'])await controlled(()=>owner.query(`INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity${p1?',quota_mode':''})VALUES($1,'srm',$2,$3,'ACTIVE','SYNTHETIC_REQUEST_COUNT',now()-interval '1 hour',now()+interval '2 hours',$4,100${p1?",'ROLLING_24H'":''})`,[randomUUID(),A,operation,future()]))
  })
  await t.test('manual create/retry/reload commits once, shares across users and preserves attribution',async()=>{
   const created=await call(command,U,key);assert.equal(created.status,202,await created.clone().text());const receipt=await created.json()
   if(p1){
    assert.equal(parentLockProbed,true,'real supplier lock held before first collection exists')
    const location=(await owner.query('SELECT location_id FROM srm.supplier_locations WHERE organization_id=$1 AND supplier_id=$2 AND origin=\'MANUAL\'',[A,S])).rows[0].location_id
    assert.equal((await call({action:'UPDATE',supplierId:S,locationId:location,expectedVersion:'1',command:manual},V,'parent_not_child_'+randomUUID())).status,403,'parent grant does not edit a child')
    // Explicit controlled test operator grants. Creation itself grants nothing.
    for(const user of[U,V])await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)VALUES($1,'srm',$2,$3,'ALLOW','supplier.location.write','supplier_report',$4)",[randomUUID(),A,user,location]))
   }
   assert.deepEqual(await(await call(command,U,key)).json(),receipt)
   if(p1)assert.equal(laterParentLockProbed,true,'same actual parent lock also held after collection creation')
   const r=await page(V);assert.equal(r.status,200,await r.clone().text());const result=await r.json();assert.equal(result.total,1);assert.equal(result.items[0].createdByUserId,U);assert.equal(result.items[0].updatedByUserId,U);assert.equal(result.items[0].origin,'MANUAL')
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_requests.intents WHERE status=\'ACCEPTED\'')).rows[0].n,1)
  })
  await t.test('another member edits with CAS, stale write fails, source fields and caller identity are rejected',async()=>{
   const location=(await(await page()).json()).items[0],change={action:'UPDATE',supplierId:S,locationId:location.id,expectedVersion:location.version,command:{...manual,label:'Updated by member'}}
   const r=await call(change,V,'manual_update_'+randomUUID());assert.equal(r.status,202,await r.clone().text())
   const current=(await(await page()).json()).items[0];assert.equal(current.createdByUserId,U);assert.equal(current.updatedByUserId,V)
   assert.equal((await call(change,V,'stale_update_'+randomUUID())).status,409)
   assert.equal((await call({...command,command:{...manual,createdByUserId:V}},U,'forged_actor_'+randomUUID())).status,400)
   assert.equal((await call({...command,organisationId:B},U,'forged_owner_'+randomUUID())).status,400)
  })
  await t.test('permission revocation, changed-payload replay and concurrent edits fail before an extra effect',async()=>{
   assert.equal((await call({...command,command:{...manual,label:'Changed payload'}},U,key)).status,409)
   const grant=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature)VALUES($1,'srm',$2,$3,'DENY','supplier.location.write','supplier_report')",[grant,A,V]))
   try{const row=(await(await page(V)).json()).items[0];assert.equal((await call({action:'UPDATE',supplierId:S,locationId:row.id,expectedVersion:row.version,command:manual},V,'no_write_grant_'+randomUUID())).status,403)}
   finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grant]))}
   const row=(await(await page()).json()).items[0],change={action:'UPDATE',supplierId:S,locationId:row.id,expectedVersion:row.version,command:{...manual,label:'Concurrent edit'}}
   const result=await Promise.all([call(change,U,'concurrent_one_'+randomUUID()),call(change,V,'concurrent_two_'+randomUUID())]);assert.deepEqual(result.map(v=>v.status).sort(),[202,409])
  })
  await t.test('direct SQL remains denied even with forged GUCs and accidental table ACLs',async()=>{
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON srm.supplier_locations TO ${ROLE}`)
   assert.equal((await pool.query('SELECT srm.location_installation_descriptor() AS d')).rows[0].d,null)
   const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('profitia.user_id',$1,true),set_config('profitia.organisation_id',$2,true)",[U,A]);assert.equal((await client.query('SELECT * FROM srm.supplier_locations')).rowCount,0);assert.equal((await client.query('UPDATE srm.supplier_locations SET lifecycle=\'INACTIVE\'')).rowCount,0)}finally{await client.query('ROLLBACK');client.release()}
   await owner.query(`REVOKE ALL ON srm.supplier_locations FROM ${ROLE}`)
   assert.equal((await pool.query('SELECT srm.location_installation_descriptor() AS d')).rows[0].d.locationBusinessSchemaDigest,hash(extension))
  })
  await t.test('accepted MGBI backfill and repeated sync use stable source IDs and never overwrite manual data',async()=>{
   const section=mapMgbiGeneralRecord({id:'synthetic-wp',identifiers:{pl_nip:NIP,pl_krs:'0000123456'},content:{current_excerpt:{dane:{dzial1:{danePodmiotu:{nazwa:'Company'},siedzibaIAdres:{adres:{ulica:'Prosta',nrDomu:'1',kodPocztowy:'00-001',miejscowosc:'Warszawa',kraj:'Polska'}}}}}}},new Date().toISOString()).section
   await owner.query('INSERT INTO srm.catalog_companies(nip,general_json,general_sha256,general_checked_at)VALUES($1,$2::jsonb,$3,now())',[NIP,JSON.stringify(section),hash(JSON.stringify(section))])
   const first=await call({action:'SYNC',supplierId:S});assert.equal(first.status,200,await first.clone().text());const receipt=await first.json()
   assert.deepEqual(await(await call({action:'SYNC',supplierId:S})).json(),receipt)
   const values=(await(await page()).json()).items;assert.equal(values.length,2);assert.equal(values.filter(v=>v.origin==='MANUAL').length,1);assert.equal(values.find(v=>v.kind==='HEADQUARTERS').address.line1,section.data.registeredAddress)
   const ownId=values.find(v=>v.origin==='MANUAL').id
   await call({action:'UPDATE',supplierId:S,locationId:ownId,expectedVersion:values.find(v=>v.id===ownId).version,command:{...manual,label:'Manual survives source retry'}},V,'manual_after_sync_'+randomUUID())
   assert.deepEqual(await(await call({action:'SYNC',supplierId:S})).json(),receipt)
  })
  await t.test('new accepted MGBI address version updates one stable HQ and preserves manual locations',async()=>{
   const before=(await(await page()).json()).items,hq=before.find(v=>v.kind==='HEADQUARTERS')
   const section=(await owner.query('SELECT general_json FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows[0].general_json
   section.retrievedAt=new Date().toISOString();section.data.registeredAddress='Nowa 20, 00-002, Warszawa, Polska'
   await owner.query('UPDATE srm.catalog_companies SET general_json=$2::jsonb,general_sha256=$3,general_checked_at=now() WHERE nip=$1',[NIP,JSON.stringify(section),hash(JSON.stringify(section))])
   const sync=await call({action:'SYNC',supplierId:S});assert.equal(sync.status,200,await sync.clone().text())
   const after=(await(await page()).json()).items,current=after.find(v=>v.kind==='HEADQUARTERS');assert.equal(current.id,hq.id);assert.notEqual(current.addressVersion,hq.addressVersion);assert.match(current.address.line1,/Nowa/);assert.equal(after.filter(v=>v.origin==='MANUAL').length,1)
  })
  await t.test('limited UAT blocks KYS/ALL reads and never calls an available KYS reader during actual MGBI sync',async()=>{
   let kysCalls=0
   const limited=createSupplierLocationHandler(createSupplierLocationRuntime({...options,sourceScope:'HEADQUARTERS_MANUAL',readAcceptedKys:async()=>{kysCalls++;throw Error('KYS must not be called')}}),A)
   const request=body=>limited(new Request(ORIGIN+'/api/supplier-locations',{method:'POST',headers:{Authorization:'Bearer external-'+U,Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(body)}))
   for(const group of ['RELATED_ENTITIES','ALL'])assert.equal((await request({action:'READ',supplierId:S,group,offset:0,limit:50})).status,403)
   const before=(await owner.query("SELECT count(*)::int n FROM srm.supplier_locations WHERE location_group='RELATED_ENTITIES'")).rows[0].n
   const sync=await request({action:'SYNC',supplierId:S});assert.equal(sync.status,200,await sync.clone().text());assert.equal(kysCalls,0)
   assert.equal((await owner.query("SELECT count(*)::int n FROM srm.supplier_locations WHERE location_group='RELATED_ENTITIES'")).rows[0].n,before)
   for(const group of ['SUPPLIER_LOCATIONS','USER_LOCATIONS']){const response=await request({action:'READ',supplierId:S,group,offset:0,limit:50});assert.equal(response.status,200);assert((await response.json()).items.every(v=>v.group===group&&v.sources.every(s=>s.kind!=='KYS')))}
  })
  await t.test('current KYS legal entities reconcile, exact source revocation withholds them and retention physically removes derivatives',async()=>{
   const snapshot=randomUUID(),request=randomUUID(),attempt=randomUUID(),retrieved=new Date(Date.now()-5000).toISOString(),until=new Date(Date.now()+3600000).toISOString()
   const data={relatedEntities:[{name:'Related company',krs:'0000999999',nip:null,regon:null,role:'SUBSIDIARY',relationshipStart:'2020-01-01',relationshipEnd:null,stakeDescription:null,sanctionsMatch:null}]}
   const envelope={status:'PARTIAL',source:{provider:'VERCLY',model:'kys',recordId:null},retrievedAt:retrieved,effectiveAt:null,warnings:[],data}
   await owner.query('BEGIN;SET LOCAL session_replication_role=replica')
   await owner.query("INSERT INTO srm.lookup_requests(organization_id,id,supplier_id,identifier_type,identifier,entity_type)VALUES($1,$2,$3,'NIP',$4,'COMPANY')",[A,request,S,NIP])
   await owner.query("INSERT INTO srm.provider_attempts(organization_id,id,request_id,section,provider,attempt_no,status,completed_at)VALUES($1,$2,$3,'kys','VERCLY',1,'SUCCESS',now())",[A,attempt,request])
   await owner.query("INSERT INTO srm.source_snapshots(organization_id,id,attempt_id,supplier_id,section,payload_json,payload_sha256,data_class,retrieved_at,retention_until)VALUES($1,$2,$3,$4,'kys',$5::jsonb,$6,'KYS_PERSONAL',$7,$8)",[A,snapshot,attempt,S,JSON.stringify(data),hash(JSON.stringify(data)),retrieved,until])
   await owner.query("INSERT INTO srm.section_projections(organization_id,supplier_id,snapshot_id,section,projection_version,data_json,private_envelope)VALUES($1,$2,$3,'kys',2,$4::jsonb,$5::jsonb)",[A,S,snapshot,JSON.stringify(data),JSON.stringify(envelope)])
   await owner.query('COMMIT')
   assert.equal((await owner.query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'O'")).rows[0].n,0)
   const relatedNip='5272443955',relatedSection=mapMgbiGeneralRecord({id:'related-accepted',identifiers:{pl_nip:relatedNip,pl_krs:'0000999999'},content:{current_excerpt:{dane:{dzial1:{danePodmiotu:{nazwa:'Related company'},siedzibaIAdres:{adres:{ulica:'Powiązana',nrDomu:'1',kodPocztowy:'00-003',miejscowosc:'Warszawa',kraj:'Polska'}}}}}}},retrieved).section
   await owner.query('INSERT INTO srm.catalog_companies(nip,general_json,general_sha256,general_checked_at)VALUES($1,$2::jsonb,$3,now())',[relatedNip,JSON.stringify(relatedSection),hash(JSON.stringify(relatedSection))])
   const privateResponse=await options.readAcceptedKys(new Request(ORIGIN,{headers:{Authorization:'Bearer external-'+U,Origin:ORIGIN}}),A,NIP);assert.equal(privateResponse.status,200);assert.equal((await privateResponse.clone().json()).privateReport.snapshotId,snapshot)
   const r=await call({action:'SYNC',supplierId:S});assert.equal(r.status,200,await r.clone().text())
   const related=(await(await page(V)).json()).items.filter(v=>v.group==='RELATED_ENTITIES');assert.equal(related.length,1);assert.match(related[0].address.line1,/Powiązana/);assert.equal(related[0].sources[0].version,snapshot)
   const addressGrant=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)VALUES($1,'srm',$2,$3,'DENY','supplier.report.read','supplier_report',$4)",[addressGrant,A,V,'supplier-report:COMPANY:'+relatedNip]));const masked=(await(await page(V)).json()).items.find(v=>v.group==='RELATED_ENTITIES');assert(masked);assert.equal(masked.address,null);assert.equal(masked.coordinates,null);assert.equal(masked.sources.length,1);await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[addressGrant]))
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature)VALUES($1,'srm',$2,$3,'DENY','supplier.private.read','supplier_report')",[randomUUID(),A,V]))
   assert.equal((await(await page(V)).json()).items.filter(v=>v.group==='RELATED_ENTITIES').length,0)
   assert.equal((await(await page()).json()).items.filter(v=>v.group==='RELATED_ENTITIES').length,1)
   await owner.query("UPDATE srm.supplier_locations SET retention_until=now()-interval '1 second' WHERE location_group='RELATED_ENTITIES'")
   assert.equal((await(await page()).json()).items.filter(v=>v.group==='RELATED_ENTITIES').length,0)
   assert.equal((await owner.query("SELECT count(*)::int n FROM srm.supplier_locations WHERE location_group='RELATED_ENTITIES'")).rows[0].n,0)
  })
  await t.test('expired Google cache is physically cleared while source address survives',async()=>{
   const clock=Date.now(),coords={position:{lat:52,lng:21},origin:'GOOGLE_GEOCODING',fetchedAt:new Date(clock-31*86400000).toISOString(),expiresAt:new Date(clock-86400000).toISOString()}
   await owner.query("UPDATE srm.supplier_locations SET body=jsonb_set(body,'{coordinates}',$1::jsonb) WHERE kind='HEADQUARTERS'",[JSON.stringify(coords)])
   const current=(await(await page()).json()).items.find(v=>v.kind==='HEADQUARTERS');assert.equal(current.coordinates,null);assert(current.address.line1)
   assert.equal((await owner.query("SELECT body->'coordinates' AS c FROM srm.supplier_locations WHERE kind='HEADQUARTERS'")).rows[0].c,null)
  })
  await t.test('an OUTCOME audit failure rolls back the entire manual record and Root reservation',async()=>{
   const before=(await owner.query('SELECT count(*)::int n FROM srm.supplier_locations')).rows[0].n
   await controlled(()=>owner.query("CREATE FUNCTION srm.fixture_reject_outcome() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'Synthetic audit outage';END IF;RETURN NEW;END$$;CREATE TRIGGER fixture_reject_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION srm.fixture_reject_outcome()"))
   try{assert.equal((await call(command,U,'audit_outage_'+randomUUID())).status,503);assert.equal((await owner.query('SELECT count(*)::int n FROM srm.supplier_locations')).rows[0].n,before)}
   finally{await controlled(()=>owner.query('DROP TRIGGER fixture_reject_outcome ON profitia_access.security_events;DROP FUNCTION srm.fixture_reject_outcome()'))}
  })
  await t.test('actual geocode SERVICE preserves the initiating user, zero allowance, address CAS, cache reuse and revocation',async st=>{
   const request=new Request(ORIGIN,{headers:{Authorization:'Bearer external-'+U,Origin:ORIGIN}})
   assert.deepEqual(await createSrmLocationGeocodingRequest(sensitiveOptions).request(),{status:'WAITING_OWNER',paidCalls:0})
   const job={schemaDigest:hash(core('007-delegated-jobs.sql')),targetOperation:'supplier.location.geocode',supplierSchemaDigest:hash(core('013-supplier-delegation.sql')),operationSchemaDigest:hash(core('017-additional-request-operations.sql')),locationSchemaDigest:hash(core('019-supplier-location-operations.sql'))}
   const geo=createSrmLocationGeocodingRequest(options,{executorApplicationId:WORKER_APP,job})
   const grant=randomUUID(),binding=randomUUID(),execution=randomUUID()
   await controlled(async()=>{
    await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature)VALUES($1,'srm',$2,$3,'ALLOW','supplier.location.geocode','supplier_report')",[grant,A,U])
    await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at)VALUES($1,'srm','supplier.location.geocode',$2,'SUPPLIER_INTELLIGENCE_STANDALONE','locations-test-v1',$3,'stored.technical-command','synthetic-source','synthetic-branch','synthetic_source','synthetic-source-app',$4,'technical-command-v1','quality-v1','technical-v1',300,3,'ACTIVE','SYNTHETIC_NO_NETWORK',$5)",[binding,ROLE,WORKER_APP,'a'.repeat(64),future()])
    await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at)VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[execution,WORKER,binding,A,future()])
    for(const[unit,mode]of[['MAPS_GEOCODE_READ','READ'],['MAPS_GEOCODE_SAVE','WRITE']])await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at)VALUES('srm',$1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[unit,mode,future()])
   })
   const row=await call({...command,command:{...manual,label:'Geo target',position:null}},U,'geo_manual_'+randomUUID());assert.equal(row.status,202)
   const location=(await(await page()).json()).items.find(v=>v.label==='Geo target'),input={request,organisationId:A,supplierId:S,locationId:location.id}
   if(p1)await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)VALUES($1,'srm',$2,$3,'ALLOW','supplier.location.write','supplier_report',$4)",[randomUUID(),A,U,location.id]))
   await assert.rejects(geo.request(input),e=>isOperationDenied(e)&&e.reasonCode==='LIMIT_POLICY_UNAVAILABLE')
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_requests.intents WHERE operation='supplier.location.geocode'")).rows[0].n,0)
   await controlled(()=>owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity)VALUES($1,'srm',$2,'supplier.location.geocode','ACTIVE','SYNTHETIC_FINITE_REQUESTS_NOT_GOOGLE_BUDGET',now()-interval '1 hour',now()+interval '2 hours',$3,10)",[randomUUID(),A,future()]))
   const wrong=createSrmLocationGeocodingRequest(options,{executorApplicationId:'incorrect-executor',job});await assert.rejects(wrong.request(input),isOperationDenied)
   const admitted=await geo.request(input);assert.equal(admitted.status,'ACCEPTED');assert.deepEqual((await geo.request(input)).receipt,admitted.receipt)
   const workerUrl=new URL(url);workerUrl.username=WORKER;workerUrl.password='isolated_ci_only';workPool=new pg.Pool({connectionString:workerUrl.toString(),max:3});workAudit=new pg.Pool({connectionString:workerUrl.toString(),max:1})
   const worker=createDelegatedNativeWorkHost({application:{appId:WORKER_APP,profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'geo-fixture',configurationVersion:'geo-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},
    binding:{...options.binding,applicationId:WORKER_APP,role:WORKER,service:{schemaDigest:hash(core('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'geo-fixture',configurationVersion:'geo-v1'}},job,privateWork:{schemaDigest:hash(core('016-delegated-native-work.sql'))},...createSrmNativePgDriver(workPool,workAudit),
    readExternalAccount:createClerkAccountStatusReader({environment:'development',issuer:ISSUER,client:clerk})})
   const domain=createSrmLocationGeocodingDomain(hash(extension)),workInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,resourceId:admitted.receipt.requestId,payload:admitted.payload,request:null}
   let selection,calls=0
   const read=()=>worker.runSqlWork(workInput,{unitId:'MAPS_GEOCODE_READ',accessMode:'READ',inputDigest:operationPayloadDigest({requestId:workInput.resourceId})},async(context,client)=>{calls++;assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,U);assert.notEqual(context.actorId,U);selection=await domain.readCurrent(context,client)})
   await controlled(()=>owner.query("UPDATE profitia_jobs.execution_grants SET status='REVOKED' WHERE grant_id=$1",[execution]));await assert.rejects(read(),isOperationDenied);assert.equal(calls,0);await controlled(()=>owner.query("UPDATE profitia_jobs.execution_grants SET status='ACTIVE' WHERE grant_id=$1",[execution]))
   await read();assert.equal(selection.locationId,location.id);assert.equal(selection.alreadyResolved,false)
   const result={status:'resolved',position:{lat:52.1,lng:21.1},placeId:'synthetic-only',formatted_address:'MUST_NOT_PERSIST'}
   const save=()=>worker.runSqlWork(workInput,{unitId:'MAPS_GEOCODE_SAVE',accessMode:'WRITE',inputDigest:operationPayloadDigest({requestId:workInput.resourceId,result})},async(context,client)=>domain.storeCurrent(context,client,selection,result))
   await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE grant_id=$1",[grant]));await assert.rejects(save(),isOperationDenied);await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE grant_id=$1",[grant]))
   await save();const cached=(await(await page()).json()).items.find(v=>v.id===location.id);assert.equal(cached.coordinates.origin,'GOOGLE_GEOCODING');assert.equal(cached.updatedByUserId,U);assert.equal(Date.parse(cached.coordinates.expiresAt)-Date.parse(cached.coordinates.fetchedAt),29*86400000);assert.doesNotMatch(JSON.stringify(cached),/MUST_NOT_PERSIST/)
   await read();assert.equal(selection.alreadyResolved,true);assert.deepEqual(await geo.request(input),{status:'RESOLVED',paidCalls:0})
   await st.test('transient completion retains only CAS/audit metadata and refuses replay, wrong digest and foreign target',async()=>{
    const migration=own('018-transient-location-geocoding.sql')
    await controlled(async()=>{
     await owner.query(migration)
     await owner.query("INSERT INTO srm.transient_location_geocoding_installation VALUES(true,'1.0.0',$1,$2)",[hash(migration),'a'.repeat(40)])
     await owner.query(`GRANT EXECUTE ON FUNCTION srm.location_geocode_transient_complete(uuid,uuid,text,bigint,text) TO ${WORKER}`)
    })
    assert.equal((await owner.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[ROLE,'srm.location_geocode_transient_complete(uuid,uuid,text,bigint,text)'])).rows[0].allowed,false)
    await call({...command,command:{...manual,label:'Ephemeral target',position:null}},U,'transient_manual_'+randomUUID())
    const target=(await(await page()).json()).items.find(v=>v.label==='Ephemeral target')
    const accepted=await geo.request({...input,locationId:target.id}),nativeInput={...workInput,resourceId:accepted.receipt.requestId,payload:accepted.payload}
    const transient=createSrmTransientGeocodingDomain(hash(extension),hash(migration));let selected
    await worker.runSqlWork(nativeInput,{unitId:'MAPS_GEOCODE_READ',accessMode:'READ',inputDigest:operationPayloadDigest({transient:'read'})},async(ctx,client)=>{selected=await transient.readCurrent(ctx,client)})
    const save=domain=>worker.runSqlWork(nativeInput,{unitId:'MAPS_GEOCODE_SAVE',accessMode:'WRITE',inputDigest:operationPayloadDigest({transient:'save',result})},async(ctx,client)=>domain.storeCurrent(ctx,client,selected,result))
    await assert.rejects(save(createSrmTransientGeocodingDomain(hash(extension),'0'.repeat(64))))
    assert.equal(transient.result(),undefined)
    await save(transient)
    const current=(await(await page()).json()).items.find(v=>v.id===target.id),position=transient.result()
    assert.equal(current.coordinates,null);assert.equal(current.geocodingStatus,'UNREQUESTED');assert.equal(current.version,String(Number(target.version)+1));assert.equal(current.updatedByUserId,U)
    assert.deepEqual(position.coordinates.position,result.position);assert.equal(position.version,current.version)
    assert(Date.parse(position.coordinates.expiresAt)-Date.parse(position.coordinates.fetchedAt)<=15*60000)
    assert.doesNotMatch(JSON.stringify(current),/synthetic-only|MUST_NOT_PERSIST|GOOGLE_GEOCODING/)
    await assert.rejects(save(transient),'completed CAS cannot be reused')
    await assert.rejects(geo.request({...input,organisationId:B,locationId:target.id}),isOperationDenied)
    const reconciliation=own('019-geocoding-reconciliation.sql')
    await assert.rejects(owner.query(reconciliation),e=>e.code==='42501')
    await controlled(()=>owner.query(reconciliation))
    for(const role of[ROLE,WORKER])assert.equal((await owner.query("SELECT has_table_privilege($1,'srm.location_geocoding_reconciliations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS allowed",[role])).rows[0].allowed,false)
    const insert="INSERT INTO srm.location_geocoding_reconciliations(organisation_id,supplier_id,location_id,previous_version,new_version,address_version,previous_request_id,previous_status,new_status,observed_source_calls,operator_login,reason,source_ref) VALUES($1,$2,$3,1,2,$4,$5,'DELIVERY_UNCERTAIN','UNREQUESTED',$6,session_user,'SYNTHETIC_LOCAL_NOT_SENT_PROOF',$7)"
    const values=[A,S,target.id,target.addressVersion,accepted.receipt.requestId,0,'a'.repeat(40)]
    await assert.rejects(controlled(()=>owner.query(insert,[...values.slice(0,5),1,values[6]])),e=>e.code==='23514')
    await controlled(()=>owner.query(insert,values))
    await assert.rejects(controlled(()=>owner.query("UPDATE srm.location_geocoding_reconciliations SET reason='rewrite'")),e=>e.code==='42501')
    await assert.rejects(controlled(()=>owner.query('TRUNCATE srm.location_geocoding_reconciliations')),e=>e.code==='42501')
    assert.equal((await owner.query('SELECT count(*)::int n FROM srm.location_geocoding_reconciliations')).rows[0].n,1)
   })
   // A SOURCE location is rechecked against the exact currently accepted
   // MGBI version, under the narrow controlled metadata policy for SERVICE.
   const hq=(await(await page()).json()).items.find(v=>v.kind==='HEADQUARTERS'),normalized={line1:'Nowa 20',postalCode:'00-002',locality:'Warszawa',country:'Polska'}
   await owner.query("UPDATE srm.supplier_locations SET body=jsonb_set(body,'{address}',$2::jsonb) WHERE location_id=$1",[hq.id,JSON.stringify(normalized)])
   const sourceRequest=await geo.request({...input,locationId:hq.id});assert.equal(sourceRequest.status,'ACCEPTED')
   const sourceInput={...workInput,resourceId:sourceRequest.receipt.requestId,payload:sourceRequest.payload};let sourceSelection
   await worker.runSqlWork(sourceInput,{unitId:'MAPS_GEOCODE_READ',accessMode:'READ',inputDigest:operationPayloadDigest({requestId:sourceInput.resourceId})},async(context,client)=>{sourceSelection=await domain.readCurrent(context,client)})
   const original=(await owner.query('SELECT general_sha256 FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows[0].general_sha256
   await owner.query('UPDATE srm.catalog_companies SET general_sha256=$2 WHERE nip=$1',[NIP,'f'.repeat(64)])
   try{await assert.rejects(worker.runSqlWork(sourceInput,{unitId:'MAPS_GEOCODE_SAVE',accessMode:'WRITE',inputDigest:operationPayloadDigest({requestId:sourceInput.resourceId,result})},async(context,client)=>domain.storeCurrent(context,client,sourceSelection,result)),isOperationDenied)}
   finally{await owner.query('UPDATE srm.catalog_companies SET general_sha256=$2 WHERE nip=$1',[NIP,original])}
   assert.equal((await owner.query("SELECT body->'coordinates' AS c FROM srm.supplier_locations WHERE location_id=$1",[hq.id])).rows[0].c,null)
   const oldSelection=selection,currentEditVersion=(await(await page()).json()).items.find(v=>v.id===location.id).version,editKey='geo_changed_'+randomUUID(),editCommand={...manual,label:'Geo target changed',address:{...manual.address,line1:'Different 20'},position:null};await runtime.write({request:new Request(ORIGIN+'/api/supplier-locations',{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer external-'+U}}),organisationId:A,supplierId:S},'UPDATE',location.id,currentEditVersion,editCommand,editKey)
   selection=oldSelection;await assert.rejects(save(),isOperationDenied)
   const current=(await(await page()).json()).items.find(v=>v.id===location.id);assert.equal(current.coordinates,null);assert.equal(current.address.line1,'Different 20')
  })
  await t.test('more than 500 eligible related companies persist and remain paged, with no provider acquisition',async()=>{
   const snapshot=randomUUID(),request=randomUUID(),attempt=randomUUID(),retrieved=new Date().toISOString(),until=future()
   const data={relatedEntities:Array.from({length:501},(_,i)=>({name:'Legal company '+i,krs:String(i+1).padStart(10,'0'),nip:null,regon:null,role:'SUBSIDIARY',relationshipStart:null,relationshipEnd:null,stakeDescription:null,sanctionsMatch:null}))}
   const envelope={status:'SUCCESS',source:{provider:'VERCLY',model:'kys',recordId:null},retrievedAt:retrieved,effectiveAt:null,warnings:[],data}
   await owner.query('BEGIN;SET LOCAL session_replication_role=replica')
   await owner.query("INSERT INTO srm.lookup_requests(organization_id,id,supplier_id,identifier_type,identifier,entity_type)VALUES($1,$2,$3,'NIP',$4,'COMPANY')",[A,request,S,NIP])
   await owner.query("INSERT INTO srm.provider_attempts(organization_id,id,request_id,section,provider,attempt_no,status,completed_at)VALUES($1,$2,$3,'kys','VERCLY',1,'SUCCESS',now())",[A,attempt,request])
   await owner.query("INSERT INTO srm.source_snapshots(organization_id,id,attempt_id,supplier_id,section,payload_json,payload_sha256,data_class,retrieved_at,retention_until)VALUES($1,$2,$3,$4,'kys',$5::jsonb,$6,'KYS_PERSONAL',$7,$8)",[A,snapshot,attempt,S,JSON.stringify(data),hash(JSON.stringify(data)),retrieved,until])
   await owner.query("INSERT INTO srm.section_projections(organization_id,supplier_id,snapshot_id,section,projection_version,data_json,private_envelope)VALUES($1,$2,$3,'kys',2,$4::jsonb,$5::jsonb)",[A,S,snapshot,JSON.stringify(data),JSON.stringify(envelope)])
   await owner.query('COMMIT');assert.equal((await owner.query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'O'")).rows[0].n,0)
   const sync=await call({action:'SYNC',supplierId:S});assert.equal(sync.status,200,await sync.clone().text())
   const first=await call({action:'READ',supplierId:S,group:'RELATED_ENTITIES',offset:0,limit:100});const result=await first.json();assert.equal(result.total,501);assert.equal(result.items.length,100);assert.equal(result.hasMore,true)
   const last=await(await call({action:'READ',supplierId:S,group:'RELATED_ENTITIES',offset:500,limit:100})).json();assert.equal(last.total,501);assert.equal(last.items.length,1);assert.equal(last.hasMore,false)
   assert.equal((await owner.query("SELECT count(*)::int n FROM srm.supplier_locations WHERE location_group='RELATED_ENTITIES'")).rows[0].n,501)
   await assert.rejects(pool.query('SELECT srm.location_expire_controlled()'),e=>e.code==='42501')
   const receipt=await controlled(()=>owner.query('SELECT srm.location_expire_controlled() AS value'));assert.deepEqual(receipt.rows[0].value,{expiredCoordinates:0,expiredDerivedLocations:0})
  })
  await t.test('cross-org supplier, absent session and current revocation deny list and writes',async()=>{
   assert.equal((await page(U,SB,A)).status,403);assert.equal((await page(U,S,B)).status,403)
   assert.equal((await page(randomUUID())).status,401)
   await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED'WHERE organisation_id=$1 AND user_id=$2",[A,V]));assert.equal((await page(V)).status,403)
   assert.equal((await page(U)).status,200)
  })
  await t.test('deactivation keeps audit/history, malformed inputs and pagination are bounded',async()=>{
   const row=(await(await page()).json()).items.find(v=>v.origin==='MANUAL')
   const r=await call({action:'DEACTIVATE',supplierId:S,locationId:row.id,expectedVersion:row.version,command:null},U,'manual_deactivate_'+randomUUID());assert.equal(r.status,202,await r.clone().text())
   assert.equal((await(await page()).json()).items.filter(v=>v.id===row.id).length,0)
   assert.equal((await owner.query('SELECT lifecycle FROM srm.supplier_locations WHERE location_id=$1',[row.id])).rows[0].lifecycle,'INACTIVE')
   assert.equal((await call({action:'READ',supplierId:S,group:'ALL',offset:0,limit:501})).status,400)
   assert.equal((await call({action:'SYNC',supplierId:S,url:'https://attacker.test'})).status,400)
  })
  if(p1){
   await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,V]))
   const accepted=async operation=>Number((await owner.query("SELECT count(*)::int AS n FROM profitia_requests.intents WHERE organisation_id=$1 AND operation=$2 AND status='ACCEPTED'",[A,operation])).rows[0].n)
   await t.test('real SRM WRITE100/101 shares a rolling organisation quota across actors; rotation/replay cannot reset it',async()=>{
    let winner
    for(let i=await accepted('supplier.location.write');i<100;i++){
     const actor=i%2?U:V,key='srm_quota_write_'+randomUUID(),r=await call(command,actor,key)
     assert.equal(r.status,202,await r.clone().text());winner={actor,key}
    }
    assert.equal(await accepted('supplier.location.write'),100)
    assert.equal((await call(command,U,'srm_write_101_'+randomUUID())).status,429)
    assert.equal((await call(command,winner.actor,winner.key)).status,202)
    await controlled(async()=>{
     await owner.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE organisation_id=$1 AND operation='supplier.location.write' AND status='ACTIVE'",[A])
     await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity,quota_mode)VALUES($1,'srm',$2,'supplier.location.write','ACTIVE','SYNTHETIC_ROTATION',now()-interval '1 hour',now()+interval '2 hours',$3,100,'ROLLING_24H')",[randomUUID(),A,future()])
    })
    assert.equal((await call(command,V,'rotation_no_reset_'+randomUUID())).status,429)
    assert.equal((await call(command,winner.actor,winner.key)).status,202)
    assert.equal(await accepted('supplier.location.write'),100)
   })
   await t.test('real SRM SYNC100/101 shares the organisation quota; stable source replay costs0 and a new version costs1',async()=>{
    const syncRuntime=createSupplierLocationRuntime({...options,readAcceptedKys:undefined}),syncHandler=createSupplierLocationHandler(syncRuntime,A)
    const sync=actor=>syncHandler(new Request(ORIGIN+'/api/supplier-locations?organisationId='+A,{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer external-'+actor,'Content-Type':'application/json'},body:JSON.stringify({action:'SYNC',supplierId:S})}))
    const section=(await owner.query('SELECT general_json FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows[0].general_json
    const save=()=>owner.query('UPDATE srm.catalog_companies SET general_json=$2::jsonb,general_sha256=$3,general_checked_at=now() WHERE nip=$1',[NIP,JSON.stringify(section),hash(JSON.stringify(section))])
    let winner,last
    for(let i=await accepted('supplier.location.sync');i<100;i++){
     section.retrievedAt=new Date().toISOString();section.data.registeredAddress='Quota '+i+', 00-001, Warszawa, Polska';await save()
     winner=i%2?U:V;try{await syncRuntime.sync({request:new Request(ORIGIN+'/api/supplier-locations',{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer external-'+winner}}),organisationId:A,supplierId:S})}catch(error){assert.fail(error.stack)};const response=await sync(winner);assert.equal(response.status,200,await response.clone().text());last=structuredClone(section)
     assert.equal(await accepted('supplier.location.sync'),i+1)
     assert.equal((await sync(winner)).status,200);assert.equal(await accepted('supplier.location.sync'),i+1)
    }
    section.data.registeredAddress='Denied101, 00-001, Warszawa, Polska';await save();assert.equal((await sync(U)).status,429)
    Object.assign(section,last);await save();assert.equal((await sync(winner)).status,200);assert.equal(await accepted('supplier.location.sync'),100)
   })
   await t.test('actual SQL rolling boundary excludes exactly24h and allows the next SRM write after aging',async()=>{
    const boundary=(await owner.query("SELECT (min(accepted_at)+interval '24 hours')::text AS value FROM profitia_requests.intents WHERE organisation_id=$1 AND operation='supplier.location.write' AND status='ACCEPTED'",[A])).rows[0].value
    const result=(await owner.query("SELECT profitia_requests.location_rolling_used($1::uuid,'supplier.location.write',$2::timestamptz) AS used,(SELECT count(*) FROM profitia_requests.intents WHERE organisation_id=$1 AND operation='supplier.location.write' AND status='ACCEPTED' AND accepted_at>$2::timestamptz-interval '24 hours' AND accepted_at<=$2::timestamptz) AS expected",[A,boundary])).rows[0]
    assert.equal(result.used,result.expected);assert(Number(result.used)<100)
    // Only this isolated fixture owner ages synthetic timestamps. No live data.
    await controlled(async()=>{await owner.query('ALTER TABLE profitia_requests.intents DISABLE TRIGGER USER');try{await owner.query("UPDATE profitia_requests.intents SET accepted_at=clock_timestamp()-interval '24 hours' WHERE organisation_id=$1 AND operation='supplier.location.write'",[A])}finally{await owner.query('ALTER TABLE profitia_requests.intents ENABLE TRIGGER USER')}})
    assert.equal((await call(command,V,'aged_window_'+randomUUID())).status,202);assert.equal(await accepted('supplier.location.write'),101)
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'O'")).rows[0].n,0)
   })
  }
 }finally{
  await workPool?.end();await workAudit?.end();await pool?.end();await auditPool?.end();await owner?.end();await root.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH(FORCE)`);await root.end()
 }
})
