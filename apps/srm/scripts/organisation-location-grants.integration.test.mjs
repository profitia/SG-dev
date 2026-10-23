import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import {NextRequest} from 'next/server'
import {middleware} from '../middleware.ts'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {privateBusinessPlan} from '../db/private-store/initialize.mjs'
import {createSupplierLocationRuntime,createSupplierLocationHandler} from '../src/server/supplier-locations.ts'
import {createSrmSensitiveOperationHost,readPrivateSupplier,privateSupplierReportId} from '../src/server/supplier-sensitive-operation.ts'
import {createSrmLocationGeocodingDomain,createSrmLocationGeocodingRequest} from '../src/server/supplier-location-geocoding.ts'
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

for(const p1 of[true])test('organization location authority in actual SRM native E1 and HTTP',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const root=new pg.Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 let owner,pool,auditPool,workPool,workAudit
 const previousProvider=process.env.PROFITIA_AUTH_PROVIDER
 process.env.PROFITIA_AUTH_PROVIDER='clerk'
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
  for(const[org,id,slug]of[[A,S,'alpha'],[B,SB,'beta']]){await owner.query('INSERT INTO srm.organizations(id,slug)VALUES($1,$2)',[org,slug]);await owner.query('INSERT INTO srm.suppliers(organization_id,id,nip,krs)VALUES($1,$2,$3,$4)',[org,id,NIP,null])}
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
  const addon=core('022-organisation-location-grants.sql'),consumer=own('017-organisation-location-grants.sql')
  await t.test('exact optional producer and consumer install atomically, with rollback proof',async()=>{
   await assert.rejects(controlled(async()=>{await owner.query(addon);throw Error('SYNTHETIC_INTERRUPTION')}))
   assert.equal((await owner.query("SELECT to_regclass('profitia_access.organisation_location_policies') AS value")).rows[0].value,null)
   await controlled(async()=>{
    await owner.query(addon);await owner.query("INSERT INTO profitia_access.organisation_location_installation VALUES(true,'1.0.0',$1,$2)",[hash(addon),'a'.repeat(40)])
    await owner.query(consumer);await owner.query("INSERT INTO srm.organisation_location_installation VALUES(true,'1.0.0',$1,$2)",[hash(consumer),'b'.repeat(40)])
    await owner.query("DELETE FROM profitia_access.permission_grants WHERE application_id='srm' AND operation LIKE 'supplier.location.%'")
    for(const operation of ['supplier.location.read','supplier.location.write','supplier.location.sync'])await owner.query("INSERT INTO profitia_access.organisation_location_policies(application_id,organisation_id,operation,resource_id,status,source_ref,expires_at) VALUES('srm',$1,$2,$3,'ACTIVE','SYNTHETIC_EXPLICIT_OWNER',$4)",[A,operation,'supplier-locations:'+S,future()])
    for(const operation of ['supplier.location.write','supplier.location.sync'])await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity,quota_mode) VALUES($1,'srm',$2,$3,'ACTIVE','SYNTHETIC_OWNER',now()-interval '1 day',now()+interval '2 days',now()+interval '2 days',100,'ROLLING_24H')",[randomUUID(),A,operation])
   })
  })
  const limited={...options,sourceScope:'HEADQUARTERS_MANUAL',readAcceptedKys:async()=>{throw Error('KYS is excluded')}}
  const runtime=createSupplierLocationRuntime(limited),handler=createSupplierLocationHandler(runtime,A)
  const call=async(body,user=U,key,org=A)=>{
   const request=new NextRequest(ORIGIN+'/api/supplier-locations?organisationId='+org,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Authorization:'Bearer external-'+user,...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)})
   const gate=await middleware(request)
   return gate.headers.get('x-middleware-next')==='1'?handler(request):gate
  }
  const page=(user=U,org=A,supplierId=S)=>call({action:'READ',supplierId,group:'USER_LOCATIONS',offset:0,limit:50},user,undefined,org)
  const key='org_manual_'+randomUUID(),command={action:'CREATE',supplierId:S,locationId:null,expectedVersion:null,command:manual}
  let location
  await t.test('admitted Clerk entry still rejects unverified identity in its actual E1 backend',async()=>{
   const r=await page('unverified-fixture-user');assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'private, no-store')
  })
  await t.test('CREATE and idempotent retry work with no individual location grants',async()=>{
   assert.equal((await owner.query("SELECT count(*)::int AS n FROM profitia_access.permission_grants WHERE operation LIKE 'supplier.location.%'")).rows[0].n,0)
   for(let i=0;i<2;i++){const r=await call(command,U,key);assert.equal(r.status,202,await r.clone().text())}
   const r=await page();assert.equal(r.status,200,await r.clone().text());const body=await r.json();assert.equal(body.total,1);location=body.items[0]
   const meta=(await owner.query('SELECT collection_id,location_id FROM profitia_access.organisation_location_children')).rows;assert.equal(meta.length,1);assert.equal(meta[0].location_id,location.id);assert.equal(meta[0].collection_id,'supplier-locations:'+S)
  })
  await t.test('second member reads and edits shared manual location; creator attribution remains',async()=>{
   const r=await page(V);assert.equal(r.status,200);assert.equal((await r.json()).items[0].id,location.id)
   const updated=await call({action:'UPDATE',supplierId:S,locationId:location.id,expectedVersion:location.version,command:{...manual,label:'Edited by another member'}},V,'org_edit_'+randomUUID());assert.equal(updated.status,202,await updated.clone().text())
   const row=(await owner.query('SELECT created_by_user_id,updated_by_user_id FROM srm.supplier_locations WHERE location_id=$1',[location.id])).rows[0];assert.equal(row.created_by_user_id,U);assert.equal(row.updated_by_user_id,V)
   location=(await(await page()).json()).items[0]
  })
  await t.test('MGBI headquarters sync is stable, keeps manual data and does not acquire KYS',async()=>{
   const section=mapMgbiGeneralRecord({id:'synthetic-org-wp',identifiers:{pl_nip:NIP,pl_krs:'0000123456'},content:{current_excerpt:{dane:{dzial1:{danePodmiotu:{nazwa:'Company'},siedzibaIAdres:{adres:{ulica:'Prosta',nrDomu:'1',kodPocztowy:'00-001',miejscowosc:'Warszawa',kraj:'Polska'}}}}}}},new Date().toISOString()).section
   await owner.query('INSERT INTO srm.catalog_companies(nip,general_json,general_sha256,general_checked_at) VALUES($1,$2::jsonb,$3,now())',[NIP,JSON.stringify(section),hash(JSON.stringify(section))])
   const a=await call({action:'SYNC',supplierId:S});assert.equal(a.status,200,await a.clone().text());const receipt=await a.json()
   assert.deepEqual(await(await call({action:'SYNC',supplierId:S})).json(),receipt)
   const hq=await call({action:'READ',supplierId:S,group:'SUPPLIER_LOCATIONS',offset:0,limit:50},V);assert.equal(hq.status,200);assert.equal((await hq.json()).total,1)
   assert.equal((await(await page()).json()).total,1)
  })
  await t.test('foreign organization, supplier and excluded KYS group are denied',async()=>{
   assert.equal((await page(U,B,SB)).status,403);assert.equal((await page(U,A,SB)).status,403)
   assert.equal((await call({action:'READ',supplierId:S,group:'RELATED_ENTITIES',offset:0,limit:50})).status,403)
  })
  await t.test('individual exact-child DENY overrides inherited WRITE without hiding legal READ',async()=>{
   const grant=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants VALUES($1,'srm',$2,$3,'DENY','supplier.location.write','supplier_report',$4)",[grant,A,V,location.id]))
   const r=await call({action:'UPDATE',supplierId:S,locationId:location.id,expectedVersion:location.version,command:manual},V,'org_denied_'+randomUUID());assert.equal(r.status,403);assert.equal((await page(V)).status,200)
   await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grant]))
  })
  await t.test('DEACTIVATE works through exact inherited child, and organization revoke removes READ',async()=>{
   const r=await call({action:'DEACTIVATE',supplierId:S,locationId:location.id,expectedVersion:location.version,command:null},V,'org_deactivate_'+randomUUID());assert.equal(r.status,202,await r.clone().text())
   assert.equal((await owner.query('SELECT lifecycle FROM srm.supplier_locations WHERE location_id=$1',[location.id])).rows[0].lifecycle,'INACTIVE')
   await controlled(()=>owner.query("UPDATE profitia_access.organisation_location_policies SET status='REVOKED' WHERE organisation_id=$1",[A]))
   assert.equal((await page()).status,403)
  })
 }finally{
  if(previousProvider===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=previousProvider
  await workPool?.end();await workAudit?.end();await pool?.end();await auditPool?.end();await owner?.end();await root.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH(FORCE)`);await root.end()
 }
})
